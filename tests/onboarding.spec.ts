// Vitest cases for src/lib/components/onboarding.ts — see
// docs/work-packages/WP-3.5-onboarding-quiz.md and
// docs/recommendation-design.md ("Cold start").

import { describe, expect, it } from 'vitest';
import {
  ONBOARDING_FORM_DELTA,
  ONBOARDING_THEME_DELTA,
  seedWeightsFromCards,
  shouldShowOnboarding,
  TASTE_CARDS,
  type TasteCard,
} from '../src/lib/components/onboarding';
import { DEFAULT_SETTINGS } from '../src/lib/stores/schema';
import type { Weights } from '../src/lib/stores/schema';

function zeroWeights(): Weights {
  return { theme: {}, form: {}, era: {}, author: {} };
}

describe('TASTE_CARDS', () => {
  it('has between 6 and 7 cards', () => {
    expect(TASTE_CARDS.length).toBeGreaterThanOrEqual(6);
    expect(TASTE_CARDS.length).toBeLessThanOrEqual(7);
  });

  it('gives every card a unique id, a non-empty label, at least one theme, and a form', () => {
    const ids = new Set<string>();
    for (const card of TASTE_CARDS) {
      expect(card.label.length).toBeGreaterThan(0);
      expect(card.themes.length).toBeGreaterThan(0);
      expect(card.form.length).toBeGreaterThan(0);
      expect(ids.has(card.id)).toBe(false);
      ids.add(card.id);
    }
  });
});

describe('seedWeightsFromCards', () => {
  it('applies +3 to each theme and +1 to the form of a single chosen card', () => {
    const card: TasteCard = { id: 'x', label: 'X', themes: ['love'], form: 'sonnet' };
    const result = seedWeightsFromCards(zeroWeights(), [card]);
    expect(result.theme.love).toBe(ONBOARDING_THEME_DELTA);
    expect(result.form.sonnet).toBe(ONBOARDING_FORM_DELTA);
  });

  it('applies the theme delta to every theme on a multi-theme card', () => {
    const card: TasteCard = {
      id: 'x',
      label: 'X',
      themes: ['grief', 'memory'],
      form: 'short story',
    };
    const result = seedWeightsFromCards(zeroWeights(), [card]);
    expect(result.theme.grief).toBe(3);
    expect(result.theme.memory).toBe(3);
    expect(result.form['short story']).toBe(1);
  });

  it('accumulates deltas across multiple chosen cards, including a shared theme', () => {
    const cardA: TasteCard = { id: 'a', label: 'A', themes: ['love'], form: 'sonnet' };
    const cardB: TasteCard = { id: 'b', label: 'B', themes: ['love'], form: 'novel' };
    const result = seedWeightsFromCards(zeroWeights(), [cardA, cardB]);
    expect(result.theme.love).toBe(6);
    expect(result.form.sonnet).toBe(1);
    expect(result.form.novel).toBe(1);
  });

  it('leaves weights unchanged (all-zero) when no cards are chosen — a full skip', () => {
    const start = zeroWeights();
    const result = seedWeightsFromCards(start, []);
    expect(result).toEqual(start);
  });

  it('clips accumulated theme weight at 10 rather than overflowing', () => {
    const card: TasteCard = { id: 'x', label: 'X', themes: ['love'], form: 'sonnet' };
    // Four cards worth of +3 would be 12; must clip to the documented [-10, 10] range.
    const result = seedWeightsFromCards(zeroWeights(), [card, card, card, card]);
    expect(result.theme.love).toBe(10);
  });

  it('never mutates the weights object passed in', () => {
    const start = zeroWeights();
    const card: TasteCard = { id: 'x', label: 'X', themes: ['love'], form: 'sonnet' };
    seedWeightsFromCards(start, [card]);
    expect(start).toEqual(zeroWeights());
  });

  it('preserves pre-existing weight entries untouched by the chosen cards', () => {
    const start: Weights = { theme: { grief: 4 }, form: { novel: 2 }, era: {}, author: {} };
    const card: TasteCard = { id: 'x', label: 'X', themes: ['love'], form: 'sonnet' };
    const result = seedWeightsFromCards(start, [card]);
    expect(result.theme.grief).toBe(4);
    expect(result.form.novel).toBe(2);
  });
});

describe('shouldShowOnboarding', () => {
  it('returns true for the documented default settings (onboardingDone: false)', () => {
    expect(shouldShowOnboarding(DEFAULT_SETTINGS)).toBe(true);
  });

  it('returns true when onboardingDone is missing entirely (pre-WP-3.5 stored settings)', () => {
    expect(shouldShowOnboarding({})).toBe(true);
  });

  it('returns false once onboardingDone is true', () => {
    expect(shouldShowOnboarding({ onboardingDone: true })).toBe(false);
  });

  it('returns true when onboardingDone is explicitly false', () => {
    expect(shouldShowOnboarding({ onboardingDone: false })).toBe(true);
  });
});
