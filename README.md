# One Solution

Turn a shape into a puzzle that fits together **exactly one way**.

You pick or draw an outline. The app cuts it into pieces, then proves that
those pieces repack that outline in exactly one arrangement — and shows you the
search rejecting the near-misses on the way. Then it prints the cut sheet, the
tray and a mirrored solution card.

Everything runs in the browser. No accounts, no server, no database. The whole
puzzle lives in the URL, so sharing a link shares the puzzle.

## Stack

Vanilla TypeScript · Vite · Vitest · Bun. No framework, no backend.

## Local development

```bash
bun install
bun run dev
```

### Validation gate

All four must pass before a change is done. CI runs exactly these.

```bash
bun run build      # bundle must build
bun run lint       # eslint, no `any`
bun run typecheck  # tsc --noEmit, strict
bun run test       # vitest, including the known-answer solver tests
```

## Layout

```
src/
  lib/            pure logic; every file has a co-located *.test.ts
    types.ts      the shared vocabulary — read this first
    envelope.ts   measured limits: max 7 pieces, min thickness, retry budget
    grid.ts       cell-set primitives
  components/     DOM wiring only
  main.ts         mount point
reference/        validated Python oracle + test vectors — not shipped
docs/
  specs/          the spec; issues reference its sections
  adr/            hard-to-reverse decisions only
```

## How it works

1. **Dissect.** Grow the outline into *k* connected pieces from random seeds.
2. **Count.** Run an exact-cover search to count how many distinct ways that
   piece set repacks the outline, allowing pieces to be flipped over, and
   quotienting by the outline's own symmetry.
3. **Accept or retry.** Keep the dissection only if the count is exactly one.
   Otherwise throw it away and grow another.

A single search takes about 3 ms, so the retry loop is fast enough to run in
front of the user rather than behind a spinner. That is the demo: you watch it
reject `4 solutions`, `12 solutions`, `2 solutions`, and then settle on `1`.

## The envelope is measured, not guessed

A reference solver was run over 2,520 random dissections across seven shapes.
Two limits came out of it and both are enforced in code:

- **Seven pieces is the cap.** At nine pieces, not one dissection out of 360
  was unique, on any shape.
- **Thin shapes are refused.** Letter-stroke outlines were by far the worst,
  because narrow shapes force small pieces and small pieces are mostly
  congruent duplicates.

See `reference/README.md` for the raw numbers and the validation record.

## Prior art

This builds on work worth naming.

- **BurrTools** — the long-standing desktop tool. It solves and analyses puzzles
  whose pieces *you* supply. Its design/generation chapter is explicitly
  unimplemented; the manual says the text was written as if the features
  existed so it could be reused later.
- **Mechanical Puzzle Studio** — a free browser tool that counts solutions up to
  symmetry. It does not generate dissections, and has no fabrication output.
- **Kita & Miyata, *Computational design of polyomino puzzles* (2020)** — does
  dissect a user-supplied shape into polyominoes. It does not guarantee a
  unique solution, does not score difficulty, and released no code.

What is new here is the combination: generate a dissection of an arbitrary
outline, *prove* the solution is unique, and emit a hand-cut fabrication
package. Browser exact-cover solvers and cut-file export are both commodity.

## Licence

MIT.
