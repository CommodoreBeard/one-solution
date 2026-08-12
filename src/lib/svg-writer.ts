/**
 * SVG for craft cutters.
 *
 * The one thing this file must not get wrong: **explicit real-world width and
 * height, with a viewBox that agrees with them.** Cutter software derives its
 * import scale from that pair, and an SVG carrying `width="640"` with no unit
 * imports at whatever the receiving program guesses. So the user unit is one
 * millimetre by construction — `width="128mm" viewBox="0 0 128 ..."` — and every
 * coordinate in the file is already in millimetres from the sheet model.
 *
 * SVG has no pages, so the three sheets stack vertically in one document with a
 * gap between them. Paths are grouped by line kind, which is what a cutter
 * reads as a layer: cut, fold, score and guide each get their own stroke and
 * dash, so no operator has to guess which lines are cuts.
 *
 * This module is internal. Tests reach it through `serialize`.
 */

import { HAND_CUTTING_CAVEAT } from './hand-cutting-caveat';
import { SHEET_GAP_MM, offsetSheet } from './sheet-layout';
import type { LineKind, Sheet, SheetPath, SheetText } from './sheet-layout';

/** Millimetres to at most three decimals, with no `-0` and no trailing zeros. */
function mm(value: number): string {
  const rounded = Number(value.toFixed(3));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

const escapeXml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Stroke presentation per kind, applied to the group so the paths stay
 * readable. Colour alone would fail a monochrome print, so each kind also has
 * its own dash pattern.
 */
const KIND_STYLE: Record<LineKind, string> = {
  cut: 'stroke="#000000" stroke-width="0.25"',
  fold: 'stroke="#0057b8" stroke-width="0.25" stroke-dasharray="4 2"',
  score: 'stroke="#c81e3c" stroke-width="0.25" stroke-dasharray="1 1.5"',
  guide: 'stroke="#7a7a7a" stroke-width="0.2"',
};

const KIND_ORDER: readonly LineKind[] = ['cut', 'fold', 'score', 'guide'];

function pathData(path: SheetPath): string {
  const [first, ...rest] = path.points;
  if (!first) return '';
  const parts = [`M ${mm(first[0])} ${mm(first[1])}`];
  for (const [x, y] of rest) parts.push(`L ${mm(x)} ${mm(y)}`);
  if (path.closed) parts.push('Z');
  return parts.join(' ');
}

function renderPath(path: SheetPath, sheet: Sheet): string {
  const piece = path.piece === undefined ? '' : ` data-piece="${path.piece}"`;
  return `    <path data-sheet="${sheet.id}"${piece} d="${pathData(path)}"/>`;
}

function renderText(text: SheetText, sheet: Sheet): string {
  const anchor = text.centred ? ' text-anchor="middle"' : '';
  // A mirrored label is reflected about its own anchor, so the answer reads
  // only in a mirror while the sheet furniture stays legible.
  const position = text.mirrored
    ? ` x="0" y="0" transform="translate(${mm(text.x)} ${mm(text.y)}) scale(-1 1)"`
    : ` x="${mm(text.x)}" y="${mm(text.y)}"`;
  return (
    `    <text data-sheet="${sheet.id}"${position}${anchor} ` +
    `font-family="Helvetica, Arial, sans-serif" font-size="${mm(text.sizeMm)}" ` +
    `fill="#333333">${escapeXml(text.text)}</text>`
  );
}

export function writeSvg(sheets: readonly Sheet[]): string {
  let y = 0;
  const placed = sheets.map((sheet) => {
    const at = offsetSheet(sheet, 0, y);
    y += sheet.heightMm + SHEET_GAP_MM;
    return at;
  });
  const widthMm = placed.reduce((widest, sheet) => Math.max(widest, sheet.widthMm), 0);
  const heightMm = Math.max(y - SHEET_GAP_MM, 0);

  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<!-- One Solution. One user unit is one millimetre. ${escapeXml(HAND_CUTTING_CAVEAT)} -->`,
    `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${mm(widthMm)}mm" ` +
      `height="${mm(heightMm)}mm" viewBox="0 0 ${mm(widthMm)} ${mm(heightMm)}">`,
    `  <title>One Solution - ${placed.map((sheet) => escapeXml(sheet.title)).join(', ')}</title>`,
  ];

  for (const kind of KIND_ORDER) {
    const paths = placed.flatMap((sheet) =>
      sheet.paths.filter((path) => path.kind === kind).map((path) => renderPath(path, sheet)),
    );
    if (paths.length === 0) continue;
    lines.push(`  <g id="${kind}" fill="none" ${KIND_STYLE[kind]} stroke-linejoin="round">`);
    lines.push(...paths);
    lines.push('  </g>');
  }

  lines.push('  <g id="labels">');
  for (const sheet of placed) {
    for (const text of sheet.texts) lines.push(renderText(text, sheet));
  }
  lines.push('  </g>', '</svg>', '');

  return lines.join('\n');
}
