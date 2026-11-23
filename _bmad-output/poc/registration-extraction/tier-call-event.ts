// POC: the tier call (variant C) for MULTI-EVENT posts, with the extracted event names given as a closed list. Each option says which event it belongs to
// (`event`, an enum of the names plus GENERAL for a price that covers the whole post); code then decides tiers inside each event (tier-options.mjs, decideTiersPerEvent).
//   npx tsx tier-call-event.ts [--runs 2] [--spacing 4200] [--out private/tier-call-runs-event.jsonl]
// Input: private/sample.jsonl rows with n_events >= 2 and stored event names (production names, read-only export). Output (gitignored): one row per (post, run).
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { callGeminiGenerateContent } from '../../../apps/backend/src/lib/ai-gateway/gemini-client.ts';
import { loadBackendEnv } from '../../../apps/backend/src/env.ts';
import { claimCall } from './quota-budget.mjs';
import { AUDIENCES, KINDS, GENERAL } from './tier-options.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce<string[][]>((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const runs = Number(args.runs ?? 2), spacing = Number(args.spacing ?? 4200);
const OUT = args.out ?? 'private/tier-call-runs-event.jsonl';
const key = loadBackendEnv().systemGeminiApiKey;
if (!key) { console.error('no SYSTEM_GEMINI_API_KEY in .env'); process.exit(2); }

const NL = String.fromCharCode(10);
const SYSTEM = `You read ONE social media post that announces several events, and list every priced option a person can choose to attend or take part, exactly as the post states it. You are given the list of events of this post.
Return one entry per distinct option; return an empty list when the post states no price. A single price with no named option is still ONE entry (a later step decides what to do with it). Never compute, convert, round or invent a price, and never split one price into several options.
For each entry:
- event: the event this option belongs to, copied exactly from the list of events; GENERAL when the price covers the whole post or you cannot tell which event it belongs to.
- label: the option's name as written ("UMUM 5K", "Early bird", "VIP", "Mahasiswa"), at most 5 words; "Tiket" when the post names none.
- kind: CATEGORY when options differ by what you take part in (distance, class, seat class, package size); TIME_WINDOW when they differ by when you buy (early bird, presale, batch 1, regular, on the day); OTHER otherwise.
- audience: who may take this option. PUBLIC when the post puts no restriction on who can take it (this is the default); STUDENT (pelajar, mahasiswa, a named school or campus); CHILD (an age group under 18, "anak", "kids", a school grade); MEMBER (members, holders of a card, followers, a community); LOCAL_RESIDENT (a city, region or ID card of a place); GROUP (a team, group, pair or family price); OTHER when the post states a restriction that is none of these. Use OTHER, not PUBLIC, when you are unsure whether a restriction applies.
- conditions: a short copy of the condition stated for this option ("khusus pelajar", "KTP DIY", "minimal 10 orang", "wajib order di venue", "10 pendaftar pertama"), at most 80 characters; leave absent when none.
- price: only the amount as written, with its currency or unit ("Rp 200.000", "IDR 35K", "Gratis"), at most 20 characters and nothing after the amount (no words, no per-unit text: put "per team" in conditions); absent when the post gives no price for this option.
- opensOn and closesOn: YYYY-MM-DD, only when the post states the sales period of this option.
A discount or promotion is not an option: only a price someone actually pays. A fee for taking part (registration, entry, ticket, per team) is an option. Never write a phone number, email address or personal name into any field.`;

const rows = readFileSync('private/sample.jsonl', 'utf8').trim().split(NL).map((l) => JSON.parse(l));
const names = (r: any): string[] => { try { const v = typeof r.event_names === 'string' ? JSON.parse(r.event_names) : r.event_names; return Array.isArray(v) ? v.map(String) : []; } catch { return []; } };
// S02 repeats the caption of S01 (two posts, same text): one of them is enough
let items = rows.filter((r) => r.n_events >= 2 && names(r).length >= 2 && r.sampleId !== 'S02');
if (args.ids) items = items.filter((r) => args.ids.split(',').includes(r.sampleId));
const done = new Set(existsSync(OUT) ? readFileSync(OUT, 'utf8').trim().split(NL).filter(Boolean).map((l) => JSON.parse(l)).filter((j) => j.ok).map((j) => `${j.id}|${j.run}`) : []);
console.log(`tier call per event: ${items.length} multi-event captions, runs ${runs}`);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
for (let run = 1; run <= runs; run++) {
  for (const it of items) {
    if (done.has(`${it.sampleId}|${run}`)) continue;
    const ev = names(it);
    const schema = { type: 'OBJECT', properties: { options: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      event: { type: 'STRING', enum: [...ev, GENERAL] }, label: { type: 'STRING' }, kind: { type: 'STRING', enum: [...KINDS] }, audience: { type: 'STRING', enum: [...AUDIENCES] },
      conditions: { type: 'STRING' }, price: { type: 'STRING' }, opensOn: { type: 'STRING' }, closesOn: { type: 'STRING' } }, required: ['event', 'label', 'kind', 'audience'] } } }, required: ['options'] };
    const body = `Events of this post:${NL}${ev.map((n, i) => `${i + 1}. ${n}`).join(NL)}${NL}${NL}Post caption:${NL}"${it.caption}"`;
    let attempt = 0;
    for (;;) {
      attempt++;
      try {
        const t0 = Date.now();
        if (!claimCall().ok) { console.log('stopping: daily budget'); process.exit(3); }
        const res = await callGeminiGenerateContent(key, { contents: body, systemInstruction: SYSTEM, responseSchema: schema, responseMimeType: 'application/json', maxOutputTokens: 1500 } as any);
        let parsed: any = null; try { parsed = JSON.parse(res.text as string); } catch { /* bad json */ }
        appendFileSync(OUT, JSON.stringify({ ok: true, id: it.sampleId, run, events: ev, ms: Date.now() - t0, usage: res.usage, finish: res.finishReason, parsedOk: !!parsed, options: parsed?.options ?? [] }) + NL);
        console.log(`${run} ${it.sampleId} ok events=${ev.length} options=${parsed?.options?.length ?? '?'} ${res.finishReason}`);
        break;
      } catch (err: any) {
        const msg = String(err?.message ?? err);
        const daily = /per ?day|PerDay|daily|exceeded your current quota/i.test(msg);
        if (/503|UNAVAILABLE|high demand|overloaded|fetch failed|ECONNRESET|ETIMEDOUT|429|Rate/i.test(msg) && !daily && attempt <= 5) { await sleep((Number(/retry in ([\d.]+)s/i.exec(msg)?.[1]) || 20 * attempt) * 1000 + 2000); continue; }
        appendFileSync(OUT, JSON.stringify({ ok: false, id: it.sampleId, run, error: msg.slice(0, 1500), daily }) + NL);
        console.log(`${it.sampleId} FAILED ${msg.slice(0, 120)}`);
        if (daily) { console.log('stopping: quota'); process.exit(3); }
        break;
      }
    }
    await sleep(spacing);
  }
}
console.log('done');
