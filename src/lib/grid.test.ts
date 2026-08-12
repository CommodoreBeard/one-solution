import { describe, expect, test } from 'vitest';
import { cellKey, isConnected, normalise } from './grid';
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

describe('cellKey', () => {
  test('separates rows from columns unambiguously', () => {
    expect(cellKey({ row: 1, col: 23 })).not.toBe(cellKey({ row: 12, col: 3 }));
  });
});
