# 0005 — Hand-rolled PDF, SVG and DXF writers over one sheet model

- **Status** — accepted
- **Date** — 2026-08-12

## Context

Seam 2 is `serialize(doc, format) → Uint8Array`, and it has to produce three
formats that each exist for a stated reason: PDF is the reference output for
printing on card, SVG is for craft cutters, and DXF exists because the basic
edition of Silhouette Studio cannot open SVG at all.

The obvious move is a library per format. The spec forbids it — "the bundle is
a feature", and any new runtime dependency needs an ADR of its own — so this
records the decision not to reach for one, along with the format choices that
are awkward to reverse once users have files on disk.

Three facts shape the rest. The pieces are already laid out in millimetres in
their solved positions, so there is no packing problem to solve. The output is
closed polylines plus short single-line labels, which is a very small subset of
all three formats. And scale correctness is the requirement that actually
matters, because a user discovers a rescaled sheet after cutting.

## Decision

**One format-independent sheet model, three thin writers.** `sheet-layout.ts`
decides what is on the page — three sheets, in millimetres, y down — and each
writer only knows how to spell a polyline and a piece of text. Everything that
could be inconsistent between formats is therefore written once, and a writer
is small enough to hand-roll without a library.

**No dependencies.** The PDF is an uncompressed PDF 1.4: catalog, page tree,
one base-14 Helvetica, one content stream per page, and a cross-reference table
of byte offsets. That is roughly a hundred lines, against a PDF library's tens
of kilobytes of bundle.

**PDF gets three pages; SVG and DXF stack the three sheets in one document.**
SVG and DXF have no notion of a page, and asking the user to download nine
files instead of three would be worse than a stacked sheet a cutter can crop.

**DXF is R12 (AC1009), with `POLYLINE`/`VERTEX`/`SEQEND` rather than the R13
`LWPOLYLINE`.** R12 is the most widely readable dialect and needs no handles,
no CLASSES section and no OBJECTS dictionary, so a minimal hand-written R12
file is a complete valid file rather than a truncated newer one. The whole
point of shipping DXF is reach, and R12 maximises it. `$INSUNITS = 4`
(millimetres) is written even though it is strictly an R13+ header variable:
importers that do not know it ignore it, and importers that do know it get the
scale right.

**Cut, fold, score and guide are separate layers in every format** — group in
SVG, layer in DXF, and colour plus dash pattern in all three, so the
distinction survives a monochrome print as well as a cutting head. Guide is
separate from the other three specifically so a cutter never cuts the
calibration ruler.

**Piece labels anchor to a cell centre, not a polygon centroid**, because the
centroid of an L or a U falls outside the piece, and a letter printed outside
the piece it names is worse than no letter.

## Consequences

- No runtime dependencies, and the writers stay readable in a text editor.
- Adding a fourth format means one more writer against the sheet model, and no
  change to the sheet model itself.
- The PDF is uncompressed, so it is larger than a library's output. For three
  pages of line art this is a few kilobytes and nobody notices.
- The hand-rolled PDF supports only what is written here. Anything wanting
  images, transparency or embedded fonts would need real work, and should
  reopen this decision rather than extend the writer quietly.
- R12 costs verbosity in the DXF: every vertex is its own entity. The file is
  still tens of kilobytes.
- Characterisation tests restate the layout constants rather than importing
  them, so a change to page size fails a test instead of silently agreeing with
  itself.

## Alternatives considered

- **A PDF library (pdf-lib, jsPDF) and an SVG/DXF library.** Rejected on the
  spec's own terms: the bundle is part of the pitch, and the subset needed here
  is small enough that a library would be mostly unused code.
- **Rely on the browser's print-to-PDF from CSS.** Rejected outright by the
  spec, and correctly: print scaling is exactly the thing that cannot be
  trusted, and the failure is discovered after cutting.
- **DXF R2000 with `LWPOLYLINE`.** Terser, but a hand-rolled R2000 file without
  CLASSES and OBJECTS is a file some importers reject. Reach beats terseness
  here, since reach is the reason DXF exists at all.
- **One page per file, nine downloads.** Rejected as worse for the user than a
  stacked sheet.
- **Emitting the tray outline on the cut sheet as well as the pieces.** It is
  the union of the pieces, so it would put two cut paths on the same line and a
  cutter would cut it twice.
