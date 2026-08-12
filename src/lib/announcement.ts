/**
 * The result as a sentence, for the live region.
 *
 * A screen-reader user gets no value from a canvas full of pieces, so the spec
 * requires the result announced as text including the piece count. The same
 * sentence is shown on screen: one wording, in one place, exercised by one
 * test.
 *
 * A rejection's own `message` is used verbatim. The engine's refusals already
 * name the fix, and paraphrasing them here would be a second, worse copy.
 */

import { pieceStyle } from './piece-styles';
import type { BuildResult, PuzzleDocument } from './types';

const plural = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? '' : 's'}`;

/** The headline sentence. Always names the piece count. */
export function describeResult(result: BuildResult): string {
  if (!result.ok) return `No puzzle yet. ${result.message}`;

  const { proof, pieces } = result;
  return (
    `Puzzle ready: ${plural(pieces.length, 'piece')} that fit the outline in ` +
    `exactly one way. Found after ${plural(proof.attempts, 'candidate')} in ` +
    `${plural(Math.round(proof.searchMs), 'millisecond')}.`
  );
}

/**
 * The pieces as text, so the drawing is not the only way to know what came out.
 * Sizes are in cells, which is the unit the editor works in.
 */
export function describePieces(doc: PuzzleDocument): string {
  const parts = doc.pieces.map(
    (piece, index) => `${pieceStyle(index).label}, ${plural(piece.length, 'cell')}`,
  );
  return `Pieces: ${parts.join('; ')}.`;
}

/**
 * The claim, stated as precisely as the spec states it: counted up to the
 * outline's own symmetry, with flips allowed.
 */
export function describeProof(doc: PuzzleDocument): string {
  const { symmetryOrder, rawSolutions } = doc.proof;
  return (
    `${plural(rawSolutions, 'arrangement')} found, which is one arrangement up ` +
    `to the outline's symmetry (order ${symmetryOrder}, flips allowed).`
  );
}
