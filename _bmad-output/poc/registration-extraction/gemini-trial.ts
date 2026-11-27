// Throwaway Gemini trial (handoff 7B.3). READ-ONLY w.r.t. the repo and the DB: it imports the production request builder
// to get the exact production prompt + schema, then (arm "ext") appends an addendum and extra schema fields in memory.
// Nothing under apps/ or packages/ is modified. The caption text goes to Gemini exactly as in production (text only here:
// post images are not sent, they are expired and the flyer-only case is measured separately as "not checkable").
// Output: private/gemini-runs.jsonl (gitignored: contains model output derived from real captions).
//
//   npx tsx gemini-trial.ts --ids S01,S02 --arms base,ext --runs 3 [--spacing 4500]
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { buildGeminiExtractionRequest } from '../../../apps/backend/src/lib/ai-processor/build-gemini-request.ts';
import { callGeminiGenerateContent, GeminiRateLimitedError } from '../../../apps/backend/src/lib/ai-gateway/gemini-client.ts';
import { loadBackendEnv } from '../../../apps/backend/src/env.ts';

const args = Object.fromEntries(process.argv.slice(2).reduce<string[][]>((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const ids = (args.ids ?? '').split(',').filter(Boolean);
const arms = (args.arms ?? 'base,ext').split(',');
const runs = Number(args.runs ?? 3);
const spacing = Number(args.spacing ?? 4500);
const OUT = 'private/gemini-runs.jsonl';

export const ADDENDUM = `REGISTRATION AND HIGHLIGHT (additional per-event fields; apply them to each event in the events array):
12. highlight: the single fact in THIS event's source text that would most make a stranger care to attend (a prize or prize pool, a discount, free entry, a named headline guest). At most 40 characters, copied from the caption's own wording (shorten by cutting words, never by rewording) and never translated. Every amount or number in it must appear in the caption exactly as written. Omit highlight when the caption states no such fact. Scope or category labels (for example "Nasional", "Promo Mall", "Open Recruitment") and vague claims ("hadiah menarik", "door prize melimpah") are not highlights. highlightKind is one of PRIZE, DISCOUNT, FREE, GUEST, GIFT, BENEFIT, OTHER. highlightEvidence is the exact caption text (at most 120 characters) the highlight was taken from.
13. registrations: one entry per distinct way to take part in THIS event, only when the caption states it (a registration or ticket link, a WhatsApp or phone contact to register or reserve, a QR code on the poster, a DM, walk-in). A contact with several numbers is still ONE entry; make separate entries only for different channels or different conditions (price, eligibility, batch, category). For each entry:
   - channel: LINK, WHATSAPP, PHONE, QR, DM, ONSITE or OTHER.
   - label: a short label of at most 4 words in the caption's language (for example "Pendaftaran", "Early bird", "Peserta umum").
   - url: the link, only for channel LINK.
   - priceText: the price or fee for THIS entry exactly as written ("Rp 25.000", "Gratis"); absent when not stated for it.
   - eligibility: who may use THIS entry, only when the caption restricts it (age, school level, membership, "wajib follow @x"); copied or minimally shortened, in the caption's language.
   - opensOn and closesOn: YYYY-MM-DD when stated for this entry.
   - instruction: the caption's own instructions for registering (steps, requirements), copied in the caption's language, at most 300 characters; absent when it only says "daftar sekarang".
   - messageTemplate: ONLY when the caption explicitly tells people to send a specific message or format (for example "Nama_Asal_Judul", "ketik NAMA_BOOKING"): copy that text exactly, never write or improve one. Absent otherwise.
   - evidence: the exact caption text (at most 120 characters) this entry is based on.
   NEVER write a phone number, email address or wa.me / WhatsApp link into any of these fields: contact numbers are collected separately by code; for a WhatsApp or phone contact set only channel and label. Never write a person's name into any field.
   When one post lists several events and a registration channel is stated once for all of them (one admin number or one link), repeat that entry under every event it applies to; when a link or number is clearly for one event only, put it only under that event. If you cannot tell, leave it out.
   Registration or ticket links also stay in links, as before.

`;

const REG_ITEM = {
  type: 'OBJECT',
  properties: {
    channel: { type: 'STRING', enum: ['LINK', 'WHATSAPP', 'PHONE', 'QR', 'DM', 'ONSITE', 'OTHER'] },
    label: { type: 'STRING' },
    url: { type: 'STRING' },
    priceText: { type: 'STRING' },
    eligibility: { type: 'STRING' },
    opensOn: { type: 'STRING' },
    closesOn: { type: 'STRING' },
    instruction: { type: 'STRING' },
    messageTemplate: { type: 'STRING' },
    evidence: { type: 'STRING' },
  },
  required: ['channel'],
};

function extend(request: any) {
  const r = structuredClone(request);
  const ev = r.responseSchema.properties.events.items.properties;
  ev.highlight = { type: 'STRING' };
  ev.highlightKind = { type: 'STRING', enum: ['PRIZE', 'DISCOUNT', 'FREE', 'GUEST', 'GIFT', 'BENEFIT', 'OTHER'] };
  ev.highlightEvidence = { type: 'STRING' };
  ev.registrations = { type: 'ARRAY', items: REG_ITEM };
  const marker = 'Strictly adhere to the provided JSON schema.';
  if (!r.systemInstruction.includes(marker)) throw new Error('prompt marker moved: update the POC');
  r.systemInstruction = r.systemInstruction.replace(marker, ADDENDUM + marker);
  return r;
}

const sample = new Map(readFileSync('private/sample.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l)).map((r) => [r.sampleId, r]));
const done = new Set(existsSync(OUT) ? readFileSync(OUT, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((j) => j.ok).map((j) => `${j.id}|${j.arm}|${j.run}`) : []);
const env = loadBackendEnv();
const key = env.systemGeminiApiKey;
if (!key) { console.error('no SYSTEM_GEMINI_API_KEY in .env'); process.exit(2); }
console.log(`model=${env.geminiModel} ids=${ids.length} arms=${arms} runs=${runs} spacing=${spacing}ms (key not printed)`);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let calls = 0;
for (const id of ids) {
  const row = sample.get(id);
  if (!row) { console.log('unknown id', id); continue; }
  const built = await buildGeminiExtractionRequest({ postId: row.post_id, accountId: 'poc', content: row.caption, postUrl: '', publishedAt: row.published_at ?? new Date().toISOString() } as any);
  for (const arm of arms) {
    const n = arm === 'base' ? 1 : runs;
    for (let run = 1; run <= n; run++) {
      if (done.has(`${id}|${arm}|${run}`)) continue;
      const request = arm === 'ext' ? extend(built.request) : built.request;
      let attempt = 0;
      for (;;) {
        attempt++;
        try {
          const t0 = Date.now();
          const res = await callGeminiGenerateContent(key, request as any);
          appendFileSync(OUT, JSON.stringify({ id, arm, run, ok: true, ms: Date.now() - t0, finishReason: res.finishReason, blockReason: res.blockReason, usage: res.usage, text: res.text }) + '\n');
          console.log(`${id} ${arm}#${run} ok ${res.usage?.promptTokens}/${res.usage?.outputTokens}/${res.usage?.thinkingTokens ?? 0} ${res.finishReason}`);
          break;
        } catch (e: any) {
          const msg = String(e?.message ?? e);
          const daily = /per ?day|PerDay|daily/i.test(msg);
          if (/503|UNAVAILABLE|high demand|overloaded|fetch failed|ECONNRESET|ETIMEDOUT/i.test(msg) && attempt <= 4) {
            console.log(`${id} ${arm}#${run} transient (${msg.slice(0, 40)}): retry ${attempt} in 20s`);
            await sleep(20000);
            continue;
          }
          if (e instanceof GeminiRateLimitedError && !daily && attempt <= 3) {
            const wait = (Number(/retry in ([\d.]+)s/i.exec(msg)?.[1]) || 30) + 2;
            console.log(`${id} ${arm}#${run} rate limited (RPM): waiting ${wait}s`);
            await sleep(wait * 1000);
            continue;
          }
          appendFileSync(OUT, JSON.stringify({ id, arm, run, ok: false, error: msg.slice(0, 300), daily }) + '\n');
          console.log(`${id} ${arm}#${run} FAILED ${daily ? '(DAILY QUOTA)' : ''} ${msg.slice(0, 160)}`);
          if (daily) { console.log('stopping: daily quota'); process.exit(3); }
          break;
        }
      }
      calls++;
      await sleep(spacing);
    }
  }
}
console.log('done, calls this run:', calls);
