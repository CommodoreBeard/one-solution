/**
 * Pins issue #7's proof panel: "attempts, milliseconds, symmetry order, raw and
 * distinct counts", all five, with the raw count and the symmetry order beside
 * the distinct count so a sceptical reader can see what "exactly one" is
 * measured up to.
 *
 * Documents come from seam 1, so the numbers here are the engine's own.
 */

import { describe, expect, it } from 'vitest';
import { buildPuzzle } from './build-puzzle';
import { PRESETS } from './presets';
import { proofRows } from './proof-summary';
import type { PuzzleDocument } from './types';
import { encodeState } from './url-codec';

function document_(id: string): PuzzleDocument {
  const found = PRESETS.find((preset) => preset.id === id);
  if (found === undefined) throw new Error(`no preset ${id}`);
  const result = buildPuzzle(
    encodeState({
      target: found.target,
      pieceCount: 5,
      seed: found.seed,
      material: 'cardstock',
      cellSizeMm: 18,
    }),
  );
  if (!result.ok) throw new Error(`preset ${id}: ${result.reason}`);
  return result;
}

const valueOf = (doc: PuzzleDocument, term: string): string => {
  const row = proofRows(doc).find((candidate) => candidate.term === term);
  if (row === undefined) throw new Error(`no row "${term}"`);
  return row.value;
};

describe('proofRows', () => {
  it('reports the candidates tried and the milliseconds spent', () => {
    const doc = document_('cat');
    expect(valueOf(doc, 'Candidates tried')).toBe(String(doc.proof.attempts));
    expect(valueOf(doc, 'Search time')).toBe(`${Math.round(doc.proof.searchMs)} ms`);
  });

  it('reports the symmetry order the count is taken up to', () => {
    for (const { id } of PRESETS) {
      const doc = document_(id);
      expect(valueOf(doc, 'Symmetry order')).toBe(String(doc.proof.symmetryOrder));
    }
  });

  it('shows the raw count and the distinct count together, never one alone', () => {
    for (const { id } of PRESETS) {
      const doc = document_(id);
      const arrangements = valueOf(doc, 'Arrangements');
      expect(arrangements).toContain(`${doc.proof.rawSolutions} raw`);
      expect(arrangements).toContain('1 distinct');
      expect(arrangements).toContain(`symmetry order ${doc.proof.symmetryOrder}`);
    }
  });

  it('names the finished size, because the sheet is the point', () => {
    const doc = document_('cat');
    expect(valueOf(doc, 'Finished size')).toBe(
      `${doc.geometry.widthMm} × ${doc.geometry.heightMm} mm`,
    );
  });

  it('is a stable list of terms, so the panel does not reshuffle', () => {
    expect(proofRows(document_('cat')).map((row) => row.term)).toEqual([
      'Candidates tried',
      'Search time',
      'Symmetry order',
      'Arrangements',
      'Finished size',
    ]);
  });
});
