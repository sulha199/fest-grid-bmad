---
baseline_commit: 73aec34f7847672dc00f4a6456c9943705e7f706
---

# Story 0.40: Replace idle SQS Lambda pollers with a stage-gated ESM and scheduled poll-and-drain

## Story Details

- Epic: 0
- Story ID: 0.40
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

<!--
Sourced from backlog.yaml's FIND-034 (created 2026-09-17 via direct AWS CLI/CloudWatch
investigation after an AWS Free Tier billing alert). The investigation, root cause, and fix
shape were already fully settled with the user before this story existed (see
`_bmad-output/implementation-artifacts/backlog/FIND-034-sqs-lambda-poller-idle-cost.md`) --
this story's job is to formalize that settled design into ACs/Tasks, run the story-split-gate
sweep, and resolve two real gaps the settled design left open (staging's treatment, and
poll-loop drain depth), both confirmed with the user via AskUserQuestion during this story's
creation (see Dev Notes).
-->

## Story

As a developer,
I want the 3 backend SQS consumer Lambdas (`scraperLambda`/`aiProcessorLambda`/`ingestorLambda`) to stop running Lambda's built-in `SqsEventSource` poller continuously on idle queues in every environment, gating it behind an explicit opt-in context flag for dev/staging and replacing it entirely with a 5-minute EventBridge-scheduled poll-and-drain mechanism in prod,
so that the account stops burning ~77% of its monthly AWS SQS free-tier request quota on empty long-polls (854,420 of 867,586 September requests, 98.5%, were empty receives from queues that together processed only 484 real messages all month) while still processing real scraping/AI-extraction/data-ingestion work within the user-confirmed acceptable delay of a few minutes.

## Acceptance Criteria

1. **Given** `FestgridBackendStack`'s existing `scrapingQueue`/`aiProcessingQueue`/`dataIngestionQueue` (each with a DLQ, `maxReceiveCount: 3` redrive policy, and `visibilityTimeout: 300s`) and their consumer Lambdas (`scraperLambda`/`aiProcessorLambda`/`ingestorLambda`, each `timeout: 300s`), **when** the stack is synthesized for `stageName === 'dev'` or `stageName === 'staging'` with no CDK context passed, **then** each of the 3 Lambdas' `SqsEventSource` (`addEventSource`) is present but wired with `enabled: false` (the poller is provisioned but disabled by default) — matching the currently-applied manual stopgap (the 3 dev event-source-mapping UUIDs disabled via `aws lambda update-event-source-mapping ... --no-enabled`), but now declaratively, so it survives every future `cdk deploy` instead of reverting on the next deploy.
2. **And** when the stack is synthesized for `stageName === 'dev'` **or** `stageName === 'staging'` with CDK context `enableNonProdQueuePolling` set to the literal string `'true'` (e.g. `cdk deploy FestgridBackendStack-dev -c enableNonProdQueuePolling=true`), each of the 3 Lambdas' `SqsEventSource` is wired with `enabled: true` — the pre-existing continuous-poll behavior becomes available as an explicit, deliberate opt-in for local/staging testing rather than an unconditional default. (Confirmed with the user via AskUserQuestion during this story's creation: staging receives the **same treatment as dev** — gated, default-off, opt-in via this shared flag — not the scheduled poll-and-drain mechanism prod gets in AC3, since staging is a non-production stage exactly like dev and isn't deployed by CI today.)
3. **Given** `stageName === 'prod'`, **when** the stack is synthesized, **then** `scraperLambda`/`aiProcessorLambda`/`ingestorLambda` have **no** `SqsEventSource`/`addEventSource` call at all (no `AWS::Lambda::EventSourceMapping` resource is synthesized for any of the 3 queues in the prod stack), and each Lambda instead has a **new** EventBridge `events.Rule` (`ScraperPollAndDrainRule-prod`/`AIProcessorPollAndDrainRule-prod`/`IngestorPollAndDrainRule-prod`) on `events.Schedule.rate(cdk.Duration.minutes(5))`, targeting the respective Lambda via `RuleTargetInput.fromObject({ jobType: 'poll-and-drain' })` — the same marker-payload idiom `staleJobSweepRule` already uses for `scraperLambda` (`{ jobType: 'stale-job-sweep' }`), so this is a 4th occurrence of an already-established pattern, not a new one.
4. **And** `reportBatchItemFailures: true` remains on `aiProcessorLambda`'s and `ingestorLambda`'s `SqsEventSource` config for the dev/staging gated-ESM path (AC1/AC2, unchanged from today) — it is never referenced at all in the prod path, since prod has no `SqsEventSource` to configure (AC3).
5. **Given** the new prod-only poll-and-drain trigger, **when** `scraperLambda`'s handler (`apps/backend/src/lambdas/scraper.ts`) receives an event matching `{ jobType: 'poll-and-drain' }`, **then** it calls the new shared `pollAndDrainQueue()` helper (AC9) against `process.env.SCRAPING_QUEUE_URL` with a per-message callback that mirrors the existing SQS-branch logic exactly (`JSON.parse(record.body)` then `await processScrapeJob(target)`), and returns without falling through to the existing `'jobType' in event && event.jobType === 'stale-job-sweep'`, `'Records' in event`, or EventBridge-daily-batch branches. This is a **4th branch** added to `scraper.ts`'s existing 3-way branch (stale-job-sweep / SQS-Records / daily-batch-EventBridge) — correcting the backlog note's claim that scraper.ts "already distinguishes" this case; today it does not have a `poll-and-drain` branch at all.
6. **And** `aiProcessorLambda`'s handler (`apps/backend/src/lambdas/ai-processor.ts`) and `ingestorLambda`'s handler (`apps/backend/src/lambdas/ingestor.ts`) — **neither of which has any event-shape branching today** (each is a flat `(event: SQSEvent) => Promise<SQSBatchResponse>` that assumes every invocation is an SQS batch — correcting the backlog note's claim that "ingestorLambda's handler already branches on event shape today," which is not accurate for the code as it exists) — each gain a **new** branch: when the received event matches `{ jobType: 'poll-and-drain' }` (checked via `'jobType' in event`, since this event shape has no `Records` field), call `pollAndDrainQueue()` (AC9) against `process.env.AI_PROCESSING_QUEUE_URL` / `process.env.DATA_INGESTION_QUEUE_URL` respectively, with a per-message callback mirroring each handler's existing per-record logic (`JSON.parse(record.body)` then `processAiJob(message)` / `processIngestionJob(message)`), and return `undefined` (not an `SQSBatchResponse` — that shape is meaningless outside an actual SQS-event-source invocation). The pre-existing `SQSEvent`-batch branch (used only when dev/staging's gated ESM, AC2, is opted in) is otherwise unchanged, including its `reportBatchItemFailures` behavior (AC4).
7. **And** `aiProcessorLambda`'s environment gains a new `AI_PROCESSING_QUEUE_URL: aiProcessingQueue.queueUrl` entry (its own input queue's URL — today it only has `DATA_INGESTION_QUEUE_URL`, its *output* queue, since it never previously needed to know its own queue's URL under the ESM model), and `ingestorLambda`'s environment gains a new `DATA_INGESTION_QUEUE_URL: dataIngestionQueue.queueUrl` entry (today `ingestorLambda`'s environment has no queue URL at all). Without these, AC6's new branch cannot resolve which queue to poll.
8. **And** `scrapingQueue.grantConsumeMessages(scraperLambda)`, `aiProcessingQueue.grantConsumeMessages(aiProcessorLambda)`, and `dataIngestionQueue.grantConsumeMessages(ingestorLambda)` are added **unconditionally** (all 3 stages, not just prod) — today, `sqs:ReceiveMessage`/`sqs:DeleteMessage`/`sqs:GetQueueAttributes` permissions come *entirely* from `addEventSource`'s implicit CDK-generated grant (confirmed via grep: zero explicit `grantConsumeMessages` calls exist anywhere in the stack today). Prod's AC3 removes `addEventSource` entirely, which would silently remove that implicit grant too and leave prod's `ReceiveMessage` calls failing with `AccessDenied`. Granting explicitly and unconditionally (rather than only inside an `if (stageName === 'prod')` block) makes the fix's correctness independent of whether a given stage happens to also have an ESM, and is a harmless no-op duplicate grant on dev/staging (where the ESM's implicit grant already covers the same actions).
9. **Given** a new shared module `apps/backend/src/lib/aws/poll-and-drain-queue.ts`, **when** any of the 3 handlers' new branches (AC5/AC6) call its exported `pollAndDrainQueue(queueUrl, handleMessage, opts?)`, **then** it repeatedly calls `ReceiveMessageCommand` (`MaxNumberOfMessages: 10`, `WaitTimeSeconds: 20` for long-polling) against `queueUrl`, and for each returned message calls `handleMessage(message.Body)`; on success it calls `DeleteMessageCommand` for that message's `ReceiptHandle` (only after `handleMessage` resolves without throwing); on failure it logs the error and leaves the message undeleted (so the queue's existing `maxReceiveCount: 3` redrive-to-DLQ policy — a queue-level attribute, unaffected by consumer mechanism — still applies unchanged). The loop continues issuing further `ReceiveMessageCommand` calls until either a call returns zero messages (queue drained) or a time budget is reached (default: 270 seconds — the Lambda's 300-second timeout minus a 30-second safety margin — configurable via `opts.timeBudgetMs`), rather than processing a single fixed batch of 10 per invocation. (Confirmed with the user via AskUserQuestion during this story's creation: loop-until-drained-or-time-budget was chosen over a single fixed batch of 10, since it removes the ~2,880-messages/day/queue throughput ceiling a single-batch approach would impose — e.g. a 50-message burst from one bulk post-selection action would otherwise take ~25 minutes/5 cycles to fully drain — at no extra AWS cost, since it's still exactly one Lambda invocation every 5 minutes.)
10. **And** `pollAndDrainQueue`'s `ReceiveMessageCommand`/`DeleteMessageCommand` calls are made through reassignable exported functions with setter overrides (`receiveSqsMessages`/`setReceiveSqsMessages`, `deleteSqsMessage`/`setDeleteSqsMessage`), following the exact same test-seam convention already established by `apps/backend/src/lib/aws/send-sqs-message.ts`'s `sendSqsMessage`/`setSendSqsMessage` (used by `enqueue-scrape-job.ts` and its test) — not a new/different mocking approach, and not `aws-sdk-client-mock` (which is not a dependency anywhere in this repo today).
11. **And** a CDK assertion test (`aws-cdk-lib/assertions`) proves, for a `stageName: 'dev'` stack synthesized with no context: all 3 target Lambdas' `AWS::Lambda::EventSourceMapping` resources exist with `Enabled: false`; for the same stack synthesized with context `{ enableNonProdQueuePolling: 'true' }`: the same 3 resources exist with `Enabled: true`; and for a `stageName: 'prod'` stack (constructed with the required prod env vars set, per the stack's existing `if (stageName === 'prod')` required-vars check): zero `AWS::Lambda::EventSourceMapping` resources exist for these 3 queues, exactly 3 new `AWS::Events::Rule` resources exist with `ScheduleExpression: 'rate(5 minutes)'` each targeting one of the 3 Lambdas with `Input` containing `{"jobType":"poll-and-drain"}`, and an IAM policy statement exists granting `sqs:ReceiveMessage`/`sqs:DeleteMessage`/`sqs:GetQueueAttributes` (or CDK's equivalent `grantConsumeMessages` action set) scoped to each of the 3 queues' ARNs for their respective Lambda's execution role.
12. **And** unit tests (`node:test`, matching this codebase's existing convention — see `enqueue-scrape-job.test.ts`) prove `pollAndDrainQueue`'s core semantics via the AC10 test seams: (a) it loops across multiple `ReceiveMessageCommand` calls, processing messages from each, until a call returns an empty result; (b) it stops looping once the configured time budget elapses even if the queue is not yet empty; (c) it calls `deleteSqsMessage` only for messages whose `handleMessage` callback resolved successfully, and never for ones that threw; (d) a thrown error from `handleMessage` is caught and logged, not left unhandled/crashing the loop.
13. **And** new unit tests for `scraper.ts`/`ai-processor.ts`/`ingestor.ts` (new test files — none of the 3 have a test file today) prove each handler's new `{ jobType: 'poll-and-drain' }` branch (AC5/AC6) calls `pollAndDrainQueue` with the correct queue URL (sourced from that Lambda's own environment variable per AC7) and a per-message callback that correctly parses and forwards to the existing `processScrapeJob`/`processAiJob`/`processIngestionJob` functions — using AC10's test seams to substitute a fake `pollAndDrainQueue` (or its own `receiveSqsMessages`/`deleteSqsMessage` seams) rather than making real AWS calls.
14. **And** this story does not modify `processScrapeJob`, `processAiJob`, or `processIngestionJob`'s own business logic, nor any Drizzle schema, GraphQL schema/resolver, or frontend code — its scope is exclusively the CDK stage-gating/scheduling wiring and each Lambda handler's new poll-and-drain branch.

## Tasks / Subtasks

- [x] Task 1: Confirm current state before starting (AC: 1, 3, 5, 6, 7, 8)
  - [x] Re-confirm `festgrid-backend-stack.ts`'s current unconditional `addEventSource` calls (lines ~391, ~406, ~411) and that no `grantConsumeMessages`/stage-gating exists anywhere yet.
  - [x] Re-confirm `ai-processor.ts`/`ingestor.ts` have zero event-shape branching today (flat `SQSEvent -> SQSBatchResponse`), and `scraper.ts`'s existing 3-way branch (`stale-job-sweep` / `Records` / daily-batch EventBridge), so the new branch is additive to each, not a rewrite.
  - [x] Re-confirm `aiProcessorLambda`'s environment lacks `AI_PROCESSING_QUEUE_URL` and `ingestorLambda`'s environment lacks any queue URL at all (AC7).
  - [x] Re-derive whether the manual stopgap (3 dev ESM UUIDs disabled via CLI, noted in `backlog/FIND-034-sqs-lambda-poller-idle-cost.md`) is still in effect at implementation time; note in Completion Notes either way (informational only — this story's `enabled: false` default (AC1) is what makes the fix durable across deploys, the manual stopgap itself needs no further action).
- [x] Task 2: Add the shared `pollAndDrainQueue` module (AC: 9, 10, 12)
  - [x] Create `apps/backend/src/lib/aws/poll-and-drain-queue.ts`: reassignable `receiveSqsMessages`/`setReceiveSqsMessages` and `deleteSqsMessage`/`setDeleteSqsMessage` (mirroring `send-sqs-message.ts`'s pattern exactly), and the `pollAndDrainQueue(queueUrl, handleMessage, opts?)` orchestration function implementing the loop-until-drained-or-time-budget semantics from AC9.
  - [x] Create `apps/backend/src/lib/aws/poll-and-drain-queue.test.ts` covering AC12(a)-(d).
- [x] Task 3: Add the new poll-and-drain branch to each handler (AC: 5, 6, 7, 13)
  - [x] `scraper.ts`: add the `event.jobType === 'poll-and-drain'` branch (4th branch), calling `pollAndDrainQueue(process.env.SCRAPING_QUEUE_URL!, ...)` wrapping the existing `JSON.parse` + `processScrapeJob` logic.
  - [x] `ai-processor.ts`: add event-shape branching (new — none exists today); the `{ jobType: 'poll-and-drain' }` branch calls `pollAndDrainQueue(process.env.AI_PROCESSING_QUEUE_URL!, ...)` wrapping `processAiJob`; update the handler's return type to `Promise<SQSBatchResponse | void>`.
  - [x] `ingestor.ts`: same as `ai-processor.ts`, using `process.env.DATA_INGESTION_QUEUE_URL!` and `processIngestionJob`.
  - [x] Create `scraper.test.ts`, `ai-processor.test.ts`, `ingestor.test.ts` (new files) covering AC13 for each handler's new branch only (not re-testing the pre-existing SQS-batch/daily-batch/stale-sweep branches, which are unchanged).
- [x] Task 4: Stage-gate the dev/staging ESM (AC: 1, 2, 4)
  - [x] In `festgrid-backend-stack.ts`, compute `const enableNonProdQueuePolling = stageName === 'prod' || this.node.tryGetContext('enableNonProdQueuePolling') === 'true';` and pass `{ enabled: enableNonProdQueuePolling }` into all 3 `addEventSource(new eventSources.SqsEventSource(queue, { enabled: enableNonProdQueuePolling, ...existing reportBatchItemFailures where present }))` calls, but only actually invoke `addEventSource` at all when `stageName !== 'prod'` (AC3 removes it entirely for prod).
  - [x] Note the deliberate naming choice: `enableNonProdQueuePolling`, not the backlog note's originally-suggested `enableDevQueuePolling` — renamed because, per this story's AskUserQuestion resolution, the same flag now gates **both** dev and staging, not just dev.
- [x] Task 5: Replace prod's ESM with scheduled poll-and-drain (AC: 3, 8)
  - [x] In `festgrid-backend-stack.ts`, when `stageName === 'prod'`, add `ScraperPollAndDrainRule-prod`/`AIProcessorPollAndDrainRule-prod`/`IngestorPollAndDrainRule-prod` (`events.Rule`, `Schedule.rate(Duration.minutes(5))`, `RuleTargetInput.fromObject({ jobType: 'poll-and-drain' })`), each targeting the corresponding Lambda, mirroring `staleJobSweepRule`'s exact construct shape.
  - [x] Add `AI_PROCESSING_QUEUE_URL`/`DATA_INGESTION_QUEUE_URL` environment entries per AC7.
  - [x] Add the 3 `grantConsumeMessages` calls per AC8 (unconditional, all stages).
- [x] Task 6: Add CDK infrastructure assertion tests (AC: 11)
  - [x] Extend `apps/infrastructure/lib/festgrid-backend-stack.test.ts`: dev-stack-no-context assertions (`Enabled: false` ×3), dev-stack-with-context assertions (`Enabled: true` ×3, constructed via a second `Template.fromStack` on a stack built with `app.node.setContext('enableNonProdQueuePolling', 'true')` or the stack-construction-time context mechanism this CDK version supports), and a new prod-stack test (setting the required `process.env` vars per the existing prod-required-vars check, then constructing `{ stageName: 'prod' }`) asserting zero `EventSourceMapping` for these 3 queues, 3 new `rate(5 minutes)` rules with the `poll-and-drain` marker, and the 3 `grantConsumeMessages`-derived IAM policy statements.
- [x] Task 7: Update `SETUP_WALKTHROUGH.md` (persistent fact: cloud/external service setup) (AC: 1, 2)
  - [x] Under the existing `## 2. Backend (AWS Serverless)` section, add a short note documenting the `enableNonProdQueuePolling` context flag and its default-off behavior for dev/staging, and that prod now uses scheduled poll-and-drain instead of a continuous ESM.
- [x] Task 8: Verification (AC: 1-14)
  - [x] `pnpm --filter infrastructure exec cdk synth` succeeds for all three stage instances.
  - [x] `pnpm --filter infrastructure test` (extended assertions from Task 6) passes.
  - [x] `pnpm --filter backend test` (new/extended unit tests from Tasks 2/3) passes.
  - [x] `pnpm build`/`pnpm lint` clean at the repo root for `apps/infrastructure` and `apps/backend`.
  - [x] Record in Completion Notes (deferred, not a failure, mirroring Stories 0.14/0.25/0.27's precedent): a real `cdk deploy` plus a live 5-minute-scheduled invocation against a real AWS account is not performed as part of this story's automated verification (no AWS credentials available in this development environment).

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infrastructure Completeness) — run fresh via `runSubagent` (Winston lens).** `epic-0-readiness.md`'s `swept: true` report's `stories_covered` list stops at `0.19` and predates this story by a wide margin (same escape-hatch situation Stories 0.23/0.24/0.25/0.27/0.33 already recorded for themselves). **Verdict: no architecture-layer gap** — this story is entirely internal to the already-provisioned `FestgridBackendStack` (Story 0.14), touches no frontend, adds no new unbacked API surface, and doesn't call an external service from the wrong layer; it *is* the IaC/deploy story for its own change. However, the subagent's "leave the system working end-to-end" scrutiny surfaced two real completeness gaps the backlog note's write-up did not mention, both folded into this story's own ACs/Tasks rather than treated as missing architecture layers: (1) removing `addEventSource` for prod silently drops its implicit `sqs:ReceiveMessage`/`DeleteMessage`/`GetQueueAttributes` IAM grant — no explicit `grantConsumeMessages` exists anywhere in the stack today — addressed by AC8; (2) `aiProcessorLambda`/`ingestorLambda` are each missing an environment variable for their *own* queue's URL (they never previously needed it under the ESM model) — addressed by AC7. Independently confirmed via direct code inspection (grep for `grantConsumeMessages`, reading both Lambdas' current `environment` blocks) before dispatching the subagent, and the subagent's answer matched.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — run fresh via `runSubagent` (Winston lens), same escape-hatch reasoning as Gate 1.** Split into two sub-questions:
  - The **EventBridge `Rule` + `LambdaFunction` target** wiring pattern: **no gap**. This is the 4th-6th occurrence of the exact pattern already used by `scraperScheduleRule`/`notifierScheduleRule`/`staleJobSweepRule` (including the `RuleTargetInput.fromObject({ jobType: ... })` marker idiom `staleJobSweepRule` already established). Story 0.27 already considered and declined extracting a shared `addScheduledLambdaTrigger()` helper for this exact pattern ("rule of three" not met, premature abstraction for 2-3 lines of boilerplate) — that reasoning still holds and is not re-opened here.
  - The **receive-then-delete-on-success-only mechanism** itself: **no gap** — Gate 3's actual trigger condition ("shared, project-wide tooling that *other future stories/epics* will also need") does not fire here: no other current or planned story/epic needs a new SQS poll-and-drain consumer, so this fails Gate 3's own qualifying heuristic rather than satisfying it. What *is* true is a narrower, ordinary Step-3 "leave the system working end-to-end" / avoid-duplication concern, fully internal to this one story: this is a real algorithm with correctness-sensitive edge cases (batch-size capping, an empty-receive stop condition, a time-budget cutoff to respect the Lambda timeout, and per-message success/failure handling where a failure must skip the delete so DLQ redrive still fires), and if `scraper.ts`/`ai-processor.ts`/`ingestor.ts` each hand-rolled it independently, subtle divergence across the three (one deletes before processing, one doesn't cap batch size, one loops past its time budget) would be likely and hard to catch in review. Resolved by building it once, correctly, as one shared module consumed by all 3 handlers this same story modifies — `apps/backend/src/lib/aws/poll-and-drain-queue.ts` (AC9/AC10, Task 2; consumed per AC5/AC6, Task 3) — a File-Change-Plan decision, not a story split. No new backlog entry or epics.md section was warranted, since a Gate-3-style split exists to prevent scope creep across stories/epics, not to fragment a single story's own internal file change plan when every consumer of the shared piece already lives inside that one story.
- **Gate 2 (UI Complexity & Reusability) — no subagent dispatched.** This story has **zero UI surface** — pure AWS IaC (CDK stack changes) and backend Lambda-handler internals, no React component, page, hook, or util. A grep of both authoritative UX artifact sets (`design-artifacts/UX-festgrid-run-1/{DESIGN,EXPERIENCE}.md`, `design-artifacts/UX-wizard-page-run-1/{DESIGN,EXPERIENCE}.md`) for "SQS"/"queue"/"poll"/"Lambda"/"EventBridge" returned zero matches, confirming no UX artifact describes any user-facing surface for this story's scope — same justification Stories 0.14/0.25/0.27 already recorded for themselves. **Verdict: no gap found.**
- **Two real design gaps the settled backlog note left open — resolved via AskUserQuestion with the user during this story's creation, not silently decided:**
  1. **Staging's treatment.** The settled design's example code (`stageName !== 'dev' || context flag`) and its prose ("Dev: gate ESM... Prod: replace...") together leave staging in an unaddressed middle state — under the example code, staging's ESM would default to `enabled: true` (continuous, unconditional) if the code were implemented literally, silently reintroducing the exact free-tier-burning bug for a currently-undeployed stage (confirmed via `.github/workflows/*.yml`: only `FestgridBackendStack-prod` is deployed by CI today; staging is never deployed). **User chose: treat staging identically to dev** — same gated, default-off, opt-in-via-context-flag ESM (AC2) — not prod's scheduled mechanism. This is why the context flag is named `enableNonProdQueuePolling` rather than the backlog note's originally-suggested `enableDevQueuePolling`.
  2. **Poll-loop drain depth.** The settled design's text ("does its own `ReceiveMessage` (long-poll, batch of 10)") is ambiguous about whether that's a single fixed batch per 5-minute tick or a loop that drains the queue each cycle — current real traffic (0-19 messages/day/queue per the backlog note's CloudWatch data) makes this a non-issue today, but a fixed single-batch-of-10 caps steady-state throughput at ~2,880 msgs/day/queue regardless of burst size (e.g. a 50-post bulk-selection burst would take ~25 minutes across 5 cycles to fully drain). **User chose: loop until drained or a time budget is reached** (AC9) — this removes the throughput ceiling entirely at no extra AWS cost (still exactly one Lambda invocation every 5 minutes; looping only adds more `ReceiveMessage`/`DeleteMessage` calls *within* that one invocation when there's a backlog to clear).
- **One risk flagged by the Gate 1 subagent and resolved by reasoning, not by asking the user (mechanical, not a judgment call):** whether overlapping invocations (a poll-and-drain invocation still running near its 300s timeout when the next 5-minute tick fires) could cause double-processing. **Resolved: no new risk.** SQS's per-message visibility timeout (300s, matching the queue's existing `visibilityTimeout`) already prevents the *same* message from being handed to two concurrent `ReceiveMessage` callers; two overlapping invocations would simply consume *different* messages in parallel, which is safe and actually improves drain throughput under load. No `reservedConcurrentExecutions` cap is introduced — none of this stack's other scheduled Lambdas (`scraperScheduleRule`, `notifierScheduleRule`, `staleJobSweepRule`) set one either, and doing so here would only risk artificially throttling drain speed under a real backlog.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: **No changes required.** This story provisions/wires AWS infrastructure (CDK) and Lambda-handler control flow only — no Drizzle schema change, no `packages/database` migration, no `@festgrid/shared-types` change, and no GraphQL contract change. The SQS message shapes consumed (`target` for `scraperLambda`, `ProcessingJobMessage` for `aiProcessorLambda`, `ExtractedEventMessage` for `ingestorLambda`) are unchanged — the new poll-and-drain branches parse and forward them identically to the existing SQS-event branches.
- Impacted fields/contracts: None.
- Required DB migration changes: None.
- Required TypeScript type changes: None to any shared/domain type. `scraper.ts`/`ai-processor.ts`/`ingestor.ts` gain a small locally-scoped discriminated-union addition to their handler's event parameter type (e.g. `SQSEvent | { jobType: 'poll-and-drain' }`), and `ai-processor.ts`/`ingestor.ts`'s return type widens from `Promise<SQSBatchResponse>` to `Promise<SQSBatchResponse | void>` — both are internal to the handler files, not exported/shared types.
- Backward compatibility and rollout notes: Purely additive/gating for dev and staging (existing continuous-poll behavior remains available, just opt-in instead of default). For prod, this is a genuine behavior change (continuous → 5-minute-scheduled polling) that the user has already explicitly confirmed is acceptable given scraping/AI-extraction/data-ingestion's tolerance for minutes of delay. No existing resource is destroyed in a way that loses data — the queues, DLQs, and redrive policies are untouched; only the consumption mechanism changes.
- Verification checks: Task 6/8's CDK assertion tests and `cdk synth` prove the wiring is structurally correct; Task 2/3's unit tests prove the drain/delete/branch semantics; real end-to-end verification (a deployed prod Lambda successfully draining a live queue on its 5-minute schedule) is deferred to CI's first real deploy after this story ships, consistent with Stories 0.14/0.25/0.27's own precedent.

### Project Structure Notes

- **Modified:** `apps/infrastructure/lib/festgrid-backend-stack.ts`, `apps/infrastructure/lib/festgrid-backend-stack.test.ts`, `apps/backend/src/lambdas/scraper.ts`, `apps/backend/src/lambdas/ai-processor.ts`, `apps/backend/src/lambdas/ingestor.ts`, `SETUP_WALKTHROUGH.md`.
- **New:** `apps/backend/src/lib/aws/poll-and-drain-queue.ts`, `apps/backend/src/lib/aws/poll-and-drain-queue.test.ts`, `apps/backend/src/lambdas/scraper.test.ts`, `apps/backend/src/lambdas/ai-processor.test.ts`, `apps/backend/src/lambdas/ingestor.test.ts`.
- **Not modified:** `apps/backend/src/lib/scraper/process-scrape-job.ts`, `apps/backend/src/lib/ai-processor/process-ai-job.ts`, `apps/backend/src/lib/ingestor/process-ingestion-job.ts` (all 3 handlers' existing per-message business logic — this story only changes *when/how* each handler is invoked and how it receives/deletes messages, never the processing logic itself), `packages/database`, `packages/domain`, `packages/graphql-select`, `packages/ui`, any GraphQL schema/resolver, any frontend file.
- Detected conflicts or variances: None. The manual stopgap noted in the backlog finding (3 dev ESM UUIDs disabled via AWS CLI) is informational only — it does not conflict with this story's code, since AC1's `enabled: false` default achieves the same effect declaratively once deployed.

### References

- [Source: `_bmad-output/implementation-artifacts/backlog/FIND-034-sqs-lambda-poller-idle-cost.md`] — the full investigation, CloudWatch data, and settled fix shape this story formalizes; read in full.
- [Source: `apps/infrastructure/lib/festgrid-backend-stack.ts`] — read in full; confirmed current unconditional `addEventSource` wiring, existing `scraperScheduleRule`/`notifierScheduleRule`/`staleJobSweepRule` precedent, and the absence of any `grantConsumeMessages` call.
- [Source: `apps/infrastructure/lib/festgrid-backend-stack.test.ts`] — read in full; current assertion shape this story's Task 6 extends (no existing `EventSourceMapping` or `rate(5 minutes)` coverage).
- [Source: `apps/backend/src/lambdas/scraper.ts`, `ai-processor.ts`, `ingestor.ts`] — read in full; confirmed the real current branching (or lack thereof) driving AC5/AC6's corrections to the backlog note's claims.
- [Source: `apps/backend/src/lib/aws/send-sqs-message.ts`, `apps/backend/src/lib/scraper/enqueue-scrape-job.ts` + its test] — read in full; the established reassignable-function/setter test-seam pattern AC10/Task 2 follows.
- [Source: `.github/workflows/ci.yml`, `.github/workflows/trigger-scraper.yml`] — confirmed only `FestgridBackendStack-prod` is deployed by CI today; staging is never deployed, informing the staging-treatment question resolved via AskUserQuestion.
- [Source: `_bmad-output/implementation-artifacts/0-27-provision-the-notifier-lambda-s-infrastructure-and-ses-send-permission.md`] — read in full; the closest prior-art infra story, mirrored for its Gate 1/3 "run fresh, cite escape hatch" reasoning, its declined-`addScheduledLambdaTrigger()`-helper precedent, and its overall story shape.
- [Source: `_bmad-output/planning-artifacts/epic-readiness/epic-0-readiness.md`] — confirmed `swept: true` but `stories_covered` stops at `0.19`; basis for running Gate 1/3 fresh.
- [Source: `_bmad-output/planning-artifacts/story-split-gate.md`] — gate definitions, execution protocol, escape-hatch guard, numbering rule (applied to conclude Gate 3's finding does not warrant a split — see Architecture & UX Gate Findings above).
- [Source: `_bmad-output/project-context.md#Security`] — "Resilient Processing Pipeline" rule (SQS-based decoupling); this story preserves the 3-queue architecture unchanged, only changing how each queue is consumed.
- Two design tradeoffs the backlog note's settled design left open (staging's treatment; poll-loop drain depth) were surfaced to and resolved by the user via `AskUserQuestion` during this story's creation — see Architecture & UX Gate Findings above for the full record and reasoning.

## Global Rules References

- `_bmad-output/project-context.md` — Security (Resilient Processing Pipeline: the 3-queue SQS architecture is preserved unchanged, only its consumption mechanism changes; Credential Management: no new secrets/credentials introduced).
- `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order/status vocabulary followed in this file.
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no dedicated `AD-*` rule exists for IaC/EventBridge/queue-polling tooling (confirmed via grep, same finding Stories 0.14/0.25/0.27 already recorded); this story's approach is governed by the existing `scraperScheduleRule`/`staleJobSweepRule`/`sendSqsMessage` precedent already in the codebase.
- `docs/infrastructure/index.md`, `docs/infrastructure/2-backend.md` — no new architecture-diagram node/edge (this story changes how already-diagrammed Lambda/SQS/EventBridge nodes are wired together, it does not add a new AWS service type).
- `_bmad-output/planning-artifacts/story-split-gate.md` — Gate 1/2/3 execution and findings recorded above.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **Modified:** `apps/infrastructure/lib/festgrid-backend-stack.ts`, `apps/infrastructure/lib/festgrid-backend-stack.test.ts`, `apps/backend/src/lambdas/scraper.ts`, `apps/backend/src/lambdas/ai-processor.ts`, `apps/backend/src/lambdas/ingestor.ts`, `SETUP_WALKTHROUGH.md`.
- **New:** `apps/backend/src/lib/aws/poll-and-drain-queue.ts`, `apps/backend/src/lib/aws/poll-and-drain-queue.test.ts`, `apps/backend/src/lambdas/scraper.test.ts`, `apps/backend/src/lambdas/ai-processor.test.ts`, `apps/backend/src/lambdas/ingestor.test.ts`.
- **Not modified:** all 3 handlers' underlying per-message business-logic modules (`process-scrape-job.ts`, `process-ai-job.ts`, `process-ingestion-job.ts`), `packages/database`, `packages/domain`, `packages/graphql-select`, `packages/ui`, GraphQL schema/resolvers, frontend.

### Rule Mapping

- "Resilient Processing Pipeline" (SQS-based decoupling, unchanged) → `project-context.md` → the 3 queues/DLQs/redrive policies are untouched; only their consumption mechanism (ESM vs. scheduled poll-and-drain) changes.
- "Leave the system working end-to-end" (workflow Step 3 critical rule) → Gate 1's re-derivation findings (AC7's missing queue-URL env vars, AC8's missing `grantConsumeMessages`) → both folded into this story's own ACs/Tasks rather than shipped as a broken fix.
- Gate 3's "avoid duplicated shared mechanisms" principle, scoped correctly to this story's own 3 consumers (not a cross-epic split) → AC9/AC10, Task 2's single shared `poll-and-drain-queue.ts` module.
- Established test-seam convention (`send-sqs-message.ts`'s reassignable-function/setter pattern) → AC10 → `poll-and-drain-queue.ts` follows the identical shape, no new mocking approach or dependency introduced.
- Gate 1/2/3 — evaluated and resolved directly in Dev Notes' Architecture & UX Gate Findings; no new prerequisite story required.
- Two real design gaps the settled backlog design left silent on (staging's treatment, poll-loop drain depth) → resolved via `AskUserQuestion` with the user before finalizing ACs, per this workflow's design-tradeoff-surfacing requirement — not silently decided.

### Verification Plan

- `pnpm --filter infrastructure exec cdk synth` succeeds for all three (`dev`/`staging`/`prod`) stack instances (Task 8).
- `apps/infrastructure/lib/festgrid-backend-stack.test.ts`: extended `aws-cdk-lib/assertions` checks — dev-no-context (`Enabled: false` ×3), dev-with-context (`Enabled: true` ×3), prod (`0` `EventSourceMapping` for these 3 queues, `3` new `rate(5 minutes)` rules with the `poll-and-drain` marker, `grantConsumeMessages`-derived IAM statements present) (Task 6/8).
- `apps/backend/src/lib/aws/poll-and-drain-queue.test.ts`: unit tests proving loop-until-drained, time-budget cutoff, delete-only-on-success, and error-swallowing semantics (Task 2/8, AC12).
- `scraper.test.ts`/`ai-processor.test.ts`/`ingestor.test.ts`: unit tests proving each handler's new `poll-and-drain` branch wires the correct queue URL and per-message callback (Task 3/8, AC13).
- `pnpm build`/`pnpm lint` clean at the repo root for `apps/infrastructure` and `apps/backend` (Task 8).
- Explicitly recorded as deferred (not a failure): a real `cdk deploy` plus a live EventBridge-triggered invocation against a real AWS account — no AWS credentials available in this development environment, mirroring Stories 0.14/0.25/0.27's own precedent.

## Pre-Coding Approval Gate

- [x] Scope confirmation: stage-gate the dev/staging `SqsEventSource` (`enabled`, default off, opt-in via `enableNonProdQueuePolling` context flag) for all 3 queues; replace prod's `SqsEventSource` entirely with a 5-minute EventBridge scheduled poll-and-drain per queue, via a new shared `pollAndDrainQueue()` module; add the previously-missing `grantConsumeMessages` grants and queue-URL environment variables needed for the new mechanism to actually function; zero changes to any handler's underlying business logic.
- [x] Architecture and boundary confirmation: Gate 1 — no architecture-layer gap, two real end-to-end completeness gaps folded into this story's own ACs (AC7/AC8). Gate 2 — no gap (zero UI surface, grep-verified). Gate 3 — the EventBridge Rule+Target wiring is a 4th-6th occurrence of an already-declined-helper-extraction pattern (no gap); the receive/delete mechanism itself is a real shared-duplication risk, resolved by building it once within this story's own scope (not split into a separate prerequisite story, since all consumers are inside this story).
- [x] Testing plan confirmation: extended `festgrid-backend-stack.test.ts` CDK assertions (dev gated on/off, prod scheduled-poll wiring) plus new unit tests for `poll-and-drain-queue.ts` and all 3 handlers' new branches; a real `cdk deploy` and live scheduled invocation against real AWS is explicitly deferred (no AWS credentials in this environment).
- [x] Explicit human approval state: **approved** — user (shulha) signed off via AskUserQuestion on 2026-09-18 to start implementation as scoped.
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted: no prerequisite story exists or is needed; Gate 1's two completeness findings are resolved within this story's own scope (see Architecture & UX Gate Findings), Gate 2 found no gap, and Gate 3 found no gap (its shared-mechanism consideration is a within-story avoid-duplication decision, not a cross-story/cross-epic foundational dependency).
- [x] **Staging-treatment decision accepted:** user confirmed via AskUserQuestion (2026-09-18) that staging receives the same gated/default-off/opt-in treatment as dev, not prod's scheduled poll-and-drain mechanism.
- [x] **Poll-loop drain-depth decision accepted:** user confirmed via AskUserQuestion (2026-09-18) that the poll-and-drain branch loops until the queue is drained or a time budget is reached, not a single fixed batch of 10 per invocation.

## Testing Requirements

- [x] Infrastructure assertion tests (required): extended `apps/infrastructure/lib/festgrid-backend-stack.test.ts` via `node:test`/`tsx --test` and `aws-cdk-lib/assertions`, proving the dev/staging gated-ESM `Enabled` toggle and prod's scheduled-poll-and-drain wiring, IAM grants, and environment variables (Task 6).
- [x] Unit tests (required): `poll-and-drain-queue.test.ts` (loop/drain/delete/error semantics) and `scraper.test.ts`/`ai-processor.test.ts`/`ingestor.test.ts` (new poll-and-drain branch wiring) via `node:test`, matching this codebase's existing `apps/backend` test convention (Task 2/3).
- [x] Synth verification (required): `cdk synth` succeeds for all three stage instances (Task 8).
- [x] Integration tests: Not applicable beyond the unit tests above — no GraphQL/resolver/frontend surface changes in this story.
- [x] E2E tests: Not applicable — no UI in this story.
- [x] Manual verification (deferred, tracked): a real `cdk deploy` plus a live EventBridge-triggered invocation, verified the first time CI's deploy job runs against a real AWS account after this story ships (no AWS credentials available in this development environment).

## Deliverables Checklist

- [x] `festgrid-backend-stack.ts`'s 3 target Lambdas' `SqsEventSource` gated via `enableNonProdQueuePolling` (default off) for dev/staging.
- [x] Prod's 3 `SqsEventSource` calls removed entirely; replaced by 3 new `rate(5 minutes)` EventBridge rules with the `poll-and-drain` marker.
- [x] `grantConsumeMessages` added for all 3 Lambda/queue pairs (unconditional, all stages).
- [x] `AI_PROCESSING_QUEUE_URL`/`DATA_INGESTION_QUEUE_URL` environment entries added to `aiProcessorLambda`/`ingestorLambda`.
- [x] `apps/backend/src/lib/aws/poll-and-drain-queue.ts` implemented and unit-tested.
- [x] `scraper.ts`/`ai-processor.ts`/`ingestor.ts` each gain the new poll-and-drain branch, unit-tested.
- [x] Extended `festgrid-backend-stack.test.ts` assertions passing.
- [x] `SETUP_WALKTHROUGH.md` updated with the `enableNonProdQueuePolling` flag note.
- [x] `pnpm build`/`pnpm lint` pass at the repo root for `apps/infrastructure` and `apps/backend`.

## Out of Scope

- Any change to `processScrapeJob`, `processAiJob`, or `processIngestionJob`'s own business logic — this story only changes how each handler is invoked/receives-and-deletes messages.
- A real `cdk deploy` against a live AWS account, and an actual EventBridge-triggered invocation, as part of this story's own automated verification — no AWS credentials available in this development environment; deferred to CI's first real deploy.
- Extracting a reusable "scheduled Lambda trigger" CDK helper for the `Rule`+`Target` wiring pattern — already considered and declined by Story 0.27; not re-opened here (Gate 3).
- Re-scoping `BUG-002`'s missing-Lambda-timeout framing (which is specific to the ESM-invocation model this story removes for `aiProcessorLambda`/`ingestorLambda`) — tracked separately on the backlog board per FIND-034's existing `blocks: [BUG-002]` link; BUG-002 should be re-scoped against the new poll-and-drain model in its own future pass, not as part of this story.
- Setting `reservedConcurrentExecutions` on any of the 3 Lambdas — considered under the overlap-risk discussion in Dev Notes and declined (SQS visibility timeout already prevents double-delivery of the same message; an artificial concurrency cap would only risk throttling drain speed under a real backlog).

## Definition of Done

- [x] AC 1-14 satisfied.
- [x] `cdk synth` succeeds for all three stage instances (Task 8).
- [x] `apps/infrastructure` assertion tests passing, including the new dev-gated/prod-scheduled assertions (Task 6).
- [x] `apps/backend` unit tests passing, including the new `poll-and-drain-queue.ts` and 3 handler-branch test files (Task 2/3).
- [x] `pnpm lint` and `pnpm build` passing for `apps/infrastructure` and `apps/backend`.
- [x] `SETUP_WALKTHROUGH.md` updated (Task 7).
- [x] Pre-Coding Approval Gate explicitly approved by the user before implementation begins.

## Completion Status

- [x] Complete (implementation) — status set to "review" for code-review workflow

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5), via `bmad-dev-story`.

### Debug Log References

- `pnpm --filter infrastructure test` — all 3 suites pass (original resource-count assertions + 2 new Story 0.40 suites: dev-no-context `Enabled: false` ×3, dev-with-context `Enabled: true` ×3, prod ESM-removed/scheduled-poll-and-drain/grants).
- `apps/backend`: `poll-and-drain-queue.test.ts` (4/4), `scraper.test.ts` (2/2), `ai-processor.test.ts` (2/2), `ingestor.test.ts` (2/2) all pass.
- `DEPLOY_STAGE=dev cdk synth`, `DEPLOY_STAGE=staging cdk synth`, and `DEPLOY_STAGE=prod cdk synth` (with the 5 required prod env vars stubbed) all exit 0; prod synth output confirmed 0 `AWS::Lambda::EventSourceMapping` and 3 `{"jobType":"poll-and-drain"}` rule targets for these 3 queues.
- `pnpm build` (repo root, turbo, excludes `ai-dev-orchestrator`) — 7/7 tasks succeed, including `backend:build` (tsc) and `web:build`.
- `pnpm lint` (repo root, turbo) — 0 errors (pre-existing warning-only baseline unchanged).
- Full `apps/backend` test suite (`tsx --test --test-concurrency=1 "src/**/*.test.ts"`, 760 tests): 4 pre-existing failures unrelated to this story (`api-keys.test.ts` ×2 — real AWS KMS `InvalidCiphertextException` against a local dev environment with no working KMS decrypt path; `resolvers.test.ts`'s `events - includeMyArchived opt-in bypass` — a pre-existing test-isolation FK-violation on `account_votes`/`users` cleanup ordering). Verified pre-existing by stashing this story's 3 handler-file changes and re-running `api-keys.test.ts` in isolation — it fails identically with those changes absent. Neither failing suite imports or exercises anything this story touches (SQS/EventBridge/poll-and-drain code). Flagging per workflow instruction rather than silently proceeding; not fixed as part of this story (out of scope).
- Local Postgres was missing a pending migration (`0058_nice_liz_osborn.sql`, adds `events.links`) going into this session; ran `packages/database`'s `migrate.ts` (additive-only, no drops) to bring the dev DB schema current — required for `ingestor.test.ts`'s real-DB integration test to exercise `processIngestionJob` correctly. Unrelated to this story's own scope but necessary for its own new tests to run.

### Completion Notes List

- Manual dev-ESM stopgap (3 dev event-source-mapping UUIDs disabled via `aws lambda update-event-source-mapping --no-enabled`, noted in `backlog/FIND-034-sqs-lambda-poller-idle-cost.md`) was not re-verified against a live AWS account in this session (no AWS credentials available). This is purely informational per Task 1 — AC1's `enabled: false` default is what makes the fix durable across future deploys regardless of the stopgap's current live state; no further action needed either way.
- `pollAndDrainQueue()` implemented per AC9/AC10 in `apps/backend/src/lib/aws/poll-and-drain-queue.ts`, using the exact `receiveSqsMessages`/`setReceiveSqsMessages` + `deleteSqsMessage`/`setDeleteSqsMessage` reassignable-function/setter seam shape already established by `send-sqs-message.ts`. Loop semantics: always issues at least one `ReceiveMessageCommand` regardless of the time budget (so a short-lived invocation still does useful work), then continues until a call returns zero messages or the budget (default 270s) is exceeded after processing the current batch. A message is deleted only after its `handleMessage` callback resolves without throwing; a thrown error is caught, logged, and the message left undeleted so the queue's existing `maxReceiveCount: 3` redrive-to-DLQ policy still applies unchanged.
- All 3 handlers (`scraper.ts`/`ai-processor.ts`/`ingestor.ts`) gained a new `{ jobType: 'poll-and-drain' }` branch per AC5/AC6, each forwarding to `pollAndDrainQueue()` against their own queue URL env var (`SCRAPING_QUEUE_URL` already existed; `AI_PROCESSING_QUEUE_URL`/`DATA_INGESTION_QUEUE_URL` are new per AC7) with a per-message callback mirroring each handler's existing SQS-Records parse-and-forward logic exactly. `ai-processor.ts`/`ingestor.ts`'s return type widened to `Promise<SQSBatchResponse | void>` per the story's plan.
- **Implementation deviation from the story's literal task wording, discovered during Task 3 (documented here since Dev Notes/Tasks aren't editable post-approval):** the story's inline example (`'jobType' in event && event.jobType === 'poll-and-drain'`) does not type-check once a second/third union member also declares a `jobType` field (TS's `in`-narrowing + literal-comparison combination stops collapsing non-`jobType` members to `never`, producing real `tsc` errors — caught by this workflow's own build-gate in Step 7/9, not skipped). Replaced with a small local type-guard function per handler (`isPollAndDrainEvent`, plus `isStaleJobSweepEvent` in `scraper.ts`) using an `(event as { jobType?: unknown }).jobType === '...'` cast internally. Behaviorally identical at runtime to the story's literal example; purely a TypeScript control-flow-narrowing fix. `scraper.ts`'s event type also gained an explicit `StaleJobSweepEvent` union member (reflecting a `jobType` shape already used at runtime via `RuleTargetInput.fromObject({ jobType: 'stale-job-sweep' })` but previously untyped) — required for the new type guard's predicate to type-check.
- `festgrid-backend-stack.ts`: `enableNonProdQueuePolling` computed once and applied to all 3 dev/staging `SqsEventSource` calls (each still gated `if (stageName !== 'prod')`); prod branch adds the 3 new `*PollAndDrainRule-prod` EventBridge rules (`rate(5 minutes)`, `{jobType:'poll-and-drain'}` marker, mirroring `staleJobSweepRule`'s shape exactly), the 2 new queue-URL environment entries, and all 3 `grantConsumeMessages` calls unconditionally (all stages) per AC8.
- `SETUP_WALKTHROUGH.md`: added a new numbered item under "Backend (AWS Serverless) → Setup Steps" documenting the `enableNonProdQueuePolling` context flag and prod's scheduled poll-and-drain mechanism; renumbered the two following `### N.` sub-headings (`Credentials & Secrets Configuration`, `Legacy Stack Cleanup`) from 5/6 to 6/7 to stay sequential.
- A real `cdk deploy` and live 5-minute-scheduled invocation against a real AWS account is deferred per this story's own Out of Scope/Testing Requirements — no AWS credentials available in this development environment, consistent with Stories 0.14/0.25/0.27's precedent.

### File List

**Modified:**
- `apps/infrastructure/lib/festgrid-backend-stack.ts`
- `apps/infrastructure/lib/festgrid-backend-stack.test.ts`
- `apps/backend/src/lambdas/scraper.ts`
- `apps/backend/src/lambdas/ai-processor.ts`
- `apps/backend/src/lambdas/ingestor.ts`
- `SETUP_WALKTHROUGH.md`

**New:**
- `apps/backend/src/lib/aws/poll-and-drain-queue.ts`
- `apps/backend/src/lib/aws/poll-and-drain-queue.test.ts`
- `apps/backend/src/lambdas/scraper.test.ts`
- `apps/backend/src/lambdas/ai-processor.test.ts`
- `apps/backend/src/lambdas/ingestor.test.ts`
