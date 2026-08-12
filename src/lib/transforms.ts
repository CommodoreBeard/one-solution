/**
 * The dihedral group of order 8 acting on grid cells.
 *
 * A card piece can be turned face down, so the group includes reflections and
 * a piece is identified with all eight of its images. That clause is what makes
 * an S-tetromino and a Z-tetromino the same piece, and getting it wrong makes
 * the uniqueness guarantee false for the physical object.
 *
 * Every operation here maps points *individually*. The reference oracle's worst
 * bug came from sorting a point set before transforming it, which destroyed the
 * correspondence between a cell and its image; see reference/README.md.
 */

import { normalise } from './grid';
import type { Cell, Shape } from './types';

/** One element of the group, as a map on a single point. */
export type PointMap = (cell: Cell) => Cell;

/** A group element named by its quarter-turns and whether it reflects. */
export interface DihedralElement {
  readonly rot: 0 | 1 | 2 | 3;
  readonly flip: boolean;
}

/** All eight elements, in a fixed order so results are reproducible. */
export const DIHEDRAL: readonly DihedralElement[] = [
  { rot: 0, flip: false },
  { rot: 1, flip: false },
  { rot: 2, flip: false },
  { rot: 3, flip: false },
  { rot: 0, flip: true },
  { rot: 1, flip: true },
  { rot: 2, flip: true },
  { rot: 3, flip: true },
];

/** Build the point map for one group element. Reflect first, then rotate. */
export function pointMap({ rot, flip }: DihedralElement): PointMap {
  return ({ row, col }: Cell): Cell => {
    let r = row;
    let c = flip ? -col : col;
    for (let i = 0; i < rot; i += 1) {
      const nr = c;
      c = -r;
      r = nr;
    }
    return { row: r, col: c };
  };
}

/**
 * A stable string for a shape that has already been normalised to the origin.
 * Two shapes share a key exactly when they are the same set of cells.
 */
export function shapeKey(shape: Shape): string {
  return normalise(shape)
    .map(({ row, col }) => `${row},${col}`)
    .join(';');
}

/** All eight images of a shape, each translated back to the origin. */
export function images(shape: Shape): Shape[] {
  return DIHEDRAL.map((element) => normalise(shape.map(pointMap(element))));
}

/**
 * The images of a shape with congruent duplicates removed. A cross pentomino
 * has one; an L-tromino has four; a scalene piece has eight. Placement
 * generation walks these so a symmetric piece is not placed twice in the same
 * spot, which would double-count partitions.
 */
export function distinctImages(shape: Shape): Shape[] {
  const seen = new Set<string>();
  const out: Shape[] = [];
  for (const image of images(shape)) {
    const key = shapeKey(image);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(image);
  }
  return out;
}

/**
 * The representative of a shape's congruence class, as a key. Shapes with the
 * same canonical key are the same piece: interchangeable in a puzzle, and
 * counted as one piece type by the solution counter.
 */
export function canonicalKey(shape: Shape): string {
  let best: string | undefined;
  for (const image of images(shape)) {
    const key = shapeKey(image);
    if (best === undefined || key < best) best = key;
  }
  return best ?? '';
}
