# Design seed: moderator Apply for re-extract (turn a post into a roundup)

Status: deferred (split from `implementation-artifacts/spec-reextract-read-all-slide-images.md` on 2026-10-31).
Not approved, not frozen: a starting draft for a future `bmad-quick-dev` run, to be re-validated against the code then.
Depends on the slide-image fix landing first (Apply is only reliable once every slide is read).
The slide-image parts of the draft below are now specified in that spec; read them as context only.


## Intent

**Problem:** (1) The re-extract preview of a carousel roundup shows only events from the first image. The job reuses the stored `imageUrl` / `additionalImageUrls`, which are Instagram hotlinks that expire (`posts.image_url_expires_at`); an expired slide is skipped with only a log line, an expired cover drops every slide (text-only), the rescrape branch discards the slides the scraper just returned, the unknown-URL branch and `extractEventDataFromUrl` never pass slides, and only `MAX_CAROUSEL_IMAGES` (5) are sent. (2) Re-extract cannot change anything: ingestion skips every `(post, ordinal)` slot that already holds an event (AD-40 Rule 1), so a post first stored as one event can never become a roundup linked to several.

**Approach:** Make the preview read all slides and say how many it read. Add a moderator-only **Apply** that takes the exact previewed extraction and, in one transaction, rewrites the post's grouping, reuses the events the post already produced (id, slug, favorites, calendar entries, aliases survive) as roundup stubs, and ingests the remaining items as new stub events linked to the same post.

## Boundaries & Constraints

**Always:**
- Moderator only (`requireModerator`); the job is owner-scoped. Preview stays write-free.
- Slides: rescrape when the stored cover or any slide URL is expired or missing (caption rule of AD-40 Rule 5 unchanged: caption only in the job payload, never in `posts`), and send the scraper's `imageUrl` + `additionalImageUrls`. A moderator job sends up to 10 slides (`REEXTRACT_MAX_CAROUSEL_IMAGES`); ingestion's `MAX_CAROUSEL_IMAGES` is unchanged.
- The preview result reports `imagesAvailable` and `imagesSent`; a shortfall is shown as a warning, never silent. A failed cover must not skip the slides.
- Apply uses the previewed payload stored on the job (validated events, no caption), not a new Gemini call; one job applies once (`appliedAt`), within 30 minutes, only for a stored post.
- One decision, two callers: the write branches of `processIngestionJob` (insert / enrich / queue) move into one shared function that Apply also calls; `evaluateIngestionMatch` stays the only decision. `events.postId` and `event_posts` are written only through `insertEventWithPrimaryPost` / `setEventPrimaryPost` / `enrichAndPromoteEvent` (AD-30 Rule 2 ratchet).
- Apply sets `posts.grouping_reason` and `posts.title` from the fresh extraction; every event it touches or creates has `detail_level = 'stub'`. Corrections already applied to an event win over the new values (existing protected-fields mechanism).
- No notifications are sent by Apply.

**Ask First:** Any change to dedup weights/thresholds; raising `MAX_CAROUSEL_IMAGES`; soft-deleting or merging an event; an undo for Apply.

**Never:** Delete or soft-delete an event; touch an event the post did not produce except through the normal match tiers (high links, mid queues a suggestion); persist a caption; expose caption text in any response.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Expired slides | stored post, slide URLs past expiry | rescrape, send fresh cover + all slides (up to 10) | scrape fails: `SCRAPE_FAILED`, no silent text-only |
| Shortfall | 6 slides exist, 4 fetched | preview shows "read 4 of 6 images" warning | N/A |
| Reuse | post has event E; new extraction has an item matching E (score >= mid, among the post's own events) | E keeps id/slug/favorites; takes the item's data, becomes stub, link moved to the new ordinal | protected fields kept |
| New items | extracted items matching no event of the post | ingested as stubs at new ordinals; dedup tier applies (high links an existing event, mid queues a suggestion) | N/A |
| Orphan | post's event E matches no extracted item | untouched, listed in the apply summary | N/A |
| Re-apply | job already applied | returns the stored summary, writes nothing | N/A |
| Stale or foreign | job > 30 min, not owner's, preview failed, post not stored | no writes | `NOT_FOUND` / `EXPIRED` / `NOT_STORED` |


## Code Map

- `apps/backend/src/lib/extraction/start-post-reextraction-preview.ts` -- rescrape on expired/missing images; pass scraped slides (lines 131, 187); unknown-URL branch too.
- `apps/backend/src/schema/resolvers.ts` (`extractEventDataFromUrl`, ~1640) -- same slide pass-through.
- `apps/backend/src/lib/ai-processor/build-gemini-request.ts` -- cover failure must not skip slides; return `imagesAvailable`/`imagesSent`; per-call slide cap.
- `apps/backend/src/lib/ai-processor/process-manual-extraction-job.ts`, `build-reextraction-preview.ts` -- store `extracted` payload and image counts in `result_data`.
- `apps/backend/src/lib/ingestor/process-ingestion-job.ts` -- extract shared write branches.
- `apps/backend/src/lib/extraction/apply-post-reextraction.ts` (new) -- pairing, transaction, summary.
- `apps/backend/src/schema/extraction.graphql`, `resolvers.ts`, `packages/domain/src/posts/types.ts` -- `applyPostReextraction(jobId)`, result types, `REEXTRACT_MAX_CAROUSEL_IMAGES`; domain pairing function (100% covered).
- `apps/web/src/features/moderation/reextract-preview-result.tsx`, `reextract-post-dialog.tsx`, `use-post-reextraction-preview.ts`, `reextract.graphql`, `locales/{en,id}.json` -- image warning, Apply button via `ConfirmActionDialog`, summary.
- Docs: AD-40 amendment (Rule 1 and "Considered and rejected"), `project-context.md`, `docs/infrastructure/7-event-dedup.md`, `_bmad-output/planning-artifacts/diagrams/event-dedup-flow.html`, backlog row.

## Tasks & Acceptance

**Execution:**
- [ ] `start-post-reextraction-preview.ts`, `extractEventDataFromUrl` -- rescrape on expired/missing images, forward scraped slides -- slides were being lost
- [ ] `build-gemini-request.ts` + manual job + preview builder -- slide cap, cover-failure fix, counts in result -- visible, complete image reading
- [ ] `process-ingestion-job.ts` -- extract shared write function, ingestion tests untouched -- one decision, two callers
- [ ] `packages/domain` pairing + `apply-post-reextraction.ts` + GraphQL -- transactional apply, once, owner-scoped -- roundup conversion
- [ ] Web dialog, locales (en + id), docs, diagram, backlog -- moderator UI and records
- [ ] Tests: matrix rows, ordinal swap under the `(post, ordinal)` unique, favorites/slug survive, no notification, row-count ratchet clean

**Acceptance Criteria:**
- Given a stored carousel post with expired image URLs, when a moderator previews, then fresh slides are sent and the result states `imagesSent` of `imagesAvailable`.
- Given a post stored as one event, when a moderator applies a roundup preview, then the original event keeps its id, slug, favorites and calendar entries, new items become linked stub events, and `posts.grouping_reason` is `roundup`.
- Given any non-owner, non-moderator, expired, repeated or failed job, when applying, then nothing is written.

## Spec Change Log

## Design Notes

Ordinals are assigned by earliest date then name (`assignExtractionOrdinals`), so a larger event set shifts them: pairing is by match score against the post's own events, never by ordinal. Move paired links in two steps (null, then set) to respect the `(post, ordinal)` unique. Stub status is derived from `posts.grouping_reason`, which is why Apply writes it first.

## Verification

**Commands:**
- `pnpm --filter backend test`, `pnpm --filter @festgrid/domain test` -- expected: pass, row-count ratchet clean
- `pnpm --filter web test` and `pnpm --filter web exec tsc --noEmit` -- expected: pass
- `uv run --python 3.11 --with pyyaml scripts/backlog-check.py` -- expected: clean
