---
title: 'Cursor extraction slice 5: the step handler and the chain start'
type: 'feature'
created: '2026-11-10'
status: 'done'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Roundup posts with more images than the first request reads lose most of their events (post `DfLcqoqj-al`: 8 of about 200).

**Approach:** Slice 5 of `_bmad-output/specs/spec-cursor-extraction/build-slices.md`: with `CURSOR_EXTRACTION_ENABLED` on, the first request of a post with unread slides decides in code (AD-46, `decideNextStep`) whether to start a chain; a chain is a persisted cursor plus one queue message per step. A step takes the lease, reads its window, asks Gemini (splitting an at-risk answer in half, down to one slide), dedupes, reserves an ordinal range before enqueueing, commits the cursor and either enqueues the next step or ends the chain atomically. With the flag off (the default) nothing changes.

## Boundaries & Constraints

**Always:** Ships dark (flag default off; a step with the flag off ends its chain partial); every cursor write is a compare-and-set (slice 3); the caption comes from `posts.content` in memory and never rides in a message or the cursor; requests are counted before each call and bounded (AD-51); the first request keeps today's read window; a curator caption is nulled only after the chain really ended.

**Ask First:** Turning the flag on anywhere; splitting a first request that is cut off (not done here: it is flagged partial).

**Never:** The resume pass or the re-scrape (slice 6), moderator guards or UI (slice 7), changes to the one-request path when the flag is off.

## Tasks & Acceptance

- [x] `extraction-chain.ts` (step message, queue send with a 10 s delay, first cursor), `process-extraction-step.ts` (the step), the first-request chain start and the per-call event cap in `process-ai-job.ts`, the builder's unread slides, `cursorExtractionEnabled`, an SQS delay option.
- [x] 16 tests in `process-ai-job.cursor.test.ts` against a real database: chain start, flag off, new events with ordinals from the cursor, last step, stale and duplicate messages, kill switch, request bound, split and retry, lineup follow-up, partial flags, missing slide, redelivery.

**Acceptance Criteria:**
- Given a roundup whose first window leaves slides unread and the flag on, then the post is not marked extracted, a cursor is stored and a step message without a caption is enqueued; with the flag off it finishes as before.
- Given a step message, when it runs twice or with a stale lease, then events are ingested once and nothing else changes.
- Given an at-risk answer, then the window is split, each request is counted, and a half that cannot run keeps the half that finished and ends the chain partial.

## Spec Change Log

## Design Notes

Review fixes: events of a half that finished are kept; a slide that could not be downloaded makes the chain partial; the first-request dedupe keys come from the model's events like the steps' do; the chain ends before the curator caption is nulled; a redelivered first request re-enqueues the stored step; the partial flag is written before the post is marked extracted; a stale cursor on an extracted post is cleared.

Known gaps (by design, for the next slices): a step that fails after taking the lease is logged and dropped, leaving the cursor for the resume pass (slice 6); a crash between the ordinal reservation and the commit can ingest a replayed event twice under new ordinals (the matching pipeline merges duplicates; a lost event could not be recovered); a first request cut off by the token limit is not split, the chain just flags the post partial.
