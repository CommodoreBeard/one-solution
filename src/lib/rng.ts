/**
 * A small seeded generator, so a puzzle is reproducible from its URL.
 *
 * `Math.random` cannot be used anywhere in the engine: the spec promises that
 * the same encoded state yields the identical puzzle, and that promise is only
 * as good as the randomness being replayable. mulberry32 is four lines, has no
 * dependencies and passes gjrand's smallcrush, which is far more than this
 * needs — it only has to be stable.
 */

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform integer in [0, bound). */
  int(bound: number): number;
  /** Uniform element of a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** A fresh Fisher-Yates shuffle; leaves the input untouched. */
  shuffled<T>(items: readonly T[]): T[];
}

export function makeRng(seed: number): Rng {
  // Keep the state in an unsigned 32-bit lane so behaviour is identical
  // wherever this runs.
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (bound: number): number => Math.floor(next() * bound);

  return {
    next,
    int,
    pick: <T>(items: readonly T[]): T => items[int(items.length)]!,
    shuffled: <T>(items: readonly T[]): T[] => {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = int(i + 1);
        const swap = out[i]!;
        out[i] = out[j]!;
        out[j] = swap;
      }
      return out;
    },
  };
}
