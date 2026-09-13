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

## Notes
- Icons (192, 512, maskable) generated as SVG (no ImageMagick/rsvg-convert available in the build environment). SVG icons are valid for modern PWA manifest specs and provide crisp rendering at any size. To convert to PNG if needed: use an online SVG-to-PNG tool or install ImageMagick (`convert` command) and re-run `node scripts/generate-icons.mjs`.

## Out of scope
- Push notifications, background sync.
