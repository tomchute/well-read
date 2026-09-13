import type { EbookLink, ExternalLink, ExternalLinkKind, Work } from '$lib/types/work';

export interface GroupedLinks {
  ebookLinks?: EbookLink[];
  externalLinksByKind?: Record<ExternalLinkKind, ExternalLink[]>;
  hasEpub: boolean;
}

/**
 * Groups a work's links by their type and policy for rendering.
 * Returns structure suitable for WorkLinks.svelte to render:
 * - full/public-domain: ebookLinks
 * - full/contemporary: externalLinks only
 * - excerpt/pending: externalLinks grouped by kind
 */
export function groupLinks(
  work: Pick<Work, 'textPolicy' | 'source' | 'ebookLinks' | 'externalLinks'>
): GroupedLinks {
  const result: GroupedLinks = {
    hasEpub: false,
  };

  // Check if there's an EPUB link for Kindle helper visibility
  if (work.ebookLinks?.some((link) => link.format === 'epub')) {
    result.hasEpub = true;
  }

  // For full text with public domain license, include ebook links
  if (work.textPolicy === 'full' && work.source.license === 'public-domain') {
    result.ebookLinks = work.ebookLinks;
  }

  // For excerpt and pending, or full with non-public-domain, group external links by kind
  if (
    work.textPolicy === 'excerpt' ||
    work.textPolicy === 'pending' ||
    (work.textPolicy === 'full' && work.source.license !== 'public-domain')
  ) {
    if (work.externalLinks && work.externalLinks.length > 0) {
      result.externalLinksByKind = work.externalLinks.reduce(
        (acc: Record<ExternalLinkKind, ExternalLink[]>, link: ExternalLink) => {
          if (!acc[link.kind]) {
            acc[link.kind] = [];
          }
          acc[link.kind].push(link);
          return acc;
        },
        {} as Record<ExternalLinkKind, ExternalLink[]>
      );
    }
  }

  return result;
}
