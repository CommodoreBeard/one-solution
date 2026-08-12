/**
 * The three printed sheets, in millimetres, independent of any file format.
 *
 * The writers differ only in how they spell a polyline and a piece of text, so
 * everything that decides *what is on the page* lives here and is written once.
 * A sheet is laid out with the origin at its own top-left, x to the right and y
 * **down**, matching `Geometry` from the engine. PDF and DXF both want y up;
 * each writer flips at the point of emission, and nothing here has to know.
 *
 * ## Why three sheets
 *
 * - **Cut sheet.** The pieces in their solved positions, which is exactly the
 *   spec's "nested inside the tray outline" — their union *is* the tray outline,
 *   so nesting is free and, importantly, the outline is not drawn a second time.
 *   Emitting it again would put two cut paths on the same line and a craft
 *   cutter would cut it twice.
 * - **Tray template.** A frame: an outer border to cut, a rim to fold under so
 *   the tray has a lip, and the target outline as the aperture the pieces drop
 *   into.
 * - **Solution card, mirrored.** The answer, reversed left-to-right so it cannot
 *   be read at a glance from the box. Its piece boundaries are **score** lines,
 *   not cut lines, because on this sheet they are a drawing rather than a cut.
 *   The title and the ruler are not mirrored — only the answer is hidden.
 *
 * Every sheet carries a calibration ruler, because the user needs to catch a
 * printer that rescaled *this* sheet, not a sheet they printed earlier.
 *
 * This module is internal. Tests reach it through `serialize`.
 */

import { SHEET_CAVEAT } from './hand-cutting-caveat';
import type { PuzzleDocument } from './types';

/**
 * What a line means, and therefore what colour, dash and layer it gets. The
 * first three are the spec's requirement that cut, fold and score be
 * distinguishable; `guide` is furniture — the ruler and its rules — which must
 * never reach a cutting head, so it is separated from all three.
 */
export type LineKind = 'cut' | 'fold' | 'score' | 'guide';

export type Point = readonly [number, number];

export interface SheetPath {
  readonly kind: LineKind;
  /** Closed rings never repeat their first point; the writers close them. */
  readonly closed: boolean;
  readonly points: readonly Point[];
  /** Set when this outline is a piece, so the output can be read back. */
  readonly piece?: number;
}

export interface SheetText {
  readonly text: string;
  /** Baseline position. `x` is the anchor, which `centred` interprets. */
  readonly x: number;
  readonly y: number;
  readonly sizeMm: number;
  /** Reversed left-to-right about its own anchor. The solution card only. */
  readonly mirrored: boolean;
  readonly centred: boolean;
}

export type SheetId = 'cut-sheet' | 'tray' | 'solution';

export interface Sheet {
  readonly id: SheetId;
  readonly title: string;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly paths: readonly SheetPath[];
  readonly texts: readonly SheetText[];
}

/** Blank paper around everything. */
const MARGIN_MM = 10;
/** Room for the sheet title above the artwork. */
const TITLE_BAND_MM = 10;
/** Room for the calibration ruler below the artwork. */
const RULER_BAND_MM = 12;
/** Room for the one-line tolerance caveat at the foot. */
const FOOTER_BAND_MM = 6;
/** Tray border width: the frame around the aperture. */
const FRAME_MM = 12;
/** How much of the tray border folds under to give the tray a lip. */
const RIM_MM = 6;
/** The calibration ruler is exactly this long, and says so. */
const RULER_LENGTH_MM = 100;
const RULER_STEP_MM = 10;

const TITLE_SIZE_MM = 4;
const LABEL_SIZE_MM = 5;
const SMALL_SIZE_MM = 2.6;

/** Gap between sheets when a format has to stack them in one document. */
export const SHEET_GAP_MM = 10;

const RULER_NOTE = `${RULER_LENGTH_MM} mm exactly - if it measures otherwise, your printer rescaled.`;

/**
 * Where each piece's label goes: the centre of the piece cell nearest the
 * piece's average position.
 *
 * Not the polygon centroid, which for an L or a U falls outside the piece —
 * and a letter printed outside the piece it names is worse than no letter,
 * because it names the piece next to it. A cell centre is inside by
 * construction. `pieces` and `pieceOutlines` are in the same order, so the
 * anchors come back in that order too.
 */
function labelAnchors(doc: PuzzleDocument): Point[] {
  const rows = doc.spec.target.map(({ row }) => row);
  const cols = doc.spec.target.map(({ col }) => col);
  const minRow = rows.length > 0 ? Math.min(...rows) : 0;
  const minCol = cols.length > 0 ? Math.min(...cols) : 0;
  const size = doc.spec.cellSizeMm;

  return doc.pieces.map((piece) => {
    const centres: Point[] = piece.map(({ row, col }) => [
      (col - minCol + 0.5) * size,
      (row - minRow + 0.5) * size,
    ]);
    if (centres.length === 0) return [0, 0];
    const meanX = centres.reduce((sum, [x]) => sum + x, 0) / centres.length;
    const meanY = centres.reduce((sum, [, y]) => sum + y, 0) / centres.length;
    return centres.reduce((best, centre) => {
      const distance = (p: Point): number => (p[0] - meanX) ** 2 + (p[1] - meanY) ** 2;
      return distance(centre) < distance(best) ? centre : best;
    });
  });
}

const translate = (ring: readonly Point[], dx: number, dy: number): Point[] =>
  ring.map(([x, y]): Point => [x + dx, y + dy]);

/** Reflect about the vertical line `x = axis`. */
const mirror = (ring: readonly Point[], axis: number): Point[] =>
  ring.map(([x, y]): Point => [2 * axis - x, y]);

const rectangle = (x: number, y: number, w: number, h: number): Point[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

/** Piece labels run A, B, C. The engine caps the piece count at seven. */
const pieceLabel = (index: number): string =>
  index < 26 ? String.fromCharCode(65 + index) : String(index + 1);

interface Frame {
  readonly sheetWidthMm: number;
  readonly sheetHeightMm: number;
  /** Top-left of the artwork box, which is the tray's outer border. */
  readonly artX: number;
  readonly artY: number;
  readonly artWidthMm: number;
  readonly artHeightMm: number;
  /** Top-left of the engine's geometry, inset into the artwork by the frame. */
  readonly geoX: number;
  readonly geoY: number;
}

/**
 * One page size for all three sheets, so the tray, the pieces and the answer
 * print on identical stock and a mis-scaled printer misses all three equally.
 */
function frameOf(doc: PuzzleDocument): Frame {
  const artWidthMm = doc.geometry.widthMm + 2 * FRAME_MM;
  const artHeightMm = doc.geometry.heightMm + 2 * FRAME_MM;
  const sheetWidthMm = 2 * MARGIN_MM + Math.max(artWidthMm, RULER_LENGTH_MM);
  const sheetHeightMm =
    2 * MARGIN_MM + TITLE_BAND_MM + artHeightMm + RULER_BAND_MM + FOOTER_BAND_MM;
  const artX = (sheetWidthMm - artWidthMm) / 2;
  const artY = MARGIN_MM + TITLE_BAND_MM;
  return {
    sheetWidthMm,
    sheetHeightMm,
    artX,
    artY,
    artWidthMm,
    artHeightMm,
    geoX: artX + FRAME_MM,
    geoY: artY + FRAME_MM,
  };
}

/** Title, calibration ruler and caveat: identical on every sheet. */
function furniture(frame: Frame, title: string): { paths: SheetPath[]; texts: SheetText[] } {
  const bandTop = frame.artY + frame.artHeightMm;
  const baseline = bandTop + 7;
  const paths: SheetPath[] = [
    {
      kind: 'guide',
      closed: false,
      points: [
        [MARGIN_MM, baseline],
        [MARGIN_MM + RULER_LENGTH_MM, baseline],
      ],
    },
  ];
  for (let mm = 0; mm <= RULER_LENGTH_MM; mm += RULER_STEP_MM) {
    const x = MARGIN_MM + mm;
    const height = mm % (RULER_STEP_MM * 5) === 0 ? 5 : 3;
    paths.push({
      kind: 'guide',
      closed: false,
      points: [
        [x, baseline],
        [x, baseline - height],
      ],
    });
  }
  return {
    paths,
    texts: [
      {
        text: title,
        x: MARGIN_MM,
        y: MARGIN_MM + TITLE_SIZE_MM,
        sizeMm: TITLE_SIZE_MM,
        mirrored: false,
        centred: false,
      },
      {
        text: RULER_NOTE,
        x: MARGIN_MM,
        y: baseline + 3.5,
        sizeMm: SMALL_SIZE_MM,
        mirrored: false,
        centred: false,
      },
      {
        text: SHEET_CAVEAT,
        x: MARGIN_MM,
        y: bandTop + RULER_BAND_MM + 4,
        sizeMm: SMALL_SIZE_MM,
        mirrored: false,
        centred: false,
      },
    ],
  };
}

/** The pieces where they sit in the solution. Their union is the tray outline. */
function cutSheet(doc: PuzzleDocument, frame: Frame): Sheet {
  const base = furniture(frame, `Cut sheet - ${doc.pieces.length} pieces to cut out`);
  const paths = [...base.paths];
  const texts = [...base.texts];
  const anchors = labelAnchors(doc);

  doc.geometry.pieceOutlines.forEach((ring, index) => {
    const placed = translate(ring, frame.geoX, frame.geoY);
    paths.push({ kind: 'cut', closed: true, points: placed, piece: index });
    const [cx, cy] = translate([anchors[index] ?? [0, 0]], frame.geoX, frame.geoY)[0]!;
    texts.push({
      text: pieceLabel(index),
      x: cx,
      y: cy + LABEL_SIZE_MM / 3,
      sizeMm: LABEL_SIZE_MM,
      mirrored: false,
      centred: true,
    });
  });

  return {
    id: 'cut-sheet',
    title: 'Cut sheet',
    widthMm: frame.sheetWidthMm,
    heightMm: frame.sheetHeightMm,
    paths,
    texts,
  };
}

/** The frame the pieces drop into: cut the border and the aperture, fold the rim. */
function traySheet(doc: PuzzleDocument, frame: Frame): Sheet {
  const base = furniture(frame, 'Tray template - cut solid, fold dashed');
  const paths: SheetPath[] = [
    ...base.paths,
    {
      kind: 'cut',
      closed: true,
      points: rectangle(frame.artX, frame.artY, frame.artWidthMm, frame.artHeightMm),
    },
    {
      kind: 'fold',
      closed: true,
      points: rectangle(
        frame.artX + RIM_MM,
        frame.artY + RIM_MM,
        frame.artWidthMm - 2 * RIM_MM,
        frame.artHeightMm - 2 * RIM_MM,
      ),
    },
    ...doc.geometry.trayOutline.map(
      (ring): SheetPath => ({
        kind: 'cut',
        closed: true,
        points: translate(ring, frame.geoX, frame.geoY),
      }),
    ),
  ];

  return {
    id: 'tray',
    title: 'Tray template',
    widthMm: frame.sheetWidthMm,
    heightMm: frame.sheetHeightMm,
    paths,
    texts: base.texts,
  };
}

/**
 * The answer, reflected left-to-right about the artwork's centre line, labels
 * included. Piece boundaries are score lines: this card is drawn, not cut, and
 * a cutter that treated them as cuts would shred it.
 */
function solutionSheet(doc: PuzzleDocument, frame: Frame): Sheet {
  const base = furniture(frame, 'Solution card - mirrored, hold it up to a mirror');
  const axis = frame.artX + frame.artWidthMm / 2;
  const paths: SheetPath[] = [
    ...base.paths,
    {
      kind: 'cut',
      closed: true,
      points: rectangle(frame.artX, frame.artY, frame.artWidthMm, frame.artHeightMm),
    },
  ];
  const texts = [...base.texts];
  const anchors = labelAnchors(doc);

  doc.geometry.pieceOutlines.forEach((ring, index) => {
    const placed = mirror(translate(ring, frame.geoX, frame.geoY), axis);
    paths.push({ kind: 'score', closed: true, points: placed, piece: index });
    const [cx, cy] = mirror(translate([anchors[index] ?? [0, 0]], frame.geoX, frame.geoY), axis)[0]!;
    texts.push({
      text: pieceLabel(index),
      x: cx,
      y: cy + LABEL_SIZE_MM / 3,
      sizeMm: LABEL_SIZE_MM,
      mirrored: true,
      centred: true,
    });
  });

  return {
    id: 'solution',
    title: 'Solution card',
    widthMm: frame.sheetWidthMm,
    heightMm: frame.sheetHeightMm,
    paths,
    texts,
  };
}

/** The whole printed package, in order: cut sheet, tray, mirrored answer. */
export function buildSheets(doc: PuzzleDocument): Sheet[] {
  const frame = frameOf(doc);
  return [cutSheet(doc, frame), traySheet(doc, frame), solutionSheet(doc, frame)];
}

/** Move a whole sheet, for the formats that stack all three in one document. */
export function offsetSheet(sheet: Sheet, dx: number, dy: number): Sheet {
  return {
    ...sheet,
    paths: sheet.paths.map((path) => ({ ...path, points: translate(path.points, dx, dy) })),
    texts: sheet.texts.map((text) => ({ ...text, x: text.x + dx, y: text.y + dy })),
  };
}
