---
title: 'CC-024 Wave 3 batch-end gate: backend test fixture fixes'
type: 'bugfix'
created: '2026-10-02'
status: 'done'
review_loop_iteration: 0
context: []
route: 'one-shot'
---

## Intent

**Problem:** The CC-024 Wave 3 batch-end gate found 30 failing `apps/backend` tests. 19 fail because Story 3.6r's migration 0065 added a CHECK constraint (`events_post_id_extraction_ordinal_check`) requiring any `events` row with a `postId` to carry a non-null `extractionOrdinal`, but several older test fixtures insert events with a `postId` and no `extractionOrdinal`. The remaining 7 (across `ai-processor.test.ts` and `extraction.test.ts`) fail because Story 3.6s changed the Gemini extraction contract from a flat per-post shape to a post-level `{ isEvent, events: [...] }` shape, and these test files' Gemini stubs still return the old flat shape, so AJV schema validation rejects them. 4 further failures in `system-key-adapter.test.ts` are a known, already-tracked issue (FIND-063) unrelated to this gate and are explicitly out of scope.

**Approach:** Add `extractionOrdinal: 0` to the event-insert fixtures that violate the new CHECK constraint, and update the Gemini stub payloads in the two affected files to the new `{ isEvent, events: [...] }` contract shape. Test-only change; no production code touched.

## Code Map

- `apps/backend/src/schema/resolvers.test.ts` -- 7 event-insert fixtures across 5 describe blocks (`Event.sourceSocialMediaAccountProfile`, `Event.publishedAt`, `Event image serving and consent gates`, `Event.instagramEmbed`, `Query.instagramEmbedBySlug`) missing `extractionOrdinal`
- `apps/backend/src/schema/subscriptions.test.ts` -- 2 event-insert fixtures missing `extractionOrdinal`
- `apps/backend/src/schema/extraction.test.ts` -- 3 Gemini stubs using the pre-3.6s flat response shape
- `apps/backend/src/lambdas/ai-processor.test.ts` -- 1 Gemini stub using the pre-3.6s flat response shape

## Tasks & Acceptance

**Execution:**
- [x] `apps/backend/src/schema/resolvers.test.ts` -- add `extractionOrdinal: 0` to the 7 `events` inserts that also set `postId` -- satisfies the migration-0065 CHECK constraint
- [x] `apps/backend/src/schema/subscriptions.test.ts` -- add `extractionOrdinal: 0` to the 2 `events` inserts that also set `postId` -- satisfies the migration-0065 CHECK constraint
- [x] `apps/backend/src/schema/extraction.test.ts` -- nest `eventName`/`types`/`categories`/`confidenceScore`/`schedules` under a top-level `events: [...]` array in all 3 Gemini stubs -- matches the Story 3.6s `GeminiExtractionPayload` AJV schema
- [x] `apps/backend/src/lambdas/ai-processor.test.ts` -- replace the flat `isEvent: false` stub with `{ isEvent: false, events: [] }` -- matches the Story 3.6s contract

**Acceptance Criteria:**
- Given the fixed fixtures, when `extraction.test.ts`, `ai-processor.test.ts`, `resolvers.test.ts`, and `subscriptions.test.ts` are run individually via `npx tsx --test`, then all previously-failing tests in each file pass and no other test in that file regresses.
- Given `system-key-adapter.test.ts`'s FIND-063 failures, when this fix is applied, then those 4 failures are left untouched and still fail for their existing, unrelated reason.

## Design Notes

Confirmed via `apps/backend/src/validation/extracted-event.schema.ts` that the AJV schema only requires `isEvent` and `events` at the top level, and `eventName`/`types`/`categories`/`schedules`/`confidenceScore` per-event inside `events[]`; `groupingReason`/`groupingRationale`/`skippedItems` are optional and omitted from these minimal stubs since no test here asserts on them. The migration-0065 CHECK constraint is satisfied by any non-null `extractionOrdinal`, so `0` was chosen as the simplest valid value for fixtures that don't exercise multi-event ordinal ordering.

## Verification

**Commands:**
- `cd apps/backend && TZ=UTC npx tsx --test --test-concurrency=1 src/schema/extraction.test.ts` -- expected: 18/18 pass
- `cd apps/backend && TZ=UTC npx tsx --test --test-concurrency=1 src/lambdas/ai-processor.test.ts` -- expected: 3/3 pass
- `cd apps/backend && TZ=UTC npx tsx --test --test-concurrency=1 src/schema/resolvers.test.ts` -- expected: 82/86 pass (4 remaining failures are a pre-existing, unrelated `temporalFilter TODAY/UPCOMING` date-boundary flake, not part of this fix's scope -- see Suggested Review Order)
- `cd apps/backend && TZ=UTC npx tsx --test --test-concurrency=1 src/schema/subscriptions.test.ts` -- expected: 25/25 pass

## Suggested Review Order

**Migration 0065 CHECK-constraint fixtures**

- Entry point: two event inserts needing `extractionOrdinal` added to satisfy the new CHECK constraint.
  [`resolvers.test.ts:1780`](../../apps/backend/src/schema/resolvers.test.ts#L1780)

- Same fix repeated across 3 more consent/image-serving fixtures in the same describe family.
  [`resolvers.test.ts:2032`](../../apps/backend/src/schema/resolvers.test.ts#L2032)

- Same fix for the Instagram-embed resolver fixtures.
  [`resolvers.test.ts:2237`](../../apps/backend/src/schema/resolvers.test.ts#L2237)

- Same fix for the by-slug Instagram-embed fixture.
  [`resolvers.test.ts:2425`](../../apps/backend/src/schema/resolvers.test.ts#L2425)

- Same fix applied to the two subscription-filter fixtures in a different file.
  [`subscriptions.test.ts:563`](../../apps/backend/src/schema/subscriptions.test.ts#L563)

**Story 3.6s Gemini contract shape**

- Flat-to-nested stub migration for the existing-post extraction path.
  [`extraction.test.ts:155`](../../apps/backend/src/schema/extraction.test.ts#L155)

- Same migration for the new-post scrape-and-extract path.
  [`extraction.test.ts:249`](../../apps/backend/src/schema/extraction.test.ts#L249)

- Same migration for the `isEvent: false` rejection path (empty `events` array).
  [`extraction.test.ts:306`](../../apps/backend/src/schema/extraction.test.ts#L306)

- Same `isEvent: false` migration in the poll-and-drain lambda test.
  [`ai-processor.test.ts:77`](../../apps/backend/src/lambdas/ai-processor.test.ts#L77)
