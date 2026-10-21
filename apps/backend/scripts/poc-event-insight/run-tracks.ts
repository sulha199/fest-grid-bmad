/**
 * Manual POC: can Gemini express "who may take part" as TRACKS (alternatives) rather than one
 * min/max? Live Gemini calls; never touches the DB. Same env conventions as run.ts.
 *
 *   BACKEND_PORT=4001 DATABASE_URL=<any placeholder> SYSTEM_GEMINI_API_KEY=... \
 *     npx tsx scripts/poc-event-insight/run-tracks.ts [--runs 2] [--model <id>] [--out <dir>]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { callGeminiGenerateContent, GeminiRateLimitedError } from '../../src/lib/ai-gateway/gemini-client.js';
import { loadCases } from './corpus.js';
import {
  EXISTING_TRACK_LABELS, HOLDOUT_TRACK_POSTS, NEW_TRACK_POSTS, TRACKS_INSTRUCTION, scoreTracks, tracksSchema, validateTracks,
  type TrackLabel, type TrackScore, type TrackedAudience,
} from './tracks.js';

function arg(name: string, fallback?: string) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; }
const RUNS = parseInt(arg('runs', '2')!, 10);
const MODEL = arg('model', process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite')!;
const OUT = resolve(arg('out', resolve(dirname(fileURLToPath(import.meta.url)), '../../../../_bmad-output/planning-artifacts/event-insight-poc/results'))!);
const HOLD = process.argv.includes('--holdout'); // run only the held-out tracks posts
const KEY = arg('gemini-key') ?? process.env.GEMINI_API_KEY ?? process.env.SYSTEM_GEMINI_API_KEY;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Rec { id: string; run: number; ok: boolean; errors: string[]; audience?: TrackedAudience; score?: TrackScore; latencyMs: number }

async function call(caption: string): Promise<{ text: string; ms: number }> {
  process.env.GEMINI_MODEL = MODEL;
  for (let attempt = 0; ; attempt++) {
    const t0 = Date.now();
    try {
      const { text } = await callGeminiGenerateContent(KEY!, { contents: `Post text:\n"""\n${caption}\n"""`, systemInstruction: TRACKS_INSTRUCTION, responseSchema: tracksSchema, responseMimeType: 'application/json', maxOutputTokens: 4096 });
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
  const posts: Array<{ id: string; caption: string; label: TrackLabel }> = HOLD
    ? HOLDOUT_TRACK_POSTS.map((p) => ({ id: p.id, caption: p.caption, label: p.label }))
    : [
      ...Object.entries(EXISTING_TRACK_LABELS).map(([id, label]) => ({ id, caption: known.get(id)!, label })),
      ...NEW_TRACK_POSTS.map((p) => ({ id: p.id, caption: p.caption, label: p.label })),
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
        const v = validateTracks(JSON.parse(r.text.replace(/^\s*```json/, '').replace(/```\s*$/, '').trim()));
        rec.ok = v.ok; rec.errors = v.errors;
        if (v.ok && v.value) { rec.audience = v.value; rec.score = scoreTracks(v.value, p.label, p.caption); }
      } catch (e: any) { rec.errors = [String(e?.message ?? e).slice(0, 200)]; }
      recs[i] = rec; process.stdout.write(rec.ok ? '.' : 'x');
    }
  }));
  console.log();
  const scored = recs.filter((r) => r.score);
  const lines = [`# Tracks experiment — ${MODEL}, ${RUNS} runs/post, ${posts.length} posts`, '',
    `- usable responses: ${recs.filter((r) => r.ok).length}/${recs.length}`,
    `- fully correct runs (count in range, every expected track present, nothing fabricated, allAges right): ${scored.filter((r) => r.score!.pass).length}/${scored.length}`,
    `- runs with a fabricated number: ${scored.filter((r) => r.score!.fabricatedNumbers.length).length}/${scored.length}`,
    `- runs with the right number of tracks: ${scored.filter((r) => r.score!.trackCount).length}/${scored.length}`, '',
    '| post | runs fully correct | tracks returned | misses (run 1) |', '|---|:-:|---|---|'];
  for (const p of posts) {
    const rs = scored.filter((r) => r.id === p.id);
    lines.push(`| ${p.id} | ${rs.filter((r) => r.score!.pass).length}/${rs.length} | ${rs.map((r) => r.audience!.tracks.length).join(', ')} | ${rs[0]?.score!.detail.join('; ') || '—'} |`);
  }
  lines.push('', '## Raw tracks, run 1', '');
  for (const p of posts) { const r = scored.find((x) => x.id === p.id && x.run === 1); if (r) lines.push(`**${p.id}** (allAges=${r.audience!.allAges})`, '```json', JSON.stringify(r.audience!.tracks.map(({ label, ageMin, ageMax, lifeStages, genderFocus }) => ({ label, ageMin, ageMax, lifeStages, genderFocus }))), '```'); }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(resolve(OUT, HOLD ? 'tracks-holdout.json' : 'tracks-experiment.json'), JSON.stringify({ model: MODEL, runs: RUNS, records: recs }, null, 1));
  writeFileSync(resolve(OUT, HOLD ? 'tracks-holdout.generated.md' : 'tracks-experiment.generated.md'), lines.join('\n') + '\n');
  console.log(lines.slice(0, 8).join('\n'));
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
