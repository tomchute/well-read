<script lang="ts">
  import { onMount } from 'svelte';

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
  });
</script>

<main class="page">
  <p class="specimen-number">No. 12</p>

  <h1 class="title">well-read</h1>

  <section class="poem" aria-label="Sample stanza (placeholder)">
    <p>
      The lantern swings above the door,
         its light a coin flipped twice —
      heads for morning, tails for more,
         and something small and wise.
    </p>
  </section>

  <p class="small-caps author">A Placeholder Author</p>

  <p class="prose">
    This paragraph exists only to prove that Newsreader is loading as the body
    typeface: generous line-height, a measured column width, and real text
    rendering rather than a system-font stand-in. Once the fonts finish
    loading there should be no visible reflow into a fallback face — Georgia
    stands in only for the instant before the self-hosted woff2 file paints.
  </p>

  <button type="button" class="theme-toggle" onclick={toggleTheme}>
    {theme === 'light' ? 'Switch to dark' : 'Switch to light'}
  </button>
</main>

<style>
  .page {
    max-width: var(--measure);
    margin: 0 auto;
    padding: var(--space-6) var(--space-4);
  }

  .title {
    font-size: var(--text-3xl);
    line-height: var(--leading-3xl);
    margin: var(--space-2) 0 var(--space-5);
  }

  .poem {
    margin: 0 0 var(--space-3);
    font-style: italic;
    font-size: var(--text-md);
    line-height: var(--leading-md);
  }

  .author {
    margin: 0 0 var(--space-6);
  }

  .prose {
    font-family: var(--font-body);
    font-size: var(--text-md);
    line-height: var(--leading-md);
    margin: 0 0 var(--space-6);
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
</style>
