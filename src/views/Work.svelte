<script lang="ts">
  import { onMount } from 'svelte';
  import { isSaved, moreLikeThis, toggleRead, toggleSaved } from '$lib/actions';
  // biome-ignore-start lint/correctness/noUnusedImports: used in template
  import MasterNotes from '$lib/components/MasterNotes.svelte';
  import WorkLinks from '$lib/components/WorkLinks.svelte';
  // biome-ignore-end lint/correctness/noUnusedImports: used in template
  import { loadWork } from '$lib/data/work';
  import { navigate } from '$lib/router.svelte';
  import { attachShortcuts } from '$lib/shortcuts';
  import { read, saved, weights } from '$lib/stores/index.svelte';
  import type { Era, Work as WorkRecord } from '$lib/types/work';

  interface Props {
    id: string;
  }

  let { id }: Props = $props();

  type Status = 'loading' | 'error' | 'not-found' | 'ready';

  // biome-ignore lint/correctness/noUnusedVariables: used in template
  let status = $state<Status>('loading');
  let work = $state<WorkRecord | undefined>(undefined);
  // biome-ignore lint/correctness/noUnusedVariables: used in template
  let errorMessage = $state('');
  // biome-ignore lint/correctness/noUnusedVariables: used in template
  let notesOpen = $state(false);

  // biome-ignore lint/correctness/noUnusedVariables: used in template
  const ERA_LABELS: Record<Era, string> = {
    ancient: 'Ancient',
    medieval: 'Medieval',
    renaissance: 'Renaissance',
    '18th_century': '18th century',
    '19th_century': '19th century',
    early_20th_century: 'Early 20th century',
    mid_20th_century: 'Mid 20th century',
    contemporary: 'Contemporary',
  };

  // biome-ignore lint/correctness/noUnusedVariables: used in template
  const isRead = $derived(work ? read.value.includes(work.id) : false);
  // biome-ignore lint/correctness/noUnusedVariables: used in template
  const isWorkSaved = $derived(work ? isSaved(saved.value, work.id) : false);

  // Splits shipped prose (short_story/book/essay/play `text`/`excerpt`) into
  // paragraphs on blank lines, so it renders as real `<p>` paragraphs rather
  // than one `white-space: pre-wrap` block — poems keep pre-wrap in `.poem`
  // to preserve line breaks and indentation exactly as authored (see
  // docs/design-system.md, "Poem rendering").
  // biome-ignore lint/correctness/noUnusedVariables: used in template
  function paragraphsOf(text: string): string[] {
    return text
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph.length > 0);
  }

  // biome-ignore lint/correctness/noUnusedVariables: used in template
  function formatLength(record: WorkRecord): string {
    return `${record.length.value.toLocaleString()} ${record.length.unit}`;
  }

  // biome-ignore lint/correctness/noUnusedVariables: used in template
  function handleToggleRead(): void {
    if (!work) return;
    toggleRead(read, work.id);
  }

  // biome-ignore lint/correctness/noUnusedVariables: used in template
  function handleToggleSaved(): void {
    if (!work) return;
    toggleSaved(saved, work.id);
  }

  // biome-ignore lint/correctness/noUnusedVariables: used in template
  function handleMoreLikeThis(): void {
    if (!work) return;
    moreLikeThis({ weights }, work);
  }

  // Keyboard shortcuts (WP-2.6, docs/design-system.md §7): `s` and `m` act
  // on the open work; `Escape` closes the notes sheet if it's open,
  // otherwise returns to the feed. MasterNotes also closes itself on
  // Escape while open (its own focus-trap listener) — harmless overlap,
  // since both simply set `notesOpen` to `false`.
  onMount(() => {
    const detach = attachShortcuts({
      save: handleToggleSaved,
      'more-like-this': handleMoreLikeThis,
      close: () => {
        if (notesOpen) {
          notesOpen = false;
        } else {
          navigate({ name: 'feed' });
        }
      },
    });
    return detach;
  });

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
    <h2 class="work-title" style="view-transition-name: work-title-{work.id}">{work.title}</h2>
    <p class="small-caps work-author">{work.author}</p>

    <ul class="badge-row">
      <li class="badge">{ERA_LABELS[work.era]}</li>
      <li class="badge">{work.form}</li>
      <li class="badge">Difficulty {work.difficulty}/5</li>
      <li class="badge">{formatLength(work)}</li>
    </ul>

    {#if work.textPolicy === 'pending'}
      <p class="pending">Notes and links are ready — the text is coming soon.</p>
    {:else if work.type === 'poem'}
      <div class="poem work-text">{work.text ?? work.excerpt}</div>
      {#if work.excerptNote}
        <p class="excerpt-note">{work.excerptNote}</p>
      {/if}
    {:else}
      <div class="prose work-text measure">
        {#each paragraphsOf(work.text ?? work.excerpt ?? '') as paragraph, index (index)}
          <p>{paragraph}</p>
        {/each}
      </div>
      {#if work.excerptNote}
        <p class="excerpt-note">{work.excerptNote}</p>
      {/if}
    {/if}

    <div class="action-row">
      <button type="button" class="notes-button" onclick={() => (notesOpen = true)}>
        Master notes
      </button>
      <button type="button" class="read-button" class:is-read={isRead} onclick={handleToggleRead}>
        {isRead ? 'Read ✓' : 'Mark as read'}
      </button>
      <button
        type="button"
        class="save-button"
        class:is-active={isWorkSaved}
        aria-pressed={isWorkSaved}
        onclick={handleToggleSaved}
      >
        {isWorkSaved ? 'Saved ✓' : 'Save'}
      </button>
      <button type="button" class="more-button" onclick={handleMoreLikeThis}>
        More like this
      </button>
    </div>

    <WorkLinks {work} />

    <MasterNotes open={notesOpen} notes={work.masterNotes} onClose={() => (notesOpen = false)} />
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

  .badge-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin: 0 0 var(--space-5);
    padding: 0;
    list-style: none;
  }

  .badge {
    font-family: var(--font-ui);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--accent-poem-text);
    background: var(--accent-poem-tint);
    padding: 2px var(--space-2);
    border-radius: var(--radius-sm);
    white-space: nowrap;
  }

  .pending {
    color: var(--text-muted);
    font-style: italic;
    margin: 0 0 var(--space-5);
  }

  .poem {
    margin: 0 0 var(--space-2);
  }

  .prose {
    margin: 0 0 var(--space-2);
  }

  .prose p {
    margin: 0 0 var(--space-4);
  }

  .prose p:last-child {
    margin-bottom: 0;
  }

  .excerpt-note {
    font-size: var(--text-sm);
    color: var(--text-muted);
    margin: 0 0 var(--space-6);
  }

  .action-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin: 0 0 var(--space-5);
  }

  .notes-button,
  .read-button,
  .save-button,
  .more-button {
    min-height: 44px;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-md);
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
    transition:
      background-color var(--duration-fast) var(--ease-out-soft),
      border-color var(--duration-fast) var(--ease-out-soft);
  }

  .notes-button,
  .more-button {
    border: 1px solid var(--hairline);
    background: var(--surface-raised);
    color: var(--text);
  }

  .notes-button:hover,
  .more-button:hover {
    background: var(--surface-pressed);
  }

  .save-button {
    border: 1px solid var(--hairline);
    background: var(--surface-raised);
    color: var(--text);
  }

  .save-button:hover {
    background: var(--surface-pressed);
  }

  .save-button.is-active {
    border-color: var(--accent-saved-text);
    background: var(--accent-saved-tint);
    color: var(--accent-saved-text);
  }

  .read-button {
    border: 1px solid var(--accent-saved-text);
    background: var(--accent-saved-tint);
    color: var(--accent-saved-text);
  }

  .read-button:hover {
    background: var(--surface-pressed);
  }

  .read-button.is-read {
    border-color: var(--hairline);
    background: transparent;
    color: var(--text-muted);
  }
</style>
