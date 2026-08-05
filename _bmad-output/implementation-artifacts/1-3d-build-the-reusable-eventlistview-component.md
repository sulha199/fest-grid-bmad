---
baseline_commit: 704c86d15e26c66b94ea0695f36cba8f5e529955
---
# Story 1.3d: Build the reusable EventListView component

## Story Details

- Epic: 1 - Core App and Event Discovery
- Story ID: 1.3d
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a reusable `EventListView` presentational component in `packages/ui`,
so that the Discovery feed (`home-content.tsx`, Story 1.3) and Favorites page (`favorites-content.tsx`, Story 2.2) — and any future long event list — render the same loading/error/empty/grid/infinite-scroll shell instead of each page independently duplicating it.

## Acceptance Criteria

1. **Given** a `status` of `'loading'`, **when** `EventListView` renders, **then** it shows a skeleton grid of `EventCard`s with `loading={true}` (default count 6, `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6` layout) — matching the markup both `home-content.tsx` and `favorites-content.tsx` currently duplicate.
2. **And** **given** a `status` of `'error'`, **when** it renders, **then** it shows the caller-supplied `errorMessage` (already translated) and `errorDetail` (raw technical string, already resolved by the caller — e.g. `idSnapshotError?.message || error?.message || 'Unknown error'`) inside the existing `text-destructive`/`<pre>` markup.
3. **And** **given** a `status` of `'success'` with an empty `events` array, **when** it renders, **then** it renders the caller-supplied `emptyState: ReactNode` verbatim. The shell does not own empty-state branching — Discovery's empty state is a single search-vs-default ternary, Favorites' is a three-way search/filter condition; both stay in their page.
4. **And** **given** a `status` of `'success'` with a non-empty `events` array, **when** it renders, **then** it renders a grid of `EventCard`s where each card's `startDate`/`priceFrom` are derived internally via `event.schedules.find(s => s.isMainSchedule) || event.schedules[0]` (the identical derivation both pages duplicate today), and `eventName`/`imageUrl`/`locationName`/`categories`/`types` are read directly off `event`.
5. **And** per-event props that genuinely diverge between pages (`isFavorited`, `isGreyedOut`, `pendingRemoval`, `onFavoriteToggle`, `onClick`, `href`) are supplied via a caller-provided `getCardProps(event: TEvent) => Partial<EventCardProps>` callback, shallow-merged onto the derived props (caller's `getCardProps` result wins on any key collision).
6. **And** it renders the `useInfiniteScroll` (Story 1.3c) sentinel at the bottom of the grid, showing a localized spinner plus caller-supplied `loadingMoreLabel` while `isFetchingNextPage` is true. `EventListView` accepts `sentinelRef: (node: Element | null) => void` and `isFetchingNextPage: boolean` as props — the caller still owns its own `useInfiniteScroll(...)` call and `fetchNextPage`/`hasNextPage` wiring; this component only renders the passthrough result.
7. **And** the component defines its own minimal, generic event-shape type (`EventListViewItem`: `id`, `slug`, `eventName`, `imageUrl?`, `location?`, `categories?`, `types?`, `schedules: { isMainSchedule: boolean; eventStartDate: string; ticketPrice?: string | number | null }[]`), generic over `TEvent extends EventListViewItem`. It does **not** import any `apps/web`-generated GraphQL type (`GetEventsQuery` etc.) — matching how `EventCard` stays decoupled from any specific query shape, relying on TypeScript structural typing.
8. **And** all labels (`priceFrom`, `categoryLabels`, `typeLabels`, `favoriteToggle`) are passed in pre-translated via a `cardLabels: EventCardLabels` prop (reusing `EventCard.types.ts`'s existing `EventCardLabels` type) — `packages/ui` does not import `next-intl` directly, per `project-context.md`'s framework-agnostic UI rule.
9. **And** `home-content.tsx` is refactored to consume `EventListView`, removing its duplicated skeleton/error/empty/grid/sentinel JSX. **Zero visible behavior change:** the Sign In/Sign Out header, the unauthenticated-favorite-click login modal, and the optimistic-mutation favorite toggle (`onMutate`/`onError` cache updates) stay in `home-content.tsx`, wired through `getCardProps` and `status`/`errorMessage`/`errorDetail`/`emptyState` derived from its existing `useInfiniteQuery` `status`/`error`.
10. **And** `favorites-content.tsx` is refactored to consume `EventListView` identically. **Zero visible behavior change:** its two-stage (`idSnapshotStatus`/`status`) loading gate is collapsed into a single `status` prop (`'loading'` while either is pending, `'error'` if either errors, `'success'` otherwise — matching today's `isInitialLoading`/combined-error logic exactly); its three-branch empty-state condition, the soft-delete-with-undo grey-out (`isGreyedOut`/`pendingRemoval` via `useSoftDeleteWithUndo`), and the `?fromList=favorites&favoriteIds=...` click URL all stay wired through `getCardProps`/`emptyState`.
11. **And** View Toggles (Card/Calendar) and Filter-by-Location — both named in `design-artifacts/D-Design-System/01-event-list-view.md` but implemented nowhere in the codebase today — are explicitly out of scope. `EventListView` renders Card View only; Calendar View remains Epic 2 Story 2.6's separate concern.
12. **And** the component is documented and exported from `packages/ui`'s public entry point (`packages/ui/src/features/events/index.ts`) for reuse across features.
13. **And** integration/unit tests verify: all four `status`/empty/success render branches, `getCardProps` merge behavior (including key-collision precedence), `mainSchedule` derivation (including the fallback-to-first-schedule case), infinite-scroll sentinel/spinner passthrough, and that existing `home-content`/`favorites-content` integration tests (`page.test.tsx`, `favorites-content.test.tsx`) still pass unmodified in their assertions (DOM output must not change).

## Tasks / Subtasks

- [ ] Task 1: Build `EventListView` in `packages/ui` (AC1-AC8, AC12)
  - [ ] Create `packages/ui/src/features/events/EventListView.types.ts`: `EventListViewItem`, `EventListViewProps<TEvent extends EventListViewItem>` (status, events, errorMessage, errorDetail, emptyState, getCardProps, cardLabels, sentinelRef, isFetchingNextPage, loadingMoreLabel, optional `skeletonCount = 6`, optional `className`).
  - [ ] Create `packages/ui/src/features/events/EventListView.tsx`: renders the four `status`/empty/success branches per AC1-AC6; derives `mainSchedule` and merges `getCardProps(event)` per AC4-AC5; renders the `useInfiniteScroll` sentinel/spinner per AC6.
  - [ ] Add `EventListView`/`EventListView.types` exports to `packages/ui/src/features/events/index.ts` (AC12).
  - [ ] `packages/ui/src/features/events/EventListView.test.tsx`: cover loading skeleton count/markup, error markup with `errorMessage`/`errorDetail`, empty-state slot rendering verbatim, success grid with `mainSchedule` derivation (including fallback-to-first-schedule), `getCardProps` merge/override precedence, infinite-scroll sentinel + `loadingMoreLabel` spinner visibility while `isFetchingNextPage`.
- [ ] Task 2: Migrate `home-content.tsx` to consume `EventListView` (AC9)
  - [ ] Replace the duplicated skeleton/error/empty/grid/sentinel JSX block with `<EventListView ... />`.
  - [ ] Map `useInfiniteQuery`'s `status`/`error` to `EventListView`'s `status`/`errorMessage`/`errorDetail` props (reuse existing `t('errorState')` for `errorMessage`; `error?.message || JSON.stringify(error)` for `errorDetail`).
  - [ ] Build `emptyState` node from the existing `q.trim() ? t('searchEmptyState') : t('emptyState')` ternary.
  - [ ] Build `getCardProps(event)` returning `{ isFavorited: event.isFavorited, onFavoriteToggle: () => {...same login-modal/mutation logic...}, onClick: () => {...same navigation...} }`, preserving today's exact behavior.
- [ ] Task 3: Migrate `favorites-content.tsx` to consume `EventListView` (AC10)
  - [ ] Replace its duplicated skeleton/error/empty/grid/sentinel JSX block with `<EventListView ... />`.
  - [ ] Collapse `isInitialLoading`/`idSnapshotStatus === 'error' || status === 'error'` into a single `status` prop value, preserving today's exact loading/error timing.
  - [ ] Build `emptyState` node from the existing three-branch condition (no favorites at all vs. no results for current search/filter).
  - [ ] Build `getCardProps(event)` returning `{ isGreyedOut: !event.isFavorited || softDelete.isPending(event.id), isFavorited: event.isFavorited && !softDelete.isPending(event.id), pendingRemoval: softDelete.isPending(event.id), onFavoriteToggle: () => {...same soft-delete markPending/undo logic...}, onClick: () => {...same ?fromList=favorites&favoriteIds=... navigation...} }`, preserving today's exact behavior.
- [ ] Task 4: Regression-verify existing tests (AC13)
  - [ ] Run `apps/web/src/app/[locale]/page.test.tsx` and `apps/web/src/app/[locale]/favorites/favorites-content.test.tsx` unmodified against the refactored pages — DOM/behavior assertions must still pass without edits to the assertions themselves (test setup/mocks may need updating for the new `EventListView` import boundary, but expected rendered output must not change).
  - [ ] If either test file breaks in a way that reveals an actual behavior drift (not a test-plumbing issue), treat that as a bug introduced by this refactor and fix `EventListView`/the page — never adjust the test's expected behavior to match a drifted implementation.
- [ ] Task 5: Final checks
  - [ ] `pnpm build` / `pnpm lint` clean at the repo root.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (Architecture/Infra + Foundational Dependency Completeness):** Not re-run fresh — sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md` (`swept: true`, covers Stories 1.1-1.8 including the 1.3-family). This story introduces no new API surface, no new resolver/mutation, no new external service call, and no new project-wide tooling/foundation — it is a pure `packages/ui` presentational extraction plus a like-for-like refactor of two already-implemented pages. Lightweight guard (reasoned fresh, no subagent needed): nothing in this story's scope (no new data entity, no new external service, no new infra dependency) falls outside what the Epic 1 sweep already covers.
- **Gate 2 (UI Complexity & Reusability):** Run fresh via subagent (Freya's analytical lens) against `design-artifacts/D-Design-System/01-event-list-view.md` and the current duplicated implementation in `home-content.tsx`/`favorites-content.tsx`. Findings:
  1. **Confirmed as a valid Gate 2 split** — a component reused across ≥2 places (Discovery, Favorites) with non-trivial states (loading/error/empty/success, infinite scroll, two divergent favorite-toggle mutation strategies) is exactly the trigger heuristic's target.
  2. **Prop contract:** `status` enum pre-resolved by the caller (not shell-derived, since Favorites' two-stage loading gate is page-specific); `events: TEvent[]` accepting the raw GraphQL shape structurally, with `mainSchedule` derived internally (identical, mechanical, duplicated verbatim today); `emptyState` as a slot, not shell-owned logic (branching differs per page); `getCardProps` as a per-event callback so page-owned divergence (favorite-toggle strategy, click URL) stays with the page. This story's AC1-AC8 implement that recommendation directly.
  3. **View Toggles (Card/Calendar) and Filter-by-Location** — both named in `01-event-list-view.md` but built nowhere in the codebase — explicitly deferred (AC11). Including them here would be scope creep on a dedup/extraction story and would block on undesigned work (Calendar View is Epic 2 Story 2.6; no Location-filter story exists yet).
  4. **Current duplicated behavior is a faithful (if spec-incomplete) baseline** — Quick Favorite and real-time filter updates already match `01-event-list-view.md`; there is no spec-vs-implementation gap for this story to correct while deduplicating. The "Nearby" default state is gated behind the out-of-scope Location filter, not this story's concern.
  5. **Flagged risk, addressed by AC13/Task 4:** this story touches two already-shipped, in-review pages simultaneously with a refactor that must be behavior-preserving — explicit "zero visible behavior change" ACs (AC9, AC10) and a regression-verification task (Task 4) against the existing `page.test.tsx`/`favorites-content.test.tsx` integration tests exist specifically to catch drift, since there is no new feature-level test coverage this story would otherwise force.
  - **Verdict:** Confirmed split, scoped exactly to AC1-AC12 above; View Toggle/Calendar/Location-filter explicitly out of scope (see `## Out of Scope`).

### Retroactive Extraction Rationale

Unlike the `1.3a`/`1.3b`/`1.6a` precedent (a split positioned *before* an unbuilt consumer), this story's two consumers — Story 1.3 and Story 2.2 — are already implemented and sitting in `review`. The duplication was surfaced directly by the user after reviewing both pages' source, not by a `bmad-create-story` gate finding mid-draft of a new story. Two numbering options were considered (a `1.3d` suffix off Story 1.3, the component's true first chronological consumer and existing `1.3a/b/c` family; or a `2.2a` suffix off Story 2.2, the epic where the duplication was actually noticed); the user chose `1.3d` to keep the component's lineage grouped with its `EventCard`/`useInfiniteScroll` siblings. The user also confirmed this story's scope includes migrating both existing pages (not just building an unconsumed component), since a component nobody uses yet does not eliminate the duplication that motivated this story.

### Component Contract Summary

```ts
// packages/ui/src/features/events/EventListView.types.ts
export interface EventListViewScheduleShape {
  isMainSchedule: boolean;
  eventStartDate: string;
  ticketPrice?: string | number | null;
}

export interface EventListViewItem {
  id: string;
  slug: string;
  eventName: string;
  imageUrl?: string | null;
  location?: string | null;
  categories?: string[] | null;
  types?: string[] | null;
  schedules: EventListViewScheduleShape[];
}

export interface EventListViewProps<TEvent extends EventListViewItem> {
  status: 'loading' | 'error' | 'success';
  events: TEvent[];
  errorMessage?: string;
  errorDetail?: string;
  emptyState: React.ReactNode;
  getCardProps: (event: TEvent) => Partial<EventCardProps>;
  cardLabels?: EventCardLabels;
  sentinelRef: (node: Element | null) => void;
  isFetchingNextPage: boolean;
  loadingMoreLabel: string;
  skeletonCount?: number; // default 6
  className?: string;
}
```

`EventListView` is generic over `TEvent` purely so `getCardProps` and any future caller-side narrowing stay type-safe against the caller's actual (richer) GraphQL type — `home-content.tsx`/`favorites-content.tsx` both already type their items as `GetEventsQuery['events']['items'][number]`, which is structurally compatible with `EventListViewItem` with no adapter/mapping step required.

### i18n Keys Required (AD-6)

None new. `EventListView` itself owns no translated strings — it receives `errorMessage`, `emptyState`, `loadingMoreLabel`, and `cardLabels` already resolved by the caller via next-intl, exactly as `EventCard` already does via its `labels` prop. `home-content.tsx`/`favorites-content.tsx` continue using their existing `DiscoveryPage`/`FavoritesPage` namespace keys unchanged.

### Analytics Events Required (AD-5)

None new. This is a pure presentational refactor; both pages' existing analytics calls (`favorites_page_viewed`, `event_unfavorited`, `filter_applied`, `search_submitted`) are untouched and continue firing from the pages themselves, not from `EventListView`.

### State Management Categorization

- **Server State (`@tanstack/react-query`):** unchanged — both pages keep their own `useInfiniteQuery`/`useQuery` calls; `EventListView` is a pure presentational consumer of already-resolved state (`status`, `events`, `isFetchingNextPage`), not a data-fetching component itself.
- **URL State (`nuqs`):** unchanged — `q`/`types`/`categories` remain owned by each page.
- **Client Global State (`zustand`):** none required.

### Loader Classification

- Initial load: **Non-blocking, Skeleton** (`EventCard loading={true}` grid) — unchanged behavior, now rendered by the shared shell.
- Subsequent pages via infinite scroll: **Non-blocking, localized spinner** (`useInfiniteScroll` sentinel) — unchanged behavior, now rendered by the shared shell.

### Data Type Compatibility & Migration Requirements

No changes required. This story adds no database columns, no GraphQL schema/resolver changes, and no new generated types — it is a `packages/ui` component plus a like-for-like consumption refactor of two existing `apps/web` pages. `EventListViewItem`'s shape is a strict structural subset of `GetEventsQuery['events']['items'][number]` (already used by both pages), so no adapter/mapping layer or type assertion is needed at either call site.

### Package boundaries

- `packages/ui/src/features/events/`: new `EventListView.tsx`/`EventListView.types.ts`/`EventListView.test.tsx`, exported via the existing `index.ts`. No `next-intl`, no GraphQL-generated types, no React Query — pure presentational, consistent with `EventCard`'s existing boundary.
- `apps/web`: `home-content.tsx`/`favorites-content.tsx` keep all data-fetching, mutation, auth, analytics, and URL-state logic — only their rendering of the loading/error/empty/grid/sentinel block moves into the shared component.

### Architecture / technical constraints

- **List Navigation invariant (`project-context.md`):** infinite scroll only, no pagination controls — unchanged; `EventListView` renders the same `useInfiniteScroll` sentinel pattern both pages already use.
- **Loaders invariant:** skeleton for initial load, localized spinner for pagination — unchanged, now centralized in one component instead of duplicated.
- **Framework-agnostic `packages/ui` components:** `EventListView` accepts pre-translated strings and pre-resolved GraphQL-shaped data, matching `EventCard`'s and `SearchBar`'s/`FilterHub`'s existing pattern of not importing `next-intl` or app-specific data-fetching hooks directly.

### Previous/Sibling Story Intelligence (Stories 1.3b, 1.3c, 2.2)

- Story 1.3b (`EventCard`) already established the `labels`-prop pattern (pre-translated strings passed into a `packages/ui` component) that `EventListView`'s `cardLabels` prop reuses directly.
- Story 1.3c (`useInfiniteScroll`) is consumed, not rebuilt, by this story — `EventListView` only renders the `sentinelRef`/`isFetchingNextPage` passthrough; the caller still owns the hook call.
- Story 2.2's Dev Notes (Loader Classification, State Management Categorization sections) already documented `favorites-content.tsx`'s loading/error/empty structure in detail — this story's Task 3 migrates that structure into `EventListView` without altering the underlying `useSoftDeleteWithUndo`/id-snapshot mechanics Story 2.2 built, which are explicitly out of scope for this story (see `## Out of Scope`).

### Project Structure Notes

- New: `packages/ui/src/features/events/EventListView.tsx`, `EventListView.types.ts`, `EventListView.test.tsx`.
- Modified: `packages/ui/src/features/events/index.ts` (export additions).
- Modified: `apps/web/src/app/[locale]/home-content.tsx`, `apps/web/src/app/[locale]/favorites/favorites-content.tsx` (consume `EventListView`, remove duplicated JSX).
- Modified (verification only, no assertion changes expected): `apps/web/src/app/[locale]/page.test.tsx`, `apps/web/src/app/[locale]/favorites/favorites-content.test.tsx`.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 1.3d`]
- [Source: `_bmad-output/planning-artifacts/epics.md#Story 1.3b`, `#Story 1.3c`, `#Story 2.2`]
- [Source: `_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md`]
- [Source: `design-artifacts/D-Design-System/01-event-list-view.md`]
- [Source: `apps/web/src/app/[locale]/home-content.tsx`, `apps/web/src/app/[locale]/favorites/favorites-content.tsx`]
- [Source: `packages/ui/src/features/events/EventCard.tsx`, `EventCard.types.ts`, `index.ts`]
- [Source: `packages/ui/src/hooks/useInfiniteScroll.types.ts`]
- [Source: `_bmad-output/implementation-artifacts/1-3b-build-the-reusable-eventcard-component.md`, `1-3c-build-the-reusable-infinite-scroll-hook.md`, `2-2-view-favorited-events.md`]

## Global Rules References

- `_bmad-output/project-context.md` (UI Patterns & UX Invariants incl. List Navigation/Loaders, Code Organization, i18n rules)
- `_bmad-output/planning-artifacts/story-content-structure.md`
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md`
- `_bmad-output/planning-artifacts/epics.md` (Story 1.3d, Story 1.3b, Story 1.3c, Story 1.3, Story 2.2)
- `_bmad-output/planning-artifacts/story-split-gate.md`
- `_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md`
- `docs/infrastructure/index.md` (no infra-shard changes — frontend-only presentational extraction)

## Implementation Plan (Rule-Compliant)

### File Change Plan

- New: `packages/ui/src/features/events/EventListView.tsx`, `EventListView.types.ts`, `EventListView.test.tsx`.
- Modified: `packages/ui/src/features/events/index.ts` (export `EventListView`/types).
- Modified: `apps/web/src/app/[locale]/home-content.tsx` (consume `EventListView`; derive `status`/`errorMessage`/`errorDetail`/`emptyState`/`getCardProps`).
- Modified: `apps/web/src/app/[locale]/favorites/favorites-content.tsx` (consume `EventListView`; collapse two-stage loading gate into `status`; derive `emptyState`/`getCardProps`).
- Verified, not functionally changed: `apps/web/src/app/[locale]/page.test.tsx`, `apps/web/src/app/[locale]/favorites/favorites-content.test.tsx` (must still pass; only test-plumbing/mocks may need updates for the new import boundary).
- **Not modified:** any GraphQL schema/resolver/query document, any database schema, `EventCard.tsx`/`EventCard.types.ts` (consumed as-is), `useInfiniteScroll.ts` (consumed as-is), `useSoftDeleteWithUndo.ts` (consumed as-is by `favorites-content.tsx`, unchanged).

### Rule Mapping

- *List Navigation / Loaders (UI Patterns & UX Invariants)* → `EventListView` centralizes the existing skeleton/spinner/infinite-scroll pattern; no behavior change (AC1, AC6).
- *Code Organization (Domain vs UI)* → `EventListView` lives in `packages/ui/src/features/events/`, no React-incompatible dependencies, no `next-intl` import (AC7, AC8).
- *UI Components & Scalability* → placed under `packages/ui/src/features/events/` (domain-feature component), matching `EventCard`/`FilterHub`'s existing location convention.
- *Story-split-gate Gate 2* → confirmed split via fresh subagent analysis against `01-event-list-view.md`; View Toggle/Calendar/Location-filter scope explicitly deferred (AC11, `## Out of Scope`).

### Verification Plan

- `packages/ui`: new `EventListView.test.tsx` covering all four render branches (loading/error/empty/success), `getCardProps` merge/override precedence, `mainSchedule` derivation including the fallback-to-first-schedule case, and infinite-scroll sentinel/spinner passthrough.
- `apps/web`: existing `page.test.tsx` (home) and `favorites-content.test.tsx` re-run against the refactored pages — must pass with their existing assertions intact (Task 4); any genuine behavior drift surfaced is a bug to fix, not a test to relax.
- Manual: `pnpm build`/`pnpm lint` clean at the repo root; visually diff both pages before/after in a local run to confirm no visible regression.

## Pre-Coding Approval Gate

- [ ] Scope confirmed: build `EventListView` in `packages/ui` (AC1-AC8, AC12) and migrate both `home-content.tsx` and `favorites-content.tsx` to consume it with zero visible behavior change (AC9, AC10) — View Toggle/Calendar View/Location-filter explicitly out of scope (AC11).
- [ ] **Retroactive-extraction placement accepted:** numbered `1.3d` (off Story 1.3's `EventCard`/`useInfiniteScroll` lettered family) rather than `2.2a` or a standalone unnumbered refactor story — per explicit user decision (see Dev Notes → Retroactive Extraction Rationale).
- [ ] **Migrate-both-pages scope accepted:** this story includes refactoring both existing consumers, not just building an unconsumed component — per explicit user decision.
- [ ] Gate 1/2/3 prerequisites confirmed: Gate 1/3 sourced from swept `epic-1-readiness.md` (no gap applicable — pure frontend presentational extraction, no new data/infra surface); Gate 2 run fresh via subagent — split confirmed, prop contract and out-of-scope boundary (View Toggle/Calendar/Location-filter) accepted as documented above.
- [ ] Architecture and data/API boundaries confirmed: no GraphQL/database changes; `EventListView` stays presentation-only (no data-fetching, no `next-intl`, no GraphQL-generated types) in `packages/ui`.
- [ ] Testing plan confirmed: new `EventListView.test.tsx` in `packages/ui`; existing `page.test.tsx`/`favorites-content.test.tsx` must pass unmodified in their assertions after the refactor.
- [ ] Explicit human approval state (Default: pending approval)

## Testing Requirements

- `packages/ui`: `EventListView.test.tsx` — loading skeleton (count + markup), error markup (`errorMessage`/`errorDetail`), empty-state slot rendered verbatim, success grid with `mainSchedule` derivation (including fallback-to-first-schedule), `getCardProps` merge/override precedence, infinite-scroll sentinel + spinner visibility while `isFetchingNextPage`.
- `apps/web`: existing `page.test.tsx` (home) and `favorites-content.test.tsx` must continue passing against the refactored pages with no assertion changes (Task 4) — this is the primary regression guard for this story, since it is a behavior-preserving refactor rather than new user-facing functionality.
- Manual: `pnpm build`/`pnpm lint` clean at the repo root.

## Deliverables Checklist

- [ ] `EventListView` built in `packages/ui/src/features/events/` with types, tests, and public export.
- [ ] `home-content.tsx` migrated to consume `EventListView`, duplicated JSX removed, zero visible behavior change.
- [ ] `favorites-content.tsx` migrated to consume `EventListView`, duplicated JSX removed, zero visible behavior change.
- [ ] Existing `page.test.tsx`/`favorites-content.test.tsx` pass against the refactored pages.
- [ ] `pnpm build`/`pnpm lint` clean at the repo root.

## Out of Scope

- **View Toggles (Card View/Calendar View)** — named in `design-artifacts/D-Design-System/01-event-list-view.md`, not built anywhere today. Calendar View is Epic 2 Story 2.6's separate concern; no story yet builds a view-switcher.
- **Filter by Location (saved locations)** and the resulting **"Nearby" default state** — named in `01-event-list-view.md`, has no backing story yet (would need a new story once saved-locations filtering is prioritized).
- Any change to `favorites-content.tsx`'s id-snapshot/local-pagination mechanism, `useSoftDeleteWithUndo` integration, or `navigation-hook.ts`'s `?fromList=favorites` handling — all built by Story 2.2, consumed unchanged by this story's `getCardProps`/`status` wiring.
- Any change to `home-content.tsx`'s optimistic-mutation favorite-toggle logic, login-modal gating, or Sign In/Sign Out header — consumed unchanged via `getCardProps`.
- Adding new i18n keys, new analytics events, or new GraphQL fields/resolvers — none are needed for this refactor.

## Definition of Done

- Acceptance criteria satisfied.
- Required tests pass: new `EventListView.test.tsx` (packages/ui), existing `page.test.tsx`/`favorites-content.test.tsx` (apps/web) with no assertion changes.
- Lint and type checks pass for `packages/ui` and `apps/web`.
- Manual visual diff confirms no regression on `/` (Discovery) and `/favorites`.

## Completion Status

- [ ] Ready for review

## Dev Agent Record

### Agent Model Used

_To be filled by the dev agent._

### Debug Log References

- Story created via `bmad-create-story` at the user's explicit request, following a conversation where the user asked to identify the reusability pattern behind `home-content.tsx`/`favorites-content.tsx`'s duplicated presentational shell.
- Placement (`1.3d` vs `2.2a` vs standalone) and scope (build-only vs build-and-migrate) were both genuine tradeoffs surfaced to the user via `AskUserQuestion` before drafting, per this project's `bmad-create-story` customization requiring non-mechanical decisions to be confirmed rather than silently picked.
- Gate 2 run fresh via subagent (Freya's analytical lens) against `01-event-list-view.md` and the current duplicated implementation; confirmed the split, recommended the prop contract, and confirmed View Toggle/Calendar/Location-filter as out of scope. Gate 1/3 sourced from `epic-1-readiness.md` (`swept: true`) — no fresh gap found.

### Completion Notes List

_To be filled by the dev agent._

### File List

_To be filled by the dev agent._
