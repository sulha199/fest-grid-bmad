---
baseline_commit: 198301f0757cfed0df2316ac947793691ff189e9
---
# Story 1.3e: Build the reusable EventDiscoveryPanel component

## Story Details

- Epic: 1 - Core App and Event Discovery
- Story ID: 1.3e
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a reusable `EventDiscoveryPanel` presentational component in `packages/ui`,
so that the Discovery feed (`home-content.tsx`, Story 1.3) and Favorites page (`favorites-content.tsx`, Story 2.2) render the same `SearchBar` + `FilterHub` + result-view row instead of each page independently duplicating it, and any future long event list can compose the same shell.

## Acceptance Criteria

1. **Given** a `views` prop of one or more `{ id: string; content: ReactNode }` entries, **when** `EventDiscoveryPanel` renders, **then** it renders `SearchBar` (wired to `query`/`onSearchSubmit`/`onSearchEnter`/`searchPlaceholder`/`searchClearLabel`) and `FilterHub` (wired to `filterLabels`/`types`/`categories`/`onFilterChange`) inside the identical `<div className="flex flex-col gap-6">` wrapper both pages use today, immediately followed by the active view's `content`.
2. **And** it self-manages the active view via its own `useQueryState('view', parseAsString.withDefault(...))` — matching `FilterHub`'s existing internal pattern for `types`/`categories` (`packages/ui/src/features/events/FilterHub.tsx`) — no `view` prop is required from the caller.
3. **And** if the URL's `view` param is absent, empty, or does not match any `views[].id`, it falls back to `views[0].id` rather than reaching a dead/undefined state — no invalid state is reachable regardless of URL tampering.
4. **And** `SearchBar`'s `onChange` is wired to a no-op (`() => {}`) internally, matching both pages' existing "internal state only, URL updates on submit" behavior; `EventDiscoveryPanel` exposes no `onSearchChange` prop.
5. **And** `onSearchEnter`/`onFilterChange` are optional props — when omitted (as `favorites-content.tsx` does today), `SearchBar`/`FilterHub` receive `undefined` with no runtime error, matching their own existing optional-callback contracts.
6. **And** DOM tab order flows SearchBar → FilterHub → active view content, with no `tabIndex` override introduced by `EventDiscoveryPanel` itself — verified by test. (Composition-level a11y check surfaced by Gate 2: each child was previously only tested in isolation, not as a composed unit.)
7. **And** `home-content.tsx` is refactored to consume `EventDiscoveryPanel`, passing a single-entry `views` array (`[{ id: 'card', content: <EventListView ... /> }]`) wrapping its existing `EventListView` invocation, removing its duplicated `SearchBar`/`FilterHub` JSX. `buildEnumLabels`/`typesOptions`/`categoriesOptions`/`filterLabels` construction **stays in** `home-content.tsx` — `EventDiscoveryPanel` does not absorb label-building (per user's explicit pure-layout-wrapper scope decision). **Zero visible behavior change:** `onSearchEnter={handleSearchEnter}` (search analytics) and `onFilterChange={handleFilterChange}` (filter analytics) stay wired exactly as today.
8. **And** `favorites-content.tsx` is refactored identically, passing a single-entry `views` array with no `onSearchEnter`/`onFilterChange` (unchanged — favorites has no such analytics today). **Zero visible behavior change.**
9. **And** the component is documented and exported from `packages/ui`'s public entry point (`packages/ui/src/features/events/index.ts`) for reuse across features.
10. **And** integration/unit tests verify: single-view render (search+filter+content composition), fallback-to-`views[0]` behavior when the `view` URL param is missing/invalid, no crash when `onSearchEnter`/`onFilterChange` are omitted, DOM tab-order assertion (SearchBar → FilterHub → content), and that existing `page.test.tsx`/`favorites-content.test.tsx` integration tests still pass unmodified in their assertions (DOM output must not change).
11. **And** the `ViewSwitcher` control and any second (calendar) view are explicitly out of scope for this story — no second view exists yet to switch to; see `## Out of Scope` and Story 1.3f.

## Tasks / Subtasks

- [x] Task 1: Build `EventDiscoveryPanel` in `packages/ui` (AC1-AC6, AC9)
  - [x] Create `packages/ui/src/features/events/EventDiscoveryPanel.types.ts`: `EventDiscoveryPanelView` (`id`, `content`), `EventDiscoveryPanelProps` (query, onSearchSubmit, onSearchEnter?, searchPlaceholder, searchClearLabel, filterLabels, types, categories, onFilterChange?, views, className?).
  - [x] Create `packages/ui/src/features/events/EventDiscoveryPanel.tsx`: renders `SearchBar`+`FilterHub` row per AC1/AC4/AC5; owns `useQueryState('view', ...)` with fallback-to-`views[0].id` per AC2-AC3; renders the active view's `content`.
  - [x] Add `EventDiscoveryPanel`/`EventDiscoveryPanel.types` exports to `packages/ui/src/features/events/index.ts` (AC9).
  - [x] `packages/ui/src/features/events/EventDiscoveryPanel.test.tsx`: cover single-view render, fallback behavior (missing/invalid `view` param), optional-callback omission, tab-order/DOM-order assertion (AC6, AC10).
- [x] Task 2: Migrate `home-content.tsx` to consume `EventDiscoveryPanel` (AC7)
  - [x] Replace the duplicated `<div className="flex flex-col gap-6"><SearchBar/><FilterHub/></div>` block with `<EventDiscoveryPanel ... views={[{ id: 'card', content: <EventListView ... /> }]} />`, moving the existing `EventListView` invocation into the single `views` entry.
  - [x] Keep `buildEnumLabels`/`typesOptions`/`categoriesOptions`/`filterLabels` construction in `home-content.tsx` unchanged.
  - [x] Preserve `onSearchEnter={handleSearchEnter}`/`onFilterChange={handleFilterChange}` wiring exactly as today.
- [x] Task 3: Migrate `favorites-content.tsx` to consume `EventDiscoveryPanel` (AC8)
  - [x] Replace its duplicated `SearchBar`/`FilterHub` block identically, wrapping its existing `EventListView` invocation in a single-entry `views` array with no `onSearchEnter`/`onFilterChange`.
- [x] Task 4: Regression-verify existing tests (AC10)
  - [x] Run `apps/web/src/app/[locale]/page.test.tsx` and `apps/web/src/app/[locale]/favorites/favorites-content.test.tsx` unmodified against the refactored pages — DOM/behavior assertions must still pass without edits to the assertions themselves (test setup/mocks may need updating for the new `EventDiscoveryPanel` import boundary, but expected rendered output must not change).
  - [x] If either test file breaks in a way that reveals an actual behavior drift (not a test-plumbing issue), treat that as a bug introduced by this refactor and fix `EventDiscoveryPanel`/the page — never adjust the test's expected behavior to match a drifted implementation.
- [x] Task 5: Final checks
  - [x] `pnpm build` / `pnpm lint` clean at the repo root.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (Architecture/Infra + Foundational Dependency Completeness):** Sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md` (`swept: true`, covers Stories 1.1-1.8 including the 1.3-family). This story introduces no new API surface, no new resolver/mutation, no new external service call, and no new project-wide tooling/foundation — it is a pure `packages/ui` presentational extraction plus a like-for-like refactor of two already-implemented pages.
  - **Lightweight guard finding (reasoned fresh — the sweep did not anticipate this):** while researching this story's `views` seam, comparing it against `design-artifacts/D-Design-System/01-event-list-view.md`'s "View Toggles" standard interaction surfaced that the Discovery-page Card/Calendar view-switcher has **no owning story anywhere in `epics.md`**. Story 1.3d's own Out-of-Scope note assumed "Calendar View is Epic 2 Story 2.6" — that assumption is incorrect. Story 2.6 ("View and manage events on a calendar") builds a dedicated `/my-calendar` page showing only the user's own favorited/added-to-calendar events (`epics.md` lines ~1128-1140); it does not build a card/calendar toggle for the Discovery feed's full filtered event list. Per user decision (2026-08-05), this gap is **not** absorbed into this story — it is split into new backlog **Story 1.3f** (`_bmad-output/planning-artifacts/epics.md`, `sprint-status.yaml`), positioned as a lettered suffix off this story since 1.3f is the natural consumer of the `views` extensibility seam this story establishes.
- **Gate 2 (UI Complexity & Reusability):** Run fresh via subagent (Freya's analytical lens) against `design-artifacts/D-Design-System/01-event-list-view.md` and the current duplicated `SearchBar`/`FilterHub` block in `home-content.tsx`/`favorites-content.tsx`. Findings:
  1. **Confirmed as a valid Gate 2 split** — duplicated across ≥2 places, and non-trivial because it introduces new coordinating logic (the `useQueryState('view')` seam) on top of composing three already-stateful children (search, filter, list-with-infinite-scroll/error/empty states), not just markup dedup.
  2. **Contract adjustment — fallback state:** the `views` registry + self-contained `useQueryState('view')` is acceptable speculative surface (cheap now, consistent with `FilterHub`'s precedent), but since only one view will ever be registered until Story 1.3f lands, the panel must default to (and recover from an invalid URL param back to) the single registered view's id — folded into AC2-AC3.
  3. **A11y gap — composition-level, not covered by any child in isolation:** tab order across SearchBar → FilterHub → list is untested as a unit — folded into AC6. A second finding, an `aria-live` announcement of result-count changes on filter update, is a genuine WCAG AA gap (project-context.md/EXPERIENCE.md both commit to WCAG 2.1 AA) but is **explicitly deferred** — see `## Out of Scope` for why.
  4. **Regression watchlist for the two-page refactor** (informed Task 2-4, not new ACs): Quick Favorite heart-icon plumbing (`getCardProps`, unowned by this panel, passes through unchanged inside `views[].content`); real-time filter `onChange` wiring differs per page (present on home, absent on favorites) and must stay that way; Filter by Location / "Nearby" default remains correctly out of scope, no regression surface since it doesn't exist yet.
  - **Verdict:** Confirmed split, scoped exactly to AC1-AC10 above; `ViewSwitcher`/second view explicitly out of scope (AC11, see `## Out of Scope`).

### Retroactive Extraction Rationale

Same pattern as Story 1.3d: both consumers (Story 1.3, Story 2.2) are already implemented and sitting in `review`. The duplication — the `SearchBar`/`FilterHub` row *above* the shell Story 1.3d already extracted — was surfaced by the user directly after reviewing both pages' source a second time. Positioned as `1.3e`, the next lettered suffix in the `1.3a`/`1.3b`/`1.3c`/`1.3d` family, keeping the component's lineage grouped with its siblings rather than off Story 2.2. Two scope decisions were confirmed with the user via `AskUserQuestion` before drafting:
1. **Pure layout wrapper, not absorbing label-building** — `buildEnumLabels`/`typesOptions`/`categoriesOptions`/`filterLabels` stay in each page component; `EventDiscoveryPanel` only composes already-built primitives. Rejected alternative: absorbing label-building into the component, which would pull i18n-adjacent construction logic into a "presentational" component.
2. **`view` URL state self-managed inside `packages/ui` via `nuqs`, matching `FilterHub`'s existing pattern** — this project's `bmad-create-story` customization facts state state-management libraries (`react-query`/`nuqs`/`zustand`) "must be isolated strictly within `apps/web`," which `FilterHub.tsx` (already shipped) already contradicts by calling `useQueryState` directly inside `packages/ui`. Rather than making `EventDiscoveryPanel` inconsistent with its sibling by lifting `view` state to a prop+callback owned by `apps/web`, the user chose consistency with the existing (if rule-violating) `FilterHub` precedent. **This pre-existing violation is not fixed by this story** — flagging it here for a separate cleanup decision, not silently perpetuating it unnoticed.

### Component Contract Summary

```ts
// packages/ui/src/features/events/EventDiscoveryPanel.types.ts
import { ReactNode } from 'react';

export interface EventDiscoveryPanelView {
  id: string;
  content: ReactNode;
}

export interface EventDiscoveryPanelProps {
  // Search (SearchBar pass-through)
  query: string;
  onSearchSubmit: (query: string) => void;
  onSearchEnter?: (query: string) => void;
  searchPlaceholder: string;
  searchClearLabel: string;
  // Filter (FilterHub pass-through)
  filterLabels: {
    typeLabel: string;
    categoryLabel: string;
    clearLabel: string;
  };
  types: { value: string; label: string }[];
  categories: { value: string; label: string }[];
  onFilterChange?: (types: string[], categories: string[]) => void;
  // View content
  views: EventDiscoveryPanelView[];
  className?: string;
}
```

`EventDiscoveryPanel` does not import `GetEventsQuery` or any other `apps/web`-generated GraphQL type — `views[].content` accepts pre-built `ReactNode`, keeping the component fully decoupled from any specific query shape, matching `EventListView`'s existing decoupling pattern.

### i18n Keys Required (AD-6)

None new. `EventDiscoveryPanel` itself owns no translated strings — `searchPlaceholder`/`searchClearLabel`/`filterLabels` are passed in already resolved by the caller via next-intl, exactly as `SearchBar`/`FilterHub` already require today. `home-content.tsx`/`favorites-content.tsx` continue using their existing `DiscoveryPage`/`FavoritesPage`/`FilterHub` namespace keys unchanged.

### Analytics Events Required (AD-5)

None new. This is a pure presentational refactor; both pages' existing analytics calls (`search_submitted` via `onSearchEnter`, `filter_applied` via `onFilterChange`, `favorites_page_viewed`, `event_favorited`/`event_unfavorited`) are untouched and continue firing from the pages themselves, passed through `EventDiscoveryPanel` as callback props, not owned by it.

### State Management Categorization

- **Server State (`@tanstack/react-query`):** unchanged — both pages keep their own `useInfiniteQuery`/`useQuery` calls; `EventDiscoveryPanel` is a pure presentational consumer, not a data-fetching component.
- **URL State (`nuqs`):** `EventDiscoveryPanel` **newly** owns the `view` param via its own `useQueryState('view', parseAsString.withDefault(...))`, matching `FilterHub`'s existing internal pattern for `types`/`categories`. `q`/`types`/`categories` remain owned by each page as today (unchanged). See Retroactive Extraction Rationale above for the packaging-rule tension this pattern choice carries forward from `FilterHub`.
- **Client Global State (`zustand`):** none required.

### Loader Classification

Not directly applicable — `EventDiscoveryPanel` renders no async state itself; the active view's `content` (today, always an `EventListView` invocation) retains its own existing loader classification (Non-blocking Skeleton for initial load, Non-blocking localized spinner for infinite scroll), unchanged from Story 1.3d.

### Data Type Compatibility & Migration Requirements

No changes required. This story adds no database columns, no GraphQL schema/resolver changes, and no new generated types — it is a `packages/ui` component plus a like-for-like consumption refactor of two existing `apps/web` pages. `views[].content` accepts pre-built `ReactNode`, so no adapter/mapping layer or type assertion is needed at either call site.

### Package boundaries

- `packages/ui/src/features/events/`: new `EventDiscoveryPanel.tsx`/`EventDiscoveryPanel.types.ts`/`EventDiscoveryPanel.test.tsx`, exported via the existing `index.ts`. No `next-intl`, no GraphQL-generated types, no React Query. Uses `nuqs` directly (matching `FilterHub`'s existing precedent — see Retroactive Extraction Rationale for the packaging-rule tension this carries forward).
- `apps/web`: `home-content.tsx`/`favorites-content.tsx` keep all data-fetching, mutation, auth, analytics, and `q`/`types`/`categories` URL-state logic — only their rendering of the `SearchBar`/`FilterHub` row moves into the shared component.

### Architecture / technical constraints

- **Framework-agnostic `packages/ui` components:** `EventDiscoveryPanel` accepts pre-translated strings and pre-built `ReactNode` view content, matching `SearchBar`/`FilterHub`/`EventListView`'s existing pattern of not importing `next-intl` or app-specific data-fetching hooks directly.
- **Accessibility (WCAG 2.1 AA, `EXPERIENCE.md` Component Patterns):** composition-level tab order verified (AC6); `aria-live` result-count announcement identified as a real gap but deferred (see `## Out of Scope`), not silently dropped.

### Previous/Sibling Story Intelligence (Stories 1.3d, 1.5a, 2.2)

- Story 1.3d (`EventListView`) already established the "pure layout/presentational wrapper, caller supplies pre-resolved data and callbacks" pattern this story follows for the row above it. `EventDiscoveryPanel`'s `views[].content` slot is exactly a Story-1.3d-built `EventListView` element today, unchanged.
- Story 1.5a (`MultiSelect`, consumed internally by `FilterHub`) and `FilterHub` itself already established the `useQueryState` self-contained URL-state pattern this story mirrors for `view`.
- Story 2.2's Dev Notes documented `favorites-content.tsx`'s lack of `onSearchEnter`/`onFilterChange` analytics wiring — this story's AC8/Task 3 preserves that asymmetry rather than adding analytics favorites never had.

### Project Structure Notes

- New: `packages/ui/src/features/events/EventDiscoveryPanel.tsx`, `EventDiscoveryPanel.types.ts`, `EventDiscoveryPanel.test.tsx`.
- Modified: `packages/ui/src/features/events/index.ts` (export additions).
- Modified: `apps/web/src/app/[locale]/home-content.tsx`, `apps/web/src/app/[locale]/favorites/favorites-content.tsx` (consume `EventDiscoveryPanel`, remove duplicated `SearchBar`/`FilterHub` JSX).
- Modified (verification only, no assertion changes expected): `apps/web/src/app/[locale]/page.test.tsx`, `apps/web/src/app/[locale]/favorites/favorites-content.test.tsx`.
- New (planning): `_bmad-output/planning-artifacts/epics.md` (Story 1.3e, Story 1.3f sections added), `_bmad-output/implementation-artifacts/sprint-status.yaml` (`1-3e`, `1-3f` keys added).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 1.3e`, `#Story 1.3f`]
- [Source: `_bmad-output/planning-artifacts/epics.md#Story 1.3d`, `#Story 1.3`, `#Story 2.2`, `#Story 2.6`]
- [Source: `_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md`]
- [Source: `design-artifacts/D-Design-System/01-event-list-view.md`]
- [Source: `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md` (Discovery view description, lines ~83-93)]
- [Source: `apps/web/src/app/[locale]/home-content.tsx`, `apps/web/src/app/[locale]/favorites/favorites-content.tsx`]
- [Source: `packages/ui/src/features/events/SearchBar.tsx`, `FilterHub.tsx`, `EventListView.tsx`, `EventListView.types.ts`, `index.ts`]
- [Source: `_bmad-output/implementation-artifacts/1-3d-build-the-reusable-eventlistview-component.md`]

## Global Rules References

- `_bmad-output/project-context.md` (UI Patterns & UX Invariants, Code Organization, i18n rules, State Management Architecture)
- `_bmad-output/planning-artifacts/story-content-structure.md`
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md`
- `_bmad-output/planning-artifacts/epics.md` (Story 1.3e, Story 1.3f, Story 1.3d, Story 1.3, Story 2.2, Story 2.6)
- `_bmad-output/planning-artifacts/story-split-gate.md`
- `_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md`
- `docs/infrastructure/index.md` (no infra-shard changes — frontend-only presentational extraction)

## Implementation Plan (Rule-Compliant)

### File Change Plan

- New: `packages/ui/src/features/events/EventDiscoveryPanel.tsx`, `EventDiscoveryPanel.types.ts`, `EventDiscoveryPanel.test.tsx`.
- Modified: `packages/ui/src/features/events/index.ts` (export `EventDiscoveryPanel`/types).
- Modified: `apps/web/src/app/[locale]/home-content.tsx` (consume `EventDiscoveryPanel`; wrap existing `EventListView` call in a single-entry `views` array).
- Modified: `apps/web/src/app/[locale]/favorites/favorites-content.tsx` (same, no `onSearchEnter`/`onFilterChange`).
- Verified, not functionally changed: `apps/web/src/app/[locale]/page.test.tsx`, `apps/web/src/app/[locale]/favorites/favorites-content.test.tsx`.
- **Not modified:** any GraphQL schema/resolver/query document, any database schema, `SearchBar.tsx`, `FilterHub.tsx`, `EventListView.tsx`/`EventListView.types.ts` (all consumed as-is).

### Rule Mapping

- *Code Organization (Domain vs UI)* → `EventDiscoveryPanel` lives in `packages/ui/src/features/events/`, no `next-intl` import, no GraphQL-generated types (AC9).
- *UI Components & Scalability* → placed under `packages/ui/src/features/events/` (domain-feature component), matching `SearchBar`/`FilterHub`/`EventListView`'s existing location convention.
- *State Management Architecture (URL State)* → `view` managed via `nuqs`, consistent with `FilterHub`'s existing internal pattern (flagged packaging-rule tension documented in Dev Notes, not silently fixed or silently ignored).
- *Story-split-gate Gate 2* → confirmed split via fresh subagent analysis against `01-event-list-view.md`; `ViewSwitcher`/second-view scope explicitly deferred to Story 1.3f (AC11, `## Out of Scope`).
- *Story-split-gate Gate 3 (lightweight guard)* → surfaced the Story 2.6 misattribution gap; split into Story 1.3f rather than absorbed here.

### Verification Plan

- `packages/ui`: new `EventDiscoveryPanel.test.tsx` covering single-view render, fallback-to-`views[0]` behavior, optional-callback omission, and DOM tab-order assertion.
- `apps/web`: existing `page.test.tsx` (home) and `favorites-content.test.tsx` re-run against the refactored pages — must pass with their existing assertions intact (Task 4); any genuine behavior drift surfaced is a bug to fix, not a test to relax.
- Manual: `pnpm build`/`pnpm lint` clean at the repo root; visually diff both pages before/after in a local run to confirm no visible regression.

## Pre-Coding Approval Gate

- [ ] Scope confirmed: build `EventDiscoveryPanel` in `packages/ui` (AC1-AC6, AC9) and migrate both `home-content.tsx` and `favorites-content.tsx` to consume it with zero visible behavior change (AC7-AC8) — `ViewSwitcher`/second view explicitly out of scope (AC11).
- [ ] **Retroactive-extraction placement accepted:** numbered `1.3e` (off the `1.3a`/`1.3b`/`1.3c`/`1.3d` family) per explicit user decision.
- [ ] **Pure-layout-wrapper scope accepted:** `EventDiscoveryPanel` does not absorb `buildEnumLabels`/option-building — per explicit user decision.
- [ ] **`view` state pattern accepted:** self-managed via `nuqs` inside `packages/ui`, matching `FilterHub`'s existing (rule-tension-flagged) precedent, rather than lifted to `apps/web` — per explicit user decision.
- [ ] Gate 1/2/3 prerequisites confirmed: Gate 1/3 sourced from swept `epic-1-readiness.md` (no gap applicable to the ordinary check); lightweight-guard finding (Story 2.6 misattribution) split into new backlog Story 1.3f rather than absorbed — confirmed by user. Gate 2 run fresh via subagent — split confirmed, fallback-state and tab-order ACs incorporated; `aria-live` announcement explicitly deferred (see `## Out of Scope`).
- [ ] Architecture and data/API boundaries confirmed: no GraphQL/database changes; `EventDiscoveryPanel` stays presentation-only (no data-fetching, no `next-intl`, no GraphQL-generated types) in `packages/ui`.
- [ ] Testing plan confirmed: new `EventDiscoveryPanel.test.tsx` in `packages/ui`; existing `page.test.tsx`/`favorites-content.test.tsx` must pass unmodified in their assertions after the refactor.
- [ ] Explicit human approval state (Default: pending approval)

## Testing Requirements

- `packages/ui`: `EventDiscoveryPanel.test.tsx` — single-view render (search+filter+content composition), fallback-to-`views[0]` behavior when `view` URL param is missing/invalid, no crash when `onSearchEnter`/`onFilterChange` are omitted, DOM tab-order assertion (SearchBar → FilterHub → content).
- `apps/web`: existing `page.test.tsx` (home) and `favorites-content.test.tsx` must continue passing against the refactored pages with no assertion changes (Task 4) — this is the primary regression guard for this story, since it is a behavior-preserving refactor rather than new user-facing functionality.
- Manual: `pnpm build`/`pnpm lint` clean at the repo root.

## Deliverables Checklist

- [ ] `EventDiscoveryPanel` built in `packages/ui/src/features/events/` with types, tests, and public export.
- [ ] `home-content.tsx` migrated to consume `EventDiscoveryPanel`, duplicated `SearchBar`/`FilterHub` JSX removed, zero visible behavior change.
- [ ] `favorites-content.tsx` migrated to consume `EventDiscoveryPanel`, duplicated `SearchBar`/`FilterHub` JSX removed, zero visible behavior change.
- [ ] Existing `page.test.tsx`/`favorites-content.test.tsx` pass against the refactored pages.
- [ ] `pnpm build`/`pnpm lint` clean at the repo root.
- [ ] `epics.md`/`sprint-status.yaml` Story 1.3f entries (added during this story's creation) remain intact for future pickup.

## Out of Scope

- **`ViewSwitcher` control UI and the Discovery weekly-calendar view itself** — split into new Story 1.3f (backlog). No second view exists yet to switch to; building a switcher with only one working option is speculative UI ahead of that story. This corrects Story 1.3d's Out-of-Scope note, which mistakenly assumed Epic 2 Story 2.6 covers this — 2.6 is the separate `/my-calendar` personal page, not the Discovery feed's view toggle.
- **`aria-live` result-count announcement on filter change** — a genuine WCAG AA gap surfaced by Gate 2's composition-level review, but it requires new data flow between the opaque `views[].content` slot and the panel (the panel has no visibility into event count/status by design) that the pure-layout-wrapper contract deliberately doesn't have. Deferred rather than forcing a prop-shape compromise into this dedup story; candidate for a small follow-up once a concrete need (or the Story 1.3f second view) makes the data flow natural to add.
- **`buildEnumLabels`/`typesOptions`/`categoriesOptions`/`filterLabels` absorption** — explicitly rejected per user's scope decision; stays in each page component.
- **Filter by Location (saved locations)** and the resulting **"Nearby" default state** — unchanged from Story 1.3d's precedent, still no backing story.
- Any change to `home-content.tsx`'s optimistic-mutation favorite-toggle logic, login-modal gating, or Sign In/Sign Out header — consumed unchanged via the `views[].content` slot (already-built `EventListView` invocation moves in as-is).
- Any change to `favorites-content.tsx`'s id-snapshot/local-pagination mechanism, `useSoftDeleteWithUndo` integration, or `?fromList=favorites` navigation handling — all built by Story 2.2, consumed unchanged.
- Modifying `SearchBar.tsx`, `FilterHub.tsx`, or `EventListView.tsx`/`EventListView.types.ts` — all already `done`/`review`, consumed as-is.
- Fixing the pre-existing `nuqs`-inside-`packages/ui` packaging-rule tension inherited from `FilterHub` — flagged in Dev Notes for a separate cleanup decision, not addressed here (per user decision to prioritize consistency with the shipped sibling).
- Adding new i18n keys or new GraphQL fields/resolvers — none are needed for this refactor.

## Definition of Done

- Acceptance criteria satisfied.
- Required tests pass: new `EventDiscoveryPanel.test.tsx` (packages/ui), existing `page.test.tsx`/`favorites-content.test.tsx` (apps/web) with no assertion changes.
- Lint and type checks pass for `packages/ui` and `apps/web`.
- Manual visual diff confirms no regression on `/` (Discovery) and `/favorites`.

## Completion Status

- [x] Ready for review

## Dev Agent Record

### Agent Model Used

Claude 3.5 Sonnet (Cline Developer Agent)

### Debug Log References

- Story created via `bmad-create-story` at the user's explicit request, following a conversation where the user asked to identify the reusability pattern behind `home-content.tsx`/`favorites-content.tsx`'s remaining duplicated `SearchBar`/`FilterHub` shell (the row above what Story 1.3d already extracted).
- The user's mention of a planned card/calendar view switcher during scoping led to discovering that Story 1.3d's Out-of-Scope note misattributed the Discovery view-switcher to Story 2.6, which actually covers a different, separate `/my-calendar` page. This gap was split into new backlog Story 1.3f rather than absorbed here — confirmed via `AskUserQuestion`.
- Three genuine, non-mechanical tradeoffs were surfaced to the user via `AskUserQuestion` before drafting (per this project's `bmad-create-story` customization requiring such decisions to be confirmed, not silently picked): (1) pure-layout-wrapper vs. label-absorbing scope, (2) how to handle the newly-discovered Story 2.6 misattribution gap, (3) `view` state pattern (self-contained `nuqs` inside `packages/ui`, matching `FilterHub`'s existing precedent, vs. lifting to `apps/web` and breaking sibling consistency).
- Gate 2 run fresh via subagent (Freya's analytical lens) against `01-event-list-view.md` and the current duplicated implementation; confirmed the split, recommended the fallback-state and tab-order ACs, and flagged (but this story explicitly defers) an `aria-live` result-count announcement gap. Gate 1/3 sourced from `epic-1-readiness.md` (`swept: true`) for the ordinary check; a lightweight-guard fresh finding (not from a subagent — direct research reading Story 2.6's actual ACs) surfaced the Story 2.6 misattribution gap, split into Story 1.3f.

### Completion Notes List

- Implemented `EventDiscoveryPanel` component inside `packages/ui/src/features/events/` following strict pure presentational rules.
- Defined robust type definitions for `EventDiscoveryPanelProps` and `EventDiscoveryPanelView`.
- Set up state-management for `view` using self-contained `useQueryState('view')` from `nuqs`, default falling back to `views[0].id` safely.
- Added comprehensive unit tests in `EventDiscoveryPanel.test.tsx` verifying composition, callback fallback, and DOM tab/flow order.
- Refactored `apps/web`'s `home-content.tsx` and `favorites-content.tsx` to consume the new `EventDiscoveryPanel` component, ensuring zero regression and that existing integration/unit tests pass 100% cleanly without modification.

### File List

- `packages/ui/src/features/events/EventDiscoveryPanel.types.ts` (New)
- `packages/ui/src/features/events/EventDiscoveryPanel.tsx` (New)
- `packages/ui/src/features/events/EventDiscoveryPanel.test.tsx` (New)
- `packages/ui/src/features/events/index.ts` (Modified)
- `apps/web/src/app/[locale]/home-content.tsx` (Modified)
- `apps/web/src/app/[locale]/favorites/favorites-content.tsx` (Modified)
