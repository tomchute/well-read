# Editorial Policy

## Purpose and posture

well-read is a private, single-user reading app, not a publication. The goal is a
personal feed of writing worth close attention, with links out to buy, borrow, or
read the rest. Quality of the reading experience wins over caution: prefer showing
enough text to actually read something over stub excerpts and a wall of links.

Posture on rights: **forgiveness over permission**. Public-domain work is used in
full. Contemporary work is shown as a generous excerpt with mandatory outbound
links (publisher, Poetry Foundation, Bookshop.org, WorldCat, or Libby) — never the
whole work — and the source is always recorded. This is judgement, not a legal
opinion; if something feels wrong to include, don't include it.

**Takedown path**: if a rights holder or the user objects to any work, open a
GitHub issue using the template from WP-4.5 ("flag a correction / takedown").
Remove or shorten the work from `content/works/` within one day of the issue being
filed, rebuild the manifest, and commit. No other process is required.

## "Well-respected" criteria

A work qualifies if it meets at least one of:

- **Canonical anthology presence**: included in a Norton anthology, Oxford World's
  Classics / Oxford Book of..., Penguin Classics, or a Library of America volume.
- **Major prizes**: Nobel Prize in Literature (for the author), Pulitzer Prize,
  Booker Prize (or International Booker), National Book Award, T.S. Eliot Prize,
  Forward Prize, Griffin Poetry Prize, O. Henry Prize, or selection in *Best
  American Short Stories*.
- **Core institutional status**: featured as a core/classic selection on the
  Poetry Foundation or Academy of American Poets sites (not a random submission).
- **Sustained critical standing**: taught widely, subject of substantial critical
  literature over decades, or named in "best of" retrospectives from serious
  outlets over multiple years — not a single review.

**Not qualifying on their own**: personal taste of the curator, social-media
virality, self-published work, or a single positive review. These can be a reason
to *look closer* for one of the criteria above, never a substitute for it.

**Overfamiliarity**: if a work is so widely taught or quoted that its own master
notes would have to warn the reader against reading it on autopilot ("you may
already know this poem by heart," "this opening is a cliché by now"), swap it
for a less-overexposed work by the same author or in the same vein rather than
include it. Well-respected is not the same as fresh; prefer the latter when
they conflict.

## Balance targets (tracked over time, not per batch)

Checked with `npm run report:coverage` against the whole catalogue, not any one
batch. A single batch may skew; the running catalogue should trend toward:

- **Eras**: ~40% pre-1900, ~30% 1900–1970, ~30% after 1970.
- **Forms**: ~40% poems, ~25% short stories, ~25% books, ~10% essays and drama
  combined.
- **Gender**: at least 40% women and non-binary authors.
- **Geography**: at least 30% authors from outside the US/UK. Translations are
  welcome and encouraged — always credit the translator in `source`/author
  metadata. Note: a translation of a public-domain original can itself still be
  in copyright (the translator's rights); check and record the translation's own
  license, don't assume public domain carries over.
- **Author cap**: no single author gets more than 3 works in the catalogue until
  it passes 150 works total, so the early feed doesn't over-index on a few names.

## Controlled theme vocabulary

Exactly these 32 lowercase kebab-case terms. `themes` on a `Work` must be a subset
of this list; `tags` are separate, free-form, and additive (use `tags` for
anything more specific — a place name, a form like "sonnet", a movement).

| Theme | Gloss |
|---|---|
| `love` | romantic or devoted love between people |
| `desire` | longing, want, physical or erotic pull |
| `grief` | mourning a loss |
| `death` | mortality's endpoint as event or presence |
| `mortality` | awareness of finitude, aging, the fact of dying |
| `memory` | recollection, nostalgia, the past intruding on the present |
| `time` | time's passage, cycles, or its distortion |
| `childhood` | being or remembering being a child |
| `family` | parents, siblings, children, inheritance of all kinds |
| `friendship` | bonds outside family or romance |
| `solitude` | aloneness, chosen or imposed |
| `nature` | the non-human natural world |
| `seasons` | seasonal change as subject or structure |
| `animals` | animals as subject, not just setting |
| `the-city` | urban life and landscape |
| `work` | labor, jobs, vocation |
| `war` | armed conflict and its aftermath |
| `exile` | displacement from one's homeland |
| `migration` | movement of people, voluntary or forced |
| `home` | belonging to or longing for a place |
| `faith` | religious or spiritual belief |
| `doubt` | uncertainty, loss of faith, skepticism |
| `justice` | fairness, law, moral reckoning |
| `power` | authority, control, its abuse or absence |
| `race` | race and racism as lived experience |
| `gender` | gender and its constraints or expression |
| `the-body` | embodiment, physicality, the body as subject |
| `illness` | sickness, disability, medicine |
| `art-making` | writing, painting, music as subject (ars poetica) |
| `language` | language itself as subject |
| `humor` | comic, satirical, or wry work |
| `wonder` | awe, astonishment, the sublime |

## Text and excerpt rules

- **Public domain**: full text (`textPolicy: full`) plus at least one
  `ebookLinks` entry (Gutenberg/Standard Ebooks epub).
- **Contemporary poems, ≤60 lines**: full text (`textPolicy: full`), with
  `externalLinks` instead of `ebookLinks` (contemporary work has no epub link to
  give).
- **Contemporary poems, >60 lines**: excerpt the strongest continuous 40–60
  lines — not the opening by default, whichever stretch reads best on its own.
- **Short stories, essays, and books, any era shown as excerpt**: 800–1,500
  words, or the complete first section/chapter if that falls in a reasonable
  range, ending at a natural break (scene, section, or chapter boundary) —
  never mid-scene.
- **A book or play excerpt** may be either the opening or one complete
  representative chapter/scene, named in `excerptNote` (e.g. "Part One,
  Chapter 18, complete"). Whichever is chosen, the chapter or scene should
  contain the protagonist or the work's central situation — not a minor aside.
- `excerptNote` must state the boundary in plain terms, e.g. "opening 1,240 of
  ~5,400 words" or "first section of three."
- **Books, essays, and plays always use `excerpt` or `pending`**, never
  `full`, even when in the public domain — never ship a whole novel or script
  into a shard.
- Validation enforces floors only, not tight ceilings: poems ≥8 lines, prose
  ≥500 words. Above the floor, judgement decides where to end.
- **Always at least one outbound link** on every work — `ebookLinks` for public
  domain, `externalLinks` (publisher page, Poetry Foundation, Bookshop.org,
  WorldCat, or Libby) for everything else.
- Verbatim text is always copied by script from a source file (Standard
  Ebooks or GITenberg on GitHub, for public domain), never typed from a
  model's memory. When no source is reachable, the work is added as
  `textPolicy: pending` with the `needs-text` tag, and the excerpt is added
  later by a human paste or a future source.
- Seed and Routine batches may include `pending` contemporary prose rather
  than skipping contemporary works altogether.

## Quality gates for master notes

Master notes are graded against `docs/master-notes-style-guide.md`, not this
file — see that doc for voice, length, and structure. This file only sets the
input constraints: `keyImages ≥ 2`, `discussionQuestions ≥ 3`, all `themes` from
the controlled vocabulary above, all ids unique kebab-case.

**Accuracy rules**: never invent biographical detail, dates, or quotations. If a
fact isn't confidently known, omit it rather than guess — a shorter, correct note
beats a fuller, wrong one. Quoted lines in notes must be verbatim from the work's
own `text`/`excerpt` field, not from memory of the work.

## Difficulty scale (1–5)

| Level | Anchor |
|---|---|
| 1 | Plain language, no background needed — read once and it lands. |
| 2 | Straightforward, maybe one unfamiliar reference or word. |
| 3 | Rewards a second read; some structural or historical context helps. |
| 4 | Dense language, allusion, or form; the master notes carry real weight. |
| 5 | Demanding on a first read even for an experienced reader (e.g. late James, dense modernist verse). |

## Sources allowed for text

- **Public domain**: Project Gutenberg / Gutendex, Standard Ebooks, Wikisource,
  PoetryDB. Fetch via the scripts in `scripts/`; never hand-copy from a
  non-authoritative site.
- **Contemporary**: transcribed by the curator from a reputable published source
  (a print book, the publisher's own site, a magazine of record like *The New
  Yorker*, *Poetry*, *The Paris Review*). Record that source's name, URL (if any),
  and retrieval date in the work's `source` field. Never transcribe from an
  unauthorized reposting.

## Sources for in-copyright text

well-read is for private use only, never republished or shared publicly — see
"Purpose and posture" above. On that basis, in-copyright text visible on the
open web may be copied by script from the publisher's own site, Poetry
Foundation, or poets.org, using `npm run inject:excerpt -- --url <page>` (see
`scripts/inject-excerpt.mjs`, `htmlPoemExtract`/`htmlArticleExtract`). This is
an owner judgement call for a single-user app, not a legal opinion; a model
must still never type verbatim text from memory — the script always fetches
and mechanically extracts it.

Given this, `textPolicy: pending` is now reserved for a work whose page is not
reachable at all (no publisher, Poetry Foundation, or poets.org page exists or
can be found) — not merely for "the Routine's environment couldn't fetch it
today." When the environment itself can't reach the network (see "Network
requirement" in `docs/architecture.md`/`docs/orchestration.md`), leave the
work `pending`, tag it `needs-text`, and list the page URL in the batch report
so a later run (or a human, via `--file`) can inject it.

The takedown path is unchanged: see "Purpose and posture" above.

## Supplying text by hand

For a work the Routine cannot fetch by script (no reachable raw-text URL —
e.g. a human-supplied scan, a print-only source), text is added to a
`pending` work after the fact, by hand:

1. Paste the text into a local `.txt` file: one paragraph per
   blank-line-separated block for prose, or one line per verse line for
   poems/plays.
2. Run:
   ```
   npm run inject:excerpt -- --id <id> --file <path> [--mode full]
   ```
   The script reads the file, validates it against `WorkSchema`, and flips
   the work from `pending` to `excerpt` (default) or `full` (with
   `--mode full`, only for types allowed to ship full text).
