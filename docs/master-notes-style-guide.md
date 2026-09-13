# Master Notes Style Guide

Master notes are the guided close-reading that accompanies every work. They are
what makes well-read a reading app and not just a text dump. This guide sets the
voice, length, structure, and one worked example. Editorial input constraints
(theme vocab, minimum counts) live in `docs/editorial-policy.md`; this file is
about quality of the writing itself.

## Three hard rules

- **Overfamiliarity is a reason to swap, not include.** If a work is so
  widely taught or quoted that the notes would need to warn the reader
  against reading it on autopilot, that is a signal to pick a different work
  (see `docs/editorial-policy.md`), not a note to write around.
- **Every anchor must be locatable in the shipped text.** Every entry in
  `keyImages`, `whatToNotice`, and `discussionQuestions` must point at
  something findable in the work's own `text`/`excerpt` field. At most one
  item across all three fields may look beyond the shipped text, and it must
  be prefixed `"Beyond this excerpt:"` so the reader knows it is not there to
  find.
- **Never assume the reader finished a book the app did not give them.**
  `context` and `form` must not rely on, or spoil, anything past the given
  `text`/`excerpt` — the reader has read exactly what well-read shipped them,
  nothing more.

## Voice

Write as a brilliant, warm tutor sitting next to the reader, not a lecturer in
front of them. Specific over general — a claim about *this* poem's third line
beats a claim about "poetry" or "the human condition." Never summarise the plot
or resolution in place of reading the work; the notes exist to sharpen attention,
not replace the text. Assume an intelligent adult reader who is new to this
particular work but not new to reading — no hand-holding on what a metaphor is,
real hand-holding on what *this* one is doing.

## Sections, length, and format

| Field | Length | Notes |
|---|---|---|
| `context` | 120–200 words | Where this sits: when written, what circumstance or tradition shaped it, why it's still read. Not a biography. |
| `form` | 100–180 words | What structural or formal choices are doing the work — meter, POV, structure, sentence rhythm — and what effect they produce. |
| `keyImages` | 3–5 items | Each item: the image/detail itself, plus one sentence on why it matters. Not a list of pretty phrases — pick ones that carry the piece's meaning. |
| `whatToNotice` | 4–6 bullets | Concrete and line-anchored ("in the second stanza," "when the narrator repeats..."). Point at something findable on the page, not a mood. |
| `discussionQuestions` | 3–5 | Open questions with no single right answer. No yes/no questions. Should be answerable only after reading, not guessable from the title. |
| `furtherReading` | 2–4 items | Each with a short phrase on why (a related work, a better-known piece by the same author, a critical response) — not a bare list of titles. |

Markdown is allowed inside field text: *italics* for titles of other works,
blockquotes for short quotations pulled from the work's own text. Do not use
headings inside any field — the field itself is the heading.

## Banned moves

- Cliché openers: "Since the dawn of time...", "Throughout history...", "This
  poem explores..." — start with something true and specific to this work
  instead.
- The biographical fallacy: reading the work as a straightforward transcript of
  the author's life. Biography belongs in `context` only when it demonstrably
  shaped the work, and even then, sparingly.
- Spoilers for stories and books ahead of where the reader is expected to be —
  `context` and `form` must not give away plot the reader hasn't reached via the
  provided `text`/`excerpt`. `keyImages` and `whatToNotice` may reference anything
  within the given excerpt, never beyond it.
- Hedging filler: "some might say," "in many ways," "it could be argued." Commit
  to the reading.

## Worked example

**Work**: Anton Chekhov, "The Lady with the Dog" (1899)

**context** (word count: 148)

Chekhov wrote "The Lady with the Dog" in 1899, near the end of a life he knew was
ending — tuberculosis would kill him five years later. It appeared in the journal
*Russkaya Mysl* and was translated into English within a decade, becoming one of
the stories that convinced Anglophone writers, Virginia Woolf among them, that
short fiction didn't need a tidy moral or a twist to be serious art. The setting
is Yalta, a resort town on the Black Sea where bored, married Russians took the
waters and, discreetly, each other. Chekhov had spent years living near Yalta for
his health, and knew exactly the kind of affair this story describes: not a grand
passion interrupting two lives, but two ordinary people discovering, almost
against their will, that they have finally met someone who sees them.

**form** (word count: 121)

The story is told in close third person, mostly from Gurov's point of view, which
matters: we get his condescension toward women in the opening paragraphs at full
strength, unfiltered by the narrator, so that his later undoing by love reads as
correction rather than sentiment. Chekhov structures the story in four short
parts spanning roughly a year, each a scene rather than a summary — the pier, the
hotel room, the provincial theater, the Moscow hotel — with the connecting time
compressed almost to nothing. Nothing is resolved in the final scene; the last
line looks forward to "a long, long road" still ahead. The open ending is the
argument: some feelings don't conclude, they just continue.

**keyImages** (4 items)

1. The slice of watermelon Gurov eats in Anna's hotel room just after they first
   sleep together — its banality against the weight of what has just happened is
   the story's coldest, funniest, most Chekhovian moment.
2. Anna's grey dress and the grey sea at dawn on the pier — the story's one
   moment of visual calm, right before both characters start lying to themselves
   about what the affair means.
3. The gray fence Gurov stares at outside Anna's provincial house, spiked with
   nails — an image of exclusion so plain it barely needs interpreting, and
   Chekhov trusts the reader not to need it explained.
4. The hotel room mirror in the final section, in which Gurov sees himself as
   "getting gray" — the story's only overt marker of aging, arriving exactly when
   he realizes this is not an affair he can end.

**whatToNotice** (5 bullets)

- Notice how the opening paragraph's gossip about "the lady with the dog" is
  entirely Gurov's voice, not the narrator's — Chekhov never corrects him
  directly, he just keeps writing.
- Notice the watermelon: comedy placed at the story's most serious turn, not
  relief from it.
- In the theater scene, notice how much is happening in what Anna does *not*
  say — count how many of her lines are incomplete sentences.
- Notice that Chekhov never describes what Gurov and Anna actually talk about
  once they're in love — only that they talk, for hours. The content of their
  intimacy is withheld; only its fact is shown.
- Notice the last paragraph shifts from past tense description into a kind of
  suspended present — "it seemed as though in a little while the solution would
  be found" — track exactly where that shift happens.

**discussionQuestions** (4 items)

- Gurov starts the story believing he understands women completely. What
  specifically breaks that certainty, and is it Anna, or something in himself?
- The story refuses a conventional ending. What would be lost if Chekhov had
  given Gurov and Anna a resolution — together or apart?
- How does the Yalta setting, a place built for temporary escape, shape what
  becomes possible between these two people?
- Chekhov withholds almost all interiority from Anna. Does that weaken her as a
  character, or is it doing something else?

**furtherReading** (3 items)

- *Ward No. 6* (Chekhov) — for the same unsparing, undramatic prose style
  applied to a much darker subject.
- Joyce's "The Dead" — a near-contemporary story built on a similarly quiet,
  open ending after a moment of emotional recognition.
- Vladimir Nabokov's lecture on this story (in *Lectures on Russian
  Literature*) — a close formal reading by a writer who considered Chekhov's
  technique nearly perfect.
