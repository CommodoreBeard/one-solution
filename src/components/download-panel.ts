/**
 * The download controls, wired to seam 2.
 *
 * `serialize(doc, format)` returns the real bytes — the cut sheet, the tray
 * template and the mirrored solution card, at exact millimetre scale with a
 * calibration ruler. This module turns those bytes into a file and does nothing
 * else: no geometry, no layout, no second opinion about what the document says.
 * `FORMAT_MEDIA` supplies the extension and the MIME type so the writers and
 * the download agree on what was written.
 *
 * The tolerance caveat is spelled out beside the buttons rather than hidden,
 * because the spec is explicit that hand-cutting slop can make a near-miss
 * arrangement fit and that saying so is the difference between a guarantee and
 * a boast. The words come from `hand-cutting-caveat.ts`, so the screen and the
 * printed sheets cannot drift apart.
 */

import { HAND_CUTTING_CAVEAT } from '@/lib/hand-cutting-caveat';
import { FORMAT_MEDIA, serialize } from '@/lib/serialize';
import type { ExportFormat, PuzzleDocument } from '@/lib/types';
import { el } from './dom';

export interface DownloadPanel {
  readonly element: HTMLElement;
  update: (doc: PuzzleDocument | null) => void;
}

const FORMATS: readonly { format: ExportFormat; label: string; hint: string }[] = [
  { format: 'pdf', label: 'PDF', hint: 'Print at exact millimetre scale, with a calibration ruler.' },
  { format: 'svg', label: 'SVG', hint: 'For craft cutters: real-world units and a matching viewBox.' },
  { format: 'dxf', label: 'DXF', hint: 'For cutting software that cannot open SVG at all.' },
];

/** `one-solution-5-pieces.pdf`: says what it is without saying too much. */
function fileName(doc: PuzzleDocument, format: ExportFormat): string {
  return `one-solution-${doc.pieces.length}-pieces.${FORMAT_MEDIA[format].extension}`;
}

export function createDownloadPanel(): DownloadPanel {
  let document_: PuzzleDocument | null = null;

  const status = el('p', { class: 'download__status', role: 'status', 'aria-live': 'polite' });

  function download(format: ExportFormat): void {
    if (document_ === null) return;

    const bytes = serialize(document_, format);
    // `Blob` will not take a `Uint8Array` that might be backed by a
    // `SharedArrayBuffer`, which is what the type says even though this one
    // never is. Copying into a plain buffer costs a few kilobytes once per
    // download and avoids asserting something the compiler cannot check.
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    const blob = new Blob([buffer], { type: FORMAT_MEDIA[format].mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = el('a', { href: url, download: fileName(document_, format) });
    anchor.click();
    // The click is synchronous and the blob has been handed to the browser by
    // the time it returns, but revoking in the same task has been known to race
    // in Safari, so it waits for the next one.
    setTimeout(() => URL.revokeObjectURL(url), 0);
    status.textContent = `Saved ${fileName(document_, format)}.`;
  }

  const buttons = FORMATS.map(({ format, label, hint }) => {
    const button = el(
      'button',
      {
        type: 'button',
        class: 'button',
        'data-format': format,
        'aria-describedby': `download-${format}-hint`,
      },
      [`Download ${label}`],
    );
    button.addEventListener('click', () => download(format));
    return el('div', { class: 'download__option' }, [
      button,
      el('p', { class: 'control__hint', id: `download-${format}-hint` }, [hint]),
    ]);
  });

  const element = el('section', { class: 'download', 'aria-labelledby': 'download-heading' }, [
    el('h2', { id: 'download-heading' }, ['Cut files']),
    el('div', { class: 'download__options' }, buttons),
    status,
    el('p', { class: 'download__caveat' }, [HAND_CUTTING_CAVEAT]),
  ]);

  function render(): void {
    const enabled = document_ !== null;
    for (const option of element.querySelectorAll('button')) option.disabled = !enabled;
    status.textContent = enabled ? '' : 'Make a puzzle first — there is nothing to cut yet.';
  }

  render();

  return {
    element,
    update(doc: PuzzleDocument | null): void {
      document_ = doc;
      render();
    },
  };
}
