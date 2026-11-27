// POC (open decision 6): what can the tiers of a LONG carousel (7 or more images: the size that takes the stepped path) be, and at what request cost?
// For each long carousel of the live set (images cached in private/img), on the images the stepped path would read together (up to 10):
//   X  the production extraction call on up to 10 images (stands in for the union of the steps): its `ticketPrice` strings feed option D (code split, 0 extra requests)
//   E  an image-aware per-event tier call at the end (event names from X; caption when there is one; up to 10 images): 1 extra request
//   B  the text-only per-event tier call at the end (caption only), only when the post still has a caption: 1 extra request
//   npx tsx long-carousel-tier.ts [--spacing 4200] [--out private/long-carousel-runs.jsonl] [--only pid,pid]
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { buildGeminiExtractionRequest } from '../../../apps/backend/src/lib/ai-processor/build-gemini-request.ts';
import { callGeminiGenerateContent } from '../../../apps/backend/src/lib/ai-gateway/gemini-client.ts';
import { loadBackendEnv } from '../../../apps/backend/src/env.ts';
import { claimCall } from './quota-budget.mjs';
import { AUDIENCES, KINDS, GENERAL } from './tier-options.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce<string[][]>((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const spacing = Number(args.spacing ?? 4200), OUT = args.out ?? 'private/long-carousel-runs.jsonl';
const key = loadBackendEnv().systemGeminiApiKey;
if (!key) { console.error('no SYSTEM_GEMINI_API_KEY in .env'); process.exit(2); }
const NL = String.fromCharCode(10);
const sniff = (b: Buffer) => (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' ? 'image/webp' : b[0] === 0x89 && b[1] === 0x50 ? 'image/png' : 'image/jpeg');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const live: any[] = readFileSync('private/live-posts.jsonl', 'utf8').trim().split(NL).map((l) => JSON.parse(l));
const imgCount = (pid: string) => { let n = 0; while (existsSync(`private/img/${pid}-${n}.jpg`)) n++; return n; };
let items = live.filter((p) => imgCount(p.pid) >= 7);
if (args.only) items = items.filter((p) => args.only.split(',').includes(p.pid));

// the production builder fetches the image links; answer them from the local copies
const byUrl = new Map<string, string>();
for (const p of live) {
  let extra: string[] = []; try { extra = typeof p.addl === 'string' ? JSON.parse(p.addl) : Array.isArray(p.addl) ? p.addl : []; } catch { extra = []; }
  [p.image, ...extra].filter(Boolean).slice(0, 10).forEach((u: string, i: number) => { const f = `private/img/${p.pid}-${i}.jpg`; if (existsSync(f)) byUrl.set(u, f); });
}
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: any, init?: any) => {
  const u = typeof input === 'string' ? input : input?.url ?? String(input);
  const f = byUrl.get(u);
  if (f) { const b = readFileSync(f); return new Response(b, { status: 200, headers: { 'content-type': sniff(b) } }); }
  return realFetch(input, init);
}) as typeof fetch;

const TIER_RULES = `Return one entry per distinct option; return an empty list when nothing states a price. A single price with no named option is still ONE entry (a later step decides what to do with it). Never compute, convert, round or invent a price, and never split one price into several options.
For each entry:
- event: the event this option belongs to, copied exactly from the list of events; GENERAL when the price covers the whole post or you cannot tell which event it belongs to.
- label: the option's name as written, at most 5 words; "Tiket" when none.
- kind: CATEGORY (options differ by what you take part in), TIME_WINDOW (they differ by when you buy), OTHER.
- audience: PUBLIC (default, no restriction), STUDENT, CHILD, MEMBER, LOCAL_RESIDENT, GROUP, or OTHER when you are unsure of a restriction.
- conditions: a short copy of the condition stated for this option, at most 80 characters; absent when none.
- price: only the amount as written, with its currency or unit ("Rp 200.000", "IDR 35K", "Gratis"), at most 20 characters, nothing after the amount; absent when no price.
- opensOn and closesOn: YYYY-MM-DD, only when stated.
A discount or promotion is not an option: only a price someone actually pays. A fee for taking part is an option. Never write a phone number, email address or personal name into any field.`;
const SYS_TEXT = `You read ONE social media post that announces several events, and list every priced option a person can choose, exactly as the post states it. You are given the list of events of this post.${NL}${TIER_RULES}`;
const SYS_IMG = `You read ONE social media post about one or several events, with its caption (possibly empty) and its images (slides), and list every priced option a person can choose, exactly as the post states it. A price printed on an image counts as stated by the post. You are given the list of events of this post.${NL}${TIER_RULES}`;
const schemaFor = (ev: string[]) => ({ type: 'OBJECT', properties: { options: { type: 'ARRAY', items: { type: 'OBJECT', properties: { event: { type: 'STRING', enum: [...ev, GENERAL] }, label: { type: 'STRING' }, kind: { type: 'STRING', enum: [...KINDS] }, audience: { type: 'STRING', enum: [...AUDIENCES] }, conditions: { type: 'STRING' }, price: { type: 'STRING' }, opensOn: { type: 'STRING' }, closesOn: { type: 'STRING' } }, required: ['event', 'label', 'kind', 'audience'] } } }, required: ['options'] });

async function call(request: any, tag: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      if (!claimCall().ok) { console.log('stopping: daily budget'); process.exit(3); }
      const t0 = Date.now();
      const res = await callGeminiGenerateContent(key!, request);
      let parsed: any = null; try { parsed = JSON.parse(res.text as string); } catch { /* bad json */ }
      return { ok: true, ms: Date.now() - t0, usage: res.usage, finish: res.finishReason, parsed };
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      const daily = /per ?day|PerDay|daily|exceeded your current quota/i.test(msg);
      if (/503|UNAVAILABLE|high demand|overloaded|fetch failed|ECONNRESET|ETIMEDOUT|429|Rate/i.test(msg) && !daily && attempt <= 5) { await sleep((Number(/retry in ([\d.]+)s/i.exec(msg)?.[1]) || 20 * attempt) * 1000 + 2000); continue; }
      console.log(`${tag} FAILED ${msg.slice(0, 120)}`);
      if (daily) { console.log('stopping: quota'); process.exit(3); }
      return { ok: false, error: msg.slice(0, 500) };
    }
  }
}

const done = new Set(existsSync(OUT) ? readFileSync(OUT, 'utf8').trim().split(NL).filter(Boolean).map((l) => JSON.parse(l)).filter((j) => j.ok).map((j) => j.pid) : []);
console.log(`long carousels: ${items.length}, with a caption: ${items.filter((p) => p.content).length}`);
for (const p of items) {
  if (done.has(p.pid)) continue;
  const n = imgCount(p.pid);
  let extra: string[] = []; try { extra = typeof p.addl === 'string' ? JSON.parse(p.addl) : Array.isArray(p.addl) ? p.addl : []; } catch { extra = []; }
  const built = await buildGeminiExtractionRequest({ postId: `lc-${p.pid}`, accountId: 'poc', content: p.content ?? '', imageUrl: p.image, additionalImageUrls: extra, postUrl: p.url ?? '', publishedAt: p.published, ownerDisplayName: p.owner ?? '' } as any, { maxCarouselImages: 9 } as any);
  const X = await call(built.request, `${p.pid} X`); await sleep(spacing);
  const evs: any[] = X.ok && X.parsed ? (X.parsed.isEvent === false ? [] : X.parsed.events ?? []) : [];
  const names = [...new Set<string>(evs.map((e) => String(e.eventName ?? '').trim()).filter(Boolean))];
  const prices = evs.map((e) => ({ name: String(e.eventName ?? ''), ticketPrices: (e.schedules ?? []).map((s: any) => s.ticketPrice ?? null) }));
  let E: any = null, B: any = null;
  if (names.length) {
    const parts: any[] = [{ text: `Events of this post:${NL}${names.map((x, i) => `${i + 1}. ${x}`).join(NL)}${NL}${NL}Post caption:${NL}"${p.content ?? ''}"` }];
    for (let i = 0; i < Math.min(n, 10); i++) { const b = readFileSync(`private/img/${p.pid}-${i}.jpg`); parts.push({ text: `Slide ${i + 1}` }, { inlineData: { mimeType: sniff(b), data: b.toString('base64') } }); }
    E = await call({ contents: parts, systemInstruction: SYS_IMG, responseSchema: schemaFor(names), responseMimeType: 'application/json', maxOutputTokens: 1500 }, `${p.pid} E`); await sleep(spacing);
    if (p.content) { B = await call({ contents: `Events of this post:${NL}${names.map((x, i) => `${i + 1}. ${x}`).join(NL)}${NL}${NL}Post caption:${NL}"${p.content}"`, systemInstruction: SYS_TEXT, responseSchema: schemaFor(names), responseMimeType: 'application/json', maxOutputTokens: 1500 }, `${p.pid} B`); await sleep(spacing); }
  }
  appendFileSync(OUT, JSON.stringify({ ok: !!X.ok, pid: p.pid, images: n, hasCaption: !!p.content, captionChars: (p.content ?? '').length, events: names.length, prices, X: { finish: X.ok ? X.finish : null, usage: X.ok ? X.usage : null }, E: E?.ok ? { options: E.parsed?.options ?? [], finish: E.finish, usage: E.usage } : null, B: B?.ok ? { options: B.parsed?.options ?? [], finish: B.finish, usage: B.usage } : null }) + NL);
  console.log(`${p.pid} images=${n} caption=${!!p.content} events=${names.length} E=${E?.parsed?.options?.length ?? '-'} B=${B?.parsed?.options?.length ?? '-'}`);
}
console.log('done');
