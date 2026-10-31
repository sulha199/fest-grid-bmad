---
title: 'Moderator Apply for re-extract: turn a post into a roundup'
type: 'feature'
created: '2026-10-31'
status: 'in-review'
baseline_commit: '102eb47a92f5401d89896c497384e0496857749d'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-moderator-reextract-post-preview.md'
  - '{project-root}/_bmad-output/specs/reextract-apply-roundup/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Re-extract is preview-only (AD-40 Rule 1). A post first stored as one event can never become a roundup linked to several: ingestion skips every `(post, ordinal)` slot that already holds an event, so a moderator can see the right result and cannot apply it.

**Approach:** A moderator-only **Apply** that takes the exact previewed extraction and, in one transaction, rewrites the post's grouping, reuses the events the post already produced (id, slug, favorites, calendar entries, aliases survive) as roundup stubs, and ingests the remaining items as new stub events linked to the same post.

## Boundaries & Constraints

**Always:**
- `requireModerator`; the job is owner-scoped. Apply uses the payload the preview stored on its job (`extracted`: validated events, grouping, post title; never the caption), not a new Gemini call. It applies once (`appliedAt`), within 30 minutes, only for a stored post whose preview succeeded; `extracted` is nulled when applied.
- One decision, two callers: the write branches of `processIngestionJob` (insert, enrich, queue a mid match) move into one shared function Apply also calls; `evaluateIngestionMatch` stays the only decision. Messages are built as `processAiJob` builds them (account/location resolution, timezones, `transformGeminiResponseToEventInfo`), shared, not copied.
- `events.postId` / `event_posts` are written only through `insertEventWithPrimaryPost`, `setEventPrimaryPost`, `enrichAndPromoteEvent` (AD-30 Rule 2 ratchet). Both `events` and `event_posts` are unique on `(post, extraction_ordinal)`: move a paired event's ordinal in two steps (null, then set).
- Apply writes `posts.grouping_reason` and `posts.title` from the fresh extraction; every event it touches or creates gets `detail_level = 'stub'`. Fields named by an applied correction keep their value (protected fields).
- Pair the post's existing events to extracted items by match score (>= mid, among that post's own events), never by ordinal: ordinals sort by earliest date then name, so a larger set shifts them.
- No notifications. Domain pairing logic in `packages/domain`, 100% covered.

**Ask First:** Any change to dedup weights or thresholds; soft-deleting or merging an event; an undo for Apply (none is built; a journal line records before/after ids).

**Never:** Delete an event; touch an event the post did not produce except through the normal match tiers (high links, mid queues a suggestion); persist a caption; expose caption text in a response.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Reuse | post has event E; an item matches E | E keeps id/slug/favorites; takes the item's data, becomes stub, moves to the item's ordinal | protected fields kept |
| New items | items matching no event of the post | stub events at new ordinals; tier applies (high links, mid queues) | N/A |
| Orphan | E matches no item | untouched, listed in the summary | N/A |
| Re-apply | job already applied | returns the stored summary, writes nothing | N/A |
| Not applicable | job > 30 min, not the caller's, preview failed, post not stored | no writes | `NOT_FOUND` / `EXPIRED` / `NOT_STORED` |
| Failure mid-way | any error after the first write | whole transaction rolls back | `APPLY_FAILED` |

</frozen-after-approval>

## Code Map

- `apps/backend/src/lib/ai-processor/process-manual-extraction-job.ts`, `build-reextraction-preview.ts` -- store `extracted` on the preview job.
- `apps/backend/src/lib/ingestor/process-ingestion-job.ts` -- extract the shared write function.
- `apps/backend/src/lib/ai-processor/process-ai-job.ts` -- extract the shared message builder (lines ~230-300).
- `apps/backend/src/lib/events/set-event-primary-post.ts` -- `setEventPrimaryPost`, `enrichAndPromoteEvent` (reused).
- `apps/backend/src/lib/extraction/apply-post-reextraction.ts` (new) -- pairing, transaction, summary, journal line.
- `packages/domain/src/posts/` (or `events/`) -- pairing function, apply result types.
- `apps/backend/src/schema/extraction.graphql`, `resolvers.ts` -- `applyPostReextraction(jobId)`.
- `apps/web/src/features/moderation/{reextract-post-dialog.tsx,use-post-reextraction-preview.ts,reextract.graphql}`, `locales/{en,id}.json` -- Apply button via `ConfirmActionDialog`, summary.
- Docs: AD-40 amendment (Rule 1, "Considered and rejected"), `project-context.md`, `docs/infrastructure/7-event-dedup.md`, `_bmad-output/planning-artifacts/diagrams/event-dedup-flow.html`, backlog.

## Tasks & Acceptance

**Execution:**
- [x] `process-ingestion-job.ts`, `process-ai-job.ts` -- extract shared write function and message builder, existing tests untouched -- one decision, two callers
- [x] preview job -- store `extracted`; `apply-post-reextraction.ts` + domain pairing -- transactional, once-only apply
- [x] GraphQL, resolver, web dialog, locales (en, id) -- moderator UI
- [x] AD-40 amendment, runbook, diagram, project-context, PRD 3.9.3 amendment (the PRD does not mention re-extract at all), backlog -- records
- [x] Tests: matrix rows, ordinal swap under both uniques, favorites/slug survive, no notification, row-count ratchet clean

**Acceptance Criteria:**
- Given a post stored as one event, when a moderator applies a roundup preview, then the original event keeps its id, slug, favorites and calendar entries, new items become linked stub events, and `posts.grouping_reason` is `roundup`.
- Given any non-owner, non-moderator, expired, repeated or failed job, when applying, then nothing is written.

## Spec Change Log

## Design Notes

Database constraint found while building (deviation from the frozen "null, then set" wording, same intent): `events` has a CHECK that a non-null `post_id` needs a non-null `extraction_ordinal`, so a moving event is parked at a distinct temporary ordinal (`PARKED_ORDINAL_BASE + n`, 30000+) rather than `NULL`, then set to its real one. Also: a reused event keeps its slug when it moves, so a NEW item is never given an ordinal whose derived slug (`ig_p_X`, `ig_p_X~n`) a reused event already holds (`events.slug` is unique).

PRD constraints found while building (3.7 "No Duplicate Re-Extraction", "Roundup Posts", 3.16), applied inside the frozen Boundaries, not changing them: (1) a re-run never recreates an event a moderator soft-deleted: ordinals held by soft-deleted or merged events of the post stay reserved (new ordinals start above the post's maximum), those events are never paired, and an item that matches one of them is skipped, not recreated; (2) an event is demoted to `stub` only when this post is its **primary** post (`events.post_id`), since a stub means "the roundup post is all we have"; an event whose primary post is the organizer's keeps its detail level and only gains this post's ordinal link; (3) roundup items without a readable date and location are already skipped by the extraction prompt, so Apply needs no filter of its own.

Stub status is derived from `posts.grouping_reason` plus `events.detail_level`, which is why Apply writes both. Reusing `enrichAndPromoteEvent` with the same post keeps slug aliasing and protected-field handling in the one place that already owns them.

## Verification

**Commands:**
- `pnpm --filter backend test`, `pnpm --filter @festgrid/domain test` -- expected: pass, row-count ratchet clean
- `pnpm --filter web test` and `pnpm --filter web exec tsc --noEmit` -- expected: pass
- `uv run --python 3.11 --with pyyaml scripts/backlog-check.py` -- no new failures
