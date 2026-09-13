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

## Result
**Lazy shard loading:** Confirmed `loadWork` in `src/lib/data/work.ts` uses in-memory shard cache (lines 16, 34–44) so a `shard-N.json` is fetched only once per session. WorkCard mounts only when its entry scrolls into viewport (virtualiser + overscan), triggering lazy load. Test verifies two works in the same shard fetch the shard once (tests/data-work.spec.ts lines 77–98).

**Image lazy-loading:** WorkCard cover-box currently uses SVG placeholder. Added documented comment (`src/lib/components/WorkCard.svelte` lines 231–233) showing pattern for future `<img>` element: `<img loading="lazy" decoding="async" src="..." alt="" />`.

**Fixed aspect ratio:** Cover-box already has `aspect-ratio: 4 / 3` (WorkCard.svelte line 439), preventing layout shift.

Verified: `npm test` passes (including shard cache test); `npm run build`, `npm run lint`, `npx tsc --noEmit`, and `npx playwright test` all pass.
