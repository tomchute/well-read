<script lang="ts">
  import { onMount } from 'svelte';
  import Onboarding from '$lib/components/Onboarding.svelte';
  import { shouldShowOnboarding } from '$lib/components/onboarding';
  import { route } from '$lib/router.svelte';
  import { decay, type ScoringState } from '$lib/scoring';
  import { attachShortcuts, resolveShortcut } from '$lib/shortcuts';
  import { reactions, read, seen, sessionPins, settings, weights } from '$lib/stores/index.svelte';
  import Feed from './views/Feed.svelte';
  import Library from './views/Library.svelte';
  import Settings from './views/Settings.svelte';
  import Styleguide from './views/Styleguide.svelte';
  import Work from './views/Work.svelte';

  /** sessionStorage flag so the once-per-session weight decay never runs twice in one tab session. */
  const SESSION_DECAY_FLAG = 'wellread:v1:session-decayed';

  /**
   * Runs the session-start weight decay (docs/recommendation-design.md,
   * "Normalisation") exactly once per browser session, guarded by a
   * `sessionStorage` flag. Wrapped end-to-end in try/catch: a blocked or
   * absent `sessionStorage` (private browsing, SSR) must not crash the app —
   * it just means decay is skipped for that session rather than guaranteed
   * once.
   */
  function decayOncePerSession(): void {
    try {
      if (sessionStorage.getItem(SESSION_DECAY_FLAG)) return;
      sessionStorage.setItem(SESSION_DECAY_FLAG, '1');
      const state: ScoringState = {
        weights: weights.value,
        seen: seen.value,
        reactions: reactions.value,
        sessionPins: sessionPins.value,
        read: read.value,
      };
      const next = decay(state);
      weights.set(next.weights);
    } catch {
      // sessionStorage unavailable or blocked — skip; decay is a gradual
      // fade, not a correctness requirement, so missing a session is fine.
    }
  }

  type Theme = 'light' | 'dark';
  const STORAGE_KEY = 'well-read-theme';

  let theme = $state<Theme>('light');

  // Shortcuts overlay (WP-2.6, docs/design-system.md §7: "listed in an
  // in-app `?` help overlay"). Opened globally by `?`; Escape closes it
  // with top priority over anything else Escape would otherwise do (Work's
  // "close notes / back to feed") via a capture-phase listener below, since
  // a capture-phase listener on `window` always runs before any
  // bubble-phase one, regardless of which component attached first.
  let shortcutsOpen = $state(false);
  let shortcutsCloseEl = $state<HTMLButtonElement | undefined>(undefined);
  let shortcutsPanelEl = $state<HTMLDivElement | undefined>(undefined);
  let mainEl = $state<HTMLElement | undefined>(undefined);

  // When the onboarding quiz finishes (Skip or Start reading), its Skip/Start
  // button is removed from the DOM as Feed takes its place — left alone, the
  // browser drops keyboard focus to <body>, so the very next Tab press lands
  // wherever the browser's internal focus cursor happens to sit rather than
  // at the top of the new view (WP-5.2: predictable focus order). Moving
  // focus onto `<main>` (already a valid focus target via the `tabindex="-1"`
  // set below for the skip link) gives the reader a sane, predictable place
  // to resume keyboard navigation instead.
  function focusMainAfterOnboarding(): void {
    mainEl?.focus();
  }

  const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

  // Focus trap + restore for the shortcuts overlay (WP-5.2, docs/design-system.md
  // §7: dialogs get a focus trap and restore focus to whatever opened them).
  // Mirrors MasterNotes.svelte's dialog handling: move focus into the panel
  // on open, trap Tab/Shift+Tab within it, and restore the previously
  // focused element on close.
  $effect(() => {
    if (!shortcutsOpen) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = requestAnimationFrame(() => shortcutsCloseEl?.focus());

    function handleKeydown(event: KeyboardEvent): void {
      if (event.key !== 'Tab' || !shortcutsPanelEl) return;
      const focusable = Array.from(
        shortcutsPanelEl.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      );
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

    return () => {
      cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', handleKeydown);
      previouslyFocused?.focus();
    };
  });

  function readStoredTheme(): Theme | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === 'light' || stored === 'dark' ? stored : null;
    } catch {
      return null;
    }
  }

  function persistTheme(next: Theme) {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* localStorage unavailable (private browsing, blocked storage) — ignore */
    }
  }

  function toggleTheme() {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    theme = next;
    document.documentElement.setAttribute('data-theme', next);
    persistTheme(next);
  }

  onMount(() => {
    const stored = readStoredTheme();
    if (stored) {
      theme = stored;
      document.documentElement.setAttribute('data-theme', stored);
    } else {
      theme = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    decayOncePerSession();

    const detachHelp = attachShortcuts({
      help: () => {
        shortcutsOpen = !shortcutsOpen;
      },
    });

    function closeOverlayFirst(event: KeyboardEvent): void {
      const action = resolveShortcut({
        key: event.key,
        target: event.target,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
      });
      if (action !== 'close' || !shortcutsOpen) return;
      event.preventDefault();
      event.stopPropagation();
      shortcutsOpen = false;
    }
    window.addEventListener('keydown', closeOverlayFirst, true);

    return () => {
      detachHelp();
      window.removeEventListener('keydown', closeOverlayFirst, true);
    };
  });

  const current = $derived(route.current);

  function isActive(name: 'feed' | 'library' | 'settings'): boolean {
    return current.name === name;
  }
</script>

<a class="skip-link" href="#main-content">Skip to content</a>

<div class="shell" class:fill={current.name === 'feed'}>
  <header class="header">
    <h1 class="app-name-heading"><a class="app-name" href="#/">WellRead</a></h1>

    <nav class="nav" aria-label="Primary">
      <a href="#/" class:active={isActive('feed')} aria-current={isActive('feed') ? 'page' : undefined}>
        Feed
      </a>
      <a
        href="#/library"
        class:active={isActive('library')}
        aria-current={isActive('library') ? 'page' : undefined}
      >
        Library
      </a>
      <a
        href="#/settings"
        class:active={isActive('settings')}
        aria-current={isActive('settings') ? 'page' : undefined}
      >
        Settings
      </a>
    </nav>

    <button type="button" class="theme-toggle" onclick={toggleTheme}>
      {theme === 'light' ? 'Switch to dark' : 'Switch to light'}
    </button>
  </header>

  <main class="page" class:fill={current.name === 'feed'} id="main-content" tabindex="-1" bind:this={mainEl}>
    {#if shouldShowOnboarding(settings.value)}
      <Onboarding onDone={focusMainAfterOnboarding} />
    {:else if current.name === 'feed'}
      <Feed />
    {:else if current.name === 'work'}
      <Work id={current.id} />
    {:else if current.name === 'library'}
      <Library />
    {:else if current.name === 'settings'}
      <Settings />
    {:else if current.name === 'styleguide'}
      <Styleguide />
    {:else}
      <h2>Not found</h2>
      <p>Nothing lives at <code>{current.hash}</code>.</p>
    {/if}
  </main>

  {#if shortcutsOpen}
    <button
      type="button"
      class="shortcuts-backdrop"
      tabindex="-1"
      aria-hidden="true"
      onclick={() => (shortcutsOpen = false)}
    ></button>
    <div
      class="shortcuts-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-heading"
      bind:this={shortcutsPanelEl}
    >
      <header class="shortcuts-header">
        <h2 id="shortcuts-heading" class="shortcuts-title">Keyboard shortcuts</h2>
        <button
          type="button"
          class="shortcuts-close"
          bind:this={shortcutsCloseEl}
          onclick={() => (shortcutsOpen = false)}
          aria-label="Close keyboard shortcuts"
        >
          &times;
        </button>
      </header>
      <dl class="shortcuts-list">
        <div class="shortcuts-row"><dt><kbd>j</kbd></dt><dd>Next card</dd></div>
        <div class="shortcuts-row"><dt><kbd>k</kbd></dt><dd>Previous card</dd></div>
        <div class="shortcuts-row"><dt><kbd>Enter</kbd></dt><dd>Open the focused card</dd></div>
        <div class="shortcuts-row"><dt><kbd>s</kbd></dt><dd>Save / unsave</dd></div>
        <div class="shortcuts-row"><dt><kbd>m</kbd></dt><dd>More like this</dd></div>
        <div class="shortcuts-row"><dt><kbd>Esc</kbd></dt><dd>Close notes, or go back</dd></div>
        <div class="shortcuts-row"><dt><kbd>?</kbd></dt><dd>Toggle this overlay</dd></div>
      </dl>
    </div>
  {/if}
</div>

<style>
  .skip-link {
    position: absolute;
    top: -100px;
    left: var(--space-4);
    z-index: 100;
    padding: var(--space-3) var(--space-4);
    background: var(--surface-raised);
    color: var(--text);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    text-decoration: none;
    transition: top var(--duration-fast) var(--ease-out-soft);
  }

  .skip-link:focus-visible,
  .skip-link:focus {
    top: var(--space-3);
    outline: 2px solid var(--accent-poem-text);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .skip-link {
      transition: none;
    }
  }

  .shell {
    max-width: var(--measure);
    margin: 0 auto;
  }

  /* Feed route only: a viewport-tall column so Feed.svelte's virtualised
   * list can fill the space below the header whatever the steering guide's
   * open/closed state (see `.feed` in Feed.svelte). Other views keep the
   * plain document flow and window scrolling. */
  .shell.fill {
    display: flex;
    flex-direction: column;
    height: 100dvh;
  }

  .page.fill {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .header {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-3) var(--space-5);
    padding: var(--space-4);
    border-bottom: 1px solid var(--hairline);
  }

  .app-name-heading {
    margin: 0;
    line-height: 1;
  }

  .app-name {
    font-family: var(--font-serif);
    font-optical-sizing: auto;
    font-weight: 600;
    font-size: var(--text-xl);
    color: var(--text);
    text-decoration: none;
  }

  .nav {
    display: flex;
    gap: var(--space-4);
    margin-right: auto;
    font-family: var(--font-ui);
    font-size: var(--text-sm);
  }

  .nav a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--text-muted);
    text-decoration: none;
    padding: var(--space-1) 0;
    border-bottom: 2px solid transparent;
  }

  .nav a:hover {
    color: var(--text);
  }

  .nav a.active {
    color: var(--text);
    border-bottom-color: var(--accent-poem-text);
  }

  .theme-toggle {
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    min-height: 44px;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-md);
    border: 1px solid var(--hairline);
    background: var(--surface-raised);
    color: var(--text);
    cursor: pointer;
    transition: background-color var(--duration-fast) var(--ease-out-soft);
  }

  .theme-toggle:hover {
    background: var(--surface-pressed);
  }

  .page {
    padding: var(--space-6) var(--space-4);
  }

  .shortcuts-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(31, 27, 22, 0.4);
    border: none;
    padding: 0;
    margin: 0;
    cursor: default;
    z-index: 50;
  }

  .shortcuts-overlay {
    position: fixed;
    z-index: 51;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(360px, calc(100vw - var(--space-6)));
    max-height: 80vh;
    overflow-y: auto;
    background: var(--surface-raised);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    padding: var(--space-5);
  }

  .shortcuts-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }

  .shortcuts-title {
    font-size: var(--text-xl);
    line-height: var(--leading-xl);
  }

  .shortcuts-close {
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

  .shortcuts-close:hover {
    background: var(--surface-pressed);
  }

  .shortcuts-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin: 0;
  }

  .shortcuts-row {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .shortcuts-row dt {
    flex: 0 0 auto;
    min-width: 56px;
  }

  .shortcuts-row dd {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--text-sm);
  }

  .shortcuts-row kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    border: 1px solid var(--hairline);
    background: var(--surface);
    font-family: var(--font-ui);
    font-size: var(--text-xs);
    color: var(--text);
  }
</style>
