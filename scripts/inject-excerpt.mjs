#!/usr/bin/env node

/**
 * inject-excerpt.mjs
 *
 * Copies verbatim text from a raw GitHub or web page URL, or a local file,
 * into `content/works/<id>.json`. Verbatim literary text must never be typed
 * by a model in this pipeline — this script is the only thing allowed to
 * write `text`/`excerpt` fields with real source text, and it does so by
 * fetching and mechanically transforming bytes, never by generating prose.
 *
 * Reachable GitHub mirrors used as sources (see docs/open-source-reuse.md):
 *   - Standard Ebooks, e.g.
 *     https://raw.githubusercontent.com/standardebooks/jane-austen_pride-and-prejudice/master/src/epub/text/chapter-1.xhtml
 *   - GITenberg (Project Gutenberg mirror), e.g.
 *     https://raw.githubusercontent.com/GITenberg/Pride-and-Prejudice_1342/master/1342.txt
 *
 * `--url` also accepts any other https page (the publisher's own site, Poetry
 * Foundation, poets.org, a magazine of record). This is a private, single-user
 * app (see docs/editorial-policy.md, "Sources for in-copyright text"), so text
 * visible on the open web may be copied by script — the model itself still
 * never types it. A non-raw-GitHub URL is fetched with a browser-like
 * User-Agent/Accept header and a 20s timeout, then routed by host and by the
 * work's `type`: poetryfoundation.org, poets.org, or any `type: 'poem'` work
 * uses `htmlPoemExtract`; everything else uses `htmlArticleExtract`. Either
 * way the result feeds the same paragraph-based excerpt slicing as the
 * GitHub-mirror path. Provenance (`source.name/url/retrievedDate` and an
 * `externalLinks` entry) is recorded automatically for the fetched page.
 *
 * Usage:
 *   node scripts/inject-excerpt.mjs --id <work-id> (--url <url> | --file <path>) \
 *     [--url <url> | --file <path> ...] \
 *     [--mode excerpt|full] [--min 800] [--max 1500] [--start "<phrase>"] [--end "<phrase>"] \
 *     [--dir <works dir>]
 *
 * --url: fetch text from a raw GitHub URL, or any other https page (repeatable).
 * --file: read text from a local file (repeatable, mutually exclusive with --url).
 *   File extension determines handling: .xhtml/.html use HTML parser; files
 *   containing *** START/END markers use Gutenberg format; otherwise plain text
 *   with paragraphs separated by blank lines, single newlines preserved as verse.
 *
 * --mode excerpt (default): fetches/reads and concatenates all --url/--file sources
 *   (in order), takes whole paragraphs until the word count is >= --min, stopping
 *   at the last paragraph boundary before exceeding --max. Writes `excerpt`
 *   and `excerptNote`, and records provenance in `source` (if `source.url` is
 *   empty or differs — the existing `source.license` is never touched).
 * --mode full: writes the whole cleaned, concatenated text into `text` and
 *   removes `excerpt`/`excerptNote`. Also records provenance in `source`.
 *
 * No other field is ever touched. Key order of the work JSON is preserved
 * (read, mutate in place, write). The result is validated against
 * `WorkSchema` before writing; an invalid result is never written — the
 * script exits 1 and prints the validation issues instead.
 *
 * Source of truth: docs/content-schema.md, docs/editorial-policy.md
 * ("Text and excerpt rules", "Sources allowed for text", "Sources for
 * in-copyright text").
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
 *   id: string|null, urls: string[], files: string[], mode: string, min: number, max: number,
 *   start: string|null, end: string|null, dir: string|null
 * }}
 */
export function parseArguments(args) {
  const opts = {
    id: null,
    urls: [],
    files: [],
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
    } else if (arg === '--file' && i + 1 < args.length) {
      opts.files.push(args[++i]);
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

// Tolerant of both modern marker phrasings ("START OF THE PROJECT GUTENBERG
// EBOOK" / "START OF THIS PROJECT GUTENBERG EBOOK") and the pre-1997
// "small print" era, whose boilerplate ends with a "*END*THE SMALL
// PRINT...*END*" marker instead of a "*** START OF ... ***" line.
const GUTENBERG_START_RE =
  /\*\*\*\s*START OF (?:THE|THIS)\s+PROJECT GUTENBERG[^\n]*\*\*\*|\*END\*\s*THE SMALL PRINT!?[\s\S]*?\*END\*/i;
const GUTENBERG_END_RE = /\*\*\*\s*END OF (?:THE|THIS)\s+PROJECT GUTENBERG[^\n]*\*\*\*/i;

/**
 * A block reads as verse (a poem stanza) rather than word-wrapped prose when
 * every one of its lines is indented — Gutenberg plain-text poetry is
 * conventionally indented on every line, whereas hard-wrapped prose is
 * indented (if at all) only on a paragraph's first line, with continuation
 * lines flush left.
 * @param {string[]} rawLines - non-blank lines of one block, before trimming
 */
function isVerseBlock(rawLines) {
  return rawLines.length > 1 && rawLines.every((line) => /^[ \t]/.test(line));
}

/**
 * Convert a Project Gutenberg / GITenberg plain-text file to plain text:
 * strips the `*** START OF ... ***` / `*** END OF ... ***` header and
 * footer markers (and everything outside them), then rejoins line-wrapped
 * prose into one line per paragraph (paragraphs separated by a blank line),
 * while preserving verse line breaks within an indented (poem) block.
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
    .map((block) => {
      const rawLines = block.split('\n').filter((line) => line.trim().length > 0);
      const trimmedLines = rawLines.map((line) => line.trim());
      return trimmedLines.join(isVerseBlock(rawLines) ? '\n' : ' ');
    })
    .filter((block) => block.length > 0);

  return paragraphs.join('\n\n');
}

/**
 * Convert plain text to plain text: splits by blank lines (2+ newlines),
 * trims each line, and preserves single newlines within paragraphs for verse.
 * @param {string} raw
 * @returns {string}
 */
export function plainTextToText(raw) {
  const text = String(raw).replace(/\r\n/g, '\n');

  const paragraphs = text
    .split(/\n{2,}/)
    .map((block) =>
      block
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .join('\n')
    )
    .filter((block) => block.length > 0);

  return paragraphs.join('\n\n');
}

// -------- excerpt slicing (pure) --------

/**
 * Collapse all whitespace runs (including line breaks) to a single space,
 * lowercase, and trim. Used only to *locate* --start/--end phrases that a
 * source has hard-wrapped across a line break; the stored/returned text is
 * never altered by this.
 * @param {string} str
 */
function normalizeForMatch(str) {
  return str.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** A numeral/roman-numeral heading glued to the front of a paragraph, e.g. "II Time does not...". */
const LEADING_NUMERAL_RE = /^\s*([IVXLC]+|\d+)\.?\s+/i;

/**
 * True for a short, punctuation-less paragraph that reads as a heading or
 * section number rather than prose/verse content — a bare roman numeral
 * ("XI"), a bare number ("11."), or any paragraph of 6 words or fewer with
 * no terminal sentence punctuation (a title line like "Contents" or a poem
 * heading).
 * @param {string} paragraph
 */
function isHeadingLikeParagraph(paragraph) {
  const normalized = paragraph.replace(/\s+/g, ' ').trim();
  if (!normalized) return false;
  if (/^[IVXLC]+\.?$/i.test(normalized)) return true;
  if (/^\d+\.?$/.test(normalized)) return true;
  const words = normalized.split(' ').filter(Boolean);
  const endsWithTerminalPunctuation = /[.!?]["'’”)\]]?$/.test(normalized);
  return words.length <= 6 && !endsWithTerminalPunctuation;
}

/** Generous upper bound on an epigraph/attribution quote's length, to tell it apart from a real stanza. */
const SANDWICHED_QUOTE_MAX_WORDS = 60;

/**
 * Drop trailing front matter from the *next* section that --end pulled in:
 * repeatedly pop a heading-like trailing paragraph, and pop a short
 * non-heading paragraph too when it directly follows a heading-like one
 * (an epigraph quote sitting between a section's title and its short
 * attribution/numeral, e.g. title / quote / "The Jew of Malta" / "I").
 * Mutates and returns `paragraphs`.
 * @param {string[]} paragraphs
 */
function trimTrailingFrontMatter(paragraphs) {
  while (paragraphs.length > 1) {
    const lastIndex = paragraphs.length - 1;
    if (isHeadingLikeParagraph(paragraphs[lastIndex])) {
      paragraphs.pop();
      continue;
    }
    const precededByHeading = lastIndex >= 1 && isHeadingLikeParagraph(paragraphs[lastIndex - 1]);
    const isShortQuote = countWords(paragraphs[lastIndex]) <= SANDWICHED_QUOTE_MAX_WORDS;
    if (precededByHeading && isShortQuote) {
      paragraphs.pop();
      continue;
    }
    break;
  }
  return paragraphs;
}

/**
 * Slice `text` (paragraphs separated by a blank line) down to an excerpt:
 * optionally starts at the first paragraph containing `start` (throws if
 * not found — the caller asked to skip to a specific point and it isn't
 * there), optionally hard-stops before the first paragraph containing `end`
 * (silently ignored if not found — it's just a safety net), then takes
 * whole paragraphs until the word count is >= `min`, stopping at the last
 * paragraph boundary before exceeding `max`.
 *
 * `start`/`end` are located against a whitespace-normalised copy of each
 * paragraph (so a phrase the source hard-wrapped across a line break, e.g.
 * Gutenberg's ~70-column .txt wrapping, still matches) without altering the
 * paragraph text itself. Once sliced, a heading-like numeral prefix glued to
 * the start paragraph (e.g. "II Time does not bring relief...") is
 * stripped, and any leftover heading-like paragraphs (a bare numeral, or a
 * short titleless line — commonly the next section's heading, dragged in
 * because --end matched a phrase in the following section) are dropped from
 * both ends of the result.
 * @param {string} text
 * @param {{ min?: number, max?: number, start?: string|null, end?: string|null }} [options]
 * @returns {SlicedExcerpt}
 */
export function sliceExcerpt(text, options = {}) {
  const { min = DEFAULT_MIN_WORDS, max = DEFAULT_MAX_WORDS, start = null, end = null } = options;

  let paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0);

  if (start) {
    const needle = normalizeForMatch(start);
    const index = paragraphs.findIndex((p) => normalizeForMatch(p).includes(needle));
    if (index === -1) {
      throw new Error(`--start phrase not found in fetched text: ${JSON.stringify(start)}`);
    }
    paragraphs = paragraphs.slice(index);

    const numeralMatch = LEADING_NUMERAL_RE.exec(paragraphs[0]);
    if (numeralMatch) {
      const rest = paragraphs[0].slice(numeralMatch[0].length);
      if (normalizeForMatch(rest).startsWith(needle)) {
        paragraphs[0] = rest;
      }
    }
  }

  if (end) {
    const needle = normalizeForMatch(end);
    const index = paragraphs.findIndex((p) => normalizeForMatch(p).includes(needle));
    if (index !== -1) {
      paragraphs = paragraphs.slice(0, index);
    }
  }

  trimTrailingFrontMatter(paragraphs);
  if (paragraphs.length > 1 && isHeadingLikeParagraph(paragraphs[0])) {
    paragraphs.shift();
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

// -------- generic HTML tree parsing (pure) --------
//
// A small, tolerant HTML tokenizer/tree-builder used by htmlPoemExtract and
// htmlArticleExtract. It is not a validating parser: it assumes reasonably
// well-formed markup (as real site HTML and our fixtures are), tracks a tag
// stack, and is forgiving of mismatches (it pops through them rather than
// throwing). Good enough to locate elements by tag/class/data-attribute and
// walk their children in document order.

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

const NON_CONTENT_TAGS = ['script', 'style', 'nav', 'header', 'footer', 'aside', 'noscript'];
const NON_CONTENT_RE = new RegExp(
  `<(${NON_CONTENT_TAGS.join('|')})\\b[^>]*>[\\s\\S]*?</\\1\\s*>`,
  'gi'
);

/**
 * Remove script/style/nav/header/footer/aside/noscript elements (tag and
 * content) entirely.
 * @param {string} html
 */
function stripNonContentTags(html) {
  return html.replace(NON_CONTENT_RE, '');
}

/**
 * @typedef {{ tag: string, attrs: string, children: HtmlNode[] } | { tag: '#text', text: string }} HtmlNode
 */

/**
 * Parse HTML into a tolerant element tree (tag/attrs/children), returning a
 * `#root` node. Not a validating parser — see module note above.
 * @param {string} html
 * @returns {HtmlNode}
 */
function parseHtmlTree(html) {
  const root = { tag: '#root', attrs: '', children: [] };
  const stack = [root];
  const tagRe = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w:-]*)\b([^>]*?)(\/)?>/g;
  let lastIndex = 0;

  const pushText = (text) => {
    if (!text) return;
    stack[stack.length - 1].children.push({ tag: '#text', text });
  };

  for (let match = tagRe.exec(html); match !== null; match = tagRe.exec(html)) {
    pushText(html.slice(lastIndex, match.index));
    lastIndex = tagRe.lastIndex;

    if (match[0].startsWith('<!--')) continue;

    const [, closingSlash, rawTagName, attrs, selfClosing] = match;
    const tagName = rawTagName.toLowerCase();

    if (closingSlash === '/') {
      for (let i = stack.length - 1; i >= 1; i--) {
        if (stack[i].tag === tagName) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    const node = { tag: tagName, attrs: attrs || '', children: [] };
    stack[stack.length - 1].children.push(node);
    if (!(VOID_TAGS.has(tagName) || selfClosing === '/')) {
      stack.push(node);
    }
  }
  pushText(html.slice(lastIndex));
  return root;
}

/**
 * Collect every descendant element (not text nodes) matching `predicate`, in
 * document (preorder) order.
 * @param {HtmlNode} root
 * @param {(node: HtmlNode) => boolean} predicate
 * @param {HtmlNode[]} [results]
 */
function findAll(root, predicate, results = []) {
  for (const child of root.children) {
    if (child.tag === '#text') continue;
    if (predicate(child)) results.push(child);
    findAll(child, predicate, results);
  }
  return results;
}

/**
 * Render an element's full descendant text, decoding entities and turning
 * `<br>` into `\n` (or a space, if `brNewline` is false).
 * @param {HtmlNode} node
 * @param {{ brNewline?: boolean, decode?: (s: string) => string }} [opts]
 */
function elementText(node, opts = {}) {
  const { brNewline = true, decode = decodeEntities } = opts;
  let out = '';
  for (const child of node.children) {
    if (child.tag === '#text') {
      out += decode(child.text);
    } else if (child.tag === 'br') {
      out += brNewline ? '\n' : ' ';
    } else {
      out += elementText(child, opts);
    }
  }
  return out;
}

/**
 * Like `decodeEntities`, but decodes `&nbsp;` to a real non-breaking-space
 * character instead of a plain space, so a run of them (used by publishers
 * for indentation) survives ASCII-whitespace collapsing and is only turned
 * into plain spaces at the very end — preserving the indentation's width.
 * @param {string} str
 */
function decodePoemEntities(str) {
  return str
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&([a-zA-Z]+);/g, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

// -------- htmlPoemExtract (pure) --------

const SHORT_LINE_MAX_CHARS = 120;
const MIN_SHORT_LINES = 4;
const POEM_CLASS_OR_DATA_ATTR_RE = /class\s*=\s*(["'])[^"']*poem[^"']*\1|\bdata-[\w-]*poem[\w-]*/i;
const POEM_CONTAINER_TAGS = new Set(['div', 'section', 'article', 'p']);
const GENERIC_BLOCK_TAGS = new Set(['div', 'p', 'section', 'article', 'td', 'li']);
const ATTRIBUTION_RE = /^(?:copyright|from\s|source:|credit|reprinted)/i;

/** @param {HtmlNode} node */
function isPoemContainerCandidate(node) {
  return POEM_CONTAINER_TAGS.has(node.tag) && POEM_CLASS_OR_DATA_ATTR_RE.test(node.attrs || '');
}

/**
 * Site-aware containers first: an element whose class or data attribute
 * contains "poem" (covers poetryfoundation's `div.o-poem`/`[class*="PoemBody"]`/
 * `[data-poem]` and poets.org's `.poem__body`/`[class*="poem-body"]` — all are
 * "class or data attribute contains poem", case-insensitively). Deepest match
 * wins if more than one is nested.
 * @param {HtmlNode} tree
 */
function findSiteAwarePoemContainer(tree) {
  const matches = findAll(tree, isPoemContainerCandidate);
  return matches.length > 0 ? matches[matches.length - 1] : null;
}

/** A block element's short-line count via its own `<br>`-separated lines. @param {HtmlNode} node */
function scoreByBr(node) {
  const lines = elementText(node)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim());
  return lines.filter((line) => line.length > 0 && line.length <= SHORT_LINE_MAX_CHARS).length;
}

/** A block element's short-line count via direct `<div>`/`<p>` children. @param {HtmlNode} node */
function scoreByChildren(node) {
  let count = 0;
  for (const child of node.children) {
    if (child.tag !== 'div' && child.tag !== 'p') continue;
    const text = elementText(child).replace(/\s+/g, ' ').trim();
    if (text.length > 0 && text.length <= SHORT_LINE_MAX_CHARS) count++;
  }
  return count;
}

/**
 * Generic fallback: among candidate block elements, the one with the most
 * short lines (>= MIN_SHORT_LINES), scored by whichever method (`<br>` lines,
 * or short `<div>`/`<p>` children) finds more.
 * @param {HtmlNode} tree
 */
function findGenericPoemContainer(tree) {
  const candidates = findAll(tree, (node) => GENERIC_BLOCK_TAGS.has(node.tag));
  let best = null;
  let bestScore = MIN_SHORT_LINES - 1;
  for (const node of candidates) {
    const score = Math.max(scoreByBr(node), scoreByChildren(node));
    if (score > bestScore) {
      bestScore = score;
      best = node;
    }
  }
  return best;
}

/**
 * Render a poem container's lines: text and `<br>` are read in document
 * order, a `<br>` ends a line, and a `<div>`/`<p>` child always starts and
 * ends its own line (so an empty one becomes a blank line, and two `<br>`s in
 * a row also produce a blank line between them, i.e. a stanza break).
 * @param {HtmlNode} node
 * @returns {string[]}
 */
function renderPoemLines(node) {
  const lines = [];
  let current = '';

  const flush = () => {
    lines.push(current);
    current = '';
  };

  const walk = (n) => {
    for (const child of n.children) {
      if (child.tag === '#text') {
        // A text node that is pure whitespace is inter-tag markup formatting
        // (e.g. the newline/indentation between two sibling <div> lines,
        // already collapsed to a single space) rather than content — it must
        // not trigger a spurious flush before the next sibling.
        const decoded = decodePoemEntities(child.text);
        if (decoded.trim().length > 0) {
          current += decoded;
        }
      } else if (child.tag === 'br') {
        flush();
      } else if (child.tag === 'div' || child.tag === 'p') {
        if (current.length > 0) flush();
        walk(child);
        flush();
      } else {
        walk(child);
      }
    }
  };

  walk(node);
  if (current.length > 0) flush();
  return lines;
}

/**
 * Trim source-formatting whitespace from one rendered poem line while
 * preserving `&nbsp;`-derived leading indentation: strip ASCII leading/
 * trailing space and tabs, collapse internal runs of them, then turn the
 * (now untouched) non-breaking spaces into plain spaces.
 * @param {string} raw
 */
function finalizeLine(raw) {
  return raw
    .replace(/^[ \t]+/, '')
    .replace(/[ \t]+$/, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\u00A0/g, ' ');
}

/** @param {string[]} lines */
function trimLeadingBlankLines(lines) {
  let start = 0;
  while (start < lines.length && lines[start].trim().length === 0) start++;
  return lines.slice(start);
}

/**
 * Drop trailing attribution/credit lines (and any blank lines around them) —
 * a line beginning with "Copyright", "From ", "Source:", "Credit", or
 * "Reprinted".
 * @param {string[]} lines
 */
function trimTrailingAttribution(lines) {
  let end = lines.length;
  while (end > 0) {
    const line = lines[end - 1].trim();
    if (line.length === 0 || ATTRIBUTION_RE.test(line)) {
      end--;
      continue;
    }
    break;
  }
  return lines.slice(0, end);
}

/**
 * Group rendered lines into stanzas (consecutive non-blank lines joined by
 * `\n`) separated by a blank line, matching the paragraph-based text format
 * the rest of the pipeline (sliceExcerpt et al.) expects.
 * @param {string[]} lines
 */
function linesToStanzaText(lines) {
  const stanzas = [];
  let current = [];
  for (const line of lines) {
    if (line.trim().length === 0) {
      if (current.length > 0) {
        stanzas.push(current);
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) stanzas.push(current);
  return stanzas.map((stanza) => stanza.join('\n')).join('\n\n');
}

/**
 * Extract a poem's text from an HTML page: strips non-content elements, then
 * looks for a site-aware poem container (class/data-attribute containing
 * "poem"), falling back to the generic block with the most short lines.
 * Preserves line and stanza breaks and `&nbsp;`-derived indentation, decodes
 * entities, and drops a trailing attribution/credit block. Throws if nothing
 * poem-like is found.
 * @param {string} html
 * @param {string} url
 * @returns {string}
 */
export function htmlPoemExtract(html, url) {
  const cleaned = stripNonContentTags(String(html)).replace(/[\t\r\n]+/g, ' ');
  const tree = parseHtmlTree(cleaned);

  const container = findSiteAwarePoemContainer(tree) ?? findGenericPoemContainer(tree);
  if (!container) {
    throw new Error(`no poem-like content found at ${url}`);
  }

  let lines = renderPoemLines(container).map(finalizeLine);
  lines = trimLeadingBlankLines(lines);
  lines = trimTrailingAttribution(lines);

  const text = linesToStanzaText(lines);
  if (!text.trim()) {
    throw new Error(`no poem-like content found at ${url}`);
  }
  return text;
}

// -------- htmlArticleExtract (pure) --------

/**
 * Collapse an element's rendered text into one paragraph: `<br>` becomes a
 * verse-style single newline within the paragraph, source-formatting
 * whitespace is collapsed, and each line is trimmed.
 * @param {HtmlNode} node
 */
function renderParagraphText(node) {
  return elementText(node)
    .split('\n')
    .map((line) => line.replace(/[ \t]{2,}/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

/**
 * Extract an article/essay's text from an HTML page: prefers `<article>` or
 * `<main>`, else the element whose direct `<p>` children carry the most
 * text; returns its paragraphs separated by a blank line. Throws if nothing
 * article-like is found.
 * @param {string} html
 * @returns {string}
 */
export function htmlArticleExtract(html) {
  const cleaned = stripNonContentTags(String(html)).replace(/[\t\r\n]+/g, ' ');
  const tree = parseHtmlTree(cleaned);

  let container =
    findAll(tree, (node) => node.tag === 'article')[0] ??
    findAll(tree, (node) => node.tag === 'main')[0];

  if (!container) {
    let best = null;
    let bestLength = 0;
    for (const node of findAll(tree, () => true)) {
      const directParagraphs = node.children.filter((child) => child.tag === 'p');
      if (directParagraphs.length === 0) continue;
      const length = directParagraphs.reduce(
        (sum, p) => sum + elementText(p).replace(/\s+/g, ' ').trim().length,
        0
      );
      if (length > bestLength) {
        bestLength = length;
        best = node;
      }
    }
    container = best;
  }

  if (!container) {
    throw new Error('no article-like content found');
  }

  const paragraphs = findAll(container, (node) => node.tag === 'p')
    .map(renderParagraphText)
    .filter((p) => p.length > 0);

  if (paragraphs.length === 0) {
    throw new Error('no article-like content found');
  }

  return paragraphs.join('\n\n');
}

// -------- fetching and file loading --------

const RAW_GITHUB_HOST = 'raw.githubusercontent.com';
const POEM_HOSTS = new Set(['poetryfoundation.org', 'poets.org']);
const FETCH_TIMEOUT_MS = 20000;
const BROWSER_FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

/**
 * Lowercased hostname with a leading `www.` stripped, or `''` if `url`
 * doesn't parse.
 * @param {string} url
 */
function normalizedHostname(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * `fetch` with a hard timeout via `AbortController`.
 * @param {string} url
 * @param {{ headers?: Record<string, string>, timeoutMs?: number }} [opts]
 */
async function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { headers: opts.headers, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch one source URL and convert it to plain text.
 *
 * `raw.githubusercontent.com` keeps the original path: a plain fetch, choosing
 * the converter from the URL's extension (`.txt` -> Gutenberg/GITenberg plain
 * text; anything else -> XHTML/HTML). Any other host is fetched with a
 * browser-like User-Agent/Accept header and a 20s timeout, then routed: a
 * poetryfoundation.org/poets.org URL, or a `workType` of `'poem'`, goes
 * through `htmlPoemExtract`; everything else goes through `htmlArticleExtract`.
 * @param {string} url
 * @param {{ workType?: string }} [opts]
 * @returns {Promise<string>}
 */
async function fetchText(url, opts = {}) {
  const hostname = normalizedHostname(url);

  if (hostname === RAW_GITHUB_HOST) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`fetch failed for ${url}: HTTP ${response.status}`);
    }
    const body = await response.text();
    return /\.txt(?:$|[?#])/i.test(url) ? gutenbergToText(body) : xhtmlToText(body);
  }

  const response = await fetchWithTimeout(url, {
    headers: BROWSER_FETCH_HEADERS,
    timeoutMs: FETCH_TIMEOUT_MS,
  });
  if (!response.ok) {
    throw new Error(`fetch failed for ${url}: HTTP ${response.status}`);
  }
  const body = await response.text();

  if (POEM_HOSTS.has(hostname) || opts.workType === 'poem') {
    return htmlPoemExtract(body, url);
  }
  return htmlArticleExtract(body);
}

/**
 * Read one source file and convert it to plain text, choosing the converter
 * from the file's extension and content:
 * - .xhtml/.html -> XHTML/HTML parser
 * - contains Gutenberg START/END markers -> Gutenberg format
 * - otherwise -> plain text (preserving verse line breaks)
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function loadTextFile(filePath) {
  const body = await readFile(filePath, 'utf8');

  // Check file extension
  if (/\.(?:xhtml|html)$/i.test(filePath)) {
    return xhtmlToText(body);
  }

  // Check for Gutenberg markers
  if (GUTENBERG_START_RE.test(body)) {
    return gutenbergToText(body);
  }

  // Treat as plain text
  return plainTextToText(body);
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

const FRIENDLY_WEB_SOURCE_NAMES = {
  'poetryfoundation.org': 'Poetry Foundation',
  'poets.org': 'Academy of American Poets',
};

/**
 * Derive a human-readable source name and `externalLinks` `kind` for a
 * non-raw-GitHub web page URL: a friendly name for Poetry Foundation and
 * poets.org, otherwise the bare hostname; `kind` is `'poetry-foundation'` for
 * poetryfoundation.org, `'other'` for every other host.
 * @param {string} url
 * @returns {{ name: string, kind: 'poetry-foundation' | 'other', hostname: string }}
 */
export function describeWebSource(url) {
  const hostname = normalizedHostname(url);
  const name = FRIENDLY_WEB_SOURCE_NAMES[hostname] ?? hostname;
  const kind = hostname === 'poetryfoundation.org' ? 'poetry-foundation' : 'other';
  return { name, kind, hostname };
}

/** @param {Date} [now] */
function isoToday(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

// -------- main operation --------

/**
 * @typedef {{
 *   id: string, urls?: string[], files?: string[], mode?: string, min?: number, max?: number,
 *   start?: string|null, end?: string|null, dir?: string, now?: Date
 * }} InjectExcerptOptions
 * @typedef {{ workPath: string, mode: string, totalWords: number, excerptWordCount: number|null }} InjectExcerptResult
 */

/**
 * Read `<dir>/<id>.json`, fetch/load and concatenate `urls`/`files`, inject the resulting
 * text as an excerpt or the full text, validate against `WorkSchema`, and
 * write the file back (preserving key order) — or throw and leave the file
 * untouched if the result would be invalid.
 * @param {InjectExcerptOptions} options
 * @returns {Promise<InjectExcerptResult>}
 */
export async function injectExcerpt(options) {
  const {
    id,
    urls = [],
    files = [],
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
  const hasUrls = urls && urls.length > 0;
  const hasFiles = files && files.length > 0;
  if (!hasUrls && !hasFiles) {
    throw new Error('--url or --file is required (one or more)');
  }
  if (hasUrls && hasFiles) {
    throw new Error('--url and --file are mutually exclusive');
  }
  if (mode !== 'excerpt' && mode !== 'full') {
    throw new Error(`--mode must be "excerpt" or "full" (got "${mode}")`);
  }

  const workPath = join(dir ?? DEFAULT_WORKS_DIR, `${id}.json`);
  const raw = await readFile(workPath, 'utf8');
  /** @type {Record<string, unknown>} */
  const work = JSON.parse(raw);

  const texts = [];
  if (hasUrls) {
    for (const url of urls) {
      texts.push(await fetchText(url, { workType: /** @type {string|undefined} */ (work.type) }));
    }
  } else {
    for (const filePath of files) {
      texts.push(await loadTextFile(filePath));
    }
  }
  const fullText = texts.join('\n\n');
  let totalWords = countWords(fullText);

  let excerptWordCount = null;
  if (mode === 'full') {
    const trimmed =
      start || end
        ? sliceExcerpt(fullText, { min: 0, max: Number.POSITIVE_INFINITY, start, end }).excerpt
        : fullText;
    totalWords = countWords(trimmed);
    work.text = trimmed;
    delete work.excerpt;
    delete work.excerptNote;
  } else {
    const sliced = sliceExcerpt(fullText, { min, max, start, end });
    let sourceDesc = 'manual paste';
    if (hasUrls) {
      sourceDesc =
        normalizedHostname(urls[0]) === RAW_GITHUB_HOST
          ? describeSource(urls[0]).hostRepo
          : describeWebSource(urls[0]).name;
    }
    work.excerpt = sliced.excerpt;
    work.excerptNote =
      sliced.wordCount === totalWords
        ? `Opening ${sliced.wordCount} words: the complete first section as published (source: ${sourceDesc})`
        : `Opening ${sliced.wordCount} words of the work, ending at a paragraph break (source: ${sourceDesc})`;
    excerptWordCount = sliced.wordCount;
  }

  work.textPolicy = mode === 'full' ? 'full' : 'excerpt';
  if (Array.isArray(work.tags)) {
    work.tags = work.tags.filter((tag) => tag !== 'needs-text');
  }

  if (hasUrls) {
    const firstUrl = urls[0];
    const source = /** @type {{ url?: string, name?: string, retrievedDate?: string }} */ (
      work.source ?? {}
    );
    const isRawGithub = normalizedHostname(firstUrl) === RAW_GITHUB_HOST;
    const { name, kind } = isRawGithub
      ? { ...describeSource(firstUrl), kind: null }
      : describeWebSource(firstUrl);
    if (!source.url || source.url !== firstUrl) {
      source.name = name;
      source.url = firstUrl;
      source.retrievedDate = isoToday(now);
    }
    work.source = source;

    if (!isRawGithub) {
      // Non-GitHub web pages (publisher, Poetry Foundation, poets.org, ...)
      // always need an outbound externalLinks entry for the page itself.
      const links = Array.isArray(work.externalLinks) ? work.externalLinks.slice() : [];
      const hasLink = links.some(
        (link) => link && typeof link === 'object' && link.url === firstUrl
      );
      if (!hasLink) {
        links.push({ kind, url: firstUrl });
      }
      work.externalLinks = links;
    }
  } else {
    // Manual paste: preserve license and other existing source fields, update name/date
    const existingSource = work.source ?? {};
    const source =
      /** @type {{ url?: string, name?: string, retrievedDate?: string, license?: string }} */
      ({});
    // Preserve license if it exists
    if (existingSource.license) {
      source.license = existingSource.license;
    }
    // Preserve url only if it's non-empty; otherwise use a placeholder
    if (existingSource.url && existingSource.url.length > 0) {
      source.url = existingSource.url;
    } else {
      source.url = '(manual paste)';
    }
    source.name = 'manual paste';
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
      console.log(
        `[inject-excerpt] wrote full text (${result.totalWords} words) to ${result.workPath}`
      );
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
