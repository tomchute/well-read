#!/usr/bin/env node

/**
 * report-coverage.mjs
 *
 * Reads `content/works/*.json` and reports coverage by era, form, gender,
 * geography, and theme to help guide curation batch focus.
 *
 * Usage:
 *   node scripts/report-coverage.mjs [inputDir] [--json]
 *
 * Outputs a human-readable table by default, or JSON with `--json`.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { argv, exit, stderr } from 'node:process';
import { WorkSchema } from './lib/schema.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const DEFAULT_INPUT_DIR = join(REPO_ROOT, 'content', 'works');

// -------- targets from docs/editorial-policy.md --------

const TARGETS = {
  eras: {
    'pre-1900': 0.4,
    '1900-1970': 0.3,
    'post-1970': 0.3,
  },
  forms: {
    poem: 0.4,
    short_story: 0.25,
    book: 0.25,
    essay: 0.05,
    play: 0.05,
  },
  gender: {
    womenAndNonBinary: 0.4, // >= 40%
  },
  geography: {
    outsideUSUK: 0.3, // >= 30%
  },
  authorCap: 3, // max 3 per author until 150 works
};

// -------- aggregation function (exportable for testing) --------

/**
 * Parse all works from an input directory and aggregate coverage metrics.
 * @param {string} inputDir
 * @returns {Promise<{works: any[], metrics: {[key: string]: any}, missingMetadata: string[]}>}
 */
export async function aggregateCoverage(inputDir) {
  const works = [];
  const missingMetadata = [];

  // List and parse all JSON files
  let entries;
  try {
    entries = await readdir(inputDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      entries = [];
    } else {
      throw error;
    }
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;

    const filePath = join(inputDir, entry.name);
    let raw;
    try {
      raw = JSON.parse(await readFile(filePath, 'utf8'));
    } catch (_error) {
      stderr.write(`[WARN] ${filePath}: invalid JSON\n`);
      continue;
    }

    const result = WorkSchema.safeParse(raw);
    if (!result.success) {
      stderr.write(`[WARN] ${filePath}: failed validation (${result.error.issues.map((i) => i.message).join('; ')})\n`);
      continue;
    }

    works.push(result.data);

    // Track missing author metadata
    if (!result.data.authorGender) {
      missingMetadata.push(result.data.id);
    }
  }

  // Calculate era bucket
  function getEraBucket(era) {
    if (['ancient', 'medieval', 'renaissance', '18th_century', '19th_century'].includes(era)) {
      return 'pre-1900';
    }
    if (['early_20th_century', 'mid_20th_century'].includes(era)) {
      return '1900-1970';
    }
    return 'post-1970';
  }

  // Aggregate metrics
  const metrics = {
    totalWorks: works.length,
    eraDistribution: {},
    formDistribution: {},
    textPolicyDistribution: {},
    themeDistribution: {},
    genderDistribution: {},
    regionDistribution: {},
    authorCounts: {},
  };

  // Count by era
  for (const era of Object.keys(TARGETS.eras)) {
    metrics.eraDistribution[era] = 0;
  }

  // Count by form
  for (const form of Object.keys(TARGETS.forms)) {
    metrics.formDistribution[form] = 0;
  }

  // Count by textPolicy
  metrics.textPolicyDistribution = { full: 0, excerpt: 0, pending: 0 };

  // Count by gender
  metrics.genderDistribution = { woman: 0, man: 0, 'non-binary': 0, unknown: 0 };

  // Count by region
  metrics.regionDistribution = { 'US/UK': 0, other: 0, unknown: 0 };

  // Aggregate
  const themeFreq = {};
  for (const work of works) {
    // Era
    const bucket = getEraBucket(work.era);
    metrics.eraDistribution[bucket]++;

    // Form (type)
    metrics.formDistribution[work.type] = (metrics.formDistribution[work.type] || 0) + 1;

    // TextPolicy
    metrics.textPolicyDistribution[work.textPolicy]++;

    // Themes
    for (const theme of work.themes) {
      themeFreq[theme] = (themeFreq[theme] || 0) + 1;
    }

    // Gender
    const gender = work.authorGender || 'unknown';
    metrics.genderDistribution[gender]++;

    // Region
    const region = work.authorRegion
      ? work.authorRegion.match(/^(US|UK|United States|United Kingdom)$/i)
        ? 'US/UK'
        : 'other'
      : 'unknown';
    metrics.regionDistribution[region]++;

    // Author counts
    const author = work.author;
    metrics.authorCounts[author] = (metrics.authorCounts[author] || 0) + 1;
  }

  // Sort themes by frequency, keep top 12
  metrics.topThemes = Object.entries(themeFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .reduce((acc, [theme, count]) => {
      acc[theme] = count;
      return acc;
    }, {});

  return { works, metrics, missingMetadata };
}

// -------- CLI + formatting --------

/**
 * Mark status as OK/LOW/HIGH vs target
 * @param {number} current
 * @param {number} target
 * @param {boolean} isMinimum - if true, treat as >= requirement; else as exact target
 * @returns {string}
 */
function getStatus(current, target, isMinimum = false) {
  const tolerance = 0.05;
  const diff = current - target;

  if (isMinimum) {
    // For minimums (gender, geography), LOW if below, OK if at or above
    return diff >= 0 ? 'OK' : 'LOW';
  }

  // For approximate targets (era, form), allow 5% tolerance
  if (Math.abs(diff) <= tolerance) {
    return 'OK';
  }
  return diff < 0 ? 'LOW' : 'HIGH';
}

/**
 * Format metrics as a human-readable table
 * @param {any} metrics
 * @param {string[]} missingMetadata
 * @returns {string}
 */
function formatTable(metrics, missingMetadata) {
  const lines = [];

  lines.push('=== COVERAGE REPORT ===\n');
  lines.push(`Total works: ${metrics.totalWorks}\n`);

  // Era distribution
  lines.push('\n--- Era Distribution ---');
  for (const [era, target] of Object.entries(TARGETS.eras)) {
    const count = metrics.eraDistribution[era];
    const pct = metrics.totalWorks ? (count / metrics.totalWorks) * 100 : 0;
    const targetPct = target * 100;
    const status = getStatus(pct / 100, target);
    lines.push(`${era.padEnd(12)} ${count.toString().padStart(3)} (${pct.toFixed(1)}%) Target: ${targetPct.toFixed(0)}% [${status}]`);
  }

  // Form distribution
  lines.push('\n--- Form Distribution ---');
  for (const [form, target] of Object.entries(TARGETS.forms)) {
    const count = metrics.formDistribution[form] || 0;
    const pct = metrics.totalWorks ? (count / metrics.totalWorks) * 100 : 0;
    const targetPct = target * 100;
    const status = getStatus(pct / 100, target);
    lines.push(`${form.padEnd(12)} ${count.toString().padStart(3)} (${pct.toFixed(1)}%) Target: ${targetPct.toFixed(0)}% [${status}]`);
  }

  // TextPolicy distribution
  lines.push('\n--- Text Policy Distribution ---');
  for (const policy of ['full', 'excerpt', 'pending']) {
    const count = metrics.textPolicyDistribution[policy];
    const pct = metrics.totalWorks ? (count / metrics.totalWorks) * 100 : 0;
    lines.push(`${policy.padEnd(12)} ${count.toString().padStart(3)} (${pct.toFixed(1)}%)`);
  }

  // Top 12 themes
  lines.push('\n--- Top 12 Themes ---');
  for (const [theme, count] of Object.entries(metrics.topThemes)) {
    const pct = metrics.totalWorks ? (count / metrics.totalWorks) * 100 : 0;
    lines.push(`${theme.padEnd(20)} ${count.toString().padStart(3)} (${pct.toFixed(1)}%)`);
  }

  // Gender distribution
  lines.push('\n--- Author Gender Distribution ---');
  const womenNonBinary = (metrics.genderDistribution.woman || 0) + (metrics.genderDistribution['non-binary'] || 0);
  const womenNonBinaryPct = metrics.totalWorks ? (womenNonBinary / metrics.totalWorks) * 100 : 0;
  const targetGenderPct = TARGETS.gender.womenAndNonBinary * 100;
  const genderStatus = getStatus(womenNonBinaryPct / 100, TARGETS.gender.womenAndNonBinary, true);
  lines.push(`Women/Non-binary  ${womenNonBinary.toString().padStart(3)} (${womenNonBinaryPct.toFixed(1)}%) Target: >= ${targetGenderPct.toFixed(0)}% [${genderStatus}]`);
  lines.push(`Men               ${(metrics.genderDistribution.man || 0).toString().padStart(3)} (${metrics.totalWorks ? ((metrics.genderDistribution.man / metrics.totalWorks) * 100).toFixed(1) : 0}%)`);
  lines.push(`Unknown           ${(metrics.genderDistribution.unknown || 0).toString().padStart(3)} (${metrics.totalWorks ? ((metrics.genderDistribution.unknown / metrics.totalWorks) * 100).toFixed(1) : 0}%)`);

  // Region distribution
  lines.push('\n--- Author Region Distribution ---');
  const outsideUSUKPct = metrics.totalWorks ? (metrics.regionDistribution.other / metrics.totalWorks) * 100 : 0;
  const targetRegionPct = TARGETS.geography.outsideUSUK * 100;
  const regionStatus = getStatus(outsideUSUKPct / 100, TARGETS.geography.outsideUSUK, true);
  lines.push(`Outside US/UK     ${metrics.regionDistribution.other.toString().padStart(3)} (${outsideUSUKPct.toFixed(1)}%) Target: >= ${targetRegionPct.toFixed(0)}% [${regionStatus}]`);
  lines.push(`US/UK             ${metrics.regionDistribution['US/UK'].toString().padStart(3)} (${metrics.totalWorks ? ((metrics.regionDistribution['US/UK'] / metrics.totalWorks) * 100).toFixed(1) : 0}%)`);
  lines.push(`Unknown           ${metrics.regionDistribution.unknown.toString().padStart(3)} (${metrics.totalWorks ? ((metrics.regionDistribution.unknown / metrics.totalWorks) * 100).toFixed(1) : 0}%)`);

  // Author cap
  lines.push('\n--- Author Cap (max 3 until 150 works) ---');
  const overCap = Object.entries(metrics.authorCounts)
    .filter(([_, count]) => count > TARGETS.authorCap && metrics.totalWorks < 150)
    .map(([author, count]) => `${author} (${count})`)
    .sort();

  if (overCap.length > 0) {
    lines.push('Authors over cap: ' + overCap.join(', ') + ' [HIGH]');
  } else {
    lines.push('All authors within cap [OK]');
  }

  // Find most under-target dimensions
  const underTargets = [];

  // Check era for lowest
  const eraPercents = Object.entries(TARGETS.eras).map(([era, target]) => ({
    name: `era: ${era}`,
    current: metrics.totalWorks ? metrics.eraDistribution[era] / metrics.totalWorks : 0,
    target,
  }));
  const lowestEra = eraPercents.reduce((a, b) => (a.current - a.target < b.current - b.target ? a : b));
  if (lowestEra.current < lowestEra.target) {
    underTargets.push({ name: lowestEra.name, deficit: lowestEra.target - lowestEra.current });
  }

  // Check form for lowest
  const formPercents = Object.entries(TARGETS.forms).map(([form, target]) => ({
    name: `form: ${form}`,
    current: metrics.totalWorks ? (metrics.formDistribution[form] || 0) / metrics.totalWorks : 0,
    target,
  }));
  const lowestForm = formPercents.reduce((a, b) => (a.current - a.target < b.current - b.target ? a : b));
  if (lowestForm.current < lowestForm.target) {
    underTargets.push({ name: lowestForm.name, deficit: lowestForm.target - lowestForm.current });
  }

  // Check gender
  if (womenNonBinaryPct / 100 < TARGETS.gender.womenAndNonBinary) {
    underTargets.push({ name: 'gender: women/non-binary', deficit: TARGETS.gender.womenAndNonBinary - womenNonBinaryPct / 100 });
  }

  // Check geography
  if (outsideUSUKPct / 100 < TARGETS.geography.outsideUSUK) {
    underTargets.push({ name: 'geography: outside US/UK', deficit: TARGETS.geography.outsideUSUK - outsideUSUKPct / 100 });
  }

  // Sort by deficit and get top 2
  const topUnderTargets = underTargets.sort((a, b) => b.deficit - a.deficit).slice(0, 2);

  lines.push('\n--- Suggested Focus for Next Batch ---');
  if (topUnderTargets.length > 0) {
    lines.push(topUnderTargets.map((t) => t.name).join(', '));
  } else {
    lines.push('All dimensions on target or above.');
  }

  // Missing metadata
  if (missingMetadata.length > 0) {
    lines.push(`\n--- Missing Author Metadata (gender) ---`);
    lines.push(`${missingMetadata.length} works lack authorGender: ${missingMetadata.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Format metrics as JSON
 * @param {any} metrics
 * @param {string[]} missingMetadata
 * @returns {string}
 */
function formatJSON(metrics, missingMetadata) {
  return JSON.stringify(
    {
      metrics,
      targets: TARGETS,
      missingMetadata,
    },
    null,
    2
  );
}

// -------- main CLI --------

async function main() {
  // Parse arguments
  const positional = [];
  let useJSON = false;

  for (const arg of argv.slice(2)) {
    if (arg === '--json') {
      useJSON = true;
    } else if (!arg.startsWith('--')) {
      positional.push(arg);
    }
  }

  const inputDir = positional[0] ? resolve(positional[0]) : DEFAULT_INPUT_DIR;

  try {
    const { metrics, missingMetadata } = await aggregateCoverage(inputDir);

    if (useJSON) {
      console.log(formatJSON(metrics, missingMetadata));
    } else {
      console.log(formatTable(metrics, missingMetadata));
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
