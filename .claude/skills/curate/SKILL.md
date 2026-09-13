---
name: curate
description: Add one validated batch of well-respected works to well-read and commit it to main.
---

## Preconditions

1. **Live Routine only:** `git status --porcelain` is empty on `main`. Dogfood/manual runs may work on a feature branch with unrelated changes; see step 12 for staging details.
2. `npm ci` has run (fresh `node_modules`).
3. Read `docs/editorial-policy.md` and `docs/master-notes-style-guide.md` in full before picking any works.

## Environment facts

1. `gutendex.com`, `standardebooks.org`, and `poetrydb.org` may be unreachable from this environment. On failure `fetch-gutendex.mjs` and `fetch-poetrydb.mjs` print an `[ERROR]` line and exit 1; `fetch-standard-ebooks.mjs` soft-fails, printing `[]` and exiting 0. None of these is a batch failure — it means "no candidates from this source": try another source, or go straight to `inject-excerpt.mjs --url` against a known raw-GitHub URL (2).
2. `raw.githubusercontent.com` is the reliable text source, unaffected by (1):
   - Standard Ebooks: `.../standardebooks/<author-slug>_<title-slug>/master/src/epub/text/<file>.xhtml`. To find `<file>` names and reading order, fetch `.../master/src/epub/content.opf` first — its `<spine>` lists `<itemref idref="...">` in reading order, and each `idref` matches an `<item id="..." href="text/<file>.xhtml">` in the `<manifest>`.
   - GITenberg: `.../GITenberg/<Title-Slug>_<gutenbergId>/master/<gutenbergId>.txt`.
3. A contemporary web page (publisher site, Poetry Foundation, poets.org, a magazine) needs the network policy described in "Network requirement" (`docs/orchestration.md`) satisfied for this run. If it 404s, times out, or no such page exists at all, leave the work `pending` with tag `needs-text` and list the URL in the Report — do not substitute typed text except the one exception in "Text rule" below.

## Text rule

1. Never type or transcribe verbatim text from memory. Text enters `content/works/*.json` only through `inject-excerpt.mjs`'s `--url` or `--file`, never by hand-editing `text`/`excerpt`.
2. One narrow exception: a public-domain poem of ≤40 lines with genuinely no fetchable source (no Standard Ebooks/GITenberg mirror, no PoetryDB entry, no web page) may be typed by the curator into a `.txt` file and injected via `--file`. Add the tag `needs-text-verification` to that work so a later batch can check it against a real source.
3. **Phrase matching:** `--start "<phrase>"` / `--end "<phrase>"` match at paragraph granularity. For verse where a whole poem is one paragraph with line breaks, `--end` must be a phrase from the NEXT item's paragraph. Use ≤4 words, copied exactly. Example: `--start "opening word"` and `--end "next stanza word"` (next paragraph), not `--end "poem closing"` (same paragraph).
4. `--mode full` for poems (full text is required for public domain, and for contemporary poems ≤60 lines). Prose (short_story/book/essay/play) and longer contemporary poems use the default `--mode excerpt`.

## Checklist

1. **Check coverage gaps.**
   ```
   npm run report:coverage
   ```
   Read the `--- Suggested Focus for Next Batch ---` line — it names the 1-2 dimensions furthest under target (era/form/gender/geography). That steers this batch, it is not a hard quota.

2. **Pick a batch focus.** One sentence naming the gap(s) from step 1.

3. **Source public-domain candidates**, per candidate author/work:
   ```
   node scripts/fetch-gutendex.mjs --search "<query>" [--limit N]
   node scripts/fetch-standard-ebooks.mjs --author "<name>" [--title "<term>"] [--limit N]
   node scripts/fetch-poetrydb.mjs --author "<name>" [--title "<title>"] [--limit N]
   ```
   A script returning a result is not itself qualification — check every candidate against "Well-respected criteria" in `docs/editorial-policy.md` before shortlisting. On unreachable hosts see "Environment facts" (1).

4. **Hand-pick 1-2 contemporary works**, each with an outbound link, and record the source. For public-domain text (Standard Ebooks/GITenberg, see "Environment facts" (2)):
   ```
   npm run inject:excerpt -- --id <id> --url <raw-github-url> [--url <raw-github-url> ...] --mode full|excerpt [--start "<phrase>"] [--end "<phrase>"]
   ```
   For a contemporary work, run the same script against its own page:
   ```
   npm run inject:excerpt -- --id <id> --url <page-url> --mode full      # poems, <=60 lines
   npm run inject:excerpt -- --id <id> --url <page-url> --mode excerpt   # prose, or poems >60 lines
   ```
   `htmlPoemExtract` (poetryfoundation.org, poets.org, or any `type: 'poem'` work) or `htmlArticleExtract` (everything else) is chosen automatically. For text with no fetchable page at all (human-supplied paste, print-only source), see "Supplying text by hand" (`docs/editorial-policy.md`):
   ```
   npm run inject:excerpt -- --id <id> --file <path> [--mode full]
   ```

5. **Assemble the batch**: 4-6 works, mixing at least 2 poems, 1 short story, 1 book, and 1 contemporary work (any form). `batchId` is today's date, `YYYY-MM-DD` — every work's `pipeline.batchId` in this run uses the same value.

6. **Write master notes** for each work per `docs/master-notes-style-guide.md` — voice, length targets, and the banned moves list. No plot summary in place of reading; no invented biography.

7. **Self-review each new work's notes.** Re-read the work in `content/works/<id>.json` and check that every `keyImages`, `whatToNotice`, and `discussionQuestions` entry is locatable in its shipped `text` or `excerpt` field. Skip this check for `pending` works (no text/excerpt); instead verify their notes use standalone reading guidance ("When you read Chapter X, notice…") with no "this excerpt" wording. For committed work on a branch, optionally delegate to a haiku sub-agent with this prompt:
   ```
   Read content/works/<id>.json. Use whichever of `text` or `excerpt` is
   present as the shipped text. For every entry in masterNotes.keyImages,
   masterNotes.whatToNotice, and masterNotes.discussionQuestions, decide
   LOCATABLE (quote the matching phrase from that text) or NOT LOCATABLE.
   At most one entry across all three fields may be prefixed "Beyond this
   excerpt:" — any other NOT LOCATABLE entry is a hard miss. Separately,
   say whether this work is so widely taught or quoted that its own notes
   would need to warn the reader against reading it on autopilot. Report
   findings only per work (id, each entry's verdict, the overfamiliarity
   call); do not edit any file.
   ```
   Any hard miss fails the batch: fix the offending note, or swap the work per `docs/editorial-policy.md`'s "Overfamiliarity", before moving on to validation.

8. **Write the content files** at `content/works/<id>.json`, one per work. Id: `<author-short-name>-<short-title>-<year>`, kebab-case, e.g. `chekhov-lady-with-the-dog-1899` — surname only unless it collides with an existing id, then add a given-name initial. Set `authorGender` (`woman`/`man`/`non-binary`/`unknown`) and `authorRegion` (e.g. `"US"`, `"Nigeria"`) on every work — `report:coverage`'s gender/region tables read these fields.

9. **Validate.**
   ```
   npm run validate:content
   ```
   Fix any reported error and rerun. Two failed fix attempts on the same batch: stop (see "Stop rule").

10. **Rebuild the manifest.**
    ```
    npm run build:manifest
    ```
    Confirm the reported work count includes this batch and no `[WARN] possible duplicate works` line names one of its ids.

11. **Run the test suite.**
    ```
    npm test
    ```
    All green before committing — this is the last gate before `main`.

12. **Commit and push.**
    ```
    git add content/works/ public/data/
    git commit -m "curate: batch <YYYY-MM-DD> (<n> works)"
    git push origin main  # (live Routine) or your branch (dogfood/manual)
    ```
    Stage only `content/works/` and `public/data/`. Live Routine pushes to `main`; manual runs push to a feature branch. Direct-to-main for the Routine is intentional: an unattended PR would sit unreviewed; `ci.yml` is the backstop that surfaces any escape.

## Stop rule

If `validate:content` fails twice in a row on the same batch without a clear fix, stop immediately. Do not force a commit, do not delete works to make validation pass, do not lower an excerpt below the floor. Leave the tree uncommitted and report the failure.

## Report

At the end of a run (success or stop), report:

1. Batch focus (the coverage gap(s) targeted, from step 1's "Suggested Focus") and `batchId`.
2. Works added: id, type, author, era, full text or excerpt.
3. Coverage numbers before and after this batch (`npm run report:coverage`).
4. Any fetch-script failure or unreachable host, and how it was handled — which source was substituted, or whether `pending`/`needs-text`/`needs-text-verification` was used.
5. Validation/test output, or the failure summary if stopped.
6. The commit hash and confirmation of the push, or confirmation that nothing was committed.
