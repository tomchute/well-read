# WP-1.8 — Seed batch: ~5 short stories
Phase: 1 · Tier: sonnet · Depends on: WP-0.1, WP-1.2

## Read first
- `docs/editorial-policy.md` (well-respected criteria, excerpt caps for prose, rights rules)
- `docs/master-notes-style-guide.md`
- `docs/content-schema.md` (`Work` fields, short-story excerpt rules)

## Scope
- Write 5 `content/works/<id>.json` short stories meeting the "well-respected" bar.
- Vary era, geography, and gender of authors; include **at least one contemporary work**.
- Public-domain stories: `textPolicy: full` (`text` + `ebookLinks`) when short enough to ship whole, otherwise `excerpt` (800–1,500 words or the complete first section, ending at a natural break) + `excerptNote` + `externalLinks`. Contemporary stories: always `excerpt` with `externalLinks`.
- Write full `masterNotes` for each per the style guide.

## Files
`content/works/<id>.json` × 5 (short stories only)

## Acceptance
- `npm run validate:content` passes on the new files.
- `npm run build:manifest` includes all of them with correct `shard` assignment.

## Out of scope
- Poems and books (WP-1.7, WP-1.9).
