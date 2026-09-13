<script lang="ts">
  // Chip controls for steering the feed by mood/theme and by form — see
  // docs/work-packages/WP-3.3-steering-bar.md, docs/recommendation-design.md
  // ("Chip actions", "Surprise me reset") and docs/design-system.md
  // ("SteeringChip"). Standalone: does not import stores, the router, or
  // App.svelte — the caller supplies the current `ScoringState` and receives
  // every chip's `ChipAction` via `onchip`.
  import { applyChip } from '$lib/scoring';
  import type { ChipAction, ScoringState, Weights } from '$lib/scoring';
  import {
    buildFormChips,
    buildThemeChips,
    lessFormChip,
    moreAboutThemeChip,
    surpriseMeChip,
  } from './steering';

  interface Props {
    /** Current scoring state. Bind it (`bind:state`) to have chips apply themselves via `applyChip`. */
    state?: ScoringState;
    /** Called with every chip's `ChipAction`, regardless of whether `state` is bound. */
    onchip?: (action: ChipAction) => void;
  }

  let { state = $bindable(), onchip }: Props = $props();

  const ZERO_WEIGHTS: Weights = { theme: {}, form: {}, era: {}, author: {} };

  let expanded = $state(false);

  const weights = $derived(state?.weights ?? ZERO_WEIGHTS);
  // biome-ignore lint/correctness/noUnusedVariables: used in template
  const themeChips = $derived(buildThemeChips(weights, expanded));
  // biome-ignore lint/correctness/noUnusedVariables: used in template
  const formChips = $derived(buildFormChips(weights));

  function dispatch(action: ChipAction) {
    onchip?.(action);
    if (state) {
      state = applyChip(state, action);
    }
  }

  function toggleExpanded() {
    expanded = !expanded;
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
          onclick={() => dispatch(moreAboutThemeChip(chip.theme))}
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
        <button
          type="button"
          class="chip form-chip"
          class:active={chip.active}
          aria-pressed={chip.active}
          onclick={() => dispatch(lessFormChip(chip.form))}
        >
          Less {chip.label}
        </button>
      {/each}
    </div>
  </section>

  <button type="button" class="chip surprise-chip" onclick={() => dispatch(surpriseMeChip())}>
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
