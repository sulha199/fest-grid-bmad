// POC (owner idea, 2026-11-26): can the model give each event a `core_event_name` that stands on its own, so that an activity item
// (race pack collection, technical meeting, side activity) can be matched to its main event?
// Input: private/core-name-set.jsonl (activity events, candidate main events, controls: name, types, caption; read-only export).
// One call per event, in the shape of the post-extraction call (caption plus event name). Output: private/core-name-runs.jsonl.
//   npx tsx core-name.ts [--runs 2] [--every 3] [--spacing 4200]
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { callGeminiGenerateContent } from '../../../apps/backend/src/lib/ai-gateway/gemini-client.ts';
import { loadBackendEnv } from '../../../apps/backend/src/env.ts';
import { claimCall } from './quota-budget.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce<string[][]>((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const runs = Number(args.runs ?? 2), every = Number(args.every ?? 3), spacing = Number(args.spacing ?? 4200);
const OUT = 'private/core-name-runs.jsonl';
const key = loadBackendEnv().systemGeminiApiKey;
if (!key) { console.error('no SYSTEM_GEMINI_API_KEY in .env'); process.exit(2); }
const NL = String.fromCharCode(10);

const SYSTEM = `You are given the name of one event as extracted from a social media post, and the post's caption (it may be empty).
Return core_event_name: the name of the main event that stands on its own, without any activity, phase or side-programme words. Remove such parts as race pack collection, RPC, registration, ticket sale, early bird, technical meeting, BIB transfer, awarding, winner announcement, "Day 2", and a side activity held inside a bigger event ("Zumba ... at <event>", "<event> - Music Performance"). Keep what is part of the official name of the main event: the series or brand name, a number or edition, the year, and a distance class only when it is a different event. Copy the words as written; do not translate, expand or invent. When the name is already the main event, return it unchanged.
Also return activity_type: NONE when the name is the main event itself, otherwise RACE_PACK_COLLECTION, REGISTRATION, TECHNICAL_MEETING, AWARDING, ANNOUNCEMENT, SIDE_ACTIVITY or OTHER.
Never write a phone number, email address or personal name into any field.`;
const SCHEMA = { type: 'OBJECT', properties: { core_event_name: { type: 'STRING' }, activity_type: { type: 'STRING', enum: ['NONE', 'RACE_PACK_COLLECTION', 'REGISTRATION', 'TECHNICAL_MEETING', 'AWARDING', 'ANNOUNCEMENT', 'SIDE_ACTIVITY', 'OTHER'] } }, required: ['core_event_name', 'activity_type'] };

const items: any[] = readFileSync('private/core-name-set.jsonl', 'utf8').trim().split(NL).map((l, i) => ({ n: i + 1, ...JSON.parse(l) }));
const done = new Set(existsSync(OUT) ? readFileSync(OUT, 'utf8').trim().split(NL).filter(Boolean).map((l) => JSON.parse(l)).filter((j) => j.ok).map((j) => `${j.n}|${j.run}`) : []);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
console.log(`core name: ${items.length} events, runs ${runs} (second run on every ${every}rd event)`);
for (let run = 1; run <= runs; run++) {
  for (const it of items) {
    if (run > 1 && it.n % every !== 0) continue;
    if (done.has(`${it.n}|${run}`)) continue;
    const contents = `Event name:${NL}${it.name}${NL}${NL}Post caption:${NL}"${String(it.caption ?? '').slice(0, 3000)}"`;
    for (let attempt = 1; ; attempt++) {
      try {
        if (!claimCall().ok) { console.log('stopping: daily budget'); process.exit(3); }
        const res = await callGeminiGenerateContent(key, { contents, systemInstruction: SYSTEM, responseSchema: SCHEMA, responseMimeType: 'application/json', maxOutputTokens: 200 } as any);
        let parsed: any = null; try { parsed = JSON.parse(res.text as string); } catch { /* bad json */ }
        appendFileSync(OUT, JSON.stringify({ ok: true, n: it.n, run, finish: res.finishReason, usage: res.usage, core: parsed?.core_event_name ?? null, activity: parsed?.activity_type ?? null }) + NL);
        break;
      } catch (err: any) {
        const msg = String(err?.message ?? err);
        const daily = /per ?day|PerDay|daily|exceeded your current quota/i.test(msg);
        if (/503|UNAVAILABLE|high demand|overloaded|fetch failed|ECONNRESET|ETIMEDOUT|429|Rate/i.test(msg) && !daily && attempt <= 5) { await sleep((Number(/retry in ([\d.]+)s/i.exec(msg)?.[1]) || 20 * attempt) * 1000 + 2000); continue; }
        appendFileSync(OUT, JSON.stringify({ ok: false, n: it.n, run, error: msg.slice(0, 500) }) + NL);
        if (daily) { console.log('stopping: quota'); process.exit(3); }
        break;
      }
    }
    await sleep(spacing);
  }
}
console.log('done');
