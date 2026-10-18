/**
 * Manual POC: from what the INITIAL PROFILE SCRAPE returns, can we tell the account's country and how far its
 * own audience reaches? Live Gemini calls; never touches the DB. Same env conventions as run.ts.
 *
 *   BACKEND_PORT=4001 DATABASE_URL=<any placeholder> SYSTEM_GEMINI_API_KEY=... \
 *     npx tsx scripts/poc-event-insight/run-profile-insight.ts [--runs 3] [--prompt v1|v2] [--model <id>] [--out <dir>] [--from <earlier-results.json>]
 *
 * v1 = country + reach; v2 = v1 + the account's default time zone (the corpus is the same; v1 results recorded earlier
 * covered the first 16 profiles, the corpus has since grown to 18).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { callGeminiGenerateContent, GeminiRateLimitedError } from '../../src/lib/ai-gateway/gemini-client.js';
import { inferCountryFromSignals } from './country-signals.js';
import { inferZone, resolveTimezone, sameClock } from './timezone-signals.js';
import {
  PROFILE_LABELS, SYNTHETIC_PROFILES, guardProfileInsight, profileInsightInstruction, profileInsightSchemaFor, profilePromptContents, realProfiles,
  resolveCountry, scoreProfile, validateProfileInsight, type ProfileCase, type ProfileInsight, type ProfileScore,
} from './profile-insight.js';

function arg(name: string, fallback?: string) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; }
const RUNS = parseInt(arg('runs', '3') as string, 10);
const PROMPT = arg('prompt', 'v1') as string;
const MODEL = arg('model', process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite') as string;
const OUT = resolve(arg('out', resolve(dirname(fileURLToPath(import.meta.url)), '../../../../_bmad-output/planning-artifacts/event-insight-poc/results')) as string);
const KEY = arg('gemini-key') ?? process.env.GEMINI_API_KEY ?? process.env.SYSTEM_GEMINI_API_KEY;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Rec { id: string; run: number; ok: boolean; errors: string[]; raw?: ProfileInsight; guarded?: ProfileInsight; actions?: string[]; rawScore?: ProfileScore; guardedScore?: ProfileScore; combined?: { status: string; country?: string; source?: string; reason?: string }; combinedWrong?: boolean; combinedMissed?: boolean; unsupportedClaim?: boolean; tzCombined?: { status: string; zone?: string; source?: string; reason?: string }; tzCombinedWrong?: boolean; tzCombinedMissed?: boolean; tzUnsupported?: boolean }

async function call(p: ProfileCase): Promise<string> {
  process.env.GEMINI_MODEL = MODEL;
  for (let attempt = 0; ; attempt++) {
    try {
      return (await callGeminiGenerateContent(KEY as string, { contents: profilePromptContents(p), systemInstruction: profileInsightInstruction(PROMPT), responseSchema: profileInsightSchemaFor(PROMPT), responseMimeType: 'application/json', maxOutputTokens: 4096 })).text;
    } catch (e) {
      if (e instanceof GeminiRateLimitedError && attempt < 4) { await sleep((e.retryAfterSeconds ?? 15 * (attempt + 1)) * 1000); continue; }
      throw e;
    }
  }
}

function evaluate(rec: Rec, p: ProfileCase, value: ProfileInsight) {
  const label = PROFILE_LABELS[p.id];
  const g = guardProfileInsight(value, p);
  rec.raw = value; rec.guarded = g.out; rec.actions = g.actions;
  rec.rawScore = scoreProfile(value.countryCode, value.reach, value.reachAreas, label, value.timezone);
  rec.guardedScore = scoreProfile(g.out.countryCode, g.out.reach, g.out.reachAreas, label, g.out.timezone);
  const signals = inferCountryFromSignals(p);
  const c = resolveCountry(signals, g.out);
  rec.combined = c.status === 'resolved' ? { status: 'resolved', country: c.country, source: c.source } : { status: 'unresolved', reason: c.reason };
  rec.combinedWrong = c.status === 'resolved' && !label.country.includes(c.country);
  rec.combinedMissed = c.status !== 'resolved' && label.country.length > 0 && !label.countryAbstainOk;
  rec.unsupportedClaim = g.out.countryCode !== 'UNKNOWN' && !signals.signals.some((s) => s.country === g.out.countryCode);
  if (PROMPT === 'v2' && label.tz) {
    const country = c.status === 'resolved' ? c.country : undefined;
    const zoneSignals = inferZone(p, { country });
    const tz = resolveTimezone(zoneSignals, { zone: g.out.timezone === 'UNKNOWN' ? undefined : g.out.timezone, quoted: (g.out.timezoneEvidence?.length ?? 0) > 0 }, g.out.reach, country);
    rec.tzCombined = tz.status === 'resolved' ? { status: 'resolved', zone: tz.zone, source: tz.source } : { status: 'unresolved', reason: tz.reason };
    rec.tzCombinedWrong = tz.status === 'resolved' && !label.tz.accept.some((z) => sameClock(z, tz.zone));
    rec.tzCombinedMissed = tz.status !== 'resolved' && label.tz.accept.length > 0 && !label.tz.abstainOk;
    rec.tzUnsupported = !!g.out.timezone && g.out.timezone !== 'UNKNOWN' && !(zoneSignals.status === 'resolved' && sameClock(zoneSignals.zone, g.out.timezone));
  }
}

const FROM = arg('from'); // re-evaluate the recorded raw model answers of an earlier run with the CURRENT guards and signals: no model calls

async function main() {
  if (!KEY && !FROM) throw new Error('No Gemini key (--gemini-key, GEMINI_API_KEY or SYSTEM_GEMINI_API_KEY).');
  const profiles: ProfileCase[] = [...realProfiles(), ...SYNTHETIC_PROFILES];
  const jobs = profiles.flatMap((p) => Array.from({ length: RUNS }, (_, i) => ({ p, run: i + 1 })));
  const recs: Rec[] = new Array(jobs.length);
  let next = 0;
  if (FROM) {
    const prior = JSON.parse(readFileSync(FROM, 'utf8')) as { records: Rec[] };
    recs.length = 0;
    for (const old of prior.records) {
      const p = profiles.find((x) => x.id === old.id);
      const rec: Rec = { id: old.id, run: old.run, ok: old.ok, errors: old.errors };
      if (p && old.raw) evaluate(rec, p, old.raw);
      recs.push(rec);
    }
    next = jobs.length;
  }
  await Promise.all(Array.from({ length: 2 }, async () => {
    while (next < jobs.length) {
      const i = next++; const { p, run } = jobs[i];
      const label = PROFILE_LABELS[p.id];
      const rec: Rec = { id: p.id, run, ok: false, errors: [] };
      try {
        const text = await call(p);
        const v = validateProfileInsight(JSON.parse(text.replace(/^\s*```json/, '').replace(/```\s*$/, '').trim()));
        rec.ok = v.ok; rec.errors = v.errors;
        if (v.ok && v.value) evaluate(rec, p, v.value);
      } catch (e) { rec.errors = [String((e as Error)?.message ?? e).slice(0, 200)]; }
      recs[i] = rec; process.stdout.write(rec.ok ? '.' : 'x');
    }
  }));
  console.log();

  const scored = recs.filter((r) => r.rawScore);
  const frac = (rs: Rec[], f: (r: Rec) => boolean) => `${rs.filter(f).length}/${rs.length}`;
  const sec = (title: string, rs: Rec[]) => [
    `**${title}** (${rs.length} runs)`,
    `- model, raw — fully correct: ${frac(rs, (r) => r.rawScore!.pass)} · **wrong country: ${frac(rs, (r) => r.rawScore!.countryWrong)}** · country UNKNOWN where one was expected: ${frac(rs, (r) => r.rawScore!.countryMissed)} · reach right: ${frac(rs, (r) => r.rawScore!.reachOk)} · areas right: ${frac(rs, (r) => r.rawScore!.areasOk)} · **national/unspecified given a place: ${frac(rs, (r) => r.rawScore!.nationalWithArea)}**`,
    `- model, guarded — fully correct: ${frac(rs, (r) => r.guardedScore!.pass)} · **wrong country: ${frac(rs, (r) => r.guardedScore!.countryWrong)}** · UNKNOWN where expected: ${frac(rs, (r) => r.guardedScore!.countryMissed)} · guard actions fired: ${frac(rs, (r) => (r.actions?.length ?? 0) > 0)}`,
    `- model claims a country that no deterministic signal supports: ${frac(rs, (r) => !!r.unsupportedClaim)}`,
    `- signals + guarded model — **wrong country: ${frac(rs, (r) => !!r.combinedWrong)}** · unresolved where a country was expected: ${frac(rs, (r) => !!r.combinedMissed)}`,
    ...(PROMPT === 'v2' ? [
      `- **time zone** — model raw: **wrong ${frac(rs, (r) => r.rawScore!.tzWrong)}** · UNKNOWN where expected ${frac(rs, (r) => r.rawScore!.tzMissed)} · model guarded: **wrong ${frac(rs, (r) => r.guardedScore!.tzWrong)}** · UNKNOWN where expected ${frac(rs, (r) => r.guardedScore!.tzMissed)} · a zone the signals do not confirm: ${frac(rs, (r) => !!r.tzUnsupported)}`,
      `- **time zone, signals + guarded model + reach gate** — **wrong ${frac(rs, (r) => !!r.tzCombinedWrong)}** · unresolved where a zone was expected ${frac(rs, (r) => !!r.tzCombinedMissed)}`,
    ] : []), '',
  ];
  const sigRows = profiles.map((p) => ({ p, d: inferCountryFromSignals(p), l: PROFILE_LABELS[p.id] }));
  const sigWrong = sigRows.filter((r) => r.d.status === 'resolved' && !r.l.country.includes((r.d as { country: string }).country)).length;
  const sigResolved = sigRows.filter((r) => r.d.status === 'resolved').length;
  const sigMissed = sigRows.filter((r) => r.d.status !== 'resolved' && r.l.country.length > 0 && !r.l.countryAbstainOk).length;
  const zoneRows = profiles.map((p) => { const c = inferCountryFromSignals(p); return { p, d: inferZone(p, { country: c.status === 'resolved' ? c.country : undefined }), l: PROFILE_LABELS[p.id] }; });
  const zWrong = zoneRows.filter((r) => r.d.status === 'resolved' && !r.l.tz!.accept.some((z) => sameClock(z, (r.d as { zone: string }).zone))).length;
  const zResolved = zoneRows.filter((r) => r.d.status === 'resolved').length;
  const zMissed = zoneRows.filter((r) => r.d.status !== 'resolved' && r.l.tz!.accept.length > 0 && !r.l.tz!.abstainOk).length;
  const lines = [`# Profile insight (country + reach${PROMPT === 'v2' ? ' + time zone' : ''}) — prompt ${PROMPT}, ${MODEL}, ${RUNS} runs/profile, ${profiles.length} profiles (${realProfiles().length} real, ${SYNTHETIC_PROFILES.length} synthetic)`, '',
    `- usable responses: ${recs.filter((r) => r.ok).length}/${recs.length}`, '',
    `**Deterministic signals alone** (no model; ${profiles.length} profiles): resolved ${sigResolved}/${profiles.length} · **wrong country ${sigWrong}** · unresolved where a country was expected ${sigMissed}`, '',
    `**Deterministic time-zone signals alone** (no model, no reach gate): resolved ${zResolved}/${profiles.length} · **wrong zone ${zWrong}** · unresolved where a zone was expected ${zMissed}`, '',
    ...sec('All profiles', scored), ...sec('Real profiles', scored.filter((r) => profiles.find((p) => p.id === r.id)?.origin === 'real')), ...sec('Synthetic profiles', scored.filter((r) => profiles.find((p) => p.id === r.id)?.origin === 'synthetic')),
    '| profile | origin | signals | model country (run 1) | reach (runs) | reach areas (run 1) | combined country (run 1) | zone: signals → model (runs) → combined (run 1) | misses (run 1, guarded) |', '|---|---|---|---|---|---|---|---|---|'];
  for (const p of profiles) {
    const rs = scored.filter((r) => r.id === p.id); const r1 = rs[0]; const d = inferCountryFromSignals(p);
    const zs = zoneRows.find((r) => r.p.id === p.id)!.d;
    lines.push(`| ${p.id} | ${p.origin} | ${d.status === 'resolved' ? d.country : d.reason} | ${rs.map((r) => r.guarded!.countryCode).join(', ')} | ${rs.map((r) => r.guarded!.reach).join(', ')} | ${r1 ? r1.guarded!.reachAreas.map((a) => a.name).join('; ') || '—' : ''} | ${r1?.combined ? (r1.combined.status === 'resolved' ? `${r1.combined.country} (${r1.combined.source})` : `unresolved (${r1.combined.reason})`) : ''} | ${PROMPT === 'v2' ? `${zs.status === 'resolved' ? zs.zone : zs.reason} → ${rs.map((r) => r.guarded!.timezone ?? '').join(', ')} → ${r1?.tzCombined ? (r1.tzCombined.status === 'resolved' ? `${r1.tzCombined.zone} (${r1.tzCombined.source})` : `unresolved (${r1.tzCombined.reason})`) : ''}` : '—'} | ${r1?.guardedScore!.detail.join(' · ') || '—'} |`);
  }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(resolve(OUT, `profile-insight-${PROMPT}${FROM ? '-rescored' : ''}.json`), JSON.stringify({ prompt: PROMPT, model: MODEL, runs: RUNS, records: recs }, null, 1));
  writeFileSync(resolve(OUT, `profile-insight-${PROMPT}${FROM ? '-rescored' : ''}.generated.md`), lines.join('\n') + '\n');
  console.log(lines.join('\n'));
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
