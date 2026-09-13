import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildManifest, DEFAULT_SHARD_SIZE, dedupeKey } from '../scripts/build-manifest.mjs';

interface ManifestEntry {
  id: string;
  title: string;
  author: string;
  year: number;
  era: string;
  type: string;
  form: string;
  themes: string[];
  tags: string[];
  difficulty: number;
  length: { unit: string; value: number };
  textPolicy: string;
  shard: number;
}

interface Manifest {
  schemaVersion: number;
  generatedAt: string;
  count: number;
  shards: number;
  works: ManifestEntry[];
}

/**
 * Build a minimal, schema-valid `Work` fixture (based on the example in
 * docs/content-schema.md) with neutral placeholder prose in place of real
 * excerpts/notes, long enough to satisfy the validation minimums.
 */
function makeWork(overrides: Record<string, unknown> = {}) {
  const placeholderWords = Array.from({ length: 520 }, (_, i) => `placeholder-word-${i}`).join(' ');

  return {
    id: 'author-example-work-1900',
    type: 'short_story',
    title: 'An Example Work',
    author: 'Example Author',
    year: 1900,
    era: '19th_century',
    form: 'short story',
    themes: ['memory', 'time'],
    tags: ['placeholder'],
    length: { unit: 'words', value: 520 },
    difficulty: 2,
    source: {
      name: 'Example Source',
      url: 'https://example.com/source',
      license: 'public-domain',
      retrievedDate: '2026-09-01',
    },
    textPolicy: 'excerpt',
    excerpt: placeholderWords,
    excerptNote: 'opening 520 of 5,000 words (placeholder)',
    externalLinks: [{ kind: 'other', url: 'https://example.com/read' }],
    masterNotes: {
      context: 'Placeholder context paragraph for testing purposes only.',
      form: 'Placeholder form discussion paragraph for testing purposes only.',
      keyImages: ['Placeholder key image one.', 'Placeholder key image two.'],
      whatToNotice: ['Placeholder thing to notice.'],
      discussionQuestions: [
        'Placeholder discussion question one?',
        'Placeholder discussion question two?',
        'Placeholder discussion question three?',
      ],
      furtherReading: ['Placeholder further reading reference.'],
    },
    pipeline: {
      batchId: 'test-batch',
      dateAdded: '2026-09-01',
      curatedBy: 'test',
      schemaVersion: 1,
    },
    ...overrides,
  };
}

describe('build-manifest', () => {
  let inputDir: string;
  let outputDir: string;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    const root = await mkdtemp(join(tmpdir(), 'well-read-build-manifest-'));
    inputDir = join(root, 'content-works');
    outputDir = join(root, 'public-data');
    await mkdir(inputDir, { recursive: true });
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(async () => {
    stderrSpy.mockRestore();
    await rm(join(inputDir, '..'), { recursive: true, force: true });
  });

  async function writeWork(work: Record<string, unknown>) {
    await writeFile(join(inputDir, `${work.id}.json`), JSON.stringify(work, null, 2));
  }

  it('writes a text-free manifest with the documented shape', async () => {
    await writeWork(makeWork({ id: 'author-example-work-1900' }));

    const { manifest: rawManifest } = await buildManifest({ inputDir, outputDir });
    const manifest = rawManifest as unknown as Manifest;

    expect(manifest).toMatchObject({
      schemaVersion: 1,
      count: 1,
      shards: 1,
    });
    expect(typeof manifest.generatedAt).toBe('string');
    expect(new Date(manifest.generatedAt).toString()).not.toBe('Invalid Date');

    const entries = manifest.works;
    expect(entries).toHaveLength(1);

    const entry = entries[0];
    expect(entry).toMatchObject({
      id: 'author-example-work-1900',
      title: 'An Example Work',
      author: 'Example Author',
      year: 1900,
      era: '19th_century',
      type: 'short_story',
      form: 'short story',
      themes: ['memory', 'time'],
      tags: ['placeholder'],
      difficulty: 2,
      length: { unit: 'words', value: 520 },
      textPolicy: 'excerpt',
      shard: 0,
    });

    // Text-free: none of the full-text/notes fields leak into the index.
    expect(entry).not.toHaveProperty('text');
    expect(entry).not.toHaveProperty('excerpt');
    expect(entry).not.toHaveProperty('masterNotes');

    const onDisk = JSON.parse(await readFile(join(outputDir, 'manifest.json'), 'utf8'));
    expect(onDisk).toEqual(manifest);
  });

  it('caps each shard at the given shard size and assigns shard indices in id order', async () => {
    await writeWork(makeWork({ id: 'author-c-work-1900', title: 'Work C' }));
    await writeWork(makeWork({ id: 'author-a-work-1900', title: 'Work A' }));
    await writeWork(makeWork({ id: 'author-b-work-1900', title: 'Work B' }));

    const { manifest: rawManifest, shardGroups } = await buildManifest({
      inputDir,
      outputDir,
      shardSize: 2,
    });
    const manifest = rawManifest as unknown as Manifest;

    expect(manifest.count).toBe(3);
    expect(manifest.shards).toBe(2);
    expect(shardGroups.map((group) => group.length)).toEqual([2, 1]);
    for (const group of shardGroups) {
      expect(group.length).toBeLessThanOrEqual(2);
    }

    // Deterministic id-sorted order: a, b land in shard 0; c lands in shard 1.
    const byId = Object.fromEntries(manifest.works.map((entry) => [entry.id, entry.shard]));
    expect(byId['author-a-work-1900']).toBe(0);
    expect(byId['author-b-work-1900']).toBe(0);
    expect(byId['author-c-work-1900']).toBe(1);

    const shard0 = JSON.parse(await readFile(join(outputDir, 'shard-0.json'), 'utf8'));
    const shard1 = JSON.parse(await readFile(join(outputDir, 'shard-1.json'), 'utf8'));
    expect(shard0).toHaveLength(2);
    expect(shard1).toHaveLength(1);
    // Shards hold full records, including text fields.
    expect(shard0[0]).toHaveProperty('excerpt');
    expect(shard0[0]).toHaveProperty('masterNotes');

    expect(DEFAULT_SHARD_SIZE).toBe(50);
  });

  it('warns on fuzzy duplicate title+author pairs but still exits successfully', async () => {
    await writeWork(
      makeWork({
        id: 'author-the-example-work-1900',
        title: 'The Example Work!',
        author: 'Example Author',
      })
    );
    await writeWork(
      makeWork({
        id: 'author-example-work-2-1901',
        title: 'example work',
        author: 'Example Author',
        year: 1901,
      })
    );

    const { manifest: rawManifest, warnings } = await buildManifest({ inputDir, outputDir });
    const manifest = rawManifest as unknown as Manifest;

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/duplicate/i);
    expect(warnings[0]).toContain('author-the-example-work-1900');
    expect(warnings[0]).toContain('author-example-work-2-1901');
    expect(stderrSpy).toHaveBeenCalled();
    expect(manifest.count).toBe(2);

    // Sanity: normalisation strips punctuation and the leading article.
    expect(dedupeKey({ title: 'The Example Work!', author: 'Example Author' })).toBe(
      dedupeKey({ title: 'example work', author: 'Example Author' })
    );
  });

  it('produces an empty manifest with no shards when the input directory has no works', async () => {
    const { manifest, shardGroups, warnings } = await buildManifest({ inputDir, outputDir });

    expect(manifest).toMatchObject({ schemaVersion: 1, count: 0, shards: 0, works: [] });
    expect(shardGroups).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });
});
