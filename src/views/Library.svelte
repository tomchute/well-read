<script lang="ts">
  import { onMount } from 'svelte';
  // biome-ignore lint/correctness/noUnusedImports: used in template
  import EmptyState from '$lib/components/EmptyState.svelte';
  // biome-ignore lint/correctness/noUnusedImports: used in template
  import { formatType } from '$lib/components/WorkCard.svelte';
  import { loadManifest, type ManifestEntry } from '$lib/data/manifest';
  import { routeToHash } from '$lib/router.svelte';
  import { reactions, read, saved } from '$lib/stores/index.svelte';
  import {
    getFilteredAndSortedEntries,
    getTabCounts,
    type TabType,
    type WorkType,
  } from './library';

  type Status = 'loading' | 'error' | 'ready';

  let status = $state<Status>('loading');
  let allEntries = $state<ManifestEntry[]>([]);
  let errorMessage = $state('');
  let activeTab = $state<TabType>('saved');
  let typeFilter = $state<WorkType>('all');



  const EMPTY_MESSAGES: Record<TabType, string> = {
    saved: 'You haven\'t saved any works yet.',
    read: 'You haven\'t marked any works as read yet.',
    liked: 'You haven\'t liked any works yet.',
  };

  const TAB_ORDER: TabType[] = ['saved', 'read', 'liked'];

  onMount(async () => {
    try {
      const manifest = await loadManifest();
      allEntries = manifest.works;
      status = 'ready';
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Something went wrong.';
      status = 'error';
    }
  });

  function handleTabChange(newTab: TabType) {
    activeTab = newTab;
    typeFilter = 'all';
  }

  function handleRemove(workId: string) {
    saved.update((current) => current.filter((id) => id !== workId));
  }

  /** Moves both the roving-tabindex selection and DOM focus to `tab`'s tab button (WAI-ARIA tabs pattern). */
  function focusTab(tab: TabType): void {
    handleTabChange(tab);
    requestAnimationFrame(() => {
      document.getElementById(`tab-${tab}`)?.focus();
    });
  }

  // Roving tabindex + arrow-key navigation (WAI-ARIA "Tabs" pattern,
  // WP-5.2): only the selected tab is in the Tab order (tabindex 0), every
  // other tab is -1; arrow keys move both the selection and DOM focus.
  function handleKeyDown(e: KeyboardEvent, tab: TabType) {
    const currentIndex = TAB_ORDER.indexOf(activeTab);

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % TAB_ORDER.length;
      focusTab(TAB_ORDER[nextIndex]);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + TAB_ORDER.length) % TAB_ORDER.length;
      focusTab(TAB_ORDER[prevIndex]);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusTab(TAB_ORDER[0]);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusTab(TAB_ORDER[TAB_ORDER.length - 1]);
    }
  }

  const tabCounts = $derived(getTabCounts(saved.value, read.value, reactions.value));
  const filteredEntries = $derived(
    getFilteredAndSortedEntries(
      allEntries,
      activeTab,
      saved.value,
      read.value,
      reactions.value,
      typeFilter
    )
  );
</script>

<div class="library-view">
  <h2>Library</h2>

  {#if status === 'loading'}
    <p class="loading">Loading library…</p>
  {:else if status === 'error'}
    <p role="alert" class="error">Couldn't load the library: {errorMessage}</p>
  {:else}
    <div class="tabs-container">
      <div class="tabs" role="tablist" aria-label="Library sections">
        {#each TAB_ORDER as tab (tab)}
          <button
            id="tab-{tab}"
            class="tab"
            class:active={activeTab === tab}
            role="tab"
            type="button"
            aria-selected={activeTab === tab}
            aria-controls="tab-panel-{tab}"
            tabindex={activeTab === tab ? 0 : -1}
            onclick={() => handleTabChange(tab)}
            onkeydown={(e) => handleKeyDown(e, tab)}
          >
            <span class="tab-label">{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
            <span class="tab-count">{tabCounts[tab]}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="tab-content">
      <div id="tab-panel-{activeTab}" role="tabpanel" aria-labelledby="tab-{activeTab}">
        <div class="filter-bar">
          <label for="type-filter" class="filter-label">Filter:</label>
          <select id="type-filter" bind:value={typeFilter} class="type-filter">
            <option value="all">All</option>
            <option value="poem">Poems</option>
            <option value="story">Stories</option>
            <option value="book">Books</option>
            <option value="essay">Essays</option>
            <option value="play">Plays</option>
          </select>
        </div>

        {#if filteredEntries.length === 0}
          <EmptyState
            title={activeTab === 'saved' ? 'Nothing saved yet' : activeTab === 'read' ? 'Nothing marked as read yet' : 'Nothing liked yet'}
            body={EMPTY_MESSAGES[activeTab]}
          />
        {:else}
          <ul class="work-list">
            {#each filteredEntries as entry (entry.id)}
              <li class="work-row">
                <a class="work-link" href={routeToHash({ name: 'work', id: entry.id })}>
                  <span class="work-title">{entry.title}</span>
                  <span class="work-author small-caps">{entry.author}</span>
                  <span class="work-type-badge">{formatType(entry.type)}</span>
                  <span class="work-era">{entry.era}</span>
                </a>
                {#if activeTab === 'saved'}
                  <button
                    class="remove-button"
                    aria-label="Remove {entry.title} from saved"
                    onclick={() => handleRemove(entry.id)}
                    title="Remove from Saved"
                  >
                    ×
                  </button>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .library-view {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-4);
  }

  h2 {
    margin: 0;
    font-size: var(--text-xl);
  }

  .loading,
  .error {
    color: var(--text-muted);
  }

  .error {
    color: var(--accent-story-text);
  }

  /* Tabs */
  .tabs-container {
    border-bottom: 1px solid var(--hairline);
  }

  .tabs {
    display: flex;
    gap: var(--space-4);
  }

  .tab {
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    min-height: 44px;
    padding: var(--space-3) 0;
    cursor: pointer;
    font-family: var(--font-serif);
    font-size: var(--text-base);
    color: var(--text-muted);
    display: flex;
    gap: var(--space-2);
    align-items: baseline;
    transition: all var(--duration-base) var(--ease-out-soft);
  }

  .tab:hover {
    color: var(--text);
  }

  .tab.active {
    color: var(--accent-poem-text);
    border-bottom-color: var(--accent-poem);
  }

  .tab:focus-visible {
    outline: 2px solid var(--accent-poem-text);
    outline-offset: 2px;
  }

  .tab-label {
    font-weight: 600;
  }

  .tab-count {
    font-family: var(--font-ui);
    font-size: var(--text-xs);
    color: inherit;
    padding: 0 var(--space-2);
    border-radius: var(--radius-sm);
    background: var(--surface-raised);
  }

  /* Tab content */
  .tab-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  /* Filter bar */
  .filter-bar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .filter-label {
    font-size: var(--text-sm);
    color: var(--text-muted);
    font-family: var(--font-ui);
  }

  .type-filter {
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--hairline);
    border-radius: var(--radius-sm);
    background: var(--surface-raised);
    color: var(--text);
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-out-soft);
  }

  .type-filter:hover {
    border-color: var(--text-muted);
    background: var(--surface-pressed);
  }

  .type-filter:focus-visible {
    outline: 2px solid var(--accent-poem-text);
    outline-offset: 2px;
  }

  /* Work list */
  .work-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .work-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--hairline);
  }

  .work-row:last-child {
    border-bottom: none;
  }

  .work-link {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-1) var(--space-2);
    text-decoration: none;
    color: var(--text);
    transition: color var(--duration-fast) var(--ease-out-soft);
  }

  .work-link:hover .work-title {
    color: var(--accent-poem-text);
  }

  .work-link:focus-visible {
    outline: 2px solid var(--accent-poem-text);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
  }

  .work-title {
    font-family: var(--font-serif);
    font-size: var(--text-md);
    font-weight: 500;
    flex: 1 1 auto;
  }

  .work-author {
    font-size: var(--text-sm);
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .work-type-badge {
    font-family: var(--font-ui);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    padding: 2px var(--space-2);
    border: 1px solid var(--hairline);
    border-radius: var(--radius-sm);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .work-era {
    font-family: var(--font-ui);
    font-size: var(--text-xs);
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .remove-button {
    background: transparent;
    border: none;
    font-size: var(--text-lg);
    color: var(--text-muted);
    cursor: pointer;
    padding: var(--space-2);
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    min-height: 44px;
    border-radius: var(--radius-sm);
    transition: all var(--duration-fast) var(--ease-out-soft);
  }

  .remove-button:hover {
    background: var(--surface-raised);
    color: var(--accent-story-text);
  }

  .remove-button:focus-visible {
    outline: 2px solid var(--accent-poem-text);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .tab,
    .work-link,
    .type-filter,
    .remove-button {
      transition: none;
    }
  }
</style>
