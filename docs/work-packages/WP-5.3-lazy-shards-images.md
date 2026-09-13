# WP-5.3 — Lazy shard + image loading
Phase: 5 · Tier: sonnet · Depends on: Phase 3 complete

## Read first
- `docs/architecture.md` (manifest/shard split)

## Scope
- Confirm/tighten shard fetching so a `shard-N.json` is only requested once a work assigned to it scrolls into (or near) the viewport, building on the virtualised feed from WP-2.3/WP-2.2.
- Add a simple in-memory cache so an already-fetched shard is never refetched in the same session.
- Lazy-load card images (`loading="lazy"`, fixed aspect boxes already established in WP-2.3).

## Files
`src/lib/data/manifest.ts` (or shard loader module), `WorkCard` image handling

## Acceptance
- Devtools network panel shows a shard fetched only when its works scroll into view.
- Scrolling back over already-seen cards produces no duplicate shard fetch.

## Out of scope
- Any image CDN/resizing service — static assets only.
