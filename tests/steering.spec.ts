// Vitest cases for src/lib/components/steering.ts — see
// docs/work-packages/WP-3.3-steering-bar.md. Covers chip list construction,
// active-state derivation, label formatting, and that the `ChipAction`s our
// helpers build actually flow through `applyChip` (the pure scoring API
// SteeringBar.svelte reports via `onchip`).

import { describe, expect, it } from 'vitest';
import {
  buildFormChips,
  buildThemeChips,
  CURATED_THEMES,
  clearThemeChip,
  countActiveSteers,
  FORM_CATEGORIES,
  formatThemeLabel,
  isFormActive,
  isFormMoreActive,
  isThemeActive,
  lessFormChip,
  moreAboutThemeChip,
  moreFormChip,
  surpriseMeChip,
  themeChipAction,
} from '../src/lib/components/steering';
import { applyChip } from '../src/lib/scoring/chips';
import type { ScoringState, Weights } from '../src/lib/scoring/types';
import { THEME_VOCABULARY } from '../src/lib/types/work';

function zeroWeights(): Weights {
  return { theme: {}, form: {}, era: {}, author: {} };
}

function emptyState(overrides: Partial<ScoringState> = {}): ScoringState {
  return {
    weights: zeroWeights(),
    seen: {},
    reactions: {},
    sessionPins: [],
    read: [],
    ...overrides,
  };
}

describe('formatThemeLabel', () => {
  it('title-cases a single-word theme', () => {
    expect(formatThemeLabel('love')).toBe('Love');
  });

  it('title-cases every hyphen-joined word, e.g. "the-city" -> "The City"', () => {
    expect(formatThemeLabel('the-city')).toBe('The City');
    expect(formatThemeLabel('art-making')).toBe('Art Making');
  });
});

describe('CURATED_THEMES / FORM_CATEGORIES', () => {
  it('every curated theme is a member of the controlled vocabulary', () => {
    for (const theme of CURATED_THEMES) {
      expect(THEME_VOCABULARY).toContain(theme);
    }
  });

  it('is a curated subset — around 10 terms, fewer than the full 32-term vocabulary', () => {
    expect(CURATED_THEMES.length).toBeGreaterThanOrEqual(8);
    expect(CURATED_THEMES.length).toBeLessThan(THEME_VOCABULARY.length);
  });

  it('has exactly the five documented work categories: poems, stories, books, essays, plays', () => {
    expect(FORM_CATEGORIES.map((f) => f.key)).toEqual([
      'poem',
      'short_story',
      'book',
      'essay',
      'play',
    ]);
    expect(FORM_CATEGORIES.map((f) => f.label)).toEqual([
      'poems',
      'stories',
      'books',
      'essays',
      'plays',
    ]);
  });
});

describe('isThemeActive / isFormActive', () => {
  it('a theme is inactive at the default zero weight', () => {
    expect(isThemeActive(zeroWeights(), 'love')).toBe(false);
  });

  it('a theme is active once its weight is positive', () => {
    expect(isThemeActive({ ...zeroWeights(), theme: { love: 3 } }, 'love')).toBe(true);
  });

  it('a theme pushed negative (e.g. by "not interested") does not read as active', () => {
    expect(isThemeActive({ ...zeroWeights(), theme: { love: -1 } }, 'love')).toBe(false);
  });

  it('a form is inactive at the default zero weight', () => {
    expect(isFormActive(zeroWeights(), 'poem')).toBe(false);
    expect(isFormMoreActive(zeroWeights(), 'poem')).toBe(false);
  });

  it('a form is active once "less <form>" has pushed its weight negative', () => {
    expect(isFormActive({ ...zeroWeights(), form: { poem: -2 } }, 'poem')).toBe(true);
    expect(isFormMoreActive({ ...zeroWeights(), form: { poem: -2 } }, 'poem')).toBe(false);
  });

  it('a form reads "more"-active once "more <form>" has pushed its weight positive', () => {
    expect(isFormMoreActive({ ...zeroWeights(), form: { poem: 2 } }, 'poem')).toBe(true);
    expect(isFormActive({ ...zeroWeights(), form: { poem: 2 } }, 'poem')).toBe(false);
  });
});

describe('buildThemeChips', () => {
  it('returns exactly the curated themes when collapsed, all inactive at zero weight', () => {
    const chips = buildThemeChips(zeroWeights(), false);
    expect(chips.map((c) => c.theme)).toEqual([...CURATED_THEMES]);
    expect(chips.every((c) => c.active === false)).toBe(true);
  });

  it('marks a chip active once its theme has positive weight', () => {
    const chips = buildThemeChips({ ...zeroWeights(), theme: { nature: 3 } }, false);
    const nature = chips.find((c) => c.theme === 'nature');
    expect(nature?.active).toBe(true);
    expect(chips.filter((c) => c.active).length).toBe(1);
  });

  it('expanded includes the full controlled vocabulary, curated chips first and no duplicates', () => {
    const chips = buildThemeChips(zeroWeights(), true);
    expect(chips.length).toBe(THEME_VOCABULARY.length);
    expect(chips.slice(0, CURATED_THEMES.length).map((c) => c.theme)).toEqual([...CURATED_THEMES]);
    expect(new Set(chips.map((c) => c.theme)).size).toBe(THEME_VOCABULARY.length);
  });

  it('every chip label is a human-readable formatting of its theme', () => {
    const chips = buildThemeChips(zeroWeights(), true);
    for (const chip of chips) {
      expect(chip.label).toBe(formatThemeLabel(chip.theme));
    }
  });
});

describe('buildFormChips', () => {
  it('returns one chip per work category, both sides inactive at zero weight', () => {
    const chips = buildFormChips(zeroWeights());
    expect(chips.map((c) => c.form)).toEqual(FORM_CATEGORIES.map((f) => f.key));
    expect(chips.every((c) => c.lessActive === false && c.moreActive === false)).toBe(true);
  });

  it('marks only the form whose weight has been pushed negative as less-active', () => {
    const chips = buildFormChips({ ...zeroWeights(), form: { short_story: -2 } });
    const shortStory = chips.find((c) => c.form === 'short_story');
    expect(shortStory?.lessActive).toBe(true);
    expect(shortStory?.moreActive).toBe(false);
    expect(chips.filter((c) => c.lessActive).length).toBe(1);
    expect(chips.filter((c) => c.moreActive).length).toBe(0);
  });

  it('marks only the form whose weight has been pushed positive as more-active', () => {
    const chips = buildFormChips({ ...zeroWeights(), form: { essay: 2 } });
    const essay = chips.find((c) => c.form === 'essay');
    expect(essay?.moreActive).toBe(true);
    expect(essay?.lessActive).toBe(false);
    expect(chips.filter((c) => c.moreActive).length).toBe(1);
    expect(chips.filter((c) => c.lessActive).length).toBe(0);
  });
});

describe('chip action builders flow through applyChip', () => {
  it('moreAboutThemeChip applies the documented +3 theme delta and pushes a session pin', () => {
    const state = applyChip(emptyState(), moreAboutThemeChip('wonder'));
    expect(state.weights.theme.wonder).toBe(3);
    expect(state.sessionPins).toEqual([{ theme: 'wonder', strength: 3, appliedCount: 0 }]);

    // The chip list built from the resulting weights now reads "active".
    const chips = buildThemeChips(state.weights, false);
    expect(chips.find((c) => c.theme === 'wonder')?.active).toBe(true);
  });

  it('clearThemeChip removes the theme weight and every session pin for it', () => {
    const steered = applyChip(emptyState(), moreAboutThemeChip('wonder'));
    const cleared = applyChip(steered, clearThemeChip('wonder'));

    expect(cleared.weights.theme.wonder).toBeUndefined();
    expect(cleared.sessionPins).toEqual([]);
    expect(buildThemeChips(cleared.weights, false).find((c) => c.theme === 'wonder')?.active).toBe(
      false
    );
  });

  it('clearThemeChip leaves every other steer alone', () => {
    const dirty = emptyState({
      weights: { theme: { wonder: 3, grief: 5 }, form: { poem: 2 }, era: {}, author: { Woolf: 2 } },
      sessionPins: [
        { theme: 'wonder', strength: 3, appliedCount: 0 },
        { theme: 'grief', strength: 3, appliedCount: 4 },
      ],
    });

    const cleared = applyChip(dirty, clearThemeChip('wonder'));

    expect(cleared.weights.theme).toEqual({ grief: 5 });
    expect(cleared.weights.form).toEqual({ poem: 2 });
    expect(cleared.weights.author).toEqual({ Woolf: 2 });
    expect(cleared.sessionPins).toEqual([{ theme: 'grief', strength: 3, appliedCount: 4 }]);
  });

  // The reported bug: the chip renders `aria-pressed`, so a tap on an active
  // chip has to turn the steer off. It used to send `more-about-theme` every
  // time, stacking +3 and a duplicate pin per tap with no way back.
  it('themeChipAction round-trips a theme on and back off', () => {
    let state = emptyState();
    const chipFor = (theme: string) =>
      buildThemeChips(state.weights, false).find((c) => c.theme === theme) ?? {
        theme,
        label: theme,
        active: false,
      };

    state = applyChip(state, themeChipAction(chipFor('love')));
    expect(state.weights.theme.love).toBe(3);
    expect(chipFor('love').active).toBe(true);

    state = applyChip(state, themeChipAction(chipFor('love')));
    expect(state.weights.theme.love).toBeUndefined();
    expect(state.sessionPins).toEqual([]);
    expect(chipFor('love').active).toBe(false);

    // and on again, without having accumulated anything
    state = applyChip(state, themeChipAction(chipFor('love')));
    expect(state.weights.theme.love).toBe(3);
    expect(state.sessionPins).toHaveLength(1);
  });

  it('repeat taps never stack weight or duplicate session pins', () => {
    let state = emptyState();
    const chipFor = () =>
      buildThemeChips(state.weights, false).find((c) => c.theme === 'war') ?? {
        theme: 'war',
        label: 'War',
        active: false,
      };

    for (let i = 0; i < 6; i++) {
      state = applyChip(state, themeChipAction(chipFor()));
    }

    // six taps = on/off three times over, ending off
    expect(state.weights.theme.war).toBeUndefined();
    expect(state.sessionPins).toEqual([]);
  });

  it('lessFormChip applies the documented -2 form delta, floored at -5', () => {
    let state = emptyState();
    state = applyChip(state, lessFormChip('poem'));
    state = applyChip(state, lessFormChip('poem'));
    state = applyChip(state, lessFormChip('poem'));
    state = applyChip(state, lessFormChip('poem'));
    expect(state.weights.form.poem).toBe(-5);

    const chips = buildFormChips(state.weights);
    const poem = chips.find((c) => c.form === 'poem');
    expect(poem?.lessActive).toBe(true);
    expect(poem?.moreActive).toBe(false);
  });

  it('moreFormChip applies the documented +2 form delta, mirroring lessFormChip', () => {
    let state = emptyState();
    state = applyChip(state, moreFormChip('play'));
    expect(state.weights.form.play).toBe(2);

    const chips = buildFormChips(state.weights);
    const play = chips.find((c) => c.form === 'play');
    expect(play?.moreActive).toBe(true);
    expect(play?.lessActive).toBe(false);

    // more-form and less-form are independent, symmetric deltas on the same key.
    state = applyChip(state, lessFormChip('play'));
    expect(state.weights.form.play).toBe(0);
  });

  it('surpriseMeChip resets weights and session pins without touching reactions/read', () => {
    const dirty = emptyState({
      weights: { theme: { love: 4 }, form: { poem: -3 }, era: {}, author: {} },
      sessionPins: [{ theme: 'love', strength: 3, appliedCount: 1 }],
      reactions: { 'author-title-1900': 1 },
      read: ['author-title-1900'],
    });

    const state = applyChip(dirty, surpriseMeChip());

    expect(state.weights).toEqual(zeroWeights());
    expect(state.sessionPins).toEqual([]);
    expect(state.reactions).toEqual({ 'author-title-1900': 1 });
    expect(state.read).toEqual(['author-title-1900']);

    const chips = buildThemeChips(state.weights, false);
    expect(chips.every((c) => c.active === false)).toBe(true);
  });
});

describe('countActiveSteers', () => {
  it('is 0 with zero weights and no pins', () => {
    expect(countActiveSteers(emptyState())).toBe(0);
  });

  it('counts themes with a positive weight and forms pushed away from zero', () => {
    const weights = zeroWeights();
    weights.theme.love = 3;
    weights.theme.grief = -2; // negative themes are not "steered towards"
    weights.form.poem = 2;
    weights.form.book = -2;
    weights.form.essay = 0;
    expect(countActiveSteers(emptyState({ weights }))).toBe(3);
  });

  it('counts a session-pinned theme once, even when its weight is also positive', () => {
    const state = applyChip(emptyState(), moreAboutThemeChip('love'));
    expect(state.sessionPins).toHaveLength(1);
    expect(countActiveSteers(state)).toBe(1);
  });

  it('drops back to 0 after "surprise me"', () => {
    let state = applyChip(emptyState(), moreAboutThemeChip('love'));
    state = applyChip(state, moreFormChip('poem'));
    expect(countActiveSteers(state)).toBe(2);
    expect(countActiveSteers(applyChip(state, surpriseMeChip()))).toBe(0);
  });
});
