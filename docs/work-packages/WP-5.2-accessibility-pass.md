# WP-5.2 — Accessibility pass
Phase: 5 · Tier: sonnet · Depends on: Phase 3 complete

## Read first
- `docs/design-system.md` (a11y contrast table, motion rules)

## Scope
- Audit and fix focus states, ARIA roles/labels for cards, sheets, and steering chips.
- Verify colour contrast against `docs/design-system.md`'s tokens; adjust any token failing WCAG AA.
- Add a skip-to-content link; confirm `prefers-reduced-motion` is respected everywhere (builds on WP-2.6).

## Files
Various `src/lib/components/*.svelte`, `src/lib/styles/tokens.css` (contrast fixes)

## Acceptance
- Lighthouse accessibility score recorded in the PR/report (target ≥ 90).
- Keyboard-only navigation (no mouse) can reach and operate every interactive element.

## Out of scope
- Full WCAG AAA compliance.
- Screen-reader-specific copy beyond ARIA labeling.
