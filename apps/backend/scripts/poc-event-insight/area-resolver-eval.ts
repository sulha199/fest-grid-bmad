/**
 * Offline: resolve every area name the model produced in the recorded audience-area runs against the gazetteer and compare the
 * LEVEL the model labelled with the level the gazetteer gives. Not an accuracy test of the resolver (the sample gazetteer was written
 * after reading these names, so coverage here is fitted); it measures how far a model-assigned level can be trusted.
 *
 *   npx tsx scripts/poc-event-insight/area-resolver-eval.ts <audience-areas-*.json>... [--out report.md]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { buildIndex, normalizeAreaName, resolveAreas, SAMPLE_GAZETTEER } from './area-resolver.js';

const files = process.argv.slice(2).filter((a) => a.endsWith('.json'));
const outIdx = process.argv.indexOf('--out');
const ix = buildIndex(SAMPLE_GAZETTEER);
const MODEL_TO_ADMIN: Record<string, string> = { city: 'regency', regency: 'regency', province: 'province', country: 'country', neighborhood: 'locality', neighbourhood: 'locality', district: 'district' };

type Class = 'agrees' | 'wrong level' | 'ambiguous name' | 'definitional' | 'outside gazetteer';
interface Row { name: string; modelLevel: string; mentions: number; verdict: string; cls: Class }
const tally = new Map<string, Row>();
let mentions = 0;
for (const f of files) {
  const d = JSON.parse(readFileSync(f, 'utf8'));
  for (const r of d.records as Array<{ ok: boolean; out?: { areas?: Array<{ name: string; level: string }> } }>) {
    if (!r.ok || !r.out) continue;
    for (const a of r.out.areas ?? []) {
      mentions++;
      const key = `${normalizeAreaName(a.name)}|${a.level}`;
      const rs = resolveAreas(a.name, ix, 'widest');
      const first = rs[0];
      let verdict: string; let cls: Class;
      if (!first.ok) { verdict = `unresolved (${first.reason})`; cls = 'outside gazetteer'; }
      else if (first.area.level === 'aggregate') { verdict = `AGGREGATE of ${first.area.keys.length} areas — the model called it a ${a.level}`; cls = 'wrong level'; }
      else if (first.area.ambiguous) { verdict = `ambiguous: ${first.area.candidates.join(' | ')}`; cls = 'ambiguous name'; }
      else if ((MODEL_TO_ADMIN[a.level] ?? a.level) !== first.area.level) { verdict = `level differs: model ${a.level}, gazetteer ${first.area.level}`; cls = first.area.level === 'locality' ? 'wrong level' : 'definitional'; }
      else { verdict = 'agrees'; cls = 'agrees'; }
      const row = tally.get(key) ?? { name: a.name, modelLevel: a.level, mentions: 0, verdict, cls };
      row.mentions++; tally.set(key, row);
    }
  }
}
const rows = [...tally.values()].sort((a, b) => b.mentions - a.mentions);
const count = (c: Class) => rows.filter((r) => r.cls === c).reduce((n, r) => n + r.mentions, 0);
const lines = [`${mentions} area mentions, ${rows.length} distinct (name, model level) pairs, ${files.length} result files.`, '',
  `- agrees with the gazetteer: ${count('agrees')}`, `- model level WRONG (an aggregate called a province, or a locality called a city/regency): ${count('wrong level')}`,
  `- ambiguous name (the string names two places; needs a rule): ${count('ambiguous name')}`, `- definitional (both labels defensible, e.g. Jakarta is a city and a province): ${count('definitional')}`,
  `- outside the (Indonesian sample) gazetteer, would go to the geocoder: ${count('outside gazetteer')}`, '',
  '| name as written | model level | mentions | class | gazetteer verdict |', '|---|---|--:|---|---|', ...rows.map((r) => `| ${r.name} | ${r.modelLevel} | ${r.mentions} | ${r.cls} | ${r.verdict} |`)];
console.log(lines.join('\n'));
if (outIdx >= 0) writeFileSync(process.argv[outIdx + 1], lines.join('\n') + '\n');
