#!/usr/bin/env tsx
/**
 * Label sheets for the audience/language/taxonomy POC. Runs on the owner's machine; everything it reads and writes is in the git-ignored local folder.
 *
 *   cd apps/backend
 *   npx tsx scripts/poc-event-insight/label-sheets.ts make --labeller owner --half all          one sheet per labeller (open it in a spreadsheet)
 *   npx tsx scripts/poc-event-insight/label-sheets.ts make --labeller wife  --half heldout
 *   npx tsx scripts/poc-event-insight/label-sheets.ts check --sheet local/label-sheet-owner.csv  what is blank or not an allowed value
 *   npx tsx scripts/poc-event-insight/label-sheets.ts compare --a local/label-sheet-owner.csv --b local/label-sheet-wife.csv
 *   npx tsx scripts/poc-event-insight/label-sheets.ts freeze --sheet local/labels-final.csv     writes the hash to commit; the content stays local
 *
 * The sheets hold third-party captions (so the labeller can read them). check, compare and freeze print post ids, label values and counts only.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { adjudicationRows, compareSheets, formatComparison, makeSheetRows, parseCsv, SHEET_COLUMNS, toCsv, validateSheet, type SourcePost } from './label-sheets-lib.js';

const here = dirname(fileURLToPath(import.meta.url));
const log = (s: string) => process.stdout.write(s + '\n');

function arg(argv: string[], name: string, fallback?: string): string {
  const i = argv.indexOf(`--${name}`);
  if (i >= 0 && argv[i + 1]) return argv[i + 1];
  if (fallback !== undefined) return fallback;
  throw new Error(`missing --${name}`);
}

function readSheet(path: string): Array<Record<string, string>> {
  if (!existsSync(path)) throw new Error(`no such sheet: ${path}`);
  return parseCsv(readFileSync(path, 'utf8'));
}

function main(): void {
  const [cmd, ...rest] = process.argv.slice(2);
  const dir = resolve(arg(rest, 'dir', join(here, 'local')));
  if (cmd === 'make') {
    const labeller = arg(rest, 'labeller').replace(/[^a-z0-9_-]/gi, '');
    const half = arg(rest, 'half', 'all') as 'all' | 'heldout' | 'tuning';
    if (!['all', 'heldout', 'tuning'].includes(half)) throw new Error('--half must be all, heldout or tuning');
    const postsFile = join(dir, 'poc-posts.local.json');
    if (!existsSync(postsFile)) throw new Error(`no ${postsFile}: run fetch-poc-posts.ts first`);
    const posts = JSON.parse(readFileSync(postsFile, 'utf8')) as SourcePost[];
    const rows = makeSheetRows(posts, half);
    mkdirSync(dir, { recursive: true });
    const out = join(dir, `label-sheet-${labeller}.csv`);
    if (existsSync(out) && !rest.includes('--overwrite')) throw new Error(`${out} exists; pass --overwrite to replace it (a filled sheet would be lost)`);
    writeFileSync(out, toCsv(SHEET_COLUMNS, rows));
    log(`${rows.length} posts (${half}) written to ${out}. Follow labelling-guide-2026-10-21.md; delete the file when the POC ends.`);
  } else if (cmd === 'check') {
    const rows = readSheet(resolve(arg(rest, 'sheet')));
    const problems = validateSheet(rows);
    const unlabelled = problems.filter((p) => p.problem === 'not labelled').length;
    log(`${rows.length} rows, ${unlabelled} not labelled, ${problems.length - unlabelled} other problems`);
    for (const p of problems.filter((x) => x.problem !== 'not labelled').slice(0, 60)) log(`  ${p.id}  ${p.field}: ${p.problem}`);
    if (problems.length > 60) log(`  ... ${problems.length - 60} more`);
    process.exitCode = problems.length ? 1 : 0;
  } else if (cmd === 'compare') {
    const a = readSheet(resolve(arg(rest, 'a')));
    const b = readSheet(resolve(arg(rest, 'b')));
    for (const [name, rows] of [['A', a], ['B', b]] as const) {
      const bad = validateSheet(rows).filter((p) => p.problem !== 'not labelled');
      if (bad.length) log(`warning: sheet ${name} has ${bad.length} problems (run check first)`);
    }
    const c = compareSheets(a, b);
    log(formatComparison(c));
    const out = join(dir, 'label-disagreements.local.csv');
    writeFileSync(out, toCsv(['id', 'field', 'labeller_a', 'labeller_b', 'final'], adjudicationRows(c.disagreements)));
    log(`adjudication sheet (ids and values, no captions): ${out}`);
  } else if (cmd === 'freeze') {
    const file = resolve(arg(rest, 'sheet'));
    const hash = createHash('sha256').update(readFileSync(file)).digest('hex');
    const out = join(dir, 'labels-frozen.sha256');
    writeFileSync(out, `${hash}  ${file.split(/[\\/]/).pop()}\n`);
    log(`sha256 ${hash}\nwritten to ${out}. Commit this hash (not the labels) before any model run; the labels are final.`);
  } else {
    log('usage: label-sheets.ts make|check|compare|freeze (see the header of this file)');
    process.exitCode = 2;
  }
}

try { main(); } catch (e) { process.stderr.write(`error: ${(e as Error).message}\n`); process.exit(1); }
