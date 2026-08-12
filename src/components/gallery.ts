/**
 * The front door.
 *
 * The gallery is the first thing in the document, before any canvas, because a
 * blank grid tells a visitor nothing about what the page makes. Each tile is
 * one button: pressing it generates a puzzle with no further input.
 *
 * Thumbnails are SVG rather than canvas — they never redraw, and a vector
 * thumbnail scales with the user's text size instead of going soft.
 */

import { PRESETS } from '@/lib/presets';
import type { Preset } from '@/lib/presets';
import { el, svg } from './dom';

/** A preset outline as a square SVG, one rect per cell. */
function thumbnail(preset: Preset): SVGElement {
  let maxRow = 0;
  let maxCol = 0;
  for (const { row, col } of preset.target) {
    if (row > maxRow) maxRow = row;
    if (col > maxCol) maxCol = col;
  }
  const side = Math.max(maxRow, maxCol) + 1;
  const rowOffset = (side - (maxRow + 1)) / 2;
  const colOffset = (side - (maxCol + 1)) / 2;

  return svg(
    'svg',
    {
      class: 'gallery__thumb',
      viewBox: `0 0 ${side} ${side}`,
      'aria-hidden': 'true',
      focusable: 'false',
    },
    preset.target.map(({ row, col }) =>
      svg('rect', {
        x: String(col + colOffset),
        y: String(row + rowOffset),
        width: '1',
        height: '1',
      }),
    ),
  );
}

/** The gallery section. `onPick` is called with the preset that was pressed. */
export function createGallery(onPick: (preset: Preset) => void): HTMLElement {
  const tiles = PRESETS.map((preset) => {
    const button = el(
      'button',
      {
        type: 'button',
        class: 'gallery__tile',
        'data-preset': preset.id,
        // The description would otherwise be a second, silent line of text:
        // a screen reader reads the accessible name, so it has to carry both.
        'aria-label': `${preset.name}. ${preset.description}. Make this puzzle.`,
      },
      [
        thumbnail(preset),
        el('span', { class: 'gallery__name' }, [preset.name]),
        el('span', { class: 'gallery__description', 'aria-hidden': 'true' }, [
          preset.description,
        ]),
      ],
    );
    button.addEventListener('click', () => onPick(preset));
    return button;
  });

  return el('section', { class: 'gallery', 'aria-labelledby': 'gallery-heading' }, [
    el('h2', { id: 'gallery-heading' }, ['Start from a shape']),
    el('p', { class: 'gallery__lead' }, [
      'Pick one and the search runs immediately. Every outline here is inside ' +
        'the measured envelope, so it will produce a puzzle.',
    ]),
    el('div', { class: 'gallery__grid' }, tiles),
  ]);
}
