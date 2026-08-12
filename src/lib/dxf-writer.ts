/**
 * DXF, because the basic edition of Silhouette Studio cannot open SVG at all.
 * Without this file a large part of the hobby-cutter audience is silently
 * excluded, which is the whole reason a third format exists.
 *
 * Deliberately **R12** (AC1009). R12 is the most widely readable DXF dialect
 * there is, and it needs no handles, no CLASSES section and no OBJECTS
 * dictionary — a minimal hand-rolled R12 file is a complete, valid file rather
 * than a truncated newer one. The cost is that closed outlines are written as
 * `POLYLINE`/`VERTEX`/`SEQEND` rather than the terser R13 `LWPOLYLINE`. That is
 * a fair trade for opening everywhere.
 *
 * One DXF unit is one millimetre, declared with `$INSUNITS = 4`. Cut, fold,
 * score and guide are separate named layers, which is how cutting software is
 * told what to cut and what merely to draw.
 *
 * DXF measures y upwards, so every coordinate is flipped on the way out.
 *
 * This module is internal. Tests reach it through `serialize`.
 */

import { SHEET_GAP_MM, offsetSheet } from './sheet-layout';
import type { LineKind, Sheet, SheetPath, SheetText } from './sheet-layout';

/** Layer name and AutoCAD colour index per line kind. */
const LAYERS: readonly { readonly kind: LineKind; readonly name: string; readonly colour: number }[] =
  [
    { kind: 'cut', name: 'CUT', colour: 1 },
    { kind: 'fold', name: 'FOLD', colour: 5 },
    { kind: 'score', name: 'SCORE', colour: 3 },
    { kind: 'guide', name: 'GUIDE', colour: 8 },
  ];

const layerName = (kind: LineKind): string =>
  LAYERS.find((layer) => layer.kind === kind)?.name ?? 'CUT';

/** DXF is a stream of (group code, value) pairs, one per line. */
type Pair = readonly [number, string | number];

const num = (value: number): string => {
  const rounded = Number(value.toFixed(4));
  return (Object.is(rounded, -0) ? 0 : rounded).toFixed(4);
};

/** DXF text records are single-line; a stray newline would desynchronise pairs. */
const plain = (text: string): string => text.replace(/[\r\n]+/g, ' ');

function polylinePairs(path: SheetPath, flipY: (y: number) => number): Pair[] {
  const layer = layerName(path.kind);
  const pairs: Pair[] = [
    [0, 'POLYLINE'],
    [8, layer],
    [66, 1],
    [70, path.closed ? 1 : 0],
    [10, num(0)],
    [20, num(0)],
    [30, num(0)],
  ];
  for (const [x, y] of path.points) {
    pairs.push([0, 'VERTEX'], [8, layer], [10, num(x)], [20, num(flipY(y))], [30, num(0)]);
  }
  pairs.push([0, 'SEQEND'], [8, layer]);
  return pairs;
}

function textPairs(text: SheetText, flipY: (y: number) => number): Pair[] {
  const x = num(text.x);
  const y = num(flipY(text.y));
  const pairs: Pair[] = [
    [0, 'TEXT'],
    [8, 'GUIDE'],
    [10, x],
    [20, y],
    [30, num(0)],
    [40, num(text.sizeMm)],
    [1, plain(text.text)],
    // 71 = 2 reflects the glyphs about the insertion point, which is how DXF
    // spells the mirrored solution card without moving the text.
    [71, text.mirrored ? 2 : 0],
    [72, text.centred ? 1 : 0],
  ];
  if (text.centred) pairs.push([11, x], [21, y], [31, num(0)]);
  return pairs;
}

export function writeDxf(sheets: readonly Sheet[]): string {
  let y = 0;
  const placed = sheets.map((sheet) => {
    const at = offsetSheet(sheet, 0, y);
    y += sheet.heightMm + SHEET_GAP_MM;
    return at;
  });
  const widthMm = placed.reduce((widest, sheet) => Math.max(widest, sheet.widthMm), 0);
  const heightMm = Math.max(y - SHEET_GAP_MM, 0);
  const flipY = (value: number): number => heightMm - value;

  const pairs: Pair[] = [
    [0, 'SECTION'],
    [2, 'HEADER'],
    [9, '$ACADVER'],
    [1, 'AC1009'],
    // 4 = millimetres. Without it, importers fall back to their own default and
    // the sheet arrives at the wrong size.
    [9, '$INSUNITS'],
    [70, 4],
    [9, '$EXTMIN'],
    [10, num(0)],
    [20, num(0)],
    [30, num(0)],
    [9, '$EXTMAX'],
    [10, num(widthMm)],
    [20, num(heightMm)],
    [30, num(0)],
    [0, 'ENDSEC'],
    [0, 'SECTION'],
    [2, 'TABLES'],
    [0, 'TABLE'],
    [2, 'LAYER'],
    [70, LAYERS.length],
  ];
  for (const layer of LAYERS) {
    pairs.push([0, 'LAYER'], [2, layer.name], [70, 0], [62, layer.colour], [6, 'CONTINUOUS']);
  }
  pairs.push([0, 'ENDTAB'], [0, 'ENDSEC'], [0, 'SECTION'], [2, 'ENTITIES']);

  for (const sheet of placed) {
    for (const path of sheet.paths) pairs.push(...polylinePairs(path, flipY));
    for (const text of sheet.texts) pairs.push(...textPairs(text, flipY));
  }

  pairs.push([0, 'ENDSEC'], [0, 'EOF']);

  return pairs.map(([code, value]) => `${code}\n${value}`).join('\n') + '\n';
}
