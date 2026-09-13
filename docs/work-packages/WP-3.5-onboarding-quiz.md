# WP-3.5 — First-run taste quiz
Phase: 3 · Tier: sonnet · Depends on: WP-3.2, WP-2.3

## Read first
- `docs/recommendation-design.md` (cold start: skippable 6–7 card quiz, skip → all-zero weights)

## Scope
- `Onboarding.svelte`: 6–7 cards (reusing `WorkCard` from WP-2.3), each with like/dislike/skip actions applying the same `applyChip` deltas used elsewhere.
- A visible "skip quiz" action that leaves all weights at zero.
- Gate first display behind a `wellread:v1:onboarded` flag (set on completion or skip) so it never reappears after the first run.

## Files
`src/views/Onboarding.svelte`

## Acceptance
- With empty `localStorage`, first load shows the quiz.
- Completing or skipping it sets the onboarded flag and routes to the Feed.
- Reloading afterward goes straight to the Feed, not the quiz.

## Out of scope
- The scoring internals themselves (already built in WP-3.2).
