# Agent kickoff prompt

Paste the block below into a fresh session started in `/Users/joe/git/one-solution`.
It is self-contained: it assumes the session knows nothing about this project.

---

You are picking up an established, fully specified project. Everything you need
is in the repo. Do not redesign it.

## Read these first, in this order

1. `CLAUDE.md` — conventions, the two test seams, the hard rules.
2. `docs/specs/one-solution-tray-edition.md` — the spec. Issues cite its sections.
3. `reference/README.md` — a validated Python oracle and the exact test vectors
   the TypeScript port must reproduce.

Then run `gh issue view 1` for the build order.

## What the project is

A static web app that cuts a shape into pieces and proves those pieces repack
that shape in **exactly one way**, then emits print-ready cut files. No backend,
no database, no accounts. State lives in the URL. Vanilla TypeScript on Vite,
Vitest, Bun.

## The rule that governs everything

The product sells a mathematical guarantee. **A wrong guarantee is worse than no
guarantee**, because the user discovers it only after cutting out the pieces.

So: if a known-answer test fails, stop and report it. Never relax a test to make
it pass. Never mark an issue done with a failing gate. A plausible-looking
number is not evidence — the prototype once reported a confident, entirely wrong
result for every mirror-symmetric shape, and it looked like a finding rather
than a bug.

## Build order

The graph is mostly serial. There is one parallel window.

```
#2 engine: dissection growth + exact-cover counter
  └─ #3 engine: symmetry quotient + envelope guards
       └─ #4 engine: url codec + buildPuzzle seam
            ├─ #5 export: pdf/svg/dxf, tray, solution card   ← these two
            └─ #6 ui: preset gallery + grid editor           ← can run together
                 └─ #7 ui: live rejected-dissection animation
                      └─ #8 chore: pages deploy + launch copy
```

Work #2, #3 and #4 strictly in order — each depends on the last being correct.

Once #4 is merged, #5 and #6 are genuinely independent: one touches the file
writers, the other touches the DOM, and they share only the types. Run them as
two agents in separate git worktrees so they cannot collide.

Then #7, then #8.

## Per-issue workflow

For each issue, in order:

1. `gh issue view <n>` and read it in full. The acceptance criteria are the
   definition of done.
2. `gh issue develop <n> --checkout` to get a branch.
3. Write the tests first. Every acceptance checkbox should map to a test.
4. Implement until they pass.
5. Run the full gate — all four, no exceptions:
   ```
   bun run build && bun run lint && bun run typecheck && bun run test
   ```
6. One commit. Conventional subject, no scope, lowercase, issue number after
   the colon: `feat: 2 add exact-cover solution counter`
7. Open a PR referencing the issue. CI runs the same four commands.
8. Merge, then move to the next issue.

## Hard rules

- **Two test seams only**: `buildPuzzle(encodedState)` and
  `serialize(doc, format)`. Growth, exact cover, canonicalisation, orbit
  counting and the retry loop are internal and must never be imported by a
  test. A third seam needs an ADR in `docs/adr/`.
- **No `any`.** Strict TypeScript; ESLint enforces it.
- **No new runtime dependencies without an ADR.** The PDF and DXF writers are
  hand-rolled on purpose — bundle size is part of the pitch.
- **Respect `src/lib/envelope.ts`.** Those constants come from 2,520 measured
  dissections, not from taste. Do not tune them to make a test pass.
- **Abort at the second solution; never enumerate.** This is what makes a search
  take about 3 ms, and the search animation in #7 depends on it.
- **Honest failure.** When no unique dissection exists, return a typed rejection
  naming a piece count that works. Never spin forever.

## When to stop and ask

Stop, apply the `hitl` label to the issue, and report back if:

- A known-answer test fails and you cannot see why.
- An acceptance criterion contradicts the spec.
- You believe an envelope constant is wrong.
- You want to add a dependency or a third seam.

Do not guess your way past any of these. Everything else is `afk` — proceed
without checking in.

## Where to record decisions

- A hard-to-reverse or trade-off-laden decision → an ADR in `docs/adr/`,
  following the template in `docs/adr/README.md`.
- Anything a later agent would need to know → a comment on the issue.
