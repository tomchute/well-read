# WP-2.5 — Ebook/external link rendering by `textPolicy`
Phase: 2 · Tier: haiku · Depends on: WP-1.3, WP-2.1

## Read first
- `docs/content-schema.md` (`textPolicy` branch: full ⇒ ebookLinks or externalLinks; excerpt ⇒ excerptNote + externalLinks)

## Scope
- `WorkLinks.svelte`: a reusable component that, given a `Work`, renders the correct link block for its `textPolicy`: `full` + public-domain shows `ebookLinks` (e.g. "Download EPUB"); `full` + contemporary shows `externalLinks` only; `excerpt` shows the `excerptNote` banner text plus `externalLinks` ("Read the rest at ...").
- Designed to drop into both `WorkCard` (WP-2.3) and `Detail` (WP-2.4) without needing changes to those components' internals beyond importing it.

## Files
`src/lib/components/WorkLinks.svelte`

## Acceptance
- A full/public-domain seed work shows its ebook download link(s).
- An excerpt seed work shows its `excerptNote` text and external "read more" link(s), with no raw excerpt text overflowing its container.

## Out of scope
- The card/detail containers themselves (WP-2.3/WP-2.4 own those; this WP only supplies the link block).
