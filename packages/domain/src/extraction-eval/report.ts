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

export interface ReportOptions {
  /**
   * Print event names in the count_mismatch detail. Off by default: names come from the labelled set (private) and
   * from model answers, and the report goes to the job summary of a public repo. Without it events are listed by
   * their position in the label (#1, #2, ...) and counted.
   */
  showNames?: boolean;
}

/** Marker that replaces a name in the JSON report when names are not shown. */
export const HIDDEN_NAME = '(hidden)';

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
export function buildReport(aggregate: Aggregate, meta: ReportMeta, baseline: Baseline | null, comparison: Comparison | null, options: ReportOptions = {}): Report {
  const showNames = options.showNames === true;
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
  lines.push(`Scored runs: ${t.ok}. Truncated (cut-off or unparseable, not scored): ${t.truncated}. Unavailable (no answer: 429/503 after the retry cap, a spent quota, or images that could not be sent; not scored): ${t.unavailable}. Runs with count_mismatch: ${t.countMismatch}.`, '');
  const flaggedPosts = Object.entries(aggregate.posts).filter(([, p]) => p.truncatedRuns + p.unavailableRuns + p.countMismatchRuns + p.missing.length + p.extras.length > 0);
  for (const [id, p] of flaggedPosts) {
    const parts = [
      p.countMismatchRuns ? `count_mismatch ${p.countMismatchRuns}/${p.okRuns}` : '',
      p.truncatedRuns ? `truncated ${p.truncatedRuns}` : '',
      p.unavailableRuns ? `unavailable ${p.unavailableRuns}` : '',
    ].filter(Boolean);
    lines.push(`- \`${id}\`: ${parts.join(', ') || 'unmatched events'}`);
    // The detail the per-field rates do not show: which labelled events were never matched, and what the model added.
    if (p.missing.length > 0) {
      lines.push(`  - Labelled events missing (runs missed of ${p.okRuns}): ${p.missing.map((m) => `#${m.index + 1}${showNames ? ` "${m.name}"` : ''} ${m.runs}/${p.okRuns}`).join(', ')}`);
    }
    if (p.extras.length > 0) {
      const total = p.extras.reduce((sum, e) => sum + e.runs, 0);
      lines.push(`  - Extra model events (reported, not scored): ${total}${showNames ? ` (${p.extras.map((e) => `"${e.name}" in ${e.runs} run(s)`).join(', ')})` : ''}`);
    }
  }
  if (comparison) {
    const flagged = comparison.fields.filter((f) => f.status === 'flagged');
    const singleRun = comparison.fields.filter((f) => f.status === 'single_run');
    lines.push('', '### Against the baseline', '');
    if (baseline) lines.push(`Baseline: model \`${baseline.model}\`, prompt hash \`${baseline.promptHash}\`, ${baseline.date}, ${baseline.runs} run(s).`, '');
    lines.push(`Pass-rate deltas are over the ${comparison.comparedPosts.length} post(s) present in both the run and the baseline.`, '');
    if (aggregate.totals.ok === 0) {
      // Never say "nothing dropped" when nothing was measured.
      lines.push('**No field had data:** no run produced a scorable answer (every run was truncated or unavailable), so no field was compared.');
    } else if (flagged.length === 0 && singleRun.length === 0) {
      lines.push('No field dropped beyond its noise band.');
    }
    for (const f of flagged) {
      lines.push(`- **${f.field}** dropped ${signed(f.delta)} pts (band ${(f.band * 100).toFixed(0)}). Changed posts: ${f.changedPosts.map((p) => `\`${p.postId}\` ${pct(p.baseline)} -> ${pct(p.current)}`).join(', ') || 'none individually beyond their own band'}`);
    }
    if (singleRun.length > 0) {
      lines.push(`Only one run per post, so a drop cannot be told from noise and these fields are not flagged: ${singleRun.map((f) => `${f.field} (${signed(f.delta)} pts)`).join(', ')}. Use \`--runs 3\` or more.`);
    }
    const tr = comparison.truncatedRate;
    if (tr.status === 'flagged') {
      lines.push(`- **Truncated or invalid answers rose** from ${pct(tr.baseline)} to ${pct(tr.current)} of the answered runs (${signed(tr.delta)} pts). These runs are not scored, so no pass-rate shows it: check the output format of the prompt or schema.`);
    } else if (tr.status === 'ok') {
      lines.push(`Truncated or invalid answers: ${pct(tr.current)} of the answered runs (baseline ${pct(tr.baseline)}).`);
    } else if (tr.status === 'no_baseline') {
      lines.push(`Truncated or invalid answers: ${pct(tr.current)} of the answered runs. This baseline does not record a rate, so it was not compared.`);
    }
    if (comparison.newPosts.length > 0) lines.push('', `New posts (no baseline, not compared): ${comparison.newPosts.map((p) => `\`${p}\``).join(', ')}`);
    if (comparison.removedPosts.length > 0) lines.push('', `Posts in the baseline but not in this run (not compared): ${comparison.removedPosts.map((p) => `\`${p}\``).join(', ')}`);
  } else {
    lines.push('', 'No baseline to compare with.');
  }
  return {
    markdown: `${lines.join('\n')}\n`,
    json: {
      meta,
      totals: aggregate.totals,
      fields: aggregate.fields,
      posts: showNames ? aggregate.posts : redactNames(aggregate.posts),
      comparison,
      baseline: baseline ? { model: baseline.model, promptHash: baseline.promptHash, date: baseline.date, runs: baseline.runs } : null,
    },
  };
}

function redactNames(posts: Aggregate['posts']): Aggregate['posts'] {
  return Object.fromEntries(
    Object.entries(posts).map(([id, p]) => [
      id,
      { ...p, missing: p.missing.map((m) => ({ ...m, name: HIDDEN_NAME })), extras: p.extras.map((e) => ({ ...e, name: HIDDEN_NAME })) },
    ])
  );
}
