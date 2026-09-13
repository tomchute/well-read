// `scoreWork` and its constituent terms — see docs/recommendation-design.md
// ("Score formula", "Recency penalty", "Jitter"). Pure: no `localStorage`,
// no internal `Date.now()`/`Math.random()`; `now` and `rng` are always
// caller-supplied.

import { defaultRng, jitter, type Rng } from './rng';
import type { ManifestEntry, SeenMap, SessionPin, Weights } from './types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * `pinBoost(work, pins)` from the score formula: each session pin whose
 * theme appears on `work` contributes `strength * max(0, 1 - appliedCount / 5)`
 * — full strength for the pin's first ~5 applications, tapering to 0 by the
 * time `appliedCount` reaches 5 (the pin itself is dropped by the caller
 * once `appliedCount >= 20`; see docs/recommendation-design.md "Chip actions").
 */
export function pinBoost(work: ManifestEntry, pins: SessionPin[]): number {
  let boost = 0;
  for (const pin of pins) {
    if (work.themes.includes(pin.theme)) {
      boost += pin.strength * Math.max(0, 1 - pin.appliedCount / 5);
    }
  }
  return boost;
}

/**
 * `recencyPenalty(work, seen, now)`: 0 if never seen, a flat 8 if seen under
 * 14 days ago, else a fading `(1 / daysSince) * 2`.
 */
export function recencyPenalty(work: ManifestEntry, seen: SeenMap, now: Date): number {
  const seenAt = seen[work.id];
  if (seenAt === undefined) return 0;

  const seenDate = new Date(seenAt);
  const daysSince = (now.getTime() - seenDate.getTime()) / MS_PER_DAY;
  if (daysSince < 14) return 8;
  return (1 / daysSince) * 2;
}

/**
 * `score(work)` from docs/recommendation-design.md ("Score formula"): the
 * sum of theme/form/era/author weights, plus pin boost, minus the recency
 * penalty, plus jitter.
 */
export function scoreWork(
  indexEntry: ManifestEntry,
  weights: Weights,
  seen: SeenMap,
  pins: SessionPin[],
  now: Date,
  rng: Rng = defaultRng
): number {
  let total = 0;
  for (const theme of indexEntry.themes) {
    total += weights.theme[theme] ?? 0;
  }
  total += weights.form[indexEntry.form] ?? 0;
  total += weights.era[indexEntry.era] ?? 0;
  total += weights.author[indexEntry.author] ?? 0;
  total += pinBoost(indexEntry, pins);
  total -= recencyPenalty(indexEntry, seen, now);
  total += jitter(rng);
  return total;
}
