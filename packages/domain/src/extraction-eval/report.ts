import type { Aggregate, Baseline, Comparison } from './types.js';
import { EXTRACTION_EVAL_FIELDS } from './types.js';

const pct = (v: number | null): string => (v === null ? 'n/a' : `${(v * 100).toFixed(0)}%`);
const signed = (v: number | null): string => (v === null ? '' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(0)}`);

export interface ReportMeta {
  model: string;
  promptHash: string;
  runs: number;
  mode: 'live' | 'replay';
}

export interface Report {
  markdown: string;
  json: {
    meta: ReportMeta;
    totals: Aggregate['totals'];
    fields: Aggregate['fields'];
    posts: Aggregate['posts'];
    comparison: Comparison | null;
    baseline: Pick<Baseline, 'model' | 'promptHash' | 'date' | 'runs'> | null;
  };
}

/** Markdown table (field x pass-rate, with the baseline comparison when there is one) plus the same data as JSON. */
export function buildReport(aggregate: Aggregate, meta: ReportMeta, baseline: Baseline | null, comparison: Comparison | null): Report {
  const lines: string[] = [];
  lines.push(`## Extraction accuracy (${meta.mode})`, '');
  lines.push(`Model \`${meta.model}\`, prompt hash \`${meta.promptHash}\`, ${meta.runs} run(s) per post, ${Object.keys(aggregate.posts).length} post(s).`, '');
  lines.push(comparison ? '| Field | Pass-rate | Baseline | Delta (pts) | Noise band (pts) | Status |' : '| Field | Pass-rate |');
  lines.push(comparison ? '|---|---|---|---|---|---|' : '|---|---|');
  for (const field of EXTRACTION_EVAL_FIELDS) {
    const current = pct(aggregate.fields[field]);
    const row = comparison?.fields.find((c) => c.field === field);
    lines.push(row ? `| ${field} | ${current} | ${pct(row.baseline)} | ${signed(row.delta)} | ${(row.band * 100).toFixed(0)} | ${row.status} |` : `| ${field} | ${current} |`);
  }
  lines.push('', '### Outcomes', '');
  const t = aggregate.totals;
  lines.push(`Scored runs: ${t.ok}. Truncated (cut-off or unparseable, not scored): ${t.truncated}. Unavailable (429/503 after the retry cap, not scored): ${t.unavailable}. Runs with count_mismatch: ${t.countMismatch}.`, '');
  const flaggedPosts = Object.entries(aggregate.posts).filter(([, p]) => p.truncatedRuns + p.unavailableRuns + p.countMismatchRuns > 0);
  for (const [id, p] of flaggedPosts) {
    const parts = [
      p.countMismatchRuns ? `count_mismatch ${p.countMismatchRuns}/${p.okRuns}` : '',
      p.truncatedRuns ? `truncated ${p.truncatedRuns}` : '',
      p.unavailableRuns ? `unavailable ${p.unavailableRuns}` : '',
    ].filter(Boolean);
    lines.push(`- \`${id}\`: ${parts.join(', ')}`);
  }
  if (comparison) {
    const flagged = comparison.fields.filter((f) => f.status === 'flagged');
    lines.push('', '### Against the baseline', '');
    if (baseline) lines.push(`Baseline: model \`${baseline.model}\`, prompt hash \`${baseline.promptHash}\`, ${baseline.date}, ${baseline.runs} run(s).`, '');
    if (flagged.length === 0) lines.push('No field dropped beyond its noise band.');
    for (const f of flagged) {
      lines.push(`- **${f.field}** dropped ${signed(f.delta)} pts (band ${(f.band * 100).toFixed(0)}). Changed posts: ${f.changedPosts.map((p) => `\`${p.postId}\` ${pct(p.baseline)} -> ${pct(p.current)}`).join(', ') || 'none individually beyond their own band'}`);
    }
    if (comparison.newPosts.length > 0) lines.push('', `New posts (no baseline, not compared): ${comparison.newPosts.map((p) => `\`${p}\``).join(', ')}`);
  } else {
    lines.push('', 'No baseline to compare with.');
  }
  return {
    markdown: `${lines.join('\n')}\n`,
    json: {
      meta,
      totals: aggregate.totals,
      fields: aggregate.fields,
      posts: aggregate.posts,
      comparison,
      baseline: baseline ? { model: baseline.model, promptHash: baseline.promptHash, date: baseline.date, runs: baseline.runs } : null,
    },
  };
}
