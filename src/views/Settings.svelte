<script lang="ts">
  import {
    exportAppState,
    importAppState,
    resetAllState,
    settings,
  } from '$lib/stores/index.svelte';
  import {
    generateExportFilename,
    mapImportResultMessage,
    validateKindleEmail,
  } from './settings';

  // biome-ignore lint/correctness/noUnusedVariables: used in template
  let kindleError = $state<string | null>(null);
  // biome-ignore lint/correctness/noUnusedVariables: used in template
  let importError = $state<string | null>(null);
  // biome-ignore lint/correctness/noUnusedVariables: used in template
  let importSuccess = $state(false);
  // biome-ignore lint/correctness/noUnusedVariables: used in template
  let resetConfirm = $state(false);

  // biome-ignore lint/correctness/noUnusedVariables: called from template
  function onThemeChange(e: Event) {
    const target = e.target as HTMLInputElement;
    settings.set({ ...settings.value, theme: target.value as 'light' | 'dark' | 'system' });
    document.documentElement.setAttribute('data-theme', target.value);
  }

  // biome-ignore lint/correctness/noUnusedVariables: called from template
  function onKindleEmailChange(e: Event) {
    const target = e.target as HTMLInputElement;
    const email = target.value;
    const error = validateKindleEmail(email);
    kindleError = error;
    if (!error) {
      settings.set({ ...settings.value, kindleEmail: email || null });
    }
  }

  // biome-ignore lint/correctness/noUnusedVariables: called from template
  async function copyKindleAddress() {
    const address = settings.value.kindleEmail;
    if (!address) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(address);
      } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = address;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
    } catch {
      // Silently fail; user can manually copy
    }
  }

  // biome-ignore lint/correctness/noUnusedVariables: called from template
  function downloadExport() {
    const state = exportAppState();
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = generateExportFilename();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // biome-ignore lint/correctness/noUnusedVariables: called from template
  function onImportFile(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    importError = null;
    importSuccess = false;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = event.target?.result;
        const result = importAppState(json);
        if (result.ok) {
          importSuccess = true;
          importError = null;
          setTimeout(() => {
            importSuccess = false;
          }, 3000);
        } else {
          importError = mapImportResultMessage(result);
        }
      } catch (error) {
        importError = mapImportResultMessage({
          ok: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    };
    reader.onerror = () => {
      importError = 'Failed to read the file.';
    };
    reader.readAsText(file);
    target.value = ''; // Reset so re-importing the same file works
  }

  // biome-ignore lint/correctness/noUnusedVariables: called from template
  function onResetConfirm() {
    resetConfirm = false;
    resetAllState();
  }
</script>

<div class="settings-container">
  <h2>Settings</h2>

  <!-- Appearance -->
  <section class="settings-section">
    <h3>Appearance</h3>
    <fieldset class="theme-group">
      <legend>Theme</legend>
      <div class="radio-option">
        <input
          type="radio"
          id="theme-light"
          name="theme"
          value="light"
          checked={settings.value.theme === 'light'}
          onchange={onThemeChange}
        />
        <label for="theme-light">Light</label>
      </div>
      <div class="radio-option">
        <input
          type="radio"
          id="theme-dark"
          name="theme"
          value="dark"
          checked={settings.value.theme === 'dark'}
          onchange={onThemeChange}
        />
        <label for="theme-dark">Dark</label>
      </div>
      <div class="radio-option">
        <input
          type="radio"
          id="theme-system"
          name="theme"
          value="system"
          checked={settings.value.theme === 'system'}
          onchange={onThemeChange}
        />
        <label for="theme-system">System</label>
      </div>
    </fieldset>
  </section>

  <!-- Kindle Helper -->
  <section class="settings-section">
    <h3>Kindle</h3>
    <p class="section-description">
      Add your Kindle email address to see Send-to-Kindle buttons on works with ebook links.
    </p>
    <div class="input-group">
      <input
        type="email"
        id="kindle-email"
        placeholder="you@kindle.com"
        value={settings.value.kindleEmail || ''}
        onchange={onKindleEmailChange}
        class:has-error={kindleError}
      />
      {#if kindleError}
        <span class="error-hint">{kindleError}</span>
      {/if}
    </div>
    {#if settings.value.kindleEmail}
      <button class="copy-button" onclick={copyKindleAddress}>
        Copy Email
      </button>
    {/if}
    <div class="kindle-explanation">
      <p>To send an ebook to your Kindle:</p>
      <ol>
        <li>Download the EPUB file</li>
        <li>Open <a href="https://www.amazon.com/sendtokindle" target="_blank" rel="noopener">
          Send to Kindle
        </a> or email it to your address</li>
        <li>It will appear in your Kindle library</li>
      </ol>
    </div>
  </section>

  <!-- Data -->
  <section class="settings-section">
    <h3>Data</h3>

    <div class="subsection">
      <h4>Export</h4>
      <p>Download all your reading history, saved works, and settings as JSON.</p>
      <button class="export-button" onclick={downloadExport}>
        Download Export
      </button>
    </div>

    <div class="subsection">
      <h4>Import</h4>
      <p>Restore settings from a previously exported JSON file.</p>
      <div class="file-input-wrapper">
        <input
          type="file"
          id="import-file"
          accept=".json"
          onchange={onImportFile}
          aria-label="Import settings from JSON file"
        />
      </div>
      {#if importError}
        <span class="error-hint" role="alert">{importError}</span>
      {/if}
      {#if importSuccess}
        <span class="success-hint" role="status">Settings imported successfully.</span>
      {/if}
    </div>

    <div class="subsection">
      <h4>Reset All</h4>
      <p>Clear all reading history, saved works, and settings to start fresh.</p>
      {#if resetConfirm}
        <div class="confirm-group">
          <p class="confirm-text">Are you sure? This cannot be undone.</p>
          <button class="button-danger" onclick={onResetConfirm}>
            Yes, Reset Everything
          </button>
          <button class="button-secondary" onclick={() => (resetConfirm = false)}>
            Cancel
          </button>
        </div>
      {:else}
        <button class="button-secondary" onclick={() => (resetConfirm = true)}>
          Reset All Data
        </button>
      {/if}
    </div>
  </section>

  <!-- About -->
  <section class="settings-section">
    <h3>About</h3>
    <p>
      WellRead is a free, open-source reading app featuring curated works from:
    </p>
    <ul class="sources-list">
      <li><a href="https://standardebooks.org" target="_blank" rel="noopener">Standard Ebooks</a> — beautifully formatted public-domain works</li>
      <li><a href="https://www.gutenberg.org" target="_blank" rel="noopener">Project Gutenberg</a> — the original digital library</li>
      <li><a href="https://www.gitenberg.org" target="_blank" rel="noopener">GITenberg</a> — Gutenberg texts on GitHub</li>
      <li><a href="https://poetryfoundation.org" target="_blank" rel="noopener">Poetry Foundation</a> — contemporary and classic poems</li>
    </ul>
    <p>
      Typefaces: <a href="https://fonts.google.com/specimen/Fraunces" target="_blank" rel="noopener">Fraunces</a> (headlines),
      <a href="https://fonts.google.com/specimen/Newsreader" target="_blank" rel="noopener">Newsreader</a> (body),
      <a href="https://fonts.google.com/specimen/Inter" target="_blank" rel="noopener">Inter</a> (UI)
      — all open-source and self-hosted.
    </p>
    <p>
      <a href="https://github.com/tchute/well-read/issues/new/choose" target="_blank" rel="noopener">Report a correction or concern</a>
    </p>
  </section>
</div>

<style>
  .settings-container {
    max-width: 600px;
    margin: 0 auto;
    padding: var(--space-4);
  }

  h2 {
    font-size: var(--text-xl);
    margin-bottom: var(--space-5);
  }

  .settings-section {
    margin-bottom: var(--space-6);
    border-bottom: 1px solid var(--hairline);
    padding-bottom: var(--space-5);
  }

  .settings-section:last-child {
    border-bottom: none;
  }

  h3 {
    font-size: var(--text-lg);
    margin-bottom: var(--space-3);
  }

  h4 {
    font-size: var(--text-base);
    margin: var(--space-4) 0 var(--space-2) 0;
  }

  .section-description {
    color: var(--text-muted);
    font-size: var(--text-sm);
    margin-bottom: var(--space-3);
  }

  /* Theme radios */
  .theme-group {
    border: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .theme-group legend {
    font-weight: 600;
    font-size: var(--text-base);
    margin-bottom: var(--space-2);
  }

  .radio-option {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .radio-option input[type='radio'] {
    cursor: pointer;
    width: 20px;
    height: 20px;
  }

  .radio-option label {
    cursor: pointer;
    flex: 1;
    padding: var(--space-2) 0;
  }

  /* Email input */
  .input-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  input[type='email'] {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--hairline);
    border-radius: var(--radius-md);
    font-family: var(--font-ui);
    font-size: var(--text-base);
    background: var(--surface-raised);
    color: var(--text);
    transition: border-color var(--duration-base) var(--ease-out-soft);
  }

  input[type='email']:focus-visible {
    outline: 2px solid var(--accent-poem-text);
    outline-offset: 2px;
    border-color: var(--accent-poem-text);
  }

  input[type='email'].has-error {
    border-color: var(--vermilion-500);
  }

  .error-hint {
    color: var(--vermilion-text);
    font-size: var(--text-sm);
    display: block;
  }

  .success-hint {
    color: var(--teal-text);
    font-size: var(--text-sm);
    display: block;
  }

  /* Buttons */
  button {
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--hairline);
    border-radius: var(--radius-md);
    background: var(--surface-raised);
    color: var(--text);
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    cursor: pointer;
    transition: background-color var(--duration-base) var(--ease-out-soft),
                border-color var(--duration-base) var(--ease-out-soft);
  }

  button:hover {
    background: var(--surface-pressed);
  }

  button:focus-visible {
    outline: 2px solid var(--accent-poem-text);
    outline-offset: 2px;
  }

  .copy-button {
    margin-bottom: var(--space-3);
  }

  .button-secondary {
    background: var(--surface);
  }

  .button-danger {
    background: var(--vermilion-tint);
    border-color: var(--vermilion-text);
    color: var(--vermilion-text);
  }

  .button-danger:hover {
    background: var(--vermilion-500);
    color: white;
  }

  .export-button {
    margin-top: var(--space-2);
  }

  /* Kindle explanation */
  .kindle-explanation {
    font-size: var(--text-sm);
    color: var(--text-muted);
    margin: var(--space-3) 0 0 0;
  }

  .kindle-explanation p {
    margin: 0 0 var(--space-2) 0;
  }

  .kindle-explanation ol {
    margin: 0 0 0 var(--space-4);
    padding-left: var(--space-4);
  }

  .kindle-explanation li {
    margin-bottom: var(--space-1);
  }

  /* File input */
  .file-input-wrapper {
    margin: var(--space-3) 0;
  }

  input[type='file'] {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--hairline);
    border-radius: var(--radius-md);
    background: var(--surface-raised);
    color: var(--text);
    font-size: var(--text-sm);
    cursor: pointer;
  }

  input[type='file']:focus-visible {
    outline: 2px solid var(--accent-poem-text);
    outline-offset: 2px;
  }

  /* Data subsections */
  .subsection {
    margin-bottom: var(--space-4);
  }

  .subsection p {
    font-size: var(--text-sm);
    color: var(--text-muted);
    margin: 0 0 var(--space-2) 0;
  }

  .confirm-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-top: var(--space-3);
  }

  .confirm-text {
    color: var(--vermilion-text);
    font-weight: 500;
    margin: 0;
  }

  /* About section */
  .sources-list {
    list-style: none;
    padding: 0;
    margin: var(--space-3) 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .sources-list li {
    margin: 0;
  }

  .sources-list a {
    /* WP-5.2 audit: --accent-poem as link text measured ~3.2:1 against
     * paper (below the 4.5:1 AA-normal-text threshold) and, being
     * distinguished only by colour inside a run of text, also failed
     * axe's link-in-text-block check — the *-text variant plus a
     * permanent underline fixes both. */
    color: var(--accent-poem-text);
    text-decoration: underline;
  }

  .sources-list a:focus-visible {
    outline: 2px solid var(--accent-poem-text);
    outline-offset: 2px;
  }

  .settings-section a {
    color: var(--accent-poem-text);
    text-decoration: underline;
  }

  .settings-section a:focus-visible {
    outline: 2px solid var(--accent-poem-text);
    outline-offset: 2px;
  }

  p {
    margin: var(--space-2) 0;
    font-size: var(--text-base);
    line-height: var(--leading-base);
  }
</style>
