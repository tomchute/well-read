# Recommendation design

All personalization is client-side, pure-function, and testable. No server, no ML — a weighted scorer over the manifest plus a greedy diversity-aware page builder. Source of truth for the `Work`/manifest fields is `docs/content-schema.md`; this doc only covers steering state and scoring.

## localStorage state shape

Versioned keys, prefix `wellread:v1:*` (bump the version segment on breaking shape changes; old keys are ignored, not migrated):

| Key | Shape | Notes |
|---|---|---|
| `wellread:v1:weights` | `{ theme: Record<string, number>, form: Record<string, number>, era: Record<string, number>, author: Record<string, number> }` | Each value clipped to **[-10, 10]**. Missing entries default to `0`. **`form` is keyed by the coarse `Work.type`** (`poem \| short_story \| book \| essay \| play`), **not** the free-text `Work.form` sub-genre field (e.g. `"sonnet"`, `"epistolary novel"`) — that field is display-only (badges, filters) and never feeds scoring. The persisted key stays named `form` to avoid a migration; read it as "form-category weights," keyed by type. |
| `wellread:v1:seen` | `Record<workId, string /* ISO date first-seen */>` | Written the first time a card is rendered in the feed (not on hover/prefetch). |
| `wellread:v1:reactions` | `Record<workId, 1 | -1>` | Explicit like/dislike; absent = neutral. |
| `wellread:v1:saved` | `workId[]` | Ordered, most-recent-first. |
| `wellread:v1:read` | `workId[]` | Marked read (manually or on scroll-past for short forms). |
| `wellread:v1:sessionPins` | `Array<{ theme: string, strength: number, appliedCount: number }>` | Transient bias from "more about X"; not required to persist across reloads but stored so a refresh mid-session doesn't lose it. |

All five are read/written only through `src/lib/scoring/` and `src/lib/stores/` (WP-3.1) — components never touch `localStorage` directly.

## Chip actions

Every chip action mutates `weights` (and `sessionPins` for the "more about" chip) by fixed deltas, then re-runs `buildPage`:

| Chip | Effect |
|---|---|
| "More like this" (on a work) | `theme[t] += 2` for each of the work's themes; `form[work.type] += 1`; `author[work.author] += 2` |
| "More about X" (theme chip, off → on) | `theme[X] += 3`; push `{ theme: X, strength: 3, appliedCount: 0 }` onto `sessionPins` |
| "More about X" (theme chip, on → off) | clears the theme: delete `theme[X]`, drop every `sessionPins` entry for X |
| "More <form>" | `form[type] += 2`, clipped to the standard **[-10, 10]** range (mirrors "Less <form>"; no special ceiling — a boost, not a guarantee) |
| "Less <form>" | `form[type] -= 2`, floored at **-5** (never fully excluded — a floor, not a ban) |
| "Not interested" (on a work) | `theme[t] -= 1` for each theme, `author[work.author] -= 3` |
| Explicit like (♥) | sets `reactions[id] = 1`; also applies "more like this" deltas |
| Explicit dislike | sets `reactions[id] = -1`; also applies "less-like-this": `theme[t] -= 2`, `author[work.author] -= 2` |

The theme chip is a toggle, not a one-way nudge: it renders `aria-pressed` from `theme[X] > 0`, and a tap on an active chip sends `clear-theme` rather than steering toward X again. Without that, repeat taps stacked `theme[X]` +3 at a time and pushed a duplicate session pin each time, and a mis-tap could only be undone by "Surprise me" wiping every steer. Clearing one theme never touches another steer.

"More <form>" and "Less <form>" both key `form` by the coarse `Work.type` (`poem \| short_story \| book \| essay \| play`), never the free-text `Work.form` field — see the `weights` row above and `ChipAction` in `src/lib/scoring/types.ts`. The steering bar offers both directions per category (a paired/segmented control), active state read from the weight's sign: positive → "More" active, negative → "Less" active.

Session pins decay linearly to zero influence over the next **~20** cards shown (tracked via `appliedCount`, incremented each time `scoreWork` applies the pin; the pin is dropped once `appliedCount >= 20`), and bias only the next ~5 cards at full strength before tapering — see `pinBoost` in the score formula.

## Score formula

```
score(work) =
    Σ weights.theme[t] for t in work.themes
  + weights.form[work.type]     // keyed by coarse type, not the free-text form field
  + weights.era[work.era]
  + weights.author[work.author]
  + pinBoost(work, sessionPins)
  - recencyPenalty(work, seen, now)
  + jitter()

pinBoost(work, pins) =
    Σ pin.strength * max(0, 1 - pin.appliedCount / 5)   // full strength for ~5 cards, 0 after
        for each pin in pins where pin.theme in work.themes
```

### Recency penalty

```
recencyPenalty(work, seen, now):
  if work.id not in seen: return 0
  daysSince = (now - seen[work.id]) in days
  if daysSince < 14: return 8
  return (1 / daysSince) * 2
```

A work seen in the last two weeks is pushed down hard (flat −8); older exposures fade to a near-zero drag so the catalog can resurface once it's no longer fresh.

### Jitter

`jitter()` returns a uniform random value in **[-0.5, 0.5]**, added after all other terms, so near-tied works don't render in a perfectly stable order every load. Tests pass an injectable RNG (or seed) rather than relying on `Math.random`.

## Greedy page builder

`buildPage` sorts all candidates by `score` descending, then walks the sorted list filling a page of `pageSize` (default 10) under two constraints evaluated over the **trailing 10 picks already on the page being built** (a rolling window, not the whole page at once):

1. **≤ 1 work per author** in any rolling window of 10.
2. **≤ 60% of one form** in any rolling window of 10 (i.e. at most 6 of 10 sharing a form) — "form" here means the coarse `Work.type`, the same key `weights.form` uses, not the free-text `Work.form` field.

Algorithm: take the next-highest-scoring candidate; if adding it would violate either constraint, skip it and try the next; if the walk exhausts all candidates without filling the page, **relax the constraints one at a time (form cap first, then author cap)** and re-walk the skipped candidates by score — the page must always fill if enough candidates exist. Already-read works (`read[]`) are excluded from candidates entirely, not merely down-scored.

## Normalisation

- **Clip**: every weight value clipped to `[-10, 10]` after each mutation.
- **Decay**: at the start of every session (app boot), multiply every stored weight by **0.98** (2% decay), so stale preferences fade gradually even without new signal. Values under `0.01` in magnitude snap to `0`.

## Cold start

A skippable **6–7 card** taste quiz (WP-3.5) shown once (tracked by a `wellread:v1:onboarded` flag, not covered by the scoring API itself): each card is a work with a like/dislike/skip choice, applying the same chip deltas as the feed. Skipping the quiz entirely leaves all weights at `0` — the feed falls back to unweighted `score = jitter() - recencyPenalty(...)`, and the diversity constraints in `buildPage` still apply so an all-zero feed isn't monotone.

## "Surprise me" reset

A single action that resets `weights` to all-zero (theme/form/era/author) and clears `sessionPins`, without touching `seen`, `reactions`, `saved`, or `read`. Implemented as `resetWeights(state)` in the stores layer (not part of the pure scoring API below, since it's a state-replacement, not a score computation) — WP-3.3 wires a button to it.

## Pure-function API — `src/lib/scoring/`

```ts
// index.ts (files may be split; these four names are the public surface)
function scoreWork(indexEntry: ManifestEntry, weights: Weights, seen: SeenMap, pins: SessionPin[], now: Date): number;
function buildPage(index: ManifestEntry[], state: ScoringState, pageSize: number = 10, now: Date): ManifestEntry[];
function applyChip(state: ScoringState, chip: ChipAction): ScoringState;
function decay(state: ScoringState): ScoringState;
```

All four are pure: no `localStorage`, no `Date.now()` internally (caller passes `now`), no mutation of inputs — return new objects. `ScoringState` bundles `{ weights, seen, reactions, sessionPins, read }`. The stores layer (WP-3.1) owns persistence and calls these functions with the current snapshot.

## Required vitest cases (`tests/scoring.spec.ts`, at least these 8)

1. `scoreWork sums theme, form, era, and author weights independently`
2. `scoreWork applies the flat -8 recency penalty for a work seen under 14 days ago`
3. `scoreWork applies the decaying 1/daysSince * 2 penalty for a work seen 14+ days ago`
4. `scoreWork adds full pinBoost for the first 5 applications of a matching session pin and zero after 20`
5. `applyChip more-like-this increases theme/form/author weights by the documented deltas` (`form` keyed by `work.type`)
6. `applyChip less-form floors the form weight at -5 and never goes lower`
7. `buildPage enforces the ≤1-per-author constraint over a rolling window of 10`
8. `buildPage enforces the ≤60%-one-form constraint (keyed by work.type) and relaxes it only when candidates run out`
9. `buildPage excludes works already in read[] from candidates`
10. `decay multiplies every weight by 0.98 and clips results to [-10, 10]`
11. `buildPage with all-zero weights (cold-start skip) still applies diversity constraints`
12. `applyChip more-form adds +2 to the type-keyed form weight, clipped to [-10, 10]`
13. `scoreWork keys weights.form by work.type, not the free-text work.form field` (a work whose free-text `form` collides with another type's key must not leak weight)

(13 listed to comfortably exceed the "at least 8" floor; an implementer may merge closely related cases but must not drop coverage of recency, pins, chip deltas, both diversity constraints, decay, the read-exclusion, the more-form action, and the type- vs free-text-form keying.)
