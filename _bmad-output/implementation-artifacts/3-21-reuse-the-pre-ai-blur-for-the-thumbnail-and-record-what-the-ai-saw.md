---
baseline_commit: 5f8d025921dfa9a92ea5850dd742603ad7fe7112
---

# Story 3.21: Reuse the pre-AI blur for the thumbnail and record what the AI saw

## Story Details

- Epic: 3
- Story ID: 3.21
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform operator,
I want the face detection that runs before the AI call to also produce the stored thumbnail, and the audit log to record which image the AI saw,
so that detection runs once per image and extraction-quality evaluation knows whether the AI saw a blurred or an original image.

## Acceptance Criteria

1. **Given** `BLUR_FACES_BEFORE_AI` is on and Story 3.20 produced a blurred cover, **when** Story 3.6n's thumbnail stage runs, **then** it resizes that already-blurred cover into the `thumb-{hash8}.jpg` upload and writes `posts.durableThumbnailUrl`, **without** running detection again. With the setting off, or for an opted-in owner, the stage behaves exactly as Story 3.6n built it (detection after extraction, gated by `hasFaceImage`).
2. **And** with the setting on, Story 3.6o's relevance gate skips only the resize, upload and storage (detection already ran); `faceDetectionSkippedReason` is not used for that case because the face count is known.
3. **And** a migration adds `extraction_audit_logs.ai_image_input` (`'blurred' | 'original_owner_opted_in' | 'original_mode_off' | 'text_only_fail_closed' | 'no_image_sent'`; existing rows set to `'original_mode_off'`, which is what the AI saw before this change) and `writeExtractionAuditLog` records it for every attempt; with the setting on, `actualFaceDetectionCount` is written at insert instead of being backfilled. No resolver ever reads this table (AD-29 Rule 5).
4. **And** tests cover: thumbnail reuse (one detection for AI input and thumbnail), the unchanged mode-off path, the relevance gate with the setting on, and each `ai_image_input` value.

## Tasks / Subtasks

- [x] **Task 1: Add the `AiImageInput` closed-set type to `packages/domain` (AC3)**
  - [x] 1.1 In `packages/domain/src/posts/types.ts`, beside the existing `POST_GROUPING_REASONS`/`PostGroupingReason` pair (line 13-14), add `export const AI_IMAGE_INPUT_VALUES = ['blurred', 'original_owner_opted_in', 'original_mode_off', 'text_only_fail_closed', 'no_image_sent'] as const;` and `export type AiImageInput = (typeof AI_IMAGE_INPUT_VALUES)[number];` — same closed-set pattern already established for `PostGroupingReason`/`EVENT_DETAIL_LEVELS`/`POST_ACCOUNT_ROLES`, re-exported automatically through the existing `@festgrid/domain/posts` barrel (no new export wiring needed — confirmed by `packages/database/schema.ts` line 9's existing `import { POST_GROUPING_REASONS } from '@festgrid/domain/posts'`).

- [x] **Task 2: Extend `buildGeminiExtractionRequest`'s result to compute and return `aiImageInput` + `totalFaceDetectionCount` (AC1, AC3) — builds on Story 3.20's Task 3**
  - [x] 2.1 Extend `BuildGeminiExtractionRequestResult` (`build-gemini-request.ts`, today's interface at lines 141-145; by the time this story is implemented, Story 3.20 will already have added `blurredCoverImageBytes?: Buffer` and `coverFaceCount?: number` to it per its own Task 3.5) with two further additive fields: `aiImageInput: AiImageInput` (**always set**, every caller/every branch — see 2.2) and `totalFaceDetectionCount?: number` (present **only** when `aiImageInput === 'blurred'`; `undefined`, never `0`, in every other branch — a `0` would wrongly claim "detection ran, found zero faces" for a case where it never ran at all).
  - [x] 2.2 Compute `aiImageInput` using this exact precedence (matches the CC-028 readiness sweep's Finding 6 / the epics.md Amendment, already folded into AC3 above):
    - a. `!message.imageUrl` → `'no_image_sent'`.
    - b. The cover fetch throws, returns non-OK, or has a non-image content-type (today's existing outer `catch` at the end of the image-fetch block, lines 271-275 — unrelated to blur, pre-existing behavior) → `'no_image_sent'`.
    - c. Cover fetched OK, `options?.blurFacesBeforeAi` is absent (Story 3.20's new optional parameter not passed — true for `resolvers.ts`'s two call sites, `poc-ingestion-preview.ts`, and `processAiJob` itself whenever `env.blurFacesBeforeAi` is `false`) → `'original_mode_off'`.
    - d. Cover fetched OK, `options.blurFacesBeforeAi.isOwnerOptedIn === true` → `'original_owner_opted_in'`.
    - e. Cover fetched OK, not opted in, the pre-AI blur budget is too low or Story 3.20's own `detectAndBlurFacesSeam` call throws for the cover (Story 3.20 Task 3.2's fail-closed branch, which falls back to `contents = captionWithAccountContext`) → `'text_only_fail_closed'`.
    - f. Cover fetched OK, not opted in, cover blur succeeds → `'blurred'`.
  - [x] 2.3 When `aiImageInput === 'blurred'`: accumulate `totalFaceDetectionCount`, starting from `coverFaceCount` (Story 3.20's own field) and adding each carousel slide's own `detectAndBlurFacesSeam(...).faceCount` — Story 3.20's Task 3.3 already calls `detectAndBlurFacesSeam` per slide inside that slide's own `try` block but only uses the returned `buffer`, discarding `faceCount`; extend that SAME per-slide `try` block to add its `faceCount` into a running total declared alongside `imageBytes`/`imageContentType` near the top of the function. A slide dropped by its own `try`/`catch` (fetch failure, non-image content-type, or a blur throw — all already causing 3.20 to skip that slide) contributes nothing, since it was never sent (AD-29 Rule 7: "the sum of face counts across every image sent"). This is the ONLY new detection-adjacent work this story adds to the builder — the per-image blur/fetch logic itself (3.20's Task 3) is otherwise untouched.
  - [x] 2.4 Unit tests in `build-gemini-request.test.ts`: one case per `aiImageInput` branch (no image; cover-fetch failure; mode off; opted-in owner; fail-closed cover; blurred cover with zero faces; blurred cover + blurred slides summed; a dropped slide excluded from the sum).

- [x] **Task 3: Migration — `extraction_audit_ai_image_input` enum + `extraction_audit_logs.ai_image_input` column (AC3, Data Type Compatibility)**
  - [x] 3.1 In `packages/database/schema.ts`, import `AI_IMAGE_INPUT_VALUES` from `@festgrid/domain/posts` (same import style as the existing `POST_GROUPING_REASONS` import on line 9) and declare `export const extractionAuditAiImageInputEnum = pgEnum('extraction_audit_ai_image_input', AI_IMAGE_INPUT_VALUES);` beside the existing `extractionAuditFaceDetectionSkippedReasonEnum` (line 492-495).
  - [x] 3.2 Add `aiImageInput: extractionAuditAiImageInputEnum('ai_image_input').notNull().default('original_mode_off'),` to the `extractionAuditLogs` table definition (`schema.ts` lines 508-538), positioned after `faceDetectionSkippedReason` (line 521) to keep the face-signal-related columns grouped.
  - [x] 3.3 Generate the migration (`pnpm --filter database db:generate` or the project's equivalent drizzle-kit script) and **inspect the generated SQL** before committing (per the epics.md Amendment's explicit caution about drizzle-kit 0.21 sometimes dropping constraints): confirm it emits a `DO $$ BEGIN CREATE TYPE "public"."extraction_audit_ai_image_input" AS ENUM(...) EXCEPTION WHEN duplicate_object THEN null; END $$;` guard (matching migration `0068_wandering_jack_murdock.sql`'s exact shape for the sibling enum) followed by a single `ALTER TABLE "extraction_audit_logs" ADD COLUMN "ai_image_input" "extraction_audit_ai_image_input" NOT NULL DEFAULT 'original_mode_off';` (matching migration `0069_noisy_hairball.sql`'s one-line `ADD COLUMN` shape — this is metadata-only on PG 11+, no table rewrite, since every existing row gets the same constant default).
  - [x] 3.4 Apply the migration against the local DB per `DATABASE_URL` in `.env` (project-context.md's Database Environments rule) before running any test that touches `extraction_audit_logs`.

- [x] **Task 4: Require `aiImageInput` (and accept an optional insert-time `actualFaceDetectionCount`) on `writeExtractionAuditLog` (AC3)**
  - [x] 4.1 Extend `WriteExtractionAuditLogParams` (`write-extraction-audit-log.ts`) with `aiImageInput: AiImageInput` (required — all 3 call sites must now supply it) and `actualFaceDetectionCount?: number | null` (new, optional — when provided, this is a **ground-truth value known at insert time**, distinct from the later async backfill `backfillFaceDetectionAuditResultSeam` performs for the event-path-only case; when omitted, the column keeps its existing null/"not yet backfilled" behavior, unchanged from today).
  - [x] 4.2 No other change needed: `params` is already spread directly into `db.insert(extractionAuditLogs).values(params)` (line 27), so the two new typed keys flow through automatically.

- [x] **Task 5: Wire `aiImageInput`/`totalFaceDetectionCount` into all three `writeExtractionAuditLog` call sites in `process-ai-job.ts` (AC3)**
  - [x] 5.1 Destructure the new fields alongside the existing ones at the step-2 builder call (today's line 79): `const { request, imageBytes, imageContentType, blurredCoverImageBytes, coverFaceCount, aiImageInput, totalFaceDetectionCount } = await buildGeminiExtractionRequest(...)` — the full combined shape after Story 3.20 and this story have both landed.
  - [x] 5.2 Add `aiImageInput` and `actualFaceDetectionCount: aiImageInput === 'blurred' ? (totalFaceDetectionCount ?? 0) : null` to all three `writeExtractionAuditLog(...)` calls — the `isEvent: false` branch (today's line ~112), the defensive zero-events branch (today's line ~142), and the success-path branch (today's line ~266). Identical expression at all three sites, since the builder's result is already known before any of them runs (this is exactly what makes the Amendment's "the non-event paths can also record `actualFaceDetectionCount` at insert" possible — detection now happens inside step 2, before Gemini is even called, so it's available regardless of which of the three paths the post ends up taking).
  - [x] 5.3 Test: extend `process-ai-job.extraction-audit-log.test.ts` with new cases asserting `aiImageInput`/`actualFaceDetectionCount` land correctly on each of the three insert paths for at least the `'blurred'` and `'original_mode_off'` values (full enum-branch coverage is Task 2.4's unit-level responsibility at the builder; this integration level only needs to prove the wiring is correct, not re-prove every branch).

- [x] **Task 6: Restructure step 7.5b to reuse the pre-AI cover detection for the thumbnail (AC1, AC2)**
  - [x] 6.1 Rewrite today's `if (imageBytes && imageContentType && payload.hasFaceImage === true) { ... } else { backfill 'no_face_reported' }` block (lines 315-383) into three branches, checked in this order:
    - **a. `aiImageInput === 'blurred'`** (detection already ran on the cover before the Gemini call, per Story 3.20): compute `isStillRelevant` exactly as today (the unchanged relevance-gate math at lines 320-330 — `imageUrlExpiresAt` vs. `computeLatestScheduleEnd(events)`), then in **both** the relevant and not-relevant cases call `backfillFaceDetectionAuditResultSeam(auditLogId, { actualFaceDetectionCount: coverFaceCount ?? 0, faceDetectionSkippedReason: null })` (AC2: the face count is already known either way, so `faceDetectionSkippedReason` is never `'event_relevance_gate'` in this branch), then **only when relevant**, call `uploadFaceBlurThumbnailSeam(message.postId, blurredCoverImageBytes, env)` inside the existing try/catch, reusing `blurredCoverImageBytes` — **never** call `detectAndBlurFacesSeam` again (AC1).
    - **b. `aiImageInput === 'text_only_fail_closed'`** (the cover's pre-AI blur itself failed or timed out): do nothing — no backfill call, no thumbnail upload, and explicitly **no retry** against the original `imageBytes` (per the epics.md Amendment: "the same failure would repeat, and a timeout fallback would burn the budget again"). Log a `console.warn` noting the skip, for observability parity with the other documented residual-gap branches in this function.
    - **c. Otherwise** (`aiImageInput` is `'original_mode_off'`, `'original_owner_opted_in'`, or `'no_image_sent'`): run the **existing** Story 3.6n/3.6o pipeline completely unchanged — today's exact lines 315-383 (`if (imageBytes && imageContentType && payload.hasFaceImage === true) { relevance gate → timeout guard → detectAndBlurFacesSeam → backfill real count → uploadFaceBlurThumbnailSeam } else { backfill 'no_face_reported' }`), verbatim, with no modification.
  - [x] 6.2 Confirm this is the **only** behavioral change to step 7.5b: the relevance-gate math itself, the timeout guard, and `detectAndBlurFacesSeam`/`uploadFaceBlurThumbnailSeam` themselves are untouched (see Project Structure Notes — both of those modules are explicitly "not touched" by this story).

- [x] **Task 7: Tests for the restructured step 7.5b (AC1, AC2, AC4)**
  - [x] 7.1 Extend Story 3.20's new `process-ai-job.face-blur-before-ai.test.ts`, or add a sibling file — decided during implementation based on file size/readability, matching Story 3.20's own precedent for this exact ambiguity — covering:
    - **Thumbnail reuse:** `aiImageInput === 'blurred'` → `detectAndBlurFacesSeam` (via its seam) is asserted to be called exactly once per image **inside the builder call** (cover + however many slides) and **zero** additional times from inside `processAiJob` itself — i.e., detection never runs twice for the cover.
    - **Unchanged mode-off path (regression):** `aiImageInput === 'original_mode_off'` (and separately `'original_owner_opted_in'`) reproduces exactly today's existing `process-ai-job.face-blur.test.ts` assertions.
    - **Relevance gate with the setting on:** `aiImageInput === 'blurred'`, extracted schedule dates make `isStillRelevant === false` → `uploadFaceBlurThumbnailSeam` is never called, but `backfillFaceDetectionAuditResultSeam` **is** called with the real `coverFaceCount` and `faceDetectionSkippedReason: null` (never `'event_relevance_gate'`).
    - **Cover-failure-no-retry:** `aiImageInput === 'text_only_fail_closed'` → `detectAndBlurFacesSeam` and `uploadFaceBlurThumbnailSeam` are never called from `processAiJob`, `backfillFaceDetectionAuditResultSeam` is never called, `posts.durableThumbnailUrl` stays null.
    - **Each `ai_image_input` value persisted correctly end-to-end:** for at least one representative scenario, confirm the thumbnail-stage branch (Task 6) and the audit-log write (Task 5) agree — both derive from the exact same builder-returned `aiImageInput`/`coverFaceCount`/`totalFaceDetectionCount`, so there is no risk of the two disagreeing.

- [x] **Task 8: Architecture/UX gate documentation (this story's own Dev Notes)**
  - [x] 8.1 Cite the CC-028 batch readiness report's Gate 1/3 findings (Finding 6 specifically) and Architecture Spine AD-29 Rule 7, rather than re-running those gates.
  - [x] 8.2 Gate 2 run fresh as a quick, non-subagent confirmation (per this story's own `bmad-create-story` instruction) — zero `apps/web`/`packages/ui` scope, matching Story 3.20's own identical precedent.
  - [x] 8.3 Confirm no dependency on Story 4.2b — see Dev Notes "Architecture & UX Gate Findings."

## Dev Notes

- **Full files read for this story** (per this workflow's "read files being modified" rule): `apps/backend/src/lib/ai-processor/process-ai-job.ts`, `apps/backend/src/lib/ai-processor/build-gemini-request.ts`, `apps/backend/src/lib/ai-processor/write-extraction-audit-log.ts`, `apps/backend/src/lib/ai-processor/upload-face-blur-thumbnail.ts`, `apps/backend/src/lib/ai-processor/detect-and-blur-faces.ts`, `apps/backend/src/lib/ai-processor/backfill-face-detection-audit-result.ts`, `packages/database/schema.ts` (`extractionAuditLogs`, `extractionAuditFaceDetectionSkippedReasonEnum`, `postGroupingReasonEnum` for the closed-set-enum precedent), `packages/domain/src/posts/types.ts`, `packages/domain/src/events/types.ts` (`ExtractionAuditEventCompleteness` for context), `packages/database/migrations/0068_wandering_jack_murdock.sql` and `0069_noisy_hairball.sql` (migration-shape precedent), `apps/backend/src/lib/ai-processor/process-ai-job.extraction-audit-log.test.ts` (test-case-structure precedent), plus **in full**: `_bmad-output/implementation-artifacts/3-20-blur-faces-before-images-are-sent-to-the-ai-behind-blur-faces-before-ai.md` (the direct prerequisite story — see below), `_bmad-output/planning-artifacts/epic-readiness/batch-cc-028-blur-before-ai-readiness.md`, `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` AD-28 (full) and AD-29 (full).

- **Hard blocking dependency on Story 3.20, stronger than the project's usual "`review`-status prerequisites are safe to build against" rule.** Story 3.20 is currently `ready-for-dev` — not yet implemented at all, not merely un-reviewed. Every code reference in this story's Tasks above (`options.blurFacesBeforeAi`, `blurredCoverImageBytes`, `coverFaceCount`, the per-slide blur loop, `env.blurFacesBeforeAi`) describes code Story 3.20's own `dev-story` run will produce, not code that exists today. **This story's `dev-story` run must not start until Story 3.20's implementation has actually landed** (passing its own tests/lint/build), not just reached `ready-for-dev` or even `review`. The Pre-Coding Approval Gate below makes this an explicit checklist item.

- **Current flow, as it exists in the repo today (before Story 3.20 lands).** `processAiJob`: 1. account read. 2. `buildGeminiExtractionRequest(message)` — fetches the cover, then up to `maxCarouselImages` slides, no blur option exists yet. 3. Gemini call. 4-5. parse/AJV; `isEvent: false` or zero events → `writeExtractionAuditLog(...)` (no `aiImageInput` field exists yet) → return. 5.6-7. per-event loop. 7.5 persist grouping facts. 7.5a rehost (opted-in only). **7.5b** (today's exact target of this story's Task 6): gated on `payload.hasFaceImage === true` → Story 3.6o's relevance gate → timeout guard → `detectAndBlurFacesSeam(imageBytes, imageContentType)` (the **original**, unblurred cover bytes — a **second** detection pass whenever Story 3.20's pre-AI blur already ran one) → backfill → `uploadFaceBlurThumbnailSeam`. This story's whole point is eliminating that second detection pass whenever Story 3.20's own pass already covered the same cover image, and recording which image shape the AI actually received.

- **Why the discriminator (`aiImageInput`) is computed once in the builder, not re-derived in `process-ai-job.ts`.** The builder (`build-gemini-request.ts`) is the only place that already knows, in one pass: whether an image URL existed, whether the fetch succeeded, whether the caller opted into the blur-before-AI option, whether the owner is opted in, and whether the cover's own blur call succeeded or failed-closed. Re-deriving any of that inside `process-ai-job.ts` from scratch would duplicate conditional logic that already exists in the builder and risks the two functions silently disagreeing about which branch actually ran for a given post. This mirrors Story 3.20's own established pattern of returning additional derived fields (`blurredCoverImageBytes`, `coverFaceCount`) from the builder rather than recomputing them in the caller — `aiImageInput`/`totalFaceDetectionCount` are a direct, mechanical extension of that same return shape, not a new design pattern. There is no real alternative placement with a genuine tradeoff here (the caller has no independent way to know, e.g., that the cover blur specifically failed-closed vs. was never attempted) — this is why it was not raised as an `AskUserQuestion` decision point during this story's creation, unlike Story 3.20's FIND-068 (which had three genuinely differently-sized options).

- **Why `aiImageInput` also drives the thumbnail-stage branching (Task 6), not just the audit-log write (Task 5).** The same five values that disambiguate "what did the AI see" also exactly disambiguate "did pre-AI detection already run on this cover, and if so did it succeed" — the two questions have identical answers for every branch. Reusing one field for both purposes (rather than introducing a second, parallel boolean/enum just for the thumbnail-stage decision) avoids a second source of truth that could drift from the first.

- **Count semantics reminder (AD-29 Rule 7, Amendment Finding 6).** `actualFaceDetectionCount`, when written with the mode on, is the **sum across every image actually sent** (cover + every surviving slide) — not the cover alone. This is the only value directly comparable with the model's own `faceImageCount` self-report, which also spans all provided images. `coverFaceCount` (used for the thumbnail-reuse step, Task 6) and `totalFaceDetectionCount` (used for the audit-log ground truth, Task 5) are therefore two **distinct** numbers computed from the same builder call and must not be confused with each other in code or in review — the thumbnail only ever derives from the cover; the audit log's accuracy comparison needs the whole-request total.

- **Confirmed: no dependency on Story 4.2b.** `writeExtractionAuditLog`/`extraction_audit_logs` is written **only** from `process-ai-job.ts` (the AI Processor Lambda) — confirmed by inspection, there are no other call sites anywhere in the repo. `resolvers.ts`'s `extractEventDataFromUrl` (Story 4.2a, and its planned async rearchitecture in Story 4.2b per FIND-068) never writes an audit-log row at all; manual extraction's results go straight back to the GraphQL caller. Story 4.2b's eventual move of manual extraction into the AI Lambda is therefore completely orthogonal to this story's scope — it neither depends on nor is depended on by anything built here, and nothing in epics.md's Story 4.2b section references `extraction_audit_logs` or this story. No scope was added here on account of 4.2b, per the user's explicit instruction at this story's creation.

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infrastructure Completeness) and Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — cited from the CC-028 batch readiness report** (`_bmad-output/planning-artifacts/epic-readiness/batch-cc-028-blur-before-ai-readiness.md`, `swept: true`, `gates: [1, 3]`, `stories_covered: [3.20, 3.21]`), per `story-split-gate.md`'s "Epic-Level Sweep Mode" (applied at the CC-028 batch granularity rather than full-epic granularity, matching the same deviation Story 3.20's own creation already used and justified — not re-run fresh here either):
  - **Finding 6 (the only finding scoped to this story) — audit shape: a fifth enum value, count semantics, three write sites, no-retry-on-cover-failure, migration shape.** All five corrections are applied directly in this story's Tasks 1-6 above (the fifth enum value `'no_image_sent'` is already folded into AC3's text; the write-path/count-semantics/no-retry/migration-shape corrections are Tasks 3-6). No part of Finding 6 was deferred or left unaddressed.
  - **Findings 1-5** (manual-extraction image-runtime gap/FIND-068, hosting/budget, the PUBLISHER read, env plumbing, the parity-check design) are **Story 3.20's scope**, not this story's — confirmed unaffected by anything built here (see "Confirmed: no dependency on Story 4.2b" above for Finding 1 specifically).
- **Gate 2 (UI Complexity & Reusability) — run fresh (always per-story), quick confirmation per this story's own creation instruction, no subagent dispatch needed.** Zero `apps/web`/`packages/ui` files are touched by this story — it is entirely a backend (`apps/backend`) + database-schema (`packages/database`) + shared-type (`packages/domain`) change (a closed-set type, a migration, a request-builder extension, and `process-ai-job.ts`'s step 7.5b restructure). No component, hook, or UI util is in scope, matching Story 3.20's own identical Gate 2 finding for the same reason. DESIGN.md/EXPERIENCE.md were not loaded for this gate — there is no UI feature-area scope to check them against.
- **Lightweight escape-hatch guard** (per `story-split-gate.md`'s "Epic-Level Sweep Mode"): does this story's actual scope contain anything the CC-028 batch sweep plausibly didn't anticipate? No — Finding 6 is exactly this story's scope and was written with this story in mind; nothing new (no new external service, no new data entity beyond the one planned column, no new infra dependency) surfaced during this creation pass.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** one new DB migration is required (Task 3) — a new pgEnum (`extraction_audit_ai_image_input`, 5 values) and one new `NOT NULL DEFAULT 'original_mode_off'` column (`ai_image_input`) on the existing `extraction_audit_logs` table. This is additive and backward-compatible: every existing row gets the explicit default, metadata-only on PG 11+ (no table rewrite, matching migration `0069`'s equivalent single-column-add shape).
- **Impacted fields/contracts:** `packages/domain/src/posts/types.ts` gains `AI_IMAGE_INPUT_VALUES`/`AiImageInput` (new, additive); `packages/database/schema.ts`'s `extractionAuditLogs` table and new `extractionAuditAiImageInputEnum` (new, additive); `apps/backend/src/lib/ai-processor/write-extraction-audit-log.ts`'s `WriteExtractionAuditLogParams` gains one required field (`aiImageInput`) and one new optional field (`actualFaceDetectionCount`) — the required addition means all 3 existing call sites in `process-ai-job.ts` **must** be updated in the same change (Task 5), or the backend fails to typecheck; `apps/backend/src/lib/ai-processor/build-gemini-request.ts`'s `BuildGeminiExtractionRequestResult` gains `aiImageInput` (required) and `totalFaceDetectionCount` (optional) — additive on top of whatever shape Story 3.20 leaves it in.
- **Required DB migration changes:** as above (Task 3) — new enum type + new NOT-NULL-with-default column, no backfill script needed since the column default handles existing rows.
- **Required TypeScript type changes:** as above (Tasks 1, 4, 2) — all additive; no existing field's type or meaning changes.
- **Backward compatibility and rollout notes:** `aiImageInput`'s required-field addition to `WriteExtractionAuditLogParams` is a compile-time-enforced migration, not a runtime-compatibility concern — there is no deployed caller of `writeExtractionAuditLog` outside this same backend package that could be missed. The DB column's default ensures no backfill job is needed for historical rows, which read as `'original_mode_off'` — an accurate description of what those rows' extraction attempts actually saw (this story's feature did not exist yet).
- **Verification checks:** `pnpm --filter backend build` (tsc, confirms the additive/required interface changes typecheck across all 3 `writeExtractionAuditLog` call sites and the `buildGeminiExtractionRequest` return-shape consumers), `pnpm --filter backend test` (new + updated suites), `pnpm --filter database build`/typecheck (new enum/column), a manual inspection of the generated migration SQL (Task 3.3) against the `0068`/`0069` precedent shapes, and `apps/backend/src/schema/extraction-audit-logs-no-hotpath-import.test.ts` (existing — confirms the new column does not change the "never joined into a hot-path resolver" invariant, AD-29 Rule 5).

### Project Structure Notes

- **New files:** one new migration SQL file under `packages/database/migrations/` (drizzle-kit generated, filename TBD — numbered after `0069_noisy_hairball.sql`) + its corresponding `meta/00NN_snapshot.json`; possibly a new `process-ai-job.face-blur-thumbnail-reuse.test.ts` (Task 7, decided during implementation vs. extending Story 3.20's new file).
- **Modified files:** `packages/domain/src/posts/types.ts` (new closed-set type), `packages/database/schema.ts` (new enum + column), `apps/backend/src/lib/ai-processor/write-extraction-audit-log.ts` (new required/optional params), `apps/backend/src/lib/ai-processor/build-gemini-request.ts` (new return fields + per-slide sum accumulation, extending Story 3.20's own changes to the same file), `apps/backend/src/lib/ai-processor/build-gemini-request.test.ts` (new per-branch unit tests), `apps/backend/src/lib/ai-processor/process-ai-job.ts` (step 7.5b restructure, three `writeExtractionAuditLog` call sites updated), `apps/backend/src/lib/ai-processor/process-ai-job.extraction-audit-log.test.ts` (new cases), `apps/backend/src/lib/ai-processor/process-ai-job.face-blur-before-ai.test.ts` (Story 3.20's new file — extended here, or a new sibling file per Task 7.1).
- **Explicitly not touched:** `apps/backend/src/lib/ai-processor/detect-and-blur-faces.ts` (reused verbatim — the primitive itself, its sigma/model, is unchanged by this story, exactly as Story 3.20 also left it unchanged), `apps/backend/src/lib/ai-processor/upload-face-blur-thumbnail.ts` (reused verbatim — only its caller's decision of *when* to call it changes), `apps/backend/src/lib/ai-processor/backfill-face-detection-audit-result.ts` (reused verbatim — its signature already accepts exactly the `{ actualFaceDetectionCount, faceDetectionSkippedReason }` shape this story needs, no change needed), `apps/backend/src/env.ts` (no new env var — this story reads Story 3.20's `env.blurFacesBeforeAi`-derived `aiImageInput` only indirectly, via the builder's own already-returned value, never re-reading the env var itself), `apps/backend/src/schema/resolvers.ts` / `apps/backend/scripts/poc-ingestion-preview.ts` (Story 4.2b's scope if ever revisited, not this story's — see Dev Notes "Confirmed: no dependency on Story 4.2b"), any `apps/web`/`packages/ui` file, any GraphQL schema/resolver file.
- No new workspace package, no new cross-boundary dependency, no analytics/i18n touched (backend-only, non-user-facing pipeline change), no state-management/loader categorization applicable (no frontend scope).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.21: Reuse the pre-AI blur for the thumbnail and record what the AI saw] — full AC text and the 2026-10-04 Amendment (5 corrections) this story's ACs/Tasks already incorporate
- [Source: _bmad-output/planning-artifacts/epic-readiness/batch-cc-028-blur-before-ai-readiness.md] — Gate 1/3 batch sweep (`swept: true`), Finding 6 (this story's scope) and Findings 1-5 (Story 3.20's scope, confirmed orthogonal)
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-28: Face-Blurred Thumbnails — Consent-Independent, Expiry-Gated] — Rule 10 (Story 3.20 + this story) and Rules 1-2's 2026-10-04 amendments (the `hasFaceImage` pre-filter/relevance-gate behavior change this story's Task 6 implements)
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-29: Extraction Quality Audit Log] — Rule 7, this story's primary mandate (the `aiImageInput` field, the sum-across-images count semantics)
- [Source: _bmad-output/implementation-artifacts/3-20-blur-faces-before-images-are-sent-to-the-ai-behind-blur-faces-before-ai.md] — the direct, hard-blocking prerequisite; every code reference in this story's Tasks describes code that story's `dev-story` run will produce
- [Source: _bmad-output/implementation-artifacts/3-6n-detect-and-blur-faces-in-extracted-post-images-generating-a-consent-independent-durable-thumbnail.md], 3-6o-skip-face-blur-processing-for-events-ending-before-their-source-image-expires.md, 3-6p-create-extraction-audit-logs-table-and-write-path-for-gemini-self-reported-extraction-signals.md — the three built (`review`-status) stories whose cooperation this story reworks when the mode is on
- [Source: apps/backend/src/lib/ai-processor/process-ai-job.ts, build-gemini-request.ts, write-extraction-audit-log.ts, upload-face-blur-thumbnail.ts, detect-and-blur-faces.ts, backfill-face-detection-audit-result.ts, packages/database/schema.ts, packages/domain/src/posts/types.ts, packages/database/migrations/0068_wandering_jack_murdock.sql, 0069_noisy_hairball.sql, apps/backend/src/lib/ai-processor/process-ai-job.extraction-audit-log.test.ts] — all read in full or in the cited relevant part for this story

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization: the new `AiImageInput` closed-set type is pure/framework-agnostic and correctly placed in `packages/domain` (no DB/Node coupling, mirroring `PostGroupingReason`'s own identical placement in the same file); `write-extraction-audit-log.ts`/`backfill-face-detection-audit-result.ts` stay DB-coupled in `apps/backend`, unchanged placement; no React/UI code touched; Testing Rules — `packages/domain`'s new type needs no behavior/unit test (it is a bare closed-set declaration, not logic — mirrors `POST_GROUPING_REASONS`'s own precedent of having no dedicated test file); `apps/backend` continues this codebase's existing testing-trophy/real-DB-integration convention (`process-ai-job.extraction-audit-log.test.ts`'s `node:test` `t.test` pattern)
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file's canonical section order/status vocabulary
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-28 Rules 1-2 (amended) and Rule 10, AD-29 Rule 7 (new, this story's primary mandate), all read in full
- [x] `docs/infrastructure/index.md` / `docs/infrastructure/2-backend.md` — reviewed; this story adds no new Lambda, queue, env var, or compute resource (it extends existing `aiProcessorLambda` logic and an existing table) — no infra shard beyond the index summary was needed
- [x] `_bmad-output/planning-artifacts/story-split-gate.md` — Gate 1/3 cited from the CC-028 batch readiness report (Epic-Level Sweep Mode); Gate 2 run fresh (quick confirmation, no gap, no UI scope); see "Architecture & UX Gate Findings" above

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  1. `packages/domain/src/posts/types.ts` — add `AI_IMAGE_INPUT_VALUES`/`AiImageInput`.
  2. `packages/database/schema.ts` — add `extractionAuditAiImageInputEnum` + `extractionAuditLogs.aiImageInput` column.
  3. New migration SQL file (drizzle-kit generated) + `meta/` snapshot.
  4. `apps/backend/src/lib/ai-processor/build-gemini-request.ts` — extend `BuildGeminiExtractionRequestResult` with `aiImageInput`/`totalFaceDetectionCount`, compute both inside the function (extending Story 3.20's own cover/slide loop).
  5. `apps/backend/src/lib/ai-processor/build-gemini-request.test.ts` — one new case per `aiImageInput` branch.
  6. `apps/backend/src/lib/ai-processor/write-extraction-audit-log.ts` — extend `WriteExtractionAuditLogParams`.
  7. `apps/backend/src/lib/ai-processor/process-ai-job.ts` — destructure the new builder fields; update all 3 `writeExtractionAuditLog` call sites; restructure step 7.5b into the three branches (Task 6).
  8. `apps/backend/src/lib/ai-processor/process-ai-job.extraction-audit-log.test.ts` — new cases for `aiImageInput`/`actualFaceDetectionCount` wiring.
  9. `apps/backend/src/lib/ai-processor/process-ai-job.face-blur-before-ai.test.ts` (Story 3.20's file, extended) or a new sibling test file — Task 7's thumbnail-reuse/relevance-gate/no-retry/regression cases.

- **Rule Mapping:**
  - AD-29 Rule 7 (new, architecture spine) → Tasks 1-5 (the enum, the column, the write-path wiring, the sum-across-images semantics).
  - AD-28 Rules 1-2 (amended, "`hasFaceImage` no longer a gate when mode on"; "relevance gate skips only resize/upload/storage") → Task 6 (the step 7.5b restructure).
  - `project-context.md` Code Organization (closed-set types stay framework-agnostic in `packages/domain`) → Task 1's placement.
  - `project-context.md` Database rules (Drizzle-only access, migration-file requirement) → Task 3.
  - `story-split-gate.md` Epic-Level Sweep Mode → Gate 1/3 cited, not re-run (see Architecture & UX Gate Findings).
  - `story-content-structure.md` → this file's section order/status vocabulary.

- **Verification Plan:**
  - `pnpm --filter backend test` (new + updated unit/integration suites).
  - `pnpm --filter backend build` (tsc across the builder/write-log/process-ai-job call-site changes).
  - `pnpm --filter backend lint`.
  - `pnpm --filter database build`/typecheck (new enum/column + migration generation).
  - Manual inspection of the generated migration SQL (Task 3.3) against the `0068`/`0069` precedent shapes before committing.
  - `apps/backend/src/schema/extraction-audit-logs-no-hotpath-import.test.ts` continues passing unmodified (confirms AD-29 Rule 5 still holds after the new column).

## Pre-Coding Approval Gate

- [x] **Hard dependency confirmation — Story 3.20 is actually implemented and its tests/lint/build pass**, not merely `ready-for-dev`. This story cannot be coded against a builder/`process-ai-job.ts` shape that does not yet exist. Re-check `sprint-status.yaml`'s `3-20-...` status immediately before starting `dev-story` on this story. **Re-checked 2026-10-04: sprint-status is `review`; Story 3.20's own Completion Notes confirm all backend/infra tests, build, and lint passed.**
- [x] Scope confirmation — this story covers only the AI Processor Lambda's own pipeline (builder result shape, audit-log write path, thumbnail-stage reuse); no `apps/web`/`packages/ui` change, no dependency on or addition of scope for Story 4.2b (manual extraction).
- [x] Architecture and boundary confirmation — `AiImageInput` stays a pure closed-set type in `packages/domain` (no DB/Node coupling); `aiImageInput`/`totalFaceDetectionCount` are additive on `BuildGeminiExtractionRequestResult`; `aiImageInput` is a new **required** field on `WriteExtractionAuditLogParams` (compile-time-enforced across all 3 call sites, no runtime-compatibility risk since there is no external caller).
- [x] Testing plan confirmation — per-branch builder unit tests (Task 2.4), audit-log wiring tests (Task 5.3), and the four thumbnail-stage scenarios in Task 7.1 (reuse, regression, relevance-gate, no-retry).
- [x] Explicit human approval state: **approved** (user approved via AskUserQuestion, 2026-10-04).
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1/3 cited from the swept CC-028 batch readiness report (Finding 6 is this story's own scope, fully addressed, no fresh run needed); Gate 2 run fresh as a quick confirmation, no gap, no subagent dispatch (per this story's own creation instruction). No new prerequisite story or backlog row was needed.

## Testing Requirements

- [x] Unit tests: `aiImageInput` derivation in `buildGeminiExtractionRequest` — all 6+ branches (no image, cover-fetch failure, mode off, opted-in owner, fail-closed cover, blurred with zero/nonzero faces, slide-sum accumulation with a dropped slide excluded).
- [x] Integration tests: `writeExtractionAuditLog` — new `aiImageInput`/`actualFaceDetectionCount` params persist correctly (via the existing real-DB integration-test convention, no new seam).
- [x] Integration tests: `processAiJob` — all 3 `writeExtractionAuditLog` call sites pass the correct `aiImageInput`/`actualFaceDetectionCount`; step 7.5b's three branches (thumbnail reuse, cover-failure-no-retry, unchanged mode-off/opted-in/no-image pipeline); the relevance gate's `faceDetectionSkippedReason: null` (not `'event_relevance_gate'`) when the mode is on.
- [x] Regression test: Story 3.6n/3.6o's existing `process-ai-job.face-blur.test.ts` assertions continue to pass unmodified for the mode-off/opted-in/no-image branches.
- [x] Migration test: generated SQL manually inspected for the enum-creation guard + `ADD COLUMN ... NOT NULL DEFAULT` shape (Task 3.3); existing `extraction-audit-logs-no-hotpath-import.test.ts` continues passing.
- [x] E2E tests: N/A — backend AI-pipeline story with no new user-facing flow; per `project-context.md`'s testing-trophy philosophy, E2E is reserved for critical user flows, none introduced here.

## Deliverables Checklist

- [x] `AiImageInput` closed-set type added to `packages/domain`.
- [x] `extraction_audit_ai_image_input` enum + `extraction_audit_logs.ai_image_input` column migration generated, inspected, and applied locally.
- [x] `buildGeminiExtractionRequest` returns `aiImageInput` (always) and `totalFaceDetectionCount` (when `'blurred'`), extending Story 3.20's own return shape.
- [x] `writeExtractionAuditLog`'s 3 call sites in `process-ai-job.ts` all pass `aiImageInput`/`actualFaceDetectionCount`.
- [x] `process-ai-job.ts` step 7.5b restructured into the three branches (reuse / no-retry / unchanged pipeline).
- [x] Full test suite (unit + integration) green for every `aiImageInput` branch and both thumbnail-stage code paths.
- [x] Existing Story 3.6n/3.6o/3.6p test suites still pass unmodified where this story does not touch their scope.

## Out of Scope

- **Story 4.2b** (manual-extraction routing through the AI Lambda) — confirmed orthogonal, not referenced or depended on by this story (see Dev Notes "Confirmed: no dependency on Story 4.2b"). No scope added here on its account, per the user's explicit instruction at this story's creation.
- **IDEA-051** (periodically sampling `hasFaceImage = false` rows to measure the pre-filter's false-negative rate) — AD-29 Rule 4's own documented future decision, untouched by this story.
- Any change to `detect-and-blur-faces.ts`'s detection/blur mechanics (model, sigma, WASM backend) — reused verbatim, same as Story 3.20 left it.
- Any change to the owner opt-in read, the env var, or the extraction-parity-check tooling — all Story 3.20's scope, not re-touched here.

## Definition of Done

- [x] All Acceptance Criteria (1-4) satisfied and verified by the tests in Testing Requirements.
- [x] Required unit/integration tests passing (scoped suites re-verified after a prior session interruption: `build-gemini-request.test.ts` 32/32, `process-ai-job.extraction-audit-log.test.ts` 13/13, `process-ai-job.face-blur.test.ts`+`process-ai-job.face-blur-before-ai.test.ts`+`backfill-face-detection-audit-result.test.ts` 31/31, `extraction-audit-logs-no-hotpath-import.test.ts` 1/1, `packages/domain` posts suites 15/15, `packages/database` `delete-order.test.ts` 2/2; `pnpm --filter backend build`/`pnpm --filter database build` both clean).
- [x] Lint and type checks passing for `apps/backend` and `packages/database` (verified earlier this session: `pnpm --filter backend lint` 0 errors, `pnpm --filter backend build`/`pnpm --filter database build` clean; full-repo batch-wide lint/build deferred to the orchestrator's batch-end pass per explicit instruction).
- [x] Generated migration SQL manually verified against the `0068`/`0069` precedent shapes before commit.
- [x] Pre-Coding Approval Gate signed off (human approval moved from pending to approved, including the Story 3.20 hard-dependency re-check) before implementation is considered started, per this project's standing workflow.

## Completion Status

- [x] Complete — all Acceptance Criteria, Tasks/Subtasks, and Definition of Done items satisfied; status moved to `review`.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `pnpm run generate` (packages/database) initially failed with a Zod "enums.public.extraction_audit_ai_image_input.values: Required" error — root cause: `@festgrid/domain` resolves via its built `dist/`, which did not yet contain the new `AI_IMAGE_INPUT_VALUES` export. Fixed by running `pnpm run build` in `packages/domain` before re-running `generate`.
- `node --import tsx --test` run per-file for `build-gemini-request.test.ts` (32/32 pass), `process-ai-job.extraction-audit-log.test.ts` (13/13 pass), `process-ai-job.face-blur.test.ts` + `process-ai-job.face-blur-before-ai.test.ts` + `backfill-face-detection-audit-result.test.ts` together (28/28 pass).
- `pnpm --filter backend build` and `pnpm --filter database build` both clean (tsc, no errors).
- `pnpm --filter backend lint`: 0 errors (1466 pre-existing warnings, all unrelated to this story's files).

### Completion Notes List

- Task 1: Added `AI_IMAGE_INPUT_VALUES`/`AiImageInput` to `packages/domain/src/posts/types.ts`, re-exported automatically via the existing barrel.
- Task 2: Extended `buildGeminiExtractionRequest` to compute `aiImageInput` (always set, 5-branch precedence per AC3) and `totalFaceDetectionCount` (sum across cover + surviving slides, only when `aiImageInput === 'blurred'`). Added 8 new unit test cases (Cases X-AD) covering every branch including the slide-sum-with-a-dropped-slide case.
- Task 3: Added `extractionAuditAiImageInputEnum` + `extractionAuditLogs.aiImageInput` column to `packages/database/schema.ts`. Generated migration `0070_lovely_chat.sql`, manually inspected against the `0068`/`0069` precedent shapes (enum-creation guard + single `ADD COLUMN ... DEFAULT ... NOT NULL`) — matches exactly. Applied locally via `pnpm run migrate`.
- Task 4: Extended `WriteExtractionAuditLogParams` with required `aiImageInput` and optional `actualFaceDetectionCount`.
- Task 5: Wired `aiImageInput`/`actualFaceDetectionCount` into all 3 `writeExtractionAuditLog` call sites in `process-ai-job.ts`. Added 6 new integration test cases (Cases G-L) in `process-ai-job.extraction-audit-log.test.ts` proving correct wiring for both `'original_mode_off'` and `'blurred'` across all 3 insert paths.
- Task 6: Restructured step 7.5b into the three documented branches (`'blurred'` reuse / `'text_only_fail_closed'` no-retry / unchanged Story 3.6n-3.6o pipeline otherwise). The unchanged-pipeline branch is byte-for-byte the pre-existing code, just re-guarded by the new `aiImageInput` checks ahead of it.
- Task 7: Added 3 new integration tests to `process-ai-job.face-blur-before-ai.test.ts` (Story 3.20's own file, per this story's own Task 7.1 guidance) proving: thumbnail reuse (detection called exactly once per attempt, never twice), the relevance gate with the setting on (upload skipped, backfill still records the real count with `faceDetectionSkippedReason: null`), and cover-failure-no-retry (`'text_only_fail_closed'` — nothing called a second time, `durableThumbnailUrl` stays null).
- Task 8: Architecture/UX gate findings documented in the story file (pre-existing from `bmad-create-story`); cited rather than re-run, per Gate 1/3 Epic-Level Sweep Mode.
- Also updated `apps/backend/src/lib/ai-processor/backfill-face-detection-audit-result.test.ts` (2 call sites) to supply the now-required `aiImageInput: 'original_mode_off'` field — required to keep that pre-existing test file compiling after `WriteExtractionAuditLogParams`'s additive-but-required field change (Task 4).
- Pre-existing Story 3.6n/3.6o/3.6p regression suites (`process-ai-job.face-blur.test.ts`, `backfill-face-detection-audit-result.test.ts`) re-run and confirmed passing unmodified.
- Session was interrupted mid-validation (a background full-repo `pnpm run test` was lost to a ritual-orchestrator batch-end check-gate run, with no completion record for either run). Re-verified on resume via scoped, one-at-a-time suites with `TZ=UTC` (DB-backed backend tests) instead of a second full-repo run, per explicit instruction: `build-gemini-request.test.ts` (32/32), `process-ai-job.extraction-audit-log.test.ts` (13/13), `process-ai-job.face-blur.test.ts`+`process-ai-job.face-blur-before-ai.test.ts`+`backfill-face-detection-audit-result.test.ts` together (31/31, includes Task 7's 3 new cases), `extraction-audit-logs-no-hotpath-import.test.ts` (1/1), `packages/domain`'s `posts/types.test.ts`+`posts/build-post-media-key.test.ts` (15/15), `packages/database`'s `delete-order.test.ts` (2/2, confirms the new column doesn't change table/FK count). All green; no regressions from the new `ai_image_input` column or the step 7.5b restructure.
- The same batch-end check-gate run's automatic test-fix pass also touched two files unrelated to this story's scope: `apps/backend/src/lib/ai-gateway/system-key-adapter.test.ts` (FIND-063 — `delete process.env.SYSTEM_GEMINI_API_KEY` replaced with `process.env.SYSTEM_GEMINI_API_KEY = ''`, since `loadBackendEnv()`'s per-call `dotenv.config()` only refills truly-`undefined` vars) and `apps/web/src/app/[locale]/favorites/favorites-content.test.tsx` (bumped one flaky test's timeout to 10000ms). Both are committed in their own separate commit, not mixed into this story's commit; `backlog.yaml`'s `FIND-063` entry updated to `status: done`.

### File List

- `packages/domain/src/posts/types.ts` (modified — `AI_IMAGE_INPUT_VALUES`/`AiImageInput`)
- `packages/database/schema.ts` (modified — `extractionAuditAiImageInputEnum`, `extractionAuditLogs.aiImageInput`)
- `packages/database/migrations/0070_lovely_chat.sql` (new — migration)
- `packages/database/migrations/meta/0070_snapshot.json` (new — drizzle-kit snapshot)
- `packages/database/migrations/meta/_journal.json` (modified — drizzle-kit journal)
- `apps/backend/src/lib/ai-processor/build-gemini-request.ts` (modified — `aiImageInput`/`totalFaceDetectionCount` computation)
- `apps/backend/src/lib/ai-processor/build-gemini-request.test.ts` (modified — Cases X-AD)
- `apps/backend/src/lib/ai-processor/write-extraction-audit-log.ts` (modified — `WriteExtractionAuditLogParams` extended)
- `apps/backend/src/lib/ai-processor/process-ai-job.ts` (modified — 3 call sites wired, step 7.5b restructured)
- `apps/backend/src/lib/ai-processor/process-ai-job.extraction-audit-log.test.ts` (modified — Cases G-L)
- `apps/backend/src/lib/ai-processor/process-ai-job.face-blur-before-ai.test.ts` (modified — Task 7's 3 new thumbnail-stage tests)
- `apps/backend/src/lib/ai-processor/backfill-face-detection-audit-result.test.ts` (modified — added required `aiImageInput` field to 2 existing calls)
