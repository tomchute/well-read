#!/usr/bin/env node

/**
 * fetch-gutendex.mjs
 * Query the Gutendex API (Project Gutenberg catalog) and output candidates.
 *
 * Usage:
 *   node scripts/fetch-gutendex.mjs --search "Emily Dickinson" [--limit 10]
 *   node scripts/fetch-gutendex.mjs --author "Jane Austen" [--limit 5]
 *
 * @typedef {{name: string, birth_year: number|null, death_year: number|null}} GutendexAuthor
 * @typedef {{id: number, title: string, authors: GutendexAuthor[], subjects: string[], formats: Record<string, string>}} GutendexResult
 * @typedef {{count: number, results: GutendexResult[]}} GutendexResponse
 * @typedef {{title: string, author: string|null, year: number|null, gutenbergId: number, subjects: string[], epubUrl: string|null, htmlUrl: string|null, sourceUrl: string}} Candidate
 */

import { argv } from 'process';

const BASE_URL = 'https://gutendex.com/books';

/**
 * Parse command-line arguments
 * Supports: positional arg (search term), --search, --author, --limit
 * @returns {{search: string, author: string, limit: number}}
 */
function parseArguments() {
  const args = {
    search: '',
    author: '',
    limit: 10,
  };

  let positionalIndex = 0;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--search' && i + 1 < argv.length) {
      args.search = argv[i + 1];
      i++;
    } else if (arg === '--author' && i + 1 < argv.length) {
      args.author = argv[i + 1];
      i++;
    } else if (arg === '--limit' && i + 1 < argv.length) {
      args.limit = parseInt(argv[i + 1], 10) || 10;
      i++;
    } else if (!arg.startsWith('--')) {
      // Treat as positional argument (first positional = search term)
      if (positionalIndex === 0) {
        args.search = arg;
      }
      positionalIndex++;
    }
  }

  return args;
}

/**
 * Build the query URL for Gutendex API
 * @param {ReturnType<typeof parseArguments>} args
 * @returns {string}
 */
function buildQueryUrl(args) {
  const params = new URLSearchParams();

  if (args.search) {
    params.append('search', args.search);
  } else if (args.author) {
    params.append('search', args.author);
  }

  return `${BASE_URL}?${params.toString()}`;
}

/**
 * Extract and transform a Gutendex result into a candidate object
 * @param {GutendexResult} result
 * @returns {Candidate|null}
 */
function extractCandidate(result) {
  try {
    // Required fields
    if (!result.id || !result.title) {
      console.error(
        `[WARN] Skipping record: missing id or title in Gutendex result`
      );
      return null;
    }

    // Author extraction
    let author = null;
    let year = null;

    if (result.authors && result.authors.length > 0) {
      const firstAuthor = result.authors[0];
      author = firstAuthor.name || null;
      // Use birth year if available; if both birth and death are available, use birth (composition year)
      if (firstAuthor.birth_year !== null && firstAuthor.birth_year !== undefined) {
        year = firstAuthor.birth_year;
      } else if (firstAuthor.death_year !== null && firstAuthor.death_year !== undefined) {
        year = firstAuthor.death_year;
      }
    }

    // Format extraction
    const formats = result.formats || {};
    const epubUrl = formats['application/epub+zip'] || null;
    const htmlUrl = formats['text/html'] || null;

    // Source URL
    const sourceUrl = `${BASE_URL}/${result.id}`;

    // Subjects
    const subjects = result.subjects || [];

    return {
      title: result.title,
      author,
      year,
      gutenbergId: result.id,
      subjects,
      epubUrl,
      htmlUrl,
      sourceUrl,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[WARN] Error processing record: ${message}`);
    return null;
  }
}

/**
 * Main function: fetch and process candidates from Gutendex
 */
async function main() {
  const args = parseArguments();

  if (!args.search && !args.author) {
    console.error('[ERROR] No search term provided. Use --search or --author.');
    process.exit(1);
  }

  const url = buildQueryUrl(args);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error(
        `[ERROR] Gutendex API request failed: ${response.status} ${response.statusText}`
      );
      process.exit(1);
    }

    const data = await response.json();

    if (!data.results || !Array.isArray(data.results)) {
      console.error('[ERROR] Invalid response from Gutendex API: missing results array');
      process.exit(1);
    }

    const candidates = [];

    for (const result of data.results) {
      if (candidates.length >= args.limit) break;

      const candidate = extractCandidate(result);
      if (candidate) {
        candidates.push(candidate);
      }
    }

    console.log(JSON.stringify(candidates, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ERROR] Request failed: ${message}`);
    process.exit(1);
  }
}

main();
