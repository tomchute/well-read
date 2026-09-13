# WP-5.5 — Empty and error states
Phase: 5 · Tier: haiku · Depends on: Phase 3 complete

## Read first
- `docs/design-system.md` (public-domain illustration guidance — no AI-generated imagery, no stock photos)

## Scope
- `EmptyState.svelte`: art + copy for zero-result Library tabs (Saved/Read/Liked with nothing in them), using public-domain natural-history illustration per the design system, not AI-generated art.
- An error state for a failed manifest fetch (e.g. offline): friendly message plus a manual reload action, shown instead of a blank screen.

## Files
`src/lib/components/EmptyState.svelte`, error handling in the manifest loader (`src/lib/data/manifest.ts`) and its call site(s)

## Acceptance
- Clearing `saved`/`read`/`reactions` from localStorage and opening each Library tab shows the empty state, not a blank list.
- Simulating a manifest fetch failure (devtools offline mode) shows the friendly error state, not a blank screen or unhandled exception.

## Out of scope
- Retry/backoff logic beyond a manual "reload" action.

## Result
Created `src/lib/components/EmptyState.svelte`: a centered column component with small fixed-aspect engraving-style SVG ornament (sepia/hairline tokens), Fraunces headline, Newsreader body copy, and optional action (link or button). Quiet literary voice, no exclamation marks.

Updated `src/views/Feed.svelte`:
- Feed with zero works → EmptyState with title "The feed is empty"
- Manifest fetch failure → EmptyState with title "The feed is temporarily unavailable" + Reload button

Updated `src/views/Library.svelte`:
- Empty Saved/Read/Liked tabs → EmptyState with contextual title and message

Updated `src/views/Work.svelte`:
- Work not found → EmptyState with title "This work is not in the catalog"
- Shard fetch failure → EmptyState with title "This work is temporarily unavailable" + Reload button

Verified: `npm run build`, `npm run lint`, `npm test`, `npx tsc --noEmit`, and `npx playwright test` all pass.
