<script lang="ts">
  import WorkLinks from '$lib/components/WorkLinks.svelte';
  import { loadWork } from '$lib/data/work';
  import type { Work as WorkRecord } from '$lib/types/work';

  interface Props {
    id: string;
  }

  let { id }: Props = $props();

  type Status = 'loading' | 'error' | 'not-found' | 'ready';

  let status = $state<Status>('loading');
  let work = $state<WorkRecord | undefined>(undefined);
  let errorMessage = $state('');

  $effect(() => {
    const workId = id;
    status = 'loading';
    work = undefined;
    loadWork(workId).then(
      (result) => {
        if (workId !== id) return; // a newer id arrived while this fetch was in flight
        if (!result) {
          status = 'not-found';
          return;
        }
        work = result;
        status = 'ready';
      },
      (error: unknown) => {
        if (workId !== id) return;
        errorMessage = error instanceof Error ? error.message : 'Something went wrong.';
        status = 'error';
      },
    );
  });
</script>

{#if status === 'loading'}
  <p>Loading…</p>
{:else if status === 'not-found'}
  <p>This work isn't in the catalog.</p>
{:else if status === 'error'}
  <p role="alert">Couldn't load this work: {errorMessage}</p>
{:else if work}
  <article>
    <h2 class="work-title">{work.title}</h2>
    <p class="small-caps work-author">{work.author}</p>

    {#if work.textPolicy === 'pending'}
      <p class="pending">Notes and links are ready — the text is coming soon.</p>
    {:else if work.type === 'poem'}
      <div class="poem work-text">{work.text ?? work.excerpt}</div>
    {:else}
      <div class="prose work-text measure">{work.text ?? work.excerpt}</div>
    {/if}

    <WorkLinks {work} />
  </article>
{/if}

<style>
  .work-title {
    font-size: var(--text-2xl);
    line-height: var(--leading-2xl);
    margin: var(--space-2) 0 var(--space-3);
  }

  .work-author {
    margin: 0 0 var(--space-5);
  }

  .pending {
    color: var(--text-muted);
    font-style: italic;
    margin: 0 0 var(--space-5);
  }

  .poem {
    margin: 0 0 var(--space-6);
  }

  .prose {
    white-space: pre-wrap;
    margin: 0 0 var(--space-6);
  }
</style>
