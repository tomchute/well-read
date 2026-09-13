# WP-2.6 — Motion, view transitions, keyboard shortcuts
Phase: 2 · Tier: sonnet · Depends on: WP-1.3, WP-2.1

## Read first
- `docs/design-system.md` (motion timing 150-250ms ease-out, `prefers-reduced-motion` rule, interaction feel)

## Scope
- Use the View Transitions API for feed→detail navigation.
- All transitions run 150–250ms ease-out and are disabled or shortened to near-instant under `prefers-reduced-motion: reduce`.
- Keyboard shortcuts: `j`/`k` move to next/previous card in the feed, `s` saves the focused card, `m` triggers "more like this" on it (if scoring isn't wired yet at this point in the build order, call a documented stub and note it in the report).

## Files
`src/lib/actions/shortcuts.ts`, view-transition wiring in `App.svelte` / `Feed.svelte` / `Detail.svelte`

## Acceptance
- Navigating feed→detail visibly animates in normal mode; emulating `prefers-reduced-motion: reduce` in devtools removes/shortens the animation.
- `j`/`k`/`s`/`m` operate on the focused card as described.

## Out of scope
- The real steering-chip wiring for `m` (WP-3.3) if not yet available — a stub is acceptable here.
