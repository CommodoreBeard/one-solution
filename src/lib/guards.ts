/**
 * The measured envelope, enforced, and the bounded generate-and-verify loop
 * that sits behind it.
 *
 * The constants live in `envelope.ts` with the 2,520 dissections that produced
 * them. This module is the only place they are read, so the policy is in one
 * file rather than scattered through the engine.
 *
 * Two commitments from the spec shape everything here:
 *
 * - **Refuse cheaply.** A piece count outside the range, a target that is too
 *   small, disconnected or too thin is rejected without a single search. Those
 *   are properties of the request, not discoveries about it.
 * - **Fail honestly, and name the fix.** When no unique dissection exists at
 *   the requested count, the engine says which count did work rather than
 *   spinning or shrugging. "No unique dissection at 7 pieces — try 4" beats
 *   "generation failed".
 *
 * `buildPuzzle` (issue 4) wraps `generate` — it decodes the URL, calls this,
 * and turns a `Generation` into a `PuzzleDocument` by adding geometry.
 */

import { growDissection } from './dissect';
import {
  MAX_ATTEMPTS,
  MAX_PIECES,
  MAX_RETAINED_REJECTS,
  MIN_MEAN_THICKNESS,
  MIN_PIECES,
  MIN_TARGET_CELLS,
  SOLUTION_COUNT_CAP,
} from './envelope';
import { isConnected, meanThickness } from './grid';
import { makeRng } from './rng';
import type { Rng } from './rng';
import { findPartitions } from './solution-count';
import { countOrbits, stabiliser } from './symmetry';
import type { DihedralElement } from './transforms';
import type { RejectedCandidate, Rejection, Shape } from './types';

/**
 * Attempts spent probing an *alternative* piece count once the requested one
 * has failed, so the rejection can name a count that works.
 *
 * A fraction of the main budget rather than a measured constant of its own: the
 * probe only has to find one success, and the worst hit rate that ever produced
 * one was roughly 1 in 50. Deliberately not in `envelope.ts`, which holds
 * measurements.
 */
export const PROBE_ATTEMPTS = Math.ceil(MAX_ATTEMPTS / 8);

/**
 * The most dissections `generate` will ever draw for one request: the full
 * budget at the count asked for, then a probe at each of the others. Exported
 * so a test can pin the bound rather than trust the loop.
 */
export const MAX_TOTAL_ATTEMPTS =
  MAX_ATTEMPTS + (MAX_PIECES - MIN_PIECES) * PROBE_ATTEMPTS;

/** A dissection that the engine is willing to sell the guarantee on. */
export interface Generation {
  readonly ok: true;
  readonly pieces: readonly Shape[];
  /** Dissections drawn and thrown away before this one. */
  readonly attempts: number;
  /** `|G|` for the target outline, 1 to 8. */
  readonly symmetryOrder: number;
  /** Raw partitions, before the quotient. Always at most `symmetryOrder`. */
  readonly rawSolutions: number;
  readonly rejected: readonly RejectedCandidate[];
  readonly searchMs: number;
}

export type GenerationResult = Generation | Rejection;

const plural = (n: number, noun: string): string =>
  `${n} ${noun}${n === 1 ? '' : 's'}`;

/**
 * Everything that can be decided about a request without searching. Returns
 * `null` when the request is worth a search.
 *
 * Order matters only for the message the user sees: size before thinness,
 * because "draw something bigger" is easier to act on than a thickness figure.
 */
export function checkEnvelope(target: Shape, pieceCount: number): Rejection | null {
  if (
    !Number.isInteger(pieceCount) ||
    pieceCount < MIN_PIECES ||
    pieceCount > MAX_PIECES
  ) {
    const suggested = Math.min(MAX_PIECES, Math.max(MIN_PIECES, Math.round(pieceCount) || MIN_PIECES));
    return {
      ok: false,
      reason: 'piece-count-out-of-range',
      message:
        `A puzzle has between ${MIN_PIECES} and ${MAX_PIECES} pieces, not ${pieceCount}` +
        ` — try ${suggested}.`,
      suggestedPieceCount: suggested,
    };
  }

  if (target.length < MIN_TARGET_CELLS) {
    return {
      ok: false,
      reason: 'shape-too-small',
      message:
        `This outline is ${plural(target.length, 'cell')} — draw at least ` +
        `${MIN_TARGET_CELLS} before cutting it into pieces.`,
    };
  }

  if (!isConnected(target)) {
    return {
      ok: false,
      reason: 'shape-disconnected',
      message:
        'The outline is in separate parts — join them into one shape, or draw ' +
        'each part as its own puzzle.',
    };
  }

  const thickness = meanThickness(target);
  if (thickness < MIN_MEAN_THICKNESS) {
    return {
      ok: false,
      reason: 'shape-too-thin',
      message:
        `This outline is too thin — mean thickness ${thickness.toFixed(2)} cells, ` +
        `and ${MIN_MEAN_THICKNESS} is the minimum. Thicken the strokes to at ` +
        'least two cells; letter shapes rarely pass.',
    };
  }

  return null;
}

interface Search {
  /** The accepted dissection, or `null` if the budget ran out. */
  readonly pieces: readonly Shape[] | null;
  readonly attempts: number;
  readonly rawSolutions: number;
  readonly rejected: readonly RejectedCandidate[];
}

/**
 * Draw dissections until one has exactly one solution up to symmetry, or the
 * budget runs out.
 *
 * The uniqueness test aborts as early as it soundly can. Partitions are
 * collected only up to `|G| + 1`: more raw partitions than the group has
 * elements means at least two orbits, whatever they turn out to be, so there is
 * nothing to gain by counting further. That is the quotient's version of "abort
 * at the second solution".
 *
 * Retained rejects are re-counted at the display cap, because the search
 * animation shows honest numbers and `|G| + 1` is not one.
 */
function searchForUnique(
  target: Shape,
  pieceCount: number,
  rng: Rng,
  group: readonly DihedralElement[],
  budget: number,
  collectRejects: boolean,
): Search {
  const rejected: RejectedCandidate[] = [];
  const uniquenessCap = group.length + 1;

  for (let attempt = 1; attempt <= budget; attempt += 1) {
    const pieces = growDissection(target, pieceCount, rng);
    // A stranded draw costs microseconds and still spends an attempt, which is
    // what keeps the budget a real bound on wall-clock time.
    if (pieces === null) continue;

    const partitions = findPartitions(target, pieces, uniquenessCap);
    const raw = partitions.length;
    if (raw <= group.length && countOrbits(partitions, target, group) === 1) {
      return { pieces, attempts: attempt, rawSolutions: raw, rejected };
    }

    if (collectRejects && rejected.length < MAX_RETAINED_REJECTS) {
      const full = findPartitions(target, pieces, SOLUTION_COUNT_CAP);
      rejected.push({
        pieces,
        distinctSolutions: countOrbits(full, target, group),
      });
    }
  }

  return { pieces: null, attempts: budget, rawSolutions: 0, rejected };
}

/**
 * Piece counts to offer instead of one that failed, best first.
 *
 * Downwards before upwards: every row of the measured table falls off as the
 * piece count rises, so fewer pieces is always the likelier rescue.
 */
function fallbackCounts(pieceCount: number): number[] {
  const out: number[] = [];
  for (let k = pieceCount - 1; k >= MIN_PIECES; k -= 1) out.push(k);
  for (let k = pieceCount + 1; k <= MAX_PIECES; k += 1) out.push(k);
  return out;
}

/**
 * The engine's internal entry point: guard the request, then generate and
 * verify until a unique dissection appears or the budget is spent.
 *
 * Taking an `Rng` rather than a seed is what lets a test prove the envelope
 * guards run *before* any search does — a rejected request touches the
 * generator zero times.
 */
export function generate(
  target: Shape,
  pieceCount: number,
  rng: Rng,
): GenerationResult {
  const rejection = checkEnvelope(target, pieceCount);
  if (rejection) return rejection;

  const group = stabiliser(target);
  const started = performance.now();
  const found = searchForUnique(target, pieceCount, rng, group, MAX_ATTEMPTS, true);

  if (found.pieces !== null) {
    return {
      ok: true,
      pieces: found.pieces,
      attempts: found.attempts,
      symmetryOrder: group.length,
      rawSolutions: found.rawSolutions,
      rejected: found.rejected,
      searchMs: performance.now() - started,
    };
  }

  // The budget is spent at this count. Spend a much smaller one finding a count
  // that does work, so the failure can name the fix rather than the fault.
  for (const candidate of fallbackCounts(pieceCount)) {
    const probe = searchForUnique(
      target,
      candidate,
      rng,
      group,
      PROBE_ATTEMPTS,
      false,
    );
    if (probe.pieces !== null) {
      return {
        ok: false,
        reason: 'no-unique-dissection-at-k',
        message: `No unique dissection at ${plural(pieceCount, 'piece')} — try ${candidate}.`,
        suggestedPieceCount: candidate,
      };
    }
  }

  return {
    ok: false,
    reason: 'budget-exhausted',
    message:
      `No unique dissection at ${plural(pieceCount, 'piece')}, and none at any ` +
      `count from ${MIN_PIECES} to ${MAX_PIECES} either — redraw the outline a ` +
      'little larger or a little rounder and try again.',
  };
}

/** `generate` from a seed, for callers that hold a `PuzzleSpec` rather than an `Rng`. */
export function generateFromSeed(
  target: Shape,
  pieceCount: number,
  seed: number,
): GenerationResult {
  return generate(target, pieceCount, makeRng(seed));
}
