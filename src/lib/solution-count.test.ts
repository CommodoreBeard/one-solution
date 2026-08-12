/**
 * Pins the counting contract from the spec's *uniqueness claim, stated
 * exactly*: partitions of the target into a piece multiset, with pieces
 * allowed to flip and congruent pieces interchangeable.
 *
 * The pentomino rectangles are the known-answer tests. Those counts are
 * published, and reference/README.md records them as the vectors this port
 * must reproduce. They are raw partitions; the quotient by the target's
 * symmetry group is issue 3.
 */

import { describe, expect, test } from 'vitest';
import { countPartitions, findPartitions } from './solution-count';
import type { Shape } from './types';

const shape = (...pairs: [number, number][]): Shape =>
  pairs.map(([row, col]) => ({ row, col }));

const rect = (rows: number, cols: number): Shape => {
  const cells: { row: number; col: number }[] = [];
  for (let row = 0; row < rows; row += 1)
    for (let col = 0; col < cols; col += 1) cells.push({ row, col });
  return cells;
};

const translate = (s: Shape, dr: number, dc: number): Shape =>
  s.map(({ row, col }) => ({ row: row + dr, col: col + dc }));

const DOMINO = shape([0, 0], [0, 1]);
const L_TROMINO = shape([0, 0], [1, 0], [1, 1]);
const L_TROMINO_MIRRORED = shape([0, 1], [1, 0], [1, 1]);
const S_TETROMINO = shape([0, 0], [0, 1], [1, 1], [1, 2]);
const Z_TETROMINO = shape([0, 1], [0, 2], [1, 0], [1, 1]);

/** The twelve free pentominoes, in the usual FILNPTUVWXYZ naming. */
const PENTOMINOES: readonly Shape[] = [
  shape([0, 1], [0, 2], [1, 0], [1, 1], [2, 1]), // F
  shape([0, 0], [1, 0], [2, 0], [3, 0], [4, 0]), // I
  shape([0, 0], [1, 0], [2, 0], [3, 0], [3, 1]), // L
  shape([0, 1], [1, 1], [2, 0], [2, 1], [3, 0]), // N
  shape([0, 0], [0, 1], [1, 0], [1, 1], [2, 0]), // P
  shape([0, 0], [0, 1], [0, 2], [1, 1], [2, 1]), // T
  shape([0, 0], [0, 2], [1, 0], [1, 1], [1, 2]), // U
  shape([0, 0], [1, 0], [2, 0], [2, 1], [2, 2]), // V
  shape([0, 0], [1, 0], [1, 1], [2, 1], [2, 2]), // W
  shape([0, 1], [1, 0], [1, 1], [1, 2], [2, 1]), // X
  shape([0, 1], [1, 0], [1, 1], [2, 1], [3, 1]), // Y
  shape([0, 0], [0, 1], [1, 1], [2, 1], [2, 2]), // Z
];

const ALL = Number.POSITIVE_INFINITY;

describe('known answers from the literature', () => {
  // Published raw counts for the twelve pentominoes in a rectangle, i.e.
  // before quotienting by the rectangle's symmetry group of order 4.
  test.each([
    [3, 20, 8],
    [4, 15, 1472],
    [5, 12, 4040],
    [6, 10, 9356],
  ])('the pentominoes pack %ix%i in %i raw ways', (rows, cols, expected) => {
    expect(countPartitions(rect(rows, cols), PENTOMINOES, ALL)).toBe(expected);
  });
});

describe('congruent pieces are interchangeable', () => {
  test('two dominoes in a 2x2 give 2 partitions, not 4', () => {
    // Swapping the two identical dominoes is not a second puzzle. Counting
    // instances rather than types would report 4.
    expect(countPartitions(rect(2, 2), [DOMINO, DOMINO], ALL)).toBe(2);
  });

  test('two L-trominoes in a 2x3 give 2 partitions', () => {
    expect(countPartitions(rect(2, 3), [L_TROMINO, L_TROMINO], ALL)).toBe(2);
  });
});

describe('a piece is the same piece when flipped over', () => {
  test('an L-tromino and its mirror are one type, not two', () => {
    // Two types of one each would generate every partition twice, giving 4.
    expect(
      countPartitions(rect(2, 3), [L_TROMINO, L_TROMINO_MIRRORED], ALL),
    ).toBe(countPartitions(rect(2, 3), [L_TROMINO, L_TROMINO], ALL));
  });

  test('a Z-tetromino covers an S-shaped target', () => {
    expect(countPartitions(S_TETROMINO, [Z_TETROMINO], ALL)).toBe(1);
    expect(countPartitions(Z_TETROMINO, [S_TETROMINO], ALL)).toBe(1);
  });

  test('S and Z count as one interchangeable type', () => {
    const target = [...S_TETROMINO, ...translate(S_TETROMINO, 2, 0)];
    const mixed = countPartitions(target, [S_TETROMINO, Z_TETROMINO], ALL);
    expect(mixed).toBeGreaterThan(0);
    expect(mixed).toBe(countPartitions(target, [S_TETROMINO, S_TETROMINO], ALL));
  });
});

describe('the cap aborts rather than enumerating', () => {
  test('a cap of 2 answers the uniqueness question and stops there', () => {
    // 9356 partitions exist; asking whether there is more than one must not
    // pay for finding them all.
    const started = performance.now();
    expect(countPartitions(rect(6, 10), PENTOMINOES, 2)).toBe(2);
    expect(performance.now() - started).toBeLessThan(1000);
  });

  test('a cap of 1 still detects that a packing exists', () => {
    expect(countPartitions(rect(6, 10), PENTOMINOES, 1)).toBe(1);
  });
});

describe('impossible requests', () => {
  test('a piece multiset of the wrong area covers nothing', () => {
    expect(countPartitions(rect(2, 3), [DOMINO, DOMINO], ALL)).toBe(0);
  });

  test('a piece that does not fit covers nothing', () => {
    expect(countPartitions(rect(2, 2), [shape([0, 0], [0, 1], [0, 2], [0, 3])], ALL)).toBe(0);
  });

  test('an empty target has no partitions', () => {
    expect(countPartitions([], [DOMINO], ALL)).toBe(0);
  });
});

describe('the partitions themselves', () => {
  test('each one exactly covers the target with the requested piece count', () => {
    const target = rect(4, 5);
    const dominoes = Array.from({ length: 10 }, () => DOMINO);
    const partitions = findPartitions(target, dominoes, ALL);
    expect(partitions.length).toBeGreaterThan(0);
    for (const partition of partitions) {
      expect(partition).toHaveLength(10);
      const covered = partition.flatMap((piece) =>
        piece.map(({ row, col }) => `${row},${col}`),
      );
      expect(new Set(covered).size).toBe(target.length);
      expect(covered).toHaveLength(target.length);
    }
  });

  test('collecting agrees with counting', () => {
    const target = rect(3, 20);
    expect(findPartitions(target, PENTOMINOES, ALL)).toHaveLength(
      countPartitions(target, PENTOMINOES, ALL),
    );
  });
});
