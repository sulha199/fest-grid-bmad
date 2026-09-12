---
baseline_commit: 7ea8b3450f3b0f57d0efc8de440a7d43cc0c2f89
---

# Story 3.6l: Extract events from multi-image carousel posts using a single batched Gemini request

## Story Details

- Epic: 3
- Story ID: 3.6l
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system,
I want to include every additional carousel image (Story 3.3e's `additionalImageUrls`, up to a configurable cap) as extra parts of the same Gemini extraction request Story 3.6 already makes — not a sequence of separate re-trigger calls,
so that schedule information living on a later slide is found, without multiplying the number of Gemini requests against the account's RPM/RPD quota.

## Acceptance Criteria

1. **Given** a `ProcessingJobMessage` has one or more `additionalImageUrls` (Story 3.3e, already wired through `enqueuePostForProcessing`), **when** `buildGeminiExtractionRequest` builds the request, **then** it fetches up to `MAX_CAROUSEL_IMAGES` (new env var, default `5`) of those additional images — in slide order, stopping at the cap — and appends each as its own `inlineData` part to the **same** `contents` array as the existing cover-image part, after it (`[text, coverImage, slide1, slide2, ...]`).
2. **Given** a fetch for one particular additional slide fails (non-2xx, non-image content-type, or throws), **when** that slide is being fetched, **then** only that slide is skipped (logged, best-effort) — the cover image and every other successfully-fetched slide remain in the request. A slide-fetch failure must never trigger the existing text-only fallback that today only exists for a **cover-image** fetch failure.
3. **Given** any additional images were sent, **when** the system prompt (`systemInstruction`) is built, **then** it explicitly instructs the model that multiple images are sequential slides of one post (in order), that schedule information may be split across slides, and that it must merge/attribute information about the same event into one `schedules` entry rather than treating each image as a separate or competing event.
4. **Given** the Gemini response, **when** the response schema (`geminiExtractionResponseSchema`, the Gemini-side schema — distinct from the AJV `extractedEventSchema`) is built, **then** it gains two new **optional**, model-self-reported fields: `minScheduleCount` (number) and `expectedScheduleNames` (string array) — neither is added to the schema's `required` list.
5. **Given** `payload.isEvent === true` and the model returned a `minScheduleCount`, **when** `processAiJob` receives the parsed/AJV-validated payload and `payload.schedules.length < payload.minScheduleCount`, **then** it logs a warning (post ID, `minScheduleCount` vs. actual `schedules.length`, `expectedScheduleNames`) for moderator visibility — this is a **logging signal only**: no additional Gemini call, no automatic re-trigger, and neither new field is persisted anywhere (not on `ExtractedEventMessage`, not on any DB table).
6. **Given** `payload.isEvent === false`, or `minScheduleCount` is absent from the response, **when** `processAiJob` runs, **then** no incomplete-extraction log is emitted (nothing to compare against).
7. **Given** an opted-in account's post with a successfully-rehosted cover image, **when** the request includes additional carousel-slide images, **then** `rehostPostImageSeam` (Story 3.6e/3.6h) is called with only the cover image's `imageBytes`/`imageContentType` exactly as today — additional slide bytes are never passed to it and never durably stored (AD-13 rule 2; distinct from AD-12's cover-image treatment).
8. **Regression fixture (mocked, always runs in `npm test`):** a unit test on `buildGeminiExtractionRequest` using the real `laridijogja` carousel's actual Apify shape and image URLs (already captured in `_bmad-output/implementation-artifacts/backlog/IDEA-001-multislide-extraction.md`) proves the multi-image request is assembled correctly (order, cap enforcement, per-slide failure resilience) — see Dev Notes "Testing Strategy" for exactly what this does and does not prove. Plus an integration test on `processAiJob` (real DB, `callGeminiSeam` mocked to return the human-verified ground-truth schedules already recorded at the bottom of that same backlog file) proving those schedules — however obtained — flow correctly to the `DataIngestionQueue` hand-off, and that the incomplete-extraction log fires/does not fire correctly.
9. **Opt-in live smoke test (never runs in normal `npm test`/CI, explicit `AskUserQuestion` decision — see Dev Notes):** a separate test, skipped via `t.skip()` unless a `RUN_LIVE_GEMINI_TESTS=true` env var **and** `SYSTEM_GEMINI_API_KEY` are both set, that calls the real Gemini API with the real carousel image URLs from the same fixture and checks the actual model output contains schedules matching the human-verified ground truth. See Dev Notes for the known image-URL-staleness caveat.
10. **i18n:** N/A — this story is entirely backend/pipeline (prompt engineering, request construction, structured logging). No user-facing string is added or changed. (Confirmed no UI/GraphQL/DB-displayed surface exists anywhere in this story's scope — see "Architecture & UX Gate Findings" below.)

## Tasks / Subtasks

- [ ] **Task 1 (AC1, AC2): Add `maxCarouselImages` to `BackendEnv` and fetch additional carousel images in `buildGeminiExtractionRequest`**
  - [ ] `apps/backend/src/env.ts`: add `maxCarouselImages: number;` to the `BackendEnv` interface and `maxCarouselImages: parseInt(process.env.MAX_CAROUSEL_IMAGES || '5', 10),` to the loader, following the exact existing pattern (e.g. `scrapeResultsLimit`) including the `// eslint-disable-next-line turbo/no-undeclared-env-vars` comment.
  - [ ] `apps/backend/src/lib/ai-processor/build-gemini-request.ts`: import `loadBackendEnv` (already imported project-wide via `../../env.js`; this file does not import it yet — add it).
  - [ ] Inside the existing `if (message.imageUrl) { try { ... } }` block, after the cover image's `inlineData` part is built, if `message.additionalImageUrls?.length`, iterate `message.additionalImageUrls.slice(0, env.maxCarouselImages)` **in order** and, for each slide URL, `fetch` it inside its **own** `try/catch` (not the outer one) — on success push `{ inlineData: { mimeType, data: base64 } }` to the same `contents` array; on any failure (non-ok status, non-`image/*` content-type, or thrown error) `console.error` and skip that one slide only, continuing the loop. **Critical implementation guardrail:** the per-slide catch must not `throw` or otherwise cause the outer `catch` (the one that falls back to text-only `contents = captionWithAccountContext`) to fire — a slide failure must never wipe out the cover image that already succeeded. Verify by re-reading the existing outer catch's fallback behavior (lines ~116-120 today) before making this change; it must remain reachable only by a **cover**-image failure.
  - [ ] `contents` when any additional slides succeed ends up as `[{text}, {inlineData: cover}, {inlineData: slide1}, ...]` — array order must exactly match slide order minus any skipped slides.

- [ ] **Task 2 (AC3): Amend the system prompt for multi-slide instructions**
  - [ ] Add a new numbered instruction to `systemInstruction` in `build-gemini-request.ts` (after the existing 9 numbered points) explaining: when multiple images are provided, they are sequential slides of one social media post in order; schedule information may be split across slides; extract and merge schedules describing the same event from across all provided images into one combined `schedules` array rather than treating each image as a separate/competing event.
  - [ ] Add a second new numbered instruction directing the model to also self-report `minScheduleCount` (best-effort count of distinct schedules/events the caption + all provided images appear to describe, whether or not every field was extractable) and `expectedScheduleNames` (name/title text for schedules it can identify even if other fields couldn't be extracted).
  - [ ] These instructions must read sensibly for the **single-image** case too (no additional images) — do not word them in a way that implies multiple images are always present.

- [ ] **Task 3 (AC4): Extend the Gemini-side response schema**
  - [ ] `geminiExtractionResponseSchema` (Google's schema format, `type: 'OBJECT'`/`'NUMBER'`/`'ARRAY'`/`'STRING'`, distinct from the AJV schema) in `build-gemini-request.ts`: add `minScheduleCount: { type: 'NUMBER' }` and `expectedScheduleNames: { type: 'ARRAY', items: { type: 'STRING' } }` as top-level properties, alongside existing ones like `confidenceScore`. Do **not** add either to the `required` array.

- [ ] **Task 4 (AC4, Data Type Compatibility): Extend `GeminiExtractionPayload` and the AJV `extractedEventSchema` together — load-bearing, not cosmetic**
  - [ ] `packages/domain/src/events/types.ts`: add `minScheduleCount?: number;` and `expectedScheduleNames?: string[];` to the `GeminiExtractionPayload` interface (do not add to `ExtractedEventMessage`, `EventInsertValues`, or any DB-facing type — these two fields are logging-only per AC5, never persisted).
  - [ ] `apps/backend/src/validation/extracted-event.schema.ts`: add matching `minScheduleCount: { type: 'number', nullable: true }` and `expectedScheduleNames: { type: 'array', items: { type: 'string' }, nullable: true }` properties to `extractedEventSchema`, following the exact existing `hasPrivateContact`/`performers` pattern (optional in TS ⇒ `nullable: true` in `JSONSchemaType`, absent from `required`). **This is load-bearing:** `extractedEventSchema` has `additionalProperties: false`. Once Task 3's Gemini-side schema starts asking the model for these two fields, every real Gemini response that includes them would fail AJV validation and get silently dropped (the existing `if (!isValid) { console.error(...); return; }` branch at `process-ai-job.ts` step 4) unless this schema is updated in the same change — mirroring the exact failure mode Story 3.3e's Task 1 called out for `scrapedPostSchema`.

- [ ] **Task 5 (AC5, AC6): Log the incomplete-extraction signal in `processAiJob`**
  - [ ] `apps/backend/src/lib/ai-processor/process-ai-job.ts`: immediately after step 5's "if not an event, mark extracted and return" block (i.e. only reached when `payload.isEvent === true`), add: if `payload.minScheduleCount !== undefined && payload.schedules.length < payload.minScheduleCount`, `console.warn` a message including `message.postId`, `payload.schedules.length`, `payload.minScheduleCount`, and `payload.expectedScheduleNames` (default to `[]` if absent). No other behavior changes — the function continues to step 6 unchanged either way.

- [ ] **Task 6 (AC7 — regression guard, no code change expected): Confirm `rehostPostImageSeam` call site is unaffected**
  - [ ] Re-read the existing step 7.5 rehost call in `process-ai-job.ts` after Task 5's edit lands — confirm it still passes only `imageBytes`/`imageContentType` (the cover image's, returned from `buildGeminiExtractionRequest`'s `BuildGeminiExtractionRequestResult`) and that Task 1 did not change what that function returns for those two fields (it must keep returning only the cover image's bytes/type, never a slide's). Add an explicit assertion for this to the regression test in Task 7 rather than relying on manual inspection alone.

- [ ] **Task 7 (AC8): Mocked regression tests**
  - [ ] In `apps/backend/src/lib/ai-processor/build-gemini-request.test.ts`, add new `t.test` cases (following the file's existing `Case A`.. `Case H` convention) using the real `laridijogja` post's actual `displayUrl`/`childPosts[].displayUrl` values from `_bmad-output/implementation-artifacts/backlog/IDEA-001-multislide-extraction.md` as the fixture URLs (mock `globalThis.fetch` per-URL, returning distinct fake bytes per slide so each part is distinguishable in assertions):
    - Multi-image success: cover + N additional slides (N ≤ default cap) → `contents` array has `2 + N` entries in the correct order, and `imageBytes`/`imageContentType` on the returned result are still the **cover image's** only (Task 6's assertion).
    - Cap enforcement: more `additionalImageUrls` supplied than `MAX_CAROUSEL_IMAGES` (temporarily set `process.env.MAX_CAROUSEL_IMAGES` for the test, restore in `t.afterEach`) → only the first N slides up to the cap appear, in order.
    - Per-slide failure resilience: one slide (middle of the list) returns a failing fetch (403 or a non-image content-type) → that slide is omitted, cover image and the other successful slides remain, and the overall `contents` is **not** the text-only fallback.
    - Prompt content: assert `systemInstruction` contains the new multi-slide-sequential-slides guidance and mentions `minScheduleCount`/`expectedScheduleNames`.
  - [ ] Add a new dedicated test file `apps/backend/src/lib/ai-processor/process-ai-job.carousel-completeness.test.ts` (matching the existing `process-ai-job.multi-subscriber-quota.test.ts` precedent of a focused dedicated file rather than growing the main `process-ai-job.test.ts`), using the same real-DB seeded-profile/subscription setup as `process-ai-job.test.ts`:
    - `setCallGeminiSeam` returns a payload built from a representative subset (3-5 entries) of the human-verified ground-truth events at the bottom of `IDEA-001-multislide-extraction.md`, with `minScheduleCount` set higher than the number of schedules actually included (e.g. ground truth has ~30 events, seam returns only 3) — assert (`t.mock.method(console, 'warn', () => {})`, matching the existing `record-actor-run.test.ts`/`scraper-audit-integration.test.ts` precedent for mocking console methods) that the warning fires with the right post ID / counts / names, and that the mocked schedules still reach the `DataIngestionQueue` hand-off (`setSendSqsMessage`/inline-fallback spy, matching `process-ai-job.test.ts`'s existing assertions) unmodified.
    - A second case: `minScheduleCount` absent from the seam's returned payload → no warning logged (AC6).
    - A third case: `payload.isEvent: false` with a `minScheduleCount` present anyway → no warning logged (AC6 — guards against a naive comparison that ignores `isEvent`).

- [ ] **Task 8 (AC9): Opt-in live smoke test**
  - [ ] New test file `apps/backend/src/lib/ai-processor/build-gemini-request.live-carousel.test.ts`. At the top of the test body (inside the `t.test`, not as a file-level guard, so `npm test`'s file glob still picks up and reports the file without erroring), check `if (process.env.RUN_LIVE_GEMINI_TESTS !== 'true' || !process.env.SYSTEM_GEMINI_API_KEY) { t.skip('RUN_LIVE_GEMINI_TESTS/SYSTEM_GEMINI_API_KEY not set — live Gemini smoke test opted out'); return; }`.
  - [ ] When not skipped: build a `ProcessingJobMessage` from the real `laridijogja` fixture (cover `displayUrl` + `childPosts[].displayUrl` as `additionalImageUrls`), call `buildGeminiExtractionRequest`, then call the real `callGeminiGenerateContent` (`apps/backend/src/lib/ai-gateway/gemini-client.ts`) directly with `process.env.SYSTEM_GEMINI_API_KEY`, parse the JSON response, and assert at least one returned schedule's `title` (fuzzy-matched, e.g. substring/keyword match — Gemini's exact wording will not byte-match the ground truth) corresponds to one of the human-verified event names in the ground-truth list (e.g. one of "Pink Ribbon Run", "K24 Healthy Run", "Erafone Run", etc.).
  - [ ] **Document the known caveat inline as a code comment**, not just here: the fixture's Instagram CDN image URLs are signed with an expiry (`oe=` query param) and were captured 2026-09-04 — they may already be expired by the time this test runs. If the image fetch itself fails (caught by Task 1's per-slide/cover try/catch, degrading to fewer images or text-only), this test should fail with a clear assertion message distinguishing "images fetched but model didn't find the schedules" from "images could not be fetched (fixture URLs likely stale — needs a fresh Apify capture to keep this test meaningful)" rather than an opaque assertion failure.

- [ ] **Task 9: Full verification pass**
  - [ ] `pnpm --filter backend test` (or the monorepo equivalent) — full backend suite green, including the new files from Tasks 7-8 (Task 8's test skips cleanly without `RUN_LIVE_GEMINI_TESTS`/`SYSTEM_GEMINI_API_KEY` set).
  - [ ] `pnpm --filter backend lint` / `pnpm --filter backend build` (or monorepo equivalents) clean for `apps/backend` and `packages/domain`.
  - [ ] Manually confirm (read the diff) that no DB migration, GraphQL SDL change, or frontend file was touched — this story has none of those (see "Architecture & UX Gate Findings").

## Dev Notes

- This story is **entirely backend/pipeline** — `apps/backend/src/lib/ai-processor/build-gemini-request.ts` (prompt + request construction) and `apps/backend/src/lib/ai-processor/process-ai-job.ts` (post-response logging), plus the shared `GeminiExtractionPayload` type (`packages/domain`) and its AJV mirror (`apps/backend/src/validation/extracted-event.schema.ts`). No GraphQL schema change, no new DB column (Story 3.3e already added `posts.additional_image_urls` and threaded it through `ProcessingJobMessage`), no frontend file.
- **Dependencies are already fully shipped in code**, confirmed by direct file read + `git log`, not assumed:
  - Story 3.3e (`31b92de feat(backend): persist all carousel image URLs for scraped posts`) — `posts.additional_image_urls` (jsonb, nullable), `ScrapedPost.additionalImageUrls`, and `ProcessingJobMessage.additionalImageUrls` (`packages/domain/src/posts/types.ts`) all already exist and are already populated by `enqueuePostForProcessing`. This story only needs to **consume** `message.additionalImageUrls` — no upstream plumbing work needed.
  - Stories 3.6i (`5061e02`) and 3.6j (`9e4b897`) — the `hasPrivateContact` classification and performer-contact/photo exclusion instructions are **already present** in the current `build-gemini-request.ts` system prompt on `master`. The sprint-status.yaml note flagging "coordinate merge order with in-flight 3-6i/3-6j/3-6k (same build-gemini-request.ts prompt file)" is now moot — those stories already landed and this story's prompt edit (Task 2) is a pure addition after their existing numbered instructions, not a merge/rebase.
  - Story 3-6k (`576983f`) — its children's-data keyword filter operates in `packages/domain`'s `transformGeminiResponseToEventInfo` (post-response, ingestion-time), not in `build-gemini-request.ts`'s prompt/schema — no overlap with this story's edits.

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3:** Cited from `_bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md` (`swept: true`, re-run 2026-09-11, `stories_covered` explicitly includes `3-6l`) — no blocking layering gap and no foundational/cross-cutting dependency gap found for Epic 3 at its full ~53-story scope. The report's one confirmed gap (Apify outage alerting, → new Story 3-4r) is unrelated to this story's scope. Per this epic's swept status, Gate 1/3 were **not** re-run fresh for this story (per `story-split-gate.md`'s Epic-Level Sweep Mode).
  - **Lightweight escape-hatch guard (performed instead of a fresh Gate 1/3 run):** does this story introduce anything the epic-wide sweep couldn't have anticipated (new external service, new data entity, new infra dependency)? No — it adds zero new external services (still only Gemini, already covered), zero new DB tables/columns (Story 3.3e already added the one column this story reads), and zero new infra (no new IAM grant, no new queue, no new Lambda). The `MAX_CAROUSEL_IMAGES` cap keeps the AI Processor Lambda inside its existing 300s timeout (AD-13's own stated rationale), so no infra/timeout-configuration change is implied either. Sweep coverage confirmed sufficient — no fresh Gate 1/3 run needed.
- **Gate 2:** Run fresh via a one-shot UX-lens analysis (per `story-split-gate.md` — Gate 2 stays per-story even under epic-sweep mode). **No gap found.** This story has zero UI surface: no GraphQL field, no resolver, no React component, no page — confirmed independently by (a) this story's own AC list, (b) the originating `sprint-change-proposal-2026-09-03-carousel-multi-image-extraction.md`'s own explicit line "UI/UX: none — fully backend/pipeline change," and (c) a fresh UX-lens review during this story's creation, which concluded splitting out a UI story here "would be manufacturing scope that doesn't exist."
- **No prerequisite stories or `sprint-status.yaml`/`epics.md` entries were added by this story's creation** — all three gates cleared with no gap.

### Design Decisions Confirmed With The User (`AskUserQuestion`, during this story's creation)

- **Regression test strategy (AC8/AC9):** every existing test that touches Gemini in this codebase (`build-gemini-request.test.ts`, `process-ai-job.test.ts`, `system-key-adapter.test.ts`) mocks the Gemini call entirely via the `callGeminiSeam`/`callGeminiGenerateContent` seams — there is zero precedent for a test that calls the real Gemini API. The epics.md AC's literal wording ("confirms schedules are extracted from the non-cover image(s)") could be read as requiring a live model call, which would be non-deterministic, burn real API quota, and never run in CI. Presented as a two-option tradeoff; **user chose to add an opt-in live smoke test on top of the mocked regression suite**, not to rely on mocked tests alone. Resulting scope: Task 7 (always-on, mocked, proves the request-construction/response-handling plumbing) **plus** Task 8 (opt-in via `RUN_LIVE_GEMINI_TESTS=true` + `SYSTEM_GEMINI_API_KEY`, proves genuine model extraction from the real fixture images, never runs in default `npm test`/CI). Task 8 carries a documented caveat: the fixture's Instagram CDN image URLs are signed and expire, so the live test may need a fresh Apify capture to stay meaningful over time — this is inherent to testing against real external image URLs, not a defect in this story's design.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** A real, load-bearing mismatch would be introduced if only the Gemini-side response schema (Task 3) were updated without also updating the AJV validation schema (Task 4) — see Task 4's note. No DB-level mismatch: no schema/migration change in this story at all.
- **Impacted fields/contracts:** `GeminiExtractionPayload` (`packages/domain/src/events/types.ts`) gains `minScheduleCount?: number` and `expectedScheduleNames?: string[]`; `extractedEventSchema` (`apps/backend/src/validation/extracted-event.schema.ts`, `JSONSchemaType<GeminiExtractionPayload>`, `additionalProperties: false`) must declare both as `nullable: true`, non-required properties in the same change.
- **Required DB migration changes:** None. `posts.additional_image_urls` (jsonb) already exists (Story 3.3e). No new column.
- **Required TypeScript type changes:** `GeminiExtractionPayload` (above). Explicitly **not** added to `ExtractedEventMessage`, `EventInsertValues`, `ScheduleInsertValues`, or any other DB-facing/persisted type — both new fields are logging-only (AC5) and must not leak further into the pipeline.
- **Backward compatibility and rollout notes:** Both new Gemini-schema/payload fields are optional/additive. A Gemini response that omits them (e.g. before this change is fully deployed, or if the model simply doesn't populate them) continues to validate and process exactly as today — `processAiJob`'s new logging branch is guarded by `payload.minScheduleCount !== undefined`.
- **Verification checks:** Task 4's AJV-schema update is exercised implicitly by Task 7's mocked `processAiJob` integration test (a payload carrying `minScheduleCount`/`expectedScheduleNames` must pass AJV validation, not get silently dropped) — the test suite should include at least one assertion that a payload with these two new fields present is accepted, not rejected, by `compileValidator<GeminiExtractionPayload>(extractedEventSchema)`.

### Project Structure Notes

- No new package/module boundary introduced. Files touched already live in their established homes (`apps/backend/src/lib/ai-processor/`, `apps/backend/src/validation/`, `apps/backend/src/env.ts`, `packages/domain/src/events/types.ts`) — no `packages/domain` DB/Node-dependency concern applies here (these are pure type additions, no new imports).
- No new reusable UI component or `packages/domain` mechanism is introduced by this story (see Gate 2 finding above) — the persistent project-context facts about placing reusable UI in `packages/ui` / reusable mechanisms in `packages/domain` do not apply to this story's scope.
- No PostHog analytics event, no i18n locale key, no SETUP_WALKTHROUGH.md update, no new cloud/external service — this story adds zero new external dependencies (still Gemini only, already provisioned).

### Testing Strategy — what each test layer proves and does not prove

- **Task 7 (mocked, always-on):** proves the *plumbing* — that `buildGeminiExtractionRequest` correctly assembles a multi-part request from `additionalImageUrls` (order, cap, per-slide resilience), and that whatever schedules a Gemini response contains (real or, in this test, a stand-in for real) flow correctly through `processAiJob` to the `DataIngestionQueue`, including the new completeness-logging branch. It does **not** prove the actual Gemini model can find schedule information on a non-cover slide — that is a property of the model and the prompt, not of this codebase's plumbing, and cannot be deterministically asserted without a live call.
- **Task 8 (opt-in live smoke test):** the only layer that exercises genuine model behavior against the real fixture images. Intentionally excluded from default `npm test`/CI because it is non-deterministic (LLM output), consumes real API quota, and depends on external image URLs that expire over time.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.6l] — original AC list, Note, Cross-reference.
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.3e] — `additionalImageUrls` field this story consumes.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-13] — binding rule: batched not sequential, extraction-time-only/never-durable, completeness-is-a-signal-not-a-driver.
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-09-03-carousel-multi-image-extraction.md] — full research/rationale (Gemini RPM/RPD/TPM quota research), "UI/UX: none" confirmation.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md] — Gate 1/3 epic-wide sweep, `swept: true`, `3-6l` in `stories_covered`.
- [Source: _bmad-output/implementation-artifacts/backlog/IDEA-001-multislide-extraction.md] — the real `laridijogja` carousel fixture (Apify JSON shape, image URLs) and human-verified ground-truth extracted events used by Tasks 7-8's tests.
- [Source: apps/backend/src/lib/ai-processor/build-gemini-request.ts] — file this story edits; current state already includes Stories 3.6i/3.6j's prompt additions.
- [Source: apps/backend/src/lib/ai-processor/process-ai-job.ts] — file this story edits.
- [Source: apps/backend/src/env.ts] — `BackendEnv` pattern this story's `maxCarouselImages` follows.
- [Source: _bmad-output/implementation-artifacts/3-3e-persist-all-carousel-image-urls-for-a-scraped-post.md] — dependency story; confirms `additionalImageUrls` is already fully plumbed through to `ProcessingJobMessage`.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Technology Stack, Adapter Pattern, Testing Rules (Vitest/msw "testing trophy" philosophy — this backend package specifically uses Node's built-in `node:test`, its own established convention, not Vitest; no deviation introduced by this story).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order and status vocabulary followed.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-13 (this story's binding architecture rule).
- [x] `docs/infrastructure/index.md` / `docs/infrastructure/2-backend.md` — AI Processor Lambda's fixed 300s timeout (this story's `MAX_CAROUSEL_IMAGES` cap exists specifically to stay inside it, per AD-13's own rationale and Story 3.4f's precedent). No infra/CDK change required by this story.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - `apps/backend/src/env.ts` (modify — add `maxCarouselImages`)
  - `apps/backend/src/lib/ai-processor/build-gemini-request.ts` (modify — multi-image fetch/batch, prompt, Gemini-side response schema)
  - `apps/backend/src/lib/ai-processor/build-gemini-request.test.ts` (modify — new mocked multi-image cases)
  - `apps/backend/src/lib/ai-processor/build-gemini-request.live-carousel.test.ts` (new — opt-in live smoke test)
  - `apps/backend/src/lib/ai-processor/process-ai-job.ts` (modify — incomplete-extraction logging)
  - `apps/backend/src/lib/ai-processor/process-ai-job.carousel-completeness.test.ts` (new — mocked integration tests)
  - `packages/domain/src/events/types.ts` (modify — `GeminiExtractionPayload` optional fields)
  - `apps/backend/src/validation/extracted-event.schema.ts` (modify — matching AJV properties, load-bearing)
- **Rule Mapping:**
  - AD-13 rules 1-3 (batched single request, extraction-time-only/never-durable, completeness-is-signal-not-driver) → Tasks 1-3, 5, 6.
  - `story-split-gate.md` Gate 1/2/3 discipline (epic-sweep citation + lightweight guard for Gate 1/3, fresh one-shot check for Gate 2) → Dev Notes "Architecture & UX Gate Findings".
  - Data-type-compatibility persistent fact (mismatch/no-mismatch section always included) → Dev Notes "Data Type Compatibility & Migration Requirements" + Task 4.
  - `AskUserQuestion`-before-drafting persistent fact (real, non-mechanical tradeoff surfaced) → Dev Notes "Design Decisions Confirmed With The User".
- **Verification Plan:**
  - `pnpm --filter backend test` — all of Task 7's mocked cases pass; Task 8's live test skips cleanly by default.
  - `pnpm --filter backend lint` / `tsc` build clean for `apps/backend` and `packages/domain`.
  - Manual diff review confirming no DB migration, GraphQL SDL, or frontend file changed.
  - Optional, explicit opt-in run: `RUN_LIVE_GEMINI_TESTS=true SYSTEM_GEMINI_API_KEY=<key> pnpm --filter backend test` to exercise Task 8 against the real fixture (accepting the documented URL-staleness risk).

## Pre-Coding Approval Gate

- [ ] Scope confirmation — backend-only extension of `build-gemini-request.ts`/`process-ai-job.ts`; no DB migration; no GraphQL/UI change.
- [ ] Architecture and boundary confirmation — AD-13 compliance (batched not sequential; extraction-time-only, never durable; completeness is a logging signal only).
- [ ] Testing plan confirmation — mocked regression suite (Task 7, always-on) plus opt-in live smoke test (Task 8, user-confirmed scope addition).
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — all three gates cleared with no gap; nothing pending.

## Testing Requirements

- [ ] Unit tests: `build-gemini-request.test.ts` new cases (multi-image success, cap enforcement, per-slide failure resilience, prompt content) — Task 7.
- [ ] Integration tests: `process-ai-job.carousel-completeness.test.ts` (real DB, mocked `callGeminiSeam`) — incomplete-extraction logging fires/doesn't fire correctly, schedules flow to `DataIngestionQueue` unmodified, AJV accepts the two new optional fields — Task 7.
- [ ] Opt-in live smoke test: `build-gemini-request.live-carousel.test.ts`, gated behind `RUN_LIVE_GEMINI_TESTS`/`SYSTEM_GEMINI_API_KEY`, never part of default CI — Task 8.
- [ ] E2E tests: none required — no user-facing surface exists in this story's scope.

## Deliverables Checklist

- [ ] `MAX_CAROUSEL_IMAGES` env var wired into `BackendEnv` with default `5`.
- [ ] `buildGeminiExtractionRequest` batches cover + up to `MAX_CAROUSEL_IMAGES` additional slides into one Gemini request, in order, with per-slide failure resilience.
- [ ] System prompt updated for multi-slide sequential-slide merging guidance and the two new self-reported completeness fields.
- [ ] `geminiExtractionResponseSchema` (Gemini-side) and `extractedEventSchema` (AJV) both updated in the same change for `minScheduleCount`/`expectedScheduleNames`.
- [ ] `GeminiExtractionPayload` (packages/domain) carries the two new optional fields; no other type gains them.
- [ ] `processAiJob` logs the incomplete-extraction warning exactly when `isEvent && minScheduleCount !== undefined && schedules.length < minScheduleCount`.
- [ ] `rehostPostImageSeam` call site unaffected — still cover-image-only.
- [ ] Mocked regression tests (Task 7) and opt-in live smoke test (Task 8) both added.

## Out of Scope

- A sequential/multi-call re-trigger mechanism for incomplete extractions (explicitly rejected — AD-13 rule 3, epics.md Note).
- Any change to Section 3.10's "Selected Posts" quota accounting (explicitly confirmed unaffected — a carousel post still costs exactly one Gemini call, per the originating sprint-change-proposal).
- Persisting `minScheduleCount`/`expectedScheduleNames` anywhere (DB, `ExtractedEventMessage`, GraphQL) — logging-only per AC5.
- Durable re-hosting of any carousel slide beyond the cover image (AD-13 rule 2; Stories 3.6e/3.6f/3.6h's scope is unchanged).
- Refreshing the `IDEA-001-multislide-extraction.md` fixture's Instagram CDN URLs when they eventually expire — flagged as a known maintenance need for Task 8's live test, not built here.

## Definition of Done

- [ ] AC1-AC10 satisfied.
- [ ] Task 7's mocked tests passing; Task 8's live test present and skips cleanly without live credentials.
- [ ] Lint and type checks passing for `apps/backend` and `packages/domain`.
- [ ] No regression in existing `build-gemini-request.test.ts` / `process-ai-job.test.ts` cases (single-image path, private-contact classification, performer-exclusion — all pre-existing behavior unchanged).

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
