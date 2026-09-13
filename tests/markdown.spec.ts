// Unit tests for src/lib/markdown.ts.
//
// `dompurify` is mocked here because it needs a real DOM to run (it calls
// `document.implementation.createHTMLDocument`, `DOMParser`, etc.) and this
// suite runs under Vitest's plain Node environment, which has none — calling
// the real `DOMPurify.sanitize` outside a browser (or without `jsdom`) throws
// `TypeError: DOMPurify.sanitize is not a function`, since DOMPurify only
// defines that method once it detects a working `window.document`. The
// fake below reproduces DOMPurify's *sanitizing* behaviour (stripping
// script/style/iframe elements, event-handler attributes, and
// `javascript:` URLs, and respecting `ALLOWED_TAGS`) closely enough to prove
// `renderMarkdown` actually wires `marked` output through a sanitizer and
// never renders unsanitised HTML; real DOMPurify runs for real in the
// browser build (see docs/open-source-reuse.md).
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sanitize = vi.fn((html: string, config?: { ALLOWED_TAGS?: string[] }) => {
  let out = html;
  // Drop dangerous elements (and their content) entirely.
  out = out.replace(/<(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  out = out.replace(/<(script|style|iframe|object|embed)\b[^>]*\/?>/gi, '');
  // Strip inline event-handler attributes (onerror=, onclick=, ...).
  out = out.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // Neutralise javascript: URLs in href/src.
  out = out.replace(/\s(href|src)\s*=\s*"javascript:[^"]*"/gi, ' $1="#"');
  out = out.replace(/\s(href|src)\s*=\s*'javascript:[^']*'/gi, " $1='#'");
  // Respect an ALLOWED_TAGS allow-list by unwrapping (not deleting the text
  // of) any other tag — close enough to DOMPurify's real behaviour for our
  // purposes here.
  if (config?.ALLOWED_TAGS) {
    const allowed = new Set(config.ALLOWED_TAGS.map((tag) => tag.toLowerCase()));
    out = out.replace(/<\/?([a-z0-9]+)\b[^>]*>/gi, (full, tag: string) =>
      allowed.has(tag.toLowerCase()) ? full : ''
    );
  }
  return out;
});

vi.mock('dompurify', () => ({
  default: { sanitize, isSupported: true },
}));

const { renderMarkdown } = await import('../src/lib/markdown');

beforeEach(() => {
  sanitize.mockClear();
});

describe('renderMarkdown', () => {
  it('renders basic Markdown to HTML', () => {
    const html = renderMarkdown('**bold** and *italic* text');

    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
  });

  it('renders a blockquote (used for pulled quotations per the style guide)', () => {
    const html = renderMarkdown('> a quoted line');

    expect(html).toContain('<blockquote>');
  });

  it('passes the marked output through DOMPurify.sanitize', () => {
    renderMarkdown('hello');

    expect(sanitize).toHaveBeenCalledTimes(1);
    expect(sanitize.mock.calls[0]?.[0]).toContain('hello');
  });

  it('makes every link open in a new tab with rel="noopener noreferrer"', () => {
    const html = renderMarkdown('[Poetry Foundation](https://www.poetryfoundation.org)');

    expect(html).toContain('href="https://www.poetryfoundation.org"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('overrides an author-supplied target/rel instead of duplicating it', () => {
    const html = renderMarkdown('<a href="https://example.com" target="_self" rel="bogus">link</a>');

    expect(html.match(/target=/g)).toHaveLength(1);
    expect(html.match(/rel=/g)).toHaveLength(1);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('strips a <script> tag injected via raw HTML in the Markdown source', () => {
    const html = renderMarkdown('Some notes.\n\n<script>alert("xss")</script>\n\nMore notes.');

    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert(');
    expect(html).toContain('Some notes.');
    expect(html).toContain('More notes.');
  });

  it('strips an inline event-handler attribute injected via raw HTML', () => {
    const html = renderMarkdown('<img src="x" onerror="alert(1)"> not a real image');

    expect(html).not.toContain('onerror');
    expect(html).not.toContain('alert(1)');
  });

  it('neutralises a javascript: URL', () => {
    const html = renderMarkdown('[click me](javascript:alert(1))');

    expect(html).not.toContain('javascript:alert');
  });

  it('never renders unsanitised HTML: DOMPurify.sanitize always wraps the marked output', () => {
    // A dedicated regression guard for the WP-2.4 acceptance criterion:
    // every render must run through DOMPurify.sanitize, no matter the input.
    for (const input of ['plain text', '# Heading', '<script>alert(1)</script>', '']) {
      sanitize.mockClear();
      renderMarkdown(input);
      expect(sanitize).toHaveBeenCalledTimes(1);
    }
  });
});
