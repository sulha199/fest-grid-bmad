import test from 'node:test';
import * as assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import '../scraper/register-adapters.js';
import { detectPlatformFromUrl, getScraperAdapter, type ScrapedPost } from '@festgrid/domain';
import { buildGeminiExtractionRequest } from './build-gemini-request.js';
import { callGeminiGenerateContent } from '../ai-gateway/gemini-client.js';
import { type ProcessingJobMessage } from '@festgrid/domain/posts';

// Story 3.20 (Task 9.2, AC7) -- OPT-IN live extraction-parity check: does blurring every image
// before it is sent to Gemini (this story's whole point) change what the model extracts? Gated
// exactly like build-gemini-request.live-cc024-regression.test.ts's established convention
// (RUN_LIVE_GEMINI_TESTS=true + a real SYSTEM_GEMINI_API_KEY, t.skip(...) otherwise) -- excluded
// from default `pnpm --filter backend test`/CI: non-deterministic (LLM output), consumes real
// Gemini + scraping quota, and (unlike the cc024 regression test) this one does NOT read a
// committed fixture -- AC7 explicitly requires re-scraping each post FRESH every run, since the
// whole point is to feed the (just-fetched) original bytes down one arm and the blurred bytes
// down the other, and a stale, already-expired signed CDN link would make both arms fail to fetch
// identically, masking any real difference.
//
// POSTS below covers the four existing cc-024-reference-posts fixtures (reused for their post
// URLs only, not their committed JSON -- this test re-scrapes) plus two new posts with NO prior
// recorded expected result. Per AC7/Task 9.3, the two new posts' baseline is whatever the
// ORIGINAL arm produces on this run, and that baseline must be reviewed and confirmed correct by
// a human before being trusted for comparison -- this automated test file cannot itself perform
// that human sign-off (node:test has no interactive prompt), so it prints each new post's
// original-arm result prominently and documents the sign-off as a manual step the operator
// completes by reading this test's console output before relying on its PASS/FAIL. See this
// story's Dev Notes for the recorded sign-off, once performed.
//
// Material-difference rule (Task 9.5, corrected from the original proposal): a difference is
// material only when the BLURRED arm's runs produce an event count, grouping reason, name, or
// date that the ORIGINAL arm's runs (for that same post) NEVER produced across ALL its runs --
// never a difference between a single pair of runs, since extraction is already known to be
// non-deterministic run-to-run (the CC-024 prototype's post 4 "Vifation" collapsed once in two
// runs with no code change at all).
//
// Run manually with:
//   RUN_LIVE_GEMINI_TESTS=true SYSTEM_GEMINI_API_KEY=<key> pnpm --filter backend test -- --test-name-pattern="CC-028"
// Override the repeat count with CC028_LIVE_RUNS=<n> (positive integer, default 3).

interface ParityPost {
  url: string;
  label: string;
  hasRecordedBaseline: boolean;
}

const POSTS: ParityPost[] = [
  { url: 'https://www.instagram.com/p/DdV_7Jsk6pw/', label: '1-sleman-city-hall-reborn (cc-024)', hasRecordedBaseline: true },
  { url: 'https://www.instagram.com/p/DdT1cgTlJ2k/', label: '2-smi-drum-contest (cc-024)', hasRecordedBaseline: true },
  { url: 'https://www.instagram.com/p/DcntzF0mB7z/', label: '3-laridijogja-roundup (cc-024)', hasRecordedBaseline: true },
  { url: 'https://www.instagram.com/p/Ddi9wU6RCRQ/', label: '4-vifation-2026 (cc-024)', hasRecordedBaseline: true },
  { url: 'https://www.instagram.com/suzurunberiman/p/Dd6SHRZzxI8/', label: '5-suzurunberiman (new, AC7)', hasRecordedBaseline: false },
  { url: 'https://www.instagram.com/merapiperformance/p/DdVwNyFATse/', label: '6-merapiperformance (new, AC7)', hasRecordedBaseline: false },
];

interface RunOutcome {
  run: number;
  ok: boolean;
  detail: string;
  groupingReason?: string;
  eventCount?: number;
  eventNames?: string[];
  dates?: string[];
  coverFaceCount?: number;
}

function getLiveRunCount(): number {
  const raw = process.env.CC028_LIVE_RUNS;
  if (!raw) return 3;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`CC028_LIVE_RUNS must be a positive integer, got: ${raw}`);
  }
  return parsed;
}

function extractOutcome(run: number, resultText: string, coverFaceCount: number | undefined): RunOutcome {
  let payload: any;
  try {
    payload = JSON.parse(resultText);
  } catch {
    return { run, ok: false, detail: `Gemini response was not valid JSON: ${resultText}` };
  }
  const events = Array.isArray(payload.events) ? payload.events : [];
  const eventNames: string[] = events.map((e: any) => e.eventName).filter(Boolean);
  const dates: string[] = events.flatMap((e: any) =>
    Array.isArray(e.schedules) ? e.schedules.map((s: any) => s.eventStartDate).filter(Boolean) : []
  );
  return {
    run,
    ok: true,
    detail: `groupingReason=${payload.groupingReason}, events=${events.length}, names=${JSON.stringify(eventNames)}, dates=${JSON.stringify(dates)}`,
    groupingReason: payload.groupingReason,
    eventCount: events.length,
    eventNames,
    dates,
    coverFaceCount,
  };
}

/** Task 9.5 -- a value in `blurredValues` is material only if it never appears anywhere in `originalValues`. */
function findMaterialNewValues<T>(originalValues: T[], blurredValues: T[]): T[] {
  const originalSet = new Set(originalValues.map((v) => JSON.stringify(v)));
  const seen = new Set<string>();
  const materialNew: T[] = [];
  for (const v of blurredValues) {
    const key = JSON.stringify(v);
    if (!originalSet.has(key) && !seen.has(key)) {
      seen.add(key);
      materialNew.push(v);
    }
  }
  return materialNew;
}

test('CC-028 extraction parity check: original vs. blurred (opt-in live, Task 9)', async (t) => {
  if (process.env.RUN_LIVE_GEMINI_TESTS !== 'true' || !process.env.SYSTEM_GEMINI_API_KEY) {
    t.skip('RUN_LIVE_GEMINI_TESTS/SYSTEM_GEMINI_API_KEY not set — live Gemini parity check opted out');
    return;
  }

  const apiKey = process.env.SYSTEM_GEMINI_API_KEY;
  const runs = getLiveRunCount();
  const materialDifferences: string[] = [];

  for (const post of POSTS) {
    await t.test(`${post.label} (${runs} runs per arm)`, async () => {
      if (!post.hasRecordedBaseline) {
        console.log(
          `\n[CC-028] ${post.label} has NO recorded expected result. Its baseline is this run's ORIGINAL arm ` +
            'output below -- review it and confirm it is correct before trusting this test\'s material-' +
            'difference verdict for this post (AC7/Task 9.3). This automated test cannot perform that sign-off ' +
            'itself; it is a manual step for whoever runs this opt-in test.'
        );
      }

      // AC7: re-scrape fresh every run -- signed image CDN links expire, so a stale scrape would
      // make both arms fail identically and mask any real difference.
      const platform = detectPlatformFromUrl(post.url);
      assert.ok(platform, `expected a supported platform for URL: ${post.url}`);
      const adapter = getScraperAdapter(platform!);
      const scraped: ScrapedPost | null = await adapter.getPostByUrl(post.url);
      assert.ok(scraped, `expected a successful scrape for ${post.url} (post may be private/deleted/rate-limited)`);

      const message: ProcessingJobMessage = {
        postId: randomUUID(),
        accountId: 'cc028-live-parity-account',
        content: scraped!.content,
        imageUrl: scraped!.imageUrl,
        postUrl: scraped!.postUrl,
        publishedAt: scraped!.publishedAt,
        ownerDisplayName: scraped!.ownerDisplayName,
        ownerUsername: scraped!.ownerUsername,
        additionalImageUrls: scraped!.additionalImageUrls,
      };

      async function runArm(blurred: boolean): Promise<RunOutcome[]> {
        const outcomes: RunOutcome[] = [];
        // Sequential, not parallel, to respect Gemini rate limits (matching the existing live
        // regression test's own reasoning).
        for (let run = 1; run <= runs; run++) {
          const { request, imageBytes, coverFaceCount } = await buildGeminiExtractionRequest(
            message,
            blurred ? { blurFacesBeforeAi: { isOwnerOptedIn: false } } : undefined
          );
          if (!imageBytes) {
            outcomes.push({ run, ok: false, detail: 'Cover image could not be fetched for this run.' });
            continue;
          }
          try {
            const result = await callGeminiGenerateContent(apiKey, request);
            outcomes.push(extractOutcome(run, result.text, coverFaceCount));
          } catch (err: any) {
            outcomes.push({ run, ok: false, detail: `Live Gemini call failed: ${err?.message || String(err)}` });
          }
        }
        return outcomes;
      }

      const originalOutcomes = await runArm(false);
      const blurredOutcomes = await runArm(true);

      const okOriginal = originalOutcomes.filter((o) => o.ok);
      const okBlurred = blurredOutcomes.filter((o) => o.ok);

      console.log(`\n[CC-028] ${post.label} -- ORIGINAL arm:`);
      for (const o of originalOutcomes) console.log(`  run ${o.run}: ${o.ok ? o.detail : `FAILED (${o.detail})`}`);
      console.log(`[CC-028] ${post.label} -- BLURRED arm (cover faceCount per run: ${okBlurred.map((o) => o.coverFaceCount ?? 'n/a').join(', ')}):`);
      for (const o of blurredOutcomes) console.log(`  run ${o.run}: ${o.ok ? o.detail : `FAILED (${o.detail})`}`);

      if (okOriginal.length === 0 || okBlurred.length === 0) {
        console.warn(`[CC-028] ${post.label}: at least one arm had zero successful runs -- cannot compare, skipping material-difference check for this post.`);
        return;
      }

      const noFacesDetected = okBlurred.every((o) => (o.coverFaceCount ?? 0) === 0);
      if (noFacesDetected) {
        console.warn(
          `[CC-028] ${post.label}: zero faces detected on the cover across all blurred-arm runs -- this post is ` +
            'blur-IDENTICAL to its original and proves nothing about degradation either way (Task 9.4). Recorded, not a "pass".'
        );
      }

      const materialGroupingReasons = findMaterialNewValues(
        okOriginal.map((o) => o.groupingReason),
        okBlurred.map((o) => o.groupingReason)
      );
      const materialEventCounts = findMaterialNewValues(
        okOriginal.map((o) => o.eventCount),
        okBlurred.map((o) => o.eventCount)
      );
      const materialNames = findMaterialNewValues(
        okOriginal.flatMap((o) => o.eventNames ?? []),
        okBlurred.flatMap((o) => o.eventNames ?? [])
      );
      const materialDates = findMaterialNewValues(
        okOriginal.flatMap((o) => o.dates ?? []),
        okBlurred.flatMap((o) => o.dates ?? [])
      );

      const postMaterialFindings: string[] = [];
      if (materialGroupingReasons.length > 0) postMaterialFindings.push(`groupingReason: ${JSON.stringify(materialGroupingReasons)}`);
      if (materialEventCounts.length > 0) postMaterialFindings.push(`eventCount: ${JSON.stringify(materialEventCounts)}`);
      if (materialNames.length > 0) postMaterialFindings.push(`eventName: ${JSON.stringify(materialNames)}`);
      if (materialDates.length > 0) postMaterialFindings.push(`date: ${JSON.stringify(materialDates)}`);

      if (postMaterialFindings.length > 0) {
        const msg = `${post.label}: MATERIAL DIFFERENCE found in blurred arm, never seen in original arm's ${okOriginal.length} runs -- ${postMaterialFindings.join('; ')}`;
        materialDifferences.push(msg);
        console.error(`[CC-028] ${msg}`);
      } else {
        console.log(`[CC-028] ${post.label}: no material difference between original and blurred arms.`);
      }
    });
  }

  // Task 9.7: a material difference on ANY post stops the dev and must be raised to the user --
  // never a silent pass. Failing this top-level assertion is that "stop."
  assert.deepStrictEqual(
    materialDifferences,
    [],
    `Material difference(s) found between the original and blurred extraction arms -- raise to the user ` +
      `(accept, or revisit eyes-only redaction, IDEA-058) before marking Story 3.20 done:\n${materialDifferences.join('\n')}`
  );
});
