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

## Result

Added `@axe-core/playwright` as a dev dependency and `tests/e2e/a11y.spec.ts`,
which runs axe (`wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa` tags) against the feed
(after Skip), a work detail page with the master-notes sheet open, the
library, and settings — failing on any `serious`/`critical` violation and
logging `moderate`/`minor` ones to the report without failing the run.
Lighthouse is not available in this environment (no Chrome DevTools /
`lighthouse` CLI access), so its ≥90 accessibility-score target from the
original Acceptance section could not be measured; the axe run above is the
substitute automated check, backed by the manual audit below.

### Axe results — before fixes

| Page | Violations (all impacts) |
|---|---|
| Feed | 0 |
| Work detail + master notes | 1 type: `color-contrast`, **serious**, 5 nodes (the master-notes tab strip's inactive tabs) — flaky: only reproduced when axe ran mid-way through the sheet's open transition; settled state was already compliant |
| Library | 0 |
| Settings | 2 types: `color-contrast` **serious** (9 nodes — About-section links set in `--accent-poem`, ~3.2:1) and `link-in-text-block` **serious** (1 node — a link distinguished only by that same under-contrast colour) |

### Axe results — after fixes

| Page | Violations (all impacts) |
|---|---|
| Feed | 0 |
| Work detail + master notes (sheet open, transition settled) | 0 |
| Library | 0 |
| Settings | 0 |

`npx playwright test` (smoke + a11y, 6 tests) is green and stable across
repeated runs, including default 2-worker parallelism.

### Fixes made

- **Colour contrast (design-system.md §7):** `Settings.svelte`'s About-section
  links and the onboarding quiz's "Start reading" button used a raw accent
  (`--accent-poem`, ~3.2:1 on paper) as text/button-fill colour instead of its
  `*-text` variant; both now use `--accent-poem-text` (~5.4:1), and the
  About-section links also gained a permanent underline so they aren't
  distinguished by colour alone (`link-in-text-block`).
- **Focus ring never removed:** `Settings.svelte`'s Kindle email input had
  `input[type='email']:focus { outline: none; ... }`, dropping the ring
  entirely on click-focus. Changed to `:focus-visible` with the standard
  2px `--accent-poem-text` ring kept alongside the border-colour change.
- **Skip-to-content link:** added to `App.svelte`, jumping to `<main
  id="main-content" tabindex="-1">`.
- **One `h1` per page:** the app previously had zero `h1`s (Onboarding's was
  the only one, `Feed`/`Work`/`Library`/`Settings` all render `h2`). Rather
  than promote those `h2`s (the smoke test asserts `h2:has-text("Feed")` and
  `h2.work-title` — left untouched per "keep the smoke tests green"), the
  header's site name is now the single per-page `h1` (`<h1
  class="app-name-heading"><a class="app-name" href="#/">well-read</a></h1>`),
  and Onboarding's own `h1` was demoted to `h2` to avoid a duplicate when it
  and the header render together.
- **Dialog focus trap/restore:** the `?` keyboard-shortcuts overlay
  (`App.svelte`) had `role="dialog"`/`aria-modal` but no focus management at
  all. Added the same pattern already used by `MasterNotes.svelte`: focus
  moves to the close button on open, Tab/Shift+Tab is trapped within the
  panel, and focus restores to whatever opened it on close.
- **Roving tabindex + arrow keys on tabs (WAI-ARIA Tabs pattern):** neither
  `Library.svelte`'s section tabs nor `MasterNotes.svelte`'s section tabs
  moved DOM focus on arrow-key change (only the active-tab styling updated),
  and Library's tab buttons lacked the `id` their tabpanel's
  `aria-labelledby` pointed at. Both now set `tabindex="0"` on the selected
  tab only (`-1` elsewhere) and move real focus to the newly active tab on
  Left/Right/Up/Down (Home/End too); Library's missing tab `id`s were added.
- **Real bug found in the process:** `Library.svelte`'s `handleTabChange`
  called `navigate({ name: 'library' })`, but `navigate` was never imported
  — every tab click or arrow-key press threw a `ReferenceError` and silently
  did nothing, so the Library tabs were completely non-operable by keyboard
  *or* mouse before this pass. The call was dead weight (already on that
  route) and is removed rather than fixing the import.
- **Hit targets ≥44px:** `WorkLinks.svelte`'s download/external-link chips
  measured ~30px tall (padding only, no `min-height`); now `min-height: 44px`
  with flex centring. Also bumped the header's nav links and theme toggle to
  44px for consistency with the design system's blanket "every interactive
  control" rule, though they weren't explicitly named in scope.
- **`prefers-reduced-motion`:** `Onboarding.svelte` had transform-on-hover/
  press (taste-card press, "Start reading" hover/press scale) with no
  reduced-motion guard, unlike every other component; added one matching the
  existing pattern in `WorkCard`/`SteeringBar`/`Library`.
- **Focus order after onboarding:** Skipping or finishing the taste quiz
  removes its "Skip"/"Start reading" button from the DOM, which drops
  keyboard focus to `<body>` — the next Tab press then landed on an arbitrary
  point in the Feed (observed: straight into the middle of the steering
  chips) rather than the top of the new view. `Onboarding` now takes an
  `onDone` callback that focuses `<main>` before/as the view swaps.

### Manual checklist

- [x] Landmarks: `<header>` (implicit banner), `<nav aria-label="Primary">`,
      `<main id="main-content">` — one per page.
- [x] One `h1` per page (see "Fixes made" above).
- [x] Skip-to-content link, visible on focus, jumps into `<main>`.
- [x] Tab order reaches every card and its like/dislike/save/more-like-this
      actions, the steering chips, and every button in both dialogs; verified
      with a scripted keyboard walk (no mouse).
- [x] `aria-pressed` on every toggle button (card like/save, steering chips,
      Work's Save, onboarding taste cards) reflects live state.
- [x] `aria-label`s present on every icon-only button (card actions, sheet/
      overlay close buttons, Library's remove-from-saved button).
- [x] Tabs (Library, MasterNotes) follow the WAI-ARIA roving-tabindex pattern
      with Left/Right/Up/Down (+ Home/End); verified via scripted DOM checks
      that `tabindex` and real focus move together.
- [x] MasterNotes sheet: `role="dialog"`, `aria-modal="true"`,
      `aria-labelledby` on its title, Tab-trapped, focus enters on the close
      button and restores to the "Master notes" trigger on close — verified
      with a scripted open → Escape → focus-restored check.
- [x] Shortcuts overlay: same dialog contract, now with the same trap/restore
      (previously missing).
- [x] Visible focus ring (`:focus-visible`, 2px `--accent-poem-text`)
      confirmed on every interactive element; the one place it was
      suppressed (`Settings.svelte`'s email input, plain `:focus{outline:
      none}`) is fixed.
- [x] Hit targets ≥44px on chips and card actions (WorkCard actions,
      SteeringBar chips, Onboarding cards, Library tabs/remove button were
      already compliant; WorkLinks chips fixed — see above).
- [x] `prefers-reduced-motion` respected everywhere motion is used (token
      level in `tokens.css` plus per-component guards); Onboarding's gap
      fixed.
- [x] Colour contrast of text and badges against the tokens: every badge and
      status colour already used its `*-text` variant; the two places that
      didn't (Settings links, Onboarding's primary button) are fixed — see
      above. Re-verified against `docs/design-system.md`'s contrast table in
      both themes.
