/**
 * Manual POC: can Gemini report where an event's AUDIENCE is (as opposed to where it is held)? Live
 * Gemini calls; never touches the DB. Same env conventions as run.ts.
 *
 *   BACKEND_PORT=4001 DATABASE_URL=<any placeholder> SYSTEM_GEMINI_API_KEY=... \
 *     npx tsx scripts/poc-event-insight/run-audience-areas.ts [--runs 3] [--prompt v1|v2] [--set core|holdout|all] [--model <id>] [--out <dir>]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { callGeminiGenerateContent, GeminiRateLimitedError } from '../../src/lib/ai-gateway/gemini-client.js';
import { loadCases } from './corpus.js';
import {
  AUDIENCE_AREAS_INSTRUCTIONS, EXISTING_AREA_LABELS, HOLDOUT_AREA_POSTS, NEW_AREA_POSTS, audienceAreasSchema, scoreAreas, validateAudienceAreas,
  type AreaLabel, type AreaScore, type AudienceAreas,
} from './audience-areas.js';

function arg(name: string, fallback?: string) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; }
const RUNS = parseInt(arg('runs', '3') as string, 10);
const MODEL = arg('model', process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite') as string;
const OUT = resolve(arg('out', resolve(dirname(fileURLToPath(import.meta.url)), '../../../../_bmad-output/planning-artifacts/event-insight-poc/results')) as string);
const PROMPT = arg('prompt', 'v1') as string;
// core = the 20 posts the first prompt was written around; holdout = 6 posts labelled before prompt v2 existed; all = both.
const SET = arg('set', 'core') as string;
const KEY = arg('gemini-key') ?? process.env.GEMINI_API_KEY ?? process.env.SYSTEM_GEMINI_API_KEY;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Rec { id: string; run: number; ok: boolean; errors: string[]; out?: AudienceAreas; score?: AreaScore }

async function call(caption: string, account?: string): Promise<string> {
  process.env.GEMINI_MODEL = MODEL;
  // Production passes the account name as metadata (build-gemini-request.ts); do the same, because a
  // city in the account name is one of the leaks under test.
  const contents = `${account ? `Account Name Metadata: "${account}"\n` : ''}Post text:\n"""\n${caption}\n"""`;
  for (let attempt = 0; ; attempt++) {
    try {
      return (await callGeminiGenerateContent(KEY as string, { contents, systemInstruction: AUDIENCE_AREAS_INSTRUCTIONS[PROMPT], responseSchema: audienceAreasSchema, responseMimeType: 'application/json', maxOutputTokens: 4096 })).text;
    } catch (e) {
      if (e instanceof GeminiRateLimitedError && attempt < 4) { await sleep((e.retryAfterSeconds ?? 15 * (attempt + 1)) * 1000); continue; }
      throw e;
    }
  }
}

async function main() {
  if (!KEY) throw new Error('No Gemini key (--gemini-key, GEMINI_API_KEY or SYSTEM_GEMINI_API_KEY).');
  const known = new Map(loadCases('all').map((c) => [c.id, c]));
  if (!AUDIENCE_AREAS_INSTRUCTIONS[PROMPT]) throw new Error(`Unknown prompt ${PROMPT}`);
  const core = [
    ...Object.entries(EXISTING_AREA_LABELS).map(([id, label]) => ({ id, caption: known.get(id)?.caption as string, label, account: known.get(id)?.account, fresh: false })),
    ...NEW_AREA_POSTS.map((p) => ({ id: p.id, caption: p.caption, label: p.label, account: p.account, fresh: true })),
  ];
  const holdout = HOLDOUT_AREA_POSTS.map((p) => ({ id: p.id, caption: p.caption, label: p.label, account: p.account, fresh: true }));
  const posts: Array<{ id: string; caption: string; label: AreaLabel; account?: string; fresh: boolean }> = SET === 'holdout' ? holdout : SET === 'all' ? [...core, ...holdout] : core;
  const jobs = posts.flatMap((p) => Array.from({ length: RUNS }, (_, i) => ({ p, run: i + 1 })));
  const recs: Rec[] = new Array(jobs.length);
  let next = 0;
  await Promise.all(Array.from({ length: 2 }, async () => {
    while (next < jobs.length) {
      const i = next++; const { p, run } = jobs[i];
      const rec: Rec = { id: p.id, run, ok: false, errors: [] };
      try {
        const text = await call(p.caption, p.account);
        const v = validateAudienceAreas(JSON.parse(text.replace(/^\s*```json/, '').replace(/```\s*$/, '').trim()));
        rec.ok = v.ok; rec.errors = v.errors;
        if (v.ok && v.value) { rec.out = v.value; rec.score = scoreAreas(v.value, p.label, p.caption); }
      } catch (e) { rec.errors = [String((e as Error)?.message ?? e).slice(0, 200)]; }
      recs[i] = rec; process.stdout.write(rec.ok ? '.' : 'x');
    }
  }));
  console.log();
  const scored = recs.filter((r) => r.score);
  const fresh = new Set(posts.filter((p) => p.fresh).map((p) => p.id));
  const frac = (rs: Rec[], f: (r: Rec) => boolean) => `${rs.filter(f).length}/${rs.length}`;
  const section = (title: string, rs: Rec[]) => [
    `**${title}** (${rs.length} runs)`,
    `- fully correct: ${frac(rs, (r) => r.score!.pass)}`,
    `- geoScope right: ${frac(rs, (r) => r.score!.scope)}`,
    `- every expected audience area found with an accepted basis: ${frac(rs, (r) => r.score!.expectationsMet === r.score!.expectationsTotal)}`,
    `- **venue-derived area on a nationwide/international event: ${frac(rs, (r) => r.score!.venueAreaOnNationwide)}**`,
    `- **forbidden area (venue / account-name / artist-origin leak): ${frac(rs, (r) => r.score!.forbiddenHit.length > 0)}**`,
    `- venue area added next to a stated area: ${frac(rs, (r) => r.score!.venueWithStated)}`,
    `- stated area not in the post text: ${frac(rs, (r) => r.score!.ungroundedStated.length > 0)}`, '',
  ];
  const lines = [`# Audience-area experiment — prompt ${PROMPT}, set ${SET}, ${MODEL}, ${RUNS} runs/post, ${posts.length} posts`, '', `- usable responses: ${recs.filter((r) => r.ok).length}/${recs.length}`, '',
    ...section('All posts', scored), ...section('Posts written for this experiment (unseen)', scored.filter((r) => fresh.has(r.id))), ...section('Posts re-used from the first study (cald-conference was a known failure)', scored.filter((r) => !fresh.has(r.id))),
    '| post | fully correct | scope | areas returned (run 1) | misses (run 1) |', '|---|:-:|---|---|---|'];
  for (const p of posts) {
    const rs = scored.filter((r) => r.id === p.id);
    const r1 = rs[0];
    lines.push(`| ${p.id}${p.fresh ? '' : ' †'} | ${rs.filter((r) => r.score!.pass).length}/${rs.length} | ${rs.map((r) => r.out!.geoScope).join(', ')} | ${r1 ? r1.out!.areas.map((a) => `${a.name} (${a.basis})`).join('; ') || '—' : ''} | ${r1?.score!.detail.join(' · ') || '—'} |`);
  }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(resolve(OUT, `audience-areas-${PROMPT}-${SET}.json`), JSON.stringify({ prompt: PROMPT, set: SET, model: MODEL, runs: RUNS, records: recs }, null, 1));
  writeFileSync(resolve(OUT, `audience-areas-${PROMPT}-${SET}.generated.md`), lines.join('\n') + '\n');
  console.log(lines.slice(0, 26).join('\n'));
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
