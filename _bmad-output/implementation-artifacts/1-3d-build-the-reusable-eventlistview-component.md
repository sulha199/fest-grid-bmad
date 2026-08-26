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
14. **AC14 — Grid column count scales past `lg:`, via `GridContainer` (revised 2026-08-24, same day, superseding the version committed in `fe8a1af`):** And the two `<div className={className}>` wrappers (AC1's skeleton grid, AC4's success grid) are replaced with `<GridContainer baseCols={1} colsStep={1} gap="gap-6">` (`@festgrid/ui`, Story 0.31) — `gap="gap-6"` preserves this component's already-shipped spacing exactly (`GridContainer`'s own default is `gap-4`, matching `DESIGN.md`'s token; `EventListView` overrides it explicitly rather than silently inheriting a spacing change). This produces the same five-breakpoint column progression the original (now-superseded) version of this AC specified — `1/2/3/4/5` at base/md/lg/xl/2xl — but via the shared primitive instead of a second hand-written literal string (`posts-select-content.tsx`'s `PostCard` grid, Story 5.1 AC12, is the other consumer). The `className` prop (AC1's `EventListViewProps`) is repurposed: it now passes through to `GridContainer`'s own `className` merge slot rather than replacing the whole grid className outright — any caller needing a one-off tweak appends via that prop instead of overriding the full grid string. **Depends on Story 0.31.** No change to `EventCard` itself, `getCardProps`, or any other AC.

15. **AC15 — Masonry view-mode switcher (added 2026-08-25, `bmad-correct-course`/`bmad-create-story` amendment, `sprint-change-proposal-2026-08-24-ux-rework-batch.md` Section 4.4; fulfills the Masonry Forward Note below):** `EventListView` accepts a new optional `viewMode?: 'list' | 'masonry'` prop, defaulting to `'list'` (today's existing single-column-progression grid, AC14, unchanged). `EventListView` itself owns no toggle UI and no view-mode state — matching every other prop on this component (a purely controlled presentational shell; the caller decides how/where to render the actual switch control, mirroring how `EventDiscoveryPanel`'s own `views` mechanism, not `EventListView`, owns the Card/Calendar switcher one level up). When `viewMode === 'masonry'`: both grid wrappers (AC14's skeleton and success grids) use `<GridContainer baseCols={2} colsStep={1} gap="gap-6">` instead of `baseCols={1}`; every rendered `EventCard` (including skeleton-state cards) receives `variant="masonry"` (Story 1.3b's AC11) as a base prop, shallow-merged with `getCardProps(event)`'s output using the exact same precedence AC5 already establishes (`getCardProps` wins on key collision) — `viewMode`-derived props are not a new merge mechanism, just another source feeding the same merge AC5 already defines.

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
- [ ] **Task 6: Compose `GridContainer` for the default grid (AC14, revised 2026-08-24)**
  - [ ] **Depends on Story 0.31** (`GridContainer` primitive) landing first.
  - [ ] In `EventListView.tsx`, replace both `<div className={className}>` wrappers (skeleton grid, success grid) with `<GridContainer baseCols={1} colsStep={1} gap="gap-6" className={className}>` (`className` here is the caller-supplied override prop, now passed through rather than replacing the whole grid string — see AC14).
  - [ ] Manually verify at 1280px (`xl`) and 1536px (`2xl`) that the grid shows 4 and 5 columns respectively, with no card-width distortion (cards should get narrower, not stretch/squash).
  - [ ] Confirm no current call site (`home-content.tsx`, `favorites-content.tsx`, `archive-content.tsx`, `account-content.tsx`, `feed-content.tsx`) passes an explicit `className` override that would suppress this change — a grep across all 5 confirmed none do as of this amendment.
  - [ ] **Not this task's scope:** the Pinterest/masonry view mode (`GridContainer baseCols={2} colsStep={1}`, per `project-context.md`) is separate, not-yet-built work — see Dev Notes → Amendment. Do not build it as part of this task.
- [x] **Task 7 (AC15, added 2026-08-25) — Masonry `viewMode` support:**
  - [x] Add `viewMode?: 'list' | 'masonry'` to `EventListViewProps` (default `'list'`).
  - [x] In `EventListView.tsx`, branch `GridContainer`'s `baseCols` prop (`1` for `'list'`, `2` for `'masonry'`) on both the skeleton grid (AC1) and success grid (AC4) — `colsStep={1}` unchanged in both cases.
  - [x] Compute each rendered `EventCard`'s `variant` prop as `viewMode === 'masonry' ? 'masonry' : 'standard'`, shallow-merged with that event's `getCardProps(event)` result (`getCardProps` wins on collision, same as every other merged prop per AC5) — apply this to skeleton-state cards too (a fixed, uniform `variant`, not per-event, so no `getCardProps` call is needed for skeleton cards specifically).
  - [x] Extend `EventListView.test.tsx`: `viewMode="masonry"` renders `GridContainer` with `baseCols=2`; every `EventCard` (including skeleton state) receives `variant="masonry"`; `viewMode="list"` (and the default, omitted case) renders `baseCols=1`/`variant="standard"` unchanged from today; a `getCardProps` result that explicitly sets `variant` overrides the `viewMode`-derived value.
  - [x] This story does **not** build the actual toggle-button UI (the control a user clicks to switch `viewMode`) — that is the `apps/web` call site's responsibility (`home-content.tsx`/`feed-content.tsx`/wherever Card view is rendered), analogous to how `EventDiscoveryPanel`'s Card/Calendar switcher UI lives one level up from `EventListView` too. Not building it here is a scope boundary, not an oversight — flagged explicitly so the dev agent doesn't invent a toggle control inside `packages/ui`.

## Dev Notes

### Amendment (2026-08-25, `bmad-correct-course` / `bmad-create-story`)

AC15/Task 7 fulfill the Masonry Forward Note below, per `sprint-change-proposal-2026-08-24-ux-rework-batch.md` Section 4.4. `EventListView` stays a purely controlled component (no owned toggle UI/state) per its own established pattern — every other prop on this component (`status`, `events`, `getCardProps`, etc.) is caller-driven, and `viewMode` follows the same rule rather than becoming the one exception. AC1-AC14/Tasks 1-6 are unchanged and confirmed already implemented via direct code inspection.

### Masonry Forward Note (added 2026-08-24; fulfilled 2026-08-25 by AC15/Task 7 above — kept for history)

`ux-rework-2026-08-24.md` item #10 (a Pinterest-style 2-col-mobile masonry view mode, native poster aspect ratio, relative-day + like-count badges) is reopened against Stories 1.3b (`EventCard` `variant="masonry"`) and this story (the view-mode switcher + masonry grid) but not yet detailed into concrete ACs here. When that work is picked up, its column-count progression is already locked in `project-context.md`'s "Grid/Calendar Page Containers" rule — `<GridContainer baseCols={2} colsStep={1}>` (Story 0.31), same primitive AC14 already composes for the standard grid, just a different `baseCols` — so that future `bmad-create-story` pass should consume the existing primitive rather than hand-writing a third literal className.

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

- [x] Scope confirmed: build `EventListView` in `packages/ui` (AC1-AC8, AC12) and migrate both `home-content.tsx` and `favorites-content.tsx` to consume it with zero visible behavior change (AC9, AC10) — View Toggle/Calendar View/Location-filter explicitly out of scope (AC11).
- [x] **Retroactive-extraction placement accepted:** numbered `1.3d` (off Story 1.3's `EventCard`/`useInfiniteScroll` lettered family) rather than `2.2a` or a standalone unnumbered refactor story — per explicit user decision (see Dev Notes → Retroactive Extraction Rationale).
- [x] **Migrate-both-pages scope accepted:** this story includes refactoring both existing consumers, not just building an unconsumed component — per explicit user decision.
- [x] Gate 1/2/3 prerequisites confirmed: Gate 1/3 sourced from swept `epic-1-readiness.md` (no gap applicable — pure frontend presentational extraction, no new data/infra surface); Gate 2 run fresh via subagent — split confirmed, prop contract and out-of-scope boundary (View Toggle/Calendar/Location-filter) accepted as documented above.
- [x] Architecture and data/API boundaries confirmed: no GraphQL/database changes; `EventListView` stays presentation-only (no data-fetching, no `next-intl`, no GraphQL-generated types) in `packages/ui`.
- [x] Testing plan confirmed: new `EventListView.test.tsx` in `packages/ui`; existing `page.test.tsx`/`favorites-content.test.tsx` must pass unmodified in their assertions after the refactor.
- [x] Explicit human approval state (Default: pending approval)

## Testing Requirements

- `packages/ui`: `EventListView.test.tsx` — loading skeleton (count + markup), error markup (`errorMessage`/`errorDetail`), empty-state slot rendered verbatim, success grid with `mainSchedule` derivation (including fallback-to-first-schedule), `getCardProps` merge/override precedence, infinite-scroll sentinel + spinner visibility while `isFetchingNextPage`.
- `apps/web`: existing `page.test.tsx` (home) and `favorites-content.test.tsx` must continue passing against the refactored pages with no assertion changes (Task 4) — this is the primary regression guard for this story, since it is a behavior-preserving refactor rather than new user-facing functionality.
- Manual: `pnpm build`/`pnpm lint` clean at the repo root.

## Deliverables Checklist

- [x] `EventListView` built in `packages/ui/src/features/events/` with types, tests, and public export.
- [x] `home-content.tsx` migrated to consume `EventListView`, duplicated JSX removed, zero visible behavior change.
- [x] `favorites-content.tsx` migrated to consume `EventListView`, duplicated JSX removed, zero visible behavior change.
- [x] Existing `page.test.tsx`/`favorites-content.test.tsx` pass against the refactored pages.
- [x] `pnpm build`/`pnpm lint` clean at the repo root.

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

- [x] Ready for review (AC1-AC13, original)
- [x] Ready for review (AC15 / Task 7 masonry viewMode plumbing)

**2026-08-24 (`bmad-correct-course`):** Reopened for AC14 only (grid column count widened past `lg:`, `ux-rework-2026-08-24.md` item #1 expanded scope — see `sprint-change-proposal-2026-08-24-ux-rework-batch.md`). AC1-AC13 unaffected.

**2026-08-24, later same day:** AC14 revised again — now composes the new `GridContainer` primitive (Story 0.31, `baseCols`/`colsStep` props) instead of hand-writing the literal className. No code existed against the prior version (committed in `fe8a1af`); this is a documentation correction, not a rework.

**2026-08-25:** AC15 (masonry `viewMode` switcher) backfilled with real AC/task — only a forward-note existed before. AC1-AC14 confirmed already implemented via direct code inspection, unaffected.

## Dev Agent Record

### Agent Model Used

Claude 3.5 Sonnet

### Debug Log References

- Story created via `bmad-create-story` at the user's explicit request, following a conversation where the user asked to identify the reusability pattern behind `home-content.tsx`/`favorites-content.tsx`'s duplicated presentational shell.
- Placement (`1.3d` vs `2.2a` vs standalone) and scope (build-only vs build-and-migrate) were both genuine tradeoffs surfaced to the user via `AskUserQuestion` before drafting, per this project's `bmad-create-story` customization requiring non-mechanical decisions to be confirmed rather than silently picked.
- Gate 2 run fresh via subagent (Freya's analytical lens) against `01-event-list-view.md` and the current duplicated implementation; confirmed the split, recommended the prop contract, and confirmed View Toggle/Calendar/Location-filter as out of scope. Gate 1/3 sourced from `epic-1-readiness.md` (`swept: true`) — no fresh gap found.

### Completion Notes List

- Added the optional `viewMode?: 'list' | 'masonry'` prop to `EventListViewProps` defaulting to `'list'`.
- Branched the grid containers (`baseCols={viewMode === 'masonry' ? 2 : 1}`) for both loading skeleton and success grids, composing the shared `GridContainer` primitive cleanly.
- Derived and passed the corresponding base variant (`'masonry'` or `'standard'`) to `EventCard` elements, and ensured `getCardProps(event)` has overriding precedence.
- Wrote extensive new unit tests validating the grid column layouts, the skeleton card aspect ratios, success card styles, and proper prop merging.
- Ensured zero regression across pre-existing `@festgrid/ui` unit tests.

### File List

- `packages/ui/src/features/events/EventListView.types.ts`
- `packages/ui/src/features/events/EventListView.tsx`
- `packages/ui/src/features/events/EventListView.test.tsx`
