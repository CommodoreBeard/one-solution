/**
 * Pins issue 6: "Pieces distinguishable by more than hue" and the
 * accessibility criterion behind it. Two pieces sharing a pattern or a letter
 * would leave a colour-blind user reading hue alone, which is the exact
 * failure the requirement exists to prevent.
 */

import { describe, expect, test } from 'vitest';
import { MAX_PIECES } from './envelope';
import { pieceStyle } from './piece-styles';

describe('piece styles', () => {
  const styles = Array.from({ length: MAX_PIECES }, (_, index) => pieceStyle(index));

  test('give every piece of the largest legal puzzle its own letter', () => {
    expect(new Set(styles.map((style) => style.label)).size).toBe(MAX_PIECES);
    expect(styles[0]!.label).toBe('A');
  });

  test('give every piece its own fill pattern, so hue is never the only cue', () => {
    expect(new Set(styles.map((style) => style.pattern)).size).toBe(MAX_PIECES);
  });

  test('give every piece its own hue as a third, redundant cue', () => {
    expect(new Set(styles.map((style) => style.hue)).size).toBe(MAX_PIECES);
    for (const style of styles) {
      expect(style.hue).toBeGreaterThanOrEqual(0);
      expect(style.hue).toBeLessThan(360);
    }
  });

  test('are stable: the same index is always the same piece', () => {
    expect(pieceStyle(3)).toEqual(pieceStyle(3));
  });

  test('never throw for an index the renderer should not have produced', () => {
    expect(pieceStyle(MAX_PIECES)).toEqual(pieceStyle(0));
    expect(pieceStyle(-1)).toEqual(pieceStyle(MAX_PIECES - 1));
  });
});
