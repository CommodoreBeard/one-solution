/**
 * Dissection growth: cut a target outline into k connected pieces.
 *
 * k seeds are scattered over the target and each grows into its neighbours
 * until every cell is claimed. Growth always goes to the *smallest* piece that
 * still has room, which keeps sizes even — a dissection with one huge piece and
 * four crumbs is both ugly and, because small pieces are usually congruent
 * duplicates of each other, far more likely to have several solutions.
 *
 * Growth can strand cells: a piece can wall off a pocket that no piece borders.
 * Rather than repair it, this returns `null` and the caller draws again. A
 * failed growth costs microseconds and the retry loop is bounded elsewhere.
 *
 * This module is internal. Tests reach it through the `buildPuzzle` seam.
 */

import { cellKey } from './grid';
import type { Rng } from './rng';
import type { Cell, Shape } from './types';

function neighbours({ row, col }: Cell): Cell[] {
  return [
    { row: row + 1, col },
    { row: row - 1, col },
    { row, col: col + 1 },
    { row, col: col - 1 },
  ];
}

/**
 * Grow `pieceCount` connected pieces that exactly partition `target`, or
 * `null` if this draw stranded cells. Deterministic given the generator.
 */
export function growDissection(
  target: Shape,
  pieceCount: number,
  rng: Rng,
): Shape[] | null {
  if (pieceCount < 1 || target.length < pieceCount) return null;

  const inTarget = new Set(target.map(cellKey));
  const owner = new Map<string, number>();
  const seeds = rng.shuffled(target).slice(0, pieceCount);
  const pieces: Cell[][] = [];
  const frontier: Cell[][] = [];

  seeds.forEach((seed, i) => {
    owner.set(cellKey(seed), i);
    pieces.push([seed]);
    frontier.push([]);
  });
  seeds.forEach((seed, i) => {
    for (const next of neighbours(seed)) {
      const key = cellKey(next);
      if (inTarget.has(key) && !owner.has(key)) frontier[i]!.push(next);
    }
  });

  let unclaimed = target.length - pieceCount;
  while (unclaimed > 0) {
    // Smallest first, ties broken randomly so the tie order is not an artefact
    // of the seed positions.
    const order = rng
      .shuffled(pieces.map((_, i) => i))
      .sort((a, b) => pieces[a]!.length - pieces[b]!.length);

    let grew = false;
    for (const i of order) {
      const live = frontier[i]!.filter((cell) => !owner.has(cellKey(cell)));
      frontier[i] = live;
      if (live.length === 0) continue;

      const cell = live[rng.int(live.length)]!;
      owner.set(cellKey(cell), i);
      pieces[i]!.push(cell);
      unclaimed -= 1;
      for (const next of neighbours(cell)) {
        const key = cellKey(next);
        if (inTarget.has(key) && !owner.has(key)) live.push(next);
      }
      grew = true;
      break;
    }
    // Every piece is walled in and cells are still unclaimed. Draw again.
    if (!grew) return null;
  }

  return pieces;
}
