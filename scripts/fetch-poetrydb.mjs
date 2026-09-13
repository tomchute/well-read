#!/usr/bin/env node

/**
 * fetch-poetrydb.mjs — CLI for querying the PoetryDB API
 * Fetches poem metadata and text from https://poetrydb.org
 *
 * Usage:
 *   node scripts/fetch-poetrydb.mjs "Robert Frost"
 *   node scripts/fetch-poetrydb.mjs --author "Robert Frost" [--limit 10]
 *   node scripts/fetch-poetrydb.mjs --title "Fire and Ice" [--limit 10]
 *   node scripts/fetch-poetrydb.mjs --author "Robert Frost" --title "Fire and Ice" [--limit 10]
 *
 * Output: JSON array to stdout with {title, author, lines, linecount, text, sourceUrl}
 *
 * Exit codes: non-zero only when the request itself fails (network error or a
 * non-OK / unparseable HTTP response). A successful request with no matching
 * poems prints an empty JSON array and exits 0. Malformed individual poem
 * entries are skipped with a warning to stderr (fail soft per item).
 *
 * @typedef {{title: string, author: string, lines: string[], linecount?: number}} PoetryDbPoem
 * @typedef {{title: string, author: string, lines: string[], linecount: number, text: string, sourceUrl: string}} Candidate
 */

const BASE_URL = 'https://poetrydb.org';

/**
 * Parse command-line arguments.
 * Supports both a bare positional author and flag-based options:
 *   node fetch-poetrydb.mjs "Robert Frost"
 *   node fetch-poetrydb.mjs --author "Robert Frost" --limit 5
 * @param {string[]} argv - arguments after the node/script path (process.argv.slice(2))
 * @returns {{author: string|null, title: string|null, limit: number}}
 */
export function parseArgs(argv) {
  const config = {
    author: null,
    title: null,
    limit: 10,
  };

  let positionalIndex = 0;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--author' && i + 1 < argv.length) {
      config.author = argv[++i];
    } else if (argv[i] === '--title' && i + 1 < argv.length) {
      config.title = argv[++i];
    } else if (argv[i] === '--limit' && i + 1 < argv.length) {
      const parsed = Number.parseInt(argv[++i], 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        config.limit = parsed;
      }
    } else if (!argv[i].startsWith('--')) {
      // Bare positional argument: first one is treated as author
      if (positionalIndex === 0) {
        config.author = argv[i];
        positionalIndex++;
      }
    }
  }

  return config;
}

/**
 * Build the PoetryDB request URL for the given author/title query.
 * @param {string|null} author
 * @param {string|null} title
 * @returns {string}
 */
export function buildRequestUrl(author, title) {
  let endpoint;
  if (author && title) {
    endpoint = `/author,title/${encodeURIComponent(author)};${encodeURIComponent(title)}`;
  } else if (author) {
    endpoint = `/author/${encodeURIComponent(author)}`;
  } else if (title) {
    endpoint = `/title/${encodeURIComponent(title)}`;
  } else {
    throw new Error('must specify --author or --title');
  }

  return `${BASE_URL}${endpoint}`;
}

/**
 * Fetch poems from the PoetryDB API.
 * Throws when the request itself fails: a network error, a non-OK HTTP
 * response, or a response body that isn't a recognizable PoetryDB shape.
 * A well-formed "no matches" response (PoetryDB returns a {status, reason}
 * object rather than an array) is not a failure — it resolves to [].
 * @param {string|null} author
 * @param {string|null} title
 * @returns {Promise<PoetryDbPoem[]>}
 */
async function fetchPoems(author, title) {
  const url = buildRequestUrl(author, title);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`PoetryDB API error (HTTP ${response.status}): ${url}`);
  }

  const data = await response.json();

  if (Array.isArray(data)) {
    return data;
  }

  // PoetryDB responds with an object like {status, reason} when nothing matches.
  if (data && typeof data === 'object' && 'status' in data) {
    return [];
  }

  throw new Error(`Unexpected PoetryDB response format from ${url}`);
}

/**
 * Transform a raw PoetryDB poem into the output candidate shape.
 * Returns null (and warns to stderr) for a malformed/incomplete entry
 * instead of throwing, so one bad item never aborts the whole run.
 * @param {PoetryDbPoem} poem
 * @returns {Candidate|null}
 */
export function transformPoem(poem) {
  try {
    if (!poem?.title || !poem.author || !poem.lines) {
      console.error(`Warning: skipping poem with missing fields: ${poem?.title ?? '(no title)'}`);
      return null;
    }

    const lines = Array.isArray(poem.lines) ? poem.lines : [];
    if (lines.length === 0) {
      console.error(`Warning: skipping poem with no lines: ${poem.title}`);
      return null;
    }

    return {
      title: poem.title,
      author: poem.author,
      lines,
      linecount: lines.length,
      text: lines.join('\n'),
      sourceUrl: `${BASE_URL}/title/${encodeURIComponent(poem.title)}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Warning: error transforming poem: ${message}`);
    return null;
  }
}

/**
 * Main
 */
async function main() {
  const config = parseArgs(process.argv.slice(2));

  if (!config.author && !config.title) {
    console.error('Error: must specify --author or --title');
    process.exit(1);
  }

  let poems;
  try {
    poems = await fetchPoems(config.author, config.title);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: PoetryDB request failed: ${message}`);
    process.exit(1);
    return;
  }

  const candidates = [];
  for (const poem of poems) {
    if (candidates.length >= config.limit) break;

    const transformed = transformPoem(poem);
    if (transformed) {
      candidates.push(transformed);
    }
  }

  console.log(JSON.stringify(candidates, null, 2));
}

const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Fatal error: ${message}`);
    process.exit(1);
  });
}
