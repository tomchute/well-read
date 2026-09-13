// Shared store-mutation logic for the reader actions that both Feed.svelte
// and Work.svelte expose: like, dislike, save, "more like this", mark-as-read,
// and first-seen tracking. Kept out of both components so neither duplicates
// the scoring/persistence wiring — see the integration step in CLAUDE.md and
// docs/recommendation-design.md ("Chip actions", "localStorage state shape").
//
// Deliberately Svelte-free: every function here takes a small `ValueStore<T>`
// (the same `{ value, set }` shape `PersistedRune<T>` in
// `stores/index.svelte.ts` already exposes) rather than importing the rune
// module directly, so this file needs no Svelte compiler and runs under
// plain vitest (tests/actions.spec.ts) with test doubles backed by
// `createMemoryStorage()` from `stores/persisted.ts`.

import { applyChip, type ChipWork, type ScoringState } from './scoring';
import type { Reactions, Read, Saved, SeenMap, Weights } from './stores/schema';

/** The minimal read/write surface these actions need from a persisted rune. */
export interface ValueStore<T> {
  readonly value: T;
  set(next: T): void;
}

/**
 * Builds a full `ScoringState` for `applyChip`, filling in the fields the
 * `like`/`dislike`/`more-like-this` cases never read (`seen`, `sessionPins`,
 * `read`) with empty placeholders — `applyChip` passes those through
 * unchanged (see `src/lib/scoring/chips.ts`), so their exact value here
 * never matters.
 */
function chipState(weights: Weights, reactions: Reactions): ScoringState {
  return { weights, seen: {}, reactions, sessionPins: [], read: [] };
}

/** Explicit like (♥): sets `reactions[id] = 1` and applies the "more like this" deltas. */
export function likeWork(
  stores: { weights: ValueStore<Weights>; reactions: ValueStore<Reactions> },
  work: ChipWork
): void {
  const next = applyChip(chipState(stores.weights.value, stores.reactions.value), {
    type: 'like',
    work,
  });
  stores.weights.set(next.weights);
  stores.reactions.set(next.reactions);
}

/** Explicit dislike: sets `reactions[id] = -1` and applies the "less like this" deltas. */
export function dislikeWork(
  stores: { weights: ValueStore<Weights>; reactions: ValueStore<Reactions> },
  work: ChipWork
): void {
  const next = applyChip(chipState(stores.weights.value, stores.reactions.value), {
    type: 'dislike',
    work,
  });
  stores.weights.set(next.weights);
  stores.reactions.set(next.reactions);
}

/** "More like this": applies the theme/form/author deltas without touching `reactions`. */
export function moreLikeThis(stores: { weights: ValueStore<Weights> }, work: ChipWork): void {
  const next = applyChip(chipState(stores.weights.value, {}), { type: 'more-like-this', work });
  stores.weights.set(next.weights);
}

/** Toggles `id` in the saved list, prepending new saves (docs: "ordered, most-recent-first"). */
export function toggleSaved(store: ValueStore<Saved>, id: string): void {
  const current = store.value;
  store.set(
    current.includes(id) ? current.filter((existing) => existing !== id) : [id, ...current]
  );
}

/** Whether `id` is currently saved — a plain read, kept here so callers don't repeat `.includes`. */
export function isSaved(saved: Saved, id: string): boolean {
  return saved.includes(id);
}

/** Whether `id` carries an explicit like (`reactions[id] === 1`). */
export function isLiked(reactions: Reactions, id: string): boolean {
  return reactions[id] === 1;
}

/** Toggles `id` in the read list — the mutation behind Work.svelte's "Mark as read" button. */
export function toggleRead(store: ValueStore<Read>, id: string): void {
  const current = store.value;
  store.set(
    current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id]
  );
}

/**
 * Records `id`'s first-seen timestamp, once. A no-op if `id` is already in
 * `seen` — per docs/recommendation-design.md, `seen` is "written the first
 * time a card is rendered in the feed", not refreshed on every later view.
 */
export function markSeen(store: ValueStore<SeenMap>, id: string, now: Date = new Date()): void {
  if (store.value[id]) return;
  store.set({ ...store.value, [id]: now.toISOString() });
}
