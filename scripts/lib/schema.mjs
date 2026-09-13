// Zod schema for the `Work` content type. Plain JS (no TS syntax) so both
// Node scripts (scripts/validate-content.mjs, scripts/build-manifest.mjs, ...)
// and the Vite/TS app (via src/lib/types/work.ts, `z.infer`) share one source
// of truth.
//
// Source of truth for shape: docs/content-schema.md
// Source of truth for the theme vocabulary: docs/editorial-policy.md

import { z } from 'zod';

// -------- controlled theme vocabulary --------
// Exactly the 32 terms from docs/editorial-policy.md's "Controlled theme
// vocabulary" table. Exported so scripts and the app share the same list
// (e.g. for theme filter UI, coverage reports).
export const THEME_VOCABULARY = [
  'love',
  'desire',
  'grief',
  'death',
  'mortality',
  'memory',
  'time',
  'childhood',
  'family',
  'friendship',
  'solitude',
  'nature',
  'seasons',
  'animals',
  'the-city',
  'work',
  'war',
  'exile',
  'migration',
  'home',
  'faith',
  'doubt',
  'justice',
  'power',
  'race',
  'gender',
  'the-body',
  'illness',
  'art-making',
  'language',
  'humor',
  'wonder',
];

const THEME_SET = new Set(THEME_VOCABULARY);

// -------- enums / literal unions --------

export const WorkTypeSchema = z.enum(['poem', 'short_story', 'book', 'essay', 'play']);

// Types that never ship the whole work as `textPolicy: 'full'` — always
// 'excerpt' or 'pending' (docs/content-schema.md, validation rule 5).
const NEVER_FULL_TYPES = new Set(['book', 'essay', 'play']);

export const EraSchema = z.enum([
  'ancient',
  'medieval',
  'renaissance',
  '18th_century',
  '19th_century',
  'early_20th_century',
  'mid_20th_century',
  'contemporary',
]);

export const TextPolicySchema = z.enum(['full', 'excerpt', 'pending']);

export const EbookProviderSchema = z.enum(['standard-ebooks', 'gutenberg', 'open-library']);

export const EbookFormatSchema = z.enum(['epub', 'pdf', 'mobi', 'html']);

export const ExternalLinkKindSchema = z.enum([
  'publisher',
  'bookstore',
  'library',
  'poetry-foundation',
  'author-site',
  'other',
]);

export const SourceLicenseSchema = z.enum([
  'public-domain',
  'cc0',
  'cc-by',
  'cc-by-sa',
  'all-rights-reserved',
]);

// Licenses treated as "public-domain-ish" for the full-text link-source rule
// (docs/content-schema.md, validation rule 1).
const PUBLIC_DOMAIN_ISH_LICENSES = new Set(['public-domain', 'cc0']);

// -------- shared field validators --------

// ISO 8601 calendar date, e.g. "2026-09-13".
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO 8601 date (YYYY-MM-DD)');

// Ids are kebab-case, lowercase letters/digits, hyphen-separated segments.
const KEBAB_CASE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const nonEmptyString = z.string().min(1);

// -------- composite fields --------

export const LengthSchema = z.object({
  unit: z.enum(['lines', 'words', 'pages']),
  value: z.number().int().positive(),
});

export const SourceInfoSchema = z.object({
  name: nonEmptyString,
  url: nonEmptyString,
  license: SourceLicenseSchema,
  retrievedDate: isoDate,
});

export const EbookLinkSchema = z.object({
  provider: EbookProviderSchema,
  format: EbookFormatSchema,
  url: nonEmptyString,
});

export const ExternalLinkSchema = z.object({
  kind: ExternalLinkKindSchema,
  url: nonEmptyString,
  label: z.string().min(1).optional(),
});

export const MasterNotesSchema = z.object({
  context: nonEmptyString,
  form: nonEmptyString,
  keyImages: z.array(nonEmptyString).min(2, 'masterNotes.keyImages must have at least 2 entries'),
  whatToNotice: z.array(nonEmptyString).min(1),
  discussionQuestions: z
    .array(nonEmptyString)
    .min(3, 'masterNotes.discussionQuestions must have at least 3 entries'),
  furtherReading: z.array(nonEmptyString).min(1),
});

export const PipelineSchema = z.object({
  batchId: nonEmptyString,
  dateAdded: isoDate,
  curatedBy: nonEmptyString,
  schemaVersion: z.literal(1),
});

// -------- the Work schema --------

const WorkBaseSchema = z.object({
  id: z.string().regex(KEBAB_CASE_ID, 'id must be kebab-case (lowercase letters, digits, hyphens)'),
  type: WorkTypeSchema,
  title: nonEmptyString,
  author: nonEmptyString,
  year: z.number().int(),
  era: EraSchema,
  form: nonEmptyString,
  themes: z.array(z.string()).refine((themes) => themes.every((t) => THEME_SET.has(t)), {
    message: `themes must be a subset of the controlled vocabulary in docs/editorial-policy.md: ${THEME_VOCABULARY.join(', ')}`,
  }),
  tags: z.array(z.string()),
  length: LengthSchema,
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  source: SourceInfoSchema,
  textPolicy: TextPolicySchema,
  text: z.string().min(1).optional(),
  excerpt: z.string().min(1).optional(),
  excerptNote: z.string().min(1).optional(),
  ebookLinks: z.array(EbookLinkSchema).optional(),
  externalLinks: z.array(ExternalLinkSchema).optional(),
  cover: z.string().min(1).optional(),
  masterNotes: MasterNotesSchema,
  pipeline: PipelineSchema,
  authorGender: z.enum(['woman', 'man', 'non-binary', 'unknown']).optional(),
  authorRegion: z.string().min(1).optional(),
});

/**
 * Count "lines" or "words" in shipped text, for the excerpt-minimum gates.
 * Mirrors how `length.value` is defined (docs/content-schema.md: "count for
 * the unit above, of the shipped text").
 */
/** @param {string} text */
function countLines(text) {
  return text.split('\n').filter((/** @type {string} */ line) => line.trim().length > 0).length;
}

/** @param {string} text */
function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export const WorkSchema = WorkBaseSchema.superRefine((work, ctx) => {
  const isPublicDomainIsh = PUBLIC_DOMAIN_ISH_LICENSES.has(work.source.license);
  const ebookLinkCount = work.ebookLinks?.length ?? 0;
  const externalLinkCount = work.externalLinks?.length ?? 0;

  // Rule 4: books, essays, and plays never ship `full` — always excerpted or
  // pending, even public domain.
  if (NEVER_FULL_TYPES.has(work.type) && work.textPolicy === 'full') {
    ctx.addIssue({
      code: 'custom',
      path: ['textPolicy'],
      message:
        "types 'book', 'essay', and 'play' must always use textPolicy 'excerpt' or 'pending' (never 'full')",
    });
  }

  if (work.textPolicy === 'full') {
    // Rule 1: full => text is set.
    if (!work.text) {
      ctx.addIssue({
        code: 'custom',
        path: ['text'],
        message: "textPolicy 'full' requires `text` to be set",
      });
    }
    // Rule 1: full => excerpt/excerptNote must not be set.
    if (work.excerpt) {
      ctx.addIssue({
        code: 'custom',
        path: ['excerpt'],
        message: "textPolicy 'full' must not set `excerpt`",
      });
    }
    if (work.excerptNote) {
      ctx.addIssue({
        code: 'custom',
        path: ['excerptNote'],
        message: "textPolicy 'full' must not set `excerptNote`",
      });
    }
    // Rule 1: full + public-domain-ish => ebookLinks >= 1; otherwise externalLinks >= 1.
    if (isPublicDomainIsh) {
      if (ebookLinkCount < 1) {
        ctx.addIssue({
          code: 'custom',
          path: ['ebookLinks'],
          message:
            "textPolicy 'full' with a public-domain-ish source.license requires at least 1 ebookLinks entry",
        });
      }
    } else if (externalLinkCount < 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['externalLinks'],
        message:
          "textPolicy 'full' with a non-public-domain source.license requires at least 1 externalLinks entry",
      });
    }
  }

  if (work.textPolicy === 'excerpt') {
    // Rule 2: excerpt => excerpt + excerptNote set, externalLinks >= 1, text not set.
    if (!work.excerpt) {
      ctx.addIssue({
        code: 'custom',
        path: ['excerpt'],
        message: "textPolicy 'excerpt' requires `excerpt` to be set",
      });
    }
    if (!work.excerptNote) {
      ctx.addIssue({
        code: 'custom',
        path: ['excerptNote'],
        message: "textPolicy 'excerpt' requires `excerptNote` to be set",
      });
    }
    if (externalLinkCount < 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['externalLinks'],
        message: "textPolicy 'excerpt' requires at least 1 externalLinks entry",
      });
    }
    if (work.text) {
      ctx.addIssue({
        code: 'custom',
        path: ['text'],
        message: "textPolicy 'excerpt' must not set `text`",
      });
    }

    // Rule 3: excerpt minimums — poems >= 8 lines, prose (short_story/book/
    // essay/play) >= 500 words.
    if (work.excerpt) {
      if (work.type === 'poem') {
        const lines = countLines(work.excerpt);
        if (lines < 8) {
          ctx.addIssue({
            code: 'custom',
            path: ['excerpt'],
            message: `poem excerpts must be at least 8 lines (found ${lines})`,
          });
        }
      } else {
        const words = countWords(work.excerpt);
        if (words < 500) {
          ctx.addIssue({
            code: 'custom',
            path: ['excerpt'],
            message: `prose excerpts must be at least 500 words (found ${words})`,
          });
        }
      }
    }
  }

  if (work.textPolicy === 'pending') {
    // Rule (pending): no text, no excerpt, externalLinks >= 1, tags includes 'needs-text'.
    if (work.text) {
      ctx.addIssue({
        code: 'custom',
        path: ['text'],
        message: "textPolicy 'pending' must not set `text`",
      });
    }
    if (work.excerpt) {
      ctx.addIssue({
        code: 'custom',
        path: ['excerpt'],
        message: "textPolicy 'pending' must not set `excerpt`",
      });
    }
    if (externalLinkCount < 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['externalLinks'],
        message: "textPolicy 'pending' requires at least 1 externalLinks entry",
      });
    }
    if (!work.tags.includes('needs-text')) {
      ctx.addIssue({
        code: 'custom',
        path: ['tags'],
        message: 'textPolicy \'pending\' requires `tags` to include "needs-text"',
      });
    }
  }

  // `length.unit` follows the shipped text's kind: lines for poems, pages for
  // plays, words for all other prose (short_story, book, essay).
  /** @type {Partial<Record<string, string>>} */
  const UNIT_BY_TYPE = { poem: 'lines', play: 'pages' };
  const expectedUnit = UNIT_BY_TYPE[work.type] ?? 'words';
  if (work.length.unit !== expectedUnit) {
    ctx.addIssue({
      code: 'custom',
      path: ['length', 'unit'],
      message: `type '${work.type}' must use length.unit '${expectedUnit}'`,
    });
  }
});
