// Vitest cases for src/lib/actions.ts — the shared like/dislike/save/more-
// like-this/mark-as-read/first-seen mutations Feed.svelte and Work.svelte
// both call. Test doubles are plain `ValueStore`s backed by a memory storage
// (`createMemoryStorage` from stores/persisted.ts), mirroring the
// `PersistedRune` shape components get from stores/index.svelte.ts without
// needing the Svelte compiler.

import { describe, expect, it } from 'vitest';
import {
  dislikeWork,
  isLiked,
  isSaved,
  likeWork,
  markSeen,
  moreLikeThis,
  toggleRead,
  toggleSaved,
  type ValueStore,
} from '../src/lib/actions';
import {
  ALL_STORES,
  createMemoryStorage,
  exportState,
  importState,
  type PersistedDef,
  type StorageLike,
} from '../src/lib/stores/persisted';
import type { Reactions, Read, Saved, SeenMap, Weights } from '../src/lib/stores/schema';

/** A `ValueStore` backed by one persisted slot in a given storage — the same read/write pattern `createRune` uses in stores/index.svelte.ts, minus the Svelte reactivity. */
function runeFor<T>(storage: StorageLike, def: PersistedDef<T>): ValueStore<T> {
  let current = def.read(storage);
  return {
    get value() {
      return current;
    },
    set(next: T) {
      current = next;
      def.write(storage, next);
    },
  };
}

function makeStores(storage: StorageLike) {
  return {
    weights: runeFor<Weights>(storage, ALL_STORES.weights),
    reactions: runeFor<Reactions>(storage, ALL_STORES.reactions),
    saved: runeFor<Saved>(storage, ALL_STORES.saved),
    read: runeFor<Read>(storage, ALL_STORES.read),
    seen: runeFor<SeenMap>(storage, ALL_STORES.seen),
  };
}

const WORK = {
  id: 'plath-tulips-1962',
  type: 'poem' as const,
  author: 'Sylvia Plath',
  themes: ['grief', 'body'],
};

describe('likeWork / dislikeWork', () => {
  it('like sets reactions[id] = 1 and applies the more-like-this deltas', () => {
    const stores = makeStores(createMemoryStorage());
    likeWork(stores, WORK);
    expect(stores.reactions.value[WORK.id]).toBe(1);
    expect(stores.weights.value.theme.grief).toBe(2);
    expect(stores.weights.value.theme.body).toBe(2);
    expect(stores.weights.value.form.poem).toBe(1);
    expect(stores.weights.value.author['Sylvia Plath']).toBe(2);
  });

  it('dislike sets reactions[id] = -1 and applies the less-like-this deltas', () => {
    const stores = makeStores(createMemoryStorage());
    dislikeWork(stores, WORK);
    expect(stores.reactions.value[WORK.id]).toBe(-1);
    expect(stores.weights.value.theme.grief).toBe(-2);
    expect(stores.weights.value.author['Sylvia Plath']).toBe(-2);
  });

  it('persists through the backing storage, not just the in-memory rune', () => {
    const storage = createMemoryStorage();
    const stores = makeStores(storage);
    likeWork(stores, WORK);
    expect(ALL_STORES.reactions.read(storage)[WORK.id]).toBe(1);
  });
});

describe('moreLikeThis', () => {
  it('applies the more-like-this weight deltas without touching reactions', () => {
    const stores = makeStores(createMemoryStorage());
    moreLikeThis(stores, WORK);
    expect(stores.weights.value.theme.grief).toBe(2);
    expect(stores.reactions.value[WORK.id]).toBeUndefined();
  });

  it('accepts a loaded Work-shaped object as well as a ManifestEntry', () => {
    // A full Work record carries every field ManifestEntry does except the
    // manifest-only `shard` number — moreLikeThis never needs it (see
    // ChipWork in src/lib/scoring/types.ts).
    const loadedWork = {
      id: 'woolf-mrs-dalloway-1925',
      type: 'book' as const,
      author: 'Virginia Woolf',
      themes: ['time', 'the-city'],
      title: 'Mrs Dalloway',
      text: 'Mrs Dalloway said she would buy the flowers herself.',
    };
    const stores = makeStores(createMemoryStorage());
    moreLikeThis(stores, loadedWork);
    expect(stores.weights.value.theme.time).toBe(2);
    expect(stores.weights.value.author['Virginia Woolf']).toBe(2);
  });
});

describe('toggleSaved / isSaved', () => {
  it('saves an unsaved id by prepending it (most-recent-first)', () => {
    const stores = makeStores(createMemoryStorage());
    stores.saved.set(['work-a']);
    toggleSaved(stores.saved, 'work-b');
    expect(stores.saved.value).toEqual(['work-b', 'work-a']);
    expect(isSaved(stores.saved.value, 'work-b')).toBe(true);
  });

  it('unsaves an already-saved id', () => {
    const stores = makeStores(createMemoryStorage());
    stores.saved.set(['work-b', 'work-a']);
    toggleSaved(stores.saved, 'work-b');
    expect(stores.saved.value).toEqual(['work-a']);
    expect(isSaved(stores.saved.value, 'work-b')).toBe(false);
  });
});

describe('isLiked', () => {
  it('reads true only for an explicit like, not a dislike or neutral', () => {
    const reactions: Reactions = { 'work-a': 1, 'work-b': -1 };
    expect(isLiked(reactions, 'work-a')).toBe(true);
    expect(isLiked(reactions, 'work-b')).toBe(false);
    expect(isLiked(reactions, 'work-c')).toBe(false);
  });
});

describe('toggleRead', () => {
  it('marks an unread work read, then marks it unread again', () => {
    const stores = makeStores(createMemoryStorage());
    toggleRead(stores.read, 'work-a');
    expect(stores.read.value).toEqual(['work-a']);
    toggleRead(stores.read, 'work-a');
    expect(stores.read.value).toEqual([]);
  });
});

describe('markSeen', () => {
  it('records the first-seen ISO timestamp for a new id', () => {
    const stores = makeStores(createMemoryStorage());
    const now = new Date('2026-09-13T12:00:00.000Z');
    markSeen(stores.seen, 'work-a', now);
    expect(stores.seen.value['work-a']).toBe('2026-09-13T12:00:00.000Z');
  });

  it('does not overwrite an existing first-seen timestamp on a later call', () => {
    const stores = makeStores(createMemoryStorage());
    markSeen(stores.seen, 'work-a', new Date('2026-09-13T12:00:00.000Z'));
    markSeen(stores.seen, 'work-a', new Date('2026-09-14T00:00:00.000Z'));
    expect(stores.seen.value['work-a']).toBe('2026-09-13T12:00:00.000Z');
  });
});

describe('export -> import round-trip after acting through actions.ts', () => {
  it('preserves every mutation made via likeWork/toggleSaved/toggleRead/markSeen/moreLikeThis', () => {
    const source = createMemoryStorage();
    const stores = makeStores(source);

    likeWork(stores, WORK);
    moreLikeThis(stores, {
      id: 'other-work',
      type: 'essay',
      author: 'Zadie Smith',
      themes: ['home'],
    });
    toggleSaved(stores.saved, WORK.id);
    toggleRead(stores.read, WORK.id);
    markSeen(stores.seen, WORK.id, new Date('2026-09-13T12:00:00.000Z'));

    const exported = exportState(source);
    const json = JSON.stringify(exported);

    const dest = createMemoryStorage();
    const result = importState(dest, json);

    expect(result.ok).toBe(true);
    expect(exportState(dest)).toEqual(exportState(source));
    // Spot-check the mutations actually made it through the round trip.
    expect(exportState(dest).reactions[WORK.id]).toBe(1);
    expect(exportState(dest).saved).toEqual([WORK.id]);
    expect(exportState(dest).read).toEqual([WORK.id]);
    expect(exportState(dest).seen[WORK.id]).toBe('2026-09-13T12:00:00.000Z');
    expect(exportState(dest).weights.author['Zadie Smith']).toBe(2);
  });
});
