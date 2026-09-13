# WP-1.3 — `build-manifest.mjs` with sharding + dedupe warnings
Phase: 1 · Tier: sonnet · Depends on: WP-0.1, WP-1.1

## Read first
- `docs/architecture.md` (manifest vs. shards field lists, sharding rule)
- `docs/content-schema.md` (`Work` fields)

## Scope
- `scripts/build-manifest.mjs`: reads `content/works/*.json`, writes `public/data/manifest.json` (text-free index: `id, title, author, year, era, type, form, themes[], tags[], difficulty, length, textPolicy, shard`) and `public/data/shard-N.json` files, each holding at most **50** full `Work` records.
- Fuzzy dedupe warning (not a failure): normalise `title+author` (lowercase, strip punctuation and leading articles) and print a warning to stderr for any near-duplicate pair, without blocking the build.
- Add npm script `build:manifest`.

## Files
`scripts/build-manifest.mjs`, `package.json` (`build:manifest` script)

## Acceptance
- Run against a fixture/seed directory: `manifest.json` entries contain none of `text`, `excerpt`, `masterNotes`.
- No shard file exceeds 50 works.
- A fixture pair with matching normalised title+author produces a dedupe warning on stderr and the build still exits 0.

## Out of scope
- Content validation gates (WP-1.2, already run beforehand in the pipeline).
- The seed content itself (WP-1.7–1.9).
