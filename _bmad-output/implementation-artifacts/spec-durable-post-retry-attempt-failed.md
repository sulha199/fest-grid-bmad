---
title: 'Durable post retry: attempt ledger, resume pass for due posts, ATTEMPT_FAILED status'
type: 'feature'
created: '2026-11-09'
status: 'draft'
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

- `packages/database/schema.ts` and a new migration -- the three `posts` columns.
- `packages/domain/src/posts/extraction-status.ts` -- `POST_EXTRACTION_STATUSES`, `derivePostExtractionStatus`; `apps/backend/src/lib/posts/post-extraction-status.ts` -- SQL twin and `withExtractionStatus`; `post-extraction-status.test.ts` -- the lockstep test.
- `apps/backend/src/schema/extraction.graphql` -- `PostExtractionStatus`, `Post` (reason and next attempt fields); codegen for backend and web.
- `apps/backend/src/lib/ai-processor/process-ai-job.ts` -- failure and success paths; `apps/backend/src/lib/posts/enqueue-post-for-processing.ts` -- the atomic claim; `apps/backend/src/lambdas/ai-processor.ts` -- the tick (resume pass before the drain).
- `apps/web/src/features/posts/ExtractionStatusFilter.tsx`, `apps/web/src/app/[locale]/posts/select/posts-select-content.tsx` and the en/id message files -- filter value, badge, reason and next attempt.

## Tasks & Acceptance

**Execution:**
- [ ] Migration and schema -- add the three columns (drizzle-kit --custom in PowerShell per the migration lessons; check journal order) -- AD-52 Rule 4.
- [ ] `process-ai-job.ts` -- on a failed job write the ledger via `decideRetry` and release the claim; on success clear it -- Rules 3-4.
- [ ] Resume pass in `ai-processor.ts` -- enqueue due posts (bounded per tick) through the atomic claim -- Rule 5.
- [ ] Status rule, SQL twin, GraphQL enum and fields, codegen, web filter and badge (en and id) -- Rule 6.
- [ ] Tests for every I/O row, the lockstep test, and a test that in-call retries count one failed job -- the contract.

**Acceptance Criteria:**
- Given an unparseable response on attempt 1, when the job fails, then the post shows ATTEMPT_FAILED with the reason and a next attempt time, and is re-enqueued by the next tick after that time.
- Given a safety-blocked response, when the job fails, then the post shows ATTEMPT_FAILED as given up and is never re-enqueued.
- Given a post that failed twice and then succeeds, when extraction finishes, then its ledger is cleared and its status is PROMOTED or NOT_EVENT.
- Given the status lockstep test, when it runs, then every status (including ATTEMPT_FAILED) matches in the domain rule and the SQL form.

## Spec Change Log

## Verification

**Commands:**
- `pnpm --filter backend exec tsx --test` on the touched suites and `pnpm --filter @festgrid/domain test` -- expected: all pass
- `pnpm lint`, `pnpm build`, and `pnpm --filter web test` on the filter component -- expected: clean
