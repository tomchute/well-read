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
  import { accentFor, typeGlyphFor } from './workAccent';

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
    /** Called when the card is opened (its link clicked or activated) — before the browser follows `href`. */
    onOpen?: (entry: ManifestEntry) => void;
    /** Whether this card plays its entry fade/rise on mount (WP-2.6: first paint only, never on virtualiser recycling). */
    animateEntry?: boolean;
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
    onOpen = noop,
    animateEntry = false,
  }: Props = $props();

  // Snapshot at creation time only: whether `animateEntry` was true the
  // instant this card instance was created decides whether it ever plays
  // the entry animation. A later flip of the prop (Feed.svelte's
  // `hasPainted` turning true once first paint has happened) must not
  // retroactively add or remove the animation from a card already mounted.
  // svelte-ignore state_referenced_locally -- intentional: freezes the
  // prop's value at creation time (see comment above).
  const playEntryAnimation = animateEntry;

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

  const accent = $derived(accentFor(entry.type));
  const glyph = $derived(typeGlyphFor(entry.type));
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
  function handleOpen() {
    // Never preventDefault here — the anchor's own `href` navigation (and
    // the router's view-transition wrapping of it) still needs to happen;
    // this only lets Feed.svelte record which card was opened so it can
    // restore focus to it on the way back (WP-2.6).
    onOpen(entry);
  }
</script>

<article
  class="work-card"
  class:entry-animate={playEntryAnimation}
  style="--card-accent: {accent.bar}; --card-accent-tint: {accent.tint}; --card-accent-text: {accent.text};"
>
  <a
    class="card-link"
    href={workHref}
    aria-label={`${entry.title} by ${entry.author} (${formatType(entry.type)})`}
    onclick={handleOpen}
  ></a>

  <div class="card-body">
    <p class="specimen-number">No. {index}</p>

    <div class="cover-box" aria-hidden="true">
      <!-- Type glyph standing in for card cover art (the badge row carries
           the same type as text, so this stays decorative). When a real
           image is added, use: <img loading="lazy" decoding="async" src="..." alt="" />
           The fixed aspect ratio (4/3) is already set to prevent layout shift. -->
      <svg viewBox="0 0 24 24" class="cover-glyph" focusable="false">
        <path
          d={glyph}
          fill="none"
          stroke="currentColor"
          stroke-width="1.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </div>

    <div class="card-main">
      <h3 class="title" style="view-transition-name: work-title-{entry.id}">{entry.title}</h3>
      <p class="author small-caps">{entry.author}</p>

      <div class="badges">
        <span class="badge badge-type">{formatType(entry.type)}</span>
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

  /* Entry fade/rise (WP-2.6): played only for cards Feed.svelte renders on
   * first paint — never replayed for cards the virtualiser destroys and
   * recreates while scrolling. `both` keeps the card at its resting state
   * before and after the animation runs. */
  .work-card.entry-animate {
    animation: card-entry var(--duration-slow) var(--ease-out-soft) both;
  }

  @keyframes card-entry {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Reduced motion: crossfade only, no movement (docs/design-system.md §5) —
   * `--duration-slow` is already capped to 100ms at the token level. */
  @media (prefers-reduced-motion: reduce) {
    .work-card.entry-animate {
      animation-name: card-entry-fade;
    }
  }

  @keyframes card-entry-fade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
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
    /* border-box + min-width 0: as a flex item of `.work-card` this must
     * never grow past the card (its padding used to be added on top of
     * `width: 100%`, and a long no-wrap badge could hold it there). */
    box-sizing: border-box;
    min-width: 0;
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
    width: 48%;
    height: 48%;
    opacity: 0.8;
  }

  .card-main {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    padding-top: var(--space-4);
  }

  /* The card is a fixed height (Feed.svelte's CARD_HEIGHT) and `.card-main` is
   * a flex column, so any content overrun is absorbed by shrinking its
   * children — which silently squashed the title to a clipped half-line
   * whenever it wrapped to two lines, a badge row wrapped, or a long
   * translator credit pushed the block down. These four carry the card's
   * identity and so hold their natural height; `.teaser` below is the one
   * expendable block and absorbs the overrun instead. */
  .title,
  .author,
  .badges,
  .actions {
    flex-shrink: 0;
  }

  .title {
    font-family: var(--font-serif);
    font-optical-sizing: auto;
    font-weight: 600;
    font-size: var(--text-lg);
    line-height: var(--leading-lg);
    margin: 0 0 var(--space-1);
    color: var(--text);
    /* Bounded at every width, not just narrow ones — an unbounded title is
     * what makes a fixed-height card's content unpredictable. The full title
     * stays in the card link's aria-label. */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .author {
    margin: 0 0 var(--space-3);
    color: var(--text-muted);
    /* Translator credits ("… (translated by X and Y)") ran to three lines at
     * phone widths, which is what squashed the title above them. */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
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
    /* A long free-text form ("novel, translated from Russian") truncates
     * inside the card rather than forcing the whole card body wider than
     * the card and clipping the teaser on narrow screens. */
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* The type badge is the legend for the card's accent: same tint, but
   * bolder and outlined in the accent so it reads as the lead badge. */
  .badge-type {
    font-weight: 700;
    box-shadow: inset 0 0 0 1px var(--card-accent);
  }

  /* The single flexible block: it gives up lines so that a two-line title or a
   * wrapped badge row costs preview text rather than clipping the title. It
   * only ever shrinks (never grows past its content), with a two-line floor so
   * a heavily constrained card still previews something.
   *
   * This no longer reserves a fixed block of lines. That reservation existed to
   * stop the card resizing when its shard landed, but the card's fixed height
   * and `.actions { margin-top: auto }` already pin the layout: the teaser can
   * change height without moving anything around it. */
  .teaser {
    flex: 0 1 auto;
    min-height: calc(var(--leading-md) * var(--text-md) * 2);
    overflow: hidden;
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

    /* At ~220px of text width the badge row wraps to two or three rows, so the
     * preview gives up a line to keep the card's content inside CARD_HEIGHT.
     * (The two-line title clamp this block used to carry now applies at every
     * width, alongside the author clamp.) */
    .teaser-text {
      -webkit-line-clamp: 3;
    }

    .action.wide span {
      display: none;
    }
  }
</style>
