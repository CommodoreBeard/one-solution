/**
 * The proof panel as data: term and value, in the order they are shown.
 *
 * The spec's sceptical visitor (*User Stories → Seeing the proof*, 16 and 17)
 * wants two things this list has to keep together — how hard the search worked,
 * and what "exactly one" is being measured up to. So the raw partition count,
 * the symmetry order and the distinct count appear in one row rather than
 * scattered: a distinct count on its own invites the accusation that the
 * quotient is hiding something, and the quotient is the whole claim.
 *
 * Formatting lives here rather than in the view because it is the part worth
 * testing, and because `result-view.ts` is DOM wiring.
 */

import type { PuzzleDocument } from './types';

export interface ProofRow {
  readonly term: string;
  readonly value: string;
}

/** The proof panel's rows, in display order. */
export function proofRows(doc: PuzzleDocument): readonly ProofRow[] {
  const { attempts, searchMs, symmetryOrder, rawSolutions } = doc.proof;
  const { widthMm, heightMm } = doc.geometry;

  return [
    { term: 'Candidates tried', value: String(attempts) },
    { term: 'Search time', value: `${Math.round(searchMs)} ms` },
    { term: 'Symmetry order', value: String(symmetryOrder) },
    {
      term: 'Arrangements',
      value: `${rawSolutions} raw ÷ symmetry order ${symmetryOrder} = 1 distinct`,
    },
    { term: 'Finished size', value: `${widthMm} × ${heightMm} mm` },
  ];
}
