/**
 * Pins issue 8: "The uniqueness definition ... stated in plain words", and the
 * spec's user story 36 — flips allowed, counted up to the outline's symmetry
 * group.
 *
 * Both clauses were bugs in the prototype. A definition that quietly loses one
 * of them still reads fine, which is the whole reason this is a test and not a
 * proofread.
 */

import { describe, expect, test } from 'vitest';
import {
  UNIQUENESS_CLAUSES,
  UNIQUENESS_HEADLINE,
  UNIQUENESS_METHOD,
} from './uniqueness-claim';

describe('the stated uniqueness claim', () => {
  const clauses = UNIQUENESS_CLAUSES.join(' ').toLowerCase();

  test('says that pieces may be flipped over', () => {
    expect(clauses).toContain('flipped over');
  });

  test("says arrangements are counted up to the outline's symmetry group", () => {
    expect(clauses).toContain('symmetry group');
  });

  test('says identical pieces are interchangeable', () => {
    expect(clauses).toContain('interchangeable');
  });

  test('leads with the count being exactly one, not merely the best found', () => {
    expect(UNIQUENESS_HEADLINE.toLowerCase()).toContain('exactly one');
  });

  test('names the quotient the engine actually takes', () => {
    expect(UNIQUENESS_METHOD).toContain('stabiliser subgroup');
    expect(UNIQUENESS_METHOD).toContain('dihedral group of order 8');
  });
});
