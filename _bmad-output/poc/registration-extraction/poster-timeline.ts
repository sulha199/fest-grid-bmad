// POC: does the production extraction read a timeline poster whose old dates are struck through and replaced ("EXTENDED")?
// Input: private/vectra-post.json (caption, published_at) and private/vectra-timeline.png (the poster slide, supplied by the owner). Production request builder, 2 runs.
//   npx tsx poster-timeline.ts [--runs 2]
import { readFileSync } from 'node:fs';
import { buildGeminiExtractionRequest } from '../../../apps/backend/src/lib/ai-processor/build-gemini-request.ts';
import { callGeminiGenerateContent } from '../../../apps/backend/src/lib/ai-gateway/gemini-client.ts';
import { loadBackendEnv } from '../../../apps/backend/src/env.ts';
import { claimCall } from './quota-budget.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce<string[][]>((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const runs = Number(args.runs ?? 2);
const key = loadBackendEnv().systemGeminiApiKey;
if (!key) { console.error('no SYSTEM_GEMINI_API_KEY in .env'); process.exit(2); }
const post = JSON.parse(readFileSync('private/vectra-post.json', 'utf8'));
const URL_ = 'https://poc.local/vectra-timeline.png';
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: any, init?: any) => {
  const u = typeof input === 'string' ? input : input?.url ?? String(input);
  if (u === URL_) return new Response(readFileSync('private/vectra-timeline.png'), { status: 200, headers: { 'content-type': 'image/png' } });
  return realFetch(input, init);
}) as typeof fetch;

const built = await buildGeminiExtractionRequest({ postId: 'ab-vectra', accountId: 'poc', content: post.c ?? '', imageUrl: URL_, additionalImageUrls: [], postUrl: '', publishedAt: post.p, ownerDisplayName: post.o ?? '' } as any);
for (let run = 1; run <= runs; run++) {
  if (!claimCall().ok) { console.log('stopping: budget'); process.exit(3); }
  const res = await callGeminiGenerateContent(key, built.request as any);
  let parsed: any = null; try { parsed = JSON.parse(res.text as string); } catch { /* bad json */ }
  console.log(`run ${run}: finish=${res.finishReason} events=${parsed?.events?.length ?? '?'}`);
  for (const e of parsed?.events ?? []) {
    console.log(`  event: ${e.eventName} [${(e.types ?? []).join(',')}]`);
    for (const s of e.schedules ?? []) console.log(`    ${s.title ?? '-'} | ${s.eventStartDate ?? '-'}${s.eventEndDate ? '..' + s.eventEndDate : ''} | main=${!!s.isMainSchedule}`);
  }
}
