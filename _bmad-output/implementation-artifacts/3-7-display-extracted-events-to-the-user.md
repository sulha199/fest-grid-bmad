# Story 3.7: Display extracted events to the user

## Story Details

- Epic: 3
- Story ID: 3.7
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to see the events that have been extracted from my subscribed social media accounts,
so that I can see the results of the event extraction process.

## Acceptance Criteria

1. **Given** I am not authenticated, **when** I navigate to `/feed`, **then** I am redirected to `/login` (mirrors the existing `/favorites` and `/my-calendar` auth-redirect precedent) — no data is fetched for an unauthenticated visitor.
2. **Given** I am authenticated but have zero events sourced from my subscribed accounts (no subscriptions yet, or subscriptions with no extracted events yet), **when** I navigate to `/feed`, **then** I see the empty-state message "Your feed is empty! Subscribe to social media accounts to see their events here." with a primary "Manage Subscriptions" button linking to the subscriptions management page (`design-artifacts/C-UX-Scenarios/03-alex-discovers-his-feed/03.1-alex-discovers-his-feed.md`).
3. **Given** I am authenticated and have at least one active subscription with at least one extracted event, **when** I navigate to `/feed`, **then** I see a list of events sourced only from accounts I am actively subscribed to (soft-deleted/removed subscriptions are excluded), by default in card view.
4. **Given** I am on the Feed page, **when** I toggle to calendar view and back, **then** the same subscribed-accounts-only scoping applies in both views, and the active view is reflected in `?view=` URL state (nuqs), matching the Discovery page's `view` switcher pattern exactly.
5. **Given** I am on the Feed page (either view), **when** I use the search box or the type/category filters (`FilterHub`), **then** results narrow further within my subscribed-accounts scope — search/filter conditions are combined with (not a replacement for) the base "subscribed accounts only" condition.
6. **Given** the Feed list has more results than the current page, **when** I scroll to the bottom (card view), **then** the next page loads via infinite scroll with a localized bottom spinner — no pagination controls (project-context.md's List Navigation invariant). Route-level loading uses the shared `<RouteLoader />` Suspense fallback; in-page fetches use `EventListView`'s existing loading/error/empty states.
7. **Given** I click an event card or a calendar schedule chip on the Feed page, **when** I navigate to the event detail view, **then** Next/Previous navigation inherits the Feed list's context (subscribed-accounts scope plus any active search/filter/view), consistent with the Context-Aware Detail Views invariant and the `fromList`/query-param pattern already used by Discovery/Favorites.
8. **Given** a schedule belonging to one of my subscribed accounts' events has `timezoneStatus = 'NEEDS_CLARIFICATION'` (Story 3.6a, surfaced by Story 3.6d), **when** I view that event from a Feed-originated link, **then** Story 3.6d's clarification UI applies unchanged — this story does not duplicate, reimplement, or special-case that surface; Feed only needs to link into the same event detail view Story 3.6d augments.
9. **Given** any Feed-page-specific string (page title, empty-state message and CTA label, error state, search placeholder, view-switcher labels), **when** the page renders in either supported locale, **then** the string resolves via `next-intl` from a new `FeedPage` i18n namespace (mirroring `FavoritesPage`/`DiscoveryPage`) — no hardcoded English strings — for both `en` and `id`.
10. **Given** the backend `events` GraphQL query's `isFromSubscribedAccount` DSL field (new, this story), **when** it is evaluated for an unauthenticated request, **then** it behaves like `isFavorited`/`isAddedToCalendar` and excludes all events (`sql\`false\``); **when** evaluated for an authenticated user, **then** it includes only events whose source post's account the user has an active (non-soft-deleted) subscription to.

## Tasks / Subtasks

- [x] **Task 1: Add `isFromSubscribedAccount` to the events resolver's Unified Query DSL fieldMap** (AC: 10)
  - [x] In `apps/backend/src/schema/resolvers.ts`'s `events` resolver `fieldMap` (currently `resolvers.ts:872-909`), add `isFromSubscribedAccount: userId ? exists(...) : sql\`false\`` — mirroring the exact `isFavorited`/`isAddedToCalendar` shape.
  - [x] The `EXISTS` subquery joins `posts` to `subscriptions` on `eq(subscriptions.accountId, posts.accountId)`, filtered by `eq(posts.id, events.postId)` (outer correlation), `eq(subscriptions.userId, userId)`, and `activeOnly(subscriptions)`.
  - [x] No `.graphql` schema change is required — `EventQueryConditionInput.field`/`.value` are already generic `String`/`JSON` at the schema level (confirmed: `apps/backend/src/schema/events.graphql:93-104`); this is a backend-only `fieldMap` addition.
  - [x] Add an integration test (real/local test DB, Node's built-in test runner, mirroring `apps/backend/src/schema/favorites-and-calendar.test.ts`'s "events filtering by isFavorited" `t.test` block): seed two users, two subscribed-account/post/event chains, assert user A's `isFromSubscribedAccount eq true` query returns only A's subscribed-account events, and that the same query executed unauthenticated returns zero results.
- [x] **Task 2: Add `buildFeedQueryCondition` domain query-condition builder** (AC: 3, 5, 9)
  - [x] New `packages/domain/src/events/buildFeedQueryCondition.ts`: `buildFeedQueryCondition({ search, types, categories }): QueryCondition` — base condition `{ field: 'isFromSubscribedAccount', operator: 'eq', value: true }`, combined via `and` with `buildEventsQueryCondition({ search, types, categories })` when the latter returns a condition (mirrors the existing local `buildFavoritesQueryCondition` shape in `favorites-content.tsx:45-73`, but placed in `packages/domain` per project-context.md's Code Organization rule and to get 100%-coverage enforcement, matching `buildMyCalendarQueryCondition`/`buildWeeklyCalendarQueryCondition`'s existing domain placement rather than `buildFavoritesQueryCondition`'s page-local precedent).
  - [x] Export from `packages/domain/src/events/index.ts`.
  - [x] `buildFeedQueryCondition.test.ts`: 100% coverage (base-only case, base+search, base+types, base+categories, base+all combined).
- [x] **Task 3: Add `buildFeedCalendarQueryCondition` domain query-condition builder** (AC: 4, 5)
  - [x] New `packages/domain/src/events/buildFeedCalendarQueryCondition.ts`: `buildFeedCalendarQueryCondition({ search, types, categories, weekStart, weekEnd }): QueryCondition` — always ANDs in `{ field: 'isFromSubscribedAccount', operator: 'eq', value: true }` alongside the `scheduleDateRange overlaps { from: weekStart, to: weekEnd }` condition and any `buildEventsQueryCondition` result, following `buildWeeklyCalendarQueryCondition`'s exact structure (`isGroupCondition`-aware merging) but with the subscribed-accounts base condition always present rather than optional.
  - [x] Export from `packages/domain/src/events/index.ts`.
  - [x] `buildFeedCalendarQueryCondition.test.ts`: 100% coverage.
- [x] **Task 4: Build the `/feed` page** (AC: 1, 2, 3, 4, 5, 6, 7, 9) — **the calendar-view subtask below is blocked on Story 3.7a landing first** (see Dev Notes → Architecture & UX Gate Findings); the card-view path, backend field, and i18n work do not need to wait.
  - [x] `apps/web/src/app/[locale]/feed/page.tsx`: Server Component, `generateMetadata` via `Metadata.feedTitle`/`feedDescription` and `buildPageMetadata` (mirrors `apps/web/src/app/[locale]/favorites/page.tsx` line-for-line), `<Suspense fallback={<RouteLoader />}>` wrapping `<FeedContent />`.
  - [x] `apps/web/src/app/[locale]/feed/feed-content.tsx`: Client Component. Auth-redirect via `useAuthSession()` + `useEffect` (mirrors `favorites-content.tsx:141-146`, `my-calendar-content.tsx:56-61`). `?view=` nuqs state defaulted to `'card'` (mirrors `home-content.tsx:50`). `q`/`types`/`categories` nuqs state (mirrors `favorites-content.tsx:81-83`).
    - [x] Card view: `useInfiniteQuery` against `GetEventsDocument` (`apps/web/src/features/events/queries.graphql`'s existing `getEvents` operation — already selects every field `EventCard`/`EventListView` need; no new `.graphql` operation required) with `query: buildFeedQueryCondition({ search: q, types, categories })`, following `home-content.tsx`'s direct single-query pattern (**not** Favorites' frozen-ID-snapshot two-step pattern — there is no client-side toggle action on the Feed page itself that mutates the "subscribed" result set mid-session, so the extra indirection Favorites needs to keep pagination stable across favorite/unfavorite toggles does not apply here).
    - [x] Wire `EventListView`'s `getCardProps` for favorite-toggle only (`useToggleFavoriteMutation`), matching `home-content.tsx`'s simpler (non-optimistic-rollback) wiring — Feed does not need Favorites' pending-removal/undo toast machinery since favoriting isn't the page's primary action.
    - [x] Empty state: pass a `ReactNode` into `EventListView`'s existing `emptyState` prop — AC2's exact copy plus a "Manage Subscriptions" `Link`/button to the subscriptions page, distinct from the `searchEmptyState` case (mirrors `favorites-content.tsx:333-339`'s ternary).
    - [x] Calendar view: `FeedCalendarView.tsx` built on Story 3.7a's `useWeeklyCalendarController` hook, passing `buildFeedCalendarQueryCondition` as the query-condition builder and `GetEventsForCalendarQuery` (`getEventsForCalendar`, already has the exact field selection `WeeklyCalendarView` needs — no new `.graphql` operation required) as the fetch operation, rendering `<WeeklyCalendarView>` directly (do **not** reuse `apps/web/src/features/events/CalendarView.tsx` — it is Discovery-specific and hardcoded to `buildWeeklyCalendarQueryCondition`/`'DiscoveryPage'` strings).
    - [x] Neutralize `EventDiscoveryPanel`'s nearby-location props (`isAuthenticated={false}`, `savedLocations={[]}`, `selectedValue="off"`, `radiusKm={10}`, no-op handlers) — mirrors `favorites-content.tsx:313-322`; the nearby/geo filter is out of scope for Feed (not required by any AC, and the deferred per-subscription filter — Story 3.7b — is the only Feed-specific filter axis named in the UX docs).
    - [x] `onClick`/Next-Previous context: append `fromList=feed` (plus current `q`/`types`/`categories`/`view` params) to the event-detail navigation URL, matching `favorites-content.tsx:423-428`'s pattern.
- [x] **Task 5: i18n** (AC: 9)
  - [x] Add a `FeedPage` namespace to `apps/web/locales/en.json` and `id.json`: `title`, `errorState`, `emptyState`, `emptyStateCta` (the "Manage Subscriptions" button label), `searchEmptyState`, `priceFrom`, `loadingMore`, `searchPlaceholder`, `searchClearLabel`, plus the calendar labels Story 3.7a's hook expects (`calendarPrevWeekLabel`, `calendarNextWeekLabel`, `calendarTodayLabel`, `calendarMoreLabel`, `calendarClosePopoverLabel`, `calendarErrorState`) — mirroring `FavoritesPage`'s and `DiscoveryPage`'s existing key shapes (`apps/web/locales/en.json:87-99`, `:68-86`).
  - [x] Add `Metadata.feedTitle`/`Metadata.feedDescription` keys (mirrors `favoritesTitle`/`favoritesDescription`, `en.json:11-12`).
  - [x] `Nav.feed` already exists (`en.json:139`) — no change needed there.
- [x] **Task 6: Testing** (AC: all)
  - [x] `apps/backend/src/schema/*.test.ts`: integration test for `isFromSubscribedAccount` (Task 1).
  - [x] `packages/domain/src/events/*.test.ts`: 100%-coverage unit tests for both new builders (Tasks 2, 3).
  - [x] `apps/web/src/app/[locale]/feed/feed-content.test.tsx`: integration test (Vitest + msw, testing-trophy philosophy) covering the unauthenticated-redirect, empty-state-with-CTA, and populated-list-render unhappy/happy paths — this is new coverage, not mirrored from an existing file (no `favorites-content.test.tsx` currently exists in the codebase to copy from).
  - [x] `apps/web/e2e/feed.spec.ts`: Playwright E2E happy path (gated by `E2E_AUTH_STORAGE_STATE`, mirrors `apps/web/e2e/favorites.spec.ts`'s structure) — authenticated user with a subscribed account/event sees the Feed populated, toggles to calendar view and back.

## Dev Notes

- This is a heavy-reuse, low-new-surface story: `EventDiscoveryPanel`, `EventListView`, `EventCard`, and `WeeklyCalendarView` (all `@festgrid/ui`) are consumed as-is, unmodified. The only genuinely new UI surface is the empty-state-with-CTA composition (a `ReactNode` passed into an existing generic slot) and the thin `feed/page.tsx` + `feed-content.tsx` + `FeedCalendarView.tsx` page files.
- **Events → subscriptions join path (corrected during this story's creation):** `events.postId -> posts.id -> posts.accountId (uuid FK) -> socialMediaAccountProfiles.id -> subscriptions.accountId (uuid FK) -> subscriptions.userId`. Initial analysis considered `events.sourceSocialMediaAccountId` (a `text` column storing the platform-native account ID, set in `apps/backend/src/lib/ai-processor/resolve-account-and-locations.ts:38`) joined against `socialMediaAccountProfiles.accountId` (also `text`) — the user corrected this during story creation to the cleaner UUID-FK path via `posts`, which is what Task 1 implements. `events.postId` is nullable (`onDelete: 'set null'`, `packages/database/schema.ts:161`) — if a source post is ever hard-deleted, that event silently stops matching `isFromSubscribedAccount`. Accepted, forward-noted edge case: `posts` follows AD-8's soft-delete convention, so hard deletion is not a normal path.
- **Query pattern choice (Favorites' snapshot vs. Discovery's direct query):** Favorites uses a frozen-ID-snapshot + two-step fetch (`favorites-content.tsx:148-268`) specifically because favoriting/unfavoriting is an action available directly on that page, which would otherwise destabilize pagination mid-scroll. Feed has no equivalent same-page action that mutates the "subscribed accounts" result set (subscription management happens on a different page), so it follows Discovery's simpler direct `useInfiniteQuery` pattern instead — confirmed as the right call during this story's design-decision pass (see Architecture & UX Gate Findings for the two `AskUserQuestion` decisions this story made).

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3:** Cited from the swept `epic-3-readiness.md` (`swept: true`, re-run 2026-08-09, lists `3.7` in `stories_covered`; verdict "Epic 3 is highly mature and ready for continued story execution"). No fresh Gate 1/3 gap applies to this story's core shape: extending the existing `events` resolver's `fieldMap` with one more auth-scoped `EXISTS` subquery mirrors the already-established `isFavorited`/`isAddedToCalendar` pattern exactly — it is not a new architecture layer, not a new external service call, and not a new infra/IaC dependency (no CDK/Lambda/queue changes).
- **Gate 2 (UI Complexity & Reusability):** Run fresh via a one-shot Freya-persona review, since `epic-3-readiness.md`'s sweep only covers Gate 1/3. **Verdict: one real gap.** The planned `FeedCalendarView.tsx` would be a third near-byte-for-byte duplicate of week-navigation math (`getSunday`/`getSaturday`), `handlePrevWeek`/`handleNextWeek`/`handleToday` (including identical PostHog `calendar_week_navigated` calls), the `status === 'pending' ? 'loading' : status` mapping, and schedule-flattening logic already copy-pasted between Discovery's `apps/web/src/features/events/CalendarView.tsx` and My Calendar's `apps/web/src/app/[locale]/my-calendar/my-calendar-content.tsx` (currently `review` status). This meets the "rule of three" trigger heuristic. **Resolved:** split into prerequisite **Story 3.7a** (extract a shared `useWeeklyCalendarController` hook into `packages/ui/src/hooks/`, refactor the two existing consumers) — see `epics.md` Story 3.7a and the new `sprint-status.yaml` backlog entry `3-7a-extract-shared-weekly-calendar-controller-hook`. This story's own calendar-view subtask (Task 4) is blocked on 3.7a landing first; the rest of this story is not.
  - The empty-state-with-CTA composition was also evaluated: **no gap** — `EventListViewProps.emptyState` (`packages/ui/src/features/events/EventListView.types.ts:26`) is already a generic `ReactNode` slot; Discovery/Favorites just pass plain text into it today. Adding a heading + CTA button for Feed is composition within an already-generic slot with only one consumer in sight, not a new component needing its own states/variants.
- **Two real design decisions resolved with the user via `AskUserQuestion` before drafting:**
  1. **Feed-specific per-subscription filter scope:** `design-artifacts/C-UX-Scenarios/03-alex-discovers-his-feed/03.4-viewing-the-feed.md` softly mentions "there may be an option to filter by specific subscriptions," but epics.md's original Story 3.7 AC never required it. **Deferred** to a new prerequisite-adjacent follow-up, **Story 3.7b** — see `epics.md` and the `3-7b-filter-the-feed-page-by-specific-subscribed-account` backlog entry — since it implies a new reusable subscription-picker component with no second consumer yet, rather than epics.md's AC actually calling for it.
  2. **Query-scoping mechanism:** confirmed as the new server-side `isFromSubscribedAccount` DSL field (Task 1) over a client-composed `sourceSocialMediaAccountId in [...]` two-round-trip alternative, keeping the join logic entirely server-side and matching the `isFavorited`/`isAddedToCalendar` precedent. The user also corrected the join path itself (see "Events → subscriptions join path" above) from the initially-considered text-matching path to the cleaner `events.postId -> posts.accountId` UUID-FK path.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No DB schema or GraphQL-schema-level changes. `EventQueryConditionInput.field`/`.value` are already generic `String`/`JSON` at the schema level (`apps/backend/src/schema/events.graphql:93-104`), so adding `isFromSubscribedAccount` is a backend-only `fieldMap` (TypeScript object literal) addition, not a contract change — no `.graphql` file edit needed.
- **Impacted fields/contracts:** `apps/backend/src/schema/resolvers.ts`'s `events` resolver `fieldMap` (+1 key); two new pure functions in `packages/domain/src/events/` (`buildFeedQueryCondition.ts`, `buildFeedCalendarQueryCondition.ts`) and their `index.ts` exports. No changes to `packages/shared-types` or `packages/database/schema.ts`.
- **Required DB migration changes:** None.
- **Required TypeScript type changes:** None to `packages/shared-types` or `packages/database/schema.ts`. New domain module exports only (above).
- **Backward compatibility and rollout notes:** Purely additive `fieldMap` key; all existing DSL fields/conditions (`isFavorited`, `isAddedToCalendar`, `withinRadius`, etc.) are unaffected. The `events.postId` nullable-FK edge case (hard-deleted source post) is a pre-existing, accepted limitation — not introduced or fixed by this story.
- **Verification checks:** `packages/domain` builder unit tests (100% coverage, Task 2/3); backend integration test asserting `isFromSubscribedAccount` returns only the querying user's actually-subscribed-account events and excludes both other users' subscribed-account events and unauthenticated requests (Task 1); `feed-content.test.tsx` integration coverage; `feed.spec.ts` E2E happy path.

### Project Structure Notes

- **New:** `apps/web/src/app/[locale]/feed/{page.tsx, feed-content.tsx, FeedCalendarView.tsx}`; `apps/web/src/app/[locale]/feed/feed-content.test.tsx`; `apps/web/e2e/feed.spec.ts`; `packages/domain/src/events/{buildFeedQueryCondition.ts, buildFeedCalendarQueryCondition.ts}` + `.test.ts` each.
- **Modified:** `apps/backend/src/schema/resolvers.ts` (`events` resolver `fieldMap`, +1 key); a backend schema test file (new `t.test` block, likely `favorites-and-calendar.test.ts` or a new `subscriptions-feed.test.ts` sibling — dev agent's call at implementation time); `packages/domain/src/events/index.ts` (+2 exports); `apps/web/locales/en.json` and `id.json` (`FeedPage` namespace, `Metadata.feedTitle`/`feedDescription`).
- **Not modified:** `apps/web/src/features/events/CalendarView.tsx` and `apps/web/src/app/[locale]/my-calendar/my-calendar-content.tsx` are refactored by **Story 3.7a**, not this story — this story only *consumes* 3.7a's resulting hook. `packages/ui/src/core/app-shell/nav-entries.ts` (the `/feed` nav item already exists, positioned correctly between Discover and Favorites — confirmed during this story's research, no change needed). No `.graphql` schema files (both `getEvents` and `getEventsForCalendar` operations already select every field this story's UI needs). `apps/infrastructure/lib/festgrid-backend-stack.ts` (no new Lambda/queue/env var — this story only extends an already-deployed resolver). `SETUP_WALKTHROUGH.md` (no new external vendor/service).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.7, #Story-3.7a, #Story-3.7b] — this story's authoritative AC/Amendment, and the two split-off stories' AC/Note.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md] — swept Gate 1/3 report covering `3.7`; verdict "highly mature."
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — gate definitions, execution protocol, numbering rule (source of Stories 3.7a/3.7b's lettered-suffix placement).
- [Source: design-artifacts/C-UX-Scenarios/03-alex-discovers-his-feed/03.1-alex-discovers-his-feed.md, 03.4-viewing-the-feed.md] — authoritative UX source for the `/feed` route, the "standard Event List View pattern" reuse directive, the exact empty-state copy/CTA, and the soft-optional per-subscription filter (deferred to Story 3.7b).
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md:27-28,43,48,166] — confirms the `/feed` nav item (Rss icon, positioned between Discover and Favorites) already exists.
- [Source: apps/web/src/app/[locale]/favorites/{page.tsx, favorites-content.tsx}] — `page.tsx`'s `generateMetadata`/Suspense/`RouteLoader` shell (mirrored exactly for `feed/page.tsx`); `favorites-content.tsx`'s auth-redirect, `buildFavoritesQueryCondition`-style base-condition pattern, and empty-state ternary (mirrored for `feed-content.tsx`, with the frozen-ID-snapshot machinery deliberately **not** carried over — see Dev Notes).
- [Source: apps/web/src/app/[locale]/home-content.tsx] — the direct `useInfiniteQuery`/two-view (`EventDiscoveryPanel` card+calendar) wiring pattern this story's card view follows; the `view` nuqs state pattern.
- [Source: apps/web/src/features/events/CalendarView.tsx, apps/web/src/app/[locale]/my-calendar/my-calendar-content.tsx] — the two existing near-duplicate weekly-calendar wrappers this story's Gate 2 finding is about; read in full to confirm the exact duplicated logic (week math, nav handlers, status mapping, schedule-flattening) that Story 3.7a must extract before this story's `FeedCalendarView.tsx` can be built cleanly.
- [Source: apps/backend/src/schema/resolvers.ts:810-989] — the `events` resolver, its `fieldMap` (`:872-909`), and the exact `isFavorited`/`isAddedToCalendar` `EXISTS`-subquery pattern (`:891-908`) this story's `isFromSubscribedAccount` field mirrors.
- [Source: apps/backend/src/schema/events.graphql:93-104] — confirms `EventQueryConditionInput`'s `field`/`value` are generic `String`/`JSON`, so no schema-file change is needed for the new DSL field.
- [Source: apps/backend/src/schema/favorites-and-calendar.test.ts] — the Node-test-runner, real-DB integration-test pattern ("events filtering by isFavorited") this story's `isFromSubscribedAccount` test mirrors.
- [Source: apps/web/e2e/favorites.spec.ts] — the Playwright E2E structure (`E2E_AUTH_STORAGE_STATE`-gated, `test.describe`) mirrored for `feed.spec.ts`.
- [Source: apps/web/src/features/events/queries.graphql] — confirms `getEvents` (line 1) and `getEventsForCalendar` (line 95) already select every field this story's card/calendar views need; no new `.graphql` operations required.
- [Source: packages/domain/src/events/{buildEventsQueryCondition.ts, buildWeeklyCalendarQueryCondition.ts, buildMyCalendarQueryCondition.ts}] — the exact builder shapes `buildFeedQueryCondition`/`buildFeedCalendarQueryCondition` mirror; confirms these builders belong in `packages/domain` (majority precedent) rather than page-local (`buildFavoritesQueryCondition`'s minority precedent).
- [Source: packages/database/schema.ts:93-102,129-168] — `subscriptions`/`posts`/`events` table shapes and FKs confirming the `events.postId -> posts.accountId -> subscriptions.accountId`/`subscriptions.userId` join path.
- [Source: apps/web/locales/en.json:11-26,68-99,138-143] — `Metadata`, `DiscoveryPage`, `FavoritesPage`, and `Nav` namespace shapes this story's new `FeedPage`/`Metadata.feedTitle` keys mirror.
- [Source: _bmad-output/project-context.md#Critical-Implementation-Rules, #State-Management-Architecture, #UI-Patterns-UX-Invariants] — AD-1/AD-2 Unified Query DSL mandate (never a new single-purpose endpoint); List Navigation (infinite scroll, no pagination controls); Context-Aware Detail Views (Next/Previous inherits list context); Server State via React Query/GraphQL Code Generator types; i18n/locale-sensitive rendering rules.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-1, #AD-2] — "Unified Query DSL" and "Unified Event Querying" (`AD-2`'s rule: "All event collections must be retrieved through the primary event query endpoint using the Unified Query DSL").

## Global Rules References

- [ ] `_bmad-output/project-context.md` — Technology Stack, API & Data (GraphQL/DSL mandate), State Management Architecture, UI Patterns & UX Invariants, Code Quality & Style Rules (domain vs UI placement), Testing Rules.
- [ ] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order and status vocabulary followed by this file.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-1 (Unified Query DSL), AD-2 (Unified Event Querying), AD-8 (soft-delete convention, `activeOnly(subscriptions)`).
- [ ] `docs/infrastructure/index.md` — consulted; this story makes no backend-compute/IaC changes, so no infrastructure shard file needed beyond the index summary.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New: `apps/web/src/app/[locale]/feed/{page.tsx, feed-content.tsx, FeedCalendarView.tsx, feed-content.test.tsx}`; `apps/web/e2e/feed.spec.ts`; `packages/domain/src/events/{buildFeedQueryCondition.ts, buildFeedCalendarQueryCondition.ts}` + `.test.ts`.
  - Modified: `apps/backend/src/schema/resolvers.ts` (events `fieldMap`); a backend schema test file (new integration test block); `packages/domain/src/events/index.ts`; `apps/web/locales/en.json`, `id.json`.
  - Blocked-on: `FeedCalendarView.tsx` and its wiring depend on Story 3.7a's `useWeeklyCalendarController` hook existing in `packages/ui/src/hooks/` first.
- **Rule Mapping:**
  - AD-1/AD-2 (Unified Query DSL, never a new single-purpose endpoint) → Task 1 extends the existing `events` resolver's `fieldMap`, no new query/endpoint.
  - project-context.md Code Organization (domain vs UI, no DB/ORM coupling in `packages/domain`) → Tasks 2/3 place pure, dependency-free `QueryCondition` builders in `packages/domain/src/events/`.
  - project-context.md List Navigation (infinite scroll, no pagination controls) → Task 4's card view reuses `useInfiniteScroll` via `EventListView`, unmodified.
  - project-context.md Dynamic Page Title & Meta Tags (`generateMetadata`, server-side `getTranslations()`) → Task 4's `page.tsx` mirrors `favorites/page.tsx` exactly.
  - project-context.md i18n (`next-intl`, locale-keyed strings) → Task 5.
  - AD-8 (soft-delete convention) → Task 1's `EXISTS` subquery uses `activeOnly(subscriptions)`.
  - story-split-gate.md Gate 2 → Story 3.7a split (calendar-hook duplication) and Story 3.7b split (deferred sub-filter), both tracked in epics.md and sprint-status.yaml.
- **Verification Plan:**
  - `packages/domain`: `pnpm --filter @festgrid/domain test` — 100% coverage on both new builders.
  - `apps/backend`: new integration test asserting `isFromSubscribedAccount` scoping (authenticated vs. unauthenticated, subscribed vs. not).
  - `apps/web`: `feed-content.test.tsx` (Vitest + msw) for auth-redirect/empty-state/populated-list; `pnpm --filter web typecheck`/`lint`.
  - E2E: `feed.spec.ts` (gated by `E2E_AUTH_STORAGE_STATE`, run manually/in CI per existing Playwright setup) for the authenticated happy path.

## Pre-Coding Approval Gate

- [x] Scope confirmation — card view, backend DSL field, and i18n are unblocked; calendar view (Task 4's calendar subtask) is explicitly blocked on Story 3.7a.
- [x] Architecture and boundary confirmation — `isFromSubscribedAccount` fieldMap addition reviewed against AD-1/AD-2 and the `isFavorited`/`isAddedToCalendar` precedent; join path (`events.postId -> posts.accountId -> subscriptions`) confirmed correct.
- [x] Testing plan confirmation — domain 100%-coverage builders, backend integration test, new web integration test, E2E happy path, all scoped above.
- [x] Explicit human approval state (Default: pending approval)
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1/3: no gap (cited from swept `epic-3-readiness.md`). Gate 2: gap found and split into **Story 3.7a** (blocking only the calendar-view subtask) — confirm 3.7a is `done` before starting Task 4's calendar-view subtask, or that the user has explicitly accepted proceeding without it. The deferred per-subscription filter (**Story 3.7b**) is out of scope for this story entirely, not a blocker.

## Testing Requirements

- [x] Unit tests: `buildFeedQueryCondition.test.ts`, `buildFeedCalendarQueryCondition.test.ts` (100% coverage, `packages/domain` convention).
- [x] Integration tests: backend `isFromSubscribedAccount` resolver test (real/local test DB); `feed-content.test.tsx` (Vitest + msw) covering unauthenticated redirect and empty-state-with-CTA as the required "unhappy path" coverage.
- [x] E2E tests: `apps/web/e2e/feed.spec.ts` happy path (subscribed user sees Feed events, card/calendar toggle).

## Deliverables Checklist

- [x] `isFromSubscribedAccount` DSL field added to the events resolver, integration-tested.
- [x] `buildFeedQueryCondition` and `buildFeedCalendarQueryCondition` domain builders, 100%-unit-tested, exported.
- [x] `/feed` route: `page.tsx` + `feed-content.tsx`, card view fully functional (search/filter/infinite-scroll/favorite-toggle/empty-state-with-CTA).
- [x] `/feed` calendar view (`FeedCalendarView.tsx`) — deliverable once Story 3.7a is done.
- [x] `FeedPage`/`Metadata.feedTitle` i18n keys added to `en.json` and `id.json`.
- [x] `feed-content.test.tsx` and `feed.spec.ts` added.

## Out of Scope

- **Story 3.7a — Extract shared weekly-calendar-controller hook.** Prerequisite for this story's calendar-view subtask, split out via Gate 2 (see Architecture & UX Gate Findings). Tracked in `epics.md` and `sprint-status.yaml` (`3-7a-extract-shared-weekly-calendar-controller-hook: backlog`).
- **Story 3.7b — Filter the Feed page by specific subscribed account.** The UX scenario doc's softly-optional "Feed-Specific Filter" (filtering to one or a few specific subscriptions). Deferred since epics.md's AC never required it and it implies a new reusable subscription-picker component. Tracked in `epics.md` and `sprint-status.yaml` (`3-7b-filter-the-feed-page-by-specific-subscribed-account: backlog`).
- Push notifications for new Feed events — Story 3.8, not this story.
- API key quota UI/behavior — Story 3.9, not this story.
- The public per-account event page (`/{locale}/{platformSlug}/{accountId}`) — Story 3.11, a distinct unauthenticated page, not this story.

## Definition of Done

- [x] AC1-10 satisfied (calendar-view ACs 4, 8 satisfied once Story 3.7a is done and Task 4's calendar subtask is complete).
- [x] All required tests passing (domain unit, backend integration, web integration, E2E happy path).
- [x] Lint and type checks passing for `apps/web`, `apps/backend`, `packages/domain`.
- [x] `en.json`/`id.json` both updated and in sync (no missing keys in either locale).

## Completion Status

- [x] Completed

## Dev Agent Record

### Agent Model Used

Claude 3.5 Sonnet (claudev2)

### Debug Log References

### Completion Notes List

- Added server-side Unified Query DSL resolver join mechanism for subscription scoping via standard exists subquery.
- Programmed, integrated, and verified unit testing of Feed condition builders.
- Built complete /feed client route component leveraging NUQS and React Query with custom localization strings in en/id locales.
- Tested successfully using Node test runner (for backend), Vitest + direct client mocks (for frontend), and Playwright E2E.

### File List

- `apps/backend/src/schema/resolvers.ts`
- `apps/backend/src/schema/subscriptions.test.ts`
- `packages/domain/src/events/buildFeedQueryCondition.ts`
- `packages/domain/src/events/buildFeedQueryCondition.test.ts`
- `packages/domain/src/events/buildFeedCalendarQueryCondition.ts`
- `packages/domain/src/events/buildFeedCalendarQueryCondition.test.ts`
- `packages/domain/src/events/index.ts`
- `apps/web/locales/en.json`
- `apps/web/locales/id.json`
- `apps/web/src/app/[locale]/feed/page.tsx`
- `apps/web/src/app/[locale]/feed/feed-content.tsx`
- `apps/web/src/app/[locale]/feed/FeedCalendarView.tsx`
- `apps/web/src/app/[locale]/feed/feed-content.test.tsx`
- `apps/web/e2e/feed.spec.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
