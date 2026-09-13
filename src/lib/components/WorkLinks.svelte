<script lang="ts">
  import type { Work } from '$lib/types/work';
  import { type GroupedLinks, groupLinks } from './workLinks';

  interface Props {
    work: Pick<Work, 'textPolicy' | 'source' | 'ebookLinks' | 'externalLinks' | 'type'> & {
      excerptNote?: string;
    };
  }

  let { work }: Props = $props();

  // biome-ignore lint/correctness/noUnusedVariables: used in template
  const grouped: GroupedLinks = $derived(groupLinks(work));

  // biome-ignore lint/correctness/noUnusedVariables: used in template
  function getProviderLabel(provider: string, format: string): string {
    const formatUpper = format.toUpperCase();
    const providerMap: Record<string, string> = {
      'standard-ebooks': 'Standard Ebooks',
      gutenberg: 'Project Gutenberg',
      'open-library': 'Open Library',
    };
    const providerName = providerMap[provider] || provider;
    return `${formatUpper} · ${providerName}`;
  }

  // biome-ignore lint/correctness/noUnusedVariables: used in template
  function getExternalLinkLabel(kind: string, customLabel?: string): string {
    if (customLabel) return customLabel;

    const labelMap: Record<string, string> = {
      publisher: 'Publisher',
      bookstore: 'Bookshop',
      library: 'Library / WorldCat',
      'poetry-foundation': 'Poetry Foundation',
      'author-site': 'Author Site',
      other: 'Read More',
    };

    return labelMap[kind] || 'Read More';
  }

  // biome-ignore lint/correctness/noUnusedVariables: used in template
  function groupNameFromKind(kind: string): string {
    const groupMap: Record<string, string> = {
      publisher: 'Publisher',
      bookstore: 'Bookshop',
      library: 'Library',
      'poetry-foundation': 'Poetry Foundation',
      'author-site': 'Author',
      other: 'Other',
    };
    return groupMap[kind] || kind;
  }
</script>

{#if grouped.ebookLinks && grouped.ebookLinks.length > 0}
  <!-- Full text, public domain: ebook download buttons -->
  <div class="links-block">
    <div class="ebook-links">
      <p class="links-label">Download</p>
      <div class="link-group">
        {#each grouped.ebookLinks as link}
          <a href={link.url} class="link-badge" target="_blank" rel="noopener noreferrer">
            {getProviderLabel(link.provider, link.format)}
          </a>
        {/each}
        {#if grouped.hasEpub}
          <a
            href="https://www.amazon.com/sendtokindle"
            class="link-badge kindle-helper"
            target="_blank"
            rel="noopener noreferrer"
            title="Send EPUB file to Kindle device or app"
          >
            Send to Kindle
          </a>
        {/if}
      </div>
    </div>
  </div>
{:else if work.textPolicy === 'excerpt'}
  <!-- Excerpt: boundary note + external links grouped by kind -->
  <div class="links-block">
    {#if work.excerptNote}
      <p class="excerpt-note">{work.excerptNote}</p>
    {/if}
    {#if grouped.externalLinksByKind && Object.keys(grouped.externalLinksByKind).length > 0}
      <p class="read-more-label">Read the rest</p>
      <div class="external-links-groups">
        {#each Object.entries(grouped.externalLinksByKind) as [kind, links]}
          <div class="link-kind-group">
            <span class="link-kind-name">{groupNameFromKind(kind)}</span>
            <div class="link-group">
              {#each links as link}
                <a href={link.url} class="link-badge external" target="_blank" rel="noopener noreferrer">
                  {getExternalLinkLabel(kind, link.label)}
                </a>
              {/each}
            </div>
          </div>
        {/each}
        {#if grouped.hasEpub}
          <div class="link-kind-group kindle-group">
            <a
              href="https://www.amazon.com/sendtokindle"
              class="link-badge kindle-helper"
              target="_blank"
              rel="noopener noreferrer"
              title="Send EPUB file to Kindle device or app"
            >
              Send to Kindle
            </a>
          </div>
        {/if}
      </div>
    {/if}
  </div>
{:else if work.textPolicy === 'pending'}
  <!-- Pending: "Text not yet added" notice + external links -->
  <div class="links-block">
    <p class="pending-notice">Text not yet added</p>
    {#if grouped.externalLinksByKind && Object.keys(grouped.externalLinksByKind).length > 0}
      <div class="external-links-groups">
        {#each Object.entries(grouped.externalLinksByKind) as [kind, links]}
          <div class="link-kind-group">
            <span class="link-kind-name">{groupNameFromKind(kind)}</span>
            <div class="link-group">
              {#each links as link}
                <a href={link.url} class="link-badge external" target="_blank" rel="noopener noreferrer">
                  {getExternalLinkLabel(kind, link.label)}
                </a>
              {/each}
            </div>
          </div>
        {/each}
        {#if grouped.hasEpub}
          <div class="link-kind-group kindle-group">
            <a
              href="https://www.amazon.com/sendtokindle"
              class="link-badge kindle-helper"
              target="_blank"
              rel="noopener noreferrer"
              title="Send EPUB file to Kindle device or app"
            >
              Send to Kindle
            </a>
          </div>
        {/if}
      </div>
    {/if}
  </div>
{:else if grouped.externalLinksByKind && Object.keys(grouped.externalLinksByKind).length > 0}
  <!-- Full text, contemporary: external links only -->
  <div class="links-block">
    <div class="external-links-groups">
      {#each Object.entries(grouped.externalLinksByKind) as [kind, links]}
        <div class="link-kind-group">
          <span class="link-kind-name">{groupNameFromKind(kind)}</span>
          <div class="link-group">
            {#each links as link}
              <a href={link.url} class="link-badge external" target="_blank" rel="noopener noreferrer">
                {getExternalLinkLabel(kind, link.label)}
              </a>
            {/each}
          </div>
        </div>
      {/each}
      {#if grouped.hasEpub}
        <div class="link-kind-group kindle-group">
          <a
            href="https://www.amazon.com/sendtokindle"
            class="link-badge kindle-helper"
            target="_blank"
            rel="noopener noreferrer"
            title="Send EPUB file to Kindle device or app"
          >
            Send to Kindle
          </a>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .links-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .links-label,
  .read-more-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0;
  }

  .excerpt-note {
    font-size: 0.875rem;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.5;
  }

  .pending-notice {
    font-size: 0.875rem;
    color: var(--text-muted);
    margin: 0;
    font-style: italic;
  }

  .link-group {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .link-badge {
    display: inline-block;
    padding: var(--space-2) var(--space-3);
    background-color: var(--accent-poem-tint);
    color: var(--accent-poem-text);
    text-decoration: none;
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    border: 1px solid transparent;
    transition: all var(--duration-fast) var(--ease-out-soft);
  }

  .link-badge:hover {
    border-color: var(--accent-poem-text);
    background-color: transparent;
  }

  .link-badge:focus-visible {
    outline: 2px solid var(--accent-poem-text);
    outline-offset: 2px;
  }

  .link-badge.external {
    background-color: var(--accent-story-tint);
    color: var(--accent-story-text);
  }

  .link-badge.external:hover {
    border-color: var(--accent-story-text);
  }

  .link-badge.external:focus-visible {
    outline-color: var(--accent-story-text);
  }

  .link-badge.kindle-helper {
    background-color: var(--accent-saved-tint);
    color: var(--accent-saved-text);
  }

  .link-badge.kindle-helper:hover {
    border-color: var(--accent-saved-text);
  }

  .link-badge.kindle-helper:focus-visible {
    outline-color: var(--accent-saved-text);
  }

  .external-links-groups {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .link-kind-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .link-kind-name {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  .kindle-group {
    margin-top: var(--space-2);
  }
</style>
