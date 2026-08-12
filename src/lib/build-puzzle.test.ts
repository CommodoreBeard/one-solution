/**
 * Pins seam 1: `buildPuzzle(encodedState) -> PuzzleDocument | Rejection`, and
 * with it the spec's *State is the URL, and it is the input format*.
 *
 * Everything here goes through the seam. The engine's internals — growth,
 * exact cover, canonicalisation, the symmetry quotient, orbit counting, the
 * retry loop, geometry — are never imported, and the only other module touched
 * is the codec's encode direction, which is the seam's own input format and
 * the editor's output.
 *
 * The guarantee is checked against an **independently written solver at the
 * bottom of this file**, not against the engine's own numbers. It is naive on
 * purpose: fill the lowest uncovered cell, enumerate everything, deduplicate
 * partitions, then quotient by the target's symmetries. It shares no code with
 * the engine, so agreement between the two is evidence rather than a tautology.
 *
 * One acceptance criterion is met in spirit rather than to the letter: "the
 * same encoded state yields a byte-identical document" cannot hold for
 * `proof.searchMs`, which `types.ts` defines as wall-clock milliseconds. Every
 * other byte is compared exactly, and `searchMs` is pinned as a finite,
 * non-negative measurement of the same deterministic work. See
 * docs/adr/0001-url-state-codec.md.
 */

import { describe, expect, test } from 'vitest';
import { buildPuzzle } from './build-puzzle';
import { STATE_VERSION, encodeState } from './url-codec';
import type { Cell, Material, PuzzleDocument, PuzzleSpec, Shape } from './types';

const BASE: PuzzleSpec = {
  target: [],
  pieceCount: 4,
  seed: 1,
  material: 'cardstock',
  cellSizeMm: 12,
};

const spec = (overrides: Partial<PuzzleSpec>): PuzzleSpec => ({ ...BASE, ...overrides });

const rect = (rows: number, cols: number): Shape => {
  const cells: Cell[] = [];
  for (let row = 0; row < rows; row += 1)
    for (let col = 0; col < cols; col += 1) cells.push({ row, col });
  return cells;
};

/** An L: a 7x7 square with its top-right 3x3 corner removed. 40 cells, |G| = 2. */
const ell = (): Shape => rect(7, 7).filter(({ row, col }) => row >= 3 || col < 4);

/** A one-cell-wide stroke. The measured envelope refuses these. */
const stroke = (): Shape => rect(1, 30);

/** Build and require success, so a failure reports the engine's own message. */
const built = (input: PuzzleSpec): PuzzleDocument => {
  const result = buildPuzzle(encodeState(input));
  if (!result.ok) throw new Error(`expected a puzzle, got ${result.reason}: ${result.message}`);
  return result;
};

/** Every byte of a document except the wall-clock measurement. */
const withoutTiming = (doc: PuzzleDocument): string =>
  JSON.stringify({ ...doc, proof: { ...doc.proof, searchMs: 'measured' } });

describe('determinism', () => {
  test('the same encoded state yields a byte-identical document', () => {
    const state = encodeState(spec({ target: rect(6, 6), pieceCount: 4, seed: 7 }));

    const first = buildPuzzle(state);
    const second = buildPuzzle(state);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(withoutTiming(second)).toBe(withoutTiming(first));
    for (const doc of [first, second]) {
      expect(Number.isFinite(doc.proof.searchMs)).toBe(true);
      expect(doc.proof.searchMs).toBeGreaterThanOrEqual(0);
    }
  });

  test('a different seed is a different puzzle from the same outline', () => {
    const target = rect(5, 6);
    const one = built(spec({ target, seed: 3 }));
    const other = built(spec({ target, seed: 4 }));
    expect(withoutTiming(other)).not.toBe(withoutTiming(one));
  });

  test('where the outline was drawn does not change the puzzle', () => {
    const here = rect(6, 6);
    const there = here.map(({ row, col }) => ({ row: row + 40, col: col + 17 }));
    expect(encodeState(spec({ target: there }))).toBe(encodeState(spec({ target: here })));
  });
});

describe('the codec round-trips', () => {
  const cases: { name: string; target: Shape; pieceCount: number }[] = [
    { name: 'a 6x6 square', target: rect(6, 6), pieceCount: 4 },
    { name: 'a 40-cell L', target: ell(), pieceCount: 3 },
    { name: 'a 6x8 rectangle', target: rect(6, 8), pieceCount: 5 },
    { name: 'a 200-cell rectangle', target: rect(10, 20), pieceCount: 4 },
  ];

  for (const { name, target, pieceCount } of cases) {
    test(`${name} survives encode and decode`, () => {
      const input = spec({ target, pieceCount, seed: 11 });
      expect(built(input).spec).toEqual(input);
    });
  }

  test('every material and a fractional cell size survive', () => {
    const materials: Material[] = ['cardstock', 'chipboard', 'laser-ply', 'acrylic'];
    for (const material of materials) {
      const input = spec({ target: rect(6, 6), material, cellSizeMm: 8.5, seed: 2 });
      expect(built(input).spec).toEqual(input);
    }
  });
});

describe('damaged links are refused, never thrown', () => {
  const valid = (): string => encodeState(spec({ target: rect(6, 6) }));

  const refuses = (state: string): { reason: string; message: string } => {
    const result = buildPuzzle(state);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected a rejection');
    // Honest failure: every message has to leave the user something to do.
    expect(result.message.length).toBeGreaterThan(20);
    return { reason: result.reason, message: result.message };
  };

  test('an empty or version-less string is malformed', () => {
    expect(refuses('').reason).toBe('malformed-state');
    expect(refuses('notapuzzleatall').reason).toBe('malformed-state');
    expect(refuses('.AAAAAAAAAAAAAAAAAA').reason).toBe('malformed-state');
    expect(refuses('x.AAAAAAAAAAAAAAAAAA').reason).toBe('malformed-state');
  });

  test('characters outside the alphabet are malformed', () => {
    expect(refuses(`${STATE_VERSION}.not base64!`).reason).toBe('malformed-state');
  });

  test('a truncated link is malformed at every cut', () => {
    const state = valid();
    for (let cut = 1; cut < state.length; cut += 1) {
      const result = buildPuzzle(state.slice(0, cut));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('malformed-state');
    }
  });

  test('a corrupted payload fails the checksum', () => {
    const state = valid();
    // Flip one payload character to something else in the alphabet.
    const at = state.length - 6;
    const swapped = state[at] === 'A' ? 'B' : 'A';
    const damaged = state.slice(0, at) + swapped + state.slice(at + 1);
    expect(damaged).not.toBe(state);
    expect(refuses(damaged).reason).toBe('malformed-state');
  });

  test('a future version is refused by name, not misparsed', () => {
    const state = valid();
    const future = `${STATE_VERSION + 1}.${state.slice(state.indexOf('.') + 1)}`;
    const refusal = refuses(future);
    expect(refusal.reason).toBe('unsupported-version');
    expect(refusal.message).toContain(String(STATE_VERSION + 1));
  });

  test('the version this build writes is the one it reads', () => {
    expect(valid().startsWith(`${STATE_VERSION}.`)).toBe(true);
  });
});

describe('the outline and piece count are judged before anything is promised', () => {
  const reason = (input: PuzzleSpec): string => {
    const result = buildPuzzle(encodeState(input));
    expect(result.ok).toBe(false);
    return result.ok ? 'accepted' : result.reason;
  };

  test('a piece count outside the measured range is refused with a workable one', () => {
    const result = buildPuzzle(encodeState(spec({ target: rect(6, 6), pieceCount: 9 })));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('piece-count-out-of-range');
    expect(result.suggestedPieceCount).toBeGreaterThanOrEqual(3);
    expect(result.suggestedPieceCount).toBeLessThanOrEqual(7);
  });

  test('an outline too small, too thin or in pieces is refused by name', () => {
    expect(reason(spec({ target: rect(3, 4) }))).toBe('shape-too-small');
    expect(reason(spec({ target: stroke() }))).toBe('shape-too-thin');
    expect(
      reason(
        spec({
          target: [...rect(4, 4), ...rect(4, 4).map(({ row, col }) => ({ row, col: col + 6 }))],
        }),
      ),
    ).toBe('shape-disconnected');
  });
});

describe('every accepted document is checked against its own pieces', () => {
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8];

  test('pieces cover the outline exactly, once each, connected, and number k', () => {
    // Counted, because a suite that quietly checked nothing would still pass.
    let checked = 0;
    for (const seed of seeds) {
      for (const pieceCount of [3, 4, 5]) {
        const target = seed % 2 === 0 ? rect(5, 6) : ell();
        const result = buildPuzzle(encodeState(spec({ target, pieceCount, seed })));
        if (!result.ok) continue;
        checked += 1;

        expect(result.pieces).toHaveLength(pieceCount);
        const covered = new Set<string>();
        for (const piece of result.pieces) {
          expect(piece.length).toBeGreaterThan(0);
          expect(isConnectedLocally(piece)).toBe(true);
          for (const cell of piece) {
            const at = `${cell.row},${cell.col}`;
            expect(covered.has(at)).toBe(false);
            covered.add(at);
          }
        }
        expect(covered.size).toBe(target.length);
        for (const cell of target) expect(covered.has(`${cell.row},${cell.col}`)).toBe(true);
      }
    }
    expect(checked).toBeGreaterThanOrEqual(20);
  });

  test('an independent solver agrees the pieces fit back in exactly one way', () => {
    // Both symmetry classes matter: the 6x6 square has |G| = 8 and the L has
    // |G| = 2, so the quotient is doing real work in one and almost none in
    // the other. A quotient that collapsed too much would pass only the first.
    let checked = 0;
    for (const target of [rect(6, 6), ell()]) {
      for (const seed of [1, 2, 3]) {
        const result = buildPuzzle(encodeState(spec({ target, seed })));
        if (!result.ok) continue;
        checked += 1;

        const independent = naiveCount(target, result.pieces);
        expect(independent.distinct).toBe(1);
        expect(independent.distinct).toBe(result.proof.distinctSolutions);
        expect(independent.raw).toBe(result.proof.rawSolutions);
        expect(independent.symmetryOrder).toBe(result.proof.symmetryOrder);
      }
    }
    expect(checked).toBe(6);
  });

  test('the proof stays inside 1 <= raw <= |G|, and claims exactly one', () => {
    let checked = 0;
    for (const seed of seeds) {
      const result = buildPuzzle(encodeState(spec({ target: rect(5, 6), seed })));
      if (!result.ok) continue;
      checked += 1;
      const { attempts, symmetryOrder, rawSolutions, distinctSolutions } = result.proof;
      expect(distinctSolutions).toBe(1);
      expect(symmetryOrder).toBeGreaterThanOrEqual(1);
      expect(symmetryOrder).toBeLessThanOrEqual(8);
      expect(rawSolutions).toBeGreaterThanOrEqual(1);
      expect(rawSolutions).toBeLessThanOrEqual(symmetryOrder);
      expect(attempts).toBeGreaterThanOrEqual(1);
    }
    expect(checked).toBe(seeds.length);
  });
});

describe('rejected candidates are real search output', () => {
  test('each is a genuine dissection with an honest count of at least two', () => {
    // A 5x6 at six pieces rejects plenty before it succeeds, which is what the
    // search animation replays.
    const target = rect(5, 6);
    const doc = built(spec({ target, pieceCount: 6, seed: 5 }));

    // Real candidates or none — never synthesised — but this case has to
    // produce some, or the test proves nothing.
    expect(doc.rejected.length).toBeGreaterThan(0);
    // MAX_RETAINED_REJECTS.
    expect(doc.rejected.length).toBeLessThanOrEqual(40);

    for (const candidate of doc.rejected) {
      expect(candidate.pieces).toHaveLength(6);
      const covered = new Set(
        candidate.pieces.flatMap((piece) => piece.map((c) => `${c.row},${c.col}`)),
      );
      expect(covered.size).toBe(target.length);
      // Rejected means "not exactly one", and the count shown is the real one.
      expect(candidate.distinctSolutions).toBeGreaterThanOrEqual(2);
    }
  });

  test('a retained count matches an independent enumeration', () => {
    const target = rect(6, 6);
    const doc = built(spec({ target, pieceCount: 5, seed: 9 }));
    expect(doc.rejected.length).toBeGreaterThan(0);

    const candidate = doc.rejected[0]!;
    const independent = naiveCount(target, candidate.pieces);
    // The engine stops collecting partitions at SOLUTION_COUNT_CAP, so its
    // count is exact below the cap and a floor at it.
    if (independent.raw < 12) expect(candidate.distinctSolutions).toBe(independent.distinct);
    else expect(independent.distinct).toBeGreaterThanOrEqual(candidate.distinctSolutions);
  });
});

describe('geometry is millimetres, derived from the cell size alone', () => {
  test('the sheet is the outline bounding box times the cell size', () => {
    for (const cellSizeMm of [10, 12.5, 25.4]) {
      const doc = built(spec({ target: rect(5, 6), cellSizeMm, seed: 3 }));
      expect(doc.geometry.widthMm).toBeCloseTo(6 * cellSizeMm, 10);
      expect(doc.geometry.heightMm).toBeCloseTo(5 * cellSizeMm, 10);
    }
  });

  test('every outline is closed, on the cell grid, and inside the tray', () => {
    const cellSizeMm = 12;
    const doc = built(spec({ target: ell(), cellSizeMm, seed: 3 }));
    const { widthMm, heightMm, trayOutline, pieceOutlines } = doc.geometry;

    expect(trayOutline.length).toBeGreaterThanOrEqual(1);
    expect(pieceOutlines).toHaveLength(doc.pieces.length);

    for (const ring of [...trayOutline, ...pieceOutlines]) {
      // Closed implicitly: at least three corners, and no repeated first point.
      expect(ring.length).toBeGreaterThanOrEqual(4);
      expect(ring[0]).not.toEqual(ring[ring.length - 1]);
      for (const [x, y] of ring) {
        expect(Number.isInteger(x / cellSizeMm)).toBe(true);
        expect(Number.isInteger(y / cellSizeMm)).toBe(true);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(widthMm);
        expect(y).toBeLessThanOrEqual(heightMm);
      }
    }
  });

  test('each piece outline encloses exactly its own cells', () => {
    const cellSizeMm = 12;
    const doc = built(spec({ target: rect(5, 6), cellSizeMm, seed: 3 }));
    doc.geometry.pieceOutlines.forEach((ring, i) => {
      expect(Math.abs(shoelace(ring))).toBeCloseTo(
        doc.pieces[i]!.length * cellSizeMm * cellSizeMm,
        6,
      );
    });
    const trayArea = doc.geometry.trayOutline.reduce(
      (total, ring) => total + Math.abs(shoelace(ring)),
      0,
    );
    expect(trayArea).toBeCloseTo(30 * cellSizeMm * cellSizeMm, 6);
  });

  test('an outline with a hole gives a tray with a hole', () => {
    // The tray keeps every ring, wound the opposite way for the hole, because a
    // ring traced the wrong way round is a hole that gets cut out as a disc.
    const cellSizeMm = 10;
    const donut = rect(8, 8).filter(
      ({ row, col }) => !(row >= 3 && row <= 4 && col >= 3 && col <= 4),
    );
    const doc = built(spec({ target: donut, cellSizeMm, seed: 3 }));

    const areas = doc.geometry.trayOutline.map(shoelace).sort((a, b) => a - b);
    expect(areas).toHaveLength(2);
    const [hole, outer] = [areas[0]!, areas[1]!];
    expect(Math.sign(hole)).toBe(-Math.sign(outer));
    expect(Math.abs(outer)).toBeCloseTo(64 * cellSizeMm * cellSizeMm, 6);
    expect(Math.abs(hole)).toBeCloseTo(4 * cellSizeMm * cellSizeMm, 6);
    expect(Math.abs(outer) - Math.abs(hole)).toBeCloseTo(
      donut.length * cellSizeMm * cellSizeMm,
      6,
    );
  });

  test('the cell size is the only thing that scales it', () => {
    const target = rect(5, 6);
    const small = built(spec({ target, cellSizeMm: 10, seed: 3 })).geometry;
    const large = built(spec({ target, cellSizeMm: 20, seed: 3 })).geometry;
    expect(large.widthMm).toBe(small.widthMm * 2);
    expect(large.pieceOutlines.map((ring) => ring.map(([x, y]) => [x / 2, y / 2]))).toEqual(
      small.pieceOutlines.map((ring) => ring.map(([x, y]) => [x, y])),
    );
  });
});

describe('the independent solver, checked by hand', () => {
  // If the checker below agreed with everything it would prove nothing, so it
  // is pinned on a case small enough to count on paper. A 2x2 square splits
  // into two dominoes in two ways, both horizontal or both vertical; the two
  // are a quarter-turn apart and the square's group has order 8, so that is one
  // puzzle, not two. Counting the identical dominoes as interchangeable is what
  // keeps the raw number 2 rather than 4.
  test('a 2x2 square into two dominoes is 2 raw, 1 distinct, |G| = 8', () => {
    const target = rect(2, 2);
    const pieces = [
      [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
      ],
      [
        { row: 1, col: 0 },
        { row: 1, col: 1 },
      ],
    ];
    expect(naiveCount(target, pieces)).toEqual({ raw: 2, distinct: 1, symmetryOrder: 8 });
  });

  // The flip clause: an L-tetromino and its mirror image are the same piece,
  // because a card piece can be turned face down. The two halves of this 2x4
  // are mirror images of each other, and the whole arrangement is one puzzle.
  test('an L-tetromino and its mirror are one piece', () => {
    const target = rect(2, 4);
    const jay = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 1, col: 0 },
    ];
    const ell4 = [
      { row: 0, col: 3 },
      { row: 1, col: 1 },
      { row: 1, col: 2 },
      { row: 1, col: 3 },
    ];
    expect(localCanonical(jay)).toBe(localCanonical(ell4));
    expect(naiveCount(target, [jay, ell4]).distinct).toBe(1);
  });
});

/** Twice the signed area of a closed ring. */
function shoelace(ring: readonly (readonly [number, number])[]): number {
  let total = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [x0, y0] = ring[i]!;
    const [x1, y1] = ring[(i + 1) % ring.length]!;
    total += x0 * y1 - x1 * y0;
  }
  return total / 2;
}

// ---------------------------------------------------------------------------
// An independent solver. Deliberately naive and deliberately duplicated: it
// shares nothing with the engine, so when the two agree the agreement means
// something. Only ever run on small targets, where enumerating everything is
// cheap.
// ---------------------------------------------------------------------------

type LocalMap = (cell: Cell) => Cell;

const LOCAL_GROUP: readonly LocalMap[] = [
  ({ row, col }) => ({ row, col }),
  ({ row, col }) => ({ row: col, col: -row }),
  ({ row, col }) => ({ row: -row, col: -col }),
  ({ row, col }) => ({ row: -col, col: row }),
  ({ row, col }) => ({ row, col: -col }),
  ({ row, col }) => ({ row: col, col: row }),
  ({ row, col }) => ({ row: -row, col }),
  ({ row, col }) => ({ row: -col, col: -row }),
];

const at = ({ row, col }: Cell): string => `${row},${col}`;

function localNormalise(cells: readonly Cell[]): Cell[] {
  const minRow = Math.min(...cells.map((c) => c.row));
  const minCol = Math.min(...cells.map((c) => c.col));
  return cells
    .map(({ row, col }) => ({ row: row - minRow, col: col - minCol }))
    .sort((a, b) => a.row - b.row || a.col - b.col);
}

const localKey = (cells: readonly Cell[]): string => localNormalise(cells).map(at).join(' ');

const localCanonical = (cells: readonly Cell[]): string =>
  LOCAL_GROUP.map((map) => localKey(cells.map(map))).sort()[0]!;

function isConnectedLocally(cells: readonly Cell[]): boolean {
  const left = new Set(cells.map(at));
  const queue = [cells[0]!];
  left.delete(at(cells[0]!));
  while (queue.length > 0) {
    const { row, col } = queue.pop()!;
    for (const next of [
      { row: row + 1, col },
      { row: row - 1, col },
      { row, col: col + 1 },
      { row, col: col - 1 },
    ]) {
      if (left.delete(at(next))) queue.push(next);
    }
  }
  return left.size === 0;
}

interface NaiveResult {
  readonly raw: number;
  readonly distinct: number;
  readonly symmetryOrder: number;
}

/**
 * Every way this piece multiset repacks the target, counted as the spec
 * defines it: pieces may be flipped, congruent pieces are interchangeable, and
 * arrangements related by a symmetry of the target are the same puzzle.
 */
function naiveCount(target: Shape, pieces: readonly Shape[]): NaiveResult {
  const inTarget = new Set(target.map(at));
  const cells = [...target].sort((a, b) => a.row - b.row || a.col - b.col);

  const classes = new Map<string, { shape: Shape; count: number }>();
  for (const piece of pieces) {
    const key = localCanonical(piece);
    const seen = classes.get(key);
    if (seen) seen.count += 1;
    else classes.set(key, { shape: piece, count: 1 });
  }
  const types = [...classes.values()];

  // Placements of each type, as cell lists that lie wholly inside the target.
  const placements = types.map(({ shape }) => {
    const forms = [...new Set(LOCAL_GROUP.map((map) => localKey(shape.map(map))))].map((key) =>
      key.split(' ').map((point) => {
        const [row, col] = point.split(',').map(Number);
        return { row: row!, col: col! };
      }),
    );
    const found: Cell[][] = [];
    const seen = new Set<string>();
    for (const form of forms) {
      for (const anchor of cells) {
        const dr = anchor.row - form[0]!.row;
        const dc = anchor.col - form[0]!.col;
        const placed = form.map(({ row, col }) => ({ row: row + dr, col: col + dc }));
        if (!placed.every((cell) => inTarget.has(at(cell)))) continue;
        const key = placed.map(at).sort().join(' ');
        if (seen.has(key)) continue;
        seen.add(key);
        found.push(placed);
      }
    }
    return found;
  });

  const remaining = types.map(({ count }) => count);
  const covered = new Set<string>();
  const current: Cell[][] = [];
  const partitions: Cell[][][] = [];

  const fill = (): void => {
    const next = cells.find((cell) => !covered.has(at(cell)));
    if (next === undefined) {
      partitions.push(current.map((piece) => [...piece]));
      return;
    }
    placements.forEach((options, type) => {
      if (remaining[type] === 0) return;
      for (const placed of options) {
        if (!placed.some((cell) => at(cell) === at(next))) continue;
        if (placed.some((cell) => covered.has(at(cell)))) continue;
        for (const cell of placed) covered.add(at(cell));
        remaining[type]! -= 1;
        current.push(placed);
        fill();
        current.pop();
        remaining[type]! += 1;
        for (const cell of placed) covered.delete(at(cell));
      }
    });
  };
  fill();

  // Interchangeable pieces: two arrangements that differ only by which
  // identical piece went where are one arrangement.
  const partitionKey = (partition: readonly Cell[][]): string =>
    partition
      .map((piece) => piece.map(at).sort().join(' '))
      .sort()
      .join(' | ');
  const rawKeys = new Set(partitions.map(partitionKey));

  const targetKey = localKey(target);
  const group = LOCAL_GROUP.filter((map) => localKey(target.map(map)) === targetKey);

  const orbits = new Set<string>();
  const byKey = new Map<string, Cell[][]>();
  for (const partition of partitions) byKey.set(partitionKey(partition), partition);
  for (const partition of byKey.values()) {
    const images = group.map((map) => {
      const mapped = target.map(map);
      const minRow = Math.min(...mapped.map((c) => c.row));
      const minCol = Math.min(...mapped.map((c) => c.col));
      return partitionKey(
        partition.map((piece) =>
          piece
            .map(map)
            .map(({ row, col }) => ({ row: row - minRow, col: col - minCol })),
        ),
      );
    });
    orbits.add(images.sort()[0]!);
  }

  return { raw: rawKeys.size, distinct: orbits.size, symmetryOrder: group.length };
}
