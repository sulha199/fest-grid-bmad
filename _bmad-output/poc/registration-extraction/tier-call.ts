// POC: a SEPARATE text-only Gemini call that lists every priced option of a post, with who it is for (audience) and the stated condition.
// The extraction prompt and the grouping decision stay untouched. Whether the options become tiers (at least two distinct prices) is decided
// in code (tier-options.mjs), not by the model. Scores against the hand labels (private/tier-gold.json, from make-tier-gold.mjs).
//   npx tsx tier-call.ts --runs 1 [--spacing 4200] [--limit 0] [--only labelled]
// Output: private/tier-call-runs.jsonl (gitignored; holds real captions' prices). Resumable by (id|run).
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { callGeminiGenerateContent } from '../../../apps/backend/src/lib/ai-gateway/gemini-client.ts';
import { loadBackendEnv } from '../../../apps/backend/src/env.ts';
import { claimCall } from './quota-budget.mjs';
import { AUDIENCES, KINDS } from './tier-options.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce<string[][]>((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const runs = Number(args.runs ?? 1), spacing = Number(args.spacing ?? 4200), limit = Number(args.limit ?? 0);
const OUT = args.out ?? 'private/tier-call-runs.jsonl';
const key = loadBackendEnv().systemGeminiApiKey;
if (!key) { console.error('no SYSTEM_GEMINI_API_KEY in .env'); process.exit(2); }

export const SYSTEM = `You read ONE social media post about an event and list every priced option a person can choose to attend or take part, exactly as the post states it.
Return one entry per distinct option; return an empty list when the post states no price. A single price with no named option is still ONE entry (a later step decides what to do with it). Never compute, convert, round or invent a price, and never split one price into several options.
For each entry:
- label: the option's name as written ("UMUM 5K", "Early bird", "VIP", "Mahasiswa"), at most 5 words; "Tiket" when the post names none.
- kind: CATEGORY when options differ by what you take part in (distance, class, seat class, package size); TIME_WINDOW when they differ by when you buy (early bird, presale, batch 1, regular, on the day); OTHER otherwise.
- audience: who may take this option. PUBLIC when the post puts no restriction on who can take it (this is the default); STUDENT (pelajar, mahasiswa, a named school or campus); CHILD (an age group under 18, "anak", "kids", a school grade); MEMBER (members, holders of a card, followers, a community); LOCAL_RESIDENT (a city, region or ID card of a place); GROUP (a team, group, pair or family price); OTHER when the post states a restriction that is none of these. Use OTHER, not PUBLIC, when you are unsure whether a restriction applies.
- conditions: a short copy of the condition stated for this option ("khusus pelajar", "KTP DIY", "minimal 10 orang", "wajib order di venue", "10 pendaftar pertama"), at most 80 characters; leave absent when none.
- price: the price exactly as written ("Rp 200.000", "IDR 35K / group", "Gratis"); absent when the post gives no price for this option.
- opensOn and closesOn: YYYY-MM-DD, only when the post states the sales period of this option.
- evidence: the exact source text (at most 120 characters) this entry is based on.
A discount or promotion is not an option: only a price someone actually pays. A fee for taking part (registration, entry, ticket, per team) is an option. Never write a phone number, email address or personal name into any field.`;
const OPTION = {
  type: 'OBJECT',
  properties: {
    label: { type: 'STRING' }, kind: { type: 'STRING', enum: [...KINDS] }, audience: { type: 'STRING', enum: [...AUDIENCES] }, conditions: { type: 'STRING' },
    price: { type: 'STRING' }, opensOn: { type: 'STRING' }, closesOn: { type: 'STRING' }, evidence: { type: 'STRING' },
  },
  required: ['label', 'kind', 'audience'],
};
const SCHEMA = { type: 'OBJECT', properties: { options: { type: 'ARRAY', items: OPTION } }, required: ['options'] };

// Variant B (run after variant A leaked neighbouring text into price strings on 10 of 51 options and ran away on 3 of 60 calls): the price is a
// whole number of rupiah instead of a copied string, there is no evidence field, and the output is capped.
const VARIANT = args.variant ?? 'A';
const SYSTEM_B = SYSTEM
  .replace(/- price: .*\n/, '- amount: the price as a whole number of rupiah (50k = 50000, 1,5 juta = 1500000, "Rp 25.000" = 25000); 0 when the option is free; absent when the post gives no price for this option. Copy the number the post states, never compute one.\n')
  .replace(/- evidence: .*\n/, '');
// Variant C: the copied price string of variant A, but with a hard shape (amount only, at most 20 characters), no evidence field and a capped output.
const SYSTEM_C = SYSTEM
  .replace(/- price: .*\n/, '- price: only the amount as written, with its currency or unit ("Rp 200.000", "IDR 35K", "Gratis"), at most 20 characters and nothing after the amount (no words, no per-unit text: put "per team" in conditions); absent when the post gives no price for this option.\n')
  .replace(/- evidence: .*\n/, '');
const OPTION_C = { ...OPTION, properties: Object.fromEntries(Object.entries(OPTION.properties).filter(([k]) => k !== 'evidence')) };
const SCHEMA_C = { type: 'OBJECT', properties: { options: { type: 'ARRAY', items: OPTION_C } }, required: ['options'] };
const OPTION_B = { type: 'OBJECT', properties: { label: { type: 'STRING' }, kind: { type: 'STRING', enum: [...KINDS] }, audience: { type: 'STRING', enum: [...AUDIENCES] }, conditions: { type: 'STRING' }, amount: { type: 'INTEGER' }, opensOn: { type: 'STRING' }, closesOn: { type: 'STRING' } }, required: ['label', 'kind', 'audience'] };
const SCHEMA_B = { type: 'OBJECT', properties: { options: { type: 'ARRAY', items: OPTION_B } }, required: ['options'] };

const sample = new Map(readFileSync('private/sample.jsonl', 'utf8').trim().split(String.fromCharCode(10)).map((l) => JSON.parse(l)).map((r) => [r.sampleId, r]));
const gold = JSON.parse(readFileSync('private/tier-gold.json', 'utf8'));
const labels = JSON.parse(readFileSync('private/labels.json', 'utf8'));
// the labelled tier captions, plus the first 18 captions whose label states no price (a check for options invented from nothing)
const noPrice = Object.keys(labels).filter((id) => !labels[id].tiers && sample.has(id)).sort().slice(0, 18);
let ids = [...Object.keys(gold), ...(args.only === 'labelled' ? [] : noPrice)].filter((id) => sample.has(id));
if (args.ids) ids = args.ids.split(',').filter((id) => sample.has(id));
if (limit) ids = ids.slice(0, limit);
console.log(`tier call: ${ids.length} captions (${Object.keys(gold).length} labelled with a price, ${args.only === 'labelled' ? 0 : noPrice.length} without), runs ${runs}`);

const done = new Set(existsSync(OUT) ? readFileSync(OUT, 'utf8').trim().split(String.fromCharCode(10)).filter(Boolean).map((l) => JSON.parse(l)).filter((j) => j.ok).map((j) => `${j.id}|${j.run}`) : []);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
for (let run = 1; run <= runs; run++) {
  for (const id of ids) {
    if (done.has(`${id}|${run}`)) continue;
    const body = `Post caption:\n"${sample.get(id).caption}"`;
    let attempt = 0;
    for (;;) {
      attempt++;
      try {
        const t0 = Date.now();
        if (!claimCall().ok) { console.log('stopping: daily budget'); process.exit(3); }
        const req = VARIANT === 'C'
          ? { contents: body, systemInstruction: SYSTEM_C, responseSchema: SCHEMA_C, responseMimeType: 'application/json', maxOutputTokens: 1500 }
          : VARIANT === 'B'
          ? { contents: body, systemInstruction: SYSTEM_B, responseSchema: SCHEMA_B, responseMimeType: 'application/json', maxOutputTokens: 1500 }
          : { contents: body, systemInstruction: SYSTEM, responseSchema: SCHEMA, responseMimeType: 'application/json' };
        const res = await callGeminiGenerateContent(key, req as any);
        let parsed: any = null; try { parsed = JSON.parse(res.text as string); } catch { /* bad json */ }
        appendFileSync(OUT, JSON.stringify({ ok: true, variant: VARIANT, id, run, ms: Date.now() - t0, usage: res.usage, finish: res.finishReason, parsedOk: !!parsed, options: parsed?.options ?? [] }) + String.fromCharCode(10));
        console.log(`${run} ${id} ok options=${parsed?.options?.length ?? '?'} ${res.finishReason}`);
        break;
      } catch (err: any) {
        const msg = String(err?.message ?? err);
        const daily = /per ?day|PerDay|daily|exceeded your current quota/i.test(msg);
        if (/503|UNAVAILABLE|high demand|overloaded|fetch failed|ECONNRESET|ETIMEDOUT|429|Rate/i.test(msg) && !daily && attempt <= 5) { await sleep((Number(/retry in ([\d.]+)s/i.exec(msg)?.[1]) || 20 * attempt) * 1000 + 2000); continue; }
        appendFileSync(OUT, JSON.stringify({ ok: false, id, run, error: msg.slice(0, 1500), daily }) + String.fromCharCode(10));
        console.log(`${id} FAILED ${msg.slice(0, 120)}`);
        if (daily) { console.log('stopping: quota'); process.exit(3); }
        break;
      }
    }
    await sleep(spacing);
  }
}
console.log('done');
