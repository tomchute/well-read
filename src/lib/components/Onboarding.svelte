<script lang="ts">
  // First-run taste quiz (WP-3.5) — see docs/recommendation-design.md
  // ("Cold start"). A standalone component: it reads/writes the `weights`
  // and `settings` stores directly and calls `onDone` when finished, but it
  // does not itself decide when to render or where to navigate afterward —
  // that's `shouldShowOnboarding` (./onboarding.ts) plus the orchestrator's
  // routing.
  import { settings, weights } from '$lib/stores/index.svelte';
  import { seedWeightsFromCards, TASTE_CARDS, type TasteCard } from './onboarding';

  interface Props {
    /** Called once the quiz is finished, by either Start reading or Skip. */
    onDone?: () => void;
  }

  let { onDone }: Props = $props();

  let selectedIds = $state<Set<string>>(new Set());

  // biome-ignore lint/correctness/noUnusedVariables: called from template
  function toggle(card: TasteCard) {
    const next = new Set(selectedIds);
    if (next.has(card.id)) {
      next.delete(card.id);
    } else {
      next.add(card.id);
    }
    selectedIds = next;
  }

  function finish() {
    settings.set({ ...settings.value, onboardingDone: true });
    onDone?.();
  }

  // biome-ignore lint/correctness/noUnusedVariables: called from template
  function startReading() {
    const chosen = TASTE_CARDS.filter((card) => selectedIds.has(card.id));
    if (chosen.length > 0) {
      weights.set(seedWeightsFromCards(weights.value, chosen));
    }
    finish();
  }

  // biome-ignore lint/correctness/noUnusedVariables: called from template
  function skip() {
    finish();
  }
</script>

<div class="onboarding">
  <header class="intro">
    <p class="eyebrow">Before you begin</p>
    <h2>What draws you to a page?</h2>
    <p class="hint">
      Pick as many as sound good, or none at all — you can always steer the feed later.
    </p>
  </header>

  <div class="cards" role="group" aria-label="Taste cards">
    {#each TASTE_CARDS as card (card.id)}
      {@const selected = selectedIds.has(card.id)}
      <button
        type="button"
        class="card"
        class:selected
        aria-pressed={selected}
        onclick={() => toggle(card)}
      >
        <span class="label">{card.label}</span>
      </button>
    {/each}
  </div>

  <div class="actions">
    <button type="button" class="btn-skip" onclick={skip}>Skip quiz</button>
    <button type="button" class="btn-start" onclick={startReading}>Start reading</button>
  </div>
</div>

<style>
  .onboarding {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    max-width: 640px;
    margin: 0 auto;
    padding: var(--space-6) var(--space-4);
  }

  .intro {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    text-align: center;
  }

  .eyebrow {
    margin: 0;
    font-family: var(--font-ui);
    font-size: var(--text-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  h2 {
    font-size: var(--text-2xl);
    line-height: var(--leading-2xl);
  }

  .hint {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--text-sm);
    line-height: var(--leading-sm);
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: var(--space-3);
  }

  .card {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: var(--space-4) var(--space-4);
    border: 1px solid var(--hairline);
    border-radius: var(--radius-md);
    background: var(--surface-raised);
    color: var(--text);
    font-family: var(--font-serif);
    font-size: var(--text-md);
    text-align: center;
    cursor: pointer;
    transition:
      transform var(--duration-fast) var(--ease-out-soft),
      border-color var(--duration-fast) var(--ease-out-soft),
      background-color var(--duration-fast) var(--ease-out-soft);
  }

  .card:hover {
    border-color: var(--accent-poem-text);
  }

  .card:active {
    transform: scale(0.97);
  }

  .card.selected {
    background: var(--accent-poem-tint);
    border-color: var(--accent-poem-text);
    color: var(--accent-poem-text);
    font-weight: 600;
  }

  .card:focus-visible {
    outline: 2px solid var(--accent-poem-text);
    outline-offset: 2px;
  }

  .actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
  }

  .btn-skip,
  .btn-start {
    min-height: 44px;
    padding: var(--space-3) var(--space-5);
    border-radius: var(--radius-sm);
    font-family: var(--font-ui);
    font-size: var(--text-base);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-out-soft);
  }

  .btn-skip {
    background: transparent;
    border: 1px solid var(--hairline);
    color: var(--text-muted);
  }

  .btn-skip:hover {
    border-color: var(--text);
    color: var(--text);
  }

  .btn-start {
    /* AA-safe combination: the darkened *-text variant as a solid fill with
     * near-white text (WP-5.2 audit — the raw --accent-poem fill against
     * --paper-100 text measured ~3.4:1, below the 4.5:1 AA-normal-text
     * threshold; --accent-poem-text as the fill clears 5:1+ in both themes). */
    background: var(--accent-poem-text);
    border: 1px solid transparent;
    color: var(--paper-100);
  }

  .btn-start:hover {
    transform: scale(1.02);
  }

  .btn-start:active {
    transform: scale(0.97);
  }

  .btn-skip:focus-visible,
  .btn-start:focus-visible {
    outline: 2px solid var(--accent-poem-text);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .card,
    .btn-skip,
    .btn-start {
      transition: none;
    }

    .card:active,
    .btn-start:hover,
    .btn-start:active {
      transform: none;
    }
  }
</style>
