# WP-0.5 — Vitest setup + smoke test
Phase: 0 · Tier: haiku · Depends on: WP-0.1

## Read first
- `docs/open-source-reuse.md` (test tool choice)

## Scope
- Install `vitest` (and `@testing-library/svelte` if a component smoke test is used) as dev dependencies.
- `vitest.config.ts` wired to the Vite config.
- Add `test` npm script: `vitest run`.
- One smoke test that asserts the test runner itself works (a trivial assertion, or mounting the root `App` component if trivial).

## Files
`vitest.config.ts`, `package.json` (test script), `tests/smoke.spec.ts`

## Acceptance
- `npm test` runs and passes with at least 1 passing test.

## Out of scope
- Coverage thresholds or reporting.
- Component test scaffolding beyond the one smoke test.
