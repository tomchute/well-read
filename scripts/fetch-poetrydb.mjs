#!/usr/bin/env node

/**
 * fetch-poetrydb.mjs — CLI for querying the PoetryDB API
 * Fetches poem metadata and text from https://poetrydb.org
 *
 * Usage:
 *   node scripts/fetch-poetrydb.mjs --author "Robert Frost" [--limit 10]
 *   node scripts/fetch-poetrydb.mjs --title "Fire" [--limit 10]
 *   node scripts/fetch-poetrydb.mjs --author "Robert Frost" --title "Fire" [--limit 10]
 *
 * Output: JSON array to stdout with {title, author, lines[], linecount, text, sourceUrl}
 */

const BASE_URL = 'https://poetrydb.org';

/**
 * Parse CLI arguments
 * Supports both positional and flag-based formats:
 *   node fetch-poetrydb.mjs "Robert Frost"
 *   node fetch-poetrydb.mjs --author "Robert Frost" --limit 5
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    author: null,
    title: null,
    limit: 10,
  };

  let positionalIndex = 0;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--author' && i + 1 < args.length) {
      config.author = args[++i];
    } else if (args[i] === '--title' && i + 1 < args.length) {
      config.title = args[++i];
    } else if (args[i] === '--limit' && i + 1 < args.length) {
      const parsed = parseInt(args[++i], 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        config.limit = parsed;
      }
    } else if (!args[i].startsWith('--')) {
      // Positional argument: first one is author
      if (positionalIndex === 0) {
        config.author = args[i];
        positionalIndex++;
      }
    }
  }

  return config;
}

/**
 * Fetch from PoetryDB API
 * Returns array of poems or empty array on error
 */
async function fetchPoems(author, title) {
  try {
    let endpoint;
    if (author && title) {
      // Both author and title: use the combined endpoint
      endpoint = `/author,title/${encodeURIComponent(author)};${encodeURIComponent(title)}`;
    } else if (author) {
      endpoint = `/author/${encodeURIComponent(author)}`;
    } else if (title) {
      endpoint = `/title/${encodeURIComponent(title)}`;
    } else {
      console.error('Error: must specify --author or --title', { file: 'stderr' });
      return [];
    }

    const url = `${BASE_URL}${endpoint}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`PoetryDB API error (HTTP ${response.status}): ${url}`, { file: 'stderr' });
      return [];
    }

    const data = await response.json();

    // PoetryDB returns {poems: [...]} for search results
    if (!Array.isArray(data)) {
      if (data.poems && Array.isArray(data.poems)) {
        return data.poems;
      }
      console.error('Unexpected PoetryDB response format', { file: 'stderr' });
      return [];
    }

    return data;
  } catch (error) {
    console.error(`PoetryDB fetch error: ${error.message}`, { file: 'stderr' });
    return [];
  }
}

/**
 * Transform a PoetryDB poem into the output format
 */
function transformPoem(poem) {
  try {
    // Ensure required fields exist
    if (!poem.title || !poem.author || !poem.lines) {
      console.error(`Warning: skipping poem with missing fields: ${poem.title || '(no title)'}`, { file: 'stderr' });
      return null;
    }

    // lines should be an array
    const lines = Array.isArray(poem.lines) ? poem.lines : [];
    if (lines.length === 0) {
      console.error(`Warning: skipping poem with no lines: ${poem.title}`, { file: 'stderr' });
      return null;
    }

    const text = lines.join('\n');
    const sourceUrl = poem.linecount
      ? `${BASE_URL}/poems/${encodeURIComponent(poem.title.replace(/\s+/g, '-').toLowerCase())}`
      : `${BASE_URL}`;

    return {
      title: poem.title,
      author: poem.author,
      lines,
      linecount: lines.length,
      text,
      sourceUrl,
    };
  } catch (error) {
    console.error(`Warning: error transforming poem: ${error.message}`, { file: 'stderr' });
    return null;
  }
}

/**
 * Main
 */
async function main() {
  const config = parseArgs();

  if (!config.author && !config.title) {
    console.error('Error: must specify --author or --title', { file: 'stderr' });
    console.log(JSON.stringify([]));
    process.exit(1);
  }

  // Fetch poems from PoetryDB
  const poems = await fetchPoems(config.author, config.title);

  if (poems.length === 0) {
    console.log(JSON.stringify([]));
    return;
  }

  // Transform and filter: apply limit and skip invalid entries
  const candidates = [];
  for (const poem of poems) {
    if (candidates.length >= config.limit) break;

    const transformed = transformPoem(poem);
    if (transformed) {
      candidates.push(transformed);
    }
  }

  // Output JSON array to stdout
  console.log(JSON.stringify(candidates, null, 2));
}

main().catch((error) => {
  console.error(`Fatal error: ${error.message}`, { file: 'stderr' });
  console.log(JSON.stringify([]));
  process.exit(1);
});
