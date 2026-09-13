// Shared types for the pure scoring API. Reuses the persisted-state shapes
// from src/lib/stores/schema.ts (WP-3.1) and the manifest index shape from
// src/lib/data/manifest.ts rather than redefining them — see
// docs/recommendation-design.md ("localStorage state shape",
// "Pure-function API").

import type { ManifestEntry } from '$lib/data/manifest';
import type { Reactions, Read, SeenMap, SessionPin, Weights } from '$lib/stores/schema';

export type { ManifestEntry, Reactions, Read, SeenMap, SessionPin, Weights };

/**
 * The subset of `ManifestEntry` the per-work chip actions actually read
 * (`applyMoreLikeThis`/`applyNotInterested`/`applyLessLikeThis` in
 * `./chips.ts`). Any full `ManifestEntry` satisfies this structurally, but a
 * full `Work` record (src/lib/types/work.ts) also does — it carries every
 * field `ManifestEntry` does except the manifest-only `shard` number, which
 * these actions never touch. Narrowing `ChipAction['work']` to this shape
 * lets `src/lib/actions.ts` pass either a feed `ManifestEntry` or a loaded
 * `Work` (Work.svelte) without a manifest-only field getting in the way.
 */
export type ChipWork = Pick<ManifestEntry, 'id' | 'type' | 'author' | 'themes'>;

/**
 * The bundle of persisted state the scoring functions need, as described in
 * docs/recommendation-design.md ("Pure-function API"): "ScoringState bundles
 * `{ weights, seen, reactions, sessionPins, read }`". `saved` is deliberately
 * excluded — it never affects scoring or page building.
 */
export interface ScoringState {
  weights: Weights;
  seen: SeenMap;
  reactions: Reactions;
  sessionPins: SessionPin[];
  read: Read;
}

/**
 * Chip actions from docs/recommendation-design.md ("Chip actions"), plus
 * `surprise-me` (the "Surprise me" reset) so callers have one pure entry
 * point for every steering interaction in the design.
 *
 * `more-form`/`less-form`'s `form` field holds a coarse `WorkType` value
 * (`"poem" | "short_story" | "book" | "essay" | "play"`), not the free-text
 * `Work.form` sub-genre field — `weights.form` is keyed by `WorkType` even
 * though the persisted key stays named `form`. See
 * docs/recommendation-design.md ("Score formula", "Chip actions").
 */
export type ChipAction =
  | { type: 'more-like-this'; work: ChipWork }
  | { type: 'more-about-theme'; theme: string }
  | { type: 'more-form'; form: string }
  | { type: 'less-form'; form: string }
  | { type: 'not-interested'; work: ChipWork }
  | { type: 'like'; work: ChipWork }
  | { type: 'dislike'; work: ChipWork }
  | { type: 'surprise-me' };
