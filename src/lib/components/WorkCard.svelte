<script module lang="ts">
  // Pure helpers, importable without mounting the component (see
  // tests/workCard.spec.ts). Kept in the module context per Svelte 5 so
  // WorkCard.svelte stays the single file this WP scopes, rather than
  // splitting a sibling `workCard.ts` the WP's Files list doesn't name.
  import type { Era, TextPolicy, WorkType } from '$lib/types/work';

  /** Opening lines (poems) or an opening-words snippet (prose), or `pending` when no text shipped yet. */
  export type Teaser = { kind: 'text'; value: string } | { kind: 'pending' };

  /** How many opening lines a poem teaser shows (design-system.md: "first 3–4 lines"). */
  const POEM_TEASER_LINES = 4;
  /** How many opening words a prose teaser shows (WP-2.3: "the first ~40 words"). */
  const PROSE_TEASER_WORDS = 40;

  /**
   * Builds a card's teaser from whatever text a work actually ships
   * (`text` for `textPolicy: 'full'`, `excerpt` for `'excerpt'`) — poems show
   * their opening lines verbatim (line breaks and leading space preserved,
   * blank stanza-break lines skipped when counting toward the line cap);
   * every other type shows an opening-words snippet. No shipped text at all
   * (`textPolicy: 'pending'`, or a record that simply hasn't got one yet)
   * teasers as `pending` so the card can show a quiet "text coming" notice
   * instead of blank space.
   */
  export function computeTeaser(work: {
    type: WorkType;
    text?: string;
    excerpt?: string;
  }): Teaser {
    const source = work.text ?? work.excerpt;
    if (!source) return { kind: 'pending' };

    if (work.type === 'poem') {
      const lines = source.split('\n').filter((line) => line.trim().length > 0);
      return { kind: 'text', value: lines.slice(0, POEM_TEASER_LINES).join('\n') };
    }

    const words = source.trim().split(/\s+/).filter(Boolean);
    const snippet = words.slice(0, PROSE_TEASER_WORDS).join(' ');
    return { kind: 'text', value: words.length > PROSE_TEASER_WORDS ? `${snippet}…` : snippet };
  }

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

  /** Formats a manifest `era` value for the era badge. */
  export function formatEra(era: Era): string {
    return ERA_LABELS[era];
  }

  const TYPE_LABELS: Record<WorkType, string> = {
    poem: 'Poem',
    short_story: 'Short story',
    book: 'Book',
    essay: 'Essay',
    play: 'Play',
  };

  /** Formats a manifest `type` value (used as the accessible label for the card link). */
  export function formatType(type: WorkType): string {
    return TYPE_LABELS[type];
  }

  /** Textual `textPolicy` note shown only while a card is waiting on its shard fetch. */
  export function pendingNoticeFor(textPolicy: TextPolicy): string {
    return textPolicy === 'pending' ? 'Notes and links — text coming' : 'Text coming';
  }
</script>

<script lang="ts">
  import type { ManifestEntry } from '$lib/data/manifest';
  import { loadWork } from '$lib/data/work';
  import { routeToHash } from '$lib/router';
  import type { Work } from '$lib/types/work';

  interface Props {
    /** The manifest entry to render — every field except shipped text is available immediately. */
    entry: ManifestEntry;
    /** 1-based position in the current feed order — shown as the specimen number. */
    index: number;
    /** Whether this work carries an explicit like (`reactions[id] === 1`) — shows the like button pressed. */
    liked?: boolean;
    /** Whether this work is in the saved list — shows the save button pressed. */
    saved?: boolean;
    onLike?: (entry: ManifestEntry) => void;
    onDislike?: (entry: ManifestEntry) => void;
    onSave?: (entry: ManifestEntry) => void;
    onMoreLikeThis?: (entry: ManifestEntry) => void;
  }

  const noop = () => {};

  let {
    entry,
    index,
    liked = false,
    saved = false,
    onLike = noop,
    onDislike = noop,
    onSave = noop,
    onMoreLikeThis = noop,
  }: Props = $props();

  type LoadStatus = 'loading' | 'ready' | 'error';

  let loadStatus = $state<LoadStatus>('loading');
  let work = $state<Work | undefined>(undefined);
  let loadErrorMessage = $state('');

  // Re-fetches only when the underlying work actually changes (Feed.svelte
  // keys each virtual row by `entry.id`, so in practice a given WorkCard
  // instance is mounted once per id and this runs once) — never on every
  // manifest-order re-sort. Because it targets `entry.id`, a stale response
  // from a since-replaced id is discarded rather than clobbering the card.
  $effect(() => {
    const id = entry.id;
    loadStatus = 'loading';
    work = undefined;
    loadWork(id)
      .then((result) => {
        if (id !== entry.id) return;
        work = result;
        loadStatus = 'ready';
      })
      .catch((error: unknown) => {
        if (id !== entry.id) return;
        loadErrorMessage = error instanceof Error ? error.message : 'Something went wrong.';
        loadStatus = 'error';
      });
  });

  const teaser = $derived<Teaser>(
    loadStatus === 'ready' && work
      ? computeTeaser({ type: entry.type, text: work.text, excerpt: work.excerpt })
      : { kind: 'pending' }
  );

  /**
   * Accent CSS custom-property names by `type`, per docs/design-system.md
   * ("poem=teal, story=vermilion, book=ochre") plus two sensible reuses for
   * the two types the design system doesn't assign a dedicated hue to
   * (§8 rules out inventing new hues beyond the four specimen accents):
   * essay borrows the cooler `saved` (sky) family — reflective, non-fiction
   * prose — and play borrows `story` (vermilion) — both are performed/staged
   * narrative forms.
   */
  const ACCENT_BY_TYPE: Record<WorkType, { bar: string; tint: string; text: string }> = {
    poem: { bar: 'var(--accent-poem)', tint: 'var(--accent-poem-tint)', text: 'var(--accent-poem-text)' },
    short_story: {
      bar: 'var(--accent-story)',
      tint: 'var(--accent-story-tint)',
      text: 'var(--accent-story-text)',
    },
    book: { bar: 'var(--accent-book)', tint: 'var(--accent-book-tint)', text: 'var(--accent-book-text)' },
    essay: { bar: 'var(--accent-saved)', tint: 'var(--accent-saved-tint)', text: 'var(--accent-saved-text)' },
    play: {
      bar: 'var(--accent-story)',
      tint: 'var(--accent-story-tint)',
      text: 'var(--accent-story-text)',
    },
  };

  const accent = $derived(ACCENT_BY_TYPE[entry.type]);
  const workHref = $derived(routeToHash({ name: 'work', id: entry.id }));

  function handleLike(event: MouseEvent) {
    event.preventDefault();
    onLike(entry);
  }
  function handleDislike(event: MouseEvent) {
    event.preventDefault();
    onDislike(entry);
  }
  function handleSave(event: MouseEvent) {
    event.preventDefault();
    onSave(entry);
  }
  function handleMoreLikeThis(event: MouseEvent) {
    event.preventDefault();
    onMoreLikeThis(entry);
  }
</script>

<article
  class="work-card"
  style="--card-accent: {accent.bar}; --card-accent-tint: {accent.tint}; --card-accent-text: {accent.text};"
>
  <a class="card-link" href={workHref} aria-label={`${entry.title} by ${entry.author}`}></a>

  <div class="card-body">
    <p class="specimen-number">No. {index}</p>

    <div class="cover-box" aria-hidden="true">
      <svg viewBox="0 0 24 24" class="cover-glyph" focusable="false">
        <path
          d="M12 3c3 3 7 4 7 9a7 7 0 0 1-14 0c0-5 4-6 7-9Z"
          fill="none"
          stroke="currentColor"
          stroke-width="1"
        />
      </svg>
    </div>

    <div class="card-main">
      <h3 class="title">{entry.title}</h3>
      <p class="author small-caps">{entry.author}</p>

      <div class="badges">
        <span class="badge">{formatEra(entry.era)}</span>
        <span class="badge">{entry.form}</span>
      </div>

      <div class="teaser" class:poem={entry.type === 'poem'}>
        {#if loadStatus === 'loading'}
          <span class="teaser-skeleton" aria-hidden="true"></span>
          <span class="teaser-skeleton" aria-hidden="true"></span>
          <span class="teaser-skeleton short" aria-hidden="true"></span>
        {:else if loadStatus === 'error'}
          <p class="teaser-notice" role="alert">Couldn't load a preview: {loadErrorMessage}</p>
        {:else if teaser.kind === 'pending'}
          <p class="teaser-notice">{pendingNoticeFor(entry.textPolicy)}</p>
        {:else}
          <p class="teaser-text">{teaser.value}</p>
        {/if}
      </div>

      <div class="actions">
        <button
          type="button"
          class="action"
          class:pressed={liked}
          aria-pressed={liked}
          onclick={handleLike}
          aria-label="Like"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"
            ><path
              d="M12 20s-7-4.4-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 5c-2.5 4.6-9.5 9-9.5 9Z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
            /></svg
          >
        </button>
        <button type="button" class="action" onclick={handleDislike} aria-label="Not for me">
          <svg viewBox="0 0 24 24" aria-hidden="true"
            ><path
              d="M7 14V4M3 12l1.6 6.4a2 2 0 0 0 2 1.6H16a2 2 0 0 0 2-1.6L20 9a2 2 0 0 0-2-2.4h-5l.7-3.4a1.6 1.6 0 0 0-2.9-1.2L7 6"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              transform="rotate(180 12 12)"
            /></svg
          >
        </button>
        <button
          type="button"
          class="action"
          class:pressed={saved}
          aria-pressed={saved}
          onclick={handleSave}
          aria-label="Save"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"
            ><path
              d="M6 3.5h12a.5.5 0 0 1 .5.5v16.2a.5.5 0 0 1-.77.42L12 16.8l-5.73 3.82a.5.5 0 0 1-.77-.42V4a.5.5 0 0 1 .5-.5Z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
            /></svg
          >
        </button>
        <button
          type="button"
          class="action wide"
          onclick={handleMoreLikeThis}
          aria-label="More like this"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"
            ><path
              d="M12 4v4M12 16v4M4 12h4M16 12h4M6.3 6.3l2.8 2.8M14.9 14.9l2.8 2.8M6.3 17.7l2.8-2.8M14.9 9.1l2.8-2.8"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            /></svg
          >
          <span>More like this</span>
        </button>
      </div>
    </div>
  </div>
</article>

<style>
  .work-card {
    position: relative;
    height: 100%;
    display: flex;
    background: var(--surface-raised);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
    transition:
      box-shadow var(--duration-base) var(--ease-out-soft),
      transform var(--duration-base) var(--ease-out-soft);
  }

  .work-card::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 3px;
    background: var(--card-accent);
  }

  .work-card:has(> .card-link:hover) {
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }

  .work-card:has(> .card-link:active) {
    box-shadow: var(--shadow-sm);
    transform: translateY(0);
    background: var(--surface-pressed);
  }

  @media (prefers-reduced-motion: reduce) {
    .work-card:has(> .card-link:hover),
    .work-card:has(> .card-link:active) {
      transform: none;
    }
  }

  .card-link {
    position: absolute;
    inset: 0;
    z-index: 1;
  }

  .card-body {
    position: relative;
    z-index: 2;
    display: flex;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-4) var(--space-4) var(--space-5);
    width: 100%;
    pointer-events: none;
  }

  .card-body :global(a),
  .card-body button {
    pointer-events: auto;
  }

  .specimen-number {
    position: absolute;
    top: var(--space-2);
    left: var(--space-5);
    margin: 0;
  }

  .cover-box {
    flex: 0 0 auto;
    width: 96px;
    aspect-ratio: 4 / 3;
    border-radius: var(--radius-sm);
    background: var(--card-accent-tint);
    color: var(--card-accent-text);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: var(--space-4);
  }

  .cover-glyph {
    width: 40%;
    height: 40%;
    opacity: 0.6;
  }

  .card-main {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    padding-top: var(--space-4);
  }

  .title {
    font-family: var(--font-serif);
    font-optical-sizing: auto;
    font-weight: 600;
    font-size: var(--text-lg);
    line-height: var(--leading-lg);
    margin: 0 0 var(--space-1);
    color: var(--text);
  }

  .author {
    margin: 0 0 var(--space-3);
    color: var(--text-muted);
  }

  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  .badge {
    font-family: var(--font-ui);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 2px var(--space-2);
    border-radius: var(--radius-sm);
    background: var(--card-accent-tint);
    color: var(--card-accent-text);
    white-space: nowrap;
  }

  /* Reserves a stable block of teaser lines regardless of loading/ready/pending
   * state, so a card never resizes once its shard finishes loading. */
  .teaser {
    min-height: calc(var(--leading-md) * var(--text-md) * 4);
    margin-bottom: var(--space-3);
  }

  .teaser-text {
    margin: 0;
    font-family: var(--font-body);
    font-size: var(--text-md);
    line-height: var(--leading-md);
    color: var(--text);
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .teaser.poem .teaser-text {
    white-space: pre-wrap;
    font-style: italic;
  }

  .teaser-notice {
    margin: 0;
    font-family: var(--font-body);
    font-size: var(--text-md);
    font-style: italic;
    color: var(--text-muted);
  }

  .teaser-skeleton {
    display: block;
    height: 0.9em;
    margin-bottom: var(--space-1);
    border-radius: var(--radius-sm);
    background: var(--surface-pressed);
    animation: skeleton-pulse 1.4s var(--ease-out-soft) infinite;
  }

  .teaser-skeleton.short {
    width: 60%;
  }

  @keyframes skeleton-pulse {
    0%,
    100% {
      opacity: 0.5;
    }
    50% {
      opacity: 0.9;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .teaser-skeleton {
      animation: none;
    }
  }

  .actions {
    margin-top: auto;
    display: flex;
    gap: var(--space-2);
  }

  .action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    min-width: 44px;
    min-height: 44px;
    padding: 0 var(--space-2);
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: background-color var(--duration-fast) var(--ease-out-soft);
  }

  .action svg {
    width: 20px;
    height: 20px;
  }

  .action:hover {
    background: var(--surface-pressed);
    color: var(--text);
  }

  .action:active {
    background: var(--surface-pressed);
  }

  .action.pressed {
    background: var(--card-accent-tint);
    color: var(--card-accent-text);
  }

  .action.wide {
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    padding: 0 var(--space-3);
    width: auto;
  }

  @media (max-width: 480px) {
    .card-body {
      padding-left: var(--space-4);
    }

    .cover-box {
      width: 72px;
    }

    .action.wide span {
      display: none;
    }
  }
</style>
