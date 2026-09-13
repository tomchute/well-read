// Zod shapes for every persisted store, plus their documented defaults.
//
// See docs/recommendation-design.md ("localStorage state shape") for the six
// `wellread:v1:*` keys, and docs/work-packages/WP-3.6-kindle-helper-export-import.md
// for the settings/kindleEmail field (kept out of the `wellread:v1:*` prefix
// on purpose — it is not one of the versioned scoring keys).

import { z } from 'zod';

export const WeightsSchema = z.object({
  theme: z.record(z.string(), z.number()),
  form: z.record(z.string(), z.number()),
  era: z.record(z.string(), z.number()),
  author: z.record(z.string(), z.number()),
});
export type Weights = z.infer<typeof WeightsSchema>;

export const SeenSchema = z.record(z.string(), z.string());
export type SeenMap = z.infer<typeof SeenSchema>;

export const ReactionSchema = z.union([z.literal(1), z.literal(-1)]);
export const ReactionsSchema = z.record(z.string(), ReactionSchema);
export type Reactions = z.infer<typeof ReactionsSchema>;

export const SavedSchema = z.array(z.string());
export type Saved = z.infer<typeof SavedSchema>;

export const ReadSchema = z.array(z.string());
export type Read = z.infer<typeof ReadSchema>;

export const SessionPinSchema = z.object({
  theme: z.string(),
  strength: z.number(),
  appliedCount: z.number(),
});
export const SessionPinsSchema = z.array(SessionPinSchema);
export type SessionPin = z.infer<typeof SessionPinSchema>;
export type SessionPins = z.infer<typeof SessionPinsSchema>;

// Not one of the versioned `wellread:v1:*` scoring keys (see
// docs/work-packages/WP-3.6-kindle-helper-export-import.md) but bundled here
// so the whole app state can round-trip through one export/import pair.
//
// `onboardingDone` (WP-3.5) is optional-without-default on purpose: existing
// stored/serialized settings that predate this field must keep parsing to
// exactly the same shape they had before (no key silently injected), so
// `shouldShowOnboarding` in src/lib/components/onboarding.ts treats a
// missing value the same as `false`.
export const SettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  kindleEmail: z.string().nullable(),
  onboardingDone: z.boolean().optional(),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_WEIGHTS: Weights = { theme: {}, form: {}, era: {}, author: {} };
export const DEFAULT_SEEN: SeenMap = {};
export const DEFAULT_REACTIONS: Reactions = {};
export const DEFAULT_SAVED: Saved = [];
export const DEFAULT_READ: Read = [];
export const DEFAULT_SESSION_PINS: SessionPins = [];
export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  kindleEmail: null,
  onboardingDone: false,
};
