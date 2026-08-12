/**
 * What came back: the search running, the pieces, the proof, or the refusal.
 *
 * Four commitments from the spec are load-bearing here.
 *
 * - **The result is text as well as a picture.** A canvas full of pieces is
 *   nothing to a screen-reader user, so the same sentence that is announced in
 *   the live region is also on screen, and the piece list is text. The wording
 *   is `announcement.ts`, which is tested; this module only places it.
 * - **Pieces are told apart by more than hue.** Each carries a letter, a fill
 *   pattern and a colour; see `piece-canvas.ts`.
 * - **A refusal names the fix.** The engine's `message` is shown verbatim, and
 *   when it carries a `suggestedPieceCount` that becomes a single button.
 * - **The proof is watched, not asserted** (issue #7). The canvas replays the
 *   dissections the search really rejected, each stamped with its true solution
 *   count, and lands on the accepted one; then the proof panel fills in.
 *
 * The animation delays *nothing*. The puzzle is finished before the first frame
 * is drawn: the headline sentence, the live-region announcement, the piece list
 * and — outside this module — the download buttons and share link are all final
 * from the first paint. Only the picture and the numbers beneath it catch up,
 * and the skip control collapses even that.
 */

import { describePieces, describeProof, describeResult } from '@/lib/announcement';
import { proofRows } from '@/lib/proof-summary';
import type { TimelineFrame } from '@/lib/search-timeline';
import type { BuildResult, Shape } from '@/lib/types';
import { el, onSchemeChange } from './dom';
import { drawPieces } from './piece-canvas';
import { createSearchAnimation } from './search-animation';

export interface ResultViewHandlers {
  /** The one-click fix offered on a rejection that names a piece count. */
  readonly onUseSuggestedPieceCount: (pieceCount: number) => void;
}

export interface ResultView {
  readonly element: HTMLElement;
  update: (result: BuildResult | null) => void;
}

export function createResultView(handlers: ResultViewHandlers): ResultView {
  const canvas = el('canvas', {
    class: 'result__canvas',
    // The canvas repeats what the text beside it already says.
    role: 'img',
    'aria-label': 'The pieces, drawn where they sit in the solution.',
  });

  const announcement = el('p', {
    class: 'result__headline',
    role: 'status',
    'aria-live': 'polite',
  });
  const pieceList = el('p', { class: 'result__detail' });
  const proofLine = el('p', { class: 'result__detail' });
  const stats = el('dl', { class: 'result__stats' });

  const suggestion = el('button', { type: 'button', class: 'button button--primary' });
  const rejection = el('div', { class: 'result__rejection', hidden: 'hidden' }, [suggestion]);

  let current: BuildResult | null = null;
  /** The dissection on the canvas right now: a candidate, or the answer. */
  let drawn: readonly Shape[] | null = null;

  const animation = createSearchAnimation({
    onFrame(frame: TimelineFrame): void {
      if (current?.ok !== true) return;
      drawn = frame.pieces;
      drawPieces(canvas, current.spec.target, frame.pieces);
    },
    onSettled(): void {
      if (current?.ok !== true) return;
      pieceList.textContent = describePieces(current);
      proofLine.textContent = describeProof(current);
      stats.replaceChildren(
        ...proofRows(current).map(({ term, value }) =>
          // A `div` around each pair, which HTML allows inside a `dl` and which
          // is what keeps a term next to its own value when the list is laid
          // out as a grid — a bare `dt`/`dd` sequence wraps into columns
          // independently and puts every number under the wrong label.
          el('div', { class: 'result__stat' }, [el('dt', {}, [term]), el('dd', {}, [value])]),
        ),
      );
    },
  });

  const element = el('section', { class: 'result', 'aria-labelledby': 'result-heading' }, [
    el('h2', { id: 'result-heading' }, ['The puzzle']),
    announcement,
    rejection,
    canvas,
    animation.element,
    pieceList,
    proofLine,
    stats,
  ]);

  function render(): void {
    stats.replaceChildren();
    pieceList.textContent = '';
    proofLine.textContent = '';

    if (current === null) {
      announcement.textContent =
        'Nothing drawn yet. Pick a shape above, or draw one on the grid.';
      rejection.hidden = true;
      canvas.hidden = true;
      animation.stop();
      drawn = null;
      return;
    }

    // Final, immediately: the search is already over by the time this runs.
    announcement.textContent = describeResult(current);

    if (!current.ok) {
      canvas.hidden = true;
      animation.stop();
      drawn = null;
      const suggested = current.suggestedPieceCount;
      rejection.hidden = suggested === undefined;
      if (suggested !== undefined) {
        suggestion.textContent = `Use ${suggested} pieces instead`;
        suggestion.onclick = (): void => handlers.onUseSuggestedPieceCount(suggested);
      }
      return;
    }

    rejection.hidden = true;
    canvas.hidden = false;
    animation.play(current);
  }

  const redraw = (): void => {
    if (current?.ok === true && drawn !== null) drawPieces(canvas, current.spec.target, drawn);
  };
  new ResizeObserver(redraw).observe(canvas);
  onSchemeChange(redraw);

  return {
    element,
    update(result: BuildResult | null): void {
      current = result;
      render();
    },
  };
}
