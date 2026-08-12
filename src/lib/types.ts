/**
 * The shared vocabulary for One Solution. Every module speaks in these terms;
 * the spec (docs/specs/one-solution-tray-edition.md) uses the same words.
 *
 * Nothing here is implementation. These are the contracts the two test seams
 * are defined against.
 */

/** A single square on the integer grid. Row-major, origin top-left. */
export interface Cell {
  readonly row: number;
  readonly col: number;
}

/**
 * A connected set of cells. Used for both the target outline the user draws
 * and each individual puzzle piece.
 */
export type Shape = readonly Cell[];

/** How a piece will be cut, which decides tolerance and tab handling. */
export type Material = 'cardstock' | 'chipboard' | 'laser-ply' | 'acrylic';

/**
 * Everything the URL carries. `buildPuzzle` takes the encoded form of this,
 * so the codec is exercised by every engine test rather than needing a seam
 * of its own.
 */
export interface PuzzleSpec {
  /** The outline to dissect. */
  readonly target: Shape;
  /** How many pieces to cut it into. Engine rejects anything above MAX_PIECES. */
  readonly pieceCount: number;
  /** Makes generation reproducible: the same seed yields the same puzzle. */
  readonly seed: number;
  readonly material: Material;
  /** Millimetres per grid cell on the printed sheet. */
  readonly cellSizeMm: number;
}

/**
 * Why the engine declined to produce a puzzle. Always actionable.
 *
 * The first six are decisions about a puzzle. The last three are decisions
 * about the *link*: seam 1 takes an encoded string straight from the URL bar,
 * so "this is not a puzzle at all" and "this is a newer format than I read" are
 * outcomes it has to be able to state, rather than throw.
 */
export type RejectionReason =
  | 'no-unique-dissection-at-k'
  | 'shape-too-thin'
  | 'shape-too-small'
  | 'shape-disconnected'
  | 'piece-count-out-of-range'
  | 'budget-exhausted'
  /** The state string is damaged, truncated or not a puzzle. */
  | 'malformed-state'
  /** The state string is a format this build does not read. */
  | 'unsupported-version'
  /**
   * The independent re-count disagreed with the search. Never expected: this
   * is the engine catching itself, and it refuses rather than ship a
   * guarantee it could not confirm.
   */
  | 'verification-failed';

export interface Rejection {
  readonly ok: false;
  readonly reason: RejectionReason;
  /** Shown to the user verbatim. Must name the fix, not just the fault. */
  readonly message: string;
  /** Populated for `no-unique-dissection-at-k`: a piece count that did work. */
  readonly suggestedPieceCount?: number;
}

/** What the search had to do to find this puzzle. Shown, not hidden. */
export interface Proof {
  /** Dissections tried and thrown away before this one. */
  readonly attempts: number;
  /** Order of the target's own symmetry group, 1 to 8. */
  readonly symmetryOrder: number;
  /** Raw partitions found. Always `symmetryOrder / distinctOrbits` many. */
  readonly rawSolutions: number;
  /** The claim. Always 1 in an accepted puzzle — asserted, never assumed. */
  readonly distinctSolutions: 1;
  /** Wall-clock milliseconds spent in search, for the on-screen counter. */
  readonly searchMs: number;
}

/** One rejected candidate, kept so the UI can replay the search. */
export interface RejectedCandidate {
  readonly pieces: readonly Shape[];
  readonly distinctSolutions: number;
}

/** Vector output, already laid out in millimetres. Ready to serialise. */
export interface Geometry {
  readonly widthMm: number;
  readonly heightMm: number;
  /** Closed outlines, one per piece, in the same order as `pieces`. */
  readonly pieceOutlines: readonly (readonly [number, number][])[];
  readonly trayOutline: readonly (readonly [number, number][])[];
}

export interface PuzzleDocument {
  readonly ok: true;
  readonly spec: PuzzleSpec;
  readonly pieces: readonly Shape[];
  readonly proof: Proof;
  /** Capped; the UI replays these as the "search working" animation. */
  readonly rejected: readonly RejectedCandidate[];
  readonly geometry: Geometry;
}

export type BuildResult = PuzzleDocument | Rejection;

export type ExportFormat = 'pdf' | 'svg' | 'dxf';
