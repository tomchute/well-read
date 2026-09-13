# WP-2.4 — Work detail + master-notes side/bottom sheet
Phase: 2 · Tier: sonnet · Depends on: WP-1.3, WP-2.1, WP-2.2

## Read first
- `docs/design-system.md` (side sheet desktop / bottom sheet mobile, breakpoints, motion feel)
- `docs/master-notes-style-guide.md` (section structure to render)
- `docs/open-source-reuse.md` (`marked` + `DOMPurify` for Markdown master notes)

## Scope
- `Detail.svelte`: renders a full `Work` (fetched from its shard), including its text/excerpt with correct formatting.
- `MasterNotesSheet.svelte`: renders all `masterNotes` sections (context, form, keyImages, whatToNotice, discussionQuestions, furtherReading) as sanitised Markdown via `marked` + `DOMPurify`.
- Layout: side sheet on desktop widths, bottom sheet on mobile widths, per the design system's breakpoint.

## Files
`src/views/Detail.svelte`, `src/lib/components/MasterNotesSheet.svelte`

## Acceptance
- Opening a seed work's detail shows every `masterNotes` section with correctly rendered Markdown.
- Narrowing the viewport to mobile width switches the sheet to a bottom-sheet layout.
- No unsanitised HTML executes (confirm `DOMPurify.sanitize` wraps every rendered Markdown string).

## Out of scope
- Link-type rendering rules (WP-2.5), motion/transition polish (WP-2.6).
