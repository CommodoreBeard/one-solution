# One Solution — agent instructions

A static web app that cuts a shape into pieces and proves those pieces fit back
together in exactly one way, then prints the cut files.

**Read `docs/specs/one-solution-tray-edition.md` before making changes.** It is
the spec. Issues reference its sections.

## The one rule that matters

The product sells a mathematical guarantee. **A wrong guarantee is worse than
no guarantee**, because the user discovers it after cutting out the pieces.
Any change that touches the engine must keep the known-answer tests green. If
you cannot make a test pass, stop and say so — do not relax the test.

`reference/` holds a validated Python oracle and the exact test vectors. Read
`reference/README.md` before touching the solver.

## Stack

Vanilla TypeScript, Vite, Vitest, Bun. No framework, no backend, no database,
no accounts, no analytics. State lives in the URL. It must stay free to host.

## Layout

```
src/lib/          pure logic, one concern per file, co-located *.test.ts
src/components/   UI, plain DOM modules
reference/        Python oracle — not shipped, excluded from build and lint
docs/specs/       the spec
docs/adr/         hard-to-reverse decisions only
```

- **No barrel files.** Import the concrete module.
- **Filenames kebab-case.** `solution-count.ts`, not `solutionCount.ts`.
- **`src/lib/` is the logic/UI seam.** Anything that can be a pure function
  belongs there with a sibling test. `src/components/` holds only DOM wiring.

## Test seams

There are exactly two. Do not add a third without an ADR.

1. **`buildPuzzle(encodedState: string) → PuzzleDocument | Rejection`** — the
   whole engine behind one entry point. The URL codec rides along inside it, so
   every engine test exercises encode/decode too. Growth, exact cover,
   canonicalisation, orbit counting and the retry loop are **internal** and are
   never imported by a test.
2. **`serialize(doc, format) → Uint8Array`** — the PDF/SVG/DXF writers. Tested
   for exact millimetre dimensions, correct viewBox, and the calibration ruler.

Test external behaviour only. If a test imports something the seam does not
export, the test is wrong, not the boundary.

## Hard rules

- **No `any`.** TypeScript strict is non-negotiable; ESLint enforces it.
- **No dependencies without an ADR.** The bundle is a feature. Hand-roll the
  PDF and DXF writers rather than pulling in a library.
- **Never rely on CSS print for true scale.** Emit exact-millimetre PDF and
  include a printed calibration ruler.
- **Honest failure.** When no unique dissection exists, say so and name a piece
  count that works. Never spin forever.
- **Respect the measured envelope** in `src/lib/envelope.ts`. Those constants
  come from 2,520 measured dissections, not from taste.

## Validation gate

Run all four before claiming anything is done:

```bash
bun run build
bun run lint
bun run typecheck
bun run test
```

## Git conventions

- Conventional commits, **no scope**, lowercase subject, no trailing period:
  `feat: 2 add exact-cover solution counter`
- The number after the colon is the **GitHub issue number**.
- One commit per completed task.
- Branches: `feat/<slug>-<issue-number>`, e.g. `feat/solution-counter-2`.
