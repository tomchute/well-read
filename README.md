# well-read

A free-to-run, single-user "Instagram for literature": a scrollable feed of well-respected poems, short stories, and books with steerable recommendations, guided master notes on every work, and epub links for Kindle. Static Svelte app on GitHub Pages; content is added in batches by a scheduled Claude Code Routine.

Status: Phases 0–5 complete on the feature branch (30 works, 11 awaiting text). Remaining: merge to main and configure the curation Routine (WP-4.4).

- Roadmap and work packages: [ROADMAP.md](ROADMAP.md)
- Conventions and doc index: [CLAUDE.md](CLAUDE.md)
- How work is delegated and how the content Routine runs: [docs/orchestration.md](docs/orchestration.md)
- Adding text by hand (for works the Routine couldn't fetch by script): see
  "Supplying text by hand" in [docs/editorial-policy.md](docs/editorial-policy.md).
- Corrections and takedowns: [GitHub issue templates](.github/ISSUE_TEMPLATE/) for flagging factual errors, broken links, metadata issues, or rights concerns. Removal is processed within one day per the [editorial policy](docs/editorial-policy.md#takedown-path).
