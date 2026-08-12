/**
 * The search, replayed as a schedule of frames.
 *
 * The engine hands back `PuzzleDocument.rejected`: the dissections it drew,
 * counted, and threw away, each with its true number of distinct solutions.
 * This turns that list into a timeline the UI can play — what to draw, what to
 * say, when, and for how long — and nothing more. It renders nothing, owns no
 * clock, and touches no DOM, which is what makes the interesting part testable
 * and keeps the animation out of the engine.
 *
 * **Nothing here is invented.** Every candidate frame is one of the engine's
 * own rejects with the engine's own count. A search that succeeded on its first
 * draw has no candidates, and the honest thing to show is exactly that: one
 * frame, saying it was found first time. A timeline that padded that case with
 * plausible-looking failures would be a lie about the one thing this product
 * sells.
 *
 * Two details that are easy to get wrong and both are honesty problems:
 *
 * - The engine stops counting a reject at `SOLUTION_COUNT_CAP` raw partitions,
 *   so a distinct count that reaches the cap is a floor. It is labelled `12+`,
 *   not `12`.
 * - Only `MAX_RETAINED_REJECTS` candidates are kept, while `attempts` can be
 *   larger. When they differ, the timeline says how many of how many are being
 *   shown rather than letting the replay imply it was the whole search.
 */

import { SOLUTION_COUNT_CAP } from './envelope';
import type { PuzzleDocument, Shape } from './types';

/** The whole show, at most. About a second: long enough to read, short enough to sit through. */
export const MAX_ANIMATION_MS = 1400;

/** Fast enough to feel like a search, slow enough that the count is readable. */
export const MIN_FRAME_MS = 70;

/** A single candidate held longer than this stops being an animation. */
export const MAX_FRAME_MS = 220;

/** The accepted dissection, held before the proof panel settles. */
export const SETTLE_MS = 520;

export interface TimelineFrame {
  /** A discarded draw, or the one that was kept. */
  readonly kind: 'candidate' | 'solution';
  /** 1-based position among the candidates; 0 on the solution frame. */
  readonly index: number;
  /** The dissection to draw. The same array the engine returned. */
  readonly pieces: readonly Shape[];
  /** The engine's count for this dissection. 1 on the solution frame. */
  readonly distinctSolutions: number;
  /** The stamp over the drawing: `4 solutions`, `12+ solutions`, `1 solution`. */
  readonly countLabel: string;
  /** The sentence beneath it. */
  readonly caption: string;
  readonly startMs: number;
  /** Zero on the solution frame: it is terminal, not timed. */
  readonly durationMs: number;
}

export interface SearchTimeline {
  readonly frames: readonly TimelineFrame[];
  /** Retained rejects, whether or not they are being animated. */
  readonly candidateCount: number;
  readonly attempts: number;
  /** When the solution frame is reached. Zero when there is nothing to play. */
  readonly totalMs: number;
  /** False when the timeline is one frame — there is nothing to skip. */
  readonly skippable: boolean;
  readonly reducedMotion: boolean;
  /** Set when the search tried more candidates than it kept. */
  readonly truncatedNote: string | null;
}

export interface TimelineOptions {
  /** Resolve straight to the final state, without flashing anything past. */
  readonly reducedMotion?: boolean;
}

/**
 * A count the engine may have stopped short of. `12+` where it capped, an
 * exact number below that.
 */
function countLabel(distinctSolutions: number): string {
  if (distinctSolutions >= SOLUTION_COUNT_CAP) return `${SOLUTION_COUNT_CAP}+ solutions`;
  return `${distinctSolutions} solution${distinctSolutions === 1 ? '' : 's'}`;
}

/** How long each candidate is held so the whole run fits the budget. */
function frameDuration(candidateCount: number): number {
  if (candidateCount === 0) return 0;
  const share = (MAX_ANIMATION_MS - SETTLE_MS) / candidateCount;
  return Math.max(MIN_FRAME_MS, Math.min(MAX_FRAME_MS, Math.round(share)));
}

function solutionCaption(attempts: number): string {
  if (attempts <= 1) {
    return 'Found on the first candidate: exactly 1 solution, up to the outline’s symmetry.';
  }
  return `Candidate ${attempts}: exactly 1 solution, up to the outline’s symmetry. Accepted.`;
}

function solutionFrame(doc: PuzzleDocument, startMs: number): TimelineFrame {
  return {
    kind: 'solution',
    index: 0,
    pieces: doc.pieces,
    distinctSolutions: 1,
    countLabel: '1 solution',
    caption: solutionCaption(doc.proof.attempts),
    startMs,
    durationMs: 0,
  };
}

/**
 * Schedule the replay of a real search.
 *
 * Under `reducedMotion` the result is a one-frame timeline that is already
 * settled: the final state, immediately, with no content shown and replaced.
 * The candidate counts are still reported — as text, in `candidateCount` and
 * the caption — so it is the same information without the strobing.
 */
export function buildTimeline(
  doc: PuzzleDocument,
  options: TimelineOptions = {},
): SearchTimeline {
  const reducedMotion = options.reducedMotion === true;
  const candidateCount = doc.rejected.length;
  const attempts = doc.proof.attempts;
  // `attempts` counts the accepted draw too, so the rejects it implies is one
  // fewer. Stranded draws also spend an attempt without producing a candidate.
  const rejectedAttempts = Math.max(0, attempts - 1);
  const truncatedNote =
    candidateCount < rejectedAttempts
      ? `Showing ${candidateCount} of the ${rejectedAttempts} candidates the search discarded.`
      : null;

  if (reducedMotion || candidateCount === 0) {
    return {
      frames: [solutionFrame(doc, 0)],
      candidateCount,
      attempts,
      totalMs: 0,
      skippable: false,
      reducedMotion,
      truncatedNote,
    };
  }

  const duration = frameDuration(candidateCount);
  const frames: TimelineFrame[] = doc.rejected.map((candidate, position) => ({
    kind: 'candidate' as const,
    index: position + 1,
    pieces: candidate.pieces,
    distinctSolutions: candidate.distinctSolutions,
    countLabel: countLabel(candidate.distinctSolutions),
    caption: `Candidate ${position + 1}: ${countLabel(candidate.distinctSolutions)} — rejected.`,
    startMs: position * duration,
    durationMs: duration,
  }));

  const totalMs = candidateCount * duration;
  frames.push(solutionFrame(doc, totalMs));

  return {
    frames,
    candidateCount,
    attempts,
    totalMs,
    skippable: true,
    reducedMotion,
    truncatedNote,
  };
}

/** The frame showing at `elapsedMs`. Clamped at both ends. */
export function frameAt(timeline: SearchTimeline, elapsedMs: number): TimelineFrame {
  const { frames } = timeline;
  if (!(elapsedMs > 0)) return frames[0];
  if (elapsedMs >= timeline.totalMs) return frames[frames.length - 1];

  for (const frame of frames) {
    if (elapsedMs < frame.startMs + frame.durationMs) return frame;
  }
  return frames[frames.length - 1];
}

/** True once the accepted dissection is on screen and the panel may settle. */
export function isSettled(timeline: SearchTimeline, elapsedMs: number): boolean {
  return elapsedMs >= timeline.totalMs;
}
