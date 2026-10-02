import test from 'node:test';
import * as assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { buildGeminiExtractionRequest } from './build-gemini-request.js';
import { callGeminiGenerateContent } from '../ai-gateway/gemini-client.js';
import { type ProcessingJobMessage } from '@festgrid/domain/posts';
import { type ScrapedPost } from '@festgrid/domain';

// Story 3.6s (AC9, Task 9.3) — OPT-IN live regression test against the real Gemini API, gated
// exactly like this codebase's existing build-gemini-request.live-carousel.test.ts convention
// (RUN_LIVE_GEMINI_TESTS=true + a real SYSTEM_GEMINI_API_KEY, t.skip(...) otherwise). Excluded
// from default `pnpm --filter backend test`/CI: it is non-deterministic (LLM output), consumes
// real Gemini quota, and depends on expiring external image URLs.
//
// Per the user's correction during this story's creation (AskUserQuestion): this test repeats
// EACH of the four reference posts N times (default 3, overridable via CC024_LIVE_RUNS) and
// asserts groupingReason/event count match README.md's expected values on EVERY run -- a single
// run per post would miss exactly the instability this test exists to catch (the proposal's own
// prototype saw post 4 "Vifation" collapse to one event in one of two runs; this story's own
// prompt-tuning pass during Task 9.1 independently reproduced that exact failure mode before the
// prompt was corrected -- see Dev Agent Record). Runs sequentially (not in parallel) to stay
// inside Gemini rate limits, and reports "k of N runs matched" per post in the failure message so
// a flaky post is distinguishable from a consistently wrong one.
//
// CAVEAT: the four fixtures' image URLs are signed CDN links and expire around 2026-10-06
// (see cc-024-reference-posts/README.md). If run after that date, a fresh --force re-scrape via
// poc-ingestion-preview.ts is needed first (BUG-053's --force re-scrape path is confirmed working
// as of this story). This test's failure message distinguishes "images failed to fetch" from
// "the model grouped differently than expected", the same distinction the existing
// live-carousel test already makes.
//
// Run manually with:
//   RUN_LIVE_GEMINI_TESTS=true SYSTEM_GEMINI_API_KEY=<key> pnpm --filter backend test
// Override the repeat count with CC024_LIVE_RUNS=<n> (positive integer, default 3).

const fixtureDir = resolve(
  __dirname,
  '../../../../../_bmad-output/implementation-artifacts/cc-024-reference-posts'
);

interface CacheEntry {
  scrapedAt: string;
  imageUrlExpiresAt: string | null;
  scrapedPost: ScrapedPost;
}

interface LiveFixtureCase {
  file: string;
  expectedGroupingReason: string;
  expectedEventCount: number;
}

// Expected values per _bmad-output/implementation-artifacts/cc-024-reference-posts/README.md.
const FIXTURES: LiveFixtureCase[] = [
  { file: '1-DdV_7Jsk6pw-sleman-city-hall-reborn.json', expectedGroupingReason: 'program-lineup', expectedEventCount: 1 },
  { file: '2-DdT1cgTlJ2k-smi-drum-contest.json', expectedGroupingReason: 'dependent-stages', expectedEventCount: 1 },
  { file: '3-DcntzF0mB7z-laridijogja-roundup.json', expectedGroupingReason: 'roundup', expectedEventCount: -1 }, // -1: any count 1..10 accepted (roundup cap, model count varies)
  { file: '4-Ddi9wU6RCRQ-vifation-2026.json', expectedGroupingReason: 'separate-events', expectedEventCount: 3 },
];

function getLiveRunCount(): number {
  const raw = process.env.CC024_LIVE_RUNS;
  if (!raw) return 3;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`CC024_LIVE_RUNS must be a positive integer, got: ${raw}`);
  }
  return parsed;
}

test('CC-024 reference-post regression fixtures (opt-in live, Task 9.3)', async (t) => {
  if (process.env.RUN_LIVE_GEMINI_TESTS !== 'true' || !process.env.SYSTEM_GEMINI_API_KEY) {
    t.skip('RUN_LIVE_GEMINI_TESTS/SYSTEM_GEMINI_API_KEY not set — live Gemini regression test opted out');
    return;
  }

  const apiKey = process.env.SYSTEM_GEMINI_API_KEY;
  const runs = getLiveRunCount();

  for (const fixtureCase of FIXTURES) {
    await t.test(`${fixtureCase.file} (${runs} runs)`, async () => {
      const entry: CacheEntry = JSON.parse(readFileSync(resolve(fixtureDir, fixtureCase.file), 'utf-8'));
      const scrapedPost = entry.scrapedPost;

      const message: ProcessingJobMessage = {
        postId: randomUUID(),
        accountId: 'cc024-live-account',
        content: scrapedPost.content,
        imageUrl: scrapedPost.imageUrl,
        postUrl: scrapedPost.postUrl,
        publishedAt: scrapedPost.publishedAt,
        ownerDisplayName: scrapedPost.ownerDisplayName,
        ownerUsername: scrapedPost.ownerUsername,
        additionalImageUrls: scrapedPost.additionalImageUrls
      };

      const results: Array<{ run: number; matched: boolean; detail: string }> = [];

      // Sequential, not parallel, to stay inside Gemini rate limits (per Task 9.3's explicit
      // requirement).
      for (let run = 1; run <= runs; run++) {
        const { request, imageBytes } = await buildGeminiExtractionRequest(message);

        if (!imageBytes) {
          results.push({
            run,
            matched: false,
            detail:
              'Cover image could not be fetched — the fixture image URL is likely stale ' +
              `(expires ${entry.imageUrlExpiresAt ?? 'unknown'}; see README.md). A fresh --force ` +
              're-scrape via poc-ingestion-preview.ts is needed. This is distinct from the model ' +
              'grouping differently than expected on successfully-fetched images.'
          });
          continue;
        }

        let resultText: string;
        try {
          const result = await callGeminiGenerateContent(apiKey, request);
          resultText = result.text;
        } catch (err: any) {
          results.push({ run, matched: false, detail: `Live Gemini call failed: ${err?.message || String(err)}` });
          continue;
        }

        let payload: any;
        try {
          payload = JSON.parse(resultText);
        } catch {
          results.push({ run, matched: false, detail: `Gemini response was not valid JSON: ${resultText}` });
          continue;
        }

        const eventCount = Array.isArray(payload.events) ? payload.events.length : -1;
        const groupingMatches = payload.groupingReason === fixtureCase.expectedGroupingReason;
        const countMatches =
          fixtureCase.expectedEventCount === -1
            ? eventCount >= 1 && eventCount <= 10
            : eventCount === fixtureCase.expectedEventCount;

        results.push({
          run,
          matched: groupingMatches && countMatches,
          detail: `groupingReason=${payload.groupingReason}, events=${eventCount}`
        });
      }

      const matchedCount = results.filter((r) => r.matched).length;
      const summary = results.map((r) => `run ${r.run}: ${r.matched ? 'MATCH' : 'MISMATCH'} (${r.detail})`).join('; ');

      assert.strictEqual(
        matchedCount,
        runs,
        `${fixtureCase.file}: expected groupingReason="${fixtureCase.expectedGroupingReason}"` +
          (fixtureCase.expectedEventCount === -1 ? ', events 1-10' : `, events=${fixtureCase.expectedEventCount}`) +
          ` on every run — got ${matchedCount} of ${runs} runs matching. ${summary}`
      );
    });
  }
});
