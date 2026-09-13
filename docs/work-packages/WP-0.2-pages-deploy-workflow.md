# WP-0.2 — GitHub Pages deploy workflow
Phase: 0 · Tier: sonnet · Depends on: WP-0.1

## Read first
- `docs/architecture.md` (Workflows table, Pages base path)

## Scope
- `.github/workflows/deploy.yml` triggered on push to `main` and `workflow_dispatch`.
- Steps: checkout, setup-node, `npm ci`, `npm run build`, `actions/configure-pages`, `actions/upload-pages-artifact` (path `dist`), `actions/deploy-pages`.
- `permissions: pages: write, id-token: write`; a `concurrency` group so overlapping deploys don't race.
- Note in a comment that the repo's Pages source must be set to "GitHub Actions" once, manually, in repo settings (not automatable from here).

## Files
`.github/workflows/deploy.yml`

## Acceptance
- YAML is valid (`python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy.yml'))"` or equivalent).
- Job steps and action versions match the bullets above; permissions block present.
- Actual live deploy can only be confirmed after a real push to `main` — note this in the report.

## Out of scope
- CI workflow content (WP-0.3).
- Enabling Pages in repo settings.
