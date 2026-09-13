#!/usr/bin/env node

/**
 * build-manifest.mjs
 *
 * Reads `content/works/*.json`, validates each against `WorkSchema`
 * (scripts/lib/schema.mjs), and writes:
 *   - `public/data/manifest.json` — a text-free index of every work, plus
 *     which shard file holds its full record.
 *   - `public/data/shard-N.json` — full `Work` records, at most
 *     `DEFAULT_SHARD_SIZE` (50) per shard.
 *
 * Also prints a warning to stderr (without failing the build) for any pair
 * of works whose normalised `title + author` collide — a likely duplicate.
 *
 * Usage:
 *   node scripts/build-manifest.mjs [inputDir] [outputDir] [--shard-size N]
 *
 * Source of truth: docs/architecture.md ("Manifest vs. shards"),
 * docs/content-schema.md ("Manifest index shape").
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { argv, exit, stderr } from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WorkSchema } from './lib/schema.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

export const DEFAULT_INPUT_DIR = join(REPO_ROOT, 'content', 'works');
export const DEFAULT_OUTPUT_DIR = join(REPO_ROOT, 'public', 'data');
export const DEFAULT_SHARD_SIZE = 50;
export const SCHEMA_VERSION = 1;

// -------- CLI argument parsing --------

/**
 * @param {string[]} args - argv slice (no `node`/script path entries)
 * @returns {{ inputDir: string, outputDir: string, shardSize: number }}
 */
export function parseArguments(args) {
  const positional = [];
  let shardSize = DEFAULT_SHARD_SIZE;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--shard-size' && i + 1 < args.length) {
      const parsed = Number.parseInt(args[i + 1], 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        shardSize = parsed;
      }
      i++;
    } else if (!arg.startsWith('--')) {
      positional.push(arg);
    }
  }

  return {
    inputDir: positional[0] ? resolve(positional[0]) : DEFAULT_INPUT_DIR,
    outputDir: positional[1] ? resolve(positional[1]) : DEFAULT_OUTPUT_DIR,
    shardSize,
  };
}

// -------- fuzzy dedupe --------

const LEADING_ARTICLE = /^(a|an|the)\s+/;

/**
 * Lowercase, strip punctuation, collapse whitespace.
 * @param {string} value
 * @returns {string}
 */
function normalize(value) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Normalised `title + author` key used for fuzzy duplicate detection:
 * lowercase, strip punctuation, strip a leading article from the title.
 * @param {{ title: string, author: string }} work
 * @returns {string}
 */
export function dedupeKey(work) {
  const title = normalize(work.title).replace(LEADING_ARTICLE, '');
  const author = normalize(work.author);
  return `${title}|${author}`;
}

/**
 * Group works by dedupeKey and return one warning message per group with
 * more than one member.
 * @param {Array<{ id: string, title: string, author: string }>} works
 * @returns {string[]}
 */
export function findFuzzyDuplicates(works) {
  /** @type {Map<string, string[]>} */
  const groups = new Map();

  for (const work of works) {
    const key = dedupeKey(work);
    const ids = groups.get(key) ?? [];
    ids.push(work.id);
    groups.set(key, ids);
  }

  const warnings = [];
  for (const [key, ids] of groups) {
    if (ids.length > 1) {
      warnings.push(
        `possible duplicate works (normalised title+author "${key}"): ${ids.join(', ')}`
      );
    }
  }
  return warnings;
}

// -------- reading + parsing content --------

/**
 * @param {string} inputDir
 * @returns {Promise<string[]>} absolute paths of `*.json` files, sorted
 */
async function listWorkFiles(inputDir) {
  let entries;
  try {
    entries = await readdir(inputDir, { withFileTypes: true });
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => join(inputDir, entry.name))
    .sort();
}

/**
 * Read and validate every work JSON file in `inputDir`.
 * Throws (with a descriptive message) if a file is not valid JSON or fails
 * `WorkSchema` — content validation is expected to have already run
 * (see docs/architecture.md, "Routine commit flow"), so a failure here means
 * the manifest step was invoked out of order.
 * @param {string} inputDir
 * @returns {Promise<import('zod').infer<typeof WorkSchema>[]>}
 */
export async function readWorks(inputDir) {
  const files = await listWorkFiles(inputDir);
  const works = [];

  for (const file of files) {
    let raw;
    try {
      raw = JSON.parse(await readFile(file, 'utf8'));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${file}: invalid JSON (${message})`);
    }

    const result = WorkSchema.safeParse(raw);
    if (!result.success) {
      const issues = result.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      throw new Error(`${file}: failed WorkSchema validation (${issues})`);
    }

    works.push(result.data);
  }

  return works;
}

// -------- manifest + shard assembly --------

/**
 * @typedef {{
 *   id: string, title: string, author: string, year: number, era: string,
 *   type: string, form: string, themes: string[], tags: string[],
 *   difficulty: number, length: { unit: string, value: number },
 *   textPolicy: string, shard: number
 * }} ManifestEntry
 */

/**
 * @param {import('zod').infer<typeof WorkSchema>} work
 * @returns {Omit<ManifestEntry, 'shard'>}
 */
function toManifestEntry(work) {
  return {
    id: work.id,
    title: work.title,
    author: work.author,
    year: work.year,
    era: work.era,
    type: work.type,
    form: work.form,
    themes: work.themes,
    tags: work.tags,
    difficulty: work.difficulty,
    length: work.length,
    textPolicy: work.textPolicy,
  };
}

/**
 * Sort works deterministically (by id), assign each a shard index, and build
 * the text-free manifest entries and the full-record shard groups.
 * @param {import('zod').infer<typeof WorkSchema>[]} works
 * @param {number} shardSize
 * @returns {{ manifestEntries: ManifestEntry[], shardGroups: Array<typeof works> }}
 */
export function assembleManifest(works, shardSize = DEFAULT_SHARD_SIZE) {
  const sorted = [...works].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  /** @type {Array<typeof works>} */
  const shardGroups = [];
  const manifestEntries = sorted.map((work, index) => {
    const shard = Math.floor(index / shardSize);
    if (!shardGroups[shard]) {
      shardGroups[shard] = [];
    }
    shardGroups[shard].push(work);
    return { ...toManifestEntry(work), shard };
  });

  return { manifestEntries, shardGroups };
}

// -------- main build --------

/**
 * Build the manifest + shards from `inputDir` and write them to
 * `outputDir`. Prints a stderr warning (non-fatal) for fuzzy duplicates.
 * @param {{ inputDir?: string, outputDir?: string, shardSize?: number }} [options]
 * @returns {Promise<{ manifest: object, shardGroups: Array<unknown[]>, warnings: string[] }>}
 */
export async function buildManifest(options = {}) {
  const {
    inputDir = DEFAULT_INPUT_DIR,
    outputDir = DEFAULT_OUTPUT_DIR,
    shardSize = DEFAULT_SHARD_SIZE,
  } = options;

  const works = await readWorks(inputDir);
  const warnings = findFuzzyDuplicates(works);
  const { manifestEntries, shardGroups } = assembleManifest(works, shardSize);

  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    // Deterministic: the newest dateAdded across works, so rebuilding without
    // content changes never dirties the tree.
    generatedAt: works.reduce((max, w) => {
      const d = String(w.pipeline?.dateAdded ?? '');
      return d > max ? d : max;
    }, '1970-01-01'),
    count: works.length,
    shards: shardGroups.length,
    works: manifestEntries,
  };

  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  for (let shard = 0; shard < shardGroups.length; shard++) {
    await writeFile(
      join(outputDir, `shard-${shard}.json`),
      `${JSON.stringify(shardGroups[shard], null, 2)}\n`
    );
  }

  for (const warning of warnings) {
    stderr.write(`[WARN] ${warning}\n`);
  }

  return { manifest, shardGroups, warnings };
}

async function main() {
  const { inputDir, outputDir, shardSize } = parseArguments(argv.slice(2));

  try {
    const { manifest, warnings } = await buildManifest({ inputDir, outputDir, shardSize });
    console.log(
      `[build-manifest] wrote ${manifest.count} work(s) across ${manifest.shards} shard(s) to ${outputDir}`
    );
    if (warnings.length > 0) {
      console.log(`[build-manifest] ${warnings.length} fuzzy-duplicate warning(s) (see above)`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr.write(`[ERROR] ${message}\n`);
    exit(1);
  }
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main();
}
