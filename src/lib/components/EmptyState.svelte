<script lang="ts">
  interface Props {
    /** Small headline, no exclamation marks. */
    title: string;
    /** One supporting line of quiet prose. */
    body: string;
    /** Optional action: link with href, or button with onclick. */
    action?: { label: string; href?: string; onclick?: () => void } | null;
  }

  // biome-ignore lint/correctness/noUnusedVariables: used in template
  let { title, body, action = null }: Props = $props();
</script>

<div class="empty-state">
  <!-- Inline SVG placeholder engraving-style ornament (sepia/hairline tokens).
       Future: replace with real public-domain natural-history engraving from
       Biodiversity Heritage Library (https://www.biodiversityheritagelibrary.org/)
       or Rijksmuseum (https://rijksmuseum.nl/) — CC0 only, no AI-generated art. -->
  <svg viewBox="0 0 80 80" class="ornament" aria-hidden="true">
    <!-- Decorative border frame in hairline weight -->
    <rect x="8" y="8" width="64" height="64" fill="none" stroke="currentColor" stroke-width="0.8" />
    <!-- Four corner flourishes -->
    <line x1="12" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="0.8" />
    <line x1="12" y1="12" x2="12" y2="20" stroke="currentColor" stroke-width="0.8" />
    <line x1="68" y1="12" x2="60" y2="12" stroke="currentColor" stroke-width="0.8" />
    <line x1="68" y1="12" x2="68" y2="20" stroke="currentColor" stroke-width="0.8" />
    <line x1="12" y1="68" x2="20" y2="68" stroke="currentColor" stroke-width="0.8" />
    <line x1="12" y1="68" x2="12" y2="60" stroke="currentColor" stroke-width="0.8" />
    <line x1="68" y1="68" x2="60" y2="68" stroke="currentColor" stroke-width="0.8" />
    <line x1="68" y1="68" x2="68" y2="60" stroke="currentColor" stroke-width="0.8" />
    <!-- Central dot -->
    <circle cx="40" cy="40" r="2" fill="currentColor" />
  </svg>

  <h2 class="title">{title}</h2>
  <p class="body">{body}</p>

  {#if action}
    {#if action.href}
      <a class="action" href={action.href}>{action.label}</a>
    {:else if action.onclick}
      <button type="button" class="action" onclick={action.onclick}>{action.label}</button>
    {/if}
  {/if}
</div>

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-7) var(--space-4);
    text-align: center;
  }

  .ornament {
    width: 80px;
    height: 80px;
    color: var(--hairline);
    opacity: 0.8;
  }

  .title {
    margin: 0;
    font-family: var(--font-serif);
    font-size: var(--text-xl);
    line-height: var(--leading-xl);
    color: var(--text);
  }

  .body {
    margin: 0;
    font-family: var(--font-body);
    font-size: var(--text-base);
    line-height: var(--leading-base);
    color: var(--text-muted);
    max-width: 50ch;
  }

  .action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--hairline);
    border-radius: var(--radius-md);
    background: var(--surface-raised);
    color: var(--text);
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-out-soft);
  }

  a.action {
    text-decoration: none;
  }

  button.action {
    border: 1px solid var(--hairline);
  }

  .action:hover {
    background: var(--surface-pressed);
    border-color: var(--text-muted);
  }

  .action:focus-visible {
    outline: 2px solid var(--accent-poem-text);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .action {
      transition: none;
    }
  }
</style>
