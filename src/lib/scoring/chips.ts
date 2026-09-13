// `applyChip` and `decay` — see docs/recommendation-design.md
// ("Chip actions", "Normalisation", "Surprise me reset"). Pure: returns a
// new `ScoringState`, never mutates `state` or its nested records.

import type { ChipAction, ManifestEntry, ScoringState, Weights } from './types';
import { clip, withAuthorDelta, withFormDelta, withThemeDelta } from './weights';

const LESS_FORM_FLOOR = -5;
const MORE_FORM_DELTA = 2;
const DECAY_FACTOR = 0.98;
const DECAY_SNAP_THRESHOLD = 0.01;

/**
 * "More like this": `theme[t] += 2` for each theme, `form[type] += 1`,
 * `author += 2`. `weights.form` is keyed by the coarse `work.type`, not the
 * free-text `work.form` sub-genre field — see
 * docs/recommendation-design.md ("Score formula", "Chip actions").
 */
function applyMoreLikeThis(weights: Weights, work: ManifestEntry): Weights {
  let next = weights;
  for (const theme of work.themes) {
    next = withThemeDelta(next, theme, 2);
  }
  next = withFormDelta(next, work.type, 1);
  next = withAuthorDelta(next, work.author, 2);
  return next;
}

/** "Not interested": `theme[t] -= 1` for each theme, `author -= 3`. */
function applyNotInterested(weights: Weights, work: ManifestEntry): Weights {
  let next = weights;
  for (const theme of work.themes) {
    next = withThemeDelta(next, theme, -1);
  }
  next = withAuthorDelta(next, work.author, -3);
  return next;
}

/** Explicit dislike's "less-like-this" deltas: `theme[t] -= 2`, `author -= 2`. */
function applyLessLikeThis(weights: Weights, work: ManifestEntry): Weights {
  let next = weights;
  for (const theme of work.themes) {
    next = withThemeDelta(next, theme, -2);
  }
  next = withAuthorDelta(next, work.author, -2);
  return next;
}

const ZERO_WEIGHTS: Weights = { theme: {}, form: {}, era: {}, author: {} };

/**
 * Applies one chip action's documented weight/pin/reaction deltas to
 * `state`, returning a new `ScoringState`. Never mutates `state`.
 */
export function applyChip(state: ScoringState, chip: ChipAction): ScoringState {
  switch (chip.type) {
    case 'more-like-this':
      return { ...state, weights: applyMoreLikeThis(state.weights, chip.work) };

    case 'more-about-theme':
      return {
        ...state,
        weights: withThemeDelta(state.weights, chip.theme, 3),
        sessionPins: [...state.sessionPins, { theme: chip.theme, strength: 3, appliedCount: 0 }],
      };

    case 'more-form':
      return {
        ...state,
        weights: withFormDelta(state.weights, chip.form, MORE_FORM_DELTA),
      };

    case 'less-form':
      return {
        ...state,
        weights: withFormDelta(state.weights, chip.form, -2, LESS_FORM_FLOOR),
      };

    case 'not-interested':
      return { ...state, weights: applyNotInterested(state.weights, chip.work) };

    case 'like':
      return {
        ...state,
        weights: applyMoreLikeThis(state.weights, chip.work),
        reactions: { ...state.reactions, [chip.work.id]: 1 },
      };

    case 'dislike':
      return {
        ...state,
        weights: applyLessLikeThis(state.weights, chip.work),
        reactions: { ...state.reactions, [chip.work.id]: -1 },
      };

    case 'surprise-me':
      return { ...state, weights: ZERO_WEIGHTS, sessionPins: [] };
  }
}

/** Decays one weight record: multiply by 0.98, snap near-zero to 0, clip to [-10, 10]. */
function decayRecord(record: Record<string, number>): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [key, value] of Object.entries(record)) {
    const decayed = value * DECAY_FACTOR;
    next[key] = Math.abs(decayed) < DECAY_SNAP_THRESHOLD ? 0 : clip(decayed);
  }
  return next;
}

/**
 * Session-start decay from docs/recommendation-design.md ("Normalisation"):
 * multiplies every stored weight by 0.98, clipping to [-10, 10] and snapping
 * magnitudes under 0.01 to exactly 0.
 */
export function decay(state: ScoringState): ScoringState {
  return {
    ...state,
    weights: {
      theme: decayRecord(state.weights.theme),
      form: decayRecord(state.weights.form),
      era: decayRecord(state.weights.era),
      author: decayRecord(state.weights.author),
    },
  };
}
