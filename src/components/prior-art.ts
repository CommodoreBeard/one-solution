/**
 * The prior-art comparison, as a real table.
 *
 * A real `<table>` with a `<caption>`, a header row and `scope` on every header
 * cell — not a grid of `div`s — because a screen-reader user navigating this
 * needs the tool name announced with each cell, and that is the one thing a
 * `div` layout cannot give them. On a narrow screen the table scrolls inside
 * its own container rather than forcing the page sideways; the container is
 * focusable and labelled so a keyboard user can reach the scroll.
 *
 * Content is `lib/prior-art.ts`. Nothing here decides what the comparison says.
 */

import { PRIOR_ART, PRIOR_ART_LEAD, WHAT_IS_NEW, WHAT_IS_NOT_NEW } from '@/lib/prior-art';
import { el } from './dom';

const COLUMNS = ['Tool', 'What it does', 'What it does not'] as const;

function comparisonTable(): HTMLElement {
  const head = el('thead', {}, [
    el(
      'tr',
      {},
      COLUMNS.map((column) => el('th', { scope: 'col' }, [column])),
    ),
  ]);

  const body = el(
    'tbody',
    {},
    PRIOR_ART.map((row) =>
      el('tr', {}, [
        el('th', { scope: 'row' }, [row.tool]),
        el('td', {}, [row.does]),
        el('td', {}, [row.doesNot]),
      ]),
    ),
  );

  return el('table', { class: 'prior-art__table' }, [
    el('caption', {}, ['Existing tools, and where each of them stops']),
    head,
    body,
  ]);
}

function list(headingId: string, heading: string, items: readonly string[]): HTMLElement {
  return el('div', { class: 'prior-art__column' }, [
    el('h3', { id: headingId }, [heading]),
    el(
      'ul',
      { 'aria-labelledby': headingId },
      items.map((item) => el('li', {}, [item])),
    ),
  ]);
}

export function createPriorArt(): HTMLElement {
  return el('section', { class: 'prior-art', 'aria-labelledby': 'prior-art-heading' }, [
    el('h2', { id: 'prior-art-heading' }, ['What already existed']),
    el('p', { class: 'prior-art__lead' }, [PRIOR_ART_LEAD]),
    el(
      'div',
      {
        class: 'prior-art__scroll',
        // Scrollable regions have to be reachable and named, or a keyboard
        // user cannot scroll the table on a narrow screen.
        tabindex: '0',
        role: 'region',
        'aria-labelledby': 'prior-art-heading',
      },
      [comparisonTable()],
    ),
    el('div', { class: 'prior-art__columns' }, [
      list('prior-art-new', 'What is new here', WHAT_IS_NEW),
      list('prior-art-old', 'What is not', WHAT_IS_NOT_NEW),
    ]),
  ]);
}
