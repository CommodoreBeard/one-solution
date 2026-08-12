/**
 * Pins seam 2: `serialize(doc, format) -> Uint8Array`, and with it the spec's
 * *Implementation Decisions → Scale correctness* and the acceptance criteria of
 * issue #5.
 *
 * Roughly four characterisation tests per format, which is what the spec asks
 * for: this seam is thin by design and the value in the product is in the
 * engine. Everything behind the seam — the sheet model and the three writers —
 * is internal and is never imported here. The document under test is a real one
 * from `buildPuzzle`, so the geometry these tests measure is geometry a user
 * would actually cut.
 *
 * The sheet layout constants are restated at the top of this file rather than
 * imported. That is deliberate: a characterisation test that imports the
 * numbers it checks cannot fail when they change, and page size is precisely
 * the thing a user discovers is wrong only after printing.
 */

import { describe, expect, test } from 'vitest';
import { buildPuzzle } from './build-puzzle';
import { HAND_CUTTING_CAVEAT, SHEET_CAVEAT } from './hand-cutting-caveat';
import { serialize } from './serialize';
import type { Cell, PuzzleDocument, PuzzleSpec, Shape } from './types';
import { encodeState } from './url-codec';

const rect = (rows: number, cols: number): Shape => {
  const cells: Cell[] = [];
  for (let row = 0; row < rows; row += 1)
    for (let col = 0; col < cols; col += 1) cells.push({ row, col });
  return cells;
};

/** An L: a 7x7 square with its top-right 3x3 corner removed. 40 cells. */
const ELL: Shape = rect(7, 7).filter(({ row, col }) => row >= 3 || col < 4);

const SPEC: PuzzleSpec = {
  target: ELL,
  pieceCount: 4,
  seed: 1,
  material: 'cardstock',
  cellSizeMm: 12,
};

const build = (spec: PuzzleSpec): PuzzleDocument => {
  const result = buildPuzzle(encodeState(spec));
  if (!result.ok) throw new Error(`expected a puzzle, got ${result.reason}: ${result.message}`);
  return result;
};

const DOC = build(SPEC);

/** The layout the writers are expected to produce, restated independently. */
const MARGIN_MM = 10;
const TITLE_BAND_MM = 10;
const RULER_BAND_MM = 12;
const FOOTER_BAND_MM = 6;
const FRAME_MM = 12;
const SHEET_GAP_MM = 10;
const RULER_LENGTH_MM = 100;
const SHEETS = 3;

const SHEET_WIDTH_MM =
  2 * MARGIN_MM + Math.max(DOC.geometry.widthMm + 2 * FRAME_MM, RULER_LENGTH_MM);
const SHEET_HEIGHT_MM =
  2 * MARGIN_MM +
  TITLE_BAND_MM +
  DOC.geometry.heightMm +
  2 * FRAME_MM +
  RULER_BAND_MM +
  FOOTER_BAND_MM;

const PT_PER_MM = 72 / 25.4;
const RULER_TEXT = '100 mm exactly';

const text = (format: 'svg' | 'dxf'): string =>
  new TextDecoder().decode(serialize(DOC, format));

/** PDF is a byte-offset format, so it is read back byte for byte. */
const pdfText = (): string =>
  Array.from(serialize(DOC, 'pdf'), (byte) => String.fromCharCode(byte)).join('');

const countOf = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

/** Millimetres as the PDF spells them, escaped for use inside a regex. */
const points = (valueMm: number): string =>
  String(Number((valueMm * PT_PER_MM).toFixed(4))).replace('.', '\\.');

describe('the document under test', () => {
  test('is a real puzzle whose sheets are the size the writers claim', () => {
    // 7 columns and 7 rows of 12 mm, so the arithmetic below is checkable by
    // hand: 84 mm of artwork, a 12 mm tray frame each side, 10 mm of paper.
    expect(DOC.geometry.widthMm).toBe(84);
    expect(DOC.geometry.heightMm).toBe(84);
    expect(SHEET_WIDTH_MM).toBe(128);
    expect(SHEET_HEIGHT_MM).toBe(156);
    expect(DOC.pieces).toHaveLength(4);
  });
});

describe('pdf', () => {
  test('page dimensions are the expected millimetres, on all three sheets', () => {
    const file = pdfText();
    const boxes = [...file.matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)];
    expect(boxes).toHaveLength(SHEETS);

    const expectedWidth = Number((SHEET_WIDTH_MM * PT_PER_MM).toFixed(4));
    const expectedHeight = Number((SHEET_HEIGHT_MM * PT_PER_MM).toFixed(4));
    for (const box of boxes) {
      // A PDF unit is 1/72 inch, so this is the only place scale can be lost.
      expect(Number(box[1])).toBeCloseTo(expectedWidth, 4);
      expect(Number(box[2])).toBeCloseTo(expectedHeight, 4);
      // Back to millimetres, within the 1/10000 of a point the box is written
      // to: about 20 nanometres, or a ten-thousandth of a laser kerf.
      expect(Number(box[1]) / PT_PER_MM).toBeCloseTo(SHEET_WIDTH_MM, 4);
      expect(Number(box[2]) / PT_PER_MM).toBeCloseTo(SHEET_HEIGHT_MM, 4);
    }
    expect(file).toContain(`/Count ${SHEETS}`);
  });

  test('is a structurally valid pdf whose cross-reference table is correct', () => {
    const file = pdfText();
    expect(file.startsWith('%PDF-1.4\n')).toBe(true);
    expect(file.endsWith('%%EOF\n')).toBe(true);

    const startxref = /startxref\n(\d+)\n%%EOF/.exec(file);
    expect(startxref).not.toBeNull();
    expect(file.slice(Number(startxref![1]))).toMatch(/^xref\n0 (\d+)\n/);

    const entries = [...file.matchAll(/^(\d{10}) 00000 n $/gm)];
    expect(entries.length).toBeGreaterThan(0);
    entries.forEach((entry, index) => {
      // Object numbering starts at 1; entry 0 is the free-list head.
      expect(file.slice(Number(entry[1]))).toMatch(new RegExp(`^${index + 1} 0 obj\n`));
    });
  });

  test('prints a calibration ruler on every page', () => {
    const file = pdfText();
    expect(countOf(file, RULER_TEXT)).toBe(SHEETS);
    // A horizontal line exactly 100 mm long, starting at the 10 mm margin.
    const baseline = new RegExp(
      `^${points(MARGIN_MM)} (\\S+) m ${points(MARGIN_MM + RULER_LENGTH_MM)} \\1 l S$`,
      'gm',
    );
    expect([...file.matchAll(baseline)]).toHaveLength(SHEETS);
  });

  test('draws cut, fold and score lines distinguishably', () => {
    const file = pdfText();
    // Colour and dash both differ, so the three survive a monochrome print.
    expect(file).toContain('0 0 0 RG 0.5 w [] 0 d');
    expect(file).toContain('0 0.34 0.72 RG 0.5 w [4 2] 0 d');
    expect(file).toContain('0.78 0.12 0.24 RG 0.5 w [1 1.5] 0 d');
  });
});

/** Every `<path>` in the file, with the attributes the tests select on. */
interface SvgPath {
  readonly group: string;
  readonly sheet: string;
  readonly piece: number | null;
  readonly points: readonly (readonly [number, number])[];
}

function svgPaths(file: string): SvgPath[] {
  const paths: SvgPath[] = [];
  for (const group of [...file.matchAll(/<g id="([a-z]+)"([\s\S]*?)<\/g>/g)]) {
    for (const path of [...group[2]!.matchAll(/<path ([^>]*)d="([^"]+)"\/>/g)]) {
      const attrs = path[1]!;
      const piece = /data-piece="(\d+)"/.exec(attrs);
      const numbers = (path[2]!.match(/-?[\d.]+/g) ?? []).map(Number);
      const points: [number, number][] = [];
      for (let i = 0; i + 1 < numbers.length; i += 2) points.push([numbers[i]!, numbers[i + 1]!]);
      paths.push({
        group: group[1]!,
        sheet: /data-sheet="([a-z-]+)"/.exec(attrs)![1]!,
        piece: piece ? Number(piece[1]) : null,
        points,
      });
    }
  }
  return paths;
}

/** A ring translated so its own bounding box starts at the origin. */
const normalised = (points: readonly (readonly [number, number])[]): string[] => {
  const minX = Math.min(...points.map(([x]) => x));
  const minY = Math.min(...points.map(([, y]) => y));
  return points.map(([x, y]) => `${(x - minX).toFixed(3)},${(y - minY).toFixed(3)}`).sort();
};

const mirrored = (points: readonly (readonly [number, number])[]): string[] => {
  const width = Math.max(...points.map(([x]) => x)) - Math.min(...points.map(([x]) => x));
  return normalised(points.map(([x, y]): [number, number] => [width - x, y]));
};

describe('svg', () => {
  test('carries explicit real-world units and a viewBox that agrees', () => {
    const file = text('svg');
    const totalHeight = SHEETS * SHEET_HEIGHT_MM + (SHEETS - 1) * SHEET_GAP_MM;
    // Craft-cutter software derives import scale from exactly this pair.
    expect(file).toContain(`width="${SHEET_WIDTH_MM}mm"`);
    expect(file).toContain(`height="${totalHeight}mm"`);
    expect(file).toContain(`viewBox="0 0 ${SHEET_WIDTH_MM} ${totalHeight}"`);

    const svg = /<svg[^>]*>/.exec(file)![0];
    const width = /width="([\d.]+)mm"/.exec(svg)!;
    const height = /height="([\d.]+)mm"/.exec(svg)!;
    const viewBox = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg)!;
    expect(viewBox[1]).toBe(width[1]);
    expect(viewBox[2]).toBe(height[1]);
  });

  test('carries a calibration ruler on every sheet', () => {
    const file = text('svg');
    expect(countOf(file, RULER_TEXT)).toBe(SHEETS);
    const rulers = svgPaths(file).filter(
      (path) =>
        path.group === 'guide' &&
        path.points.length === 2 &&
        path.points[0]![1] === path.points[1]![1] &&
        path.points[1]![0] - path.points[0]![0] === RULER_LENGTH_MM,
    );
    expect(rulers.map((path) => path.sheet)).toEqual(['cut-sheet', 'tray', 'solution']);
  });

  test('separates cut, fold and score into distinguishable layers', () => {
    const file = text('svg');
    const styles = [...file.matchAll(/<g id="(cut|fold|score)"([^>]*)>/g)];
    expect(styles.map((match) => match[1])).toEqual(['cut', 'fold', 'score']);
    // Different stroke and different dash: legible in colour and in black.
    const strokes = styles.map((match) => /stroke="(#\w+)"/.exec(match[2]!)![1]);
    expect(new Set(strokes).size).toBe(3);
    expect(/stroke-dasharray/.test(styles[0]![2]!)).toBe(false);
    expect(new Set(styles.map((match) => /stroke-dasharray="([^"]+)"/.exec(match[2]!)?.[1])).size)
      .toBe(3);
  });

  test('mirrors the solution card and scores it rather than cutting it', () => {
    const paths = svgPaths(text('svg'));
    const cut = paths.filter((path) => path.sheet === 'cut-sheet' && path.piece !== null);
    const answer = paths.filter((path) => path.sheet === 'solution' && path.piece !== null);
    expect(cut).toHaveLength(DOC.pieces.length);
    expect(answer).toHaveLength(DOC.pieces.length);

    // The card is drawn, not cut. Cutting these lines would shred it.
    expect(new Set(answer.map((path) => path.group))).toEqual(new Set(['score']));
    expect(new Set(cut.map((path) => path.group))).toEqual(new Set(['cut']));

    for (const piece of cut) {
      const twin = answer.find((path) => path.piece === piece.piece)!;
      expect(normalised(twin.points)).toEqual(mirrored(piece.points));
    }
    // Guard against a vacuous pass: at least one piece is not its own mirror.
    expect(cut.some((piece) => normalised(piece.points).join() !== mirrored(piece.points).join()))
      .toBe(true);
    expect(text('svg')).toContain('mirrored');
  });
});

/** DXF is (group code, value) pairs, one per line. */
const dxfPairs = (file: string): [number, string][] => {
  const lines = file.split('\n');
  const pairs: [number, string][] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) pairs.push([Number(lines[i]), lines[i + 1]!]);
  return pairs;
};

interface DxfPolyline {
  readonly layer: string;
  readonly closed: boolean;
  readonly points: readonly (readonly [number, number])[];
}

function dxfPolylines(file: string): DxfPolyline[] {
  const pairs = dxfPairs(file);
  const polylines: DxfPolyline[] = [];
  let current: { layer: string; closed: boolean; points: [number, number][] } | null = null;
  let vertex: { x: number; y: number } | null = null;
  for (const [code, value] of pairs) {
    if (code === 0) {
      if (vertex && current) current.points.push([vertex.x, vertex.y]);
      vertex = null;
      if (value === 'POLYLINE') current = { layer: '', closed: false, points: [] };
      else if (value === 'VERTEX') vertex = { x: 0, y: 0 };
      else if (value === 'SEQEND' && current) {
        polylines.push(current);
        current = null;
      }
    } else if (vertex) {
      if (code === 10) vertex.x = Number(value);
      if (code === 20) vertex.y = Number(value);
    } else if (current) {
      if (code === 8) current.layer = value;
      if (code === 70) current.closed = (Number(value) & 1) === 1;
    }
  }
  return polylines;
}

describe('dxf', () => {
  test('parses, and holds the expected number of closed polylines', () => {
    const polylines = dxfPolylines(text('dxf'));
    const pieces = DOC.pieces.length;
    const trayRings = DOC.geometry.trayOutline.length;
    // Pieces on the cut sheet, the tray frame and its rim and aperture rings,
    // the card border, and the pieces again on the mirrored card.
    const expectedClosed = pieces + 2 + trayRings + 1 + pieces;
    expect(polylines.filter((line) => line.closed)).toHaveLength(expectedClosed);
    // Ruler furniture: a baseline and eleven ticks, on each of three sheets.
    expect(polylines.filter((line) => !line.closed)).toHaveLength(SHEETS * 12);
    for (const line of polylines) expect(line.points.length).toBeGreaterThanOrEqual(2);
  });

  test('is in real-world millimetres', () => {
    const file = text('dxf');
    // 4 is millimetres. Without it importers fall back to their own default.
    expect(file).toContain('$INSUNITS\n70\n4');

    const pieces = dxfPolylines(file)
      .filter((line) => line.closed && line.layer === 'CUT')
      .slice(0, DOC.pieces.length)
      .flatMap((line) => line.points);
    const spanX = Math.max(...pieces.map(([x]) => x)) - Math.min(...pieces.map(([x]) => x));
    const spanY = Math.max(...pieces.map(([, y]) => y)) - Math.min(...pieces.map(([, y]) => y));
    // The pieces of the cut sheet fill the target's bounding box exactly.
    expect(spanX).toBeCloseTo(DOC.geometry.widthMm, 6);
    expect(spanY).toBeCloseTo(DOC.geometry.heightMm, 6);
    expect(spanX % SPEC.cellSizeMm).toBeCloseTo(0, 6);
  });

  test('puts cut, fold and score on separate named layers', () => {
    const file = text('dxf');
    for (const layer of ['CUT', 'FOLD', 'SCORE', 'GUIDE']) {
      expect(file).toContain(`0\nLAYER\n2\n${layer}\n`);
    }
    const used = new Set(dxfPolylines(file).map((line) => line.layer));
    expect(used).toEqual(new Set(['CUT', 'FOLD', 'SCORE', 'GUIDE']));
  });

  test('carries a calibration ruler and its labels on every sheet', () => {
    const file = text('dxf');
    const labels = dxfPairs(file)
      .filter(([code]) => code === 1)
      .map(([, value]) => value);
    expect(labels.filter((label) => label.includes(RULER_TEXT))).toHaveLength(SHEETS);
    // Mirrored text: 71 = 2 reflects the glyphs, so the card cannot be read.
    expect([...file.matchAll(/^71\n2$/gm)]).toHaveLength(DOC.pieces.length);
  });
});

describe('the tolerance caveat', () => {
  test('is exported for the download control and printed on every sheet', () => {
    // Required copy, not decoration: the proof is exact and the scissors are not.
    expect(HAND_CUTTING_CAVEAT).toMatch(/slop/);
    expect(HAND_CUTTING_CAVEAT.length).toBeGreaterThan(80);
    for (const file of [pdfText(), text('svg'), text('dxf')]) {
      expect(countOf(file, SHEET_CAVEAT)).toBeGreaterThanOrEqual(SHEETS);
    }
  });
});
