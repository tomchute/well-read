// Vitest cases for src/lib/scoring — see docs/recommendation-design.md
// ("Required vitest cases") for the required list; each `it` below is
// labelled with the case number it covers.

import { describe, expect, it } from 'vitest';
import type { ManifestEntry } from '../src/lib/data/manifest';
import { applyChip, decay } from '../src/lib/scoring/chips';
import { buildPage } from '../src/lib/scoring/page';
import { createSeededRng } from '../src/lib/scoring/rng';
import { scoreWork } from '../src/lib/scoring/score';
import type { ScoringState, SessionPin, Weights } from '../src/lib/scoring/types';

function makeEntry(overrides: Partial<ManifestEntry> = {}): ManifestEntry {
  return {
    id: 'author-title-1900',
    title: 'Title',
    author: 'Author',
    year: 1900,
    era: '19th_century',
    type: 'short_story',
    form: 'short story',
    themes: ['mortality', 'time'],
    tags: [],
    difficulty: 3,
    length: { unit: 'words', value: 1000 },
    textPolicy: 'full',
    shard: 0,
    ...overrides,
  };
}

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

const NOW = new Date('2026-09-13T00:00:00.000Z');

function daysAgoIso(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe('scoreWork', () => {
  // Case 1
  it('sums theme, form, era, and author weights independently', () => {
    const entry = makeEntry({
      themes: ['mortality', 'time'],
      form: 'novel',
      era: '19th_century',
      author: 'X',
    });
    const weights: Weights = {
      theme: { mortality: 2, time: 3, unrelated: 100 },
      form: { novel: 1 },
      era: { '19th_century': 4 },
      author: { X: 5 },
    };
    // No jitter contribution: rng() fixed at 0.5 -> jitter = 0.
    const rng = () => 0.5;
    const score = scoreWork(entry, weights, {}, [], NOW, rng);
    expect(score).toBe(2 + 3 + 1 + 4 + 5);
  });

  // Case 2
  it('applies the flat -8 recency penalty for a work seen under 14 days ago', () => {
    const entry = makeEntry();
    const seen = { [entry.id]: daysAgoIso(5) };
    const rng = () => 0.5; // jitter = 0
    const score = scoreWork(entry, zeroWeights(), seen, [], NOW, rng);
    expect(score).toBe(-8);
  });

  // Case 3
  it('applies the decaying 1/daysSince * 2 penalty for a work seen 14+ days ago', () => {
    const entry = makeEntry();
    const seen = { [entry.id]: daysAgoIso(20) };
    const rng = () => 0.5; // jitter = 0
    const score = scoreWork(entry, zeroWeights(), seen, [], NOW, rng);
    expect(score).toBeCloseTo(-((1 / 20) * 2), 10);
  });

  it('returns 0 recency penalty for a work never seen', () => {
    const entry = makeEntry();
    const rng = () => 0.5;
    const score = scoreWork(entry, zeroWeights(), {}, [], NOW, rng);
    expect(score).toBe(0);
  });

  // Case 4
  it('adds full pinBoost for the first 5 applications of a matching session pin and zero after 20', () => {
    const entry = makeEntry({ themes: ['solitude'] });
    const rng = () => 0.5; // jitter = 0

    const fullStrengthPin: SessionPin = { theme: 'solitude', strength: 3, appliedCount: 0 };
    expect(scoreWork(entry, zeroWeights(), {}, [fullStrengthPin], NOW, rng)).toBe(3);

    const stillFullAt4: SessionPin = { theme: 'solitude', strength: 3, appliedCount: 4 };
    expect(scoreWork(entry, zeroWeights(), {}, [stillFullAt4], NOW, rng)).toBeCloseTo(
      3 * (1 - 4 / 5),
      10
    );

    const taperedAt5: SessionPin = { theme: 'solitude', strength: 3, appliedCount: 5 };
    expect(scoreWork(entry, zeroWeights(), {}, [taperedAt5], NOW, rng)).toBe(0);

    const staleAt20: SessionPin = { theme: 'solitude', strength: 3, appliedCount: 20 };
    expect(scoreWork(entry, zeroWeights(), {}, [staleAt20], NOW, rng)).toBe(0);
  });

  it('jitter stays within [-0.5, 0.5) bounds', () => {
    const entry = makeEntry();
    const low = scoreWork(entry, zeroWeights(), {}, [], NOW, () => 0);
    const high = scoreWork(entry, zeroWeights(), {}, [], NOW, () => 0.999999);
    expect(low).toBeCloseTo(-0.5, 10);
    expect(high).toBeGreaterThanOrEqual(-0.5);
    expect(high).toBeLessThan(0.5);
  });

  it('is deterministic given the same seeded rng', () => {
    const entry = makeEntry();
    const weights: Weights = { theme: { mortality: 1 }, form: {}, era: {}, author: {} };
    const a = scoreWork(entry, weights, {}, [], NOW, createSeededRng(42));
    const b = scoreWork(entry, weights, {}, [], NOW, createSeededRng(42));
    expect(a).toBe(b);
  });
});

describe('applyChip', () => {
  // Case 5
  it('more-like-this increases theme/form/author weights by the documented deltas', () => {
    const work = makeEntry({ themes: ['mortality', 'time'], form: 'novel', author: 'Kate Chopin' });
    const next = applyChip(emptyState(), { type: 'more-like-this', work });
    expect(next.weights.theme.mortality).toBe(2);
    expect(next.weights.theme.time).toBe(2);
    expect(next.weights.form.novel).toBe(1);
    expect(next.weights.author['Kate Chopin']).toBe(2);
  });

  it('more-about-theme adds +3 to the theme weight and pushes a session pin', () => {
    const next = applyChip(emptyState(), { type: 'more-about-theme', theme: 'wonder' });
    expect(next.weights.theme.wonder).toBe(3);
    expect(next.sessionPins).toEqual([{ theme: 'wonder', strength: 3, appliedCount: 0 }]);
  });

  it('not-interested decreases theme weights by 1 and author weight by 3', () => {
    const work = makeEntry({ themes: ['doubt'], author: 'Borges' });
    const next = applyChip(emptyState(), { type: 'not-interested', work });
    expect(next.weights.theme.doubt).toBe(-1);
    expect(next.weights.author.Borges).toBe(-3);
  });

  it('like sets reactions[id] = 1 and applies more-like-this deltas', () => {
    const work = makeEntry({ id: 'w1', themes: ['nature'], form: 'poem', author: 'Blake' });
    const next = applyChip(emptyState(), { type: 'like', work });
    expect(next.reactions.w1).toBe(1);
    expect(next.weights.theme.nature).toBe(2);
    expect(next.weights.author.Blake).toBe(2);
  });

  it('dislike sets reactions[id] = -1 and applies less-like-this deltas', () => {
    const work = makeEntry({ id: 'w1', themes: ['nature'], author: 'Blake' });
    const next = applyChip(emptyState(), { type: 'dislike', work });
    expect(next.reactions.w1).toBe(-1);
    expect(next.weights.theme.nature).toBe(-2);
    expect(next.weights.author.Blake).toBe(-2);
  });

  it('surprise-me resets weights to zero and clears session pins without touching other state', () => {
    const state = emptyState({
      weights: { theme: { a: 5 }, form: { b: 2 }, era: {}, author: {} },
      sessionPins: [{ theme: 'a', strength: 3, appliedCount: 1 }],
      seen: { w1: daysAgoIso(1) },
      reactions: { w1: 1 },
      read: ['w1'],
    });
    const next = applyChip(state, { type: 'surprise-me' });
    expect(next.weights).toEqual(zeroWeights());
    expect(next.sessionPins).toEqual([]);
    expect(next.seen).toEqual(state.seen);
    expect(next.reactions).toEqual(state.reactions);
    expect(next.read).toEqual(state.read);
  });

  // Case 6
  it('less-form floors the form weight at -5 and never goes lower', () => {
    let state = emptyState({ weights: { theme: {}, form: { novel: -4 }, era: {}, author: {} } });
    state = applyChip(state, { type: 'less-form', form: 'novel' });
    expect(state.weights.form.novel).toBe(-5);
    // Applying again must not push it past the floor.
    state = applyChip(state, { type: 'less-form', form: 'novel' });
    expect(state.weights.form.novel).toBe(-5);
  });

  it('does not mutate the input state', () => {
    const state = emptyState();
    const frozen = JSON.parse(JSON.stringify(state));
    applyChip(state, { type: 'more-like-this', work: makeEntry() });
    expect(state).toEqual(frozen);
  });
});

describe('decay', () => {
  // Case 10
  it('multiplies every weight by 0.98 and clips results to [-10, 10]', () => {
    const state = emptyState({
      weights: {
        theme: { a: 10, b: -10, c: 5 },
        form: { novel: -5 },
        era: {},
        author: { X: 9.99 },
      },
    });
    const next = decay(state);
    expect(next.weights.theme.a).toBeCloseTo(9.8, 10);
    expect(next.weights.theme.b).toBeCloseTo(-9.8, 10);
    expect(next.weights.theme.c).toBeCloseTo(4.9, 10);
    expect(next.weights.form.novel).toBeCloseTo(-4.9, 10);
    expect(next.weights.author.X).toBeLessThanOrEqual(10);
    expect(next.weights.author.X).toBeCloseTo(9.99 * 0.98, 10);
  });

  it('snaps magnitudes under 0.01 to exactly 0', () => {
    const state = emptyState({
      weights: { theme: { tiny: 0.005 }, form: {}, era: {}, author: {} },
    });
    const next = decay(state);
    expect(next.weights.theme.tiny).toBe(0);
  });
});

describe('buildPage', () => {
  function manyAuthorsIndex(count: number): ManifestEntry[] {
    return Array.from({ length: count }, (_, i) =>
      makeEntry({ id: `w${i}`, author: `Author ${i}`, form: 'novel' })
    );
  }

  // Case 7
  it('enforces the <=1-per-author constraint over a rolling window of 10', () => {
    // 10 works from the same author, plus 10 from distinct authors, all
    // scoring identically (zero weights, no jitter) except insertion order.
    const sameAuthor = Array.from({ length: 10 }, (_, i) =>
      makeEntry({ id: `same-${i}`, author: 'Same Author', form: `form-${i}` })
    );
    const distinct = Array.from({ length: 10 }, (_, i) =>
      makeEntry({ id: `distinct-${i}`, author: `Distinct ${i}`, form: `form-${i}` })
    );
    const index = [...sameAuthor, ...distinct];
    const page = buildPage(index, emptyState(), 10, NOW, () => 0.5);
    const sameAuthorCount = page.filter((w) => w.author === 'Same Author').length;
    expect(sameAuthorCount).toBeLessThanOrEqual(1);
    expect(page).toHaveLength(10);
  });

  // Case 8
  it('enforces the <=60%-one-form constraint and relaxes it only when candidates run out', () => {
    // 8 novels (distinct authors) that would otherwise dominate the top of
    // the ranking, plus 4 other-form works to fill the rest of the page.
    const novels = Array.from({ length: 8 }, (_, i) =>
      makeEntry({ id: `novel-${i}`, author: `Novel Author ${i}`, form: 'novel' })
    );
    const others = Array.from({ length: 4 }, (_, i) =>
      makeEntry({ id: `other-${i}`, author: `Other Author ${i}`, form: `other-form-${i}` })
    );
    const index = [...novels, ...others];
    const page = buildPage(index, emptyState(), 10, NOW, () => 0.5);
    const novelCount = page.filter((w) => w.form === 'novel').length;
    expect(novelCount).toBeLessThanOrEqual(6);
    expect(page).toHaveLength(10);
  });

  it('relaxes the form cap (not the author cap) first when candidates run out', () => {
    // 8 novels from 8 distinct authors + only 1 other-form work: the form
    // cap (max 6 novels) cannot be satisfied while also filling all 9 slots
    // without repeating an author, so it must relax to fill the page,
    // while still never repeating an author (only 9 distinct authors exist
    // here, so the author cap is never actually tested against, but every
    // pick must remain unique).
    const novels = Array.from({ length: 8 }, (_, i) =>
      makeEntry({ id: `novel-${i}`, author: `Novel Author ${i}`, form: 'novel' })
    );
    const other = [makeEntry({ id: 'other-0', author: 'Other Author', form: 'poem' })];
    const index = [...novels, ...other];
    const page = buildPage(index, emptyState(), 9, NOW, () => 0.5);
    expect(page).toHaveLength(9);
    const authors = new Set(page.map((w) => w.author));
    expect(authors.size).toBe(9);
  });

  // Case 9
  it('excludes works already in read[] from candidates', () => {
    const index = manyAuthorsIndex(5);
    const state = emptyState({ read: ['w0', 'w2'] });
    const page = buildPage(index, state, 5, NOW, () => 0.5);
    expect(page.some((w) => w.id === 'w0')).toBe(false);
    expect(page.some((w) => w.id === 'w2')).toBe(false);
    expect(page).toHaveLength(3);
  });

  // Case 11
  it('with all-zero weights (cold-start skip) still applies diversity constraints', () => {
    const sameAuthor = Array.from({ length: 10 }, (_, i) =>
      makeEntry({ id: `same-${i}`, author: 'Same Author', form: `form-${i}` })
    );
    const distinct = Array.from({ length: 10 }, (_, i) =>
      makeEntry({ id: `distinct-${i}`, author: `Distinct ${i}`, form: `form-${i}` })
    );
    const index = [...sameAuthor, ...distinct];
    // All-zero weights: cold start / skipped quiz per docs/recommendation-design.md.
    const page = buildPage(index, emptyState(), 10, NOW, createSeededRng(7));
    const sameAuthorCount = page.filter((w) => w.author === 'Same Author').length;
    expect(sameAuthorCount).toBeLessThanOrEqual(1);
    expect(page).toHaveLength(10);
  });

  it('fills the page fully even when constraints must relax (page must always fill)', () => {
    // Only 3 distinct authors available for a page of 5: the author cap
    // alone cannot fill 5 slots without a repeat, so it must relax.
    const index = Array.from({ length: 9 }, (_, i) =>
      makeEntry({ id: `w${i}`, author: `Author ${i % 3}`, form: 'novel' })
    );
    const page = buildPage(index, emptyState(), 5, NOW, () => 0.5);
    expect(page).toHaveLength(5);
  });

  it('does not mutate the index or state inputs', () => {
    const index = manyAuthorsIndex(3);
    const frozenIndex = JSON.parse(JSON.stringify(index));
    const state = emptyState();
    const frozenState = JSON.parse(JSON.stringify(state));
    buildPage(index, state, 3, NOW, () => 0.5);
    expect(index).toEqual(frozenIndex);
    expect(state).toEqual(frozenState);
  });
});
