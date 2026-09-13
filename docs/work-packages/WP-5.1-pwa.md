# WP-5.1 — PWA manifest + offline shell
Phase: 5 · Tier: haiku · Depends on: Phase 3 complete

## Read first
- `docs/design-system.md` (icon/theme colours)
- `docs/open-source-reuse.md` (`vite-plugin-pwa`)

## Scope
- Configure `vite-plugin-pwa` for a static offline app shell caching the built assets plus `manifest.json`/shard JSON.
- Web app manifest: name, icons, theme/background colours matching `docs/design-system.md`.

## Files
`vite.config.ts` (plugin config), generated/static web app manifest, icon assets

## Acceptance
- `npm run build` emits a service worker and web app manifest.
- A local Lighthouse PWA installability check passes.

## Out of scope
- Push notifications, background sync.
