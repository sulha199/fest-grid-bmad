# Story 3.5: Add new posts to a processing queue

## Story Details

- **Epic:** 3
- **Story ID:** 3.5
- **Status:** ready-for-dev

## Story

**As a** system,
**I want** to add the scraped posts to a processing queue,
**So that** I can reliably and asynchronously process them for event extraction.

## Acceptance Criteria

1. **Given** a new post has been scraped from a subscribed account and persisted (Story 3.3a's `persistScrapedPost`),
2. **When** a post becomes "ready to be processed" — i.e. a user selects it for extraction via Story 5.1a's `selectPostsForExtraction` mutation (PRD §3.10) — not automatically for every scraped post, since Epic 5's manual selection is the deliberate entry point that lets users stay within their API quota,
3. **Then** the post is added as a message to the `AIProcessingQueue` SQS queue.
4. **And** the message contains all the necessary information about the post the AI Processor Lambda (Story 3.6) needs to extract event info without a second DB read: `postId`, `accountId`, `content`, `imageUrl`, `postUrl`, `publishedAt`.
5. **And** this story's queue-producer logic (`enqueuePostForProcessing(postId)`) is the shared mechanism Story 5.1a's mutation calls into — Story 5.1a does not reimplement queueing.
6. **And** the producer defensively guards against enqueueing a `postId` that doesn't exist (throws `PostNotFoundError`) or that has already been fully processed (`isExtracted: true`, throws `PostAlreadyExtractedError`) — sending zero SQS messages in either case — so a stray duplicate selection (before Story 5.1a's own quota/UI validation exists) cannot waste a paid Gemini/quota call. This does not catch the narrower race of the same post being selected twice while an earlier job is still in-flight (unprocessed); that is an accepted gap, not solved by this story (see Dev Notes).

**Note:** AC corrected by Gate 1 (`story-split-gate.md`), surfaced by the Epic 5 readiness sweep (`bmad-epic-readiness-check`) — the original draft implied posts are queued automatically right after scraping, which conflicts with PRD §3.10 (manual post selection is what "should be processed by the AI agent") and with Story 5.3's quota-enforcement requirement. Queueing is now explicitly tied to user selection.

**Depends on:** Story 3.3a.

## Tasks / Subtasks

- [ ] **Task 1 (AC4) — Shared cross-boundary types in `packages/domain`:** Create `packages/domain/src/posts/types.ts` exporting:
  - `ProcessingJobMessage` interface: `{ postId: string; accountId: string; content: string; imageUrl?: string; postUrl: string; publishedAt: string }` — the exact `AIProcessingQueue` message contract this story's producer sends and Story 3.6's AI Processor Lambda will later consume.
  - `PostNotFoundError extends Error` and `PostAlreadyExtractedError extends Error` (pure, dependency-free custom error classes — mirrors `ScraperCapacityExceededError`'s placement in `packages/domain/src/scraper/types.ts`).
  - Add `packages/domain/src/posts/index.ts` (`export * from './types.js';`) and a new `"./posts"` subpath entry in `packages/domain/package.json`'s `exports` map, mirroring the existing `"./scraper"` entry exactly.
- [ ] **Task 2 (AC3) — Extract shared SQS-send helper (reuse over reinvention):** Create `apps/backend/src/lib/aws/send-sqs-message.ts`, moving the generic `sendSqsMessage`/`setSendSqsMessage` test-seam pair currently declared inline inside `apps/backend/src/lib/scraper/enqueue-scrape-job.ts` (lines 1-15) into this new, queue-agnostic file — it was only ever scraper-specific by accident of being written first, not by design; Story 3.6/3.6b will need the identical AWS SDK call again for `DataIngestionQueue`. Update `enqueue-scrape-job.ts` to `export { sendSqsMessage, setSendSqsMessage } from '../aws/send-sqs-message.js';` instead of declaring its own, so `enqueue-scrape-job.test.ts`'s existing `import { enqueueScrapeJob, setSendSqsMessage } from './enqueue-scrape-job.js';` keeps working unmodified — zero test churn on an already-`review`-status story.
- [ ] **Task 3 (AC1, AC2, AC3, AC4, AC6) — `enqueuePostForProcessing`:** Create `apps/backend/src/lib/posts/enqueue-post-for-processing.ts`:
  - Fetch the post row by `id` from `packages/database`'s `posts` table (`db.select().from(posts).where(eq(posts.id, postId)).limit(1)`, mirroring `persist-scraped-post.ts`'s lookup style). `posts` is one of the tables explicitly excluded from AD-8 soft-delete (`project-context.md`), so no `activeOnly`/`deletedAt` filter applies here.
  - If no row found, throw `PostNotFoundError` (from `@festgrid/domain/posts`).
  - If `post.isExtracted` is `true`, throw `PostAlreadyExtractedError` (from `@festgrid/domain/posts`) — per the user's explicit decision (AC6), this guard lives in the producer itself, not deferred to Story 5.1a's future mutation/UI.
  - Build a `ProcessingJobMessage` from the fetched row: `{ postId: post.id, accountId: post.accountId, content: post.content, imageUrl: post.imageUrl ?? undefined, postUrl: post.postUrl, publishedAt: post.publishedAt.toISOString() }`.
  - Read `env.aiProcessingQueueUrl` (Task 4); throw a plain `Error('AI_PROCESSING_QUEUE_URL is not configured')` if unset (mirrors `enqueueScrapeJob`'s existing `SCRAPING_QUEUE_URL` guard).
  - Send via Task 2's shared `sendSqsMessage(queueUrl, JSON.stringify(message))`.
  - Exported signature: `enqueuePostForProcessing(postId: string): Promise<void>` — single-postId, per the user's explicit decision; Story 5.1a will loop over its selected `postIds` array when it is built, exactly as `getBatchScrapeTargets`/`enqueueScrapeJob` already keep "get many" and "enqueue one" as separate concerns in this codebase.
- [ ] **Task 4 — Env config:** Add `aiProcessingQueueUrl?: string` to `BackendEnv` in `apps/backend/src/env.ts`, sourced from `process.env.AI_PROCESSING_QUEUE_URL` (with the same `// eslint-disable-next-line turbo/no-undeclared-env-vars` pattern as `scrapingQueueUrl`).
- [ ] **Task 5 — `.env.example`:** Add `AI_PROCESSING_QUEUE_URL=` under a `# AI processing pipeline (Story 3.5)` heading, with a comment noting it is provisioned by Story 0.14's IaC but — unlike `SCRAPING_QUEUE_URL` — is **not yet** wired into any Lambda's CDK `environment` block, since no caller exists inside a Lambda until Story 5.1a adds the real `selectPostsForExtraction` resolver (see Dev Notes).
- [ ] **Task 6 (AC1, AC3, AC4, AC6) — Tests:** Create `apps/backend/src/lib/posts/enqueue-post-for-processing.test.ts` (`node:test`, real local DB + SQS test seam, no live AWS calls), covering:
  - (a) Happy path: insert a real `socialMediaAccountProfiles` row and a real `posts` row (`isExtracted: false`), call `enqueuePostForProcessing(post.id)`, assert `setSendSqsMessage`'s captured queue URL equals `env.aiProcessingQueueUrl` and the captured, parsed body deep-equals the expected `ProcessingJobMessage` built from that exact row.
  - (b) Not-found: call with a random UUID that doesn't exist in `posts`; assert it rejects with `PostNotFoundError` and the SQS seam was never invoked.
  - (c) Already-extracted: insert a post with `isExtracted: true`; assert it rejects with `PostAlreadyExtractedError` and the SQS seam was never invoked.
  - No dedicated test is added for Task 2's extracted `send-sqs-message.ts` helper itself — it is a trivial 5-line AWS SDK wrapper already exercised indirectly through both this test file's seam and the pre-existing `enqueue-scrape-job.test.ts`, mirroring the precedent that `packages/domain`'s equally-trivial `ScraperCapacityExceededError` has no dedicated test file either (exercised only via `subscribe-to-account.test.ts`).

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3:** Sourced from the swept `epic-3-readiness.md` (`swept: true`, re-run 2026-08-09, lists `3.5` in `stories_covered`). The sweep's Gate 3 section explicitly pre-validated this exact cross-epic relationship: *"Epic 5's manual extraction mutation (`selectPostsForExtraction`) correctly enqueues tasks using Epic 3's queue-producer logic (Story 3.5)"* — no fresh Gate 1/3 gap found for this story.
  - **Lightweight guard (this story's own creation):** re-checked whether this story's specific scope (a pure library function with a genuinely new forward-dependency shape — a function built now with no caller until a different, not-yet-created epic's story exists) contains anything the epic-wide sweep couldn't have anticipated. Found one sequencing nuance the sweep's prose didn't spell out at the CDK/IAM level (see "API Lambda wiring is deferred" below) — not a new architectural layer, just a precedent-following sequencing note, so it is recorded here rather than escalated into a fresh Gate 1 split.
- **Gate 2 (UI Complexity & Reusability):** Run fresh via a one-shot Freya-persona review. **Verdict: No gap.** Zero UI surface — this story adds one library function with no resolver, page, component, or hook attached; it has no caller until Story 5.1a (backlog) wires it to a mutation/UI. Confirmed no `design-artifacts/` UX spec describes this queue-producer function.

### API Lambda wiring is deferred to Story 5.1a (not this story)

`docs/infrastructure/high-level-overview.md`'s diagram already (correctly) shows `L_API -- selectPostsForExtraction --> SQS_AI` as the target architecture. However, per this codebase's own established precedent (Story 3.4 added `SCRAPING_QUEUE_URL` to the API Lambda's CDK `environment` block **and** `scrapingQueue.grantSendMessages(apiLambda)` in the *same* story that added the real caller — `subscribeToAccount`'s on-demand trigger — inside that Lambda), infra plumbing for a specific Lambda is wired only when a real caller exists inside that Lambda, not preemptively. This story adds **no** caller inside `apiLambda` (no resolver, no mutation) — `enqueuePostForProcessing` is called by nothing in this story. Therefore `apps/infrastructure/lib/festgrid-backend-stack.ts` is **not modified** by this story: no `AI_PROCESSING_QUEUE_URL` added to `apiLambda`'s environment, no `aiProcessingQueue.grantSendMessages(apiLambda)` grant. Story 5.1a must add both when it wires `selectPostsForExtraction` into `resolvers.ts`. This is documented as a forward dependency, not silently dropped — see `## Out of Scope`.

### User-confirmed design decisions (this story's own creation, via `AskUserQuestion`)

Two real tradeoffs, not resolvable from epics.md's AC text alone, were raised with the user and explicitly decided during this story's creation:

1. **Producer function shape — single `postId` vs. batch `postIds[]`.** epics.md's AC is phrased per-post ("a post is added as a message"), while the future caller (Story 5.1a's `selectPostsForExtraction(postIds: [ID!])`) is batch-shaped. **Decided: single `postId`.** Rationale: mirrors `enqueueScrapeJob`'s existing per-target precedent exactly, avoids inventing a partial-failure policy for an invalid id inside a batch, and matches this codebase's existing separation of "get many" (`getBatchScrapeTargets`) from "enqueue one" (`enqueueScrapeJob`) concerns. Story 5.1a will loop over its selected `postIds` when it is built.
2. **Duplicate-enqueue guard.** Neither this story's nor Story 5.1a's AC guards against re-enqueueing an already-fully-processed post; the only real cost is a wasted Gemini/quota call (Story 3.6b's ingestion already dedupes any resulting duplicate event gracefully — this is a cost concern, not a data-integrity one). **Decided: guard on `isExtracted` inside the producer itself** (Task 3, AC6) rather than deferring entirely to Story 5.1a's not-yet-built mutation/UI — cheap, self-contained, no schema change, and protects quota even if a future caller forgets to check. Explicitly **not** solved: the narrower race where the same unprocessed post is selected twice before the first job completes (no `queuedAt`/in-flight tracking added) — see `## Out of Scope`.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: no DB schema changes; one new cross-boundary TypeScript shape.** No new columns or tables. `packages/domain/src/posts/types.ts` (Task 1) adds `ProcessingJobMessage` (a new interface, not derived from `packages/shared-types`' `Post`, since it's an internal SQS-message contract, not a GraphQL-exposed shape) plus two new error classes.
- **Impacted fields/contracts:** None in `packages/shared-types` or the GraphQL schema — this story has zero GraphQL surface. `BackendEnv` (Task 4) gains one new optional field.
- **Required DB migration changes:** None.
- **Required TypeScript type changes:** None beyond the new `packages/domain/src/posts` module (Task 1) and `BackendEnv` (Task 4).
- **Backward compatibility and rollout notes:** Purely additive. `enqueuePostForProcessing` has no existing caller anywhere in the codebase yet, so nothing depends on or could be broken by its shape.
- **Verification checks:** Task 6's three test cases (happy path message-shape assertion, not-found guard, already-extracted guard); Task 2's refactor is verified by re-running the existing, unmodified `enqueue-scrape-job.test.ts` to confirm the extraction broke nothing.

### Project Structure Notes

- **New:** `packages/domain/src/posts/{types.ts, index.ts}`; `apps/backend/src/lib/aws/send-sqs-message.ts`; `apps/backend/src/lib/posts/enqueue-post-for-processing.ts` + `.test.ts`.
- **Modified:** `packages/domain/package.json` (new `"./posts"` exports entry); `apps/backend/src/lib/scraper/enqueue-scrape-job.ts` (re-exports the extracted helper instead of declaring it inline — no behavior change); `apps/backend/src/env.ts`; `.env.example`.
- **Not modified:** any `.graphql` schema file; `apps/web`; `apps/infrastructure/lib/festgrid-backend-stack.ts` (see "API Lambda wiring is deferred" above); `docs/infrastructure/high-level-overview.md` (already accurate for the target state); `SETUP_WALKTHROUGH.md` (no new external vendor/credential — `AIProcessingQueue` was already provisioned by Story 0.14's IaC, unlike Apify's new-vendor onboarding in Story 3.4); `packages/database/schema.ts` (no schema change); `enqueue-scrape-job.test.ts` (kept working unmodified, per Task 2).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.5] — this story's authoritative AC and Gate-1-corrected Note.
- [Source: _bmad-output/planning-artifacts/epics.md#Story-5.1a] — the future consumer (`selectPostsForExtraction` mutation) this story's function is built for; confirms the exact contract ("enqueues the selected posts onto the `AIProcessingQueue` via Story 3.5's queue-producer logic — this mutation is the entry point Story 3.5 expects for manually-selected posts").
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md] — swept Gate 1/3 report covering `3.5`; source of the pre-validated Story 3.5/5.1a cross-epic relationship cited above.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-5-readiness.md] — the Epic 5 readiness sweep that originally corrected this story's AC (Gate 1: manual-selection trigger, not automatic).
- [Source: apps/backend/src/lib/scraper/enqueue-scrape-job.ts, enqueue-scrape-job.test.ts] — the exact `sendSqsMessage`/`setSendSqsMessage` test-seam pattern Task 2 extracts and Task 3 reuses; the "get many vs. enqueue one" separation-of-concerns precedent (alongside `get-scrape-targets.ts`) that resolved this story's producer-shape decision.
- [Source: apps/backend/src/lib/posts/persist-scraped-post.ts, mark-post-extracted.ts, persist-scraped-post.test.ts] — Story 3.3a's already-shipped `posts` table access patterns (lookup-by-column style, real-DB integration test style) this story's new file follows exactly; `mark-post-extracted.ts` is the `isExtracted` flip this story's downstream consumer (Story 3.6b) will eventually call.
- [Source: packages/database/schema.ts (posts table, lines ~126-140)] — the exact row shape (`id`, `accountId`, `content`, `imageUrl`, `postUrl`, `originalPostUrl`, `isExtracted`, `publishedAt`) `enqueuePostForProcessing` reads from and maps into `ProcessingJobMessage`; confirms `posts` has no `deletedAt` column (AD-8-excluded).
- [Source: packages/domain/src/scraper/types.ts] — the `ScraperCapacityExceededError` placement/no-dedicated-test precedent Task 1's two new error classes and Task 6's testing note both follow.
- [Source: apps/infrastructure/lib/festgrid-backend-stack.ts] — read in full during this story's creation to confirm the API Lambda's current environment/grants (`SCRAPING_QUEUE_URL` + `scrapingQueue.grantSendMessages(apiLambda)`, added by Story 3.4 alongside its own real caller) and that no `AIProcessingQueue`-related grant exists yet on `apiLambda` — source of the "API Lambda wiring is deferred" decision above.
- [Source: docs/infrastructure/high-level-overview.md, 2-backend.md] — confirms the target-state `L_API -- selectPostsForExtraction --> SQS_AI` edge this story's function exists to eventually serve.
- [Source: _bmad-output/project-context.md#Security, #Code-Organization, #Testing-Rules] — "Resilient Processing Pipeline" (SQS-decoupled `AIProcessingQueue`); DB/AWS-SDK-coupled logic stays in `apps/backend`, pure cross-boundary types/errors go in `packages/domain`; `apps/backend`'s real-DB integration-test convention.
- [Source: _bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md#3.10] — Manual Post Selection feature (the eventual UI trigger for this story's queue-producer, built by Epic 5, not this story).

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (pure `ProcessingJobMessage`/error classes in `packages/domain/src/posts`; all DB/AWS-SDK-coupled logic in `apps/backend`); Security (Resilient Processing Pipeline — `AIProcessingQueue` decoupling); Testing Rules (`apps/backend` real-DB integration-test convention; `packages/domain` trivial-error-class no-dedicated-test precedent).
- [x] `story-content-structure.md` — canonical section order followed.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no AD applies directly (this story has no GraphQL query/soft-delete surface); `posts` confirmed AD-8-excluded, so no `activeOnly` filter needed on the by-id lookup.
- [x] `docs/infrastructure/index.md` / `docs/infrastructure/high-level-overview.md`, `2-backend.md` — read in full; this story implements the producer half of the already-documented `L_API -- selectPostsForExtraction --> SQS_AI` edge (consumer half wiring deferred to Story 5.1a per Dev Notes).

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **New:** `packages/domain/src/posts/{types.ts, index.ts}`; `apps/backend/src/lib/aws/send-sqs-message.ts`; `apps/backend/src/lib/posts/enqueue-post-for-processing.ts` + `.test.ts`.
- **Modified:** `packages/domain/package.json`; `apps/backend/src/lib/scraper/enqueue-scrape-job.ts`; `apps/backend/src/env.ts`; `.env.example`.
- **Not modified:** any `.graphql` file; any `apps/web` file; `apps/infrastructure/lib/festgrid-backend-stack.ts`; `docs/infrastructure/high-level-overview.md`; `SETUP_WALKTHROUGH.md`; `packages/database/schema.ts`; `apps/backend/src/lib/scraper/enqueue-scrape-job.test.ts` (import path unchanged, per Task 2's re-export).

### Rule Mapping

- SQS-decoupled processing pipeline (`AIProcessingQueue`) → `project-context.md` Security/Resilient Processing Pipeline rule → Task 3.
- Code Organization (Domain vs. DB-coupled) → `project-context.md` Code Organization rule → Task 1 (pure types/errors in `packages/domain`) vs. Task 3 (DB/AWS-SDK-coupled logic in `apps/backend`).
- Reuse over reinvention (shared SQS-send helper, `persistScrapedPost`'s lookup style, `ScraperCapacityExceededError`'s placement/testing precedent, `getBatchScrapeTargets`/`enqueueScrapeJob`'s "get many vs. enqueue one" separation) → this story's own Dev Notes + Story 3.3a/3.4's precedents → Tasks 1, 2, 3, 6.
- "Leave the system working end-to-end, not just satisfy stated ACs" (AC6's duplicate-enqueue guard, user-confirmed) → this workflow's Step 3 mandate + `AskUserQuestion` decision → Task 3.
- Infra plumbing wired only alongside a real caller (API Lambda CDK deferral) → Story 3.4's own precedent, re-applied → documented in Dev Notes, deliberately **not** a Task in this story.

### Verification Plan

- `packages/domain`: `pnpm --filter @festgrid/domain build && pnpm --filter @festgrid/domain test` confirms Task 1's new module compiles and the new `"./posts"` export resolves; existing tests unaffected.
- `apps/backend`: `pnpm --filter backend test` — new `enqueue-post-for-processing.test.ts` (real local DB, SQS test seam, no live AWS calls) plus the existing, unmodified `enqueue-scrape-job.test.ts` (confirms Task 2's extraction broke nothing).
- `pnpm build`, `pnpm lint`, `pnpm test` (root): full suite, no regressions.
- Manual/deferred: no live AWS SQS call is exercised by any automated test (matches this pipeline's existing testing-trophy convention); real end-to-end delivery to `AIProcessingQueue` will be implicitly proven once Story 3.6's AI Processor Lambda (already `SqsEventSource`-wired to this queue per Story 0.14's IaC) consumes a real message — not this story's job to prove.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: this story builds exactly one new library function (`enqueuePostForProcessing(postId)`) plus its supporting cross-boundary types/errors and a small SQS-helper extraction refactor. It does **not** build Story 5.1a's `selectPostsForExtraction` mutation, any GraphQL schema/resolver, any `apps/web` UI, or any CDK/IaC change (API Lambda wiring is Story 5.1a's responsibility — see Dev Notes).
- [ ] Architecture and boundary confirmation: `ProcessingJobMessage`/`PostNotFoundError`/`PostAlreadyExtractedError` are pure and DB/Node-dependency-free, correctly placed in `packages/domain/src/posts`; all DB/AWS-SDK-coupled logic (`enqueuePostForProcessing`, the extracted `send-sqs-message.ts` helper) correctly lives in `apps/backend`; `posts`' AD-8-excluded status confirmed (no `activeOnly` filter needed).
- [ ] Testing plan confirmation: new `enqueue-post-for-processing.test.ts` covers the happy path plus both guard-error cases (Task 6); the pre-existing `enqueue-scrape-job.test.ts` is re-run unmodified to confirm Task 2's refactor is behavior-preserving.
- [ ] **Story 3.3a dependency confirmed satisfied:** `done` — `posts` table and `persistScrapedPost` already exist in the codebase.
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1/3 sourced from swept `epic-3-readiness.md` (no gap; the Story 3.5/5.1a cross-epic relationship was explicitly pre-validated by that sweep). Gate 2 run fresh, no gap (zero UI surface). Both real design tradeoffs surfaced during this story's creation (producer function shape; duplicate-enqueue guard) were resolved directly with the user via `AskUserQuestion` before this file was drafted — see Dev Notes "User-confirmed design decisions." The API-Lambda-CDK-wiring forward dependency onto Story 5.1a is explicitly accepted, not silently dropped.
- [ ] Explicit human approval state (Default: **pending approval**).

## Testing Requirements

- [ ] `apps/backend/src/lib/posts/enqueue-post-for-processing.test.ts` (new, real DB + SQS test seam): happy-path message-shape assertion (Task 6a); not-found guard, zero messages sent (Task 6b); already-extracted guard, zero messages sent (Task 6c).
- [ ] `apps/backend/src/lib/scraper/enqueue-scrape-job.test.ts` (existing, unmodified): re-run to confirm Task 2's helper extraction is behavior-preserving.
- [ ] `packages/domain` test suite (existing): re-run to confirm Task 1's new `posts` module doesn't break the build or existing tests.
- [ ] E2E: not required — no user-facing page/flow; per `project-context.md`'s testing-trophy philosophy, the integration tests above are the appropriate depth (mirrors Story 3.4's own Gate 2 "zero UI surface" precedent).
- [ ] **Explicitly not automatable, tracked as a follow-up, not silently skipped:** real end-to-end delivery through a live `AIProcessingQueue` (no live AWS call in any test here) — implicitly exercised once Story 3.6's AI Processor Lambda consumes a real message; not re-proven by this story.

## Deliverables Checklist

- [ ] `packages/domain/src/posts/{types.ts, index.ts}` created; `ProcessingJobMessage`, `PostNotFoundError`, `PostAlreadyExtractedError` exported via a new `"./posts"` subpath in `packages/domain/package.json`.
- [ ] `apps/backend/src/lib/aws/send-sqs-message.ts` created; `enqueue-scrape-job.ts` refactored to re-export from it with zero behavior change and zero test-file churn.
- [ ] `enqueuePostForProcessing(postId)` implemented in `apps/backend/src/lib/posts/enqueue-post-for-processing.ts`, integration-tested per Task 6.
- [ ] `apps/backend/src/env.ts` and `.env.example` updated with `AI_PROCESSING_QUEUE_URL`.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` green at the repo root (excluding pre-existing, unrelated warnings/noise).

## Out of Scope

- Story 5.1a's `selectPostsForExtraction` GraphQL mutation, and any `mySubscriptions`/`postsByAccount`/`myExtractionQuota` query — Epic 5, `backlog`.
- Wiring `AI_PROCESSING_QUEUE_URL` into the API Lambda's CDK `environment` block and `aiProcessingQueue.grantSendMessages(apiLambda)` — deferred to Story 5.1a, the first story to add a real caller of `enqueuePostForProcessing` inside a Lambda. Explicitly accepted, not a silent gap (see Dev Notes "API Lambda wiring is deferred").
- Story 3.6's AI Processor Lambda logic (consuming `ProcessingJobMessage` from `AIProcessingQueue`, calling Gemini via the AI Gateway adapter, enqueueing to `DataIngestionQueue`) and Story 3.6b's Ingestor Lambda (writing the extracted event, calling `markPostExtracted`) — this story only produces the message; it does not consume it.
- Guarding against the narrower race of the same unprocessed post being selected and enqueued twice before the first job completes (no `queuedAt`/in-flight tracking added) — user-accepted per this story's "Duplicate-enqueue guard" decision (Dev Notes); the `isExtracted`-based guard only catches the "already fully processed" case, not "already queued, still pending."
- Epic 5's manual post-selection UI that will eventually call this story's function — that UI does not exist yet (`5.1a`/`5.1` are `backlog`).

## Definition of Done

- [ ] All 6 Acceptance Criteria satisfied.
- [ ] `enqueue-post-for-processing.test.ts` passing (happy path + both guard cases).
- [ ] `enqueue-scrape-job.test.ts` and `packages/domain`'s existing test suite passing unmodified, confirming Task 2's refactor is behavior-preserving.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` pass at the repo root with no regressions.
- [ ] No DB migration required (confirmed additive-free — see Data Type Compatibility).
- [ ] `.env.example` reflects the new `AI_PROCESSING_QUEUE_URL` variable, with its "not yet wired to a Lambda" caveat documented.

## Completion Status

- [ ] Complete

## Dev Agent Record

### Agent Model Used


### Debug Log References


### Completion Notes List


### File List

