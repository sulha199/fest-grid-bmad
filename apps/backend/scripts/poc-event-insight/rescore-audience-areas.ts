/**
 * Offline: re-score recorded audience-area runs with and without the deterministic guards
 * (guardAudienceAreas). No Gemini calls.
 *
 *   npx tsx scripts/poc-event-insight/rescore-audience-areas.ts --results <audience-areas-*.json>... [--md <out.md>]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { loadCases } from './corpus.js';
import { EXISTING_AREA_LABELS, HOLDOUT_AREA_POSTS, NEW_AREA_POSTS, guardAudienceAreas, scoreAreas, type AreaLabel, type AudienceAreas } from './audience-areas.js';

function args(name: string): string[] {
  const out: string[] = [];
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return out;
  for (let j = i + 1; j < process.argv.length && !process.argv[j].startsWith('--'); j++) out.push(process.argv[j]);
  return out;
}

const known = new Map(loadCases('all').map((c) => [c.id, c.caption]));
const labels = new Map<string, { label: AreaLabel; caption: string }>();
for (const [id, label] of Object.entries(EXISTING_AREA_LABELS)) labels.set(id, { label, caption: known.get(id) as string });
for (const p of [...NEW_AREA_POSTS, ...HOLDOUT_AREA_POSTS]) labels.set(p.id, { label: p.label, caption: p.caption });

const files = args('results');
if (files.length === 0) throw new Error('--results <audience-areas-*.json>... is required');
const lines: string[] = ['| results file | runs | raw fully correct | guarded fully correct | raw wrong geoScope | guarded wrong geoScope | guard actions |', '|---|--:|--:|--:|--:|--:|--:|'];
const actionLog: string[] = [];
for (const file of files) {
  const data = JSON.parse(readFileSync(file, 'utf8')) as { prompt?: string; set?: string; records: Array<{ id: string; run: number; out?: AudienceAreas }> };
  let runs = 0, rawPass = 0, guardedPass = 0, rawScope = 0, guardedScope = 0, actions = 0;
  for (const r of data.records) {
    const l = labels.get(r.id);
    if (!r.out || !l) continue;
    runs++;
    const raw = scoreAreas(r.out, l.label, l.caption);
    const g = guardAudienceAreas(r.out, l.caption);
    const guarded = scoreAreas(g.out, l.label, l.caption);
    if (raw.pass) rawPass++;
    if (guarded.pass) guardedPass++;
    if (!raw.scope) rawScope++;
    if (!guarded.scope) guardedScope++;
    if (g.actions.length) { actions++; actionLog.push(`- ${file.split('/').pop()} ${r.id} run ${r.run}: ${g.actions.join('; ')} (raw ${raw.pass ? 'pass' : 'fail'} -> guarded ${guarded.pass ? 'pass' : 'fail'})`); }
  }
  lines.push(`| ${file.split('/').pop()} | ${runs} | ${rawPass}/${runs} | ${guardedPass}/${runs} | ${rawScope} | ${guardedScope} | ${actions} |`);
}
const text = [...lines, '', '### Guard actions', '', ...(actionLog.length ? actionLog : ['(none)'])].join('\n');
console.log(text);
const md = (args('md'))[0];
if (md) writeFileSync(md, `# Audience-area guards, re-scored offline (generated)\n\n${text}\n`);
