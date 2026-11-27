// POC: runs the title classifier over the stored schedule titles of active events (private/prod-schedule-titles.jsonl). Aggregates only.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { classifyStage } from './stage-classifier.mjs';
const rows = readFileSync('private/prod-schedule-titles.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const COUNTS = new Set(['event', 'qualification', 'supporting']);
const dist = {}; const byEvent = new Map(); const samples = {};
for (const r of rows) {
  const s = classifyStage(r.t); dist[s] = (dist[s] ?? 0) + 1;
  (samples[s] ??= new Set()).size < 12 && samples[s].add(r.t);
  if (!byEvent.has(r.e)) byEvent.set(r.e, []);
  byEvent.get(r.e).push({ ...r, stage: s });
}
let withNon = 0, onlyNon = 0, mainOnNon = 0, mainOnNonWithEventRow = 0, noCounting = 0, multi = 0;
for (const v of byEvent.values()) {
  const non = v.filter((x) => !COUNTS.has(x.stage));
  if (non.length) withNon++;
  if (non.length === v.length) onlyNon++;
  if (non.length && non.length < v.length && v.some((x) => x.main && !COUNTS.has(x.stage))) mainOnNonWithEventRow++;
  if (non.length === v.length && v.some((x) => x.main)) mainOnNon++;
  if (v.length > 1) multi++;
}
const out = { schedules: rows.length, events: byEvent.size, multiScheduleEvents: multi, distribution: dist, eventsWithNonCountingRow: withNon, eventsWithOnlyNonCountingRows: onlyNon, eventsMainFlagOnNonCountingWhileEventRowExists: mainOnNonWithEventRow };
mkdirSync('out', { recursive: true }); writeFileSync('out/stage-classify-prod.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
if (process.argv.includes('--samples')) for (const [k, v] of Object.entries(samples)) console.log(k, [...v]);
