// POC: scores private/tier-input-runs.jsonl against private/poster-truth.json (written before the model output was read).
//   node tier-input-analyze.mjs [--detail]      writes out/tier-input-summary.json (aggregates only)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { amountOf, decideTiersPerEvent } from './tier-options.mjs';

const NL = String.fromCharCode(10);
const detail = process.argv.includes('--detail');
const set = JSON.parse(readFileSync('private/poster-set.json', 'utf8'));
const truth = JSON.parse(readFileSync('private/poster-truth.json', 'utf8'));
const runs = readFileSync('private/tier-input-runs.jsonl', 'utf8').trim().split(NL).map((l) => JSON.parse(l)).filter((r) => r.ok);

const summary = { notes: 'aggregates only; posterOnly = the price is not in the caption, control = the caption states it', posts: set.length, arms: {} };
const lines = [];
for (const arm of ['caption', 'strings', 'images']) {
  const groups = {};
  for (const r of runs.filter((x) => x.arm === arm)) {
    const idx = set.findIndex((p) => p.pid === r.pid), post = set[idx], t = truth[r.pid];
    const g = (groups[post.group] ??= { rows: 0, truthAmounts: 0, found: 0, falseAmounts: 0, soldOutListed: 0, exactSet: 0, tierWanted: 0, tierEmitted: 0, tierWrongEmit: 0, promptTokens: 0, ms: 0 });
    const got = [...new Set(r.options.map((o) => amountOf(o.price)).filter((a) => a !== null && a > 0))];
    const sold = got.filter((a) => (t.soldOut ?? []).includes(a));
    const found = t.amounts.filter((a) => got.includes(a));
    const falseA = got.filter((a) => !t.amounts.includes(a) && !sold.includes(a));
    const emitted = decideTiersPerEvent(r.options, post.events.map((e) => String(e.name))).filter((e) => e.emit).length;
    const want = t.amounts.length >= 2;
    g.rows++; g.truthAmounts += t.amounts.length; g.found += found.length; g.falseAmounts += falseA.length; g.soldOutListed += sold.length;
    if (found.length === t.amounts.length && !falseA.length) g.exactSet++;
    if (want) { g.tierWanted++; if (emitted) g.tierEmitted++; } else if (emitted) g.tierWrongEmit++;
    g.promptTokens += r.usage?.promptTokenCount ?? r.usage?.promptTokens ?? r.usage?.inputTokens ?? 0; g.ms += r.ms;
    lines.push(`${arm.padEnd(7)} ${post.group === 'poster' ? 'P' : 'C'}${String(idx + 1).padStart(2, '0')} run${r.run} got=[${got.join(',')}] missing=[${t.amounts.filter((a) => !got.includes(a)).join(',')}] false=[${falseA.join(',')}] sold=[${sold.join(',')}] tierEvents=${emitted}/${post.events.length}`);
  }
  for (const g of Object.values(groups)) { g.promptTokens = Math.round(g.promptTokens / g.rows); g.ms = Math.round(g.ms / g.rows); }
  summary.arms[arm] = groups;
}
mkdirSync('out', { recursive: true });
writeFileSync('out/tier-input-summary.json', JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary.arms, null, 1));
if (detail) console.log(lines.sort((a, b) => a.slice(8, 11).localeCompare(b.slice(8, 11)) || a.localeCompare(b)).join(NL));
console.log('usage keys:', Object.keys(runs[0]?.usage ?? {}).join(','));
