// POC (owner, 2026-11-26): what should the tier call read? Same posts, same schema and rules, three inputs:
//   caption : caption only (the design so far)
//   strings : caption + the price string the main extraction stored for each event (option A)
//   images  : caption + the post's images (option B, the fallback)
// Input: private/poster-set.json (read-only prod export), images in private/img. Output (gitignored): private/tier-input-runs.jsonl.
//   npx tsx tier-input.ts [--runs 2] [--spacing 4200] [--maxImages 5] [--arms caption,strings,images] [--set private/poster-set.json] [--out private/tier-input-runs.jsonl]
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { callGeminiGenerateContent } from '../../../apps/backend/src/lib/ai-gateway/gemini-client.ts';
import { loadBackendEnv } from '../../../apps/backend/src/env.ts';
import { claimCall } from './quota-budget.mjs';
import { AUDIENCES, KINDS, GENERAL } from './tier-options.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce<string[][]>((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const runs = Number(args.runs ?? 2), spacing = Number(args.spacing ?? 4200), maxImages = Number(args.maxImages ?? 5);
const arms = String(args.arms ?? 'caption,strings,images').split(',');
const OUT = args.out ?? 'private/tier-input-runs.jsonl';
const key = loadBackendEnv().systemGeminiApiKey;
if (!key) { console.error('no SYSTEM_GEMINI_API_KEY in .env'); process.exit(2); }
const NL = String.fromCharCode(10);

const SOURCE: Record<string, string> = {
  caption: 'You are given the post caption only.',
  strings: 'You are given the post caption and, for some events, the price text that an earlier step read from the whole post, including its images. The price text counts as stated by the post. Split it into its options.',
  images: 'You are given the post caption and its images (slides). A price printed on an image counts as stated by the post.',
};
const system = (arm: string) => `You read ONE social media post about one or more events, and list every priced option a person can choose to attend or take part, exactly as the post states it. You are given the list of events of this post. ${SOURCE[arm]}
Return one entry per distinct option; return an empty list when no price is stated. A single price with no named option is still ONE entry (a later step decides what to do with it). Never compute, convert, round or invent a price, and never split one price into several options.
For each entry:
- event: the event this option belongs to, copied exactly from the list of events; GENERAL when the price covers the whole post or you cannot tell which event it belongs to.
- label: the option's name as written ("UMUM 5K", "Early bird", "VIP", "Mahasiswa"), at most 5 words; "Tiket" when the post names none.
- kind: CATEGORY when options differ by what you take part in (distance, class, seat class, package size); TIME_WINDOW when they differ by when you buy (early bird, presale, batch 1, regular, on the day); OTHER otherwise.
- audience: who may take this option. PUBLIC when the post puts no restriction on who can take it (this is the default); STUDENT (pelajar, mahasiswa, a named school or campus); CHILD (an age group under 18, "anak", "kids", a school grade); MEMBER (members, holders of a card, followers, a community); LOCAL_RESIDENT (a city, region or ID card of a place); GROUP (a team, group, pair or family price); OTHER when the post states a restriction that is none of these. Use OTHER, not PUBLIC, when you are unsure whether a restriction applies.
- conditions: a short copy of the condition stated for this option, at most 80 characters; leave absent when none.
- price: only the amount as written, with its currency or unit ("Rp 200.000", "IDR 35K", "Gratis"), at most 20 characters and nothing after the amount; absent when the post gives no price for this option.
A discount, prize, voucher value or add-on is not an option: only a price someone actually pays to attend or take part. Never write a phone number, email address or personal name into any field.`;

const set: any[] = JSON.parse(readFileSync(args.set ?? 'private/poster-set.json', 'utf8'));
const done = new Set(existsSync(OUT) ? readFileSync(OUT, 'utf8').trim().split(NL).filter(Boolean).map((l) => JSON.parse(l)).filter((j) => j.ok).map((j) => `${j.arm}|${j.pid}|${j.run}`) : []);
const sniff = (b: Buffer) => (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' ? 'image/webp' : b[0] === 0x89 && b[1] === 0x50 ? 'image/png' : 'image/jpeg');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
console.log(`tier input: ${set.length} posts, arms ${arms.join(',')}, runs ${runs}`);

for (let run = 1; run <= runs; run++) for (const it of set) for (const arm of arms) {
  if (done.has(`${arm}|${it.pid}|${run}`)) continue;
  const ev: string[] = it.events.map((e: any) => String(e.name));
  let text = `Events of this post:${NL}${ev.map((n, i) => `${i + 1}. ${n}`).join(NL)}${NL}${NL}Post caption:${NL}"${it.caption}"`;
  if (arm === 'strings') {
    const priced = it.events.filter((e: any) => e.price);
    if (priced.length) text += `${NL}${NL}Price text per event:${NL}${priced.map((e: any) => `- ${e.name}: ${e.price}`).join(NL)}`;
  }
  const parts: any[] = [{ text }];
  let sent = 0;
  if (arm === 'images') for (let i = 0; i < maxImages; i++) {
    const f = `private/img/${it.pid}-${i}.jpg`;
    if (!existsSync(f)) break;
    const b = readFileSync(f);
    parts.push({ inlineData: { mimeType: sniff(b), data: b.toString('base64') } });
    sent++;
  }
  const schema = { type: 'OBJECT', properties: { options: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
    event: { type: 'STRING', enum: [...new Set([...ev, GENERAL])] }, label: { type: 'STRING' }, kind: { type: 'STRING', enum: [...KINDS] }, audience: { type: 'STRING', enum: [...AUDIENCES] },
    conditions: { type: 'STRING' }, price: { type: 'STRING' } }, required: ['event', 'label', 'kind', 'audience'] } } }, required: ['options'] };
  for (let attempt = 1; ; attempt++) {
    try {
      if (!claimCall().ok) { console.log('stopping: daily budget'); process.exit(3); }
      const t0 = Date.now();
      const res = await callGeminiGenerateContent(key, { contents: arm === 'images' ? parts : text, systemInstruction: system(arm), responseSchema: schema, responseMimeType: 'application/json', maxOutputTokens: 3000 } as any);
      let parsed: any = null; try { parsed = JSON.parse(res.text as string); } catch { /* bad json */ }
      appendFileSync(OUT, JSON.stringify({ ok: true, arm, pid: it.pid, run, images: sent, ms: Date.now() - t0, usage: res.usage, finish: res.finishReason, parsedOk: !!parsed, options: parsed?.options ?? [] }) + NL);
      console.log(`${run} ${arm} ${it.pid} options=${parsed?.options?.length ?? '?'} ${res.finishReason}`);
      break;
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      const daily = /per ?day|PerDay|daily|exceeded your current quota/i.test(msg);
      if (/503|UNAVAILABLE|high demand|overloaded|fetch failed|ECONNRESET|ETIMEDOUT|429|Rate/i.test(msg) && !daily && attempt <= 5) { await sleep((Number(/retry in ([\d.]+)s/i.exec(msg)?.[1]) || 20 * attempt) * 1000 + 2000); continue; }
      appendFileSync(OUT, JSON.stringify({ ok: false, arm, pid: it.pid, run, error: msg.slice(0, 500), daily }) + NL);
      console.log(`${arm} ${it.pid} FAILED ${msg.slice(0, 120)}`);
      if (daily) { console.log('stopping: quota'); process.exit(3); }
      break;
    }
  }
  await sleep(spacing);
}
console.log('done');
