/**
 * The prior art, named on the page before anybody else names it for us.
 *
 * The spec is explicit (*Further Notes → Name the prior art on the page*): ship
 * a comparison table covering BurrTools, Mechanical Puzzle Studio and Kita &
 * Miyata 2020, and state plainly what is new and what is not. Without it the
 * launch reads as reinvention, and the correction arrives as the top comment
 * rather than as our own copy.
 *
 * Kita & Miyata is cited first and by name in `PRIOR_ART_LEAD`, deliberately.
 * It is the closest prior art that exists, so raising it ourselves converts the
 * strongest available attack into a credential.
 *
 * This file is content, not logic. It holds no puzzle knowledge and computes
 * nothing; `components/prior-art.ts` puts it into a real `<table>`.
 */

/** One row of the comparison: a tool, what it does, and what it does not. */
export interface PriorArtRow {
  /** The tool or paper, as it should be cited. */
  readonly tool: string;
  /** The claim in its favour, stated as its authors would state it. */
  readonly does: string;
  /** The gap this project fills — never a criticism of the tool's own goal. */
  readonly doesNot: string;
}

/** The sentence that introduces the table. Names the closest prior art first. */
export const PRIOR_ART_LEAD =
  'None of this is invented from nothing. Kita and Miyata showed in 2020 that ' +
  'a user-supplied shape can be dissected into polyominoes automatically, and ' +
  'two mature pieces of puzzle software already do the solving and the ' +
  'counting. Here is exactly where each of them stops.';

/** The comparison table, in display order. */
export const PRIOR_ART: readonly PriorArtRow[] = [
  {
    tool: 'BurrTools',
    does: 'Solves and analyses puzzles whose pieces you supply.',
    doesNot:
      'Does not generate dissections. Its design chapter is explicitly ' +
      'unimplemented — the manual says the text was written as though the ' +
      'features existed so it could be reused later.',
  },
  {
    tool: 'Mechanical Puzzle Studio',
    does: 'Counts solutions up to symmetry, free, in the browser, today.',
    doesNot: 'Does not generate dissections; no fabrication output.',
  },
  {
    tool: 'Kita & Miyata, 2020',
    does: 'Dissects a user-supplied shape into polyominoes.',
    doesNot: 'No uniqueness guarantee, no difficulty score, no released code.',
  },
];

/** What this page adds that the row above does not already cover. */
export const WHAT_IS_NEW: readonly string[] = [
  'Generating a dissection of an arbitrary outline rather than asking you to supply the pieces.',
  'Proving that dissection is the only one, and showing the count rather than asserting it.',
  'Emitting a hand-cut fabrication package — true-scale cut sheet, tray template, mirrored solution card, calibration ruler.',
];

/** What is commodity, said plainly so that nobody has to say it for us. */
export const WHAT_IS_NOT_NEW: readonly string[] = [
  'Exact-cover solving in the browser. That is a solved problem and has been for years.',
  'Cut-file export. SVG and DXF writers are commodity, and kerf-compensated generators are free and abundant.',
  'Custom-shape puzzles as a product. They are sold commercially today; only the guarantee is unoccupied ground.',
];
