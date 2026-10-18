/**
 * Probe (live Gemini): what does the PRODUCTION extraction prompt put in `schedules[].location` for
 * online, hybrid and multi-venue posts? No insight schema involved — this is today's behaviour.
 *
 *   BACKEND_PORT=4001 DATABASE_URL=<placeholder> SYSTEM_GEMINI_API_KEY=... npx tsx scripts/poc-event-insight/probe-online.ts
 */
import type { ProcessingJobMessage } from '@festgrid/domain/posts';
import { buildGeminiExtractionRequest } from '../../src/lib/ai-processor/build-gemini-request.js';
import { callGeminiGenerateContent, GeminiRateLimitedError } from '../../src/lib/ai-gateway/gemini-client.js';
import { PROBE_POSTS } from './venues.js';

const KEY = process.env.GEMINI_API_KEY ?? process.env.SYSTEM_GEMINI_API_KEY;
if (!KEY) throw new Error('No Gemini key');

const RUNS = parseInt(process.argv[process.argv.indexOf('--runs') + 1] || '1', 10) || 1;
// --patched: append an explicit location rule to the production instruction (probe only; product code is untouched).
const PATCHED = process.argv.includes('--patched');
const LOCATION_RULES = `LOCATION RULES (these take precedence): a schedule's "location" is the PHYSICAL place where that schedule happens, as written in the post (a venue name or address), even when the same place also appears in the schedule title. If different days or sessions happen at different places, EVERY such schedule gets its own location. Never put a video-call platform, link or the word "online" (Zoom, Google Meet, YouTube, webinar, daring) in location: leave location absent for a fully online schedule, and for a hybrid event put only the physical place.`;
const ONLY = process.argv.includes('--only') ? (process.argv[process.argv.indexOf('--only') + 1] ?? '').split(',') : undefined;

async function callWithRetry(request: Parameters<typeof callGeminiGenerateContent>[1]): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    try {
      return (await callGeminiGenerateContent(KEY as string, request)).text;
    } catch (e) {
      if (e instanceof GeminiRateLimitedError && attempt < 4) { await new Promise((r) => setTimeout(r, (e.retryAfterSeconds ?? 15 * (attempt + 1)) * 1000)); continue; }
      throw e;
    }
  }
}

async function main(): Promise<void> {
  for (const p of PROBE_POSTS.filter((x) => !ONLY || ONLY.includes(x.id))) {
    for (let run = 1; run <= RUNS; run++) {
    const message: ProcessingJobMessage = { postId: `probe-${p.id}`, accountId: 'probe', content: p.caption, postUrl: 'https://example.invalid/p', publishedAt: '2026-10-01T09:00:00.000Z' };
    const { request } = await buildGeminiExtractionRequest(message);
    if (PATCHED) request.systemInstruction = `${request.systemInstruction}\n\n${LOCATION_RULES}`;
    const text = await callWithRetry(request);
    const payload = JSON.parse(text.replace(/^\s*```json/, '').replace(/```\s*$/, '').trim());
    console.log(`\n### ${p.id} — run ${run}${PATCHED ? ' [patched]' : ''} — ${p.note}`);
    for (const [i, e] of (payload.events ?? []).entries()) {
      console.log(`  event ${i + 1}: ${e.eventName} | event.location=${JSON.stringify(e.location ?? null)}`);
      for (const [j, s] of (e.schedules ?? []).entries()) console.log(`    schedule ${j + 1}: ${s.eventStartDate} location=${JSON.stringify(s.location ?? null)}${s.title ? ` title=${JSON.stringify(s.title)}` : ''}`);
    }
    }
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
