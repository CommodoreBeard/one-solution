/**
 * The honesty copy that has to sit next to the download control.
 *
 * The spec is explicit about this (*Further Notes → Be honest about
 * hand-cutting tolerance*): the guarantee is mathematical, and the object is
 * physical. A millimetre of accumulated slop across seven hand-cut pieces can
 * let a near-miss arrangement drop into the tray, and a user who discovers that
 * for themselves reasonably concludes the proof was a boast.
 *
 * It lives here, on its own, so the UI renders the same words the sheets carry
 * and neither can drift from the other. `HAND_CUTTING_CAVEAT` is the copy for
 * the screen; `SHEET_CAVEAT` is the one-line version printed on every sheet,
 * kept short because it has to fit inside the sheet width and ASCII-only
 * because it is written into a PDF string and a DXF text record.
 */

/** Shown near the download control, verbatim. */
export const HAND_CUTTING_CAVEAT =
  'The uniqueness proof is exact, but your scissors are not. Accumulated ' +
  'cutting slop across several pieces can make a near-miss arrangement fit ' +
  'physically, even though it does not fit mathematically. Cut carefully, and ' +
  'treat the guarantee as a statement about the shapes rather than about your ' +
  'craft knife.';

/** Printed on every exported sheet. One line, ASCII only. */
export const SHEET_CAVEAT =
  'Hand-cutting slop can make a near-miss arrangement fit physically.';
