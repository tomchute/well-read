<!--
  Typographic proof-of-concept from WP-2.1, kept out of the shipped shell
  (App.svelte) per WP-2.2 but preserved here at `#/styleguide` rather than
  deleted outright.
-->
<p class="specimen-number">No. 12</p>

<h2 class="title">WellRead</h2>

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
  rendering rather than a system-font stand-in. Once the fonts finish loading
  there should be no visible reflow into a fallback face — Georgia stands in
  only for the instant before the self-hosted woff2 file paints.
</p>

<style>
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
</style>
