// POC A/B replay (live Gemini, real post images, no DB writes, nothing under apps/ or packages/ changed).
// Arms A (production) / B (+highlight, registrations) / C (+registrationWindow, window not a schedule) are interleaved per post and run,
// the arm order rotating per run, so time-of-day and quota effects spread evenly. Output: private/ab-runs.jsonl (gitignored).
//   npx tsx ab-multi-event.ts --set multi:6,control:2,window:3 [--spacing 3500]
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { buildGeminiExtractionRequest } from '../../../apps/backend/src/lib/ai-processor/build-gemini-request.ts';
import { callGeminiGenerateContent, GeminiRateLimitedError } from '../../../apps/backend/src/lib/ai-gateway/gemini-client.ts';
import { loadBackendEnv } from '../../../apps/backend/src/env.ts';
import { armRequest } from './arms.ts';

const args = Object.fromEntries(process.argv.slice(2).reduce<string[][]>((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const sets = Object.fromEntries((args.set ?? 'multi:6,control:2,window:3').split(',').map((s) => s.split(':')).map(([k, v]) => [k, Number(v)]));
const spacing = Number(args.spacing ?? 3500);
const OUT = args.out ?? 'private/ab-runs.jsonl';
const env = loadBackendEnv();
const key = env.systemGeminiApiKey;
if (!key) { console.error('no SYSTEM_GEMINI_API_KEY in .env'); process.exit(2); }

const rows: any[] = readFileSync('private/live-posts.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const re = /(pendaftaran|registrasi|registration|early ?bird|presale|open recruitment|batas (akhir )?pendaftaran|deadline)/i;
const dre = /\b(\d{1,2})\s*(jan|feb|mar|apr|mei|may|jun|jul|agu|aug|sep|okt|oct|nov|des|dec)/i;
const multi = rows.filter((r) => r.n >= 2);
const window = rows.filter((r) => r.n <= 1 && re.test(r.content ?? '') && dre.test(r.content ?? '')).sort((a, b) => hash(a.pid) - hash(b.pid)).slice(0, 12);
const control = rows.filter((r) => r.n === 1 && (r.content ?? '').length > 80 && !window.includes(r)).sort((a, b) => hash(a.pid) - hash(b.pid)).slice(0, 8);
const qrPids: string[] = args.pids ? JSON.parse(readFileSync(args.pids, 'utf8')).map((x: any) => x.pid) : [];
const armsWanted = (args.arms ?? 'A,B,C').split(',');
const posts = qrPids.length
  ? rows.filter((r) => qrPids.includes(r.pid)).map((p) => ({ ...p, set: 'qr' }))
  : [...multi.map((p) => ({ ...p, set: 'multi' })), ...control.map((p) => ({ ...p, set: 'control' })), ...window.map((p) => ({ ...p, set: 'window' }))];
console.log(`posts: multi ${multi.length}, control ${control.length}, window ${window.length}; runs ${JSON.stringify(sets)}`);

const done = new Set(existsSync(OUT) ? readFileSync(OUT, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((j) => j.ok).map((j) => `${j.pid}|${j.arm}|${j.run}`) : []);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const SCHED_REG = /(pendaftaran|registrasi|registration|register|daftar|open recruitment|early ?bird|presale|pre-sale|flash sale|tiket|ticket|call for|open call|penjualan|periode)/i;

for (let run = 1; run <= Math.max(...Object.values(sets)); run++) {
  for (const p of posts) {
    if (run > (sets[p.set] ?? 0)) continue;
    let extra: string[] = [];
    try { extra = typeof p.addl === 'string' ? JSON.parse(p.addl) : Array.isArray(p.addl) ? p.addl : []; } catch { extra = []; }
    const built = await buildGeminiExtractionRequest({ postId: `ab-${p.pid}`, accountId: 'poc', content: p.content ?? '', imageUrl: p.image, additionalImageUrls: extra, postUrl: p.url ?? '', publishedAt: p.published, ownerDisplayName: p.owner } as any);
    const order = (['A', 'B', 'C'] as const).slice(run % 3).concat((['A', 'B', 'C'] as const).slice(0, run % 3));
    for (const arm of order) {
      if (!armsWanted.includes(arm)) continue;
      if (done.has(`${p.pid}|${arm}|${run}`)) continue;
      let attempt = 0;
      for (;;) {
        attempt++;
        try {
          const t0 = Date.now();
          const res = await callGeminiGenerateContent(key, armRequest(arm, built.request) as any);
          let parsed: any = null; try { parsed = JSON.parse(res.text as string); } catch { /* truncated */ }
          const evs: any[] = parsed ? (parsed.isEvent === false ? [] : parsed.events ?? []) : [];
          appendFileSync(OUT, JSON.stringify({
            ok: true, pid: p.pid, set: p.set, arm, run, ms: Date.now() - t0, finish: res.finishReason, usage: res.usage,
            imagesSent: built.imagesSent, imagesAvailable: built.imagesAvailable, parsedOk: !!parsed,
            grouping: parsed?.groupingReason, events: evs.length,
            schedules: evs.map((e) => (e.schedules ?? []).length),
            regLikeSchedules: evs.map((e) => (e.schedules ?? []).filter((s: any) => SCHED_REG.test(s.title ?? '')).length),
            regLikeTitles: evs.flatMap((e) => (e.schedules ?? []).filter((s: any) => SCHED_REG.test(s.title ?? '')).map((s: any) => s.title)),
            window: evs.map((e) => e.registrationWindow ?? null),
            regCount: evs.map((e) => (e.registrations ?? []).length),
            regChannels: evs.flatMap((e) => (e.registrations ?? []).map((r: any) => `${r.channel}:${r.label ?? ''}`)),
            links: evs.map((e) => (e.links ?? []).length),
            regWindowFields: evs.flatMap((e) => (e.registrations ?? []).map((r: any) => ({ o: r.opensOn ?? null, c: r.closesOn ?? null }))),
            highlights: evs.map((e) => e.highlight ?? null),
            published: p.published,
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
