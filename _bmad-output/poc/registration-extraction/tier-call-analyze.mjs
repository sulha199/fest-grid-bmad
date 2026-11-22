// POC: scores private/tier-call-runs.jsonl against private/tier-gold.json (hand labels). Writes out/tier-call-summary.json (aggregates only).
//   node tier-call-analyze.mjs [--detail]
// Questions: (1) does the "two distinct prices" decision made in code match the labels, (2) are the amounts the labels name found and are the
// amounts the model returns written in the caption, (3) does the audience field separate student, child, group and public prices, (4) is it stable.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { decideTiers, amountOf } from './tier-options.mjs';

const detail = process.argv.includes('--detail');
const NL = String.fromCharCode(10);
const argv = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d; };
const only = argv('only') ? new Set(argv('only').split(',')) : null;
const norm = (o) => (o.price === undefined && o.amount !== undefined && o.amount !== null ? { ...o, price: String(o.amount) } : o); // variant B returns a number
const rows = readFileSync(argv('in', 'private/tier-call-runs.jsonl'), 'utf8').trim().split(NL).map((l) => JSON.parse(l)).filter((r) => !only || only.has(r.id)).map((r) => ({ ...r, options: (r.options ?? []).map(norm) }));
const sample = new Map(readFileSync('private/sample.jsonl', 'utf8').trim().split(NL).map((l) => JSON.parse(l)).map((r) => [r.sampleId, r]));
const gold = JSON.parse(readFileSync('private/tier-gold.json', 'utf8'));
const ok = rows.filter((r) => r.ok && r.parsedOk && r.finish === 'STOP');
const digits = (s) => String(s ?? '').replace(/\D/g, '');
const sum = (a) => a.reduce((x, y) => x + y, 0);
const out = { notes: 'aggregates only', calls: rows.length, okCalls: ok.length, failed: rows.filter((r) => !r.ok).length, notStop: rows.filter((r) => r.ok && (!r.parsedOk || r.finish !== 'STOP')).length };

const items = [];
for (const r of ok) {
  const cap = sample.get(r.id)?.caption ?? '';
  const d = decideTiers(r.options);
  const g = gold[r.id];
  // The hand labels were written with the images and the stored ticket-price text in view; this call sees the caption only. A labelled amount
  // counts only when it is written in the caption, otherwise the call could not have found it.
  const flat = cap.replace(/(?<=\d)[.,](?=\d{3})/g, '');
  const inCap = (a) => (a === 0 ? /\b(gratis|free)\b/i.test(cap) : flat.includes(String(a)) || (a % 1000 === 0 && new RegExp('\\b' + a / 1000 + '\\s?k\\b', "i").test(cap)));
  const goldAmounts = g ? g.amounts.filter(inCap) : null; // null = the label states no price
  const goldMulti = goldAmounts ? goldAmounts.length >= 2 : false;
  items.push({ r, cap, d, g, goldAmounts, goldMulti });
}
const first = (id) => items.filter((x) => x.r.id === id).sort((a, b) => a.r.run - b.r.run)[0];
const ids = [...new Set(items.map((x) => x.r.id))];

// 1. the decision
let tp = 0, fp = 0, fn = 0, tn = 0; const fpEx = [], fnEx = [];
for (const x of items) {
  if (x.d.emit && x.goldMulti) tp++; else if (x.d.emit && !x.goldMulti) { fp++; fpEx.push(`${x.r.id}#${x.r.run} model ${JSON.stringify(x.d.amounts)} label ${JSON.stringify(x.goldAmounts)}`); }
  else if (!x.d.emit && x.goldMulti) { fn++; fnEx.push(`${x.r.id}#${x.r.run} model ${JSON.stringify(x.d.amounts)} label ${JSON.stringify(x.goldAmounts)}`); } else tn++;
}
out.emitDecision = { tp, fp, fn, tn, precision: +(tp / Math.max(1, tp + fp)).toFixed(3), recall: +(tp / Math.max(1, tp + fn)).toFixed(3) };

// 2. amounts: recall of labelled amounts, and grounding of what the model returns
let goldN = 0, goldFound = 0, modelAmounts = 0, grounded = 0, optionsNoPrice = 0, optionsAll = 0; const missEx = [];
for (const x of items) {
  const found = new Set(x.d.amounts);
  if (x.goldAmounts) for (const a of x.goldAmounts) { goldN++; if (found.has(a)) goldFound++; else if (detail && missEx.length < 14) missEx.push(`${x.r.id}#${x.r.run} missing ${a}`); }
  for (const o of x.r.options) {
    optionsAll++;
    const a = amountOf(o.price);
    if (a === null) { optionsNoPrice++; continue; }
    modelAmounts++;
    if (a === 0 || digits(x.cap).includes(digits(o.price).replace(/^0+/, '').slice(0, 3))) grounded++;
  }
}
out.amounts = { labelledAmountsWrittenInCaption: goldN, found: goldFound, recall: +(goldFound / Math.max(1, goldN)).toFixed(3), modelOptions: optionsAll, withoutReadablePrice: optionsNoPrice, pricesWrittenInCaption: `${grounded}/${modelAmounts}` };

// 3. captions whose label has no price: options invented from nothing?
const noPrice = items.filter((x) => !x.g);
out.noPriceCaptions = { calls: noPrice.length, callsWithAnyPricedOption: noPrice.filter((x) => x.d.amounts.length).length, callsEmittingTiers: noPrice.filter((x) => x.d.emit).length };

// 4. audience and kind
const aud = {}, kinds = {}; let withCond = 0, nOpts = 0;
for (const x of items) for (const o of x.r.options) { aud[o.audience] = (aud[o.audience] ?? 0) + 1; kinds[o.kind] = (kinds[o.kind] ?? 0) + 1; nOpts++; if (o.conditions) withCond++; }
out.audience = aud; out.kind = kinds; out.optionsWithConditions = `${withCond}/${nOpts}`;
// the labels that name an audience (field `el`): which of them show a non-PUBLIC option
const el = items.filter((x) => x.g?.el);
out.audienceOnLabelledEligibility = { calls: el.length, withNonPublicOption: el.filter((x) => x.r.options.some((o) => o.audience !== 'PUBLIC')).length };
out.fromPrice = { calls: items.length, withFromPrice: items.filter((x) => x.d.fromPrice !== null).length, withFreePublic: items.filter((x) => x.d.freePublic).length };

// 5. stability across runs (only when several runs exist)
const multiRun = ids.filter((id) => items.filter((x) => x.r.id === id).length > 1);
out.stability = { postsWithSeveralRuns: multiRun.length,
  sameEmitDecision: multiRun.filter((id) => new Set(items.filter((x) => x.r.id === id).map((x) => x.d.emit)).size === 1).length,
  sameAmounts: multiRun.filter((id) => new Set(items.filter((x) => x.r.id === id).map((x) => JSON.stringify(x.d.amounts))).size === 1).length,
  sameAudiences: multiRun.filter((id) => new Set(items.filter((x) => x.r.id === id).map((x) => JSON.stringify(x.r.options.map((o) => o.audience).sort()))).size === 1).length };
out.tokens = { promptAvg: Math.round(sum(ok.map((r) => r.usage?.promptTokens ?? 0)) / Math.max(1, ok.length)), outputAvg: Math.round(sum(ok.map((r) => r.usage?.outputTokens ?? 0)) / Math.max(1, ok.length)) };

mkdirSync('out', { recursive: true }); writeFileSync(argv('out', 'out/tier-call-summary.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
if (detail) {
  console.log('emit false positives:', fpEx); console.log('emit misses:', fnEx); console.log('missing amounts:', missEx);
  console.log('non-PUBLIC options (id audience | label | condition):');
  for (const x of items.filter((y) => y.r.run === 1)) for (const o of x.r.options) if (o.audience !== 'PUBLIC') console.log(`  ${x.r.id} ${o.audience} | ${String(o.label).slice(0, 30)} | ${String(o.conditions ?? '').slice(0, 50)} | ${o.price ?? '-'}`);
}
