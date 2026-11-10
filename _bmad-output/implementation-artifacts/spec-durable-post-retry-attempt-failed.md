---
title: 'Durable post retry: attempt ledger, resume pass for due posts, ATTEMPT_FAILED status'
type: 'feature'
created: '2026-11-09'
status: 'done'
baseline_commit: 'f4984ac2216643e86ae8c30d6ed0b82659b473c5'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A post whose extraction attempt fails (unparseable or blocked response, provider error after the in-call retries) stays EXTRACTING for the claim TTL and then shows PENDING, indistinguishable from a post never tried, and nothing retries it: it only runs again when a moderator selects it or the auto-enqueue picks it up.

**Approach:** Per AD-52 Rules 4-6: a failed job records `extraction_attempts`, `extraction_failure_reason` and `extraction_next_attempt_at` (from `decideRetry`, slice 1b) and releases the claim; the AI Lambda's tick re-enqueues due posts through the existing atomic claim; a derived `ATTEMPT_FAILED` status shows on the moderator extract screen with the reason and next attempt time.

## Boundaries & Constraints

**Always:** Starting values are code constants: 5 attempts, 24 hours from the first failure, never past the image expiry; success clears the ledger; the status rule, its SQL twin, the GraphQL enum and the web filter change together and the existing lockstep test covers every status; a moderator's manual selection resets the attempts to 0; the claim stays atomic (`enqueuePostForProcessing`); the retry pass is bounded per tick and runs before the queue drain.

**Ask First:** Changing the attempt count, window or table; showing the status outside the moderator screen; new translation wording beyond the reason labels.

**Never:** A new queue or Lambda, an `extraction_audit_logs` row for failures, the cursor or stepped extraction (a post with a cursor is governed by AD-47), retrying `blocked` or `bad_request`, changing the PR #180 time-budget guard, prod writes.

## I/O & Edge-Case Matrix

| Scenario | State | Outcome | Error Handling |
|----------|-------|---------|----------------|
| Failure, retry allowed | attempt 2 of 5, reason `unavailable` | ledger written, claim released, status ATTEMPT_FAILED with next attempt time | N/A |
| Failure, deterministic | reason `blocked` | `extraction_next_attempt_at` null, status ATTEMPT_FAILED "given up" | reason shown |
| Attempts or window spent | attempt 5, or 24h passed | next attempt null, given up | N/A |
| Due post on the tick | next attempt in the past, attempts left, not extracted | re-enqueued through the atomic claim; status QUEUED then EXTRACTING | a lost claim race is skipped |
| Success after a failure | attempt succeeds | ledger cleared; PROMOTED or NOT_EVENT | N/A |
| Manual select of a failed post | any attempts | attempts reset to 0, normal path | N/A |

</frozen-after-approval>

## Code Map

- `packages/database/schema.ts` and migration 0093 -- the four `posts` columns (the three in the intent plus `extraction_first_failure_at`, which anchors the 24 hour window) and a partial index on `extraction_next_attempt_at`.
- `apps/infrastructure/lib/festgrid-backend-stack.ts` -- the AI Lambda gains `aiProcessingQueue.grantSendMessages` (it re-enqueues to its own queue); the stack's queue-env-var-to-grant walker covers it.
- `packages/domain/src/posts/extraction-status.ts` -- `POST_EXTRACTION_STATUSES`, `derivePostExtractionStatus`; `apps/backend/src/lib/posts/post-extraction-status.ts` -- SQL twin and `withExtractionStatus`; `post-extraction-status.test.ts` -- the lockstep test.
- `apps/backend/src/schema/extraction.graphql` -- `PostExtractionStatus`, `Post` (reason and next attempt fields); codegen for backend and web.
- `apps/backend/src/lib/ai-processor/process-ai-job.ts` -- failure and success paths; `apps/backend/src/lib/posts/enqueue-post-for-processing.ts` -- the atomic claim; `apps/backend/src/lambdas/ai-processor.ts` -- the tick (resume pass before the drain).
- `apps/web/src/features/posts/ExtractionStatusFilter.tsx`, `apps/web/src/app/[locale]/posts/select/posts-select-content.tsx` and the en/id message files -- filter value, badge, reason and next attempt.

## Tasks & Acceptance

**Execution:**
- [x] Migration and schema -- add the three columns (drizzle-kit --custom in PowerShell per the migration lessons; check journal order) -- AD-52 Rule 4.
- [x] `process-ai-job.ts` -- on a failed job write the ledger via `decideRetry` and release the claim; on success clear it -- Rules 3-4.
- [x] Resume pass in `ai-processor.ts` -- enqueue due posts (bounded per tick) through the atomic claim -- Rule 5.
- [x] Status rule, SQL twin, GraphQL enum and fields, codegen, web filter and badge (en and id) -- Rule 6.
- [x] Tests for every I/O row, the lockstep test, and a test that in-call retries count one failed job -- the contract.

**Acceptance Criteria:**
- Given an unparseable response on attempt 1, when the job fails, then the post shows ATTEMPT_FAILED with the reason and a next attempt time, and is re-enqueued by the next tick after that time.
- Given a safety-blocked response, when the job fails, then the post shows ATTEMPT_FAILED as given up and is never re-enqueued.
- Given a post that failed twice and then succeeds, when extraction finishes, then its ledger is cleared and its status is PROMOTED or NOT_EVENT.
- Given the status lockstep test, when it runs, then every status (including ATTEMPT_FAILED) matches in the domain rule and the SQL form.

## Spec Change Log

- 2026-11-10 (planning, before implementation): the frozen intent says a failed job "records three columns"; the code needs a fourth, `extraction_first_failure_at`, for the 24 hour window. The AI Lambda had no permission to send to its own queue, so the resume pass needs a one-line IAM grant. No frozen text was changed.

## Verification

**Commands:**
- `pnpm --filter backend exec tsx --test` on the touched suites and `pnpm --filter @festgrid/domain test` -- expected: all pass
- `pnpm lint`, `pnpm build`, and `pnpm --filter web test` on the filter component -- expected: clean

## Design Notes

- **Who owns the retry now.** A failure of the Gemini stage (an error, an unparseable or schema-invalid response) is recorded on the post and the job returns normally, so the queue no longer re-runs Gemini three times and then dead-letters; the resume pass owns the retry. When nothing can be recorded (an unknown post, an already extracted one) the error propagates as before. Errors after the Gemini stage (database, enqueue) still throw.
- **Waits** (`planExtractionFailure`): the larger of the policy's delay and 5 min, 15 min, 1 h, 4 h by attempt; at most 5 attempts; the next attempt must fall inside 24 hours of the first failure (a per-day quota is the exception and waits for its reset). Failures that waiting cannot fix (blocked, bad request, invalid credential, truncated until the split slice, image expired until the re-scrape slice) are not retried.
- **Watchdog.** When the resume pass enqueues a retry it moves `extraction_next_attempt_at` past the claim TTL. A retry that dies without recording anything is found again, counted as a `timeout` failure, and rescheduled or given up, so no chain is unbounded without a second counter.
- **Manual selection** resets the ledger and takes the claim in one update; the status filter and the select screen treat ATTEMPT_FAILED like PENDING for selection.
- **Review fixes applied:** a guarded (optimistic) write on the attempts counter; the watchdog is armed before the send and only if the due time is unchanged; a post that fails to enqueue is counted and pushed back so it cannot starve the pass; the 24 hour window holds from the first failure (a per-day quota is exempt); the status fact `extractionFailureReason` is required; the select screen's pending count includes failed posts.
- **Known gaps, not in this slice:** a first-ever attempt that dies without recording anything (a hard Lambda timeout) still returns to PENDING after the claim TTL and is not retried automatically; errors thrown before the Gemini stage or after the parse stage still go through the queue's own retries; a job that outlives the 30 minute claim could release a newer job's claim (never seen: jobs run under 2 minutes).
- The PRD (3.10 status list and the `extractionStatus` type) and the GraphQL `PostExtractionStatus` enum were updated with the new status.

## Suggested Review Order

**The plan**

- Pure rule: attempt count, backoff, 24 hour window, which failures are never retried.
  [`extraction-retry.ts:43`](../../packages/domain/src/posts/extraction-retry.ts#L43)

- The derived status: a recorded failure with no live claim is ATTEMPT_FAILED.
  [`extraction-status.ts:55`](../../packages/domain/src/posts/extraction-status.ts#L55)

**Recording a failure**

- Guarded write of the ledger and release of the claim.
  [`extraction-ledger.ts:27`](../../apps/backend/src/lib/posts/extraction-ledger.ts#L27)

- The job records a failed Gemini stage and returns; the resume pass owns the retry.
  [`process-ai-job.ts:149`](../../apps/backend/src/lib/ai-processor/process-ai-job.ts#L149)

**Retrying**

- The resume pass: due posts, watchdog before the send, starvation guard.
  [`resume-due-extractions.ts:32`](../../apps/backend/src/lib/posts/resume-due-extractions.ts#L32)

- It runs first on every tick and never blocks the drain.
  [`ai-processor.ts:66`](../../apps/backend/src/lambdas/ai-processor.ts#L66)

- Manual selection resets the ledger.
  [`enqueue-post-for-processing.ts:24`](../../apps/backend/src/lib/posts/enqueue-post-for-processing.ts#L24)

**Data, API, infra and screen**

- Migration 0093: four columns and a partial index.
  [`0093_posts_extraction_attempt_ledger.sql:1`](../../packages/database/migrations/0093_posts_extraction_attempt_ledger.sql#L1)

- SQL twin of the status rule.
  [`post-extraction-status.ts:32`](../../apps/backend/src/lib/posts/post-extraction-status.ts#L32)

- The AI Lambda may send to its own queue.
  [`festgrid-backend-stack.ts:738`](../../apps/infrastructure/lib/festgrid-backend-stack.ts#L738)

- Reason and next retry on the card; failed posts stay selectable.
  [`posts-select-content.tsx:144`](../../apps/web/src/app/[locale]/posts/select/posts-select-content.tsx#L144)
