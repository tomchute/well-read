import { beforeEach, describe, expect, it } from 'vitest';
import {
  ALL_STORES,
  createMemoryStorage,
  exportState,
  importState,
  reactionsStore,
  readStore,
  resetAll,
  resolveStorage,
  STORAGE_KEYS,
  type StorageLike,
  savedStore,
  seenStore,
  sessionPinsStore,
  settingsStore,
  weightsStore,
} from '../src/lib/stores/persisted';
import {
  DEFAULT_REACTIONS,
  DEFAULT_READ,
  DEFAULT_SAVED,
  DEFAULT_SEEN,
  DEFAULT_SESSION_PINS,
  DEFAULT_SETTINGS,
  DEFAULT_WEIGHTS,
} from '../src/lib/stores/schema';

/** A storage stub whose every method throws, simulating disabled/blocked storage. */
function createThrowingStorage(): StorageLike {
  return {
    getItem: () => {
      throw new Error('storage disabled');
    },
    setItem: () => {
      throw new Error('storage disabled');
    },
    removeItem: () => {
      throw new Error('storage disabled');
    },
  };
}

describe('versioned key names', () => {
  it('uses the exact wellread:v1:* keys from docs/recommendation-design.md', () => {
    expect(STORAGE_KEYS.weights).toBe('wellread:v1:weights');
    expect(STORAGE_KEYS.seen).toBe('wellread:v1:seen');
    expect(STORAGE_KEYS.reactions).toBe('wellread:v1:reactions');
    expect(STORAGE_KEYS.saved).toBe('wellread:v1:saved');
    expect(STORAGE_KEYS.read).toBe('wellread:v1:read');
    expect(STORAGE_KEYS.sessionPins).toBe('wellread:v1:sessionPins');
  });

  it('keeps settings out of the versioned scoring-key prefix', () => {
    expect(STORAGE_KEYS.settings).toBe('wellread:settings');
    expect(STORAGE_KEYS.settings.startsWith('wellread:v1:')).toBe(false);
  });

  it('writes each store under its own literal key in the backing storage', () => {
    const storage = createMemoryStorage();
    weightsStore.write(storage, { theme: { grief: 2 }, form: {}, era: {}, author: {} });
    expect(storage.getItem('wellread:v1:weights')).not.toBeNull();
    expect(JSON.parse(storage.getItem('wellread:v1:weights') as string)).toEqual({
      theme: { grief: 2 },
      form: {},
      era: {},
      author: {},
    });
  });
});

describe('default fallback', () => {
  it('returns the documented default when a key is missing', () => {
    const storage = createMemoryStorage();
    expect(weightsStore.read(storage)).toEqual(DEFAULT_WEIGHTS);
    expect(seenStore.read(storage)).toEqual(DEFAULT_SEEN);
    expect(reactionsStore.read(storage)).toEqual(DEFAULT_REACTIONS);
    expect(savedStore.read(storage)).toEqual(DEFAULT_SAVED);
    expect(readStore.read(storage)).toEqual(DEFAULT_READ);
    expect(sessionPinsStore.read(storage)).toEqual(DEFAULT_SESSION_PINS);
    expect(settingsStore.read(storage)).toEqual(DEFAULT_SETTINGS);
  });

  it('falls back to the default on corrupted (non-JSON) stored text', () => {
    const storage = createMemoryStorage();
    storage.setItem(STORAGE_KEYS.weights, '{not valid json');
    expect(weightsStore.read(storage)).toEqual(DEFAULT_WEIGHTS);
  });

  it('falls back to the default when stored JSON does not match the schema', () => {
    const storage = createMemoryStorage();
    // Valid JSON, wrong shape (reactions must be 1 | -1).
    storage.setItem(STORAGE_KEYS.reactions, JSON.stringify({ 'some-work': 99 }));
    expect(reactionsStore.read(storage)).toEqual(DEFAULT_REACTIONS);

    storage.setItem(STORAGE_KEYS.saved, JSON.stringify({ not: 'an array' }));
    expect(savedStore.read(storage)).toEqual(DEFAULT_SAVED);
  });

  it('falls back to the default when the storage backend throws on read', () => {
    const storage = createThrowingStorage();
    expect(weightsStore.read(storage)).toEqual(DEFAULT_WEIGHTS);
    expect(sessionPinsStore.read(storage)).toEqual(DEFAULT_SESSION_PINS);
  });

  it('swallows a storage failure on write without throwing', () => {
    const storage = createThrowingStorage();
    expect(() => weightsStore.write(storage, DEFAULT_WEIGHTS)).not.toThrow();
    expect(() => savedStore.write(storage, ['some-work'])).not.toThrow();
  });
});

describe('JSON round-trip for each of the six documented keys plus settings', () => {
  let storage: StorageLike;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it('weights', () => {
    const value = { theme: { grief: 2, nature: -1 }, form: { poem: 1 }, era: {}, author: {} };
    weightsStore.write(storage, value);
    expect(weightsStore.read(storage)).toEqual(value);
  });

  it('seen', () => {
    const value = { 'dickinson-because-i-could-not-stop-for-death-1863': '2026-09-01' };
    seenStore.write(storage, value);
    expect(seenStore.read(storage)).toEqual(value);
  });

  it('reactions', () => {
    const value = { 'work-a': 1 as const, 'work-b': -1 as const };
    reactionsStore.write(storage, value);
    expect(reactionsStore.read(storage)).toEqual(value);
  });

  it('saved (ordered, most-recent-first)', () => {
    const value = ['work-c', 'work-b', 'work-a'];
    savedStore.write(storage, value);
    expect(savedStore.read(storage)).toEqual(value);
  });

  it('read', () => {
    const value = ['work-a', 'work-d'];
    readStore.write(storage, value);
    expect(readStore.read(storage)).toEqual(value);
  });

  it('sessionPins', () => {
    const value = [{ theme: 'grief', strength: 3, appliedCount: 0 }];
    sessionPinsStore.write(storage, value);
    expect(sessionPinsStore.read(storage)).toEqual(value);
  });

  it('settings', () => {
    const value = { theme: 'dark' as const, kindleEmail: 'reader@example.com' };
    settingsStore.write(storage, value);
    expect(settingsStore.read(storage)).toEqual(value);
  });
});

describe('resolveStorage fallback', () => {
  it('returns a usable in-memory storage when no global localStorage exists', () => {
    // vitest runs this suite under the node environment (no `window`), so
    // resolveStorage() is already exercising the no-localStorage branch.
    expect(globalThis.localStorage).toBeUndefined();
    const storage = resolveStorage();
    storage.setItem('probe', 'value');
    expect(storage.getItem('probe')).toBe('value');
  });

  it('falls back to memory storage when the global localStorage throws on probe', () => {
    const original = (globalThis as { localStorage?: unknown }).localStorage;
    (globalThis as { localStorage?: unknown }).localStorage = createThrowingStorage();
    try {
      const storage = resolveStorage();
      // Must not throw, and must be a working (memory) storage.
      expect(() => storage.setItem('a', '1')).not.toThrow();
      expect(storage.getItem('a')).toBe('1');
    } finally {
      (globalThis as { localStorage?: unknown }).localStorage = original;
    }
  });
});

describe('exportState / importState', () => {
  it('exports all seven keys under version 1', () => {
    const storage = createMemoryStorage();
    weightsStore.write(storage, { theme: { grief: 4 }, form: {}, era: {}, author: {} });
    savedStore.write(storage, ['work-a']);

    const exported = exportState(storage);
    expect(exported.version).toBe(1);
    expect(exported.weights).toEqual({ theme: { grief: 4 }, form: {}, era: {}, author: {} });
    expect(exported.saved).toEqual(['work-a']);
    // Untouched keys still come back as their documented defaults.
    expect(exported.seen).toEqual(DEFAULT_SEEN);
    expect(exported.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips export -> JSON string -> import into a fresh storage', () => {
    const source = createMemoryStorage();
    weightsStore.write(source, { theme: { grief: 4 }, form: { poem: 1 }, era: {}, author: {} });
    seenStore.write(source, { 'work-a': '2026-08-01' });
    reactionsStore.write(source, { 'work-a': 1 });
    savedStore.write(source, ['work-a']);
    readStore.write(source, ['work-a']);
    sessionPinsStore.write(source, [{ theme: 'grief', strength: 3, appliedCount: 1 }]);
    settingsStore.write(source, { theme: 'dark', kindleEmail: 'reader@example.com' });

    const json = JSON.stringify(exportState(source));

    const dest = createMemoryStorage();
    const result = importState(dest, json);

    expect(result.ok).toBe(true);
    expect(exportState(dest)).toEqual(exportState(source));
  });

  it('rejects an import whose top-level shape is invalid and writes nothing', () => {
    const storage = createMemoryStorage();
    savedStore.write(storage, ['keep-me']);

    const result = importState(storage, { version: 1, weights: 'not-an-object' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(0);
    }
    // Nothing was clobbered by the failed import.
    expect(savedStore.read(storage)).toEqual(['keep-me']);
  });

  it('rejects malformed JSON text without throwing', () => {
    const storage = createMemoryStorage();
    const result = importState(storage, '{not valid json');
    expect(result.ok).toBe(false);
  });
});

describe('resetAll', () => {
  it('clears every persisted key back to its documented default', () => {
    const storage = createMemoryStorage();
    weightsStore.write(storage, { theme: { grief: 5 }, form: {}, era: {}, author: {} });
    seenStore.write(storage, { 'work-a': '2026-08-01' });
    reactionsStore.write(storage, { 'work-a': 1 });
    savedStore.write(storage, ['work-a']);
    readStore.write(storage, ['work-a']);
    sessionPinsStore.write(storage, [{ theme: 'grief', strength: 3, appliedCount: 1 }]);
    settingsStore.write(storage, { theme: 'dark', kindleEmail: 'reader@example.com' });

    resetAll(storage);

    for (const store of Object.values(ALL_STORES)) {
      expect(store.read(storage)).toEqual(store.defaultValue);
    }
  });
});
