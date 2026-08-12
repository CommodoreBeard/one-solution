/**
 * Seam 2: the file writers behind one function.
 *
 * ```ts
 * serialize(doc: PuzzleDocument, format: 'pdf' | 'svg' | 'dxf'): Uint8Array
 * ```
 *
 * The sheet model and the three writers are internal to this call, the same way
 * growth and exact cover are internal to `buildPuzzle`. A test that reaches past
 * this function is testing how the promise is kept rather than the promise.
 *
 * Bytes, not strings, because that is what a download is: `Blob` takes a
 * `Uint8Array` directly and PDF is a byte-offset format that cannot be handled
 * as text without care.
 *
 * Why three formats, so none is mistaken for gold-plating: PDF is the reference
 * output for printing on card; SVG is for craft cutters and carries explicit
 * real-world units; DXF exists because the basic edition of Silhouette Studio
 * cannot open SVG at all. See docs/adr/0002-hand-rolled-export-writers.md.
 */

import { writeDxf } from './dxf-writer';
import { writePdf } from './pdf-writer';
import { buildSheets } from './sheet-layout';
import { writeSvg } from './svg-writer';
import type { ExportFormat, PuzzleDocument } from './types';

/** File extension and MIME type, for whatever wires up the download. */
export const FORMAT_MEDIA: Record<ExportFormat, { extension: string; mimeType: string }> = {
  pdf: { extension: 'pdf', mimeType: 'application/pdf' },
  svg: { extension: 'svg', mimeType: 'image/svg+xml' },
  dxf: { extension: 'dxf', mimeType: 'application/dxf' },
};

/**
 * Write the printable package for a puzzle: the cut sheet, the tray template
 * and the mirrored solution card, each with a calibration ruler, at exact
 * millimetre scale.
 */
export function serialize(doc: PuzzleDocument, format: ExportFormat): Uint8Array {
  const sheets = buildSheets(doc);
  if (format === 'pdf') return writePdf(sheets);
  const text = format === 'svg' ? writeSvg(sheets) : writeDxf(sheets);
  return new TextEncoder().encode(text);
}
