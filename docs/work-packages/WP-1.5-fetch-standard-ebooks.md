# WP-1.5 — `fetch-standard-ebooks.mjs` (OPDS)
Phase: 1 · Tier: haiku · Depends on: WP-0.1

## Read first
- `docs/open-source-reuse.md` (Standard Ebooks OPDS feed is consumed via API, never vendored)

## Scope
- `scripts/fetch-standard-ebooks.mjs`: CLI querying the Standard Ebooks OPDS feed for candidates matching a search term.
- Parse the OPDS/Atom XML response into a JSON array printed to stdout: `{ title, author, url, epubUrl, license }`.
- Fail soft per item: skip and warn to stderr on a malformed entry, never crash the whole run.

## Files
`scripts/fetch-standard-ebooks.mjs`

## Acceptance
- `node scripts/fetch-standard-ebooks.mjs "Frankenstein"` prints a valid JSON array to stdout when network access is available, or a clear soft-fail message if it isn't.

## Out of scope
- Writing `content/works/*.json` (the curation skill's job).
