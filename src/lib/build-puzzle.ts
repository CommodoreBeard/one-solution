/**
 * Seam 1: the whole engine behind one function.
 *
 * ```ts
 * buildPuzzle(encodedState: string): PuzzleDocument | Rejection
 * ```
 *
 * It takes the encoded string rather than a decoded object, so the URL codec is
 * exercised by every engine test and needs no seam of its own. Growth, exact
 * cover, canonicalisation, the symmetry quotient, orbit counting, the retry
 * loop and geometry layout are all internal to this call.
 *
 * ## The central invariant
 *
 * Nothing leaves here on the search's own authority. Before a document is
 * returned, the piece set is **re-counted from scratch** — partitions found
 * again, quotient taken again — and the numbers in the `Proof` are the ones
 * this second pass produced, not the ones the search reported. The two are then
 * compared, and a disagreement is a refusal.
 *
 * That costs one extra exact-cover search, a fraction of a millisecond against
 * the hundreds of searches that produced the candidate. It is the difference
 * between a guarantee and a hope: the product's only claim is that the pieces
 * fit back together in exactly one way, and the user finds out otherwise after
 * they have cut the pieces out.
 *
 * The re-count also checks the boring things the counter would not notice — the
 * pieces cover the target exactly, do not overlap, are each connected, and are
 * the number that was asked for — because a "unique" dissection into the wrong
 * number of pieces is still wrong.
 *
 * ## Determinism
 *
 * The same encoded state yields the same document, byte for byte, with one
 * measured exception: `proof.searchMs` is wall-clock time and varies by machine
 * and by run. It describes the same deterministic work either way. See
 * docs/adr/0001-url-state-codec.md.
 */

import { buildGeometry } from './geometry';
import { cellKey, isConnected } from './grid';
import { generateFromSeed } from './guards';
import type { Generation } from './guards';
import { findPartitions } from './solution-count';
import { countOrbits, stabiliser } from './symmetry';
import type { BuildResult, Proof, PuzzleSpec, Shape } from './types';
import { decodeState } from './url-codec';

/**
 * The re-count is a fresh, independent statement about the piece set, so it
 * reports what it found rather than confirming what it was told.
 */
interface Recount {
  readonly symmetryOrder: number;
  readonly rawSolutions: number;
  readonly distinctSolutions: number;
}

/** True when the pieces are a partition of the target into connected regions. */
function isPartitionOf(target: Shape, pieces: readonly Shape[]): boolean {
  const covered = new Set<string>();
  for (const piece of pieces) {
    if (piece.length === 0 || !isConnected(piece)) return false;
    for (const cell of piece) {
      const key = cellKey(cell);
      // A repeat is an overlap between pieces, or a piece listing a cell twice.
      if (covered.has(key)) return false;
      covered.add(key);
    }
  }
  if (covered.size !== target.length) return false;
  return target.every((cell) => covered.has(cellKey(cell)));
}

/**
 * Count this piece set again from nothing.
 *
 * Partitions are collected to `|G| + 1`, which is the smallest cap that can
 * still prove uniqueness: more raw partitions than the group has elements means
 * at least two orbits whatever they are. So this never enumerates, and an
 * accepted puzzle's raw count is exact rather than capped.
 */
function recount(target: Shape, pieces: readonly Shape[]): Recount {
  const group = stabiliser(target);
  const partitions = findPartitions(target, pieces, group.length + 1);
  return {
    symmetryOrder: group.length,
    rawSolutions: partitions.length,
    distinctSolutions: countOrbits(partitions, target, group),
  };
}

const VERIFICATION_MESSAGE =
  'This puzzle could not be proved unique on a second check, so it will not be ' +
  'offered. Change the seed or the piece count and try again — and please ' +
  'report the link, because this should not happen.';

/**
 * Turn a verified generation into a document, or refuse.
 *
 * Every number in the returned `Proof` except `attempts` and `searchMs` comes
 * from `recount`; the search's own claims are only ever used to disagree with.
 */
function verify(spec: PuzzleSpec, found: Generation): BuildResult {
  const { target, pieceCount, cellSizeMm } = spec;
  const { pieces } = found;

  if (pieces.length !== pieceCount || !isPartitionOf(target, pieces)) {
    return { ok: false, reason: 'verification-failed', message: VERIFICATION_MESSAGE };
  }

  const { symmetryOrder, rawSolutions, distinctSolutions } = recount(target, pieces);
  if (
    distinctSolutions !== 1 ||
    rawSolutions < 1 ||
    rawSolutions > symmetryOrder ||
    symmetryOrder !== found.symmetryOrder ||
    rawSolutions !== found.rawSolutions
  ) {
    return { ok: false, reason: 'verification-failed', message: VERIFICATION_MESSAGE };
  }

  const proof: Proof = {
    attempts: found.attempts,
    symmetryOrder,
    rawSolutions,
    distinctSolutions: 1,
    searchMs: found.searchMs,
  };

  return {
    ok: true,
    spec,
    pieces,
    proof,
    // Real search output, honestly counted at the display cap by the search
    // itself. The animation in issue 7 replays these; none is synthesised, and
    // there is nothing to synthesise them from — a puzzle found on the first
    // draw simply has an empty list.
    rejected: found.rejected,
    geometry: buildGeometry(target, pieces, cellSizeMm),
  };
}

/**
 * Decode a state string and build the puzzle it describes.
 *
 * Never throws. A damaged link, an outline outside the measured envelope and a
 * piece count with no unique dissection all come back as a `Rejection` that
 * names the fix.
 */
export function buildPuzzle(encodedState: string): BuildResult {
  const decoded = decodeState(encodedState);
  if ('ok' in decoded) return decoded;

  const found = generateFromSeed(decoded.target, decoded.pieceCount, decoded.seed);
  if (!found.ok) return found;

  return verify(decoded, found);
}
