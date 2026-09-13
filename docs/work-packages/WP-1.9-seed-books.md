# WP-1.9 — Seed batch: ~5 books
Phase: 1 · Tier: sonnet · Depends on: WP-0.1, WP-1.2

## Read first
- `docs/editorial-policy.md` (well-respected criteria, book excerpt rule, rights rules)
- `docs/master-notes-style-guide.md`
- `docs/content-schema.md` (`Work` fields — books always `excerpt`)

## Scope
- Write 5 `content/works/<id>.json` books meeting the "well-respected" bar.
- Vary era, geography, and gender of authors; include **at least one contemporary work**.
- All books use `textPolicy: excerpt` regardless of copyright status (never ship a whole novel in a shard): 800–1,500 words or the complete first chapter, ending at a natural break, plus `excerptNote` and `externalLinks`; public-domain books also get `ebookLinks`.
- Write full `masterNotes` for each per the style guide.

## Files
`content/works/<id>.json` × 5 (books only)

## Acceptance
- `npm run validate:content` passes on the new files.
- `npm run build:manifest` includes all of them with correct `shard` assignment; confirm no book carries `textPolicy: full`.

## Out of scope
- Poems and short stories (WP-1.7, WP-1.8).
