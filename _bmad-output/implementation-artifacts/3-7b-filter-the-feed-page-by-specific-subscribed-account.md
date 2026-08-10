# Story 3.7b: Filter the Feed page by specific subscribed account

## Story Details

- Epic: 3
- Story ID: 3.7b
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user with multiple social media account subscriptions,
I want to narrow my Feed to events from one or a few specific subscribed accounts,
so that I can focus on a subset of my subscriptions instead of always seeing everything at once.

## Acceptance Criteria

1. **Given** I am on the `/feed` page and have more than one active subscription, **when** I view the page filters, **then** I see a new "Subscription" filter alongside the search, type, and category filters.
2. **Given** I open the subscription filter, **when** the filter triggers, **then** it lists all of my active (non-soft-deleted) subscriptions, showing each account's platform icon/badge and display name (or username if display name is absent).
3. **Given** I select one or more subscribed accounts from the list, **when** the filter is applied, **then** the Feed's card and calendar results immediately narrow to display only events sourced from those specific accounts.
4. **Given** active subscription filters are selected, **when** I use the search, type, or category filters, **then** the subscription filter is combined with those filters (results must satisfy all active filters).
5. **Given** a subscription filter is selected, **when** I refresh the page or share the URL, **then** the subscription selection is preserved in the URL search parameters as `?subscriptions=` using `nuqs` (comma-separated list of profile IDs), SSR-friendly.
6. **Given** I have exactly one active subscription, **when** I load the `/feed` page, **then** the subscription filter is hidden by default (unnecessary UI clutter since filtering would just show the same single-subscription results or nothing).
7. **Given** any subscription filter UI string (labels, placeholders, empty-select state), **when** the page renders, **then** the string resolves via `next-intl` from the `FeedPage` i18n namespace — no hardcoded English strings — for both `en` and `id`.

## Tasks / Subtasks

- [ ] **Task 1: Add `socialMediaAccountProfileId` to the events resolver's Unified Query DSL fieldMap** (AC: 3, 4)
  - [ ] In `apps/backend/src/schema/resolvers.ts`'s `events` resolver `fieldMap` (currently `:872-909`), add `socialMediaAccountProfileId: posts.accountId` — mapping the field name directly to the joined `posts` table's `accountId` UUID column.
  - [ ] Since `posts` is already `leftJoin`ed in the main query (`resolvers.ts:953` and total count `:935`), no extra query joins are needed.
  - [ ] Add an integration test in `apps/backend/src/schema/subscriptions.test.ts` (or as a new block): assert that passing `socialMediaAccountProfileId` with operator `in` or `eq` to the primary `events` query correctly restricts the returned event items to those originating from the specified account profiles.
- [ ] **Task 2: Extend `buildFeedQueryCondition` domain query-condition builder** (AC: 3, 4, 5)
  - [ ] Update `packages/domain/src/events/buildFeedQueryCondition.ts` and its interface `BuildFeedQueryConditionInput` to accept an optional `subscriptions?: string[]` (the array of selected profile UUIDs).
  - [ ] If `subscriptions` is provided and has length > 0, append `{ field: 'socialMediaAccountProfileId', operator: 'in', value: subscriptions }` to the query conditions using `and`.
  - [ ] Update `buildFeedQueryCondition.test.ts` to cover the new parameter with 100% unit test coverage.
- [ ] **Task 3: Extend `buildFeedCalendarQueryCondition` domain query-condition builder** (AC: 3, 4, 5)
  - [ ] Update `packages/domain/src/events/buildFeedCalendarQueryCondition.ts` and its interface `BuildFeedCalendarQueryConditionInput` to accept `subscriptions?: string[]`.
  - [ ] Append the `{ field: 'socialMediaAccountProfileId', operator: 'in', value: subscriptions }` condition alongside the subscription scoping and overlap checks.
  - [ ] Update `buildFeedCalendarQueryCondition.test.ts` to cover the new parameter with 100% unit test coverage.
- [ ] **Task 4: Build the reusable `SubscriptionPicker` component in packages/ui** (AC: 2, 7)
  - [ ] Create `packages/ui/src/features/subscriptions/SubscriptionPicker.tsx` as a reusable component.
  - [ ] It accepts `value: string[]`, `onChange: (value: string[]) => void`, and `subscriptions: Array<{ id: string, account: { id: string, platform: string, displayName: string, username: string, profileImageUrl?: string | null } }>` (or a shared type matching the `getMySubscriptions` graphql query's return type).
  - [ ] Under the hood, it consumes the generic `@festgrid/ui` `MultiSelect` component (built in Story 1.5a, located in `packages/ui/src/core/multi-select.tsx`), configuring the rendering of each item to display the platform icon/badge and name (display name or `@username`).
  - [ ] Export the component from `packages/ui/src/features/subscriptions/index.ts` and add proper types.
- [ ] **Task 5: Integrate `SubscriptionPicker` and URL State onto `/feed`** (AC: 1, 3, 4, 5, 6, 7)
  - [ ] In `apps/web/src/app/[locale]/feed/feed-content.tsx`, use the `useGetMySubscriptionsQuery` query (GraphQL, already generated and typed from `apps/web/src/features/subscriptions/queries.graphql`) to load the active user's subscriptions.
  - [ ] Declare `subscriptions` search param state using `nuqs`: `useQueryState('subscriptions', parseAsArrayOf(parseAsString, ',').withDefault([]))`.
  - [ ] If the loaded subscriptions count is > 1:
    - [ ] Render the `<SubscriptionPicker />` component inside the filter row of `<FeedContent />` (typically beside or integrated into `<EventDiscoveryPanel>` or `<FilterHub>`).
    - [ ] Pass the active subscriptions and state handlers to it.
  - [ ] In `useInfiniteQuery` (card view) and `useQuery` (calendar view), pass the selected subscription profile IDs into `buildFeedQueryCondition` and `buildFeedCalendarQueryCondition` respectively.
- [ ] **Task 6: i18n support** (AC: 7)
  - [ ] Add translation strings to the `FeedPage` namespace in `apps/web/locales/en.json` and `id.json`:
    - [ ] `subscriptionFilterLabel` (e.g. "Subscriptions" / "Langganan")
    - [ ] `subscriptionFilterPlaceholder` (e.g. "Select accounts..." / "Pilih akun...")
- [ ] **Task 7: Automated Tests** (AC: all)
  - [ ] Run backend tests: `pnpm --filter @festgrid/backend test` with new DSL test cases.
  - [ ] Run domain tests: `pnpm --filter @festgrid/domain test` with 100% coverage on new builder logic.
  - [ ] Add integration test in `apps/web/src/app/[locale]/feed/feed-content.test.tsx` (using MSW) to verify that selecting a subscription in the picker triggers the events query with the correct `socialMediaAccountProfileId` DSL parameter.
  - [ ] Add Playwright E2E test in `apps/web/e2e/feed.spec.ts` asserting that an authenticated user with multiple subscriptions can select one from the dropdown and see results narrow correctly.

## Dev Notes

- **Unified Query DSL Integration:** Rather than creating a custom endpoint or query parameter, this story utilizes the existing `events` query. This conforms to `AD-1` and `AD-2` invariants of the project.
- **Reusing MultiSelect Component:** We leverage the highly robust, pre-existing `@festgrid/ui` `MultiSelect` component (from `packages/ui/src/core/multi-select.tsx`), meaning we do not reinvent any styling, accessibility, or keyboard interaction logic.
- **URL Parameter State Management:** The filter state is fully managed in the URL using `nuqs`. This keeps the filter selection shareable, bookmarkable, and SSR-friendly, aligning with `project-context.md`'s State Management rules.
- **Conditional Filter Exposure:** The subscription filter is hidden when the user has <= 1 active subscription. This is a deliberate UX choice to avoid rendering redundant filtering controls on the page.

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3:** Cited from the swept `epic-3-readiness.md` (`swept: true`, dated 2026-08-09). There is no architectural or foundational dependency gap. The filtering uses the pre-existing server-side `leftJoin` with the `posts` table, which matches the database relationships exactly. The `useGetMySubscriptionsQuery` is a pre-existing GraphQL operation which avoids introducing any raw database queries on the frontend.
- **Gate 2 (UI Complexity & Reusability):** Evaluated fresh. The `SubscriptionPicker` component is designed as a reusable feature component inside `packages/ui/src/features/subscriptions/` rather than page-locally. It abstracts the subquery fetching details and leverages the core `MultiSelect` primitive, meaning it satisfies modularity and style tokens consistency.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No database schema migrations or `.graphql` schema additions are required. The Query DSL input `EventQueryConditionInput.field` is a generic string field. Adding `socialMediaAccountProfileId` to the `fieldMap` is pure resolver-level mapping configuration.
- **TypeScript updates:** We extend the interfaces `BuildFeedQueryConditionInput` and `BuildFeedCalendarQueryConditionInput` in `packages/domain/src/events/` with the optional `subscriptions?: string[]` array.

### Project Structure Notes

- **New:** `packages/ui/src/features/subscriptions/SubscriptionPicker.tsx` and its index file export.
- **Modified:**
  - `apps/backend/src/schema/resolvers.ts` (adds `socialMediaAccountProfileId` to `fieldMap`)
  - `apps/backend/src/schema/subscriptions.test.ts` (adds integration tests)
  - `packages/domain/src/events/buildFeedQueryCondition.ts` and its test file
  - `packages/domain/src/events/buildFeedCalendarQueryCondition.ts` and its test file
  - `apps/web/src/app/[locale]/feed/feed-content.tsx` (mounts picker and hooks up URL search state)
  - `apps/web/locales/en.json` and `id.json`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.7b] — authoritative AC and numbering rule source.
- [Source: _bmad-output/project-context.md#State-Management-Architecture] — State and URL param management guidelines.
- [Source: apps/web/src/app/[locale]/feed/feed-content.tsx] — the target file for filter integration.
- [Source: packages/ui/src/core/multi-select.tsx] — the MultiSelect primitive used under the hood.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Adhered to for directory organization, state management, testing trophies, and translation handling.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-1 (Unified Query DSL), AD-2 (Unified Event Querying).

## Implementation Plan (Rule-Compliant)

1. **Backend Integration (Task 1):** Extend `fieldMap` with `socialMediaAccountProfileId` and add backend schema test assertions.
2. **Domain Updates (Tasks 2 & 3):** Update both feed condition builders to accept the subscriptions array and generate `{ field: 'socialMediaAccountProfileId', operator: 'in', value: subscriptions }` logic. Run domain unit tests to reach 100% coverage.
3. **Picker Component (Task 4):** Build `<SubscriptionPicker />` inside `packages/ui/src/features/subscriptions/` reusing `MultiSelect` primitive.
4. **Feed Integration (Task 5):** Hook up `useGetMySubscriptionsQuery` on `/feed`, register `subscriptions` in `nuqs`, and conditionally render the picker component. Update query arguments for infinite and calendar queries.
5. **i18n & Tests (Tasks 6 & 7):** Add localization entries and write comprehensive integration/E2E tests.

## Pre-Coding Approval Gate

- [x] Scope confirmation — subscription list filter, URL persistence, picker component, and condition builder extensions fully scoped.
- [x] Architecture and boundary confirmation — Unified Query DSL usage confirmed; database join mapping is zero-risk.
- [x] Testing plan confirmation — domain coverage 100%, backend integration tests, web picker integrations, and E2E coverage mapped.
- [x] Explicit human approval state (Default: **pending approval**).
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1/3: no gap. Gate 2: run fresh, modular picker component inside `packages/ui` avoids any duplication or isolation leaks.
