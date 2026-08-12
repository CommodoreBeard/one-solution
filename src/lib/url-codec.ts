/**
 * The URL codec: a `PuzzleSpec` to and from the string that lives in the
 * fragment.
 *
 * Three commitments from the spec shape the format:
 *
 * 1. **Versioned from the first commit.** A link made this year must still open
 *    in five, so the version is the first thing in the string and the first
 *    thing read. An unknown version is refused by name rather than misparsed:
 *    a v2 reader can then still recognise a v1 link, and a v1 reader tells the
 *    user honestly that the link is newer than the page.
 * 2. **Compressed, with no dependencies.** The target is a set of cells inside
 *    its own bounding box, which is exactly a bitmask — one bit per grid
 *    square rather than a pair of numbers per cell. A 200-cell blob costs
 *    about 40 bytes of payload. `CompressionStream` would be the obvious
 *    alternative and is the wrong tool: it is async, and seam 1 is
 *    synchronous.
 * 3. **Never throws on input.** Anything malformed, truncated, corrupted or
 *    from an unknown version comes back as a typed `Rejection`. The string
 *    arrives from a URL bar, so it is hostile by default.
 *
 * The encode direction is public because the editor (issue 6) has to write the
 * fragment, and because a test that builds a state with it is still only
 * touching seam 1.
 *
 * ## v1 layout
 *
 * `1.` followed by base64url (no padding) of, big-endian throughout:
 *
 * ```
 *   0      u8    piece count
 *   1      u8    material, an index into MATERIALS
 *   2..3   u16   cell size in tenths of a millimetre
 *   4..7   u32   seed
 *   8..9   u16   bounding-box width in cells
 *   10..11 u16   bounding-box height in cells
 *   12..   bits  one bit per bounding-box square, row-major, MSB first
 *   last 2 u16   FNV-1a checksum of every preceding byte
 * ```
 *
 * The payload length is fully determined by the width and height, so a
 * truncated string fails the length check before the checksum ever runs; the
 * checksum is there for the corrupted-but-plausible case.
 *
 * Only the shape of the target is carried, not where it was drawn: cells are
 * stored relative to their own bounding box and come back at the origin. Where
 * an outline sits on an infinite grid means nothing to the puzzle, and dropping
 * it means two users who drew the same shape in different places share a link.
 */

import type { Cell, Material, PuzzleSpec, Rejection, Shape } from './types';

/** The version this build writes. Read the doc comment before changing it. */
export const STATE_VERSION = 1;

/**
 * Material codes, positional and frozen. Appending is safe; reordering or
 * removing breaks every link ever made, and needs a new version instead.
 */
const MATERIALS: readonly Material[] = [
  'cardstock',
  'chipboard',
  'laser-ply',
  'acrylic',
];

const HEADER_BYTES = 12;
const CHECKSUM_BYTES = 2;

/**
 * Largest bounding box a v1 state may describe, in squares. Well beyond any
 * drawable target, and it bounds the work a hostile string can ask for before
 * a single byte is trusted.
 */
const MAX_GRID_SQUARES = 1 << 16;

const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** Reverse table for base64url. `-1` marks a character that is not in it. */
const BASE64URL_VALUES = ((): Int8Array => {
  const values = new Int8Array(128).fill(-1);
  for (let i = 0; i < BASE64URL.length; i += 1) values[BASE64URL.charCodeAt(i)] = i;
  return values;
})();

function toBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += BASE64URL[a >> 2];
    out += BASE64URL[((a & 0b11) << 4) | ((b ?? 0) >> 4)];
    if (b === undefined) break;
    out += BASE64URL[((b & 0b1111) << 2) | ((c ?? 0) >> 6)];
    if (c === undefined) break;
    out += BASE64URL[c & 0b111111];
  }
  return out;
}

/** `null` for any character outside the alphabet, or an impossible length. */
function fromBase64Url(text: string): Uint8Array | null {
  // A single leftover character cannot encode any whole byte.
  if (text.length % 4 === 1) return null;

  const bytes = new Uint8Array((text.length * 3) >> 2);
  let at = 0;
  let bits = 0;
  let width = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    const value = code < 128 ? BASE64URL_VALUES[code]! : -1;
    if (value < 0) return null;
    bits = (bits << 6) | value;
    width += 6;
    if (width >= 8) {
      width -= 8;
      bytes[at] = (bits >> width) & 0xff;
      at += 1;
    }
  }
  return bytes;
}

/** FNV-1a, truncated to 16 bits. Detects corruption, not tampering. */
function checksum(bytes: Uint8Array, upto: number): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < upto; i += 1) {
    hash = Math.imul(hash ^ bytes[i]!, 0x01000193) >>> 0;
  }
  return hash & 0xffff;
}

function malformed(message: string): Rejection {
  return { ok: false, reason: 'malformed-state', message };
}

interface Bounds {
  readonly minRow: number;
  readonly minCol: number;
  readonly width: number;
  readonly height: number;
}

function boundsOf(target: Shape): Bounds {
  if (target.length === 0) return { minRow: 0, minCol: 0, width: 0, height: 0 };
  let minRow = Infinity;
  let minCol = Infinity;
  let maxRow = -Infinity;
  let maxCol = -Infinity;
  for (const { row, col } of target) {
    if (row < minRow) minRow = row;
    if (col < minCol) minCol = col;
    if (row > maxRow) maxRow = row;
    if (col > maxCol) maxCol = col;
  }
  return {
    minRow,
    minCol,
    width: maxCol - minCol + 1,
    height: maxRow - minRow + 1,
  };
}

/**
 * A `PuzzleSpec` as a fragment string.
 *
 * Deliberately permissive about the *puzzle*: a piece count of nine, a
 * three-cell outline and a letter stroke all encode cleanly, because refusing
 * them is the engine's job and its refusals name the fix. It throws only when a
 * field cannot be represented at all, which is a programming error rather than
 * a user one.
 */
export function encodeState(spec: PuzzleSpec): string {
  const { target, pieceCount, seed, material, cellSizeMm } = spec;

  if (!Number.isInteger(pieceCount) || pieceCount < 0 || pieceCount > 0xff) {
    throw new RangeError(`piece count ${pieceCount} does not fit the state format`);
  }
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError(`seed ${seed} does not fit the state format`);
  }
  const materialCode = MATERIALS.indexOf(material);
  if (materialCode < 0) throw new RangeError(`unknown material ${material}`);

  // Tenths of a millimetre: finer than any cutter's tolerance, and it keeps the
  // field two bytes wide.
  const sizeTenths = Math.round(cellSizeMm * 10);
  if (!Number.isFinite(sizeTenths) || sizeTenths < 1 || sizeTenths > 0xffff) {
    throw new RangeError(`cell size ${cellSizeMm}mm does not fit the state format`);
  }

  for (const { row, col } of target) {
    if (!Number.isInteger(row) || !Number.isInteger(col)) {
      throw new RangeError(`cell ${row},${col} is not on the integer grid`);
    }
  }

  const { minRow, minCol, width, height } = boundsOf(target);
  if (width > 0xffff || height > 0xffff || width * height > MAX_GRID_SQUARES) {
    throw new RangeError(`a ${width}x${height} outline does not fit the state format`);
  }

  const maskBytes = Math.ceil((width * height) / 8);
  const bytes = new Uint8Array(HEADER_BYTES + maskBytes + CHECKSUM_BYTES);
  const view = new DataView(bytes.buffer);
  view.setUint8(0, pieceCount);
  view.setUint8(1, materialCode);
  view.setUint16(2, sizeTenths);
  view.setUint32(4, seed);
  view.setUint16(8, width);
  view.setUint16(10, height);

  for (const { row, col } of target) {
    const bit = (row - minRow) * width + (col - minCol);
    bytes[HEADER_BYTES + (bit >> 3)]! |= 0x80 >> (bit & 7);
  }

  view.setUint16(HEADER_BYTES + maskBytes, checksum(bytes, HEADER_BYTES + maskBytes));
  return `${STATE_VERSION}.${toBase64Url(bytes)}`;
}

/**
 * A fragment string back to a `PuzzleSpec`, or a typed rejection.
 *
 * The returned target is sorted row-major with its bounding box at the origin,
 * so the same shape always decodes to the same array whatever the caller
 * originally handed to `encodeState`.
 */
export function decodeState(encoded: string): PuzzleSpec | Rejection {
  // Tolerate the separator the URL itself uses, so a whole `#state` works.
  const text = encoded.startsWith('#') ? encoded.slice(1) : encoded;

  const dot = text.indexOf('.');
  if (dot < 1) {
    return malformed(
      'This link is not a puzzle — it is missing its version marker. Check ' +
        'the whole address was copied, or start a new puzzle.',
    );
  }

  const versionText = text.slice(0, dot);
  if (!/^\d{1,3}$/.test(versionText)) {
    return malformed(
      'This link is not a puzzle — its version marker is not a number. Check ' +
        'the whole address was copied, or start a new puzzle.',
    );
  }

  const version = Number(versionText);
  if (version !== STATE_VERSION) {
    return {
      ok: false,
      reason: 'unsupported-version',
      message:
        `This link is in puzzle format ${version} and this page reads format ` +
        `${STATE_VERSION}. Reload the page to pick up the newer version, or ` +
        'ask whoever sent it for a fresh link.',
    };
  }

  const bytes = fromBase64Url(text.slice(dot + 1));
  if (bytes === null) {
    return malformed(
      'This link is damaged — it contains characters that are not part of a ' +
        'puzzle. Check the whole address was copied, or start a new puzzle.',
    );
  }
  if (bytes.length < HEADER_BYTES + CHECKSUM_BYTES) {
    return malformed(
      'This link is cut short — the puzzle it describes is incomplete. Check ' +
        'the whole address was copied, or start a new puzzle.',
    );
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint16(8);
  const height = view.getUint16(10);
  if (width * height > MAX_GRID_SQUARES) {
    return malformed(
      'This link describes an outline far larger than a puzzle sheet. Start a ' +
        'new puzzle.',
    );
  }

  const maskBytes = Math.ceil((width * height) / 8);
  // The payload length is a function of the width and height, so this catches
  // every truncation before the checksum is even consulted. base64url without
  // padding decodes to a whole number of bytes, so exact equality is right.
  if (bytes.length !== HEADER_BYTES + maskBytes + CHECKSUM_BYTES) {
    return malformed(
      'This link is the wrong length for the puzzle it describes. Check the ' +
        'whole address was copied, or start a new puzzle.',
    );
  }

  if (view.getUint16(HEADER_BYTES + maskBytes) !== checksum(bytes, HEADER_BYTES + maskBytes)) {
    return malformed(
      'This link is damaged — its contents do not match its checksum. Check ' +
        'the whole address was copied, or start a new puzzle.',
    );
  }

  const material = MATERIALS[view.getUint8(1)];
  if (material === undefined) {
    return malformed(
      'This link names a material this page does not know. Start a new puzzle ' +
        'and pick a material.',
    );
  }

  const sizeTenths = view.getUint16(2);
  if (sizeTenths === 0) {
    return malformed(
      'This link has no cell size, so nothing could be printed to scale. ' +
        'Start a new puzzle.',
    );
  }

  const target: Cell[] = [];
  for (let bit = 0; bit < width * height; bit += 1) {
    if ((bytes[HEADER_BYTES + (bit >> 3)]! & (0x80 >> (bit & 7))) !== 0) {
      target.push({ row: Math.floor(bit / width), col: bit % width });
    }
  }

  return {
    target,
    pieceCount: view.getUint8(0),
    seed: view.getUint32(4),
    material,
    cellSizeMm: sizeTenths / 10,
  };
}
