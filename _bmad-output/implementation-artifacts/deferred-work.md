# Deferred Work

This file tracks work deferred from development stories, code reviews, and planning sessions.

## Deferred from: code review of 3-4k-moderator-actor-run-browser-and-replay-ui.md (2026-08-20)

- Actor-run cursor decoding accepts malformed base64/non-numeric values and can produce a `NaN` offset. Evidence: pre-existing Story 3-4j resolver at `apps/backend/src/schema/resolvers.ts:2839`; explicitly excluded from the 3-4k review-patch scope.
- Actor-run `createdBefore` filtering compares against midnight at the start of the selected date, so the UI's end-date filter is not inclusive for the whole day. Evidence: pre-existing Story 3-4j resolver at `apps/backend/src/schema/resolvers.ts:2857`; explicitly excluded from the 3-4k review-patch scope.
- The tracked root `.env` contains live-looking AWS, Firebase, Apify, Supabase, and other service credentials. Evidence: repository security issue observed during the 3-4k review; revoke and rotate all exposed credentials and remove the file from repository history before any production use. This is outside the Story 3-4k implementation diff.

## Deferred from: code review of 0-1-initialize-pnpm-monorepo.md (2026-07-22)

- Missing next-intl integration vs. project i18n constraint — The app layout and page currently hardcode English text, directly violating project-context.md general architecture rules 14 & 15. Deferred: To address i18n setup in a dedicated workspace setup story

## Deferred from: code review of 1-1-create-initial-database-tables.md (2026-07-27)

- Vague local Postgres instance setup — deferred, pre-existing

## Deferred from: quick-dev fix of enum i18n rendering (2026-08-01)

- source_spec: `_bmad-output/implementation-artifacts/spec-enum-i18n-eventcard-fix.md`
  summary: Discovery page (`apps/web/src/app/[locale]/page.tsx`) never resolves the active route locale and never passes it as the `locale` prop to `EventCard`, so dates always render formatted as `en-US` regardless of whether the user is on `/en/` or `/id/`.
  evidence: Pre-existing — `EventCard`'s `locale` prop and its `en-US` default predate this change; `page.tsx` never wired it up. Surfaced by adversarial review while fixing the related enum-translation bug and documenting the "Locale-Sensitive Data Rendering" rule in project-context.md, which now covers dates too.
  **RESOLVED (2026-08-01):** Added a `ScopedLocaleProvider`/`useScopedLocale`/`useScopedTimezone` scoped context to `packages/ui` (see `packages/ui/src/hooks/useScopedLocale.tsx`); `apps/web/src/app/[locale]/layout.tsx` now wraps `<AppShell>` in `<ScopedLocaleProvider locale={...}>` using the resolved route locale (mapped to a region-qualified BCP-47 tag), so `EventCard` (and future locale-aware components) inherit the active locale without per-call-site prop drilling. Verified via unit tests of the context primitive and `EventCard` (`packages/ui`); **not yet verified by an integration/E2E test exercising the real `layout.tsx` → `page.tsx` → `EventCard` wiring** — see the new deferred item below. See `spec-locale-scoped-context.md`.
- source_spec: `_bmad-output/implementation-artifacts/spec-locale-scoped-context.md`
  summary: No integration or E2E test proves the route locale actually flows `layout.tsx` → `ScopedLocaleProvider` → `AppShell` → `EventCard` in the real app; the "RESOLVED" claim above rests on unit tests of the primitive against a hand-built provider, not the real component tree. `layout.tsx` is an async Server Component with no existing test precedent in this codebase (no `layout.test.tsx` exists for any route).
  evidence: Surfaced by adversarial review. A Playwright E2E case (switch locale, assert displayed date format changes) is the natural fit per the project's "testing trophy" philosophy — critical flows only — rather than a mocked Server Component unit test.
- source_spec: `_bmad-output/implementation-artifacts/spec-locale-scoped-context.md`
  summary: `EventCard` is a `'use client'` component but is still server-rendered for the initial HTML in the Next.js App Router. No app-wide `timezone` is sourced at `layout.tsx` yet, so `Intl.DateTimeFormat` omits `timeZone` and falls back to the host's local timezone — the server process's timezone during SSR vs. the browser's local timezone during hydration. If these differ, dates could hydration-mismatch on every card.
  evidence: Pre-existing risk (already true before `useScopedTimezone` was added, since `EventCard` never passed `timeZone` before either) but now more directly relevant since this change adds the timezone plumbing without wiring a real value at the app root. Surfaced by adversarial review.
- source_spec: `_bmad-output/implementation-artifacts/spec-enum-i18n-eventcard-fix.md`
  summary: `EventCategory`/`EventType` are hand-maintained in two independent places — `packages/shared-types/src/index.ts` and the GraphQL-codegen'd enum in `apps/web/src/generated/graphql.ts` — with nothing enforcing they stay in sync (a new enum member could silently fall back to raw display if `shared-types` lags codegen).
  evidence: Pre-existing architecture gap, unrelated to the translation-label fix itself; surfaced by adversarial review.
- source_spec: `_bmad-output/implementation-artifacts/spec-enum-i18n-eventcard-fix.md`
  summary: No mechanism (lint rule, codegen step, or test) keeps `EventCategory`/`EventType` members in sync across all four sources: `packages/shared-types`, `apps/web/locales/en.json`, `apps/web/locales/id.json`, and `generated/graphql.ts`. A new locale-parity test (`apps/web/locales/locales.test.ts`) now guards en.json↔id.json parity only.
  evidence: Broader than the current fix's scope; surfaced by adversarial review.
- source_spec: `_bmad-output/implementation-artifacts/spec-enum-i18n-eventcard-fix.md`
  summary: Pairing the translated "From"/"Mulai dari" price label with free-text `ticketPrice` values like `"Free"` (yielding "From  Free") was not reconsidered — may need a product decision on when to show/hide the price-from label based on value.
  evidence: Pre-existing UX question about `ticketPrice` display, not introduced by the label-translation fix; surfaced by adversarial review.

## Deferred from: quick-dev addition of RELIGION_AND_SPIRITUALITY category (2026-08-01)

- source_spec: none
  summary: `apps/backend`'s own GraphQL codegen (`apps/backend/codegen.ts`) generates the `Resolvers` type from a stub `src/schema/typeDefs.graphql` (`type Query { health: Boolean! }`), not from the real schema files under `src/schema/` (e.g. `events.graphql`) that are loaded separately at runtime via `readdirSync` in `server.ts`. Combined with `useIndexSignature: true` in that codegen config (which adds a catch-all index signature suppressing excess-property checks), `resolvers.ts` gets zero compile-time verification against the actual runtime schema — a typo'd or removed field/enum value in `events.graphql` would not be caught by `tsc`.
  evidence: Pre-existing architecture gap, unrelated to the category addition itself; surfaced by adversarial review while adding `RELIGION_AND_SPIRITUALITY` to `events.graphql`.
- source_spec: none
  summary: No test asserts that the backend's runtime-merged GraphQL schema (all `*.graphql` files under `src/schema/`, string-concatenated in `server.ts`) actually parses/builds successfully, or that a query touching a given `EventCategory` value round-trips end to end.
  evidence: Pre-existing test-coverage gap, not specific to this change; surfaced by adversarial review while adding `RELIGION_AND_SPIRITUALITY`.
- source_spec: none
  summary: This change is the first migration in the repo to add a value to an existing Postgres enum via `ALTER TYPE ... ADD VALUE` (previous category/type values were all part of the initial `CREATE TYPE` in `0000_cultured_ultragirl.sql`). Postgres has no `ALTER TYPE ... DROP VALUE` — once applied, removing or renaming `RELIGION_AND_SPIRITUALITY` requires recreating the whole `event_category` type and repointing every dependent column. No process doc currently flags this one-way-door risk for future enum additions.
  evidence: Inherent Postgres limitation, not a defect in this change; noted by adversarial review since this is the first migration of this kind in the repo.

## Deferred from: code review of 1-2a-create-posts-table-and-link-seeded-events-to-their-source-post.md (2026-08-03)

- Extra changes (generateSlug using crypto, RELIGION_AND_SPIRITUALITY) in the diff baseline. Pre-existing changes from other commits on master.

## Deferred from: quick-dev fix of missing-platform-field-in-post-inserts (2026-08-19)

- source_spec: `_bmad-output/implementation-artifacts/spec-fix-missing-platform-field-in-post-inserts.md`
  summary: `mapApifyItemToScrapedPost()` in process-apify-async-result.ts is called without await, causing the result to be a Promise instead of a ScrapedPost object.
  evidence: Pre-existing bug in line 16 of process-apify-async-result.ts. The check 'if (!post)' on line 17 will always be false (Promises are truthy), causing validation failures to be silently ignored. Surfaced by code review of the platform-field fix.

- source_spec: `_bmad-output/implementation-artifacts/spec-fix-missing-platform-field-in-post-inserts.md`
  summary: instagram-adapter.ts line 234 uses AND logic ('if (!item.caption && !item.timestamp)') instead of OR to validate posts, allowing incomplete posts with either field missing to pass through.
  evidence: Pre-existing bug. According to the comment, both caption AND timestamp are required, but AND logic only detects missing posts when BOTH are absent. A post with caption but no timestamp passes through as valid despite violating the schema. Surfaced by code review.

- source_spec: `_bmad-output/implementation-artifacts/spec-fix-missing-platform-field-in-post-inserts.md`
  summary: instagram-adapter.ts line 238 uses AND logic ('if (!item.fullName && !item.biography)') instead of OR to validate profiles, allowing incomplete profiles with either field missing to pass through.
  evidence: Pre-existing bug. Valid profiles require both fullName AND biography, but AND logic only detects missing profiles when BOTH are absent. A profile with only one field passes through as valid, allowing malformed data into the database. Surfaced by code review.

- source_spec: `_bmad-output/implementation-artifacts/spec-fix-missing-platform-field-in-post-inserts.md`
  summary: instagram-adapter.ts line 300 calls recordProviderUsage with items.length instead of mappedPosts.length, counting unfiltered items including those that failed validation.
  evidence: Pre-existing bug. The mappedPosts array (line 297) contains only successfully validated posts, but usage accounting counts all items in the unfiltered array. This inflates vendor usage metrics by billing for items that failed validation and were never persisted. Surfaced by code review.

- source_spec: `_bmad-output/implementation-artifacts/spec-fix-missing-platform-field-in-post-inserts.md`
  summary: process-brightdata-result.ts line 27 uses an unchecked type assertion ('as string') on brightDataRecord.date_posted, masking potential type mismatches with the API.
  evidence: Pre-existing pattern. If Bright Data API returns date_posted as a number (milliseconds) or null, the assertion hides the type mismatch. Line 36 passes this to new Date(), which may produce incorrect timestamps if the source data format changes. Surfaced by code review.

## Deferred from: root `pnpm lint` cleanup (2026-08-21)

- source_spec: none
  summary: `apps/backend` has 868 pre-existing lint warnings (mostly `@typescript-eslint/no-explicit-any`, plus a handful of `no-unused-vars` and `turbo/no-undeclared-env-vars`) spread across most of `src/` and `scripts/`, e.g. `src/env.ts`, `src/lambdas/*.ts`, `src/webhook-dev-server.ts`. `apps/backend/package.json`'s `lint` script had `--max-warnings 0`, which made every `pnpm lint` (including at the repo root via turbo) fail on these pre-existing warnings even when a given change touched none of the affected files.
  evidence: Surfaced while fixing unrelated `no-explicit-any` warnings in `@festgrid/graphql-select` and `@festgrid/domain` flagged by the same root `pnpm lint` run; `apps/backend` has no uncommitted changes, so the 868 warnings are pre-existing debt, not a regression. `--max-warnings 0` removed from `apps/backend/package.json`'s `lint` script (2026-08-21) so root lint isn't blocked by this backlog; the underlying warnings still need to be worked through and `--max-warnings 0` restored once they're clear.

## Deferred from: quick-dev UI fixes batch (2026-08-28)

- source_spec: `_bmad-output/implementation-artifacts/spec-ui-quick-fixes-batch.md`
  summary: `persistScrapedPost` (`apps/backend/src/lib/posts/persist-scraped-post.ts:47-52`) returns an already-known post row unchanged on re-scrape, so `videoUrl` (and any other field added to the schema after a post's first scrape) never backfills — any post first persisted before `posts.video_url` existed (migration `0036`, 2026-08-25) has `video_url = NULL` permanently, even though a fresh scrape of the same URL today returns a populated `videoUrl`.
  evidence: Confirmed end-to-end (Instagram adapter → `posts.video_url` column → GraphQL resolver → `Event.videoUrl`) is wired correctly for any post persisted after the column/adapter mapping shipped; the dedupe short-circuit is explicit, intentional, and tested (`persist-scraped-post.test.ts:46-67`, comment: "updated content should be ignored as row is returned unchanged"), so this isn't a simple one-line fix — a real fix needs a decision on whether to (a) add a narrow update path in `persistScrapedPost` for null media fields specifically, without risking overwriting human/AI-corrected data on other fields, or (b) run a one-off backfill job re-fetching/replaying already-persisted posts. Surfaced by the user while dev-testing the `ui-quick-fixes-batch` branch, on a real post (`Dci_mTlzRE8`) with a populated `videoUrl` in the raw Apify payload but null in the app. Also noted in Story 3-3a's Dev Agent Record (`_bmad-output/implementation-artifacts/3-3a-create-posts-table-and-persist-scraped-posts.md`) since that's where `persistScrapedPost`'s dedupe behavior was originally implemented.

## Deferred from: quick-dev fix of posts-videourl-originalposturl-passthrough (2026-08-28)

- source_spec: `_bmad-output/implementation-artifacts/spec-posts-videourl-originalposturl-passthrough.md`
  summary: The Bright Data raw-record→`ScrapedPost` mapping (URL/caption/date extraction, `videos` array extraction, candidate construction, AJV validation) is implemented twice — once in `process-brightdata-result.ts`, once in `replay-actor-run.ts`'s Bright Data branch — with no shared helper.
  evidence: Pre-existing duplication (already true for the URL/caption/date/imageUrl mapping before this change); this fix necessarily extended both copies in parallel to add `videoUrl`/`originalPostUrl` extraction, since a shared helper didn't already exist and introducing one was out of scope for a narrow field-passthrough fix. Surfaced by adversarial review of this change, which also flagged the two copies already beginning to diverge in how they handle a malformed `date_posted` value. A future story should extract a single `mapBrightDataRecordToScrapedPost()` used by both call sites.

- source_spec: `_bmad-output/implementation-artifacts/spec-posts-videourl-originalposturl-passthrough.md`
  summary: **Significant, likely production-impacting:** `apps/backend`'s `test` script (`"test": "cross-env NODE_ENV=test tsx --test --test-concurrency=1 src/**/*.test.ts"`) does not actually reach test files nested two or more directories under `src/` — e.g. every file under `src/lib/scraper/` and `src/lib/posts/` (20 files, including `persist-scraped-post.test.ts`, `process-brightdata-result.test.ts`, `process-apify-async-result.test.ts`, `scraper-actor-run-linking.test.ts` — all touched by this change). `pnpm test` reports "267 tests, 267 pass" while silently never executing any of them.
  evidence: Directly confirmed by planting a deliberate `assert.strictEqual(1, 2)` failure inside `persist-scraped-post.test.ts` and re-running `pnpm test` (via both this session's Bash tool and PowerShell) — the pass/fail counts (267/267/0) did not change at all, proving the file never ran. Invoking `tsx --test` on the same glob string directly (quoted, bypassing the package.json script) picks up a much larger and slower-running set of tests, confirming Node's own recursive glob resolution works correctly when it actually gets the unexpanded pattern — something in the `pnpm test` invocation path is pre-expanding `src/**/*.test.ts` non-recursively before tsx ever sees it. All verification in this change's own spec was instead done via explicit per-file `tsx --test <literal-path>` invocations, which do work correctly. This needs its own investigation (likely: quote the glob in package.json, or switch to a test runner with reliable recursive discovery) — a fix could surface a wave of previously-invisible failures across unrelated files, so it deserves a dedicated pass, not a drive-by fix. Worth flagging as urgent: if CI runs this same script the same way, a large fraction of this project's backend test suite may not be providing any actual coverage today.

- source_spec: `_bmad-output/implementation-artifacts/spec-posts-videourl-originalposturl-passthrough.md`
  summary: The `unprocessed_scraper_payloads.context` jsonb column is double-JSON-encoded on write — it stores a JSON string scalar (e.g. `"{\"source\":...}"`) rather than a JSON object, even though `persistUnprocessedPayload()` passes a plain JS object to drizzle. A naive `context->>'accountId' = ...` query matches zero rows against real data; unwrapping once via `(("context"#>>'{}')::jsonb)->>'accountId'` is required.
  evidence: Confirmed via a raw SQL probe (`select context, pg_typeof(context), context::text from unprocessed_scraper_payloads`) during this change: `pg_typeof` reports `jsonb`, but the column's text form is itself an escaped JSON string, not an object — a genuine driver/schema serialization bug, not a query-syntax mistake. `apps/backend/src/schema/resolvers.ts:2778` has an existing production filter (`context->>'source' = ...`) that queries this exact column the same single-level way — if all rows are double-encoded this way, that filter may always be silently matching zero rows in production. Worth an urgent, dedicated look: check whether `rawPayload` (same jsonb pattern in the same table) has the same issue, find why the driver double-encodes (likely something in `db/client.ts`'s postgres.js config, or the drizzle jsonb column type), and decide whether to fix at the source (write path) — which would also require a migration to un-double-encode existing rows — or normalize on every read/query site.

## Deferred from: quick-dev fix of seed script FK violation (2026-08-29)

- source_spec: `_bmad-output/implementation-artifacts/spec-fix-seed-brightdata-fk-violation.md`
  summary: `brightdata_pending_jobs.profile_id`/`apify_pending_jobs.profile_id` (and their `scraper_actor_run_id` FKs) are declared `ON DELETE no action` in the schema (`packages/database/migrations/0028_vengeful_silver_surfer.sql:24`), so any code path that deletes a `social_media_account_profiles` or `scraper_actor_runs` row directly (not through the seed script's hand-maintained delete order) will hit the identical FK violation this fix patches only for `seedDatabase()`.
  evidence: Surfaced by adversarial review of the seed-script fix. Root-caused via the migration file; out of scope for a one-shot fix to the seed script.
- source_spec: `_bmad-output/implementation-artifacts/spec-fix-seed-brightdata-fk-violation.md`
  summary: `seedDatabase()`'s cleanup transaction relies on a hand-maintained, manually-ordered list of `tx.delete(...)` calls with no automated check that the order matches the FK graph in `schema.ts` — this is the second time the list needed a reactive patch (the block comment used to say "these five," now a generic count) after a new table was added without updating deletion order. No generic/topological-sort delete mechanism exists to prevent a third recurrence.
  evidence: Surfaced by adversarial review. A generic fix (e.g. deriving delete order from `schema.ts`'s own `.references()` declarations, or a lint/test that fails when a new FK-bearing table is added without a corresponding seed cleanup entry) is a larger architectural change than this bug fix's scope.

## Deferred from: sprint-change-proposal-2026-08-28.md Items 1-2 implementation (2026-08-29, commit a0fc985)

- source_spec: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-28.md`
  summary: No email notification is sent to moderators when a new `AWAITING_APPROVAL` `DefaultLocationChangeRequest` is created (low-confidence AI-inferred location, FR94), unlike the existing "already applied, FYI" email sent for a `PENDING_REVIEW` item. A moderator only learns of it via the new Moderator Pending-Item Badge (FR96) — passive, not push — so a low-vigilance moderator could leave a subscriber's Default Location unset/stale for a while.
  evidence: `TODO(2026-08-28)` left in `apps/backend/src/lib/accounts/apply-default-location-change.ts:118-120`. Deliberately deferred rather than folded into this batch — a dedicated email needs new copy distinguishing "needs your decision" from the existing FYI template, a real (if small) product-copy decision out of scope for a direct PRD/schema amendment. Noted in the PRD's `.memlog.md` (`_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/.memlog.md`) but not previously logged here.

## Deferred from: quick-dev fix of scraper-provider-usage test pollution (2026-08-29)

- source_spec: none
  summary: Replace/augment the budget-threshold-based `isProviderCapacityAvailable()` in `apps/backend/src/lib/scraper/usage-store.ts` with real Apify account usage data from `GET https://api.apify.com/v2/users/me/limits`, persisting the response with a timestamp and refreshing it after every Apify call.
  evidence: Requested by the user while diagnosing a flaky `scraper_provider_usage` test-pollution failure (the immediate fix — hardening `trigger-apify-for-target.test.ts`/`instagram-adapter.test.ts`/`extraction.test.ts` cleanup — is test-only and zero blast radius). This is a separate, independently shippable production change: it needs a persistence shape for the limits snapshot, a policy for how "refresh after every call" interacts with rate-limiting Apify's own `/users/me/limits` endpoint (calling it synchronously on every scrape adds latency/API load), how it reconciles with or replaces the existing `monthlyBudgetUsd`/`pricePerThousandItemsUsd` threshold math, and error handling if that endpoint itself fails — real architectural decisions that don't belong in a one-shot fix. Split from the current intent per user's choice (2026-08-29): "A now, B via planning."

- source_spec: `_bmad-output/implementation-artifacts/spec-scraper-usage-test-isolation.md`
  summary: `trigger-apify-for-target.test.ts`'s `testProfileId = 'profile-' + Date.now()` (line 10, e.g. `"profile-1787978131157"`) is not a valid UUID, but `apifyPendingJobs.profileId` (`packages/database/schema.ts:70`) is a strict `uuid` column — every subtest in this file throws Postgres error `22P02 invalid input syntax for type uuid` from the shared `t.afterEach` hook's `db.delete(apifyPendingJobs).where(eq(apifyPendingJobs.profileId, testProfileId))`, regardless of what the subtest itself does.
  evidence: Confirmed pre-existing and unrelated to the scraper_provider_usage isolation fix in this same spec — the failing line (`testProfileId`) was untouched by this change, and the schema column has been `uuid`-typed independently. Discovered only because this fix required actually running this file directly with `tsx --test` against the real Postgres test DB; it very likely never runs under normal `pnpm test` at all due to the already-tracked glob bug (see the "quick-dev fix of posts-videourl-originalposturl-passthrough" entry above, 2026-08-28: `src/**/*.test.ts` doesn't reach files two-plus directories under `src/`, and this file lives at `src/lib/scraper/`) — which would explain why this has never been caught. Fix is presumably trivial (use `randomUUID()` like sibling test files do), but is out of scope for a one-shot isolation fix and should be verified/fixed together with a resolution of the glob bug, since fixing the glob bug alone would newly expose this failure (and possibly others) in CI.

## Deferred from: quick-dev UI fixes batch, ux-rework2 (2026-08-29)

- source_spec: `_bmad-output/implementation-artifacts/spec-ux-rework2-batch.md`
  summary: "AI-assisted filter creation" (a button to run AI-prompt-based filter creation from any event list) was dropped from this batch's scope — the underlying feature (PRD §3.15, `EventFilterInput`/`AIEventFilter`) had no epics.md/sprint-status.yaml backlog entry at all until this same day.
  evidence: `spec-ux-rework2-batch.md`'s own Intent section states this item was "dropped (it requires a full unbuilt feature, tracked separately in deferred-work.md)" — but it was never actually added here; this entry corrects that gap. The feature is now properly tracked as Epic 7 (AI Prompt-Based Custom Event Filter, `epics.md`, Stories 7.1a–7.5, commit `916a753`) rather than as deferred work — Epic 7's Story 7.4 ("Add the AI filter prompt entry point to FilterHub") is the actual home for the button the user asked about.
