# WP-1.6 — `fetch-poetrydb.mjs`
Phase: 1 · Tier: haiku · Depends on: WP-0.1

## Read first
- `docs/open-source-reuse.md` (PoetryDB is consumed via API, never vendored)

## Scope
- `scripts/fetch-poetrydb.mjs`: CLI querying the PoetryDB API (`https://poetrydb.org`) by author or title.
- Print a JSON array to stdout: `{ title, author, lines[] }`.
- Fail soft per item: skip and warn to stderr on a malformed/missing entry, never crash the whole run.

## Files
`scripts/fetch-poetrydb.mjs`

## Acceptance
- `node scripts/fetch-poetrydb.mjs "Robert Frost"` prints a valid JSON array to stdout when network access is available, or a clear soft-fail message if it isn't.

## Out of scope
- Writing `content/works/*.json` (the curation skill's job).
