<script lang="ts">
  import { onMount } from 'svelte';
  import { loadManifest, type ManifestEntry } from '$lib/data/manifest';
  import { routeToHash } from '$lib/router';

  type Status = 'loading' | 'error' | 'ready';

  let status = $state<Status>('loading');
  let entries = $state<ManifestEntry[]>([]);
  let errorMessage = $state('');

  const TYPE_LABELS: Record<ManifestEntry['type'], string> = {
    poem: 'Poem',
    short_story: 'Short story',
    book: 'Book',
    essay: 'Essay',
    play: 'Play',
  };

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
</script>

<h2>Feed</h2>

{#if status === 'loading'}
  <p>Loading works…</p>
{:else if status === 'error'}
  <p role="alert">Couldn't load the feed: {errorMessage}</p>
{:else if entries.length === 0}
  <p>No works in the catalog yet.</p>
{:else}
  <ul class="feed-list">
    {#each entries as entry (entry.id)}
      <li class="feed-row">
        <a class="feed-link" href={routeToHash({ name: 'work', id: entry.id })}>
          <span class="feed-title">{entry.title}</span>
          <span class="feed-author small-caps">{entry.author}</span>
          <span class="feed-badge">{TYPE_LABELS[entry.type]}</span>
        </a>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .feed-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .feed-row + .feed-row {
    border-top: 1px solid var(--hairline);
  }

  .feed-link {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-1) var(--space-3);
    padding: var(--space-3) 0;
    text-decoration: none;
    color: var(--text);
  }

  .feed-link:hover .feed-title {
    color: var(--accent-poem-text);
  }

  .feed-title {
    font-family: var(--font-serif);
    font-size: var(--text-md);
  }

  .feed-author {
    color: var(--text-muted);
  }

  .feed-badge {
    margin-left: auto;
    font-family: var(--font-ui);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    padding: 2px var(--space-2);
    border: 1px solid var(--hairline);
    border-radius: var(--radius-sm);
    white-space: nowrap;
  }
</style>
