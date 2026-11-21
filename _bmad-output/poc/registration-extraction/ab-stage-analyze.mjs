// POC: summarises private/ab-stage-runs.jsonl. Writes out/stage-summary.json (aggregates only: no captions, titles or post ids).
//   node ab-stage-analyze.mjs [--detail]   --detail prints per-post rows and disagreements to the terminal (private data, never commit the output)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { classifyStage } from './stage-classifier.mjs';

const detail = process.argv.includes('--detail');
const rows = readFileSync('private/ab-stage-runs.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const posts = new Map(readFileSync('private/live-posts.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l)).map((r) => [r.pid, r]));
// Two replay processes wrote to the same file once (an orphan of a stopped job), so `run` can repeat. Every row is still an independent
// sample; renumber the samples per (post, arm) in file order so stability checks and --detail use sample numbers, not run labels.
const seen = new Map();
const allOk = rows.filter((r) => r.ok).map((r) => { const k = `${r.pid}|${r.arm}`; const n = (seen.get(k) ?? 0) + 1; seen.set(k, n); return { ...r, run: n }; });
// Runs that hit the output cap (runaway generation, unparsable JSON) are reported on their own and left out of every other metric.
const runaway = allOk.filter((r) => !r.parsedOk || r.finish !== 'STOP');
const ok = allOk.filter((r) => r.parsedOk && r.finish === 'STOP');
const sum = (a) => a.reduce((x, y) => x + y, 0);
const mode = (a) => { const c = {}; a.forEach((x) => (c[x] = (c[x] ?? 0) + 1)); return +Object.entries(c).sort((x, y) => y[1] - x[1] || +y[0] - +x[0])[0][0]; };
const COUNTS = new Set(['event', 'qualification', 'supporting']); // stages that may carry the main flag / count as event days
const arms = ['A', 'D', 'E'];
const schedOf = (r) => r.ev.flatMap((e) => e.schedules);
const digits = (s) => String(s ?? '').replace(/\D/g, '');
const out = {
  runs: { calls: allOk.length, failedCalls: rows.length - allOk.length, usedForMetrics: ok.length },
  runaway: Object.fromEntries(arms.map((a) => [a, { calls: allOk.filter((r) => r.arm === a).length, outputCapHits: runaway.filter((r) => r.arm === a).length, maxOutputTokens: Math.max(...runaway.filter((r) => r.arm === a).map((r) => r.usage?.outputTokens ?? 0), 0) }])),
  tokens: {}, grouping: {}, stage: {}, tiers: {},
};

out.zeroEventRunsParsed = Object.fromEntries(arms.map((a) => [a, `${ok.filter((r) => r.arm === a && r.events === 0).length}/${ok.filter((r) => r.arm === a).length}`]));
for (const arm of arms) {
  const rs = ok.filter((r) => r.arm === arm);
  out.tokens[arm] = { calls: rs.length, promptAvg: Math.round(sum(rs.map((r) => r.usage?.promptTokens ?? 0)) / rs.length), outputAvg: Math.round(sum(rs.map((r) => r.usage?.outputTokens ?? 0)) / rs.length) };
}

// 1. does the new field disturb grouping or schedule rows? compare with arm A's usual answer per post (events, schedules)
const ref = {};
for (const pid of new Set(ok.map((r) => r.pid))) {
  const a = ok.filter((r) => r.pid === pid && r.arm === 'A');
  if (a.length) ref[pid] = { events: mode(a.map((r) => r.events)), scheds: mode(a.map((r) => schedOf(r).length)) };
}
for (const set of ['stage', 'tier', 'control']) {
  out.grouping[set] = {};
  for (const arm of arms) {
    const rs = ok.filter((r) => r.set === set && r.arm === arm && ref[r.pid]);
    if (!rs.length) continue;
    const unstable = [...new Set(rs.map((r) => r.pid))].filter((pid) => new Set(rs.filter((r) => r.pid === pid).map((r) => r.events)).size > 1).length;
    out.grouping[set][arm] = {
      runs: rs.length, posts: new Set(rs.map((r) => r.pid)).size,
      fewerEventsThanA: rs.filter((r) => r.events < ref[r.pid].events).length, moreEventsThanA: rs.filter((r) => r.events > ref[r.pid].events).length,
      fewerSchedulesThanA: rs.filter((r) => schedOf(r).length < ref[r.pid].scheds).length, moreSchedulesThanA: rs.filter((r) => schedOf(r).length > ref[r.pid].scheds).length,
      postsWithUnstableEventCount: unstable,
    };
  }
}

// 2. stage field: coverage, distribution, agreement with the title classifier, main-flag discipline
const conf = {}; const disagree = [];
let nSched = 0, nStage = 0, nValid = 0, agree = 0;
const dist = {}; let mainOnNonCounting = 0, mainSchedules = 0, regRegexRows = 0, aMainOnRegRegex = 0, aMainRows = 0;
for (const r of ok.filter((x) => x.arm !== 'A')) {
  for (const s of schedOf(r)) {
    nSched++;
    if (s.stage) { nStage++; nValid++; }
    const code = classifyStage(s.t);
    dist[s.stage ?? 'missing'] = (dist[s.stage ?? 'missing'] ?? 0) + 1;
    const k = `${s.stage ?? 'missing'} | ${code}`; conf[k] = (conf[k] ?? 0) + 1;
    if (s.stage === code) agree++; else disagree.push({ pid: r.pid, arm: r.arm, run: r.run, title: s.t, model: s.stage, code });
    if (s.main) { mainSchedules++; if (s.stage && !COUNTS.has(s.stage)) mainOnNonCounting++; }
  }
}
for (const r of ok.filter((x) => x.arm === 'A')) for (const s of schedOf(r)) {
  const code = classifyStage(s.t); if (s.main) aMainRows++;
  if (!COUNTS.has(code)) { regRegexRows++; if (s.main) aMainOnRegRegex++; }
}
out.stage = {
  scheduleRows: nSched, withStage: nStage, distribution: dist, agreeWithTitleRule: agree, mainFlagRows: mainSchedules, mainFlagOnNonCountingStage: mainOnNonCounting,
  armA: { rows: sum(ok.filter((x) => x.arm === 'A').map((r) => schedOf(r).length)), mainFlagRows: aMainRows, rowsWithNonCountingTitle: regRegexRows, ofThoseMarkedMain: aMainOnRegRegex },
  confusion_modelVsTitleRule: conf,
};
// posts with at least one registration-like row: does the model tag it registration?
const regPosts = [...new Set(ok.filter((r) => r.arm === 'A').filter((r) => schedOf(r).some((s) => classifyStage(s.t) === 'registration')).map((r) => r.pid))];
out.stage.postsWhereAEmitsRegistrationTitledRow = regPosts.length;

// 3. stability of the stage assignment across runs (same title -> same stage in every run of the same arm)
let titles = 0, unstableTitles = 0;
for (const arm of ['D', 'E']) for (const pid of new Set(ok.filter((r) => r.arm === arm).map((r) => r.pid))) {
  const m = new Map();
  ok.filter((r) => r.arm === arm && r.pid === pid).forEach((r) => schedOf(r).forEach((s) => { const k = `${s.s}|${(s.t ?? '').toLowerCase()}`; if (!m.has(k)) m.set(k, new Set()); m.get(k).add(s.stage); }));
  for (const v of m.values()) { titles++; if (v.size > 1) unstableTitles++; }
}
out.stage.stability = { scheduleKeys: titles, withDifferentStageAcrossRuns: unstableTitles };

// 4. tiers (arm E)
const E = ok.filter((r) => r.arm === 'E');
for (const set of ['tier', 'stage', 'control']) {
  const rs = E.filter((r) => r.set === set);
  if (!rs.length) continue;
  const withTiers = rs.filter((r) => r.ev.some((e) => e.tiers.length > 0));
  const per = {};
  for (const pid of new Set(rs.map((r) => r.pid))) per[pid] = rs.filter((r) => r.pid === pid).map((r) => sum(r.ev.map((e) => e.tiers.length)));
  const kinds = {}; let tn = 0, priced = 0, priceInCaption = 0, priceNotInCaption = 0, window = 0, windowBoth = 0, evOk = 0, evTotal = 0;
  for (const r of rs) {
    const cap = digits(posts.get(r.pid)?.content);
    for (const e of r.ev) for (const t of e.tiers) {
      tn++; kinds[t.kind] = (kinds[t.kind] ?? 0) + 1;
      if (t.price) { priced++; const d = digits(t.price); if (d && cap.includes(d)) priceInCaption++; else if (d) priceNotInCaption++; }
      if (t.o || t.c) { window++; if (t.o && t.c) windowBoth++; }
      if (t.ev) { evTotal++; const norm = (x) => String(x).toLowerCase().replace(/\s+/g, ' '); if (norm(posts.get(r.pid)?.content ?? '').includes(norm(t.ev))) evOk++; }
    }
  }
  out.tiers[set] = {
    runs: rs.length, runsWithTiers: withTiers.length, tiers: tn, kinds, priced, priceDigitsFoundInCaption: priceInCaption, priceDigitsNotInCaption: priceNotInCaption,
    withSalesDates: window, withBothDates: windowBoth, evidenceQuotedVerbatim: `${evOk}/${evTotal}`,
    postsWithTierCountVaryingAcrossRuns: Object.values(per).filter((v) => new Set(v).size > 1).length, posts: Object.keys(per).length,
    postsWithTiersInEveryRun: Object.values(per).filter((v) => v.every((n) => n > 0)).length, postsWithTiersInSomeRuns: Object.values(per).filter((v) => v.some((n) => n > 0) && !v.every((n) => n > 0)).length,
  };
}
// arm D must not emit tiers (sanity)
out.tiers.armDEmitsTiers = ok.filter((r) => r.arm === 'D').filter((r) => r.ev.some((e) => e.tiers.length)).length;

mkdirSync('out', { recursive: true });
writeFileSync('out/stage-summary.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
if (detail) {
  console.log('\n-- disagreements (model | title rule), first 80');
  disagree.slice(0, 80).forEach((d) => console.log(`${d.pid} ${d.arm}#${d.run} model=${d.model} rule=${d.code} :: ${d.title}`));
  console.log('\n-- tiers on posts, run 1 of arm E');
  E.filter((r) => r.run === 1).forEach((r) => r.ev.forEach((e) => { if (e.tiers.length) console.log(`${r.set} ${r.pid}: ` + e.tiers.map((t) => `${t.label}[${t.kind}] ${t.price ?? '-'}${t.o || t.c ? ` ${t.o ?? ''}..${t.c ?? ''}` : ''}`).join(' | ')); }));
}
