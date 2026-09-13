# WP-2.2 — App shell, hash routing, manifest + shard loading
Phase: 2 · Tier: sonnet · Depends on: WP-1.3, WP-2.1

## Read first
- `docs/architecture.md` (data flow, Pages base path, manifest/shard split)
- `docs/open-source-reuse.md` (routing choice: `svelte-spa-router` or hand-rolled hash routing)

## Scope
- `App.svelte` shell using the design tokens from WP-2.1.
- Hash-based router with routes for Feed, Detail, Library, Onboarding (stub views are fine for views not yet built).
- Boot sequence: fetch `public/data/manifest.json` via `` `${import.meta.env.BASE_URL}data/manifest.json` `` once on load.
- A shard loader helper that fetches `shard-N.json` on demand by manifest `shard` field, with no hardcoded `/data/...` paths anywhere.

## Files
`src/App.svelte`, router module (e.g. `src/lib/router.ts`), `src/views/Feed.svelte` / `Detail.svelte` / `Library.svelte` / `Onboarding.svelte` (stubs), `src/lib/data/manifest.ts`

## Acceptance
- `npm run dev`: navigating each hash route renders its (stub) view without a full reload.
- A test or manual check confirms the manifest loader fetches via `import.meta.env.BASE_URL` and returns parsed entries.

## Out of scope
- Actual card rendering (WP-2.3), detail content (WP-2.4).
