<script lang="ts">
  import { createVirtualizer } from '@tanstack/svelte-virtual';
  import { onMount } from 'svelte';
  import { loadManifest, type ManifestEntry } from '$lib/data/manifest';
  import { buildPage, defaultRng, type ScoringState } from '$lib/scoring';
  import WorkCard from '$lib/components/WorkCard.svelte';
  import { reactions, read, seen, sessionPins, weights } from '$lib/stores/index.svelte';

  type Status = 'loading' | 'error' | 'ready';

  let status = $state<Status>('loading');
  let entries = $state<ManifestEntry[]>([]);
  let errorMessage = $state('');
  let scrollElement = $state<HTMLDivElement | undefined>(undefined);

  // Fixed card height (+ the gap below it) so the virtualiser never has to
  // measure the DOM: WorkCard reserves its own teaser space, so every card
  // renders at exactly this height regardless of load state. Keeping it
  // constant is also what keeps the mounted-node count stable while
  // scrolling (docs/work-packages/WP-2.3 acceptance).
  const CARD_HEIGHT = 360;
  const ROW_GAP = 16;
  const ROW_HEIGHT = CARD_HEIGHT + ROW_GAP;

  onMount(async () => {
    try {
      const manifest = await loadManifest();
      entries = manifest.works;
      status = 'ready';
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Something went wrong.';
      status = 'error';
    }
  });

  // Full scoring (steering chips, live weight updates) is wired in WP-3.3.
  // For now this still runs every manifest entry through the real
  // `buildPage` walk — using whatever `weights`/`seen`/`reactions`/
  // `sessionPins`/`read` are already persisted, which is all-zero/empty
  // until a later WP writes to them — rather than raw manifest order, since
  // the persisted-state runes it needs already exist and reading them here
  // is a one-line, non-reactive-surprise wire-up.
  const orderedEntries = $derived.by((): ManifestEntry[] => {
    if (status !== 'ready' || entries.length === 0) return entries;
    const state: ScoringState = {
      weights: weights.value,
      seen: seen.value,
      reactions: reactions.value,
      sessionPins: sessionPins.value,
      read: read.value,
    };
    return buildPage(entries, state, entries.length, new Date(), defaultRng);
  });

  const virtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: 0,
    getScrollElement: () => scrollElement ?? null,
    estimateSize: () => ROW_HEIGHT,
    overscan: 6,
  });

  $effect(() => {
    $virtualizer.setOptions({
      count: orderedEntries.length,
      getScrollElement: () => scrollElement ?? null,
      estimateSize: () => ROW_HEIGHT,
      overscan: 6,
    });
  });
</script>

<h2>Feed</h2>

{#if status === 'loading'}
  <div class="feed-skeleton" aria-hidden="true" aria-label="Loading works">
    {#each { length: 4 } as _, i (i)}
      <div class="skeleton-card"></div>
    {/each}
  </div>
{:else if status === 'error'}
  <p role="alert" class="feed-error">Couldn't load the feed: {errorMessage}</p>
{:else if orderedEntries.length === 0}
  <p>No works in the catalog yet.</p>
{:else}
  <div class="feed-scroll" bind:this={scrollElement}>
    <div class="feed-inner" style="height: {$virtualizer.getTotalSize()}px;">
      {#each $virtualizer.getVirtualItems() as virtualRow (orderedEntries[virtualRow.index]?.id ?? virtualRow.key)}
        {@const item = orderedEntries[virtualRow.index]}
        {#if item}
          <div
            class="virtual-row"
            style="height: {CARD_HEIGHT}px; transform: translateY({virtualRow.start}px);"
          >
            <WorkCard entry={item} index={virtualRow.index + 1} />
          </div>
        {/if}
      {/each}
    </div>
  </div>
{/if}

<style>
  .feed-scroll {
    height: calc(100dvh - 220px);
    min-height: 320px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .feed-inner {
    position: relative;
    width: 100%;
  }

  .virtual-row {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
  }

  .feed-error {
    color: var(--accent-story-text);
  }

  .feed-skeleton {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .skeleton-card {
    height: 360px;
    border-radius: var(--radius-md);
    background: var(--surface-raised);
    box-shadow: var(--shadow-sm);
    animation: feed-skeleton-pulse 1.4s var(--ease-out-soft) infinite;
  }

  @keyframes feed-skeleton-pulse {
    0%,
    100% {
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton-card {
      animation: none;
    }
  }
</style>
