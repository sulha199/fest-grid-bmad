// POC: summarises private/ab-runs.jsonl (A/B replay). Writes out/ab-summary.json with aggregates only (no captions, no post ids).
//   node ab-analyze.mjs [--detail]     --detail prints per-post rows (post ids are public Instagram shortcodes, still kept out of the summary file)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const detail = process.argv.includes('--detail');
const rows = readFileSync('private/ab-runs.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const ok = rows.filter((r) => r.ok);
const fail = rows.filter((r) => !r.ok);
const sum = (a) => a.reduce((x, y) => x + y, 0);
const mode = (a) => { const c = {}; a.forEach((x) => (c[x] = (c[x] ?? 0) + 1)); return +Object.entries(c).sort((x, y) => y[1] - x[1] || +y[0] - +x[0])[0][0]; };
const key = (r) => `${r.set}|${r.pid}`;
const posts = [...new Set(ok.map(key))];
const arms = ['A', 'B', 'C'];

// reference event count per post = mode of arm A (the production prompt), falling back to the post's stored count is not possible here.
const ref = {};
for (const k of posts) { const a = ok.filter((r) => key(r) === k && r.arm === 'A').map((r) => r.events); if (a.length) ref[k] = mode(a); }

const out = { runs: { ok: ok.length, failed: fail.length, truncated: ok.filter((r) => r.finish !== 'STOP' || !r.parsedOk).length }, bySet: {}, tokens: {}, windowSet: {} };
for (const set of ['multi', 'control', 'window']) {
  const o = {};
  for (const arm of arms) {
    const rs = ok.filter((r) => r.set === set && r.arm === arm && ref[key(r)] !== undefined);
    if (!rs.length) continue;
    const collapse = rs.filter((r) => r.events < ref[key(r)]).length;
    const expand = rs.filter((r) => r.events > ref[key(r)]).length;
    const same = rs.filter((r) => r.events === ref[key(r)]).length;
    const oneEvent = rs.filter((r) => r.events === 1).length;
    const g = {}; rs.forEach((r) => { g[r.grouping ?? 'none'] = (g[r.grouping ?? 'none'] ?? 0) + 1; });
    o[arm] = { runs: rs.length, sameCountAsA: same, fewerThanA: collapse, moreThanA: expand, oneEvent, grouping: g };
  }
  out.bySet[set] = o;
}
for (const arm of arms) {
  const rs = ok.filter((r) => r.arm === arm);
  out.tokens[arm] = { calls: rs.length, promptAvg: Math.round(sum(rs.map((r) => r.usage?.promptTokens ?? 0)) / rs.length), outputAvg: Math.round(sum(rs.map((r) => r.usage?.outputTokens ?? 0)) / rs.length), msAvg: Math.round(sum(rs.map((r) => r.ms)) / rs.length) };
}
// per-post stability of the event count within an arm (min..max)
out.perPostRange = {};
for (const arm of arms) {
  const spread = posts.filter((k) => k.startsWith('multi') || k.startsWith('control')).map((k) => { const e = ok.filter((r) => key(r) === k && r.arm === arm).map((r) => r.events); return e.length ? Math.max(...e) - Math.min(...e) : null; }).filter((x) => x !== null);
  out.perPostRange[arm] = { posts: spread.length, postsWithUnstableCount: spread.filter((x) => x > 0).length };
}
// registration window (set 'window' + any)
const w = ok.filter((r) => r.set === 'window');
for (const arm of arms) {
  const rs = w.filter((r) => r.arm === arm);
  if (!rs.length) continue;
  out.windowSet[arm] = {
    runs: rs.length,
    withRegLikeSchedule: rs.filter((r) => r.regLikeSchedules.some((n) => n > 0)).length,
    withWindowField: rs.filter((r) => r.window.some((x) => x && (x.opensOn || x.closesOn))).length,
    withBothWindowDates: rs.filter((r) => r.window.some((x) => x && x.opensOn && x.closesOn)).length,
    withOptionOpensClosesFilled: rs.filter((r) => (r.regWindowFields ?? []).some((f) => f.o || f.c)).length,
    leakWindowAsScheduleAlso: arm === 'C' ? rs.filter((r) => r.window.some((x) => x && (x.opensOn || x.closesOn)) && r.regLikeSchedules.some((n) => n > 0)).length : undefined,
  };
}
mkdirSync('out', { recursive: true });
writeFileSync('out/ab-summary.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
if (detail) {
  for (const k of posts) {
    const line = arms.map((arm) => { const rs = ok.filter((r) => key(r) === k && r.arm === arm); return `${arm}: ${rs.map((r) => r.events).join(',') || '-'} [${[...new Set(rs.map((r) => r.grouping))].join('/')}]`; }).join('  ');
    console.log(k.padEnd(28), line);
  }
}
