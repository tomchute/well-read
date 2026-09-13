#!/usr/bin/env node

/**
 * Fetch candidates from Standard Ebooks OPDS feed
 * Usage: node fetch-standard-ebooks.mjs [--author <name>] [--title <term>] [--limit N]
 *
 * Outputs JSON array to stdout
 * Logs errors to stderr and continues (fail soft per entry)
 */

const OPDS_URL = 'https://standardebooks.org/feeds/opds';

/**
 * Parse command-line arguments
 */
function parseArgs(argv) {
  const args = {
    author: null,
    title: null,
    limit: 10,
  };

  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--author' && i + 1 < argv.length) {
      args.author = argv[++i];
    } else if (argv[i] === '--title' && i + 1 < argv.length) {
      args.title = argv[++i];
    } else if (argv[i] === '--limit' && i + 1 < argv.length) {
      args.limit = parseInt(argv[++i], 10);
    }
  }

  return args;
}

/**
 * Extract text between XML tags with basic error handling
 */
function extractXmlText(xml, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Extract all entries from Atom feed
 */
function extractEntries(xml) {
  const entryRegex = /<entry[^>]*>.*?<\/entry>/gs;
  const entries = xml.match(entryRegex) || [];
  return entries;
}

/**
 * Extract author name from entry
 */
function extractAuthor(entryXml) {
  const authorRegex = /<author[^>]*>(.*?)<\/author>/is;
  const authorMatch = entryXml.match(authorRegex);
  if (authorMatch) {
    const nameMatch = authorMatch[1].match(/<name[^>]*>([^<]+)<\/name>/i);
    return nameMatch ? nameMatch[1].trim() : null;
  }
  return null;
}

/**
 * Extract all links from entry
 */
function extractLinks(entryXml) {
  const links = {};
  const linkRegex = /<link[^>]*href="([^"]*)"[^>]*(?:rel="([^"]*)")?[^>]*(?:type="([^"]*)")?/g;
  let match;

  while ((match = linkRegex.exec(entryXml)) !== null) {
    const href = match[1];
    const rel = match[2] || '';
    const type = match[3] || '';

    // Main page (alternate)
    if (rel === 'alternate' && !links.pageUrl) {
      links.pageUrl = href;
    }

    // EPUB download
    if (type.includes('epub')) {
      links.epubUrl = href;
    }

    // KEPUB download (Kobo format)
    if (type.includes('kepub')) {
      links.kepubUrl = href;
    }
  }

  return links;
}

/**
 * Extract license/rights information
 */
function extractLicense(entryXml) {
  // Standard Ebooks publishes public-domain works
  // Check for rights element
  const rightsMatch = entryXml.match(/<rights[^>]*>([^<]+)<\/rights>/i);
  if (rightsMatch) {
    const rights = rightsMatch[1].toLowerCase();
    if (rights.includes('public domain') || rights.includes('public-domain')) {
      return 'public-domain';
    }
  }

  // Default to public-domain since Standard Ebooks only publishes PD works
  return 'public-domain';
}

/**
 * Parse a single entry from Atom feed
 */
function parseEntry(entryXml) {
  try {
    const title = extractXmlText(entryXml, 'title');
    const author = extractAuthor(entryXml);
    const links = extractLinks(entryXml);
    const license = extractLicense(entryXml);

    if (!title) {
      console.error('Warning: Entry missing title, skipping');
      return null;
    }

    return {
      title,
      author: author || 'Unknown',
      url: links.pageUrl || null,
      epubUrl: links.epubUrl || null,
      license,
    };
  } catch (error) {
    console.error(`Warning: Failed to parse entry: ${error.message}`);
    return null;
  }
}

/**
 * Filter candidates based on search criteria (case-insensitive substring match)
 */
function filterCandidates(candidates, args) {
  return candidates.filter((candidate) => {
    if (args.author) {
      if (!candidate.author.toLowerCase().includes(args.author.toLowerCase())) {
        return false;
      }
    }
    if (args.title) {
      if (!candidate.title.toLowerCase().includes(args.title.toLowerCase())) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Main function
 */
async function main() {
  const args = parseArgs(process.argv);

  try {
    // Build query parameters
    const params = new URLSearchParams();
    if (args.title) {
      params.append('query', args.title);
    }
    if (args.author) {
      params.append('query', args.author);
    }

    const url = `${OPDS_URL}?${params.toString()}`;

    // Fetch feed
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch OPDS feed: HTTP ${response.status} ${response.statusText}`,
      );
    }

    const xml = await response.text();

    // Parse entries
    const entries = extractEntries(xml);
    const candidates = entries
      .map((entry) => parseEntry(entry))
      .filter((candidate) => candidate !== null)
      .slice(0, args.limit);

    // Filter candidates based on search criteria
    const filtered = filterCandidates(candidates, args).slice(0, args.limit);

    // Output JSON
    console.log(JSON.stringify(filtered, null, 2));
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.log(JSON.stringify([], null, 2));
    process.exit(0); // Soft fail
  }
}

main().catch((error) => {
  console.error(`Unexpected error: ${error.message}`);
  console.log(JSON.stringify([], null, 2));
  process.exit(0);
});
