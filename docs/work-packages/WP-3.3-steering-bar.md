# WP-3.3 — Steering bar wired to scorer
Phase: 3 · Tier: sonnet · Depends on: WP-3.2, WP-2.3

## Read first
- `docs/recommendation-design.md` (chip actions table, "surprise me" reset)
- `docs/design-system.md` (chip interaction feel: pressed state, gentle spring)

## Scope
- `SteeringBar.svelte`: chip controls for "more like this", "more about X" (theme), "less <form>", "not interested", like/dislike, and a "surprise me" reset button.
- Each chip calls `applyChip` (or the reset helper) from `src/lib/scoring/`, persists the resulting state via the WP-3.1 stores, and triggers `buildPage` to re-render the feed.

## Files
`src/lib/components/SteeringBar.svelte`, wiring inside `src/views/Feed.svelte`

## Acceptance
- Clicking "more like this" on a card visibly shifts subsequent feed pages toward similar works (manual check, plus a test on the wiring function if it's pure enough to unit test).
- "Surprise me" resets weights and session pins to zero without touching `saved`/`read`/`reactions`.

## Out of scope
- The onboarding quiz UI (WP-3.5).
- Library tabs (WP-3.4).
