# WP-3.6 — Kindle helper + JSON export/import
Phase: 3 · Tier: haiku · Depends on: WP-3.2, WP-2.3

## Read first
- `docs/recommendation-design.md` (state keys to include in export/import)
- `ROADMAP.md` Deferred section (no server-side Send-to-Kindle)

## Scope
- Store a Kindle email address locally (a new, separate localStorage field, not one of the versioned `wellread:v1:*` scoring keys).
- Render an Amazon Send-to-Kindle link/button using that stored address wherever a work has `ebookLinks`.
- JSON export: a single downloadable file containing all six `wellread:v1:*` keys plus the Kindle email.
- JSON import: validated parse with a confirmation step before overwriting existing state; reject malformed input without corrupting current state.

## Files
`src/lib/components/KindleSettings.svelte`, `src/lib/data/exportImport.ts`

## Acceptance
- Export produces a JSON file containing every state key.
- Importing that same file round-trips: state before export equals state after import.
- Importing an invalid JSON file shows an error and leaves existing state untouched.

## Out of scope
- Server-side Send-to-Kindle (explicitly deferred in `ROADMAP.md`).
