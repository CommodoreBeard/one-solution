/**
 * The symmetry quotient: two arrangements are the same puzzle when one maps
 * onto the other under a symmetry of the *target outline*.
 *
 * This is the part of the engine most likely to be silently wrong, and it was
 * wrong in the prototype in a way that read as a finding rather than a bug: it
 * reported 0% unique for every mirror-symmetric shape. The cause was mapping
 * points *after* sorting them, which destroys the correspondence between a cell
 * and its image. Fixing it moved the measured rate from 8.3% to 36.9%.
 *
 * Two rules keep it honest, and both are load-bearing:
 *
 * 1. **Map pointwise, then serialise.** Never sort a cell list before mapping
 *    it. Every `map(cell)` here runs on an individual cell; sorting only ever
 *    happens on the finished strings, where it is a canonical serialisation of
 *    a *set* and carries no geometric meaning.
 * 2. **Take the translation offset from the target, not from each piece.** A
 *    partition has to move as one rigid body. Normalising each piece to its own
 *    bounding box would slide the pieces relative to one another and stop the
 *    result being a partition of anything.
 *
 * This module is internal. Tests reach it through the `buildPuzzle` seam, apart
 * from the symmetry-quotient tests the spec asks for specifically.
 */

import { shapeKey } from './transforms';
import { DIHEDRAL, pointMap } from './transforms';
import type { DihedralElement } from './transforms';
import type { Partition } from './solution-count';
import type { Shape } from './types';

/**
 * The target's stabiliser: the subgroup of the dihedral group of order 8 whose
 * elements map the outline onto itself. Order 1 for an asymmetric blob, 2 for a
 * mirror-symmetric cat, 4 for a rectangle, 8 for a square.
 *
 * Comparison is by cell set after translation back to the origin, because a
 * symmetry of an outline is a symmetry wherever the outline happens to sit.
 */
export function stabiliser(target: Shape): DihedralElement[] {
  const own = shapeKey(target);
  return DIHEDRAL.filter(
    (element) => shapeKey(target.map(pointMap(element))) === own,
  );
}

/** `|G|`, the order of the target's own symmetry group. Between 1 and 8. */
export function symmetryOrder(target: Shape): number {
  return stabiliser(target).length;
}

/**
 * One image of a whole partition under one group element, as a string.
 *
 * The offset comes from the mapped *target*, so every piece shifts by the same
 * vector and the image is still a partition of the same outline.
 */
function imageKey(
  partition: Partition,
  target: Shape,
  element: DihedralElement,
): string {
  const map = pointMap(element);

  let minRow = Infinity;
  let minCol = Infinity;
  for (const cell of target) {
    const { row, col } = map(cell);
    if (row < minRow) minRow = row;
    if (col < minCol) minCol = col;
  }

  return partition
    .map((piece) =>
      piece
        // Pointwise, one cell at a time. Sorting comes after, never before.
        .map((cell) => map(cell))
        .map(({ row, col }) => `${row - minRow},${col - minCol}`)
        .sort()
        .join(';'),
    )
    .sort()
    .join('|');
}

/**
 * The representative of a partition's orbit under the target's symmetry group,
 * as a string. Two partitions share this key exactly when they are the same
 * puzzle.
 */
export function orbitKey(
  partition: Partition,
  target: Shape,
  group: readonly DihedralElement[] = stabiliser(target),
): string {
  let best: string | undefined;
  for (const element of group) {
    const key = imageKey(partition, target, element);
    if (best === undefined || key < best) best = key;
  }
  return best ?? '';
}

/**
 * How many genuinely different puzzles these partitions represent.
 *
 * The bound `1 <= orbits <= raw <= orbits * |G|` holds for any non-empty input
 * and is asserted in the tests, because it is the cheapest statement that
 * catches both directions of failure: a quotient that collapses too much, and
 * one that collapses nothing.
 */
export function countOrbits(
  partitions: readonly Partition[],
  target: Shape,
  group: readonly DihedralElement[] = stabiliser(target),
): number {
  const seen = new Set<string>();
  for (const partition of partitions) seen.add(orbitKey(partition, target, group));
  return seen.size;
}
