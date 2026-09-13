<!--
  Master notes sheet (WP-2.4). Renders every `masterNotes` section (context,
  form, keyImages, whatToNotice, discussionQuestions, furtherReading — see
  docs/content-schema.md) as a sticky tab strip over sanitised Markdown.

  Layout per docs/design-system.md ("MasterNotes sheet"): a side sheet
  anchored right at viewport >= 900px, a bottom sheet full-width below that,
  both with a close button, Escape-to-close, a focus trap, and a backdrop.
-->
<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { renderMarkdown } from '$lib/markdown';
  import type { MasterNotes as MasterNotesData } from '$lib/types/work';

  interface Props {
    open: boolean;
    notes: MasterNotesData;
    onClose: () => void;
  }

  let { open, notes, onClose }: Props = $props();

  type SectionKey =
    | 'context'
    | 'form'
    | 'keyImages'
    | 'whatToNotice'
    | 'discussionQuestions'
    | 'furtherReading';

  const SECTIONS: { key: SectionKey; label: string; kind: 'text' | 'list' }[] = [
    { key: 'context', label: 'Context', kind: 'text' },
    { key: 'form', label: 'Form', kind: 'text' },
    { key: 'keyImages', label: 'Key images', kind: 'list' },
    { key: 'whatToNotice', label: 'What to notice', kind: 'list' },
    { key: 'discussionQuestions', label: 'Discussion questions', kind: 'list' },
    { key: 'furtherReading', label: 'Further reading', kind: 'list' },
  ];

  function textValue(key: SectionKey): string {
    const value = notes[key];
    return typeof value === 'string' ? value : '';
  }

  function listValue(key: SectionKey): string[] {
    const value = notes[key];
    return Array.isArray(value) ? value : [];
  }

  let activeTab = $state<SectionKey>('context');
  let panelEl = $state<HTMLElement | undefined>(undefined);
  let closeButtonEl = $state<HTMLButtonElement | undefined>(undefined);
  let reducedMotion = $state(false);
  let wideViewport = $state(true);

  const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

  function getFocusable(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  }

  // Opens/closes the sheet: resets to the first tab, captures viewport +
  // motion preference for the enter transition, moves focus into the sheet,
  // traps Tab/Shift+Tab within it, closes on Escape, and restores focus to
  // whatever triggered the sheet once it closes.
  $effect(() => {
    if (!open) return;

    activeTab = 'context';
    reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    wideViewport = typeof window !== 'undefined' && window.matchMedia('(min-width: 900px)').matches;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = requestAnimationFrame(() => closeButtonEl?.focus());

    function handleKeydown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelEl) return;
      const focusable = getFocusable(panelEl);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    window.addEventListener('keydown', handleKeydown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', handleKeydown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  });
</script>

{#if open}
  <button
    type="button"
    class="backdrop"
    tabindex="-1"
    aria-hidden="true"
    onclick={onClose}
    transition:fade={{ duration: reducedMotion ? 100 : 200 }}
  ></button>

  <div
    class="sheet"
    role="dialog"
    aria-modal="true"
    aria-labelledby="master-notes-heading"
    bind:this={panelEl}
    transition:fly={{
      x: reducedMotion ? 0 : wideViewport ? 480 : 0,
      y: reducedMotion ? 0 : wideViewport ? 0 : 400,
      duration: reducedMotion ? 100 : 250,
    }}
  >
    <div class="sheet-handle" aria-hidden="true"></div>

    <header class="sheet-header">
      <h2 id="master-notes-heading" class="sheet-title">Master notes</h2>
      <button
        type="button"
        class="close-button"
        bind:this={closeButtonEl}
        onclick={onClose}
        aria-label="Close master notes"
      >
        &times;
      </button>
    </header>

    <div class="tab-strip" role="tablist" aria-label="Master notes sections">
      {#each SECTIONS as section (section.key)}
        <button
          type="button"
          role="tab"
          id={`notes-tab-${section.key}`}
          aria-selected={activeTab === section.key}
          aria-controls={`notes-panel-${section.key}`}
          class="tab"
          class:active={activeTab === section.key}
          onclick={() => (activeTab = section.key)}
        >
          {section.label}
        </button>
      {/each}
    </div>

    <div class="sheet-body">
      {#each SECTIONS as section (section.key)}
        {#if activeTab === section.key}
          <div
            id={`notes-panel-${section.key}`}
            role="tabpanel"
            aria-labelledby={`notes-tab-${section.key}`}
            class="panel"
          >
            {#if section.kind === 'text'}
              <div class="notes-body">{@html renderMarkdown(textValue(section.key))}</div>
            {:else}
              <ul class="notes-list">
                {#each listValue(section.key) as item, i (i)}
                  <li class="notes-body">{@html renderMarkdown(item)}</li>
                {/each}
              </ul>
            {/if}
          </div>
        {/if}
      {/each}
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(31, 27, 22, 0.4);
    border: none;
    padding: 0;
    margin: 0;
    cursor: default;
    z-index: 40;
  }

  .sheet {
    position: fixed;
    z-index: 41;
    display: flex;
    flex-direction: column;
    background: var(--surface-raised);
    box-shadow: var(--shadow-lg);
    /* Side sheet (>= 900px): anchored right, full height. */
    top: 0;
    right: 0;
    bottom: 0;
    width: min(480px, 40vw);
    border-radius: var(--radius-lg) 0 0 var(--radius-lg);
  }

  .sheet-handle {
    display: none;
  }

  @media (max-width: 899px) {
    .sheet {
      /* Bottom sheet: full width, anchored to the bottom, capped height. */
      top: auto;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      max-height: 85vh;
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    }

    .sheet-handle {
      display: block;
      width: 40px;
      height: 4px;
      margin: var(--space-2) auto 0;
      border-radius: var(--radius-sm);
      background: var(--hairline);
      flex: none;
    }
  }

  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-4) var(--space-2);
    flex: none;
  }

  .sheet-title {
    font-size: var(--text-xl);
    line-height: var(--leading-xl);
  }

  .close-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    min-width: 44px;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: var(--text);
    font-size: var(--text-xl);
    line-height: 1;
    cursor: pointer;
    transition: background-color var(--duration-fast) var(--ease-out-soft);
  }

  .close-button:hover {
    background: var(--surface-pressed);
  }

  .tab-strip {
    position: sticky;
    top: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-4);
    padding: 0 var(--space-4);
    border-bottom: 1px solid var(--hairline);
    background: var(--surface-raised);
    flex: none;
    z-index: 1;
  }

  .tab {
    appearance: none;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    padding: var(--space-2) 0;
    font-family: var(--font-serif);
    font-size: var(--text-base);
    color: var(--text-muted);
    cursor: pointer;
    min-height: 44px;
  }

  .tab:hover {
    color: var(--text);
  }

  .tab.active {
    color: var(--text);
    border-bottom-color: var(--accent-poem-text);
  }

  .sheet-body {
    overflow-y: auto;
    padding: var(--space-4);
  }

  .notes-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .notes-list .notes-body {
    padding-left: var(--space-4);
    border-left: 2px solid var(--hairline);
  }

  .notes-body {
    font-family: var(--font-body);
    font-size: var(--text-md);
    line-height: var(--leading-md);
  }

  .notes-body :global(p) {
    margin: 0 0 var(--space-3);
  }

  .notes-body :global(p:last-child) {
    margin-bottom: 0;
  }

  .notes-body :global(blockquote) {
    margin: 0 0 var(--space-3);
    padding-left: var(--space-3);
    border-left: 2px solid var(--hairline);
    color: var(--text-muted);
    font-style: italic;
  }

  .notes-body :global(a) {
    color: var(--accent-poem-text);
  }

  @media (prefers-reduced-motion: reduce) {
    .sheet {
      transition: none;
    }
  }
</style>
