/**
 * The editor's model: everything the controls and the grid can change, as
 * plain data with pure transitions.
 *
 * `src/components/` is DOM wiring only, so every decision the UI makes about a
 * value — what a piece count is allowed to be, which cells survive a change of
 * grid resolution, what the next seed is — is made here and tested here. The
 * component layer reads the state and draws it; it never reasons about it.
 *
 * This module holds no puzzle logic. It assembles a `PuzzleSpec` and hands it
 * to `buildPuzzle` (via `encodeState`), and that is the whole of its
 * relationship with the engine.
 *
 * The grid is square. A single resolution is one control rather than two, and
 * the codec stores a target relative to its own bounding box, so where a shape
 * sits inside the grid never reaches the URL or the puzzle.
 */

import {
  DEFAULT_PIECE_COUNT,
  MAX_PIECES,
  MIN_PIECES,
} from './envelope';
import { cellKey } from './grid';
import type { Preset } from './presets';
import type { Cell, Material, PuzzleSpec, Shape } from './types';

/** Coarsest grid offered. Below this even a blob struggles to reach 24 cells. */
export const MIN_GRID_SIZE = 8;
/** Finest grid offered. Above this the cells are too small to hit on a phone. */
export const MAX_GRID_SIZE = 28;
export const DEFAULT_GRID_SIZE = 12;

/** Millimetres per cell, bounded by what fits on a sheet of A4. */
export const MIN_CELL_SIZE_MM = 6;
export const MAX_CELL_SIZE_MM = 40;
export const DEFAULT_CELL_SIZE_MM = 18;

/** Offered in this order; the codec's material codes are separate and frozen. */
export const MATERIALS: readonly Material[] = [
  'cardstock',
  'chipboard',
  'laser-ply',
  'acrylic',
];

export const DEFAULT_MATERIAL: Material = 'cardstock';

/** Empty squares kept around a preset, so it can be edited without resizing. */
const PRESET_MARGIN = 2;

export interface EditorState {
  /** Side of the square drawing grid, in cells. */
  readonly size: number;
  /** The outline being drawn. Always inside the grid. */
  readonly target: Shape;
  readonly pieceCount: number;
  readonly seed: number;
  readonly material: Material;
  readonly cellSizeMm: number;
}

function clampInteger(value: number, low: number, high: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(high, Math.max(low, Math.round(value)));
}

/**
 * The UI cannot ask for a piece count outside the measured envelope. The engine
 * would refuse one anyway; refusing it here means the user never spends a
 * generation to be told so.
 */
export function clampPieceCount(value: number): number {
  return clampInteger(value, MIN_PIECES, MAX_PIECES, DEFAULT_PIECE_COUNT);
}

export function clampGridSize(value: number): number {
  return clampInteger(value, MIN_GRID_SIZE, MAX_GRID_SIZE, DEFAULT_GRID_SIZE);
}

/** Tenths of a millimetre is what the codec stores, so that is the precision. */
export function clampCellSizeMm(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CELL_SIZE_MM;
  const rounded = Math.round(value * 10) / 10;
  return Math.min(MAX_CELL_SIZE_MM, Math.max(MIN_CELL_SIZE_MM, rounded));
}

export function clampMaterial(value: string): Material {
  return MATERIALS.find((material) => material === value) ?? DEFAULT_MATERIAL;
}

/** Sort row-major, so equal outlines are equal arrays whatever the draw order. */
function ordered(cells: readonly Cell[]): Shape {
  return [...cells].sort((a, b) => a.row - b.row || a.col - b.col);
}

/** The blank editor: a default grid with nothing drawn on it. */
export function emptyState(): EditorState {
  return {
    size: DEFAULT_GRID_SIZE,
    target: [],
    pieceCount: DEFAULT_PIECE_COUNT,
    seed: 1,
    material: DEFAULT_MATERIAL,
    cellSizeMm: DEFAULT_CELL_SIZE_MM,
  };
}

interface Placement {
  readonly size: number;
  readonly target: Shape;
}

/** Put a shape at the top-left of a grid big enough to hold it and a margin. */
function place(shape: Shape, margin: number): Placement {
  if (shape.length === 0) return { size: DEFAULT_GRID_SIZE, target: [] };

  let minRow = Infinity;
  let minCol = Infinity;
  let maxRow = -Infinity;
  let maxCol = -Infinity;
  for (const { row, col } of shape) {
    if (row < minRow) minRow = row;
    if (col < minCol) minCol = col;
    if (row > maxRow) maxRow = row;
    if (col > maxCol) maxCol = col;
  }
  const height = maxRow - minRow + 1;
  const width = maxCol - minCol + 1;

  // A shape wider than the finest grid is only reachable from a hand-made link;
  // it still has to land somewhere, so the grid stretches to hold it.
  const size = Math.max(
    MIN_GRID_SIZE,
    Math.min(MAX_GRID_SIZE, Math.max(height, width) + margin * 2),
    Math.max(height, width),
  );
  const rowOffset = Math.floor((size - height) / 2) - minRow;
  const colOffset = Math.floor((size - width) / 2) - minCol;

  return {
    size,
    target: ordered(
      shape.map(({ row, col }) => ({ row: row + rowOffset, col: col + colOffset })),
    ),
  };
}

/** A gallery preset, centred on a grid, at the default piece count. */
export function fromPreset(preset: Preset): EditorState {
  const { size, target } = place(preset.target, PRESET_MARGIN);
  return { ...emptyState(), size, target, seed: preset.seed };
}

/**
 * The state a decoded link describes.
 *
 * The codec drops where a shape was drawn, so this centres it. Two people who
 * drew the same outline in different corners of the grid open the same editor,
 * which is the same reason the codec drops the position in the first place.
 */
export function fromSpec(spec: PuzzleSpec): EditorState {
  const { size, target } = place(spec.target, PRESET_MARGIN);
  return {
    size,
    target,
    pieceCount: clampPieceCount(spec.pieceCount),
    seed: spec.seed,
    material: spec.material,
    cellSizeMm: clampCellSizeMm(spec.cellSizeMm),
  };
}

/** The spec this state describes, ready for `encodeState`. */
export function toSpec(state: EditorState): PuzzleSpec {
  return {
    target: state.target,
    pieceCount: state.pieceCount,
    seed: state.seed,
    material: state.material,
    cellSizeMm: state.cellSizeMm,
  };
}

/** True when the cell is on the grid. */
export function isOnGrid(state: EditorState, cell: Cell): boolean {
  return (
    Number.isInteger(cell.row) &&
    Number.isInteger(cell.col) &&
    cell.row >= 0 &&
    cell.col >= 0 &&
    cell.row < state.size &&
    cell.col < state.size
  );
}

export function isFilled(state: EditorState, cell: Cell): boolean {
  const key = cellKey(cell);
  return state.target.some((filled) => cellKey(filled) === key);
}

/**
 * Add or remove one cell. Off-grid cells are ignored rather than rejected,
 * because a drag that leaves the canvas is a normal thing for a pointer to do.
 *
 * Returns the same object when nothing changed, so the caller can skip a
 * redraw and a regeneration on the many pointer moves that land on a cell
 * already in the state it wants.
 */
export function setCell(state: EditorState, cell: Cell, filled: boolean): EditorState {
  if (!isOnGrid(state, cell)) return state;
  const already = isFilled(state, cell);
  if (already === filled) return state;

  const key = cellKey(cell);
  const target = filled
    ? ordered([...state.target, { row: cell.row, col: cell.col }])
    : state.target.filter((existing) => cellKey(existing) !== key);
  return { ...state, target };
}

export function clearTarget(state: EditorState): EditorState {
  return state.target.length === 0 ? state : { ...state, target: [] };
}

/**
 * Change the grid resolution.
 *
 * Cells that fall outside the new grid are dropped rather than scaled: scaling
 * an outline changes the puzzle silently, and the whole point of the resolution
 * control is to trade detail against piece size deliberately.
 */
export function withGridSize(state: EditorState, size: number): EditorState {
  const next = clampGridSize(size);
  if (next === state.size) return state;
  return {
    ...state,
    size: next,
    target: state.target.filter(({ row, col }) => row < next && col < next),
  };
}

export function withPieceCount(state: EditorState, pieceCount: number): EditorState {
  return { ...state, pieceCount: clampPieceCount(pieceCount) };
}

export function withMaterial(state: EditorState, material: string): EditorState {
  return { ...state, material: clampMaterial(material) };
}

export function withCellSizeMm(state: EditorState, cellSizeMm: number): EditorState {
  return { ...state, cellSizeMm: clampCellSizeMm(cellSizeMm) };
}

/**
 * The next puzzle from the same outline. Seeds stay inside the u32 the codec
 * stores, so "regenerate" can be pressed indefinitely without ever producing a
 * spec that cannot be encoded.
 */
export function advanceSeed(state: EditorState): EditorState {
  return { ...state, seed: (state.seed + 1) % 0x1_0000_0000 };
}

/** Move the keyboard cursor, clamped to the grid rather than wrapping. */
export function moveCursor(
  state: EditorState,
  cursor: Cell,
  rowStep: number,
  colStep: number,
): Cell {
  const limit = state.size - 1;
  return {
    row: Math.min(limit, Math.max(0, cursor.row + rowStep)),
    col: Math.min(limit, Math.max(0, cursor.col + colStep)),
  };
}
