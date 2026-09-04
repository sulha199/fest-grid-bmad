---
baseline_commit: 4255f0df9c29b1fbd06867954801d351664a2c8d
---

# Story 3.6j: Verify and guard against performer-contact/photo leakage in extraction

## Story Details

- Epic: 3
- Story ID: 3.6j
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform operator,
I want the AI extraction prompt to actively exclude a performer's contact info or photo from ever landing in a free-text field,
so that the "no performer photo or contact info is ever stored" guarantee is an enforced extraction-time exclusion, not just an absent schema field a naive extraction could still route around.

## Acceptance Criteria

1. **Given** a source post's caption includes a performer credit with an attached booking contact (e.g. "book this artist via 0812-xxx"), **when** AI extraction runs, **then** that contact value never appears in `EventInfo.description` or any other free-text field it could naively be copied into — while the performer's *name* is still extracted normally into `Schedule.performers`. [epics.md AC1]
2. **And** this is verified against the live extraction prompt (not assumed from the absence of a dedicated schema field) — a review/update of the current Gemini prompt in `build-gemini-request.ts`'s `systemInstruction`, adding an explicit negative instruction (item 9, after the existing 8-item list) since none exists today (confirmed by direct read, 2026-09-03). [epics.md AC2]
3. **And** a regression test fixture (a synthetic post caption containing a performer name + inline contact) confirms the contact does not appear anywhere in the resulting `EventInfo`/`Schedule` output. **Scope clarification (confirmed via `AskUserQuestion` during this story's creation):** unlike Story 3.6i's `hasPrivateContact`, there is no dedicated schema field to classify against here — `description`/`performers`/etc. are freeform text with no downstream discard point, and a live Gemini call cannot be asserted on in CI. The regression fixture is therefore a **prompt-only + pass-through test**: a synthetic `GeminiExtractionPayload` representing a *correctly-behaving* extraction (i.e. one that already followed the new prompt instruction — the performer's name present, the contact value absent from every field) is fed through `transformGeminiResponseToEventInfo`, asserting none of the output's string fields contain the fixture's known contact sentinel. This documents the pass-through contract and catches a future code regression that accidentally copies raw source content into a field — it does not (cannot) prove Gemini itself will always comply with the prompt; that is a prompt-engineering/manual-eval concern, matching the same testability boundary Story 3.6i drew for its own AC4. [epics.md AC3, scope clarified]
4. **And** no performer photo URL is ever written to any field, verified the same way against a synthetic post whose caption references an attached performer image — same prompt-only + pass-through fixture pattern as AC3, with a photo-URL sentinel instead of a contact sentinel. [epics.md AC4, scope clarified]

**Note (2026-09-02, added via `bmad-correct-course`, `sprint-change-proposal-2026-09-02.md`):** Per the minimization doc (§2.4), this guardrail "is not yet built... not yet verified or shipped" per the legal doc's own language — this story exists specifically to close that verification gap, not to build new suppression logic from scratch (some of it may already incidentally work; this story's job is to confirm and harden it, not assume).

**Depends on:** Story 3.6.

## Tasks / Subtasks

- [ ] **Task 1 (AC1, AC2) — Harden the Gemini extraction prompt against performer-contact/photo leakage:**
  - [ ] In `apps/backend/src/lib/ai-processor/build-gemini-request.ts`'s `systemInstruction`, add a new numbered instruction (item 9, after the existing item 8 "Use the provided account name metadata...") stating: performer names must still be extracted normally into each schedule's `performers` array, but any personal contact detail (a phone number, email address, or booking/management link, including a `wa.me` link) or any photo/image reference/URL associated with a specific performer — wherever it appears in the caption text or the image — must never be copied into `description`, `contactInfo`, `organizerName`, or any schedule field (`title`, `location`, `performers`). If such a detail is present in the source, omit it entirely from the extraction rather than including it in any field.
  - [ ] Update `build-gemini-request.test.ts`: add a new test case (Case G) asserting `result.request.systemInstruction` includes the new instruction's distinguishing text (e.g. `.includes('performer')` combined with `.includes('must never be copied')`, or equivalent substrings unique to the new instruction), mirroring the existing Case D-F `.includes(...)` assertion pattern.

- [ ] **Task 2 (AC3) — Regression fixture: performer contact never appears in the transform pipeline's output:**
  - [ ] In `packages/domain/src/events/transform-gemini-response-to-event-info.test.ts`, add a new `it` case ("should never surface a performer's contact detail in any output field, while preserving the performer's name"): construct a `GeminiExtractionPayload` representing a correctly-behaved extraction from a synthetic source caption — document the simulated source caption in a comment (e.g. `// Simulated source caption: "Live music by DJ Nova! Book this artist via 0812-3456-7890."`) — where `schedules[0].performers` contains `'DJ Nova'` (name preserved) but no field of the payload (`description`, `contactInfo`, `organizerName`, `location`, any `schedules[].title`/`location`/`performers`) contains the sentinel contact string `'0812-3456-7890'`. Run the payload through `transformGeminiResponseToEventInfo` and assert: (a) `result.schedules[0].performers` still contains `'DJ Nova'`; (b) none of `result.description`, `result.contactInfo`, `result.organizerName`, `result.location`, or any `result.schedules[].title`/`.location`/`.performers` entry contains `'0812-3456-7890'` (explicit per-field assertions, not a generic recursive scanner, to match this test file's existing per-field assertion style).

- [ ] **Task 3 (AC4) — Regression fixture: performer photo URL never appears in the transform pipeline's output:**
  - [ ] Same file, add a second `it` case ("should never surface a performer's photo URL in any output field"): same pattern as Task 2, with a sentinel photo-URL string (e.g. `'https://instagram.com/p/abc123photo'`) simulating a caption referencing an attached performer image, asserting none of the same output fields listed in Task 2 contain that URL substring.

- [ ] **Task 4 — Full verification:** `pnpm --filter backend test` (Task 1); `pnpm --filter @festgrid/domain test` (Tasks 2, 3); `pnpm build`, `pnpm lint`, `pnpm test` at the repo root — no regressions elsewhere that reads `EventInfo.description`/`contactInfo`/`organizerName` or `Schedule.performers`/`title`/`location`.

## Dev Notes

- **This story's enforcement mechanism is prompt-only, by design — not a code-level scrub.** Unlike Story 3.6i (which added a dedicated `hasPrivateContact` boolean the pipeline can classify and discard against), there is no structured field here to classify a "performer contact/photo" against: `description`, `organizerName`, and each schedule's `title`/`location`/`performers` are all freeform text with no downstream discard point. A code-level regex/heuristic scrub applied to those fields was considered and explicitly declined during this story's creation (confirmed via `AskUserQuestion`) — it would be materially larger scope than the epics.md AC text asks for ("AI extraction prompt to actively exclude"), and risks false positives (e.g. stripping a legitimate business phone number that belongs in `description`). The guarantee this story ships is therefore a prompt-level instruction (Task 1), backed by a pass-through regression fixture (Tasks 2-3) that proves the pipeline itself never re-introduces a leak it wasn't given — not a code-level backstop against Gemini itself violating the prompt.
- **Why the regression fixture tests pass-through behavior, not live Gemini compliance (AC3/AC4):** a live Gemini call cannot be asserted on deterministically in CI. The fixture in Tasks 2-3 constructs a `GeminiExtractionPayload` that already reflects a *correctly-behaving* extraction (as if Gemini had followed the new Task 1 instruction), then proves `transformGeminiResponseToEventInfo` doesn't independently reintroduce the leaked value from anywhere (e.g. accidentally falling back to raw source content). This is a real regression guard for the code path, and mirrors the exact testability boundary Story 3.6i drew for its own AC4 (its 6 classification-outcome test cases likewise test the pipeline's deterministic handling of a given classification outcome, not Gemini's live classification accuracy).
- **Forward-looking note (raised during this story's Gate 1 check, not a blocker for 3.6j as scoped):** AC4's reasoning — "a performer's photo can only leak via a free-text field, since there is no dedicated schema field for it" — holds only as long as that stays true. If a future story ever adds a structured field capable of holding a URL/reference (e.g. a performer-image slot on `GeminiSchedulePayload`), this story's guardrail would need re-verification against that new field; it is not automatically still covered.
- **This is unrelated to the whole-post image re-hosting pipeline (Stories 3.6e-3.6h).** `posts.imageUrl`/`durableImageUrl` unconditionally capture the *post's own* attached image regardless of its content (gated on account opt-in, Story 3.6h) — that is a structurally separate mechanism from this story's concern, which is a performer-specific photo *reference/URL mentioned inside caption text* incidentally leaking into a free-text extraction field. This story does not touch `rehost-post-image.ts` or any image-storage code.

### Architecture & UX Gate Findings

Epic 3's readiness sweep (`epic-readiness/epic-3-readiness.md`, `swept: true`, dated 2026-08-09) predates this story (added 2026-09-02 via `bmad-correct-course`, same batch as siblings 3.6g/3.6h/3.6i/3.6k) and its `stories_covered` list does not include 3.6j — so per `story-split-gate.md`'s epic-level-sweep-mode fallback, all three gates were re-run fresh via `runSubagent`, matching the precedent set by Stories 3.6g/3.6h/3.6i's own creation.

- **Gate 1 (Architecture/Infrastructure Completeness, Winston persona) — No gap found.** The story is a prompt-string edit plus test fixtures entirely inside the already-provisioned backend AI pipeline (Gemini call via Story 0.13's AI Gateway adapter → AJV validation → `transformGeminiResponseToEventInfo` → SQS `DataIngestionQueue`); zero frontend code, zero new external service calls, zero new GraphQL/API surface, zero new infrastructure. One forward-looking maintenance note surfaced (not a blocker): see Dev Notes above.
- **Gate 2 (UI Complexity & Reusability, Freya persona) — No gap found.** Checked both `design-artifacts/UX-festgrid-run-1/` and `design-artifacts/UX-wizard-page-run-1/`'s `DESIGN.md`/`EXPERIENCE.md` for any mention of performer contact/photo display — zero matches in either. There is no UI in this story's scope at all (contrast with Story 3.6i, which needed a fallback-message display for its AC3): the correct behavior is pure suppression at the extraction layer, with no reveal/fallback UI counterpart needed, since the detail is discarded before it ever reaches persistence.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness, Winston persona) — No gap found.** The story only edits an existing `systemInstruction` string and adds tests inside the already-built Story 3.6 pipeline / Story 0.13 AI Gateway adapter — the same scope-shape as sibling Story 3.6i, whose own Gate 3 pass already confirmed no dangling foundation. No new mandated utility, no new external integration, no PRD-referenced cross-cutting surface (i18n, app shell, GraphQL codegen, analytics, email) touched.

### Data Type Compatibility & Migration Requirements

- **No changes required.** This story adds no new field, column, GraphQL type, or TypeScript interface anywhere in the stack — it is a prompt-string edit (`build-gemini-request.ts`) plus test-only additions (`build-gemini-request.test.ts`, `transform-gemini-response-to-event-info.test.ts`). `GeminiExtractionPayload`, `ExtractedEventMessage`, `EventInsertValues`, and the `events`/`schedules` DB schema are all unchanged by this story.

### Project Structure Notes

- **New:** no new files.
- **Modified:** `apps/backend/src/lib/ai-processor/build-gemini-request.ts` + `.test.ts` (Task 1); `packages/domain/src/events/transform-gemini-response-to-event-info.test.ts` (Tasks 2, 3) — `transform-gemini-response-to-event-info.ts` itself is **not** modified, since its existing pure pass-through behavior is exactly what Tasks 2-3 verify, not change.
- **Not modified:** `process-ai-job.ts` (confirmed by direct read — no change needed; it already calls `buildGeminiExtractionRequest` and `transformGeminiResponseToEventInfo` unchanged); `packages/domain/src/events/types.ts`, `packages/database/schema.ts`, `apps/backend/src/schema/events.graphql`, `apps/backend/src/validation/extracted-event.schema.ts` (no field changes, see Data Type Compatibility above); any frontend file (no UI in scope, see Gate 2 above); `apps/backend/src/lib/ai-processor/rehost-post-image.ts` (unrelated whole-post-image mechanism, see Dev Notes above).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.6j] — this story's own AC/Note.
- [Source: _bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md#3.16, #Security] — Scraping & Display Data Minimization section and the Security NFR bullet naming the "no performer photo or contact info is ever stored" guarantee as a not-yet-verified item.
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-09-02.md] — the correct-course session that created this story and its siblings (3.4n, 3.6g-3.6k, 3.7c-3.7d).
- [Source: _bmad-output/implementation-artifacts/3-6i-classify-and-discard-private-contact-info-during-ai-extraction.md] — direct sibling from the same correct-course batch, same file family; read in full for structural precedent (testability-boundary reasoning for its own AC4, Gate re-run rationale, Dev Notes/Global Rules/Implementation Plan shape this story mirrors).
- [Source: apps/backend/src/lib/ai-processor/build-gemini-request.ts, build-gemini-request.test.ts] — read in full; confirmed the exact `systemInstruction` numbered-list shape Task 1 extends (currently 8 items) and the existing Case A-F `.includes(...)` prompt-content assertion pattern Task 1's new test case follows. Confirmed zero existing negative instruction re: performer contact/photo.
- [Source: packages/domain/src/events/transform-gemini-response-to-event-info.ts, .test.ts] — read in full; confirmed the function is a pure pass-through for `description`/`contactInfo`/`organizerName`/schedule fields (no filtering logic exists or is being added), and confirmed the existing `describe`/`it` + `node:assert` per-field assertion style Tasks 2-3 follow.
- [Source: packages/domain/src/events/types.ts] — read in full; confirmed `GeminiSchedulePayload`/`GeminiExtractionPayload`/`ExtractedEventMessage` have no photo/image-URL field today (basis for AC4's "can only leak via free-text" reasoning and the Gate 1 forward-looking note).
- [Source: apps/backend/src/lib/ai-processor/process-ai-job.ts] — read in full; confirmed the pipeline order (`buildGeminiExtractionRequest` → `callGeminiSeam` → AJV validate → `transformGeminiResponseToEventInfo` → SQS enqueue) this story's changes sit inside, and confirmed the unrelated whole-post image re-hosting step (`rehostPostImageSeam`, Stories 3.6e-3.6h) operates on the post's own `imageUrl` unconditionally, not on caption-referenced performer photos.
- [Source: packages/database/schema.ts] — grepped for `imageUrl`/`photoUrl`/`performerImage`; confirmed `imageUrl`/`durableImageUrl` exist only on the `posts` table (whole-post image mechanism), not on `events`/`schedules`, and no performer-specific image field exists anywhere.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — gate definitions and the epic-level-sweep-mode basis for re-running Gates 1/2/3 fresh here.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md] — confirmed `swept: true` (2026-08-09) but `stories_covered` predates and excludes 3.6j, triggering the fresh-gate fallback.
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md, EXPERIENCE.md; design-artifacts/UX-wizard-page-run-1/DESIGN.md, EXPERIENCE.md] — checked (via Gate 2 subagent) for any performer-contact/photo display spec; zero matches in either, confirming no UI counterpart is missing from this story's scope.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Testing Rules (backend "testing trophy" integration-style prompt-content assertions, Task 1; `packages/domain` unit coverage, Tasks 2-3); Adapter Pattern for external AI services (Story 0.13's AI Gateway, reused unchanged); Code Organization (no `packages/domain` change introduced at all — this story only adds test cases to an already-pure function).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order and status vocabulary followed by this file.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — this story implements PRD §3.16/Security's data-minimization requirement for performer contact/photo; no existing AD rule required amendment (new verification scope, not a correction to an existing AD).
- [x] `docs/infrastructure/index.md` — confirmed not applicable: no backend compute/queue/EventBridge/DB-provisioning change; reuses the already-provisioned Gemini/AI Gateway pipeline unchanged.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - Modified: `apps/backend/src/lib/ai-processor/build-gemini-request.ts` + `.test.ts` (Task 1); `packages/domain/src/events/transform-gemini-response-to-event-info.test.ts` (Tasks 2, 3).
  - No new files.
- **Rule Mapping:**
  - PRD §3.16/Security "no performer photo or contact info is ever stored" → AC1/AC2, Task 1.
  - Testability-boundary precedent (matching 3.6i's own AC4 scope clarification) → AC3/AC4, Tasks 2-3, Dev Notes.
  - Story-split-gate discipline (fresh Gate 1/2/3, epic-level-sweep-mode fallback) → Dev Notes "Architecture & UX Gate Findings".
  - User-confirmed scope decision (`AskUserQuestion`: prompt-only + fixture test, not a code-level regex scrub) → Dev Notes "Data Type Compatibility" and the story's opening paragraph.
- **Verification Plan:**
  - `apps/backend`: `pnpm --filter backend test` — new Case G in `build-gemini-request.test.ts` passes; no regression in `process-ai-job.test.ts`/`extraction.test.ts` (neither requires new cases per this story's Task list, but must continue passing unchanged); `pnpm --filter backend build`/`lint` clean.
  - `packages/domain`: `pnpm --filter @festgrid/domain test` — the two new `it` cases in `transform-gemini-response-to-event-info.test.ts` pass; all existing cases in that file continue passing unchanged.
  - `pnpm build`, `pnpm lint`, `pnpm test` (root) — full suite, no regressions elsewhere.

## Pre-Coding Approval Gate

- [x] Scope confirmation — one prompt-string addition to `build-gemini-request.ts` (Task 1); two new test cases in an already-existing domain test file (Tasks 2-3); no new DB column, GraphQL field, resolver, component, or i18n/analytics/app-shell foundation; no code-level regex/heuristic scrub (explicitly declined, see Dev Notes).
- [x] Architecture and boundary confirmation — no `packages/domain` implementation file is modified, only its test file; the prompt change stays inside `apps/backend`'s existing AI-processor layer, matching where every other extraction-prompt rule already lives (e.g. the publish-date anchor instruction, item 8's account-name-metadata instruction).
- [x] Testing plan confirmation — `apps/backend` prompt-content assertion (Task 1, mirrors Case D-F); `packages/domain` pass-through fixture tests for both the contact sentinel (AC3) and the photo-URL sentinel (AC4), each asserting the performer's name is preserved while the sentinel value is absent from every output field (Tasks 2-3).
- [x] Explicit human approval state — approved by shulha via `AskUserQuestion` on 2026-09-03 ("Approve, proceed").
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1: no gap (re-run fresh via `runSubagent`, Winston persona; one non-blocking forward-looking note recorded in Dev Notes). Gate 2: no gap (re-run fresh via `runSubagent`, Freya persona; confirmed no UX-spec display requirement exists for this data). Gate 3: no gap (re-run fresh via `runSubagent`, Winston persona; confirmed no other story owns this scope).
- [x] **Test-approach decision confirmed via `AskUserQuestion` (see Dev Notes):** the regression fixture tests pipeline pass-through behavior against a synthetic "correctly-behaving" Gemini payload, not live Gemini compliance — confirm this narrower boundary before implementing Tasks 2-3, do not widen it into a code-level free-text scrub without re-confirming.

## Testing Requirements

- [ ] Unit test (required, `apps/backend`): `build-gemini-request.test.ts` — new Case G prompt-content assertion for the performer-contact/photo negative instruction (Task 1).
- [ ] Unit tests (required, `packages/domain`): `transform-gemini-response-to-event-info.test.ts` — two new cases: performer-contact sentinel absent from all output fields while the name is preserved (Task 2); performer-photo-URL sentinel absent from all output fields (Task 3).
- [ ] Integration tests: not required as new cases — `process-ai-job.test.ts`/`extraction.test.ts` must continue passing unchanged (no test in either file asserts on the literal content of `description`/`contactInfo`/`organizerName` today, confirmed by direct read via Story 3.6i's own equivalent finding; if implementation reveals otherwise, add the minimal case needed rather than skipping verification).
- [ ] E2E tests: not required — this is a prompt-hardening/regression-fixture story with no new interactive flow and no UI.

## Deliverables Checklist

- [ ] Gemini prompt's `systemInstruction` gains an explicit negative instruction excluding performer contact/photo details from every free-text/schedule field while preserving performer names (AC1, AC2, Task 1).
- [ ] Prompt-content assertion test proving the new instruction is present (AC2, Task 1).
- [ ] Regression fixture proving `transformGeminiResponseToEventInfo`'s output never contains a performer-contact sentinel across any field, while the performer's name is preserved (AC3, Task 2).
- [ ] Regression fixture proving `transformGeminiResponseToEventInfo`'s output never contains a performer-photo-URL sentinel across any field (AC4, Task 3).

## Out of Scope

- **A code-level regex/heuristic scrub on free-text fields (`description`, etc.) as a backstop against Gemini violating the prompt.** Explicitly declined during this story's creation via `AskUserQuestion` — see Dev Notes. Considered materially larger scope than the AC text asks for, and risks false positives against legitimate business contact info in `description`.
- **Re-verifying this guardrail against a future structured photo-URL field**, should one ever be added to `GeminiSchedulePayload`/the schema. Flagged as a forward-looking maintenance note by this story's Gate 1 check (see Dev Notes) — not built or tracked as its own story here, since no such field exists today.
- **Story 3.6i (business-vs-private contact classification via `hasPrivateContact`)** and **Story 3.6k (children's-data keyword filter)** — separate, unrelated data-minimization concerns from the same 2026-09-02 correct-course batch, not touched here.
- **The whole-post image re-hosting/serving mechanism (Stories 3.6e-3.6h)** — a structurally separate mechanism (the post's own attached image, gated on account opt-in) unrelated to this story's caption-referenced-performer-photo concern.

## Definition of Done

- [ ] AC1-AC4 satisfied.
- [ ] All required tests passing (`apps/backend` prompt-content assertion; `packages/domain` pass-through fixture tests for both sentinels).
- [ ] Lint and type checks passing for `apps/backend`, `packages/domain`.
- [ ] No code-level regex/heuristic scrub added to any free-text field beyond the prompt-level instruction itself (per the confirmed scope boundary) — any diff there should be treated as scope creep and questioned.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

_To be filled in by the implementing agent._

### Debug Log References

_To be filled in by the implementing agent._

### Completion Notes List

_To be filled in by the implementing agent._

### File List

_To be filled in by the implementing agent._
