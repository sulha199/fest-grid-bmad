// POC: re-weights the hand-labelled sample to the whole pool of unique stored titles (the sample over-represents non-event titles on purpose).
// Strata = the three draw buckets of make-title-sample.mjs (v1 non-event, v1 event with a weak keyword, v1 event without). Estimates, for a rule,
// how many titles of the pool are truly non-counting, and the precision and recall of its non-counting flag. Small strata make these wide.
//   node estimate-pool.mjs [--rule ./stage-classifier-v2.mjs]
import { readFileSync } from 'node:fs';
import { classifyStage as v1 } from './stage-classifier.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const { classifyStage } = await import(arg('rule', './stage-classifier-v2.mjs'));
const weak = /(pendaftaran|daftar|regist|tiket|ticket|final|babak|pengumuman|announce|batch|gelombang|deadline|submission|submit|meeting|workshop|talk|seminar|gladi|check|redeem|open|closing|sale|promo|early|presale|seleksi|audisi|kurasi|penyisihan|juara|winner|hasil|result|pengumpulan|racepack|race pack|briefing|bazaar|pre-?event|day \d|hari)/i;
const COUNT = new Set(['event', 'qualification', 'supporting']);
const FULL = { E: 'event', Q: 'qualification', S: 'supporting', R: 'registration', U: 'submission', A: 'announcement', P: 'preparation', O: 'other' };
const labels = Object.fromEntries(readFileSync('private/title-labels.txt', 'utf8').split(/\s+/).filter(Boolean).map((x) => { const m = /^(\d+)([EQSRUAPO])(\?)?/.exec(x); return [+m[1], m[3] ? null : FULL[m[2]]]; })); // null = unsure label, left out of the estimate
const sample = JSON.parse(readFileSync('private/title-sample.json', 'utf8'));
const rows = readFileSync('private/prod-schedule-titles.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const seen = new Set(); const pool = [];
for (const r of rows) { const k = String(r.t ?? '').trim().toLowerCase(); if (!k || k.length > 120 || seen.has(k)) continue; seen.add(k); pool.push(r.t); }
const stratum = (t) => (v1(t) !== 'event' ? 'nonEvent' : weak.test(t) ? 'eventWeak' : 'eventPlain');
const nUnsure = Object.values(labels).filter((x) => !x).length;
const W = {}; pool.forEach((t) => { const s = stratum(t); W[s] = (W[s] ?? 0) + 1; });
const N = {}; sample.forEach((r) => { const s = stratum(r.t); N[s] = (N[s] ?? 0) + 1; });
let tp = 0, fp = 0, fn = 0, truth = 0;
for (const r of sample) {
  if (!labels[r.i]) continue;
  const w = W[stratum(r.t)] / N[stratum(r.t)];
  const wantNon = !COUNT.has(labels[r.i]), gotNon = !COUNT.has(classifyStage(r.t));
  if (wantNon) truth += w;
  if (wantNon && gotNon) tp += w; else if (!wantNon && gotNon) fp += w; else if (wantNon && !gotNon) fn += w;
}
console.log(JSON.stringify({ unsureLabelsLeftOut: nUnsure, poolUniqueTitles: pool.length, strata: W, sampled: N, estimatedTrulyNonCounting: Math.round(truth), estimatedFlagged: Math.round(tp + fp), precision: +(tp / (tp + fp)).toFixed(3), recall: +(tp / (tp + fn)).toFixed(3), estimatedFalsePositives: Math.round(fp), estimatedMissed: Math.round(fn) }, null, 1));
