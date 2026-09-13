// Shared types for the pure scoring API. Reuses the persisted-state shapes
// from src/lib/stores/schema.ts (WP-3.1) and the manifest index shape from
// src/lib/data/manifest.ts rather than redefining them — see
// docs/recommendation-design.md ("localStorage state shape",
// "Pure-function API").

import type { ManifestEntry } from '$lib/data/manifest';
import type { Reactions, Read, SeenMap, SessionPin, Weights } from '$lib/stores/schema';

export type { ManifestEntry, Reactions, Read, SeenMap, SessionPin, Weights };

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
  | { type: 'more-like-this'; work: ManifestEntry }
  | { type: 'more-about-theme'; theme: string }
  | { type: 'more-form'; form: string }
  | { type: 'less-form'; form: string }
  | { type: 'not-interested'; work: ManifestEntry }
  | { type: 'like'; work: ManifestEntry }
  | { type: 'dislike'; work: ManifestEntry }
  | { type: 'surprise-me' };
