/**
 * The grid editor: a canvas the outline is drawn on with a pointer, a finger
 * or the arrow keys.
 *
 * Canvas rather than DOM cells, per the spec's rendering decision — a 28×28
 * grid is 784 nodes to restyle on every pointer move, and the same canvas
 * redraw is one call.
 *
 * This module decides nothing about the outline. Which cells exist, which
 * survive a change of resolution and where the cursor may go are all
 * `editor-state.ts`, which has the tests; here there is only input handling
 * and paint.
 *
 * Three input paths, one code path: pointer events cover mouse, pen and touch
 * together, and the keyboard reaches the same `onPaint` callback the pointer
 * does, so a keyboard user is drawing the same outline rather than a lesser
 * one. Painting reports each cell as it is touched; `onCommit` fires once the
 * gesture ends, because generation is worth doing once per stroke and not once
 * per cell.
 */

import { isFilled, moveCursor } from '@/lib/editor-state';
import type { EditorState } from '@/lib/editor-state';
import type { Cell } from '@/lib/types';
import { el, fitCanvas, onSchemeChange, prefersDark } from './dom';

export interface GridEditorHandlers {
  /** One cell added or erased. Called many times during a drag. */
  readonly onPaint: (cell: Cell, filled: boolean) => void;
  /** The stroke is over: a good moment to regenerate. */
  readonly onCommit: () => void;
}

export interface GridEditor {
  readonly element: HTMLElement;
  update: (state: EditorState) => void;
}

interface Palette {
  readonly grid: string;
  readonly filled: string;
  readonly cursor: string;
  readonly background: string;
}

function palette(): Palette {
  return prefersDark()
    ? {
        grid: 'rgba(255, 255, 255, 0.16)',
        filled: '#7fb2ff',
        cursor: '#ffd166',
        background: 'rgba(255, 255, 255, 0.03)',
      }
    : {
        grid: 'rgba(0, 0, 0, 0.14)',
        filled: '#2f6fd0',
        cursor: '#b45309',
        background: 'rgba(0, 0, 0, 0.02)',
      };
}

export function createGridEditor(handlers: GridEditorHandlers): GridEditor {
  const canvas = el('canvas', {
    class: 'grid-editor__canvas',
    tabindex: '0',
    role: 'application',
    'aria-label':
      'Outline editor. Drag to draw, drag over a filled square to erase. ' +
      'With the keyboard: arrow keys move, space fills or clears, ' +
      'shift with an arrow key paints while moving.',
  });

  const status = el('p', {
    class: 'grid-editor__status',
    role: 'status',
    'aria-live': 'polite',
  });

  const element = el('div', { class: 'grid-editor' }, [canvas, status]);

  let state: EditorState | null = null;
  let cursor: Cell = { row: 0, col: 0 };
  /** What the current gesture is doing: fill, erase, or nothing in progress. */
  let painting: boolean | null = null;

  const cellPx = (): number => {
    const size = state?.size ?? 1;
    return Math.min(canvas.clientWidth, canvas.clientHeight) / size;
  };

  function draw(): void {
    const current = state;
    const context = fitCanvas(canvas);
    if (context === null || current === null) return;

    const colours = palette();
    const step = cellPx();
    const extent = step * current.size;

    context.fillStyle = colours.background;
    context.fillRect(0, 0, extent, extent);

    context.fillStyle = colours.filled;
    for (const { row, col } of current.target) {
      context.fillRect(col * step, row * step, step, step);
    }

    context.strokeStyle = colours.grid;
    context.lineWidth = 1;
    context.beginPath();
    for (let i = 0; i <= current.size; i += 1) {
      const at = Math.round(i * step) + 0.5;
      context.moveTo(at, 0.5);
      context.lineTo(at, extent + 0.5);
      context.moveTo(0.5, at);
      context.lineTo(extent + 0.5, at);
    }
    context.stroke();

    // The cursor is only meaningful to a keyboard user, and drawing it always
    // would put a permanent marker on a canvas most people never focus.
    if (document.activeElement === canvas) {
      context.strokeStyle = colours.cursor;
      context.lineWidth = 3;
      context.strokeRect(
        cursor.col * step + 1.5,
        cursor.row * step + 1.5,
        step - 3,
        step - 3,
      );
    }
  }

  function announceCursor(): void {
    if (state === null) return;
    status.textContent =
      `Row ${cursor.row + 1}, column ${cursor.col + 1}: ` +
      `${isFilled(state, cursor) ? 'filled' : 'empty'}. ` +
      `${state.target.length} squares drawn.`;
  }

  function cellAt(event: PointerEvent): Cell | null {
    if (state === null) return null;
    const rect = canvas.getBoundingClientRect();
    const step = cellPx();
    if (step <= 0) return null;
    const col = Math.floor((event.clientX - rect.left) / step);
    const row = Math.floor((event.clientY - rect.top) / step);
    if (row < 0 || col < 0 || row >= state.size || col >= state.size) return null;
    return { row, col };
  }

  canvas.addEventListener('pointerdown', (event: PointerEvent) => {
    const cell = cellAt(event);
    if (cell === null || state === null) return;
    event.preventDefault();
    canvas.focus();
    canvas.setPointerCapture(event.pointerId);
    // Starting on a filled square erases, starting on an empty one draws. One
    // gesture, no mode switch, and the same rule under a finger as a mouse.
    painting = !isFilled(state, cell);
    cursor = cell;
    handlers.onPaint(cell, painting);
    announceCursor();
  });

  canvas.addEventListener('pointermove', (event: PointerEvent) => {
    if (painting === null) return;
    const cell = cellAt(event);
    if (cell === null) return;
    cursor = cell;
    handlers.onPaint(cell, painting);
  });

  const endStroke = (event: PointerEvent): void => {
    if (painting === null) return;
    painting = null;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    announceCursor();
    handlers.onCommit();
  };

  canvas.addEventListener('pointerup', endStroke);
  canvas.addEventListener('pointercancel', endStroke);

  const ARROWS: Readonly<Record<string, readonly [number, number]>> = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
  };

  canvas.addEventListener('keydown', (event: KeyboardEvent) => {
    if (state === null) return;
    const step = ARROWS[event.key];

    if (step !== undefined) {
      event.preventDefault();
      cursor = moveCursor(state, cursor, step[0], step[1]);
      // Shift turns the arrow keys into a drag: the keyboard equivalent of
      // holding the button down while moving.
      if (event.shiftKey) {
        handlers.onPaint(cursor, true);
        handlers.onCommit();
      }
      announceCursor();
      draw();
      return;
    }

    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      handlers.onPaint(cursor, !isFilled(state, cursor));
      handlers.onCommit();
      announceCursor();
      return;
    }

    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      handlers.onPaint(cursor, false);
      handlers.onCommit();
      announceCursor();
    }
  });

  canvas.addEventListener('focus', () => {
    announceCursor();
    draw();
  });
  canvas.addEventListener('blur', draw);

  new ResizeObserver(draw).observe(canvas);
  onSchemeChange(draw);

  return {
    element,
    update(next: EditorState): void {
      state = next;
      cursor = moveCursor(next, cursor, 0, 0);
      draw();
    },
  };
}
