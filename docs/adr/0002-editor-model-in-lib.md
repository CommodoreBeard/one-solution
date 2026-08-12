# 0002 — The editor model lives in `src/lib`, and is not a third seam

- **Status** — accepted
- **Date** — 2026-08-12

## Context

The spec allows exactly two test seams and requires an ADR for a third:
`buildPuzzle` for the engine, `serialize` for the writers. It also says
`src/lib/` is the logic/UI seam and that anything that can be a pure function
belongs there with a sibling test, while `src/components/` is DOM wiring only.

Issue 6 needs decisions that are neither engine nor writer: what a piece count
is allowed to be, which cells survive a change of grid resolution, what the
next seed is, where the keyboard cursor may go, how a decoded link becomes an
editable grid. They are pure functions, and the acceptance criteria — "piece
count cannot be set above `MAX_PIECES` through the UI" among them — are exactly
the kind of thing that must be tested rather than eyeballed.

Testing them through the DOM would need jsdom and a change to
`vitest.config.ts`. Leaving them untested would put an acceptance criterion
beyond the reach of the suite.

## Decision

The editor's model is `src/lib/editor-state.ts`, plus `presets.ts`,
`piece-styles.ts`, `fragment.ts` and `announcement.ts`, each with a co-located
test. `src/components/` reads these and draws; it decides nothing.

**This is not a third seam.** The two seams are about the *engine* and the
*writers* — the parts that carry the mathematical guarantee, where a test that
reaches inside is testing an implementation detail of a proof. Nothing in
`editor-state.ts` computes anything about a puzzle: it assembles a
`PuzzleSpec`, hands it to `encodeState`, and every statement it makes about a
puzzle still comes back through `buildPuzzle`. The rule these modules are held
to is unchanged and is enforced by their imports: **no test in this feature
reaches past `buildPuzzle`.**

## Consequences

- Every acceptance criterion of issue 6 that can be tested has a test, without
  jsdom, without Playwright and without touching `vitest.config.ts`.
- `src/components/` stays thin enough that the spec's "DOM layer gets a smoke
  check only" remains true — the smoke check being that the app runs.
- A future contributor adding a control has an obvious home for its rules, and
  an obvious reason not to put them in the component.
- The cost is one more module boundary in `src/lib/` and the discipline to keep
  puzzle logic out of it. `editor-state.ts` importing from the engine's
  internals would be the signal that this line has moved.

## Alternatives considered

- **Put the rules in the components and test with jsdom.** Needs a config
  change the brief forbids without an ADR, and buys a slower suite that tests
  clamping through an `<input>` rather than clamping.
- **Put the rules in the components and leave them untested.** Cheapest, and it
  drops "piece count cannot be set above `MAX_PIECES`" — a guard on the
  measured envelope — to the level of a code comment.
- **Extend `buildPuzzle` to normalise UI values.** Would put presentation
  policy inside the engine's entry point and change a tested signature that two
  other issues depend on.
