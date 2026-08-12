/**
 * The download controls, and the seam issue #5 fills in.
 *
 * Seam 2 — `serialize(doc, format): Uint8Array` — is being written in parallel
 * on another branch and does not exist here. The buttons are laid out, labelled
 * and wired to a single function so that wiring them up is one import and one
 * line; see `TODO(#5)` in `download`.
 *
 * They are disabled and say why. A stub that produced a plausible-looking file
 * would be worse than no button at all: the whole product is a guarantee about
 * a physical object, and a file that is not the real writer's output is exactly
 * the kind of thing that gets cut out before anyone notices.
 *
 * The tolerance caveat is spelled out here rather than hidden, because the spec
 * is explicit that hand-cutting slop can make a near-miss arrangement fit and
 * that saying so is the difference between a guarantee and a boast. Issue #5
 * ships the canonical copy constant; this wording is replaced by it on merge.
 */

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

/** True until issue #5 lands `serialize` on this branch. */
const EXPORT_READY = false;

export function createDownloadPanel(): DownloadPanel {
  let document_: PuzzleDocument | null = null;

  function download(format: ExportFormat): void {
    if (document_ === null) return;
    // TODO(#5): the export seam. When `src/lib/serialize.ts` lands, this whole
    // body becomes:
    //
    //   const bytes = serialize(document_, format);
    //   const url = URL.createObjectURL(new Blob([bytes], { type: MIME[format] }));
    //   ... anchor, click, revokeObjectURL ...
    //
    // and `EXPORT_READY` above becomes true. Nothing else in the UI changes.
    // Until then this is unreachable: every button is disabled.
    throw new Error(`export to ${format} arrives with issue #5`);
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

  const status = el('p', { class: 'download__status' });

  const element = el('section', { class: 'download', 'aria-labelledby': 'download-heading' }, [
    el('h2', { id: 'download-heading' }, ['Cut files']),
    el('div', { class: 'download__options' }, buttons),
    status,
    el('p', { class: 'download__caveat' }, [
      'Hand-cutting is not exact. Accumulated slop across several pieces can ' +
        'make a near-miss arrangement physically fit, so the guarantee is about ' +
        'the geometry, not about your scissors. Cut carefully and the puzzle has ' +
        'one solution.',
    ]),
  ]);

  function render(): void {
    const enabled = EXPORT_READY && document_ !== null;
    for (const option of element.querySelectorAll('button')) option.disabled = !enabled;
    status.textContent = EXPORT_READY
      ? document_ === null
        ? 'Make a puzzle first — there is nothing to cut yet.'
        : ''
      : 'Cut files are not wired up in this build yet (issue #5).';
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
