/**
 * The guarantee, spelled out, as a standing part of the page.
 *
 * Static: it says the same thing before and after a puzzle exists, because the
 * definition does not depend on which outline you picked. The per-puzzle
 * numbers are `result-view.ts`'s job.
 *
 * The words are `lib/uniqueness-claim.ts` so that the definition on screen and
 * the definition in the spec are one text with one place to change it.
 */

import {
  UNIQUENESS_CLAUSES,
  UNIQUENESS_HEADLINE,
  UNIQUENESS_METHOD,
} from '@/lib/uniqueness-claim';
import { el } from './dom';

export function createUniquenessPanel(): HTMLElement {
  return el('section', { class: 'claim', 'aria-labelledby': 'claim-heading' }, [
    el('h2', { id: 'claim-heading' }, ['What "exactly one" means']),
    el('p', { class: 'claim__lead' }, [UNIQUENESS_HEADLINE]),
    el(
      'ul',
      { class: 'claim__clauses' },
      UNIQUENESS_CLAUSES.map((clause) => el('li', {}, [clause])),
    ),
    el('p', { class: 'claim__method' }, [UNIQUENESS_METHOD]),
  ]);
}
