/**
 * Manual POC: from what the INITIAL PROFILE SCRAPE returns, can we tell the account's country and how far its
 * own audience reaches? Live Gemini calls; never touches the DB. Same env conventions as run.ts.
 *
 *   BACKEND_PORT=4001 DATABASE_URL=<any placeholder> SYSTEM_GEMINI_API_KEY=... \
 *     npx tsx scripts/poc-event-insight/run-profile-insight.ts [--runs 3] [--model <id>] [--out <dir>]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { callGeminiGenerateContent, GeminiRateLimitedError } from '../../src/lib/ai-gateway/gemini-client.js';
import { inferCountryFromSignals } from './country-signals.js';
import {
  PROFILE_LABELS, SYNTHETIC_PROFILES, guardProfileInsight, profileInsightInstruction, profileInsightSchema, profilePromptContents, realProfiles,
  resolveCountry, scoreProfile, validateProfileInsight, type ProfileCase, type ProfileInsight, type ProfileScore,
} from './profile-insight.js';

function arg(name: string, fallback?: string) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; }
const RUNS = parseInt(arg('runs', '3') as string, 10);
const MODEL = arg('model', process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite') as string;
const OUT = resolve(arg('out', resolve(dirname(fileURLToPath(import.meta.url)), '../../../../_bmad-output/planning-artifacts/event-insight-poc/results')) as string);
const KEY = arg('gemini-key') ?? process.env.GEMINI_API_KEY ?? process.env.SYSTEM_GEMINI_API_KEY;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Rec { id: string; run: number; ok: boolean; errors: string[]; raw?: ProfileInsight; guarded?: ProfileInsight; actions?: string[]; rawScore?: ProfileScore; guardedScore?: ProfileScore; combined?: { status: string; country?: string; source?: string; reason?: string }; combinedWrong?: boolean; combinedMissed?: boolean; unsupportedClaim?: boolean }

async function call(p: ProfileCase): Promise<string> {
  process.env.GEMINI_MODEL = MODEL;
  for (let attempt = 0; ; attempt++) {
    try {
      return (await callGeminiGenerateContent(KEY as string, { contents: profilePromptContents(p), systemInstruction: profileInsightInstruction('v1'), responseSchema: profileInsightSchema, responseMimeType: 'application/json', maxOutputTokens: 4096 })).text;
    } catch (e) {
      if (e instanceof GeminiRateLimitedError && attempt < 4) { await sleep((e.retryAfterSeconds ?? 15 * (attempt + 1)) * 1000); continue; }
      throw e;
    }
  }
}

async function main() {
  if (!KEY) throw new Error('No Gemini key (--gemini-key, GEMINI_API_KEY or SYSTEM_GEMINI_API_KEY).');
  const profiles: ProfileCase[] = [...realProfiles(), ...SYNTHETIC_PROFILES];
  const jobs = profiles.flatMap((p) => Array.from({ length: RUNS }, (_, i) => ({ p, run: i + 1 })));
  const recs: Rec[] = new Array(jobs.length);
  let next = 0;
  await Promise.all(Array.from({ length: 2 }, async () => {
    while (next < jobs.length) {
      const i = next++; const { p, run } = jobs[i];
      const label = PROFILE_LABELS[p.id];
      const rec: Rec = { id: p.id, run, ok: false, errors: [] };
      try {
        const text = await call(p);
        const v = validateProfileInsight(JSON.parse(text.replace(/^\s*```json/, '').replace(/```\s*$/, '').trim()));
        rec.ok = v.ok; rec.errors = v.errors;
        if (v.ok && v.value) {
          const g = guardProfileInsight(v.value, p);
          rec.raw = v.value; rec.guarded = g.out; rec.actions = g.actions;
          rec.rawScore = scoreProfile(v.value.countryCode, v.value.reach, v.value.reachAreas, label);
          rec.guardedScore = scoreProfile(g.out.countryCode, g.out.reach, g.out.reachAreas, label);
          const signals = inferCountryFromSignals(p);
          const c = resolveCountry(signals, g.out);
          rec.combined = c.status === 'resolved' ? { status: 'resolved', country: c.country, source: c.source } : { status: 'unresolved', reason: c.reason };
          rec.combinedWrong = c.status === 'resolved' && !label.country.includes(c.country);
          rec.combinedMissed = c.status !== 'resolved' && label.country.length > 0 && !label.countryAbstainOk;
          rec.unsupportedClaim = g.out.countryCode !== 'UNKNOWN' && !signals.signals.some((s) => s.country === g.out.countryCode);
        }
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
    `- signals + guarded model — **wrong country: ${frac(rs, (r) => !!r.combinedWrong)}** · unresolved where a country was expected: ${frac(rs, (r) => !!r.combinedMissed)}`, '',
  ];
  const sigRows = profiles.map((p) => ({ p, d: inferCountryFromSignals(p), l: PROFILE_LABELS[p.id] }));
  const sigWrong = sigRows.filter((r) => r.d.status === 'resolved' && !r.l.country.includes((r.d as { country: string }).country)).length;
  const sigResolved = sigRows.filter((r) => r.d.status === 'resolved').length;
  const sigMissed = sigRows.filter((r) => r.d.status !== 'resolved' && r.l.country.length > 0 && !r.l.countryAbstainOk).length;
  const lines = [`# Profile insight (country + reach) — prompt v1, ${MODEL}, ${RUNS} runs/profile, ${profiles.length} profiles (${realProfiles().length} real, ${SYNTHETIC_PROFILES.length} synthetic)`, '',
    `- usable responses: ${recs.filter((r) => r.ok).length}/${recs.length}`, '',
    `**Deterministic signals alone** (no model; ${profiles.length} profiles): resolved ${sigResolved}/${profiles.length} · **wrong country ${sigWrong}** · unresolved where a country was expected ${sigMissed}`, '',
    ...sec('All profiles', scored), ...sec('Real profiles', scored.filter((r) => profiles.find((p) => p.id === r.id)?.origin === 'real')), ...sec('Synthetic profiles', scored.filter((r) => profiles.find((p) => p.id === r.id)?.origin === 'synthetic')),
    '| profile | origin | signals | model country (run 1) | reach (runs) | reach areas (run 1) | combined (run 1) | misses (run 1, guarded) |', '|---|---|---|---|---|---|---|---|'];
  for (const p of profiles) {
    const rs = scored.filter((r) => r.id === p.id); const r1 = rs[0]; const d = inferCountryFromSignals(p);
    lines.push(`| ${p.id} | ${p.origin} | ${d.status === 'resolved' ? d.country : d.reason} | ${rs.map((r) => r.guarded!.countryCode).join(', ')} | ${rs.map((r) => r.guarded!.reach).join(', ')} | ${r1 ? r1.guarded!.reachAreas.map((a) => a.name).join('; ') || '—' : ''} | ${r1?.combined ? (r1.combined.status === 'resolved' ? `${r1.combined.country} (${r1.combined.source})` : `unresolved (${r1.combined.reason})`) : ''} | ${r1?.guardedScore!.detail.join(' · ') || '—'} |`);
  }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(resolve(OUT, 'profile-insight-v1.json'), JSON.stringify({ prompt: 'v1', model: MODEL, runs: RUNS, records: recs }, null, 1));
  writeFileSync(resolve(OUT, 'profile-insight-v1.generated.md'), lines.join('\n') + '\n');
  console.log(lines.join('\n'));
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
