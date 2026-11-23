// POC: per-slide event map on multi-event carousel posts (cover per event). Two steps per post, both with images:
//   1. event names (once per post, saved in private/slide-map-names.json): the distinct events the post announces
//   2. slide map (--runs times): for each "Slide N", which of those events it shows; code then decides covers (slide-cover.mjs)
//   npx tsx slide-map.ts [--runs 2] [--maxImages 10] [--spacing 4200] [--ids a,b] [--out private/slide-map-runs.jsonl]
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { callGeminiGenerateContent } from '../../../apps/backend/src/lib/ai-gateway/gemini-client.ts';
import { loadBackendEnv } from '../../../apps/backend/src/env.ts';
import { claimCall } from './quota-budget.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce<string[][]>((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const runs = Number(args.runs ?? 2), spacing = Number(args.spacing ?? 4200), maxImages = Number(args.maxImages ?? 10);
const OUT = args.out ?? 'private/slide-map-runs.jsonl', NAMES = 'private/slide-map-names.json';
const key = loadBackendEnv().systemGeminiApiKey;
if (!key) { console.error('no SYSTEM_GEMINI_API_KEY in .env'); process.exit(2); }
const NL = String.fromCharCode(10);

const SYS_NAMES = `You read ONE social media post (caption and images) that announces several separate events, and list the distinct events. One entry per event someone could attend or enter separately; do not list sponsors, sessions of the same event, or the post itself. Name: as written, at most 8 words.`;
const SYS_MAP = `You are given a social media carousel post: its caption, a numbered list of its events, and its images, each introduced by a line "Slide N". For every slide say which of the listed events that slide shows or announces (its name, date, poster or details). A slide that shows none of the events (sponsors, rules, thanks) gets an empty list. Use the event names exactly as listed. Do not guess: list an event only when the slide itself shows it.`;

const live = new Map(readFileSync('private/live-posts.jsonl', 'utf8').trim().split(NL).map((l) => JSON.parse(l)).map((r) => [r.pid, r]));
const sniff = (b: Buffer) => (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' ? 'image/webp' : b[0] === 0x89 && b[1] === 0x50 ? 'image/png' : 'image/jpeg');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const imagesOf = (id: string) => { const out: { i: number; part: any }[] = []; for (let i = 0; i < maxImages; i++) { const f = `private/img/${id}-${i}.jpg`; if (!existsSync(f)) break; const b = readFileSync(f); out.push({ i: i + 1, part: { inlineData: { mimeType: sniff(b), data: b.toString('base64') } } }); } return out; };

async function call(schema: any, system: string, parts: any[], tag: string, maxOut: number) {
  for (let attempt = 1; ; attempt++) {
    try {
      if (!claimCall().ok) { console.log('stopping: daily budget'); process.exit(3); }
      const t0 = Date.now();
      const res = await callGeminiGenerateContent(key!, { contents: parts, systemInstruction: system, responseSchema: schema, responseMimeType: 'application/json', maxOutputTokens: maxOut } as any);
      let parsed: any = null; try { parsed = JSON.parse(res.text as string); } catch { /* bad json */ }
      return { ok: true, ms: Date.now() - t0, usage: res.usage, finish: res.finishReason, parsed };
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      const daily = /per ?day|PerDay|daily|exceeded your current quota/i.test(msg);
      if (/503|UNAVAILABLE|high demand|overloaded|fetch failed|ECONNRESET|ETIMEDOUT|429|Rate/i.test(msg) && !daily && attempt <= 5) { await sleep((Number(/retry in ([\d.]+)s/i.exec(msg)?.[1]) || 20 * attempt) * 1000 + 2000); continue; }
      console.log(`${tag} FAILED ${msg.slice(0, 120)}`);
      if (daily) { console.log('stopping: quota'); process.exit(3); }
      return { ok: false, error: msg.slice(0, 800) };
    }
  }
}

const ids = (args.ids ? args.ids.split(',') : ['Df5DGnxmn-C', 'Df9JOHkoCST', 'Df9gS1PoGQx', 'DfzUk-8msPo', 'Df7DJodEoR6', 'Df6RcryoKou']).filter((id) => live.has(id));
const names: Record<string, string[]> = existsSync(NAMES) ? JSON.parse(readFileSync(NAMES, 'utf8')) : {};
console.log(`slide map: ${ids.length} posts, runs ${runs}`);

for (const id of ids) { // step 1: names
  if (names[id]?.length) continue;
  const imgs = imagesOf(id);
  const parts: any[] = [{ text: `Post caption:${NL}"${live.get(id).content ?? ''}"` }, ...imgs.flatMap((m) => [{ text: `Slide ${m.i}` }, m.part])];
  const schema = { type: 'OBJECT', properties: { events: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['events'] };
  const r = await call(schema, SYS_NAMES, parts, `${id} names`, 1500);
  if (r.ok && r.parsed?.events?.length) { names[id] = [...new Set<string>(r.parsed.events.map((x: any) => String(x).trim()).filter(Boolean))]; writeFileSync(NAMES, JSON.stringify(names, null, 1)); console.log(`${id} names ${names[id].length} (production count ${live.get(id).n})`); }
  await sleep(spacing);
}

const done = new Set(existsSync(OUT) ? readFileSync(OUT, 'utf8').trim().split(NL).filter(Boolean).map((l) => JSON.parse(l)).filter((j) => j.ok).map((j) => `${j.id}|${j.run}`) : []);
for (let run = 1; run <= runs; run++) { // step 2: slide map
  for (const id of ids) {
    if (!names[id]?.length || done.has(`${id}|${run}`)) continue;
    const imgs = imagesOf(id), ev = names[id];
    const parts: any[] = [{ text: `Post caption:${NL}"${live.get(id).content ?? ''}"${NL}${NL}Events of this post:${NL}${ev.map((n, i) => `${i + 1}. ${n}`).join(NL)}` }, ...imgs.flatMap((m) => [{ text: `Slide ${m.i}` }, m.part])];
    const schema = { type: 'OBJECT', properties: { slides: { type: 'ARRAY', items: { type: 'OBJECT', properties: { slide: { type: 'INTEGER' }, events: { type: 'ARRAY', items: { type: 'STRING', enum: ev } } }, required: ['slide', 'events'] } } }, required: ['slides'] };
    const r = await call(schema, SYS_MAP, parts, `${id} run${run}`, 3000);
    appendFileSync(OUT, JSON.stringify({ ...r, id, run, images: imgs.length, events: ev, slides: r.parsed?.slides ?? [], parsed: undefined }) + NL);
    if (r.ok) console.log(`${run} ${id} ok images=${imgs.length} events=${ev.length} rows=${r.parsed?.slides?.length ?? '?'} ${r.finish}`);
    await sleep(spacing);
  }
}
console.log('done');
