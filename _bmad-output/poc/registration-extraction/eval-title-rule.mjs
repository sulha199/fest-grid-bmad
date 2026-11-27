// POC: scores a title -> stage rule against the hand labels (private/title-labels.txt, private/title-sample.json). One reader (the author), labelled blind to the rule.
//   node eval-title-rule.mjs [--rule ./stage-classifier.mjs] [--split odd|even|all] [--errors]
// Reports 8-way accuracy and the functional boundary that matters downstream: counting (event, qualification, supporting) vs not counting.
import { readFileSync } from 'node:fs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const mod = await import(arg('rule', './stage-classifier.mjs'));
const split = arg('split', 'all');
const FULL = { E: 'event', Q: 'qualification', S: 'supporting', R: 'registration', U: 'submission', A: 'announcement', P: 'preparation', O: 'other' };
const COUNT = new Set(['event', 'qualification', 'supporting']);
const sample = JSON.parse(readFileSync('private/title-sample.json', 'utf8'));
const labels = Object.fromEntries(readFileSync('private/title-labels.txt', 'utf8').split(/\s+/).filter(Boolean).map((x) => { const m = /^(\d+)([EQSRUAPO])(\?)?$/.exec(x); return [+m[1], { stage: FULL[m[2]], unsure: !!m[3] }]; }));
if (process.argv.includes('--merge')) for (const l of Object.values(labels)) if (l.stage === 'qualification' || l.stage === 'supporting') l.stage = 'event'; // rule has no separate qualification/supporting
const rows = sample.filter((r) => labels[r.i] && (split === 'all' || (split === 'odd') === (r.i % 2 === 1)));
let ok = 0, okSure = 0, nSure = 0, bOk = 0; const conf = {}, errs = [];
for (const r of rows) {
  const got = mod.classifyStage(r.t), want = labels[r.i];
  if (got === want.stage) ok++;
  if (!want.unsure) { nSure++; if (got === want.stage) okSure++; }
  if (COUNT.has(got) === COUNT.has(want.stage)) bOk++;
  const k = `${want.stage} -> ${got}`; if (got !== want.stage) conf[k] = (conf[k] ?? 0) + 1;
  if (got !== want.stage) errs.push(`${r.i}${want.unsure ? '?' : ''} want=${want.stage} got=${got} :: ${String(r.t).slice(0, 80)}`);
}
console.log(JSON.stringify({ split, rows: rows.length, exact: `${ok}/${rows.length}`, exactOnConfidentLabels: `${okSure}/${nSure}`, countingBoundary: `${bOk}/${rows.length}`, nonCountingWanted: rows.filter((r) => !COUNT.has(labels[r.i].stage)).length, errorsByKind: conf }, null, 1));
if (process.argv.includes('--errors')) console.log(errs.join('\n'));
