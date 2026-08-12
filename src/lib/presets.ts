/**
 * The gallery: ready-made outlines, so the first screen is something a visitor
 * recognises rather than an empty grid.
 *
 * Each outline is written as ASCII art, because a shape you can see in the
 * source is a shape that stays recognisable when someone edits it. `X` is a
 * cell; anything else is empty.
 *
 * Every preset here is inside the measured envelope (`envelope.ts`) and has a
 * seed that produces a unique dissection at the default piece count. That is
 * not a claim to take on trust — `presets.test.ts` builds every one of them
 * through `buildPuzzle` and fails if any preset stops working.
 *
 * Shapes are deliberately chunky. The measured table in `envelope.ts` says
 * thin outlines are the worst performers, and a gallery whose shapes sometimes
 * fail is worse than a smaller gallery.
 */

import type { Cell, Shape } from './types';

export interface Preset {
  /** Stable identifier, used as the DOM id and in tests. */
  readonly id: string;
  /** Shown on the gallery tile. */
  readonly name: string;
  /** One line, read out with the name to screen-reader users. */
  readonly description: string;
  readonly target: Shape;
  /** A seed known to yield a unique dissection at the default piece count. */
  readonly seed: number;
}

/** ASCII art to cells. `X` is filled; every other character is empty. */
function outline(rows: readonly string[]): Shape {
  const cells: Cell[] = [];
  rows.forEach((line, row) => {
    [...line].forEach((character, col) => {
      if (character === 'X') cells.push({ row, col });
    });
  });
  return cells;
}

export const PRESETS: readonly Preset[] = [
  {
    id: 'cat',
    name: 'Cat',
    description: 'A sitting cat with pointed ears',
    seed: 1,
    target: outline([
      'X.....X',
      'XX...XX',
      'XXXXXXX',
      'XXXXXXX',
      '.XXXXX.',
      '.XXXXX.',
      'XXXXXXX',
      'XXXXXXX',
    ]),
  },
  {
    id: 'heart',
    name: 'Heart',
    description: 'A broad heart with two lobes',
    seed: 1,
    target: outline([
      '.XX...XX.',
      'XXXXXXXXX',
      'XXXXXXXXX',
      'XXXXXXXXX',
      '.XXXXXXX.',
      '..XXXXX..',
      '...XXX...',
    ]),
  },
  {
    id: 'leaf',
    name: 'Leaf',
    description: 'A leaf on the diagonal, tip to stem',
    seed: 1,
    target: outline([
      '...XX..',
      '..XXXX.',
      '.XXXXXX',
      'XXXXXXX',
      'XXXXXX.',
      'XXXXX..',
      '.XXX...',
      '..X....',
    ]),
  },
  {
    id: 'fish',
    name: 'Fish',
    description: 'A fish with a forked tail',
    seed: 1,
    target: outline([
      '..XXXX..X',
      '.XXXXXXXX',
      'XXXXXXXXX',
      'XXXXXXXXX',
      '.XXXXXXXX',
      '..XXXX..X',
    ]),
  },
  {
    id: 'blob',
    name: 'Blob',
    description: 'A rounded blob, the easiest shape to dissect',
    seed: 1,
    target: outline([
      '..XXXX..',
      '.XXXXXX.',
      'XXXXXXXX',
      'XXXXXXXX',
      'XXXXXXX.',
      '.XXXXX..',
    ]),
  },
  {
    id: 'house',
    name: 'House',
    description: 'A house with a pitched roof',
    seed: 1,
    target: outline([
      '...XX...',
      '..XXXX..',
      '.XXXXXX.',
      'XXXXXXXX',
      'XXXXXXXX',
      'XXXXXXXX',
      'XXXXXXXX',
    ]),
  },
  {
    id: 'county',
    name: 'County',
    description: 'A lopsided county outline',
    seed: 1,
    target: outline([
      '..XXXXX..',
      '.XXXXXXX.',
      'XXXXXXXXX',
      'XXXXXXXX.',
      'XXXXXXX..',
      '.XXXXXX..',
      '..XXXX...',
    ]),
  },
  {
    id: 'pinwheel',
    name: 'Pinwheel',
    description: 'A chunky abstract of two offset blocks',
    seed: 1,
    target: outline([
      'XXXXXX..',
      'XXXXXX..',
      'XXXXXXXX',
      'XXXXXXXX',
      '..XXXXXX',
      '..XXXXXX',
    ]),
  },
];

/** A preset by id, or `undefined` if nothing matches. */
export function findPreset(id: string): Preset | undefined {
  return PRESETS.find((preset) => preset.id === id);
}
