// `buildPage` — the greedy, diversity-aware page builder from
// docs/recommendation-design.md ("Greedy page builder"). Pure: sorts
// candidates by score, walks them applying the author/form caps over a
// rolling window of the trailing 10 picks, and relaxes the constraints
// (form cap first, then author cap) only when candidates run out before the
// page fills.

import { defaultRng, type Rng } from './rng';
import { scoreWork } from './score';
import type { ManifestEntry, ScoringState } from './types';

/** Rolling window size the diversity constraints are evaluated over. */
const WINDOW_SIZE = 10;
/** "At most 6 of 10 sharing a form" — 60% of the window. */
const FORM_CAP_RATIO = 0.6;

interface ScoredCandidate {
  entry: ManifestEntry;
  score: number;
}

interface WalkConstraints {
  authorCap: boolean;
  formCap: boolean;
}

/** The trailing up-to-`WINDOW_SIZE - 1` picks a new candidate would join. */
function trailingWindow(picks: ManifestEntry[]): ManifestEntry[] {
  const start = Math.max(0, picks.length - (WINDOW_SIZE - 1));
  return picks.slice(start);
}

function violatesAuthorCap(picks: ManifestEntry[], candidate: ManifestEntry): boolean {
  return trailingWindow(picks).some((pick) => pick.author === candidate.author);
}

function violatesFormCap(picks: ManifestEntry[], candidate: ManifestEntry): boolean {
  const window = [...trailingWindow(picks), candidate];
  const sameForm = window.filter((pick) => pick.form === candidate.form).length;
  const limit = Math.max(1, Math.floor(window.length * FORM_CAP_RATIO));
  return sameForm > limit;
}

/**
 * Walks `candidates` (already sorted by score descending) appending to
 * `picks` (mutated in place — a local accumulator private to `buildPage`,
 * never an input the caller owns) up to `pageSize`, under `constraints`.
 * Returns the candidates skipped because they'd violate an enforced
 * constraint, in their original (score-descending) order, for a possible
 * relaxed re-walk.
 */
function walk(
  candidates: ScoredCandidate[],
  picks: ManifestEntry[],
  pageSize: number,
  constraints: WalkConstraints
): ScoredCandidate[] {
  const skipped: ScoredCandidate[] = [];
  for (const candidate of candidates) {
    if (picks.length >= pageSize) {
      skipped.push(candidate);
      continue;
    }
    const authorViolation = constraints.authorCap && violatesAuthorCap(picks, candidate.entry);
    const formViolation = constraints.formCap && violatesFormCap(picks, candidate.entry);
    if (authorViolation || formViolation) {
      skipped.push(candidate);
    } else {
      picks.push(candidate.entry);
    }
  }
  return skipped;
}

/**
 * Builds one page of `pageSize` works: excludes already-`read` works
 * entirely, scores and sorts the rest, then greedily fills the page under
 * the author/form diversity caps — relaxing the form cap, then the author
 * cap, only if candidates run out before the page fills.
 */
export function buildPage(
  index: ManifestEntry[],
  state: ScoringState,
  pageSize: number = 10,
  now: Date,
  rng: Rng = defaultRng
): ManifestEntry[] {
  const readSet = new Set(state.read);
  const scored: ScoredCandidate[] = index
    .filter((entry) => !readSet.has(entry.id))
    .map((entry) => ({
      entry,
      score: scoreWork(entry, state.weights, state.seen, state.sessionPins, now, rng),
    }))
    .sort((a, b) => b.score - a.score);

  const picks: ManifestEntry[] = [];

  let remaining = walk(scored, picks, pageSize, { authorCap: true, formCap: true });
  if (picks.length < pageSize && remaining.length > 0) {
    remaining = walk(remaining, picks, pageSize, { authorCap: true, formCap: false });
  }
  if (picks.length < pageSize && remaining.length > 0) {
    walk(remaining, picks, pageSize, { authorCap: false, formCap: false });
  }

  return picks;
}
