/**
 * What came back: the pieces, the proof, or the refusal.
 *
 * Three commitments from the spec are load-bearing here.
 *
 * - **The result is text as well as a picture.** A canvas full of pieces is
 *   nothing to a screen-reader user, so the same sentence that is announced in
 *   the live region is also on screen, and the piece list is text. The wording
 *   is `announcement.ts`, which is tested; this module only places it.
 * - **Pieces are told apart by more than hue.** Each carries a letter, a fill
 *   pattern and a colour, from `piece-styles.ts`. Remove the colour and the
 *   drawing still reads.
 * - **A refusal names the fix.** The engine's `message` is shown verbatim, and
 *   when it carries a `suggestedPieceCount` that becomes a single button.
 */

import { describePieces, describeProof, describeResult } from '@/lib/announcement';
import { pieceStyle } from '@/lib/piece-styles';
import type { PiecePattern } from '@/lib/piece-styles';
import type { BuildResult, PuzzleDocument, Shape } from '@/lib/types';
import { el, fitCanvas, onSchemeChange, prefersDark } from './dom';

export interface ResultViewHandlers {
  /** The one-click fix offered on a rejection that names a piece count. */
  readonly onUseSuggestedPieceCount: (pieceCount: number) => void;
}

export interface ResultView {
  readonly element: HTMLElement;
  update: (result: BuildResult | null) => void;
}

interface Bounds {
  readonly minRow: number;
  readonly minCol: number;
  readonly rows: number;
  readonly cols: number;
}

function boundsOf(shape: Shape): Bounds {
  let minRow = Infinity;
  let minCol = Infinity;
  let maxRow = -Infinity;
  let maxCol = -Infinity;
  for (const { row, col } of shape) {
    if (row < minRow) minRow = row;
    if (col < minCol) minCol = col;
    if (row > maxRow) maxRow = row;
    if (col > maxCol) maxCol = col;
  }
  return { minRow, minCol, rows: maxRow - minRow + 1, cols: maxCol - minCol + 1 };
}

/**
 * The texture over a piece, drawn inside an existing clip.
 *
 * Deliberately coarse: a fine texture and a colour are the same information at
 * arm's length, and the point of the pattern is to survive being reduced to
 * greyscale or printed.
 */
function paintPattern(
  context: CanvasRenderingContext2D,
  pattern: PiecePattern,
  bounds: { x: number; y: number; width: number; height: number },
  step: number,
): void {
  const { x, y, width, height } = bounds;
  const gap = Math.max(6, step / 3);
  context.beginPath();

  if (pattern === 'dots') {
    for (let dy = gap / 2; dy < height; dy += gap) {
      for (let dx = gap / 2; dx < width; dx += gap) {
        context.moveTo(x + dx + 1.6, y + dy);
        context.arc(x + dx, y + dy, 1.6, 0, Math.PI * 2);
      }
    }
    context.fill();
    return;
  }

  if (pattern === 'horizontal' || pattern === 'grid') {
    for (let dy = gap; dy < height; dy += gap) {
      context.moveTo(x, y + dy);
      context.lineTo(x + width, y + dy);
    }
  }
  if (pattern === 'vertical' || pattern === 'grid') {
    for (let dx = gap; dx < width; dx += gap) {
      context.moveTo(x + dx, y);
      context.lineTo(x + dx, y + height);
    }
  }
  if (pattern === 'stripes-up') {
    for (let at = 0; at < width + height; at += gap) {
      context.moveTo(x + at, y);
      context.lineTo(x + at - height, y + height);
    }
  }
  if (pattern === 'stripes-down') {
    for (let at = -height; at < width; at += gap) {
      context.moveTo(x + at, y);
      context.lineTo(x + at + height, y + height);
    }
  }
  context.stroke();
}

/** The path of a cell set, as one region of unit squares. */
function cellPath(piece: Shape, bounds: Bounds, step: number): Path2D {
  const path = new Path2D();
  for (const { row, col } of piece) {
    path.rect(
      (col - bounds.minCol) * step,
      (row - bounds.minRow) * step,
      step,
      step,
    );
  }
  return path;
}

function drawPuzzle(canvas: HTMLCanvasElement, doc: PuzzleDocument): void {
  const context = fitCanvas(canvas);
  if (context === null) return;

  const bounds = boundsOf(doc.spec.target);
  const step = Math.min(
    canvas.clientWidth / bounds.cols,
    canvas.clientHeight / bounds.rows,
  );
  const dark = prefersDark();
  const ink = dark ? '#f4f6fb' : '#12161f';

  context.translate(
    (canvas.clientWidth - bounds.cols * step) / 2,
    (canvas.clientHeight - bounds.rows * step) / 2,
  );

  doc.pieces.forEach((piece, index) => {
    const { hue, pattern, label } = pieceStyle(index);
    const path = cellPath(piece, bounds, step);

    context.fillStyle = dark ? `hsl(${hue} 55% 34%)` : `hsl(${hue} 62% 78%)`;
    context.fill(path);

    context.save();
    context.clip(path);
    context.strokeStyle = dark ? `hsl(${hue} 70% 72%)` : `hsl(${hue} 55% 32%)`;
    context.fillStyle = context.strokeStyle;
    context.lineWidth = 1.5;
    const piecePixels = boundsOf(piece);
    paintPattern(
      context,
      pattern,
      {
        x: (piecePixels.minCol - bounds.minCol) * step,
        y: (piecePixels.minRow - bounds.minRow) * step,
        width: piecePixels.cols * step,
        height: piecePixels.rows * step,
      },
      step,
    );
    context.restore();

    // The border is the fourth cue and the one that says where to cut.
    context.strokeStyle = ink;
    context.lineWidth = 2.5;
    context.stroke(outlinePath(piece, bounds, step));

    const centre = labelPoint(piece, bounds, step);
    context.font = `700 ${Math.max(11, step * 0.5)}px system-ui, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineWidth = 3;
    context.strokeStyle = dark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(255, 255, 255, 0.85)';
    context.strokeText(label, centre.x, centre.y);
    context.fillStyle = ink;
    context.fillText(label, centre.x, centre.y);
  });
}

/**
 * The outline of a piece: the cell edges that border something else. Drawing
 * every cell's four sides would put a line down the middle of every piece and
 * lose the only cue that says where one piece ends.
 */
function outlinePath(piece: Shape, bounds: Bounds, step: number): Path2D {
  const inside = new Set(piece.map(({ row, col }) => `${row},${col}`));
  const path = new Path2D();
  for (const { row, col } of piece) {
    const x = (col - bounds.minCol) * step;
    const y = (row - bounds.minRow) * step;
    const edges: readonly [boolean, number, number, number, number][] = [
      [!inside.has(`${row - 1},${col}`), x, y, x + step, y],
      [!inside.has(`${row + 1},${col}`), x, y + step, x + step, y + step],
      [!inside.has(`${row},${col - 1}`), x, y, x, y + step],
      [!inside.has(`${row},${col + 1}`), x + step, y, x + step, y + step],
    ];
    for (const [exposed, x0, y0, x1, y1] of edges) {
      if (!exposed) continue;
      path.moveTo(x0, y0);
      path.lineTo(x1, y1);
    }
  }
  return path;
}

/** A cell of the piece to put the letter on, biased to the middle of it. */
function labelPoint(piece: Shape, bounds: Bounds, step: number): { x: number; y: number } {
  const meanRow = piece.reduce((sum, cell) => sum + cell.row, 0) / piece.length;
  const meanCol = piece.reduce((sum, cell) => sum + cell.col, 0) / piece.length;
  // The centroid of an L-shaped piece can fall outside it, so the label goes on
  // whichever of its own cells is nearest that point.
  const nearest = piece.reduce((best, cell) =>
    (cell.row - meanRow) ** 2 + (cell.col - meanCol) ** 2 <
    (best.row - meanRow) ** 2 + (best.col - meanCol) ** 2
      ? cell
      : best,
  );
  return {
    x: (nearest.col - bounds.minCol + 0.5) * step,
    y: (nearest.row - bounds.minRow + 0.5) * step,
  };
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

  const element = el('section', { class: 'result', 'aria-labelledby': 'result-heading' }, [
    el('h2', { id: 'result-heading' }, ['The puzzle']),
    announcement,
    rejection,
    canvas,
    pieceList,
    proofLine,
    stats,
  ]);

  let current: BuildResult | null = null;

  /**
   * A `div` around each pair, which HTML allows inside a `dl` and which is
   * what keeps a term next to its own value when the list is laid out as a
   * grid — a bare `dt`/`dd` sequence wraps into columns independently and puts
   * every number under the wrong label.
   */
  function statistic(term: string, value: string): void {
    stats.append(
      el('div', { class: 'result__stat' }, [
        el('dt', {}, [term]),
        el('dd', {}, [value]),
      ]),
    );
  }

  function render(): void {
    stats.replaceChildren();

    if (current === null) {
      announcement.textContent =
        'Nothing drawn yet. Pick a shape above, or draw one on the grid.';
      pieceList.textContent = '';
      proofLine.textContent = '';
      rejection.hidden = true;
      canvas.hidden = true;
      return;
    }

    announcement.textContent = describeResult(current);

    if (!current.ok) {
      canvas.hidden = true;
      pieceList.textContent = '';
      proofLine.textContent = '';
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
    pieceList.textContent = describePieces(current);
    proofLine.textContent = describeProof(current);
    statistic('Candidates tried', String(current.proof.attempts));
    statistic('Search time', `${Math.round(current.proof.searchMs)} ms`);
    statistic('Symmetry order', String(current.proof.symmetryOrder));
    statistic('Arrangements', `${current.proof.rawSolutions} raw, 1 distinct`);
    statistic(
      'Finished size',
      `${current.geometry.widthMm} × ${current.geometry.heightMm} mm`,
    );
    drawPuzzle(canvas, current);
  }

  const redraw = (): void => {
    if (current?.ok === true) drawPuzzle(canvas, current);
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
