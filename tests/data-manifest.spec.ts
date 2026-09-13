import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetManifestCacheForTests,
  findManifestEntry,
  loadManifest,
  type Manifest,
} from '../src/lib/data/manifest';

const sampleManifest: Manifest = {
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

function okResponse(body: unknown): Response {
  return { ok: true, status: 200, statusText: 'OK', json: async () => body } as Response;
}

function errorResponse(status: number, statusText: string): Response {
  return { ok: false, status, statusText, json: async () => ({}) } as Response;
}

beforeEach(() => {
  __resetManifestCacheForTests();
});

describe('loadManifest', () => {
  it('fetches the manifest via the base-URL-relative path and returns it parsed', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(sampleManifest));

    const result = await loadManifest(fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith(`${import.meta.env.BASE_URL}data/manifest.json`);
    expect(result).toEqual(sampleManifest);
  });

  it('caches the result: a second call does not fetch again', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(sampleManifest));

    await loadManifest(fetchImpl);
    await loadManifest(fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('throws on a non-ok response and does not poison the cache for a later retry', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(500, 'Internal Server Error'))
      .mockResolvedValueOnce(okResponse(sampleManifest));

    await expect(loadManifest(fetchImpl)).rejects.toThrow(/500/);
    await expect(loadManifest(fetchImpl)).resolves.toEqual(sampleManifest);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('findManifestEntry', () => {
  it('finds an entry by id', () => {
    expect(findManifestEntry(sampleManifest, 'blake-the-tyger-1794')).toEqual(sampleManifest.works[0]);
  });

  it('returns undefined for an unknown id', () => {
    expect(findManifestEntry(sampleManifest, 'nope')).toBeUndefined();
  });
});
