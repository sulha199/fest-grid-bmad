---
baseline_commit: 7c261503b0a167702d6257e0d233470ba47de294
---

# Story 3.6m: Add hasFaceImage/faceImageCount self-reported fields to Gemini extraction schema

## Story Details

- Epic: 3
- Story ID: 3.6m
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system,
I want the Gemini extraction response to self-report whether a post's image contains any people,
so that a later face-detection/blur pass (Story 3.6n) can skip images that plainly have none, without paying for a separate detection call on every extracted image.

## Acceptance Criteria

1. **Given** `geminiExtractionResponseSchema` (`build-gemini-request.ts`) and `extractedEventSchema` (`extracted-event.schema.ts`), **when** this story ships, **then** both gain two new **optional** fields, added together in the same change: `hasFaceImage` (boolean) and `faceImageCount` (number, advisory/logging-only — never trusted as an exact count). Neither is added to either schema's `required` list. This is the same load-bearing pattern Story 3.6l's `minScheduleCount`/`expectedScheduleNames` already established — `extractedEventSchema` has `additionalProperties: false`, so a real Gemini response carrying these fields would otherwise fail AJV validation and be silently dropped (`process-ai-job.ts`'s existing `if (!isValid) { console.error(...); return; }` branch) unless both files change together.
2. **Given** the system prompt (`systemInstruction` in `build-gemini-request.ts`), **when** it is built, **then** it is amended with an explicit instruction to self-report `hasFaceImage`/`faceImageCount` based on the same image(s) already provided for event extraction — no second image fetch, no second Gemini call. The instruction must read sensibly whether one image or multiple carousel slides (Story 3.6l) are provided.
3. **Given** an `isEvent === true` payload that AJV-validates successfully and includes `hasFaceImage`/`faceImageCount`, **when** `processAiJob` processes it, **then** both values are logged (structured, including `message.postId`) for later correlation — **this story logs only; it does not write to any DB table.** `extraction_audit_logs` (Architecture Spine AD-29) does not exist yet (Story 3.6p, which creates that table and its write path, is still `backlog`); actual persistence of `hasFaceImage`/`faceImageCount` into that table is Story 3.6p's scope, which is already planned to retrofit both Story 3.6l's (`minScheduleCount`/`expectedScheduleNames`) and this story's fields into the table in one pass. **Neither field is ever written to `posts`/`EventInfo`, and neither is ever exposed via GraphQL** — in this story or any future one.
4. **Given** `payload.isEvent === false`, or `hasFaceImage`/`faceImageCount` are absent from the response, **when** `processAiJob` runs, **then** no face-signal log line is emitted (nothing to report) — mirroring Story 3.6l's AC6 guard for `minScheduleCount`.
5. **Regression fixture (mocked, always runs in `npm test`):** a unit test on `buildGeminiExtractionRequest`/the Gemini-side schema confirms `hasFaceImage`/`faceImageCount` are present as optional (non-required) properties and that the amended prompt text mentions both fields. An integration test on `processAiJob` (real DB, `callGeminiSeam` mocked) covers (a) a payload simulating "no people" (`hasFaceImage: false`) and (b) a payload simulating "a clearly visible person" (`hasFaceImage: true`, `faceImageCount` set), asserting each is AJV-accepted (not silently dropped) and that the expected log line fires with the right post ID and values for case (b), and does not fire for case (a) per AC4's absent-vs-false distinction — see Dev Notes "Testing Strategy" for the exact true/false vs. absent semantics this test must distinguish.
6. **i18n:** N/A — this story is entirely backend/pipeline (prompt engineering, request/response schema, structured logging). No user-facing string is added or changed, no UI/GraphQL/DB-displayed surface exists anywhere in this story's scope (confirmed via a fresh Gate 2 run — see "Architecture & UX Gate Findings" below).

## Tasks / Subtasks

- [ ] **Task 1 (AC1): Extend the Gemini-side response schema**
  - [ ] `apps/backend/src/lib/ai-processor/build-gemini-request.ts`: in `geminiExtractionResponseSchema`'s `properties`, add `hasFaceImage: { type: 'BOOLEAN' }` and `faceImageCount: { type: 'NUMBER' }` alongside the existing `minScheduleCount`/`expectedScheduleNames` (Story 3.6l) and `confidenceScore`. Do **not** add either to the schema's `required` array. Add a code comment following the exact style of the existing `minScheduleCount` comment (Story 3.6l) explaining these are a pre-filter signal for Story 3.6n, logging-only in this story, never persisted to `posts`/`EventInfo`/GraphQL (AD-28 Rule 1).

- [ ] **Task 2 (AC2): Amend the system prompt**
  - [ ] Add a new numbered instruction to `systemInstruction` in `build-gemini-request.ts` (after the existing numbered points, including Story 3.6l's #10/#11) directing the model to self-report, using the same image(s) already provided for event extraction: `hasFaceImage` (boolean — does any provided image contain a visible person/people, e.g. a performer, crowd, or any human figure, as opposed to a text-only flyer/graphic-design poster with no people) and `faceImageCount` (best-effort approximate count of distinct people visible across the provided image(s) — advisory only, not required to be exact, especially in dense/crowd scenes).
  - [ ] Word the instruction so it reads sensibly for both the single-image case and the multi-slide carousel case (Story 3.6l) — e.g. "across the provided image(s)" rather than assuming exactly one or more than one image.

- [ ] **Task 3 (AC1, Data Type Compatibility): Extend `GeminiExtractionPayload` and the AJV `extractedEventSchema` together — load-bearing, not cosmetic**
  - [ ] `packages/domain/src/events/types.ts`: add `hasFaceImage?: boolean;` and `faceImageCount?: number;` to the `GeminiExtractionPayload` interface, directly beside the existing `minScheduleCount?: number; expectedScheduleNames?: string[];` (Story 3.6l) and with a matching comment: logging-only in this story, never added to `ExtractedEventMessage`, `EventInsertValues`, or any DB-facing type.
  - [ ] `apps/backend/src/validation/extracted-event.schema.ts`: add matching `hasFaceImage: { type: 'boolean', nullable: true }` and `faceImageCount: { type: 'number', nullable: true }` properties to `extractedEventSchema`, following the exact existing `minScheduleCount`/`expectedScheduleNames` pattern (optional in TS ⇒ `nullable: true` in `JSONSchemaType`, absent from `required`). **This is load-bearing** for the same reason Story 3.6l's Task 4 called out: `extractedEventSchema` has `additionalProperties: false`, so once Task 2's prompt starts asking the model for these two fields, a real Gemini response that includes them fails AJV validation and is silently dropped unless this schema is updated in the same change.

- [ ] **Task 4 (AC3, AC4): Log the self-reported face signal in `processAiJob`**
  - [ ] `apps/backend/src/lib/ai-processor/process-ai-job.ts`: immediately after the existing step 5.5 (Story 3.6l's incomplete-extraction warning — only reached when `payload.isEvent === true` and AJV-validated), add a new step (5.6): if `payload.hasFaceImage !== undefined`, log a structured line (e.g. `console.log` — this is a routine signal, not a warning condition — including `message.postId`, `payload.hasFaceImage`, and `payload.faceImageCount ?? null`) for later correlation with Story 3.6n/3.6p's eventual ground-truth comparison. If `payload.hasFaceImage === undefined` (absent from the response), log nothing (AC4). No other behavior changes — the function continues to step 6 unchanged either way. Add a code comment explicitly stating: log-only in this story; `extraction_audit_logs` persistence is Story 3.6p's scope (AD-29), not yet built.
  - [ ] Do **not** add any DB write, any new import of a not-yet-existing `extractionAuditLogs` table, or any GraphQL-facing change in this task — see "Architecture & UX Gate Findings" below for why this is the correct scope, not a shortcut.

- [ ] **Task 5 (AC5): Mocked regression tests**
  - [ ] In `apps/backend/src/lib/ai-processor/build-gemini-request.test.ts`, add a new `t.test` case (following the file's existing lettered-`Case` convention, continuing after Story 3.6l's cases) asserting `geminiExtractionResponseSchema.properties` contains `hasFaceImage`/`faceImageCount`, neither is in `required`, and `systemInstruction` contains language referencing both fields.
  - [ ] In `apps/backend/src/lib/ai-processor/process-ai-job.test.ts` (or a focused new file if that one is already large — follow whichever precedent `process-ai-job.carousel-completeness.test.ts` (Story 3.6l) set for "focused dedicated file vs. growing the main file"), using the same real-DB seeded-profile/subscription setup as the existing tests:
    - A case with `setCallGeminiSeam` returning a payload with `hasFaceImage: false`, `faceImageCount: 0` (simulating a text-only flyer) → assert AJV accepts the payload (not silently dropped) and (`t.mock.method(console, 'log', () => {})`, matching the existing console-mocking precedent) that the log line fires with the right post ID and values.
    - A case with `hasFaceImage: true`, `faceImageCount: 3` (simulating a clearly-visible-person image) → same AJV-acceptance and log-content assertions.
    - A case with both fields absent from the seam's returned payload → assert no face-signal log line fires (AC4), distinguishing "absent" from "present but `false`" (case 1 above must still log).

- [ ] **Task 6: Full verification pass**
  - [ ] `pnpm --filter backend test` — full backend suite green, including the new/modified cases from Task 5.
  - [ ] `pnpm --filter backend lint` / `pnpm --filter backend build` (or monorepo equivalents) clean for `apps/backend` and `packages/domain`.
  - [ ] Manually confirm (read the diff) that no DB migration, GraphQL SDL change, or frontend file was touched — this story has none of those (see "Architecture & UX Gate Findings").

## Dev Notes

- This story is **entirely backend/pipeline** — `apps/backend/src/lib/ai-processor/build-gemini-request.ts` (prompt + Gemini-side response schema) and `apps/backend/src/lib/ai-processor/process-ai-job.ts` (post-response logging), plus the shared `GeminiExtractionPayload` type (`packages/domain`) and its AJV mirror (`apps/backend/src/validation/extracted-event.schema.ts`) — the exact same four-file mechanism Story 3.6l already used for `minScheduleCount`/`expectedScheduleNames`. No GraphQL schema change, no new DB column/table built by this story, no frontend file.
- **Scope-sequencing decision, confirmed with the user (`AskUserQuestion`, during this story's creation):** epics.md's literal AC3 wording ("written to the new `extraction_audit_logs` table") describes this story's *eventual* end state once Story 3.6p lands, not something achievable today — `extraction_audit_logs` does not exist in `packages/database/schema.ts` (confirmed by direct grep: zero hits for `extraction_audit_logs`/`hasFaceImage`/`faceImageCount` anywhere in `apps/backend` or `packages/domain`), and Story 3.6p (the story that creates that table and its write path) is still `backlog`, not yet even created as a story file. This story was scoped to mirror Story 3.6l's already-shipped, already-in-review precedent exactly: ship the schema/prompt/type additions now with a log-only statement, and defer actual persistence to Story 3.6p — which is explicitly already scoped in epics.md (`### Story 3.6p`) and Architecture Spine AD-29 to retrofit **both** Story 3.6l's and this story's fields into the table in one pass ("Binds: ... Story 3.6l's `minScheduleCount`/`expectedScheduleNames` (retrofit) and Story 3.6m's `hasFaceImage`/`faceImageCount` (new)"). Presented as a three-option tradeoff (log-only-now-and-defer / block 3.6m until 3.6p ships / absorb 3.6p's table into this story); **user chose log-only-now-and-defer**, matching the Gate 1 finding below and the explicit 3.6l/3.6p precedent. AC3 above is written to reflect this chosen scope rather than the epics.md AC's literal wording.
- **Dependencies, confirmed by direct file read + `git log`, not assumed:**
  - Story 3.6 (done) — the base extraction pipeline (`buildGeminiExtractionRequest`/`processAiJob`) this story extends.
  - Story 3.6l (`status: review`) — already shipped the identical four-file mechanism (Gemini-side schema, AJV schema, `GeminiExtractionPayload`, prompt + a log-only `processAiJob` step) for `minScheduleCount`/`expectedScheduleNames`. Confirmed in place by direct read of all four files; this story's Tasks 1-4 are a parallel addition alongside those fields, not a rewrite of them.
  - Story 3.6p (`status: backlog`) — **not yet implemented.** Per the scope-sequencing decision above, this story does not block on it; it only logs, matching 3.6l's own precedent of shipping before its persistence story existed.
- Story 3.6n (face detection/blur, `backlog`) is the actual future **consumer** of `hasFaceImage` (to skip detection when `false`) — out of scope for this story, which only produces the signal.

### Architecture & UX Gate Findings

- **Epic-wide sweep does not cover this story:** `_bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md` is `swept: true`, but its `stories_covered` list (dated 2026-09-11) stops at `3-6l` — it predates Architecture Spine AD-28/AD-29 and does not mention `3-6m`/`3-6n`/`3-6o`/`3-6p`/`3-6q` at all. Per `story-split-gate.md`'s "lightweight escape-hatch guard," this story's scope (a dependency on a not-yet-built new data entity, `extraction_audit_logs`) is plausibly something the 2026-09-11 sweep could not have anticipated — so Gate 1 and Gate 3 were **re-run fresh** for this story (via `runSubagent`, Winston persona), not cited from the stale sweep.
- **Gate 1 (fresh run, Winston persona) — No gap found.** Verdict: this story's scope (schema fields on two existing backend-only files, a prompt amendment, a log-only write using data already in-memory from the existing single Gemini call) triggers none of Gate 1's five heuristics — no frontend/UI involved, no new API surface/resolver, no new external service call (same single Gemini call already made), no auth/secrets/business-rule logic, and while it does depend on `extraction_audit_logs` infra that has no deploy story *yet shipped*, it does not attempt to stand that infra up itself — deferring to Story 3.6p (which already fully owns and is scoped to build it) is exactly the pattern Gate 1 recommends, not a trigger for it. The subagent explicitly flagged that the Gate-1-triggering move would have been building the `extraction_audit_logs` table/write path *inside* this story's own diff — which this story's confirmed scope avoids.
- **Gate 2 (fresh run, Freya persona) — No gap found.** Verdict: zero UI surface anywhere in this story's AC list — no React component, no page, no GraphQL field, no resolver. `hasFaceImage`/`faceImageCount` are self-reported numbers/booleans destined for a future audit table, never read by any component in this story's scope; the eventual UI-facing consequence (Story 3.6n's `prominentPoster` widening) belongs entirely to that separate, not-yet-built story. Splitting out a UI story here would manufacture scope that doesn't exist — same conclusion independently reached for sibling Story 3.6l.
- **Gate 3 (fresh run, Winston persona) — No gap found; `extraction_audit_logs`/Story 3.6p is explicitly confirmed to be a sequencing matter, not a true Gate 3 gap.** Verdict: none of Gate 3's six heuristics (global shell, i18n foundation, analytics foundation, GraphQL scaffold, an orphaned named reusable utility, or an architecture-spine item with no corresponding `epics.md` story) fire. Gate 3's actual trigger condition is "a dependency referenced in the architecture spine but with **no corresponding story anywhere in `epics.md`**" — that condition is false here: Story 3.6p is fully specified in `epics.md` (`### Story 3.6p`, full AC list, exact column list matching AD-29) and tracked in `sprint-status.yaml`. This is a sequencing/dependency-ordering matter (3.6m ships the self-reported fields now; 3.6p, not yet implemented, will persist them later) — the identical situation Story 3.6l was already in before Story 3.6p existed as a story at all.
- **No new prerequisite stories or `sprint-status.yaml`/`epics.md` entries were added by this story's creation** — all three gates cleared with no gap; Story 3.6p already exists as its own fully-specified entry and needed no new entry.
- **Pre-Coding Approval Gate note:** Story 3.6p is an accepted, explicitly-documented pending dependency for this story's eventual full AC3 text (table persistence) — not a blocker for this story's confirmed, narrower scope (schema/prompt/type additions + logging). See the Pre-Coding Approval Gate checklist below.

### Design Decisions Confirmed With The User (`AskUserQuestion`, during this story's creation)

- **3.6p sequencing (the only real, non-mechanical tradeoff surfaced by this story):** see "Dev Notes" above for the full reasoning and the three options presented. User selected "Log-only now, defer persistence to 3.6p" — the option matching all three fresh Gate findings and the Story 3.6l/3.6p precedent already established in the architecture spine and shipped code.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** A real, load-bearing mismatch would be introduced if only the Gemini-side response schema (Task 1) were updated without also updating the AJV validation schema (Task 3) — see Task 3's note; mirrors the exact mismatch class Story 3.6l's Task 4 already called out for `minScheduleCount`/`expectedScheduleNames`. No DB-level mismatch: no schema/migration change in this story at all — `extraction_audit_logs` (Story 3.6p) is explicitly deferred, not built here.
- **Impacted fields/contracts:** `GeminiExtractionPayload` (`packages/domain/src/events/types.ts`) gains `hasFaceImage?: boolean` and `faceImageCount?: number`; `extractedEventSchema` (`apps/backend/src/validation/extracted-event.schema.ts`, `JSONSchemaType<GeminiExtractionPayload>`, `additionalProperties: false`) must declare both as `nullable: true`, non-required properties in the same change; `geminiExtractionResponseSchema` (Gemini-side, `build-gemini-request.ts`) must declare both as optional (non-required) `BOOLEAN`/`NUMBER` properties in the same change.
- **Required DB migration changes:** None in this story. The future `extraction_audit_logs` table (Story 3.6p, Architecture Spine AD-29) is the eventual home for persisting these two fields — out of scope here by the confirmed scope-sequencing decision above.
- **Required TypeScript type changes:** `GeminiExtractionPayload` (above). Explicitly **not** added to `ExtractedEventMessage`, `EventInsertValues`, `ScheduleInsertValues`, or any other DB-facing/persisted type — both new fields are logging-only (AC3) in this story's scope and must not leak further into the pipeline, mirroring Story 3.6l's identical constraint for its own two fields.
- **Backward compatibility and rollout notes:** Both new Gemini-schema/payload fields are optional/additive. A Gemini response that omits them (e.g. before this change is fully deployed, or if the model simply doesn't populate them) continues to validate and process exactly as today — `processAiJob`'s new logging branch (Task 4) is guarded by `payload.hasFaceImage !== undefined`, matching Story 3.6l's `payload.minScheduleCount !== undefined` guard pattern exactly.
- **Verification checks:** Task 3's AJV-schema update is exercised implicitly by Task 5's mocked `processAiJob` integration tests (payloads carrying `hasFaceImage`/`faceImageCount` must pass AJV validation, not get silently dropped) — the test suite should include at least one assertion that a payload with these two new fields present (both the `true` and `false` cases) is accepted, not rejected, by `compileValidator<GeminiExtractionPayload>(extractedEventSchema)`.

### Project Structure Notes

- No new package/module boundary introduced. Files touched already live in their established homes (`apps/backend/src/lib/ai-processor/`, `apps/backend/src/validation/`, `packages/domain/src/events/types.ts`) — no `packages/domain` DB/Node-dependency concern applies here (these are pure type additions, no new imports).
- No new reusable UI component or `packages/domain` mechanism is introduced by this story (see Gate 2 finding above) — the persistent project-context facts about placing reusable UI in `packages/ui` / reusable mechanisms in `packages/domain` do not apply to this story's scope.
- No new env var is required (unlike Story 3.6l's `MAX_CAROUSEL_IMAGES`) — this story adds no new fetch, no new configurable cap, and reuses the image bytes already fetched by the existing extraction request.
- No PostHog analytics event, no i18n locale key, no SETUP_WALKTHROUGH.md update, no new cloud/external service — this story adds zero new external dependencies (still Gemini only, already provisioned).

### Testing Strategy — what the test layer proves and the absent-vs-false distinction it must get right

- The mocked `processAiJob` integration tests (Task 5) prove the *plumbing* — that the Gemini-side schema and AJV schema accept `hasFaceImage`/`faceImageCount` without the response being silently dropped, and that the log-only step (Task 4) fires exactly when the fields are present (whether `true` or `false`) and does not fire when they are absent from the response entirely. This absent-vs-`false` distinction is the same one Story 3.6l's `minScheduleCount !== undefined` guard already established and must not be collapsed into a single truthiness check (`if (payload.hasFaceImage)` would incorrectly skip logging for the legitimate `hasFaceImage === false` case).
- This story does not and cannot prove the actual Gemini model reliably detects faces in real images — that is a property of the model and the prompt, not of this codebase's plumbing. A live-model smoke test (mirroring Story 3.6l's opt-in `build-gemini-request.live-carousel.test.ts` pattern) was considered but not required here: unlike 3.6l's non-cover-slide schedule extraction (which had no other way to validate real model behavior against a known fixture), this story's two fields are purely advisory/logging-only signals never used for any automated decision in this story's own scope, so the cost/non-determinism of a live API call was judged not to earn its keep for this story. The dev agent may still add one if it finds the mocked coverage insufficient, but it is not a required deliverable here.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.6m] — original AC list, Note, Cross-reference, Depends-on.
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.6l] — shipped precedent for the same four-file schema/prompt/type mechanism.
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.6p] — the story that will create `extraction_audit_logs` and retrofit persistence for both 3.6l's and this story's fields.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-28] — Rule 1 (the pre-filter this story implements) and overall face-blur mechanism this story's fields feed into (Story 3.6n, out of scope here).
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-29] — binding rule for `extraction_audit_logs`; explicitly names this story's fields as part of Story 3.6p's retrofit scope.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md] — `swept: true`, dated 2026-09-11, `stories_covered` stops at `3-6l`; basis for this story's decision to re-run Gate 1/3 fresh rather than cite the sweep.
- [Source: _bmad-output/implementation-artifacts/3-6l-extract-events-from-multi-image-carousel-posts-using-a-single-batched-gemini-request.md] — shipped precedent story; Dev Notes, Tasks, and Gate findings this story mirrors.
- [Source: apps/backend/src/lib/ai-processor/build-gemini-request.ts] — file this story edits; current state already includes Story 3.6l's `minScheduleCount`/`expectedScheduleNames` schema/prompt additions.
- [Source: apps/backend/src/lib/ai-processor/process-ai-job.ts] — file this story edits; current state already includes Story 3.6l's step 5.5 logging pattern this story's step 5.6 follows.
- [Source: apps/backend/src/validation/extracted-event.schema.ts] — file this story edits; current state already includes Story 3.6l's AJV additions.
- [Source: packages/domain/src/events/types.ts] — file this story edits; current state already includes Story 3.6l's optional fields.
- [Source: packages/database/schema.ts] — confirmed by direct read: no `extraction_audit_logs` table exists yet (Story 3.6p not started).

## Global Rules References

- [x] `_bmad-output/project-context.md` — Technology Stack, Adapter Pattern, Testing Rules (Node's built-in `node:test`, this package's established convention; no deviation introduced by this story).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order and status vocabulary followed.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-28 Rule 1 (this story's binding architecture rule) and AD-29 (the deferred persistence destination, Story 3.6p).
- [x] `docs/infrastructure/index.md` — no infra/CDK change required by this story (no new env var, no new fetch, no new Lambda timeout concern — reuses the existing AI Processor Lambda's already-fetched image bytes).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - `apps/backend/src/lib/ai-processor/build-gemini-request.ts` (modify — Gemini-side response schema + prompt additions)
  - `apps/backend/src/lib/ai-processor/build-gemini-request.test.ts` (modify — new mocked schema/prompt assertions)
  - `apps/backend/src/lib/ai-processor/process-ai-job.ts` (modify — log-only face-signal step)
  - `apps/backend/src/lib/ai-processor/process-ai-job.test.ts` (modify, or a new focused file per Task 5's precedent check — new mocked integration cases)
  - `packages/domain/src/events/types.ts` (modify — `GeminiExtractionPayload` optional fields)
  - `apps/backend/src/validation/extracted-event.schema.ts` (modify — matching AJV properties, load-bearing)
- **Rule Mapping:**
  - AD-28 Rule 1 (pre-filter signal, near-zero marginal cost, never trusted for a hard cutoff) → Tasks 1-2, 4.
  - AD-29 (persistence destination is Story 3.6p, not this story) → Dev Notes "Scope-sequencing decision" + Task 4's explicit log-only comment.
  - `story-split-gate.md` Gate 1/2/3 discipline (fresh runs for this story, since the epic-3 sweep predates AD-28/29) → Dev Notes "Architecture & UX Gate Findings".
  - Data-type-compatibility persistent fact (mismatch/no-mismatch section always included) → Dev Notes "Data Type Compatibility & Migration Requirements" + Task 3.
  - `AskUserQuestion`-before-drafting persistent fact (real, non-mechanical tradeoff surfaced: 3.6p sequencing) → Dev Notes "Design Decisions Confirmed With The User".
- **Verification Plan:**
  - `pnpm --filter backend test` — all of Task 5's mocked cases pass (no DB write asserted anywhere; only AJV acceptance + log-line content/absence).
  - `pnpm --filter backend lint` / `tsc` build clean for `apps/backend` and `packages/domain`.
  - Manual diff review confirming no DB migration, GraphQL SDL, or frontend file changed, and no reference to a not-yet-existing `extractionAuditLogs` table/import anywhere in the diff.

## Pre-Coding Approval Gate

- [ ] Scope confirmation — backend-only extension of `build-gemini-request.ts`/`process-ai-job.ts`/shared types/AJV schema; no DB migration; no GraphQL/UI change; logging-only for `hasFaceImage`/`faceImageCount` in this story (persistence deferred to Story 3.6p).
- [ ] Architecture and boundary confirmation — AD-28 Rule 1 compliance (pre-filter signal, reuses already-fetched image bytes, never a hard cutoff); AD-29's persistence destination explicitly deferred to Story 3.6p, not built here.
- [ ] Testing plan confirmation — mocked regression suite only (Task 5); no live-model smoke test required for this story's advisory-signal scope (see Dev Notes "Testing Strategy").
- [ ] Explicit human approval state (Default: pending approval).
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — all three gates re-run fresh (epic-3 sweep predates AD-28/29) and cleared with no gap; **Story 3.6p is an explicitly accepted pending dependency** for this story's eventual full persistence (not a blocker for this story's confirmed log-only scope) — user confirmed via `AskUserQuestion` during story creation.

## Testing Requirements

- [ ] Unit tests: `build-gemini-request.test.ts` new case (schema properties present/optional, prompt content) — Task 5.
- [ ] Integration tests: `process-ai-job.test.ts` (or a new focused file) new cases (real DB, mocked `callGeminiSeam`) — AJV accepts `hasFaceImage`/`faceImageCount` (both `true` and `false` values), log line fires correctly for present values and does not fire when absent — Task 5.
- [ ] E2E tests: none required — no user-facing surface exists in this story's scope.

## Deliverables Checklist

- [ ] `geminiExtractionResponseSchema` (Gemini-side) gains optional `hasFaceImage`/`faceImageCount` properties.
- [ ] System prompt updated with self-report instructions for both fields, worded correctly for single-image and multi-slide cases.
- [ ] `extractedEventSchema` (AJV) gains matching nullable, non-required `hasFaceImage`/`faceImageCount` properties in the same change.
- [ ] `GeminiExtractionPayload` (packages/domain) carries the two new optional fields; no other type gains them.
- [ ] `processAiJob` logs `hasFaceImage`/`faceImageCount` exactly when `isEvent && hasFaceImage !== undefined` — no DB write, no GraphQL exposure.
- [ ] Mocked regression tests (Task 5) added and passing.

## Out of Scope

- Persisting `hasFaceImage`/`faceImageCount` into `extraction_audit_logs` or any other table — Story 3.6p's scope (Architecture Spine AD-29), not yet built; this story's logging is a deliberate, user-confirmed interim step mirroring Story 3.6l's own precedent.
- Any face-detection/blur logic, `@vladmandic/face-api` integration, or `durableThumbnailUrl` generation — Story 3.6n's scope entirely; this story only produces the `hasFaceImage` signal that story will later consume.
- The event-relevance/expiry skip gate for face-blur processing — Story 3.6o's scope.
- Any GraphQL field, resolver, or UI change for either new field — neither is ever exposed via GraphQL (AC3; confirmed Gate 2 finding, no gap).
- A live-model smoke test against real Gemini API calls — considered and explicitly not required for this story's advisory-signal scope (see Dev Notes "Testing Strategy"); the dev agent may add one at its discretion but it is not a required deliverable.

## Definition of Done

- [ ] AC1-AC6 satisfied.
- [ ] Task 5's mocked tests passing (schema/prompt assertions, AJV-acceptance, log-fires/doesn't-fire cases).
- [ ] Lint and type checks passing for `apps/backend` and `packages/domain`.
- [ ] No regression in existing `build-gemini-request.test.ts` / `process-ai-job.test.ts` cases (single-image path, multi-slide carousel path, private-contact classification, performer-exclusion, incomplete-extraction logging — all pre-existing behavior unchanged).

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
