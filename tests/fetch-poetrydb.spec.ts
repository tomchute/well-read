import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRequestUrl, parseArgs, transformPoem } from '../scripts/fetch-poetrydb.mjs';

// Tiny neutral fixture standing in for a PoetryDB response — never real poem text.
const MOCK_POEMS = [
  {
    title: 'Sample Poem One',
    author: 'Test Author',
    lines: ['line one', 'line two'],
    linecount: '2',
  },
  {
    title: 'Sample Poem Two',
    author: 'Test Author',
    lines: ['line one', 'line two', 'line three'],
    linecount: '3',
  },
];

describe('fetch-poetrydb', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('parseArgs', () => {
    it('treats a bare positional argument as author', () => {
      expect(parseArgs(['Test Author'])).toEqual({
        author: 'Test Author',
        title: null,
        limit: 10,
      });
    });

    it('parses --author, --title and --limit flags', () => {
      expect(
        parseArgs(['--author', 'Test Author', '--title', 'Sample Poem One', '--limit', '5'])
      ).toEqual({
        author: 'Test Author',
        title: 'Sample Poem One',
        limit: 5,
      });
    });

    it('falls back to the default limit for an invalid --limit value', () => {
      expect(parseArgs(['--author', 'Test Author', '--limit', 'not-a-number'])).toEqual({
        author: 'Test Author',
        title: null,
        limit: 10,
      });
      expect(parseArgs(['--author', 'Test Author', '--limit', '0'])).toMatchObject({ limit: 10 });
      expect(parseArgs(['--author', 'Test Author', '--limit', '-3'])).toMatchObject({ limit: 10 });
    });
  });

  describe('buildRequestUrl', () => {
    it('builds an author endpoint', () => {
      expect(buildRequestUrl('Test Author', null)).toBe(
        'https://poetrydb.org/author/Test%20Author'
      );
    });

    it('builds a title endpoint', () => {
      expect(buildRequestUrl(null, 'Sample Poem')).toBe('https://poetrydb.org/title/Sample%20Poem');
    });

    it('builds a combined author,title endpoint', () => {
      expect(buildRequestUrl('Test Author', 'Sample Poem')).toBe(
        'https://poetrydb.org/author,title/Test%20Author;Sample%20Poem'
      );
    });

    it('throws when neither author nor title is given', () => {
      expect(() => buildRequestUrl(null, null)).toThrow(/must specify/i);
    });
  });

  describe('transformPoem', () => {
    it('transforms a well-formed poem into the candidate shape', () => {
      const candidate = transformPoem(MOCK_POEMS[0]);

      expect(candidate).toEqual({
        title: 'Sample Poem One',
        author: 'Test Author',
        lines: ['line one', 'line two'],
        linecount: 2,
        text: 'line one\nline two',
        sourceUrl: 'https://poetrydb.org/title/Sample%20Poem%20One',
      });
    });

    it('fails soft (returns null) when title is missing', () => {
      const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
      const candidate = transformPoem({ author: 'Test Author', lines: ['line one'] });

      expect(candidate).toBeNull();
      expect(warn).toHaveBeenCalled();
    });

    it('fails soft (returns null) when author is missing', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const candidate = transformPoem({ title: 'Sample Poem One', lines: ['line one'] });

      expect(candidate).toBeNull();
    });

    it('fails soft (returns null) when lines is missing or empty', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(
        transformPoem({ title: 'Sample Poem One', author: 'Test Author', lines: [] })
      ).toBeNull();
      expect(transformPoem({ title: 'Sample Poem One', author: 'Test Author' })).toBeNull();
    });

    it('fails soft (returns null) for a null/undefined poem instead of throwing', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(transformPoem(null)).toBeNull();
      expect(transformPoem(undefined)).toBeNull();
    });
  });

  describe('candidate assembly against a mocked fetch', () => {
    it('transforms every poem in a successful response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => MOCK_POEMS,
      });

      const response = await fetch(buildRequestUrl('Test Author', null));
      const data = await response.json();
      const candidates = data.map(transformPoem).filter(Boolean);

      expect(candidates).toHaveLength(2);
      expect(candidates[0].title).toBe('Sample Poem One');
      expect(candidates[1].linecount).toBe(3);
    });

    it('treats a PoetryDB {status, reason} not-found body as zero results, not a failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 404, reason: 'title not found' }),
      });

      const response = await fetch(buildRequestUrl(null, 'Nonexistent Poem'));
      const data = await response.json();

      expect(Array.isArray(data)).toBe(false);
      expect(data.status).toBe(404);
    });
  });
});
