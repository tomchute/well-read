// Pure, plain-TypeScript persistence engine behind the app's localStorage
// stores. No Svelte runes here on purpose: this module is what
// tests/stores/persisted.spec.ts imports directly, and it must run under
// plain vitest (node environment) with no compiler magic. The runes-based
// reactive wrapper that components use lives in `./index.svelte.ts`.
//
// Key naming: docs/recommendation-design.md defines six versioned
// `wellread:v1:*` keys. `settings` (theme + Kindle email) is intentionally
// kept outside that prefix — see
// docs/work-packages/WP-3.6-kindle-helper-export-import.md ("a new, separate
// localStorage field, not one of the versioned wellread:v1:* scoring keys").
//
// Every read and every write is wrapped in try/catch: a corrupted value,
// a disabled/full/absent localStorage (private browsing, SSR, a test
// runner) must never throw out of this module. A read that fails in any
// way falls back to the documented default; a write that fails is silently
// dropped (the in-memory rune state above it still reflects the change for
// the rest of the session).

import { z } from 'zod';
import {
  DEFAULT_REACTIONS,
  DEFAULT_READ,
  DEFAULT_SAVED,
  DEFAULT_SEEN,
  DEFAULT_SESSION_PINS,
  DEFAULT_SETTINGS,
  DEFAULT_WEIGHTS,
  ReactionsSchema,
  ReadSchema,
  SavedSchema,
  SeenSchema,
  SessionPinsSchema,
  SettingsSchema,
  WeightsSchema,
} from './schema';

/** The subset of the `Storage` DOM interface this module relies on. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** In-memory stand-in used whenever real `localStorage` isn't usable. */
export function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

const fallbackStorage = createMemoryStorage();

/**
 * Resolves the storage backend to use: real `localStorage` when present and
 * writable, an in-memory fallback otherwise (no `window` at all, storage
 * disabled by the browser, quota already exhausted, etc). Probing is
 * itself wrapped in try/catch — some browsers throw merely on *accessing*
 * `window.localStorage` (e.g. cookies fully blocked).
 */
export function resolveStorage(): StorageLike {
  try {
    const candidate = (globalThis as { localStorage?: StorageLike }).localStorage;
    if (!candidate) return fallbackStorage;
    const probeKey = '__wellread_storage_probe__';
    candidate.setItem(probeKey, '1');
    candidate.removeItem(probeKey);
    return candidate;
  } catch {
    return fallbackStorage;
  }
}

/** Prefix for the six versioned scoring keys from docs/recommendation-design.md. */
export const KEY_PREFIX = 'wellread:v1:';

export const STORAGE_KEYS = {
  weights: `${KEY_PREFIX}weights`,
  seen: `${KEY_PREFIX}seen`,
  reactions: `${KEY_PREFIX}reactions`,
  saved: `${KEY_PREFIX}saved`,
  read: `${KEY_PREFIX}read`,
  sessionPins: `${KEY_PREFIX}sessionPins`,
  // Deliberately unversioned / outside the `wellread:v1:*` scoring prefix.
  settings: 'wellread:settings',
} as const;

export type StoreName = keyof typeof STORAGE_KEYS;

/** One persisted slot: a storage key, its zod shape, and its documented default. */
export interface PersistedDef<T> {
  key: string;
  schema: z.ZodType<T>;
  defaultValue: T;
  /** Safe read: corrupted JSON, a failed schema check, or a missing value all fall back to `defaultValue`. */
  read(storage: StorageLike): T;
  /** Safe write: swallows any storage failure (quota, disabled storage, etc). */
  write(storage: StorageLike, value: T): void;
}

function definePersisted<T>(key: string, schema: z.ZodType<T>, defaultValue: T): PersistedDef<T> {
  return {
    key,
    schema,
    defaultValue,
    read(storage) {
      let raw: string | null;
      try {
        raw = storage.getItem(key);
      } catch {
        return structuredClone(defaultValue);
      }
      if (raw === null) return structuredClone(defaultValue);
      try {
        const parsed = JSON.parse(raw);
        const result = schema.safeParse(parsed);
        return result.success ? result.data : structuredClone(defaultValue);
      } catch {
        return structuredClone(defaultValue);
      }
    },
    write(storage, value) {
      try {
        storage.setItem(key, JSON.stringify(value));
      } catch {
        // Storage unavailable, full, or disabled: the caller's in-memory
        // state still holds the value for the rest of the session.
      }
    },
  };
}

export const weightsStore = definePersisted(STORAGE_KEYS.weights, WeightsSchema, DEFAULT_WEIGHTS);
export const seenStore = definePersisted(STORAGE_KEYS.seen, SeenSchema, DEFAULT_SEEN);
export const reactionsStore = definePersisted(
  STORAGE_KEYS.reactions,
  ReactionsSchema,
  DEFAULT_REACTIONS
);
export const savedStore = definePersisted(STORAGE_KEYS.saved, SavedSchema, DEFAULT_SAVED);
export const readStore = definePersisted(STORAGE_KEYS.read, ReadSchema, DEFAULT_READ);
export const sessionPinsStore = definePersisted(
  STORAGE_KEYS.sessionPins,
  SessionPinsSchema,
  DEFAULT_SESSION_PINS
);
export const settingsStore = definePersisted(
  STORAGE_KEYS.settings,
  SettingsSchema,
  DEFAULT_SETTINGS
);

/** Every persisted slot, keyed by the same names used in `ExportedState`. */
export const ALL_STORES = {
  weights: weightsStore,
  seen: seenStore,
  reactions: reactionsStore,
  saved: savedStore,
  read: readStore,
  sessionPins: sessionPinsStore,
  settings: settingsStore,
} as const;

const EXPORT_VERSION = 1;

export const ExportedStateSchema = z.object({
  version: z.literal(EXPORT_VERSION),
  weights: WeightsSchema,
  seen: SeenSchema,
  reactions: ReactionsSchema,
  saved: SavedSchema,
  read: ReadSchema,
  sessionPins: SessionPinsSchema,
  settings: SettingsSchema,
});
export type ExportedState = z.infer<typeof ExportedStateSchema>;

/** Reads every persisted key into one plain object, ready to `JSON.stringify`. */
export function exportState(storage: StorageLike = resolveStorage()): ExportedState {
  return {
    version: EXPORT_VERSION,
    weights: weightsStore.read(storage),
    seen: seenStore.read(storage),
    reactions: reactionsStore.read(storage),
    saved: savedStore.read(storage),
    read: readStore.read(storage),
    sessionPins: sessionPinsStore.read(storage),
    settings: settingsStore.read(storage),
  };
}

export type ImportResult = { ok: true; state: ExportedState } | { ok: false; error: string };

/**
 * Validates `json` (a string or an already-parsed value) against the
 * top-level export shape and, only if it fully validates, writes every key.
 * Nothing is written on failure — a bad import must not partially clobber
 * existing state.
 */
export function importState(storage: StorageLike, json: unknown): ImportResult {
  let candidate: unknown = json;
  if (typeof json === 'string') {
    try {
      candidate = JSON.parse(json);
    } catch {
      return { ok: false, error: 'Invalid JSON' };
    }
  }

  const result = ExportedStateSchema.safeParse(candidate);
  if (!result.success) {
    return { ok: false, error: result.error.message };
  }

  const state = result.data;
  weightsStore.write(storage, state.weights);
  seenStore.write(storage, state.seen);
  reactionsStore.write(storage, state.reactions);
  savedStore.write(storage, state.saved);
  readStore.write(storage, state.read);
  sessionPinsStore.write(storage, state.sessionPins);
  settingsStore.write(storage, state.settings);

  return { ok: true, state };
}

/**
 * Clears every persisted key back to its documented default. Distinct from
 * the scoring layer's "Surprise me" `resetWeights` (WP-3.3), which only
 * touches `weights`/`sessionPins` and leaves history (`seen`, `reactions`,
 * `saved`, `read`) and `settings` untouched.
 */
export function resetAll(storage: StorageLike = resolveStorage()): void {
  weightsStore.write(storage, structuredClone(weightsStore.defaultValue));
  seenStore.write(storage, structuredClone(seenStore.defaultValue));
  reactionsStore.write(storage, structuredClone(reactionsStore.defaultValue));
  savedStore.write(storage, structuredClone(savedStore.defaultValue));
  readStore.write(storage, structuredClone(readStore.defaultValue));
  sessionPinsStore.write(storage, structuredClone(sessionPinsStore.defaultValue));
  settingsStore.write(storage, structuredClone(settingsStore.defaultValue));
}
