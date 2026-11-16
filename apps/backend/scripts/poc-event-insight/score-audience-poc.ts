#!/usr/bin/env tsx
/**
 * Scorer for the audience, language and taxonomy POC (plan §5). Reads the labels and the saved model runs; prints and writes counts, enum values and
 * post ids only (no caption is read, even though the label sheet contains one).
 *
 *   cd apps/backend
 *   npx tsx scripts/poc-event-insight/score-audience-poc.ts --labels scripts/poc-event-insight/local/label-sheet-claude-tuning.csv     (tuning half: no gate)
 *   npx tsx scripts/poc-event-insight/score-audience-poc.ts --labels scripts/poc-event-insight/local/labels-final.csv --half heldout   (gated: the labels must hash to the frozen value)
 *
 * Options: --runs <file> (default local/extraction-runs.local.json) · --half tuning|heldout|all (default tuning; selects the posts by the fixed hash of the URL
 * recorded in the run file's ids) · --out <file> (default local/audience-poc-report-<half>.local.md).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatReport, score } from './audience-poc-score-lib.js';
import { runGate, type RunRecord } from './audience-poc-lib.js';
import { halfOf, parseCsv, postId, type SourcePost } from './label-sheets-lib.js';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (name: string, fallback?: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

function main(): void {
  const local = resolve(arg('dir', join(here, 'local'))!);
  const half = (arg('half', 'tuning') as 'tuning' | 'heldout' | 'all');
  if (!['tuning', 'heldout', 'all'].includes(half)) throw new Error('--half must be tuning, heldout or all');
  const labelsPath = resolve(arg('labels') ?? (() => { throw new Error('missing --labels <csv>'); })());
  const runsPath = resolve(arg('runs', join(local, 'extraction-runs.local.json'))!);
  if (!existsSync(labelsPath)) throw new Error(`no such labels file: ${labelsPath}`);
  if (!existsSync(runsPath)) throw new Error(`no run file: ${runsPath} (run run-audience-poc.ts first)`);

  const hashFile = join(local, 'labels-frozen.sha256');
  const gate = runGate(half, { sheetContent: readFileSync(labelsPath), hashFileContent: existsSync(hashFile) ? readFileSync(hashFile, 'utf8') : undefined });
  if (!gate.allowed) throw new Error(gate.reason);

  // The half of each id comes from the posts file (id = hash of the URL); the label sheet itself is not trusted to say.
  const posts = JSON.parse(readFileSync(join(local, 'poc-posts.local.json'), 'utf8')) as SourcePost[];
  const halfById = new Map(posts.map((p) => [postId(p.url), halfOf(p.url)]));
  const labels = parseCsv(readFileSync(labelsPath, 'utf8'))
    .filter((r) => r.id && (half === 'all' || halfById.get(r.id) === half))
    .map(({ caption: _caption, hashtags: _hashtags, tagged_place: _place, ...rest }) => rest); // drop third-party text at once
  const records = (JSON.parse(readFileSync(runsPath, 'utf8')).records ?? []) as RunRecord[];

  const report = score(labels, records);
  const text = formatReport(report, `Audience, language and taxonomy POC: ${half} half`);
  const out = resolve(arg('out', join(local, `audience-poc-report-${half}.local.md`))!);
  writeFileSync(out, text);
  process.stdout.write(text + `\nwritten to ${out}\n`);
}

try { main(); } catch (e) { process.stderr.write(`error: ${(e as Error).message}\n`); process.exit(1); }
