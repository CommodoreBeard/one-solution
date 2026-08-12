/**
 * The guarantee, in plain words, standing on the page whether or not a puzzle
 * has been made yet.
 *
 * `announcement.ts` already states the claim for a *particular* puzzle, with
 * that outline's real symmetry order in it. This is the other half: the
 * definition itself, which a visitor needs before the numbers mean anything.
 * The spec requires it stated exactly (*Implementation Decisions → The
 * uniqueness claim, stated exactly*, and user story 36) — flips allowed,
 * counted up to the outline's symmetry group — because each clause was a bug in
 * the prototype at some point and a reader cannot tell which definition is in
 * force by looking at a picture of some pieces.
 *
 * Copy only. The engine's definition lives in the engine; if the two ever
 * disagree it is this file that is wrong, and the known-answer tests are what
 * say so.
 */

/** The headline claim: one sentence, no hedging, no jargon. */
export const UNIQUENESS_HEADLINE =
  'Exactly one arrangement of the pieces fills the outline. Not "probably one" ' +
  'and not "one we could find" — the count is re-run from scratch on the ' +
  'finished piece set, and a puzzle is only offered when that count comes back as one.';

/** What "the same arrangement" means, clause by clause. */
export const UNIQUENESS_CLAUSES: readonly string[] = [
  'Pieces may be flipped over. A card piece can be turned face down, so a mirrored placement is not a new solution — it is the same one.',
  "Arrangements are counted up to the outline's own symmetry group. Rotating or reflecting a finished puzzle inside a symmetric tray does not make a second answer.",
  'Identical pieces are interchangeable. Swapping two pieces of the same shape is not a second solution either.',
  'Everything else counts. Any placement that is not one of the above is a genuine second solution, and one is enough for the outline to be rejected.',
];

/** How the count is actually arrived at, for a reader who wants the mechanism. */
export const UNIQUENESS_METHOD =
  'Concretely: the engine counts distinct partitions of the outline into ' +
  'regions whose shapes match the piece multiset, then quotients by the ' +
  "outline's stabiliser subgroup of the dihedral group of order 8. The proof " +
  'panel above shows both numbers — the raw count and the symmetry order it is ' +
  'divided by — so you can check the quotient rather than trust it.';
