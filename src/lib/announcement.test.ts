/**
 * Pins issue 6: "Result announced as text for screen readers, including piece
 * count", and "A too-thin or too-small shape shows the engine's message".
 *
 * The rejection wording is the engine's, verbatim — a paraphrase here would be
 * a second copy of a message that already names the fix.
 */

import { describe, expect, test } from 'vitest';
import { describePieces, describeProof, describeResult } from './announcement';
import { buildPuzzle } from './build-puzzle';
import { fromPreset, toSpec } from './editor-state';
import { DEFAULT_PIECE_COUNT } from './envelope';
import { PRESETS } from './presets';
import { encodeState } from './url-codec';

const preset = PRESETS[0]!;
const built = buildPuzzle(encodeState(toSpec(fromPreset(preset))));

describe('the announcement for a puzzle', () => {
  test('names the piece count', () => {
    expect(built.ok).toBe(true);
    const sentence = describeResult(built);
    expect(sentence).toContain(`${DEFAULT_PIECE_COUNT} pieces`);
    expect(sentence).toContain('exactly one way');
  });

  test('lists the pieces by their labels, so the canvas is not the only source', () => {
    if (!built.ok) throw new Error('the first preset must build');
    const sentence = describePieces(built);
    expect(sentence).toContain('A, ');
    expect(sentence.match(/cells?/g)).toHaveLength(DEFAULT_PIECE_COUNT);
  });

  test('states what "exactly one" is measured up to', () => {
    if (!built.ok) throw new Error('the first preset must build');
    const sentence = describeProof(built);
    expect(sentence).toContain(`order ${built.proof.symmetryOrder}`);
    expect(sentence).toContain('flips allowed');
  });
});

describe('the announcement for a rejection', () => {
  test('uses the engine message unchanged, so the named fix survives', () => {
    // Four cells: under MIN_TARGET_CELLS, so the engine refuses before searching.
    const tiny = encodeState({
      target: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 1, col: 0 },
        { row: 1, col: 1 },
      ],
      pieceCount: DEFAULT_PIECE_COUNT,
      seed: 1,
      material: 'cardstock',
      cellSizeMm: 18,
    });
    const rejected = buildPuzzle(tiny);
    expect(rejected.ok).toBe(false);
    if (rejected.ok) return;
    expect(describeResult(rejected)).toContain(rejected.message);
  });
});
