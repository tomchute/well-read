# WP-3.2 — Pure scoring module + vitest
Phase: 3 · Tier: sonnet · Depends on: WP-3.1

## Read first
- `docs/recommendation-design.md` (score formula, recency penalty, jitter, greedy page builder, diversity constraints, normalisation, cold start, required vitest cases — implement exactly)

## Scope
- Implement `scoreWork`, `buildPage`, `applyChip`, `decay` in `src/lib/scoring/` matching the signatures in `docs/recommendation-design.md`'s "Pure-function API" section exactly.
- All functions pure: no `localStorage` access, no internal `Date.now()`/`Math.random()` (caller passes `now`; jitter uses an injectable RNG).
- Write every vitest case listed in `docs/recommendation-design.md`'s "Required vitest cases" section (11 cases covering sums, recency, pins, chip deltas, both diversity constraints, decay, read-exclusion).

## Files
`src/lib/scoring/index.ts` (may be split into multiple files under `src/lib/scoring/`), `tests/scoring.spec.ts`

## Acceptance
- `npm test` passes, including all listed scoring cases.
- Code review confirms no internal `Date.now()`/`Math.random()` calls in `src/lib/scoring/`.

## Out of scope
- Store persistence (already done in WP-3.1).
- Any UI (WP-3.3 onward).
