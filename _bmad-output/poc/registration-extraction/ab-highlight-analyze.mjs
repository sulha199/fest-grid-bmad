// POC: scores private/ab-highlight-runs.jsonl. Writes out/highlight-summary.json (aggregates only: no captions, names or post ids).
//   node ab-highlight-analyze.mjs [--in private/ab-highlight-runs.jsonl] [--detail]
//   captions mode: composed highlight vs the hand labels (caption-level presence, same definition as findings 5.1) and groundedness, stability, kind agreement.
//   live mode    : A / F / G on real posts with images: runaway output, event and schedule count changes, tokens, composed share.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { composeHighlight } from './compose-highlight.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const detail = process.argv.includes('--detail');
const all = readFileSync(arg('in', 'private/ab-highlight-runs.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const sum = (a) => a.reduce((x, y) => x + y, 0);
const mode_ = (a) => { const c = {}; a.forEach((x) => (c[x] = (c[x] ?? 0) + 1)); return +Object.entries(c).sort((x, y) => y[1] - x[1] || +y[0] - +x[0])[0][0]; };
const flat = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
const digitsOf = (s) => String(s ?? '').replace(/\D/g, '');
const numTokens = (s) => (String(s).match(/\d[\d.,]*/g) ?? []).map((t) => t.replace(/\D/g, '')).filter(Boolean);
const out = { notes: 'aggregates only', captions: {}, live: {} };
const KIND_MAP = { PRIZE: ['prize'], DISCOUNT: ['discount'], FREE: ['free'], BENEFIT: ['benefit', 'gift'], PERFORMERS: ['guest'] };

// runs that hit the output cap are reported on their own and left out of the other metrics
const ok = all.filter((r) => r.ok);
const bad = (r) => !r.parsedOk || r.finish !== 'STOP';
out.runaway = {}; for (const arm of ['A', 'F', 'G']) { const rs = ok.filter((r) => r.arm === arm); if (rs.length) out.runaway[arm] = { calls: rs.length, outputCapHits: rs.filter(bad).length }; }
const good = ok.filter((r) => !bad(r));

// ---- captions mode
const cap = good.filter((r) => r.mode === 'captions');
if (cap.length) {
  const sample = new Map(readFileSync('private/sample.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l)).map((r) => [r.sampleId, r]));
  const labels = JSON.parse(readFileSync('private/labels.json', 'utf8'));
  for (const arm of ['F', 'G']) {
    const rs = cap.filter((r) => r.arm === arm); if (!rs.length) continue;
    let tp = 0, fp = 0, fn = 0, tn = 0, withHl = 0, events = 0, grounded = 0, verbatim = 0, kindBoth = 0, kindAgree = 0; const src = {}, perId = new Map(); const fpEx = [], fnEx = [];
    for (const r of rs) {
      const c = sample.get(r.id)?.caption ?? ''; const L = labels[r.id] ?? {}; const capD = digitsOf(c), capF = flat(c);
      const comps = r.ev.map((e) => composeHighlight(e)).filter(Boolean);
      events += r.ev.length; withHl += comps.length;
      for (const h of comps) {
        src[h.source] = (src[h.source] ?? 0) + 1;
        if (numTokens(h.text).every((t) => capD.includes(t))) grounded++;
        const valuePart = h.text.replace(/^(Total hadiah|Hadiah|Beasiswa|Doorprize|Diskon|Potongan|Gratis|Cashback|Paket|Termasuk|Penampil:)\s*/i, '');
        if (valuePart.split(/,\s*/).every((p) => capF.includes(flat(p.replace(/\s\+\d+$/, ''))))) verbatim++;
        if (L.hk) { kindBoth++; if ((KIND_MAP[h.kind] ?? []).includes(L.hk)) kindAgree++; }
      }
      const has = comps.length > 0, want = !!L.hl;
      if (has && want) tp++; else if (has && !want) { fp++; if (fpEx.length < 8) fpEx.push(`${r.id} "${comps[0].text}" (${comps[0].source})`); } else if (!has && want) { fn++; if (fnEx.length < 8) fnEx.push(`${r.id} label "${String(L.hl).slice(0, 50)}"`); } else tn++;
      perId.set(r.id, [...(perId.get(r.id) ?? []), comps.map((h) => h.text).join('|')]);
    }
    const stable = [...perId.values()].filter((v) => v.length > 1 && new Set(v).size === 1).length;
    out.captions[arm] = { runs: rs.length, captions: perId.size, events, composedHighlights: withHl, precision: +(tp / Math.max(1, tp + fp)).toFixed(3), recall: +(tp / Math.max(1, tp + fn)).toFixed(3), tp, fp, fn, tn,
      numbersGroundedInCaption: `${grounded}/${withHl}`, valueVerbatimInCaption: `${verbatim}/${withHl}`, kindAgreesWithLabel: `${kindAgree}/${kindBoth}`, identicalAcrossRuns: `${stable}/${[...perId.values()].filter((v) => v.length > 1).length}`, bySource: src,
      tokens: { promptAvg: Math.round(sum(rs.map((r) => r.usage?.promptTokens ?? 0)) / rs.length), outputAvg: Math.round(sum(rs.map((r) => r.usage?.outputTokens ?? 0)) / rs.length) } };
    if (detail) { console.log(arm, 'false positives:', fpEx); console.log(arm, 'misses:', fnEx); }
  }
}

// ---- live mode
const live = good.filter((r) => r.mode === 'live');
if (live.length) {
  const ref = {}; for (const id of new Set(live.map((r) => r.id))) { const a = live.filter((r) => r.id === id && r.arm === 'A'); if (a.length) ref[id] = { ev: mode_(a.map((r) => r.events)), sc: mode_(a.map((r) => sum(r.ev.map((e) => e.schedules.length)))) }; }
  for (const arm of ['A', 'F', 'G']) {
    const rs = live.filter((r) => r.arm === arm); if (!rs.length) continue;
    const cmp = rs.filter((r) => ref[r.id]);
    const evs = rs.flatMap((r) => r.ev); const comps = evs.map((e) => composeHighlight(e)).filter(Boolean);
    const unstable = [...new Set(rs.map((r) => r.id))].filter((id) => new Set(rs.filter((r) => r.id === id).map((r) => r.events)).size > 1).length;
    out.live[arm] = { runs: rs.length, zeroEventRuns: rs.filter((r) => r.events === 0).length, fewerEventsThanA: cmp.filter((r) => r.events < ref[r.id].ev).length, moreEventsThanA: cmp.filter((r) => r.events > ref[r.id].ev).length,
      fewerSchedulesThanA: cmp.filter((r) => sum(r.ev.map((e) => e.schedules.length)) < ref[r.id].sc).length, postsWithUnstableEventCount: unstable,
      eventsWithComposedHighlight: `${comps.length}/${evs.length}`, bySource: comps.reduce((a, h) => ((a[h.source] = (a[h.source] ?? 0) + 1), a), {}),
      eventsWithPrizes: evs.filter((e) => (e.prizes ?? []).length).length, eventsWithPromos: evs.filter((e) => (e.promos ?? []).length).length, eventsWithInclusions: evs.filter((e) => (e.inclusions ?? []).length).length, eventsFlaggedFree: evs.filter((e) => e.isFree === true).length,
      tokens: { promptAvg: Math.round(sum(rs.map((r) => r.usage?.promptTokens ?? 0)) / rs.length), outputAvg: Math.round(sum(rs.map((r) => r.usage?.outputTokens ?? 0)) / rs.length) } };
  }
  const g = live.filter((r) => r.arm === 'G').flatMap((r) => r.ev.flatMap((e) => e.schedules));
  out.live.stageOnG = { rows: g.length, withStage: g.filter((s) => s.stage).length };
}
mkdirSync('out', { recursive: true }); writeFileSync('out/highlight-summary.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
