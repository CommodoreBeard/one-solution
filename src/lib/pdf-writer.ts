/**
 * PDF, the reference output, hand-rolled.
 *
 * **Scale correctness is the point of this file.** The page is sized in the
 * PDF's own coordinate space — 72 units to the inch, so a millimetre is
 * `72 / 25.4` units — and every coordinate is converted the same way. Nothing
 * here depends on a browser, a stylesheet or a print dialog, because CSS print
 * scale is exactly what cannot be trusted. What the writer emits is what the
 * page measures, and the calibration ruler on each page lets the user confirm
 * their printer did not quietly rescale it anyway.
 *
 * One sheet per page, all pages the same size. PDF measures y upwards and the
 * sheet model measures y down, so coordinates flip on the way out.
 *
 * The file is a plain uncompressed PDF 1.4: catalog, page tree, one base-14
 * Helvetica, and one content stream per page. No filters, no embedded fonts,
 * no dependencies. It stays readable in a text editor, which is a fair
 * description of the whole bundle-size argument.
 *
 * This module is internal. Tests reach it through `serialize`.
 */

import { HAND_CUTTING_CAVEAT } from './hand-cutting-caveat';
import type { LineKind, Sheet, SheetPath, SheetText } from './sheet-layout';

const PT_PER_MM = 72 / 25.4;

const pt = (valueMm: number): string => {
  const rounded = Number((valueMm * PT_PER_MM).toFixed(4));
  return String(Object.is(rounded, -0) ? 0 : rounded);
};

/**
 * Colour and dash per kind, so cut, fold and score survive both a colour and a
 * monochrome print. Dash lengths are in points.
 */
const KIND_STYLE: Record<LineKind, string> = {
  cut: '0 0 0 RG 0.5 w [] 0 d',
  fold: '0 0.34 0.72 RG 0.5 w [4 2] 0 d',
  score: '0.78 0.12 0.24 RG 0.5 w [1 1.5] 0 d',
  guide: '0.48 0.48 0.48 RG 0.4 w [] 0 d',
};

const KIND_ORDER: readonly LineKind[] = ['cut', 'fold', 'score', 'guide'];

/** Backslash, and both parentheses, are the only characters a PDF string fears. */
const escapePdfText = (text: string): string =>
  text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

/** Helvetica averages a little over half an em; close enough to centre a label. */
const widthOf = (text: SheetText): number => text.text.length * text.sizeMm * 0.5;

function pathOps(path: SheetPath, flipY: (y: number) => number): string {
  const [first, ...rest] = path.points;
  if (!first) return '';
  const ops = [`${pt(first[0])} ${pt(flipY(first[1]))} m`];
  for (const [x, y] of rest) ops.push(`${pt(x)} ${pt(flipY(y))} l`);
  if (path.closed) ops.push('h');
  ops.push('S');
  return ops.join(' ');
}

function textOps(text: SheetText, flipY: (y: number) => number): string {
  const shift = text.centred ? widthOf(text) / 2 : 0;
  // A mirrored run grows leftwards from its origin, so centring moves the
  // origin the other way.
  const x = text.mirrored ? text.x + shift : text.x - shift;
  const matrix = `${text.mirrored ? -1 : 1} 0 0 1 ${pt(x)} ${pt(flipY(text.y))}`;
  return (
    `BT /F1 ${pt(text.sizeMm)} Tf ${matrix} Tm ` +
    `(${escapePdfText(text.text)}) Tj ET`
  );
}

function contentStream(sheet: Sheet): string {
  const flipY = (value: number): number => sheet.heightMm - value;
  const lines: string[] = [];
  for (const kind of KIND_ORDER) {
    const paths = sheet.paths.filter((path) => path.kind === kind);
    if (paths.length === 0) continue;
    lines.push('q', KIND_STYLE[kind]);
    for (const path of paths) lines.push(pathOps(path, flipY));
    lines.push('Q');
  }
  lines.push('q', '0.2 0.2 0.2 rg');
  for (const text of sheet.texts) lines.push(textOps(text, flipY));
  lines.push('Q');
  return lines.join('\n') + '\n';
}

/**
 * PDF is a byte-offset format: the cross-reference table records where each
 * object starts. Every string here is ASCII apart from the binary marker in the
 * header, so one character is one byte and the offsets are just running string
 * lengths.
 */
function latin1(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) bytes[i] = text.charCodeAt(i) & 0xff;
  return bytes;
}

export function writePdf(sheets: readonly Sheet[]): Uint8Array {
  const FIRST_PAGE_OBJECT = 5;
  const pageId = (index: number): number => FIRST_PAGE_OBJECT + index * 2;
  const contentId = (index: number): number => FIRST_PAGE_OBJECT + index * 2 + 1;

  const objects: string[] = [
    `<< /Type /Catalog /Pages 2 0 R >>`,
    `<< /Type /Pages /Kids [${sheets.map((_, i) => `${pageId(i)} 0 R`).join(' ')}] ` +
      `/Count ${sheets.length} >>`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`,
    `<< /Producer (One Solution) /Title (One Solution puzzle) ` +
      `/Subject (${escapePdfText(HAND_CUTTING_CAVEAT)}) >>`,
  ];

  sheets.forEach((sheet, index) => {
    const stream = contentStream(sheet);
    objects.push(
      `<< /Type /Page /Parent 2 0 R ` +
        `/MediaBox [0 0 ${pt(sheet.widthMm)} ${pt(sheet.heightMm)}] ` +
        `/Resources << /Font << /F1 3 0 R >> >> ` +
        `/Contents ${contentId(index)} 0 R >>`,
      `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
    );
  });

  // The binary comment on line two tells transfer software this is not text.
  let file = '%PDF-1.4\n%âãÏÓ\n';
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(file.length);
    file += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefAt = file.length;
  file += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) file += `${String(offset).padStart(10, '0')} 00000 n \n`;
  file +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 4 0 R >>\n` +
    `startxref\n${xrefAt}\n%%EOF\n`;

  return latin1(file);
}
