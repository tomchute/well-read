# WP-4.4 — Configure the scheduled Routine (orchestrator task)
Phase: 4 · Tier: orchestrator · Depends on: WP-4.3

## Read first
- `docs/orchestration.md` ("The curation Routine" section — use its prompt verbatim)

## Scope
- The orchestrator (not a sub-agent) calls `create_trigger` with the Routine prompt from `docs/orchestration.md`, on a weekly or monthly cron schedule, pointed at this repo.
- Confirm the trigger fires into a session that opens the repo on `main` and has access to run the curate skill.

## Files
None (external Routine configuration). Optionally record the resulting `trigger_id` as a comment in `docs/orchestration.md`.

## Acceptance
- `list_triggers` shows the new Routine enabled, with the correct prompt text and cadence.
- A manual `fire_trigger` run lands a validated batch on `main` with CI green (or, if validation fails twice, leaves the tree uncommitted with a summary, per the Routine's own instructions).

## Out of scope
- Any code changes to the repo itself.

## Result (2026-09-13)
- Routine created with Claude Code Routines: name "well-read weekly curation", id `trig_01SD7fw5QN6ZjZmrW9FPu27y`, cron `0 7 * * 1` (Mondays 07:00 UTC), fresh session per run in the same cloud environment as the build sessions, push notification on completion. Prompt as in `docs/orchestration.md`.
- Caveats: the Routine's sessions carry no MCP connectors, so they work through git only; the environment's network policy still blocks poetryfoundation.org and similar, so contemporary works land as `pending` until the allowlist in `docs/orchestration.md` is applied or text is pasted with `--file`.
- First deploy to Pages failed because Pages was not yet enabled on the repository; `actions/configure-pages` now runs with `enablement: true` so the workflow enables it on the next push to `main`.
