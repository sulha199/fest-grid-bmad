/** Metric tables shared by run.ts (live) and rescore.ts (offline). */
import type { EventInsight } from './insight-schema.js';
import { DIMENSIONS, agreementRate, stabilityKey, type ScoreResult } from './score.js';

export interface CallRecord {
  caseId: string; variant: string; model: string; run: number;
  ok: boolean; errors: string[]; latencyMs: number;
  inputTokens?: number; outputTokens?: number; thoughtTokens?: number;
  insight?: EventInsight; score?: ScoreResult; rawText?: string; eventCount?: number;
}

// ---- summarising ----------------------------------------------------------------------------
export const pct = (n: number, d: number) => (d === 0 ? 'n/a' : `${Math.round((100 * n) / d)}% (${n}/${d})`);
export const quantile = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN; };
export const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : NaN);

export function summarise(title: string, recs: CallRecord[]): string {
  const scored = recs.filter((r) => r.score);
  const lines: string[] = [`### ${title}`, ''];
  lines.push(`- calls: ${recs.length}; schema-valid / usable: ${pct(recs.filter((r) => r.ok).length, recs.length)}`);
  const lat = recs.filter((r) => r.latencyMs).map((r) => r.latencyMs);
  lines.push(`- latency p50 / p95: ${quantile(lat, 0.5)} ms / ${quantile(lat, 0.95)} ms`);
  const inT = recs.map((r) => r.inputTokens).filter((x): x is number => x !== undefined);
  const outT = recs.map((r) => (r.outputTokens ?? 0) + (r.thoughtTokens ?? 0)).filter((_, i) => recs[i].outputTokens !== undefined);
  lines.push(`- avg tokens per call: ${avg(inT)} in / ${avg(outT)} out (output includes thinking tokens)`);
  lines.push('', '| dimension | correct | abstained (no claim) | wrong |', '|---|--:|--:|--:|');
  for (const d of DIMENSIONS) {
    const applicable = scored.filter((x) => x.score!.dimensions[d].applicable);
    const right = applicable.filter((x) => x.score!.dimensions[d].pass).length;
    const abst = applicable.filter((x) => x.score!.dimensions[d].abstained).length;
    const n = applicable.length;
    lines.push(`| ${d} | ${pct(right, n)} | ${abst} | ${n - right - abst} |`);
  }
  const strict = scored.filter((r) => DIMENSIONS.every((d) => !r.score!.dimensions[d].applicable || r.score!.dimensions[d].pass));
  lines.push(`| **all dimensions correct** | ${pct(strict.length, scored.length)} | | |`);
  const withCritical = scored.filter((r) => r.score!.criticalErrors.length > 0);
  lines.push('', `- calls with ≥1 critical error (would mislead or hide an event): ${pct(withCritical.length, scored.length)}`);
  const groupedCritical = new Map<string, string[]>();
  for (const r of withCritical) for (const e of r.score!.criticalErrors) groupedCritical.set(`${r.caseId}: ${e}`, [...(groupedCritical.get(`${r.caseId}: ${e}`) ?? []), String(r.run)]);
  for (const [k, runs] of groupedCritical) lines.push(`  - ${k}  _(runs ${runs.join(',')})_`);

  const byCase = new Map<string, CallRecord[]>();
  for (const r of scored) byCase.set(r.caseId, [...(byCase.get(r.caseId) ?? []), r]);
  const multi = [...byCase.values()].filter((v) => v.length > 1);
  if (multi.length) {
    const agree = multi.map((v) => agreementRate(v.map((r) => stabilityKey(r.insight!))));
    lines.push('', `- run-to-run stability (share of runs agreeing with the modal answer on scope/eligibility/segments/gender/cost/participation/age, averaged over posts): ${Math.round(100 * agree.reduce((a, b) => a + b, 0) / agree.length)}%; posts with all ${multi[0].length} runs identical: ${pct(agree.filter((a) => a === 1).length, agree.length)}`);
  }
  return lines.join('\n');
}

export function perCaseTable(recs: CallRecord[]): string {
  const rows = ['| post | ' + DIMENSIONS.join(' | ') + ' | critical |', '|---|' + DIMENSIONS.map(() => ':-:').join('|') + '|:-:|'];
  const ids = [...new Set(recs.map((r) => r.caseId))];
  for (const id of ids) {
    const rs = recs.filter((r) => r.caseId === id && r.score);
    if (!rs.length) { rows.push(`| ${id} | ${DIMENSIONS.map(() => '–').join(' | ')} | – |`); continue; }
    const cells = DIMENSIONS.map((d) => {
      const app = rs.filter((r) => r.score!.dimensions[d].applicable);
      if (!app.length) return '·';
      const passes = app.filter((r) => r.score!.dimensions[d].pass).length;
      return passes === app.length ? '✓' : passes === 0 ? '✗' : `${passes}/${app.length}`;
    });
    const crit = rs.filter((r) => r.score!.criticalErrors.length).length;
    rows.push(`| ${id} | ${cells.join(' | ')} | ${crit ? `${crit}/${rs.length}` : '–'} |`);
  }
  return rows.join('\n');
}

export function failureDetails(recs: CallRecord[]): string {
  const out: string[] = [];
  for (const r of recs.filter((x) => x.score && x.run === 1)) {
    const fails = DIMENSIONS.filter((d) => r.score!.dimensions[d].applicable && !r.score!.dimensions[d].pass);
    if (fails.length) out.push(`- **${r.caseId}** — ${fails.map((d) => `${d}: ${r.score!.dimensions[d].detail}`).join(' · ')}`);
  }
  return out.join('\n');
}

