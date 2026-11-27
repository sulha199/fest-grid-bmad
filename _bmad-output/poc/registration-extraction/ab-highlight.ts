// POC replay for highlight composed in code (live Gemini, no DB writes, nothing under apps/ or packages/ changed).
//   --mode captions : the 37 captions of the first POC (text only, like findings section 5), arms F-end and F-inline (the same facts, new instructions at the end of the prompt vs inline in the per-event section), so the composed highlight can be scored
//                     against the hand labels in private/labels.json and set beside the free-text highlight of section 5.1 (precision 75%, recall 98%).
//   --mode live     : the 53 live posts of the stage replay (real images), arms A, G-end, G-inline (facts + stage, both placements), for cost, runaway output and grouping changes.
// Arms are interleaved per post and run, the arm order rotating per run. Request built once per post. Output: private/ab-highlight-runs.jsonl (gitignored).
//   npx tsx ab-highlight.ts --mode captions --runs 3 [--spacing 3500]   |   npx tsx ab-highlight.ts --mode live --runs 3
// Run ONE replay process at a time (a stopped job can leave its node child running and double-writing the output file).
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { buildGeminiExtractionRequest } from '../../../apps/backend/src/lib/ai-processor/build-gemini-request.ts';
import { callGeminiGenerateContent } from '../../../apps/backend/src/lib/ai-gateway/gemini-client.ts';
import { loadBackendEnv } from '../../../apps/backend/src/env.ts';
import { claimCall } from './quota-budget.mjs';
import { armRequest } from './arms-placement.ts';

const args = Object.fromEntries(process.argv.slice(2).reduce<string[][]>((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const mode = args.mode ?? 'captions';
const runs = Number(args.runs ?? 3), spacing = Number(args.spacing ?? 3500), limit = Number(args.limit ?? 0);
const OUT = args.out ?? 'private/ab-highlight-runs.jsonl';
const key = loadBackendEnv().systemGeminiApiKey;
if (!key) { console.error('no SYSTEM_GEMINI_API_KEY in .env'); process.exit(2); }
// Arm names are defined in arms-placement.ts: F = facts, G = facts + stage; the suffix is where the new instructions sit (end of the prompt vs inline in the per-event section).
const ARMS: string[] = args.arms ? args.arms.split(',') : mode === 'live' ? ['A', 'G-end', 'G-inline'] : ['F-end', 'F-inline'];

type Item = { id: string; input: any };
let items: Item[] = [];
if (mode === 'captions') {
  // --sample file: another caption file with the same fields (private/sample2.jsonl, a fresh set); every caption of it is used
  const sample = new Map(readFileSync(args.sample ?? 'private/sample.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l)).map((r) => [r.sampleId, r]));
  const usedIds = new Set(readFileSync('private/gemini-runs.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l).id));
  // --heldout true: the sample captions the composer rules were NOT fitted on (everything but the 37 above, no synthetic captions)
  const ids = args.sample ? [...sample.keys()] : args.heldout ? [...sample.keys()].filter((id) => !usedIds.has(id) && !String(sample.get(id).post_id).startsWith('synthetic')) : [...usedIds];
  items = ids.filter((id) => sample.has(id)).map((id) => { const r = sample.get(id); return { id, input: { postId: r.post_id, accountId: 'poc', content: r.caption, postUrl: '', publishedAt: r.published_at ?? new Date().toISOString() } }; });
} else {
  const all: any[] = readFileSync('private/live-posts.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const byPid = new Map(all.map((r) => [r.pid, r]));
  const sel: { pid: string }[] = JSON.parse(readFileSync(args.stage ?? 'private/stage-posts.json', 'utf8'));
  items = sel.map((s) => byPid.get(s.pid)).filter(Boolean).map((p: any) => {
    let extra: string[] = []; try { extra = typeof p.addl === 'string' ? JSON.parse(p.addl) : Array.isArray(p.addl) ? p.addl : []; } catch { extra = []; }
    return { id: p.pid, input: { postId: `ab-${p.pid}`, accountId: 'poc', content: p.content ?? '', imageUrl: p.image, additionalImageUrls: extra, postUrl: p.url ?? '', publishedAt: p.published, ownerDisplayName: p.owner } };
  });
}
// Signed Instagram image links expire about five days after the scrape; the images were downloaded earlier (download-live-images.mjs, private/img).
// In live mode the builder's own fetch is answered from that local copy when the URL is known, so a replay does not depend on the link still being valid.
if (mode === 'live') {
  const all2: any[] = readFileSync('private/live-posts.jsonl', 'utf8').trim().split(String.fromCharCode(10)).map((l) => JSON.parse(l));
  const byUrl = new Map<string, string>();
  for (const p of all2) {
    let extra: string[] = []; try { extra = typeof p.addl === 'string' ? JSON.parse(p.addl) : Array.isArray(p.addl) ? p.addl : []; } catch { extra = []; }
    [p.image, ...(p.n >= 2 || extra.length ? extra : [])].filter(Boolean).slice(0, 10).forEach((u: string, i: number) => { const f = `private/img/${p.pid}-${i}.jpg`; if (existsSync(f)) byUrl.set(u, f); });
  }
  const sniff = (b: Buffer) => (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' ? 'image/webp' : b[0] === 0x89 && b[1] === 0x50 ? 'image/png' : 'image/jpeg');
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    const u = typeof input === 'string' ? input : input?.url ?? String(input);
    const f = byUrl.get(u);
    if (f) { const b = readFileSync(f); return new Response(b, { status: 200, headers: { 'content-type': sniff(b) } }); }
    return realFetch(input, init);
  }) as typeof fetch;
  console.log(`local image copies known for ${byUrl.size} urls`);
}
if (limit) items = items.slice(0, limit);
console.log(`mode ${mode}: ${items.length} posts, arms ${ARMS.join('')}, runs ${runs}`);

const done = new Set(existsSync(OUT) ? readFileSync(OUT, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((j) => j.ok && j.mode === mode).map((j) => `${j.id}|${j.arm}|${j.run}`) : []);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
for (let run = 1; run <= runs; run++) {
  for (const it of items) {
    const order = ARMS.slice(run % ARMS.length).concat(ARMS.slice(0, run % ARMS.length));
    if (order.every((arm) => done.has(`${it.id}|${arm}|${run}`))) continue;
    let built: Awaited<ReturnType<typeof buildGeminiExtractionRequest>>;
    try { built = await buildGeminiExtractionRequest(it.input as any); }
    catch (e: any) { appendFileSync(OUT, JSON.stringify({ ok: false, mode, id: it.id, run, buildError: String(e?.message ?? e).slice(0, 200) }) + String.fromCharCode(10)); console.log(`${it.id} build failed, skipped: ${String(e?.message ?? e).slice(0, 100)}`); continue; }
    for (const arm of order) {
      if (done.has(`${it.id}|${arm}|${run}`)) continue;
      let attempt = 0;
      for (;;) {
        attempt++;
        try {
          const t0 = Date.now();
          if (!claimCall().ok) { console.log('stopping: daily budget'); process.exit(3); }
          const res = await callGeminiGenerateContent(key, armRequest(arm, built.request) as any);
          let parsed: any = null; try { parsed = JSON.parse(res.text as string); } catch { /* truncated */ }
          const evs: any[] = parsed ? (parsed.isEvent === false ? [] : parsed.events ?? []) : [];
          appendFileSync(OUT, JSON.stringify({
            ok: true, mode, id: it.id, arm, run, ms: Date.now() - t0, finish: res.finishReason, usage: res.usage, parsedOk: !!parsed, grouping: parsed?.groupingReason, events: evs.length,
            ev: evs.map((e) => ({
              name: e.eventName, types: e.types ?? [], prizes: e.prizes ?? [], promos: e.promos ?? [], inclusions: e.inclusions ?? [], isFree: e.isFree ?? null,
              schedules: (e.schedules ?? []).map((s: any) => ({ t: s.title ?? null, performers: s.performers ?? [], ticketPrice: s.ticketPrice ?? null, stage: s.stage ?? null, main: !!s.isMainSchedule })),
            })),
          }) + '\n');
          console.log(`${mode} ${it.id} ${arm}#${run} ok events=${evs.length} ${res.finishReason}`);
          break;
        } catch (e: any) {
          const msg = String(e?.message ?? e);
          const daily = /per ?day|PerDay|daily|exceeded your current quota/i.test(msg);
          if (/503|UNAVAILABLE|high demand|overloaded|fetch failed|ECONNRESET|ETIMEDOUT|429|Rate/i.test(msg) && !daily && attempt <= 5) {
            await sleep(((Number(/retry in ([\d.]+)s/i.exec(msg)?.[1]) || 20 * attempt) + 2) * 1000); continue;
          }
          appendFileSync(OUT, JSON.stringify({ ok: false, mode, id: it.id, arm, run, error: msg.slice(0, 300), daily }) + '\n');
          console.log(`${it.id} ${arm}#${run} FAILED ${msg.slice(0, 140)}`);
          if (daily) { console.log('stopping: daily quota'); process.exit(3); }
          break;
        }
      }
      await sleep(spacing);
    }
  }
}
console.log('done');
