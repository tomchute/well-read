# CLAUDE.md — well-read

Single-user, free-to-run literature feed. Static Vite + Svelte 5 + TypeScript SPA on GitHub Pages. Content is JSON in the repo, produced in batches by a scheduled Claude Code Routine running the `/curate` skill. No backend, no paid services, no secrets.

## Start here
1. `ROADMAP.md` — phases, work packages (WPs), definitions of done. Pick the next unchecked WP.
2. `docs/orchestration.md` — how to execute a WP with a sub-agent, prompt template, model tiers.
3. The WP file in `docs/work-packages/` — scope, files, acceptance criteria.

## Source-of-truth documents (read the one your WP names; do not contradict them)
| Topic | File |
|---|---|
| Data flow, folders, build artefacts | `docs/architecture.md` |
| `Work` type, validation rules, example JSON | `docs/content-schema.md` |
| What counts as well-respected, theme vocabulary, excerpt and rights rules | `docs/editorial-policy.md` |
| How to write master notes | `docs/master-notes-style-guide.md` |
| Steering weights, scoring, diversity, cold start | `docs/recommendation-design.md` |
| Palette, type, motion, components, reference image | `docs/design-system.md` |
| Chosen libraries and data sources | `docs/open-source-reuse.md` |
| Batch curation checklist for the Routine | `.claude/skills/curate/SKILL.md` |

## Commands (available once Phase 0/1 land)
```
npm run dev              # Vite dev server
npm run build            # production build (base path /well-read/)
npm run preview          # serve the build locally
npm test                 # vitest
npm run lint             # biome check
npm run validate:content # zod + editorial gates over content/works/*.json
npm run build:manifest   # content/works -> public/data/manifest.json + shards
npm run report:coverage  # era/form/theme/geography/gender counts
npm run inject:excerpt   # copy verbatim text from a raw GitHub or web page URL, or a local file, into a work's excerpt/text
```

## Conventions
- `content/works/<id>.json` is hand-authored source; `public/data/*` is generated and committed. Never edit `public/data` by hand.
- Ids are kebab-case `author-short-title-year`. Themes come only from the controlled vocabulary in `docs/editorial-policy.md`.
- All data fetches in the app go through `import.meta.env.BASE_URL`.
- Prefer an existing open-source package over hand-rolling; record new choices in `docs/open-source-reuse.md`.
- Keep the app light: no UI kit, no global state library, no analytics.
- Commit messages: `<area>: <imperative summary>` (e.g. `feed: add virtualised card list`, `curate: batch 2026-10-01 (5 works)`).
- Feature work goes on a branch and merges to `main`; the curation Routine commits directly to `main` (see `docs/orchestration.md`).
- Before pushing: `npm run lint && npm test && npm run validate:content`.
