# WP-1.2 — `validate-content.mjs` with good/bad fixtures
Phase: 1 · Tier: sonnet · Depends on: WP-0.1, WP-1.1

## Read first
- `docs/content-schema.md` (validation gates: full/excerpt branch, book-always-excerpt, id format)
- `docs/editorial-policy.md` (theme vocabulary, excerpt length rules)

## Scope
- `scripts/validate-content.mjs`: CLI that validates a directory of Work JSON files (defaults to `content/works/`, but accepts a path arg for testing against fixtures) against `schema.mjs` plus the editorial gates from `docs/content-schema.md` (full ⇒ text + ebookLinks/externalLinks; excerpt ⇒ excerpt + excerptNote + externalLinks, no text; book always excerpt; themes ⊆ vocabulary; unique kebab-case ids).
- Print one line per file with pass/fail and the specific rule violated; exit nonzero if any file fails.
- Add npm script `validate:content` running it against `content/works/`.
- Fixtures: `tests/fixtures/content/good/*.json` (several valid works), `tests/fixtures/content/bad/*.json` (one file per violated rule, named for the rule it breaks).

## Files
`scripts/validate-content.mjs`, `package.json` (`validate:content` script), `tests/fixtures/content/good/*.json`, `tests/fixtures/content/bad/*.json`, a vitest spec invoking the CLI against both fixture dirs

## Acceptance
- `node scripts/validate-content.mjs tests/fixtures/content/good` exits 0.
- `node scripts/validate-content.mjs tests/fixtures/content/bad` exits nonzero, and each bad fixture is individually reported as failing.
- `npm test` includes and passes this coverage.

## Out of scope
- `build-manifest.mjs` (WP-1.3).
- Real seed content (WP-1.7–1.9).
