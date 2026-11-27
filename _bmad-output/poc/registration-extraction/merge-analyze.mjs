// POC: scores private/merge-runs.jsonl (merge-call.ts). Writes out/merge-summary.json (aggregates only: no captions, names or post ids).
//   node merge-analyze.mjs [--detail]
//   location: arm L (production call alone) against arm M (merged call), per string; stability of M over two runs.
//   tier    : arm M options against the existing baseline (tier-call-runs-C.jsonl for single-event posts, tier-call-runs-event.jsonl for multi-event posts).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { decideTiers, decideTiersPerEvent } from './tier-options.mjs';

const NL = String.fromCharCode(10);
const detail = process.argv.includes('--detail');
const read = (f) => readFileSync(f, 'utf8').trim().split(NL).filter(Boolean).map((l) => JSON.parse(l));
const rows = read('private/merge-runs.jsonl');
const ok = rows.filter((r) => r.ok);
const good = ok.filter((r) => r.parsedOk && r.finish === 'STOP');
const sum = (a) => a.reduce((x, y) => x + y, 0);
const avg = (a) => (a.length ? Math.round(sum(a) / a.length) : 0);
const flat = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
const locOf = (r) => (r.arm === 'L' ? (Array.isArray(r.result) ? r.result : []) : (Array.isArray(r.result?.locations) ? r.result.locations : []));
const kwKey = (a) => JSON.stringify([(a.locationKeywords ?? []).map(flat), flat(a.countryCode)]);

const L = new Map(good.filter((r) => r.arm === 'L' && r.run === 1).map((r) => [r.id, r]));
const M1 = new Map(good.filter((r) => r.arm === 'M' && r.run === 1).map((r) => [r.id, r]));
const M2 = new Map(good.filter((r) => r.arm === 'M' && r.run === 2).map((r) => [r.id, r]));

const out = { notes: 'aggregates only', calls: { total: rows.length, ok: ok.length, failed: rows.filter((r) => !r.ok).length, notStopOrBadJson: ok.filter((r) => !r.parsedOk || r.finish !== 'STOP').length, byArm: {} }, location: {}, tier: {}, stability: {} };
for (const arm of ['L', 'M']) { const rs = good.filter((r) => r.arm === arm); out.calls.byArm[arm] = { calls: rs.length, promptAvg: avg(rs.map((r) => r.usage?.promptTokens ?? 0)), outputAvg: avg(rs.map((r) => r.usage?.outputTokens ?? 0)), thinkingAvg: avg(rs.map((r) => r.usage?.thinkingTokens ?? 0)), secondsAvg: +(sum(rs.map((r) => r.ms)) / Math.max(1, rs.length) / 1000).toFixed(1) }; }

// ---- location: L against M run 1, per string id
let strings = 0, answeredL = 0, answeredM = 0, sameKeywords = 0, sameFirst = 0, sameCountry = 0, bothAnswered = 0, postsCompared = 0, missingM = 0;
const diffs = [];
for (const [id, l] of L) {
  const m = M1.get(id); if (!m) continue; postsCompared++;
  const lm = new Map(locOf(l).map((a) => [a.id, a])), mm = new Map(locOf(m).map((a) => [a.id, a]));
  for (let i = 0; i < l.locStrings; i++) {
    const a = lm.get(`s${i}`), b = mm.get(`s${i}`); strings++;
    const ak = (a?.locationKeywords ?? []).length > 0, bk = (b?.locationKeywords ?? []).length > 0;
    if (ak) answeredL++; if (bk) answeredM++; if (ak && !bk) missingM++;
    if (ak && bk) {
      bothAnswered++;
      if (kwKey(a) === kwKey(b)) sameKeywords++; else if (detail && diffs.length < 8) diffs.push(`${id} s${i} L=${JSON.stringify(a.locationKeywords)}/${a.countryCode} M=${JSON.stringify(b.locationKeywords)}/${b.countryCode}`);
      if (flat(a.locationKeywords[0]) === flat(b.locationKeywords[0])) sameFirst++;
      if (flat(a.countryCode) === flat(b.countryCode)) sameCountry++;
    }
  }
}
out.location = { postsCompared, strings, answeredL, answeredM, answeredByLNotByM: missingM, bothAnswered, identicalKeywordsAndCountry: sameKeywords, sameMostSpecificKeyword: sameFirst, sameCountry };
if (detail) console.log('location differences:', diffs);

// ---- location stability of M (run 1 against run 2)
let sn = 0, sIdent = 0, sPosts = 0, sPostsIdent = 0;
for (const [id, m2] of M2) {
  const m1 = M1.get(id); if (!m1) continue; sPosts++;
  const a1 = new Map(locOf(m1).map((a) => [a.id, a])), a2 = new Map(locOf(m2).map((a) => [a.id, a]));
  let all = true;
  for (let i = 0; i < m1.locStrings; i++) { sn++; const x = a1.get(`s${i}`), y = a2.get(`s${i}`); const same = x && y && kwKey(x) === kwKey(y); if (same) sIdent++; else all = false; }
  if (all) sPostsIdent++;
}
out.stability.location = { posts: sPosts, strings: sn, identicalStrings: sIdent, postsWithAllStringsIdentical: sPostsIdent };

// ---- the control: the production call (L) against itself, run 1 against run 2, on the same posts
const L2 = new Map(good.filter((r) => r.arm === 'L' && r.run === 2).map((r) => [r.id, r]));
const L1 = new Map(good.filter((r) => r.arm === 'L' && r.run === 1).map((r) => [r.id, r]));
let ln = 0, lIdent = 0, lFirst = 0, lCountry = 0, lBoth = 0, lPosts = 0;
for (const [id, l2] of L2) {
  const l1 = L1.get(id); if (!l1) continue; lPosts++;
  const a1 = new Map(locOf(l1).map((a) => [a.id, a])), a2 = new Map(locOf(l2).map((a) => [a.id, a]));
  for (let i = 0; i < l1.locStrings; i++) {
    const x = a1.get(`s${i}`), y = a2.get(`s${i}`); ln++;
    if (x && y && kwKey(x) === kwKey(y)) lIdent++;
    if ((x?.locationKeywords ?? []).length && (y?.locationKeywords ?? []).length) { lBoth++; if (flat(x.locationKeywords[0]) === flat(y.locationKeywords[0])) lFirst++; if (flat(x.countryCode) === flat(y.countryCode)) lCountry++; }
  }
}
out.stability.locationControlL = { posts: lPosts, strings: ln, identicalStrings: lIdent, bothAnswered: lBoth, sameMostSpecificKeyword: lFirst, sameCountry: lCountry };

// ---- tier: M against the baseline
const baseC = new Map(read('private/tier-call-runs-C.jsonl').filter((r) => r.ok && r.run === 1 && r.parsedOk && r.finish === 'STOP').map((r) => [r.id, r]));
const baseE = new Map(read('private/tier-call-runs-event.jsonl').filter((r) => r.ok && r.run === 1 && r.parsedOk && r.finish === 'STOP').map((r) => [r.id, r]));
const amountsSig = (d) => JSON.stringify([...d.amounts].sort((a, b) => a - b));
const sigOf = (opts, events, multi) => {
  if (multi) return JSON.stringify(decideTiersPerEvent(opts, events).map((x) => [x.event, x.emit, amountsSig(x)]));
  const d = decideTiers(opts); return JSON.stringify([d.emit, amountsSig(d)]);
};
let tp = 0, sameDecision = 0, sameAmounts = 0, multiPosts = 0, mEmit = 0, bEmit = 0; const tdiff = [];
for (const [id, m] of M1) {
  const e = baseE.get(id), c = baseC.get(id);
  const base = e ?? c; if (!base) continue; tp++;
  const multi = !!e;
  const events = multi ? base.events : ['__single__'];
  const bo = base.options, mo = (m.result?.options ?? []).map((o) => (multi ? o : { ...o, event: '__single__' }));
  const bOpts = multi ? bo : bo.map((o) => ({ ...o, event: '__single__' }));
  const bs = sigOf(bOpts, events, multi), ms = sigOf(mo, events, multi);
  const bd = multi ? decideTiersPerEvent(bOpts, events).some((x) => x.emit) : decideTiers(bo).emit;
  const md = multi ? decideTiersPerEvent(mo, events).some((x) => x.emit) : decideTiers(mo).emit;
  if (multi) multiPosts++; if (bd) bEmit++; if (md) mEmit++;
  if (bd === md) sameDecision++;
  if (bs === ms) sameAmounts++; else if (detail && tdiff.length < 10) tdiff.push(`${id} multi=${multi} base=${bs} merged=${ms}`);
}
out.tier = { postsCompared: tp, multiEventPosts: multiPosts, sameEmitDecision: sameDecision, sameAmountsAndDecision: sameAmounts, baselineEmits: bEmit, mergedEmits: mEmit };
if (detail) console.log('tier differences:', tdiff);

// ---- tier stability of M (run 1 against run 2)
let ts = 0, tsSame = 0;
for (const [id, m2] of M2) {
  const m1 = M1.get(id); if (!m1) continue; ts++;
  const e = baseE.get(id); const events = e ? e.events : ['__single__'];
  const f = (m) => (m.result?.options ?? []).map((o) => (e ? o : { ...o, event: '__single__' }));
  if (sigOf(f(m1), events, !!e) === sigOf(f(m2), events, !!e)) tsSame++;
}
out.stability.tier = { posts: ts, identicalDecisionAndAmounts: tsSame };

mkdirSync('out', { recursive: true }); writeFileSync('out/merge-summary.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
