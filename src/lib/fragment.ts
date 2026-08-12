/**
 * The fragment, in and out.
 *
 * The spec puts the encoded spec in the fragment because a fragment is never
 * sent to a server, and because a shared link must open straight onto the
 * finished puzzle. That is two lines of string handling, and it lives here
 * rather than in a component so that the round trip has a test.
 *
 * `decodeState` already tolerates a leading `#`, so reading is only about
 * telling "no puzzle in this URL" from "a puzzle that may or may not decode".
 */

/** The encoded state in a `location.hash`, or `null` when there is none. */
export function readFragment(hash: string): string | null {
  const text = hash.startsWith('#') ? hash.slice(1) : hash;
  return text.length === 0 ? null : text;
}

/** The `location.hash` an encoded state should be written as. */
export function toFragment(encoded: string): string {
  return `#${encoded}`;
}
