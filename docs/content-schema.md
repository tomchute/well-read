# Content schema

Source of truth for the `Work` type, its zod validation gates, and the manifest index shape. `content/works/<id>.json` files must conform to this; `scripts/validate-content.mjs` enforces it; `src/lib/types/` holds the zod schema and the `z.infer`'d TS types the app imports.

## The `Work` type

```ts
// -------- enums / literal unions --------

type WorkType = 'poem' | 'short_story' | 'book';

type Era =
  | 'ancient'              // pre-500 CE
  | 'medieval'             // ~500–1400
  | 'renaissance'          // ~1400–1660
  | '18th_century'
  | '19th_century'
  | 'early_20th_century'   // 1900–1945
  | 'mid_20th_century'     // 1946–1980
  | 'contemporary';        // 1981–present

type TextPolicy = 'full' | 'excerpt'; // whether the app ships the whole work or a bounded excerpt

type EbookProvider = 'standard-ebooks' | 'gutenberg' | 'open-library';
type EbookFormat = 'epub' | 'pdf' | 'mobi' | 'html';

type ExternalLinkKind =
  | 'publisher'         // publisher's book/product page
  | 'bookstore'         // a place to buy it
  | 'library'           // library catalog / borrow link (e.g. Open Library, Internet Archive)
  | 'poetry-foundation' // Poetry Foundation or similar archive page
  | 'author-site'       // author's own site or official page
  | 'other';

type SourceLicense =
  | 'public-domain'
  | 'cc0'
  | 'cc-by'
  | 'cc-by-sa'
  | 'all-rights-reserved'; // in-copyright; excerpt shown under fair-use-style limits, always with externalLinks

// -------- composite fields --------

interface Length {
  unit: 'lines' | 'words';  // lines for poems, words for prose
  value: number;            // count for the unit above (of the shipped text, i.e. excerpt length if excerpted)
}

interface SourceInfo {
  name: string;          // human-readable source name, e.g. "Standard Ebooks"
  url: string;           // canonical source URL for this text/edition
  license: SourceLicense;
  retrievedDate: string; // ISO 8601 date the text/metadata was fetched
}

interface EbookLink {
  provider: EbookProvider;
  format: EbookFormat;
  url: string; // direct or catalog URL for this format
}

interface ExternalLink {
  kind: ExternalLinkKind;
  url: string;
  label?: string; // optional display text, e.g. "Buy from publisher"
}

interface MasterNotes {
  context: string;               // markdown: historical/biographical context, 1-3 short paragraphs
  form: string;                  // markdown: form/craft discussion, 1-3 short paragraphs
  keyImages: string[];           // markdown strings, ≥2, notable images/lines worth pausing on
  whatToNotice: string[];        // markdown strings, close-reading prompts
  discussionQuestions: string[]; // markdown strings, ≥3, open-ended questions
  furtherReading: string[];      // markdown strings, ≥1 each a title + why/link, plain text or markdown link
}

interface Pipeline {
  batchId: string;       // curation batch identifier, e.g. "2026-09-13"
  dateAdded: string;     // ISO 8601 date this work entered the catalog
  curatedBy: string;     // "routine" | a human identifier
  schemaVersion: 1;      // must equal 1 for this schema version
}

// -------- the Work type --------

interface Work {
  id: string;             // unique, kebab-case, e.g. "dickinson-because-i-could-not-stop-for-death-1863"
  type: WorkType;
  title: string;
  author: string;
  year: number;           // year of composition/first publication
  era: Era;
  form: string;           // free-text sub-genre, e.g. "lyric poem", "ghazal", "novella"
  themes: string[];       // must be a subset of docs/editorial-policy.md's controlled vocabulary
  tags: string[];         // free-text, uncontrolled, for search/flavor only
  length: Length;
  difficulty: 1 | 2 | 3 | 4 | 5; // reading difficulty, 1 = easiest
  source: SourceInfo;
  textPolicy: TextPolicy;
  text?: string;          // full text; present only when textPolicy === 'full'
  excerpt?: string;       // excerpted text; present only when textPolicy === 'excerpt'
  excerptNote?: string;   // required with excerpt: states the boundary, e.g. "opening 1,240 of 5,400 words"
  ebookLinks?: EbookLink[];     // download links; required (≥1) for full public-domain works
  externalLinks?: ExternalLink[]; // outbound links; required (≥1) for excerpts and non-public-domain fulls
  cover?: string;         // optional cover/illustration image URL
  masterNotes: MasterNotes;
  pipeline: Pipeline;
}
```

`masterNotes.context`, `masterNotes.form`, and every entry in `keyImages`, `whatToNotice`, `discussionQuestions`, and `furtherReading` are **Markdown strings**, rendered with `marked` + sanitized with `DOMPurify` (see `docs/open-source-reuse.md`).

## Validation rules

Enforced by `scripts/validate-content.mjs` (zod) — a work fails the batch if any of these do not hold:

1. **`textPolicy: 'full'`** ⇒ `text` is set, and either `ebookLinks` has ≥1 entry (when `source.license` is public-domain-ish: `public-domain` or `cc0`) or `externalLinks` has ≥1 entry (otherwise).
2. **`textPolicy: 'excerpt'`** ⇒ `excerpt` and `excerptNote` are both set, `externalLinks` has ≥1 entry, and `text` is **not** set.
3. **Excerpt boundary rules** (private use, quality first, not tight maximums):
   - Contemporary poems ≤60 lines are shown in full (`textPolicy: 'full'` with `externalLinks`, not `ebookLinks`); longer poems are excerpted to the strongest continuous 40–60 lines.
   - Short stories and books are excerpted to 800–1,500 words or the complete first section/chapter, ending at a natural break.
   - `excerptNote` must state the boundary (e.g. "opening 1,240 of 5,400 words").
   - Validation enforces **minimums only**: poem excerpts ≥8 lines, prose excerpts ≥500 words.
4. **`type: 'book'`** always uses `textPolicy: 'excerpt'` plus links, even when the source is public domain — whole novels are never shipped in shards.
5. **`themes`** must be a subset of the controlled vocabulary defined in `docs/editorial-policy.md`.
6. **`masterNotes.keyImages`** has ≥2 entries.
7. **`masterNotes.discussionQuestions`** has ≥3 entries.
8. **`id`** is unique across `content/works/` and kebab-case.
9. **`pipeline.schemaVersion`** equals `1`.

A documented takedown path exists for rights concerns (see `docs/editorial-policy.md`); validation is structural only and does not judge editorial quality.

## Manifest index shape

`public/data/manifest.json` is an object `{ schemaVersion, generatedAt, count, shards, works }` where `works` is an array of entries containing only the text-free subset of `Work`, plus which shard holds the full record:

```ts
interface ManifestEntry {
  id: string;
  title: string;
  author: string;
  year: number;
  era: Era;
  type: WorkType;
  form: string;
  themes: string[];
  tags: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  length: Length;
  textPolicy: TextPolicy;
  shard: number; // index into shard-<shard>.json where the full Work record lives
}
```

## Example `Work`

Public-domain poem, shown in full. Links are Standard Ebooks/Gutenberg-style placeholders — marked `TODO verify` for the curation Routine to confirm before shipping.

```json
{
  "id": "dickinson-because-i-could-not-stop-for-death-1863",
  "type": "poem",
  "title": "Because I could not stop for Death",
  "author": "Emily Dickinson",
  "year": 1863,
  "era": "19th_century",
  "form": "lyric poem, ballad meter",
  "themes": ["mortality", "time", "nature", "wonder"],
  "tags": ["carriage", "afterlife", "personification"],
  "length": { "unit": "lines", "value": 24 },
  "difficulty": 2,
  "source": {
    "name": "Standard Ebooks — Emily Dickinson: Poems",
    "url": "https://standardebooks.org/ebooks/emily-dickinson/poems",
    "license": "public-domain",
    "retrievedDate": "2026-09-01"
  },
  "textPolicy": "full",
  "text": "Because I could not stop for Death –\nHe kindly stopped for me –\nThe Carriage held but just Ourselves –\nAnd Immortality.\n\nWe slowly drove – He knew no haste\nAnd I had put away\nMy labor and my leisure too,\nFor His Civility –\n\nWe passed the School, where Children strove\nAt Recess – in the Ring –\nWe passed the Fields of Gazing Grain –\nWe passed the Setting Sun –\n\nOr rather – He passed us –\nThe Dews drew quivering and Chill –\nFor only Gossamer, my Gown –\nMy Tippet – only Tulle –\n\nWe paused before a House that seemed\nA Swelling of the Ground –\nThe Roof was scarcely visible –\nThe Cornice – in the Ground –\n\nSince then – 'tis Centuries – and yet\nFeels shorter than the Day\nI first surmised the Horses' Heads\nWere toward Eternity –",
  "ebookLinks": [
    {
      "provider": "standard-ebooks",
      "format": "epub",
      "url": "https://standardebooks.org/ebooks/emily-dickinson/poems/downloads/emily-dickinson_poems.epub"
    },
    {
      "provider": "gutenberg",
      "format": "pdf",
      "url": "https://www.gutenberg.org/ebooks/12242"
    }
  ],
  "externalLinks": [
    {
      "kind": "poetry-foundation",
      "url": "https://www.poetryfoundation.org/poems/47652/because-i-could-not-stop-for-death-479",
      "label": "Read at Poetry Foundation"
    }
  ],
  "cover": "TODO verify",
  "masterNotes": {
    "context": "Dickinson wrote this poem around 1862–63, during the extraordinarily productive years of the Civil War period, though it was not published until 1890, four years after her death, in the first posthumous collection of her verse. She lived a famously withdrawn life in Amherst, Massachusetts, and death was one of her most persistent subjects — not treated as an abstraction but staged, again and again, as an encounter.\n\nThe poem takes the New England custom of a horse-drawn funeral carriage and turns it into an unhurried social call: Death arrives not as a violent interruption but as a courteous suitor, and the speaker, mid-errand, simply goes along for the ride.",
    "form": "The poem is written in Dickinson's signature common meter (alternating four- and three-stress lines), the meter of hymns and ballads, which lends even her most unsettling ideas a deceptively singable, familiar rhythm. Her characteristic dashes replace conventional punctuation throughout, creating pauses that feel like held breath rather than grammatical stops.\n\nSlant rhyme (\"me\"/\"Immortality,\" \"Ground\"/\"Ground\") and the slow widening of stanza scope — from carriage, to schoolyard, to fields, to sunset, to grave — build a quiet deceleration that mirrors the ride itself.",
    "keyImages": [
      "The carriage holding \"just Ourselves – / And Immortality\" — a third, abstract passenger riding along as if it were a person.",
      "The house that \"seemed / A Swelling of the Ground\" — the grave described with the softened, domestic word \"House.\"",
      "The final image of the horses' heads pointed \"toward Eternity,\" left suspended without arrival."
    ],
    "whatToNotice": [
      "Death is personified as courteous and unhurried (\"He kindly stopped for me\"), never menacing — notice how that tone shapes your own sense of dread, or lack of it.",
      "The speaker's clothing (\"Gossamer,\" \"Tulle\") is unfit for the cold, marking the crossing from the world of the living into something else without ever naming it directly.",
      "Time collapses in the final stanza: centuries feel shorter than the single day of the ride. Notice how the poem never actually arrives anywhere — it ends suspended, mid-journey.",
      "The dashes control pacing more than grammar does. Try reading a stanza aloud pausing only where a dash falls."
    ],
    "discussionQuestions": [
      "Why might Dickinson have chosen to make Death a polite, familiar figure rather than a frightening one?",
      "What is the effect of ending the poem mid-journey, with the horses still \"toward Eternity,\" rather than at a clear arrival?",
      "How does the hymn-like meter interact with the poem's subject? Does the familiarity of the rhythm comfort, unsettle, or both?"
    ],
    "furtherReading": [
      "Helen Vendler, *Dickinson: Selected Poems and Commentaries* — a close-reading companion covering this poem in detail.",
      "[Poetry Foundation: Emily Dickinson](https://www.poetryfoundation.org/poets/emily-dickinson) — biography and further poems."
    ]
  },
  "pipeline": {
    "batchId": "seed-0001",
    "dateAdded": "2026-09-13",
    "curatedBy": "orchestrator-seed",
    "schemaVersion": 1
  }
}
```

See also: `docs/architecture.md` (manifest/shard build), `docs/editorial-policy.md` (theme vocabulary, rights rules), `docs/master-notes-style-guide.md` (how to write the notes fields well).
