# Open-source reuse

Rule: **consume, don't reinvent.** Prefer an existing library over hand-rolling; prefer consuming a public data source live (or via a thin fetch script) over vendoring its data wholesale. Record any new dependency in this file when you add it.

## Libraries and services

| Need | Use | Why | We still write | Install |
|---|---|---|---|---|
| Schema validation | `zod` | one schema shared by build scripts and app (`z.infer` gives the TS types for free), good error messages for the Routine to self-correct on | the schema shape + editorial gates | `npm install zod` |
| Feed virtualization | `@tanstack/svelte-virtual` | scrolling hundreds of cards without layout jank or hand-rolled windowing math | card components | `npm install @tanstack/svelte-virtual` |
| Master notes rendering | `marked` | small, fast Markdown → HTML for notes authored as Markdown strings | none | `npm install marked` |
| Sanitizing rendered notes | `dompurify` | notes are unattended-Routine-authored; sanitize before injecting HTML | none | `npm install dompurify` |
| Client-side search/filter | `minisearch` | small (no deps), fast full-text search over the manifest index in-browser | none | `npm install minisearch` |
| Design tokens | `open-props` | consistent spacing/color/motion scale to build our palette on top of, instead of inventing a token system | the palette + component styles | `npm install open-props` |
| PWA (Phase 5) | `vite-plugin-pwa` | offline shell + manifest without hand-writing a service worker | none | `npm install -D vite-plugin-pwa` |
| Tests | `vitest` | fast, Vite-native test runner for scoring logic and components | tests | `npm install -D vitest` |
| Lint/format | `@biomejs/biome` | one tool for both lint and format, fast, minimal config | config | `npm install -D @biomejs/biome` |
| Routing (optional) | `svelte-spa-router` | if hash routing outgrows ~40 hand-rolled lines; hash routing is preferred by default for Pages simplicity | none, or the ~40-line hash router | `npm install svelte-spa-router` |
| localStorage stores | hand-rolled `persisted` helper (~30 lines) over Svelte 5 runes | small enough not to need a dependency; `svelte-persisted-store` is the fallback if it grows | the store shapes | `npm install svelte-persisted-store` (fallback only) |
| Deploy | `actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages` | official GitHub Actions for Pages, no third-party deploy action needed | workflow YAML | (GitHub Actions, no npm install) |
| Epub preview | deferred; `epub.js` if ever needed | not required for MVP — links out instead of in-app reading | — | — |

Ideas to borrow (not code): Standard Ebooks' catalog design, Poetry Foundation's "Poem of the Day" pacing, Project Gutenberg browser projects.

## Data sources

Consumed live or via thin fetch scripts in `scripts/fetch-*.mjs` — never mirrored wholesale into the repo. Only the curated, per-work fields we choose go into `content/works/*.json`.

| Source | Base URL | Use |
|---|---|---|
| Gutendex | `https://gutendex.com/books` | Project Gutenberg catalog search/metadata |
| Standard Ebooks OPDS feed | `https://standardebooks.org/feeds/opds` | curated public-domain epubs, cleaner formatting than raw Gutenberg |
| PoetryDB | `https://poetrydb.org` | public-domain poem text and metadata lookup |
| Open Library | `https://openlibrary.org/developers/api` | book metadata and covers |

Illustration sources (card art, empty states — all public domain / CC0, never AI-generated or stock photo):

- Biodiversity Heritage Library
- Rijksmuseum
- Smithsonian Open Access

## Adding a new dependency

Before adding anything not listed here: check it isn't already covered by a library above, confirm it has no server-side/paid requirement (this app has no backend and no budget), then add a row to this table in the same PR/commit that introduces it.
