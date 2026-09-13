import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetManifestCacheForTests, type Manifest } from '../src/lib/data/manifest';
import { __resetShardCacheForTests, loadWork } from '../src/lib/data/work';
import type { Work } from '../src/lib/types/work';

const manifest: Manifest = {
  schemaVersion: 1,
  generatedAt: '2026-09-13T00:00:00.000Z',
  count: 1,
  shards: 1,
  works: [
    {
      id: 'blake-the-tyger-1794',
      title: 'The Tyger',
      author: 'William Blake',
      year: 1794,
      era: '18th_century',
      type: 'poem',
      form: 'lyric poem',
      themes: ['nature'],
      tags: [],
      difficulty: 3,
      length: { unit: 'lines', value: 24 },
      textPolicy: 'full',
      shard: 0,
    },
  ],
};

// Only the fields loadWork actually reads/returns are populated in full;
// the rest of `Work` isn't relevant to this loader's behavior.
const fullWork = { id: 'blake-the-tyger-1794', title: 'The Tyger' } as unknown as Work;
const shard0: Work[] = [fullWork];

function okResponse(body: unknown): Response {
  return { ok: true, status: 200, statusText: 'OK', json: async () => body } as Response;
}

function errorResponse(status: number, statusText: string): Response {
  return { ok: false, status, statusText, json: async () => ({}) } as Response;
}

function fetchFor(manifestBody: unknown, shardBody: unknown) {
  return vi.fn(async (url: string) => {
    if (url.endsWith('manifest.json')) return okResponse(manifestBody);
    if (url.endsWith('shard-0.json')) return okResponse(shardBody);
    throw new Error(`unexpected url: ${url}`);
  });
}

beforeEach(() => {
  __resetManifestCacheForTests();
  __resetShardCacheForTests();
});

describe('loadWork', () => {
  it('resolves the shard from the manifest and returns the matching work', async () => {
    const fetchImpl = fetchFor(manifest, shard0);

    const result = await loadWork('blake-the-tyger-1794', fetchImpl);

    expect(result).toEqual(fullWork);
    expect(fetchImpl).toHaveBeenCalledWith(`${import.meta.env.BASE_URL}data/manifest.json`);
    expect(fetchImpl).toHaveBeenCalledWith(`${import.meta.env.BASE_URL}data/shard-0.json`);
  });

  it('returns undefined for an id not present in the manifest', async () => {
    const fetchImpl = fetchFor(manifest, shard0);

    const result = await loadWork('not-a-real-id', fetchImpl);

    expect(result).toBeUndefined();
    // Never fetches a shard for a work the manifest doesn't know about.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('caches a shard: two works in the same shard only fetch it once', async () => {
    const twoWorkManifest: Manifest = {
      ...manifest,
      works: [
        ...manifest.works,
        { ...manifest.works[0], id: 'blake-the-lamb-1789', title: 'The Lamb' },
      ],
    };
    const twoWorkShard: Work[] = [
      fullWork,
      { id: 'blake-the-lamb-1789', title: 'The Lamb' } as unknown as Work,
    ];
    const fetchImpl = fetchFor(twoWorkManifest, twoWorkShard);

    await loadWork('blake-the-tyger-1794', fetchImpl);
    await loadWork('blake-the-lamb-1789', fetchImpl);

    const shardFetches = fetchImpl.mock.calls.filter(([url]) =>
      (url as string).endsWith('shard-0.json')
    );
    expect(shardFetches).toHaveLength(1);
  });

  it('throws when the shard fetch fails', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith('manifest.json')) return okResponse(manifest);
      return errorResponse(404, 'Not Found');
    });

    await expect(loadWork('blake-the-tyger-1794', fetchImpl)).rejects.toThrow(/404/);
  });
});
