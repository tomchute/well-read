import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { validateDirectory } from '../scripts/validate-content.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GOOD_DIR = path.join(__dirname, 'fixtures/content/good');
const BAD_DIR = path.join(__dirname, 'fixtures/content/bad');

// Maps each bad fixture's filename (its gate name) to a substring that must
// appear in one of its reported errors, proving the failure names that gate.
const BAD_FIXTURE_GATES: Record<string, string> = {
  'duplicate-id-1.json': 'duplicate id',
  'duplicate-id-2.json': 'duplicate id',
  'filename-does-not-match-id.json': 'filename must equal id',
  'missing-text-for-full-policy.json': 'requires `text` to be set',
  'excerpt-with-text-present.json': 'must not set `text`',
  'book-not-using-excerpt.json': "must always use textPolicy 'excerpt'",
  'theme-outside-vocabulary.json': 'controlled vocabulary',
  'key-images-below-minimum.json': 'keyImages must have at least 2 entries',
  'discussion-questions-below-minimum.json': 'discussionQuestions must have at least 3 entries',
  'excerpt-below-word-minimum.json': 'at least 500 words',
  'pending-with-excerpt-present.json': 'must not set `excerpt`',
};

describe('validate-content: good fixtures', () => {
  const report = validateDirectory(GOOD_DIR);

  it('finds at least 6 fixtures and every one passes', () => {
    expect(report.total).toBeGreaterThanOrEqual(6);
    expect(report.ok).toBe(true);
    for (const result of report.results) {
      expect(result.ok, `${result.file}: ${result.errors.join('; ')}`).toBe(true);
    }
  });

  it('covers poem, short_story, and book, and all three textPolicy values', () => {
    const files = report.results.map((r) => r.file).join(' ');
    // Sanity check via the fixtures we authored, not a schema re-implementation.
    expect(report.total).toBe(6);
    expect(files).toContain('dickinson-because-i-could-not-stop-for-death-1863.json'); // poem, full
    expect(files).toContain('anon-riverlight-verses-1888.json'); // poem, excerpt
    expect(files).toContain('fixture-office-hours-2019.json'); // short_story, excerpt
    expect(files).toContain('fixture-larkspur-street-2021.json'); // book, excerpt
    expect(files).toContain('fixture-porch-light-2022.json'); // poem, full
    expect(files).toContain('fixture-quiet-hours-2023.json'); // short_story, pending
  });
});

describe('validate-content: bad fixtures', () => {
  const report = validateDirectory(BAD_DIR);

  it('finds at least 6 fixtures and every one fails', () => {
    expect(report.total).toBeGreaterThanOrEqual(6);
    expect(report.ok).toBe(false);
    for (const result of report.results) {
      expect(result.ok, `${result.file} unexpectedly passed`).toBe(false);
    }
  });

  it('covers every expected gate-breaking fixture', () => {
    const files = report.results.map((r) => r.file);
    for (const expectedFile of Object.keys(BAD_FIXTURE_GATES)) {
      expect(files).toContain(expectedFile);
    }
  });

  it.each(Object.entries(BAD_FIXTURE_GATES))(
    '%s fails with a message naming its gate',
    (file, expectedSubstring) => {
      const result = report.results.find((r) => r.file === file);
      expect(result, `fixture ${file} not found in report`).toBeDefined();
      expect(result?.ok).toBe(false);
      expect(result?.errors.some((e) => e.includes(expectedSubstring))).toBe(true);
    }
  );
});

describe('validate-content: CLI-facing directory handling', () => {
  it('accepts a directory argument (not just the default content/works)', () => {
    const report = validateDirectory(GOOD_DIR);
    expect(report.dir).toBe(GOOD_DIR);
  });
});

describe('validate-content: malformed JSON', () => {
  // Built at test time (not a checked-in fixture) so Biome's JSON parser
  // never has to lint a file that is deliberately not valid JSON.
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reports a file that fails to parse as JSON, naming the gate', () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'validate-content-'));
    writeFileSync(path.join(tmpDir, 'broken.json'), '{ "id": "broken", ');

    const report = validateDirectory(tmpDir);

    expect(report.ok).toBe(false);
    const result = report.results.find((r) => r.file === 'broken.json');
    expect(result?.ok).toBe(false);
    expect(result?.errors.some((e) => e.includes('invalid JSON'))).toBe(true);
  });
});
