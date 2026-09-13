<script module lang="ts">
  // Id of the last work opened from this feed, kept at module scope (not
  // component-instance `$state`) so it survives Feed.svelte being destroyed
  // entirely while a work is open (App.svelte swaps `<Feed>` for `<Work>`)
  // and read back the next time a Feed instance mounts, to restore keyboard
  // focus to the card that was opened (WP-2.6 scope item 5).
  let lastOpenedId: string | undefined;
</script>

<script lang="ts">
  import { createVirtualizer } from '@tanstack/svelte-virtual';
  import { onMount, untrack } from 'svelte';
  import { get } from 'svelte/store';
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
  import EmptyState from '$lib/components/EmptyState.svelte';
  // biome-ignore lint/correctness/noUnusedImports: used in template
  import SteeringBar from '$lib/components/SteeringBar.svelte';
  // biome-ignore lint/correctness/noUnusedImports: used in template
  import WorkCard from '$lib/components/WorkCard.svelte';
  import { loadManifest, type ManifestEntry } from '$lib/data/manifest';
  import { navigate } from '$lib/router.svelte';
  import { applyChip, buildPage, type ChipAction, defaultRng, type ScoringState } from '$lib/scoring';
  import { attachShortcuts } from '$lib/shortcuts';
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

  // Keyboard focus (WP-2.6): index into `page` of the card `j`/`k` last
  // moved to, or -1 before the reader has used a shortcut this visit.
  let focusedIndex = $state(-1);

  // True once the feed's first paint has happened — gates the entry
  // fade/rise so only cards rendered on that first paint animate in, never
  // ones the virtualiser mounts later while scrolling (WP-2.6 scope item 3).
  let hasPainted = $state(false);

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
      restoreFocusIfNeeded();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Something went wrong.';
      status = 'error';
    }
    // Two animation frames: the first lets the browser paint the cards just
    // rendered above; only after that do later virtualiser mounts (further
    // scrolling) stop qualifying as "first paint" and lose the entry
    // animation (WP-2.6 scope item 3).
    requestAnimationFrame(() => requestAnimationFrame(() => (hasPainted = true)));
  });

  // Keyboard shortcuts (WP-2.6, docs/design-system.md §7): `j`/`k` move
  // focus, `Enter` opens the focused card, `s`/`m` act on it. A separate
  // `onMount` (not folded into the async one above) so it can return a
  // proper synchronous cleanup function.
  onMount(() => {
    const detach = attachShortcuts({
      next: () => moveFocus(1),
      prev: () => moveFocus(-1),
      open: openFocused,
      save: () => {
        const entry = page[focusedIndex];
        if (entry) handleSave(entry);
      },
      'more-like-this': () => {
        const entry = page[focusedIndex];
        if (entry) handleMoreLikeThis(entry);
      },
    });
    return detach;
  });

  /** Restores focus to the card the reader last opened, once, after coming back to a freshly-mounted feed. */
  function restoreFocusIfNeeded(): void {
    const id = lastOpenedId;
    lastOpenedId = undefined;
    if (!id) return;
    const index = page.findIndex((entry) => entry.id === id);
    if (index < 0) return;
    focusedIndex = index;
    requestAnimationFrame(() => {
      get(virtualizer).scrollToIndex(index, { align: 'auto' });
      requestAnimationFrame(() => focusCardAt(index));
    });
  }

  /** Records which card is being opened (link click or `Enter`) so a later feed mount can restore focus to it. */
  function handleOpen(entry: ManifestEntry): void {
    lastOpenedId = entry.id;
    const index = page.findIndex((candidate) => candidate.id === entry.id);
    if (index >= 0) focusedIndex = index;
  }

  /** Navigates to the currently-focused card, as `Enter` does. */
  function openFocused(): void {
    const entry = page[focusedIndex];
    if (!entry) return;
    handleOpen(entry);
    navigate({ name: 'work', id: entry.id });
  }

  /** Moves keyboard focus by `delta` cards, scrolling the newly-focused card into view. */
  function moveFocus(delta: 1 | -1): void {
    if (page.length === 0) return;
    const next =
      focusedIndex < 0
        ? delta > 0
          ? 0
          : page.length - 1
        : Math.min(Math.max(focusedIndex + delta, 0), page.length - 1);
    focusedIndex = next;
    get(virtualizer).scrollToIndex(next, { align: 'auto' });
    requestAnimationFrame(() => focusCardAt(next));
  }

  /** Moves actual DOM focus onto the card link at `index`, retrying a couple of frames if the virtualiser hasn't mounted it yet. */
  function focusCardAt(index: number, attemptsLeft = 3): void {
    const id = page[index]?.id;
    if (!id || !scrollElement) return;
    const link = scrollElement.querySelector<HTMLAnchorElement>(
      `[data-card-id="${CSS.escape(id)}"] .card-link`
    );
    if (link) {
      link.focus();
    } else if (attemptsLeft > 0) {
      requestAnimationFrame(() => focusCardAt(index, attemptsLeft - 1));
    }
  }

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

  // Reads `page.length`/`scrollElement` reactively but calls `setOptions`
  // through `get()` rather than the auto-subscribing `$virtualizer` — the
  // svelte-virtual adapter's `setOptions` unconditionally forces the
  // underlying store to emit a new value on every call (so a `count` change
  // that doesn't shift the visible range still triggers a re-render).
  // Reading `$virtualizer` here as well would make this same effect depend
  // on that emission, re-running itself forever
  // (`effect_update_depth_exceeded` — this was the WP-2.6 blocking bug: it
  // fired the moment a real feed rendered, right after onboarding).
  $effect(() => {
    get(virtualizer).setOptions({
      count: page.length,
      getScrollElement: () => scrollElement ?? null,
      estimateSize: () => ROW_HEIGHT,
      overscan: 6,
    });
  });

  // Records first-seen for every card the virtualiser currently renders
  // (visible plus its overscan margin) — a no-op for ids already in `seen`.
  // This never touches `page`, so it cannot reorder the feed mid-scroll.
  // The `seen.value` read inside `markSeen` is wrapped in `untrack` so this
  // effect depends only on `$virtualizer`/`page` — not on `seen` itself —
  // since it also *writes* `seen`: left tracked, every write would re-run
  // this same effect (bounded, since each id is only written once, but
  // still an unnecessary self-retrigger the WP-2.6 fix avoids on principle).
  $effect(() => {
    for (const item of $virtualizer.getVirtualItems()) {
      const entry = page[item.index];
      if (entry) untrack(() => markSeen(seen, entry.id));
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
  <div role="alert">
    <EmptyState
      title="The feed is temporarily unavailable"
      body="We couldn't load the works catalog. Please try again."
      action={{ label: 'Reload', onclick: () => location.reload() }}
    />
  </div>
{:else if page.length === 0}
  <EmptyState
    title="The feed is empty"
    body="No works in the catalog yet."
  />
{:else}
  <div class="feed-scroll" bind:this={scrollElement}>
    <div class="feed-inner" style="height: {$virtualizer.getTotalSize()}px;">
      {#each $virtualizer.getVirtualItems() as virtualRow (page[virtualRow.index]?.id ?? virtualRow.key)}
        {@const item = page[virtualRow.index]}
        {#if item}
          <div
            class="virtual-row"
            data-card-id={item.id}
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
              onOpen={handleOpen}
              animateEntry={!hasPainted}
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
