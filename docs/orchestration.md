# Orchestration — how work gets done here

The project is built by an orchestrating Claude session that delegates each work package (WP) to a cheaper sub-agent, and by a scheduled Routine that adds content. This file is the operating manual for both. Any session with no memory of earlier ones should be able to follow it.

## Roles

| Role | Model tier | Does |
|---|---|---|
| Orchestrator | the main session | Reads `ROADMAP.md`, picks WPs, writes sub-agent prompts, reviews output, ticks boxes, commits, pushes. Does not write feature code itself. |
| Builder sub-agent | tier named in the WP (`haiku` for mechanical/config work, `sonnet` for anything with judgement or UI) | Implements one WP end to end, runs its acceptance checks, reports what passed and what did not. |
| Reviewer sub-agent | `haiku` | Cross-checks a batch of finished WPs against acceptance criteria and repo conventions; reports drift, does not fix. |
| Curation Routine | scheduled Claude Code session | Runs `.claude/skills/curate/SKILL.md`, commits content to `main`. |

Keep the orchestrator's context light: sub-agents read files themselves; the orchestrator passes file paths, not file contents.

## Executing a WP

1. Confirm dependencies listed in the WP file are ticked in `ROADMAP.md`.
2. Launch a builder sub-agent with the prompt template below. Independent WPs in the same phase can run in parallel, one agent each.
3. When it reports back, run the WP's acceptance commands yourself (or via a haiku reviewer). Do not trust "done" without the check output.
4. Tick the box in `ROADMAP.md`, commit as `<area>: <summary> (WP-x.y)`, push.
5. After a phase completes, run the phase verification line from `ROADMAP.md` before starting the next phase.

### Builder prompt template

```
You are implementing one work package in the repo at <path>.
Read, in this order: CLAUDE.md, docs/work-packages/<WP file>, and the docs the WP lists under "Read first".
Scope is exactly the WP's "Scope" section. Do not touch files outside its "Files" list unless the WP says so.
Prefer the libraries named in docs/open-source-reuse.md; do not add others without saying why in your report.
When done, run every command under "Acceptance" and paste the actual output in your report.
Report format: (1) files created/changed, (2) acceptance output, (3) anything not done and why, (4) any doc that turned out to be wrong or missing.
Do not commit or push.
```

### Reviewer prompt template

```
Review the uncommitted changes in <path> against docs/work-packages/<WP file> and CLAUDE.md conventions.
Report only concrete problems: unmet acceptance criteria, files outside scope, hand-edited generated files, contradictions with the source-of-truth docs. Under 200 words. Do not fix anything.
```

## Model-tier guidance

- `haiku`: config files, workflows, scripts with clear I/O, fixtures, small components with a spec, doc cross-checks.
- `sonnet`: schema design, scoring logic, UI components with visual judgement, anything that writes literary content (seed works, master notes).
- Escalate to a stronger model only when a sonnet agent fails the same acceptance check twice.

## The curation Routine

Configured once in WP-4.4 with the Claude Code Routines feature (`create_trigger`), weekly or monthly, opening this repo. Its prompt:

```
Open the well-read repo on main. Run the .claude/skills/curate skill exactly as written to add one batch of 4–6 works: check coverage gaps, source public-domain works with the fetch scripts, choose 1–2 contemporary works with policy-compliant text, write master notes per the style guide, validate, rebuild the manifest, run tests, then commit directly to main as "curate: batch <YYYY-MM-DD> (<n> works)" and push. If validation still fails after two fix attempts, stop, leave the tree uncommitted, and write a short failure summary.
```

Why direct to `main`: an unattended Routine's pull request would sit unreviewed and defeat the point. `validate:content` and `npm test` gate the commit locally, and the CI workflow is the backstop that makes any escape visible. If a review buffer is ever wanted, point the Routine at a branch with auto-merge on green; nothing in the skill changes.

## Git rules

- Feature WPs: branch from `main`, merge when the WP's acceptance passes.
- Never hand-edit `public/data/*`; regenerate with `npm run build:manifest`.
- Never rewrite history on `main`.
- Commit messages: `<area>: <imperative summary>`.
