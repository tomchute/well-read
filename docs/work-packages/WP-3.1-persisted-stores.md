# WP-3.1 — Versioned localStorage stores
Phase: 3 · Tier: sonnet · Depends on: WP-0.1

## Read first
- `docs/recommendation-design.md` (localStorage state shape — implement these six keys exactly)

## Scope
- A tiny hand-rolled `persisted` helper (Svelte 5 runes-based; `svelte-persisted-store` documented as fallback in `docs/open-source-reuse.md` if the hand-rolled version proves insufficient).
- Implement the six `wellread:v1:*` keys from `docs/recommendation-design.md`: `weights`, `seen`, `reactions`, `saved`, `read`, `sessionPins`.
- Safe JSON parse/stringify: a corrupted or missing value falls back to the documented default (all-zero weights, empty maps/arrays) rather than throwing.

## Files
`src/lib/stores/persisted.ts`, `src/lib/stores/index.ts` (or one file per key)

## Acceptance
- Vitest covers read/write and default-fallback behaviour for each of the six keys.
- Manually confirm in browser devtools that the keys appear under `localStorage` exactly as `wellread:v1:weights`, `wellread:v1:seen`, etc.

## Out of scope
- The scoring math itself (WP-3.2).
- Any UI wiring (WP-3.3 onward).
