/**
 * Pure scoring for the insight POC: validate a model response, compare it with a hand-written
 * Label, and measure run-to-run stability. No network, no env — unit-tested in score.test.ts.
 */
import {
  AREA_LEVELS, COST_TIERS, ELIGIBILITY, GENDER_FOCUS, GEO_SCOPES, INFERABLE_FIELDS,
  PARTICIPATION_MODES, SEGMENTS, type EventInsight,
} from './insight-schema.js';
import type { Label } from './labels.js';

export const AREA_ALIASES: Record<string, string[]> = {
  yogyakarta: ['yogyakarta', 'jogja', 'jogjakarta', 'diy', 'daerah istimewa', 'special region'],
  sleman: ['sleman'],
  bantul: ['bantul'],
  central_java: ['jawa tengah', 'central java'],
  semarang: ['semarang'],
  jakarta: ['jakarta', 'dki'],
  bandung: ['bandung'],
  surabaya: ['surabaya'],
  bali: ['bali'],
  canggu: ['canggu'],
  asia: ['asia', 'asean'],
};

export type Dimension =
  | 'geoScope' | 'areas' | 'eligibility' | 'segments' | 'age' | 'gender'
  | 'interests' | 'participation' | 'cost' | 'language' | 'evidence';

export const DIMENSIONS: Dimension[] = [
  'geoScope', 'areas', 'eligibility', 'segments', 'age', 'gender',
  'interests', 'participation', 'cost', 'language', 'evidence',
];

export interface ScoreResult {
  // `abstained`: the insight made no claim where the label expects one (empty / "unspecified"). For
  // ranking that is the SAFE failure (the event stays neutral); a wrong claim is the harmful one.
  dimensions: Record<Dimension, { pass: boolean; applicable: boolean; abstained: boolean; detail?: string }>;
  // Errors that would actively mislead a user or hide an event from them — tracked separately
  // from plain misses, because they are the ones a ranking system must not be built on.
  criticalErrors: string[];
}

function containsAlias(name: string, key: string): boolean {
  const lower = name.toLowerCase();
  const aliases = AREA_ALIASES[key] ?? [key];
  return aliases.some((alias) => new RegExp(`(^|[^a-z])${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(lower));
}

// NFKC folds decorative unicode (math-bold letters, fullwidth forms) to plain letters, then every
// non-alphanumeric is dropped so emoji/markdown/whitespace differences never fail a verbatim check.
export function normalizeForQuoteMatch(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

export function isVerbatimQuote(quote: string, source: string): boolean {
  const q = normalizeForQuoteMatch(quote);
  return q.length >= 4 && normalizeForQuoteMatch(source).includes(q);
}

export interface ValidationResult { ok: boolean; errors: string[]; insight?: EventInsight }

const isOneOf = <T extends string>(allowed: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value);

export function validateInsight(raw: unknown): ValidationResult {
  const errors: string[] = [];
  if (typeof raw !== 'object' || raw === null) return { ok: false, errors: ['not an object'] };
  const r = raw as Record<string, unknown>;
  const arrayOf = (key: string, check: (v: unknown) => boolean) => {
    if (!Array.isArray(r[key])) { errors.push(`${key} is not an array`); return; }
    if (!(r[key] as unknown[]).every(check)) errors.push(`${key} has an invalid member`);
  };
  if (!isOneOf(GEO_SCOPES, r.geoScope)) errors.push('geoScope invalid');
  if (!isOneOf(ELIGIBILITY, r.eligibility)) errors.push('eligibility invalid');
  if (!isOneOf(GENDER_FOCUS, r.genderFocus)) errors.push('genderFocus invalid');
  if (!isOneOf(COST_TIERS, r.costTier)) errors.push('costTier invalid');
  if (typeof r.confidence !== 'number' || r.confidence < 0 || r.confidence > 1) errors.push('confidence invalid');
  arrayOf('segments', (v) => isOneOf(SEGMENTS, v));
  arrayOf('participationModes', (v) => isOneOf(PARTICIPATION_MODES, v));
  arrayOf('inferredFields', (v) => isOneOf(INFERABLE_FIELDS, v));
  arrayOf('interests', (v) => typeof v === 'string');
  arrayOf('languages', (v) => typeof v === 'string');
  arrayOf('evidence', (v) => typeof v === 'string');
  arrayOf('targetAreas', (v) => typeof v === 'object' && v !== null
    && typeof (v as { name?: unknown }).name === 'string' && isOneOf(AREA_LEVELS, (v as { level?: unknown }).level));
  for (const key of ['ageMin', 'ageMax'] as const) {
    if (r[key] !== undefined && r[key] !== null && typeof r[key] !== 'number') errors.push(`${key} not a number`);
  }
  return errors.length === 0 ? { ok: true, errors, insight: raw as EventInsight } : { ok: false, errors };
}

const accepts = (rule: 'absent' | number[], value: number | undefined | null): boolean =>
  rule === 'absent' ? value === undefined || value === null : value !== undefined && value !== null && rule.includes(value);

export function scoreInsight(insight: EventInsight, label: Label, sourceText: string): ScoreResult {
  const critical: string[] = [];
  const dims = {} as ScoreResult['dimensions'];
  const set = (d: Dimension, pass: boolean, detail?: string, applicable = true, abstained = false) => { dims[d] = { pass, applicable, abstained: !pass && abstained, detail }; };

  set('geoScope', label.geoScope.includes(insight.geoScope), `got ${insight.geoScope}, accept ${label.geoScope.join('|')}`, true, insight.geoScope === 'unspecified');

  const areaNames = insight.targetAreas.map((a) => a.name);
  const missingGroups = (label.areasAll ?? []).filter((group) => !group.some((key) => areaNames.some((n) => containsAlias(n, key))));
  const forbidden = (label.areasForbid ?? []).filter((key) => areaNames.some((n) => containsAlias(n, key)));
  const notEmptyButShouldBe = label.noAreas === true && areaNames.length > 0;
  if (forbidden.length) critical.push(`forbidden area(s): ${forbidden.join(',')} in [${areaNames.join('; ')}]`);
  if (notEmptyButShouldBe) critical.push(`areas invented for a post with no place: [${areaNames.join('; ')}]`);
  set('areas', missingGroups.length === 0 && forbidden.length === 0 && !notEmptyButShouldBe,
    `got [${areaNames.join('; ')}]${missingGroups.length ? `, missing ${missingGroups.map((g) => g.join('/')).join(' & ')}` : ''}`, true, areaNames.length === 0 && forbidden.length === 0);

  set('eligibility', label.eligibility.includes(insight.eligibility), `got ${insight.eligibility}, accept ${label.eligibility.join('|')}`, true, insight.eligibility === 'unspecified');
  if (insight.eligibility === 'restricted' && !label.eligibility.includes('restricted')) {
    critical.push('marked restricted although the post does not restrict it (would hide the event from users)');
  }

  const segMissing = (label.segmentsAll ?? []).filter((group) => !group.some((s) => insight.segments.includes(s)));
  const segForbidden = (label.segmentsForbid ?? []).filter((s) => insight.segments.includes(s));
  if (segForbidden.length) critical.push(`forbidden segment(s): ${segForbidden.join(',')}`);
  set('segments', segMissing.length === 0 && segForbidden.length === 0,
    `got [${insight.segments.join(',')}]${segMissing.length ? `, missing ${segMissing.map((g) => g.join('/')).join(' & ')}` : ''}${segForbidden.length ? `, forbidden ${segForbidden.join(',')}` : ''}`, true, insight.segments.length === 0 && segForbidden.length === 0);

  const minOk = accepts(label.ageMin, insight.ageMin);
  const maxOk = accepts(label.ageMax, insight.ageMax);
  if ((label.ageMin === 'absent' && !minOk) || (label.ageMax === 'absent' && !maxOk)) {
    critical.push(`age number emitted although the text states none (min=${insight.ageMin ?? '-'}, max=${insight.ageMax ?? '-'})`);
  }
  const wrongNumber = (label.ageMin === 'absent' && !minOk) || (label.ageMax === 'absent' && !maxOk) || (Array.isArray(label.ageMin) && insight.ageMin != null && !minOk) || (Array.isArray(label.ageMax) && insight.ageMax != null && !maxOk);
  set('age', minOk && maxOk, `got ${insight.ageMin ?? '-'}..${insight.ageMax ?? '-'}`, true, !wrongNumber);

  const genderOk = label.genderFocus.includes(insight.genderFocus);
  if (!genderOk && label.genderFocus.includes('all')) critical.push(`gender restriction "${insight.genderFocus}" invented`);
  set('gender', genderOk, `got ${insight.genderFocus}, accept ${label.genderFocus.join('|')}`, true, insight.genderFocus === 'all');

  const interestText = insight.interests.map((i) => i.toLowerCase());
  const interestMissing = label.interestsAll.filter((group) => !group.some((alias) => interestText.some((t) => t.includes(alias))));
  set('interests', interestMissing.length === 0, `got [${insight.interests.join('; ')}]${interestMissing.length ? `, missing ${interestMissing.map((g) => g.join('/')).join(' & ')}` : ''}`);

  const partMissing = label.participationAll.filter((group) => !group.some((m) => insight.participationModes.includes(m)));
  set('participation', partMissing.length === 0, `got [${insight.participationModes.join(',')}]`);

  set('cost', label.costTier.includes(insight.costTier), `got ${insight.costTier}, accept ${label.costTier.join('|')}`, true, insight.costTier === 'unspecified');

  if (label.languages) {
    set('language', label.languages.every((l) => insight.languages.map((x) => x.toLowerCase()).includes(l)), `got [${insight.languages.join(',')}]`);
  } else {
    set('language', true, undefined, false);
  }

  const badQuotes = insight.evidence.filter((q) => !isVerbatimQuote(q, sourceText));
  if (badQuotes.length) critical.push(`evidence not found in source: ${badQuotes.map((q) => JSON.stringify(q.slice(0, 60))).join(', ')}`);
  set('evidence', badQuotes.length === 0, `${insight.evidence.length} quote(s), ${badQuotes.length} not verbatim`);

  return { dimensions: dims, criticalErrors: critical };
}

// Normalised fingerprint of the fields a ranking would actually consume, for run-to-run stability.
export function stabilityKey(insight: EventInsight): string {
  return JSON.stringify({
    g: insight.geoScope,
    e: insight.eligibility,
    s: [...insight.segments].sort(),
    gf: insight.genderFocus,
    c: insight.costTier,
    p: [...insight.participationModes].sort(),
    a: [insight.ageMin ?? null, insight.ageMax ?? null],
  });
}

export function agreementRate(keys: string[]): number {
  if (keys.length === 0) return 1;
  const counts = new Map<string, number>();
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  return Math.max(...counts.values()) / keys.length;
}
