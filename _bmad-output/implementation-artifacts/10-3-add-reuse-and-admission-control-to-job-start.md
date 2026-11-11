# Story 10.3: Add reuse and admission control to job start

## Story Details

- Epic: 10 (Background vendor jobs: one engine, one Jobs page)
- Story ID: 10.3
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want starting the same work twice to join the running job, and starting several at once never to push me past my plan or be turned away,
so that I never pay twice, never exceed my subscription cap and never get a refusal for work I am allowed to start.

## Acceptance Criteria

1. **Given** a non-terminal job of the same type and input key for the same user, **when** it is started again, **then** `startJob` returns that job's id with the outcome `REUSED`, writes no new row, invokes nothing, and two simultaneous starts yield one job (a partial unique index is the backstop). [PRD §3.18 FR120]
2. **And** a job type may declare `sharedAcrossUsers` (default false; its `resultData` is then public by contract). **Given** such a type and a job of the same type and input key that another user has already admitted and not ended, **when** a different user starts it, **then** that user's job is written as a follower: status `WAITING`, `leader_job_id` pointing at the first job, no place held, no vendor call of its own. When the leader ends (any terminal status, including swept as expired), every follower ends with the same status, reason code and `resultData`; a follower whose leader was lost (row deleted, wake-up missed) is settled by the 5-minute sweep. No type is flagged in this story: this is proven with fixture types, and Stories 10.6 and 10.7 flip the flag where the result is public. [FR120]
3. **And** admission is per user account, atomic, and applies to user jobs only (system jobs, FR130, use and wait for no user's places). One function, `admitJob`, decides it for `startJob`, for promotion and for re-admission: inside one transaction holding a row lock on the user (`SELECT ... FOR UPDATE` on `users`), it applies reuse, the cap, sharing and the limits in that order. A job **holds a place from its admission** until it ends or goes `WAITING` (an admitted job not yet claimed by a worker counts, otherwise simultaneous starts would all see zero running). At most `MAX_CONCURRENT_JOBS_PER_USER` (default 3) places are held at once; every job type counts. A `QUEUED` job that is not admitted and a `WAITING` job hold none. [FR121]
4. **And** a job started over the limit is accepted as `QUEUED` and not admitted (`admitted_at` null), stamped with `queued_since`; it is promoted oldest first (by `queued_since`, then id) when a place frees: at the end of the worker's run (any ending, and `WAITING`), after a failed start, by `cancelJob`, and by the 5-minute sweep (so a lost wake-up cannot strand it). Promotion sets `admitted_at`, re-sets `deadline_at` to now plus the type's `maxDurationMs`, and invokes the host Lambda. At most `MAX_QUEUED_JOBS_PER_USER` (default 10) may wait; a start beyond that is refused with `JOB_QUEUE_FULL`. A job queued longer than `JOB_QUEUE_MAX_WAIT_MINUTES` (default 30, counted from `queued_since`) ends `EXPIRED` with the reason `WAITED_TOO_LONG` in the same 5-minute sweep (no second sweep). [FR121]
5. **And** a `WAITING` job is re-admitted like a new start: `readmitWaitingJob(jobId)` moves it to the queue (`QUEUED`, not admitted, `queued_since` now) and promotes, so it takes the next free place or waits its turn. The 5-minute sweep calls it for every non-follower `WAITING` job whose `resume_at` is due, and event sources (Story 10.5's late result, Story 10.12a's finished post) call it directly. **The worker's claim no longer takes a `WAITING` row** (it would bypass admission); it takes only admitted `QUEUED` and `RUNNING` rows. (Resolves code-review finding 2 of Story 10.1a.)
6. **And** `cancelJob(jobId, ownerUserId)` ends an owned, non-terminal job `FAILED` with the reason `CANCELLED` (guarded, so a job that already ended is untouched), releases its place and any subscription slot, promotes the next queued job and settles its followers. A running handler cannot be stopped from here; its late writes are refused by the existing write guard. Story 10.7 calls it when a user removes an account that is still being added. [FR122]
7. **And** the subscription cap is built here (IDEA-008 had not landed; the code has no cap today). `MAX_SUBSCRIBED_ACCOUNTS_FREE_USER` (default 5) applies to **every user who is not a moderator** (a moderator is exempt but still bound by the job limit); there is no tier model yet. Per PRD FR122 it counts active (not soft-deleted) subscriptions plus **reserved slots**: non-terminal jobs of a type that declares `reservesSubscriptionSlot` for that user. A user already above the cap keeps every subscription and cannot add another until below it. Re-subscribing to an account the user already holds uses no extra slot. A refusal is typed: `SubscriptionCapReachedError { activeCount, reservedCount, cap }`, which the `subscribeToAccount` resolver maps to a GraphQL error `SUBSCRIPTION_CAP_REACHED` with those three numbers in `extensions` (the refusal screen and the upgrade call to action are Story 10.3a). [PRD §6, FR122]
8. **And** the cap is enforced wherever a subscription becomes active: `subscribeToAccount` (the only insert; the check and the insert become one transaction under the user lock, and it runs BEFORE any profile classification or scrape starts, so a refused subscribe spends no vendor credit) and `removeSubscription` with `RESTORE`.
9. **And** the 10-minute rescrape cooldown starting only when a vendor call actually ran (FIND-261102-4qm) is already built and tested (PR #184, `start-post-reextraction-preview.test.ts`); this story changes nothing there and must keep that test green.
10. **And** the concurrency tests pass against real Postgres: (a) six `startJob`s at once for one user: exactly `MAX_CONCURRENT_JOBS_PER_USER` are admitted, the rest `QUEUED`, none lost, none duplicated; (b) five slot-reserving starts for a user holding none: three admitted, two queued, and a sixth refused by the cap, not by the job limit; (c) two simultaneous slot-reserving starts for a user holding four active subscriptions: exactly one succeeds; (d) two simultaneous `subscribeToAccount` calls at four subscriptions: exactly one succeeds; (e) the same input started twice at once: one job; (f) a follower settles with its leader's outcome, including when the leader is expired by the sweep.
11. **And** `docs/infrastructure/architecture-diagram.md`, `high-level-overview.md` and AD-53 describe the shipped behaviour (place held from admission, queue, re-admission, leader and follower), and the four new settings are wired into the API, scraper and AI-processor Lambdas.

## Tasks / Subtasks

- [ ] **Task 1: Pure rules in `packages/domain`** (AC: 2, 3, 4, 7)
  - [ ] Add `packages/domain/src/jobs/admission.ts` (+ test, 100% coverage): `holdsPlace({ status, admittedAt })` (admitted and `QUEUED` or `RUNNING`); `decideAdmission({ placesHeld, queued, maxPlaces, maxQueued })` returning `ADMIT`, `QUEUE` (with the position) or `REFUSE_QUEUE_FULL`; `queuePosition` helper used by Story 10.4. No DB, no Node-only import.
  - [ ] Add `packages/domain/src/subscriptions/subscription-cap.ts` (+ test, 100% coverage): `evaluateSubscriptionCap({ isModerator, activeCount, reservedCount, alreadyHeld, cap })` returning `{ allowed: true }` or `{ allowed: false, activeCount, reservedCount, cap }`; moderator and already-held are always allowed; at or above the cap is refused (so a user above it cannot add). Export `SubscriptionCapReachedError` here (a plain class with the three numbers, no ORM).
  - [ ] Extend `JobTypeDefinition` in `packages/domain/src/jobs/job-engine.ts` with optional `sharedAcrossUsers?: boolean` and `reservesSubscriptionSlot?: boolean` (both default false); extend the register tests (the existing validation stays). Export both new modules from their folder barrels and the `./jobs` and subscriptions entries (the `public-api` test loads every barrel).
- [ ] **Task 2: Schema and migration** (AC: 1, 2, 4)
  - [ ] In `packages/database/schema.ts` add to `jobs`: `leaderJobId: uuid('leader_job_id').references((): AnyPgColumn => jobs.id, { onDelete: 'set null' })` and `queuedSince: timestamp('queued_since', { withTimezone: true })`; add `idx_jobs_leader` on `leader_job_id` and the queue index `(owner_user_id, queued_since)` for rows with `admitted_at IS NULL AND status = 'QUEUED'`.
  - [ ] Generate with drizzle-kit (never hand-number: first `git fetch origin master` and re-confirm the latest migration, expected 0097; take the next). The partial unique index for reuse, `(owner_user_id, type, input_key) WHERE owner_user_id IS NOT NULL AND leader_job_id IS NULL AND status NOT IN ('SUCCEEDED','SUCCEEDED_WITH_LIMITS','FAILED','EXPIRED')`, and the partial queue index are hand-written SQL in a second `--custom` migration, because drizzle-kit drops the WHERE clause of a partial index (project-context, AD-8 workaround). Both migrations idempotent; RLS stays on (no new table).
- [ ] **Task 3: Settings** (AC: 3, 4, 7, 11)
  - [ ] `apps/backend/src/env.ts`: `maxConcurrentJobsPerUser` (3), `maxQueuedJobsPerUser` (10), `jobQueueMaxWaitMinutes` (30), `maxSubscribedAccountsFreeUser` (5), all through the strict `parsePositiveInt`; root `.env.example`; CDK (`festgrid-backend-stack.ts`) passes all four to the API, scraper and AI-processor Lambdas (admission runs in the API Lambda; promotion runs in both workers and the sweep) with the same defaults; extend `env.test.ts` and the stack test.
- [ ] **Task 4: `admitJob` and `startJob`** (AC: 1, 2, 3, 4, 7, 10)
  - [ ] Add `apps/backend/src/lib/job-engine/admit-job.ts`: one transaction, `SELECT ... FROM users WHERE id = $1 FOR UPDATE` first; then reuse (same owner, type, input key, non-terminal, not a follower), the cap for a `reservesSubscriptionSlot` type (using `evaluateSubscriptionCap`; `alreadyHeld` is passed in by the caller), sharing for a `sharedAcrossUsers` type (leader = oldest admitted, non-terminal, non-follower job of the same type and input key from another owner), then `decideAdmission` on a count of held places and queued jobs. Insert accordingly (`admitted_at` and `deadline_at = now + maxDurationMs` when admitted; `queued_since` when queued; a follower is `WAITING`, admitted, `leader_job_id` set). Return `{ jobId, outcome: 'ADMITTED' | 'QUEUED' | 'REUSED' | 'SHARED', position? }` or a typed refusal. The partial unique index is the backstop: catch its violation and return the existing job.
  - [ ] `start-job.ts` uses `admitJob` (this replaces the inline `admittedAt = now`); only an `ADMITTED` job is invoked, after the transaction commits; a failed invoke marks it FAILED (`START_FAILED`) and promotes the next queued job. `StartJobResult` becomes `{ jobId, outcome, position? } | { errorCode: 'JOB_START_FAILED' | 'JOB_QUEUE_FULL' | 'SUBSCRIPTION_CAP_REACHED', errorMessage, details? }`.
  - [ ] Replace the inline "who may run now" decision the Story 10.1a Dev Notes name (resolves review finding 9b): `startJob`, `promoteQueuedJobs` and `readmitWaitingJob` all go through `admitJob`'s counting and insert/update helpers, never their own.
- [ ] **Task 5: Promotion, re-admission, cancel, followers** (AC: 4, 5, 6, 2)
  - [ ] Add `promote-queued-jobs.ts` (`promoteQueuedJobs(ownerUserId)`: lock the user, count held places, admit the oldest queued up to the free places, set `admitted_at` and `deadline_at`, invoke each host after commit; an invoke failure ends that job `START_FAILED` and the loop continues), `readmit-waiting-job.ts` (`readmitWaitingJob(jobId)`: guarded `WAITING` to `QUEUED`, not admitted, `queued_since` now, then promote), `cancel-job.ts`, and `settle-followers.ts` (`settleFollowers(leaderJobId)`: followers take the leader's status, reason code, `resultData`, `finished_at`; idempotent).
  - [ ] `run-job.ts`: claim only admitted `QUEUED` and `RUNNING` (drop `WAITING`); after every write that ends a run (finish, expire, `WAITING`) call `promoteQueuedJobs(owner)` and, for a terminal status, `settleFollowers(job.id)`. Both are best-effort and logged: a failure never changes the job's own outcome (the sweep repairs it).
  - [ ] Update the Story 10.1a worker tests that asserted the old claim (`WAITING` claimable once due) to the new rule: a `WAITING` row is never claimed directly.
- [ ] **Task 6: Sweep** (AC: 4, 5, 2)
  - [ ] Extend `runJobEngineSweep` (same 5-minute rule, each step in its own try/catch): (a) expire unadmitted `QUEUED` jobs past `queued_since + JOB_QUEUE_MAX_WAIT_MINUTES` as `EXPIRED`/`WAITED_TOO_LONG`, (b) `readmitWaitingJob` for each non-follower `WAITING` row with `resume_at` due, (c) `promoteQueuedJobs` for each owner that has queued jobs and a free place, (d) `settleFollowers` for followers whose leader is terminal, and expire followers past their own deadline (the existing deadline sweep already covers the last).
- [ ] **Task 7: Subscription cap** (AC: 7, 8)
  - [ ] Add `apps/backend/src/lib/subscriptions/subscription-cap.ts`: counts active subscriptions and reserved slots for a user (inside the caller's transaction, after the user lock) and calls `evaluateSubscriptionCap`; moderator read from `users.role`.
  - [ ] Read `subscribe-to-account.ts` in full first. Make the cap check and the subscription insert one transaction under the user lock, executed before the classification and scrape side effects; keep every existing behaviour (find-or-create profile, `alreadySubscribed`, the AD-41/AD-34 cascade) intact and tested.
  - [ ] `removeSubscription` `RESTORE`: same lock and check before un-deleting.
  - [ ] Resolver: map `SubscriptionCapReachedError` to `GraphQLError` code `SUBSCRIPTION_CAP_REACHED` with `activeCount`, `reservedCount`, `cap` in `extensions`, the pattern of `SCRAPER_CAPACITY_EXCEEDED`; regenerate the GraphQL types if an enum changes. No schema file needs the new code (errors travel in `extensions`).
- [ ] **Task 8: Tests** (AC: 1 to 10)
  - [ ] Domain: `admission.test.ts`, `subscription-cap.test.ts`, the extended definition tests (100% coverage gate).
  - [ ] Backend real-Postgres suites in `apps/backend/src/lib/job-engine/`: `admit-job.test.ts` (reuse, queue, queue full, ordering, cap, share), `promote-queued-jobs.test.ts`, `readmit-waiting-job.test.ts`, `cancel-job.test.ts`, `settle-followers.test.ts`, the extended sweep tests, and `admission.concurrency.test.ts` for AC 10 (a) to (f) using `Promise.all`; `subscribe-to-account` cap and RESTORE tests next to the existing ones, including AC 10 (d). Every suite deletes the users, jobs and subscriptions it creates (row-count ratchet).
- [ ] **Task 9: Architecture and docs** (AC: 11)
  - [ ] Amend AD-53 (rules 5, 7 and 9, and the Deferred list): place held from admission, queue and `queued_since`, re-admission and the claim change, leader and follower, the cap and its reservation; the resume driver is no longer deferred. Update `architecture-diagram.md` and `high-level-overview.md` (no new Lambda, queue or secret; the new columns and the sweep's added steps), CLAUDE.md §4.

## Dev Notes

- **Architecture and technical constraints.** This is the second mechanism story of the engine (AD-53). Everything pure goes in `packages/domain` (no `drizzle-orm`, no Node-only import); everything that touches the database or AWS stays in `apps/backend/src/lib/job-engine/`. The API Lambda runs `admitJob` and `startJob`; it must not import a job handler (the AI-processor's `sharp` and `face-api` bundle; `lambda-sharp-isolation.test.ts` fails the build otherwise). Admission is serialized per user by a row lock on `users`: a transaction-scoped row lock is safe under the Supabase transaction-mode pooler, unlike a session advisory lock (AD-32).
- **What exists today (read these first).** Story 10.1a is on master; its review follow-ups are PR #219 (abort signal on the handler context, plain-words `error_message`, `START_FAILED`, `HANDOFF_MISSING`, strict settings, the pure `Job` type and `jobHasValidOwner`). **This story depends on PR #219 being merged**: it edits `run-job.ts` and `start-job.ts` on top of those changes.
  - `lib/job-engine/start-job.ts` today inserts the row with `admittedAt = now` and invokes the host: admission does not exist yet.
  - `lib/job-engine/run-job.ts` claims `QUEUED`, `RUNNING` and `WAITING` rows (admitted; `WAITING` only once `resume_at` is due). Nothing re-invokes a due `WAITING` job (code-review finding 2). This story changes the claim to admitted `QUEUED` and `RUNNING` only.
  - `lib/job-engine/sweep-expired-jobs.ts` ends admitted, non-terminal jobs past `deadline_at`; `run-job-engine-sweep.ts` runs the two halves each in its own try/catch.
  - `packages/domain/src/jobs/job-engine.ts` has `isPlaceHoldingJobStatus` (status only: `RUNNING`). That function stays; the new `holdsPlace` (admission-aware) is what counts places. Document the difference in the code comment so nobody counts with the wrong one.
  - There is **no subscription cap anywhere** in the code and no user-tier model; `users.role` has `user` and `moderator`. `subscribeToAccount` (`lib/subscriptions/subscribe-to-account.ts`) has one insert; `removeSubscription` `RESTORE` in `schema/resolvers.ts` is the only other way a subscription becomes active.
  - `SCRAPE_IN_PROGRESS` (FIND-110's per-URL lease in `extractEventDataFromUrl`) is **not touched here**: its replacement by job reuse happens in the adoption stories (10.6 re-extract, 10.10 extract-by-URL), because no real job type exists until then.
- **Decisions taken with the product owner while creating this story (2026-11-11).** (1) The cap's refusal screen, the upgrade call to action and the two PostHog events are a separate Story 10.3a; this story ships only the typed refusal that carries the counts. (2) The cap applies to every non-moderator, existing subscriptions are never removed, and re-subscribing uses no slot; the PRD's `free_user` wording waits for a tier model. (3) Sharing one vendor call between users is built now, opt-in per job type through `sharedAcrossUsers`, proven with fixtures. (4) Code-review findings 2 and 9b of Story 10.1a (the resume driver and the single admission function) belong here.
- **Reservation storage.** No new table: a reserved slot is a non-terminal job of a type with `reservesSubscriptionSlot`, so it is released automatically when the job ends, fails, expires or is cancelled (`cancelJob`). The cap check, the reservation (the job insert) and the subscription insert all happen under the same user lock.
- **Place accounting, precisely.** PRD FR121 says only a running job holds a place. A job the worker has not yet claimed is `QUEUED` with `admitted_at` set; it must already count, or six simultaneous starts all see zero running. So a place is held from admission. Say so in AD-53 (Task 9).
- **Leader and follower.** A follower holds no place, is bounded by its own `deadline_at` (swept like any job) and copies only what the type declares public (`resultData`). Followers never attach to an unadmitted (queued) leader, and a follower never becomes a leader. `leader_job_id` is `ON DELETE SET NULL`: a lost leader leaves the follower to the deadline sweep.
- **Reuse key.** `input_key` is the normalized identity of the work (the adoption story defines each type's key). Reuse matches the same owner, type and key among non-terminal, non-follower rows.
- **Package boundaries (project-context).** No React, `react-query`, `nuqs` or `zustand` here (this story has no UI; the refusal screen is 10.3a, in `apps/web` and `packages/ui`). `ajv` only in `apps/backend`. The domain package's 100% coverage gate applies to both new files and the changed definition.
- **Async process loaders.** Not applicable: no user-facing loader in this story (Story 10.4 and 10.3a own the UI).
- **i18n and analytics.** None in this story. The English and Indonesian copy and the PostHog events `subscription_cap_upgrade_cta_shown { accountId, currentSubscriptionCount }` and `subscription_cap_upgrade_cta_clicked` belong to Story 10.3a.
- **Cloud services.** None added, so `SETUP_WALKTHROUGH.md` needs no change. CLAUDE.md §4 applies to the diagram docs (Task 9).
- **Migration rule.** Drizzle-kit-generated SQL checked into the repository (project-context): the generated migration for the columns; one custom migration for the two partial indexes (the drizzle-kit WHERE-clause workaround). Never hand-number or hand-set a journal `when`; re-check the latest migration number right before generating.
- **Tests (project-context).** Backend integration tests on real Postgres (`node:test`), the row-count ratchet must stay flat (delete the users, jobs and subscriptions created; `jobs` and `subscriptions` cascade from `users`), the domain package keeps 100%.

### Data Type Compatibility & Migration Requirements

- **Database.** `jobs.leader_job_id uuid` (nullable, self-referencing, `ON DELETE SET NULL`) and `jobs.queued_since timestamptz` (nullable). Three partial indexes: reuse uniqueness `(owner_user_id, type, input_key)` over non-terminal, non-follower, owned rows; queue order `(owner_user_id, queued_since, id)` over unadmitted `QUEUED` rows; plus a plain `idx_jobs_leader`. Existing rows need no backfill: they are admitted (`admitted_at` set, `queued_since` null) and have no leader. No enum changes (`job_status` already has every status).
- **Reason codes** are text and need no migration: `WAITED_TOO_LONG` is already a PRD reason code; `CANCELLED` too. Add `JOB_QUEUE_FULL` and `SUBSCRIPTION_CAP_REACHED` only as typed start refusals, not as stored reasons.
- **TypeScript.** `StartJobResult` widens (see Task 4); `JobTypeDefinition` gains two optional booleans; new `SubscriptionCapReachedError`. A GraphQL error code `SUBSCRIPTION_CAP_REACHED` with `extensions { activeCount, reservedCount, cap }`; no `.graphql` schema change is needed, so no codegen run unless an enum is added.
- **Backward compatibility and rollout.** Behaviour changes for existing code: (a) the cap now exists, so a user already above 5 can add no more (they keep what they have); (b) `startJob` returns a richer result. No job type is registered yet, so nothing in production starts a job through the new path until Stories 10.6 and 10.7; the cap applies at once to `subscribeToAccount`, which is live. **Check how many production users hold more than the cap before deploying** (the author had no production access): the change cannot remove anything, but it will start refusing those users.
- **Verification.** Migration applies on a seeded database; the concurrency suites; the cap tests including RESTORE and a user above the cap; the row-count ratchet; lint, build and the infrastructure tests.

### Architecture & UX Gate Findings

- **Gate 1 and Gate 3 cited from the epic-wide sweep** (`_bmad-output/planning-artifacts/epic-readiness/epic-10-readiness.md`, `swept: true`, with its 2026-11-02 and 2026-11-11 addenda): admission is database work inside the existing Lambdas, no new service, queue or secret; Story 10.3 was validated buildable as one story. **Lightweight guard performed for this story**: the sweep did not anticipate four things, recorded here and in AD-53 instead of silently trusting it: (1) the subscription cap does not exist in the code, so this story builds it; (2) a place is held from admission, not from the worker's claim; (3) the claim must stop taking `WAITING` rows or admission is bypassed; (4) leader and follower needs a new self-referencing column. None needs a new prerequisite story.
- **Gate 2 (UI complexity and reusability), run for this story:** no gap, because the story is backend only. The one UI part of the original scope, the cap refusal screen with the upgrade call to action, the two PostHog events and the English and Indonesian copy, **was split out at the product owner's decision into a new Story 10.3a** (needs `bmad-ux`; depends on this story). It is added to `epics.md` and `sprint-status.yaml` (`backlog`).
- **Prerequisite:** PR #219 (Story 10.1a review follow-ups) must be merged first. It is not a new story.

### Project Structure Notes

- **New:** `packages/domain/src/jobs/admission.ts` (+ test); `packages/domain/src/subscriptions/subscription-cap.ts` (+ test); `apps/backend/src/lib/job-engine/{admit-job,promote-queued-jobs,readmit-waiting-job,cancel-job,settle-followers}.ts` (+ tests); `apps/backend/src/lib/subscriptions/subscription-cap.ts` (+ test); two migrations under `packages/database/migrations/` (generated, then custom).
- **Modified:** `packages/domain/src/jobs/job-engine.ts` (two optional flags) and the jobs and subscriptions barrels and `package.json` exports if needed; `packages/database/schema.ts` (`jobs` columns and indexes); `apps/backend/src/env.ts` and `.env.example`; `apps/backend/src/lib/job-engine/{start-job,run-job,run-job-engine-sweep,sweep-expired-jobs}.ts`; `apps/backend/src/lib/subscriptions/subscribe-to-account.ts`; `apps/backend/src/schema/resolvers.ts` (cap mapping, RESTORE check); `apps/infrastructure/lib/festgrid-backend-stack.ts` (+ test); the spine (AD-53), `architecture-diagram.md`, `high-level-overview.md`.
- **Not modified:** any `.graphql` schema (the refusal travels in `extensions`), `apps/web`, `packages/ui`, `SCRAPE_IN_PROGRESS` call sites, `manual_extraction_jobs`, any real vendor adapter, `start-post-reextraction-preview.ts` (the cooldown is done).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Epic 10`, Story 10.3 and 10.3a] and `epic-readiness/epic-10-readiness.md` (swept, addenda).
- [Source: PRD `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md`: 3.18 FR120, FR121, FR122, FR130; Section 6 Subscription Cap, Reserved Slots, Moderator Exemption, Upgrade CTA; 3.7 Subscribe Runs as a Job.]
- [Source: Architecture Spine AD-53 (the engine), AD-41 (subscribe), AD-32 (no session advisory locks under the pooler), AD-34.]
- [Source: `_bmad-output/planning-artifacts/background-vendor-jobs-design-notes-2026-11-02.md` decisions 9, 13, 14, 17, 18 and the new decisions 19 to 21.]
- [Source: `_bmad-output/implementation-artifacts/10-1a-build-the-job-engine-core-record-lifecycle-runner-and-sweep.md` (Review Follow-ups, findings 2 and 9b) and PR #219.]
- [Source: `_bmad-output/implementation-artifacts/backlog/IDEA-008-subscribed-account-cap.md`; `backlog.yaml` row IDEA-008.]
- [Source: code read while creating this story: `apps/backend/src/lib/job-engine/*`, `lib/subscriptions/subscribe-to-account.ts`, `schema/resolvers.ts` (`subscribeToAccount`, `removeSubscription`), `schema/subscriptions.graphql`, `packages/database/schema.ts` (`jobs`, `subscriptions`), `lib/extraction/start-post-reextraction-preview.test.ts`.]

## Global Rules References

- `_bmad-output/project-context.md` (database access through Drizzle only, drizzle-kit migrations, `packages/domain` purity and 100% coverage, backend integration tests on real Postgres, row-count ratchet, strict settings parsing).
- `_bmad-output/planning-artifacts/story-content-structure.md` (this file's section order and status vocabulary).
- Architecture spine: AD-53 (job engine), AD-41, AD-32, AD-34; PRD 3.18 and Section 6.
- Infrastructure docs: `docs/infrastructure/index.md`, `architecture-diagram.md`, `high-level-overview.md` (CLAUDE.md §4).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New (domain): `packages/domain/src/jobs/admission.ts`, `packages/domain/src/subscriptions/subscription-cap.ts` and their tests.
  - New (backend): `lib/job-engine/{admit-job,promote-queued-jobs,readmit-waiting-job,cancel-job,settle-followers}.ts`, `lib/subscriptions/subscription-cap.ts` and their tests; two migrations (`packages/database/migrations/00NN_*.sql`, next free number).
  - Modified: `packages/domain/src/jobs/job-engine.ts`; `packages/database/schema.ts`; `apps/backend/src/env.ts`, `.env.example`; `lib/job-engine/{start-job,run-job,run-job-engine-sweep,sweep-expired-jobs}.ts` (+ tests); `lib/subscriptions/subscribe-to-account.ts` (+ tests); `schema/resolvers.ts`; `apps/infrastructure/lib/festgrid-backend-stack.ts` (+ test); spine AD-53; both infrastructure docs.
  - Not modified: `.graphql` schema files, `apps/web`, `packages/ui`, `SCRAPE_IN_PROGRESS` call sites, vendor adapters.
- **Rule Mapping:**
  - Database access through Drizzle, drizzle-kit migrations (custom SQL only for the partial indexes, the documented workaround) → `project-context.md` → Task 2.
  - Pure logic in `packages/domain`, 100% covered, no ORM import → `project-context.md` → Task 1.
  - Row lock rather than advisory lock under the transaction pooler → AD-32 → Task 4.
  - Three-queue architecture untouched (admission uses the existing async invoke seam) → AD-53 → Tasks 4 and 5.
  - Settings parsed strictly, never silently defaulted on a typo → `env.ts` precedent → Task 3.
  - CLAUDE.md §4 (diagram upkeep) → Task 9.
  - Story-split-gate: Gate 1 and 3 cited from the swept readiness report with a lightweight guard; Gate 2 run, the UI part split out as Story 10.3a → Dev Notes.
- **Verification Plan:**
  - `pnpm --filter @festgrid/database run generate` then `run migrate` apply cleanly on a seeded database; the migration journal ratchet passes.
  - `pnpm --filter @festgrid/domain test`: 100% coverage including the two new files.
  - `pnpm --filter backend exec tsx --test` over the new and changed job-engine, subscription and resolver suites, then the full backend suite through `scripts/run-tests-with-row-count-ratchet.ts` on a migrated, seeded database (with `GEOAPIFY_API_KEY=test-geoapify-key`).
  - `pnpm --filter infrastructure test` (the stack test gains the four settings).
  - `pnpm build` and `pnpm lint` clean at the repository root.
  - Manual: `git diff --stat` against `baseline_commit` shows no `.graphql`, `apps/web` or `packages/ui` file.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: admission, queue, promotion, re-admission, cancel, same-user reuse, opt-in cross-user sharing, the subscription cap with reservation (enforced in `subscribeToAccount` and RESTORE) and the typed refusal. No UI, no real job type, no GraphQL schema change. Pending approval.
- [ ] Architecture and boundary confirmation: pure rules in `packages/domain`; database and Lambda wiring in `apps/backend`; admission serialized by a row lock on `users`; no new service, queue or secret. Pending approval.
- [ ] Testing plan confirmation: domain 100% coverage; real-Postgres concurrency suites for AC 10 (a) to (f); cap, RESTORE and above-the-cap tests; the row-count ratchet; infra stack test. Pending approval.
- [ ] Explicit human approval state: **pending approval.**
- [ ] Gate 1/2/3 prerequisites confirmed: Gate 1 and 3 cited from the swept `epic-10-readiness.md` plus the lightweight guard above; Gate 2 run (no gap, UI split to Story 10.3a). PR #219 must be merged first. Pending user acknowledgement.
- [ ] Production check acknowledged: how many production users already hold more than 5 subscriptions is unknown here; they keep them but cannot add more. Pending user acknowledgement.

## Testing Requirements

- [ ] Unit tests (required, `packages/domain`, 100% coverage per the enforced `c8` gate): `admission.test.ts`, `subscription-cap.test.ts`, the extended `job-engine.test.ts`.
- [ ] Integration tests (required, real local Postgres, no mocks): `admit-job`, `promote-queued-jobs`, `readmit-waiting-job`, `cancel-job`, `settle-followers`, the extended `run-job` and sweep tests, `admission.concurrency`, the `subscribe-to-account` cap and RESTORE tests, the resolver mapping of `SUBSCRIPTION_CAP_REACHED`.
- [ ] Infrastructure tests: the stack test asserts the four settings on the API, scraper and AI-processor Lambdas.
- [ ] E2E tests: not applicable (no UI; the refusal screen is Story 10.3a).

## Deliverables Checklist

- [ ] `jobs.leader_job_id`, `jobs.queued_since`, the three indexes and the two migrations, applied locally.
- [ ] `admission.ts` and `subscription-cap.ts` in `packages/domain`, exported, 100% covered.
- [ ] `admit-job`, `promote-queued-jobs`, `readmit-waiting-job`, `cancel-job`, `settle-followers` and the changed `start-job`, `run-job` and sweep.
- [ ] The four settings in `env.ts`, `.env.example` and the CDK stack.
- [ ] The cap enforced in `subscribeToAccount` and `removeSubscription` RESTORE; typed `SUBSCRIPTION_CAP_REACHED` error.
- [ ] AD-53, `architecture-diagram.md` and `high-level-overview.md` updated.
- [ ] All new tests passing; `pnpm build` and `pnpm lint` clean.

## Out of Scope

- The cap refusal screen, the upgrade call to action, the PostHog events and the English and Indonesian copy: Story 10.3a.
- Registering any real job type, and flipping `sharedAcrossUsers` or `reservesSubscriptionSlot` on one: Stories 10.6, 10.7 and later adoption stories.
- Replacing `SCRAPE_IN_PROGRESS` at its call sites: Stories 10.6 and 10.10.
- Calling `cancelJob` when a user removes an account that is still being added: Story 10.7.
- The queue position shown on the Jobs page and the GraphQL `job` surface: Story 10.4 (this story only provides `queuePosition`).
- Late vendor results, the snapshot wait and the calls to `readmitWaitingJob` from their events: Stories 10.5 and 10.12a.
- A user-tier model (`free_user` versus `contributing_user`) and any tier-based exemption.
- The 10-minute rescrape cooldown (done in PR #184).
- `JOBS_HISTORY_RETENTION_DAYS` and deletion of old jobs: Story 10.4.

## Definition of Done

- [ ] AC 1-11 satisfied.
- [ ] All new unit, integration and infra tests passing (Testing Requirements), including the concurrency suites.
- [ ] `pnpm lint` and `pnpm build` passing for `packages/domain`, `packages/database`, `apps/backend`, `apps/infrastructure`.
- [ ] Migrations generated with correct, non-colliding numbers (re-verified against `origin/master` immediately before generation) and applied locally.
- [ ] `docs/infrastructure/architecture-diagram.md`, `high-level-overview.md` and AD-53 updated in the same change.
- [ ] Pre-Coding Approval Gate explicitly approved by the user before implementation begins, and PR #219 merged.

## Completion Status

- [ ] Not started
- Creation note (2026-11-11): created with three product decisions (UI split into Story 10.3a; cap for every non-moderator; cross-user sharing opt-in per type) and the two code-review findings handed over from Story 10.1a (the resume driver and the single admission function). Depends on PR #219.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
