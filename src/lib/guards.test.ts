/**
 * Pins the spec's *envelope is measured, and enforced in code*: the constants
 * in `envelope.ts` are policy, not advice, and the engine refuses a request
 * outside them rather than searching and hoping.
 *
 * Also pins honest failure. Every rejection must name the fix — a rejection
 * that says only what went wrong leaves the user with nothing to do — and the
 * retry loop must be bounded, because a puzzle that never arrives is worse than
 * one that arrives refused.
 *
 * The uniqueness of an accepted dissection is re-derived here from scratch
 * rather than read off the result: the engine never takes its own word for it.
 */

import { describe, expect, test } from 'vitest';
import {
  MAX_ATTEMPTS,
  MAX_PIECES,
  MIN_MEAN_THICKNESS,
  MIN_PIECES,
  MIN_TARGET_CELLS,
} from './envelope';
import {
  MAX_TOTAL_ATTEMPTS,
  checkEnvelope,
  generate,
  generateFromSeed,
} from './guards';
import { cellKey, isConnected, meanThickness } from './grid';
import { makeRng } from './rng';
import type { Rng } from './rng';
import { findPartitions } from './solution-count';
import { countOrbits, stabiliser } from './symmetry';
import type { Shape } from './types';

const rect = (rows: number, cols: number): Shape => {
  const cells: { row: number; col: number }[] = [];
  for (let row = 0; row < rows; row += 1)
    for (let col = 0; col < cols; col += 1) cells.push({ row, col });
  return cells;
};

const parse = (art: string): Shape => {
  const cells: { row: number; col: number }[] = [];
  art
    .trim()
    .split('\n')
    .forEach((line, row) => {
      [...line].forEach((char, col) => {
        if (char === '#') cells.push({ row, col });
      });
    });
  return cells;
};

/** The "letters" row of the measured table: the worst performer by a wide margin. */
const INITIALS_JH = parse(`
..####..#....#
.....#..#....#
.....#..######
.....#..#....#
.#...#..#....#
.#####..#....#
`);

const HEART = parse(`
.##..##.
########
########
.######.
..####..
...##...
`);

const BLOB = parse(`
..####....
.#######..
##########
##########
.########.
..######..
...###....
`);

/** A generator that fails loudly if the guards let a search start. */
const forbiddenRng = (): Rng => {
  const fail = (): never => {
    throw new Error('the engine searched before the envelope guards ran');
  };
  return {
    next: fail,
    int: fail,
    pick: fail,
    shuffled: fail,
  };
};

describe('the envelope refuses without searching', () => {
  test('nine pieces is rejected before a single dissection is drawn', () => {
    const result = generate(rect(8, 8), 9, forbiddenRng());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('piece-count-out-of-range');
    expect(result.suggestedPieceCount).toBe(MAX_PIECES);
    expect(result.message).toContain(String(MAX_PIECES));
  });

  test('two pieces is rejected the same way, from the other end', () => {
    const result = generate(rect(8, 8), 2, forbiddenRng());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('piece-count-out-of-range');
    expect(result.suggestedPieceCount).toBe(MIN_PIECES);
  });

  test.each([MIN_PIECES - 1, MAX_PIECES + 1, 0, -3, 5.5])(
    'a piece count of %s never reaches the search',
    (pieceCount) => {
      expect(checkEnvelope(rect(8, 8), pieceCount)?.reason).toBe(
        'piece-count-out-of-range',
      );
    },
  );

  test('every piece count inside the range passes the guard', () => {
    for (let k = MIN_PIECES; k <= MAX_PIECES; k += 1) {
      expect(checkEnvelope(rect(8, 8), k)).toBeNull();
    }
  });

  test('a target below the minimum cell count is rejected', () => {
    const small = rect(4, 5); // 20 cells, under MIN_TARGET_CELLS
    expect(small.length).toBeLessThan(MIN_TARGET_CELLS);
    const result = generate(small, 4, forbiddenRng());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('shape-too-small');
    expect(result.message).toContain(String(MIN_TARGET_CELLS));
  });

  test('a disconnected target is rejected', () => {
    const islands = [
      ...rect(4, 5),
      ...rect(4, 5).map(({ row, col }) => ({ row, col: col + 8 })),
    ];
    expect(isConnected(islands)).toBe(false);
    const result = generate(islands, 4, forbiddenRng());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('shape-disconnected');
  });

  test('a letter-stroke outline is rejected as too thin', () => {
    // This is the shape behind the "letters" row of the measured table, and
    // refusing it is the deliberate decision that kills monogram puzzles.
    expect(INITIALS_JH.length).toBeGreaterThanOrEqual(MIN_TARGET_CELLS);
    expect(isConnected(INITIALS_JH)).toBe(false);
    // Joined into one connected monogram it is still refused, on thinness.
    const joined = [...INITIALS_JH, { row: 2, col: 6 }, { row: 2, col: 7 }];
    expect(isConnected(joined)).toBe(true);
    expect(meanThickness(joined)).toBeLessThan(MIN_MEAN_THICKNESS);

    const result = generate(joined, 5, forbiddenRng());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('shape-too-thin');
    expect(result.message).toContain(String(MIN_MEAN_THICKNESS));
  });

  test('a solid outline is thick enough and reaches the search', () => {
    expect(meanThickness(BLOB)).toBeGreaterThanOrEqual(MIN_MEAN_THICKNESS);
    expect(checkEnvelope(BLOB, 5)).toBeNull();
  });
});

describe('an accepted puzzle', () => {
  const result = generateFromSeed(BLOB, 5, 20240612);

  test('is generated at all', () => {
    expect(result.ok).toBe(true);
  });

  test('reports a bounded attempt count and its own symmetry order', () => {
    if (!result.ok) return;
    expect(result.attempts).toBeGreaterThanOrEqual(1);
    expect(result.attempts).toBeLessThanOrEqual(MAX_ATTEMPTS);
    expect(result.symmetryOrder).toBe(stabiliser(BLOB).length);
    expect(result.searchMs).toBeGreaterThanOrEqual(0);
  });

  test('is a genuine partition of the target into the requested pieces', () => {
    if (!result.ok) return;
    expect(result.pieces).toHaveLength(5);
    const seen = new Set<string>();
    for (const piece of result.pieces) {
      expect(piece.length).toBeGreaterThan(0);
      expect(isConnected(piece)).toBe(true);
      for (const cell of piece) {
        expect(seen.has(cellKey(cell))).toBe(false);
        seen.add(cellKey(cell));
      }
    }
    expect(seen).toEqual(new Set(BLOB.map(cellKey)));
  });

  test('really has exactly one solution, re-counted from scratch', () => {
    if (!result.ok) return;
    // The whole product rests on this line, so it is recomputed rather than
    // read back: enumerate well past the engine's own abort point and quotient
    // independently.
    const partitions = findPartitions(BLOB, result.pieces, 200);
    expect(partitions.length).toBe(result.rawSolutions);
    expect(countOrbits(partitions, BLOB)).toBe(1);
  });

  test('keeps the rejected candidates it showed its working with', () => {
    if (!result.ok) return;
    for (const candidate of result.rejected) {
      expect(candidate.pieces).toHaveLength(5);
      expect(candidate.distinctSolutions).not.toBe(1);
      expect(candidate.distinctSolutions).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('a mirror-symmetric target still gets a puzzle', () => {
  // The case the prototype got wrong. With |G| = 2 a dissection may well have
  // two raw partitions that are reflections of one another — one puzzle. An
  // engine that skipped the quotient would refuse every such shape, which is
  // exactly the 0%-unique "finding" that turned out to be a bug.
  test.each([4, 5, 6])('%i pieces out of the heart', (pieceCount) => {
    const result = generateFromSeed(HEART, pieceCount, 4242 + pieceCount);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.symmetryOrder).toBe(2);
    expect(result.pieces).toHaveLength(pieceCount);
    expect(result.rawSolutions).toBeGreaterThanOrEqual(1);
    expect(result.rawSolutions).toBeLessThanOrEqual(result.symmetryOrder);

    const partitions = findPartitions(HEART, result.pieces, 200);
    expect(partitions).toHaveLength(result.rawSolutions);
    expect(countOrbits(partitions, HEART)).toBe(1);
  });
});

describe('honest failure', () => {
  /**
   * A 5x6 rectangle at the maximum piece count: 30 cells into 7 pieces, on the
   * most symmetric outline there is. It passes every guard, and the search
   * still comes up empty on roughly half of all seeds, because five-cell pieces
   * on a rectangle are mostly congruent duplicates of one another.
   *
   * Several seeds are tried rather than one, so the test pins the *behaviour*
   * on failure instead of a particular seed's luck. The heart is deliberately
   * not used here: the measured table records 0 of 60 at seven pieces, but a
   * 400-attempt budget finds one within about a hundred draws, and 0/60 was
   * never a claim of impossibility.
   */
  const HARD = rect(5, 6);
  const SEEDS = [2, 5, 7, 8, 9];
  const outcomes = SEEDS.map((seed) => generateFromSeed(HARD, MAX_PIECES, seed));
  const refusals = outcomes.filter((result) => !result.ok);

  test('a request the engine cannot meet is refused, not retried forever', () => {
    expect(checkEnvelope(HARD, MAX_PIECES)).toBeNull();
    expect(refusals.length).toBeGreaterThan(0);
    for (const refusal of refusals) {
      expect(refusal.ok).toBe(false);
      if (refusal.ok) continue;
      expect(refusal.reason).toBe('no-unique-dissection-at-k');
    }
  });

  test('every refusal names a piece count instead of just failing', () => {
    for (const refusal of refusals) {
      if (refusal.ok) continue;
      expect(refusal.suggestedPieceCount).toBeDefined();
      expect(refusal.suggestedPieceCount).toBeGreaterThanOrEqual(MIN_PIECES);
      expect(refusal.suggestedPieceCount).toBeLessThanOrEqual(MAX_PIECES);
      expect(refusal.suggestedPieceCount).not.toBe(MAX_PIECES);
      expect(refusal.message).toContain(String(refusal.suggestedPieceCount));
      expect(refusal.message).toMatch(/try/i);
    }
  });

  test('every suggested piece count really does work', () => {
    for (const refusal of refusals) {
      if (refusal.ok) continue;
      // Generate at the suggested count and re-verify uniqueness from scratch.
      // A suggestion that does not work is a worse failure than no suggestion.
      const second = generateFromSeed(HARD, refusal.suggestedPieceCount!, 12345);
      expect(second.ok).toBe(true);
      if (!second.ok) continue;
      expect(second.pieces).toHaveLength(refusal.suggestedPieceCount!);
      expect(countOrbits(findPartitions(HARD, second.pieces, 200), HARD)).toBe(1);
    }
  });

  test('the retry budget is a real bound, not a hope', () => {
    // Growth begins by shuffling the target's cells to pick seeds, so shuffles
    // of exactly that length count the dissections drawn — including the probes
    // that look for a piece count to suggest.
    const rng = makeRng(2);
    let dissections = 0;
    const counted: Rng = {
      next: () => rng.next(),
      int: (bound) => rng.int(bound),
      pick: (items) => rng.pick(items),
      shuffled: (items) => {
        if (items.length === HARD.length) dissections += 1;
        return rng.shuffled(items);
      },
    };

    const failed = generate(HARD, MAX_PIECES, counted);
    expect(failed.ok).toBe(false);
    // A failure spends the whole budget at the requested count, then the probes.
    // Both halves are bounded, which is what stops the engine spinning.
    expect(dissections).toBeGreaterThanOrEqual(MAX_ATTEMPTS);
    expect(dissections).toBeLessThanOrEqual(MAX_TOTAL_ATTEMPTS);
  });
});
