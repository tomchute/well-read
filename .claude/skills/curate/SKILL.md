---
name: curate
description: Add one validated batch of well-respected works to well-read and commit it to main.
---

> **Status**: not runnable until Phase 1 (`validate-content.mjs`, `build-manifest.mjs`,
> fetch scripts) and Phase 4 (`report-coverage.mjs`) land. Until then this file is a
> checklist to implement against, not a script to execute.

## Preconditions

- Working tree is on `main` and clean (`git status --porcelain` empty).
- `npm ci` has been run (fresh `node_modules`).
- You have read `docs/editorial-policy.md` and `docs/master-notes-style-guide.md`
  in full before picking any works.

## Checklist

1. **Check coverage gaps.**
   ```
   npm run report:coverage
   ```
   Compare output against the balance targets in `docs/editorial-policy.md`
   (eras, forms, gender, geography, author caps). Note the 2-3 biggest gaps —
   these steer what you look for, not a hard quota for this batch.

2. **Pick a batch focus.** One sentence naming the gap(s) this batch leans
   into (e.g. "more pre-1900 women poets, one non-US story").

3. **Source public-domain candidates.**
   ```
   node scripts/fetch-gutendex.mjs --search "<query>"
   node scripts/fetch-standard-ebooks.mjs --author "<name>"
   node scripts/fetch-poetrydb.mjs --author "<name>" --title "<title>"
   ```
   Run these for each candidate author/work you're considering. Check every
   result against the "well-respected" criteria in `docs/editorial-policy.md`
   before shortlisting — a script returning a text is not itself qualification.

4. **Hand-pick 1–2 contemporary works** with at least one outbound link each,
   and record the source in `source`. For public-domain text, run
   `npm run inject:excerpt -- --id <id> --url <raw github url>` (Standard
   Ebooks or GITenberg on GitHub) to copy the verbatim text by script — never
   type or transcribe it from memory.

   For a contemporary work, find its page (the publisher's own site, Poetry
   Foundation, or poets.org) and run the same script directly against that
   page — per "Sources for in-copyright text" in `docs/editorial-policy.md`,
   text visible on the open web may be copied by script for this private,
   single-user app:
   ```
   npm run inject:excerpt -- --id <id> --url <page> --mode full      # poems, ≤60 lines
   npm run inject:excerpt -- --id <id> --url <page> --mode excerpt   # prose, or poems >60 lines
   ```
   The script routes the page through `htmlPoemExtract` (poetryfoundation.org,
   poets.org, or any `type: 'poem'` work) or `htmlArticleExtract` (everything
   else) automatically. If the host is unreachable from this environment (see
   "Network requirement" in `docs/architecture.md`), leave the work `pending`
   with tag `needs-text` and list the page URL in the batch report instead —
   do not type or transcribe the text from memory as a substitute. For text
   with no fetchable page at all (a human-supplied paste, a print-only
   source), use the `--file` route instead — see "Supplying text by hand" in
   `docs/editorial-policy.md`.

5. **Assemble the batch**: 4–6 works total, mixing:
   - at least 2 poems
   - at least 1 short story
   - at least 1 book
   - at least 1 contemporary work (any form)

   `batchId` is today's date, `YYYY-MM-DD`. Every work's `pipeline.batchId`
   in this run uses the same value.

6. **Write master notes** for each work per
   `docs/master-notes-style-guide.md` — voice, length targets, and the banned
   moves list. No plot summary in place of reading; no invented biography.

7. **Self-review each new work's notes.** Launch a `haiku` sub-agent per work
   (or one sub-agent covering the whole batch) that reads the work's shipped
   `text`/`excerpt` alongside its `masterNotes` and confirms, per
   `docs/master-notes-style-guide.md`'s "Three hard rules", that every
   `keyImages`, `whatToNotice`, and `discussionQuestions` entry is locatable
   in that text — with at most one exception, prefixed `"Beyond this
   excerpt:"` — and that the work is not one whose own notes have to warn
   against its overfamiliarity. Any miss fails the batch: fix the offending
   note (or swap the work, per `docs/editorial-policy.md`) before moving on to
   validation.

8. **Write the content files** at `content/works/<id>.json`, one per work.
   Id convention: `<author-short-name>-<short-title>-<year>`, kebab-case, e.g.
   `chekhov-lady-with-the-dog-1899`. Author short name is surname only unless
   that collides with an existing id, in which case add a given-name initial.

9. **Validate.**
   ```
   npm run validate:content
   ```
   Fix any reported error and rerun. If validation still fails after **two**
   fix attempts on the same batch, **stop**: leave the tree uncommitted, and
   write a short failure summary (which file, which check, what you tried)
   instead of continuing to guess.

10. **Rebuild the manifest.**
    ```
    npm run build:manifest
    ```
    Confirm it reports the expected new work count and no dedupe warnings for
    this batch.

11. **Run the test suite.**
    ```
    npm test
    ```
    All green before committing — this is the last gate before `main`.

12. **Commit and push directly to `main`.**
    ```
    git add content/works/ public/data/
    git commit -m "curate: batch <YYYY-MM-DD> (<n> works)"
    git push origin main
    ```
    `<n>` is the number of works added in this batch (4–6). Direct-to-main is
    intentional: an unattended Routine's PR would sit unreviewed; `ci.yml` is
    the backstop that surfaces any escape.

## Stop rule

If `validate:content` fails twice in a row on the same batch without a clear
fix, stop immediately. Do not force a commit, do not delete works to make
validation pass, do not lower an excerpt below the floor. Leave the tree
uncommitted and report the failure.

## Report

At the end of a run (success or stop), report:

- Batch focus (the coverage gap(s) targeted) and `batchId`.
- The works added: id, type, author, era, whether full text or excerpt.
- Coverage numbers before and after this batch.
- Any source or fetch-script failure and how it was handled.
- Validation/test output (or the failure summary, if stopped).
- The commit hash and confirmation of the push, or confirmation that nothing
  was committed.
