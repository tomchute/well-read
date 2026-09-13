// Public surface of the scoring module — see docs/recommendation-design.md
// ("Pure-function API"). All exports are pure plain TypeScript: no Svelte
// imports, no `localStorage`, no internal `Date.now()`/`Math.random()`.

export { applyChip, decay } from './chips';
export { buildPage } from './page';
export type { Rng } from './rng';
export { createSeededRng, defaultRng, jitter } from './rng';
export { pinBoost, recencyPenalty, scoreWork } from './score';
export type {
  ChipAction,
  ManifestEntry,
  Reactions,
  Read,
  ScoringState,
  SeenMap,
  SessionPin,
  Weights,
} from './types';
export { clip } from './weights';
