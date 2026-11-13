---
baseline_commit: 49907817eac1f0afd5bda419bc564ac440d25b69
---

# Story 10.4: Build the Jobs page and the inline job progress component

## Story Details

- Epic: 10 (Background vendor jobs: one engine, one Jobs page)
- Story ID: 10.4
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user or moderator,
I want to see my running and finished jobs in one place and to watch a job where I started it,
so that long work never freezes the screen and I can leave and come back.

## Acceptance Criteria

Sources: Story 10.4 in `epics.md` (Epic 10), PRD 3.18 (FR116 to FR130) and 4.21, and the owner-confirmed UX spec of 2026-11-13 (`ux-designs/ux-festgrid-2026-11-13/`: `EXPERIENCE.md`, `DESIGN.md`, `copy-keys.md`, `graphql-read-shape.md`, `decisions.md`; all 12 design choices confirmed by the product owner on 2026-11-13). Where the spec and this list differ, the spec wins for behaviour and this list wins for what is built.

**Backend read API (Part A)**

1. **Given** a signed-in user, **when** a client calls `job(id)`, `myJobs(filter, onlyEnded, first, after)` or `activeJobs(filter, subject, endedWithinMinutes)`, **then** the answer follows `graphql-read-shape.md` (the `Job` type and its enums; `JobProvider` spelled `BRIGHT_DATA` at this boundary, mapped from the table's `BRIGHTDATA`). Each new root field calls `requireAuth(context)` as its first statement (AD-7, Authenticated Context and Authorization; the `auth-surface` ratchet), takes no `userId` argument and is not added to `PUBLIC_ROOT_FIELDS`.
2. **And** an ordinary user sees only their own USER jobs (FR130). `job(id)` for another user's job, a system job or a job past retention answers `null`, exactly as for a missing id. `scope: ALL_USERS` and `includeSystem: true` need a moderator and answer `FORBIDDEN` otherwise (checked after the top-level `requireAuth`). A moderator sees any job by id. Defaults: `scope: MINE`, `includeSystem: false`. `includeSystem` adds SYSTEM-trigger rows to either scope (Dev Notes decision 8).
3. **And** `myJobs` is newest first and cursor-paginated: `ORDER BY created_at DESC, id DESC` (the unique key last), the cursor encoded as the position after its row (`encodeActorRunCursor(offset + idx + 1)`), default page 20, maximum 50, a bad cursor is `BAD_REQUEST` (project-context, AD-18 rule 4). `onlyEnded: true` keeps only the four endings. `totalCount` is counted only when the client selects it (`getRequestedFieldNames`). `activeJobs` returns QUEUED, RUNNING and WAITING jobs, newest first, not paged, bounded by a safety limit of 50; with `subject` only that subject's jobs; `endedWithinMinutes` (clamped to 0..60, default 0) also returns jobs that ended inside that window.
4. **And** finished jobs are listed for `JOBS_HISTORY_RETENTION_DAYS` (default 30, FR123): a terminal job whose `finished_at` is older is hidden from all three reads. Owner override of 2026-11-13 (Dev Notes decision 7): this is hide-only. Nothing is deleted: no step is added to the engine's 5-minute sweep and no other delete is written; a physical delete is a follow-up for the owner.
5. **And** the response never carries a caption, a signed or any post image URL, a vendor token, the job's `input` or the preview in `result_data`: the resolver selects `jobs.input` and `jobs.result_data` only through named JSON paths (`input->>'postId'`, `input->>'url'`, `input->>'accountId'`, `result_data #>> '{refresh,outcome}'`, `result_data #>> '{refresh,retryAfter}'`, the applied marker), never whole (the re-extract holds a fetched caption in `input.held`, AD-40 Rule 9, and its `result_data` holds the preview). A post is identified by its public short code only. `subject.username`/`platform` let the client build the account link with `buildAccountHref`; the numeric `account_id` never goes in a URL (AD-35, Account URLs Resolve by Username, Never by account_id).
6. **And** vendor names, per-attempt history, the engine's raw reason code and the engine's plain message are returned only to a moderator, in `moderatorDetails`; for an ordinary user `moderatorDetails` and `owner` are `null` and no query or fragment reaches `job_attempts`. `owner` is `{ displayName }` (the user's `name`), never an email or id. Reason codes are mapped to the user-safe `JobReasonCode` enum: the engine-internal endings (`HANDLER_ERROR`, `HANDLER_NOT_REGISTERED`, `HANDOFF_MISSING`, `START_FAILED`, `UNSPECIFIED`) and any unknown code read as `GENERIC`.
7. **And** the pure rules live in `packages/domain/src/jobs/` with 100% coverage: the type presentation registry (GraphQL type, ordered phases, subject kind; unknown engine type reads as `OTHER`), `deriveJobSteps` (server-built `steps[]`, a skipped step is `SKIPPED`), `mapJobReasonCode`, `decideJobRetry` (the table in `EXPERIENCE.md`, "Which reasons offer Retry"), `deriveJobWaiting`. Queue position reuses `queuePosition` (`admission.ts`); queued info shows `position`, `maxConcurrent` and `expiresAt`.
8. **And** `retryJob(jobId)` (owner only, `requireAuth` first) starts a NEW job for the same input through that type's own start path, with reuse, admission, cooldown and slot rules unchanged, and answers `RetryJobResult { outcome STARTED | REUSED | REFUSED, job, errorCode, activeCount, reservedCount, cap, maxQueued, retryNotBefore }`. `canRetry` is true only for the owner, on an ended job, with a retryable reason (`decideJobRetry`) and a registered retry starter for the type; a type with none is not retryable (decision 6).

**Shared inline progress component (Part B)**

9. **Given** a job fetched by id, **when** the shared component renders it, **then** it shows, as a dialog, a page panel or a chip, every state of the table in `EXPERIENCE.md` ("The states of one job"): loading skeleton, queued (position, reason, the limit and the 30-minute drop warning), running (stepper, "Step 2 of 3", counts, "Leaving this page does not stop it"), waiting (what for and until when, "You can start other jobs meanwhile"), succeeded, succeeded with limits (reason and the late-result note), failed, expired, cancelled, load error, not found. Reason text is resolved from the reason code, never from the engine message; a moderator sees the engine message only inside "Technical details (moderators)".
10. **And** the component can be minimized to a chip at the place the action started and re-opened at the job's last progress (current step and steps done), on that page or from the Jobs page, also after navigating away, reloading or opening another device, because the state comes from the server (`activeJobs(subject, endedWithinMinutes)` on mount) and never from `localStorage`, `sessionStorage` or any browser store; only "is the dialog open" is view state. The dialog opens by itself only as the direct result of the user's own start in that tab; any other discovery shows the chip. Minimize, Escape and an outside tap do the same while the job is open; nothing in the component stops a job (FR123, added 2026-11-11). Starting the same action again re-attaches (`REUSED`) and is announced.
11. **And** polling follows the spec: 2 s while a dialog is open, 5 s for a chip, 10 s for a list holding an open job, none when every job has ended, paused while the tab is hidden with one immediate fetch on return, doubling after an error up to 30 s, a small "Reconnecting" line (polite, once) while offline. One shared hook per read (`useJob`, `useActiveJobs`, `useMyJobs`) in `apps/web`; no per-job-type polling loop.
12. **And** one `JobAnnouncer` per page (a visually hidden `role="status"` polite, atomic region) receives a message only when a job's status or step changes, never on an unchanged poll, coalesces messages within 3 s ("3 jobs updated"), does not announce a queue-position change, never announces from a hidden tab, and a failure in a dialog the user is watching uses `role="alert"`. Chip, row and badge carry text as well as icon and colour; the stepper has `aria-current="step"` and a hidden state word per item; the spinner is a static dot under `prefers-reduced-motion`.
13. **And** Retry shows only when `canRetry`; during a cooldown it reads "Retry at {time}", is `aria-disabled` with that text as its description and enables itself at that time (a timer, no poll). Outcomes: started (move to the new job, "Started again."), reused ("This is already running."), subscription cap refused (renders the cap notice slot; the notice itself is Story 10.3a's), queue full (`startQueueFull` copy with a link to Jobs), any other refusal the generic message. One helper in `apps/web/src/features/jobs/` maps a start error to one of these so no start point re-invents it.

**Jobs page, detail, menu, copy, analytics (Part C)**

14. **Given** the Jobs page `/jobs`, **when** it loads, **then** it uses `PageContainer` and `PageHeader` and shows two sections: "In progress" (from `activeJobs`, not paged) above "Finished" (from `myJobs` with `onlyEnded`, paged). The "Finished" list owns its pagination only through `useListPaginationController` with `filterKey { scope, includeSystem }`, `useReportConnectionPageMeta`, `PaginationControls` and `usePaginationLabels` (Previous/Next, not infinite scroll: owner-confirmed choice 1; project-context, AD-18 rule 4); a clear-filters control also calls `pagination.resetToFirstPage()`; a filter handler never calls `refetch()`; an empty later page shows `EmptyPageNotice`; a failing later page shows its error, not the notice. No `useState` cursor, `hasNextPage` or page number state (the `ad18-list-pagination` ratchet).
15. **And** each row is a link to `/jobs/{id}` with the status badge (`JobStatusBadge` mapped onto the existing `StatusBadge` variants, no new colour tokens), the type label, the subject (an account row is a `SubscribedAccountCard` with `variant="list"`, `size="sm"`, `showPlatformBadge`, no subscribe toggle in the DOM; plain text for "12 posts" or "Post {code}"), "Started {time}", "Running for / Took {duration}", "Number 2 in line", "Next try {time}"; a moderator also sees "Started by {name}" or "System job". Only a moderator sees the filter row (`RadioGroup` My jobs / All users and a `Checkbox` Include system jobs), applied immediately (AD-18, Filter Apply-Timing Convention). Empty, filtered-empty, loading (skeleton rows the same height as real ones) and error states per the spec.
16. **And** `/jobs/{id}` is its own route (a push or a list row can link to one job): back link to Jobs, the same component in its panel form, timing, the late-result note when `completedAfterDeadline`, and for a moderator a collapsed "Technical details (moderators)" block (a `Table` inside an `overflow-x-auto` box from `md:` up, a stacked definition list below; provider, result, time given, time used, reason, engine reason code, engine message, job id, who started it). A missing, retained-out or someone else's job reads "This job was not found." with a link to Jobs.
17. **And** the profile menu has a "Jobs" entry (`id: 'jobs'`, `labelKey: 'jobs'`, href `/jobs`, a `ListChecks` icon) after "Account Settings" in `profile-menu-entries.ts`; the five-item main navigation is unchanged; the finished-since-last-visit badge is Story 10.13's. Both routes set title and description through `generateMetadata` and the `Metadata` namespace (`jobsTitle`, `jobsDescription`, `jobDetailTitle`, `jobDetailDescription`), and the page's Suspense fallback is `<RouteLoader />`.
18. **And** all copy exists in English and Indonesian: the `Jobs` namespace, `UserMenu.jobs` and the four `Metadata` keys are merged from `copy-keys.md` as written; the `lookup.*` keys marked `[OPEN D1]`, `[OPEN D3]`, `[OPEN D4]` are NOT merged into the locale files and nothing renders them (decisions D1, D3, D4 of OI-2 are still open with the owner). Dates and times are formatted for the active locale, durations with `Intl.NumberFormat` units, lists with `Intl.ListFormat`; no raw enum, ISO string or number is interpolated (project-context, Locale-Sensitive Data Rendering).
19. **And** the four analytics events go through `capturePostHogEvent` from `@festgrid/analytics`, snake_case names, camelCase properties, never a handle, URL, caption or vendor name: `job_progress_minimized {jobType, status}`, `job_progress_reopened {jobType, status, source: chip|jobs_page}`, `job_retry_clicked {jobType, reasonCode}`, `jobs_filter_changed {scope, includeSystem}`.
20. **And** no page is wider than its viewport at 320 to 1440 px and the dialog fits and scrolls inside itself on a short phone (project-context, Responsive Containment): `/en/jobs` and a seeded `/en/jobs/{id}` join the signed-in and moderator routes of `responsive-overflow.spec.ts`, a progress-dialog scenario joins `responsive-popups.spec.ts`, and a Jobs happy-path spec runs with `E2E_FAKE_AUTH=1`.
21. **And** the PRD and the board are brought in line (Part D): FR123's "infinite scroll" becomes the Previous/Next paging the owner confirmed, in PRD 3.18, in the matching list-convention line of PRD 3.12 and in the FR123 line of `epics.md`; `project-context.md` gets a one-line pointer on its List Navigation rule.

## Tasks / Subtasks

Grouped so a builder can do them in order. Parts A, B and C are the three stories of the split proposed at the top of Dev Notes (10.4a, 10.4b, 10.4c); do them as one story only if the owner declines the split.

- [x] **Part A (proposed 10.4a): backend read API** (AC: 1 to 8)
  - [x] **A1. Pure rules in `packages/domain/src/jobs/` (+ tests, 100% coverage):** `job-presentation.ts` (registry `registerJobTypePresentation`/`getJobTypePresentation`: GraphQL type, ordered phase list, subject kind and its input keys; `reextract-post` registered idempotently at import with phases `refresh`, `preview` and "refresh SKIPPED when its report outcome is `NOT_NEEDED`"; unknown type reads `OTHER`), `deriveJobSteps`, `mapJobReasonCode` (user-safe enum, internal and unknown to `GENERIC`), `decideJobRetry` (the retry table), `deriveJobWaiting`, `userSafeJobProvider`. Export from the `jobs` barrel (`public-api.test.ts` loads every barrel).
  - [x] **A2. GraphQL schema** `apps/backend/src/schema/jobs.graphql`: the types of `graphql-read-shape.md` (plus `JobType.OTHER`, decision 2), `Query.job/myJobs/activeJobs`, `Mutation.retryJob`; `PageInfo` is the existing type. Resolvers inline in `schema/resolvers.ts` (the auth ratchet reads that file), each with `requireAuth(context)` first.
  - [x] **A3. Read layer** `apps/backend/src/lib/job-engine/read-jobs.ts` (+ `job-read-mappers.ts`): scope and moderator filters, `activeOnly(users)`/`activeOnly(posts)`/`activeOnly(socialMediaAccountProfiles)` on every joined soft-deletable table, `getRequestedFieldNames` to skip `job_attempts`, owner, queue and count work that is not requested, batched subject and queue lookups per page (no per-row query), retention predicate, the whitelisted JSON-path projection (AC 5), `encodeActorRunCursor`/`decodeActorRunCursor` reuse. Use `buildOptimizedDrizzleSelect` for the plain columns the client asked for plus the dependency columns the derived fields need (`phase`, `reason_code`, `status`, `admitted_at`, `queued_since`, `resume_at`, `leader_job_id`, `owner_user_id` internal only); `input`, `result_data` and `error_message` are never taken through it.
  - [x] **A4. Retry** `lib/job-engine/retry-job.ts` and `job-retry-registry.ts` (API Lambda side, imports no handler): `registerJobRetryStarter(type, fn)`; `reextract-post` registers one that calls `startReextractPostJob` with the stored post id or URL taken from the old job's input WITHOUT `held` (`withoutHeldPost`) and keeps the moderator-only rule; result mapping to `RetryJobResult`; a second tap while a new job is open is `REUSED`.
  - [x] **A5. Retention:** `JOBS_HISTORY_RETENTION_DAYS` in `apps/backend/src/env.ts` (default 30, `parsePositiveInt`), `.env.example`, `env.test.ts`, the CDK environment of the API Lambda (the only Lambda that reads jobs for a client) and `festgrid-backend-stack.test.ts`. Hide-only (owner override 2026-11-13): NO sweep step and NO delete; the read layer hides terminal jobs whose `finished_at` is older. A physical delete is a follow-up for the owner. AD-53 gets the one sentence in Part D.
  - [x] **A6. Tests, real local Postgres** (reuse `lib/job-engine/job-engine-test-support.ts`; create real `users` rows for owners; every test deletes every row it creates, jobs first then users; the backend row-count ratchet must stay clean): see Testing Requirements.
- [ ] **Part B (proposed 10.4b): shared progress component and hooks** (AC: 9 to 13, 19)
  - [ ] **B1. `packages/ui/src/features/jobs/`** (props and a `labels` object, no `next-intl` import): `JobStepper`, `JobStatusBadge`, `JobProgressView` (dialog and panel forms over one pure presentation, with slots for an outcome action and for the cap notice), `JobChip`, `JobAnnouncer` (+ `useJobAnnouncements`), `formatJobDuration`, skeleton in sync with the real heights; exported from the package barrel; tests per state.
  - [ ] **B2. `apps/web/src/features/jobs/`:** `useJob`, `useActiveJobs`, `useMyJobs` (React Query + the generated hooks, one poll scheduler with the interval, hidden-tab and back-off rules), `JobProgressHost` (resolves labels with `useTranslations`, owns "is the dialog open", attaches by job id or by subject, focus return), the start-error helper, the analytics calls, `.graphql` documents under `apps/web/src/` and `pnpm --filter web codegen` (commit `generated/graphql.ts` as the repo does).
  - [ ] **B3. Locale files:** merge `Jobs` (without `lookup.*`) into `apps/web/locales/en.json` and `id.json`; `locales.test.ts` parity.
- [ ] **Part C (proposed 10.4c): the Jobs page, the detail, the menu, e2e** (AC: 14 to 18, 20)
  - [ ] **C1. Routes:** `apps/web/src/app/[locale]/jobs/page.tsx` + `jobs-content.tsx` and `jobs/[jobId]/page.tsx` + `job-detail-content.tsx` (Server `page.tsx` with `generateMetadata`, `Suspense` with `<RouteLoader />`), `JobRow`, the moderator filter row, the technical-details block, `EmptyPageNotice` use.
  - [ ] **C2. Menu and metadata:** `profile-menu-entries.ts` entry, `UserMenu.jobs`, the four `Metadata` keys, both languages.
  - [ ] **C3. e2e:** seed job rows in `packages/database/seed.ts` (idempotent, test-only, no caption, no vendor URL); add the routes and the dialog scenario to the two responsive specs; `apps/web/e2e/jobs.spec.ts` (ordinary user: list, open a job, chip re-open after reload, Retry; moderator: filters and technical details).
- [ ] **Part D: documentation** (AC: 21)
  - [ ] **D1.** PRD 3.18 FR123 sentence: replace "with infinite scroll (Section 3.12)" with "paged with Previous and Next controls (the shared list-pagination rule, AD-18)"; the matching line of PRD 3.12 ("Infinite Scroll (Autoscroll)", and the "Fetching subsequent data (e.g., infinite scroll)" loader line stays: it describes lists that do scroll) gets one added sentence that history lists such as the Jobs page page with Previous/Next; the FR123 line in `epics.md` (requirements inventory) likewise.
  - [ ] **D2.** `project-context.md`: append one pointer sentence to the "List Navigation" rule: lists that page through a cursor with `useListPaginationController` (the moderator lists and the Jobs page, Story 10.4, owner-confirmed 2026-11-13) are the stated exception. No other rule changes.
  - [ ] **D3.** AD-53 (The Job Engine): one rule line for the read API (the whitelist, retry-starter registry, retention); PRD 4.21 `JobReasonCode`/`Job` need no change (the GraphQL shape is a projection). `docs/infrastructure/architecture-diagram.md` and `high-level-overview.md`: NOT touched (no service, queue, Lambda, table or library is added; one environment variable only).

## Dev Notes

### SPLIT RECOMMENDATION (read first): split into 10.4a, 10.4b and 10.4c

**Recommendation: yes, split.** One story file is written as asked, with tasks grouped Part A, B, C in build order, but this is too big for one builder session and Gate 2 triggers on its own:

- **10.4a, backend read API (Part A):** `job`, `myJobs`, `activeJobs`, `retryJob`, the pure domain rules, retention. Real-Postgres tested, no UI. Independent and mergeable alone.
- **10.4b, shared inline progress component (Part B):** `packages/ui` presentation (`JobProgressView`, `JobChip`, `JobStepper`, `JobAnnouncer`) plus the `apps/web` hooks and host. This is the part **Story 10.6a (Re-extract progress, missing-images banner and Retry)** and every adoption story (10.7, 10.9 to 10.12a) need; it must not wait for the Jobs page. Depends on 10.4a.
- **10.4c, the Jobs page, detail, menu entry, e2e (Part C, with Part D docs):** depends on 10.4a and 10.4b.

Why: three layers (resolvers and engine reads, a reusable `packages/ui` component with a dozen states and strict a11y, a paged page with e2e) plus an engine retention gap in one change; Gate 2 (`story-split-gate.md`) says a reusable complex component or hook with states and a11y becomes its own story. The tasks above are already in that order. **Not done here (owner to decide):** no `10-4a`, `10-4b`, `10-4c` keys were added to `epics.md` or `sprint-status.yaml`, because the instruction was one story file; if the owner accepts, add those three sections and keys (lettered suffixes off 10.4, per the Numbering Rule of the gate) and cut this file along the Part headings. Until then `10-4-...` stays the one story key.

### Owner-flagged decisions (conservative option chosen; please confirm or overrule)

1. **Split into three stories** (above), recorded in one file, no new backlog keys.
2. **`JobType.OTHER`.** Only one engine type exists today (`reextract-post`); the PRD's other types arrive with 10.7 and 10.9 to 10.12a. The GraphQL `JobType` enum adds `OTHER` (not in `graphql-read-shape.md`) so a job of a type this story does not know never breaks the page: it reads as `OTHER` with a generic label and one generic step. The domain presentation registry maps each engine type string to its GraphQL type, ordered phases and subject kind; each adoption story registers its own entry.
3. **The registry is the only per-type knowledge.** Steps are derived on the server from the registry's phase list and the job's `phase` (`graphql-read-shape.md`, note 1); the client holds no per-type logic except labels. `reextract-post` gets `refresh` then `preview`, with `refresh` shown `SKIPPED` when the stored report says `NOT_NEEDED`.
4. **A job that ended unhappily keeps its stopped step as `CURRENT`** (the enum has no failed-step state); the client renders a stopped marker from the job's status. A SUCCEEDED job shows every step `DONE` (except skipped).
5. **`Job.refresh` and `images[]` are not exposed here.** They are 10.6a's banner data; `result_data` is read only through the named paths in AC 5 (outcome and retry-after for the reason text, the applied marker). 10.6a adds `refresh` as a new field on the same `Job` type.
6. **`retryJob` through a per-type retry-starter registry** (API Lambda side). Each adoption story registers its own starter, so Retry reuses that type's own start path (reuse, gates, cooldown, cap) and never re-derives it; `reextract-post` registers the first one. A type with no starter is `canRetry: false`, so the button never shows for a type whose start path is unknown. Retry is owner only; a moderator viewing another user's job gets no button. Retry never copies `input.held`.
7. **Retention.** `JOBS_HISTORY_RETENTION_DAYS` is in PRD FR123 and `copy-keys` but **was never built** (grep finds it nowhere in `apps/` or `packages/`). OWNER OVERRIDE (2026-11-13): hide-only. The read side hides terminal jobs older than the setting; the engine's 5-minute sweep is NOT changed and nothing is deleted, so rows live on, hidden. A physical delete is a follow-up for the owner (the original plan was one sweep step with its own try/catch, cascading `job_attempts` and `job_vendor_snapshots`, and a follower's `leader_job_id` set null by the existing foreign key). Retention is measured from `finished_at`.
8. **Moderator scopes.** `ALL_USERS` lists every user's USER jobs; `MINE` lists the moderator's own; `includeSystem` adds SYSTEM-trigger rows to whichever scope; an ordinary user passing either is `FORBIDDEN`. A SYSTEM job has no owner, so "Started by" reads "System job". No system job type exists yet (FR130), so the filter shows nothing until one does.
9. **Owner label is `users.name` only** (decisions.md open row 6, a privacy call): no email, no id; a soft-deleted user reads as no label (the join uses `activeOnly(users)`).
10. **Polling numbers are the spec's** (2 s, 5 s, 10 s, hidden-tab pause, back-off to 30 s). One shared scheduler, not per component.
11. **`totalCount` is computed only when requested; the web page does not request it** (the controller treats it as optional), so the list costs one query.
12. **No new index and no migration.** `idx_jobs_owner_created_at` serves the user's list; the moderator `ALL_USERS` list scans a table that retention keeps small. Revisit if it grows.
13. **Subject matching for `activeJobs(subject)`** reads `input->>'postId'`, `input_key` (for `postUrlKey`) and `input->>'accountId'`; subject loaders for ACCOUNT and POSTS read `input` keys `accountId` and `postIds` as a convention the registry documents (no adopter exists yet, so tests register a test-only type). Adoption stories must write those keys or register their own subject reader.
14. **`lookup.*` placeholder copy (OPEN D1, D3, D4) is not put in the locale files at all**, not even unrendered. The owner's OI-2 decisions stay open; the slots (SLOT-D1, SLOT-D3, SLOT-D4 in `EXPERIENCE.md`) are not built or decided here. When the owner decides, the copy is added then.
15. **"Open the preview" on a Re-extract job's detail** is a slot in `JobProgressView` that 10.4 leaves empty; 10.6a fills it (attach to the job id). Likewise the cap notice slot is filled by 10.3a.
16. **`EXTRACTION_QUEUE` waiting** (EXTRACT_SELECTED_POSTS counts) is in the enum and rendered if present, but only 10.12a produces it; this story derives `RETRY_AT` (a `resume_at`) and `RESULT_FROM_PROVIDER` (a follower, or a pending `job_vendor_snapshots` link).
17. **Seed rows for e2e live in `packages/database/seed.ts`** (the only e2e seed in the repo); the builder adds test-only job rows there, idempotently.
18. **Analytics events are the four of the spec, nothing more**; no event on polling or on render.

### Architecture & UX Gate Findings

- **Gate 1 and Gate 3: cited from the epic-wide sweep** (`epic-readiness/epic-10-readiness.md`, `swept: true`): the `job(id)`/`myJobs`/`activeJobs` surface is co-scoped with its one consumer (not a Gate 1 violation); the pagination controller (Story 0.i5a, build the shared pagination and filter controller) and `SubscribedAccountCard` (Story 0.i6a, finish the `SubscribedAccountCard`/`AccountAvatar` contract) are `review` status and already in the code, so adopt them now; their ratchets (0-i5z, 0-i6z) are still `backlog` and must not catch this story later.
- **Lightweight guard (what the sweep could not see):** one engine gap found: `JOBS_HISTORY_RETENTION_DAYS` is specified and unbuilt (decision 7); absorbed as a small task (A5), not split, because it needs no new infrastructure: one environment variable and a read-side filter (hide-only, owner override 2026-11-13; no sweep step). No other foundation is missing (i18n, analytics, codegen, `buildOptimizedDrizzleSelect`, `getRequestedFieldNames`, `RouteLoader`, `PageContainer` all exist).
- **Gate 2: triggered** (a reusable component with many states and strict a11y, and a polling hook that others depend on). Answer: the split above puts them in their own story (10.4b); the UX design needed no further UX pass (the spec is final and owner-confirmed).
- **Infra docs:** no service, queue, Lambda, table or library is added, so `docs/infrastructure/architecture-diagram.md` and `high-level-overview.md` are not updated (CLAUDE.md section 4).

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** no mismatch. `jobs.type`, `reason_code`, `phase` are text, `status`/`trigger` enums, `input`/`result_data` jsonb, `deadline_at`, `admitted_at`, `queued_since`, `resume_at`, `finished_at` timestamptz: all the `Job` fields map without DDL. `job_attempts.provider` is `scraper_run_vendor` (`BRIGHTDATA`), mapped to the PRD's `BRIGHT_DATA` only in the GraphQL layer (as the schema comment already says).
- **Impacted contracts:** new GraphQL types and enums (`JobType` with `OTHER`, `JobStatus`, `JobReasonCode`, ...), new `Query`/`Mutation` fields, a new env var `JOBS_HISTORY_RETENTION_DAYS`; a new domain presentation registry. PRD 4.21's `Job` interface stays (the GraphQL `Job` is a projection: no `inputKey`, no `ownerUserId`).
- **Required DB migration changes:** No changes required.
- **Required TypeScript type changes:** codegen types in `apps/web/src/generated/graphql.ts`; `Env.jobsHistoryRetentionDays`.
- **Backward compatibility and rollout:** read-only additions; deploy API before web. A web build that queries the new fields against an old API fails the query only on the Jobs page.
- **Verification checks:** domain tests (100%); real-Postgres resolver suite; `codegen-consistency.test.ts`; `env.test.ts` and the stack test; the walking pagination test.

### What exists today (read these first)

- **Engine:** `packages/domain/src/jobs/{job-engine,admission,late-result,reextract-post}.ts`; `apps/backend/src/lib/job-engine/*` (`startJob`, `admitJob`, `cancelJob`, `run-job-engine-sweep.ts`, `job-engine-test-support.ts`); `packages/database/schema.ts` (`jobs`, `job_attempts`, `job_vendor_snapshots`; no `deletedAt`, append-only by design, AD-53 Rule 1). Only the `reextract-post` type is registered; Story 10.6 (move the moderator re-extract rescrape onto the engine) is on the base branch.
- **GraphQL:** no `job`, `myJobs` or `activeJobs` exist. List precedent: `queryActorRuns` and the `ActorRunConnection` shape (`schema/actor-runs.graphql`, resolver in `resolvers.ts`), `encodeActorRunCursor`, and `moderator-list-pagination.test.ts` (the walking test that new paged lists extend).
- **Web:** the Re-extract preview polls privately in `features/moderation/use-post-reextraction-preview.ts` (2 s) and `reextract-post-dialog.tsx` forgets the job on close. **This story does not touch either** (10.6a does: attach, chip, banner); it provides the shared `useJob` and component they will move to.
- **Reuse, do not rebuild:** `PageContainer`, `PageHeader`, `RouteLoader`, `StatusBadge`, `CountBadge`, `Dialog`, `Table`, `Checkbox`, `RadioGroup`, `SubscribedAccountCard`, `PaginationControls`, `usePaginationLabels`, `useListPaginationController`, `useReportConnectionPageMeta`, `EmptyPageNotice`, `usePrefersReducedMotion`, `capturePostHogEvent`, `buildPageMetadata`, `buildAccountHref`.

### Guardrails (project rules this story must obey)

- **Authorization:** `requireAuth(context)` first statement of every new root field, no `if` ahead of it, no `catch` that returns data; moderator-only branches are checks after it; never read `context.user` in a way that accepts a client `userId` (AD-7).
- **Soft delete:** `activeOnly(table)` (never a hand-written `isNull(deletedAt)`; the `lint:invariants` pass fails the build) on every joined table that has `deletedAt` (`users`, `posts`, `social_media_account_profiles`); `jobs` itself has none.
- **No caption, no signed URL, no vendor name for ordinary users; no raw error:** only `error_message` plain words and only to a moderator; reason text from the code.
- **Real-Postgres tests that leave no rows** (the row-count ratchet, Story 0.51): create users and jobs, delete them (jobs first, cascades to attempts and snapshots), and run the new file alone with `npx tsx scripts/run-tests-with-row-count-ratchet.ts <file>`.
- **`packages/domain`:** no React, no DB, 100% coverage, relative imports with the `.js` suffix as the existing jobs files do. `packages/ui`: no `next-intl` import; text through `labels`; framework-agnostic; components in `src/features/jobs/`; z-index only through the named tiers (the chip is in flow, the dialog is the shared `DialogContent`), no raw `z-40`/`z-50`.
- **State:** server state in React Query with generated types; view state only in the component; no `localStorage` for job state; no Zustand store for jobs.
- **Skeletons** mirror real heights (project-context, Keep Skeletons in Sync); no full-screen blocking loader for a wait (FR116).

### Project Structure Notes

- **New:** `packages/domain/src/jobs/{job-presentation,job-steps,job-reasons,job-retry,job-waiting}.ts` (+ tests; or one file if small); `apps/backend/src/schema/jobs.graphql`; `apps/backend/src/lib/job-engine/{read-jobs,job-read-mappers,retry-job,job-retry-registry}.ts` (+ tests); `apps/backend/src/schema/jobs-read-api.test.ts`; `packages/ui/src/features/jobs/*`; `apps/web/src/features/jobs/*`; `apps/web/src/app/[locale]/jobs/**`; `apps/web/e2e/jobs.spec.ts`; `.graphql` documents.
- **Modified:** `packages/domain/src/jobs/index.ts`; `apps/backend/src/schema/resolvers.ts` (resolvers only); `apps/backend/src/env.ts`, `.env.example`, `env.test.ts`; `apps/infrastructure/lib/festgrid-backend-stack.ts` and its test; `packages/ui/src/index.ts`; `packages/ui/src/core/app-shell/profile-menu-entries.ts`; `apps/web/locales/{en,id}.json`; `apps/web/src/generated/graphql.ts`; `apps/web/e2e/{responsive-overflow,responsive-popups}.spec.ts`; `packages/database/seed.ts`; `moderator-list-pagination.test.ts` (new case); the PRD, `epics.md`, `project-context.md`, AD-53.
- **Not modified:** `use-post-reextraction-preview.ts`, `reextract-post-dialog.tsx` (10.6a), any migration, `docs/infrastructure/architecture-diagram.md`, `high-level-overview.md`.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Epic 10`, Story 10.4; Stories 10.3a, 10.6a, 10.13 for the slots and the badge.]
- [Source: `ux-designs/ux-festgrid-2026-11-13/EXPERIENCE.md` (Component Patterns, State Patterns, Story 10.4 flows, Accessibility, Mobile, Analytics), `DESIGN.md`, `copy-keys.md` (sections 1 and 4), `graphql-read-shape.md`, `decisions.md` (choices 1 to 12, open rows).]
- [Source: PRD 3.18 (FR116 to FR130), 3.12, 4.21, 5 (Background Jobs); `epic-readiness/epic-10-readiness.md`; `background-vendor-jobs-design-notes-2026-11-02.md`.]
- [Source: Architecture Spine AD-53 (The Job Engine), AD-7 (Authenticated Context and Authorization), AD-18 (Filter Apply-Timing Convention), AD-35 (Account URLs Resolve by Username), AD-33 (Z-Index Layering Tiers), AD-40 (Moderator Re-extract Is a Write-Free Preview That Never Keeps a Caption) Rule 9.]
- [Source: Story files `10-1a-build-the-job-engine-core-record-lifecycle-runner-and-sweep.md`, `10-3-add-reuse-and-admission-control-to-job-start.md`, `10-5-collect-late-vendor-results-and-finish-the-job.md`, `10-6-move-the-moderator-re-extract-rescrape-onto-the-engine.md` (Dev Agent Record: engine offers, handler and test patterns).]
- [Source: code read while creating this story: `packages/domain/src/jobs/*`, `apps/backend/src/lib/job-engine/*`, `packages/database/schema.ts` (jobs section), `apps/backend/src/schema/{actor-runs.graphql,resolvers.ts,moderator-list-pagination.test.ts}`, `packages/graphql-select/optimized-select.ts`, `packages/ui/src/core/{status-badge.tsx,app-shell/profile-menu-entries.ts}`, `apps/web/src/features/{pagination,moderation}/*`, `apps/web/e2e/*`.]

## Global Rules References

- `_bmad-output/project-context.md` (GraphQL only, Drizzle only, `buildOptimizedDrizzleSelect`, `activeOnly`, auth up front, real-Postgres tests and the row-count ratchet, `packages/domain` purity and 100% coverage, list pagination controller, i18n and locale-sensitive rendering, responsive containment, layering tiers, page header and container, dynamic metadata).
- `_bmad-output/planning-artifacts/story-content-structure.md`; `story-split-gate.md`.
- Architecture spine: AD-53, AD-7, AD-18, AD-35, AD-33, AD-40.
- PRD 3.18, 3.12, 4.21.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:** see Project Structure Notes.
- **Rule Mapping:**
  - Pure presentation, step, reason and retry rules in `packages/domain`, 100% covered, no DB → project-context (Code Organization) → A1.
  - Auth first, owner scoping, moderator-only data, no caption or vendor leak → AD-7, PRD FR123, FR130, AD-53 Rule 1 → A2, A3, A6.
  - Paged list ends its `ORDER BY` in `id`, cursor after its row, walking test → project-context (AD-18 rule 4) → A3, A6.
  - Optimized select and `activeOnly` → project-context (Optimized DB Queries, Soft-Delete) → A3.
  - Shared component in `packages/ui` with labels, hooks in `apps/web` → project-context (UI Components, Adapter) → B1, B2.
  - Page uses `useListPaginationController` and the shared controls → AD-18 → C1.
  - Responsive and popup matrices, e2e happy path → project-context (Responsive Containment, Testing Rules) → C3.
  - Doc amendments (FR123 paging) → owner choice 1 → D1, D2.
- **Verification Plan:** `pnpm --filter @festgrid/domain test` (100%), `lint`, `build` (and `pnpm coverage:badge` if coverage moves); rebuild domain before the backend typecheck; `GEOAPIFY_API_KEY=test-geoapify-key pnpm --filter backend test` (new files alone with the ratchet script first); `pnpm run lint:invariants`; `pnpm --filter web codegen` then `pnpm --filter web build` and tests; `pnpm --filter @festgrid/ui test`; `pnpm --filter infrastructure test`; Playwright with `E2E_FAKE_AUTH=1` on a local stack; root `pnpm build`.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: the read API (`job`, `myJobs`, `activeJobs`, `retryJob`), the shared progress component, the Jobs page and detail, the menu entry, copy, analytics, e2e and the FR123 amendment. Pending approval.
- [ ] Split decision: accept the split into 10.4a, 10.4b, 10.4c (add their keys) or keep one story. Pending approval.
- [ ] Architecture and boundary confirmation: pure rules in `packages/domain`; component in `packages/ui`; hooks in `apps/web`; no new service, table, queue or migration; one environment variable. Pending approval.
- [ ] Testing plan confirmation: domain 100%; real-Postgres resolver suite with leak canaries; walking pagination test; component and hook tests; the two responsive specs; one e2e happy path. Pending approval.
- [ ] Explicit human approval state: **pending approval.**
- [ ] Gate 1/2/3 findings acknowledged (cited from the swept report; Gate 2 triggered, answered by the split). Pending user acknowledgement.
- [ ] Decisions acknowledged: Dev Notes decisions 1 to 18 (above all 1 split, 2 `OTHER`, 6 retry starters, 7 retention (hide-only, owner override), 9 owner label, 14 no `lookup.*` copy). Pending user acknowledgement.
- [ ] OI-2 decisions D1, D3, D4 remain OPEN with the owner; this story builds none of their slots. Pending user acknowledgement.

## Testing Requirements

- [ ] **Unit tests (required, `packages/domain`, 100% coverage):** presentation registry (known, unknown to `OTHER`, idempotent registration), `deriveJobSteps` for every status and a skipped step, `mapJobReasonCode` (every user-safe code, every internal code and an unknown one to `GENERIC`), `decideJobRetry` (every row of the retry table, COOLDOWN with a time, no starter, not owner, not ended), `deriveJobWaiting`.
- [ ] **Integration tests (required, real local Postgres, no vendor call, no Lambda invoke):** `jobs-read-api.test.ts`:
  - ordinary user sees own USER jobs only; another user's job, a SYSTEM job and a retained-out job read `null` by id and are absent from lists; `ALL_USERS` and `includeSystem` are `FORBIDDEN` for a user and work for a moderator; an unauthenticated call is `UNAUTHENTICATED`;
  - **leak canaries:** plant a caption string in `input.held`, a preview and an image URL in `result_data`, and a vendor name in `job_attempts`; serialise the whole response for an ordinary user and for a moderator and assert none of the caption or URL strings appear anywhere, and no vendor name appears for the ordinary user; `moderatorDetails` and `owner` are `null` for the ordinary user and no `job_attempts` query runs for them;
  - queue position and `expiresAt` for several QUEUED jobs, WAITING with `resume_at`, a follower, steps for every status, `completedAfterDeadline`, `GENERIC` mapping of an internal reason, `canRetry` per reason and per owner, `activeJobs` with `subject` and `endedWithinMinutes`, retention hides (hide-only: a retained-out job and its rows stay in the table), `retryJob` STARTED / REUSED / REFUSED (queue full) with a fake invoke seam, never copying `held`;
  - a case added to `moderator-list-pagination.test.ts` for `myJobs`: five finished jobs with the SAME `created_at`, page size 2, read as 2 + 2 + 1, no repeat, in list order;
  - the auth-surface ratchet, `codegen-consistency.test.ts`, `env.test.ts` and the stack test stay green.
  - Unhappy paths (required): bad cursor, unknown id, job of a type with no presentation, `retryJob` on a running job and on another user's job.
- [ ] **Component and hook tests (Vitest, msw or mocked hooks per the existing patterns):** every state of the state table for `JobProgressView`/`JobChip`; stepper roles and `aria-current`; `JobAnnouncer` (announces on change only, coalesces within 3 s, not on a poll with no change, `role="alert"` for a watched failure); `useJob` (intervals, hidden-tab pause and resume fetch, back-off, never touches `localStorage`); minimize/reopen and focus return; Retry outcomes and cooldown button; Jobs page paging in the style of `pagination-focus.test.tsx` (empty later page, failing later page, filter change returns to page 1, clear-filters resets); moderator-only filter row; locale parity in `locales.test.ts`; menu entry order.
- [ ] **E2E (Playwright, `E2E_FAKE_AUTH=1`):** `jobs.spec.ts` happy path and the moderator view; `/en/jobs` and `/en/jobs/{id}` in `responsive-overflow.spec.ts` (320 to 1440); a progress-dialog scenario in `responsive-popups.spec.ts`.

## Deliverables Checklist

- [ ] Pure rules in `packages/domain/src/jobs/`, exported, 100% covered.
- [ ] `jobs.graphql`, three read fields and `retryJob`, with the auth, scoping and no-leak guarantees and their tests.
- [ ] Retention: setting and read filter (hide-only; no sweep step, no delete).
- [ ] `packages/ui/src/features/jobs/*` and `apps/web/src/features/jobs/*`; generated GraphQL types.
- [ ] `/jobs` and `/jobs/{id}`, the profile menu entry, metadata, English and Indonesian copy.
- [ ] Four analytics events; a11y announcements; responsive containment.
- [ ] e2e seed rows and specs.
- [ ] PRD 3.18 and 3.12, `epics.md` FR123 line, `project-context.md` pointer, AD-53 line updated.
- [ ] All new tests passing; `pnpm build`, lint and `lint:invariants` clean.

## Out of Scope

- The subscription cap notice and the Upgrade button (Story 10.3a, show the subscription cap refusal and the upgrade call to action); the Re-extract banner, Retry wiring, `attachJobId`, chip in the source-post panel and the `Job.refresh`/`images[]` data (Story 10.6a, show the Re-extract progress, the missing-images banner and Retry).
- Adopting the component at the other start points: Subscribe and profile lookup (10.7), correction (10.9), extract from URL (10.10), refresh now (10.11), admin operations (10.12), manual selection (10.12a). Each registers its own presentation entry, phases and retry starter.
- The finished-since-last-visit badge and notifications (Story 10.13, notify when a job finishes).
- The OI-2 lookup-fallback copy and slots (D1 durable lookup requests, D3 interactive budget, D4 vote auto-apply); a Cancel button (design choice 9; `cancelJob` exists on the server); a floating jobs tray; progress percentages.
- Any new table, queue, Lambda or migration; changes to `docs/infrastructure/architecture-diagram.md` and `high-level-overview.md`.

## Definition of Done

- [ ] AC 1-21 satisfied.
- [ ] All new unit, integration, component and e2e tests passing; the row-count ratchet clean.
- [ ] `pnpm lint` and `pnpm build` passing for `packages/domain`, `packages/ui`, `apps/backend`, `apps/web`, `apps/infrastructure`; `lint:invariants` clean; the domain coverage badge current.
- [ ] PRD, `epics.md`, `project-context.md` and AD-53 amended in the same change.
- [ ] Pre-Coding Approval Gate explicitly approved by the owner before implementation begins.

## Completion Status

- [ ] Ready for development (created 2026-11-13, stacked on the UX branch `docs/epic-10-ux`; the split proposal and 18 decisions await the owner).
- Creation note: context engine analysis completed; the owner-confirmed UX spec (12 choices) is the design source; OI-2 D1, D3, D4 left open and unbuilt.

## Dev Agent Record

### Agent Model Used

Built in the Claude Code CLI session recorded in the commit trailers (Part A only; Parts B, C and D are later runs).

### Debug Log References

- The Part A build started on the product owner's delegation. The Pre-Coding Approval Gate boxes are left UNTICKED for the owner to tick.
- Owner override of Dev Notes decision 7 (2026-11-13): retention is hide-only. AC 4, task A5, decision 7, the Deliverables line and the Decision list were reworded; "a physical delete is a follow-up for the owner".
- Found while testing: `jobs.input` and `jobs.result_data` are stored by drizzle as a jsonb STRING holding the JSON text (the `events.links` trap in project-context), so `input ->> 'postId'` returned null until the read unwraps with `(col #>> '{}')::jsonb`, as the existing sweep does.
- Only `users` has `deleted_at` among the joined tables (`posts` and `social_media_account_profiles` have none), so `activeOnly(...)` is used for `users` only; `activeOnly(posts)` would not type-check. The story text (A3, Guardrails) names three tables; the real set is one.
- Part A does not touch `apps/web` except the regenerated `generated/graphql.ts` (schema types only; no `.graphql` document yet, those are Part B).

### Completion Notes List

- A1 (`packages/domain/src/jobs/`): `job-presentation.ts` (registry, `reextract-post` registered at import with phases `refresh`, `preview`, refresh SKIPPED on `NOT_NEEDED`, unknown type reads `OTHER`), `job-steps.ts` (`deriveJobSteps`, plus `deriveVisibleJobStatus`), `job-reasons.ts` (`mapJobReasonCode`, `userSafeJobProvider`), `job-retry.ts` (`decideJobRetry`), `job-waiting.ts` (`deriveJobWaiting`), `job-history.ts` (`jobHistoryCutoff`, `deriveJobOutcome`). 100% coverage held (1851 tests); badge current.
- A2: `apps/backend/src/schema/jobs.graphql` (types of `graphql-read-shape.md` plus `JobType.OTHER`; no `refresh` or `images`, decision 5), resolvers inline in `resolvers.ts` with `requireAuth` first; backend and web codegen run and committed.
- A3: `lib/job-engine/read-jobs.ts` and `job-read-mappers.ts`: scope and moderator filters, retention predicate (hide-only), `buildOptimizedDrizzleSelect` for plain columns plus dependency columns, named JSON-path projections only, one batched query per lookup per page (accounts, post codes, queue, owners, attempts), none of them when not requested; cursor is the position after the row (`encodeActorRunCursor`), `ORDER BY created_at DESC, id DESC`. A source-scan ratchet (`jobs-read-no-whole-json.ratchet.test.ts`) pins that `input`, `result_data` and `error_message` are never read whole.
- A4: `job-retry-registry.ts`, `register-job-retry-starters.ts` (the `reextract-post` starter, moderator-only), `retry-job.ts`; `startReextractPostJobDetailed` added beside `startReextractPostJob` (the old function keeps its result shape) so Retry can tell STARTED from REUSED and report queue-full numbers. The old job's input is read only through its identity keys, so a held caption cannot reach the starter.
- A5: `JOBS_HISTORY_RETENTION_DAYS` (default 30) in `env.ts`, `.env.example`, `env.test.ts`, the API Lambda environment and `festgrid-backend-stack.test.ts`. API Lambda only (the one reader; hide-only needs no worker). No sweep step, no delete.
- A6: `schema/jobs-read-api.test.ts` (17 cases, real Postgres, leak canaries for caption, preview, image URL and vendor, query spies for `job_attempts` and per-row lookups, retention hide-only, queue, waiting, steps, retry STARTED, REUSED, REFUSED cooldown and queue-full, unhappy paths) and a `myJobs` case in `moderator-list-pagination.test.ts` (5 rows with one `created_at`, 2 + 2 + 1). Both pass under the row-count ratchet with no rows left.
- Decisions made: (a) a QUEUED job that was admitted (holds a place) reads RUNNING and has no queue info; only a QUEUED job never admitted reads QUEUED with a position; (b) `JobSubject.accountId` is the profile's own id (the `accountId` key of a job's input is that id, never the platform's numeric id); (c) `deriveJobWaiting` tells RETRY_AT (a `resume_at`) from RESULT_FROM_PROVIDER (none) because the engine does not store the kind of wait a handler asked for; EXTRACTION_QUEUE is not produced (decision 16); (d) a job whose type has no registered presentation is `OTHER`; for a started job with no phase the first non-skipped step is CURRENT; (e) `retryJob` on a job that is not retryable is `BAD_REQUEST`, on someone else's or a missing job `NOT_FOUND`, a COOLDOWN whose time has not come is `REFUSED` with `COOLDOWN` and `retryNotBefore`; (f) `owner` is null for a SYSTEM job and for a soft-deleted user; (g) retention applies to a moderator's `job(id)` too.
- Gates run (Part A): domain `pnpm test` 1851 pass at 100% (lines, statements, functions, branches), domain lint and build clean, coverage badge current; backend `tsc --noEmit` clean; `lint:invariants` clean; ESLint on touched backend files: 0 errors; new files alone and with the touched and adjacent suites (auth-surface, codegen-consistency, schema-consistency, explicit-any, env, start-job, run-job-engine-sweep, reextract flow and start, source-scan ratchets, eslint-enforcement, moderator-list-pagination): 165 pass, 0 fail; `jobs-read-api`, `moderator-list-pagination` and the new ratchet through `run-tests-with-row-count-ratchet.ts`: 29 pass, no leftover rows; infrastructure `pnpm test`: 42 pass. Not run in this part: the whole backend suite, web build and tests, UI tests, Playwright (later parts; the Part A change to `apps/web` is generated types only).

- Review fixes (2026-11-13, three findings): (1) `getRequestedFieldNames` reads alias names, so `job(id) { input: id }` made the optimized select take a whole column; `buildJobSelect` now keeps only an allowlist of plain columns (`id`, `type`, `trigger`, `status`, `reasonCode`, `createdAt`, `finishedAt`, `deadlineAt`, `completedAfterDeadline`) from it. The shared function is unchanged. Aliased derived fields are not supported (the generated web client never aliases); an aliased query returns data only for the plain fields. (2) `retryJob` now applies the same retention rule as the reads (a job past retention is NOT_FOUND). (3) Retention measures a terminal job with no `finished_at` from `created_at`. Tests added for each in `jobs-read-api.test.ts`; 31 tests pass under the row-count ratchet.

### File List

- `_bmad-output/implementation-artifacts/10-4-build-the-jobs-page-and-the-inline-job-progress-component.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `packages/domain/src/jobs/{job-presentation,job-steps,job-reasons,job-retry,job-waiting,job-history}.ts` and their `.test.ts`; `packages/domain/src/jobs/index.ts`
- `apps/backend/src/schema/jobs.graphql`, `apps/backend/src/schema/resolvers.ts`, `apps/backend/src/schema/jobs-read-api.test.ts`, `apps/backend/src/schema/moderator-list-pagination.test.ts`
- `apps/backend/src/lib/job-engine/{read-jobs,job-read-mappers,job-retry-registry,register-job-retry-starters,retry-job}.ts`, `apps/backend/src/lib/job-engine/jobs-read-no-whole-json.ratchet.test.ts`
- `apps/backend/src/lib/extraction/start-reextract-post-job.ts`
- `apps/backend/src/env.ts`, `apps/backend/src/env.test.ts`, `apps/backend/src/lib/ai-processor/{rehost-post-image,upload-face-blur-thumbnail}.test.ts` (the `BackendEnv` literal), `.env.example`
- `apps/infrastructure/lib/festgrid-backend-stack.ts`, `apps/infrastructure/lib/festgrid-backend-stack.test.ts`
- `apps/backend/src/generated/resolvers-types.ts`, `apps/web/src/generated/graphql.ts` (codegen output)

### Change Log

- 2026-11-13: Part A (10.4a, backend read API) built: pure rules in `packages/domain`, `jobs.graphql` with `job`, `myJobs`, `activeJobs`, `retryJob`, the read layer, the retry-starter registry, hide-only retention setting, real-Postgres tests. Retention changed to hide-only by owner override (decision 7, AC 4, task A5). Status stays in-progress; Parts B, C and D remain.
