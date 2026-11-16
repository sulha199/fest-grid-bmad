/**
 * Manual POC: can Gemini report attendance mode (onsite/online/hybrid), the physical venues named in a
 * post, and each venue's kind + indoor/outdoor setting? Live Gemini calls; never touches the DB.
 *
 *   BACKEND_PORT=4001 DATABASE_URL=<any placeholder> SYSTEM_GEMINI_API_KEY=... \
 *     npx tsx scripts/poc-event-insight/run-venues.ts [--runs 2] [--model <id>] [--out <dir>]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { callGeminiGenerateContent, GeminiRateLimitedError } from '../../src/lib/ai-gateway/gemini-client.js';
import { loadCases } from './corpus.js';
import {
  EXISTING_VENUE_LABELS, NEW_VENUE_POSTS, VENUES_INSTRUCTION, scoreVenues, validateVenues, venuesSchema,
  type VenueExtraction, type VenueLabel, type VenueScore,
} from './venues.js';

function arg(name: string, fallback?: string) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; }
const RUNS = parseInt(arg('runs', '2')!, 10);
const MODEL = arg('model', process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite')!;
const OUT = resolve(arg('out', resolve(dirname(fileURLToPath(import.meta.url)), '../../../../_bmad-output/planning-artifacts/event-insight-poc/results'))!);
const KEY = arg('gemini-key') ?? process.env.GEMINI_API_KEY ?? process.env.SYSTEM_GEMINI_API_KEY;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Rec { id: string; run: number; ok: boolean; errors: string[]; out?: VenueExtraction; score?: VenueScore; latencyMs: number }

async function call(caption: string): Promise<{ text: string; ms: number }> {
  process.env.GEMINI_MODEL = MODEL;
  for (let attempt = 0; ; attempt++) {
    const t0 = Date.now();
    try {
      const { text } = await callGeminiGenerateContent(KEY as string, { contents: `Post text:\n"""\n${caption}\n"""`, systemInstruction: VENUES_INSTRUCTION, responseSchema: venuesSchema, responseMimeType: 'application/json', maxOutputTokens: 4096 });
      return { text, ms: Date.now() - t0 };
    } catch (e) {
      if (e instanceof GeminiRateLimitedError && attempt < 4) { await sleep((e.retryAfterSeconds ?? 15 * (attempt + 1)) * 1000); continue; }
      throw e;
    }
  }
}

async function main() {
  if (!KEY) throw new Error('No Gemini key (--gemini-key, GEMINI_API_KEY or SYSTEM_GEMINI_API_KEY).');
  const known = new Map(loadCases('all').map((c) => [c.id, c.caption]));
  const posts: Array<{ id: string; caption: string; label: VenueLabel }> = [
    ...Object.entries(EXISTING_VENUE_LABELS).map(([id, label]) => ({ id, caption: known.get(id) as string, label })),
    ...NEW_VENUE_POSTS.map((p) => ({ id: p.id, caption: p.caption, label: p.label })),
  ];
  const jobs = posts.flatMap((p) => Array.from({ length: RUNS }, (_, i) => ({ p, run: i + 1 })));
  const recs: Rec[] = new Array(jobs.length);
  let next = 0;
  await Promise.all(Array.from({ length: 2 }, async () => {
    while (next < jobs.length) {
      const i = next++; const { p, run } = jobs[i];
      const rec: Rec = { id: p.id, run, ok: false, errors: [], latencyMs: 0 };
      try {
        const r = await call(p.caption); rec.latencyMs = r.ms;
        const v = validateVenues(JSON.parse(r.text.replace(/^\s*```json/, '').replace(/```\s*$/, '').trim()));
        rec.ok = v.ok; rec.errors = v.errors;
        if (v.ok && v.value) { rec.out = v.value; rec.score = scoreVenues(v.value, p.label, p.caption); }
      } catch (e) { rec.errors = [String((e as Error)?.message ?? e).slice(0, 200)]; }
      recs[i] = rec; process.stdout.write(rec.ok ? '.' : 'x');
    }
  }));
  console.log();
  const scored = recs.filter((r) => r.score);
  const n = scored.length;
  const frac = (k: number) => `${k}/${n} (${Math.round((100 * k) / n)}%)`;
  const lines = [`# Venues experiment — ${MODEL}, ${RUNS} runs/post, ${posts.length} posts`, '',
    `- usable responses: ${recs.filter((r) => r.ok).length}/${recs.length}`,
    `- attendance mode correct: ${frac(scored.filter((r) => r.score!.attendance).length)}`,
    `- venue count in range: ${frac(scored.filter((r) => r.score!.count).length)}`,
    `- every expected venue found with the right setting/kind: ${frac(scored.filter((r) => r.score!.met === r.score!.total).length)}`,
    `- **online platform reported as a venue: ${scored.filter((r) => r.score!.onlineAsVenue.length).length}/${n}**`,
    `- **invented venue (name not in the post): ${scored.filter((r) => r.score!.invented.length).length}/${n}**`,
    `- wrong indoor/outdoor setting on a found venue: ${scored.filter((r) => r.score!.wrongSetting.length).length}/${n} runs; abstained (unknown): ${scored.reduce((a, r) => a + r.score!.abstained, 0)} venue(s)`,
    `- fully correct runs: ${frac(scored.filter((r) => r.score!.pass).length)}`, '',
    '| post | fully correct | attendance | venues returned | misses (run 1) |', '|---|:-:|---|---|---|'];
  for (const p of posts) {
    const rs = scored.filter((r) => r.id === p.id);
    lines.push(`| ${p.id} | ${rs.filter((r) => r.score!.pass).length}/${rs.length} | ${rs.map((r) => r.out!.attendance).join(', ')} | ${rs.map((r) => r.out!.venues.length).join(', ')} | ${rs[0]?.score!.detail.join('; ') || '—'} |`);
  }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(resolve(OUT, 'venues-experiment.json'), JSON.stringify({ model: MODEL, runs: RUNS, records: recs }, null, 1));
  writeFileSync(resolve(OUT, 'venues-experiment.generated.md'), lines.join('\n') + '\n');
  console.log(lines.slice(0, 12).join('\n'));
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
