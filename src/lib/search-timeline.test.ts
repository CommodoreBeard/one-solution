/**
 * Pins issue #7's honesty and behaviour requirements on the animation schedule:
 *
 * - "Rejected candidates shown are real, with their true solution counts" —
 *   every candidate frame comes from `doc.rejected` and carries that
 *   candidate's own `distinctSolutions`, in order, with nothing added.
 * - "A first-attempt success displays correctly rather than looking broken" —
 *   an empty `rejected` list still yields a complete, readable timeline.
 * - "`prefers-reduced-motion` resolves without flashing" — one frame, the
 *   final one, at zero elapsed time.
 * - "The animation is skippable" — the timeline says whether there is anything
 *   to skip, and `frameAt` past the end is the settled frame.
 *
 * The document under test is built through seam 1, so these are real search
 * outputs rather than hand-written fixtures.
 */

import { describe, expect, it } from 'vitest';
import { buildPuzzle } from './build-puzzle';
import { SOLUTION_COUNT_CAP } from './envelope';
import { PRESETS } from './presets';
import {
  buildTimeline,
  frameAt,
  isSettled,
  MAX_ANIMATION_MS,
  MIN_FRAME_MS,
} from './search-timeline';
import type { PuzzleDocument, Shape } from './types';
import { encodeState } from './url-codec';

function preset(id: string): { target: Shape; seed: number } {
  const found = PRESETS.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`no preset ${id}`);
  return { target: found.target, seed: found.seed };
}

/** A real document from the real engine, via the encoded state seam 1 takes. */
function document_(id: string, pieceCount: number): PuzzleDocument {
  const { target, seed } = preset(id);
  const result = buildPuzzle(
    encodeState({ target, pieceCount, seed, material: 'cardstock', cellSizeMm: 18 }),
  );
  if (!result.ok) throw new Error(`preset ${id} at ${pieceCount} pieces: ${result.reason}`);
  return result;
}

/** A preset whose search really did reject candidates before it succeeded. */
function withRejects(): PuzzleDocument {
  for (const { id } of PRESETS) {
    for (const pieceCount of [5, 6, 7]) {
      const { target, seed } = preset(id);
      const result = buildPuzzle(
        encodeState({ target, pieceCount, seed, material: 'cardstock', cellSizeMm: 18 }),
      );
      if (result.ok && result.rejected.length > 0) return result;
    }
  }
  throw new Error('no preset in the gallery rejects a candidate — cannot test the replay');
}

describe('buildTimeline', () => {
  it('replays every retained rejected candidate, in order, with its own count', () => {
    const doc = withRejects();
    const timeline = buildTimeline(doc);
    const candidates = timeline.frames.filter((frame) => frame.kind === 'candidate');

    expect(candidates).toHaveLength(doc.rejected.length);
    candidates.forEach((frame, index) => {
      const source = doc.rejected[index];
      expect(frame.pieces).toBe(source.pieces);
      expect(frame.distinctSolutions).toBe(source.distinctSolutions);
    });
  });

  it('never invents a candidate the search did not produce', () => {
    for (const { id } of PRESETS) {
      const doc = document_(id, 5);
      const timeline = buildTimeline(doc);
      expect(timeline.candidateCount).toBe(doc.rejected.length);
      expect(timeline.frames).toHaveLength(doc.rejected.length + 1);
    }
  });

  it('ends on the accepted dissection, stamped with exactly one solution', () => {
    const doc = withRejects();
    const timeline = buildTimeline(doc);
    const last = timeline.frames[timeline.frames.length - 1];

    expect(last.kind).toBe('solution');
    expect(last.pieces).toBe(doc.pieces);
    expect(last.distinctSolutions).toBe(1);
    expect(last.countLabel).toBe('1 solution');
  });

  it('labels a rejected candidate with its true count', () => {
    const doc = withRejects();
    const timeline = buildTimeline(doc);
    for (const frame of timeline.frames) {
      if (frame.kind !== 'candidate') continue;
      const expected =
        frame.distinctSolutions >= SOLUTION_COUNT_CAP
          ? `${SOLUTION_COUNT_CAP}+ solutions`
          : `${frame.distinctSolutions} solutions`;
      expect(frame.countLabel).toBe(expected);
      expect(frame.caption).toContain(expected);
    }
  });

  it('says "or more" at the counting cap rather than claiming an exact count', () => {
    // The engine stops counting a reject at SOLUTION_COUNT_CAP raw partitions,
    // so a distinct count that reaches the cap is a floor, not a total.
    const doc = withRejects();
    const capped = {
      ...doc,
      rejected: [{ pieces: doc.pieces, distinctSolutions: SOLUTION_COUNT_CAP }],
    };
    expect(buildTimeline(capped).frames[0].countLabel).toBe(`${SOLUTION_COUNT_CAP}+ solutions`);
  });

  it('gives a first-attempt success a complete timeline that says so', () => {
    const doc = document_('cat', 5);
    const first = { ...doc, rejected: [], proof: { ...doc.proof, attempts: 1 } };
    const timeline = buildTimeline(first);

    expect(timeline.candidateCount).toBe(0);
    expect(timeline.frames).toHaveLength(1);
    expect(timeline.frames[0].kind).toBe('solution');
    expect(timeline.frames[0].caption).toContain('first candidate');
    expect(timeline.skippable).toBe(false);
    expect(timeline.totalMs).toBe(0);
    expect(isSettled(timeline, 0)).toBe(true);
  });

  it('is skippable exactly when there is something to watch', () => {
    const doc = withRejects();
    expect(buildTimeline(doc).skippable).toBe(true);
    expect(buildTimeline({ ...doc, rejected: [] }).skippable).toBe(false);
  });

  it('resolves to the final frame with no flashing under reduced motion', () => {
    const doc = withRejects();
    const timeline = buildTimeline(doc, { reducedMotion: true });

    expect(timeline.reducedMotion).toBe(true);
    expect(timeline.frames).toHaveLength(1);
    expect(timeline.frames[0].kind).toBe('solution');
    expect(timeline.frames[0].startMs).toBe(0);
    expect(timeline.totalMs).toBe(0);
    expect(timeline.skippable).toBe(false);
    expect(isSettled(timeline, 0)).toBe(true);
    // The counts are still stated, in text, for someone who wanted the proof
    // and not the show.
    expect(timeline.candidateCount).toBe(doc.rejected.length);
  });

  it('schedules frames end to end inside the animation budget', () => {
    const doc = withRejects();
    const timeline = buildTimeline(doc);

    let at = 0;
    for (const frame of timeline.frames) {
      expect(frame.startMs).toBe(at);
      at += frame.durationMs;
    }
    expect(timeline.totalMs).toBeLessThanOrEqual(MAX_ANIMATION_MS);
    for (const frame of timeline.frames) {
      if (frame.kind === 'candidate') expect(frame.durationMs).toBeGreaterThanOrEqual(MIN_FRAME_MS);
    }
  });

  it('says so when the search tried more candidates than it kept', () => {
    const doc = withRejects();
    const many = { ...doc, proof: { ...doc.proof, attempts: doc.rejected.length + 20 } };
    const note = buildTimeline(many).truncatedNote;
    expect(note).toContain(String(doc.rejected.length));
    expect(note).toContain(String(doc.rejected.length + 19));

    // Nothing to say when every discarded candidate is on screen.
    const all = { ...doc, proof: { ...doc.proof, attempts: doc.rejected.length + 1 } };
    expect(buildTimeline(all).truncatedNote).toBeNull();
  });
});

describe('frameAt', () => {
  it('walks the frames in order and stops on the last one', () => {
    const doc = withRejects();
    const timeline = buildTimeline(doc);

    for (const frame of timeline.frames) {
      expect(frameAt(timeline, frame.startMs)).toBe(frame);
      expect(frameAt(timeline, frame.startMs + frame.durationMs / 2)).toBe(frame);
    }
    const last = timeline.frames[timeline.frames.length - 1];
    expect(frameAt(timeline, timeline.totalMs)).toBe(last);
    expect(frameAt(timeline, timeline.totalMs + 10_000)).toBe(last);
  });

  it('treats a negative or absent clock as the first frame', () => {
    const timeline = buildTimeline(withRejects());
    expect(frameAt(timeline, -5)).toBe(timeline.frames[0]);
  });

  it('is settled only once the schedule has run out', () => {
    const timeline = buildTimeline(withRejects());
    expect(isSettled(timeline, 0)).toBe(false);
    expect(isSettled(timeline, timeline.totalMs - 1)).toBe(false);
    expect(isSettled(timeline, timeline.totalMs)).toBe(true);
  });
});
