# WP-0.3 — CI workflow: validate content + tests on every push
Phase: 0 · Tier: haiku · Depends on: WP-0.1

## Read first
- `docs/architecture.md` (Workflows table)
- `CLAUDE.md` (command list)

## Scope
- `.github/workflows/ci.yml` triggered on `push` and `pull_request`.
- Steps: checkout, setup-node, `npm ci`, then `npm run lint --if-present`, `npm test --if-present`, `npm run validate:content --if-present`.
- Use `--if-present` for all three since `lint`/`test`/`validate:content` scripts don't exist until later WPs land — the workflow must not fail on a missing script.

## Files
`.github/workflows/ci.yml`

## Acceptance
- YAML is valid.
- Locally, `npm run lint --if-present && npm run test --if-present && npm run validate:content --if-present` exits 0 on the current scaffold (no scripts defined yet).

## Out of scope
- The actual lint/test/validate implementations (WP-0.4, WP-0.5, WP-1.2).
