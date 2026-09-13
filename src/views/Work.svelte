<script lang="ts">
  import { onMount } from 'svelte';
  import { isSaved, moreLikeThis, toggleRead, toggleSaved } from '$lib/actions';
  // biome-ignore-start lint/correctness/noUnusedImports: used in template
  import EmptyState from '$lib/components/EmptyState.svelte';
  import MasterNotes from '$lib/components/MasterNotes.svelte';
  import { formatType } from '$lib/components/WorkCard.svelte';
  import WorkLinks from '$lib/components/WorkLinks.svelte';
  import { accentFor, typeGlyphFor } from '$lib/components/workAccent';
  // biome-ignore-end lint/correctness/noUnusedImports: used in template
  import { loadWork } from '$lib/data/work';
  import { goBack, type Route, route, routeToHash } from '$lib/router.svelte';
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

  // Same per-type accent + glyph as the feed card (workAccent.ts), so the
  // colour a reader learned on the card means the same thing here.
  // biome-ignore lint/correctness/noUnusedVariables: used in template
  const accent = $derived(work ? accentFor(work.type) : accentFor('poem'));

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

  // Where "Back" goes: the in-app page the reader came from (feed or
  // library) via browser history, so scroll position and the opened card's
  // focus are restored; a deep link straight to `#/work/...` has no
  // previous in-app route and falls back to the feed (WP-2.6 focus-restore
  // path in Feed.svelte still applies either way).
  const BACK_FALLBACK: Route = { name: 'feed' };
  // biome-ignore lint/correctness/noUnusedVariables: used in template
  const backTarget = $derived<Route>(
    route.previous?.name === 'library' ? { name: 'library' } : BACK_FALLBACK
  );
  // biome-ignore lint/correctness/noUnusedVariables: used in template
  const backLabel = $derived(backTarget.name === 'library' ? 'Back to library' : 'Back to feed');
  // biome-ignore lint/correctness/noUnusedVariables: used in template
  const backHref = $derived(routeToHash(backTarget));

  function handleBack(event?: MouseEvent): void {
    event?.preventDefault();
    goBack(backTarget);
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
          handleBack();
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

{#if status !== 'loading'}
  <a class="back-link" href={backHref} onclick={handleBack}>
    <svg viewBox="0 0 24 24" aria-hidden="true"
      ><path
        d="M15 5l-7 7 7 7"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      /></svg
    >
    <span>{backLabel}</span>
  </a>
{/if}

{#if status === 'loading'}
  <p>Loading…</p>
{:else if status === 'not-found'}
  <EmptyState
    title="This work is not in the catalog"
    body="It may have been removed or the link might be incorrect."
    action={{ label: backLabel, href: backHref }}
  />
{:else if status === 'error'}
  <EmptyState
    title="This work is temporarily unavailable"
    body="We couldn't load the details. Please try again."
    action={{ label: 'Reload', onclick: () => location.reload() }}
  />
{:else if work}
  <article
    style="--card-accent: {accent.bar}; --card-accent-tint: {accent.tint}; --card-accent-text: {accent.text};"
  >
    <h2 class="work-title" style="view-transition-name: work-title-{work.id}">{work.title}</h2>
    <p class="small-caps work-author">{work.author}</p>

    <ul class="badge-row">
      <li class="badge badge-type">
        <svg viewBox="0 0 24 24" class="badge-glyph" aria-hidden="true"
          ><path
            d={typeGlyphFor(work.type)}
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          /></svg
        >
        {formatType(work.type)}
      </li>
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
  .back-link {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    min-height: 44px;
    margin: 0 0 var(--space-4);
    padding-right: var(--space-2);
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    color: var(--text-muted);
    text-decoration: none;
    transition: color var(--duration-fast) var(--ease-out-soft);
  }

  .back-link svg {
    width: 18px;
    height: 18px;
  }

  .back-link:hover {
    color: var(--text);
  }

  .back-link:focus-visible {
    outline: 2px solid var(--accent-poem-text);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
  }

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
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-family: var(--font-ui);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--card-accent-text);
    background: var(--card-accent-tint);
    padding: 2px var(--space-2);
    border-radius: var(--radius-sm);
    white-space: nowrap;
  }

  .badge-type {
    font-weight: 700;
    box-shadow: inset 0 0 0 1px var(--card-accent);
  }

  .badge-glyph {
    width: 14px;
    height: 14px;
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
