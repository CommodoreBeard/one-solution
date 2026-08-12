/**
 * Pins issue 8: "The comparison table is on the page", covering BurrTools,
 * Mechanical Puzzle Studio and Kita & Miyata 2020, and stating plainly what is
 * new and what is not.
 *
 * Copy is not usually worth a test. This copy is, because it is the difference
 * between a launch that names its prior art and one that reads as reinvention,
 * and because a trimmed table is exactly the kind of edit that looks harmless
 * in a diff. The assertions are on the claims the spec names, not on wording.
 */

import { describe, expect, test } from 'vitest';
import {
  PRIOR_ART,
  PRIOR_ART_LEAD,
  WHAT_IS_NEW,
  WHAT_IS_NOT_NEW,
} from './prior-art';

describe('the prior-art comparison', () => {
  test('names all three tools the spec requires', () => {
    const tools = PRIOR_ART.map((row) => row.tool);
    expect(tools).toContain('BurrTools');
    expect(tools).toContain('Mechanical Puzzle Studio');
    expect(tools.some((tool) => tool.includes('Kita') && tool.includes('2020'))).toBe(true);
  });

  test('gives every tool both a what-it-does and a what-it-does-not', () => {
    for (const row of PRIOR_ART) {
      expect(row.does.length).toBeGreaterThan(0);
      expect(row.doesNot.length).toBeGreaterThan(0);
    }
  });

  test('cites Kita and Miyata in the lead, before the table is reached', () => {
    // The strongest available attack, raised first so that it reads as a
    // credential rather than a correction.
    expect(PRIOR_ART_LEAD).toContain('Kita');
    expect(PRIOR_ART_LEAD).toContain('2020');
  });

  test('claims the three things that are new, and concedes the two that are not', () => {
    const isNew = WHAT_IS_NEW.join(' ').toLowerCase();
    expect(isNew).toContain('arbitrary outline');
    expect(isNew).toContain('proving');
    expect(isNew).toContain('cut sheet');

    const isNotNew = WHAT_IS_NOT_NEW.join(' ').toLowerCase();
    expect(isNotNew).toContain('exact-cover');
    expect(isNotNew).toContain('cut-file export');
  });
});
