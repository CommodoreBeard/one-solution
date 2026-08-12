/**
 * The operating envelope, measured rather than guessed.
 *
 * A reference solver (see reference/) was run over 2,520 random dissections
 * across seven target shapes. The share of dissections with exactly one
 * solution, by piece count:
 *
 *   pieces   4     5     6     7     8     9
 *   blob    97%   88%   85%   53%   13%    0%
 *   dog     97%   92%   70%   37%    3%    0%
 *   square  95%   77%   55%   28%    7%    0%
 *   cat     92%   73%   42%   12%    3%    0%
 *   heart   72%   47%   13%    0%    0%    0%
 *   letters 38%   17%    2%    2%    0%    0%
 *
 * Two rules fall out of that table and both are enforced here rather than
 * left to the UI:
 *
 * 1. Nine pieces never worked. Not once, on any shape, in 360 attempts. Seven
 *    is the last piece count with a usable hit rate, so it is the hard cap.
 * 2. The "letters" row is a thin, letter-stroke shape and it is the worst by a
 *    wide margin. Narrow shapes force small pieces, and small pieces are
 *    mostly congruent duplicates of each other, which multiplies solutions.
 *    So thinness is rejected up front with a message that says why.
 */

/** Hard ceiling. Above this the engine rejects rather than searching. */
export const MAX_PIECES = 7;

/** Floor. Fewer than three pieces is not a puzzle. */
export const MIN_PIECES = 3;

/** What the UI offers before the user touches anything. */
export const DEFAULT_PIECE_COUNT = 5;

/** Below this the target cannot carry enough distinct pieces. */
export const MIN_TARGET_CELLS = 24;

/**
 * Minimum mean thickness, in cells, for a target to be accepted.
 *
 * Measured as target area divided by the count of cells lying on the outline.
 * A solid blob scores high; a letter stroke one or two cells wide scores near
 * 1.0 and is refused.
 */
export const MIN_MEAN_THICKNESS = 1.6;

/**
 * How many dissections to try before giving up on a piece count.
 *
 * A single search takes about 3 ms, and the worst observed hit rate that ever
 * succeeded was roughly 1 in 50, so 400 attempts is generous and still returns
 * inside about two seconds.
 */
export const MAX_ATTEMPTS = 400;

/**
 * Stop counting once this many solutions are found.
 *
 * Uniqueness only needs the search to prove a second solution exists, so the
 * engine aborts at 2. The high cap matters only for the rejected-candidate
 * animation, which shows honest counts.
 */
export const SOLUTION_COUNT_CAP = 12;

/** How many rejected candidates to retain for the search animation. */
export const MAX_RETAINED_REJECTS = 40;
