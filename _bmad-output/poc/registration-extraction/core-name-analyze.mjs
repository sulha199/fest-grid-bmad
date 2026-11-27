// POC: scores private/core-name-runs.jsonl. Writes out/core-name-summary.json (aggregates only).
//   node core-name-analyze.mjs [--detail]
// Gold = which events belong to the same series (written before the model output was read, from names and dates). Scored on pairs: two events are "same"
// when their normalised core names are equal. Compared with two baselines: the raw name (normalised), and a code rule that strips activity words.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const NL = String.fromCharCode(10);
const detail = process.argv.includes('--detail');
const items = readFileSync('private/core-name-set.jsonl', 'utf8').trim().split(NL).map((l, i) => ({ n: i + 1, ...JSON.parse(l) }));
const runs = readFileSync('private/core-name-runs.jsonl', 'utf8').trim().split(NL).map((l) => JSON.parse(l)).filter((r) => r.ok);

// gold groups (index = line number of core-name-set.jsonl)
const GROUPS = {
  erafone: [3, 10, 12, 18, 27, 31, 32, 33, 37, 39, 42, 43, 44, 46, 47, 50, 51, 54, 55, 59, 63, 67, 68, 69, 70, 71, 72, 73, 74],
  lingkarMerapi: [2, 5, 6, 9, 16, 22, 23, 26, 29, 60, 77, 84],
  plnElectric: [1, 17, 20], biosferun: [11, 24, 25, 36, 40, 45, 49], k24: [14, 19, 34, 35, 52, 57, 58, 61, 62, 64, 66],
  runPalestine: [13, 38, 53], kulinerun: [8, 28, 56], sembada: [15, 30], runHas: [48, 65, 75, 76],
};
const goldOf = new Map(items.map((i) => [i.n, `single-${i.n}`]));
for (const [g, ns] of Object.entries(GROUPS)) for (const n of ns) goldOf.set(n, g);

const norm = (s) => String(s ?? '').toLowerCase().replace(/\b20\d\d\b/g, ' ').replace(/\b(yogyakarta|jogja|series|chapter)\b/g, ' ').replace(/[^a-z0-9]+/g, '');
const ACTIVITY = /(race\s?pack( collection)?|racepack( collection)?|\brpc\b|registration|pendaftaran|early\s?bird|technical meeting|bib transfer|awarding|announcement|day\s?\d+|- music performance|- e-waste exchange|healt.*$|\(.*?\))/gi;
const rule = (s) => String(s ?? '').replace(ACTIVITY, ' ');

function score(keyOf) {
  let tp = 0, fp = 0, fn = 0;
  for (let a = 0; a < items.length; a++) for (let b = a + 1; b < items.length; b++) {
    const x = items[a], y = items[b];
    const gold = goldOf.get(x.n) === goldOf.get(y.n);
    const kx = keyOf(x), ky = keyOf(y);
    const pred = !!kx && kx === ky;
    if (pred && gold) tp++; else if (pred) fp++; else if (gold) fn++;
  }
  // does each activity event (race pack and friends) find at least one event of its own series, and no event of another?
  let found = 0, wrong = 0, total = 0;
  for (const x of items.filter((i) => i.role === 'activity' && !String(goldOf.get(i.n)).startsWith('single'))) {
    total++;
    const same = items.filter((y) => y.n !== x.n && y.role !== 'activity' && keyOf(y) && keyOf(y) === keyOf(x));
    if (same.some((y) => goldOf.get(y.n) === goldOf.get(x.n))) found++;
    if (same.some((y) => goldOf.get(y.n) !== goldOf.get(x.n))) wrong++;
  }
  return { precision: +(tp / Math.max(1, tp + fp)).toFixed(3), recall: +(tp / Math.max(1, tp + fn)).toFixed(3), tp, fp, fn, activityFindsItsMain: `${found}/${total}`, activityMatchesAWrongSeries: wrong };
}

const first = new Map(runs.filter((r) => r.run === 1).map((r) => [r.n, r]));
const out = {
  notes: 'aggregates only', events: items.length, calls: runs.length,
  rawName: score((i) => norm(i.name)),
  codeRule: score((i) => norm(rule(i.name))),
  llmCore: score((i) => norm(first.get(i.n)?.core)),
};
const second = runs.filter((r) => r.run === 2);
out.stability = { repeated: second.length, sameCore: second.filter((r) => norm(r.core) === norm(first.get(r.n)?.core)).length, sameActivity: second.filter((r) => r.activity === first.get(r.n)?.activity).length };
out.activityTypes = runs.filter((r) => r.run === 1).reduce((a, r) => ((a[r.activity] = (a[r.activity] ?? 0) + 1), a), {});
const controls = items.filter((i) => i.role === 'control' && i.n !== 84);
out.controlsUnchanged = `${controls.filter((i) => norm(first.get(i.n)?.core) === norm(i.name)).length}/${controls.length}`;
mkdirSync('out', { recursive: true }); writeFileSync('out/core-name-summary.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
if (detail) {
  for (const i of items.filter((x) => x.role !== 'candidate')) console.log(`${i.n} ${i.role.slice(0, 4)} | ${i.name.slice(0, 60)} -> ${first.get(i.n)?.core} [${first.get(i.n)?.activity}]`);
  const keys = {}; for (const i of items) { const k = norm(first.get(i.n)?.core); (keys[goldOf.get(i.n)] = keys[goldOf.get(i.n)] || new Set()).add(k); }
  console.log('distinct LLM keys per gold group:', Object.entries(keys).filter(([g]) => !g.startsWith('single')).map(([g, s]) => `${g}:${s.size} ${[...s].join('|')}`));
}
