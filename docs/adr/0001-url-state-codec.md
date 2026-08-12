# 0001 — The URL state codec, and what "byte-identical" means

- **Status** — accepted
- **Date** — 2026-08-12

## Context

Seam 1 takes the encoded state string, not a decoded object:

```ts
buildPuzzle(encodedState: string): PuzzleDocument | Rejection
```

So the codec is on the path of every engine call and every engine test, and its
format is hard to change later in the only way that matters: **links already
sent to other people must keep working.** That makes the encoding a
hard-to-reverse decision and puts it here.

Three constraints bind it:

1. The state rides in the URL **fragment**, so it is never sent to a server and
   is subject to whatever length a browser and a chat client will carry.
2. **No new runtime dependencies** (CLAUDE.md). The bundle is a feature.
3. Seam 1 is **synchronous**.

## Decision

### Format

`<version>.<base64url payload>`, e.g. `1.BAAAeAAAAAEABgAG______DVBg`. The version is
decimal digits before the first `.`, read before anything else is trusted.

The v1 payload is fixed-layout binary, big-endian:

```
  0      u8    piece count
  1      u8    material, an index into a frozen list
  2..3   u16   cell size in tenths of a millimetre
  4..7   u32   seed
  8..9   u16   bounding-box width in cells
  10..11 u16   bounding-box height in cells
  12..   bits  one bit per bounding-box square, row-major, MSB first
  last 2 u16   FNV-1a checksum of every preceding byte
```

The target is stored as a **bitmask over its own bounding box**: one bit per
grid square rather than a coordinate pair per cell. A 200-cell blob costs about
40 payload bytes, roughly 55 characters of URL. Only the *shape* is carried, not
where it was drawn — cells come back at the origin — so two people who drew the
same outline in different places produce the same link.

The payload length is a function of the width and height, so truncation is
caught by arithmetic before the checksum is consulted; the checksum is for the
corrupted-but-plausible case.

### Versioning

The version is the first thing written and the first thing read. An unknown
version is refused **by name** (`unsupported-version`) rather than misparsed, so
a v1 page tells the user honestly that a v2 link is newer than the page, and a
future v2 reader can still recognise and read v1 links. Material codes are
positional and frozen: appending a material is safe, reordering or removing one
is not and needs a new version.

### Three new rejection reasons

`types.ts` gained `malformed-state`, `unsupported-version` and
`verification-failed`. The first two exist because seam 1 takes a string from a
URL bar and so has to be able to say "this is not a puzzle" without throwing.
The third is the central invariant's refusal path: when the independent re-count
disagrees with the search, the engine declines rather than shipping a guarantee
it could not confirm. All three are additive to the union.

### "Byte-identical" excludes `proof.searchMs`

Issue 4's acceptance criteria say the same encoded state yields a
byte-identical document. `Proof.searchMs` is defined in `types.ts` as wall-clock
milliseconds, for the on-screen counter, so it cannot be byte-identical between
two runs on the same machine, let alone two machines. Everything else is:
`build-puzzle.test.ts` compares the whole document exactly with `searchMs`
masked, and pins `searchMs` separately as a finite, non-negative measurement of
the same deterministic work. The alternative — dropping or quantising the field
— would take a real number away from the UI to satisfy a phrase.

## Consequences

- Old links keep working, or are refused by name. There is no third outcome.
- A puzzle URL is short enough to paste into a chat window: 28 characters of
  fragment for a 36-cell square, 54 for a 200-cell rectangle.
- The encoder is deliberately permissive about the *puzzle* — a piece count of
  nine and a three-cell outline both encode cleanly — because refusing them is
  the engine's job and its refusals name the fix. It throws only when a field
  cannot be represented at all, which is a programming error.
- Bounding boxes are capped at 65,536 squares, which bounds the work a hostile
  string can ask for before a byte of it is trusted.
- Changing any field width or order means a version 2, a v2 writer, and a
  reader that still reads v1.

## Alternatives considered

- **`CompressionStream` (gzip/deflate in the browser).** No dependency, but it
  is asynchronous and seam 1 is synchronous. It would also compress a bitmask
  that is already near-dense. Rejected.
- **A hand-rolled LZ or run-length pass over the bitmask.** Real gains only on
  large sparse targets, which the envelope does not produce, and every byte of
  it is a byte that can be subtly wrong for five years. Rejected as unearned
  complexity; the version field leaves the door open.
- **JSON, or a delimited list of coordinates.** Three to five times longer, and
  a hand-written URL would parse into a plausible-looking puzzle rather than a
  refusal. Rejected.
- **Version as a byte inside the payload rather than a prefix.** Then reading
  the version means base64-decoding first, and a v2 payload whose base64 fails a
  v1 length check reports "damaged link" instead of "newer format". Rejected.
- **No checksum.** The length check already catches truncation, which is the
  common failure. Two bytes buys the case where a link is mangled in transit but
  still decodes, which would otherwise become a puzzle the sender never made.
  Kept.
