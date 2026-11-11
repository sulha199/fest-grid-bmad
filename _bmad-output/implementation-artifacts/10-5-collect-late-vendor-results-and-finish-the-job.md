---
baseline_commit: e570c049f0c6c7722fe70864ca58d883b498671d
---
# Story 10.5: Collect late vendor results and finish the job

## Story Details

- Epic: 10 (Background vendor jobs: one engine, one Jobs page)
- Story ID: 10.5
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a moderator,
I want a vendor result that arrives after a job's deadline to still be used,
so that a Bright Data snapshot that takes hours heals the post instead of being paid for twice.

## Acceptance Criteria

1. **Given** the post chain (Story 10.2) ran for a job and a Bright Data snapshot was still running when the Bright Data adapter's budget ran out, **when** the attempt is recorded, **then** the snapshot id stays linked to the job in a new table `job_vendor_snapshots` (`job_id`, `provider`, `snapshot_id` unique, `status` `PENDING | COLLECTED | GAVE_UP`, `wait_until`, `collected_at`), written by `fetchScrapedPost` (so no handler has to), and the adapter still throws so the chain moves on to Apify. A job with no `jobId` links nothing. [PRD §3.18 FR119]
2. **And** the 5-minute job sweep gains one step, `collectLateVendorResults`: for each `PENDING` link whose `wait_until` has not passed it asks Bright Data for the snapshot's progress. `ready`: the link is claimed by one conditional `UPDATE ... WHERE status = 'PENDING' RETURNING` (a duplicate delivery or a second sweep finds no row and is a no-op, AC5), the records are downloaded and handed to the job type's registered **late-result handler**, and the job is finished from its answer. `failed`: the link is `GAVE_UP` and a `WAITING` job ends `FAILED` / `VENDOR_RUN_FAILED`. Still running: nothing changes. Progress or download errors are logged and retried on the next sweep; they never throw out of the sweep.
3. **And** finishing a job from a late result is one guarded update (`status IN ('WAITING','RUNNING','EXPIRED')`, and for `EXPIRED` only when `reason_code = 'TIMED_OUT'`): the job becomes the handler's `SUCCEEDED` or `SUCCEEDED_WITH_LIMITS`, `completed_after_deadline` is true when the finish is past `deadline_at` (the PRD's "completed after deadline"), `finished_at` is set, the reason and error message are cleared or replaced by the handler's, then `afterJobEnded` runs (promotes the next queued job, settles followers). A job that ended any other way (`FAILED`, `CANCELLED`, a different `EXPIRED` reason) is never revived: the result is processed by the handler's own idempotent persistence and the job is left as it is. [FR117, FR119]
4. **And** the late-result handler is a second registry beside the job handlers (`registerLateResultHandler(type, handler)` in `lib/job-engine/job-registry.ts`, registered only in the Scraper Lambda): `handler({ jobId, input, records }) => { outcome: 'SUCCEEDED' | 'SUCCEEDED_WITH_LIMITS'; reasonCode?; resultData? }`. **This story registers none for a real type**; Story 10.6 registers the moderator re-extract one, which saves the fresh image links to `posts`. A type with no late-result handler gets its link `GAVE_UP` with a logged warning (nothing to do with the records). Tests use a fixture type. [FR119 "for an image refresh the fresh links are saved": the saving belongs to 10.6's handler]
5. **And** a duplicate delivery is a no-op: the claim in AC2 is the only door, so two deliveries (two sweeps, or a webhook and a sweep) run the handler at most once.
6. **And** the sweep waits for a snapshot Bright Data still reports as running instead of sending it to the paid Apify fallback, **up to `BRIGHTDATA_SNAPSHOT_MAX_WAIT_MINUTES`** (default 480, strict positive integer, on the Scraper Lambda; absorbs IDEA-102): (a) for the **daily batch** (`stale-job-sweep.ts`, `processSingleExpiredBrightDataJob`): a pending job whose snapshot is still `scheduled | building | running` and whose age is under the bound is left `PENDING` with its `expires_at` pushed to the next hourly sweep, no failed run recorded, no fallback enqueued; past the bound it takes today's TIMED_OUT path unchanged; (b) for a **linked job snapshot** (AC2): while it waits the job is `WAITING` and holds no place (FR121); past `wait_until` the link is `GAVE_UP` and a `WAITING` job ends `EXPIRED` / `WAITED_TOO_LONG`. A snapshot the vendor reports `ready` or `failed` is never delayed by the bound.
7. **And** the link is plain words only: no caption, no URL, no vendor error text in the table, the logs or the job row. The table has row level security enabled with no policy (repo RLS test). No vendor call is made by any test; Bright Data is replaced by the existing `setGetBrightDataProgress` and `setGetBrightDataSnapshot` seams.
8. **And** `docs/infrastructure/architecture-diagram.md`, `high-level-overview.md` and AD-53 describe the new table, the new sweep step, the bound and the batch wait; the setting is wired into `env.ts`, `.env.example` and the Scraper Lambda in the CDK stack.

## Tasks / Subtasks

- [x] **Task 1: Pure rules in `packages/domain`** (AC: 2, 3, 6)
  - [x] `packages/domain/src/jobs/late-result.ts` (+ test, 100% coverage): `canSettleFromLateResult({ status, reasonCode })` (true for `WAITING`, `RUNNING`, and `EXPIRED` with `TIMED_OUT`), `decideSnapshotWait({ progressStatus, ageMs, maxWaitMs })` returning `COLLECT | GIVE_UP_FAILED | WAIT | GIVE_UP_TOO_LONG`, and the `JobLateResultHandler` / `LateResultOutcome` types. Export from the `jobs` barrel.
- [x] **Task 2: Schema and migration** (AC: 1, 7)
  - [x] `packages/database/schema.ts`: enum `job_vendor_snapshot_status` and table `job_vendor_snapshots` (`id`, `job_id` fk `jobs.id` ON DELETE CASCADE, `provider` `scraper_run_vendor`, `snapshot_id` text unique, `status` default `PENDING`, `wait_until` timestamptz, `collected_at` nullable, timestamps; index on `(status, wait_until)` and on `job_id`). Generate with drizzle-kit (fetch master first, never hand-number); append `ENABLE ROW LEVEL SECURITY` to the creating migration (the repo RLS test).
- [x] **Task 3: Link the snapshot** (AC: 1)
  - [x] `brightdata-client.ts`: the "snapshot still running after budget" error becomes `BrightDataSnapshotPendingError { snapshotId }` (same message wording, so `isProfileLookupTimeout` still reads it as a timeout).
  - [x] `post-scraper.ts`: when a `jobId` is given and an attempt failed with that error, `linkJobVendorSnapshot({ jobId, provider: 'BRIGHTDATA', snapshotId, waitUntil: now + bound })`; idempotent on `snapshot_id`; failure never changes what the fetch returns.
- [x] **Task 4: Collect** (AC: 2, 3, 4, 5)
  - [x] `lib/job-engine/late-results.ts`: `collectLateVendorResults()`, `settleJobFromLateResult()` and the second registry (`registerLateResultHandler`, `getLateResultHandler` in `job-registry.ts`).
  - [x] `run-job-engine-sweep.ts`: one more step, in its own try/catch, after re-invocation.
- [x] **Task 5: Wait for a running snapshot** (AC: 6)
  - [x] `stale-job-sweep.ts`: the PENDING branch of `processSingleExpiredBrightDataJob` waits while `decideSnapshotWait` says `WAIT`; `brightdata-pending-jobs-store.ts` gets `extendPendingJobExpiry`.
  - [x] `env.ts` `brightdataSnapshotMaxWaitMinutes` (strict `parsePositiveInt`, default 480), `.env.example`, `festgrid-backend-stack.ts` (Scraper Lambda), `env.test.ts` and the stack test.
- [x] **Task 6: Tests** (AC: 1 to 8)
  - [x] Domain: both rules, every branch. Backend real-Postgres suites with the Bright Data seams: link written only with a `jobId` and idempotent; a ready snapshot runs the handler once and finishes a `WAITING` job and a job `EXPIRED / TIMED_OUT` as `SUCCEEDED` with `completed_after_deadline` true; a second sweep is a no-op; a `FAILED` or `CANCELLED` job is not revived but the handler still ran; a failed snapshot gives up; past `wait_until` a waiting job ends `EXPIRED / WAITED_TOO_LONG`; no handler registered gives up with a warning; the daily batch waits for a running snapshot under the bound and falls back past it, and never delays a `ready` or `failed` one; a progress error is retried; the sweep step cannot throw. Every suite deletes the rows it creates (row-count ratchet).
- [x] **Task 7: Docs** (AC: 8)
  - [x] AD-53 (a rule for late results: the link table, the claim, the second registry, the finish rule, the bound, the batch wait), `architecture-diagram.md`, `high-level-overview.md`; mark IDEA-102 per `backlog-spec.md`.

## Dev Notes

- **What exists today (read these first).** `stale-job-sweep.ts` (hourly, the batch path: it already downloads a `ready` snapshot after `expires_at` and processes it; a still-running one is recorded TIMED_OUT and falls back to Apify, which is IDEA-102); `process-brightdata-result.ts`; `brightdata-pending-jobs-store.ts`; `fetch-vendor-run-output.ts` (`fetchBrightDataRunOutput`: progress then snapshot); `brightdata-client.ts` (`getBrightDataProgress`, `getBrightDataSnapshot`, the post scrape of Story 10.2 whose polling loop throws a plain `Error` when the budget runs out); the 5-minute job sweep `run-job-engine-sweep.ts`; the job engine `run-job.ts` (`finish` with `completedAfterDeadline`) and `after-job-ended.ts`.
- **Why a new table and not `brightdata_pending_jobs`.** That table is the profile batch's: it needs a profile id, a webhook token and an expiry, and its webhook and sweep processors write posts for a profile. A post snapshot from the sync `/datasets/v3/scrape` has no webhook and no profile; it belongs to a job. A separate small table keeps both paths unchanged, and the claim (`PENDING` to `COLLECTED`) is the duplicate-delivery guard. The webhook path for batch snapshots already processes late deliveries (PR #118) and is not touched.
- **Decisions made at story creation (owner, please look).** (1) A late result REVISES an `EXPIRED / TIMED_OUT` job to `SUCCEEDED` with `completed_after_deadline` true (the PRD's "completed after deadline"); no other ending is revised. (2) The wait bound defaults to 480 minutes (8 h): on 2026-10-29, 21 of 38 snapshots took 5 to 6 hours; the bound is an assumption to tune. (3) This story builds the mechanism and tests it with a fixture type; it registers no real late-result handler: saving the fresh links to `posts` is the re-extract job type's (Story 10.6). (4) Only the sweep collects a linked snapshot (no webhook: the sync call registers none).
- **Guardrails.** Vendor calls only through the guarded wrapper (the existing client functions); no secret, caption, signed URL or raw vendor error in a log, the table or a job row; `packages/domain` pure and 100% covered; drizzle-kit migration, fetch master first; RLS on the new table; no vendor call and no Lambda invoke in any test or by the build session.
- **Reusable mechanisms (project rule).** The wait rule and the settle rule are pure and live in `packages/domain`; the table, the registry and the sweep step in `apps/backend/src/lib/job-engine`. No UI, analytics or i18n; no new service (no `SETUP_WALKTHROUGH.md` change).

### Data Type Compatibility & Migration Requirements

- **Database.** New enum `job_vendor_snapshot_status` and new table `job_vendor_snapshots`; `provider` reuses `scraper_run_vendor` (`APIFY | BRIGHTDATA`). `snapshot_id` is text (Bright Data's id), unique. RLS enabled, no policy. No backfill, no change to an existing column.
- **TypeScript.** New domain types (`JobLateResultHandler`, `LateResultOutcome`, the wait decision); `BrightDataSnapshotPendingError`; `Env` gains `brightdataSnapshotMaxWaitMinutes`.
- **Backward compatibility and rollout.** The only behaviour change for existing code is the daily batch waiting up to the bound for a snapshot Bright Data still reports as running, instead of falling back to Apify at once (intended, IDEA-102): such profiles are scraped later by Bright Data instead of immediately by Apify, and Apify spend drops. No job type is registered yet, so the linked-snapshot path is idle in production until Story 10.6.
- **Verification.** Migration applies on a seeded database and the RLS test passes; the sweep and wait tests; the row-count ratchet; lint, build and the infrastructure test.

### Architecture & UX Gate Findings

- **Gate 1 and Gate 3 cited from the epic-wide sweep** (`epic-readiness/epic-10-readiness.md`, `swept: true`): a sweep step and one table inside the existing Scraper Lambda, no new service, queue or secret. **Lightweight guard performed:** the one thing the sweep did not anticipate is a link table between a job and a vendor snapshot (one new table); no gap.
- **Gate 2:** not applicable, no UI.
- **Prerequisites:** Stories 10.1a and 10.2 are done.

### Project Structure Notes

- **New:** `packages/domain/src/jobs/late-result.ts` (+ test); `apps/backend/src/lib/job-engine/{late-results,link-job-vendor-snapshot}.ts` (+ tests); one migration.
- **Modified:** `packages/database/schema.ts`; `packages/domain/src/jobs/index.ts`; `apps/backend/src/lib/scraper/{brightdata-client,post-scraper,stale-job-sweep,brightdata-pending-jobs-store}.ts`; `apps/backend/src/lib/job-engine/{job-registry,run-job-engine-sweep}.ts`; `apps/backend/src/env.ts`, `.env.example`; `apps/infrastructure/lib/festgrid-backend-stack.ts` (+ test); spine AD-53; both infrastructure docs; `backlog.yaml` (IDEA-102).
- **Not modified:** the Bright Data webhook, `process-brightdata-result.ts`, any `.graphql` file, `apps/web`, `packages/ui`, `start-post-reextraction-preview.ts`.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Epic 10`, Story 10.5] and `epic-readiness/epic-10-readiness.md`.
- [Source: PRD 3.18 FR117, FR119, FR121; 4.21 `Job.completedAfterDeadline`.]
- [Source: Architecture Spine AD-53 (engine), AD-32, AD-43 (Bright Data result handling).]
- [Source: `docs/infrastructure/incidents/2026-10-30-apify-monthly-cap-and-late-brightdata-delivery.md`; `backlog.yaml` IDEA-102.]
- [Source: code read while creating this story: `lib/scraper/{stale-job-sweep,process-brightdata-result,brightdata-pending-jobs-store,fetch-vendor-run-output,brightdata-client,post-scraper}.ts`, `lib/job-engine/{run-job,after-job-ended,job-registry,run-job-engine-sweep}.ts`, `packages/database/schema.ts`.]

## Global Rules References

- `_bmad-output/project-context.md` (Drizzle only, drizzle-kit migrations, RLS on every new table, `packages/domain` purity and 100% coverage, real-Postgres integration tests, row-count ratchet).
- `_bmad-output/planning-artifacts/story-content-structure.md`.
- Architecture spine: AD-32, AD-43, AD-53; PRD 3.18.
- Infrastructure docs: `docs/infrastructure/index.md`, `architecture-diagram.md`, `high-level-overview.md` (CLAUDE.md §4).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:** see Project Structure Notes.
- **Rule Mapping:**
  - Pure wait and settle rules in `packages/domain`, 100% covered → `project-context.md` → Task 1.
  - drizzle-kit migration, RLS on the new table → `project-context.md` → Task 2.
  - Vendor calls only through the existing guarded client functions → AD-32 → Tasks 3 to 5.
  - Plain words only in rows and logs → PRD 3.18 / FR117 → Tasks 3, 4.
  - CLAUDE.md §4 diagram upkeep → Task 7.
  - Story-split-gate: Gate 1 and 3 cited from the swept report plus a lightweight guard; Gate 2 not applicable → Dev Notes.
- **Verification Plan:**
  - `pnpm --filter @festgrid/domain test` (100% coverage); `pnpm --filter @festgrid/database run generate` then `run migrate`.
  - New and changed backend suites, then the full suite through `scripts/run-tests-with-row-count-ratchet.ts` (with `GEOAPIFY_API_KEY=test-geoapify-key`); `pnpm --filter infrastructure test`.
  - `pnpm build` and `pnpm lint` at the root.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: the link table, the sweep step, the second registry, the finish rule, the wait bound for batch and linked snapshots; no real late-result handler. Pending approval.
- [ ] Architecture and boundary confirmation: pure rules in `packages/domain`; one new table; one new setting; no new service. Pending approval.
- [ ] Testing plan confirmation: domain 100% coverage; real-Postgres suites with the Bright Data seams; the row-count ratchet; the infra stack test. Pending approval.
- [ ] Explicit human approval state: **pending approval.**
- [ ] Gate 1/2/3 prerequisites confirmed from the swept readiness report plus the lightweight guard. Pending user acknowledgement.
- [ ] Decisions acknowledged: a late result revises `EXPIRED / TIMED_OUT` to `SUCCEEDED`; the 480-minute bound is an assumption. Pending user acknowledgement.

## Testing Requirements

- [ ] Unit tests (required, `packages/domain`, 100% coverage): `late-result.test.ts`.
- [ ] Integration tests (required, real local Postgres, Bright Data seams, no vendor call): the late-result suites, the daily-batch wait tests, the env and stack tests.
- [ ] E2E tests: not applicable.

## Deliverables Checklist

- [ ] `late-result.ts` in `packages/domain`, exported, 100% covered.
- [ ] `job_vendor_snapshots` table and migration applied locally with RLS.
- [ ] Snapshot link, `collectLateVendorResults`, the second registry and the batch wait.
- [ ] `BRIGHTDATA_SNAPSHOT_MAX_WAIT_MINUTES` in `env.ts`, `.env.example` and the CDK stack.
- [ ] AD-53, `architecture-diagram.md`, `high-level-overview.md` and IDEA-102 updated.
- [ ] All new tests passing; `pnpm build` and `pnpm lint` clean.

## Out of Scope

- A real late-result handler and saving fresh image links to `posts`: Story 10.6.
- A late result for Apify (its runs are bounded at 20 s on this path).
- A Bright Data webhook for the sync post scrape (it registers none).
- Reviving a job that ended `FAILED`, `CANCELLED` or `EXPIRED` for another reason.
- The Jobs page showing "completed after deadline": Story 10.4.

## Definition of Done

- [ ] AC 1-8 satisfied.
- [ ] All new unit, integration and infra tests passing.
- [ ] `pnpm lint` and `pnpm build` passing for `packages/domain`, `packages/database`, `apps/backend`, `apps/infrastructure`.
- [ ] Migration generated with a correct, non-colliding number (re-verified against `origin/master` immediately before generation) and applied locally.
- [ ] `docs/infrastructure/architecture-diagram.md`, `high-level-overview.md` and AD-53 updated in the same change.
- [ ] Pre-Coding Approval Gate explicitly approved by the user before implementation begins.

## Completion Status

- [ ] Not started
- Creation note (2026-11-11): created with the mechanism-only scope (the real handler is Story 10.6) and two assumptions flagged for acknowledgement (the 480-minute bound; revising an `EXPIRED / TIMED_OUT` job on a late result). IDEA-102 absorbed.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5 (cloud session; built on branch `feat/job-late-results` from master after PR #237).

### Debug Log References

- Pre-Coding Approval Gate: the user asked in conversation to continue with the next Epic 10 story, so the Gate's approval boxes are left for the user to tick. **Open flags, not resolved here:** the 480-minute wait bound is an assumption (on 2026-10-29, 21 of 38 snapshots took 5 to 6 hours); and no real job type registers a late-result handler yet, so the linked-snapshot path is idle in production until Story 10.6. No vendor call was made at any point.
- The two sweep suites (`stale-job-sweep.test.ts` and `stale-job-sweep-brightdata.test.ts`) both call the shared `runStaleJobSweep`, so they interfere when run in parallel (each sweeps the other's expired job). That is how they were before this story; the full-suite runner runs files one at a time.

### Completion Notes List

- **Domain (Task 1).** `late-result.ts`: `decideSnapshotWait` (COLLECT, GIVE_UP_FAILED, WAIT, GIVE_UP_TOO_LONG), `canSettleFromLateResult`, `isCompletedAfterDeadline`, and the `JobLateResultHandler` / `LateResultOutcome` types. 100% coverage kept.
- **Table (Task 2).** `job_vendor_snapshots` and its enum (migration 0103, RLS enabled in the creating migration, the repo RLS test passes). The migration number was re-verified against `origin/master` (0102 was the latest).
- **Link (Task 3).** `BrightDataSnapshotPendingError` carries the snapshot id (message wording unchanged, so the timeout classifier still reads it as a timeout); `fetchScrapedPost` links it when a `jobId` is given, through `linkJobVendorSnapshot` (idempotent, never throws).
- **Collect (Task 4).** `collectLateVendorResults` as a new step of the 5-minute job sweep, `settleJobFromLateResult`, and the second registry (`registerLateResultHandler`). Records are downloaded before the claim; the claim (PENDING to COLLECTED, one conditional update) is the only door; a throwing handler puts the link back to PENDING.
- **Wait (Task 5).** The daily batch (`stale-job-sweep.ts`) waits for a snapshot still reporting `scheduled | building | running` under the bound (its expiry is pushed an hour, no failed run, no fallback); past the bound the old TIMED_OUT path runs unchanged; `ready` and `failed` are never delayed. `BRIGHTDATA_SNAPSHOT_MAX_WAIT_MINUTES` (strict positive integer, default 480) is on the Scraper Lambda.
- **Decisions beyond the story text (reviewer, please look at these).**
  1. *The wait bound for a link is stored as `wait_until`* when the link is written (`now + bound`), and the sweep derives the age from `created_at`, so changing the setting later does not move links already written.
  2. *A handler that throws puts the link back to PENDING* (not GAVE_UP): handlers are idempotent by contract and the wait bound still ends the retries.
  3. *A job that cannot be settled is not revived but its records are still handed to the handler*, so a late result for a cancelled job still heals the post.
  4. *A `RUNNING` job is also settleable* (domain rule), for a job whose run is still going when the snapshot lands; the run's own guarded writes then refuse, as they do for any ended job.
  5. *Link rows for an unknown job or a provider other than Bright Data are given up with a warning.*
- **Tests.** Domain 1781 passing, 100% coverage. Backend real-Postgres suites with the Bright Data seams: `late-results` (the main behaviours incl. duplicate delivery, two sweeps at once, ready, running, failed, past the bound, no handler, progress and download and handler errors, promotion of the next queued job), `link-job-vendor-snapshot`, the link and pending-error cases in `post-scraper` and `brightdata-post-scrape`, the batch wait cases in `stale-job-sweep-brightdata` (the old "still running is TIMED_OUT" test now sets the job age past the bound), the sweep-order test, the env and stack tests.
- **Not done here (by design).** No real late-result handler and no saving of fresh links to `posts` (Story 10.6); no webhook for the sync post scrape; no UI.

### File List

Added: `packages/domain/src/jobs/late-result.ts` and `.test.ts`; `packages/database/migrations/0103_job_vendor_snapshots.sql` and `meta/0103_snapshot.json`; `apps/backend/src/lib/job-engine/{late-results,link-job-vendor-snapshot}.ts` and `.test.ts`.

Changed: `packages/domain/src/jobs/index.ts`; `packages/database/schema.ts`, `migrations/meta/_journal.json`; `apps/backend/src/lib/scraper/{brightdata-client,post-scraper,stale-job-sweep,brightdata-pending-jobs-store}.ts`; `apps/backend/src/lib/job-engine/{job-registry,run-job-engine-sweep}.ts`; `apps/backend/src/env.ts`; tests `post-scraper`, `brightdata-post-scrape`, `stale-job-sweep-brightdata`, `run-job-engine-sweep`, `env`, `ai-processor/{rehost-post-image,upload-face-blur-thumbnail}`; `apps/infrastructure/lib/festgrid-backend-stack.ts` and its test; `.env.example`; `docs/infrastructure/architecture-diagram.md`, `high-level-overview.md`; `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-53 Rule 16); this story and `sprint-status.yaml`.

### Change Log

- 2026-11-11: Story 10.5 built: late Bright Data results are linked to their job, collected by the 5-minute job sweep and finish the job "completed after deadline"; the daily batch waits for a snapshot still running, under `BRIGHTDATA_SNAPSHOT_MAX_WAIT_MINUTES` (default 480), instead of falling back to Apify at once; migration 0103; AD-53 Rule 16 added.
