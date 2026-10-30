/**
 * Probe (live Gemini): what "default location" does the PRODUCTION inference prompt
 * (`buildLocationInferenceRequest`, the one `backfillAccountProfileAndInferDefaultLocation` uses) give
 * for each post of an account? A real account location should be stable across posts. A curator's
 * is not — the prompt asks where THIS POST's events take place.
 *
 *   BACKEND_PORT=4001 DATABASE_URL=<placeholder> SYSTEM_GEMINI_API_KEY=... npx tsx scripts/poc-event-insight/probe-default-location.ts
 */
import { buildLocationInferenceRequest, parseLocationInferenceResponse } from '@festgrid/domain';
import { callGeminiGenerateContent, GeminiRateLimitedError } from '../../src/lib/ai-gateway/gemini-client.js';
import { loadCases } from './corpus.js';

const KEY = process.env.GEMINI_API_KEY ?? process.env.SYSTEM_GEMINI_API_KEY;
const THRESHOLD = 0.5; // LOCATION_INFERENCE_CONFIDENCE_THRESHOLD default (apps/backend/src/env.ts)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call(req: NonNullable<ReturnType<typeof buildLocationInferenceRequest>>): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    try { return (await callGeminiGenerateContent(KEY as string, req)).text; } catch (e) {
      if (e instanceof GeminiRateLimitedError && attempt < 4) { await sleep((e.retryAfterSeconds ?? 15 * (attempt + 1)) * 1000); continue; }
      throw e;
    }
  }
}

async function main(): Promise<void> {
  if (!KEY) throw new Error('No Gemini key');
  const real = loadCases('core').filter((c) => c.source === 'real' && c.account);
  const byAccount = new Map<string, typeof real>();
  for (const c of real) byAccount.set(c.account as string, [...(byAccount.get(c.account as string) ?? []), c]);
  for (const [account, posts] of byAccount) {
    console.log(`\n## @${account} — ${posts.length} post(s)`);
    const places: string[] = [];
    for (const p of posts) {
      const req = buildLocationInferenceRequest({ content: p.caption, ownerUsername: account, ownerDisplayName: account });
      if (!req) continue;
      const inf = parseLocationInferenceResponse(await call(req));
      const verdict = inf ? (inf.confidence >= THRESHOLD ? 'APPLIED' : 'awaiting approval') : 'nothing found';
      console.log(`  ${p.id.padEnd(26)} -> ${inf ? JSON.stringify(inf.placeDescription) : '—'}  conf=${inf ? inf.confidence.toFixed(2) : '—'}  ${verdict}`);
      if (inf) places.push(inf.placeDescription);
    }
    console.log(`  distinct place descriptions: ${new Set(places.map((x) => x.toLowerCase())).size} of ${places.length}`);
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
