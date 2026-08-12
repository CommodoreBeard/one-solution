/**
 * Pins the spec's *uniqueness claim, stated exactly*: after counting raw
 * partitions, the engine quotients by the target's stabiliser subgroup of the
 * dihedral group of order 8.
 *
 * These checks are ported from `reference/quicktest.py` sections A, C, D, E and
 * F, and the orbit bound from the second half of `reference/crosscheck.py`. The
 * reference README explains why they exist: an earlier version of this quotient
 * reported 0% unique for every mirror-symmetric shape, which reads as a finding
 * rather than a bug. A plausible-looking number is not evidence, so every
 * number here has an independent source — published pentomino counts, or a
 * bound that must hold structurally.
 */

import { describe, expect, test } from 'vitest';
import { growDissection } from './dissect';
import { makeRng } from './rng';
import { findPartitions } from './solution-count';
import type { Partition } from './solution-count';
import { countOrbits, stabiliser, symmetryOrder } from './symmetry';
import type { Shape } from './types';

const shape = (...pairs: [number, number][]): Shape =>
  pairs.map(([row, col]) => ({ row, col }));

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

/** The seven shapes the reference oracle measured, verbatim from dissect.py. */
const SHAPES = {
  dog: `
....##....
...####...
..######..
.########.
.########.
.########.
..##..##..
..##..##..
`,
  initials_JH: `
..####..#....#
.....#..#....#
.....#..######
.....#..#....#
.#...#..#....#
.#####..#....#
`,
  heart: `
.##..##.
########
########
.######.
..####..
...##...
`,
  blob: `
..####....
.#######..
##########
##########
.########.
..######..
...###....
`,
  cat: `
.#....#.
.######.
########
########
.######.
.#.##.#.
`,
} as const;

const DOMINO = shape([0, 0], [0, 1]);
const L_TROMINO = shape([0, 0], [1, 0], [1, 1]);

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

describe('stabiliser', () => {
  // quicktest.py section A. A square is fixed by all eight elements, a
  // non-square rectangle by four, a mirror-symmetric silhouette by two, and an
  // irregular blob only by the identity.
  test.each([
    ['7x7 square', rect(7, 7), 8],
    ['6x8 rectangle', rect(6, 8), 4],
    ['heart', parse(SHAPES.heart), 2],
    ['cat', parse(SHAPES.cat), 2],
    ['dog', parse(SHAPES.dog), 2],
    ['blob', parse(SHAPES.blob), 1],
    ['initials JH', parse(SHAPES.initials_JH), 1],
  ])('|G| for the %s is %i', (_name, target, order) => {
    expect(symmetryOrder(target)).toBe(order);
  });

  test('a single cell is fixed by the whole group', () => {
    expect(symmetryOrder(shape([4, 9]))).toBe(8);
  });

  test('symmetry does not depend on where the outline sits', () => {
    const moved = parse(SHAPES.cat).map(({ row, col }) => ({
      row: row + 13,
      col: col - 7,
    }));
    expect(symmetryOrder(moved)).toBe(2);
  });
});

describe('the quotient collapses mirror-image partitions', () => {
  // quicktest.py section C, the check that was broken in the prototype. The two
  // ways to cut a 2x3 rectangle into two L-trominoes are reflections of one
  // another, so they are the same puzzle.
  test('2x3 into two L-trominoes: 2 raw, 1 orbit', () => {
    const target = rect(2, 3);
    const partitions = findPartitions(target, [L_TROMINO, L_TROMINO], 10);
    expect(symmetryOrder(target)).toBe(4);
    expect(partitions).toHaveLength(2);
    expect(countOrbits(partitions, target)).toBe(1);
  });

  // quicktest.py section D: both-horizontal and both-vertical are related by a
  // quarter turn, and identical pieces are not double counted on top of that.
  test('2x2 into two dominoes: 2 raw, 1 orbit', () => {
    const target = rect(2, 2);
    const partitions = findPartitions(target, [DOMINO, DOMINO], 10);
    expect(partitions).toHaveLength(2);
    expect(countOrbits(partitions, target)).toBe(1);
  });

  test('1x4 into two dominoes: 1 raw, 1 orbit', () => {
    const target = rect(1, 4);
    const partitions = findPartitions(target, [DOMINO, DOMINO], 10);
    expect(symmetryOrder(target)).toBe(4);
    expect(partitions).toHaveLength(1);
    expect(countOrbits(partitions, target)).toBe(1);
  });

  test('a partition fixed by the whole group is still one orbit', () => {
    // Four dominoes in a pinwheel round a 4x4 centre would be neat, but the
    // simplest fixed partition is a 2x2 square cut into four unit cells: every
    // group element maps it to itself.
    const target = rect(2, 2);
    const units = [shape([0, 0]), shape([0, 0]), shape([0, 0]), shape([0, 0])];
    const partitions = findPartitions(target, units, 10);
    expect(partitions).toHaveLength(1);
    expect(countOrbits(partitions, target)).toBe(1);
  });
});

describe('known-answer tests from the literature', () => {
  // reference/README.md lists these as the vectors the port must reproduce.
  // Issue 2 pinned the raw counts; these are the published up-to-symmetry
  // figures, and each is exactly a quarter of the raw count because a non-square
  // rectangle has |G| = 4 and no pentomino tiling of these boxes is fixed by a
  // non-identity symmetry.
  test.each([
    [3, 20, 8, 2],
    [4, 15, 1472, 368],
    [5, 12, 4040, 1010],
    [6, 10, 9356, 2339],
  ])(
    'the 12 pentominoes tile %ix%i in %i raw partitions, %i up to symmetry',
    (rows, cols, raw, orbits) => {
      const target = rect(rows, cols);
      const partitions = findPartitions(target, PENTOMINOES, raw + 1);
      expect(symmetryOrder(target)).toBe(4);
      expect(partitions).toHaveLength(raw);
      expect(countOrbits(partitions, target)).toBe(orbits);
    },
    120_000,
  );
});

describe('structural invariants over random dissections', () => {
  const dissectionsOf = (
    target: Shape,
    pieceCount: number,
    seed: number,
    tries: number,
  ): { partitions: Partition[]; raw: number }[] => {
    const rng = makeRng(seed);
    const out: { partitions: Partition[]; raw: number }[] = [];
    for (let i = 0; i < tries; i += 1) {
      const pieces = growDissection(target, pieceCount, rng);
      if (pieces === null) continue;
      const partitions = findPartitions(target, pieces, 400);
      out.push({ partitions, raw: partitions.length });
    }
    return out;
  };

  // quicktest.py section E. With |G| = 1 the quotient has nothing to collapse,
  // so any difference between orbits and raw is a bug in the quotient itself.
  test('orbits equal raw partitions for an asymmetric target', () => {
    const target = parse(SHAPES.blob);
    expect(symmetryOrder(target)).toBe(1);
    const cases = dissectionsOf(target, 6, 7, 20);
    expect(cases.length).toBeGreaterThan(10);
    for (const { partitions, raw } of cases) {
      expect(countOrbits(partitions, target)).toBe(raw);
    }
  });

  // crosscheck.py's second half. This bound is the cheapest statement that
  // catches both failure directions: a quotient that collapses too much drives
  // orbits below raw / |G|, and one that collapses nothing leaves orbits equal
  // to raw on a symmetric target.
  test('1 <= orbits <= raw <= orbits * |G| over more than 100 random cases', () => {
    const targets: [string, Shape][] = [
      ['blob', parse(SHAPES.blob)],
      ['cat', parse(SHAPES.cat)],
      ['heart', parse(SHAPES.heart)],
      ['dog', parse(SHAPES.dog)],
      ['rect_6x8', rect(6, 8)],
      ['square_7x7', rect(7, 7)],
    ];

    let checked = 0;
    let collapsedAny = false;
    for (const [name, target] of targets) {
      const group = stabiliser(target);
      for (const { partitions, raw } of dissectionsOf(target, 6, 4242, 25)) {
        // A capped enumeration is a lower bound on the raw count, and the upper
        // half of the bound would not mean anything against one.
        if (raw >= 400) continue;
        const orbits = countOrbits(partitions, target, group);
        checked += 1;
        if (orbits < raw) collapsedAny = true;
        const where = `${name}: raw=${raw} orbits=${orbits} |G|=${group.length}`;
        expect(orbits, where).toBeGreaterThanOrEqual(1);
        expect(orbits, where).toBeLessThanOrEqual(raw);
        expect(raw, where).toBeLessThanOrEqual(orbits * group.length);
      }
    }

    expect(checked).toBeGreaterThanOrEqual(100);
    // Guards the degenerate pass where the quotient is the identity map and the
    // bound holds vacuously.
    expect(collapsedAny).toBe(true);
  });
});
