---
title: 'Re-extract reads every slide of a carousel post'
type: 'bugfix'
created: '2026-10-31'
status: 'draft'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-moderator-reextract-post-preview.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The re-extract preview of a carousel roundup shows only events from the first image. The job reuses the stored `imageUrl` / `additionalImageUrls`, Instagram hotlinks that expire (`posts.image_url_expires_at`). An expired slide is skipped with only a log line; an expired cover sends the request text-only and the slides are never tried; the rescrape branch discards the slides the scraper just returned; the unknown-URL branch and `extractEventDataFromUrl` never pass slides; and only `MAX_CAROUSEL_IMAGES` (5) are sent.

**Approach:** Refresh expired images by rescrape, send every slide the scraper or the post has (up to a moderator cap), keep trying slides when the cover fails, and report how many images were read so a shortfall is visible.

## Boundaries & Constraints

**Always:**
- Moderator preview path: rescrape when the stored cover or any stored slide URL is expired (`parseImageUrlExpiry`) or the cover is missing, and send the scraper's `imageUrl` + `additionalImageUrls`. A stored caption is kept; the rescraped caption is used only when none is stored (AD-40 Rule 5/6: caption only in the job payload, never in `posts`).
- The rescrape cooldown still applies. When it blocks, or the scrape fails, a post with a stored caption still previews with its stored images and a shortfall warning; only a post with no caption and no scrape result fails (`SCRAPE_FAILED` / `RATE_LIMITED` as today).
- Moderator preview jobs send up to `REEXTRACT_MAX_CAROUSEL_IMAGES` (10, a domain constant) slides; ingestion keeps `MAX_CAROUSEL_IMAGES`.
- A cover failure no longer skips the slides. When no image succeeds the request is text-only exactly as today. `aiImageInput` and the fail-closed face-blur behavior (Stories 3.20/3.21, AD-28/29) are unchanged.
- The preview result carries `imagesAvailable` and `imagesSent`; the dialog shows a warning when `imagesSent < imagesAvailable`. Strings in en and id.

**Ask First:** Raising `MAX_CAROUSEL_IMAGES` for ingestion; changing `aiImageInput` semantics; any Apply/write behavior (deferred, see backlog).

**Never:** Write a caption or fresh image URLs to `posts`; send an unblurred image when blur is on; change dedup behavior.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Expired slides | stored post with caption, URLs past expiry | rescrape, send fresh cover + all slides (cap 10) | N/A |
| Shortfall | 6 images available, 4 fetched | result `imagesSent: 4`, `imagesAvailable: 6`, warning shown | N/A |
| Cover fails | cover 403, 3 slides ok | the 3 slides are sent, not text-only | N/A |
| Scrape blocked or failed, caption stored | cooldown, or scrape throws | preview with stored images, warning | N/A |
| Scrape failed, no caption | content empty, scrape fails | no job | `SCRAPE_FAILED` |
| Unknown URL | not in DB, carousel | scraper's slides are sent | as today |
| Single-image post | no slides, URLs valid | no rescrape, one image | N/A |

</frozen-after-approval>

## Code Map

- `apps/backend/src/lib/extraction/start-post-reextraction-preview.ts` -- expiry check, rescrape trigger, use scraped slides (current lines 131, 187), fall back to stored on block/failure.
- `apps/backend/src/schema/resolvers.ts` (`extractEventDataFromUrl`, ~1688) -- pass `scrapedPost.additionalImageUrls`.
- `apps/backend/src/lib/ai-processor/build-gemini-request.ts` -- slides tried when the cover fails (lines ~308-460), per-call slide cap option, return `imagesAvailable` / `imagesSent`.
- `apps/backend/src/lib/ai-processor/process-manual-extraction-job.ts`, `build-reextraction-preview.ts` -- cap for preview mode; counts into `result_data`.
- `packages/domain/src/posts/types.ts`, `packages/domain/src/scraper/parse-image-url-expiry.ts` -- constant, result fields, reuse the parser (100% covered).
- `apps/backend/src/schema/extraction.graphql`, `apps/web/src/features/moderation/{reextract.graphql,reextract-preview-result.tsx}`, `locales/{en,id}.json` -- fields and warning.
- Docs: AD-40 Rule 5 amendment (rescrape also on expired images), `docs/infrastructure/7-event-dedup.md`.

## Tasks & Acceptance

**Execution:**
- [ ] `start-post-reextraction-preview.ts`, `extractEventDataFromUrl` -- refresh expired images, forward scraped slides, degrade gracefully -- slides were being lost
- [ ] `build-gemini-request.ts` -- cover failure keeps slides, cap option, counts -- complete, visible reading
- [ ] domain constant and types, manual job, preview builder, GraphQL, web, locales -- carry counts to the dialog warning
- [ ] AD-40 Rule 5 and runbook amendment
- [ ] Tests: matrix rows, existing blur tests untouched, no `posts` writes, row-count ratchet clean

**Acceptance Criteria:**
- Given a stored carousel post whose image URLs have expired, when a moderator previews, then a rescrape supplies fresh images and events from later slides appear in the preview.
- Given fewer images fetched than available, when the preview opens, then the shortfall warning is visible.
- Given any preview, when it ends, then `posts` is unchanged and no caption persists.

## Spec Change Log

## Design Notes

Ingestion shares `build-gemini-request.ts`, so the cover-failure fix also helps normal extraction; its outcomes only improve (slides sent where the request used to go text-only). The 10-slide cap is scoped to moderator previews because each slide costs Gemini image tokens on a manual, on-demand call.

## Verification

**Commands:**
- `pnpm --filter backend test`, `pnpm --filter @festgrid/domain test` -- expected: pass, row-count ratchet clean
- `pnpm --filter web test` and `pnpm --filter web exec tsc --noEmit` -- expected: pass
- `uv run --python 3.11 --with pyyaml scripts/backlog-check.py` -- expected: clean
