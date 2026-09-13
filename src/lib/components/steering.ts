// Pure helpers for SteeringBar.svelte: chip list construction, active-state
// derivation from weights, and label formatting. No Svelte imports, no
// `localStorage` — mirrors the workLinks.ts pattern (a component-scoped pure
// module) rather than putting this logic in the component's `<script>`.
//
// See docs/recommendation-design.md ("Chip actions") for the deltas each
// action applies and docs/design-system.md ("SteeringChip") for the states
// the component derives from the booleans below.
//
// Note: docs/recommendation-design.md's chip table (and the `ChipAction`
// union in src/lib/scoring/types.ts) defines only a "Less <form>" action —
// there is no "more-form" counterpart in the pure scoring API. The form row
// below therefore offers "less <category>" chips only, even though this
// WP's scope note says "more/less poems | stories | books | essays | plays";
// see this WP's report for the flagged gap.

import type { ChipAction, Weights } from '$lib/scoring';
import { THEME_VOCABULARY } from '$lib/types/work';

/** Curated subset of the 32-term controlled vocabulary shown before "more…". */
export const CURATED_THEMES: readonly string[] = [
  'love',
  'grief',
  'memory',
  'nature',
  'solitude',
  'war',
  'home',
  'faith',
  'wonder',
  'humor',
];

/**
 * The five coarse work categories the form row steers by — the `WorkType`
 * values from docs/content-schema.md, not the free-text `Work.form`
 * sub-genre field (which scoring keys `weights.form` by).
 */
export const FORM_CATEGORIES: readonly { key: string; label: string }[] = [
  { key: 'poem', label: 'poems' },
  { key: 'short_story', label: 'stories' },
  { key: 'book', label: 'books' },
  { key: 'essay', label: 'essays' },
  { key: 'play', label: 'plays' },
];

export interface ThemeChip {
  theme: string;
  label: string;
  active: boolean;
}

export interface FormChip {
  form: string;
  label: string;
  active: boolean;
}

function capitalize(word: string): string {
  if (word.length === 0) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Turns a kebab-case vocabulary term into a Title Case label, e.g. "the-city" -> "The City". */
export function formatThemeLabel(theme: string): string {
  return theme.split('-').map(capitalize).join(' ');
}

/** A theme reads as "on" once "more about X" has pushed its weight positive. */
export function isThemeActive(weights: Weights, theme: string): boolean {
  return (weights.theme[theme] ?? 0) > 0;
}

/** A form category reads as "on" once "less <form>" has pushed its weight negative. */
export function isFormActive(weights: Weights, form: string): boolean {
  return (weights.form[form] ?? 0) < 0;
}

/**
 * Builds the mood/theme chip row: the curated subset by default, or the
 * curated chips followed by the rest of the controlled vocabulary once
 * expanded. Curated chips keep a stable position so expanding never
 * reshuffles what's already on screen.
 */
export function buildThemeChips(weights: Weights, expanded: boolean): ThemeChip[] {
  const themes = expanded
    ? [...CURATED_THEMES, ...THEME_VOCABULARY.filter((theme) => !CURATED_THEMES.includes(theme))]
    : CURATED_THEMES;
  return themes.map((theme) => ({
    theme,
    label: formatThemeLabel(theme),
    active: isThemeActive(weights, theme),
  }));
}

/** Builds the five "less <form>" chips, active state derived from `weights.form`. */
export function buildFormChips(weights: Weights): FormChip[] {
  return FORM_CATEGORIES.map(({ key, label }) => ({
    form: key,
    label,
    active: isFormActive(weights, key),
  }));
}

export function moreAboutThemeChip(theme: string): ChipAction {
  return { type: 'more-about-theme', theme };
}

export function lessFormChip(form: string): ChipAction {
  return { type: 'less-form', form };
}

export function surpriseMeChip(): ChipAction {
  return { type: 'surprise-me' };
}
