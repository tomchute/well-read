# WP-3.4 — Library: Saved / Read / Liked
Phase: 3 · Tier: sonnet · Depends on: WP-3.2, WP-2.3

## Read first
- `docs/recommendation-design.md` (`saved`, `read`, `reactions` state shapes)
- `docs/design-system.md` (component feel, empty-state placeholder acceptable here; full empty-state art is WP-5.5)

## Scope
- `Library.svelte` with three tabs: Saved (`saved[]`), Read (`read[]`), Liked (works where `reactions[id] === 1`).
- Reuse `WorkCard` from WP-2.3 in a simple (non-virtualised is fine unless the list is large) list per tab.
- Tab switching via the hash router from WP-2.2.

## Files
`src/views/Library.svelte`

## Acceptance
- Saving a work from the feed makes it appear under the Saved tab.
- Liking a work makes it appear under the Liked tab.
- Switching tabs updates the URL hash and the rendered list.

## Out of scope
- Export/import (WP-3.6).
- Polished empty-state art (WP-5.5) — a plain "nothing here yet" message is sufficient for this WP.
