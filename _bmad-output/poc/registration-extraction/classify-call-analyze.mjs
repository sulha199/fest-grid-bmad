// POC: scores private/classify-call-runs.jsonl (separate text-only stage call) against the hand labels, next to title rule v2 on the same rows.
//   node classify-call-analyze.mjs [--errors]    Writes out/classify-call-summary.json (aggregates only).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { classifyStage as rule } from './stage-classifier-v2.mjs';

const FULL = { E: 'event', Q: 'qualification', S: 'supporting', R: 'registration', U: 'submission', A: 'announcement', P: 'preparation', O: 'other' };
const merge = (s) => (s === 'qualification' || s === 'supporting' ? 'event' : s);
const COUNT = (s) => s === 'event';
const sample = JSON.parse(readFileSync('private/title-sample.json', 'utf8'));
const labels = Object.fromEntries(readFileSync('private/title-labels.txt', 'utf8').split(/\s+/).filter(Boolean).map((x) => { const m = /^(\d+)([EQSRUAPO])(\?)?$/.exec(x); return [+m[1], { stage: merge(FULL[m[2]]), unsure: !!m[3] }]; }));
const byKey = new Map(sample.map((r) => [`${r.en}|${r.t}|${r.s}`, r]));
const runs = readFileSync('private/classify-call-runs.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const ok = runs.filter((r) => r.ok && r.parsedOk);
const per = new Map(); // sample index -> stages across runs
let calls = ok.length, missing = 0;
for (const r of ok) for (const x of r.rows) {
  const s = byKey.get(`${x.en}|${x.t}|${x.s}`); if (!s) continue;
  if (!x.stage) { missing++; continue; }
  if (!per.has(s.i)) per.set(s.i, []); per.get(s.i).push(x.stage);
}
let n = 0, exact = 0, nSure = 0, exactSure = 0, bound = 0, ruleExact = 0, ruleSure = 0, unstable = 0, tpN = 0, fpN = 0, fnN = 0; const errs = [], conf = {};
for (const [i, st] of per) {
  const want = labels[i]; const row = sample.find((r) => r.i === i); const got = st[0]; n++;
  if (got === want.stage) exact++; else { errs.push(`${i}${want.unsure ? '?' : ''} want=${want.stage} got=${st.join('/')} rule=${rule(row.t)} :: ${String(row.t).slice(0, 80)}`); conf[`${want.stage} -> ${got}`] = (conf[`${want.stage} -> ${got}`] ?? 0) + 1; }
  if (COUNT(got) === COUNT(want.stage)) bound++;
  if (!want.unsure) { nSure++; if (got === want.stage) exactSure++; if (rule(row.t) === want.stage) ruleSure++; }
  if (rule(row.t) === want.stage) ruleExact++;
  if (new Set(st).size > 1) unstable++;
  const wantNon = !COUNT(want.stage), gotNon = !COUNT(got); if (wantNon && gotNon) tpN++; else if (!wantNon && gotNon) fpN++; else if (wantNon && !gotNon) fnN++;
}
const out = { calls, rowsScored: n, rowsWithNoStageReturned: missing, exact: `${exact}/${n}`, exactOnConfidentLabels: `${exactSure}/${nSure}`, ruleV2ExactOnSameRows: `${ruleExact}/${n}`, ruleV2OnConfidentLabels: `${ruleSure}/${nSure}`,
  countingBoundary: `${bound}/${n}`, nonCounting: { truePositive: tpN, falsePositive: fpN, missed: fnN }, rowsWithDifferentStageAcrossRuns: unstable, errorsByKind: conf,
  tokens: { promptAvg: Math.round(ok.reduce((a, r) => a + (r.usage?.promptTokens ?? 0), 0) / calls), outputAvg: Math.round(ok.reduce((a, r) => a + (r.usage?.outputTokens ?? 0), 0) / calls) } };
mkdirSync('out', { recursive: true }); writeFileSync('out/classify-call-summary.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
if (process.argv.includes('--errors')) console.log(errs.join('\n'));
