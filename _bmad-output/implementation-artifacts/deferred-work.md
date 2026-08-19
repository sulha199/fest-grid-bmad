# Deferred Work

This file tracks work deferred from development stories, code reviews, and planning sessions.

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
