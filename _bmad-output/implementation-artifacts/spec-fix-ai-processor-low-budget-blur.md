---
title: 'AI processor: never start a message without enough Lambda time for face-blur'
type: 'bugfix'
created: '2026-11-09'
status: 'done'
baseline_commit: 'bfe92e15b7bffe5dd6c092c69e7cfa860dddf5ca'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The prod AI-processor Lambda (300s timeout) drains its queue until a 270s budget is spent, so late messages start with 30-60s left. That is below `faceBlurMinRemainingTimeMs` (60s), so the pre-AI cover blur fails closed: the post is extracted text-only, gets no thumbnail, and is never retried. 380 prod posts are in this state (`text_only_fail_closed`: 280 in Oct, 100 in Nov), e.g. post `b92beff2…` / event `ig_p_DezN8HHE2ss`.

**Approach:** When face-blur is on, make the AI processor's `pollAndDrainQueue` call size its receives from a measured per-message budget and refuse to start any message when the Lambda's real remaining time is below floor + margin. Leftover queue work waits for the next 5-minute tick.

## Boundaries & Constraints

**Always:** Keep AD-28/Story 3.20 fail-closed (original bytes are never the fallback); the in-job low-budget checks in `build-gemini-request.ts` and `process-ai-job.ts` stay as backstops. With no new options `pollAndDrainQueue` behaves exactly as today (scraper/ingestor untouched). When `BLUR_FACES_BEFORE_AI` is off (dev/staging) the AI processor passes no new options.

**Ask First:** Making a low-budget cover blur retry (throw, leave message undeleted) instead of text-only: it reverses Story 3.20 AC3 and the existing `Case T` test.

**Never:** Run the thumbnail backfill, touch prod data, or change `FACE_BLUR_MIN_REMAINING_TIME_MS`, the Lambda timeout, queue visibility timeout or `maxReceiveCount`. No change to blur, slide or extraction logic.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Plenty of time | remaining ≥ min before a message | handled and deleted as today | N/A |
| Slow batch | remaining < min before a later message of a received batch | loop returns; that message and the rest stay undeleted (next tick) | warn `{remaining, min, handled, leftInFlight}` |
| First message | remaining < min before the very first message | not handled (guard applies to every message) | same warn |
| Before a receive | remaining < min | no ReceiveMessage call, loop returns | same warn |
| Receive sizing | `perMessageBudgetMs` set | each receive asks `floor((deadline-now)/perMessageBudgetMs)` messages (existing rule) | N/A |
| Guard options absent | no `getRemainingTimeInMillis` / no `minRemainingMs` (scraper, ingestor, tests, blur off) | guard disabled, unchanged | N/A |

</frozen-after-approval>

## Code Map

- `apps/backend/src/lib/aws/poll-and-drain-queue.ts` -- shared drain loop; gets the optional remaining-time guard.
- `apps/backend/src/lib/aws/poll-and-drain-queue.test.ts` -- node:test suite; add guard cases.
- `apps/backend/src/lambdas/ai-processor.ts` -- poll-and-drain branch calls the loop with no options today.
- `apps/backend/src/lambdas/ai-processor.test.ts` -- handler test; uses the `setReceiveSqsMessages` seam.
- `apps/backend/src/lambdas/scraper.ts:58,103` -- precedent: `perMessageBudgetMs` + named overhead constant.
- `apps/backend/src/env.ts:410` -- `faceBlurMinRemainingTimeMs`; `env.blurFacesBeforeAi`.

## Tasks & Acceptance

**Execution:**
- [x] `poll-and-drain-queue.ts` -- add optional `minRemainingMs` + `getRemainingTimeInMillis`; before each receive and before each message (including a batch's first) return with a `console.warn` when remaining < `minRemainingMs`; no-op if either is absent.
- [x] `ai-processor.ts` -- only when `env.blurFacesBeforeAi` and the context has `getRemainingTimeInMillis`: `minRemainingMs = faceBlurMinRemainingTimeMs + AI_MESSAGE_WORK_MARGIN_MS` (40_000), `perMessageBudgetMs = AI_PER_MESSAGE_BUDGET_MS` (45_000), `timeBudgetMs = remaining - minRemainingMs + perMessageBudgetMs` (floored at 0), so the last receive happens early enough that its messages still start ≥ min before timeout. Named consts with the measurement in a comment.
- [x] `poll-and-drain-queue.test.ts` -- stub `Date.now` (no real sleeps) and cover every matrix row, incl. first message skipped and unchanged existing cases (`timeBudgetMs: 0` first-message rule still holds without guard options).
- [x] `ai-processor.test.ts` -- via `setReceiveSqsMessages`: context remaining 300_000 with blur on → first receive asks `maxMessages` 5 (floor(245000/45000), stable under ms jitter); remaining 50_000 → no receive; blur off → `maxMessages` undefined.

**Acceptance Criteria:**
- Given blur is on, when the AI processor drains, then no message starts with less than floor + 40s Lambda time remaining.
- Given a message slower than its 45s budget pushes a later batch message below the minimum, when the loop reaches it, then nothing is handled or deleted for it and a warning logs remaining/min/handled/leftInFlight.
- Given blur is off, or scraper/ingestor poll-and-drain, when run, then behavior and receive sizes are unchanged.

## Design Notes

Measured 2026-11-02..09 (log gaps between messages, an upper bound): p50 4.6s, p95 22s, p99 40s, max 71s. Hence the 45s budget (≈p99) and a 40s work margin on top of the 60s floor: the cover blur, up to 4 slide blurs and the Gemini call must fit in that margin, because slide blurs and the thumbnail stage re-check the 60s floor. The ~1% of messages slower than p99 can still drop a slide or skip the thumbnail (both still fail-closed, thumbnail is backfillable); the AC is therefore "no message starts below floor + margin", not "no low-budget branch ever fires".

Arithmetic: deadline = 245s from loop start (300 - 100 + 45); receives size to floor((245-t)/45), the last receive is at ≤200s, so every message starts with ≥100s left. The guard is a backstop for slow batches. A message arriving in the last seconds of a 20s long poll could still be received then skipped; it stays in flight 300s and costs one of 3 receives, rare and logged, so no extra pre-receive margin (it would shorten every busy tick).

Throughput: last start ~200s vs ~270s (about -26% per busy tick). Prod receives 100-143 messages/day in one burst at ~5s each: roughly 4 ticks instead of 3, DLQ empty.

## Verification

**Commands:**
- `pnpm --filter backend exec tsx --test src/lib/aws/poll-and-drain-queue.test.ts src/lambdas/ai-processor.test.ts` -- expected: all pass (rebuild domain/database dist first if imports fail)
- `pnpm --filter backend exec tsc --noEmit` -- expected: no errors
- `pnpm --filter backend lint` -- expected: clean

## Suggested Review Order

**Budget derived from the blur floor (entry point)**

- Per-message budget, work margin and the deadline arithmetic that keeps every message start above floor + margin.
  [`ai-processor.ts:22`](../../apps/backend/src/lambdas/ai-processor.ts#L22)

- Measured p99 constants the budget rests on, and why they sit on top of the 60s floor.
  [`ai-processor.ts:12`](../../apps/backend/src/lambdas/ai-processor.ts#L12)

- Only poll-and-drain passes the budget; blur off or no Lambda context keeps today's loop.
  [`ai-processor.ts:73`](../../apps/backend/src/lambdas/ai-processor.ts#L73)

**Remaining-time guard in the shared loop**

- New optional options, inert unless both are given, so scraper and ingestor are untouched.
  [`poll-and-drain-queue.ts:67`](../../apps/backend/src/lib/aws/poll-and-drain-queue.ts#L67)

- The guard itself: warns with remaining, minimum, handled and left-in-flight, then stops.
  [`poll-and-drain-queue.ts:95`](../../apps/backend/src/lib/aws/poll-and-drain-queue.ts#L95)

- Checked before every receive and before every message, a batch's first included.
  [`poll-and-drain-queue.ts:118`](../../apps/backend/src/lib/aws/poll-and-drain-queue.ts#L118)
  [`poll-and-drain-queue.ts:156`](../../apps/backend/src/lib/aws/poll-and-drain-queue.ts#L156)

**Tests**

- Every edge-case matrix row: mid-batch stop, long-poll eats the time, no receive, options partial.
  [`poll-and-drain-queue.test.ts:272`](../../apps/backend/src/lib/aws/poll-and-drain-queue.test.ts#L272)

- Handler wiring: receive size derives from the env floor; blur off stays unsized.
  [`ai-processor.test.ts:129`](../../apps/backend/src/lambdas/ai-processor.test.ts#L129)
