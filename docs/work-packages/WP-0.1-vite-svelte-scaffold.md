# WP-0.1 — Vite + Svelte 5 + TypeScript scaffold with Pages base path
Phase: 0 · Tier: sonnet · Depends on: none

## Read first
- `docs/architecture.md` (folder layout, Pages base path)
- `CLAUDE.md` (command names — must match exactly)

## Scope
- Scaffold with `npm create vite@latest . -- --template svelte-ts`, then upgrade to Svelte 5.
- Set `base: '/well-read/'` in `vite.config.ts`.
- Add npm scripts named exactly as in `CLAUDE.md`: `dev`, `build`, `preview` (leave `test`, `lint`, `validate:content`, `build:manifest`, `report:coverage` for the WPs that implement them — do not stub scripts you don't implement).
- Create the folder skeleton from `docs/architecture.md`'s "Folder layout" (`content/works/`, `scripts/`, `public/data/`, `src/lib/types|stores|scoring|components/`, `src/views/`, `tests/`) with `.gitkeep` where empty.
- `.gitignore` covering `node_modules`, `dist`.

## Files
`package.json`, `vite.config.ts`, `svelte.config.js`, `tsconfig.json`, `index.html`, `src/`, `.gitignore`

## Acceptance
- `npm install` succeeds.
- `npm run dev` boots without error (start and confirm the server logs a local URL, then stop it).
- `npm run build` succeeds; `dist/index.html` references assets under `/well-read/assets/...`.

## Out of scope
- Deploy/CI workflows (WP-0.2, WP-0.3).
- Biome/strict tsconfig, vitest (WP-0.4, WP-0.5).
