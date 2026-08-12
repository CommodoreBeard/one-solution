/**
 * The DOM layer's smoke check, and only that (issue #7).
 *
 * The suite runs in node with no jsdom, deliberately: pixels are checked by
 * hand and everything worth asserting about the animation is pure data in
 * `src/lib/search-timeline.ts`. What can still be checked here is the one thing
 * that would break silently — that loading a component touches no DOM until it
 * is called. A module that reached for `document` at import time would take the
 * whole page down, and would do it only in the browser.
 */

import { describe, expect, it } from 'vitest';

describe('the component modules', () => {
  it('import without a DOM present', async () => {
    expect(typeof globalThis.document).toBe('undefined');

    const animation = await import('./search-animation');
    const downloads = await import('./download-panel');
    const result = await import('./result-view');
    const canvas = await import('./piece-canvas');

    expect(typeof animation.createSearchAnimation).toBe('function');
    expect(typeof downloads.createDownloadPanel).toBe('function');
    expect(typeof result.createResultView).toBe('function');
    expect(typeof canvas.drawPieces).toBe('function');
  });
});
