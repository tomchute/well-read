#!/usr/bin/env node

/**
 * validate-content.mjs
 * Validate every Work JSON file in a directory against WorkSchema
 * (scripts/lib/schema.mjs) plus cross-file gates the schema cannot express:
 *   - the file is valid JSON
 *   - `id` is unique across the directory
 *   - the filename (minus `.json`) equals `id`
 *
 * Usage:
 *   node scripts/validate-content.mjs               # validates content/works/
 *   node scripts/validate-content.mjs <directory>    # validates any directory (e.g. fixtures)
 *
 * Exits 0 (and prints a count) when every file passes; exits 1 and prints a
 * per-file violation list when any file fails.
 *
 * Source of truth for the gates: docs/content-schema.md.
 *
 * @typedef {{file: string, id: string | null, ok: boolean, errors: string[]}} FileResult
 * @typedef {{dir: string, total: number, results: FileResult[], ok: boolean}} ValidationReport
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorkSchema } from './lib/schema.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONTENT_DIR = path.resolve(__dirname, '..', 'content', 'works');

/**
 * Validate every `*.json` file in `dir` against WorkSchema plus the
 * cross-file gates (unique id, filename === id).
 * @param {string} dir
 * @returns {ValidationReport}
 */
export function validateDirectory(dir) {
  /** @type {FileResult[]} */
  const results = [];
  /** @type {string[]} */
  let files;
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  } catch (err) {
    throw new Error(`cannot read content directory "${dir}": ${err.message}`);
  }

  /** @type {Map<string, string[]>} */
  const idToFiles = new Map();

  for (const file of files) {
    const filePath = path.join(dir, file);
    /** @type {string[]} */
    const errors = [];
    /** @type {string | null} */
    let id = null;

    if (!statSync(filePath).isFile()) {
      continue;
    }

    let raw;
    try {
      raw = readFileSync(filePath, 'utf-8');
    } catch (err) {
      errors.push(`could not read file: ${err.message}`);
      results.push({ file, id, ok: false, errors });
      continue;
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      errors.push(`invalid JSON: ${err.message}`);
      results.push({ file, id, ok: false, errors });
      continue;
    }

    id = typeof data?.id === 'string' ? data.id : null;

    const parsed = WorkSchema.safeParse(data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const issuePath = issue.path.join('.') || '(root)';
        errors.push(`${issuePath}: ${issue.message}`);
      }
    }

    // Cross-file gate: filename (minus .json) must equal id.
    const stem = file.slice(0, -'.json'.length);
    if (id && stem !== id) {
      errors.push(`filename must equal id: filename is "${stem}", id is "${id}"`);
    }

    if (id) {
      const filesWithId = idToFiles.get(id) ?? [];
      filesWithId.push(file);
      idToFiles.set(id, filesWithId);
    }

    results.push({ file, id, ok: errors.length === 0, errors });
  }

  // Cross-file gate: id must be unique across the directory.
  for (const [id, filesWithId] of idToFiles) {
    if (filesWithId.length <= 1) continue;
    for (const result of results) {
      if (!filesWithId.includes(result.file)) continue;
      const others = filesWithId.filter((f) => f !== result.file);
      result.errors.push(`duplicate id "${id}": also used by ${others.join(', ')}`);
      result.ok = false;
    }
  }

  return {
    dir,
    total: results.length,
    results,
    ok: results.every((r) => r.ok),
  };
}

/**
 * Print a human-readable report for `report` to stdout.
 * @param {ValidationReport} report
 */
function printReport(report) {
  for (const result of report.results) {
    if (result.ok) {
      console.log(`PASS  ${result.file}`);
    } else {
      console.log(`FAIL  ${result.file}`);
      for (const error of result.errors) {
        console.log(`        - ${error}`);
      }
    }
  }

  const failCount = report.results.filter((r) => !r.ok).length;
  const plural = report.total === 1 ? '' : 's';
  if (report.ok) {
    console.log(`\n${report.total} work${plural} validated, all passed.`);
  } else {
    console.log(`\n${failCount} of ${report.total} work${plural} failed validation.`);
  }
}

function main() {
  const arg = process.argv[2];
  const dir = arg ? path.resolve(process.cwd(), arg) : DEFAULT_CONTENT_DIR;

  let report;
  try {
    report = validateDirectory(dir);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
    return;
  }

  printReport(report);
  process.exit(report.ok ? 0 : 1);
}

const isMainModule = path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] ?? '');
if (isMainModule) {
  main();
}
