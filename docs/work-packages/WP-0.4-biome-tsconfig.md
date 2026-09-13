# WP-0.4 — Biome lint/format + strict tsconfig
Phase: 0 · Tier: haiku · Depends on: WP-0.1

## Read first
- `docs/open-source-reuse.md` (lint/format tool choice)

## Scope
- Install `@biomejs/biome` as a dev dependency.
- `biome.json` with recommended rules enabled, formatter on, tuned to not fight Svelte SFC files (ignore `*.svelte` from the formatter if Biome's Svelte support is incomplete; still lint the `<script>` TS).
- Add `lint` npm script: `biome check .`.
- Set `tsconfig.json` to `strict: true` plus `noUncheckedIndexedAccess`, `noImplicitOverride`.

## Files
`biome.json`, `package.json` (lint script + devDependency), `tsconfig.json`

## Acceptance
- `npm run lint` runs and passes on the current scaffold.
- `npx tsc --noEmit` passes.

## Out of scope
- Fixing lint issues in code that doesn't exist yet.
- CI wiring (already done in WP-0.3).
