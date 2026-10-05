---
title: 'Auto-enqueue new posts from Bright Data/Apify async scrape results'
type: 'bugfix'
created: '2026-10-05'
status: 'done'
baseline_commit: '2b3e9451a82f6ea7ba30e7c68617737f83f2ad36'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/3-6z-automatically-enqueue-new-scraped-posts-for-extraction-within-quota.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 3.6z (Automatically enqueue new scraped posts for extraction) only wired auto-enqueue into `processScrapeJob`, the last-resort SQS fallback. Prod's daily batch dispatches to Bright Data (then Apify) async; their webhooks persist posts via `processBrightDataResult`/`processApifyAsyncResult`, which never enqueue. Verified in prod CloudWatch: the 2026-10-05 batch sent all 8 targets to Bright Data, 8 webhooks fired with no errors, and zero `[processScrapeJob]` lines exist in 3 days. PRD §3.7 (Automatic Extraction of New Posts) is therefore unmet for nearly every post.

**Approach:** Extract the 3.6z per-post block into one shared never-throwing helper, call it from `processScrapeJob` and both async processors (the stale-job sweep reuses them), and give the two webhook Lambdas the queue env and IAM grant they need.

## Boundaries & Constraints

**Always:** Only genuinely new posts (`alreadyExisted === false`). Key check uses the persisted row's `accountId`, per post. A per-post failure is logged and never aborts the loop or the job's persist/`markPendingJobCompleted`. Reuse `hasAvailableApiKeyForAccount` and `enqueuePostForProcessing` unchanged.

**Ask First:** Any change to `enqueuePostForProcessing` semantics, the claim TTL, or the Webhook Lambda timeouts.

**Never:** Backfill or re-enqueue posts already persisted (that is a separate one-off). No change to `replay-actor-run.ts`. Do not touch the pre-existing Apify-async omission of `additionalImageUrls`. No `sharp`/face-api/tfjs reachable from the webhook Lambda bundles (2026-10-04 incident).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| New post, key available | async result, `alreadyExisted=false`, active subscriber with valid Gemini key | exactly one SQS send to `AI_PROCESSING_QUEUE_URL` | N/A |
| New post, no key | no subscriber or no valid key | not enqueued, `isExtracted` stays false | no throw |
| Re-delivered post | `alreadyExisted=true` | no key check, no enqueue | N/A |
| Enqueue throws | SQS error on post 1 of 2 | post 1 error logged with source prefix; post 2 still persisted and attempted | caught inside helper |

</frozen-after-approval>

## Code Map

- `apps/backend/src/lib/scraper/process-scrape-job.ts:52-68` -- existing inline block to extract (sync path)
- `apps/backend/src/lib/scraper/process-brightdata-result.ts`, `process-apify-async-result.ts` -- async persisters needing the call; `stale-job-sweep.ts` reuses both
- `apps/backend/src/lib/posts/persist-scraped-post.ts` -- returns `{ post, alreadyExisted }`
- `apps/infrastructure/lib/festgrid-backend-stack.ts:734-762` -- `webhookLambda`/`apifyWebhookLambda` (no queue env/grant today); mirror scraperLambda's lines 362-370 and 650
- `apps/infrastructure/lib/festgrid-backend-stack.test.ts:270` -- generic queue-URL-has-grant walker that guards this

## Tasks & Acceptance

**Execution:**
- [x] `apps/backend/src/lib/posts/auto-enqueue-new-post.ts` -- new `autoEnqueueNewPostForExtraction({ post, alreadyExisted }, source)`: skip if existed; key check then enqueue; catch and `console.error` `[source] auto-enqueue failed for post <id> (account <id>):` -- one shared implementation
- [x] `process-scrape-job.ts` -- replace inline block with helper call, source `processScrapeJob` -- keep existing 3.6z tests green
- [x] `process-brightdata-result.ts`, `process-apify-async-result.ts` -- capture `persistScrapedPost` result and call helper after each persist -- the fix
- [x] `festgrid-backend-stack.ts` -- add `AI_PROCESSING_QUEUE_URL`, `AI_PROCESSING_INLINE_FALLBACK_ENABLED='false'`, `POST_EXTRACTION_CLAIM_TTL_MINUTES` env to both webhook Lambdas and `aiProcessingQueue.grantSendMessages` on each -- else SQS AccessDenied
- [x] Tests: helper (4 matrix rows) in `auto-enqueue-new-post.test.ts`; per-processor new-post-with-key enqueues once and already-existed does not; infra grants covered by the existing walker, extend `lambda-sharp-isolation.test.ts` to bundle both webhook entries

**Acceptance Criteria:**
- Given a Bright Data or Apify async result with a new post and an available key, when the webhook/sweep processes it, then one message is sent to the AI processing queue.
- Given the synthesized stack, when the queue-URL grant walker and bundle-isolation tests run, then both webhook Lambdas hold the grant and never bundle `sharp`/face-api/tfjs.

## Design Notes

A webhook Lambda timeout mid-loop leaves the job PENDING; the sweep re-runs it and those posts are `alreadyExisted`, so they are not auto-enqueued. This is the same accepted limitation as the sync path; those posts stay available to manual selection (PRD §3.10).

## Verification

**Commands:**
- `pnpm --filter backend test` (targeted files) -- expected: pass
- `pnpm --filter infrastructure test` -- expected: pass
- `pnpm -w lint` and `pnpm --filter backend exec tsc --noEmit` -- expected: clean

## Suggested Review Order

**The fix: one shared auto-enqueue, called from every persister**

- Never-throwing helper; skips existing posts, checks key for the persisted account, then enqueues.
  [`auto-enqueue-new-post.ts:19`](../../apps/backend/src/lib/posts/auto-enqueue-new-post.ts#L19)

- Bright Data webhook path: the missing call that left prod's daily batch unextracted.
  [`process-brightdata-result.ts:42`](../../apps/backend/src/lib/scraper/process-brightdata-result.ts#L42)

- Apify async path (the stale-job sweep reuses both processors).
  [`process-apify-async-result.ts:47`](../../apps/backend/src/lib/scraper/process-apify-async-result.ts#L47)

- Sync SQS fallback now routes through the same helper, behaviour unchanged.
  [`process-scrape-job.ts:51`](../../apps/backend/src/lib/scraper/process-scrape-job.ts#L51)

**Infra: webhook Lambdas need the queue to use it**

- Bright Data webhook Lambda gets the queue URL env and send grant.
  [`festgrid-backend-stack.ts:746`](../../apps/infrastructure/lib/festgrid-backend-stack.ts#L746)
  [`festgrid-backend-stack.ts:754`](../../apps/infrastructure/lib/festgrid-backend-stack.ts#L754)

- Apify webhook Lambda, same wiring.
  [`festgrid-backend-stack.ts:769`](../../apps/infrastructure/lib/festgrid-backend-stack.ts#L769)
  [`festgrid-backend-stack.ts:777`](../../apps/infrastructure/lib/festgrid-backend-stack.ts#L777)

**Tests**

- Helper behaviour: key, no key, already existed, enqueue failure swallowed.
  [`auto-enqueue-new-post.test.ts`](../../apps/backend/src/lib/posts/auto-enqueue-new-post.test.ts)

- Bright Data end to end: enqueued once, not on re-delivery, batch survives a failed send.
  [`process-brightdata-result.test.ts:481`](../../apps/backend/src/lib/scraper/process-brightdata-result.test.ts#L481)
  [`process-brightdata-result.test.ts:564`](../../apps/backend/src/lib/scraper/process-brightdata-result.test.ts#L564)

- Apify equivalent of the partial-failure case.
  [`process-apify-async-result.test.ts:378`](../../apps/backend/src/lib/scraper/process-apify-async-result.test.ts#L378)

- Structural 3.6z test now asserts all three persisters go through the helper.
  [`enqueue-post-for-processing.test.ts:290`](../../apps/backend/src/lib/posts/enqueue-post-for-processing.test.ts#L290)

- Webhook bundles must never reach sharp/face-api/tfjs (2026-10-04 incident guard).
  [`lambda-sharp-isolation.test.ts:85`](../../apps/infrastructure/lib/lambda-sharp-isolation.test.ts#L85)

- Seed/capture helpers shared by the tests.
  [`auto-enqueue-test-helpers.ts`](../../apps/backend/src/lib/posts/auto-enqueue-test-helpers.ts)

