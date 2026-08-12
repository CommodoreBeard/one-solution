/**
 * The search, played back: the demo (issue #7).
 *
 * A single solution count takes about 3 ms, so there is nothing here to hide
 * behind a spinner. What is worth showing is the *work*: the dissections the
 * engine drew and threw away, each stamped with the number of ways it could be
 * reassembled, until one comes up with exactly one. That explains the algorithm
 * without a word of prose.
 *
 * Three rules hold this module together.
 *
 * - **The candidates are real.** Every frame comes from `PuzzleDocument.rejected`
 *   by way of `search-timeline.ts`. Nothing is synthesised; a first-attempt
 *   success plays a one-frame timeline that says it was found first time.
 * - **Nothing is blocked.** The puzzle is finished before the first frame is
 *   drawn. The headline, the download buttons and the share link are all live
 *   from the first paint, and skipping only fast-forwards the picture.
 * - **State lives here.** The engine returns data and knows nothing about
 *   presentation; the schedule is pure data in `src/lib`; this file owns the
 *   clock, the canvas and the buttons, and nothing else.
 *
 * Under `prefers-reduced-motion` the timeline is one already-settled frame, so
 * the final state is drawn once and no content is ever shown and replaced.
 */

import { buildTimeline, frameAt, isSettled } from '@/lib/search-timeline';
import type { SearchTimeline, TimelineFrame } from '@/lib/search-timeline';
import type { PuzzleDocument } from '@/lib/types';
import { el, prefersReducedMotion } from './dom';

export interface SearchAnimationHandlers {
  /** Draw this frame's dissection. Called for every frame, settled or not. */
  readonly onFrame: (frame: TimelineFrame) => void;
  /** The accepted dissection is on screen: the proof panel may fill in. */
  readonly onSettled: () => void;
}

export interface SearchAnimation {
  /** The stamp, the caption and the skip control. */
  readonly element: HTMLElement;
  /** Play the search that produced `doc`, or resolve straight to its end. */
  play: (doc: PuzzleDocument) => void;
  /** Jump to the settled state. Safe at any time, including when idle. */
  settle: () => void;
  /** Abandon the run without settling, for a result that no longer applies. */
  stop: () => void;
}

export function createSearchAnimation(handlers: SearchAnimationHandlers): SearchAnimation {
  const stamp = el('p', { class: 'search__stamp' });
  const caption = el('p', { class: 'search__caption' });
  const note = el('p', { class: 'search__note' });
  const skip = el('button', { type: 'button', class: 'button button--quiet' }, [
    'Skip the search',
  ]);

  const element = el('div', { class: 'search', hidden: 'hidden' }, [
    el('div', { class: 'search__row' }, [stamp, skip]),
    caption,
    note,
  ]);

  let timeline: SearchTimeline | null = null;
  let handle: number | null = null;
  let startedAt = 0;
  let shown: TimelineFrame | null = null;

  function cancel(): void {
    if (handle !== null) cancelAnimationFrame(handle);
    handle = null;
  }

  /** Draw a frame only when it is not the one already on the canvas. */
  function show(frame: TimelineFrame): void {
    if (frame === shown) return;
    shown = frame;
    stamp.textContent = frame.countLabel;
    stamp.dataset.kind = frame.kind;
    caption.textContent = frame.caption;
    handlers.onFrame(frame);
  }

  function finish(): void {
    if (timeline === null) return;
    cancel();
    show(timeline.frames[timeline.frames.length - 1]);
    skip.hidden = true;
    element.dataset.state = 'settled';
    handlers.onSettled();
  }

  function tick(): void {
    if (timeline === null) return;
    const elapsed = performance.now() - startedAt;
    if (isSettled(timeline, elapsed)) {
      finish();
      return;
    }
    show(frameAt(timeline, elapsed));
    handle = requestAnimationFrame(tick);
  }

  skip.addEventListener('click', finish);

  return {
    element,
    play(doc: PuzzleDocument): void {
      cancel();
      shown = null;
      timeline = buildTimeline(doc, { reducedMotion: prefersReducedMotion() });
      element.hidden = false;
      element.dataset.state = 'running';
      note.textContent = timeline.truncatedNote ?? '';
      skip.hidden = !timeline.skippable;

      if (!timeline.skippable) {
        // Nothing to watch — one honest frame, drawn once.
        finish();
        return;
      }
      startedAt = performance.now();
      show(timeline.frames[0]);
      handle = requestAnimationFrame(tick);
    },
    settle(): void {
      finish();
    },
    stop(): void {
      cancel();
      timeline = null;
      shown = null;
      element.hidden = true;
      element.dataset.state = 'idle';
    },
  };
}
