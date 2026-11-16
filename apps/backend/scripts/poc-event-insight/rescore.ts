/**
 * Offline: re-score a results-*.json from run.ts with the deterministic guards applied (no API
 * calls). Shows what the same model output looks like once guards.ts has verified it against the
 * source text — i.e. the quality a pipeline that persists only guarded insights would see.
 *
 *   npx tsx scripts/poc-event-insight/rescore.ts --results <results.json> [--variant standalone] [--md <out.md>]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { loadCases } from './corpus.js';
import { applyGuards } from './guards.js';
import { summarise, type CallRecord } from './report.js';
import { scoreInsight } from './score.js';

function arg(name: string): string | undefined { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }
const path = arg('results');
if (!path) throw new Error('--results <results-*.json> is required');
const variant = arg('variant') ?? 'standalone';
const data = JSON.parse(readFileSync(path, 'utf8')) as { promptVersion?: string; model: string; records: CallRecord[] };
const cases = new Map(loadCases('all').map((c) => [c.id, c]));

const mine = data.records.filter((r) => r.variant === variant && r.model === data.model && r.insight);
const actionCounts = new Map<string, number>();
const guarded: CallRecord[] = mine.map((r) => {
  const c = cases.get(r.caseId)!;
  const g = applyGuards(r.insight!, c.caption);
  for (const a of g.actions) { const k = a.replace(/=\d+/g, '').replace(/\(s\)/, ''); actionCounts.set(k, (actionCounts.get(k) ?? 0) + 1); }
  return { ...r, insight: g.insight, score: scoreInsight(g.insight, c.label, c.caption) };
});

const lines = [
  `## Guards applied offline — ${variant}, prompt ${data.promptVersion ?? 'v1'}, ${data.model}`, '',
  summarise('Raw model output (as returned)', mine), '',
  summarise('After deterministic guards', guarded), '',
  '#### Guard actions taken', '', ...[...actionCounts].map(([k, v]) => `- ${k}: ${v}×`),
];
const text = lines.join('\n');
console.log(text);
const md = arg('md');
if (md) writeFileSync(md, `${text}\n`);
