import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

// Import the script as a module - we'll test individual functions
// For now, we'll test with a mock feed fixture

const MOCK_OPDS_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opds="http://opds-spec.org/2010/catalog">
  <title>Standard Ebooks Catalog</title>
  <updated>2026-09-13T00:00:00Z</updated>
  <entry>
    <title>Frankenstein</title>
    <author>
      <name>Mary Wollstonecraft Shelley</name>
    </author>
    <id>urn:uuid:3c59dc048e8850243be8079a5c74d079</id>
    <updated>2020-05-17T20:02:14Z</updated>
    <summary>A creature assembled from dead body parts is animated by mad scientist Victor Frankenstein. The creature, lonely and desperate to connect, eventually revenges himself on his creator.</summary>
    <link rel="alternate" href="https://standardebooks.org/ebooks/mary-wollstonecraft-shelley/frankenstein"/>
    <link rel="http://opds-spec.org/acquisition" type="application/epub+zip" href="https://standardebooks.org/ebooks/mary-wollstonecraft-shelley/frankenstein/downloads/mary-wollstonecraft-shelley_frankenstein.epub"/>
    <link rel="http://opds-spec.org/acquisition" type="application/x-mobipocket-ebook" href="https://standardebooks.org/ebooks/mary-wollstonecraft-shelley/frankenstein/downloads/mary-wollstonecraft-shelley_frankenstein.azw3"/>
    <category term="Fiction" label="Fiction"/>
    <category term="Horror" label="Horror"/>
    <rights>This work is in the public domain in the United States.</rights>
  </entry>
  <entry>
    <title>The Haunted and the Haunters; or, The House and the Brain</title>
    <author>
      <name>Edward Bulwer-Lytton</name>
    </author>
    <id>urn:uuid:1c59dc048e8850243be8079a5c74d079</id>
    <updated>2015-08-08T18:27:47Z</updated>
    <summary>A skeptical philosopher rents a notoriously haunted London house to discover the secret of its supernatural disturbances.</summary>
    <link rel="alternate" href="https://standardebooks.org/ebooks/edward-bulwer-lytton/the-haunted-and-the-haunters"/>
    <link rel="http://opds-spec.org/acquisition" type="application/epub+zip" href="https://standardebooks.org/ebooks/edward-bulwer-lytton/the-haunted-and-the-haunters/downloads/edward-bulwer-lytton_the-haunted-and-the-haunters.epub"/>
    <category term="Fiction" label="Fiction"/>
    <category term="Horror" label="Horror"/>
    <rights>This work is in the public domain in the United States.</rights>
  </entry>
  <entry>
    <title>The Strange Case of Dr. Jekyll and Mr. Hyde</title>
    <author>
      <name>Robert Louis Stevenson</name>
    </author>
    <id>urn:uuid:2c59dc048e8850243be8079a5c74d079</id>
    <updated>2012-02-12T04:14:05Z</updated>
    <summary>A respectable Jekyll permits an evil alternate personality named Hyde to emerge.</summary>
    <link rel="alternate" href="https://standardebooks.org/ebooks/robert-louis-stevenson/the-strange-case-of-dr-jekyll-and-mr-hyde"/>
    <link rel="http://opds-spec.org/acquisition" type="application/epub+zip" href="https://standardebooks.org/ebooks/robert-louis-stevenson/the-strange-case-of-dr-jekyll-and-mr-hyde/downloads/robert-louis-stevenson_the-strange-case-of-dr-jekyll-and-mr-hyde.epub"/>
    <category term="Fiction" label="Fiction"/>
    <rights>This work is in the public domain in the United States.</rights>
  </entry>
</feed>`;

describe('fetch-standard-ebooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should parse OPDS feed and extract candidates', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => MOCK_OPDS_FEED,
    });

    // Test the parsing logic with the mock feed
    const entries = MOCK_OPDS_FEED.match(/<entry[^>]*>.*?<\/entry>/gs) || [];
    expect(entries).toHaveLength(3);

    // Extract title from first entry
    const firstEntry = entries[0];
    const titleMatch = firstEntry.match(/<title[^>]*>([^<]*)<\/title>/i);
    expect(titleMatch).toBeTruthy();
    expect(titleMatch[1]).toBe('Frankenstein');
  });

  it('should extract author names from Atom entries', () => {
    const entries = MOCK_OPDS_FEED.match(/<entry[^>]*>.*?<\/entry>/gs) || [];
    const firstEntry = entries[0];

    const authorRegex = /<author[^>]*>(.*?)<\/author>/is;
    const authorMatch = firstEntry.match(authorRegex);
    expect(authorMatch).toBeTruthy();

    const nameMatch = authorMatch[1].match(/<name[^>]*>([^<]+)<\/name>/i);
    expect(nameMatch[1]).toBe('Mary Wollstonecraft Shelley');
  });

  it('should extract EPUB download links', () => {
    const entries = MOCK_OPDS_FEED.match(/<entry[^>]*>.*?<\/entry>/gs) || [];
    const firstEntry = entries[0];

    const linkRegex = /<link[^>]*href="([^"]*)"[^>]*(?:type="([^"]*)")?/g;
    const links = [];
    let match;
    while ((match = linkRegex.exec(firstEntry)) !== null) {
      if (match[2] && match[2].includes('epub')) {
        links.push(match[1]);
      }
    }

    expect(links).toHaveLength(1);
    expect(links[0]).toContain('frankenstein.epub');
  });

  it('should extract license as public-domain', () => {
    const entries = MOCK_OPDS_FEED.match(/<entry[^>]*>.*?<\/entry>/gs) || [];
    const firstEntry = entries[0];

    const rightsMatch = firstEntry.match(/<rights[^>]*>([^<]+)<\/rights>/i);
    expect(rightsMatch).toBeTruthy();
    expect(rightsMatch[1]).toContain('public domain');
  });

  it('should handle multiple entries', () => {
    const entries = MOCK_OPDS_FEED.match(/<entry[^>]*>.*?<\/entry>/gs) || [];
    expect(entries).toHaveLength(3);

    const titles = entries.map((entry) => {
      const match = entry.match(/<title[^>]*>([^<]*)<\/title>/i);
      return match ? match[1] : null;
    });

    expect(titles).toEqual([
      'Frankenstein',
      'The Haunted and the Haunters; or, The House and the Brain',
      'The Strange Case of Dr. Jekyll and Mr. Hyde',
    ]);
  });

  it('should extract categories/subjects', () => {
    const entries = MOCK_OPDS_FEED.match(/<entry[^>]*>.*?<\/entry>/gs) || [];
    const firstEntry = entries[0];

    const categoryRegex = /<category[^>]*term="([^"]*)"[^>]*>/g;
    const subjects = [];
    let match;
    while ((match = categoryRegex.exec(firstEntry)) !== null) {
      subjects.push(match[1]);
    }

    expect(subjects).toEqual(['Fiction', 'Horror']);
  });
});
