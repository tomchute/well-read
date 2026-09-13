// Renders a Markdown string (as authored in `masterNotes.*` fields — see
// docs/content-schema.md, "masterNotes.context, ... are Markdown strings,
// rendered with marked + sanitized with DOMPurify") into HTML safe to inject
// via Svelte's `{@html ...}`.
//
// `marked` turns Markdown into HTML but does not sanitize it — raw HTML
// embedded in the Markdown source is passed straight through. `DOMPurify`
// strips anything unsafe (scripts, inline event handlers, disallowed tags)
// before the result is ever rendered. Every surviving `<a>` then gets
// `target="_blank" rel="noopener noreferrer"` so master notes can link out
// (e.g. `furtherReading`) without the destination page getting a
// `window.opener` handle back into the app.
//
// See docs/open-source-reuse.md ("marked" + "dompurify").

import DOMPurify from 'dompurify';
import { marked } from 'marked';

const ALLOWED_TAGS = [
  'p',
  'br',
  'em',
  'strong',
  'a',
  'ul',
  'ol',
  'li',
  'blockquote',
  'code',
  'pre',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'del',
  'sup',
  'sub',
];

const ALLOWED_ATTR = ['href', 'title'];

/**
 * Renders `markdown` to sanitised HTML. Safe to pass directly to `{@html}`.
 */
export function renderMarkdown(markdown: string): string {
  const rawHtml = marked.parse(markdown, { async: false }) as string;
  const sanitized = DOMPurify.sanitize(rawHtml, { ALLOWED_TAGS, ALLOWED_ATTR });
  return openLinksInNewTab(sanitized);
}

/**
 * Adds `target="_blank" rel="noopener noreferrer"` to every `<a>` tag.
 * Runs strictly after `DOMPurify.sanitize`, so `html` here holds only markup
 * that already survived sanitisation — this is attribute bookkeeping on
 * trusted output, not re-parsing of untrusted input.
 */
function openLinksInNewTab(html: string): string {
  return html.replace(/<a\b([^>]*)>/gi, (_match, attrs: string) => {
    const withoutOldAttrs = attrs.replace(/\s+(target|rel)\s*=\s*("[^"]*"|'[^']*'|\S+)/gi, '');
    return `<a${withoutOldAttrs} target="_blank" rel="noopener noreferrer">`;
  });
}
