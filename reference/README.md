# Reference oracle

This is **not shipped code**. It is a validated Python implementation of the
same maths the TypeScript engine must perform, kept so the port can be checked
against something known-good instead of against its author's confidence.

It is excluded from `tsconfig.json`, `eslint.config.mjs` and `vitest.config.ts`.

## Why it exists

The product sells one claim: *this puzzle fits together exactly one way.*
If the claim is wrong, the product is worse than useless — a person cuts out
the pieces, finds a second solution, and never trusts it again. So the port
gets an oracle.

## What it does

| File | Purpose |
| --- | --- |
| `dissect.py` | The solver: random dissection, exact-cover solution counting, symmetry quotient. Run it to reproduce the sweep. |
| `quicktest.py` | Known-answer tests: symmetry groups, piece-flip identity, the symmetry quotient, duplicate-piece handling, pentominoes in 3×20. |
| `crosscheck.py` | Differential test against a second, independently written naive enumerator. |
| `sweep-results.txt` | The raw output behind the numbers in `src/lib/envelope.ts`. |

## Its validation record

- **Differential:** 426 random cases against an independently written naive
  enumerator, 0 disagreements.
- **Literature:** the 12 pentominoes tile a 3×20 rectangle in exactly 2 ways up
  to symmetry. The solver returns 8 raw partitions with a symmetry group of
  order 4, giving 2. Matches.
- **Structural:** symmetry group orders, mirror-identity of pieces, and the
  bound `1 ≤ orbits ≤ raw ≤ orbits × |G|` over 150 further cases.

An earlier version reported 0% unique for every mirror-symmetric shape. That
was a bug in the symmetry quotient — it sorted points before mapping them,
which destroyed the correspondence. Fixing it moved the measured rate from
8.3% to 36.9%. **The lesson for the port: the symmetry quotient is the part
most likely to be silently wrong, and a plausible-looking number is not
evidence.**

## Test vectors the port must reproduce

Counting solutions up to the target's symmetry group, with piece flips allowed:

| Target | Pieces | Expected |
| --- | --- | --- |
| 3×20 rectangle | the 12 pentominoes | 2 |
| 4×15 rectangle | the 12 pentominoes | 368 |
| 5×12 rectangle | the 12 pentominoes | 1010 |
| 6×10 rectangle | the 12 pentominoes | 2339 |
| 2×3 rectangle | two L-trominoes | 1 |
| 2×2 square | two dominoes | 1 (2 raw) |

## A performance warning for the port

`dissect.py` uses a naive bitmask recursion, not a real Dancing Links
structure. Full enumeration of the 3×20 pentomino case took **26 minutes**.

That is fine for an oracle and **not** fine for the product. The shipped engine
must abort at the second solution rather than enumerate, which is what makes it
run in ~3 ms. Only the rejected-candidate animation needs true counts, and
those are capped. Do not port the naive recursion as-is.

## Running it

```bash
cd reference
python3 quicktest.py     # fast checks, then ~26 min on the pentomino case
python3 crosscheck.py    # differential test, about a minute
python3 dissect.py 777 60 # reproduce the sweep
```
