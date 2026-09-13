// Shard loader: resolves a work id to its shard via the manifest, then
// lazy-fetches that `shard-N.json` on demand (never all shards up front),
// caching each shard once fetched. Pure plain-TypeScript module (no Svelte
// runes) so it is trivially unit-testable with a mocked `fetch` — see
// tests/data-work.spec.ts.
//
// Shape: docs/architecture.md ("Manifest vs. shards") — `shard-N.json` holds
// full `Work` records (including text/excerpt, masterNotes, links), capped at
// 50 works per shard. Per docs/architecture.md ("GitHub Pages base path"),
// the fetch always goes through `import.meta.env.BASE_URL` — never a
// hardcoded `/data/...` path.

import type { Work } from '$lib/types/work';
import { type Fetcher, findManifestEntry, loadManifest } from './manifest';

const shardPromises = new Map<number, Promise<Work[]>>();

/**
 * Resolves `id`'s shard from the manifest and returns the full `Work`
 * record, or `undefined` if `id` isn't in the manifest or isn't present in
 * its shard (a shard/manifest mismatch, which `build:manifest` should never
 * produce, but the caller shouldn't crash on it either).
 */
export async function loadWork(id: string, fetchImpl: Fetcher = fetch): Promise<Work | undefined> {
  const manifest = await loadManifest(fetchImpl);
  const entry = findManifestEntry(manifest, id);
  if (!entry) return undefined;

  const shard = await loadShard(entry.shard, fetchImpl);
  return shard.find((work) => work.id === id);
}

/** Fetches `shard-N.json` on first request for that shard number, then caches it. */
function loadShard(shard: number, fetchImpl: Fetcher): Promise<Work[]> {
  let cached = shardPromises.get(shard);
  if (!cached) {
    cached = fetchShard(shard, fetchImpl).catch((error: unknown) => {
      shardPromises.delete(shard);
      throw error;
    });
    shardPromises.set(shard, cached);
  }
  return cached;
}

async function fetchShard(shard: number, fetchImpl: Fetcher): Promise<Work[]> {
  const url = `${import.meta.env.BASE_URL}data/shard-${shard}.json`;
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Failed to load shard ${shard} (${response.status} ${response.statusText})`);
  }
  return (await response.json()) as Work[];
}

/** Test-only: clears the in-memory shard cache so each test starts fresh. */
export function __resetShardCacheForTests(): void {
  shardPromises.clear();
}
