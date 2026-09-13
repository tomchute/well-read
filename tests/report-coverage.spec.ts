import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { aggregateCoverage } from '../scripts/report-coverage.mjs';

const placeholderWords = Array.from({ length: 520 }, (_, i) => `placeholder-word-${i}`).join(' ');

/**
 * Build a minimal, schema-valid Work fixture with neutral placeholder content
 */
function makeWork(overrides: Record<string, unknown> = {}) {
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

describe('report-coverage', () => {
  let inputDir: string;

  beforeEach(async () => {
    const root = await mkdtemp(join(tmpdir(), 'well-read-report-coverage-'));
    inputDir = join(root, 'content-works');
    await mkdir(inputDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(join(inputDir, '..'), { recursive: true, force: true });
  });

  async function writeWork(work: Record<string, unknown>) {
    await writeFile(join(inputDir, `${work.id}.json`), JSON.stringify(work, null, 2));
  }

  it('aggregates metrics from valid works and tracks missing metadata', async () => {
    // Create diverse fixtures: era, form, gender, region
    await writeWork(
      makeWork({
        id: 'blake-the-tyger-1794',
        title: 'The Tyger',
        author: 'William Blake',
        year: 1794,
        era: '18th_century',
        type: 'poem',
        form: 'lyric poem',
        themes: ['nature', 'animals', 'wonder'],
        length: { unit: 'lines', value: 24 },
        textPolicy: 'full',
        text: 'Tyger Tyger, burning bright...',
        excerpt: undefined,
        excerptNote: undefined,
        externalLinks: [{ kind: 'poetry-foundation', url: 'https://poetryfoundation.org/tyger' }],
        authorGender: 'man',
        authorRegion: 'UK',
      })
    );

    await writeWork(
      makeWork({
        id: 'chopin-story-of-hour-1894',
        title: 'The Story of an Hour',
        author: 'Kate Chopin',
        year: 1894,
        era: '19th_century',
        type: 'short_story',
        form: 'short story',
        themes: ['death', 'gender', 'family'],
        length: { unit: 'words', value: 1000 },
        authorGender: 'woman',
        authorRegion: 'US',
      })
    );

    await writeWork(
      makeWork({
        id: 'achebe-things-fall-apart-1958',
        title: 'Things Fall Apart',
        author: 'Chinua Achebe',
        year: 1958,
        era: 'mid_20th_century',
        type: 'book',
        form: 'novel',
        themes: ['power', 'family', 'faith'],
        length: { unit: 'words', value: 66000 },
        textPolicy: 'pending',
        excerpt: undefined,
        excerptNote: undefined,
        authorGender: 'man',
        authorRegion: 'Nigeria',
      })
    );

    await writeWork(
      makeWork({
        id: 'unknown-author-work-2000',
        title: 'Unknown Author Work',
        author: 'Unknown Author',
        year: 2000,
        era: 'contemporary',
        type: 'essay',
        form: 'essay',
        themes: ['justice'],
        length: { unit: 'words', value: 2000 },
        // Deliberately omit authorGender and authorRegion
        authorGender: undefined,
        authorRegion: undefined,
      })
    );

    const { metrics, missingMetadata } = await aggregateCoverage(inputDir);

    // Basic counts
    expect(metrics.totalWorks).toBe(4);
    expect(missingMetadata).toHaveLength(1);
    expect(missingMetadata).toContain('unknown-author-work-2000');

    // Era distribution
    expect(metrics.eraDistribution['pre-1900']).toBe(2); // Blake, Chopin
    expect(metrics.eraDistribution['1900-1970']).toBe(1); // Achebe
    expect(metrics.eraDistribution['post-1970']).toBe(1); // Unknown

    // Form distribution
    expect(metrics.formDistribution.poem).toBe(1);
    expect(metrics.formDistribution.short_story).toBe(1);
    expect(metrics.formDistribution.book).toBe(1);
    expect(metrics.formDistribution.essay).toBe(1);

    // TextPolicy
    expect(metrics.textPolicyDistribution.full).toBe(1);
    expect(metrics.textPolicyDistribution.excerpt).toBe(2);
    expect(metrics.textPolicyDistribution.pending).toBe(1);

    // Gender
    expect(metrics.genderDistribution.man).toBe(2);
    expect(metrics.genderDistribution.woman).toBe(1);
    expect(metrics.genderDistribution.unknown).toBe(1);

    // Region
    expect(metrics.regionDistribution['US/UK']).toBe(2); // Blake (UK), Chopin (US)
    expect(metrics.regionDistribution.other).toBe(1); // Achebe (Nigeria)
    expect(metrics.regionDistribution.unknown).toBe(1); // Unknown

    // Top themes
    expect(metrics.topThemes).toBeDefined();
    expect(Object.keys(metrics.topThemes).length).toBeGreaterThan(0);
  });

  it('handles empty directory gracefully', async () => {
    const { metrics, missingMetadata } = await aggregateCoverage(inputDir);

    expect(metrics.totalWorks).toBe(0);
    expect(missingMetadata).toHaveLength(0);
    expect(metrics.eraDistribution['pre-1900']).toBe(0);
  });

  it('skips invalid JSON files with stderr warning', async () => {
    await writeWork(
      makeWork({
        id: 'valid-work-1900',
        author: 'Valid Author',
      })
    );

    // Write an invalid JSON file
    await writeFile(join(inputDir, 'invalid.json'), '{not valid json');

    const { metrics, missingMetadata } = await aggregateCoverage(inputDir);

    // Should only count the valid work
    expect(metrics.totalWorks).toBe(1);
  });

  it('counts multiple works by the same author', async () => {
    const author = 'Prolific Author';
    for (let i = 0; i < 4; i++) {
      await writeWork(
        makeWork({
          id: `prolific-work-${i}`,
          author,
          year: 1900 + i,
          authorGender: 'woman',
          authorRegion: 'US',
        })
      );
    }

    const { metrics } = await aggregateCoverage(inputDir);

    expect(metrics.totalWorks).toBe(4);
    expect(metrics.authorCounts[author]).toBe(4);
  });

  it('tracks themes across multiple works', async () => {
    await writeWork(
      makeWork({
        id: 'work-1',
        themes: ['love', 'memory', 'time'],
        authorGender: 'woman',
        authorRegion: 'US',
      })
    );

    await writeWork(
      makeWork({
        id: 'work-2',
        themes: ['love', 'death', 'grief'],
        authorGender: 'man',
        authorRegion: 'UK',
      })
    );

    const { metrics } = await aggregateCoverage(inputDir);

    // Love appears twice
    expect(metrics.topThemes.love).toBe(2);
    expect(metrics.topThemes.memory).toBe(1);
    expect(metrics.topThemes.death).toBe(1);
  });
});
