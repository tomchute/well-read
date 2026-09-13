// Weight-record helpers: clipping and immutable per-key updates shared by
// `applyChip` and `decay`. See docs/recommendation-design.md
// ("Normalisation"): every weight value is clipped to [-10, 10] after each
// mutation, and decay snaps near-zero magnitudes to exactly 0.

import type { Weights } from './types';

const WEIGHT_MIN = -10;
const WEIGHT_MAX = 10;

/** Clips `value` to `[min, max]`. */
export function clip(value: number, min: number = WEIGHT_MIN, max: number = WEIGHT_MAX): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Returns a new record with `record[key]` (defaulting missing entries to 0)
 * increased by `delta`, clipped to `[floor, ceiling]`. Never mutates `record`.
 */
export function withDelta(
  record: Record<string, number>,
  key: string,
  delta: number,
  floor: number = WEIGHT_MIN,
  ceiling: number = WEIGHT_MAX
): Record<string, number> {
  const current = record[key] ?? 0;
  return { ...record, [key]: clip(current + delta, floor, ceiling) };
}

/** Returns a new `Weights` with `theme[theme]` adjusted by `delta`. */
export function withThemeDelta(weights: Weights, theme: string, delta: number): Weights {
  return { ...weights, theme: withDelta(weights.theme, theme, delta) };
}

/** Returns a new `Weights` with `form[form]` adjusted by `delta`, clipped to `[floor, 10]`. */
export function withFormDelta(
  weights: Weights,
  form: string,
  delta: number,
  floor: number = WEIGHT_MIN
): Weights {
  return { ...weights, form: withDelta(weights.form, form, delta, floor) };
}

/** Returns a new `Weights` with `author[author]` adjusted by `delta`. */
export function withAuthorDelta(weights: Weights, author: string, delta: number): Weights {
  return { ...weights, author: withDelta(weights.author, author, delta) };
}
