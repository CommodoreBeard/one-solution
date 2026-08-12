/**
 * The controls: piece count, material, cell size, grid resolution, regenerate.
 *
 * Every value here is clamped twice on purpose. The input elements carry `min`
 * and `max` so the browser stops a drag at the right place and announces the
 * range to assistive technology, and `editor-state.ts` clamps again because an
 * attribute is a hint and a typed number, a pasted value or a hand-edited link
 * is not bound by one. The tested clamp is the one in `editor-state.ts`.
 *
 * The piece-count ceiling is `MAX_PIECES` from the measured envelope, not a
 * number chosen here.
 */

import {
  MATERIALS,
  MAX_CELL_SIZE_MM,
  MAX_GRID_SIZE,
  MIN_CELL_SIZE_MM,
  MIN_GRID_SIZE,
} from '@/lib/editor-state';
import type { EditorState } from '@/lib/editor-state';
import { MAX_PIECES, MIN_PIECES } from '@/lib/envelope';
import type { Material } from '@/lib/types';
import { el } from './dom';

export interface ControlsHandlers {
  readonly onPieceCount: (value: number) => void;
  readonly onMaterial: (value: string) => void;
  readonly onCellSizeMm: (value: number) => void;
  readonly onGridSize: (value: number) => void;
  readonly onRegenerate: () => void;
  readonly onClear: () => void;
}

export interface Controls {
  readonly element: HTMLElement;
  update: (state: EditorState) => void;
}

const MATERIAL_NAMES: Readonly<Record<Material, string>> = {
  cardstock: 'Cardstock',
  chipboard: 'Chipboard',
  'laser-ply': 'Laser ply',
  acrylic: 'Acrylic',
};

interface Slider {
  readonly field: HTMLElement;
  readonly input: HTMLInputElement;
  readonly readout: HTMLElement;
}

function slider(
  id: string,
  label: string,
  attributes: Readonly<Record<string, string>>,
  hint: string,
): Slider {
  const input = el('input', { type: 'range', id, ...attributes });
  const readout = el('output', { class: 'control__value', for: id });
  const field = el('div', { class: 'control' }, [
    el('label', { for: id }, [label]),
    el('div', { class: 'control__row' }, [input, readout]),
    el('p', { class: 'control__hint', id: `${id}-hint` }, [hint]),
  ]);
  input.setAttribute('aria-describedby', `${id}-hint`);
  return { field, input, readout };
}

export function createControls(handlers: ControlsHandlers): Controls {
  const pieces = slider(
    'piece-count',
    'Pieces',
    { min: String(MIN_PIECES), max: String(MAX_PIECES), step: '1' },
    `Between ${MIN_PIECES} and ${MAX_PIECES}. Above ${MAX_PIECES} no shape ever ` +
      'produced a single-solution puzzle in the measurements behind this page.',
  );
  pieces.input.addEventListener('input', () =>
    handlers.onPieceCount(Number(pieces.input.value)),
  );

  const grid = slider(
    'grid-size',
    'Grid resolution',
    { min: String(MIN_GRID_SIZE), max: String(MAX_GRID_SIZE), step: '1' },
    'More squares means more detail in the outline and smaller pieces. ' +
      'Squares outside a smaller grid are dropped, not shrunk.',
  );
  grid.input.addEventListener('input', () => handlers.onGridSize(Number(grid.input.value)));

  const cellSize = slider(
    'cell-size',
    'Square size',
    { min: String(MIN_CELL_SIZE_MM), max: String(MAX_CELL_SIZE_MM), step: '0.5' },
    'The printed size of one grid square, in millimetres.',
  );
  cellSize.input.addEventListener('input', () =>
    handlers.onCellSizeMm(Number(cellSize.input.value)),
  );

  const material = el(
    'select',
    { id: 'material' },
    MATERIALS.map((value) => el('option', { value }, [MATERIAL_NAMES[value]])),
  );
  material.addEventListener('change', () => handlers.onMaterial(material.value));
  const materialField = el('div', { class: 'control' }, [
    el('label', { for: 'material' }, ['Material']),
    el('div', { class: 'control__row' }, [material]),
    el('p', { class: 'control__hint', id: 'material-hint' }, [
      'Sets the cutting tolerance. Card is the reference material; laser users ' +
        'get a kerf allowance that has not been validated on a machine.',
    ]),
  ]);
  material.setAttribute('aria-describedby', 'material-hint');

  const regenerate = el('button', { type: 'button', class: 'button button--primary' }, [
    'Try another puzzle',
  ]);
  regenerate.addEventListener('click', handlers.onRegenerate);

  const clear = el('button', { type: 'button', class: 'button' }, ['Clear the grid']);
  clear.addEventListener('click', handlers.onClear);

  const element = el('section', { class: 'controls', 'aria-labelledby': 'controls-heading' }, [
    el('h2', { id: 'controls-heading' }, ['Settings']),
    pieces.field,
    grid.field,
    cellSize.field,
    materialField,
    el('div', { class: 'controls__actions' }, [regenerate, clear]),
  ]);

  return {
    element,
    update(state: EditorState): void {
      pieces.input.value = String(state.pieceCount);
      pieces.readout.textContent = String(state.pieceCount);

      grid.input.value = String(state.size);
      grid.readout.textContent = `${state.size} × ${state.size}`;

      cellSize.input.value = String(state.cellSizeMm);
      cellSize.readout.textContent = `${state.cellSizeMm} mm`;

      material.value = state.material;
      clear.disabled = state.target.length === 0;
    },
  };
}
