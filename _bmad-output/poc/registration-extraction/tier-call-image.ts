// POC: the tier call of tier-call.ts (variant C) with the post's images attached, on the live posts whose images are cached (private/img).
// Question: does the call find prices that exist only on the poster, and does it stay as well-behaved as the text-only call?
//   npx tsx tier-call-image.ts [--limit 0] [--maxImages 5] [--spacing 4200] [--out private/tier-call-runs-img.jsonl]
// Output (gitignored): one row per post with the options returned, the caption, and the number of images sent. Resumable by post id.
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { callGeminiGenerateContent } from '../../../apps/backend/src/lib/ai-gateway/gemini-client.ts';
import { loadBackendEnv } from '../../../apps/backend/src/env.ts';
import { claimCall } from './quota-budget.mjs';
import { AUDIENCES, KINDS } from './tier-options.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce<string[][]>((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const limit = Number(args.limit ?? 0), spacing = Number(args.spacing ?? 4200), maxImages = Number(args.maxImages ?? 5);
const OUT = args.out ?? 'private/tier-call-runs-img.jsonl';
const key = loadBackendEnv().systemGeminiApiKey;
if (!key) { console.error('no SYSTEM_GEMINI_API_KEY in .env'); process.exit(2); }

const SYSTEM = `You read ONE social media post about an event, with its caption and its images (slides), and list every priced option a person can choose to attend or take part, exactly as the post states it. A price printed on an image counts as stated by the post.
Return one entry per distinct option; return an empty list when neither the caption nor the images state a price. A single price with no named option is still ONE entry (a later step decides what to do with it). Never compute, convert, round or invent a price, and never split one price into several options.
For each entry:
- label: the option's name as written ("UMUM 5K", "Early bird", "VIP", "Mahasiswa"), at most 5 words; "Tiket" when the post names none.
- kind: CATEGORY when options differ by what you take part in (distance, class, seat class, package size); TIME_WINDOW when they differ by when you buy (early bird, presale, batch 1, regular, on the day); OTHER otherwise.
- audience: who may take this option. PUBLIC when the post puts no restriction on who can take it (this is the default); STUDENT (pelajar, mahasiswa, a named school or campus); CHILD (an age group under 18, "anak", "kids", a school grade); MEMBER (members, holders of a card, followers, a community); LOCAL_RESIDENT (a city, region or ID card of a place); GROUP (a team, group, pair or family price); OTHER when the post states a restriction that is none of these. Use OTHER, not PUBLIC, when you are unsure whether a restriction applies.
- conditions: a short copy of the condition stated for this option ("khusus pelajar", "KTP DIY", "minimal 10 orang", "wajib order di venue", "10 pendaftar pertama"), at most 80 characters; leave absent when none.
- price: only the amount as written, with its currency or unit ("Rp 200.000", "IDR 35K", "Gratis"), at most 20 characters and nothing after the amount (no words, no per-unit text: put "per team" in conditions); absent when the post gives no price for this option.
- opensOn and closesOn: YYYY-MM-DD, only when the post states the sales period of this option.
A discount or promotion is not an option: only a price someone actually pays. A fee for taking part (registration, entry, ticket, per team) is an option. Never write a phone number, email address or personal name into any field.`;
const OPTION = {
  type: 'OBJECT',
  properties: { label: { type: 'STRING' }, kind: { type: 'STRING', enum: [...KINDS] }, audience: { type: 'STRING', enum: [...AUDIENCES] }, conditions: { type: 'STRING' }, price: { type: 'STRING' }, opensOn: { type: 'STRING' }, closesOn: { type: 'STRING' } },
  required: ['label', 'kind', 'audience'],
};
const SCHEMA = { type: 'OBJECT', properties: { options: { type: 'ARRAY', items: OPTION } }, required: ['options'] };

const NL = String.fromCharCode(10);
const live = new Map(readFileSync('private/live-posts.jsonl', 'utf8').trim().split(NL).map((l) => JSON.parse(l)).map((r) => [r.pid, r]));
const sel: { pid: string }[] = JSON.parse(readFileSync('private/stage-posts.json', 'utf8'));
let ids = sel.map((s) => s.pid).filter((id) => live.has(id) && existsSync(`private/img/${id}-0.jpg`));
if (args.ids) ids = args.ids.split(',').filter((id) => live.has(id));
if (limit) ids = ids.slice(0, limit);
const done = new Set(existsSync(OUT) ? readFileSync(OUT, 'utf8').trim().split(NL).filter(Boolean).map((l) => JSON.parse(l)).filter((j) => j.ok).map((j) => j.id) : []);
console.log(`tier call with images: ${ids.length} posts, up to ${maxImages} images each`);

const sniff = (b: Buffer) => (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' ? 'image/webp' : b[0] === 0x89 && b[1] === 0x50 ? 'image/png' : 'image/jpeg');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
for (const id of ids) {
  if (done.has(id)) continue;
  const p = live.get(id);
  const parts: any[] = [{ text: `Post caption:${NL}"${p.content ?? ''}"` }];
  let sent = 0;
  for (let i = 0; i < maxImages; i++) { const f = `private/img/${id}-${i}.jpg`; if (!existsSync(f)) break; const b = readFileSync(f); parts.push({ inlineData: { mimeType: sniff(b), data: b.toString('base64') } }); sent++; }
  let attempt = 0;
  for (;;) {
    attempt++;
    try {
      const t0 = Date.now();
      if (!claimCall().ok) { console.log('stopping: daily budget'); process.exit(3); }
      const res = await callGeminiGenerateContent(key, { contents: parts, systemInstruction: SYSTEM, responseSchema: SCHEMA, responseMimeType: 'application/json', maxOutputTokens: 1500 } as any);
      let parsed: any = null; try { parsed = JSON.parse(res.text as string); } catch { /* bad json */ }
      appendFileSync(OUT, JSON.stringify({ ok: true, id, events: p.n, images: sent, ms: Date.now() - t0, usage: res.usage, finish: res.finishReason, parsedOk: !!parsed, options: parsed?.options ?? [] }) + NL);
      console.log(`${id} ok images=${sent} options=${parsed?.options?.length ?? '?'} ${res.finishReason}`);
      break;
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      const daily = /per ?day|PerDay|daily|exceeded your current quota/i.test(msg);
      if (/503|UNAVAILABLE|high demand|overloaded|fetch failed|ECONNRESET|ETIMEDOUT|429|Rate/i.test(msg) && !daily && attempt <= 5) { await sleep((Number(/retry in ([\d.]+)s/i.exec(msg)?.[1]) || 20 * attempt) * 1000 + 2000); continue; }
      appendFileSync(OUT, JSON.stringify({ ok: false, id, error: msg.slice(0, 1500), daily }) + NL);
      console.log(`${id} FAILED ${msg.slice(0, 120)}`);
      if (daily) { console.log('stopping: quota'); process.exit(3); }
      break;
    }
  }
  await sleep(spacing);
}
console.log('done');
