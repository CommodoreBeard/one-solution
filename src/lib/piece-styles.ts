/**
 * How the pieces are told apart on screen.
 *
 * The spec requires pieces to be distinguishable by more than hue, so every
 * piece carries three independent marks: a letter, a fill pattern and a hue.
 * A colour-blind user reads the letters and the patterns; a user in bright
 * sunlight reads the letters. Hue is the decoration, not the information.
 *
 * There are exactly `MAX_PIECES` patterns and `MAX_PIECES` letters, so no two
 * pieces of any legal puzzle ever share either one. That is asserted in the
 * sibling test rather than left to a reader to count.
 *
 * Lightness is fixed per scheme by the stylesheet, not here: these hues are
 * chosen to stay legible against both a light and a dark background.
 */

import { MAX_PIECES } from './envelope';

/** Drawn by the canvas renderer. Each is a distinct texture, not a shade. */
export type PiecePattern =
  | 'solid'
  | 'stripes-up'
  | 'stripes-down'
  | 'horizontal'
  | 'vertical'
  | 'grid'
  | 'dots';

export interface PieceStyle {
  /** `A`, `B`, `C`… Printed on the piece and used in the text description. */
  readonly label: string;
  readonly pattern: PiecePattern;
  /** Degrees on the colour wheel. The stylesheet fixes saturation and lightness. */
  readonly hue: number;
}

const PATTERNS: readonly PiecePattern[] = [
  'solid',
  'stripes-up',
  'grid',
  'stripes-down',
  'dots',
  'horizontal',
  'vertical',
];

/**
 * Spread around the wheel rather than evenly stepped, because an even step
 * puts two of seven hues in the red-green pair that is hardest to separate.
 */
const HUES: readonly number[] = [210, 25, 145, 285, 55, 330, 180];

/**
 * The style for the piece at `index`.
 *
 * Wraps rather than throws past `MAX_PIECES`: the engine cannot produce more
 * pieces than that, and a renderer is the wrong place to discover it if it
 * ever did.
 */
export function pieceStyle(index: number): PieceStyle {
  const at = ((index % MAX_PIECES) + MAX_PIECES) % MAX_PIECES;
  return {
    label: String.fromCharCode(65 + at),
    pattern: PATTERNS[at]!,
    hue: HUES[at]!,
  };
}
