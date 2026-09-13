# WP-4.3 — Dogfood batch + human spot-check
Phase: 4 · Tier: sonnet · Depends on: WP-4.1

## Read first
- `.claude/skills/curate/SKILL.md` (hardened checklist — follow it exactly)
- `docs/editorial-policy.md`, `docs/master-notes-style-guide.md`

## Scope
- Run the hardened curate skill once, end to end, to add one real batch (4–6 works) using the actual fetch scripts and hand-picked contemporary works.
- Write master notes per the style guide.
- Run `npm run validate:content`, `npm run build:manifest`, `npm test` and confirm all green.
- Leave the batch uncommitted — this WP produces the files for human review, it does not commit them.

## Files
`content/works/<new id>.json` × 4–6

## Acceptance
- `npm run validate:content && npm run build:manifest && npm test` all pass on the new batch.
- Report flags the batch as ready for a human spot-check of master-notes accuracy before commit.

## Out of scope
- Committing/pushing the batch (left to the orchestrator/user after spot-check).
- Configuring the scheduled Routine (WP-4.4).
