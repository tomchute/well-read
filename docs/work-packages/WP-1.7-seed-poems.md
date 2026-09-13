# WP-1.7 — Seed batch: ~6 poems (mixed eras, full + contemporary)
Phase: 1 · Tier: sonnet · Depends on: WP-0.1, WP-1.2

## Read first
- `docs/editorial-policy.md` (well-respected criteria, theme vocabulary, excerpt/rights rules, balance goals)
- `docs/master-notes-style-guide.md` (worked example to follow)
- `docs/content-schema.md` (`Work` fields, poem-specific excerpt rules)

## Scope
- Write 6–7 `content/works/<id>.json` poems meeting `docs/editorial-policy.md`'s "well-respected" bar (anthology presence, major award, Poetry Foundation core status).
- Vary era, geography, and gender of authors across the batch; include **at least one contemporary work**.
- Public-domain poems ≤60 lines: `textPolicy: full` with `text` + `ebookLinks`. Contemporary poems ≤60 lines: `textPolicy: full` with `text` + `externalLinks` (no `ebookLinks`, per rights rules). Longer poems: `excerpt` (strongest continuous 40–60 lines) + `excerptNote` + `externalLinks`.
- Write full `masterNotes` for each (`keyImages >= 2`, `discussionQuestions >= 3`) per the style guide.

## Files
`content/works/<id>.json` × 6–7 (poems only)

## Acceptance
- `npm run validate:content` passes on the new files.
- `npm run build:manifest` includes all of them in the manifest with correct `shard` assignment.

## Out of scope
- Short stories and books (WP-1.8, WP-1.9).
- Building/modifying the fetch scripts.
