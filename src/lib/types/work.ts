// Re-exports the `Work` zod schema (scripts/lib/schema.mjs) as a TS type, so
// the app and the Node scripts share one source of truth.
//
// See docs/content-schema.md for the shape and docs/editorial-policy.md for
// the theme vocabulary.

import type { z } from 'zod';
import {
  type EbookFormatSchema,
  type EbookLinkSchema,
  type EbookProviderSchema,
  type EraSchema,
  type ExternalLinkKindSchema,
  type ExternalLinkSchema,
  type LengthSchema,
  type MasterNotesSchema,
  type PipelineSchema,
  type SourceInfoSchema,
  type SourceLicenseSchema,
  type TextPolicySchema,
  THEME_VOCABULARY,
  WorkSchema,
  type WorkTypeSchema,
} from '../../../scripts/lib/schema.mjs';

export { THEME_VOCABULARY, WorkSchema };

export type WorkType = z.infer<typeof WorkTypeSchema>;
export type Era = z.infer<typeof EraSchema>;
export type TextPolicy = z.infer<typeof TextPolicySchema>;
export type EbookProvider = z.infer<typeof EbookProviderSchema>;
export type EbookFormat = z.infer<typeof EbookFormatSchema>;
export type ExternalLinkKind = z.infer<typeof ExternalLinkKindSchema>;
export type SourceLicense = z.infer<typeof SourceLicenseSchema>;
export type Length = z.infer<typeof LengthSchema>;
export type SourceInfo = z.infer<typeof SourceInfoSchema>;
export type EbookLink = z.infer<typeof EbookLinkSchema>;
export type ExternalLink = z.infer<typeof ExternalLinkSchema>;
export type MasterNotes = z.infer<typeof MasterNotesSchema>;
export type Pipeline = z.infer<typeof PipelineSchema>;

export type Work = z.infer<typeof WorkSchema>;
