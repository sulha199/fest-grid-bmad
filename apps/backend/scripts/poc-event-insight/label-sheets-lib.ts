/**
 * Pure pieces of label-sheets.ts: the label sheets of the audience/language/taxonomy POC (event-insight-poc/audience-and-taxonomy-poc-plan-2026-10-21.md
 * and labelling-guide-2026-10-21.md). A sheet is a CSV the labeller fills in; this module builds it from the gathered posts, validates it,
 * and measures how well two labellers agree. No I/O (node:crypto is only a hash), so it is unit-tested (label-sheets-lib.test.ts).
 *
 * The sheets contain third-party captions and live only in the git-ignored local folder. Everything this module REPORTS (agreement, disagreements,
 * problems) names post ids and label values, never a caption.
 */
import { createHash } from 'node:crypto';
import type { PocPost } from './poc-posts-lib.js';

// ---------------------------------------------------------------------------------------------------------------------------------------
// fields and allowed values (the labelling guide's table)

export const GEO_SCOPES = ['venue_local', 'city', 'region', 'national', 'international', 'online', 'unspecified'] as const;
export const AREA_LEVELS = ['neighborhood', 'city', 'regency', 'province', 'country', 'continent', 'none'] as const;
export const LANGUAGES = ['id', 'en', 'ms', 'mixed', 'other'] as const;
export const ELIGIBILITY = ['open_to_public', 'restricted', 'unspecified'] as const;
export const COST_TIERS = ['free', 'low', 'medium', 'high', 'unspecified'] as const;
export const SENSITIVE = ['none', 'religion', 'politics_civic', 'health_condition', 'sexuality', 'ethnicity'] as const;
export const YES_NO = ['yes', 'no'] as const;

/** The label columns, in sheet order. `notes` is free text and is never compared. */
export const LABEL_FIELDS = [
  'audience_country', 'geo_scope', 'post_language', 'target_area_level', 'eligibility', 'track_count', 'age_written', 'cost_tier', 'sensitive', 'unsure', 'notes',
] as const;
export type LabelField = (typeof LABEL_FIELDS)[number];
/** The fields that are compared between labellers. */
export const COMPARED_FIELDS = LABEL_FIELDS.filter((f) => f !== 'notes' && f !== 'unsure') as readonly LabelField[];

export const CONTEXT_COLUMNS = ['id', 'account', 'stratum', 'url', 'post_date', 'caption', 'hashtags', 'tagged_place'] as const;
export const SHEET_COLUMNS: readonly string[] = [...CONTEXT_COLUMNS, ...LABEL_FIELDS];

/** The value a field may take, or null for free text. `unclear` is always allowed. */
function allowed(field: LabelField, value: string): boolean {
  if (value === 'unclear') return field !== 'notes';
  switch (field) {
    case 'audience_country': return value === 'international' || /^[a-z]{2}$/.test(value);
    case 'geo_scope': return (GEO_SCOPES as readonly string[]).includes(value);
    case 'post_language': return (LANGUAGES as readonly string[]).includes(value);
    case 'target_area_level': return (AREA_LEVELS as readonly string[]).includes(value);
    case 'eligibility': return (ELIGIBILITY as readonly string[]).includes(value);
    case 'track_count': return /^\d{1,2}$/.test(value);
    case 'age_written': case 'unsure': return (YES_NO as readonly string[]).includes(value);
    case 'cost_tier': return (COST_TIERS as readonly string[]).includes(value);
    case 'sensitive': return (SENSITIVE as readonly string[]).includes(value);
    case 'notes': return true;
  }
}

export const normalizeLabel = (value: string | undefined): string => (value ?? '').trim().toLowerCase();

// ---------------------------------------------------------------------------------------------------------------------------------------
// ids and the fixed split

export const postId = (url: string): string => createHash('sha1').update(url).digest('hex').slice(0, 10);

/**
 * The held-out half, fixed by a hash of the URL so it is decided before any model output exists and never changes: the lowest bit of the first hash
 * byte. Prompts and guard rules may be tuned on the 'tuning' half only (plan section 3).
 */
export function halfOf(url: string): 'heldout' | 'tuning' {
  return parseInt(createHash('sha1').update(url).digest('hex').slice(0, 2), 16) % 2 === 1 ? 'heldout' : 'tuning';
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// CSV (RFC 4180: quotes, embedded commas and new lines)

export function toCsv(columns: readonly string[], rows: Array<Record<string, string>>): string {
  const cell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [columns.map(cell).join(','), ...rows.map((r) => columns.map((c) => cell(r[c] ?? '')).join(','))].join('\r\n') + '\r\n';
}

export function parseCsv(text: string): Array<Record<string, string>> {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // a spreadsheet export may start with a byte order mark
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') { if (src[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false; }
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); if (row.some((c) => c !== '')) rows.push(row); }
  const [header, ...body] = rows;
  if (!header) return [];
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ''])));
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// building a sheet

export interface SourcePost extends PocPost { account?: string; stratum?: string }

/** One sheet row per post (caption included, for the labeller to read locally), with blank label cells. */
export function makeSheetRows(posts: SourcePost[], half: 'all' | 'heldout' | 'tuning'): Array<Record<string, string>> {
  return posts
    .filter((p) => half === 'all' || halfOf(p.url) === half)
    .sort((a, b) => postId(a.url).localeCompare(postId(b.url))) // a stable order that does not group by account or date
    .map((p) => ({
      id: postId(p.url), account: p.account ?? p.username ?? '', stratum: p.stratum ?? '', url: p.url, post_date: p.datePosted ?? '',
      caption: p.caption, hashtags: p.hashtags.join(' '), tagged_place: p.locationName ?? '',
    }));
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// checking a filled sheet

export interface Problem { id: string; field: string; problem: string }

/** What is wrong with a filled sheet: a missing or unknown value, or a duplicate id. Rows with every label blank are reported once as "not labelled". */
export function validateSheet(rows: Array<Record<string, string>>): Problem[] {
  const out: Problem[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const id = r.id ?? '';
    if (!id) { out.push({ id: '(blank)', field: 'id', problem: 'row has no id' }); continue; }
    if (seen.has(id)) out.push({ id, field: 'id', problem: 'duplicate id' });
    seen.add(id);
    const filled = LABEL_FIELDS.filter((f) => f !== 'notes' && normalizeLabel(r[f]) !== '');
    if (filled.length === 0) { out.push({ id, field: '(all)', problem: 'not labelled' }); continue; }
    for (const f of LABEL_FIELDS) {
      const v = normalizeLabel(r[f]);
      if (f === 'notes') continue;
      if (v === '') out.push({ id, field: f, problem: 'blank' });
      else if (!allowed(f, v)) out.push({ id, field: f, problem: `unknown value "${v.slice(0, 30)}"` });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// agreement

/** Cohen's kappa for two equally long label lists. Perfect agreement on a single label gives 1 (the usual 0/0 is defined as 1 when po = 1, else 0). */
export function cohenKappa(a: string[], b: string[]): number {
  if (a.length !== b.length || a.length === 0) return NaN;
  const n = a.length;
  const po = a.filter((x, i) => x === b[i]).length / n;
  const labels = new Set([...a, ...b]);
  let pe = 0;
  for (const l of labels) pe += (a.filter((x) => x === l).length / n) * (b.filter((x) => x === l).length / n);
  if (pe >= 1) return po === 1 ? 1 : 0;
  return (po - pe) / (1 - pe);
}

export interface FieldAgreement { field: string; compared: number; agree: number; agreePct: number; kappa: number; skippedUnclear: number }
export interface Disagreement { id: string; field: string; a: string; b: string }
export interface Comparison { sharedIds: number; onlyA: number; onlyB: number; fields: FieldAgreement[]; disagreements: Disagreement[]; unclearA: number; unclearB: number }

/**
 * Compares two labellers over the posts both labelled. A field is compared only where both gave a real value: `unclear` from either side is
 * counted apart (it is an abstention, not a disagreement).
 */
export function compareSheets(a: Array<Record<string, string>>, b: Array<Record<string, string>>): Comparison {
  const mapB = new Map(b.map((r) => [r.id, r]));
  const mapA = new Map(a.map((r) => [r.id, r]));
  const shared = a.filter((r) => mapB.has(r.id));
  const fields: FieldAgreement[] = [];
  const disagreements: Disagreement[] = [];
  let unclearA = 0, unclearB = 0;
  for (const f of COMPARED_FIELDS) {
    const va: string[] = [], vb: string[] = [];
    let skipped = 0;
    for (const r of shared) {
      const x = normalizeLabel(r[f]);
      const y = normalizeLabel(mapB.get(r.id)![f]);
      if (x === 'unclear') unclearA++;
      if (y === 'unclear') unclearB++;
      if (x === '' || y === '' || x === 'unclear' || y === 'unclear') { skipped++; continue; }
      va.push(x); vb.push(y);
      if (x !== y) disagreements.push({ id: r.id, field: f, a: x, b: y });
    }
    const agree = va.filter((x, i) => x === vb[i]).length;
    fields.push({ field: f, compared: va.length, agree, agreePct: va.length ? Math.round((1000 * agree) / va.length) / 10 : NaN, kappa: va.length ? Math.round(cohenKappa(va, vb) * 1000) / 1000 : NaN, skippedUnclear: skipped });
  }
  return { sharedIds: shared.length, onlyA: a.filter((r) => !mapB.has(r.id)).length, onlyB: b.filter((r) => !mapA.has(r.id)).length, fields, disagreements, unclearA, unclearB };
}

/** The adjudication sheet: one row per disagreement, ids and values only, with a blank column for the owner's final answer. */
export function adjudicationRows(d: Disagreement[]): Array<Record<string, string>> {
  return d.map((x) => ({ id: x.id, field: x.field, labeller_a: x.a, labeller_b: x.b, final: '' }));
}

export function formatComparison(c: Comparison): string {
  const lines = [`posts labelled by both: ${c.sharedIds} (only in A: ${c.onlyA}, only in B: ${c.onlyB}); "unclear" answers: A ${c.unclearA}, B ${c.unclearB}`, '', 'field                agreed  compared  agreement   kappa  skipped'];
  for (const f of c.fields) {
    lines.push(`${f.field.padEnd(20)} ${String(f.agree).padStart(6)} ${String(f.compared).padStart(9)} ${(Number.isNaN(f.agreePct) ? '-' : f.agreePct.toFixed(1) + '%').padStart(10)} ${(Number.isNaN(f.kappa) ? '-' : f.kappa.toFixed(2)).padStart(7)} ${String(f.skippedUnclear).padStart(8)}`);
  }
  lines.push('', `disagreements to settle: ${c.disagreements.length}`);
  return lines.join('\n');
}
