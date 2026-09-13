# well-read — Roadmap

A free-to-run, single-user "Instagram for literature": a scrollable feed of well-respected poems, short stories, and books with steerable recommendations, guided **master notes** on every work, and epub links for Kindle. Content is produced in batches by a scheduled Claude Code Routine, never by an always-on service.

How to work this roadmap: pick the lowest unchecked work package (WP) whose dependencies are done, read its file in `docs/work-packages/`, follow `docs/orchestration.md`, tick the box here when its acceptance criteria pass. WPs in the same phase are independent unless the WP file lists a dependency.

Definition of done for a phase = its verification line passes on `main`.

## Phase 0 — Scaffold
Verification: `npm run dev` boots, `npm run build` passes, a push to `main` deploys and the GitHub Pages URL loads.

- [x] [WP-0.1](docs/work-packages/WP-0.1-vite-svelte-scaffold.md) Vite + Svelte 5 + TypeScript scaffold with Pages base path
- [x] [WP-0.2](docs/work-packages/WP-0.2-pages-deploy-workflow.md) GitHub Pages deploy workflow
- [x] [WP-0.3](docs/work-packages/WP-0.3-ci-workflow.md) CI workflow: validate content + tests on every push
- [ ] [WP-0.4](docs/work-packages/WP-0.4-biome-tsconfig.md) Biome lint/format + strict tsconfig
- [ ] [WP-0.5](docs/work-packages/WP-0.5-vitest-smoke.md) Vitest setup + smoke test

## Phase 1 — Content schema + seed batch
Verification: `npm run validate:content` passes on the seed works and fails on the bad fixtures; `npm run build:manifest` emits `public/data/manifest.json` + shards.

- [ ] [WP-1.1](docs/work-packages/WP-1.1-zod-schema-and-types.md) zod schema + TS types for `Work`
- [ ] [WP-1.2](docs/work-packages/WP-1.2-validate-content-script.md) `validate-content.mjs` with good/bad fixtures
- [ ] [WP-1.3](docs/work-packages/WP-1.3-build-manifest-script.md) `build-manifest.mjs` with sharding + dedupe warnings
- [ ] [WP-1.4](docs/work-packages/WP-1.4-fetch-gutendex.md) `fetch-gutendex.mjs`
- [ ] [WP-1.5](docs/work-packages/WP-1.5-fetch-standard-ebooks.md) `fetch-standard-ebooks.mjs` (OPDS)
- [ ] [WP-1.6](docs/work-packages/WP-1.6-fetch-poetrydb.md) `fetch-poetrydb.mjs`
- [ ] [WP-1.7](docs/work-packages/WP-1.7-seed-poems.md) Seed batch: ~6 poems (mixed eras, full + contemporary)
- [ ] [WP-1.8](docs/work-packages/WP-1.8-seed-stories.md) Seed batch: ~5 short stories
- [ ] [WP-1.9](docs/work-packages/WP-1.9-seed-books.md) Seed batch: ~5 books

## Phase 2 — Feed UI
Verification: seed works render as cards; detail view shows all master-notes sections; `full` and `excerpt` works render their link types correctly; the app looks like `docs/design-system.md`.

- [ ] [WP-2.1](docs/work-packages/WP-2.1-design-tokens-typography.md) Design tokens, self-hosted fonts, typography base
- [ ] [WP-2.2](docs/work-packages/WP-2.2-app-shell-routing-manifest.md) App shell, hash routing, manifest + shard loading
- [ ] [WP-2.3](docs/work-packages/WP-2.3-work-card-virtual-feed.md) `WorkCard` + virtualised feed
- [ ] [WP-2.4](docs/work-packages/WP-2.4-work-detail-master-notes.md) Work detail + master-notes side/bottom sheet
- [ ] [WP-2.5](docs/work-packages/WP-2.5-links-by-text-policy.md) Ebook/external link rendering by `textPolicy`
- [ ] [WP-2.6](docs/work-packages/WP-2.6-motion-polish-shortcuts.md) Motion, view transitions, keyboard shortcuts

## Phase 3 — Steering + library
Verification: scorer tests green; steering chips visibly reorder the feed; export → import round-trips localStorage.

- [ ] [WP-3.1](docs/work-packages/WP-3.1-persisted-stores.md) Versioned localStorage stores
- [ ] [WP-3.2](docs/work-packages/WP-3.2-scoring-module.md) Pure scoring module + vitest
- [ ] [WP-3.3](docs/work-packages/WP-3.3-steering-bar.md) Steering bar wired to scorer
- [ ] [WP-3.4](docs/work-packages/WP-3.4-library-views.md) Library: Saved / Read / Liked
- [ ] [WP-3.5](docs/work-packages/WP-3.5-onboarding-quiz.md) First-run taste quiz
- [ ] [WP-3.6](docs/work-packages/WP-3.6-kindle-helper-export-import.md) Kindle helper + JSON export/import

## Phase 4 — Curation skill + Routine
Verification: one Routine (or local `/curate`) run lands a validated batch on `main`, CI stays green, the deployed site shows the new works.

- [ ] [WP-4.1](docs/work-packages/WP-4.1-curate-skill-hardening.md) Harden `.claude/skills/curate/SKILL.md` against the real scripts
- [ ] [WP-4.2](docs/work-packages/WP-4.2-report-coverage-script.md) `report-coverage.mjs`
- [ ] [WP-4.3](docs/work-packages/WP-4.3-dogfood-batch.md) Dogfood batch + human spot-check
- [ ] [WP-4.4](docs/work-packages/WP-4.4-configure-routine.md) Configure the scheduled Routine (orchestrator task)
- [ ] [WP-4.5](docs/work-packages/WP-4.5-flag-correction-issue-template.md) "Flag a correction / takedown" issue template

## Phase 5 — Polish
Verification: Lighthouse accessibility score recorded in the WP; Playwright smoke passes in CI.

- [ ] [WP-5.1](docs/work-packages/WP-5.1-pwa.md) PWA manifest + offline shell
- [ ] [WP-5.2](docs/work-packages/WP-5.2-accessibility-pass.md) Accessibility pass
- [ ] [WP-5.3](docs/work-packages/WP-5.3-lazy-shards-images.md) Lazy shard + image loading
- [ ] [WP-5.4](docs/work-packages/WP-5.4-playwright-smoke.md) Playwright smoke test
- [ ] [WP-5.5](docs/work-packages/WP-5.5-empty-error-states.md) Empty and error states

## Deferred (not planned)
Accounts or cross-device sync, any backend, social features beyond copy-link, audio, translations, email digests, server-side send-to-Kindle.
