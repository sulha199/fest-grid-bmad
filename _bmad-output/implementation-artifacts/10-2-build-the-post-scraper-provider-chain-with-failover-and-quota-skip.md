---
baseline_commit: 721920476246866d524aa45076c063b2bdfcf1d5
---
# Story 10.2: Build the post-scraper provider chain with failover and quota skip

## Story Details

- Epic: 10 (Background vendor jobs: one engine, one Jobs page)
- Story ID: 10.2
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a post-scraper chain that mirrors the profile chain and covers Bright Data and Apify,
so that fetching one post tries each provider in order, moves on when one fails or is over quota, and records every provider it considered.

## Acceptance Criteria

1. **Given** `POST_SCRAPER_PROVIDER_ORDER` (default **`brightdata,apify`**, the owner's decision of 2026-11-11, PRD OI-1: profile lookup already prefers Apify, so posts prefer Bright Data to spare Apify's free plan) and a time budget, **when** a post URL is fetched, **then** each adapter runs through the guarded vendor call (capacity, degraded-provider and DPA gates, usage recorded) and declares `minBudgetMs`; the chain skips an adapter whose `minBudgetMs` exceeds the time left, and an adapter that throws, returns an empty or unreadable result, or is over quota hands over to the next one. A post the vendor says does not exist (`null`) is an answer and stops the chain. If every adapter fails, the first adapter's error is rethrown unchanged; if every adapter is skipped, `PostScraperBudgetError`. [PRD §3.18 FR118]
2. **And** each adapter considered writes one `job_attempts` row (`provider`, `outcome` in `SUCCEEDED | FAILED | EMPTY | TIMED_OUT | OVER_QUOTA | SKIPPED`, `budget_ms`, `elapsed_ms`, a plain-words `reason_code`, and `scraper_actor_run_id` only when a vendor call produced a `scraper_actor_runs` row), written as each outcome is known, also for the ones that fail. A caller with no job (an admin script) writes none. A write that fails never changes what the fetch returns. [FR118, PRD 4.21 `JobAttempt`]
3. **And** the Bright Data adapter fetches one post through `/datasets/v3/scrape` on the posts dataset (`brightdataDatasetId`) with `[{ "url": ... }]`: synchronous first, then polling the snapshot inside the budget, never retried (the scrape is billed and not idempotent). It maps the record with `mapBrightDataRecordToScrapedPost`. A `dead_page` error record is `null` (not found); any other error record, no record, or a record that maps to nothing throws so the next adapter is tried.
4. **And** the Apify adapter keeps the existing `getPostByUrl` behaviour (guarded call, usage recorded, `null` for a not-found item); an empty or unreadable item now THROWS instead of returning `null`, so the chain moves on (today an empty list is `null`, which a chain would read as "not found").
5. **And** both adapters return the cover in `imageUrl` and the slides in `additionalImageUrls`, and **the slide list never contains the cover** (the source fix for BUG-261102-4rm "carousel slide list repeats the cover"): a pure helper in `packages/domain` builds the list (drops a slide equal to the cover by file name, not by signed URL, and duplicates) and both mappers use it.
6. **And** an exhausted Apify monthly cap (`ApifyMonthlyUsageLimitError`) is **remembered for the rest of the usage cycle, or three days, whichever is sooner** (review: our cycle is not Apify's billing date): `scraper_provider_usage.capacity_exhausted_until` is set to the end of the current cycle, `isProviderCapacityAvailable` returns false until then (and the field clears when the cycle rolls over), so the chain records `OVER_QUOTA` and skips Apify without a refused call. The daily batch benefits too (absorbs IDEA-101 "Remember an exhausted Apify monthly cap ..."). Bright Data gets the same treatment through the same function if it ever reports a hard cap.
7. **And** the credential used per call is chosen by the job type: the chain context carries a `PostScrapeCredential` (`{ kind: 'app-funded' }` today; a contributed key for its owner's own subscription is added by Story 3-4b, which only has to extend the union and the resolver), so 3-4b plugs in without changing the chain. This story ships only `app-funded`.
8. **And** the transient-error classifier is **shared, not copied a fourth time** (FIND-082 "Story 0.i2d review deferrals: triplicated transient-error classifier ..."): one pure `isTransientVendorFailure({ statusCode?, code? })` in `packages/domain` replaces the bodies of `isApifyErrorTransient`, `isBrightDataErrorTransient` and `isGeminiErrorTransient` (each keeps its exported name and its error-class checks, and only extracts the fields), with tests proving each classifier's behaviour is unchanged.
9. **And** nothing calls a vendor in any test (fake adapters for the chain, injected seams for the clients), the chain is not yet used by any production caller (Stories 10.5, 10.6, 10.7 and later adopt it; `start-post-reextraction-preview.ts` and `resume-stalled-chains.ts` keep calling `getPostByUrl` until then), and `docs/infrastructure` and AD-53 describe the new setting and the quota memory.

## Tasks / Subtasks

- [x] **Task 1: Pure chain and rules in `packages/domain`** (AC: 1, 5, 7, 8)
  - [x] `packages/domain/src/scraper/post-scraper-adapter.ts` (+ test, 100% coverage): `PostScraperAdapterName`, `PostScrapeCredential`, `PostScraperAdapter { name, minBudgetMs, fetchPost(url, { budgetMs, credential }) }`, `DEFAULT_POST_SCRAPER_ORDER = ['brightdata','apify']`, `parsePostScraperOrder` (same rules as `parseProfileScraperOrder`: case-insensitive, unknown names reported and dropped, duplicates once, empty or all-unknown falls back to the default), `PostAdapterAttempt` (skipped with `reason: 'budget' | 'quota'`, failed, not-found, found), `PostScraperBudgetError`, `runPostScraperChain({ adapters, url, budgetMs, credential, now?, isOverQuota?, onAttempt? })`. An adapter reporting over quota BEFORE its call (`isOverQuota(adapterName)` returning true) is recorded as skipped for quota with no call made.
  - [x] `packages/domain/src/scraper/merge-post-image-urls.ts` (+ test): `buildPostImageUrls(cover, slides)` returns `{ imageUrl, additionalImageUrls }` with the cover removed from the slides (compare by `image-url-file-name`, see `packages/domain/src/posts/image-url-file-name.ts`) and duplicates removed, order kept.
  - [x] `packages/domain/src/scraper/transient-vendor-failure.ts` (+ test): `isTransientVendorFailure({ statusCode, code })`: true for a 5xx status or one of `ECONNRESET, ETIMEDOUT, ECONNREFUSED, EAI_AGAIN`, else false (never a default-transient fallback).
  - [x] Export from the `scraper` barrel and the `public-api` test's barrel list.
- [x] **Task 2: Schema and migration** (AC: 6)
  - [x] `packages/database/schema.ts`: `scraperProviderUsage.capacityExhaustedUntil: timestamp('capacity_exhausted_until', { withTimezone: true })`. Generate with drizzle-kit (never hand-number: `git fetch origin master` and take the next free number). Nullable, no backfill; RLS is already on the table.
- [x] **Task 3: Quota memory** (AC: 6)
  - [x] `apps/backend/src/lib/scraper/usage-store.ts`: `markProviderCapacityExhausted(provider)` (sets `capacity_exhausted_until` to the end of the current cycle: `usage_cycle_reset_at + SCRAPER_USAGE_CYCLE_DAYS`, creating the row if absent); `isProviderCapacityAvailable` returns false while `capacity_exhausted_until` is in the future and ignores it once the cycle has elapsed. Call it where `ApifyMonthlyUsageLimitError` is raised (`instagram-adapter.ts` async trigger and the new adapter). Keep every existing usage test green.
- [x] **Task 4: Shared transient classifier** (AC: 8)
  - [x] Replace the three bodies (`instagram-adapter.ts`, `brightdata-client.ts`, `ai-gateway/gemini-client.ts`) by calls to `isTransientVendorFailure`; keep the exported names, the error-class branches and their tests; add a table test asserting identical results for the same inputs before and after.
- [x] **Task 5: Adapters** (AC: 3, 4, 5)
  - [x] `brightdata-client.ts`: generalise `_scrapeBrightDataProfile` into a private dataset scrape taking the dataset id and the input URL; keep `scrapeBrightDataProfile` as the profile wrapper (profile tests unchanged) and add `scrapeBrightDataPost(url, budgetMs)` over `brightdataDatasetId` with an injectable seam like `setScrapeBrightDataProfile`.
  - [x] `lib/scraper/brightdata-post-adapter.ts` (+ test with the injected seam): `minBudgetMs = BRIGHTDATA_POST_MIN_BUDGET_MS` (90 000 ms, the profile adapter's observed ~80 s; **an assumption: a post snapshot's duration has not been measured, and no vendor call may be made from a build session, so the first real run's attempt rows must be read and the constant tuned**), `assertProviderCapacityAvailable('brightdata', ...)`, `recordProviderUsage('brightdata', 1)`, `dead_page` to `null`, everything else unreadable throws a typed `BrightDataPostUnavailableError`.
  - [x] `instagram-adapter.ts`: extract the body of `getPostByUrl` into an exported `apifyFetchPost(url)` used by both `getPostByUrl` (behaviour unchanged for today's callers, empty list still `null` THERE) and the new `apifyPostAdapter` (`minBudgetMs: 0`; empty or unreadable throws `ApifyPostUnavailableError`); both mappers go through `buildPostImageUrls`.
  - [x] Twitter: `twitter-adapter.ts` registers a chain of one so `fetchScrapedPost` works for every platform that has `getPostByUrl` (no behaviour change for its callers).
- [x] **Task 6: Entry point, attempts store, setting** (AC: 1, 2, 7)
  - [x] `lib/scraper/post-scraper.ts`: registry (`registerPostScraperAdapter`, `getPostScraperAdapters` in configured order, a configured name with no adapter skipped with a warning) and `fetchScrapedPost({ platform, url, budgetMs, credential, jobId? })`; one log line when more than one adapter was considered.
  - [x] `lib/job-engine/record-job-attempt.ts` (+ test): maps a `PostAdapterAttempt` to a `job_attempts` row (`found` to SUCCEEDED, `not-found` to SUCCEEDED, `failed` to FAILED / TIMED_OUT (the timeout classifier of `profile-lookup-attempts-store.ts`, reused, not copied) / EMPTY (the typed unavailable errors), `skipped` to SKIPPED / OVER_QUOTA); `reason_code` and a plain-words message only, never the raw vendor error, a URL or a caption (the repo and logs are public).
  - [x] `apps/backend/src/env.ts` (`postScraperProviderOrder`, raw, parsed by `parsePostScraperOrder`), `.env.example`, and `festgrid-backend-stack.ts` (the Scraper Lambda gets `POST_SCRAPER_PROVIDER_ORDER` like `PROFILE_SCRAPER_PROVIDER_ORDER`); extend `env.test.ts` and the stack test.
  - [x] Resolver seam `resolvePostScrapeCredential(jobType, ownerUserId)` returning `{ kind: 'app-funded' }` (test: the default).
- [x] **Task 7: Tests** (AC: 1 to 9)
  - [x] Domain: chain order, skip for budget and for quota, found, not-found stops, failover on throw, first error rethrown, all skipped, attempts recorded for failures, a throwing `onAttempt` ignored, `parsePostScraperOrder`, `buildPostImageUrls`, `isTransientVendorFailure`; 100% coverage.
  - [x] Backend (real Postgres, fakes for every vendor): the default order is Bright Data then Apify; a Bright Data failure falls to Apify and writes two `job_attempts` rows; an exhausted Apify cap is skipped with `OVER_QUOTA` and no call; the memory survives and clears when the cycle rolls over; the slide list never contains the cover for both mappers; the classifier table test; `fetchScrapedPost` with no `jobId` writes no row. Every suite deletes the rows it creates (row-count ratchet).
- [x] **Task 8: Docs** (AC: 9)
  - [x] AD-53: a rule for the post chain and the quota memory (and that no production caller uses it yet); `architecture-diagram.md` and `high-level-overview.md` (the new setting, the new column; no new service, queue, Lambda or secret); `deferred-work`/backlog: mark FIND-082 and IDEA-101 resolved per `backlog-spec.md`.

## Dev Notes

- **What exists today (read these first).** `packages/domain/src/scraper/profile-scraper-adapter.ts` is the template for the pure chain (same shape, same error behaviour); `lib/scraper/profile-scraper.ts` is the template for the registry and the entry point; `brightdata-profile-adapter.ts` for a Bright Data adapter; `profile-lookup-attempts-store.ts` for audit rows and the timeout test. `getPostByUrl` lives in `instagram-adapter.ts` (Apify actor `GET_POST_BY_URL_ACTOR`, a 20 s `withTimeout`) and `twitter-adapter.ts`; its callers are `lib/extraction/start-post-reextraction-preview.ts` and `lib/ai-processor/resume-stalled-chains.ts` and they are NOT changed here. The Bright Data posts dataset is `env.brightdataDatasetId` (`BRIGHTDATA_DATASET_ID`); the profile dataset is a different id.
- **Why `null` and "empty" differ.** A chain treats `null` as "the platform has no such post" and stops; an empty list or an unreadable item from a vendor is "the vendor did not deliver" and must throw so the next provider is tried (the 2026-10-21 Bright Data outage looked like empty results). Today's Apify `getPostByUrl` returns `null` for an empty list; that stays for its current callers and is changed only inside the new adapter.
- **Quota memory.** The incident `docs/infrastructure/incidents/2026-10-30-apify-monthly-cap-and-late-brightdata-delivery.md` has the cap's shape (403 `platform-feature-disabled`, "Monthly usage hard limit exceeded") and `ApifyMonthlyUsageLimitError` already exists. Today the refusal is cheap but repeats per target. Store the end of the cycle, not a flag, so it clears itself.
- **Guardrails.** Vendor calls only through the guarded wrapper (AD-32); only `instagram-adapter.ts` may import `apify-client` (the ratchet `no-vendor-call-bypasses-wrapper`); no secret, post caption, signed image URL or raw vendor error in a log or an attempt row; `packages/domain` stays pure and 100% covered; drizzle-kit migration, fetch master first; no vendor call and no Lambda invoke in any test or by the build session.
- **Reusable mechanisms (project rule).** The chain, `buildPostImageUrls` and `isTransientVendorFailure` are reusable and live in `packages/domain`; the registry and `record-job-attempt` live in `apps/backend/src/lib`. No UI, no analytics event, no i18n key, no GraphQL change, no new service to set up (so no `SETUP_WALKTHROUGH.md` change).

### Data Type Compatibility & Migration Requirements

- **Database.** One nullable column: `scraper_provider_usage.capacity_exhausted_until timestamptz`. No backfill (null means "not exhausted"). `job_attempts` already has every column and the six outcome values this story writes (migration 0096); no change.
- **TypeScript.** New domain types (`PostScraperAdapter`, `PostAdapterAttempt`, `PostScrapeCredential`); `ScrapedPost` is unchanged (its `additionalImageUrls` comment gains "never contains the cover"). `Env` gains `postScraperProviderOrder`.
- **Backward compatibility and rollout.** No production caller uses the chain yet, so behaviour changes only through (a) the quota memory, which makes the daily batch skip Apify once its cap is known to be used up (intended, IDEA-101), and (b) the shared classifier, which must be behaviour-identical. The new setting has a default, so deploying without it is safe.
- **Verification.** Migration applies on a seeded database; the classifier table test; the quota-memory tests; the row-count ratchet; lint, build and the infrastructure test.

### Architecture & UX Gate Findings

- **Gate 1 and Gate 3 cited from the epic-wide sweep** (`epic-readiness/epic-10-readiness.md`, `swept: true`): a chain inside the Scraper Lambda that already holds both vendor tokens, no new service, queue or secret. **Lightweight guard performed:** the only thing the sweep did not anticipate is the one new column (`capacity_exhausted_until`), a single nullable field on an existing table; no gap.
- **Gate 2:** not applicable, no UI.
- **Prerequisites:** Story 10.1a (attempt rows) is done. The default order is decided (OI-1).

### Project Structure Notes

- **New:** `packages/domain/src/scraper/{post-scraper-adapter,merge-post-image-urls,transient-vendor-failure}.ts` (+ tests); `apps/backend/src/lib/scraper/{post-scraper,brightdata-post-adapter}.ts` (+ tests); `apps/backend/src/lib/job-engine/record-job-attempt.ts` (+ test); one migration.
- **Modified:** `packages/database/schema.ts`; `apps/backend/src/lib/scraper/{usage-store,brightdata-client,instagram-adapter,twitter-adapter}.ts`; `apps/backend/src/lib/ai-gateway/gemini-client.ts`; `apps/backend/src/env.ts`, `.env.example`; `apps/infrastructure/lib/festgrid-backend-stack.ts` (+ test); `scraper` barrel; spine AD-53; both infrastructure docs; `backlog.yaml` (FIND-082, IDEA-101).
- **Not modified:** `start-post-reextraction-preview.ts`, `resume-stalled-chains.ts` (their adoption is Stories 10.5 to 10.7), any `.graphql` file, `apps/web`, `packages/ui`, the profile chain.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Epic 10`, Story 10.2] and `epic-readiness/epic-10-readiness.md`.
- [Source: PRD 3.18 FR118; 4.21 `JobAttempt`; OI-1 (decided 2026-11-11 in this story's creation); OI-3 (credential, Story 3-4b).]
- [Source: Architecture Spine AD-32 (guarded vendor call), AD-34 (scrape gate), AD-53 (engine).]
- [Source: `_bmad-output/planning-artifacts/background-vendor-jobs-design-notes-2026-11-02.md` decision 4 (order amended 2026-11-11).]
- [Source: `docs/infrastructure/incidents/2026-10-30-apify-monthly-cap-and-late-brightdata-delivery.md`; `backlog.yaml` FIND-082, IDEA-101, BUG-261102-4rm.]
- [Source: code read while creating this story: `packages/domain/src/scraper/profile-scraper-adapter.ts`, `lib/scraper/{profile-scraper,brightdata-profile-adapter,brightdata-client,brightdata-record-mapper,instagram-adapter,usage-store,profile-lookup-attempts-store}.ts`, `packages/database/schema.ts` (`jobAttempts`, `scraperProviderUsage`).]

## Global Rules References

- `_bmad-output/project-context.md` (Drizzle only, drizzle-kit migrations, `packages/domain` purity and 100% coverage, real-Postgres integration tests, row-count ratchet, no vendor call outside the guarded wrapper).
- `_bmad-output/planning-artifacts/story-content-structure.md`.
- Architecture spine: AD-32, AD-34, AD-53; PRD 3.18.
- Infrastructure docs: `docs/infrastructure/index.md`, `architecture-diagram.md`, `high-level-overview.md` (CLAUDE.md §4).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:** see Project Structure Notes (new, modified, not modified).
- **Rule Mapping:**
  - Pure chain, image-list rule and classifier in `packages/domain`, 100% covered → `project-context.md` → Task 1.
  - Vendor calls only through the guarded wrapper; only `instagram-adapter.ts` imports `apify-client` → AD-32 → Task 5.
  - drizzle-kit migration, fetch master first → `project-context.md` → Task 2.
  - Plain-words attempt rows, no raw vendor error or URL → PRD 3.18 / FR117 (public repo and logs) → Task 6.
  - CLAUDE.md §4 diagram upkeep → Task 8.
  - Story-split-gate: Gate 1 and 3 cited from the swept report plus a lightweight guard; Gate 2 not applicable → Dev Notes.
- **Verification Plan:**
  - `pnpm --filter @festgrid/domain test` (100% coverage); `pnpm --filter @festgrid/database run generate` then `run migrate`.
  - `pnpm --filter backend exec tsx --test` over the new and changed suites, then the full suite through `scripts/run-tests-with-row-count-ratchet.ts` (with `GEOAPIFY_API_KEY=test-geoapify-key`); `pnpm --filter infrastructure test`.
  - `pnpm build` and `pnpm lint` at the root.
  - Manual: `git diff --stat` against `baseline_commit` shows no caller of `getPostByUrl`, no `.graphql`, `apps/web` or `packages/ui` file changed.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: the pure chain, the two adapters, attempt rows, the quota memory, the shared classifier, the setting and docs; no production caller adopts it. Pending approval.
- [ ] Architecture and boundary confirmation: pure rules in `packages/domain`; vendor wiring in `apps/backend/src/lib/scraper`; one nullable column; no new service, queue or secret. Pending approval.
- [ ] Testing plan confirmation: domain 100% coverage; real-Postgres suites with fake vendors; the classifier table test; the row-count ratchet; the infra stack test. Pending approval.
- [ ] Explicit human approval state: **pending approval.**
- [ ] Gate 1/2/3 prerequisites confirmed from the swept readiness report plus the lightweight guard above. Pending user acknowledgement.
- [ ] Assumption acknowledged: Bright Data's post snapshot duration is unmeasured, so `BRIGHTDATA_POST_MIN_BUDGET_MS` (90 s) is a tunable guess to be corrected from the first real run's attempt rows. Pending user acknowledgement.

## Testing Requirements

- [ ] Unit tests (required, `packages/domain`, 100% coverage per the enforced `c8` gate): `post-scraper-adapter.test.ts`, `merge-post-image-urls.test.ts`, `transient-vendor-failure.test.ts`.
- [ ] Integration tests (required, real local Postgres, fake vendors, no vendor call): `post-scraper`, `brightdata-post-adapter`, the Apify post adapter, `record-job-attempt`, the quota memory in `usage-store`, the classifier table test, the env and stack tests.
- [ ] E2E tests: not applicable.

## Deliverables Checklist

- [ ] `post-scraper-adapter`, `merge-post-image-urls`, `transient-vendor-failure` in `packages/domain`, exported, 100% covered.
- [ ] `brightdata-post-adapter`, the Apify post adapter, `post-scraper`, `record-job-attempt`, the shared classifier in use at all three sites.
- [ ] `capacity_exhausted_until` column, migration applied locally, `markProviderCapacityExhausted` and the changed `isProviderCapacityAvailable`.
- [ ] `POST_SCRAPER_PROVIDER_ORDER` in `env.ts`, `.env.example` and the CDK stack.
- [ ] AD-53, `architecture-diagram.md`, `high-level-overview.md`, backlog rows FIND-082 and IDEA-101 updated.
- [ ] All new tests passing; `pnpm build` and `pnpm lint` clean.

## Out of Scope

- Adopting the chain in any production caller (`start-post-reextraction-preview.ts`, `resume-stalled-chains.ts`, extract-by-URL): Stories 10.5 to 10.10.
- Late Bright Data snapshot results and the wait for a snapshot that outlives the budget (IDEA-102): Story 10.5.
- A contributed (user-owned) key and whose credential a job uses (OI-3): Story 3-4b; this story only ships the seam.
- Changing the profile chain or its order (`PROFILE_SCRAPER_PROVIDER_ORDER` stays `apify,brightdata`).
- Measuring a real Bright Data post snapshot (no vendor call from a build session).
- Twitter or other platforms' second provider: a chain of one only.

## Definition of Done

- [ ] AC 1-9 satisfied.
- [ ] All new unit, integration and infra tests passing, including the classifier table test.
- [ ] `pnpm lint` and `pnpm build` passing for `packages/domain`, `packages/database`, `apps/backend`, `apps/infrastructure`.
- [ ] Migration generated with a correct, non-colliding number (re-verified against `origin/master` immediately before generation) and applied locally.
- [ ] `docs/infrastructure/architecture-diagram.md`, `high-level-overview.md` and AD-53 updated in the same change.
- [ ] Pre-Coding Approval Gate explicitly approved by the user before implementation begins.

## Completion Status

- [ ] Not started
- Creation note (2026-11-11): created after the owner decided OI-1 (default post order `brightdata,apify`). Two ideas absorbed from the board (IDEA-101 quota memory, FIND-082 shared classifier). One assumption flagged for acknowledgement: the Bright Data post snapshot duration.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5 (cloud session; built on branch `feat/epic-10-next` from master after PR #224).

### Debug Log References

- Pre-Coding Approval Gate: the user asked in conversation to "create and build Story 10.2 now" after deciding OI-1 (default order `brightdata,apify`), so the Gate's approval boxes are left for the user to tick. **Open flag, not resolved here:** `BRIGHTDATA_POST_MIN_BUDGET_MS` (90 s) is a guess; read the first real run's `job_attempts.elapsed_ms` and tune it. No vendor call was made at any point.
- Two parallel-suite interferences found and fixed while building: (1) the quota-memory write touches the shared real `apify` usage row, so it is a test seam (`setRememberExhaustedCapacity`) stubbed in the five suites that provoke Apify's monthly-limit refusal; (2) a circular import (`post-scraper` to `record-job-attempt` to `instagram-adapter` to `post-scraper`) would have read the adapter registry before it existed, so the registry is a leaf module and the attempt writer classifies by a domain base class.

### Completion Notes List

- **Domain (Task 1).** `post-scraper-adapter.ts` (chain, `parsePostScraperOrder` with default `brightdata,apify`, `PostScraperBudgetError`, `PostUnavailableError`, `PostScrapeCredential`), `merge-post-image-urls.ts` (`buildPostImageUrls`, built on the existing `dedupeImageUrlsByFileName` of BUG-101), `transient-vendor-failure.ts`. 100% coverage kept.
- **Quota memory (Tasks 2 and 3).** One nullable column (`capacity_exhausted_until`, migration 0102), `markProviderCapacityExhausted`, read by `isProviderCapacityAvailable` (so the daily batch benefits, IDEA-101), cleared on cycle rollover. It stores the end of OUR usage cycle (`SCRAPER_USAGE_CYCLE_DAYS`, 30), not Apify's billing date (the 23rd), so it can over-skip Apify for part of a month; acceptable because Apify is now the failover, noted in AD-53 Rule 15.
- **Shared classifier (Task 4).** All three classifiers keep their names and error-class checks and call `isTransientVendorFailure`; a table test proves identical results for every status and code (FIND-082).
- **Adapters (Task 5).** `scrapeBrightDataPost` shares one dataset-scrape routine with the profile scrape (profile tests unchanged); `brightDataPostAdapter`; `apifyPostAdapter` over an extracted `fetchApifyPost` (`getPostByUrl` behaviour unchanged for today's callers). Both mappers go through `buildPostImageUrls`; an old Bright Data mapper test that DOCUMENTED the cover being repeated as a slide was changed to the new rule (it recorded the very bug this story fixes).
- **Decisions beyond the story text (reviewer, please look at these).**
  1. *Only an explicit `error: 'not_found'` is a chain answer for Apify.* `isNotFoundItem`'s fallback heuristic (an item missing a caption or a timestamp counts as "not found") would stop the chain on an unreadable item; for the chain such an item throws so Bright Data or the next provider is tried. `getPostByUrl` keeps its old null.
  2. *Twitter has no chain.* The story said "a chain of one", but the Twitter adapter is entirely unimplemented (it throws); `fetchScrapedPost` falls through to the platform's own adapter for any non-Instagram platform.
  3. *The registry is `post-scraper-registry.ts`* (a leaf module) and `post-scraper.ts` imports `instagram-adapter.ts` for its registration side effect, like the profile chain.
  4. *`providerOverQuota` is a seam* in `post-scraper.ts` (default: the usage store inverted) so a test never writes the shared usage rows.
  5. *`scraper_actor_run_id` is left null on attempt rows* for now: the sync Bright Data path creates no `scraper_actor_runs` row, and linking the Apify sync run is Story 10.5's job (late results).
  6. *Not-found is recorded SUCCEEDED with reason `POST_NOT_FOUND`* (the vendor answered).
- **Tests.** Domain 1715 passing, 100% coverage. Backend real-Postgres suites with fake vendors: `post-scraper`, `brightdata-post-adapter`, `brightdata-post-scrape` (client), `record-job-attempt`, the quota-memory cases in `usage-store`, the Apify post adapter cases in `instagram-adapter`, the cross-classifier table `transient-classifiers`, the env and stack tests (`POST_SCRAPER_PROVIDER_ORDER` reaches the Scraper Lambda only when set).
- **Independent code review (before the PR).** An adversarial review found and I fixed: (1) the Apify chain call turned its 20 s timeout into `null` ("post not found") and stopped the chain, now it throws `ApifyRequestTimeoutError` bounded by the chain's remaining budget; (2) a remembered cap would have made every queued scrape meet the capacity gate and be redelivered into the DLQ, so `processScrapeJob` now drops `ScraperCapacityExceededError` with one warning like the monthly-limit error; (3) the marker followed OUR cycle and could lock Apify out for a month past its real reset, so it is capped at three days; (4) the degraded-provider gate (AC1) was missing, added as a chain skip (`degraded`); (5) a stray duplicate lint directive in `env.ts` (an unused-directive error); (6) a throwing skip check now fails open; (7) an all-skipped chain no longer logs "failed on every provider"; (8) a Bright Data adapter test no longer writes an exhausted shared usage row. Accepted and documented: `POST_SCRAPER_PROVIDER_ORDER` only on the Scraper Lambda (where the chain runs); `PostScraperBudgetError` must join `isPreVendorCallFailure` when callers adopt the chain (AD-53 Rule 15); a degraded `probe` claim is not released if the call then fails before reaching the vendor (the probe window expires on its own).
- **Not done here (by design).** No production caller adopts the chain; no UI; the contributed-key credential (Story 3-4b) and late Bright Data results (Story 10.5) are out of scope.

### File List

Added: `packages/domain/src/scraper/{post-scraper-adapter,merge-post-image-urls,transient-vendor-failure}.ts` and their `.test.ts`; `packages/database/migrations/0102_scraper_provider_capacity_exhausted_until.sql` and `meta/0102_snapshot.json`; `apps/backend/src/lib/scraper/{post-scraper,post-scraper-registry,brightdata-post-adapter}.ts` and tests `post-scraper`, `brightdata-post-adapter`, `brightdata-post-scrape`; `apps/backend/src/lib/job-engine/record-job-attempt.ts` and `.test.ts`; `apps/backend/src/lib/vendor-gateway/transient-classifiers.test.ts`.

Changed: `packages/domain/src/scraper/index.ts`; `packages/database/schema.ts`, `migrations/meta/_journal.json`; `apps/backend/src/lib/scraper/{usage-store,brightdata-client,brightdata-record-mapper,instagram-adapter,trigger-apify-for-target}.ts`; `apps/backend/src/lib/ai-gateway/gemini-client.ts`; `apps/backend/src/env.ts`; tests `usage-store`, `brightdata-record-mapper`, `instagram-adapter`, `trigger-apify-for-target`, `call-apify-actor`, `process-scrape-job`, `profile-scraper`, `extraction/start-post-reextraction-preview`, `env`; `apps/infrastructure/lib/festgrid-backend-stack.ts` and its test; `.env.example`; `docs/infrastructure/architecture-diagram.md`, `high-level-overview.md`; `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-53 Rule 15); this story and `sprint-status.yaml`.

### Change Log

- 2026-11-11: Story 10.2 built: the post-scraper provider chain (default `brightdata,apify`), Bright Data and Apify post adapters, one `job_attempts` row per provider considered, the remembered Apify monthly cap (migration 0102), the shared transient-error rule, and the cover-never-in-slides rule; AD-53 Rule 15 added.
