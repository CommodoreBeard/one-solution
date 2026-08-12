/**
 * The page: one state, one direction of flow.
 *
 * ```
 *   gallery / editor / controls  ──▶  EditorState  ──▶  encodeState
 *                                                          │
 *                              buildPuzzle ◀───────────── fragment
 *                                     │
 *                                     ▼
 *                      result view, download panel, share link
 * ```
 *
 * Every input produces a new `EditorState` through a pure transition in
 * `editor-state.ts`; nothing here decides what a value may be. The state is
 * then encoded, written to the fragment, and handed to `buildPuzzle` — so the
 * URL is not a copy of the state kept in sync with it, it is the input the
 * puzzle was actually built from. That is what makes a shared link open on the
 * same puzzle the sender saw.
 *
 * Generation is synchronous. The engine's budget bounds it at about two
 * seconds worst case and the usual case is a few milliseconds, so a puzzle is
 * built on every commit rather than behind a button. The search animation
 * (`search-animation.ts`) replays `document.rejected` *after* the fact — it is
 * a view of a finished result, so nothing on this page waits for it.
 */

import { buildPuzzle } from '@/lib/build-puzzle';
import {
  advanceSeed,
  clearTarget,
  emptyState,
  fromPreset,
  fromSpec,
  setCell,
  toSpec,
  withCellSizeMm,
  withGridSize,
  withMaterial,
  withPieceCount,
} from '@/lib/editor-state';
import type { EditorState } from '@/lib/editor-state';
import { readFragment, toFragment } from '@/lib/fragment';
import type { Preset } from '@/lib/presets';
import type { BuildResult, Cell } from '@/lib/types';
import { decodeState, encodeState } from '@/lib/url-codec';
import { createControls } from './controls';
import { createDownloadPanel } from './download-panel';
import { el } from './dom';
import { createGallery } from './gallery';
import { createGridEditor } from './grid-editor';
import { createPriorArt } from './prior-art';
import { createResultView } from './result-view';
import { createUniquenessPanel } from './uniqueness-panel';

function header(): HTMLElement {
  return el('header', { class: 'masthead' }, [
    el('h1', {}, ['One Solution']),
    el('p', { class: 'masthead__lead' }, [
      'A packing puzzle with fourteen solutions is not a puzzle. This one has ' +
        'exactly one, and the count is proved rather than asserted: watch the ' +
        'search reject candidate dissections — 4 solutions, 12, 2 — until one ' +
        'lands on 1. Then print the cut files and make it out of card, free, ' +
        'in your browser, with nothing sent anywhere.',
    ]),
  ]);
}

interface ShareLink {
  readonly element: HTMLElement;
  update: (encoded: string | null) => void;
}

function createShareLink(): ShareLink {
  const input = el('input', {
    type: 'text',
    id: 'share-link',
    readonly: 'readonly',
    class: 'share__input',
  });
  const copy = el('button', { type: 'button', class: 'button' }, ['Copy link']);
  const status = el('p', { class: 'control__hint', role: 'status', 'aria-live': 'polite' }, [
    'The whole puzzle is in the link. Sending it sends the puzzle.',
  ]);

  copy.addEventListener('click', () => {
    input.select();
    // `navigator.clipboard` is absent on an insecure origin, and the selection
    // above is a usable answer on its own: the text is selected, ready to copy.
    void navigator.clipboard?.writeText(input.value).then(
      () => {
        status.textContent = 'Link copied.';
      },
      () => {
        status.textContent = 'Copying was blocked — the link is selected, copy it by hand.';
      },
    );
  });

  const element = el('section', { class: 'share', 'aria-labelledby': 'share-heading' }, [
    el('h2', { id: 'share-heading' }, ['Share this puzzle']),
    el('div', { class: 'share__row' }, [
      el('label', { for: 'share-link', class: 'sr-only' }, ['Link to this puzzle']),
      input,
      copy,
    ]),
    status,
  ]);

  return {
    element,
    update(encoded: string | null): void {
      input.value = encoded === null ? '' : `${window.location.origin}${window.location.pathname}${toFragment(encoded)}`;
      copy.disabled = encoded === null;
    },
  };
}

export function mountApp(root: HTMLElement): void {
  let state: EditorState = emptyState();
  let result: BuildResult | null = null;
  /** What we last wrote to the fragment, so our own write is not read back. */
  let ownFragment: string | null = null;

  const gallery = createGallery((preset: Preset) => {
    revealEditor();
    replace(fromPreset(preset));
  });

  const editor = createGridEditor({
    onPaint(cell: Cell, filled: boolean): void {
      const next = setCell(state, cell, filled);
      if (next === state) return;
      // Paint, but do not search: a drag crosses dozens of cells and the puzzle
      // for each of them is one nobody asked for.
      state = next;
      editor.update(state);
      controls.update(state);
    },
    onCommit(): void {
      replace(state);
    },
  });

  const controls = createControls({
    onPieceCount: (value) => replace(withPieceCount(state, value)),
    onGridSize: (value) => replace(withGridSize(state, value)),
    onCellSizeMm: (value) => replace(withCellSizeMm(state, value)),
    onMaterial: (value) => replace(withMaterial(state, value)),
    onRegenerate: () => replace(advanceSeed(state)),
    onClear: () => replace(clearTarget(state)),
  });

  const resultView = createResultView({
    onUseSuggestedPieceCount: (pieceCount) => replace(withPieceCount(state, pieceCount)),
  });

  const downloads = createDownloadPanel();
  const share = createShareLink();

  const editorPanel = el('div', { class: 'editor__panel', id: 'editor-panel' }, [
    editor.element,
    controls.element,
  ]);

  const reveal = el(
    'button',
    { type: 'button', class: 'button', 'aria-expanded': 'false', 'aria-controls': 'editor-panel' },
    ['Draw your own outline'],
  );
  reveal.addEventListener('click', () => {
    revealEditor();
    editor.element.querySelector('canvas')?.focus();
  });

  function revealEditor(): void {
    editorPanel.hidden = false;
    reveal.hidden = true;
    reveal.setAttribute('aria-expanded', 'true');
  }

  // The gallery is the first thing in the document and the editor starts
  // hidden, so nobody arrives at a blank canvas.
  editorPanel.hidden = true;

  const editorSection = el('section', { class: 'editor', 'aria-labelledby': 'editor-heading' }, [
    el('h2', { id: 'editor-heading' }, ['Or draw your own']),
    el('p', { class: 'editor__lead' }, [
      'Drag to draw, drag across filled squares to erase. Arrow keys move, ' +
        'space fills. Thin outlines are refused with a reason — narrow shapes ' +
        'force small pieces, and small pieces have too many arrangements.',
    ]),
    reveal,
    editorPanel,
  ]);

  // One `main` landmark around everything the page is for, so that "skip to
  // content" and screen-reader landmark navigation both have somewhere to go.
  // The two closing sections are copy, not controls: the guarantee stated in
  // plain words, and the prior art named before anyone else names it.
  root.replaceChildren(
    header(),
    el('main', {}, [
      gallery,
      editorSection,
      resultView.element,
      downloads.element,
      share.element,
      createUniquenessPanel(),
      createPriorArt(),
    ]),
  );

  /** Adopt a state, publish it to the URL, and rebuild the puzzle from that. */
  function replace(next: EditorState): void {
    state = next;

    if (state.target.length === 0) {
      result = null;
      ownFragment = null;
      history.replaceState(null, '', window.location.pathname + window.location.search);
      render(null);
      return;
    }

    const encoded = encodeState(toSpec(state));
    ownFragment = toFragment(encoded);
    history.replaceState(null, '', ownFragment);
    // The URL is the input, not a record of it: this is the same string a
    // recipient of the link would be handed.
    result = buildPuzzle(encoded);
    render(encoded);
  }

  function render(encoded: string | null): void {
    editor.update(state);
    controls.update(state);
    resultView.update(result);
    downloads.update(result?.ok === true ? result : null);
    share.update(result?.ok === true ? encoded : null);
  }

  /** A link, pasted or followed: open straight onto the puzzle it describes. */
  function openFragment(): void {
    const encoded = readFragment(window.location.hash);
    if (encoded === null || toFragment(encoded) === ownFragment) return;

    const decoded = decodeState(encoded);
    if ('ok' in decoded) {
      // A damaged link still has something to say, and the engine says it
      // better than this module could.
      result = decoded;
      render(null);
      return;
    }
    revealEditor();
    replace(fromSpec(decoded));
  }

  window.addEventListener('hashchange', openFragment);

  render(null);
  openFragment();
}
