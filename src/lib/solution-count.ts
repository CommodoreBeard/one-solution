/**
 * Exact cover: how many distinct ways does this multiset of pieces repack the
 * target?
 *
 * Three rules make the count mean what the spec says it means:
 *
 * 1. **Search over piece *types*, not piece instances.** Congruent pieces are
 *    interchangeable — two identical dominoes swapping places is not a second
 *    solution — and grouping by congruence class makes that fall out for free.
 *    Pieces may be flipped, so the class is taken over all eight dihedral
 *    images.
 * 2. **Choose the next constraint to satisfy by a rule that reads only the
 *    cover state.** Every partition then has exactly one generation order, so
 *    each is produced once and no deduplication pass is needed. Knuth's
 *    minimum-remaining-values column choice qualifies, and is also the fastest
 *    rule available.
 * 3. **Abort at the cap.** Uniqueness needs only proof that a *second*
 *    arrangement exists, so the engine passes a cap of 2 and a search costs
 *    well under a millisecond. The reference oracle enumerated instead and took
 *    26 minutes on the pentomino 3x20 case.
 *
 * The matrix is Knuth's dancing links, held in flat typed arrays rather than
 * linked objects. Two earlier attempts are recorded here because both were
 * correct, both looked reasonable, and both were far too slow to run the
 * known-answer suite — the numbers are full enumerations of all four pentomino
 * rectangles:
 *
 *   - always filling the lowest uncovered cell, over a bitmask cover: nine
 *     minutes on 3x20 *alone*. Reading order walks into dead ends dozens of
 *     levels before noticing.
 *   - the same, plus a connected-region feasibility prune: about 90 seconds.
 *   - dancing links with minimum remaining values: about 11 seconds.
 *
 * Which constraint is chosen next, not how fast the cover state is tested, was
 * the whole difference. Dancing links also needs no region walk, and so has no
 * per-walk generation counter to overflow — a real hazard in the pruned
 * version, where 6x10 runs billions of walks and a wrapped counter silently
 * mis-sizes a region.
 *
 * This module is internal. Tests reach it through the `buildPuzzle` seam.
 */

import { cellKey } from './grid';
import { canonicalKey, distinctImages } from './transforms';
import type { Cell, Shape } from './types';

/** One way of cutting the target up: the pieces, in no particular order. */
export type Partition = readonly Shape[];

interface PieceType {
  readonly shape: Shape;
  readonly count: number;
}

/**
 * Group pieces by congruence class. The representative is arbitrary but
 * stable; only the class matters.
 */
function pieceTypes(pieces: readonly Shape[]): PieceType[] {
  const byClass = new Map<string, { shape: Shape; count: number }>();
  for (const piece of pieces) {
    const key = canonicalKey(piece);
    const existing = byClass.get(key);
    if (existing) existing.count += 1;
    else byClass.set(key, { shape: piece, count: 1 });
  }
  // Sorted by class key so the search order — and therefore the order pieces
  // come back in — does not depend on the caller's array order.
  return [...byClass.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, value]) => value);
}

/** Target cells in row-major order. An index into this array is a column id. */
function orderedCells(target: Shape): Cell[] {
  return target.slice().sort((a, b) => a.row - b.row || a.col - b.col);
}

interface Matrix {
  /** Column ids present in the matrix, cell columns first. */
  readonly columns: number[];
  /** One row per legal placement: the column ids it covers. */
  readonly rows: number[][];
  /** Which piece type each row places. */
  readonly rowType: number[];
}

/**
 * Build the cover matrix: a column per target cell, a row per legal placement
 * of a piece type anywhere inside the target.
 *
 * A piece type with exactly one copy also gets a column of its own, because
 * "use this piece once" is a genuine exact-cover constraint, and putting it in
 * the matrix is what lets the column chooser see that a piece has been spent.
 * Adding that column took the four known-answer cases from 90 seconds to 11.
 *
 * A type with *several* copies must not get one column per copy. That is
 * precisely the interchangeability bug the spec warns about: it would count
 * every partition once per permutation of the identical pieces, so a 2x2 square
 * cut into two dominoes would report 4 solutions instead of 2. Those types keep
 * a plain counter instead.
 */
function buildMatrix(types: readonly PieceType[], cells: readonly Cell[]): Matrix {
  const index = new Map<string, number>();
  cells.forEach((cell, i) => index.set(cellKey(cell), i));

  let minRow = Infinity;
  let minCol = Infinity;
  let maxRow = -Infinity;
  let maxCol = -Infinity;
  for (const { row, col } of cells) {
    if (row < minRow) minRow = row;
    if (col < minCol) minCol = col;
    if (row > maxRow) maxRow = row;
    if (col > maxCol) maxCol = col;
  }

  const n = cells.length;
  const typeColumn = types.map(({ count }, t) => (count === 1 ? n + t : -1));
  const columns = [...cells.keys(), ...typeColumn.filter((column) => column >= 0)];

  const rows: number[][] = [];
  const rowType: number[] = [];
  types.forEach(({ shape }, type) => {
    for (const image of distinctImages(shape)) {
      let height = 0;
      let width = 0;
      for (const { row, col } of image) {
        if (row > height) height = row;
        if (col > width) width = col;
      }
      for (let dr = minRow; dr + height <= maxRow; dr += 1) {
        for (let dc = minCol; dc + width <= maxCol; dc += 1) {
          const placed: number[] = [];
          let fits = true;
          for (const cell of image) {
            const at = index.get(cellKey({ row: cell.row + dr, col: cell.col + dc }));
            if (at === undefined) {
              fits = false;
              break;
            }
            placed.push(at);
          }
          if (!fits) continue;
          if (typeColumn[type]! >= 0) placed.push(typeColumn[type]!);
          rows.push(placed);
          rowType.push(type);
        }
      }
    }
  });

  return { columns, rows, rowType };
}

interface SearchOptions {
  /** Stop once this many partitions have been found. */
  readonly cap: number;
  /** Materialise each partition. Off by default because counting is hot. */
  readonly collect: boolean;
}

function search(
  target: Shape,
  pieces: readonly Shape[],
  { cap, collect }: SearchOptions,
): { count: number; partitions: Partition[] } {
  const cells = orderedCells(target);
  const n = cells.length;
  const none = { count: 0, partitions: [] as Partition[] };

  if (n === 0 || pieces.length === 0 || cap < 1) return none;
  // A multiset of the wrong area cannot cover the target, and checking here
  // keeps the recursion free of the special case. It also underwrites the claim
  // that a completed cover used every piece: with each type capped at its count
  // and the two areas equal, no type can be left over.
  let area = 0;
  for (const piece of pieces) area += piece.length;
  if (area !== n) return none;

  const types = pieceTypes(pieces);
  const { columns, rows, rowType } = buildMatrix(types, cells);
  if (rows.length === 0) return none;

  // Dancing links. Ids 0..n-1 are cell columns, n.. are piece columns, `root`
  // anchors the header ring, and row nodes follow. Flat typed arrays rather
  // than linked objects: the hot loop then touches no object property.
  const columnCount = n + types.length;
  const root = columnCount;
  let nodeCount = columnCount + 1;
  for (const row of rows) nodeCount += row.length;

  const left = new Int32Array(nodeCount);
  const right = new Int32Array(nodeCount);
  const up = new Int32Array(nodeCount);
  const down = new Int32Array(nodeCount);
  const columnOf = new Int32Array(nodeCount);
  const rowOf = new Int32Array(nodeCount);
  const size = new Int32Array(columnCount);

  columns.forEach((column, i) => {
    up[column] = column;
    down[column] = column;
    columnOf[column] = column;
    left[column] = i === 0 ? root : columns[i - 1]!;
    right[column] = i === columns.length - 1 ? root : columns[i + 1]!;
  });
  left[root] = columns[columns.length - 1]!;
  right[root] = columns[0]!;

  let next = columnCount + 1;
  rows.forEach((row, r) => {
    const first = next;
    for (const column of row) {
      const node = next;
      next += 1;
      columnOf[node] = column;
      rowOf[node] = r;
      down[node] = column;
      up[node] = up[column]!;
      down[up[column]!] = node;
      up[column] = node;
      size[column]! += 1;
      if (node === first) {
        left[node] = node;
        right[node] = node;
      } else {
        left[node] = node - 1;
        right[node] = first;
        right[node - 1] = node;
        left[first] = node;
      }
    }
  });

  const cover = (column: number): void => {
    right[left[column]!] = right[column]!;
    left[right[column]!] = left[column]!;
    for (let i = down[column]!; i !== column; i = down[i]!) {
      for (let j = right[i]!; j !== i; j = right[j]!) {
        up[down[j]!] = up[j]!;
        down[up[j]!] = down[j]!;
        size[columnOf[j]!]! -= 1;
      }
    }
  };

  const uncover = (column: number): void => {
    for (let i = up[column]!; i !== column; i = up[i]!) {
      for (let j = left[i]!; j !== i; j = left[j]!) {
        size[columnOf[j]!]! += 1;
        up[down[j]!] = j;
        down[up[j]!] = j;
      }
    }
    right[left[column]!] = column;
    left[right[column]!] = column;
  };

  const remaining = types.map(({ count }) => count);
  const chosen: number[] = [];
  const partitions: Partition[] = [];
  let count = 0;

  const recurse = (): void => {
    if (right[root] === root) {
      count += 1;
      if (collect) {
        partitions.push(
          // Piece columns are constraints, not cells, and are dropped here.
          chosen.map((row) => rows[row]!.filter((c) => c < n).map((c) => cells[c]!)),
        );
      }
      return;
    }

    // Minimum remaining values: branch on whichever constraint has the fewest
    // ways left to satisfy it.
    let column = -1;
    let fewest = Infinity;
    for (let c = right[root]!; c !== root; c = right[c]!) {
      const options = size[c]!;
      if (options < fewest) {
        fewest = options;
        column = c;
        if (options === 0) break;
      }
    }
    if (fewest === 0) return;

    cover(column);
    for (let node = down[column]!; node !== column; node = down[node]!) {
      const row = rowOf[node]!;
      const type = rowType[row]!;
      // Every copy of this piece is already placed, so the row is unavailable
      // on this branch even though it is still in the matrix.
      if (remaining[type] === 0) continue;
      remaining[type]! -= 1;
      chosen.push(row);
      for (let j = right[node]!; j !== node; j = right[j]!) cover(columnOf[j]!);
      recurse();
      for (let j = left[node]!; j !== node; j = left[j]!) uncover(columnOf[j]!);
      chosen.pop();
      remaining[type]! += 1;
      if (count >= cap) break;
    }
    uncover(column);
  };

  recurse();
  return { count, partitions };
}

/**
 * How many distinct partitions of `target` use exactly this piece multiset,
 * stopping at `cap`. A returned value equal to `cap` means "at least this
 * many", not "exactly this many".
 */
export function countPartitions(
  target: Shape,
  pieces: readonly Shape[],
  cap: number,
): number {
  return search(target, pieces, { cap, collect: false }).count;
}

/**
 * The partitions themselves, up to `cap`. Only the symmetry quotient and the
 * rejected-candidate display need these; uniqueness itself needs a count.
 */
export function findPartitions(
  target: Shape,
  pieces: readonly Shape[],
  cap: number,
): Partition[] {
  return search(target, pieces, { cap, collect: true }).partitions;
}
