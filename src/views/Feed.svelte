<script lang="ts">
  import { createVirtualizer } from '@tanstack/svelte-virtual';
  import { onMount } from 'svelte';
  import {
    dislikeWork,
    isLiked,
    isSaved,
    likeWork,
    markSeen,
    moreLikeThis,
    toggleSaved,
  } from '$lib/actions';
  // biome-ignore lint/correctness/noUnusedImports: used in template
  import SteeringBar from '$lib/components/SteeringBar.svelte';
  // biome-ignore lint/correctness/noUnusedImports: used in template
  import WorkCard from '$lib/components/WorkCard.svelte';
  import { loadManifest, type ManifestEntry } from '$lib/data/manifest';
  import { applyChip, buildPage, type ChipAction, defaultRng, type ScoringState } from '$lib/scoring';
  import { reactions, read, saved, seen, sessionPins, weights } from '$lib/stores/index.svelte';

  type Status = 'loading' | 'error' | 'ready';

  let status = $state<Status>('loading');
  let entries = $state<ManifestEntry[]>([]);
  // biome-ignore lint/correctness/noUnusedVariables: used in template
  let errorMessage = $state('');
  let scrollElement = $state<HTMLDivElement | undefined>(undefined);

  // The feed's current, stable order. Rebuilt explicitly (mount, a steering
  // chip, "surprise me") rather than derived live from `weights`/`seen` —
  // see `rebuildPage` — so passive reading (scrolling, marking a card seen)
  // never reorders the page under the reader's finger.
  let page = $state<ManifestEntry[]>([]);

  // Fixed card height (+ the gap below it) so the virtualiser never has to
  // measure the DOM: WorkCard reserves its own teaser space, so every card
  // renders at exactly this height regardless of load state. Keeping it
  // constant is also what keeps the mounted-node count stable while
  // scrolling (docs/work-packages/WP-2.3 acceptance).
  const CARD_HEIGHT = 360;
  const ROW_GAP = 16;
  const ROW_HEIGHT = CARD_HEIGHT + ROW_GAP;

  /** Rebuilds `page` from the current persisted scoring state — the only place `buildPage` is called. */
  function rebuildPage(): void {
    if (status !== 'ready' || entries.length === 0) {
      page = entries;
      return;
    }
    const state: ScoringState = {
      weights: weights.value,
      seen: seen.value,
      reactions: reactions.value,
      sessionPins: sessionPins.value,
      read: read.value,
    };
    page = buildPage(entries, state, entries.length, new Date(), defaultRng);
  }

  onMount(async () => {
    try {
      const manifest = await loadManifest();
      entries = manifest.works;
      status = 'ready';
      rebuildPage();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Something went wrong.';
      status = 'error';
    }
  });

  // Snapshot passed to SteeringBar purely for its chip active/inactive
  // display — reading it here does not itself trigger a rebuild; only
  // `handleChip` (which every SteeringBar interaction goes through) does.
  const scoringSnapshot = $derived<ScoringState>({
    weights: weights.value,
    seen: seen.value,
    reactions: reactions.value,
    sessionPins: sessionPins.value,
    read: read.value,
  });

  /** Every steering-bar interaction (a theme/form chip or "surprise me") lands here. */
  function handleChip(action: ChipAction) {
    const next = applyChip(scoringSnapshot, action);
    weights.set(next.weights);
    sessionPins.set(next.sessionPins);
    rebuildPage();
  }

  function handleLike(entry: ManifestEntry) {
    likeWork({ weights, reactions }, entry);
  }

  function handleDislike(entry: ManifestEntry) {
    dislikeWork({ weights, reactions }, entry);
  }

  function handleSave(entry: ManifestEntry) {
    toggleSaved(saved, entry.id);
  }

  function handleMoreLikeThis(entry: ManifestEntry) {
    moreLikeThis({ weights }, entry);
    rebuildPage();
  }

  const virtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: 0,
    getScrollElement: () => scrollElement ?? null,
    estimateSize: () => ROW_HEIGHT,
    overscan: 6,
  });

  $effect(() => {
    $virtualizer.setOptions({
      count: page.length,
      getScrollElement: () => scrollElement ?? null,
      estimateSize: () => ROW_HEIGHT,
      overscan: 6,
    });
  });

  // Records first-seen for every card the virtualiser currently renders
  // (visible plus its overscan margin) — a no-op for ids already in `seen`.
  // This never touches `page`, so it cannot reorder the feed mid-scroll.
  $effect(() => {
    for (const item of $virtualizer.getVirtualItems()) {
      const entry = page[item.index];
      if (entry) markSeen(seen, entry.id);
    }
  });
</script>

<h2>Feed</h2>

{#if status === 'ready'}
  <SteeringBar state={scoringSnapshot} onchip={handleChip} />
{/if}

{#if status === 'loading'}
  <div class="feed-skeleton" aria-hidden="true" aria-label="Loading works">
    {#each { length: 4 } as _, i (i)}
      <div class="skeleton-card"></div>
    {/each}
  </div>
{:else if status === 'error'}
  <p role="alert" class="feed-error">Couldn't load the feed: {errorMessage}</p>
{:else if page.length === 0}
  <p>No works in the catalog yet.</p>
{:else}
  <div class="feed-scroll" bind:this={scrollElement}>
    <div class="feed-inner" style="height: {$virtualizer.getTotalSize()}px;">
      {#each $virtualizer.getVirtualItems() as virtualRow (page[virtualRow.index]?.id ?? virtualRow.key)}
        {@const item = page[virtualRow.index]}
        {#if item}
          <div
            class="virtual-row"
            style="height: {CARD_HEIGHT}px; transform: translateY({virtualRow.start}px);"
          >
            <WorkCard
              entry={item}
              index={virtualRow.index + 1}
              liked={isLiked(reactions.value, item.id)}
              saved={isSaved(saved.value, item.id)}
              onLike={handleLike}
              onDislike={handleDislike}
              onSave={handleSave}
              onMoreLikeThis={handleMoreLikeThis}
            />
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
