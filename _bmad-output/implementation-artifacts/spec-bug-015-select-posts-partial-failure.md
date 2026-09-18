---
title: 'BUG-015: selectPostsForExtraction partial-failure tracking'
type: 'bugfix'
created: '2026-09-18T00:00:00Z'
status: 'draft'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `selectPostsForExtraction`'s enqueue loop (`apps/backend/src/schema/resolvers.ts`) awaits `enqueuePostForProcessing` sequentially and lets a single mid-loop error abort the whole request, discarding already-enqueued sends with no partial-success tracking. This was a theoretical risk until the sibling IAM-grant fix made sends actually succeed — now a real failure mid-batch silently drops successful enqueues from the response while the SQS messages have already gone out.

**Approach:** Replace the sequential `for` loop with `Promise.allSettled`, return `Post`s only for the postIds that succeeded, and log each rejection with `{postId, error}`. Preserve the existing top-level GraphQLError mapping (`PostAlreadyExtractedError`/`PostNotFoundError`) when zero postIds succeed, so the two pre-loop-and-first-error tests keep passing unmodified.

## Boundaries & Constraints

**Always:**
- Preserve existing test behavior: `extraction.test.ts`'s `selectPostsForExtraction successfully enqueues posts` and `selectPostsForExtraction throws FORBIDDEN if user is not subscribed to post account` tests must keep passing unmodified.
- Preserve the pre-enqueue checks (quota, not-found, FORBIDDEN) exactly as-is — this fix only touches the enqueue loop itself (`resolvers.ts` lines ~1988–2000).
- Do NOT change `selectPostsForExtraction`'s GraphQL return type (`[Post!]!`) — no schema change.

**Ask First:** none identified.

**Never:**
- Do NOT touch FIND-020, FIND-017, or IDEA-015 — deferred separately (see `deferred-work.md`, "Deferred from: bmad-quick-dev BUG-015,FIND-020 intent").
- Do NOT add a richer per-item result type (e.g. a union/error-list GraphQL type) — accepted tradeoff, see Design Notes.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Partial failure | 3 postIds, 2nd `enqueuePostForProcessing` throws | Returns Posts for the 2 that succeeded; failure logged with `{postId, error}` | N/A |
| Total failure | All postIds' `enqueuePostForProcessing` calls throw | Throws the same GraphQLError mapping as before (first rejection's error, `PostAlreadyExtractedError`→`BAD_REQUEST`, `PostNotFoundError`→`NOT_FOUND`, else rethrown) | GraphQLError per existing mapping |
| All succeed (existing) | All postIds enqueue successfully | Returns Posts for all postIds (unchanged) | N/A |

</frozen-after-approval>

## Code Map

- `apps/backend/src/schema/resolvers.ts:1988-2000` -- `selectPostsForExtraction`'s sequential enqueue loop; rework to `Promise.allSettled`, filter the final `db.select` to succeeded postIds.
- `apps/backend/src/schema/extraction.test.ts:664-686` -- existing "successfully enqueues posts" test (must stay green); add new partial-failure test near it.
- `apps/backend/src/lib/posts/enqueue-post-for-processing.ts` -- unchanged; throws `PostNotFoundError`/`PostAlreadyExtractedError` or a generic `Error`, reference for the error-mapping this fix preserves.

## Tasks & Acceptance

**Execution:**
- [ ] `apps/backend/src/schema/resolvers.ts` -- replace the `for (const postId of postIds) { await enqueuePostForProcessing(postId); }` loop with `Promise.allSettled(postIds.map(id => enqueuePostForProcessing(id).then(() => id)))`; collect fulfilled postIds as `succeededIds`; for each rejected result, `console.error('Failed to enqueue post for extraction', { postId, error: result.reason })` (recover the failing postId by zipping settlement results back against the original `postIds` array by index); if `succeededIds.length === 0`, re-throw using the existing mapping logic against the first rejection's reason (`PostAlreadyExtractedError`→`BAD_REQUEST`, `PostNotFoundError`→`NOT_FOUND`, else rethrow as-is); otherwise change the final `db.select().from(posts).where(inArray(posts.id, postIds))` to filter on `succeededIds` instead of `postIds` -- fixes BUG-015's live partial-failure risk without a schema change.
- [ ] `apps/backend/src/schema/extraction.test.ts` -- add a test: create 3 posts (2 normal + 1 pre-marked `isExtracted: true` so its `enqueuePostForProcessing` call throws `PostAlreadyExtractedError`), call `selectPostsForExtraction` with all 3 postIds, assert the response returns exactly the 2 non-extracted posts' ids and includes no error -- pins the new partial-success contract using a real, already-available failure trigger (no mocking needed).

**Acceptance Criteria:**
- Given 3 postIds where the 2nd is already extracted (so its enqueue throws `PostAlreadyExtractedError`), when `selectPostsForExtraction` runs, then it returns Posts for the other 2 postIds and logs the 2nd's failure, without discarding the already-enqueued sends for the other 2.
- Given all postIds fail to enqueue, when `selectPostsForExtraction` runs, then it throws the same GraphQLError mapping as before.

## Design Notes

**Return-shape tradeoff:** since `[Post!]!` can't carry per-item error detail without a breaking schema change, the client's only signal of partial failure is a shorter-than-requested array plus server-side logs. This is accepted as the minimal fix; a richer per-item result type is a separate, larger change, out of scope here.

**Failure-trigger choice for the test:** rather than mocking `enqueuePostForProcessing`, the new test triggers a real failure by pre-marking one post `isExtracted: true`, since `enqueuePostForProcessing` already throws `PostAlreadyExtractedError` for that state — keeps the test a true integration test consistent with the existing two in this file.

## Verification

**Commands:**
- `pnpm --filter backend test extraction.test.ts` -- expected: all pass including the new partial-failure case
