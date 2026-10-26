/**
 * Pure pieces of the audience POC runner (run-audience-poc.ts): turn one raw model answer into the record that is saved, and decide whether a
 * run may start. No I/O and no network, so it is unit-tested (audience-poc-lib.test.ts).
 *
 * WHAT IS SAVED. The saved record holds structured values only: enums, counts, the ladder's answer and its source, token counts and timings.
 * It never holds the caption, an evidence quote or a stated-audience quote (third-party content that must not leave the owner's machine, and
 * that the scorer does not need: the guards that read the caption have already run and left their counts behind).
 */
import { createHash } from 'node:crypto';
import {
  ageWrittenOf, guardAudienceInsight, sensitiveScreen, trackCountOf, validateAudienceInsight, type ClaimCounts,
} from './audience-insight.js';
import { resolveAudienceCountry, resolvePostLanguage, type AudienceSource } from './audience-country.js';

export interface RunUsage { inputTokens?: number; outputTokens?: number; thoughtTokens?: number; latencyMs: number; rateLimitRetries: number }

export interface RunRecord {
  id: string;
  run: number;
  ok: boolean;
  errors: string[];
  usage: RunUsage;
  /** The model's own values, before and after the guards, as enums and counts. */
  model?: {
    isEvent: boolean;
    postLanguage: string;
    statedCountry: string | null;
    statedVerified: boolean;
    eventCountry: string | null;
    geoScope: string;
    geoScopeRaw: string;
    targetAreaLevel: string;
    eligibility: string;
    eligibilityRaw: string;
    costTier: string;
    sensitiveTopic: string;
    trackCount: number;
    ageWritten: 'yes' | 'no';
    interests: string[];
  };
  claims?: ClaimCounts;
  actions?: string[];
  /** What the deterministic code decides from the guarded output. */
  resolved?: {
    audienceCountry: string;
    audienceSource: AudienceSource;
    postLanguage: string;
    postLanguageViaCue: boolean;
    sensitive: string;
    sensitiveSource: 'model' | 'list' | 'both' | 'none';
    sensitiveListHit: string | null;
  };
}

const parseJson = (text: string): unknown => JSON.parse(text.replace(/^\s*```json/, '').replace(/```\s*$/, '').trim());

/** Evaluates one raw answer against its caption. Never throws: a malformed answer becomes `ok: false` with the reasons. */
export function evaluateRun(args: { id: string; run: number; caption: string; accountCountry?: string; rawText: string; usage: RunUsage }): RunRecord {
  const rec: RunRecord = { id: args.id, run: args.run, ok: false, errors: [], usage: args.usage };
  let parsed: unknown;
  try { parsed = parseJson(args.rawText); } catch (e) { rec.errors = [`unparseable: ${String((e as Error).message).slice(0, 120)}`]; return rec; }
  const v = validateAudienceInsight(parsed);
  if (!v.ok || !v.value) { rec.errors = v.errors; return rec; }

  const raw = v.value;
  const g = guardAudienceInsight(raw, args.caption);
  const lang = resolvePostLanguage(g.value.postLanguage, args.caption, args.accountCountry);
  const ladder = resolveAudienceCountry({
    stated: g.value.statedAudience, postLanguage: lang.language, eventCountry: g.value.eventCountry, geoScope: g.value.geoScope,
    caption: args.caption, accountCountry: args.accountCountry,
  });
  const list = sensitiveScreen(args.caption, g.value.interests);
  const modelSensitive = g.value.sensitiveTopic !== 'none';
  const sensitive = modelSensitive ? g.value.sensitiveTopic : (list?.topic ?? 'none');

  rec.ok = true;
  rec.claims = g.claims;
  rec.actions = g.actions;
  rec.model = {
    isEvent: g.value.isEvent,
    postLanguage: g.value.postLanguage,
    statedCountry: raw.statedAudience ? raw.statedAudience.country.toLowerCase() : null,
    statedVerified: Boolean(g.value.statedAudience),
    eventCountry: raw.eventCountry ? raw.eventCountry.toLowerCase() : null,
    geoScope: g.value.geoScope,
    geoScopeRaw: raw.geoScope,
    targetAreaLevel: g.value.targetAreaLevel,
    eligibility: g.value.eligibility,
    eligibilityRaw: raw.eligibility,
    costTier: g.value.costTier,
    sensitiveTopic: g.value.sensitiveTopic,
    trackCount: trackCountOf(g.value),
    ageWritten: ageWrittenOf(g.value),
    interests: g.value.interests.map((t) => t.trim().toLowerCase()).filter(Boolean),
  };
  rec.resolved = {
    audienceCountry: ladder.country,
    audienceSource: ladder.source,
    postLanguage: lang.language,
    postLanguageViaCue: lang.viaCue,
    sensitive,
    sensitiveSource: modelSensitive && list ? 'both' : modelSensitive ? 'model' : list ? 'list' : 'none',
    sensitiveListHit: list ? list.topic : null,
  };
  return rec;
}

// ---- the gate on running against the held-out half -------------------------------------------
export const sha256 = (data: string | Buffer): string => createHash('sha256').update(data).digest('hex');

/** The first token of the frozen-hash file written by `label-sheets.ts freeze` ("<hash>  <file name>"). */
export const frozenHashOf = (fileContent: string): string => fileContent.trim().split(/\s+/)[0] ?? '';

export type RunGate = { allowed: true } | { allowed: false; reason: string };

/**
 * Plan §3: the labels are frozen (committed with a hash) before any model run. A run on the held-out half, or on everything, is allowed only
 * when the sheet it was given hashes to the frozen value. A run on the tuning half is always allowed: that half is what the prompt and the
 * guards may be tuned on.
 */
export function runGate(half: 'tuning' | 'heldout' | 'all', frozen: { sheetContent?: Buffer; hashFileContent?: string }): RunGate {
  if (half === 'tuning') return { allowed: true };
  if (!frozen.sheetContent || !frozen.hashFileContent) {
    return { allowed: false, reason: 'the held-out half is scored, so the labels must be frozen first: run label-sheets.ts freeze on the final sheet, commit the hash, then pass --frozen-sheet <that sheet>' };
  }
  const want = frozenHashOf(frozen.hashFileContent);
  const have = sha256(frozen.sheetContent);
  if (want !== have) return { allowed: false, reason: `the sheet given to --frozen-sheet hashes to ${have.slice(0, 12)}…, not the frozen ${want.slice(0, 12)}…: the labels changed after they were frozen` };
  return { allowed: true };
}

/** Merge new records into the saved ones by (id, run); an `ok` record is never replaced by a failed one. */
export function mergeRecords(saved: RunRecord[], fresh: RunRecord[]): RunRecord[] {
  const key = (r: RunRecord) => `${r.id}#${r.run}`;
  const map = new Map(saved.map((r) => [key(r), r]));
  for (const r of fresh) {
    const old = map.get(key(r));
    if (!old || !old.ok || r.ok) map.set(key(r), r);
  }
  return [...map.values()].sort((a, b) => a.id.localeCompare(b.id) || a.run - b.run);
}
