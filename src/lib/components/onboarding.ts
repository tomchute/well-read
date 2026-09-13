// Pure helpers behind `Onboarding.svelte` — see
// docs/work-packages/WP-3.5-onboarding-quiz.md and docs/recommendation-design.md
// ("Cold start"): a skippable 6-7 card taste quiz, each card a theme(s)-plus-form
// pairing with a short evocative label. No Svelte here on purpose, so this
// module is plain-vitest testable (tests/onboarding.spec.ts).

import { withFormDelta, withThemeDelta } from '$lib/scoring/weights';
import type { Settings, Weights } from '$lib/stores/schema';

/** One taste-quiz card: a short evocative label pairing theme(s) with a form. */
export interface TasteCard {
  id: string;
  label: string;
  /** Controlled-vocabulary theme(s) from docs/editorial-policy.md this card represents. */
  themes: string[];
  /** Free-text form (matches the `Work.form` sub-genre field, docs/content-schema.md). */
  form: string;
}

/** `theme[t] += 3` for each selected card's themes — docs/recommendation-design.md ("Cold start"). */
export const ONBOARDING_THEME_DELTA = 3;
/** `form[f] += 1` for each selected card's form. */
export const ONBOARDING_FORM_DELTA = 1;

/**
 * The 6-7 taste cards shown by the quiz. Order is fixed (not shuffled) so the
 * quiz reads the same way every first run; themes are drawn from the
 * controlled vocabulary in docs/editorial-policy.md and forms are plausible
 * free-text `Work.form` values.
 */
export const TASTE_CARDS: readonly TasteCard[] = [
  { id: 'love-sonnets', label: 'Love, in sonnets', themes: ['love'], form: 'sonnet' },
  {
    id: 'grief-short-fiction',
    label: 'Grief and memory in short fiction',
    themes: ['grief', 'memory'],
    form: 'short story',
  },
  {
    id: 'cities-novels',
    label: 'Cities and work in novels',
    themes: ['the-city', 'work'],
    form: 'novel',
  },
  {
    id: 'wonder-poems',
    label: 'Wonder and nature in poems',
    themes: ['wonder', 'nature'],
    form: 'poem',
  },
  {
    id: 'justice-essays-plays',
    label: 'Justice and power in essays and plays',
    themes: ['justice', 'power'],
    form: 'essay',
  },
  {
    id: 'humour-language',
    label: 'Humour and language',
    themes: ['humor', 'language'],
    form: 'wordplay',
  },
  {
    id: 'exile-translation',
    label: 'Exile and home in translation',
    themes: ['exile', 'home'],
    form: 'translation',
  },
] as const;

/**
 * Seeds `weights` from the chosen cards: `+3` to each theme of each chosen
 * card, `+1` to that card's form. Pure — returns a new `Weights`, never
 * mutates `weights`. Choosing no cards (a full skip) returns `weights`
 * unchanged, leaving all-zero weights per docs/recommendation-design.md.
 */
export function seedWeightsFromCards(weights: Weights, chosen: readonly TasteCard[]): Weights {
  let next = weights;
  for (const card of chosen) {
    for (const theme of card.themes) {
      next = withThemeDelta(next, theme, ONBOARDING_THEME_DELTA);
    }
    next = withFormDelta(next, card.form, ONBOARDING_FORM_DELTA);
  }
  return next;
}

/**
 * Whether the quiz should be shown: true until `onboardingDone` is set (on
 * either Start reading or Skip), per docs/recommendation-design.md ("Cold
 * start") — a missing value (settings predating this field) counts as
 * "not yet onboarded".
 */
export function shouldShowOnboarding(settings: Pick<Settings, 'onboardingDone'>): boolean {
  return !settings.onboardingDone;
}
