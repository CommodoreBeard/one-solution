/**
 * Pins issue 6: "The encoded spec lives in the fragment. A shared link must
 * open straight onto the finished puzzle." The fragment is what the recipient
 * pastes, so a leading `#`, an empty hash and a bare hash all have to behave.
 */

import { describe, expect, test } from 'vitest';
import { fromPreset, toSpec } from './editor-state';
import { readFragment, toFragment } from './fragment';
import { PRESETS } from './presets';
import { decodeState, encodeState } from './url-codec';

describe('the fragment', () => {
  test('round-trips an encoded state', () => {
    const encoded = encodeState(toSpec(fromPreset(PRESETS[0]!)));
    expect(readFragment(toFragment(encoded))).toBe(encoded);
  });

  test('reads nothing from a URL with no fragment', () => {
    expect(readFragment('')).toBeNull();
    expect(readFragment('#')).toBeNull();
  });

  test('tolerates a hash the browser handed over without its own marker', () => {
    expect(readFragment('1.abc')).toBe('1.abc');
  });

  test('opens a shared link on the same puzzle it encoded', () => {
    const spec = toSpec(fromPreset(PRESETS[2]!));
    const shared = toFragment(encodeState(spec));
    const decoded = decodeState(readFragment(shared)!);
    expect('ok' in decoded).toBe(false);
    if ('ok' in decoded) return;
    expect(decoded.pieceCount).toBe(spec.pieceCount);
    expect(decoded.target).toHaveLength(spec.target.length);
  });
});
