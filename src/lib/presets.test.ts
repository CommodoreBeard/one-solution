/**
 * Pins issue 6: "Six to eight outlines, each already passing the envelope
 * guards" and "Clicking a preset produces a puzzle without further input".
 *
 * Every preset is built through `buildPuzzle` — the only seam a UI test is
 * allowed to touch — so this fails the moment a preset stops producing a
 * puzzle, whether the preset changed or the engine did. Eyeballing the shapes
 * would not catch either.
 */

import { describe, expect, test } from 'vitest';
import { buildPuzzle } from './build-puzzle';
import { fromPreset, toSpec } from './editor-state';
import { DEFAULT_PIECE_COUNT, MAX_PIECES, MIN_PIECES } from './envelope';
import { PRESETS, findPreset } from './presets';
import { encodeState } from './url-codec';

describe('the preset gallery', () => {
  test('offers between six and eight outlines', () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(6);
    expect(PRESETS.length).toBeLessThanOrEqual(8);
  });

  test('gives every preset a unique id and a name', () => {
    const ids = new Set(PRESETS.map((preset) => preset.id));
    expect(ids.size).toBe(PRESETS.length);
    for (const preset of PRESETS) {
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.description.length).toBeGreaterThan(0);
    }
  });

  test('looks presets up by id', () => {
    expect(findPreset(PRESETS[0]!.id)?.name).toBe(PRESETS[0]!.name);
    expect(findPreset('not-a-preset')).toBeUndefined();
  });
});

describe.each(PRESETS.map((preset) => [preset.id, preset] as const))(
  'the %s preset',
  (_id, preset) => {
    test('produces a puzzle with one click, at the default piece count', () => {
      const state = fromPreset(preset);
      expect(state.pieceCount).toBe(DEFAULT_PIECE_COUNT);

      const result = buildPuzzle(encodeState(toSpec(state)));
      // A failure here means the gallery would hand a visitor a rejection on
      // their first click, so the message is worth having in the output.
      expect(result.ok ? '' : result.message).toBe('');
      if (!result.ok) return;

      expect(result.pieces).toHaveLength(DEFAULT_PIECE_COUNT);
      expect(result.proof.distinctSolutions).toBe(1);
    });

    test('survives the round trip through the fragment unchanged', () => {
      const encoded = encodeState(toSpec(fromPreset(preset)));
      const first = buildPuzzle(encoded);
      const second = buildPuzzle(encoded);
      expect(first.ok).toBe(true);
      if (!first.ok || !second.ok) return;
      expect(second.pieces).toEqual(first.pieces);
    });

    test('is inside the envelope at every piece count the UI can ask for', () => {
      // Not every count need succeed — the engine names a working count when
      // one fails — but a preset that cannot be dissected at all is a bad
      // preset, and a rejection for being too thin or too small is a broken one.
      const reasons = new Set<string>();
      for (let k = MIN_PIECES; k <= MAX_PIECES; k += 1) {
        const spec = { ...toSpec(fromPreset(preset)), pieceCount: k };
        const result = buildPuzzle(encodeState(spec));
        if (!result.ok) reasons.add(result.reason);
      }
      expect([...reasons]).not.toContain('shape-too-thin');
      expect([...reasons]).not.toContain('shape-too-small');
      expect([...reasons]).not.toContain('shape-disconnected');
    });
  },
);
