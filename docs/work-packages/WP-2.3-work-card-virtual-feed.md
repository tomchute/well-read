# WP-2.3 — `WorkCard` + virtualised feed
Phase: 2 · Tier: sonnet · Depends on: WP-1.3, WP-2.1, WP-2.2

## Read first
- `docs/design-system.md` (card surfaces, accent-per-type: poem=teal, story=vermilion, book=ochre, saved=sky; specimen-numbering motif)
- `docs/open-source-reuse.md` (`@tanstack/svelte-virtual` for feed virtualisation)

## Scope
- `WorkCard.svelte`: accent colour by `type`, specimen-number motif, fixed aspect-ratio image box (no layout shift), title/author/era/form summary.
- `Feed.svelte`: virtualised list over manifest entries using `@tanstack/svelte-virtual`; initial ordering can be manifest order or a neutral/zero score (full scoring is wired in Phase 3).
- Lazy-fetch the shard for a card only once it's within (or near) the viewport.

## Files
`src/lib/components/WorkCard.svelte`, `src/views/Feed.svelte`

## Acceptance
- Seed works from Phase 1 render as scrollable cards with correct per-type accent colours.
- Scrolling the full seed set stays smooth; the mounted DOM node count stays roughly constant (virtualisation working), checked via devtools element count before/after scrolling.

## Out of scope
- Steering chips (WP-3.3), master-notes detail view (WP-2.4).
