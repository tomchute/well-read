# WP-1.1 — zod schema + TS types for `Work`
Phase: 1 · Tier: sonnet · Depends on: WP-0.1

## Read first
- `docs/content-schema.md` (full `Work` type and validation rules — implement exactly)
- `docs/editorial-policy.md` (controlled theme vocabulary, era/form enums)
- `docs/open-source-reuse.md` (zod is shared by scripts and app via `z.infer`)

## Scope
- Write the `Work` zod schema in plain JS (`.mjs`, no TS syntax) so both Node scripts and Vite/TS can import the same source of truth.
- Cover every field, enum, and conditional in `docs/content-schema.md`: `textPolicy: full|excerpt` branching, `masterNotes` minimums (`keyImages >= 2`, `discussionQuestions >= 3`), controlled `themes` vocabulary.
- Re-export the inferred type for the app: `src/lib/types/work.ts` imports the schema and does `export type Work = z.infer<typeof WorkSchema>`.

## Files
- `scripts/lib/schema.mjs`
- `src/lib/types/work.ts`

## Acceptance
- A Node script importing `schema.mjs` and parsing the example `Work` JSON from `docs/content-schema.md` succeeds.
- `npx tsc --noEmit` resolves the re-exported `Work` type with no errors.

## Out of scope
- The `validate-content.mjs` CLI and its editorial gates beyond schema shape (WP-1.2).
- Manifest-entry types (derived later in WP-1.3/WP-2.2).
