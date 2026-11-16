/**
 * Offline: the decision-relevant headline metric. "Fully correct" punishes a missing claim as hard
 * as a wrong one, but for ranking they differ: an abstention leaves an event neutral, a wrong claim
 * misranks it. This reports, per results file, the share of runs containing ≥1 WRONG field (with a
 * Wilson 95% interval), raw and after guards.
 *
 *   npx tsx scripts/poc-event-insight/wrong-claims.ts "core v1=<results.json>" "holdout v2=<results.json>" ...
 */
import { readFileSync } from 'node:fs';
import { loadCases } from './corpus.js';
import { applyGuards } from './guards.js';
import { DIMENSIONS, scoreInsight } from './score.js';

const cases = new Map(loadCases('all').map((c) => [c.id, c]));

export function wilson(k: number, n: number, z = 1.96): [number, number] {
  const p = k / n, d = 1 + (z * z) / n, c = p + (z * z) / (2 * n), a = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [(c - a) / d, (c + a) / d];
}

for (const spec of process.argv.slice(2)) {
  const [label, file] = spec.split('=');
  const d = JSON.parse(readFileSync(file, 'utf8'));
  const recs = d.records.filter((r: any) => r.variant === 'standalone' && r.model === d.model && r.insight);
  for (const guarded of [false, true]) {
    let wrong = 0, abstained = 0, critical = 0, fullyCorrect = 0;
    for (const r of recs) {
      const c = cases.get(r.caseId)!;
      const insight = guarded ? applyGuards(r.insight, c.caption).insight : r.insight;
      const s = scoreInsight(insight, c.label, c.caption);
      const dims = DIMENSIONS.map((x) => s.dimensions[x]).filter((x) => x.applicable);
      const hasWrong = dims.some((x) => !x.pass && !x.abstained);
      const hasAbst = dims.some((x) => x.abstained);
      if (hasWrong) wrong++;
      if (hasAbst) abstained++;
      if (s.criticalErrors.length) critical++;
      if (!hasWrong && !hasAbst) fullyCorrect++;
    }
    const [lo, hi] = wilson(wrong, recs.length);
    console.log(`${label.padEnd(11)} ${guarded ? 'guarded' : 'raw    '} runs=${recs.length}  wrong-claim runs ${wrong} (${Math.round((100 * wrong) / recs.length)}%, 95% CI ${Math.round(100 * lo)}-${Math.round(100 * hi)}%)  runs with an abstention ${abstained}  critical ${critical}  fully correct ${fullyCorrect}`);
  }
}
