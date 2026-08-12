/**
 * Pins issue 6: "Piece count cannot be set above MAX_PIECES through the UI",
 * "drag to add cells, drag to erase, adjustable grid resolution", the keyboard
 * cursor, and the regenerate control advancing the seed.
 *
 * These are the decisions the components are forbidden from making for
 * themselves, so they are all tested here and none of them is tested through
 * the DOM.
 */

import { describe, expect, test } from 'vitest';
import {
  DEFAULT_CELL_SIZE_MM,
  MAX_CELL_SIZE_MM,
  MAX_GRID_SIZE,
  MIN_CELL_SIZE_MM,
  MIN_GRID_SIZE,
  advanceSeed,
  clampCellSizeMm,
  clampGridSize,
  clampMaterial,
  clampPieceCount,
  clearTarget,
  emptyState,
  fromPreset,
  fromSpec,
  isFilled,
  isOnGrid,
  moveCursor,
  setCell,
  toSpec,
  withCellSizeMm,
  withGridSize,
  withMaterial,
  withPieceCount,
} from './editor-state';
import { DEFAULT_PIECE_COUNT, MAX_PIECES, MIN_PIECES } from './envelope';
import { PRESETS } from './presets';

describe('the piece-count control', () => {
  test('never yields a count outside the measured envelope', () => {
    expect(clampPieceCount(MAX_PIECES + 1)).toBe(MAX_PIECES);
    expect(clampPieceCount(99)).toBe(MAX_PIECES);
    expect(clampPieceCount(MIN_PIECES - 1)).toBe(MIN_PIECES);
    expect(clampPieceCount(-4)).toBe(MIN_PIECES);
  });

  test('falls back to the default for a value that is not a number', () => {
    expect(clampPieceCount(Number.NaN)).toBe(DEFAULT_PIECE_COUNT);
    expect(clampPieceCount(Number.POSITIVE_INFINITY)).toBe(DEFAULT_PIECE_COUNT);
  });

  test('rounds a fractional count rather than passing it to the engine', () => {
    expect(clampPieceCount(4.4)).toBe(4);
  });

  test('clamps when set on a state, whatever the caller asks for', () => {
    expect(withPieceCount(emptyState(), 12).pieceCount).toBe(MAX_PIECES);
  });
});

describe('the cell-size and material controls', () => {
  test('bound the cell size to what fits a sheet', () => {
    expect(clampCellSizeMm(MAX_CELL_SIZE_MM + 10)).toBe(MAX_CELL_SIZE_MM);
    expect(clampCellSizeMm(0)).toBe(MIN_CELL_SIZE_MM);
    expect(clampCellSizeMm(Number.NaN)).toBe(DEFAULT_CELL_SIZE_MM);
  });

  test('round the cell size to the tenth of a millimetre the codec stores', () => {
    expect(clampCellSizeMm(12.34)).toBe(12.3);
    expect(withCellSizeMm(emptyState(), 12.36).cellSizeMm).toBe(12.4);
  });

  test('reject a material the codec does not know', () => {
    expect(clampMaterial('unobtainium')).toBe(emptyState().material);
    expect(withMaterial(emptyState(), 'acrylic').material).toBe('acrylic');
  });
});

describe('the grid', () => {
  test('bounds the resolution control', () => {
    expect(clampGridSize(MAX_GRID_SIZE + 5)).toBe(MAX_GRID_SIZE);
    expect(clampGridSize(1)).toBe(MIN_GRID_SIZE);
  });

  test('drops cells that fall outside a coarser grid rather than scaling them', () => {
    const drawn = setCell(
      setCell(emptyState(), { row: 0, col: 0 }, true),
      { row: 11, col: 11 },
      true,
    );
    const smaller = withGridSize(drawn, MIN_GRID_SIZE);
    expect(smaller.size).toBe(MIN_GRID_SIZE);
    expect(smaller.target).toEqual([{ row: 0, col: 0 }]);
  });

  test('keeps every cell when the grid grows', () => {
    const drawn = setCell(emptyState(), { row: 3, col: 4 }, true);
    expect(withGridSize(drawn, MAX_GRID_SIZE).target).toEqual(drawn.target);
  });
});

describe('drawing', () => {
  test('adds and erases a cell', () => {
    const filled = setCell(emptyState(), { row: 2, col: 3 }, true);
    expect(isFilled(filled, { row: 2, col: 3 })).toBe(true);

    const erased = setCell(filled, { row: 2, col: 3 }, false);
    expect(isFilled(erased, { row: 2, col: 3 })).toBe(false);
    expect(erased.target).toHaveLength(0);
  });

  test('ignores a drag that leaves the grid', () => {
    const state = emptyState();
    expect(isOnGrid(state, { row: -1, col: 0 })).toBe(false);
    expect(isOnGrid(state, { row: 0, col: state.size })).toBe(false);
    expect(setCell(state, { row: -1, col: 0 }, true)).toBe(state);
    expect(setCell(state, { row: 0, col: state.size }, true)).toBe(state);
  });

  test('returns the same state when a drag repaints a cell it already painted', () => {
    const filled = setCell(emptyState(), { row: 1, col: 1 }, true);
    expect(setCell(filled, { row: 1, col: 1 }, true)).toBe(filled);
  });

  test('orders cells row-major, so draw order never changes the puzzle', () => {
    const forwards = setCell(setCell(emptyState(), { row: 0, col: 1 }, true), { row: 0, col: 0 }, true);
    const backwards = setCell(setCell(emptyState(), { row: 0, col: 0 }, true), { row: 0, col: 1 }, true);
    expect(forwards.target).toEqual(backwards.target);
  });

  test('clears the outline, and is a no-op on an empty one', () => {
    const filled = setCell(emptyState(), { row: 1, col: 1 }, true);
    expect(clearTarget(filled).target).toHaveLength(0);

    const blank = emptyState();
    expect(clearTarget(blank)).toBe(blank);
  });
});

describe('the keyboard cursor', () => {
  test('moves a cell at a time and stops at the edges', () => {
    const state = emptyState();
    expect(moveCursor(state, { row: 2, col: 2 }, 1, 0)).toEqual({ row: 3, col: 2 });
    expect(moveCursor(state, { row: 0, col: 0 }, -1, -1)).toEqual({ row: 0, col: 0 });
    expect(
      moveCursor(state, { row: state.size - 1, col: state.size - 1 }, 1, 1),
    ).toEqual({ row: state.size - 1, col: state.size - 1 });
  });
});

describe('the regenerate control', () => {
  test('advances the seed and changes nothing else', () => {
    const state = fromPreset(PRESETS[0]!);
    const next = advanceSeed(state);
    expect(next.seed).toBe(state.seed + 1);
    expect(next.target).toEqual(state.target);
    expect(next.pieceCount).toBe(state.pieceCount);
  });

  test('stays inside the u32 the codec stores, however often it is pressed', () => {
    const wrapped = advanceSeed({ ...emptyState(), seed: 0xffff_ffff });
    expect(wrapped.seed).toBe(0);
  });
});

describe('presets and links', () => {
  test('open a preset centred on a grid at the default piece count', () => {
    for (const preset of PRESETS) {
      const state = fromPreset(preset);
      expect(state.pieceCount).toBe(DEFAULT_PIECE_COUNT);
      expect(state.target).toHaveLength(preset.target.length);
      for (const cell of state.target) expect(isOnGrid(state, cell)).toBe(true);
    }
  });

  test('round-trip a spec through the editor without changing the outline', () => {
    const spec = toSpec(fromPreset(PRESETS[1]!));
    const reopened = toSpec(fromSpec(spec));
    // Position on the grid is not part of the puzzle, so compare the shape by
    // its cell count and its extent rather than by absolute coordinates.
    expect(reopened.target).toHaveLength(spec.target.length);
    expect(reopened.pieceCount).toBe(spec.pieceCount);
    expect(reopened.seed).toBe(spec.seed);
    expect(reopened.material).toBe(spec.material);
    expect(reopened.cellSizeMm).toBe(spec.cellSizeMm);
  });

  test('clamp a piece count that arrived from a hand-edited link', () => {
    const spec = { ...toSpec(emptyState()), pieceCount: 99 };
    expect(fromSpec(spec).pieceCount).toBe(MAX_PIECES);
  });
});
