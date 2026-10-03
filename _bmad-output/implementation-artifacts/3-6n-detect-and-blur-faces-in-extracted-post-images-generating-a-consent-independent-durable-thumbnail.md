---
baseline_commit: 1160e08c
---

# Story 3.6n: Detect and blur faces in extracted post images, generating a consent-independent durable thumbnail

## Story Details

- Epic: 3
- Story ID: 3.6n
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a subscriber,
I want any bystander's face visible in an event's photo to be blurred and durably stored,
so that FestDaily has a safe, consent-independent copy of the photo to fall back on, regardless of whether the source account has opted into image re-hosting. (The read path that actually serves this copy to the card/detail page — GraphQL field, resolvers, `resolveServedImageUrl`, web mapper/codegen, `EventListView`'s `prominentPoster` trigger — is split out to Story 3.6n2; this story is the backend pipeline only.)

## Acceptance Criteria

1. **Given** a post's extraction reports `hasFaceImage = true` (Story 3.6m) and `imageBytes`/`imageContentType` were already fetched for the Gemini extraction request, **when** this stage runs — inside `process-ai-job.ts`'s existing post-level region (the same step-7.5a area that already best-effort re-hosts the cover image for opted-in accounts, before the per-event fan-out to `DataIngestionQueue`) — **then** it runs `@vladmandic/face-api` (SSD MobileNetV1 detector, WASM backend per Story 0.46) against those already-fetched original image bytes (no second fetch) to locate face bounding boxes.
2. **And** this stage runs **unconditionally regardless of `isImageStorageOptedIn`** — a new, separate call site from the existing `rehostPostImageSeam` call, which stays gated on opt-in (never merge the two gates or the two columns). It runs **exactly once per post, never per event**: even on a multi-event post (Story 3.6t) it produces one thumbnail, since it operates on the post's single cover image before the per-event loop/fan-out, not inside the per-event ingestor (`process-ingestion-job.ts` is never touched by this story). A queue redelivery re-runs the stage harmlessly — the content-versioned key (AC4) keeps re-upload idempotent.
3. **And** a Gaussian blur is applied over each detected face's bounding box at the image's original fetched resolution, **before** any resizing or cropping (processing order is correctness-critical — cropping first risks misaligned coordinates for a face partially outside the eventual crop).
4. **And** the blurred image is then resized/cropped via `sharp.resize(480, 480, { fit: 'cover', withoutEnlargement: true })` and re-encoded as JPEG quality 80, then uploaded under the content-versioned key `posts/{postId}/thumb-{hash8}.jpg` (Architecture Spine AD-28 Rule 9, via Story 3.6q's `buildPostMediaKey(postId, 'thumb', hash8, ext)` helper — `ext` is ignored for `'thumb'`, always re-encoded `.jpg`) to the same private-S3-bucket-plus-CloudFront-OAC mechanism Architecture Spine AD-12 Rule 2 already established, **reusing the S3 client seam `rehost-post-image.ts` already exports (`s3ClientInstance`/`setS3ClientInstance`) rather than constructing a second client**. The resulting CloudFront URL is written to a new `posts.durableThumbnailUrl` column (new migration, this story) — **independent of `isImageStorageOptedIn`** (populated for opted-in and non-opted-in accounts alike; distinct from and never conflated with `durableImageUrl`, which keeps its existing opted-in-only, unblurred, full-resolution behavior completely unchanged by this story).
5. **And** a timeout guard is applied so this stage cannot push the Lambda invocation past its 300s timeout / the `AIProcessingQueue`'s 300s visibility timeout (per Story 0.46 AC5's measurement and guard recommendation): a remaining-time check, read from the Lambda `Context` threaded down from the handler (`ai-processor.ts`) through `processAiJob`'s signature as a new optional dependency, taken **before** starting detection. If the remaining time is below a configurable floor (`FACE_BLUR_MIN_REMAINING_TIME_MS` env var), the stage is skipped defensively (logged, `durableThumbnailUrl` stays null) rather than risking an AWS-enforced hard kill mid-stage, which would abort the whole extraction attempt (including the not-yet-reached enqueue/mark-extracted steps) and trigger a costly full SQS-redelivery re-run. The existing 33 direct `processAiJob(message)` call sites in tests (no second argument) continue to work unchanged — the new parameter defaults to an unbounded/no-guard provider.
6. **And** if detection, blur, resize, or upload fails at any step (including the timeout guard tripping, or any error thrown by `@vladmandic/face-api`/`sharp`), the failure is caught and logged; `durableThumbnailUrl` stays null and extraction/ingestion proceeds unaffected (best-effort, matching Story 3.6e's existing precedent for `durableImageUrl`).
7. **And** this story adds **no** GraphQL field, resolver, `resolveServedImageUrl` change, web mapper/codegen change, or `EventCard`/`EventListView` change of any kind — all of that is Story 3.6n2's scope, built against this story's `posts.durableThumbnailUrl` column once it exists.
8. **And** a regression test fixture covering a photo with a clearly visible face confirms the stored thumbnail's face region is visibly blurred, and a fixture with `hasFaceImage = false` confirms detection is skipped entirely (no face-api.js invocation, no S3 upload).

## Tasks / Subtasks

- [ ] **Task 1 (AC4): Add the `posts.durableThumbnailUrl` migration**
  - [ ] `packages/database/schema.ts`: add `durableThumbnailUrl: text('durable_thumbnail_url'),` directly beside the existing `durableImageUrl`/`imageUrlExpiresAt` columns (lines ~316-317) — same nullable `text` shape, same table, no index (mirrors `durableImageUrl`, which has none either; nothing queries this column directly, it is only ever read via the `events` → `posts` join Story 3.6n2 adds).
  - [ ] Run `pnpm --filter database generate` (drizzle-kit) — the next migration file (highest today is `0067_superb_expediter.sql`; **do not hard-code `0068`** — confirm the actual generated filename after running the command, since another in-flight story may land a migration first).
  - [ ] Run `pnpm --filter database migrate` against the local Postgres instance before writing any test against this column.

- [ ] **Task 2 (AC1, AC3): Build the face-detection + blur module**
  - [ ] New file `apps/backend/src/lib/ai-processor/detect-and-blur-faces.ts`, exporting `detectAndBlurFaces(imageBytes: Buffer, imageContentType: string): Promise<Buffer>` (returns the blurred-but-not-yet-resized JPEG/PNG bytes at original resolution) plus the project's established seam pair (`detectAndBlurFacesSeam`/`setDetectAndBlurFacesSeam`), matching `rehostPostImageSeam`'s pattern in the same directory.
  - [ ] **Model/backend initialization:** per Story 0.46, the WASM backend (`@tensorflow/tfjs` + `@tensorflow/tfjs-backend-wasm`) and the SSD MobileNetV1 model weights are bundled into the Lambda. Initialize `@vladmandic/face-api` via its browser/ESM entry (not `dist/face-api.node.js`, which pulls in native `tfjs-node` — see 0.46 AC4) and call `tf.setBackend('wasm')` before any detection call; load the model from the documented path 0.46's bundling establishes (under `LAMBDA_TASK_ROOT` — confirm the exact path against **0.46's actual Dev Agent Record / File List once that story is built**, since 0.46 is `ready-for-dev`, not yet implemented, as of this story's creation — do not guess a path that contradicts what 0.46 actually ships).
  - [ ] **Image-to-tensor bridging — a real technical risk, resolve deliberately, do not assume:** `@vladmandic/face-api`'s detection functions accept a `tf.Tensor3D`/`tf.Tensor4D` directly (its `TNetInput` type), which avoids needing `node-canvas` (the `canvas` npm package) — itself a native binary and exactly the kind of Lambda-bundling problem Story 0.46 analyzed and rejected for `tfjs-node`. The recommended approach: decode `imageBytes` with `sharp` to raw, uncompressed RGB pixel data (`sharp(imageBytes).ensureAlpha(false).raw().toBuffer({ resolveWithObject: true })`, giving `{ data, info: { width, height, channels } }`), then construct `tf.tensor3d(new Uint8Array(data), [info.height, info.width, info.channels])` and pass that tensor to `faceapi.detectAllFaces(tensor, new faceapi.SsdMobilenetv1Options())`. **Do not use `node-canvas` or `tf.node.decodeImage()`** (the latter is `@tensorflow/tfjs-node`-only, not available on the WASM backend). **Before implementing from scratch, check Story 0.46's actual measurement harness (its File List/Dev Agent Record, once built)** — 0.46's own AC1/AC4 require it to run real detection on fixture images to measure memory/latency, so it will already have solved this exact bridging problem; reuse its approach rather than re-deriving a second one. Dispose every intermediate tensor (`tensor.dispose()` or `tf.tidy(...)`) to avoid a WASM-backend memory leak across repeated Lambda invocations in the same execution environment.
  - [ ] For each detected face, apply a Gaussian blur over its bounding box at the **original** resolution/coordinate space (AC3) — e.g. via `sharp`'s regional composite (extract the face region, apply `.blur(sigma)`, composite it back at the same coordinates) or an equivalent per-region blur; do not blur the whole image.
  - [ ] Return the blurred image re-encoded at original resolution (resize happens in Task 3, per AC3's processing-order requirement — do not resize inside this function).

- [ ] **Task 3 (AC4): Resize, upload, and write `posts.durableThumbnailUrl`**
  - [ ] New file (or extend Task 2's file, dev agent's call) implementing: `sharp(blurredBytes).resize(480, 480, { fit: 'cover', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer()`.
  - [ ] Compute `hash8` (SHA-256 of the final thumbnail bytes, first 8 hex chars — same `createHash('sha256').update(bytes).digest('hex').slice(0, 8)` pattern as `rehost-post-image.ts`) and the key via `buildPostMediaKey(postId, 'thumb', hash8, 'jpg')` (`@festgrid/domain/posts`).
  - [ ] Upload via the **imported, reused** `s3ClientInstance` from `rehost-post-image.ts` (`import { s3ClientInstance } from './rehost-post-image.js'` — do not instantiate a second `S3Client`), using `PutObjectCommand` with the same `Bucket`/`ContentType: 'image/jpeg'` shape `rehostPostImage` already uses.
  - [ ] Update `posts.durableThumbnailUrl` to the resulting CloudFront URL (`https://${postMediaCdnDomain}/${key}`) via `db.update(posts).set({ durableThumbnailUrl }).where(eq(posts.id, postId))`.
  - [ ] **Cleanup of a superseded previous thumbnail** (mirroring `rehostPostImage`'s existing previous-key delete/invalidation pattern): read the current `posts.durableThumbnailUrl` before overwriting, delete the previous S3 object and invalidate its CloudFront path if the key actually changed — best-effort, never affecting this function's own success/failure.
  - [ ] Wrap the entire upload+DB-write sequence in its own try/catch (mirroring `rehostPostImage`'s outer try/catch) so a failure here returns/logs cleanly without throwing.

- [ ] **Task 4 (AC1, AC2, AC6): Wire the stage into `process-ai-job.ts`**
  - [ ] Add a new call site immediately after the existing step-7.5a `rehostPostImageSeam` block (same post-level region, before step 8's per-event enqueue loop) — a **separate, sibling** `if` block, not nested inside `!skipImageRehost`:
    ```ts
    // 7.5b. Face-blurred durable thumbnail (Story 3.6n, AD-28) -- independent of
    // isImageStorageOptedIn (unlike the rehost block above); runs once per post, before the
    // per-event fan-out. Best-effort: any failure (including the timeout guard below) is caught,
    // logged, and leaves durableThumbnailUrl null without affecting extraction/ingestion.
    if (imageBytes && imageContentType && payload.hasFaceImage === true) {
      const remainingMs = getRemainingTimeInMillis ? getRemainingTimeInMillis() : Infinity;
      if (remainingMs < env.faceBlurMinRemainingTimeMs) {
        console.warn(
          `[processAiJob] Skipping face-blur thumbnail for post ${message.postId}: ` +
            `only ${remainingMs}ms remaining (floor ${env.faceBlurMinRemainingTimeMs}ms).`
        );
      } else {
        try {
          await detectAndBlurFacesAndUploadSeam(message.postId, imageBytes, imageContentType, env);
        } catch (blurError) {
          console.error(`Face-blur thumbnail stage failed for post ${message.postId}:`, blurError);
        }
      }
    }
    ```
    (Exact function name/split between Task 2's detection+blur and Task 3's resize+upload is the dev agent's call — compose them into one seam call here, or two; either is fine as long as both are independently unit-testable.)
  - [ ] Thread the Lambda's remaining-time provider into `processAiJob`'s signature as a new, optional third-ish parameter (e.g. `processAiJob(message: ProcessingJobMessage, deps?: { getRemainingTimeInMillis?: () => number })`), defaulting to `undefined`/unbounded so all 33 existing direct-call test sites (`processAiJob(message)`, no second argument) keep compiling and behaving identically.
  - [ ] `apps/backend/src/lambdas/ai-processor.ts`: pass `context.getRemainingTimeInMillis.bind(context)` into `processAiJob` from **both** call sites — the per-record SQS loop and the `poll-and-drain` branch (both already receive `context` as the handler's second parameter; only the threading into `processAiJob` is new).

- [ ] **Task 5 (AC5): Add the timeout-guard env var**
  - [ ] `apps/backend/src/env.ts`: add `faceBlurMinRemainingTimeMs: number` to `BackendEnv`, loaded as `parseInt(process.env.FACE_BLUR_MIN_REMAINING_TIME_MS || '60000', 10)`. **The `60000` (60s) default is a conservative placeholder, not a measured value** — Story 0.46 (which measures this stage's actual worst-case duration) is `ready-for-dev`, not yet built, as of this story's creation. Add a code comment stating this default must be revisited once 0.46's real AC1/AC4/AC5 measurements are known, and record in this story's own Dev Agent Record whatever value was actually used/tuned if 0.46 has landed by the time this story is implemented.

- [ ] **Task 6 (AC8): Regression tests**
  - [ ] Unit tests for `detect-and-blur-faces.ts` (new `*.test.ts`, `node:test` — see Dev Notes on this package's actual test runtime): a fixture image with a clearly visible face asserts at least one face is detected and the returned bytes differ from the input in the face region (a pixel-level or statistical-variance check over that region, not just "bytes changed somewhere"); a fixture with no people confirms zero detections (and, at the `process-ai-job.ts` wiring level, that the whole stage is skipped — no detector invocation — when `hasFaceImage === false`, per AC8's second half).
  - [ ] Integration tests extending `apps/backend/src/lib/ai-processor/process-ai-job.test.ts` (or a new focused file, dev agent's call, mirroring Story 3.6p's "extend vs. new file" judgment call) with real-DB cases: (a) `hasFaceImage: true` → `posts.durableThumbnailUrl` is populated after `processAiJob` runs, independent of `isImageStorageOptedIn` (test both `true` and `false`); (b) `hasFaceImage: false` → `durableThumbnailUrl` stays null, no S3 `PutObjectCommand` call (mock the S3 client); (c) a multi-event post (Story 3.6t fixture shape) produces exactly **one** thumbnail/one `durableThumbnailUrl` write, not one per event; (d) the timeout guard: inject a `getRemainingTimeInMillis` returning a value below `faceBlurMinRemainingTimeMs` and assert the stage is skipped (logged) without throwing and without an S3 call; (e) a thrown error from the detection/upload path is caught — `processAiJob` still completes (`markPostExtractedSeam` called, no error propagates to the caller).
  - [ ] Confirm no regression in the existing 33 direct `processAiJob(message)` call sites (no second argument) — full `apps/backend` suite green.

- [ ] **Task 7: Full verification pass**
  - [ ] `pnpm --filter database generate && pnpm --filter database migrate`; `pnpm --filter database seed:volume:clean` before any DB-backed run (per `cc-024-multi-event-wave-plan.md`'s "Test-gate facts learned" section).
  - [ ] `pnpm --filter backend test` (foreground, `TZ=UTC`) — full backend suite green, including Task 6's new tests.
  - [ ] `pnpm --filter backend lint` / `pnpm --filter backend build` clean for `apps/backend`, `packages/database`.
  - [ ] Manually confirm (read the diff) that no `.graphql` SDL file, no `resolvers.ts`, no `apps/web`, and no `packages/ui` file is touched anywhere in this story's diff (AC7) — all of that is Story 3.6n2.

## Dev Notes

- **This is a backend/Lambda-pipeline-only story.** Touches `apps/backend/src/lib/ai-processor/` (new module + `process-ai-job.ts` wiring), `apps/backend/src/lambdas/ai-processor.ts` (threading `Context`), `apps/backend/src/env.ts` (one new env var), and `packages/database/schema.ts` + a new migration. Zero `events.graphql`/`resolvers.ts`/`apps/web`/`packages/ui` changes — see "Architecture & UX Gate Findings" below for why, and the split history.

- **Split from this story's original, larger scope (2026-10-03, `bmad-create-story`, size judgment confirmed with the user via `AskUserQuestion`):** the batch readiness sweep (`epic-readiness/batch-cc-023-face-blur-audit-readiness.md`) flagged this story's combined size (DB migration + Lambda pipeline stage + GraphQL schema + 6 `resolvers.ts` select sites + a `packages/domain` precedence function with a privacy-sensitive test matrix + `apps/web` mapper/codegen + `EventListView` wiring) as a split candidate, mirroring this project's `1.3a`/`1.3b` backend-layer/UI-layer precedent (and this very batch's own split of Story 0.46 out of this story for the same reason). **User confirmed: split.** This story keeps the pipeline; the read path moved to new **Story 3.6n2** (`epics.md`, `sprint-status.yaml`: `3-6n2-expose-the-face-blurred-thumbnail-through-the-read-path-and-widen-the-prominent-card-trigger`, `backlog`, no story file yet — create it via a future `bmad-create-story` run once this story ships).

- **Served-URL precedence decision (resolved with the user at this same create-story session, `AskUserQuestion`) — recorded here for continuity even though it is implemented entirely in Story 3.6n2, not this one:** "Thumbnail fills the gap only." While the original hotlinked image is still valid, `Event.imageUrl` keeps serving it unchanged (any opt-in status). Only once it expires: an opted-in account still gets `durableImageUrl` (sharp) as today; a non-opted-in account now gets `durableThumbnailUrl` (blurred) instead of `null`. This story's only obligation toward that decision is to make sure `posts.durableThumbnailUrl` actually gets populated (AC4) — the precedence logic itself lives in `packages/domain/src/events/resolveServedImageUrl.ts`, touched only by Story 3.6n2.

- **Files read in full before finalizing this design:** `apps/backend/src/lib/ai-processor/process-ai-job.ts` (current, post-3.6s/3.6t — the step-7.5a region this story's new call site sits beside); `apps/backend/src/lib/ai-processor/rehost-post-image.ts` (the S3-client-seam, key-building, and previous-key-cleanup pattern this story's Task 3 reuses/mirrors); `apps/backend/src/lambdas/ai-processor.ts` (confirmed `context: Context` is already the handler's second parameter on both the SQS-batch and `poll-and-drain` branches, but is **not** threaded into either `processAiJob` call today — Task 4 is a real, if small, signature change); `packages/domain/src/posts/build-post-media-key.ts` (`buildPostMediaKey`'s `'thumb'` variant already exists and already forces `.jpg`, built by Story 3.6q specifically anticipating this story); `packages/database/schema.ts` (`posts.durableImageUrl`/`imageUrlExpiresAt` column shape, the precedent this story's new column mirrors); `_bmad-output/implementation-artifacts/0-46-...md` (full file — the Lambda-runtime prerequisite: WASM backend decision, model-weight/`.wasm` bundling, memory/timeout headroom, **not yet built** as of this story's creation); `_bmad-output/implementation-artifacts/3-6m-...md` and `_bmad-output/implementation-artifacts/3-6p-...md` (as-built/as-speced `hasFaceImage` payload-root placement and the `extraction_audit_logs` backfill contract this story must eventually satisfy, even though writing to that table is explicitly Story 3.6p's own scope, not this one's); Architecture Spine AD-28 (full text) and AD-12 Rule 2/Rule 7 (the pre-existing S3/CloudFront mechanism and consent gate this story extends without modifying).

- **Real technical risk, not yet resolved by any prior story — flagged deliberately rather than guessed past (see Task 2):** `@vladmandic/face-api` needs an image as a DOM `Image`/`HTMLCanvasElement` (browser) or a `tf.Tensor` (works anywhere, including Node). Lambda has neither DOM nor (on the WASM backend Story 0.46 chose) `tf.node.decodeImage()` (that is `@tensorflow/tfjs-node`-only). The usual Node workaround, `node-canvas` (the `canvas` npm package), is itself a native binary — exactly the Lambda-bundling problem Story 0.46 analyzed and rejected for `tfjs-node` in the first place, so pulling it in here would quietly reintroduce that same risk through a side door. The recommended, canvas-free path — decode via `sharp`'s raw-pixel output, construct a `tf.tensor3d` directly, pass that tensor to `faceapi.detectAllFaces()` (whose `TNetInput` type accepts a tensor) — is a well-documented face-api.js server-side pattern and needs no native add-on beyond what 0.46 already provisions (`sharp`, already native and already bundled by that story). **Story 0.46's own AC1/AC4 measurement harness will have to solve this exact bridging problem to produce its memory/latency numbers** — when 0.46 is actually built, read its File List/Dev Agent Record first and reuse its approach rather than re-deriving a second one; this story's Task 2 gives the fallback approach only in case 0.46's own solution differs or 0.46 is not yet dev'd when this story is implemented.
- **Escape-hatch guard (`story-split-gate.md`'s "Epic-Level Sweep Mode"):** does this story's actual scope contain anything the batch sweep didn't anticipate? The image-to-tensor bridging risk above is a genuine implementation-level technical risk the sweep's text did not call out — but it is not a new external service, new data entity, or new infra dependency (0.46 already provisions the WASM runtime; this is "how do we call it from Node without DOM," an implementation detail within the already-scoped pipeline stage). It does not rise to a fresh Gate 1/3 run; it is flagged above for the dev agent to solve deliberately instead of guessing.

### Architecture & UX Gate Findings

- **Gate 1 and Gate 3 — cited from the batch readiness sweep, not re-run.** Per `epic-readiness/batch-cc-023-face-blur-audit-readiness.md` (`swept: true`, dated 2026-10-03, `gates: [1, 3]`), Gate 1 Finding 1 is exactly Story 0.46 (the Lambda-runtime prerequisite, listed in Depends on below — already its own story, not absorbed here). Gate 1 Finding 2 ("3.6n's read path is unowned") and Gate 3 Finding 3 (`resolveServedImageUrl` served-URL precedence) both named this story's *read path* specifically — which this create-story session split out to Story 3.6n2 (see above), so those two findings now attach to 3.6n2, not to this pipeline-only story. No other Gate 1/3 gap applies to the pipeline scope: "3.6m and 3.6p stay inside the existing `process-ai-job.ts`/`build-gemini-request.ts`/... layers" (Gate 1) and the S3/media-key/IAM reuse checks ("3.6n should reuse the S3 client seam exported by `rehost-post-image.ts`", folded into Task 3 above) both clear with no gap (Gate 3).
- **Gate 2 — run fresh for this story's original (pre-split) scope** (per `story-split-gate.md`, Gate 2 stays per-story; the batch sweep explicitly called out that only this story carried frontend scope). One-shot Freya-persona evaluation was dispatched against the full pre-split scope (pipeline + the `prominentPoster` widening + the GraphQL/mapper/EventCard read path) and returned **no gap**: `EventCard`'s `prominentPoster` boolean and its two visual treatments are already shipped and unchanged (only the upstream boolean's *derivation* widens); `resolveServedImageUrl` is a pure function gaining one more candidate in already-existing precedence logic, not a new complex hook; `EVENT-CARD-DESIGN.md`/`EXPERIENCE.md` reserve no distinct "blurred" visual treatment this scope omits. Two non-gating flags were raised for a human UX reviewer's awareness (not a split trigger): (1) a blurred, consent-independent thumbnail renders in the visually identical `image_prominent` slot as a full-quality `durableImageUrl` with no distinguishing badge/label — intentional per AD-28's own design (consent is a backend concern, not a UI one), confirmed by AD-28 Rule 7/8's framing, not an oversight; (2) `resolveServedImageUrl`'s new three-way precedence deserves dedicated unit-test coverage — now an explicit requirement of Story 3.6n2's own AC2. **Given this story's scope has since narrowed to pipeline-only (zero `apps/web`/`packages/ui`/GraphQL surface at all), Gate 2 trivially clears for the as-built scope below** — the findings above (prominentPoster, resolveServedImageUrl, EventCard) now inform Story 3.6n2's own future create-story pass, not this one.
- **No new prerequisite stories or further `sprint-status.yaml`/`epics.md` entries were added by this story beyond the split itself** (Story 3.6n2, already added to both files by this same create-story session) and the already-existing Story 0.46 (found by the sweep, not by this story).

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No mismatch found. This story adds exactly one new, independent, nullable `text` column (`posts.durableThumbnailUrl`) — no existing column's type changes, no existing TypeScript interface changes.
- **Impacted fields/contracts:** `packages/database/schema.ts`'s `posts` table gains `durableThumbnailUrl`. No GraphQL type, no `packages/domain` interface, no `apps/web` type changes in this story (all deferred to Story 3.6n2, which reads this column through the `events`→`posts` join once it exists).
- **Required DB migration changes:** One new `drizzle-kit generate`-produced migration adding `posts.durable_thumbnail_url text` (Task 1). No backfill needed — every existing row simply has `null` until a future extraction attempt (this story's own stage, or a one-off backfill script if ever desired — not built here) populates it.
- **Required TypeScript type changes:** None beyond `packages/database/schema.ts`'s own generated `Post` row type (automatic from the Drizzle column addition). `GeminiExtractionPayload`/`GeminiEventPayload` (packages/domain) are unchanged — this story only *reads* their already-shipped `hasFaceImage` field (Story 3.6m), it adds nothing to them.
- **Backward compatibility and rollout notes:** Purely additive. The new post-level call site (Task 4) is independent of and runs alongside the existing `rehostPostImageSeam` call — a failure in one must never affect the other (each has its own try/catch). `processAiJob`'s new optional `deps` parameter (Task 4) is backward-compatible by construction (optional, defaults to unbounded) — every existing call site, in production (`ai-processor.ts`, updated to pass real `Context`) and in all 33 existing tests (left unchanged), continues to work.
- **Verification checks:** Task 6's unit tests (face detected/blurred vs. no-face-skip) and integration tests (DB write, opt-in independence, multi-event-post singularity, timeout-guard skip, failure non-propagation); Task 7's full lint/build/test pass confirming no regression in the pre-existing 33 call sites.

### Project Structure Notes

- New files: `apps/backend/src/lib/ai-processor/detect-and-blur-faces.ts` (+ its `*.test.ts`); one new Drizzle migration file under `packages/database/migrations/` (exact number confirmed at implementation time, not hard-coded — see Task 1).
- Modified files: `packages/database/schema.ts` (new column); `apps/backend/src/lib/ai-processor/process-ai-job.ts` (new call site + new `deps` parameter); `apps/backend/src/lambdas/ai-processor.ts` (thread `context.getRemainingTimeInMillis`); `apps/backend/src/env.ts` (new `faceBlurMinRemainingTimeMs`); `apps/backend/package.json`/`pnpm-lock.yaml` (only if Story 0.46 has not yet landed the `@vladmandic/face-api`/`@tensorflow/tfjs*`/`sharp` dependencies by the time this story is implemented — confirm against 0.46's actual status first; do not add a second, possibly-conflicting set of dependency declarations if 0.46 already shipped them).
- **Package boundary check:** the new detection/blur module is deeply coupled to native/WASM binaries (`sharp`, `@vladmandic/face-api`, `@tensorflow/tfjs-backend-wasm`) and the AWS Lambda runtime — correctly placed in `apps/backend`, never `packages/domain` (which must stay dependency-free of Node-runtime/native-binary coupling per `project-context.md`'s Code Organization rule — this is an even stronger case than the DB/ORM-coupling examples that rule names, since native binaries are not even guaranteed to load in every Node environment). No `packages/ui` component, no `SETUP_WALKTHROUGH.md` update (reuses the already-provisioned S3/CloudFront infrastructure from Stories 0.33/3.6e — no new cloud/external service), no PostHog event, no new i18n locale key — confirmed by the Gate 2 finding above (zero user-facing surface in this story's as-built, post-split scope).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md`#Story 3.6n] — authoritative ACs this story is drafted from, including the 2026-10-03 Amendment (sweep corrections, folded into the ACs above) and this same-day Correction (the split into this story + Story 3.6n2).
- [Source: `_bmad-output/planning-artifacts/epic-readiness/batch-cc-023-face-blur-audit-readiness.md`] — `swept: true`, Gate 1/3 findings cited directly; Finding 1 (Story 0.46), Finding 2 (read path → now 3.6n2), Finding 3 (served-URL precedence → now 3.6n2's AC2); the S3-client-seam-reuse note folded into Task 3.
- [Source: `_bmad-output/implementation-artifacts/0-46-...md`] — the Lambda-runtime prerequisite (full file read): WASM backend decision + its AD-28 Rule 3 compliance judgment, model-weight/`.wasm` bundling mechanism, memory/architecture sizing approach, timeout/visibility-timeout headroom methodology this story's own guard (AC5) is modeled on. **Not yet built** as of this story's creation — flagged wherever this story's design depends on 0.46's eventual real numbers/file layout.
- [Source: `_bmad-output/implementation-artifacts/3-6m-...md`] — confirmed `hasFaceImage`'s as-built payload-root placement on `GeminiExtractionPayload`, read (not written) by this story's new call site's guard condition.
- [Source: `_bmad-output/implementation-artifacts/3-6p-...md`] — confirmed the `extraction_audit_logs` backfill contract (`actualFaceDetectionCount`/`faceDetectionSkippedReason`) this story's eventual output feeds, without this story writing to that table itself (3.6p's own scope).
- [Source: `apps/backend/src/lib/ai-processor/process-ai-job.ts`] — file this story edits; current (post-3.6t) step-7.5a region, confirmed by direct read, not by any story text.
- [Source: `apps/backend/src/lib/ai-processor/rehost-post-image.ts`] — the S3-client-seam, key-building, and previous-key-cleanup pattern Task 3 reuses/mirrors; confirmed `s3ClientInstance`/`setS3ClientInstance` are already exported and importable.
- [Source: `apps/backend/src/lambdas/ai-processor.ts`] — confirmed `context: Context` is already the handler's second parameter on both branches, but not yet threaded into `processAiJob` (Task 4's real signature change).
- [Source: `packages/domain/src/posts/build-post-media-key.ts`] — confirmed the `'thumb'` variant already exists (built by Story 3.6q specifically anticipating this story) and already forces `.jpg`.
- [Source: `packages/database/schema.ts`, lines ~300-335] — `posts.durableImageUrl`/`imageUrlExpiresAt` column shape and the Story-3.6-family comment conventions this story's new column follows.
- [Source: Architecture Spine AD-28 (full text), AD-12 Rules 2/7] — binding rules for this story: detection/blur/resize/upload mechanism, the opt-in-independence requirement, the pre-existing S3/CloudFront mechanism this story extends without modifying.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Technology Stack (Backend: Serverless on AWS, Lambda); Code Organization (`packages/domain` restriction — this story's native/WASM-coupled module correctly stays in `apps/backend`, see Project Structure Notes); Security ("Resilient Processing Pipeline" — SQS queue decoupling, unaffected); General Architecture (Adapter Pattern for external AI services — not applicable here, face-api/TensorFlow.js run in-process, no external vendor call).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order and status vocabulary followed.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-28 (this story's primary binding rule, Rules 1/2(deferred to 3.6o)/3/4/5/6/8/9 all addressed above; Rule 7 deferred to Story 3.6n2), AD-12 Rules 2/7 (the pre-existing S3/CloudFront mechanism and consent gate, extended not modified).
- [x] `docs/infrastructure/index.md` / `docs/infrastructure/2-backend.md` — Lambda/SQS pipeline architecture; this story adds no new queue, Lambda, or infra resource (Story 0.46 already provisioned the runtime) — only new application-level logic inside the already-provisioned `AIProcessorLambda`.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - `packages/database/schema.ts` (modify — new `durableThumbnailUrl` column) + new migration file under `packages/database/migrations/` (new)
  - `apps/backend/src/lib/ai-processor/detect-and-blur-faces.ts` (new — detection/blur/resize/upload module + seam) + its `*.test.ts` (new)
  - `apps/backend/src/lib/ai-processor/process-ai-job.ts` (modify — new post-level call site, new `deps` parameter)
  - `apps/backend/src/lambdas/ai-processor.ts` (modify — thread `context.getRemainingTimeInMillis` on both call sites)
  - `apps/backend/src/env.ts` (modify — new `faceBlurMinRemainingTimeMs`)
  - `apps/backend/src/lib/ai-processor/process-ai-job.test.ts` or a new focused integration test file (modify/new — Task 6)
  - **Explicitly unchanged:** `events.graphql`, `resolvers.ts`, `apps/web/**`, `packages/ui/**`, `packages/domain/**`, `apps/backend/src/lib/ingestor/process-ingestion-job.ts`.
- **Rule Mapping:**
  - AC1-AC4 (detection/blur/resize/upload mechanism) → Architecture Spine AD-28 Rules 1/3/4/5, this story's primary binding rules.
  - AC2 (once-per-post, opt-in-independent) → AD-28 Rule 6 + the 2026-10-03 sweep Amendment's "where it runs" correction, folded directly into the AC.
  - AC5 (timeout guard) → Story 0.46 AC5's guard recommendation, the only part of 0.46 this story directly consumes/implements.
  - AC7 (scope boundary) → this story's own 2026-10-03 Correction/split: the read path is Story 3.6n2, not here.
  - `story-split-gate.md` Gate 1/2/3 discipline (Gate 1/3 cited from the batch sweep; Gate 2 run fresh pre-split, re-evaluated as trivially-clear post-split) → Dev Notes "Architecture & UX Gate Findings."
  - Data-type-compatibility persistent fact (mismatch/no-mismatch section always included) → Dev Notes "Data Type Compatibility & Migration Requirements."
  - `AskUserQuestion`-before-drafting persistent fact (two real, non-mechanical tradeoffs surfaced at this create-story session: the served-URL precedence — implemented in 3.6n2 but recorded here for continuity — and the story split itself) → Dev Notes, both called out explicitly.
- **Verification Plan:**
  - `pnpm --filter database generate && pnpm --filter database migrate` — migration applies cleanly.
  - `pnpm --filter backend test` (`TZ=UTC`, foreground) — Task 6's unit + integration cases, plus the full existing suite (33 pre-existing `processAiJob` call sites unaffected) green.
  - `pnpm --filter backend lint` / `tsc` build clean for `apps/backend`, `packages/database`.
  - Manual diff review confirming no `.graphql`/`resolvers.ts`/`apps/web`/`packages/ui` file changed anywhere in this story's diff (AC7).

## Pre-Coding Approval Gate

- [ ] Scope confirmation — pipeline only (face detection/blur/resize/upload, `posts.durableThumbnailUrl` migration, once-per-post run point, timeout guard); the read path (GraphQL/resolvers/`resolveServedImageUrl`/mapper/codegen/`EventListView`) is explicitly out of scope, split to Story 3.6n2.
- [ ] Architecture and boundary confirmation — all changes confined to `apps/backend` + `packages/database`; the new native/WASM-coupled module correctly stays out of `packages/domain`; AD-28's opt-in-independence and once-per-post rules are implemented as separate, non-nested gates from the existing opted-in-only `rehostPostImageSeam` call.
- [ ] Testing plan confirmation — unit tests for the new detection/blur module; integration tests for the `process-ai-job.ts` wiring (opt-in independence, multi-event singularity, timeout-guard skip, failure non-propagation); full regression on the 33 pre-existing `processAiJob` call sites.
- [ ] Explicit human approval state (Default: pending approval).
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1/3 cited from the swept `batch-cc-023-face-blur-audit-readiness.md` report; Gate 2 run fresh pre-split (no gap; two non-gating UX flags recorded) and re-confirmed trivially-clear for the post-split, pipeline-only scope. **Hard prerequisite Story 0.46 is `ready-for-dev`, not yet `done`** — this story's Task 2 (WASM backend wiring, model path, image-to-tensor bridging) cannot be finalized with full confidence until 0.46 actually ships; the dev agent must check 0.46's real status/File List before finalizing Task 2's specifics, not just at this story-creation time.
- [ ] Image-to-tensor bridging approach (Dev Notes' flagged technical risk) explicitly acknowledged and validated against Story 0.46's actual measurement harness (once built) before this story's Task 2 is considered complete — not guessed past.

## Testing Requirements

- [ ] Unit tests (`apps/backend`, `node:test` — the established convention for this package; **not Vitest** — `apps/backend` and `apps/infrastructure` both use `tsx --test`, only `apps/web` uses Vitest): `detect-and-blur-faces.ts` — face detected and blurred (fixture with a visible face); zero detections (fixture with no people).
- [ ] Integration tests (real DB, `callGeminiSeam`/S3-client mocked, extending `process-ai-job.test.ts` or a new focused file): opt-in-independence (both `true`/`false` get a thumbnail when `hasFaceImage: true`); no-face skip (no S3 call); multi-event-post singularity (one thumbnail, not N); timeout-guard skip (injected low remaining time); failure non-propagation (detection/upload throws, `processAiJob` still completes).
- [ ] Full regression: all 33 pre-existing direct `processAiJob(message)` call sites (no second argument) still pass unchanged.
- [ ] No E2E/integration test beyond the above applies — this story has no API/GraphQL/UI surface (Story 3.6n2's scope).

## Deliverables Checklist

- [ ] `posts.durableThumbnailUrl` column exists via a committed Drizzle migration.
- [ ] `detect-and-blur-faces.ts` detects faces (WASM backend, no `node-canvas`), blurs at original resolution before resize, and the thumbnail is resized/encoded/uploaded per AD-28 Rule 5.
- [ ] The new call site in `process-ai-job.ts` runs once per post, independent of `isImageStorageOptedIn`, with a working timeout guard threaded from the real Lambda `Context`.
- [ ] Every failure path is caught; `durableThumbnailUrl` stays null on any failure without affecting extraction/ingestion.
- [ ] Zero `.graphql`/`resolvers.ts`/`apps/web`/`packages/ui` changes anywhere in the diff.
- [ ] Unit + integration tests (Task 6) passing; full existing `apps/backend` suite green.

## Out of Scope

- The GraphQL field, the 6 `resolvers.ts` select sites + `Event` field resolver, `resolveServedImageUrl`'s extended precedence, `apps/web`'s mapper/codegen, and `EventListView.tsx`'s `prominentPoster` widening — **Story 3.6n2** (new, split off this story at create-story time; `epics.md`/`sprint-status.yaml` entries already added, no story file yet).
- The relevance/expiry skip gate (don't run this pipeline for events whose window ends before `imageUrlExpiresAt`) — **Story 3.6o** (depends on this story).
- Writing `actualFaceDetectionCount`/`faceDetectionSkippedReason` into `extraction_audit_logs` — **Story 3.6p**'s own write/backfill path; this story produces the underlying detection result but does not touch that table.
- Any change to `posts.durableImageUrl`'s existing opted-in-only, unblurred, full-resolution behavior — untouched by this story (AD-12 Rules 2/7, AD-28 Rule 6).
- The Lambda's memory/architecture sizing, native-binary/WASM/model-weight bundling, and the TensorFlow.js backend choice — **Story 0.46** (hard prerequisite, provisions the runtime this story's code runs on).
- Any AWS Rekognition integration or periodic `hasFaceImage = false` sampling to measure the pre-filter's false-negative rate — explicitly rejected/deferred per AD-28's own "Considered and rejected" and `IDEA-051`.

## Definition of Done

- [ ] AC1-AC8 satisfied.
- [ ] Task 6's unit and integration tests passing; full existing `apps/backend`/`packages/database` suites green, including all 33 pre-existing `processAiJob` call sites.
- [ ] Lint and type checks passing for `apps/backend`, `packages/database`.
- [ ] Migration applies cleanly to local Postgres; no other table/column affected.
- [ ] Dev Notes record the actual image-to-tensor bridging approach used (confirmed against Story 0.46's real implementation if it has landed by then) and the `faceBlurMinRemainingTimeMs` value actually shipped (and whether it was tuned against 0.46's real measurements or left at the documented placeholder).
- [ ] No regression in any other Lambda/queue behavior; `lambdas/ai-processor.ts`'s SQS-batch and `poll-and-drain` branches both still function identically apart from the new `Context`-threading.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
