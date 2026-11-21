// POC replay for the schedule-stage enum and price tiers (live Gemini, real post images, no DB writes, nothing under apps/ or packages/ changed).
// Arms A (production) / D (+stage) / E (+stage +tiers) are interleaved per post and run, the arm order rotating per run.
// The request is built once per post (images downloaded once) and reused for every run. Output: private/ab-stage-runs.jsonl (gitignored).
//   node select-stage-posts.mjs && npx tsx ab-stage.ts --runs 3 [--spacing 3500]
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { buildGeminiExtractionRequest } from '../../../apps/backend/src/lib/ai-processor/build-gemini-request.ts';
import { callGeminiGenerateContent } from '../../../apps/backend/src/lib/ai-gateway/gemini-client.ts';
import { loadBackendEnv } from '../../../apps/backend/src/env.ts';
import { claimCall } from './quota-budget.mjs';
import { stageArmRequest, type StageArm } from './arms-stage.ts';

const args = Object.fromEntries(process.argv.slice(2).reduce<string[][]>((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const runs = Number(args.runs ?? 3);
const spacing = Number(args.spacing ?? 3500);
const OUT = args.out ?? 'private/ab-stage-runs.jsonl';
const only = args.only ? new Set(args.only.split(',')) : null; // set names: stage,tier,control
const env = loadBackendEnv();
const key = env.systemGeminiApiKey;
if (!key) { console.error('no SYSTEM_GEMINI_API_KEY in .env'); process.exit(2); }

const all: any[] = readFileSync('private/live-posts.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const sel: { pid: string; set: string }[] = JSON.parse(readFileSync('private/stage-posts.json', 'utf8'));
const byPid = new Map(all.map((r) => [r.pid, r]));
const posts = sel.filter((s) => !only || only.has(s.set)).map((s) => ({ ...byPid.get(s.pid), set: s.set })).filter((p) => p.pid);
console.log(`posts ${posts.length} (${[...new Set(posts.map((p) => p.set))].map((s) => `${s} ${posts.filter((p) => p.set === s).length}`).join(', ')}); runs ${runs}`);

const done = new Set(existsSync(OUT) ? readFileSync(OUT, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((j) => j.ok).map((j) => `${j.pid}|${j.arm}|${j.run}`) : []);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const built = new Map<string, any>();

for (let run = 1; run <= runs; run++) {
  for (const p of posts) {
    const order = (['A', 'D', 'E'] as const).slice(run % 3).concat((['A', 'D', 'E'] as const).slice(0, run % 3)) as StageArm[];
    if (order.every((arm) => done.has(`${p.pid}|${arm}|${run}`))) continue;
    if (!built.has(p.pid)) {
      let extra: string[] = [];
      try { extra = typeof p.addl === 'string' ? JSON.parse(p.addl) : Array.isArray(p.addl) ? p.addl : []; } catch { extra = []; }
      built.set(p.pid, await buildGeminiExtractionRequest({ postId: `ab-${p.pid}`, accountId: 'poc', content: p.content ?? '', imageUrl: p.image, additionalImageUrls: extra, postUrl: p.url ?? '', publishedAt: p.published, ownerDisplayName: p.owner } as any));
    }
    const b = built.get(p.pid);
    for (const arm of order) {
      if (done.has(`${p.pid}|${arm}|${run}`)) continue;
      let attempt = 0;
      for (;;) {
        attempt++;
        try {
          const t0 = Date.now();
          if (!claimCall().ok) { console.log('stopping: daily budget'); process.exit(3); }
          const res = await callGeminiGenerateContent(key, stageArmRequest(arm, b.request) as any);
          let parsed: any = null; try { parsed = JSON.parse(res.text as string); } catch { /* truncated */ }
          const evs: any[] = parsed ? (parsed.isEvent === false ? [] : parsed.events ?? []) : [];
          appendFileSync(OUT, JSON.stringify({
            ok: true, pid: p.pid, set: p.set, arm, run, ms: Date.now() - t0, finish: res.finishReason, usage: res.usage,
            imagesSent: b.imagesSent, parsedOk: !!parsed, grouping: parsed?.groupingReason, events: evs.length, published: p.published,
            ev: evs.map((e) => ({
              name: e.eventName,
              schedules: (e.schedules ?? []).map((s: any) => ({ t: s.title ?? null, s: s.eventStartDate ?? null, e: s.eventEndDate ?? null, main: !!s.isMainSchedule, stage: s.stage ?? null, price: s.ticketPrice ?? null })),
              tiers: (e.tiers ?? []).map((t: any) => ({ label: t.label ?? null, kind: t.kind ?? null, price: t.price ?? null, o: t.opensOn ?? null, c: t.closesOn ?? null, ev: t.evidence ?? null })),
            })),
          }) + '\n');
          console.log(`${p.set} ${p.pid} ${arm}#${run} ok events=${evs.length} ${parsed?.groupingReason} ${res.finishReason}`);
          break;
        } catch (e: any) {
          const msg = String(e?.message ?? e);
          const daily = /per ?day|PerDay|daily/i.test(msg);
          if (/503|UNAVAILABLE|high demand|overloaded|fetch failed|ECONNRESET|ETIMEDOUT|429|Rate/i.test(msg) && !daily && attempt <= 5) {
            const wait = (Number(/retry in ([\d.]+)s/i.exec(msg)?.[1]) || 20 * attempt) + 2;
            console.log(`${p.pid} ${arm}#${run} transient (${msg.slice(0, 50)}): retry ${attempt} in ${wait}s`);
            await sleep(wait * 1000);
            continue;
          }
          appendFileSync(OUT, JSON.stringify({ ok: false, pid: p.pid, set: p.set, arm, run, error: msg.slice(0, 300), daily }) + '\n');
          console.log(`${p.pid} ${arm}#${run} FAILED ${msg.slice(0, 140)}`);
          if (daily) { console.log('stopping: daily quota'); process.exit(3); }
          break;
        }
      }
      await sleep(spacing);
    }
  }
}
console.log('done');
