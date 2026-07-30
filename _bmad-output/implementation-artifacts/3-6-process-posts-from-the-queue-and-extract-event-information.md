# Story 3.6: Process posts from the queue and extract event information

## Story Details

- Epic: 3 - Social Media Event Integration
- Story ID: 3.6
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system,
I want to consume a post message from the AIProcessingQueue, call the Gemini API (through the AI Gateway adapter) to extract event information, validate and transform the response into a structured `EventInfo` object, and enqueue it to the DataIngestionQueue,
so that new events can be reliably added to the application without any single Lambda owning both external-API calls and database writes.

> **Scope correction (Gate 1 finding):** The original epics.md AC had this Lambda both call Gemini *and* save directly to the database. Per `docs/infrastructure/high-level-overview.md`, the AI Processor Lambda (`L_AI`) only enqueues to `DataIngestionQueue` — the DB write is owned by a separate Ingestor Lambda (`L_Ingest`), tracked as prerequisite story `3-6b`. This story's scope ends at enqueue.

## Acceptance Criteria

1. Given a message is available in the `AIProcessingQueue`, when it is consumed by the AI Processor Lambda, then the Lambda calls the Gemini API exclusively through the AI Gateway adapter (story `0-13`) — never the Gemini SDK/HTTP API directly.
2. Given the Gemini API returns a response, when the response is received, then it is validated at the point of entry using AJV (per project-context.md's backend runtime-validation rule) before any further processing.
3. Given a validated Gemini response, when it is transformed, then it produces a structured `EventInfo` object (with `schedules[]`) matching the PRD's `EventInfo`/`Schedule` interfaces, including a populated `confidenceScore` (0.0–1.0).
4. Given the computed `confidenceScore` is below the configured review threshold, when the `EventInfo` object is finalized, then it is flagged for human review per the "AI Extraction Quality" NFR (flag value carried on the object, not silently dropped).
5. Given a validated, transformed `EventInfo` object, when processing completes successfully, then the object is enqueued as a message to `DataIngestionQueue` — this Lambda does not write to the database itself.
6. Given the source post has an associated `subscriptionId`/post record (from story `3-3a`), when processing completes (success or terminal failure), then the post's `isExtracted` status is updated accordingly so Epic 5's manual post-selection UI reflects it correctly.
7. Given the Gemini call fails (invalid key, rate limit, quota exhaustion, malformed/non-JSON response), when the failure is terminal for this attempt, then the message is not silently dropped — it follows the AI Gateway adapter's retry/backoff and dead-letter handling (owned by `0-13`), and the post's status is not marked `isExtracted` on failure.
8. And integration tests cover: successful extraction → enqueue-to-ingestion path, AJV validation rejecting a malformed Gemini response, and below-threshold `confidenceScore` triggering the review flag. One E2E test is not applicable (no user-facing surface in this story).

## Tasks / Subtasks

- [ ] Task 1: AI Processor Lambda — consume and orchestrate (AC: 1, 5, 6, 7)
  - [ ] Add Lambda handler in `apps/backend` triggered by `AIProcessingQueue` (SQS event source).
  - [ ] Call the Gemini adapter exposed by the AI Gateway (story `0-13`) — do not call Gemini directly.
  - [ ] On success, enqueue the transformed `EventInfo` to `DataIngestionQueue`; on terminal failure, leave message handling to the adapter's retry/DLQ policy (do not implement ad hoc retry logic here).
  - [ ] Update the post record's `isExtracted` status (requires story `3-3a`'s `posts` table).
- [ ] Task 2: Response validation and transform (AC: 2, 3, 4)
  - [ ] Add AJV schema + validation for the raw Gemini response in `apps/backend` (AJV is backend-only per project dependency-isolation rules — do not add it to any shared package).
  - [ ] Add a framework-agnostic transform function in `packages/domain` (e.g. `packages/domain/src/events/transformGeminiResponseToEventInfo.ts`) that maps a validated Gemini response to `EventInfo`/`Schedule`, sets `confidenceScore`, and applies the below-threshold review-flag rule. No React/Lambda-specific code in this function — must be unit-testable standalone per the domain-package restriction.
  - [ ] Ensure `sourceSocialMediaAccountId` is populated on the resulting `EventInfo` (schema column already exists — confirmed in `packages/database/schema.ts`, no migration needed for this field).
- [ ] Task 3: Testing (AC: 8)
  - [ ] Unit tests for the `packages/domain` transform function (100% coverage per project testing rules — this is domain-package logic).
  - [ ] Integration tests (Vitest + msw) for: happy path (SQS message → adapter call → DataIngestionQueue enqueue), AJV rejection of malformed Gemini output, and below-threshold confidence flagging.

## Dev Notes

- Architecture and technical constraints:
  - This story's Lambda must call Gemini only through the AI Gateway adapter — never the Gemini SDK/API directly (Adapter Pattern, `project-context.md`; PRD §3.8).
  - This story's Lambda must not write to the database — it enqueues to `DataIngestionQueue` only. DB writes belong to the separate Ingestor Lambda (story `3-6b`).
  - Transform/mapping logic is framework-agnostic business logic and belongs in `packages/domain`, not inline in the Lambda handler (Code Organization rule, `project-context.md`). No React imports permitted in `packages/domain`.
  - AJV validation is backend-only; do not introduce it into any shared/UI package (enforced package-isolation rule already codified in `bmad-create-story.toml`).
- File/path expectations:
  - Lambda handler: `apps/backend` (exact subpath depends on the Lambda project structure established by story `0-14`'s IaC setup — align with whatever convention that story establishes; do not invent a parallel structure).
  - Domain transform + AJV schema types: `packages/domain/src/events/`.
- Data/API boundaries:
  - Input: an `AIProcessingQueue` SQS message (produced by story `3-5`, not yet built).
  - Output: a message on `DataIngestionQueue` (consumed by story `3-6b`, not yet built) — this story does not consume its own output.
  - External call: Gemini API, exclusively via the `0-13` adapter's exposed interface (interface not yet defined — coordinate with that story; do not hardcode a direct Gemini client here).
- Source references:
  - Story source: `_bmad-output/planning-artifacts/epics.md` (Story 3.6) — AC corrected per Gate 1 finding, see below.

### Architecture & UX Gate Findings

Per `story-split-gate.md`, all three gates were run via `runSubagent` against this story's draft scope before this file was written.

- **Gate 1 (Architecture/Infra Completeness — Winston): GAP FOUND.** The original AC had one Lambda both call Gemini and write to the database, bypassing the `DataIngestionQueue` → Ingestor Lambda decoupling shown in `docs/infrastructure/high-level-overview.md`. Also found: no adapter/gateway for the direct Gemini call (see Gate 3, same underlying gap), unspecified BYOK key selection/decryption (folded into the `0-13` adapter's scope), and no IaC/deploy story for any of the Epic 3 Lambdas/queues/KMS key. AJV validation and `confidenceScore` population were confirmed as in-scope tasks for this story (not splits) — see Tasks 1–2.
- **Gate 2 (UI Complexity & Reusability — Freya): No gap found.** Story 3.6 has zero UI surface (pure SQS-triggered Lambda). Reviewed `design-artifacts/C-UX-Scenarios/04-alex-extracts-events/` and `05-alex-extracts-events/` — all UI described there (quota bar, quota-exhaustion email, in-app queue-status page, manual post-selection page) belongs to stories 3.10, 5.1, 5.2/5.3, or an as-yet-unowned FR23 screen, and none of it has a plausible seam into this story's scope.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness — Winston): GAP FOUND (2 gaps).** (1) The AI Gateway/Adapter layer for Gemini is mandated project-wide (`project-context.md`, PRD §3.8) and is also needed by Story 4.2 (AI-assisted correction) — no existing story owns it. (2) The PRD's `Post` interface (with `isExtracted`) has no backing table — Story 1.1 only created `events`/`schedules`/`users`/`user_locations`/`subscriptions`/`api_keys`. Both Epic 3 (write) and Epic 5 (read, for manual post selection) depend on this schema.

**Reconciliation note:** Gate 1 and Gate 3 both independently surfaced the AI Gateway/Adapter gap. Per `story-split-gate.md`'s default ("Epic 0 unless the architecture dictates otherwise") and Gate 3's cross-epic reuse evidence (Epic 3 *and* Epic 4 both need it), this is tracked as a single Epic 0 story (`0-13`), not duplicated as an Epic-3-scoped story.

## Global Rules References

- Shared implementation rules: `_bmad-output/project-context.md`
- Story structure contract: `_bmad-output/planning-artifacts/story-content-structure.md`
- System architecture spine: `_bmad-output/planning-artifacts/festgrid-architecture-spine.md`
- Infrastructure constraints: `docs/infrastructure/index.md` (see `docs/infrastructure/2-backend.md` for the queue/Lambda pipeline this story implements)
- Story split gate protocol: `_bmad-output/planning-artifacts/story-split-gate.md`

## Implementation Plan (Rule-Compliant)

### File Change Plan

- `apps/backend`: new AI Processor Lambda handler (SQS-triggered by `AIProcessingQueue`), AJV schema/validation for raw Gemini responses, enqueue-to-`DataIngestionQueue` call.
- `packages/domain/src/events/`: new framework-agnostic transform function mapping a validated Gemini response to `EventInfo`/`Schedule`, including `confidenceScore` and review-flag logic.
- No changes to `packages/database/schema.ts` required by this story itself (the `events` table already has `confidenceScore` and `sourceSocialMediaAccountId` columns). The `posts` table gap is owned by prerequisite story `3-3a`, not this story.

### Rule Mapping

- Adapter Pattern: Gemini calls route through the `0-13` AI Gateway adapter only.
- Queue decoupling: this Lambda enqueues to `DataIngestionQueue`, does not write to the DB.
- Domain/UI boundary: response-transform logic stays framework-agnostic in `packages/domain`; AJV and Lambda wiring stay in `apps/backend`.
- Package isolation: AJV backend-only, no shared-package leakage.
- AI Extraction Quality NFR: `confidenceScore` populated on every extraction; below-threshold results flagged for review.

### Verification Plan

- Unit tests: 100% coverage on the new `packages/domain` transform function.
- Integration tests: happy-path SQS → adapter → `DataIngestionQueue` enqueue; AJV rejection of malformed Gemini output; below-threshold confidence flagging.
- Confirm lint and type checks pass for `apps/backend` and `packages/domain`.
- Manual/architectural check: confirm no direct Gemini SDK import exists in `apps/backend` outside the `0-13` adapter boundary, and no direct database write exists in this Lambda.

## Pre-Coding Approval Gate

- [ ] Scope confirmed as corrected (enqueue to `DataIngestionQueue`, not direct DB write) — Gate 1 finding accepted.
- [ ] Prerequisite `0-13-set-up-ai-gateway-adapter-layer-for-gemini` is done, OR user explicitly accepts building 3.6 with a temporary direct Gemini call to be refactored later.
- [ ] Prerequisite `3-3a-create-posts-table-and-persist-scraped-posts` is done, OR user explicitly accepts deferring AC 6 (post `isExtracted` status update).
- [ ] Prerequisite `0-11-set-up-runtime-schema-validation` (AJV/Zod foundation) is done, OR user explicitly accepts this story establishing ad hoc AJV usage to be reconciled later.
- [ ] Sibling story `3-6b-ingest-processed-events-into-the-database` exists in the backlog to consume this story's `DataIngestionQueue` output (tracking only — not a hard blocker for 3.6 itself).
- [ ] Testing plan reviewed and accepted.
- [ ] **Approval to start coding: PENDING — not yet granted.** Three of four prerequisites above are currently `backlog` in `sprint-status.yaml`. Do not begin implementation until this checklist is explicitly resolved by the user.

## Testing Requirements

- Unit: `packages/domain` transform function, 100% coverage.
- Integration (Vitest + msw): happy path, AJV-rejection path, below-threshold-confidence path.
- No E2E test — no user-facing surface in this story.

## Deliverables Checklist

- AI Processor Lambda handler (SQS-triggered, `apps/backend`).
- AJV validation of raw Gemini responses.
- `packages/domain` transform function (Gemini response → `EventInfo`), unit-tested.
- `DataIngestionQueue` enqueue on success.
- Post `isExtracted` status update (contingent on `3-3a`).
- Integration tests per Testing Requirements.

## Out of Scope

- Direct database write of the extracted `EventInfo` — owned by prerequisite story `3-6b-ingest-processed-events-into-the-database`.
- The AI Gateway/Adapter itself, including BYOK key round-robin selection and KMS-backed decryption — owned by prerequisite story `0-13-set-up-ai-gateway-adapter-layer-for-gemini`.
- The `posts` table schema and scrape-time persistence — owned by prerequisite story `3-3a-create-posts-table-and-persist-scraped-posts`.
- IaC/deploy setup for the Lambdas, queues, and KMS key used by this pipeline — owned by prerequisite story `0-14-set-up-aws-iac-for-lambda-sqs-eventbridge-and-kms`.
- Any UI for viewing extracted events, quota status, or manual post selection — owned by stories 3.7, 3.10, 5.1–5.3 (confirmed out of scope by Gate 2).

## Definition of Done

- Acceptance criteria 1–8 satisfied.
- All Pre-Coding Approval Gate items resolved (prerequisites done or explicitly accepted as deferred by the user) before implementation is considered complete.
- Required unit and integration tests passing.
- Lint and type checks passing for `apps/backend` and `packages/domain`.

## Completion Status

- Story context prepared for implementation.
- **Not yet approved for coding** — see Pre-Coding Approval Gate. Prerequisite stories `0-13`, `0-14`, and `3-3a` were newly added to `sprint-status.yaml` as `backlog` as a result of this story's gate findings; `3-6b` was also added to track the deferred DB-write scope.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (bmad-create-story test run)

### Debug Log References

- Generated as an explicit end-to-end test of the updated `bmad-create-story.toml` overrides (AD-1/AD-2/AD-3/AD-5/AD-6 facts, sharded `docs/infrastructure/` loading, Gate 1 queue/adapter check) and the newly promoted `<step n="3.5">` Story Split Gate.
- Gates 1 and 3 both returned real, independently-verified gaps; Gate 2 returned "no gap found" with cited evidence. See "Architecture & UX Gate Findings" above for full detail.

### Completion Notes List

- Story AC corrected from the raw epics.md draft per Gate 1 (removed direct DB-write, replaced with DataIngestionQueue enqueue).
- Four new prerequisite backlog entries added to `sprint-status.yaml`: `0-13-set-up-ai-gateway-adapter-layer-for-gemini`, `0-14-set-up-aws-iac-for-lambda-sqs-eventbridge-and-kms`, `3-3a-create-posts-table-and-persist-scraped-posts`, `3-6b-ingest-processed-events-into-the-database`.
- Pre-Coding Approval Gate deliberately left pending — real unmet prerequisites exist; this is not a rubber-stamped approval.

### File List

- `_bmad-output/implementation-artifacts/3-6-process-posts-from-the-queue-and-extract-event-information.md`
