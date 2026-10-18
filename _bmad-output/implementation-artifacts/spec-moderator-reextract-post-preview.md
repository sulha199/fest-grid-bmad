---
title: 'Moderator re-extract post preview'
type: 'feature'
created: '2026-10-18'
status: 'in-review'
review_loop_iteration: 0
baseline_commit: 'c9ea9497819c7c475d5322bca48f0380402f1eb3'
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/festgrid-architecture-spine.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** When extraction or dedup produces a wrong result for a post (GembiRun Loka: the contest post got a wrong date and an unsplit event), a moderator can only hand-edit the event. There is no way to see what the *current* extraction and dedup logic would do with that post, and no way to re-fetch a post whose caption is not stored.

**Approach:** A moderator-only, **preview-only** "Re-extract" that runs the existing manual-extraction job on a post, then evaluates each extracted event through the real ingestion decision (stub rule, organizer discount, `findMatchingEvent`) in a dry run and shows grouping, events and dedup outcome. It writes nothing to `events`, `schedules`, `event_posts` or `posts`.

## Boundaries & Constraints

**Always:**
- `requireModerator` on every new resolver. The job stays owner-scoped (`requestedByUserId`).
- Reuse, don't copy: the ingestion decision is extracted from `processIngestionJob` into one shared `evaluateIngestionMatch(tx, message)` and called by both ingestion and preview. Ingestion behavior must not change (existing tests pass untouched).
- Rescrape (`getScraperAdapter(platform).getPostByUrl`) only when `posts.content` is empty. The rescraped caption is held **only** in the job's `request_payload`, never written to `posts.content`.
- Privacy: (1) `request_payload.message.content` is blanked in a `finally` when the job ends, success or failure, for **every** manual job; (2) a rescraped caption is never persisted to `posts`; (3) non-curator posts keep their stored `content` untouched.
- Rescrape cooldown per post URL (10 min), checked against recent `manual_extraction_jobs` rows. No DDL.
- Preview uses no geocoder or timezone calls. The venue signal is the location string only.

**Ask First:** Any change to `findMatchingEvent` weights, thresholds or windows (spine amendment). Adding an apply/write step.

**Never:** Writing events/schedules/posts from the preview. Calling `selectPostsForExtraction` or the ingestion queue. Exposing post caption text in any response.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Stored post | moderator, post with content | job runs; preview lists grouping reason + events, each with tier, score, candidate slug | N/A |
| Empty content | post row, `content` null | rescrape, extract, payload blanked after | scrape fails → `SCRAPE_FAILED`, no job started |
| Cooldown | same URL rescraped < 10 min ago | no scrape | `RATE_LIMITED` with minutes left |
| URL not in DB | moderator, new post URL | scrape, extract, dedup with no account signal; `postStored: false` | unsupported platform / `NO_API_KEY` as today |
| Not a moderator | any other user | N/A | `FORBIDDEN` |
| Job fails | Gemini error | job `FAILED`, payload content blanked | existing error codes |

</frozen-after-approval>

## Code Map

- `apps/backend/src/lib/ingestor/process-ingestion-job.ts` -- extract `evaluateIngestionMatch` (stub, organizer discount, `findMatchingEvent`).
- `apps/backend/src/lib/ai-processor/process-manual-extraction-job.ts` -- add `mode: 'REEXTRACT_PREVIEW'` branch; blank payload in `finally`.
- `apps/backend/src/lib/ai-processor/build-reextraction-preview.ts` (new) -- payload -> messages (`transformGeminiResponseToEventInfo`, empty resolutions) -> preview rows.
- `apps/backend/src/lib/extraction/manual-extraction-job.ts` -- start/read preview jobs; cooldown helper.
- `apps/backend/src/schema/extraction.graphql`, `resolvers.ts` -- `previewPostReextraction(postId, url)` mutation, `postReextractionPreview(id)` query.
- `packages/domain/src/posts/types.ts` -- `mode` on `ManualExtractionRequestPayload`; preview result type.
- `apps/web/src/features/events/EventDetailWrapper.tsx` -- moderator-only source-post panel (not gated by `sourcePosts.length > 1`).
- `apps/web/src/app/[locale]/moderator/tools/` -- new "Re-extract" tab (`tabEnum`, content, hooks, graphql).
- `apps/web/locales/en.json`, `id.json` -- strings. `locales.test.ts` guards key parity.

## Tasks & Acceptance

**Execution:**
- [x] `process-ingestion-job.ts` -- extract `evaluateIngestionMatch`, reuse in ingestion -- one source of truth for the dedup decision
- [x] `build-reextraction-preview.ts` + `process-manual-extraction-job.ts` -- preview branch, `finally` payload blanking -- privacy invariants
- [x] `manual-extraction-job.ts`, `extraction.graphql`, `resolvers.ts` -- mutation, query, rescrape, cooldown, moderator gate
- [x] `EventDetailWrapper.tsx` + preview dialog, moderator Tools tab, locales -- the two UI placements
- [x] Tests: matrix rows, blanking on success and failure, no `posts`/`events` writes, cooldown, ingestion regression
- [x] Docs: AD-36 in the spine, `project-context.md`, `docs/infrastructure/7-event-dedup.md` "Re-extract preview", backlog row; `architecture-diagram.md` unchanged (no service, queue, Lambda or library added)

**Acceptance Criteria:**
- Given a moderator and a stored post, when previewing, then the response lists each extracted event with its dedup tier and candidate slug, and row counts of `events`, `schedules`, `event_posts` and `posts` are unchanged.
- Given any manual job that ends, when read from the DB, then `request_payload.message.content` is empty.
- Given a post with null content, when previewing, then `posts.content` is still null afterwards.
- Given a non-moderator, when calling either operation, then `FORBIDDEN`.

## Spec Change Log

## Design Notes

Rescraped text lives only in the job payload, so "purge after rescrape" is satisfied by construction: there is nothing written to `posts` to purge. Blanking the payload closes the one remaining copy. Applying a result stays out of scope because ingestion idempotency on `(post, extraction_ordinal)` makes a re-run skip every already-represented item.

## Verification

**Commands:**
- `pnpm --filter backend test` -- expected: pass, including ingestion regression
- `pnpm --filter web test` and `pnpm --filter web exec tsc --noEmit` -- expected: pass
- `python3 scripts/backlog-check.py` -- expected: no new failures
