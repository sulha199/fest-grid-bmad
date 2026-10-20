/**
 * Calibration scorer for the pin-trust floor and the `full_match` clause (AD-14 Rule 4, BUG-066). Input: the CSV that
 * `results/prod-findings-review-2026-10-19-queries/pin-trust-sample.sql` produced, with its `label` column filled by a person
 * (Y = the pin is the place the text means, C = right city or area but not the place, N = wrong, ? = cannot tell).
 *
 *   npx tsx scripts/poc-event-insight/score-pin-trust-labels.ts <labelled.csv> [--md <out.md>]
 *
 * The sample is stratified, so each row is weighted by stratum_population / stratum_sampled: the numbers describe the whole table of pins, not the
 * sample. Rows labelled `?` or left empty are left out and counted. Each candidate rule is `confidence >= floor` and, optionally, `match_class =
 * full_match`; the rule of record today is 0.5 with full_match. "Precision" = share of the weighted pins a rule trusts that are labelled Y (strict) or Y/C
 * (lenient); "kept" = share of the weighted Y pins that the rule still trusts. Labels are one person's judgement; the strata with few pins are noisy.
 */
import { readFileSync, writeFileSync } from 'node:fs';

export interface LabelledPin { confidence: number | null; matchClass: 'full_match' | 'other'; weight: number; label: 'Y' | 'C' | 'N' }

/** Minimal RFC 4180 reader: quoted fields, doubled quotes, CRLF or LF. */
export function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = []; let field = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(field); field = ''; if (row.some((f) => f !== '')) rows.push(row); row = []; }
    else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); if (row.some((f) => f !== '')) rows.push(row); }
  const [head, ...body] = rows;
  if (!head) return [];
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ''])));
}

export function toLabelled(rows: Array<Record<string, string>>): { pins: LabelledPin[]; skipped: number } {
  const pins: LabelledPin[] = []; let skipped = 0;
  for (const r of rows) {
    const label = (r.label ?? '').trim().toUpperCase();
    const pop = Number(r.stratum_population); const sampled = Number(r.stratum_sampled);
    if ((label !== 'Y' && label !== 'C' && label !== 'N') || !(pop > 0) || !(sampled > 0)) { skipped++; continue; }
    const confRaw = (r.confidence ?? '').trim();
    pins.push({ confidence: confRaw === '' ? null : Number(confRaw), matchClass: r.match_class === 'full_match' ? 'full_match' : 'other', weight: pop / sampled, label });
  }
  return { pins, skipped };
}

export interface RuleScore { floor: number; requireFullMatch: boolean; trustedWeight: number; strictPrecision: number | null; lenientPrecision: number | null; keptY: number | null }

export function scoreRules(pins: LabelledPin[], floors = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]): RuleScore[] {
  const totalY = pins.filter((p) => p.label === 'Y').reduce((a, p) => a + p.weight, 0);
  const out: RuleScore[] = [];
  for (const requireFullMatch of [true, false]) for (const floor of floors) {
    const trusted = pins.filter((p) => p.confidence !== null && p.confidence >= floor && (!requireFullMatch || p.matchClass === 'full_match'));
    const w = trusted.reduce((a, p) => a + p.weight, 0);
    const y = trusted.filter((p) => p.label === 'Y').reduce((a, p) => a + p.weight, 0);
    const yc = trusted.filter((p) => p.label !== 'N').reduce((a, p) => a + p.weight, 0);
    out.push({ floor, requireFullMatch, trustedWeight: w, strictPrecision: w ? y / w : null, lenientPrecision: w ? yc / w : null, keptY: totalY ? y / totalY : null });
  }
  return out;
}

const pct = (x: number | null) => (x === null ? 'n/a' : `${(x * 100).toFixed(0)}%`);
export function renderTable(scores: RuleScore[], skipped: number, n: number): string {
  const head = [`${n} labelled rows used, ${skipped} left out (empty, ? or no weight).`, '', '| floor | full_match required | weighted pins trusted | precision (Y) | precision (Y or C) | Y pins kept |', '|--:|:-:|--:|--:|--:|--:|'];
  return [...head, ...scores.map((s) => `| ${s.floor.toFixed(2)} | ${s.requireFullMatch ? 'yes' : 'no'}${s.floor === 0.5 && s.requireFullMatch ? ' (today)' : ''} | ${s.trustedWeight.toFixed(0)} | ${pct(s.strictPrecision)} | ${pct(s.lenientPrecision)} | ${pct(s.keptY)} |`)].join('\n');
}

if (process.argv[1]?.endsWith('score-pin-trust-labels.ts')) {
  const file = process.argv[2];
  if (!file) { console.error('usage: score-pin-trust-labels.ts <labelled.csv> [--md <out.md>]'); process.exitCode = 1; }
  else {
    const { pins, skipped } = toLabelled(parseCsv(readFileSync(file, 'utf8')));
    const text = renderTable(scoreRules(pins), skipped, pins.length);
    console.log(text);
    const i = process.argv.indexOf('--md');
    if (i >= 0 && process.argv[i + 1]) writeFileSync(process.argv[i + 1], `# Pin-trust calibration (generated)\n\n${text}\n`);
  }
}
