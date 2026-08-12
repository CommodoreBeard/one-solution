/**
 * Cell sets to millimetre outlines.
 *
 * The spec is explicit that "the exported geometry is generated independently
 * of the canvas — the screen is a view of the document, never the source of the
 * cut file", so nothing here touches the DOM, and a piece outline is derived
 * from its cells rather than read back from anything drawn.
 *
 * Two consequences of the tray edition make the layout trivial and worth
 * stating anyway: pieces are laid out **in their solved positions**, so nesting
 * is free by construction, and the tray outline is the target outline itself.
 * The document therefore has one coordinate system: the target's bounding box,
 * top-left at (0, 0), x to the right and y down, scaled by `cellSizeMm`.
 *
 * Boundaries are traced rather than drawn per cell, so a piece is one closed
 * polygon with the interior edges gone. The tray keeps every ring, because a
 * target with a hole in it has a hole in its tray.
 *
 * This module is internal. Tests reach it through the `buildPuzzle` seam.
 */

import { cellKey } from './grid';
import type { Geometry, Shape } from './types';

/**
 * A point in millimetres, as the export writers want it. Mutable, because
 * `Geometry` in types.ts spells its rings that way.
 */
type Point = [number, number];

interface Bounds {
  readonly minRow: number;
  readonly minCol: number;
  readonly rows: number;
  readonly cols: number;
}

function boundsOf(shape: Shape): Bounds {
  if (shape.length === 0) return { minRow: 0, minCol: 0, rows: 0, cols: 0 };
  let minRow = Infinity;
  let minCol = Infinity;
  let maxRow = -Infinity;
  let maxCol = -Infinity;
  for (const { row, col } of shape) {
    if (row < minRow) minRow = row;
    if (col < minCol) minCol = col;
    if (row > maxRow) maxRow = row;
    if (col > maxCol) maxCol = col;
  }
  return { minRow, minCol, rows: maxRow - minRow + 1, cols: maxCol - minCol + 1 };
}

/** A directed unit edge on the lattice, in grid coordinates. */
interface Edge {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/**
 * The boundary edges of a cell set, each directed so that the shape lies to the
 * *right* of travel. Outer rings then come out clockwise on screen and holes
 * anticlockwise, which is what tells them apart later.
 */
function boundaryEdges(shape: Shape): Edge[] {
  const inside = new Set(shape.map(cellKey));
  const edges: Edge[] = [];
  for (const { row, col } of shape) {
    const x = col;
    const y = row;
    if (!inside.has(cellKey({ row: row - 1, col }))) {
      edges.push({ x0: x, y0: y, x1: x + 1, y1: y });
    }
    if (!inside.has(cellKey({ row, col: col + 1 }))) {
      edges.push({ x0: x + 1, y0: y, x1: x + 1, y1: y + 1 });
    }
    if (!inside.has(cellKey({ row: row + 1, col }))) {
      edges.push({ x0: x + 1, y0: y + 1, x1: x, y1: y + 1 });
    }
    if (!inside.has(cellKey({ row, col: col - 1 }))) {
      edges.push({ x0: x, y0: y + 1, x1: x, y1: y });
    }
  }
  return edges;
}

const vertexKey = (x: number, y: number): string => `${x},${y}`;

/**
 * Chain boundary edges into closed rings.
 *
 * At a pinch point — two cells of the shape meeting only at a corner — two
 * edges leave the same vertex and the trace has a choice. It always takes the
 * sharpest right turn, the wall-follower's rule, which keeps every ring simple
 * instead of producing one figure-of-eight. Rings are emitted in a fixed order
 * and each starts at its own lowest vertex, so the geometry of a document does
 * not depend on the order cells happened to arrive in.
 */
function traceRings(shape: Shape): Point[][] {
  const edges = boundaryEdges(shape);
  const outgoing = new Map<string, number[]>();
  edges.forEach((edge, i) => {
    const key = vertexKey(edge.x0, edge.y0);
    const list = outgoing.get(key);
    if (list) list.push(i);
    else outgoing.set(key, [i]);
  });

  const used = new Array<boolean>(edges.length).fill(false);
  const order = edges
    .map((_, i) => i)
    .sort((a, b) => {
      const p = edges[a]!;
      const q = edges[b]!;
      return p.y0 - q.y0 || p.x0 - q.x0 || p.y1 - q.y1 || p.x1 - q.x1;
    });

  const rings: Point[][] = [];
  for (const start of order) {
    if (used[start]) continue;

    const ring: Point[] = [];
    let current = start;
    for (;;) {
      used[current] = true;
      const edge = edges[current]!;
      ring.push([edge.x0, edge.y0]);

      const candidates = (outgoing.get(vertexKey(edge.x1, edge.y1)) ?? []).filter(
        (i) => !used[i],
      );
      if (candidates.length === 0) break;

      const dx = edge.x1 - edge.x0;
      const dy = edge.y1 - edge.y0;
      // Screen coordinates: y runs down, so a right turn is (dx, dy) -> (-dy, dx).
      const preference = (i: number): number => {
        const next = edges[i]!;
        const nx = next.x1 - next.x0;
        const ny = next.y1 - next.y0;
        if (nx === -dy && ny === dx) return 0; // right
        if (nx === dx && ny === dy) return 1; // straight on
        if (nx === dy && ny === -dx) return 2; // left
        return 3; // back the way we came
      };
      current = candidates.reduce((best, i) =>
        preference(i) < preference(best) ? i : best,
      );
    }

    rings.push(rotateToLowest(ring));
  }
  return rings;
}

/** Start a ring at its lowest vertex, so equal rings are equal arrays. */
function rotateToLowest(ring: Point[]): Point[] {
  let at = 0;
  for (let i = 1; i < ring.length; i += 1) {
    const [x, y] = ring[i]!;
    const [bx, by] = ring[at]!;
    if (y < by || (y === by && x < bx)) at = i;
  }
  return [...ring.slice(at), ...ring.slice(0, at)];
}

/** Drop the middle point of every run of three collinear points. */
function simplify(ring: Point[]): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < ring.length; i += 1) {
    const [px, py] = ring[(i - 1 + ring.length) % ring.length]!;
    const [x, y] = ring[i]!;
    const [nx, ny] = ring[(i + 1) % ring.length]!;
    if ((x - px) * (ny - y) !== (y - py) * (nx - x)) out.push([x, y]);
  }
  return out;
}

/** Twice the signed area. Positive for a hole, negative for an outer ring. */
function signedArea(ring: readonly Point[]): number {
  let total = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [x0, y0] = ring[i]!;
    const [x1, y1] = ring[(i + 1) % ring.length]!;
    total += x0 * y1 - x1 * y0;
  }
  return total;
}

/**
 * Rings of a cell set in millimetres, relative to `bounds` and scaled by
 * `cellSizeMm`. Every coordinate is an exact multiple of the cell size, which
 * is what lets the export tests check scale by arithmetic rather than by eye.
 */
function ringsInMm(shape: Shape, bounds: Bounds, cellSizeMm: number): Point[][] {
  return traceRings(shape)
    .map(simplify)
    .map((ring) =>
      ring.map(
        ([x, y]): Point => [
          (x - bounds.minCol) * cellSizeMm,
          (y - bounds.minRow) * cellSizeMm,
        ],
      ),
    );
}

/**
 * The cut geometry for one puzzle: the tray, and every piece where it sits in
 * the solution.
 *
 * A piece is one closed outline, so if a piece ever enclosed a hole only its
 * outer boundary would be cut — impossible here, because a piece that encloses
 * anything is not a piece the growth step can produce, and the tray keeps its
 * rings regardless.
 *
 * Rings close implicitly: the last point joins the first, and the first point
 * is not repeated. That is what SVG's `z` and DXF's closed-polyline flag both
 * want, and it leaves no way to emit a ring that fails to close.
 */
export function buildGeometry(
  target: Shape,
  pieces: readonly Shape[],
  cellSizeMm: number,
): Geometry {
  const bounds = boundsOf(target);
  return {
    widthMm: bounds.cols * cellSizeMm,
    heightMm: bounds.rows * cellSizeMm,
    pieceOutlines: pieces.map((piece) => {
      const rings = ringsInMm(piece, bounds, cellSizeMm);
      // The outer ring is the one enclosing the most area; a well-formed piece
      // has exactly one.
      return rings.reduce(
        (best, ring) => (Math.abs(signedArea(ring)) > Math.abs(signedArea(best)) ? ring : best),
        rings[0] ?? [],
      );
    }),
    trayOutline: ringsInMm(target, bounds, cellSizeMm),
  };
}
