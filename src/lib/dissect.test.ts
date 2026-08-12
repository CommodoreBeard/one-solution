/**
 * Pins the growth contract: a dissection either exactly partitions the target
 * into the requested number of connected pieces, or is `null` and the caller
 * draws again. Nothing in between, because a half-valid dissection would reach
 * the solution counter and produce a confident wrong answer.
 *
 * Also pins reproducibility, which the spec's URL-is-the-state decision rests
 * on: the same seed must yield the same puzzle, this year and in five.
 */

import { describe, expect, test } from 'vitest';
import { growDissection } from './dissect';
import { cellKey, isConnected } from './grid';
import { makeRng } from './rng';
import { countPartitions } from './solution-count';
import type { Shape } from './types';

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

const rect = (rows: number, cols: number): Shape =>
  parse(Array.from({ length: rows }, () => '#'.repeat(cols)).join('\n'));

/** The reference oracle's dog silhouette: 48 cells, the typical working size. */
const DOG = parse(`
....##....
...####...
..######..
.########.
.########.
.########.
..##..##..
..##..##..
`);

const TARGETS: [string, Shape][] = [
  ['dog', DOG],
  ['6x8 rectangle', rect(6, 8)],
  ['thin strip', rect(2, 9)],
];

describe('growth produces a valid dissection or nothing', () => {
  test.each(TARGETS)('%s holds up over 200 draws', (_name, target) => {
    let produced = 0;
    for (let seed = 0; seed < 200; seed += 1) {
      for (const pieceCount of [3, 4, 5, 6, 7]) {
        const pieces = growDissection(target, pieceCount, makeRng(seed));
        if (pieces === null) continue;
        produced += 1;

        expect(pieces).toHaveLength(pieceCount);
        for (const piece of pieces) {
          expect(piece.length).toBeGreaterThan(0);
          expect(isConnected(piece)).toBe(true);
        }

        const covered = pieces.flatMap((piece) => piece.map(cellKey));
        // Exactly covers: no cell claimed twice, no cell left over.
        expect(new Set(covered).size).toBe(covered.length);
        expect(new Set(covered)).toEqual(new Set(target.map(cellKey)));
      }
    }
    expect(produced).toBeGreaterThan(0);
  });
});

describe('reproducibility', () => {
  test('the same seed yields the same dissection', () => {
    for (const seed of [1, 7, 12345, 2 ** 31]) {
      expect(growDissection(DOG, 5, makeRng(seed))).toEqual(
        growDissection(DOG, 5, makeRng(seed)),
      );
    }
  });

  test('different seeds explore different dissections', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 40; seed += 1) {
      const pieces = growDissection(DOG, 5, makeRng(seed));
      if (pieces) seen.add(JSON.stringify(pieces.map((p) => p.map(cellKey).sort())));
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('requests growth cannot honour', () => {
  test('more pieces than cells is refused', () => {
    expect(growDissection(rect(2, 2), 5, makeRng(1))).toBeNull();
  });

  test('a piece count below one is refused', () => {
    expect(growDissection(DOG, 0, makeRng(1))).toBeNull();
  });
});

describe('the search budget the animation depends on', () => {
  test('a 48-cell target at 5 pieces counts solutions in single-digit ms', () => {
    const timings: number[] = [];
    for (let seed = 0; seed < 30; seed += 1) {
      const pieces = growDissection(DOG, 5, makeRng(seed));
      if (pieces === null) continue;
      const started = performance.now();
      countPartitions(DOG, pieces, 2);
      timings.push(performance.now() - started);
    }
    expect(timings.length).toBeGreaterThan(20);
    timings.sort((a, b) => a - b);
    // The measured figure is about 3 ms. The ceiling is deliberately generous
    // so this pins the algorithm's shape, not the speed of the CI machine.
    expect(timings[Math.floor(timings.length / 2)]!).toBeLessThan(50);
  });
});
