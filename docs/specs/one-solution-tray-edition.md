# One Solution — Tray Edition

## Problem Statement

Someone wants to make a physical puzzle for another person — a gift, a party
favour, a classroom set, a thing to hand across a table. They have a shape in
mind: a cat, a leaf, a county outline.

What they can get today is a jigsaw. Upload a photo, receive a tab-and-blank
cut file. A jigsaw has no puzzle in it: the tabs tell you where every piece
goes, so assembling one is a sorting chore rather than a problem to solve.

If they want a *real* puzzle — flat pieces that pack into an outline, where
finding the arrangement is the challenge — they must design it themselves.
That means picking pieces by hand, then somehow satisfying themselves that
there is only one way to fit them, because a packing puzzle with fourteen
solutions is not a puzzle either. The existing tools do not help:

- **BurrTools** requires the user to supply the pieces. It analyses; it does not
  invent. Its design chapter is explicitly unimplemented — the manual states
  the text was written as though the features existed so it could be reused.
- **Mechanical Puzzle Studio** counts solutions up to symmetry in the browser,
  free, today. It does not generate dissections and emits no cut files.
- **Kita & Miyata (2020)** dissects a user-supplied shape into polyominoes, but
  does not guarantee a unique solution, does not score difficulty, and released
  no code.

So the user is left doing exact-cover reasoning by hand, or giving up and
buying a jigsaw.

## Solution

A page where you pick or draw an outline, choose how many pieces you want, and
get back a puzzle that provably fits together **exactly one way** — with the
cut files to make it out of card.

The proof is the product, and it is shown rather than asserted. Because a
single solution count takes about three milliseconds, the search can run in
front of the user: candidate dissections flash past stamped with their solution
counts — `4 solutions`, `12`, `2` — until one lands on `1` and the app stops.
The user watches the guarantee being established.

The output is a print-ready package for hand cutting: a true-scale cut sheet
with the pieces nested inside the tray outline, a tray template, a mirrored
solution card so the answer cannot be glimpsed by accident, and a calibration
ruler so the user can confirm their printer did not rescale anything.

Everything runs in the browser. The whole puzzle is encoded in the URL, so
sending someone a link sends them the puzzle, and the app costs nothing to run
and cannot break when a vendor shuts down.

## User Stories

### Making a puzzle

1. As a gift-maker, I want to choose from a gallery of ready-made outlines, so
   that I can produce something good without first having to draw.
2. As a gift-maker, I want the gallery shown before any blank canvas, so that I
   understand what the app makes within a few seconds of arriving.
3. As a hobbyist, I want to draw my own outline on a grid by dragging, so that I
   can make a puzzle in a shape that means something to the recipient.
4. As a hobbyist, I want to erase cells I added by mistake, so that a slip does
   not force me to start again.
5. As a hobbyist, I want the grid resolution to be adjustable, so that I can
   trade detail in the outline against the size of the finished pieces.
6. As a hobbyist, I want to choose how many pieces the puzzle has, so that I can
   match the difficulty to the person receiving it.
7. As a hobbyist, I want a sensible piece count chosen for me by default, so
   that I can get a good result without understanding the trade-off.
8. As a user, I want to be told when my chosen piece count cannot work for my
   shape, and which count would, so that I can fix it in one click instead of
   guessing.
9. As a user, I want to be stopped from drawing a shape that cannot produce a
   good puzzle, with the reason explained, so that I do not cut out pieces that
   turn out to have six solutions.
10. As a user, I want to regenerate a different puzzle from the same outline, so
    that I can pick an arrangement whose pieces I like the look of.
11. As a user, I want each generated puzzle to be reproducible from its link, so
    that the same URL always yields the identical puzzle.
12. As an impatient user, I want generation to complete in about a second, so
    that experimenting feels immediate.

### Seeing the proof

13. As a curious visitor, I want to watch the search reject candidate
    dissections with their solution counts shown, so that I can see the
    guarantee being established rather than being asked to trust it.
14. As a curious visitor, I want the rejected candidates to be real search
    output rather than a decorative animation, so that what I am watching is
    honest.
15. As a visitor in a hurry, I want to skip the animation, so that I am not held
    up by a demo I have already seen.
16. As a sceptical visitor, I want to see how many candidates were tried and how
    long the search took, so that I can judge whether the claim is serious.
17. As a sceptical visitor, I want to see the outline's symmetry order and the
    raw solution count alongside the distinct count, so that I can tell what
    "exactly one" is being measured up to.
18. As a visitor with reduced-motion preferences set, I want the search to
    resolve without flashing content, so that the page does not hurt to use.

### Making the physical object

19. As a maker, I want a print-ready PDF at exact millimetre scale, so that the
    pieces I cut match the tray I cut.
20. As a maker, I want a printed calibration ruler on the sheet, so that I can
    check my printer did not silently rescale the page.
21. As a maker, I want the pieces laid out inside the tray outline, so that I
    can see at a glance that they belong to one puzzle.
22. As a maker, I want a tray or frame template, so that the finished puzzle has
    something to sit in.
23. As a maker, I want a mirrored solution card, so that I can keep the answer
    without seeing it every time I open the box.
24. As a maker, I want to pick my material, so that the tolerances suit card,
    chipboard, ply or acrylic.
25. As a maker with a craft cutter, I want an SVG with explicit real-world units
    and a correct viewBox, so that it imports at the right size.
26. As a maker whose software cannot open SVG, I want a DXF as well, so that the
    basic edition of my cutting software can still use it.
27. As a maker, I want cut lines distinguished from fold and score lines, so
    that I do not cut through something I should have creased.
28. As a maker, I want each piece labelled on the sheet, so that I can keep
    track of them while cutting.
29. As a maker cutting by hand, I want to be told honestly that hand-cutting
    slop can make a second arrangement physically possible, so that the
    guarantee is not oversold to me.

### Sharing and returning

30. As a user, I want the whole puzzle encoded in the URL, so that sending the
    link sends the puzzle.
31. As a recipient of a link, I want the puzzle to load exactly as the sender
    saw it, without an account or a download.
32. As a user, I want the link to keep working indefinitely, so that a puzzle I
    made this year still opens in five years.
33. As a user, I want a shared link to open on the finished puzzle rather than
    re-running the search, so that the recipient sees the result immediately.
34. As a user, I want the page to work offline once loaded, so that I can use it
    at a table with no signal.

### Trust and provenance

35. As an engineer arriving from a link aggregator, I want an honest comparison
    against BurrTools, Mechanical Puzzle Studio and the Kita & Miyata paper, so
    that I can see what is genuinely new here.
36. As an engineer, I want the uniqueness claim stated precisely — flips
    allowed, counted up to the outline's symmetry group — so that I can judge
    whether it means what I think it means.
37. As an engineer, I want the source and the test vectors public, so that I can
    check the claim myself.

### Accessibility and reach

38. As a keyboard user, I want to draw and edit the outline without a mouse, so
    that the editor is usable.
39. As a screen-reader user, I want the result announced as text, so that I know
    a puzzle was produced and how many pieces it has.
40. As a phone user, I want the grid editor to work with touch, so that I can
    make a puzzle without a laptop.
41. As a user in either colour scheme, I want the page to be legible, so that my
    system theme does not make it unreadable.
42. As a colour-blind user, I want pieces distinguishable by more than hue, so
    that I can tell them apart on screen.

## Implementation Decisions

### Two seams, and only two

The whole engine sits behind one entry point, and the file writers behind a
second. Everything else is internal and is never imported by a test. Adding a
third seam requires an ADR.

These signatures came out of the prototype and encode the contract more exactly
than prose can:

```ts
// Seam 1 — the engine. Takes the encoded URL state, so the codec is
// exercised by every engine test rather than needing a seam of its own.
buildPuzzle(encodedState: string): PuzzleDocument | Rejection

// Seam 2 — the writers.
serialize(doc: PuzzleDocument, format: 'pdf' | 'svg' | 'dxf'): Uint8Array
```

Behind seam 1: dissection growth, exact cover, piece canonicalisation, the
symmetry quotient, orbit counting, the retry loop, and geometry layout.

### The uniqueness claim, stated exactly

Two arrangements are **the same** when one maps onto the other under a symmetry
of the target outline. Pieces may be **flipped over**, because a card piece can
be turned face down. Congruent pieces are **interchangeable**, so swapping two
identical pieces is not a second solution.

Concretely, the engine counts distinct partitions of the target into regions
whose multiset of shapes matches the piece multiset, then quotients by the
target's stabiliser subgroup of the dihedral group of order 8.

This definition is load-bearing and each clause was a bug in the prototype at
some point. Getting the flip clause wrong makes the guarantee false for the
physical object. Getting the interchangeability clause wrong discards good
dissections. Getting the quotient wrong made the prototype report 0% unique for
every mirror-symmetric shape.

### Abort at two, never enumerate

Uniqueness needs only proof that a second arrangement exists. The engine stops
counting at the second solution, which is what makes a search ~3 ms.

The prototype used a naive recursion and took 26 minutes to fully enumerate the
pentomino 3×20 case. That is acceptable for an oracle and unacceptable here.
Full counts are needed only for the rejected-candidate display, and those are
capped at a small number.

### The envelope is measured, and enforced in code

From 2,520 random dissections across seven shapes — share with exactly one
solution, by piece count:

| Shape | 4 | 5 | 6 | 7 | 8 | 9 |
| --- | --- | --- | --- | --- | --- | --- |
| blob | 97% | 88% | 85% | 53% | 13% | 0% |
| dog | 97% | 92% | 70% | 37% | 3% | 0% |
| square | 95% | 77% | 55% | 28% | 7% | 0% |
| cat | 92% | 73% | 42% | 12% | 3% | 0% |
| heart | 72% | 47% | 13% | 0% | 0% | 0% |
| letters | 38% | 17% | 2% | 2% | 0% | 0% |

Decisions taken from it:

- **Seven pieces is a hard cap**; five is the default. Nine never worked once.
- **Thin outlines are refused up front.** The "letters" row is a letter-stroke
  shape. Narrow shapes force small pieces, and small pieces are mostly
  congruent duplicates, which multiplies solutions. This kills monogram
  puzzles as a feature, and that is a deliberate decision rather than an
  oversight.
- **Retry budget is bounded** and failure is honest: the engine reports a piece
  count that did succeed rather than spinning.

These live as named constants, not as magic numbers scattered through the code.

### No framework, no dependencies

Vanilla TypeScript on Vite. The UI is a grid editor, a controls panel and one
animation. The PDF and DXF writers are hand-rolled — both formats need only a
tiny subset for closed polylines and text, and the bundle size is part of the
pitch. Any new runtime dependency needs an ADR.

### State is the URL, and it is the input format

The encoded spec carries the target cells, piece count, seed, material and cell
size. It is compressed and placed in the fragment, which is never sent to a
server. A shared link opens directly on the finished puzzle.

The encoding is versioned from the first commit so that old links keep working.

### Scale correctness

PDF is emitted at exact millimetres by the writer, never by CSS print. SVG
carries explicit real-world width and height with a matching viewBox, because
craft-cutter software derives import scale from those and gets it wrong
otherwise. DXF exists specifically because the basic edition of Silhouette
Studio cannot open SVG at all. Every sheet carries a calibration ruler.

### Rendering

Canvas for the grid editor and the search animation, since both redraw
frequently. The exported geometry is generated independently of the canvas — the
screen is a view of the document, never the source of the cut file.

## Testing Decisions

### What makes a good test here

Test what the seam promises, never how it keeps the promise. A test that
imports the growth function, the canonicaliser or the orbit counter is testing
an implementation detail and is wrong by construction — those are internal.

The bar is higher than usual for one reason: **the product sells a mathematical
guarantee, and a wrong guarantee is discovered by the user only after they have
cut out the pieces.** A plausible-looking number is not evidence.

### Seam 1 — the engine

Carries the great majority of the suite.

- **Known-answer tests against the literature.** The 12 pentominoes tile a 3×20
  rectangle in exactly 2 ways up to symmetry, a 4×15 in 368, a 5×12 in 1010, a
  6×10 in 2339. These are published values and the port must reproduce them.
- **Differential tests against the reference oracle** in `reference/`, which was
  itself checked against an independently written naive enumerator over 426
  random cases with zero disagreements.
- **The central invariant, asserted on every accepted puzzle:** re-count the
  returned piece set from scratch and confirm the count really is one. The
  engine must never take its own word for it.
- **Partition invariants:** the pieces exactly cover the target, do not overlap,
  are each connected, and number exactly the requested count.
- **Symmetry-quotient tests specifically**, because this is the part most likely
  to be silently wrong. A mirror-symmetric target with an asymmetric dissection
  must yield one orbit from two raw partitions. Assert the bound
  `1 ≤ orbits ≤ raw ≤ orbits × |G|`.
- **Piece identity under flips:** an L-tromino and its mirror are the same
  piece; an S- and a Z-tetromino are the same piece.
- **Envelope tests:** nine pieces is rejected without searching; a letter-stroke
  outline is rejected as too thin; a disconnected outline is rejected.
- **Honest-failure tests:** an impossible request returns a typed rejection with
  a workable suggested piece count, and never exceeds the retry budget.
- **Determinism:** the same encoded state yields a byte-identical document.
- **Codec round-trip**, which rides along free because the seam takes the
  encoded string.

### Seam 2 — the writers

Roughly four characterisation tests per format, no more.

- The PDF page dimensions are the expected millimetres.
- The SVG carries explicit real-world units and a viewBox that agrees with them.
- The DXF parses and contains the expected number of closed polylines.
- The calibration ruler is present on every sheet.
- Cut, fold and score lines are distinguishable in the output.

### Prior art for the tests

There is none in this repo — it is greenfield. The closest model is
`invoiceref/web`, whose convention this project follows: Vitest, `*.test.ts`
co-located beside the module, `describe`/`test` imported explicitly, and a
comment at the top of each file naming the requirement it pins.

### Not tested

The DOM layer beyond a smoke check. No Playwright, no visual regression. The
value is in the engine and the writers, and the UI is thin enough that tests
there would cost more than they catch.

## Out of Scope

- **3D.** No polycubes, no STL, no burr puzzles. Two-dimensional tray puzzles
  only. This is the single largest scope cut and it removes most of the
  physical risk, because pieces and tray print from one sheet and a mis-scaled
  printer shrinks both together.
- **Wood and laser as the reference material.** Card is the reference. Laser
  users get a kerf offset field, documented as untested, rather than a
  validated preset — validating kerf needs a machine and several weekends.
- **Nesting for material efficiency.** Pieces lay out inside the tray outline,
  so nesting is free by construction. Irregular-polygon nesting is NP-hard and
  buys nothing here.
- **A difficulty score.** Search telemetry measures solver difficulty, not human
  difficulty. An uncalibrated number would be mocked, fairly.
- **Accounts, saving, galleries of user creations, a backend of any kind.**
- **Monetisation.** No payments, no merchant of record.
- **Monogram and lettering puzzles.** Measured as the worst-performing shape
  class. Refused with an explanation rather than shipped badly.
- **Photo or image upload.** Outlines are drawn or chosen, not traced.

## Further Notes

**Lead with the proof.** An earlier review recommended hiding the uniqueness
guarantee and marketing this as "turn any shape into a wooden puzzle". A
follow-up prior-art search found that reframing walks directly into an occupied
market: custom-shape laser puzzles are sold commercially, and kerf-compensated
cut-file generators are free and abundant. The uniqueness proof is the only
unoccupied ground. It is the headline.

**Name the prior art on the page.** Ship a comparison table covering BurrTools,
Mechanical Puzzle Studio and Kita & Miyata 2020, stating plainly what is new
(generating a dissection of an arbitrary outline, proving it unique, and
emitting a hand-cut fabrication package) and what is not (browser exact-cover
solving, cut-file export). Without it, the launch reads as reinvention.

**Be honest about hand-cutting tolerance.** Accumulated slop across several
hand-cut pieces can make a near-miss arrangement physically fit. Say so, in
plain words, near the download button. Documenting the limit is more credible
than hiding it, and it is the difference between a guarantee and a boast.

**Demand is latent, not proven.** No evidence was found of people asking for
this tool. The mechanical-puzzle community values solution uniqueness — it is
an advertised property on commercial puzzles, and computer-assisted design has
a thirty-year respected pedigree there — but nobody is requesting a generator.
This is acceptable for a portfolio piece and should be a conscious choice.
