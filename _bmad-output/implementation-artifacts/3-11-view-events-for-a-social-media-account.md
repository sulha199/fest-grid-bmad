---
baseline_commit: 63afd766260139e0dac905796b87e45967f6536b
---

# Story 3.11: View events for a social media account

## Story Details

- **Epic:** 3
- **Story ID:** 3.11
- **Status:** ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** visitor,
**I want** a dedicated page showing all events sourced from a single social media account,
**So that** I can browse an account's events directly — e.g. via a shared link — without needing to log in or be subscribed to it.

## Acceptance Criteria

1. **Given** a `social_media_account_profiles` row exists (Story 3.1a) with at least one associated event, **when** I navigate to `/{locale}/{platformSlug}/{accountId}` (e.g. `/en/ig/17841400000000000`), where `platformSlug` is the short, stable slug derived from `SocialMediaAccountProfile.platform` (Story 3.3c's `PLATFORM_SLUGS` registry) and `accountId` is `SocialMediaAccountProfile.accountId` (the platform-native identifier — not the internal database `id`), **then** I see that account's events. [epics.md AC1]
2. **And** those events render with the same card view, calendar view, search, and filter behavior as the main discovery page (Stories 1.3, 1.3b, 1.3c, 1.5, 1.5a, 2.6) — reusing `EventDiscoveryPanel`, `EventListView`, `EventCard`, `SearchBar`, `FilterHub`, `WeeklyCalendarView`/`useWeeklyCalendarController` exactly as already built, not re-implementing them. The nearby/geo-radius filter (Story 2.5) is explicitly not part of this reuse — no story in this epic's dependency chain requires it, and the AC's own "Depends on" list omits Story 2.5/2.5a. [epics.md AC2]
3. **And** the page first resolves `platformSlug`+`accountId` to the account profile via Story 3.1a's `socialMediaAccountProfileByAccountId(platform, accountId)` query (`platform` argument is the full platform name, e.g. `"instagram"` — resolved from `platformSlug` via `getPlatformByCode`, not passed as the raw slug), then fetches events via the existing events GraphQL API (Story 1.3a) using the Unified Query DSL's existing `socialMediaAccountProfileId` field (AD-1) with an `in` operator over `[profile.id]` — the profile's internal `id`, not its public `accountId`, is what the DSL condition takes (mirrors `buildFeedQueryCondition`'s existing `socialMediaAccountProfileId`/`in` usage for the exact same field — the DSL's ID-field operators are `in`/`notIn` only per the architecture spine, so this AC's "equals" wording is satisfied via `in` with a single-element array, not a new `equals` operator). No new query mechanism is introduced for events themselves. [epics.md AC3]
4. **And** this page requires no authentication and no subscription to the account — both the profile lookup and the events query are publicly accessible given a valid `platformSlug`/`accountId`. [epics.md AC4]
5. **And** if `platformSlug` matches no known platform (`getPlatformByCode` returns `undefined`), or `socialMediaAccountProfileByAccountId` finds no matching profile, a not-found state is shown (Next.js `notFound()`, mirroring the established pattern in `apps/web/src/app/[locale]/wizard/[wizardKey]/[stepSlug]/page.tsx`) rather than an error. [epics.md AC5]
6. **And** the page sets its title/meta description via `generateMetadata`, per the Dynamic Page Title invariant (project-context.md), using the account's `displayName`. [epics.md AC6]
7. **And** the platform-to-slug mapping (e.g. Instagram -> `ig`) is defined once, in Story 3.3c's shared `packages/domain/src/scraper/platform-registry.ts` (`PLATFORM_SLUGS`, `getPlatformSlug`, `getPlatformByCode`), and reused for routing here — not hardcoded per-component. [epics.md AC7]
8. **And** (end-to-end completeness, not a stated epics.md AC but required for the feature this story enables to actually work — see Dev Notes "Why AC8 exists"): Story 1.6a's `EventDetailView` account-attribution link (`accountName`/`accountPlatformIconUrl`/`accountHref`) is wired to real data end-to-end — clicking an event's account attribution on the event detail page navigates to this story's `/{platformSlug}/{accountId}` page for that event's source account. Where an event has no resolvable source account (`postId` is null, or the post's account was hard-deleted), the attribution block is simply omitted (existing `hasAccountAttribution` truthy-gate in `EventDetailView`), not shown broken.
9. **And** all user-facing strings (page title fallback, search placeholder, empty/error states, calendar labels) are sourced through `next-intl` with both `en` and `id` locale entries — no user-facing English string is hardcoded (project-context.md i18n Core Principle).

## Tasks / Subtasks

- [ ] **Task 1 (AC1, AC5, AC6, AC7) — Server-side route resolution, not-found gate, and metadata:**
  - [ ] Create `apps/web/src/features/accounts/queries.graphql` with `query getSocialMediaAccountProfileByAccountId($platform: String!, $accountId: String!) { socialMediaAccountProfileByAccountId(platform: $platform, accountId: $accountId) { id accountId platform displayName username profileImageUrl description } }` and run `pnpm --filter web codegen` (GraphQL Code Generator) to produce `useGetSocialMediaAccountProfileByAccountIdQuery`/`GetSocialMediaAccountProfileByAccountIdDocument`.
  - [ ] Create `apps/web/src/app/[locale]/[platformSlug]/[accountId]/page.tsx` (Server Component, `export const dynamic = 'force-dynamic'`, mirroring `wizard/[wizardKey]/[stepSlug]/page.tsx`'s structure): resolve `platform = getPlatformByCode(platformSlug)` (from `@festgrid/domain/scraper`) — call `notFound()` if `undefined`; call `graphqlClient.request(GetSocialMediaAccountProfileByAccountIdDocument, { platform, accountId })` — call `notFound()` if the result is `null`. On a network/server error during the fetch, do not call `notFound()` (that would misreport a transient failure as "account doesn't exist") — let it propagate to Next's default route error boundary, mirroring `events/[slug]/page.tsx`'s graceful-degrade-on-error precedent for `generateMetadata` specifically (its own try/catch), but the page body itself has no non-`generateMetadata` precedent for this — use a top-level try/catch in the page body only around the profile fetch, and re-throw on non-null-result errors so Next's error boundary handles it.
  - [ ] Implement `generateMetadata({ params })`: same platform/not-found resolution as above (duplicated resolution is intentional and matches the wizard page's own "defense-in-depth" duplication between `generateMetadata` and the page body — Next.js does not share fetched data between the two), then `buildPageMetadata({ title: t('Metadata.accountPageTitle', { displayName: profile.displayName }), description: t('Metadata.accountPageDescription', { displayName: profile.displayName }) })`.
  - [ ] Render `<Suspense fallback={<RouteLoader />}><AccountContent platformSlug={platformSlug} accountId={accountId} profile={profile} /></Suspense>` — pass the already-fetched `profile` down as a prop (id, displayName, profileImageUrl, description) so `AccountContent` does not re-fetch it.
- [ ] **Task 2 (AC2, AC3, AC4, AC9) — Domain query-condition builders:**
  - [ ] `packages/domain/src/events/buildAccountEventsQueryCondition.ts`: mirrors `buildFeedQueryCondition.ts`'s composition shape exactly, but with a single fixed base condition `{ field: 'socialMediaAccountProfileId', operator: 'in', value: [profileId] }` (no `isFromSubscribedAccount` condition — this page is public, not subscription-scoped) composed via `and` with `buildEventsQueryCondition({ search, types, categories })` (no `nearby` param — out of scope per AC2). Export from `packages/domain/src/events/index.ts`.
  - [ ] `packages/domain/src/events/buildAccountCalendarQueryCondition.ts`: mirrors `buildFeedCalendarQueryCondition.ts` exactly, adding the `weekStart`/`weekEnd` `scheduleDateRange` `overlaps` condition on top of the same fixed `socialMediaAccountProfileId` `in` condition. Export from `packages/domain/src/events/index.ts`.
  - [ ] Unit tests for both (`packages/domain`'s 100%-coverage rule — project-context.md Testing Rules), mirroring `buildFeedQueryCondition.test.ts`/`buildFeedCalendarQueryCondition.test.ts` case-by-case (empty search/types/categories, combined filters, group-condition merging).
- [ ] **Task 3 (AC2, AC4, AC9) — `AccountContent` client component (card view):**
  - [ ] Create `apps/web/src/app/[locale]/[platformSlug]/[accountId]/account-content.tsx`, structurally mirroring `feed-content.tsx` but: (a) no auth-redirect `useEffect` (public), (b) no `SubscriptionPicker` (irrelevant — single account), (c) `useInfiniteQuery` always `enabled: true` (no session gate), (d) query condition via `buildAccountEventsQueryCondition({ search: q, types, categories, profileId: profile.id })`, (e) favorite-toggle uses the main Discovery page's pattern — unauthenticated click opens the existing `LoginContent` dialog (mirror `home-content.tsx`'s `isLoginModalOpen`/`Dialog`/`LoginContent` exactly), not Feed's redirect-to-`/login` pattern, since this page must stay browsable without forcing navigation away.
  - [ ] Render a minimal page header above `EventDiscoveryPanel`: `profile.displayName` as `<h1>`, `profile.profileImageUrl` as a small avatar `<img>` if present (omit the `<img>` entirely if absent — no broken-image fallback), `profile.description` as sub-text if present. Inline JSX in `account-content.tsx` — not a new shared component (Gate 2 found no reuse need for this single-consumer header; see Architecture & UX Gate Findings).
  - [ ] `EventDiscoveryPanel`'s location props (`isAuthenticated`, `isLoadingLocations`, `locationsError`, `savedLocations`, `selectedValue`, `radiusKm`, `isCapturingCurrentLocation`, `currentLocationError`, `onSelectLocation`, `onRadiusChange`) passed as static/no-op stub values exactly as `feed-content.tsx` does (`isAuthenticated: false, savedLocations: [], selectedValue: "off"`, etc.) — the nearby filter is fully suppressed by `FilterHub` when these are inert, no new prop plumbing needed.
  - [ ] `views` array: `card` (id `"card"`, `EventListView` wired like `home-content.tsx`'s card view, event click navigates to `/events/${event.slug}?fromList=account` preserving `searchParams`) and `calendar` (id `"calendar"`, renders `AccountCalendarView`, Task 4).
- [ ] **Task 4 (AC2) — `AccountCalendarView` (calendar view):**
  - [ ] Create `apps/web/src/app/[locale]/[platformSlug]/[accountId]/AccountCalendarView.tsx`, the 4th instance of the established `CalendarView`/`FeedCalendarView`/`my-calendar-content` wrapper pattern: owns `week` URL state (`getSunday`/`getSaturday`), calls `useGetEventsForCalendarQuery` (existing document, no new query) with `buildAccountCalendarQueryCondition({ search: q, types, categories, weekStart, weekEnd, profileId: profile.id })`, drives `useWeeklyCalendarController`, renders `WeeklyCalendarView`. Schedule click navigates to `/events/${schedule.eventSlug}?fromList=account`.
- [ ] **Task 5 (AC8) — Wire `EventDetailView`'s account-attribution link end-to-end:**
  - [ ] `apps/backend/src/schema/events.graphql`: add `sourceSocialMediaAccountProfile: SocialMediaAccountProfile` to the `Event` type.
  - [ ] `apps/backend/src/schema/resolvers.ts`: add an `Event.sourceSocialMediaAccountProfile` field resolver (alongside the existing `Event.schedules` field resolver, same file/pattern) that returns `null` if `parent.postId` is `null`, otherwise joins `posts` (on `posts.id = parent.postId`) to `socialMediaAccountProfiles` (on `socialMediaAccountProfiles.id = posts.accountId`) via `buildOptimizedDrizzleSelect(socialMediaAccountProfiles, info)`, matching the `Event.schedules` resolver's use of `buildOptimizedDrizzleSelect` for AD-1's over-fetch prevention rule. Do **not** use the legacy `events.sourceSocialMediaAccountId` text column for this join — it stores the account's public `accountId` (confirmed via `packages/database/seed.ts`), not an FK, and `events.postId -> posts.accountId -> socialMediaAccountProfiles.id` is the correct, already-established relation (same path Story 3.1a's DSL `socialMediaAccountProfileId` field already uses).
  - [ ] `apps/web/src/features/events/queries.graphql`: add `sourceSocialMediaAccountProfile { accountId platform displayName profileImageUrl }` to `getEventBySlug`. Run codegen.
  - [ ] `apps/web/src/features/events/mapper.ts`: in `mapGraphQLEventToDetailViewProps`, compute `accountName = event.sourceSocialMediaAccountProfile?.displayName ?? null`, `accountPlatformIconUrl = event.sourceSocialMediaAccountProfile?.profileImageUrl ?? null` (uses the account's own avatar as the attribution icon — no static per-platform logo assets exist in the repo, and `EventDetailView`'s existing `hasAccountAttribution` truthy-gate already degrades gracefully to "omit the whole block" if this is absent, so no new asset work is introduced), `accountHref = event.sourceSocialMediaAccountProfile ? `/${getPlatformSlug(event.sourceSocialMediaAccountProfile.platform)}/${event.sourceSocialMediaAccountProfile.accountId}` : null` (using `getPlatformSlug` from `@festgrid/domain/scraper`, the same import path already used by `subscriptions-content.tsx`/`onboarding-subscribe-step.tsx`).
- [ ] **Task 6 (AC9) — i18n:** Add the `AccountPage` namespace and `Metadata.accountPageTitle`/`Metadata.accountPageDescription` keys to both `apps/web/locales/en.json` and `apps/web/locales/id.json` (see Dev Notes "Exact Locale Keys").
- [ ] **Task 7 — Testing (see Testing Requirements for full detail):** domain unit tests (Task 2), a backend `node:test` case for the new `Event.sourceSocialMediaAccountProfile` resolver, `apps/web` Vitest/MSW integration tests for `account-content.tsx` (not-found precondition covered at the `page.tsx` level via a routing-level test, card/calendar rendering, search/filter reuse), and one Playwright E2E happy-path test navigating from a seeded account's public page through to an event detail page and back via the attribution link.

## Dev Notes

- **Why AC8 exists (not in epics.md's own AC list for this story):** Story 1.6a's AC states the account-attribution link is "driven by new Story 3.11" and that clicking it "navigates to that account's public event page (`/{platformSlug}/{accountId}`, Story 3.11)." I confirmed by reading `apps/web/src/features/events/mapper.ts` and `EventDetailWrapper.tsx` that `EventDetailView`'s `accountName`/`accountPlatformIconUrl`/`accountHref` props are already defined in `EventDetailView.types.ts` and rendered by the component (`packages/ui/src/features/events/EventDetailView.tsx` lines ~243-253), but the frontend caller never populates them — and the `Event` GraphQL type (`apps/backend/src/schema/events.graphql`) exposes no field carrying the account's `platform`/`displayName`/`profileImageUrl`, only a bare `sourceSocialMediaAccountId: ID`. Per `project-context.md`'s cross-cutting mandate ("a story implementation must leave the system working end-to-end — not just satisfy its stated ACs"), and because Story 3.11 is the one story that makes this link's destination real, closing this gap here (rather than leaving 1.6a's feature permanently dead, or spinning up a disproportionate new story for what Gate 2 confirmed is one small field resolver plus prop wiring) was confirmed with the user via `AskUserQuestion` during this story's creation. See Architecture & UX Gate Findings below.
- **`events.sourceSocialMediaAccountId` vs. the DSL's `socialMediaAccountProfileId` — do not confuse the two:** `events.sourceSocialMediaAccountId` (raw DB column, `text`) stores the account's public/platform-native `accountId` string directly (confirmed via `packages/database/seed.ts` fixture data) and is a legacy/denormalized field predating the `posts`/`social_media_account_profiles` tables — it is exposed as-is on the `Event` GraphQL type and this story does not touch it. The DSL's `socialMediaAccountProfileId` field (used by this story's two new query-condition builders, AC3) is a completely different thing: a resolver-level field mapped to `posts.accountId` (the internal FK to `social_media_account_profiles.id`), used only inside the `events` list query's `WHERE` translation, never returned as event row data. Task 5's new `sourceSocialMediaAccountProfile` field resolver deliberately joins through `events.postId -> posts.accountId -> social_media_account_profiles`, the same relation the DSL field already uses — not through the legacy text column.
- **Route-collision note:** `[platformSlug]` is a top-level dynamic segment under `/{locale}/`, sibling to static route folders (`login`, `feed`, `favorites`, `settings`, `my-calendar`, `events`, `wizard`). Next.js resolves exact static-folder matches before dynamic segments, so no existing route is shadowed. `PLATFORM_SLUGS` currently only contains `ig`/`x` (Story 3.3c), neither of which collides with any existing or currently-planned top-level route name — flagging this only so a future story adding both a new top-level static route and a new platform slug is aware of the shared namespace.
- **No PostHog custom events beyond what already exists (AD-5):** this page's interactions (favorite toggle, filter change, search submit, view switch, calendar week navigation) are functionally identical to Discovery's, so it reuses the exact same event names/payloads already implemented — `event_favorited`/`event_unfavorited` (`{ eventId }`), `filter_applied` (`{ types, categories }`), `search_submitted` (`{ query }`), `view_switched` (`{ view }`), `calendar_week_navigated` (`{ direction, weekStart }`). No new event name is introduced. PostHog's route-level pageview autocapture (Story 1.8) already distinguishes this page by URL.
- **State management categorization (project-context.md):** Server State — `@tanstack/react-query` + `graphql-request` for the profile lookup (server-side, one-shot) and the events/calendar queries (client-side, via `useInfiniteQuery`/`useGetEventsForCalendarQuery`), all through GraphQL-Code-Generator-typed hooks. URL State — `nuqs` for `q`/`types`/`categories`/`view`/`week`, exactly mirroring Discovery/Feed. No Client Global State (zustand) — nothing here is ephemeral cross-component UI state.
- **Async loader categorization (project-context.md UI invariants):** Route-level — the existing project-wide `<Suspense fallback={<RouteLoader />}>` boundary (Story 0.26), already required at `page.tsx`'s top level (Task 1). In-page initial load — Non-Blocking (Skeleton), via `EventListView`'s existing loading state (unchanged, reused as-is). Infinite scroll pagination — Non-Blocking (localized spinner), via the existing `sentinelRef`/`isFetchingNextPage` wiring (unchanged, reused as-is). No new Blocking-loader scenario is introduced by this story.

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3:** Cited from swept `_bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md` (`swept: true`, `stories_covered` explicitly includes `3.11`; verdict: "Epic 3 is highly mature and ready for continued story execution"). No Gate 1/3 gap applies — this story introduces no new external service, table, queue, or cross-cutting tooling; it is a new page assembling already-built primitives plus one small, precedented backend field-resolver addition (Task 5), not a new architectural layer.
  - **Lightweight escape-hatch guard:** re-checked this story's specific scope against anything the epic-wide sweep couldn't have anticipated. The one real gap found — Story 1.6a's account-attribution link never being wired to real GraphQL data — is a full-stack data-completeness gap, not a missing architectural layer (the `socialMediaAccountProfileByAccountId` query and the DSL's `socialMediaAccountProfileId` field both already exist; only a new field *resolver* on an existing type, following an existing resolver's exact pattern, was missing). Resolved via `AskUserQuestion` with the user: absorbed into this story as Task 5 rather than split into a new story (disproportionate for the actual size of the gap) or left as a permanent forward-note (would leave 1.6a's shipped-but-inert feature dead indefinitely). See "Why AC8 exists" above.
- **Gate 2 (UI Complexity & Reusability):** Run fresh via a one-shot Freya-persona pass (required per-story even when the epic sweep is used, since UI scope is story-specific). Verdict: **No gap found.** Every component with non-trivial states in this story's scope (`EventDiscoveryPanel`, `EventListView`, `EventCard`, `WeeklyCalendarView`, `SearchBar`, `FilterHub`) is already built and already reused across ≥2 places (Discovery + Feed); this story adds zero new props/variants/states to any of them. The three net-new page-level files (`page.tsx`, `account-content.tsx`, `AccountCalendarView.tsx`) are single-consumer, page-scoped glue — `AccountCalendarView.tsx` is explicitly the 4th instance of an already-3x-repeated wrapper pattern (`CalendarView`/`FeedCalendarView`/`my-calendar-content`), not a new pattern. The two new domain query-condition builders are single-consumer, following the exact compositional shape already proven twice (`buildFeedQueryCondition`/`buildFeedCalendarQueryCondition`). No authoritative UX artifact (`design-artifacts/UX-festgrid-run-1/{DESIGN,EXPERIENCE}.md`, `design-artifacts/UX-wizard-page-run-1/{DESIGN,EXPERIENCE}.md`) mentions a per-account page at all (confirmed via grep for "account page", "per-account", "platformSlug", "public account", case-insensitive, zero hits) — there is no bespoke visual spec being missed, and the AC itself mandates reusing Discovery's exact visual treatment rather than specifying anything new.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: **No changes required for the page's own event/calendar querying** (Tasks 1-4) — it reads exclusively through already-existing, already-migrated columns and the already-existing DSL `socialMediaAccountProfileId` field. **For Task 5** (the new `Event.sourceSocialMediaAccountProfile` field): no DB schema or migration change either — it is a GraphQL-level resolver field computed via an existing FK join (`events.postId -> posts.accountId -> social_media_account_profiles.id`), not a new stored column.
- Impacted fields/contracts: `apps/backend/src/schema/events.graphql` (`Event` type gains `sourceSocialMediaAccountProfile: SocialMediaAccountProfile`, a nullable resolver field); `apps/web/src/features/events/queries.graphql`'s `getEventBySlug` document (new nested selection); generated TypeScript types (`apps/web/src/generated/graphql.ts`, `apps/backend/src/generated/resolvers-types.ts`) regenerated via `pnpm codegen` in both packages.
- Required DB migration changes: None — no new column, table, or index.
- Required TypeScript type changes: Regenerate GraphQL Code Generator output only (no hand-written type changes); `EventDetailViewProps`/`EventDetailViewLabels` in `packages/ui` are unchanged (the `accountName`/`accountPlatformIconUrl`/`accountHref` props already exist from Story 1.6a).
- Backward compatibility and rollout notes: `sourceSocialMediaAccountProfile` is purely additive and nullable — existing clients/queries that don't select it are unaffected; events with no `postId` (manually-entered or legacy data) simply resolve it to `null`, which `EventDetailView`'s existing `hasAccountAttribution` gate already handles gracefully.
- Verification checks: Task 7's backend `node:test` case for the new field resolver (asserts correct profile returned for a real `postId`, `null` for a `null` `postId`); the new Vitest/MSW `mapper.ts` case (if `mapper.ts` has existing unit/integration coverage — confirm during implementation and extend it) asserting `accountHref`/`accountName`/`accountPlatformIconUrl` are correctly derived from a mocked `sourceSocialMediaAccountProfile` payload.

### Project Structure Notes

- **New:**
  - `apps/web/src/app/[locale]/[platformSlug]/[accountId]/page.tsx`
  - `apps/web/src/app/[locale]/[platformSlug]/[accountId]/account-content.tsx`
  - `apps/web/src/app/[locale]/[platformSlug]/[accountId]/AccountCalendarView.tsx`
  - `apps/web/src/features/accounts/queries.graphql`
  - `packages/domain/src/events/buildAccountEventsQueryCondition.ts` (+ `.test.ts`)
  - `packages/domain/src/events/buildAccountCalendarQueryCondition.ts` (+ `.test.ts`)
- **Modified:**
  - `packages/domain/src/events/index.ts` (export the two new builders)
  - `apps/backend/src/schema/events.graphql` (add `sourceSocialMediaAccountProfile` field to `Event`)
  - `apps/backend/src/schema/resolvers.ts` (add `Event.sourceSocialMediaAccountProfile` field resolver)
  - `apps/web/src/features/events/queries.graphql` (extend `getEventBySlug`)
  - `apps/web/src/features/events/mapper.ts` (populate `accountName`/`accountPlatformIconUrl`/`accountHref`)
  - `apps/web/locales/en.json`, `apps/web/locales/id.json` (new `AccountPage` namespace, `Metadata` additions)
- **Not modified:** `packages/ui/src/features/events/EventDetailView.tsx` and `EventDetailView.types.ts` (props already exist from Story 1.6a — this story only supplies real data), `EventCard.tsx` (no account link at the card level, unchanged), `packages/domain/src/scraper/platform-registry.ts` (reused as-is, no changes).
- Detected conflicts or variances: None.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.11] — this story's authoritative AC and "Note" (FR68, `bmad-correct-course` 2026-08-02 origin).
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.6a] — the account-attribution-link AC and its 2026-08-02 Amendment naming this story as the link's destination (source of Task 5/AC8).
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md] — swept Gate 1/3 report covering `3.11`; verdict "highly mature."
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — gate definitions and execution protocol applied above.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-1] — Unified Query DSL field/operator table confirming `socialMediaAccountProfileId` is `in`/`notIn` only (informs AC3's "equals via `in`" clarification).
- [Source: apps/web/src/app/[locale]/feed/feed-content.tsx, FeedCalendarView.tsx] — the closest existing precedent (`EventDiscoveryPanel` + calendar-wrapper composition, `buildFeedQueryCondition`/`buildFeedCalendarQueryCondition` compositional shape) this story's Tasks 2-4 directly mirror.
- [Source: apps/web/src/app/[locale]/home-content.tsx] — the unauthenticated-favorite-toggle-opens-login-modal pattern this story's Task 3 reuses (over Feed's redirect-to-login pattern, which doesn't fit a public page).
- [Source: apps/web/src/app/[locale]/wizard/[wizardKey]/[stepSlug]/page.tsx] — the `notFound()` + duplicated-resolution-in-`generateMetadata`-and-page-body pattern this story's Task 1 mirrors.
- [Source: apps/web/src/app/[locale]/events/[slug]/page.tsx] — the async-`generateMetadata`-with-graceful-degrade-on-fetch-error pattern (distinct from the wizard's synchronous `notFound()`), informing Task 1's error-vs-not-found distinction.
- [Source: apps/backend/src/schema/resolvers.ts, lines ~729-750] — existing `socialMediaAccountProfileByAccountId` resolver (unauthenticated, already returns the full profile shape this story's Task 1 query needs).
- [Source: apps/backend/src/schema/resolvers.ts, lines ~1035-1044] — existing `Event.schedules`/`Event.imageUrl` field-resolver map, the exact precedent Task 5's new `Event.sourceSocialMediaAccountProfile` resolver follows.
- [Source: packages/database/schema.ts, lines 129-161] — `posts.accountId -> social_media_account_profiles.id` and `events.postId -> posts.id` FK relations Task 5's resolver joins through; `events.sourceSocialMediaAccountId` confirmed as a separate legacy text column (not an FK) via `packages/database/seed.ts`.
- [Source: packages/domain/src/scraper/platform-registry.ts] — `PLATFORM_SLUGS`/`getPlatformSlug`/`getPlatformByCode`/`getPlatformDisplayName` (Story 3.3c), reused by both the routing resolution (Task 1) and the attribution-link construction (Task 5).
- [Source: apps/web/src/features/subscriptions/queries.graphql] — precedent for where/how a new feature-scoped `.graphql` query document (`apps/web/src/features/accounts/queries.graphql`) is added.
- [Source: apps/web/src/features/events/mapper.ts, EventDetailWrapper.tsx] — confirmed, by direct read, that `accountName`/`accountPlatformIconUrl`/`accountHref` are never populated today (the gap Task 5 closes).
- [Source: packages/ui/src/features/events/EventDetailView.tsx, EventDetailView.types.ts] — existing account-attribution rendering/props (unmodified by this story).
- [Source: _bmad-output/implementation-artifacts/3-9-implement-api-key-quota-management.md] — most recent prior Epic 3 story; confirms the swept-report-citation + lightweight-guard Gate pattern this story follows.

## Global Rules References

- [ ] `_bmad-output/project-context.md` — Unified Query DSL / AD-1 & AD-2 (Task 2's condition builders route through the existing single events query endpoint, no new single-purpose endpoint); Optimized DB Queries (`buildOptimizedDrizzleSelect`, reused as-is for Task 5's new field resolver); i18n Core Principle (Task 6, both locales); Dynamic Page Title invariant (Task 1's `generateMetadata`); State Management Architecture (Dev Notes categorization above); Loaders invariant (Dev Notes categorization above); Code Organization (Task 2's builders placed in `packages/domain/src/events/`, no React/DB/Node dependency introduced there — pure DSL-object construction only, consistent with existing sibling files).
- [ ] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order/status vocabulary followed in this file.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-1 (Unified Query DSL field/operator table, cited above for the `in`-not-`equals` clarification); no other AD is touched by this story.
- [ ] `docs/infrastructure/1-frontend.md`, `docs/infrastructure/high-level-overview.md` — this story is frontend/GraphQL-resolver-only, no Lambda/SQS/IaC change; confirmed no infra shard needs updating.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:** See "Project Structure Notes" above for the complete New/Modified/Not-modified file list (Tasks 1-6).
- **Rule Mapping:**
  - "Reusing those components rather than re-implementing them" (epics.md AC2) → File Change Plan shows zero changes to `EventDiscoveryPanel`, `EventListView`, `EventCard`, `WeeklyCalendarView`, `useWeeklyCalendarController`, `SearchBar`, `FilterHub`.
  - "No new query mechanism is introduced for events themselves" (epics.md AC3) → Task 2's builders compose the existing `EventQueryConditionInput`/DSL shape only; no new GraphQL query/field for the events list.
  - AD-1/AD-2 (Unified Query DSL, single query endpoint) → Task 2.
  - Optimized DB Queries / `buildOptimizedDrizzleSelect` (project-context.md) → Task 5's new field resolver.
  - i18n Core Principle, dual-locale requirement → Task 6, Dev Notes "Exact Locale Keys" (below, in Testing Requirements' companion detail).
  - Dynamic Page Title invariant → Task 1's `generateMetadata`, sourced via `getTranslations` server-side (not `useTranslations`/client-side `document.title`).
  - Gate 1/2/3 → Architecture & UX Gate Findings above; Gate 1/3 escape-hatch finding → Task 5 (absorbed, not split, per user confirmation).
  - `packages/domain` 100%-unit-test-coverage rule → Task 2's `.test.ts` files.
- **Verification Plan:**
  - Task 2: `packages/domain` unit tests, 100% branch coverage on both new builders.
  - Task 5: backend `node:test` case asserting the new resolver's join correctness (real `postId` → real profile; `null` `postId` → `null`).
  - Task 7: `apps/web` Vitest/MSW integration tests (`account-content.test.tsx` or equivalent) covering: profile-resolved happy path (card view renders events scoped to the account), calendar-view switch, search/filter interaction reusing `EventDiscoveryPanel`, unauthenticated favorite-toggle opens the login modal (not a redirect); a routing-level test (or `page.tsx`-level test) asserting `notFound()` fires for an unknown `platformSlug` and for a profile-lookup miss.
  - One Playwright E2E happy path: seed an account profile + event, navigate to `/{locale}/{platformSlug}/{accountId}`, assert the event card renders, click through to the event detail page, assert the account-attribution link is present and navigates back to the account page (proves Task 5's end-to-end wiring, not just the field resolver in isolation).
  - `pnpm build`, `pnpm lint`, `pnpm codegen` (both `apps/web` and `apps/backend`), `pnpm test` (root) — full suite, no regressions.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: build the public `/{platformSlug}/{accountId}` page (Tasks 1-4, epics.md AC1-AC7, AC9) reusing all existing Discovery/Feed primitives with zero component changes, plus (Task 5, AC8) wire Story 1.6a's dormant `EventDetailView` account-attribution props to real data via one new `Event.sourceSocialMediaAccountProfile` GraphQL field resolver.
- [ ] Architecture and boundary confirmation: no new external service, table, or queue; Task 5's field resolver follows the existing `Event.schedules` field-resolver pattern exactly; Task 2's query builders route through the existing single events query endpoint (AD-1/AD-2), no new query surface.
- [ ] Testing plan confirmation: domain unit tests (Task 2), backend resolver test (Task 5), `apps/web` Vitest/MSW integration tests + one Playwright E2E happy path (Task 7), as specified in the Verification Plan above.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1/3 cited from swept `epic-3-readiness.md` (no gap, `3.11` explicitly covered); Gate 2 run fresh via Freya persona (no gap — all reusable UI is already built); the one real gap found (Story 1.6a's unwired account-link) was resolved via `AskUserQuestion` with the user — **absorbed into this story as Task 5**, not split into a new story or deferred.
- [ ] **Task 5/AC8 scope-absorption accepted:** confirm extending `apps/backend/src/schema/events.graphql`/`resolvers.ts` and `apps/web/src/features/events/mapper.ts` (files outside this story's "own" page, but required to complete Story 1.6a's promised feature end-to-end) is acceptable as part of Story 3.11, per the user's explicit choice during this story's creation.
- [ ] **Account-avatar-as-attribution-icon accepted:** confirm using the account's own `profileImageUrl` (not a new static per-platform logo asset) as `accountPlatformIconUrl` is acceptable — no platform-logo SVG assets exist in the repo today, and adding them would be disproportionate scope for this story.

## Testing Requirements

- [ ] Unit tests (required, `packages/domain`, 100% coverage per project-context.md): `buildAccountEventsQueryCondition.test.ts`, `buildAccountCalendarQueryCondition.test.ts` (Task 2).
- [ ] Integration tests (required): `apps/backend` `node:test` case for the new `Event.sourceSocialMediaAccountProfile` field resolver (Task 5); `apps/web` Vitest/MSW tests for `account-content.tsx` (happy path, not-found path at the page level, unauthenticated favorite-toggle-opens-modal, search/filter/calendar-switch reuse) (Task 7).
- [ ] E2E tests (required, Playwright, critical path only per Testing Philosophy): one happy-path test — seeded account → public page → event card → event detail → account-attribution link → back to public page (Task 7).
- [ ] Manual verification: Not applicable — no external credentials needed; all data seedable via existing fixtures (`packages/database/seed.ts` already has `FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILES`).

### Exact Locale Keys (i18n, Task 6 — both `en.json` and `id.json`)

- `Metadata.accountPageTitle`: e.g. `"{displayName} | FestDaily"` (mirrors `eventDetailTitle`'s `{eventName}` interpolation pattern).
- `Metadata.accountPageDescription`: e.g. `"Browse events from {displayName} on FestDaily."`.
- New `AccountPage` namespace, mirroring `FeedPage`'s key set minus subscription-specific keys: `errorState`, `emptyState`, `searchEmptyState`, `priceFrom`, `loadingMore`, `searchPlaceholder`, `searchClearLabel`, `favoriteButtonLabel`, `calendarPrevWeekLabel`, `calendarNextWeekLabel`, `calendarTodayLabel`, `calendarMoreLabel` (ICU plural, copy `FeedPage.calendarMoreLabel`'s exact plural syntax), `calendarErrorState`, `calendarClosePopoverLabel`. No `title`/`subscriptionFilterLabel`/`emptyStateCta` keys — this page's `<h1>` uses the live `profile.displayName`, not a static translated title, and there is no subscription concept here.

## Deliverables Checklist

- [ ] `/{locale}/{platformSlug}/{accountId}` page live, rendering the account's events in card + calendar view with working search/filter, matching Discovery's exact reused components.
- [ ] Not-found state (`notFound()`) verified for both an unrecognized `platformSlug` and a valid-but-nonexistent `accountId`.
- [ ] `generateMetadata` verified to reflect the account's `displayName`.
- [ ] `Event.sourceSocialMediaAccountProfile` field resolver live; `EventDetailView`'s account-attribution link on the event detail page verified to navigate to the correct `/{platformSlug}/{accountId}` page.
- [ ] Both `en.json` and `id.json` updated with all new keys (Exact Locale Keys above); no hardcoded user-facing string introduced.
- [ ] `pnpm build`/`pnpm lint`/`pnpm codegen` (both packages)/`pnpm test` clean at the repo root.

## Out of Scope

- Nearby/geo-radius filtering (Story 2.5/2.5a) on this page — not part of epics.md's AC2 reuse list and not required by any dependency of this story.
- Any change to `EventCard.tsx` — the account-attribution link is an `EventDetailView`-only feature (Story 1.6a), confirmed by direct read that `EventCard.tsx` has no account-related props today; out of scope here too.
- New static per-platform logo/icon assets — the account's own `profileImageUrl` is used instead (see Pre-Coding Approval Gate acceptance item above); a future story may introduce real platform-logo assets if ever needed elsewhere.
- Any change to `socialMediaAccountProfileByAccountId`'s resolver implementation, the `PLATFORM_SLUGS` registry, or the DSL's `socialMediaAccountProfileId` field translation — all three already exist and are reused as-is.
- Story 3.10's email-notification behavior and Story 3.9/3.9a's quota/queue-status UI — unrelated, separately-scoped concerns with no dependency relationship to this story.

## Definition of Done

- [ ] All Acceptance Criteria (AC1-AC9) satisfied and verified.
- [ ] All required tests (unit, integration, E2E per Testing Requirements) passing.
- [ ] Lint and type checks passing for all touched packages (`apps/web`, `apps/backend`, `packages/domain`).
- [ ] `pnpm codegen` run and committed for both `apps/web` and `apps/backend` (generated GraphQL types reflect the new field/query).
- [ ] No hardcoded user-facing English string; both `en.json`/`id.json` updated in lockstep.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
