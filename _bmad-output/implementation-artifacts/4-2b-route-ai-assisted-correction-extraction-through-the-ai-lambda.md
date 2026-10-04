# Story 4.2b: Route AI-assisted correction extraction through the AI Lambda, so the pre-AI face blur covers it too

## Story Details

- Epic: 4
- Story ID: 4.2b
- Status: ready-for-dev
- Backlog: FIND-068 (child of CC-028)
- Amends: Story 4.2a (`done`) and Story 4.2 (`review`)

## Story

As a bystander whose photo is the subject of a post someone manually extracts via the "AI-Assisted Correction" feature,
I want that image to go through the same pre-AI face blur as the automated pipeline,
so that Story 3.20's blur-before-sending-to-Gemini protection is not limited to the scraping pipeline while a second, manual path still sends my unblurred face to the AI vendor.

## Acceptance Criteria

1. **Async job instead of inline extraction.** `extractEventDataFromUrl` no longer calls `buildGeminiExtractionRequest`/`callGemini` inline in the API Lambda. After its synchronous pre-checks pass it inserts a `manual_extraction_jobs` row (`PENDING`), asynchronously invokes the AI Lambda (`InvocationType: 'Event'`, payload `{ jobType: 'manual-extraction', jobId }`), and returns immediately with `jobId` set (and `data`/`errorCode` null).
2. **Pre-checks stay synchronous and keep their error codes.** Story 4.2a's existing-post/new-post branching is preserved: dual `postUrl`/`originalPostUrl` dedup lookup, removed-content `EXTRACTION_FAILED`, `UNSUPPORTED_PLATFORM`, the TIER_1 `NO_API_KEY` pre-check, and the new-post scrape (`ScraperAdapter.getPostByUrl`, **same 20 s scrape timeout, still in the API Lambda** — decision below) with `SCRAPE_FAILED`. Each still returns `{ errorCode, errorMessage }` from the mutation itself with no job row created.
3. **Poll query.** New `extractionJob(id: ID!): ExtractionJobStatus!` (`status: PENDING|PROCESSING|SUCCEEDED|FAILED`, `data: ProposedEventCorrectionData`, `errorCode: ExtractionErrorCode`, `errorMessage`). It is scoped to the requesting user via `requireAuth`; another user's or an unknown id returns `NOT_FOUND`. On `SUCCEEDED` it returns the same `ProposedEventCorrectionData` shape 4.2a returned; on `FAILED` one of the existing `ExtractionErrorCode` values (`QUOTA_EXHAUSTED`, `EXTRACTION_FAILED`, …). No change to the `ExtractionErrorCode` enum.
4. **AI Lambda handler.** `ai-processor.ts` gains a `manual-extraction` branch (checked via `hasJobType`, before the SQS-batch branch, like `poll-and-drain`). It calls a new `processManualExtractionJob(jobId, { getRemainingTimeInMillis })` that claims the row atomically (`UPDATE … SET status='PROCESSING' WHERE id=$1 AND status='PENDING' RETURNING`), so a duplicate delivery is a no-op, then builds the request via the **same** `buildGeminiExtractionRequest`, runs the Gemini call with 4.2a's two-tier key logic (TIER_1 requester key, then for existing posts TIER_2 `getActiveSubscriberUserIds(accountId)`), parses/validates (`validateExtractedEvent`) and maps (`mapExtractionPayloadToProposedCorrection`, first event only, same multi-event warning), and writes `SUCCEEDED` + `resultData` or `FAILED` + `errorCode`. Unexpected throws are caught and recorded as `FAILED`/`EXTRACTION_FAILED` (never left `PROCESSING`).
5. **Blur applies, no opt-in path.** The request is built with `blurFacesBeforeAi: { isOwnerOptedIn: false, getRemainingTimeInMillis }` whenever `env.blurFacesBeforeAi` is on (the global `BLUR_FACES_BEFORE_AI` kill switch is respected exactly as `processAiJob` does). The publisher-opt-in exception does **not** apply to manual extraction, for existing or new posts (user decision, 2026-10-04). Fail-closed behavior is inherited unchanged from Story 3.20 (blur failure → image dropped, text-only request). No second blur implementation.
6. **No stuck PENDING.** If the async invoke itself throws, the job is marked `FAILED`/`EXTRACTION_FAILED` and the mutation returns that error. `extractionJob` lazily marks a `PENDING`/`PROCESSING` row older than 5 minutes as `FAILED`/`EXTRACTION_FAILED` when read (no new cron). The async invoke is configured with `retryAttempts: 0` (the claim step makes retries unnecessary and a retry would double-spend a Gemini key).
7. **Infra.** `apiLambda` gets `lambda:InvokeFunction` on `aiProcessorLambda` (`aiProcessorLambda.grantInvoke(apiLambda)`) and an `AI_PROCESSOR_FUNCTION_NAME` env var; `aiProcessorLambda.configureAsyncInvoke({ retryAttempts: 0 })`. Infra test asserts the grant, the env var and the retry setting. The existing `lambda-sharp-isolation.test.ts` must stay green (the API Lambda must still never statically import `sharp`/face-api/tfjs — the new API-side code uses only `@aws-sdk/client-lambda`).
8. **Frontend poll flow.** `AiAssistedCorrectionTrigger` calls the mutation, then — when it returns a `jobId` — polls `extractionJob` (React Query `refetchInterval`, 2 s, stopping on a terminal status) and calls `onExtracted(data)` on `SUCCEEDED` or shows the existing per-`errorCode` inline message on `FAILED`. Immediate mutation errors render exactly as today. The localized, non-blocking indicator is kept (never a `BlockingLoader`); after ~15 s the label switches to a new "still processing" message. Polling stops on unmount and the panel is not re-triggerable while a job is in flight. New i18n key `stillProcessing` in the same namespace as `extractingAnnouncement` (`apps/web/locales/en.json` / `id.json`).
9. **Tests updated/added; no regression in the `errorCode` taxonomy.** 4.2a's `extraction.test.ts` and 4.2's `ai-assisted-correction-trigger.test.tsx`/`correction-dialog.test.tsx` move to the async contract. `extract-event-data-no-blur-option.test.ts` (Story 3.20's resolver guard) is replaced by an invariant that `resolvers.ts` contains **no** `buildGeminiExtractionRequest` call and that `process-manual-extraction-job.ts` passes the `blurFacesBeforeAi` option.

## Tasks / Subtasks

- [ ] Task 1: Data model (AC: 1, 3, 4, 6)
  - [ ] 1.1 `packages/database/schema.ts`: `manualExtractionJobStatusEnum` (`PENDING`,`PROCESSING`,`SUCCEEDED`,`FAILED`) and `manualExtractionJobs` table (`id` uuid pk, `requestedByUserId` FK users cascade, `sourceUrl` text, `requestPayload` jsonb notnull — the `ProcessingJobMessage`-shaped message plus `accountId`/`isExistingPost` flag, `status` default `PENDING`, `resultData` jsonb null, `errorCode` text null, `errorMessage` text null, `startedAt`/`completedAt`, `...timestamps`); indexes on `(requestedByUserId, createdAt)` and `(status, createdAt)`.
  - [ ] 1.2 Generate migration `0071` with drizzle-kit; verify the SQL follows the 0068/0069/0070 enum-guard shape; commit snapshot + journal.
- [ ] Task 2: Domain types (AC: 3, 4)
  - [ ] 2.1 Add `ManualExtractionJobStatus` and the `{ jobType: 'manual-extraction', jobId }` payload type to `packages/domain/src/posts` (pure types only, no DB imports; keep 100% coverage if any logic is added).
- [ ] Task 3: AI-Lambda job processor (AC: 4, 5, 6)
  - [ ] 3.1 New `apps/backend/src/lib/ai-processor/process-manual-extraction-job.ts` with seams for Gemini/key lookup like `process-ai-job.ts`; move 4.2a's Gemini-call + tier fallback + parse/validate/map logic here from `resolvers.ts` (do not duplicate it).
  - [ ] 3.2 `lambdas/ai-processor.ts`: `hasJobType(event, 'manual-extraction')` branch passing `getRemainingTimeInMillis`; widen the handler's event union.
  - [ ] 3.3 Tests (DB-backed, seams for Gemini/blur): claim idempotency, success, `QUOTA_EXHAUSTED` incl. TIER_2 fallback, invalid JSON/`isEvent:false` → `EXTRACTION_FAILED`, blur option passed with `isOwnerOptedIn:false`, env flag off → no blur option, unexpected throw → `FAILED`.
- [ ] Task 4: API layer (AC: 1, 2, 3, 6)
  - [ ] 4.1 `extraction.graphql`: add `jobId: ID` to `ExtractEventDataFromUrlResult`; add `ExtractionJobStatus` type/enum and `extractionJob` query. Run backend codegen; commit `resolvers-types.ts` only if it truly differs (line-ending noise otherwise).
  - [ ] 4.2 New `apps/backend/src/lib/aws/invoke-ai-processor.ts` (reassignable function + `setInvokeAiProcessor` seam, like `send-sqs-message.ts`) using `@aws-sdk/client-lambda` (add dependency to `apps/backend`; lazy-import inside the function so cold start of unrelated paths is unaffected).
  - [ ] 4.3 `resolvers.ts`: strip the inline Gemini branches from `extractEventDataFromUrl`; keep pre-checks; insert job; invoke; handle invoke failure. Add `extractionJob` resolver with ownership check and the lazy 5-minute stale sweep.
  - [ ] 4.4 Update `extraction.test.ts` to the async contract; replace `extract-event-data-no-blur-option.test.ts` per AC9.
- [ ] Task 5: Infrastructure (AC: 7)
  - [ ] 5.1 `festgrid-backend-stack.ts`: `grantInvoke`, `AI_PROCESSOR_FUNCTION_NAME` (set via `addEnvironment` to avoid construct-order coupling), `configureAsyncInvoke({ retryAttempts: 0 })`; infra tests; confirm `lambda-sharp-isolation.test.ts` still green; `cdk synth` if available.
  - [ ] 5.2 If any new IAM/infra step is user-visible, update the relevant `docs/infrastructure/2-backend.md` shard (not `SETUP_WALKTHROUGH.md` unless a manual step appears — none expected).
- [ ] Task 6: Frontend (AC: 8)
  - [ ] 6.1 `corrections.graphql`: add `jobId` to the mutation selection and an `extractionJob` query; run `pnpm --filter web codegen`.
  - [ ] 6.2 Rework `ai-assisted-correction-trigger.tsx` to the poll flow (state category: **Server State, React Query**; loader category: **Non-Blocking, localized**); add `stillProcessing` label + en/id locale keys wired through `correction-dialog.tsx`.
  - [ ] 6.3 Update `ai-assisted-correction-trigger.test.tsx`, `correction-dialog.test.tsx` (msw) and `e2e/event-correction.spec.ts` stubs to the two-step contract; add unhappy-path tests (job `FAILED` per `errorCode`, poll network error, unmount stops polling).
- [ ] Task 7: Verification & bookkeeping
  - [ ] 7.1 Run backend (DB-backed), infra and web test suites touched; lint; typecheck; record what could not run.
  - [ ] 7.2 Amend Story 4.2a/4.2 files' Dev Notes with a pointer to this story; update `epics.md` 4.2b with the decisions below; `sprint-status.yaml` → `review` when done.

## Dev Notes

### Decisions (user, 2026-10-04, `bmad-create-story`)

| Question | Decision |
|---|---|
| Job transport | **API Lambda async-invokes the AI Lambda directly** + `manual_extraction_jobs` table. Rejected reuse of `AIProcessingQueue`: in prod the AI Lambda has no SQS trigger, only a 5-minute EventBridge poll-and-drain, so a user would wait up to ~5 minutes (more behind a scrape backlog). |
| Publisher opt-in | **Always blur**, no opt-in path (new-post URLs have no publisher record; one rule for both branches). |
| Scrape location | **API Lambda, before enqueueing.** Keeps the 20 s scrape timeout; pre-check errors stay synchronous. Only the Gemini call + blur move async. |
| Scope | Full story, backend + web. |

### Architecture & UX Gate Findings

- The CC-028 readiness sweep (`epic-readiness/batch-cc-028-blur-before-ai-readiness.md`, Finding 1) covered the *need* for this story but assumed the queue as the transport. **Gate 1 fresh pass (this story only, sweep insufficient on transport):** direct async Lambda invoke is a new API→AI Lambda edge not described in `docs/infrastructure/2-backend.md`; it bypasses the three-queue rule deliberately for a latency-sensitive, user-attended, non-pipeline job that writes no `posts`/`events` rows. Documented as a scoped exception, not a precedent for pipeline work (which must still use the queues). New table + IAM grant are in scope here, not prerequisite stories.
- Gate 3: no missing foundational dependency (Server State via React Query, i18n via next-intl, codegen pipeline all exist). Gate 2: no new reusable UI component — the panel's existing trigger is reworked; no `packages/ui` extraction.
- Residual (not in scope): `ai_image_input` audit (`extraction_audit_logs`) is per-post pipeline telemetry; manual extraction writes no audit row.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: new table; `ExtractionErrorCode` GraphQL enum values must map 1:1 to the `errorCode` text stored on the row (validate on write; store as text, not a PG enum, to avoid a migration per new code).
- Impacted contracts: `ExtractEventDataFromUrlResult` gains nullable `jobId` (additive; old clients ignore it but would see `data: null` with no `errorCode` — web ships in the same story, no external consumers); new query/type.
- Required DB migration: `0071` Drizzle-kit generated (`manual_extraction_jobs` + status enum), checked in.
- Required TypeScript changes: domain job-message/status types; regenerated backend + web GraphQL types.
- Rollout: deploy backend/infra before web. Sequence is safe either way for old web builds only until web ships because old `useExtractEventDataFromUrlMutation` would show `EXTRACTION_FAILED` on `data: null` — acceptable and brief.
- Verification: DB-backed processor tests, resolver tests, codegen diff check, `tsc` clean.

### Current state of files being modified (read before editing)

- `apps/backend/src/schema/resolvers.ts` `extractEventDataFromUrl` (≈ line 1437): synchronous; existing-post path builds the message from the `posts` row (cover only; `additionalImageUrls` are not stored) and calls `buildGeminiExtractionRequest(message)` with no blur option, TIER_1 then TIER_2 fallback; new-post path does platform detect → TIER_1 key pre-check → scrape → single-tier Gemini call. Shared tail: JSON parse → `validateExtractedEvent` → `isEvent`/empty guard → first-event map. **Preserve:** every error code/message, the multi-event warning, dedup lookup, the removed-content message.
- `apps/backend/src/lambdas/ai-processor.ts`: handler union `SQSEvent | { jobType: 'poll-and-drain' }`. **Preserve** poll-and-drain and SQS-batch behavior byte-for-byte.
- `apps/backend/src/lib/ai-processor/build-gemini-request.ts`: option `blurFacesBeforeAi?: { isOwnerOptedIn, getRemainingTimeInMillis? }` (Story 3.20); never reimplement blur.
- `apps/web/src/features/events/ai-assisted-correction-trigger.tsx`: single awaited `useExtractEventDataFromUrlMutation`, spinner in the Extract button (`aria-live`), per-`errorCode` inline error. **Preserve** the labels contract and error rendering.

### Project Structure Notes

- Processor in `apps/backend/src/lib/ai-processor/`, invoke seam in `apps/backend/src/lib/aws/`, types in `packages/domain/src/posts/` (pure, no DB/Node deps). Zod only in `apps/web`, AJV only in backend. `@aws-sdk/client-lambda` is backend-only.
- Backend tests that need Postgres run against the local DB (seed it first if empty); the 4 known local-data failures listed in the session notes are unrelated.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.2b]
- [Source: _bmad-output/planning-artifacts/epic-readiness/batch-cc-028-blur-before-ai-readiness.md#Finding 1]
- [Source: _bmad-output/implementation-artifacts/4-2a-build-the-on-demand-ai-assisted-correction-extraction-api-layer.md]
- [Source: _bmad-output/implementation-artifacts/3-20-blur-faces-before-images-are-sent-to-the-ai-behind-blur-faces-before-ai.md]
- [Source: docs/infrastructure/2-backend.md] (AI Lambda poll-and-drain in prod)

## Global Rules References

- [x] project-context.md
- [x] story-content-structure.md
- [x] architecture spine (AD-28 Rule 10, AD-29 Rule 7)
- [x] infrastructure docs

## Implementation Plan (Rule-Compliant)

- File Change Plan: `packages/database/schema.ts` + migration `0071`; `packages/domain/src/posts/types.ts`; `apps/backend/src/schema/{extraction.graphql,resolvers.ts,extraction.test.ts,extract-event-data-no-blur-option.test.ts}`; `apps/backend/src/lib/ai-processor/process-manual-extraction-job.ts(+test)`; `apps/backend/src/lib/aws/invoke-ai-processor.ts`; `apps/backend/src/lambdas/ai-processor.ts`; `apps/backend/package.json`; `apps/infrastructure/lib/festgrid-backend-stack.ts(+test)`; `apps/web/src/features/events/{corrections.graphql,ai-assisted-correction-trigger.tsx,correction-dialog.tsx}` + tests; `apps/web/locales/{en,id}.json`; `apps/web/e2e/event-correction.spec.ts`.
- Rule Mapping: GraphQL-only client API (project-context); Drizzle migration generated + checked in (AD-3); AJV in backend (existing validator); React Query for server state, localized non-blocking loader; i18n keys en/id; no DB code in `packages/domain`.
- Verification Plan: backend processor/resolver tests (DB-backed), infra tests incl. sharp-isolation, web vitest + msw, lint/tsc, codegen no-diff; manual: real prod API Lambda cold-start check after deploy (see Story 3.20/3.21 prod-incident follow-up).

## Pre-Coding Approval Gate

- [x] Scope confirmation (user answered the four design questions, 2026-10-04)
- [x] Architecture and boundary confirmation (direct-invoke exception documented above)
- [ ] Testing plan confirmation
- [x] Explicit human approval state: approved by user via `AskUserQuestion`, 2026-10-04 (design decisions); implementation request given in the session brief
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted (Stories 3.20, 3.21 `done`; no new prerequisite stories)

## Testing Requirements

- [ ] Integration tests (backend processor/resolver; web msw)
- [ ] Unhappy-path tests (invoke failure, claim race, `FAILED` per `errorCode`, stale sweep, poll error)
- [ ] E2E: stubs updated to the two-step contract (Playwright run only if the environment supports it)

## Out of Scope

- Persisting manual-extraction results or writing `extraction_audit_logs` rows for them.
- Per-user rate limiting beyond the existing key/quota checks.
- Moving the new-post scrape into the AI Lambda (decided against).
- Carousel slides for manual extraction (existing posts do not store `additionalImageUrls`; unchanged from 4.2a).

## Definition of Done

- [ ] All ACs and tasks complete; tests listed above pass (state what could not run).
- [ ] Lint and type checks pass for touched packages.
- [ ] Migration verified against the 0068–0070 precedent shape.
- [ ] Sprint status moved `ready-for-dev` → `in-progress` → `review`.

## Completion Status

- [ ] Ultimate context engine analysis completed - comprehensive developer guide created (status: ready-for-dev)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
