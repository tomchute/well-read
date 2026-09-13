# WP-4.1 — Harden `.claude/skills/curate/SKILL.md` against the real scripts
Phase: 4 · Tier: sonnet · Depends on: WP-1.4, WP-1.5, WP-1.6, WP-4.2

## Read first
- `.claude/skills/curate/SKILL.md` (current checklist, likely written before the scripts existed)
- `docs/editorial-policy.md`, `docs/master-notes-style-guide.md`
- `docs/open-source-reuse.md` (data sources and libraries the skill should invoke)

## Scope
- Rewrite each step of `SKILL.md` to name the actual command that now exists: `npm run report:coverage`, `node scripts/fetch-gutendex.mjs ...`, `node scripts/fetch-standard-ebooks.mjs ...`, `node scripts/fetch-poetrydb.mjs ...`, `npm run validate:content`, `npm run build:manifest`, `npm test`.
- Add concrete example invocations and the shape of expected output for each.
- Fix any drift found between the skill's original assumptions (flags, output shapes) and the scripts as actually implemented.

## Files
`.claude/skills/curate/SKILL.md`

## Acceptance
- Manually walk through the skill's steps once against the real repo scripts, dry-run (no commit), confirming every named command exists and behaves as the skill describes.

## Out of scope
- Running an actual batch and committing it (WP-4.3).
- Configuring the scheduled Routine (WP-4.4).
