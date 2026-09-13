// Seeded, deterministic PRNG used by the scoring layer for jitter and page
// tie-breaking. Never `Math.random()` — see docs/recommendation-design.md
// ("Jitter") and WP-3.2's acceptance criterion that src/lib/scoring never
// calls `Date.now()`/`Math.random()` internally. The stores layer (WP-3.1+)
// is expected to seed a real RNG (e.g. from `Math.random()`) and pass it in;
// callers that omit `rng` get this module's fixed-seed default instead, so
// scoring stays pure and fully deterministic without a caller-supplied seed.

/** A `Math.random`-shaped generator: returns a float in `[0, 1)`. */
export type Rng = () => number;

/**
 * Creates a small, fast mulberry32 PRNG seeded with `seed`. Deterministic:
 * the same seed always produces the same sequence, which is what makes the
 * "determinism with a seed" vitest case possible.
 */
export function createSeededRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fixed-seed default RNG used when a caller doesn't supply its own. */
export const defaultRng: Rng = createSeededRng(0xc0ffee);

/** Uniform jitter in `[-0.5, 0.5)`, per the score formula's `jitter()` term. */
export function jitter(rng: Rng): number {
  return rng() - 0.5;
}
