// Pure, per-`WorkType` presentation lookups shared by WorkCard.svelte (feed
// card) and views/Work.svelte (detail page) so the colour and glyph a reader
// learns on a card mean the same thing on the page it opens. No Svelte
// imports — unit-tested in tests/workCard.spec.ts.

import type { WorkType } from '$lib/types/work';

export interface Accent {
  /** The `-500` colour: accent bar, icons, borders only (docs/design-system.md §7). */
  bar: string;
  /** Soft tint for badge and cover-box fills. */
  tint: string;
  /** AA-safe `*-text` variant for small text set in the accent. */
  text: string;
}

/**
 * Accent CSS custom-property names by `type`, per docs/design-system.md
 * ("poem=teal, story=vermilion, book=ochre") plus two sensible reuses for
 * the two types the design system doesn't assign a dedicated hue to
 * (§8 rules out inventing new hues beyond the four specimen accents):
 * essay borrows the cooler `saved` (sky) family — reflective, non-fiction
 * prose — and play borrows `story` (vermilion) — both are performed/staged
 * narrative forms.
 */
export const ACCENT_BY_TYPE: Record<WorkType, Accent> = {
  poem: {
    bar: 'var(--accent-poem)',
    tint: 'var(--accent-poem-tint)',
    text: 'var(--accent-poem-text)',
  },
  short_story: {
    bar: 'var(--accent-story)',
    tint: 'var(--accent-story-tint)',
    text: 'var(--accent-story-text)',
  },
  book: {
    bar: 'var(--accent-book)',
    tint: 'var(--accent-book-tint)',
    text: 'var(--accent-book-text)',
  },
  essay: {
    bar: 'var(--accent-saved)',
    tint: 'var(--accent-saved-tint)',
    text: 'var(--accent-saved-text)',
  },
  play: {
    bar: 'var(--accent-story)',
    tint: 'var(--accent-story-tint)',
    text: 'var(--accent-story-text)',
  },
};

/** The accent family for a work type. */
export function accentFor(type: WorkType): Accent {
  return ACCENT_BY_TYPE[type];
}

/**
 * One hand-drawn 24×24 stroke glyph per work type, as an SVG path `d`
 * string (render with `fill="none" stroke="currentColor"`, matching the
 * card's action icons). Together with the type badge these are what tell a
 * reader what the card's accent colour *means*. Hand-inlined rather than an
 * icon package: docs/design-system.md §8, no imported UI kit.
 */
export const TYPE_GLYPHS: Record<WorkType, string> = {
  // A quill: feather leaf with a midrib running to the nib.
  poem: 'M4 20c1-4 4-8 8-12 2-2 5-3 8-4-1 3-2 6-4 8-4 4-8 7-12 8Z M4 20l9-9',
  // A single page with a folded corner and two lines of text.
  short_story: 'M7 3h7l5 5v13H7V3Z M14 3v5h5 M10 13h6 M10 17h6',
  // A closed book seen from the front, spine on the left.
  book: 'M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4Z M5 18a2 2 0 0 1 2-2h11 M9 4v12',
  // Lines of text with a pen laid across the lower right.
  essay: 'M5 5h14 M5 9h14 M5 13h8 M5 17h5 M18.5 12.5l-5 5-1 3 3-1 5-5a1.4 1.4 0 0 0-2-2Z',
  // A theatre mask: eyes and a smiling mouth.
  play: 'M6 4h12v8a6 6 0 0 1-12 0V4Z M9 9h2 M13 9h2 M9 14c1 1.5 5 1.5 6 0',
};

/** The glyph path for a work type. */
export function typeGlyphFor(type: WorkType): string {
  return TYPE_GLYPHS[type];
}
