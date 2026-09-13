# WP-4.2 — `report-coverage.mjs`
Phase: 4 · Tier: haiku · Depends on: WP-1.1

## Read first
- `docs/editorial-policy.md` (balance dimensions: era, form, geography, gender)
- `docs/content-schema.md` (`Work` fields to read counts from)

## Scope
- `scripts/report-coverage.mjs`: reads `content/works/*.json` and prints counts by era, form, theme, geography, and gender to help pick the next curation batch's focus.
- Add npm script `report:coverage`.
- Plain readable stdout output (a table or grouped list is fine; no required machine-readable format).

## Files
`scripts/report-coverage.mjs`, `package.json` (`report:coverage` script)

## Acceptance
- `npm run report:coverage` runs against the seed content and prints non-empty counts for each of the five dimensions.

## Out of scope
- Any UI.
- Any write access to `content/works/`.
