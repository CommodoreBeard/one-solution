# 0003 — The search animation is a schedule of data, not a component's state

- **Status** — accepted
- **Date** — 2026-08-12

## Context

Issue 7 is the demo: the engine's rejected candidates, each stamped with its
true solution count, flashing past until one lands on `1`. Four of its six
acceptance criteria are statements about *what is shown when* rather than about
pixels — the candidates are real and carry their real counts, the animation is
skippable, `prefers-reduced-motion` resolves without flashing, and a
first-attempt success displays correctly rather than looking broken.

The obvious implementation puts all of that inside a canvas component: a
`requestAnimationFrame` loop with an index, a timer and some branches. That is
also the version where none of those four criteria can be tested. The DOM layer
gets a smoke check only (no jsdom, no Playwright, no visual regression), so
anything that lives in `src/components/` is verified by hand and by eye — which
is exactly the wrong place for the rule that says *never synthesise a
plausible-looking failure*.

## Decision

The animation is split in two.

`src/lib/search-timeline.ts` turns a `PuzzleDocument` into a `SearchTimeline`:
an ordered list of frames, each with the pieces to draw, the count to stamp on
them, the caption, and a start time and duration in milliseconds. It is pure —
no DOM, no clock, no randomness — and `frameAt(timeline, elapsedMs)` is a total
function from an elapsed time to the frame showing at it. `proof-summary.ts`
does the same for the proof panel's rows.

`src/components/search-animation.ts` owns the clock, the canvas and the skip
button, and nothing else. It reads `prefers-reduced-motion`, asks for a
timeline, and plays it.

**This is not a third seam**, for the same reason ADR 0002 gives: nothing here
computes anything about a puzzle. Every candidate, every count and every number
in the proof panel arrives from `buildPuzzle` and is passed through unchanged.
The timeline decides *when* to show a fact, never *what* the fact is, and no
test in this feature reaches past `buildPuzzle`.

## Consequences

- The honesty requirement is a test, not a habit: `search-timeline.test.ts`
  builds real documents through seam 1 and asserts frame-by-frame that the
  candidates are the engine's own, in order, with the engine's own counts.
- Reduced motion is a branch in a pure function returning a one-frame,
  already-settled timeline, so "resolves without flashing" is asserted rather
  than demonstrated.
- Skipping is `finish()`: jump to the last frame of the same schedule. There is
  no second code path for the skipped case that could disagree with the played
  one.
- The animation cannot block anything. The document is complete before the
  first frame is scheduled, so the headline, the piece list, the download
  buttons and the share link are all final from the first paint — the picture
  and the proof rows are the only things that catch up.
- The engine keeps knowing nothing about presentation. `MAX_ANIMATION_MS` and
  the frame durations live in `search-timeline.ts`; `envelope.ts` is untouched.

## Alternatives considered

- **All of it in the component.** Smaller by a file, and it would have put the
  one rule that matters — the candidates are real — beyond the reach of the
  suite.
- **jsdom, and test the component.** Needs an ADR of its own, slows the suite,
  and would still not test the timing, because jsdom has no
  `requestAnimationFrame` clock worth asserting against.
- **A frame index rather than milliseconds.** Simpler to schedule, but the
  frame rate then depends on the display, and the animation budget stops being
  a budget.
