// POC: a SEPARATE text-only Gemini call that assigns a stage to every schedule of an event from its titles and dates (no images, no caption).
// It leaves the extraction prompt and the grouping decision untouched. Scores against the hand labels (private/title-labels.txt).
//   npx tsx classify-titles-call.ts --runs 2 [--spacing 1500] [--limit 0]
// Output: private/classify-call-runs.jsonl (gitignored; contains public event titles that may hold names). Resumable.
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { callGeminiGenerateContent } from '../../../apps/backend/src/lib/ai-gateway/gemini-client.ts';
import { loadBackendEnv } from '../../../apps/backend/src/env.ts';

const args = Object.fromEntries(process.argv.slice(2).reduce<string[][]>((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const runs = Number(args.runs ?? 2), spacing = Number(args.spacing ?? 1500), limit = Number(args.limit ?? 0);
const OUT = args.out ?? 'private/classify-call-runs.jsonl';
const key = loadBackendEnv().systemGeminiApiKey;
if (!key) { console.error('no SYSTEM_GEMINI_API_KEY in .env'); process.exit(2); }

export const CALL_STAGES = ['event', 'registration', 'submission', 'announcement', 'preparation', 'other'] as const;
const SYSTEM = `You label the schedule rows of ONE event. For each row decide what the row is for a person who wants to attend or take part, using exactly one stage:
- event: the event itself: its day(s), sessions, matches, rounds, performances, talks, workshops or promotions that people attend or take part in. This is the default when unsure. A competition round, semi-final or final that is played on its own date is an event row.
- registration: a period or deadline for signing up, buying tickets or applying (including early bird, presale, batches, extensions, "last call").
- submission: a period or deadline for sending in work (entries, papers, proposals, videos, documents).
- announcement: when results, winners, finalists or selected participants are announced.
- preparation: logistics before or around the event day that are not the event itself: technical meeting, race-pack or kit collection, ticket redemption, on-site re-registration, rehearsal, briefing, manager meeting.
- other: none of the above fits.
Judge the meaning of the row, not only single words: a title that mixes the event day with a logistics item (for example "Technical Meeting & Match Day") is the event. Use the event name and the other rows only as context. Return one entry per row index, never skip or add rows.`;
const SCHEMA = {
  type: 'OBJECT',
  properties: { rows: { type: 'ARRAY', items: { type: 'OBJECT', properties: { index: { type: 'INTEGER' }, stage: { type: 'STRING', enum: [...CALL_STAGES] } }, required: ['index', 'stage'] } } },
  required: ['rows'],
};

const prod = readFileSync('private/prod-schedule-titles.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const byEvent = new Map<string, any[]>(); prod.forEach((r) => { if (!byEvent.has(r.e)) byEvent.set(r.e, []); byEvent.get(r.e)!.push(r); });
const sample: any[] = JSON.parse(readFileSync('private/title-sample.json', 'utf8'));
const keyOf = (en: string, t: string, s: string) => `${en}|${t}|${s}`;
const idx = new Map(prod.map((r) => [keyOf(r.en, r.t, r.s), r.e]));
const eventIds = [...new Set(sample.map((r) => idx.get(keyOf(r.en, r.t, r.s))).filter(Boolean))] as string[];
const todo = limit ? eventIds.slice(0, limit) : eventIds;
console.log(`labelled sample rows ${sample.length}, events ${eventIds.length}, runs ${runs}`);

const done = new Set(existsSync(OUT) ? readFileSync(OUT, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((j) => j.ok).map((j) => `${j.e}|${j.run}`) : []);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
for (let run = 1; run <= runs; run++) {
  for (const e of todo) {
    if (done.has(`${e}|${run}`)) continue;
    const rows = byEvent.get(e)!.slice().sort((a, b) => String(a.s).localeCompare(String(b.s)) || String(a.t).localeCompare(String(b.t))).slice(0, 40);
    const body = `Event name: ${rows[0].en}\nRows:\n` + rows.map((r, i) => `${i}. ${r.t ?? '(no title)'} | start ${r.s ?? '?'}${r.x && r.x !== r.s ? ` | end ${r.x}` : ''}`).join('\n');
    let attempt = 0;
    for (;;) {
      attempt++;
      try {
        const t0 = Date.now();
        const res = await callGeminiGenerateContent(key, { contents: body, systemInstruction: SYSTEM, responseSchema: SCHEMA, responseMimeType: 'application/json' } as any);
        let parsed: any = null; try { parsed = JSON.parse(res.text as string); } catch { /* bad json */ }
        appendFileSync(OUT, JSON.stringify({ ok: true, e, run, ms: Date.now() - t0, usage: res.usage, finish: res.finishReason, parsedOk: !!parsed,
          rows: rows.map((r, i) => ({ en: r.en, t: r.t, s: r.s, stage: parsed?.rows?.find((x: any) => x.index === i)?.stage ?? null })) }) + '\n');
        console.log(`${run} ${e.slice(0, 8)} ok rows=${rows.length} ${res.finishReason}`);
        break;
      } catch (err: any) {
        const msg = String(err?.message ?? err);
        const daily = /per ?day|PerDay|daily|exceeded your current quota/i.test(msg);
        if (/503|UNAVAILABLE|high demand|overloaded|fetch failed|ECONNRESET|ETIMEDOUT|429|Rate/i.test(msg) && !daily && attempt <= 5) { await sleep((Number(/retry in ([\d.]+)s/i.exec(msg)?.[1]) || 20 * attempt) * 1000 + 2000); continue; }
        appendFileSync(OUT, JSON.stringify({ ok: false, e, run, error: msg.slice(0, 200), daily }) + '\n');
        console.log(`${e.slice(0, 8)} FAILED ${msg.slice(0, 120)}`);
        if (daily) { console.log('stopping: quota'); process.exit(3); }
        break;
      }
    }
    await sleep(spacing);
  }
}
console.log('done');
