<script lang="ts">
  // Chip controls for steering the feed by mood/theme and by form — see
  // docs/work-packages/WP-3.3-steering-bar.md, docs/recommendation-design.md
  // ("Chip actions", "Surprise me reset") and docs/design-system.md
  // ("SteeringChip"). Standalone: does not import stores, the router, or
  // App.svelte — the caller supplies the current `ScoringState` and receives
  // every chip's `ChipAction` via `onchip`.
  import type { ChipAction, ScoringState, Weights } from '$lib/scoring';
  import {
    buildFormChips,
    buildThemeChips,
    lessFormChip,
    moreFormChip,
    surpriseMeChip,
    type ThemeChip,
    themeChipAction,
  } from './steering';

  interface Props {
    /**
     * Current scoring state — read only, and the sole source of every chip's
     * active/inactive display. The caller owns it: apply the action you get
     * from `onchip` and pass the result back down.
     */
    state?: ScoringState;
    /** Called with every chip's `ChipAction`. */
    onchip?: (action: ChipAction) => void;
  }

  // Destructured to a differently-named local (`steeringState`, not `state`)
  // even though the public prop is still named `state` (callers still pass
  // `state={...}`) — WP-2.6 fix: a local binding literally named `state`
  // makes every `$state(...)` rune call below ambiguous with Svelte's legacy
  // `$store` auto-subscription syntax, which the compiler resolves in the
  // store's favour. That crashed this component on mount with
  // `store_invalid_shape` ("`state` is not a store with a `subscribe`
  // method") the instant the feed became ready — the reported blocking bug
  // (no SteeringBar, no cards past the "Feed" heading).
  let { state: steeringState, onchip }: Props = $props();

  const ZERO_WEIGHTS: Weights = { theme: {}, form: {}, era: {}, author: {} };

  let expanded = $state(false);

  const weights = $derived(steeringState?.weights ?? ZERO_WEIGHTS);
  // biome-ignore lint/correctness/noUnusedVariables: used in template
  const themeChips = $derived(buildThemeChips(weights, expanded));
  // biome-ignore lint/correctness/noUnusedVariables: used in template
  const formChips = $derived(buildFormChips(weights));

  // Report the action and nothing else. This used to also apply the action to
  // its own copy of `state`; with a caller that handles `onchip` and passes
  // `state` unbound (Feed.svelte — the only caller), every delta landed twice,
  // and the local copy shadowed the real one. The chips then rendered a state
  // the scorer never had: one "Less poems" after two "More poems" left the
  // stored weight at +2 while both chips displayed as off.
  function dispatch(action: ChipAction) {
    onchip?.(action);
  }

  // biome-ignore lint/correctness/noUnusedVariables: used in template
  function toggleExpanded() {
    expanded = !expanded;
  }

  // biome-ignore lint/correctness/noUnusedVariables: used in template
  function onThemeChipClick(chip: ThemeChip) {
    dispatch(themeChipAction(chip));
  }

  // biome-ignore lint/correctness/noUnusedVariables: used in template
  function onMoreFormClick(form: string) {
    dispatch(moreFormChip(form));
  }

  // biome-ignore lint/correctness/noUnusedVariables: used in template
  function onLessFormClick(form: string) {
    dispatch(lessFormChip(form));
  }

  // biome-ignore lint/correctness/noUnusedVariables: used in template
  function onSurpriseClick() {
    dispatch(surpriseMeChip());
  }
</script>

<div class="steering-bar">
  <section class="chip-section" aria-label="Steer by mood or theme">
    <div class="chip-row">
      {#each themeChips as chip (chip.theme)}
        <button
          type="button"
          class="chip theme-chip"
          class:active={chip.active}
          aria-pressed={chip.active}
          onclick={() => onThemeChipClick(chip)}
        >
          {chip.label}
        </button>
      {/each}
      <button
        type="button"
        class="chip expander-chip"
        aria-expanded={expanded}
        onclick={toggleExpanded}
      >
        {expanded ? 'Fewer themes…' : 'More themes…'}
      </button>
    </div>
  </section>

  <section class="chip-section" aria-label="Steer by form">
    <div class="chip-row">
      {#each formChips as chip (chip.form)}
        <div class="form-segment" role="group" aria-label={chip.label}>
          <button
            type="button"
            class="chip form-chip segment-start"
            class:active={chip.moreActive}
            aria-pressed={chip.moreActive}
            onclick={() => onMoreFormClick(chip.form)}
          >
            More {chip.label}
          </button>
          <button
            type="button"
            class="chip form-chip segment-end"
            class:active={chip.lessActive}
            aria-pressed={chip.lessActive}
            onclick={() => onLessFormClick(chip.form)}
          >
            Less {chip.label}
          </button>
        </div>
      {/each}
    </div>
  </section>

  <button type="button" class="chip surprise-chip" onclick={onSurpriseClick}>
    Surprise me
  </button>
</div>

<style>
  .steering-bar {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .chip-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    min-width: 44px;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-sm);
    border: 1px solid var(--hairline);
    background-color: var(--accent-poem-tint);
    color: var(--accent-poem-text);
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    font-weight: 500;
    line-height: 1;
    cursor: pointer;
    transition:
      transform var(--duration-fast) var(--ease-out-soft),
      border-color var(--duration-fast) var(--ease-out-soft),
      background-color var(--duration-fast) var(--ease-out-soft);
  }

  .chip:hover {
    border-color: var(--accent-poem-text);
  }

  .chip:active {
    transform: scale(0.97);
  }

  .chip.active {
    border-color: var(--accent-poem-text);
    font-weight: 700;
  }

  .chip:focus-visible {
    outline: 2px solid var(--accent-poem-text);
    outline-offset: 2px;
  }

  .form-segment {
    display: inline-flex;
  }

  .form-chip {
    background-color: var(--accent-story-tint);
    color: var(--accent-story-text);
  }

  .form-chip:hover,
  .form-chip.active {
    border-color: var(--accent-story-text);
  }

  .form-chip:focus-visible {
    outline-color: var(--accent-story-text);
  }

  /* Join the More/Less pair into one compact segmented control. */
  .form-segment .segment-start {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  .form-segment .segment-end {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    border-left: none;
  }

  .expander-chip {
    background-color: transparent;
    color: var(--text-muted);
    border-style: dashed;
  }

  .expander-chip:hover {
    border-color: var(--text-muted);
  }

  .surprise-chip {
    align-self: flex-start;
    background-color: var(--accent-saved-tint);
    color: var(--accent-saved-text);
  }

  .surprise-chip:hover {
    border-color: var(--accent-saved-text);
  }

  .surprise-chip:focus-visible {
    outline-color: var(--accent-saved-text);
  }

  @media (prefers-reduced-motion: reduce) {
    .chip {
      transition:
        border-color var(--duration-fast),
        background-color var(--duration-fast);
    }

    .chip:active {
      transform: none;
    }
  }
</style>
