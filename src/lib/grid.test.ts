import { describe, expect, test } from 'vitest';
import {
  cellKey,
  isConnected,
  meanThickness,
  normalise,
  outlineCells,
} from './grid';
import type { Shape } from './types';

const shape = (...pairs: [number, number][]): Shape =>
  pairs.map(([row, col]) => ({ row, col }));

describe('normalise', () => {
  test('moves a shape to the origin without changing it', () => {
    expect(normalise(shape([5, 7], [5, 8], [6, 7]))).toEqual(
      shape([0, 0], [0, 1], [1, 0]),
    );
  });

  test('is idempotent', () => {
    const once = normalise(shape([3, 3], [3, 4]));
    expect(normalise(once)).toEqual(once);
  });

  test('handles the empty shape', () => {
    expect(normalise([])).toEqual([]);
  });
});

describe('isConnected', () => {
  test('accepts an edge-adjacent run', () => {
    expect(isConnected(shape([0, 0], [0, 1], [1, 1]))).toBe(true);
  });

  test('rejects two islands', () => {
    expect(isConnected(shape([0, 0], [0, 5]))).toBe(false);
  });

  test('rejects diagonal-only contact, which cannot be cut as one piece', () => {
    expect(isConnected(shape([0, 0], [1, 1]))).toBe(false);
  });

  test('rejects the empty shape', () => {
    expect(isConnected([])).toBe(false);
  });
});

describe('outlineCells and meanThickness', () => {
  const rect = (rows: number, cols: number): Shape => {
    const cells: { row: number; col: number }[] = [];
    for (let row = 0; row < rows; row += 1)
      for (let col = 0; col < cols; col += 1) cells.push({ row, col });
    return cells;
  };

  test('a solid block has only its border on the outline', () => {
    // 5x5 with a 3x3 interior: 25 cells, 16 on the outline.
    expect(outlineCells(rect(5, 5))).toHaveLength(16);
    expect(meanThickness(rect(5, 5))).toBeCloseTo(25 / 16);
  });

  test('a one-cell-wide stroke is entirely outline, and scores 1', () => {
    // The property the envelope's thinness guard is built on.
    expect(meanThickness(rect(1, 9))).toBe(1);
    expect(meanThickness(rect(2, 1))).toBe(1);
  });

  test('thickness rises with the shorter side', () => {
    expect(meanThickness(rect(2, 8))).toBeLessThan(meanThickness(rect(4, 8)));
    expect(meanThickness(rect(4, 8))).toBeLessThan(meanThickness(rect(8, 8)));
  });

  test('a hole counts as outside, so punching one lowers the score', () => {
    // 24 cells, and only the four diagonal neighbours of the hole stay interior.
    const ring = rect(5, 5).filter(({ row, col }) => !(row === 2 && col === 2));
    expect(outlineCells(ring)).toHaveLength(20);
    expect(meanThickness(ring)).toBeCloseTo(24 / 20);
    expect(meanThickness(ring)).toBeLessThan(meanThickness(rect(5, 5)));
  });

  test('the empty shape scores zero rather than dividing by zero', () => {
    expect(meanThickness([])).toBe(0);
    expect(outlineCells([])).toEqual([]);
  });
});

describe('cellKey', () => {
  test('separates rows from columns unambiguously', () => {
    expect(cellKey({ row: 1, col: 23 })).not.toBe(cellKey({ row: 12, col: 3 }));
  });
});
