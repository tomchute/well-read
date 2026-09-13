# WP-5.4 — Playwright smoke test
Phase: 5 · Tier: haiku · Depends on: Phase 3 complete

## Read first
- `docs/open-source-reuse.md` (Playwright smoke, optional in Phase 5)

## Scope
- One Playwright test using the pre-installed Chromium browser: load the built app via `npm run preview`, assert the feed renders at least one `WorkCard`, click it, and assert the detail view opens.
- Optionally add a `test:e2e` step to `ci.yml` (with `--if-present` guarding, matching WP-0.3's style) — note in the report if this is done or left for later.

## Files
`playwright.config.ts`, `tests/e2e/smoke.spec.ts`, `package.json` (`test:e2e` script)

## Acceptance
- `npx playwright test` passes locally against a running `npm run preview` server.

## Out of scope
- A cross-browser test matrix.
- Visual regression snapshots.
