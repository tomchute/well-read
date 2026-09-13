// Manifest loader: fetches the text-free work index once and caches it in
// memory for the life of the page. Pure plain-TypeScript module (no Svelte
// runes) so it is trivially unit-testable with a mocked `fetch` — see
// tests/data-manifest.spec.ts.
//
// Shape: docs/content-schema.md ("Manifest index shape"),
// docs/architecture.md ("Manifest vs. shards"). Every field except `shard`
// mirrors the text-free subset of the `Work` type in src/lib/types/work.ts.
//
// Per docs/architecture.md ("GitHub Pages base path"), the fetch always goes
// through `import.meta.env.BASE_URL` — never a hardcoded `/data/...` path —
// so this works identically in dev, preview, and under the Pages subpath.

import type { Era, Length, TextPolicy, WorkType } from '$lib/types/work';

export interface ManifestEntry {
  id: string;
  title: string;
  author: string;
  year: number;
  era: Era;
  type: WorkType;
  form: string;
  themes: string[];
  tags: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  length: Length;
  textPolicy: TextPolicy;
  shard: number;
}

export interface Manifest {
  schemaVersion: number;
  generatedAt: string;
  count: number;
  shards: number;
  works: ManifestEntry[];
}

/** The subset of the `fetch` signature this module relies on — injectable for tests. */
export type Fetcher = (input: string) => Promise<Response>;

let manifestPromise: Promise<Manifest> | null = null;

/**
 * Fetches `${BASE_URL}data/manifest.json` on first call and caches the
 * resulting promise for every subsequent call (in-memory only — a page
 * reload re-fetches). A failed fetch clears the cache so a later call can
 * retry rather than replaying the same rejection forever.
 */
export function loadManifest(fetchImpl: Fetcher = fetch): Promise<Manifest> {
  if (!manifestPromise) {
    manifestPromise = fetchManifest(fetchImpl).catch((error: unknown) => {
      manifestPromise = null;
      throw error;
    });
  }
  return manifestPromise;
}

async function fetchManifest(fetchImpl: Fetcher): Promise<Manifest> {
  const url = `${import.meta.env.BASE_URL}data/manifest.json`;
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Failed to load manifest (${response.status} ${response.statusText})`);
  }
  return (await response.json()) as Manifest;
}

/** Looks up one manifest entry by id, or `undefined` if it isn't in the catalog. */
export function findManifestEntry(manifest: Manifest, id: string): ManifestEntry | undefined {
  return manifest.works.find((entry) => entry.id === id);
}

/** Test-only: clears the in-memory manifest cache so each test starts fresh. */
export function __resetManifestCacheForTests(): void {
  manifestPromise = null;
}
