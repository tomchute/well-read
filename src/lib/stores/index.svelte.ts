// Svelte 5 runes wrapper around the plain-TS persistence engine in
// `./persisted.ts`. Kept deliberately thin: all parsing/validation/defaulting
// logic lives in `persisted.ts` (and is unit-tested there under plain
// vitest); this file only adds reactivity so components can read/write these
// stores like normal `$state`.
//
// Not imported by tests/stores/persisted.spec.ts — Svelte runes need the
// component-compiler pipeline vitest doesn't run for plain `.ts` specs. See
// docs/work-packages/WP-3.1-persisted-stores.md.

import {
  ALL_STORES,
  type ExportedState,
  exportState as exportStateFrom,
  type ImportResult,
  importState as importStateFrom,
  type PersistedDef,
  resetAll as resetAllFrom,
  resolveStorage,
  type StorageLike,
} from './persisted';
import type { Reactions, Read, Saved, SeenMap, SessionPins, Settings, Weights } from './schema';

const storage: StorageLike = resolveStorage();

/** A reactive, persisted value: reading `.value` tracks it; `.set`/`.update` persist the change. */
export interface PersistedRune<T> {
  readonly value: T;
  set(next: T): void;
  update(fn: (current: T) => T): void;
}

function createRune<T>(def: PersistedDef<T>): PersistedRune<T> {
  let current = $state(def.read(storage));
  return {
    get value() {
      return current;
    },
    set(next: T) {
      current = next;
      def.write(storage, next);
    },
    update(fn: (current: T) => T) {
      const next = fn(current);
      current = next;
      def.write(storage, next);
    },
  };
}

export const weights: PersistedRune<Weights> = createRune(ALL_STORES.weights);
export const seen: PersistedRune<SeenMap> = createRune(ALL_STORES.seen);
export const reactions: PersistedRune<Reactions> = createRune(ALL_STORES.reactions);
export const saved: PersistedRune<Saved> = createRune(ALL_STORES.saved);
export const read: PersistedRune<Read> = createRune(ALL_STORES.read);
export const sessionPins: PersistedRune<SessionPins> = createRune(ALL_STORES.sessionPins);
export const settings: PersistedRune<Settings> = createRune(ALL_STORES.settings);

const RUNES = { weights, seen, reactions, saved, read, sessionPins, settings } as const;

/** Reads every persisted key into one plain object, ready to `JSON.stringify`. */
export function exportAppState(): ExportedState {
  return exportStateFrom(storage);
}

/** Validates and, only on success, writes every key and refreshes the reactive runes above. */
export function importAppState(json: unknown): ImportResult {
  const result = importStateFrom(storage, json);
  if (result.ok) {
    weights.set(result.state.weights);
    seen.set(result.state.seen);
    reactions.set(result.state.reactions);
    saved.set(result.state.saved);
    read.set(result.state.read);
    sessionPins.set(result.state.sessionPins);
    settings.set(result.state.settings);
  }
  return result;
}

/** Clears every persisted key back to its documented default, in storage and in the runes above. */
export function resetAllState(): void {
  resetAllFrom(storage);
  for (const key of Object.keys(RUNES) as (keyof typeof RUNES)[]) {
    // biome-ignore lint/suspicious/noExplicitAny: each rune's default matches its own value type
    (RUNES[key] as PersistedRune<any>).set(ALL_STORES[key].defaultValue);
  }
}
