# Story 3.4p: Fix daily-batch scrape-scheduling race that silently skips accounts

## Story Details

- Epic: 3
- Story ID: 3.4p
- Status: ready-for-dev

## Story

As a platform operator,
I want `getBatchScrapeTargets()`'s "already recently scraped" skip check to keep a real safety margin below the daily `ScraperScheduleRule`'s ~24h cadence,
so that a subscribed account is never silently skipped for an entire extra day (and its posts left unscraped for up to ~48h) purely because the account's own `lastScrapedAt` completion timestamp happened to land within a few hours of the next day's fixed schedule fire time.

## Acceptance Criteria

1. **Given** `getBatchScrapeTargets()` ([get-scrape-targets.ts:16-34](apps/backend/src/lib/scraper/get-scrape-targets.ts#L16-L34)) selects accounts where `lastScrapedAt` is null or `< now - SCRAPE_SKIP_RECENT_HOURS`, **when** the prod `ScraperScheduleRule` (EventBridge, `rate(1 day)`, firing at a fixed wall-clock time each day — confirmed in prod: ~03:13:37 UTC on 2026-09-01/02) runs, **then** an account whose previous scrape completed anywhere up to several hours after the *previous* day's fixed fire time must still be selected by *this* day's fire — not excluded by a razor-thin margin against the rolling skip window.
2. **And** the fix accounts for `lastScrapedAt` being stamped asynchronously, at webhook-completion time ([process-apify-async-result.ts:47](apps/backend/src/lib/scraper/process-apify-async-result.ts#L47), [process-brightdata-result.ts:43](apps/backend/src/lib/scraper/process-brightdata-result.ts#L43)) — hours after the schedule actually fires, depending on vendor actor-run duration (both vendors' own job-expiry default is 180 minutes/3h: `BRIGHTDATA_JOB_TIMEOUT_MINUTES`/`APIFY_JOB_TIMEOUT_MINUTES`) — not at daily-dispatch time.
3. **And** `SCRAPE_SKIP_RECENT_HOURS`'s effective value is lowered to **12 hours** (confirmed with the user via `AskUserQuestion` — a real safety margin below the ~24h schedule cadence, not a structural redesign of the eligibility check) and pinned as an **explicit CDK-wired environment variable** on `scraperLambda` in `festgrid-backend-stack.ts` — today it is unset in prod, silently relying on `env.ts`'s in-code default of `20`, invisible to anyone reading the infrastructure stack.
4. **And** a regression test in `get-scrape-targets.test.ts` reproduces the exact drift scenario found in prod: an account whose `lastScrapedAt` lands within `[24h − 12h]` (i.e. 12-24h ago) of "now" must still be included; an account scraped within the last 12h must still be excluded (no regression toward redundant same-day re-scrapes); an account scraped exactly at the old 20h boundary (the actual prod incident's margin) must now clear the new 12h cutoff comfortably.

## Tasks / Subtasks

- [ ] Task 1: Lower the skip-window default and pin it explicitly in prod (AC: #3)
  - [ ] `apps/backend/src/env.ts`: change the default in `scrapeSkipRecentHours: parseInt(process.env.SCRAPE_SKIP_RECENT_HOURS || '20', 10)` ([env.ts:143](apps/backend/src/env.ts#L143)) to `'12'`.
  - [ ] `apps/infrastructure/lib/festgrid-backend-stack.ts`: add `SCRAPE_SKIP_RECENT_HOURS: process.env.SCRAPE_SKIP_RECENT_HOURS || '12'` to `scraperLambda`'s `environment` block ([festgrid-backend-stack.ts:292-306](apps/infrastructure/lib/festgrid-backend-stack.ts#L292-L306)), matching the pattern already used for `UNPROCESSED_PAYLOAD_RETENTION_DAYS`/`SCRAPE_IN_PROGRESS_TIMEOUT_HOURS` on the neighboring Lambda — so the effective value is visible in the stack definition, not just a code fallback.
  - [ ] `.env.example`: add `SCRAPE_SKIP_RECENT_HOURS=12` with a one-line comment referencing this story's margin rationale (Dev Notes below).
  - [ ] `apps/infrastructure/lib/festgrid-backend-stack.test.ts`: add/update an assertion that `scraperLambda`'s environment includes `SCRAPE_SKIP_RECENT_HOURS: '12'`.

- [ ] Task 2: Regression test reproducing the prod drift scenario (AC: #1, #2, #4)
  - [ ] `apps/backend/src/lib/scraper/get-scrape-targets.test.ts`: add cases — (a) `lastScrapedAt` 13h ago → included; (b) `lastScrapedAt` 11h ago → excluded; (c) `lastScrapedAt` exactly 20h ago (the actual prod incident value that used to sit right at the old cutoff) → included under the new 12h window with clear margin, asserting the specific regression this story fixes.

- [ ] Task 3: `pnpm build`, `pnpm lint`, `pnpm test` at the repo root — no regressions.

## Dev Notes

### Architecture & UX Gate Findings

`epic-3-readiness.md`'s sweep (`swept: true`, 2026-08-09) lists `3.4`/`3.4a` in `stories_covered`, confirming the underlying batch/schedule/async-vendor architecture (EventBridge + Lambda + SQS + Bright Data/Apify pending-job tables) is already fully provisioned — this story changes zero infrastructure shape, only a config value and a test. Per `story-split-gate.md`'s lightweight-guard allowance, no subagent Gate 1/2/3 calls were run for this story; reasoning below is recorded directly instead of re-deriving an already-settled "no gap" conclusion:

- **Gate 1 (Architecture/Infrastructure Completeness): No gap found.** No new Lambda, queue, table, or API surface — a config-value change (env var default + explicit CDK wiring) plus a regression test against existing code.
- **Gate 2 (UI Complexity & Reusability): No gap found.** Zero UI surface — no GraphQL fields/resolvers, no `apps/web` change. A `design-artifacts/` check (matching Story 3.4/3.4a/3.4f's own confirmed precedent) found no UX spec touching any part of the scraping pipeline.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness): No gap found.** Nothing here is a shared dependency other stories/epics would need — `SCRAPE_SKIP_RECENT_HOURS` has exactly one consumer (`getBatchScrapeTargets`).
- **One real, non-mechanical tradeoff was resolved with the user via `AskUserQuestion` before drafting:** whether to (a) simply widen the safety margin (lower the skip window well below the schedule cadence), or (b) structurally redesign eligibility around a per-account "scraped today" calendar-day bucket instead of a rolling hours-ago window (which would eliminate this entire race class rather than just shrink its probability), or (c) both. The user chose (a) only — see "Deferred Structural Alternative" below and Out of Scope.

### Root Cause (found during a live production incident investigation, 2026-09-03, via `/bmad-help`)

Confirmed directly against prod CloudWatch logs (`/aws/lambda/FestgridBackendStack-prod-ScraperLambdaprodF94C650-iMFmm3gJwPEO`) and the production database (read-only queries against `festgrid-database-url-prod`):

- The prod `ScraperScheduleRule` fires once daily at a fixed wall-clock time: `2026-09-01T03:13:37.404Z` → "Found 8 distinct targets to scrape"; `2026-09-02T03:13:37.397Z` → "Found 5 distinct targets to scrape" (down from 8).
- Account `plazaambarrukmo` (profile id `26d26dc2-95f8-4fc7-8e5f-6b32dda7ebb7`) was scraped via Apify async completion at `2026-09-01 07:13:37.672 UTC` (webhook landed ~4h after that day's dispatch — normal Apify actor-run duration).
- On 2026-09-02's run, cutoff = `2026-09-02 03:13:37.397 − 20h = 2026-09-01 07:13:37.397`. The account's `lastScrapedAt` (`07:13:37.672`) landed **~275ms after** that cutoff — failing `lt(lastScrapedAt, cutoff)` by a razor-thin margin and silently dropping the account from that day's batch, with no error logged anywhere (this is expected, correct behavior of the *current* code — not a crash, just a design gap).
- Net effect: the account's next real scrape was pushed to 2026-09-03's run (~2 days after its last real scrape instead of ~1), and a real Instagram post published in the skipped window sat unscraped for the extra day.

### Margin Rationale (12h chosen)

Schedule cadence is ~24h (`events.Schedule.rate(cdk.Duration.days(1))`, [festgrid-backend-stack.ts:367](apps/infrastructure/lib/festgrid-backend-stack.ts#L367)). Both vendors' own async-job expiry default is 180 minutes (3h) before the stale-job sweep gives up and falls back — so worst-case webhook-completion drift from the nominal dispatch time is bounded well under that. A 12h skip window leaves roughly 12h of slack against the 24h cadence even in a worst-case multi-hour completion delay, compared to the previous 20h default's ~4h margin (which the prod incident showed is not enough). 12h is deliberately not pushed lower still, to avoid the opposite failure mode (an account whose dispatch itself is delayed getting excluded from its own day's run).

### Deferred Structural Alternative (considered, explicitly not built)

A per-account "last scraped calendar date" (UTC day-bucket) check instead of a rolling hours-ago comparison would eliminate this race class entirely rather than reduce its probability, but is a larger change (new column/logic, and needs care around how it interacts with on-demand/backfill scrapes that also stamp `lastScrapedAt`, and timezone-boundary edge cases). The user explicitly chose the smaller, lower-risk margin-widening fix for this story and deferred the structural alternative — see Out of Scope.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: No changes required.** This story changes an environment variable's default value and adds one explicit CDK environment-variable wiring; no schema, API contract, or TypeScript type is touched.
- **Verification checks:** `get-scrape-targets.test.ts`'s new regression cases (Task 2); `festgrid-backend-stack.test.ts`'s new environment-variable assertion (Task 1).

### Project Structure Notes

- Modified: `apps/backend/src/env.ts`, `apps/infrastructure/lib/festgrid-backend-stack.ts` (+`.test.ts`), `.env.example`, `apps/backend/src/lib/scraper/get-scrape-targets.test.ts`.
- Not modified: `get-scrape-targets.ts`'s query logic itself (the `lt`/`isNull` comparison shape is correct and unchanged — only the threshold value moves); any other scraper module; any `.graphql` file; `apps/web`.

### References

- [Source: apps/backend/src/lib/scraper/get-scrape-targets.ts, get-scrape-targets.test.ts] — read in full; the exact eligibility check this story tunes.
- [Source: apps/backend/src/lib/scraper/process-apify-async-result.ts, process-brightdata-result.ts] — confirmed `lastScrapedAt` stamping happens at webhook-completion time, not dispatch time.
- [Source: apps/backend/src/env.ts#L143, #L151] — `SCRAPE_SKIP_RECENT_HOURS` default (20 → 12), `BRIGHTDATA_JOB_TIMEOUT_MINUTES`/`APIFY_JOB_TIMEOUT_MINUTES` defaults (180) informing the margin rationale.
- [Source: apps/infrastructure/lib/festgrid-backend-stack.ts#L287-L307, #L366-L369] — `scraperLambda`'s environment block and `ScraperScheduleRule`'s `rate(1 day)` schedule.
- [Source: live prod CloudWatch logs, `/aws/lambda/FestgridBackendStack-prod-ScraperLambdaprodF94C650-iMFmm3gJwPEO`, queried directly 2026-09-03] — "Found N distinct targets to scrape" / "Successfully dispatched all N scrape jobs" lines for 2026-09-01 and 2026-09-02, establishing the exact schedule fire times and the 8→5 target-count drop.
- [Source: live prod database, `festgrid-database-url-prod`, queried directly 2026-09-03 (read-only)] — `social_media_account_profiles`/`apify_pending_jobs` rows for `plazaambarrukmo`, establishing the exact `lastScrapedAt` timestamp and the missing 2026-09-02 job.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — Gate 1/2/3 lightweight-guard reasoning (no subagent calls needed; see Architecture & UX Gate Findings).

## Global Rules References

- [x] `_bmad-output/project-context.md` — Security ("Resilient Processing Pipeline" — this story doesn't touch queue decoupling, only the batch-selection threshold feeding into it); Credential Management (not applicable — no secret involved, plain config value).
- [x] `story-content-structure.md` — canonical section order followed.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no AD applies; no new GraphQL surface, soft-deletable entity, or query DSL usage.
- [x] `docs/infrastructure/index.md`, `2-backend.md` — read; this story doesn't change the pipeline's shape (EventBridge → Lambda → SQS → vendor), only a tunable threshold already documented as configurable.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **Modified:** `apps/backend/src/env.ts` (default `20` → `12`); `apps/infrastructure/lib/festgrid-backend-stack.ts` + `.test.ts` (explicit `SCRAPE_SKIP_RECENT_HOURS` env wiring on `scraperLambda`); `.env.example`; `apps/backend/src/lib/scraper/get-scrape-targets.test.ts` (new regression cases).
- **Not modified:** `get-scrape-targets.ts` itself (query shape unchanged); any other scraper module, Lambda, or infrastructure resource.

### Rule Mapping

- Config visibility (infra-as-code) → this story's own finding (the value was previously an invisible code-only default) → Task 1's explicit CDK environment-variable wiring.
- Reuse over reinvention → `story-split-gate.md` → no new mechanism introduced; the fix stays within the existing `getBatchScrapeTargets`/`env.ts` shape.
- User-confirmed design decision (margin-widening over structural day-bucket redesign) → `AskUserQuestion` record (this story's own creation, 2026-09-03) → Task 1/2 scope; the deferred alternative recorded under Out of Scope.

### Verification Plan

- `apps/backend/src/lib/scraper/get-scrape-targets.test.ts`: new regression cases per Task 2 — the highest-value verification in this story, directly reproducing the prod incident's exact timing.
- `apps/infrastructure/lib/festgrid-backend-stack.test.ts`: new assertion for `scraperLambda`'s `SCRAPE_SKIP_RECENT_HOURS` environment value.
- `pnpm build`, `pnpm lint`, `pnpm test` (root): full suite, no regressions.
- **Manual, post-deploy verification (not automatable):** confirm in prod CloudWatch that the next few days' "Found N distinct targets to scrape" line does not show an unexplained drop for accounts whose prior scrape completed close to the schedule's fixed fire time.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: this story lowers `SCRAPE_SKIP_RECENT_HOURS`'s effective default from 20h to 12h, pins it as an explicit CDK-wired env var on `scraperLambda`, and adds a regression test reproducing the exact prod drift scenario. It does not change `getBatchScrapeTargets()`'s query logic/shape, and does not build the alternative "scraped-today date bucket" design (explicitly deferred by the user).
- [ ] Architecture and boundary confirmation: no new infra, table, or API surface; a config-value change plus a CDK environment-variable addition, entirely within `apps/backend`/`apps/infrastructure`.
- [ ] Testing plan confirmation: new regression cases in `get-scrape-targets.test.ts` per Task 2; new environment-variable assertion in `festgrid-backend-stack.test.ts`.
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: all three gates evaluated via lightweight guard (no subagent calls) — no gap found on any (see Dev Notes "Architecture & UX Gate Findings"); the epic-3 readiness sweep already covers the underlying architecture this story merely tunes.
- [ ] Explicit human approval state (Default: **pending approval**).

## Testing Requirements

- [ ] `apps/backend/src/lib/scraper/get-scrape-targets.test.ts` (existing, extended): 13h-ago-included, 11h-ago-excluded, and the exact-prod-incident-value (20h-ago, now comfortably included under the new 12h window) cases.
- [ ] `apps/infrastructure/lib/festgrid-backend-stack.test.ts` (existing, extended): `scraperLambda` environment includes `SCRAPE_SKIP_RECENT_HOURS: '12'`.
- [ ] Integration/E2E: not required — no user-facing page/flow, matching Story 3.4/3.4a/3.4f's own precedent under the testing-trophy philosophy.

## Deliverables Checklist

- [ ] `env.ts`'s `SCRAPE_SKIP_RECENT_HOURS` default lowered to `12`.
- [ ] `festgrid-backend-stack.ts`'s `scraperLambda` gets an explicit `SCRAPE_SKIP_RECENT_HOURS` environment entry; stack test updated.
- [ ] `.env.example` documents `SCRAPE_SKIP_RECENT_HOURS=12` with the margin rationale.
- [ ] `get-scrape-targets.test.ts` covers the exact prod drift scenario as a regression case.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` green at the repo root.

## Out of Scope

- The structural "scraped-today calendar-day bucket" redesign that would eliminate this race class entirely rather than shrink its probability — considered and explicitly deferred by the user in favor of the smaller margin-widening fix (see Dev Notes "Deferred Structural Alternative"). If a future incident shows 12h is still insufficient, revisit this as its own story rather than re-tuning the constant again.
- Any change to how/when `lastScrapedAt` itself is stamped (webhook-completion time) — left exactly as-is; this story only changes how far back the eligibility check looks.
- Story 3.4a's separate, already-known open gaps (unwired `/webhooks/brightdata` route, orphaned Lambda constructs — see Story 3.4f's Dev Notes) — unrelated to this story's scope.

## Definition of Done

- [ ] All 4 Acceptance Criteria satisfied.
- [ ] `get-scrape-targets.test.ts` and `festgrid-backend-stack.test.ts` passing, including new cases.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` pass at the repo root with no regressions.
- [ ] Prod deploy confirmed to carry the explicit `SCRAPE_SKIP_RECENT_HOURS=12` environment value (visible via `aws lambda get-function-configuration` on `scraperLambda`, non-secret).

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
