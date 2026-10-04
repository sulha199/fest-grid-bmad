---
batch: cc-028-blur-before-ai
swept: true
date: 2026-10-04
scope: batch-scoped (not per-epic) — the CC-028 stories added to Epic 3 by sprint-change-proposal-2026-10-04-blur-faces-before-ai.md
gates: [1, 3]
stories_covered: [3.20, 3.21]
not_swept: [3.6n, 3.6o, 3.6p, 0.46, 3.15 — built (review), read as prerequisites only]
new_prerequisite_stories: []
new_backlog_rows: [FIND-068]
---

# Batch Readiness — CC-028 Blur Faces Before the AI Call (Stories 3.20, 3.21)

Gate 1 (architecture/infrastructure) and Gate 3 (foundational/cross-cutting) run once over the pair. Gate 2 (UI)
does not apply: neither story has frontend scope. Every statement below was checked against source at
`6c727c2f`, not assumed from the proposal or the ACs. The sweep was run directly rather than through a Winston
subagent, because the evidence was all in a handful of files and the user asked for a quick pass.

**Headline:** no new prerequisite story. Both stories are **READY-WITH-CORRECTIONS** (applied to `epics.md`).
One real scope gap surfaced: `extractEventDataFromUrl` (Story 4.2a, manual extraction) also sends the cover image
to Gemini and runs in the API Lambda, which cannot host the face-detection runtime. It is recorded as **FIND-068**,
and the decision on it is **reserved for the user at 3.20's create-story**. The other pre-flagged items are settled
below; two of them (the PUBLISHER read and the audit enum) changed the ACs.

## Verified facts

- **Prerequisite statuses (2026-10-04):** 0.46, 3.6l, 3.6m, 3.6n, 3.6o, 3.6p, 3.6s, 3.15 are all `review`. Standing
  rule: build against `review`. 3.20 and 3.21 are `backlog`.
- **Order inside `processAiJob`.** Account read → `buildGeminiExtractionRequest` (fetch cover, fetch slides) → Gemini
  call → parse/AJV (early `return` on failure, no audit row) → three paths that write `extraction_audit_logs`
  (`isEvent: false`, zero events, success) → post-level step 7.5a rehost (opted-in only) → 7.5b face-blur thumbnail
  (gated by `hasFaceImage`, then 3.6o's relevance gate, then the timeout floor) → step 8 fan-out.
- **`buildGeminiExtractionRequest` has four callers**, not one: `process-ai-job.ts`; `schema/resolvers.ts` at two
  sites (the existing-post and new-post paths of `extractEventDataFromUrl`, Story 4.2a); `scripts/poc-ingestion-preview.ts`;
  plus tests. It is DB-free today and has no `Context`. The resolver message carries no `additionalImageUrls`, so the
  manual path sends the cover only.
- **The API Lambda has no image runtime.** `apiLambda` uses `sharedLambdaProps` (128 MB default, 30 s, plain esbuild).
  Only `aiProcessorLambda` has `memorySize: 2048`, `X86_64`, `nodeModules: ['sharp']` and the `afterBundling` copy of
  the model weights and `.wasm` files (Stories 0.46/3.6n).
- **Image count.** `slidesToFetch = additionalImageUrls.slice(0, env.maxCarouselImages)` and `additionalImageUrls`
  excludes the cover (types.ts), so the cap is five slides and the worst case is **six images**.
- **`detectAndBlurFaces`** returns `{ buffer, faceCount }`; with zero faces it returns the original bytes untouched,
  with faces it re-encodes via `sharp(...).composite(...).toBuffer()`. It already sits behind `detectAndBlurFacesSeam`.
  The module imports tfjs WASM at top level, so importing it from `build-gemini-request.ts` pulls that into every
  builder test unless the seam is used.
- **`posts.accountId` is not always the PUBLISHER.** `persist-scraped-post.ts` writes `publisherProfileId ?? accountId`
  (the scraping account as fallback). `persistPostAccountAssociations` writes the `PUBLISHER` row only when the
  publisher resolved, each insert in its own try/catch. The partial unique index
  `idx_post_account_associations_one_publisher_per_post` (`role IN ('PUBLISHER','PUBLISHER_UNKNOWN')`) allows at most
  one such row. `processAiJob` today reads `isImageStorageOptedIn` from `message.accountId` (= `posts.accountId`).
- **Env.** `faceBlurMinRemainingTimeMs` (default 60 000) and `maxCarouselImages` (5) are plain `parseInt`s. Booleans are
  `=== 'true'` (default off). Neither variable is set in IaC; `aiProcessorLambda`'s `environment` block holds `STAGE`,
  the queue URLs, `POST_MEDIA_*`, secrets. `AI_PROCESSING_INLINE_FALLBACK_ENABLED: process.env.X || 'false'` (apiLambda)
  is the closest precedent for an env passthrough with a default.
- **Infra tests.** `festgrid-backend-stack.test.ts` already asserts `aiProcessorLambda`'s environment (test 14,
  `Match.objectLike` keyed on `Timeout: 300` + `DATA_INGESTION_QUEUE_URL`) and has a `findLambdaByPrefix('AIProcessorLambda')`
  helper (~line 452), plus the Story 0.46 memory test.
- **Audit table.** `extractionAuditLogs` (schema.ts) already uses pgEnums (`extractionAuditFaceDetectionSkippedReasonEnum`);
  `writeExtractionAuditLog` takes a params object with no `aiImageInput`.
- **Fixtures.** `cc-024-reference-posts/` holds the scrape JSON (signed CDN image **links**, expiring ~2026-10-06, not
  image bytes) and the captured Gemini responses. `scripts/.poc-cache/` is gitignored. `build-gemini-request.live-cc024-regression.test.ts`
  is the opt-in live pattern (`RUN_LIVE_GEMINI_TESTS=true`, `CC024_LIVE_RUNS`, default 3).

## Gate 1 — Architecture / Infrastructure Completeness

### Finding 1 — Manual extraction sends the cover to Gemini from a Lambda with no image runtime (FIND-068; decision reserved)

`Mutation.extractEventDataFromUrl` (Story 4.2a, sync, user key) builds its request with the same
`buildGeminiExtractionRequest` and sends the original cover. If 3.20 puts the blur inside the builder for every
caller, the API Lambda would have to import face-api/tfjs/sharp (no bundling, 128 MB, 30 s): it would not load. Three
options:

| Option | Cost | Effect |
|---|---|---|
| (a) Out of scope for 3.20, document it | none | Queue pipeline covered; manual path still sends an unblurred cover on the requester's own key, for a public post they chose |
| (b) Give the API Lambda the runtime | large (memory, bundling, 30 s cap, the shared bundle) | Full coverage, heavier and slower API path |
| (c) Route manual extraction through the AI Lambda | large (sync-to-async change to Story 4.2a's UX) | Full coverage, UX change |

**Applied:** 3.20 gets the blur as an **opt-in builder option** that only `processAiJob` passes, so the three other
callers are unchanged and "byte-for-byte when off" holds structurally. The residual is **FIND-068** on the backlog
(child of CC-028). **Which option to take is the user's call**; the create-story run for 3.20 should ask. No new
story was added, because (a) needs none and (b)/(c) are product-sized.

### Finding 2 — Hosting and budget for the stage (no gap; recorded)

The stage lands in `aiProcessorLambda`, which already has 2048 MB, the WASM runtime, the model weights, `sharp`, and
S3/CloudFront IAM; no new infra beyond one env var. **Memory and time:** Story 0.46 measured ~1.1 s stage total and
~903 MB peak RSS for one 4000x3000 image (dev machine, local process). Detection is strictly sequential (the existing
fetch loop is sequential), so peak memory is one image plus the retained blurred buffers (a few MB each). Six images
at even 3x slower on Lambda is tens of seconds against 300 s, and the Gemini call keeps its own 120 s timeout. The one
unmeasured risk is the WASM heap growing across six consecutive detections; 3.20's re-measure must use six images
(corrected from "five-slide post") and record it. **Budget gate:** `FACE_BLUR_MIN_REMAINING_TIME_MS` (60 s) is the
right floor; the stage runs at the start of the invocation so it trips only on a pathological one. It needs
`getRemainingTimeInMillis` threaded from `ProcessAiJobDeps` into the builder, which has no `Context` today.

## Gate 3 — Foundational / Cross-Cutting Dependency Completeness

### Finding 3 — How the PUBLISHER role is read (settled: one fresh query in `processAiJob`)

`message.accountId` is `posts.accountId`, which is the PUBLISHER only when the vendor owner resolved; otherwise it is the
scraping account, which has no PUBLISHER row. Reusing the existing `isOptedIntoImageStorage` read would therefore let a
scraping account's opt-in unblur a post it did not publish. **Settled:** one query joining `post_account_associations`
(`role = 'PUBLISHER'`, one row at most via the partial unique index) to `social_media_account_profiles.is_image_storage_opted_in`,
in a helper beside `is-organizer-authored-post.ts` (`resolvePostPublisherOptIn`), called by `processAiJob` and passed to the
builder as a boolean. Fail safe: no row or an error means not opted in. Read fresh, not carried in the SQS message, so a
revoked opt-in is honored for a message already queued and `ProcessingJobMessage` is unchanged. The builder stays DB-free.
This is a **different, stricter read than 3.6h's rehost gate** (which keys on `posts.accountId`); the two diverge only for
a post whose publisher did not resolve, where rehost can follow the scraping account and the AI send blurs. That is the
intended fail-safe direction, noted so nobody "fixes" it later.

### Finding 4 — Env var plumbing and the test-default flip (settled)

`env.ts` needs a default-on boolean parser (none exists; booleans are default-off `=== 'true'`). IaC sets
`BLUR_FACES_BEFORE_AI: process.env.BLUR_FACES_BEFORE_AI || 'true'` in `aiProcessorLambda`'s `environment` only, asserted
by an infra test using `findLambdaByPrefix('AIProcessorLambda')`. **Hidden cost:** with the default on, every existing backend suite that runs `processAiJob` with an `imageUrl` and fake
image bytes would run real WASM detection on garbage bytes and fail closed. By a grep for `imageUrl`, that is
`process-ai-job.test.ts` (8 mentions, 1 804 lines) and `process-ai-job.face-blur.test.ts` (23), plus `build-gemini-request.test.ts`
if the builder gains the option as a default; the other `process-ai-job.*.test.ts` files carry no image and skip the stage.
Those suites must pin the variable off in the backend test setup; 3.20's tests opt in explicitly
and use `setDetectAndBlurFacesSeam`.

### Finding 5 — The parity check as written would mostly measure noise (corrected in 3.20)

(1) Extraction is non-deterministic (the CC-024 prototype saw post 4 collapse once in two runs), so a single original run
versus a single blurred run cannot separate degradation from variance: run each arm N times (default 3) and call a
difference material only when the blurred arm yields a result the original arm never did. (2) A post where no face is
detected is returned byte-identical, so it tests nothing: record per-image face counts. (3) `poc-ingestion-preview.ts`
calls the builder directly; it needs a flag for the blurred arm. (4) Committing the scrape JSON would commit signed links to
the images: keep it in the gitignored `.poc-cache/` and commit only extraction outputs and a difference table. (5) Post 3
(laridijogja, 5 slides) is the natural six-image memory/time fixture.

### Finding 6 — Audit shape: a fifth enum value, count semantics, three write sites (corrected in 3.21 and AD-29)

`ai_image_input` has no value for a request that carried no image (a post with none, or the existing cover-fetch fallback),
so it gets `'no_image_sent'` (also added to AD-29 Rule 7). `writeExtractionAuditLog` has three call sites, all after the
Gemini call and none on a parse/AJV failure; the new field is required on all three. With the mode on, the non-event paths
can record `actualFaceDetectionCount` at insert too. That count is the **sum across every image sent**, the only value
comparable with the model's all-slides `faceImageCount` (3.6n's backfill counts the cover only). A failed pre-AI cover blur
leaves no thumbnail and must not trigger a second detection. Migration: a new pgEnum with `NOT NULL DEFAULT 'original_mode_off'`.

### Reuse and ownership checks — no gap

- **Cross-epic reuse of face detection/blur.** Outside Epic 3, the only other image-to-Gemini path is Story 4.2a (Finding 1).
  No other epic needs the capability; `detect-and-blur-faces.ts` stays in `apps/backend/src/lib/ai-processor/`.
- **Thumbnail upload, media key, S3/CloudFront IAM.** Built (3.6q, 3.6n, 0.33); 3.21 reuses `uploadFaceBlurThumbnail` unchanged
  (it already accepts already-blurred bytes and resizes them).
- **Audit table ownership.** `extraction_audit_logs` is 3.6p's; 3.21 adds one column. No unowned shared table. IDEA-051 stays its
  only future reader.

## Per-story verdicts

| Story | Verdict | Reason |
|---|---|---|
| 3.20 (blur before the AI call) | **READY-WITH-CORRECTIONS** (applied) | Builder option instead of builder-wide blur; fresh PUBLISHER query; six-image measurement; env/test-default plumbing; measurable parity check. **User decision reserved: FIND-068 option (a)/(b)/(c).** |
| 3.21 (reuse for the thumbnail, record what the AI saw) | **READY-WITH-CORRECTIONS** (applied) | Fifth enum value, three write sites, sum-count semantics, no-retry on cover failure, migration shape. Needs 3.20 first. |

## New prerequisite stories

None. The only consequential gap (Finding 1) is a decision between options of different size, not a missing foundation, and
is carried as backlog row **FIND-068**.

## Corrections applied

1. **`epics.md` 3.20:** AC "five-slide post" corrected to "six-image post"; a six-bullet Amendment records the builder option,
   the publisher-opt-in read, the time budget, env/test defaults, the parity-check refinements and the stage placement.
2. **`epics.md` 3.21:** the enum AC gains `'no_image_sent'`; a five-bullet Amendment records the write path, count semantics,
   no-retry-on-cover-failure and the migration shape.
3. **Architecture Spine AD-29 Rule 7:** adds `'no_image_sent'` and the sum-of-images definition of `actualFaceDetectionCount`.
4. **`backlog.yaml`:** FIND-068 added as a child of CC-028.

No `sprint-status.yaml` change: both story keys already exist as `backlog` and nothing was added or renumbered.

## Order to create stories

**3.20** (ask the user the FIND-068 question) → **3.21**. Both edit `process-ai-job.ts` and `build-gemini-request.ts`, so build
them in order and not alongside other stories touching those files. Code review of 3.6n/3.6o should land first or alongside.
