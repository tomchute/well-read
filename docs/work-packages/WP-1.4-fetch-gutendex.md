# WP-1.4 — `fetch-gutendex.mjs`
Phase: 1 · Tier: haiku · Depends on: WP-0.1

## Read first
- `docs/open-source-reuse.md` (Gutendex is consumed via API, never vendored)

## Scope
- `scripts/fetch-gutendex.mjs`: CLI taking a search term (title/author) as an argument, querying the Gutendex API (`https://gutendex.com/books?search=...`).
- Print a JSON array to stdout of candidates: `{ title, author, gutenbergId, downloadUrls, license }`.
- Fail soft per item: skip and print a warning to stderr for any record missing required fields, never crash the whole run on one bad item.

## Files
`scripts/fetch-gutendex.mjs`

## Acceptance
- `node scripts/fetch-gutendex.mjs "Emily Dickinson"` prints a valid JSON array to stdout when network access is available, or a clear soft-fail message (not a stack trace) if it isn't.

## Out of scope
- Writing `content/works/*.json` (the curation skill does that, using this script's output as raw material).
