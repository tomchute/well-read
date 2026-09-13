import { describe, expect, it } from 'vitest';
import type { Work } from '$lib/types/work';

import { groupLinks } from '../src/lib/components/workLinks';

describe('groupLinks', () => {
  const createWork = (
    overrides: Partial<Work>
  ): Pick<Work, 'textPolicy' | 'source' | 'ebookLinks' | 'externalLinks'> => ({
    textPolicy: overrides.textPolicy ?? 'full',
    source: {
      name: 'Test Source',
      url: 'https://example.com',
      license: 'public-domain',
      retrievedDate: '2026-09-13',
      ...(overrides.source as Record<string, unknown>),
    },
    ebookLinks: overrides.ebookLinks,
    externalLinks: overrides.externalLinks,
  });

  describe('full text with public-domain license', () => {
    it('includes ebookLinks', () => {
      const work = createWork({
        textPolicy: 'full',
        source: { license: 'public-domain' as const } as Record<string, unknown>,
        ebookLinks: [
          { provider: 'standard-ebooks', format: 'epub', url: 'https://example.com/epub' },
          { provider: 'gutenberg', format: 'pdf', url: 'https://example.com/pdf' },
        ],
      });

      const result = groupLinks(work);

      expect(result.ebookLinks).toHaveLength(2);
      expect(result.ebookLinks?.[0].provider).toBe('standard-ebooks');
      expect(result.externalLinksByKind).toBeUndefined();
    });

    it('detects EPUB for Kindle helper', () => {
      const work = createWork({
        textPolicy: 'full',
        source: { license: 'public-domain' as const } as Record<string, unknown>,
        ebookLinks: [
          {
            provider: 'standard-ebooks',
            format: 'epub',
            url: 'https://example.com/epub',
          },
        ],
      });

      const result = groupLinks(work);

      expect(result.hasEpub).toBe(true);
    });

    it('returns hasEpub false when no EPUB', () => {
      const work = createWork({
        textPolicy: 'full',
        source: { license: 'public-domain' as const } as Record<string, unknown>,
        ebookLinks: [{ provider: 'gutenberg', format: 'pdf', url: 'https://example.com/pdf' }],
      });

      const result = groupLinks(work);

      expect(result.hasEpub).toBe(false);
    });
  });

  describe('full text with non-public-domain license', () => {
    it('includes externalLinks grouped by kind, not ebookLinks', () => {
      const work = createWork({
        textPolicy: 'full',
        source: { license: 'all-rights-reserved' as const } as Record<string, unknown>,
        externalLinks: [
          { kind: 'publisher', url: 'https://publisher.com', label: 'Publisher' },
          { kind: 'poetry-foundation', url: 'https://poetry.org', label: 'Poetry Foundation' },
        ],
      });

      const result = groupLinks(work);

      expect(result.ebookLinks).toBeUndefined();
      expect(result.externalLinksByKind).toBeDefined();
      expect(result.externalLinksByKind?.publisher).toHaveLength(1);
      expect(result.externalLinksByKind?.['poetry-foundation']).toHaveLength(1);
    });
  });

  describe('excerpt policy', () => {
    it('groups externalLinks by kind', () => {
      const work = createWork({
        textPolicy: 'excerpt',
        source: { license: 'all-rights-reserved' as const } as Record<string, unknown>,
        externalLinks: [
          { kind: 'publisher', url: 'https://publisher.com' },
          { kind: 'library', url: 'https://library.com' },
          { kind: 'publisher', url: 'https://publisher2.com' },
        ],
      });

      const result = groupLinks(work);

      expect(result.externalLinksByKind?.publisher).toHaveLength(2);
      expect(result.externalLinksByKind?.library).toHaveLength(1);
      expect(result.ebookLinks).toBeUndefined();
    });

    it('handles empty externalLinks', () => {
      const work = createWork({
        textPolicy: 'excerpt',
        externalLinks: undefined,
      });

      const result = groupLinks(work);

      expect(result.externalLinksByKind).toBeUndefined();
    });
  });

  describe('pending policy', () => {
    it('groups externalLinks by kind', () => {
      const work = createWork({
        textPolicy: 'pending',
        externalLinks: [
          { kind: 'publisher', url: 'https://publisher.com', label: 'Buy now' },
          { kind: 'bookstore', url: 'https://bookstore.com' },
        ],
      });

      const result = groupLinks(work);

      expect(result.externalLinksByKind?.publisher).toHaveLength(1);
      expect(result.externalLinksByKind?.bookstore).toHaveLength(1);
      expect(result.ebookLinks).toBeUndefined();
    });
  });

  describe('Kindle helper condition', () => {
    it('sets hasEpub true when EPUB exists in any policy', () => {
      const work = createWork({
        textPolicy: 'excerpt',
        ebookLinks: [
          {
            provider: 'standard-ebooks',
            format: 'epub',
            url: 'https://example.com/epub',
          },
        ],
      });

      const result = groupLinks(work);

      expect(result.hasEpub).toBe(true);
    });

    it('sets hasEpub false when no EPUB in any policy', () => {
      const work = createWork({
        textPolicy: 'pending',
        ebookLinks: undefined,
      });

      const result = groupLinks(work);

      expect(result.hasEpub).toBe(false);
    });
  });
});
