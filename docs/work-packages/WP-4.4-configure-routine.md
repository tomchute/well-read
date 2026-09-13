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
