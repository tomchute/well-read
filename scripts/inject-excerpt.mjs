#!/usr/bin/env node

/**
 * inject-excerpt.mjs
 *
 * Copies verbatim text from a source URL into `content/works/<id>.json`.
 * Verbatim literary text must never be typed by a model in this pipeline —
 * this script is the only thing allowed to write `text`/`excerpt` fields
 * with real source text, and it does so by fetching and mechanically
 * transforming bytes, never by generating prose.
 *
 * Reachable GitHub mirrors used as sources (see docs/open-source-reuse.md):
 *   - Standard Ebooks, e.g.
 *     https://raw.githubusercontent.com/standardebooks/jane-austen_pride-and-prejudice/master/src/epub/text/chapter-1.xhtml
 *   - GITenberg (Project Gutenberg mirror), e.g.
 *     https://raw.githubusercontent.com/GITenberg/Pride-and-Prejudice_1342/master/1342.txt
 *
 * Usage:
 *   node scripts/inject-excerpt.mjs --id <work-id> --url <raw-url> [--url <raw-url> ...] \
 *     [--mode excerpt|full] [--min 800] [--max 1500] [--start "<phrase>"] [--end "<phrase>"] \
 *     [--dir <works dir>]
 *
 * --mode excerpt (default): fetches and concatenates all --url bodies (in
 *   order), takes whole paragraphs until the word count is >= --min, stopping
 *   at the last paragraph boundary before exceeding --max. Writes `excerpt`
 *   and `excerptNote`, and records provenance in `source` (if `source.url` is
 *   empty or differs from the fetched URL — the existing `source.license` is
 *   never touched).
 * --mode full: writes the whole cleaned, concatenated text into `text` and
 *   removes `excerpt`/`excerptNote`. Also records provenance in `source`.
 *
 * No other field is ever touched. Key order of the work JSON is preserved
 * (read, mutate in place, write). The result is validated against
 * `WorkSchema` before writing; an invalid result is never written — the
 * script exits 1 and prints the validation issues instead.
 *
 * Source of truth: docs/content-schema.md, docs/editorial-policy.md
 * ("Text and excerpt rules", "Sources allowed for text").
 *
 * @typedef {{ excerpt: string, wordCount: number }} SlicedExcerpt
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorkSchema } from './lib/schema.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

export const DEFAULT_WORKS_DIR = join(REPO_ROOT, 'content', 'works');
export const DEFAULT_MIN_WORDS = 800;
export const DEFAULT_MAX_WORDS = 1500;

// -------- CLI argument parsing --------

/**
 * @param {string[]} args - argv slice (no `node`/script path entries)
 * @returns {{
 *   id: string|null, urls: string[], mode: string, min: number, max: number,
 *   start: string|null, end: string|null, dir: string|null
 * }}
 */
export function parseArguments(args) {
  const opts = {
    id: null,
    urls: [],
    mode: 'excerpt',
    min: DEFAULT_MIN_WORDS,
    max: DEFAULT_MAX_WORDS,
    start: null,
    end: null,
    dir: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--id' && i + 1 < args.length) {
      opts.id = args[++i];
    } else if (arg === '--url' && i + 1 < args.length) {
      opts.urls.push(args[++i]);
    } else if (arg === '--mode' && i + 1 < args.length) {
      opts.mode = args[++i];
    } else if (arg === '--min' && i + 1 < args.length) {
      opts.min = Number.parseInt(args[++i], 10);
    } else if (arg === '--max' && i + 1 < args.length) {
      opts.max = Number.parseInt(args[++i], 10);
    } else if (arg === '--start' && i + 1 < args.length) {
      opts.start = args[++i];
    } else if (arg === '--end' && i + 1 < args.length) {
      opts.end = args[++i];
    } else if (arg === '--dir' && i + 1 < args.length) {
      opts.dir = args[++i];
    }
  }

  return opts;
}

// -------- text counting --------

/** @param {string} text */
function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// -------- HTML entity decoding --------

/** @type {Record<string, string>} */
const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
  copy: '©',
};

/** @param {string} str */
function decodeEntities(str) {
  return str
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

// -------- source-format converters (pure) --------

const BLOCK_TAGS = [
  'p',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'blockquote',
  'section',
  'article',
  'header',
  'footer',
  'figcaption',
  'td',
  'tr',
  'table',
  'ul',
  'ol',
];
const BLOCK_CLOSE_RE = new RegExp(`</(?:${BLOCK_TAGS.join('|')})\\s*>`, 'gi');

/**
 * Convert XHTML/HTML to plain text: strips tags, decodes entities, separates
 * paragraphs with a blank line, and keeps `<br/>` as a single newline
 * (preserving verse line breaks within a paragraph).
 * @param {string} xhtml
 * @returns {string}
 */
export function xhtmlToText(xhtml) {
  let html = String(xhtml);

  // Drop non-content elements entirely.
  html = html.replace(/<(script|style|head)[^>]*>[\s\S]*?<\/\1>/gi, '');

  // Source-formatting whitespace (indentation/line-wrapping in the markup
  // itself) isn't semantic; collapse it before converting <br/> so real line
  // breaks aren't confused with layout whitespace.
  html = html.replace(/[\t\r\n]+/g, ' ');

  // Verse/explicit line breaks become single newlines.
  html = html.replace(/<br\s*\/?>/gi, '\n');

  // Paragraph/section boundaries: a blank line after each block-level close.
  html = html.replace(BLOCK_CLOSE_RE, '\n\n');

  // Strip all remaining tags.
  html = html.replace(/<[^>]+>/g, '');

  html = decodeEntities(html);

  const paragraphs = html
    .split(/\n{2,}/)
    .map((block) =>
      block
        .split('\n')
        .map((line) => line.replace(/[ \t]{2,}/g, ' ').trim())
        .filter((line) => line.length > 0)
        .join('\n')
    )
    .filter((block) => block.length > 0);

  return paragraphs.join('\n\n');
}

const GUTENBERG_START_RE = /\*\*\*\s*START OF (?:THE|THIS)[^\n]*\*\*\*/i;
const GUTENBERG_END_RE = /\*\*\*\s*END OF (?:THE|THIS)[^\n]*\*\*\*/i;

/**
 * Convert a Project Gutenberg / GITenberg plain-text file to plain text:
 * strips the `*** START OF ... ***` / `*** END OF ... ***` header and
 * footer markers (and everything outside them), then rejoins
 * line-wrapped prose into one line per paragraph, paragraphs separated
 * by a blank line.
 * @param {string} raw
 * @returns {string}
 */
export function gutenbergToText(raw) {
  let text = String(raw).replace(/\r\n/g, '\n');

  const startMatch = GUTENBERG_START_RE.exec(text);
  if (startMatch) {
    text = text.slice(startMatch.index + startMatch[0].length);
  }

  const endMatch = GUTENBERG_END_RE.exec(text);
  if (endMatch) {
    text = text.slice(0, endMatch.index);
  }

  const paragraphs = text
    .split(/\n{2,}/)
    .map((block) =>
      block
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .join(' ')
    )
    .filter((block) => block.length > 0);

  return paragraphs.join('\n\n');
}

// -------- excerpt slicing (pure) --------

/**
 * Slice `text` (paragraphs separated by a blank line) down to an excerpt:
 * optionally starts at the first paragraph containing `start` (throws if
 * not found — the caller asked to skip to a specific point and it isn't
 * there), optionally hard-stops before the first paragraph containing `end`
 * (silently ignored if not found — it's just a safety net), then takes
 * whole paragraphs until the word count is >= `min`, stopping at the last
 * paragraph boundary before exceeding `max`.
 * @param {string} text
 * @param {{ min?: number, max?: number, start?: string|null, end?: string|null }} [options]
 * @returns {SlicedExcerpt}
 */
export function sliceExcerpt(text, options = {}) {
  const { min = DEFAULT_MIN_WORDS, max = DEFAULT_MAX_WORDS, start = null, end = null } = options;

  let paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0);

  if (start) {
    const needle = start.toLowerCase();
    const index = paragraphs.findIndex((p) => p.toLowerCase().includes(needle));
    if (index === -1) {
      throw new Error(`--start phrase not found in fetched text: ${JSON.stringify(start)}`);
    }
    paragraphs = paragraphs.slice(index);
  }

  if (end) {
    const needle = end.toLowerCase();
    const index = paragraphs.findIndex((p) => p.toLowerCase().includes(needle));
    if (index !== -1) {
      paragraphs = paragraphs.slice(0, index);
    }
  }

  const included = [];
  let wordCount = 0;
  for (const paragraph of paragraphs) {
    const paragraphWords = countWords(paragraph);
    if (wordCount >= min && wordCount + paragraphWords > max) {
      break;
    }
    included.push(paragraph);
    wordCount += paragraphWords;
    if (wordCount >= max) {
      break;
    }
  }

  return { excerpt: included.join('\n\n'), wordCount };
}

// -------- fetching --------

/**
 * Fetch one source URL and convert it to plain text, choosing the converter
 * from the URL's extension (`.txt` -> Gutenberg/GITenberg plain text;
 * anything else -> XHTML/HTML).
 * @param {string} url
 * @returns {Promise<string>}
 */
async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`fetch failed for ${url}: HTTP ${response.status}`);
  }
  const body = await response.text();
  return /\.txt(?:$|[?#])/i.test(url) ? gutenbergToText(body) : xhtmlToText(body);
}

/**
 * Derive a human-readable source name and a `host/owner/repo` string from a
 * raw.githubusercontent.com (or similar) URL, for `excerptNote` and
 * `source.name`.
 * @param {string} url
 * @returns {{ hostRepo: string, name: string }}
 */
export function describeSource(url) {
  const parsed = new URL(url);
  const segments = parsed.pathname.split('/').filter(Boolean);
  const owner = segments[0] ?? '';
  const repo = segments[1] ?? '';
  const hostRepo = [parsed.hostname, owner, repo].filter(Boolean).join('/');

  let name = hostRepo;
  if (owner.toLowerCase() === 'standardebooks') {
    name = 'Standard Ebooks (GitHub mirror)';
  } else if (owner.toLowerCase() === 'gitenberg') {
    name = 'Project Gutenberg (GITenberg mirror)';
  }

  return { hostRepo, name };
}

/** @param {Date} [now] */
function isoToday(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

// -------- main operation --------

/**
 * @typedef {{
 *   id: string, urls: string[], mode?: string, min?: number, max?: number,
 *   start?: string|null, end?: string|null, dir?: string, now?: Date
 * }} InjectExcerptOptions
 * @typedef {{ workPath: string, mode: string, totalWords: number, excerptWordCount: number|null }} InjectExcerptResult
 */

/**
 * Read `<dir>/<id>.json`, fetch and concatenate `urls`, inject the resulting
 * text as an excerpt or the full text, validate against `WorkSchema`, and
 * write the file back (preserving key order) — or throw and leave the file
 * untouched if the result would be invalid.
 * @param {InjectExcerptOptions} options
 * @returns {Promise<InjectExcerptResult>}
 */
export async function injectExcerpt(options) {
  const {
    id,
    urls,
    mode = 'excerpt',
    min = DEFAULT_MIN_WORDS,
    max = DEFAULT_MAX_WORDS,
    start = null,
    end = null,
    dir = DEFAULT_WORKS_DIR,
    now = new Date(),
  } = options;

  if (!id) {
    throw new Error('--id is required');
  }
  if (!urls || urls.length === 0) {
    throw new Error('--url is required (one or more)');
  }
  if (mode !== 'excerpt' && mode !== 'full') {
    throw new Error(`--mode must be "excerpt" or "full" (got "${mode}")`);
  }

  const workPath = join(dir, `${id}.json`);
  const raw = await readFile(workPath, 'utf8');
  /** @type {Record<string, unknown>} */
  const work = JSON.parse(raw);

  const texts = [];
  for (const url of urls) {
    texts.push(await fetchText(url));
  }
  const fullText = texts.join('\n\n');
  const totalWords = countWords(fullText);

  let excerptWordCount = null;
  if (mode === 'full') {
    work.text = fullText;
    delete work.excerpt;
    delete work.excerptNote;
  } else {
    const sliced = sliceExcerpt(fullText, { min, max, start, end });
    const { hostRepo } = describeSource(urls[0]);
    work.excerpt = sliced.excerpt;
    work.excerptNote = `Opening ${sliced.wordCount} words of ${totalWords} (source: ${hostRepo})`;
    excerptWordCount = sliced.wordCount;
  }

  const { name } = describeSource(urls[0]);
  const source = /** @type {{ url?: string, name?: string, retrievedDate?: string }} */ (
    work.source ?? {}
  );
  if (!source.url || source.url !== urls[0]) {
    source.name = name;
    source.url = urls[0];
    source.retrievedDate = isoToday(now);
    work.source = source;
  }

  const result = WorkSchema.safeParse(work);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`refusing to write ${workPath}: failed WorkSchema validation (${issues})`);
  }

  await writeFile(workPath, `${JSON.stringify(work, null, 2)}\n`);

  return { workPath, mode, totalWords, excerptWordCount };
}

/**
 * Main
 */
async function main() {
  const opts = parseArguments(process.argv.slice(2));

  try {
    const result = await injectExcerpt(opts);
    if (result.mode === 'full') {
      console.log(`[inject-excerpt] wrote full text (${result.totalWords} words) to ${result.workPath}`);
    } else {
      console.log(
        `[inject-excerpt] wrote excerpt (${result.excerptWordCount} of ${result.totalWords} words) to ${result.workPath}`
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Fatal error: ${message}`);
    process.exit(1);
  });
}
