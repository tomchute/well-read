# WP-2.1 — Design tokens, self-hosted fonts, typography base
Phase: 2 · Tier: sonnet · Depends on: WP-0.1

## Read first
- `docs/design-system.md` (palette, type scale, motion rules, reference image, dark mode, a11y contrast table)

## Scope
- Implement the palette, spacing, and motion tokens from `docs/design-system.md` as CSS custom properties (built on `open-props` per `docs/open-source-reuse.md`), including the dark-mode variants.
- Self-host the humanist serif (Fraunces or Newsreader) and UI sans (Inter) as `woff2` files with `@font-face` — no runtime Google Fonts CDN request.
- Base typography: ~65ch measure, generous line-height, real small caps and hanging punctuation where supported; poems preserve line breaks and indentation exactly (`white-space: pre-wrap` or equivalent on poem text containers).

## Files
`src/lib/styles/tokens.css`, `src/lib/styles/fonts.css`, font files under `src/assets/fonts/` (or `public/fonts/`)

## Acceptance
- App renders on the cream paper background with ink text and the self-hosted serif/sans loaded (no visible fallback-only render after fonts finish loading).
- `npm run build` includes the font files in `dist`.

## Out of scope
- Individual component styling (later Phase 2 WPs).
- The dark-mode toggle control itself (tokens only; wiring is whichever WP adds the control, if any).
