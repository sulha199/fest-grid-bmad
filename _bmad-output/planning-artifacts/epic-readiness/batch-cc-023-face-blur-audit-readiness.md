---
batch: cc-023-face-blur-audit
swept: true
date: 2026-10-03
scope: batch-scoped (not per-epic) — the CC-023 tail (face-blurred thumbnails and the extraction audit log),
  folded into cc-024-multi-event-wave-plan.md as Wave 4C
gates: [1, 3]
stories_covered: [3.6m, 3.6n, 3.6o, 3.6p]
not_swept: [3.6q — built (review), nothing left to plan]
new_prerequisite_stories: [0.46]
---

# Batch Readiness — CC-023 Face-Blurred Thumbnails and Extraction Audit Log (Wave 4C)

Gate 1 (architecture/infra) and Gate 3 (foundational/cross-cutting) run once over the batch. Gate 2 (UI) stays
per story; only 3.6n has frontend scope. These four stories were drafted by the CC-023 change proposal
(`sprint-change-proposal-2026-09-30.md`) before CC-024 changed the extraction shape, and no readiness sweep
had covered them (the Epic 3 sweep was 2026-09-11). Every statement below was checked against source,
`sprint-status.yaml`, the architecture spine (AD-28, AD-29, AD-30) and the published `@vladmandic/face-api@1.7.15`
package, not assumed from the wave plan or the proposal.

**Headline:** one new prerequisite story, **0.46** (Provision the AI Processor Lambda's image-processing runtime),
a hard prerequisite for 3.6n only. AC corrections applied to **3.6n** (read path, served-URL precedence, once-per-post
run point, timeout guard) and **3.6p** (multi-event shape, `minEventCount`, `actualScheduleCount` write point), and a
clarification applied to **3.6o**. **3.6m** needs no `epics.md` change, but its already-created story file is stale
against the 3.6s payload shape and must be refreshed before dispatch. Three decisions are reserved for the user at
create-story (backend choice, served-URL precedence, audit-row shape); none is made here.

## Verified facts

- **One post, one AI Processor run.** `process-ai-job.ts` runs once per post. The per-event loop (steps 6–7) builds the
  messages, then step 7.5a re-hosts the image at post level ("one cover image per post … runs unconditionally regardless
  of event count"), and only then does step 8 fan out one `DataIngestionQueue` message per event. So the natural home
  for 3.6n, 3.6o and the 3.6p audit write is that post-level region, before the fan-out. Nothing needs the ingestor.
- **Redelivery re-runs everything.** If any event fails to enqueue after retries, step 8.1 throws, the post is not marked
  extracted, and the whole post re-extracts on `AIProcessingQueue` redelivery. Any new stage re-runs with it. The
  content-versioned key from 3.6q makes a repeated thumbnail upload idempotent; a repeated audit row is intended
  ("one row per extraction attempt").
- **The Lambda has no image-processing runtime.** `AIProcessorLambda` (`festgrid-backend-stack.ts`) sets only
  `timeout: 300s`. No `memorySize` (CDK default 128 MB), no `architecture` (x86_64), and `NodejsFunction` bundling is
  `{ format: CJS }` with esbuild defaults: no `nodeModules`, no `commandHooks`, no asset copying. `sharp` is not a
  dependency of `apps/backend` (only `packages/visual-audit` imports it). No `memorySize`/architecture setting exists
  anywhere in `apps/infrastructure/lib`.
- **AD-28 Rule 3's "pure npm, no native binaries" does not match the package's default entry.**
  `@vladmandic/face-api@1.7.15` has `main: dist/face-api.node.js`, which `require`s the native `@tensorflow/tfjs-node`.
  Its `face-api.node-wasm.js` build uses `@tensorflow/tfjs` + `tfjs-backend-wasm` (the `.wasm` files must be shipped).
  A pure-JS CPU backend is possible via the `esm-nobundle` build but is the slowest. The package is 23.6 MB unpacked;
  the SSD MobileNetV1 weights are `ssd_mobilenetv1_model.bin` (5.6 MB) plus a manifest. And `sharp` itself is native.
- **Queue limits.** Lambda timeout 300 s equals `AIProcessingQueue` visibility timeout 300 s, `maxReceiveCount: 3`
  (then the DLQ). A face-detection stage that runs long costs a full re-extraction (another paid Gemini call) up to three
  times before the post lands in the DLQ.
- **IAM and the media path are already in place.** `aiProcessorLambda` is granted `postMediaBucket.grantPut`,
  `grantDelete` and `postMediaDistribution.grantCreateInvalidation`, and has `POST_MEDIA_BUCKET_NAME`,
  `POST_MEDIA_CDN_DOMAIN` and `POST_MEDIA_DISTRIBUTION_ID`. `buildPostMediaKey` (`packages/domain/src/posts/`) already
  supports the `'thumb'` variant (forces `.jpg`). 3.6q (`review`) delivered both. No gap for thumbnail upload.
- **The extraction shape changed under CC-023.** 3.6s restructured the response to `events[]`. `GeminiExtractionPayload`
  now carries `isEvent`, `events`, `groupingReason`, `groupingRationale`, `minEventCount`; `minScheduleCount` and
  `expectedScheduleNames` moved onto `GeminiEventPayload` (read as `event.minScheduleCount` inside the per-event loop).
  3.6s reserved `hasFaceImage`/`faceImageCount` at the payload root and added neither field.
- **`durableImageUrl` read path.** `events.graphql` declares it on three types, `resolvers.ts` projects
  `posts.durableImageUrl` at seven select sites plus the `Event` field resolver, and `apps/web/src/features/events/mapper.ts`
  and the `EventCard` types consume it. All of it joins `posts` through `events.post_id`, which AD-30 keeps as the primary
  pointer. `resolveServedImageUrl` (`packages/domain`; callers `resolvers.ts`, `EventListView.tsx`, `seed.ts`) returns the
  original while `imageUrlExpiresAt` is in the future, `null` for a non-opted-in account once it expires, else
  `durableImageUrl || imageUrl`.
- **Prerequisite statuses (2026-10-03):** 3.6e `done`; 0.33 `review`; 3.6l `review`; 3.6q `review`; 3.6r, 3.6s `review`;
  3.6t `review`. Standing rule: build against `review`-status prerequisites. 3.6m `ready-for-dev`; 3.6n, 3.6o, 3.6p `backlog`.
- **Next free Epic 0 number is 0.46** (highest is 0.45; no `0-46` key exists in `sprint-status.yaml`, `backlog.yaml`
  or `epics.md`).

## Gate 1 — Architecture / Infrastructure Completeness

### Finding 1 — No image-processing runtime for Story 3.6n (NEW PREREQUISITE: Story 0.46)

3.6n's pipeline (face-api detection, Gaussian blur, `sharp.resize(480, 480)`, JPEG re-encode, S3 upload) runs inside
`AIProcessorLambda`, and its ACs mention no infrastructure change. Against the facts above, the deployed Lambda cannot
run it:

- **Memory.** 128 MB cannot hold the TensorFlow.js SSD MobileNetV1 forward pass on a ~1080px image plus `sharp`. This is
  a configuration gap, not a tuning choice, and it must be sized from a measurement.
- **Native module bundling.** `sharp` needs the platform-matched native binary in the bundle. The current bundling
  config does not do this, so a build that works locally would fail on first invocation in AWS.
- **Model weights.** esbuild copies no non-JS files; the 5.6 MB weights file must be shipped explicitly.
- **TensorFlow.js backend.** The proposal's "pure npm" claim holds only for specific package entries; the default one is
  native. The choice (CPU / WASM / native) changes latency, bundle size and whether AD-28 needs amending.
- **Timeout.** Lambda timeout equals the queue visibility timeout, so an over-long stage multiplies Gemini cost.

This matches Gate 1's "depends on infra that has no IaC/deploy story yet" heuristic, so the runtime becomes its own
prerequisite instead of being absorbed into 3.6n. Per the numbering rule (IaC) it is **Story 0.46**, following the
precedent of 0.27 (notifier Lambda infrastructure) and 0.33 (post-media bucket). It does not gate 3.6m, 3.6o or 3.6p.
The deployment-package-size check (50 MB zipped / 250 MB unzipped) is AC6 of 0.46; it needs a build with the real
dependencies and cannot be answered from the package metadata alone.

### Finding 2 — 3.6n's read path is unowned (CORRECTED in 3.6n)

3.6n widens `prominentPoster` to `durableThumbnailUrl != null`, but no AC exposes `durableThumbnailUrl` through
GraphQL. The surface exists for `durableImageUrl`, so this is a missing field on existing types, not a new API layer,
and it is corrected inside 3.6n, not split out. The story is large (DB column + migration, pipeline stage, GraphQL,
mapper, codegen, UI), so `bmad-create-story`'s size check may still split it.

No other Gate 1 gap: 3.6m and 3.6p stay inside the existing `process-ai-job.ts` / `build-gemini-request.ts` /
`extracted-event.schema.ts` / `schema.ts` layers; 3.6o is a pure comparison inside the same Lambda.

## Gate 3 — Foundational / Cross-Cutting Dependency Completeness (incl. cross-epic reuse)

### Finding 3 — `resolveServedImageUrl` is the named served-URL utility and 3.6n does not name it (CORRECTED in 3.6n)

All serving decisions go through `resolveServedImageUrl`. 3.6n adds a third candidate (`durableThumbnailUrl`) and
AD-28 Rule 7 states only the card's render preference, not what the backend serves while the unblurred original is still
valid. Left unnamed, 3.6n could widen `prominentPoster` in the UI while the resolver keeps returning the unblurred
original or `null`. The correction requires the story to extend the function (or add a sibling) and to state and test
the precedence, including the original-still-valid case. That case is a privacy trade-off, so it is a **user decision at
create-story**.

### Reuse and ownership checks — no gap

- **Cross-epic reuse of image processing.** Searched `epics.md` outside Epic 3 for `sharp`, resize, thumbnail
  generation, face detection and image processing: no other epic or story needs a server-side image-processing
  capability, so 0.46 stays scoped to the AI Processor Lambda and does not need to be generalized.
- **Media key helper and storage.** `buildPostMediaKey`, the S3/CloudFront IAM, env vars and the 7-day cache policy are
  built (3.6q, 0.33). 3.6n should reuse the S3 client seam exported by `rehost-post-image.ts` rather than creating a second.
- **Audit table ownership.** `extraction_audit_logs` is created by 3.6p (first consumer, AD-29). The only other
  writer-to-be is 3.6n/3.6o back-filling `actualFaceDetectionCount`/`faceDetectionSkippedReason` on the same row;
  3.6s's `groupingRationale` is deliberately never persisted. IDEA-051 is its only future reader. No unowned shared table.
- **Migration ordering.** 3.6p's table and 3.6n's `posts.durableThumbnailUrl` column are independent migrations (each
  self-contained, as with AD-31 Rule 5); either order works.

## The pre-flagged CC-023 × CC-024 items — settled

| # | Item | Result |
|---|---|---|
| 1 | Runs once per post, not per event | **Settled.** The post-level region of `process-ai-job.ts` (step 7.5a, before the step-8 fan-out) is the run point for 3.6n/3.6o and the 3.6p write. Written into 3.6n's amendment. Redelivery re-runs it, harmlessly for thumbnails (content-versioned key). |
| 2 | `actualScheduleCount` ownership | **Facts settled, decision reserved for the user at create-story of 3.6p.** The AI Processor does not persist schedules; the ingestor does, asynchronously and per event. Options and cost are in 3.6p's corrections. |
| 3 | Thumbnail follows the primary post after 3.6v | **Settled by design, with a condition.** It follows automatically if `durableThumbnailUrl` is projected from the same joined `posts` row via `events.post_id`, as `durableImageUrl` is. That projection is now an explicit 3.6n AC. |
| 4 | 3.6m story file stale against 3.6s | **Confirmed stale; refresh required before dispatch (see below).** |
| 5 | face-api bundle size vs Lambda limit | **Partly answered.** 23.6 MB unpacked package, 5.6 MB weights, `sharp` is native. The real zipped/unzipped size depends on the backend choice and needs a build, so it is Story 0.46 AC6. |

### 3.6m story file — what is stale

`implementation-artifacts/3-6m-add-hasfaceimage-faceimagecount-self-reported-fields-to-gemini-extraction-schema.md`
was drafted before 3.6s. Its Task 4 anchors the new log "immediately after the existing step 5.5 (Story 3.6l's
incomplete-extraction warning)" and names the new step 5.6. In the as-built file, step 5.5 is the zero-events guard, step
5.6 is the event-cap truncation (a number collision), and 3.6l's check now lives inside the per-event loop. Its Task 3
places the new fields "beside the existing `minScheduleCount`" on `GeminiExtractionPayload`, but `minScheduleCount` now
sits on `GeminiEventPayload`; the new fields belong at the payload root, as 3.6s reserved. The `epics.md` ACs for 3.6m
are unaffected. The story file is not modified by this sweep.

## Per-story verdicts

| Story | Verdict | Reason |
|---|---|---|
| 3.6m (`hasFaceImage`/`faceImageCount` fields) | **READY-WITH-CAVEAT** | Depends only on built stories. The `ready-for-dev` story file must be refreshed against the 3.6s shape (above) before dispatch. |
| 3.6p (`extraction_audit_logs` table and write path) | **READY-WITH-CORRECTION** (applied) | Add `minEventCount` (AD-29 Rule 6); add 3.6s and 3.6r to Depends on; per-event completeness shape and `actualScheduleCount` write point are design decisions for create-story. |
| 3.6n (face detection, blur, thumbnail, `prominentPoster`) | **NOT READY until 0.46** | Hard prerequisite 0.46; four corrections applied (run point, read path, served-URL precedence, timeout guard); backend choice and served-URL precedence are user decisions at create-story. |
| 3.6o (relevance gate) | **READY** (clarification applied) | Gate uses the events kept after truncation; adds a one-row read of `imageUrlExpiresAt`. Needs 3.6n. |

## New prerequisite stories

| Key | `epics.md` section | Classification |
|---|---|---|
| `0-46-provision-the-ai-processor-lambdas-image-processing-runtime` | Story 0.46, after Story 0.45 | Tooling/infrastructure (IaC) → new sequential Epic 0 story |

## Corrections applied to `epics.md`

1. **3.6n:** Depends on adds 0.46; amendment adds the once-per-post run point, the GraphQL/mapper/codegen read path,
   the served-URL precedence requirement, and the timeout guard.
2. **3.6p:** corrections add `minEventCount`, add 3.6s/3.6r to Depends on, and record the per-event shape and
   `actualScheduleCount` write-point decisions.
3. **3.6o:** clarification that "all events" means the events kept after truncation, and the `imageUrlExpiresAt` read.

No `sprint-status.yaml` status changed. One backlog key was added: `0-46-…: backlog`.

## Order to create stories

3.6q (built) → **3.6m** (refresh the story file first) → **3.6p** (decisions on shape and `actualScheduleCount`) →
**0.46** (backend decision) → **3.6n** (served-URL precedence decision) → **3.6o**. 0.46 can run in parallel with 3.6m/3.6p.
