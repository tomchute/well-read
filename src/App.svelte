<script lang="ts">
  import { onMount } from 'svelte';
  import Onboarding from '$lib/components/Onboarding.svelte';
  import { shouldShowOnboarding } from '$lib/components/onboarding';
  import { route } from '$lib/router.svelte';
  import { decay, type ScoringState } from '$lib/scoring';
  import { read, reactions, seen, sessionPins, settings, weights } from '$lib/stores/index.svelte';
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
  });

  const current = $derived(route.current);

  function isActive(name: 'feed' | 'library' | 'settings'): boolean {
    return current.name === name;
  }
</script>

<div class="shell">
  <header class="header">
    <a class="app-name" href="#/">well-read</a>

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

  <main class="page">
    {#if shouldShowOnboarding(settings.value)}
      <Onboarding />
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
</div>

<style>
  .shell {
    max-width: var(--measure);
    margin: 0 auto;
  }

  .header {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-3) var(--space-5);
    padding: var(--space-4);
    border-bottom: 1px solid var(--hairline);
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
</style>
