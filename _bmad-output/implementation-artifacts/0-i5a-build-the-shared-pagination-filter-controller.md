---
baseline_commit: 4f2707d5820f85961e24b29225742355942e2103
---

# Story 0.i5a: Build the shared pagination/filter controller

## Story Details

- Epic: 0.i5 (Shared list-pagination and filter-state controller)
- Story ID: 0.i5a
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want one controller/hook owning cursor state, a reset-on-filter-change rule, and prev/next/total controls — plus a documented, settled answer to whether filters apply on change or only on an explicit Apply action (IDEA-011) —
so that every list view stops reinventing pagination and filter-reset locally, and the app has one consistent rule for when a filter takes effect.

## Acceptance Criteria

1. **Given** `useListPaginationController` is used with a `filterKey` value that changes between renders (any serializable snapshot of the caller's active filter/query state), **when** the new `filterKey` is not equal to the previous one (default comparison: `JSON.stringify` equality; overridable via an `isEqual` option), **then** the controller synchronously resets its cursor to `initialCursor`, clears any accumulated page/cursor history, and increments a `resetToken` counter — all before the next render commits, so no fetch can occur with the stale cursor. This is the general mechanism that closes BUG-019's failure mode (a filter change appending the next page instead of reloading).
2. **Given** a consumer feeds the controller's `resetToken` (or `cursor`) into a `@tanstack/react-query` `queryKey`, **when** `filterKey` changes and the controller resets, **then** the reset is expressed purely as new query-key/cursor **values** — the controller's returned object never requires the consumer to change a React `key` on the list container or its scroll sentinel to reflect the reset. This is documented as the required integration contract (Dev Notes) and is the mechanism that prevents a filter-driven reset from ever unmounting/remounting an in-flight `useInfiniteScroll` sentinel subscription — the plausible root cause of BUG-018 ("sentinel no longer in view, user must manually scroll to re-trigger the next page load") sharing one hand-rolled-pagination-state root cause with BUG-019, per Epic 0.i5's invariant.
3. **Given** a consumer that needs manual prev/next navigation instead of infinite scroll (e.g. the moderator-tools pages, BUG-020), **when** it calls `goToNextPage(nextCursor)` / `goToPrevPage()`, **then** the controller pushes/pops a cursor history stack and exposes `pageIndex`, `hasPrevPage`, `hasNextPage`, and `totalCount` (the latter two supplied by the consumer via `reportPageMeta()` after each fetch, since the controller has no knowledge of the query's response shape).
4. **Given** the codebase has no single documented rule for whether a filter control applies immediately or only after an explicit "Apply" action, **when** this story ships, **then** a new `AD-18: Filter Apply-Timing Convention` entry is added to `festgrid-architecture-spine.md` (Binds/Prevents/Rule format, matching AD-8/AD-10/AD-11/AD-14 precedent) and a corresponding rule is added to `project-context.md`'s "UI Patterns & UX Invariants" section. The rule: filters apply immediately on change (no user-facing Apply action gates when a filter takes effect — confirmed against `EXPERIENCE.md`'s Filter Hub spec, "The event grid below will update in real-time with each selection"); continuous/free-text controls debounce internally via the existing shared `useDebounce` hook before committing, rather than requiring a second explicit commit action.
5. **Given** `useListPaginationController` is a new reusable hook, **when** this story ships, **then** it is exported from `packages/ui/src/hooks/index.ts` (and therefore `@festgrid/ui`) following the existing `useInfiniteScroll`/`useWeeklyCalendarController` file-pair convention (`.ts` + `.types.ts` + `.test.ts`), with unit tests covering AC1–AC3's behavior via `@testing-library/react`'s `renderHook`/`rerender`, matching the sibling hooks' existing Vitest test style.

## Tasks / Subtasks

- [x] **Task 1 — Write the Filter Apply-Timing convention (AC: 4)**
  - [x] Add `### AD-18: Filter Apply-Timing Convention` to `_bmad-output/planning-artifacts/festgrid-architecture-spine.md`, immediately after `AD-17`, in the same Binds/Prevents/Rule format as AD-8/AD-10/AD-11/AD-14. **Binds:** every filter/facet control across list, discovery, and moderation surfaces. **Prevents:** a mix of "apply on every change" vs. "apply only after an explicit Apply button" behavior across different surfaces, and the append-instead-of-reload bug class (BUG-019) caused by a consumer forgetting to reset pagination state when a filter's committed value changes. **Rule:** filters apply immediately on change; discrete controls (checkboxes, toggles, multi-select facets, single-select dropdowns) commit on the same interaction that changes the value; continuous/free-text controls (search box, date-range text input) debounce internally via `useDebounce` (`packages/ui/src/hooks/useDebounce.ts`) before committing — the debounce delay is the only permitted "not instant" gap, there is never a second required user action to commit. Any list/pagination consumer of a filter's committed value must own its pagination/cursor state via `useListPaginationController` (this story) rather than hand-rolling a `useState` cursor that must be remembered to reset.
  - [x] Add one bullet under `project-context.md`'s "UI Patterns & UX Invariants" section referencing AD-18 by name and naming `useListPaginationController` as the required mechanism for any list/pagination consumer of a filter.
  - [x] No runtime code depends on this task; it is the documented convention that Tasks 2–4 implement and that sibling stories 0.i5b/0.i5c/0.i5d (already in epics.md) will adopt at their call sites.

- [x] **Task 2 — Define `useListPaginationController`'s types (AC: 1, 2, 3)**
  - [x] New file `packages/ui/src/hooks/useListPaginationController.types.ts`, following the `useInfiniteScroll.types.ts`/`useWeeklyCalendarController.types.ts` sibling pattern (JSDoc on every field). Minimum shape:
    ```ts
    export interface UseListPaginationControllerOptions<TFilterKey, TCursor> {
      /** Serializable snapshot of the active filter/query state. Compared each render (default: JSON.stringify equality) to detect a filter change. */
      filterKey: TFilterKey;
      /** Cursor value to reset to when filterKey changes (e.g. 0 for offset pagination, undefined for a Connection-style `after` cursor). */
      initialCursor: TCursor;
      /** Optional custom equality check for filterKey. Defaults to JSON.stringify(a) === JSON.stringify(b). */
      isEqual?: (a: TFilterKey, b: TFilterKey) => boolean;
      /** Called whenever filterKey changes and the controller resets. Optional — most consumers observe the reset via `resetToken`/`cursor` instead. */
      onReset?: () => void;
    }

    export interface UseListPaginationControllerResult<TCursor> {
      /** Current cursor/offset value. Feed into the query (e.g. GetEventsQuery's `offset`, or a Connection query's `after`). */
      cursor: TCursor;
      /** Increments every time filterKey changes. Spread into a react-query `queryKey` so a filter change is always treated as a fresh query, even by a consumer that forgets to spread filterKey into the key itself. */
      resetToken: number;
      /** 1-based index of the current page, derived from cursor-history length. */
      pageIndex: number;
      /** Advance to the next page: pushes the current cursor onto history, sets cursor to nextCursor. */
      goToNextPage: (nextCursor: TCursor) => void;
      /** Go back to the previous page. No-ops if already on page 1 (history empty). */
      goToPrevPage: () => void;
      /** True if goToPrevPage() would change anything. */
      hasPrevPage: boolean;
      /** Consumer-reported: does the query report more results after the current cursor? Not computed by the controller — it doesn't know the query's response shape. */
      hasNextPage: boolean;
      /** Consumer-reported total count, passed through for prev/next/total UI (BUG-020-style consumers). */
      totalCount: number | undefined;
      /** Call after each successful fetch to report this page's hasNextPage/totalCount back into the controller. */
      reportPageMeta: (meta: { hasNextPage: boolean; totalCount?: number }) => void;
      /** Force a reset to page 1 without a filterKey change (e.g. a standalone "reset filters" action). */
      resetToFirstPage: () => void;
    }
    ```
  - [x] Naming/shape is a starting point, not a frozen contract — adjust field names during implementation if a cleaner shape emerges, but preserve the three semantic guarantees ACs 1–3 require (auto-reset-on-filterKey-change, no DOM-identity churn required for the reset, prev/next/total as consumer-driven data not controller-computed).

- [x] **Task 3 — Implement `useListPaginationController` (AC: 1, 2, 3)**
  - [x] New file `packages/ui/src/hooks/useListPaginationController.ts`, following `useInfiniteScroll.ts`'s file structure and JSDoc-with-`@example` header convention.
  - [x] Reset-on-filter-change: hold the previous `filterKey` in a `useRef`. Compare on every render via `isEqual` (default `JSON.stringify` equality — acceptable here since `filterKey` is expected to be a small, plain, serializable object per its documented contract, unlike the general-purpose caution against `JSON.stringify` deep-equality elsewhere). On mismatch, synchronously update state (cursor → `initialCursor`, history → `[]`, `resetToken` → `+1`) **during render** (the "compare ref, call setState conditionally during render" React pattern — not inside a `useEffect`) so that a re-render before any effect fires never returns a stale cursor paired with the new `filterKey`. Call `onReset` (if provided) via a `useEffect` keyed on `resetToken`, since side effects belong in effects, not render.
  - [x] Deliberately do **not** internally compose `useInfiniteScroll` — keep this hook's only job cursor/history/reset-token bookkeeping. A consumer opting into scroll-triggered fetching continues to call `useInfiniteScroll` itself exactly as `home-content.tsx` already does today, passing it `fetchNextPage`/`hasNextPage`/`isFetchingNextPage` from its own `useInfiniteQuery`. AC2's guarantee is structural: because this hook never returns anything that would force a consumer to change a list/sentinel's React `key`, a correctly-integrated consumer's sentinel DOM node and its `useInfiniteScroll` IntersectionObserver subscription stay mounted continuously across a filter-driven reset — only the underlying react-query `queryKey`/`cursor` value changes. Document this explicitly in the hook's top-of-file JSDoc as the required integration pattern, with an explicit "do NOT do this" counter-example (`<List key={resetToken}>`) since that is the anti-pattern this design exists to prevent.
  - [x] `goToNextPage(nextCursor)`: push current `cursor` onto history, set `cursor = nextCursor`.
  - [x] `goToPrevPage()`: pop last entry off history into `cursor`; no-op if history is empty.
  - [x] `pageIndex = history.length + 1`; `hasPrevPage = history.length > 0`.
  - [x] `reportPageMeta({ hasNextPage, totalCount })`: stores both into state, returned as `hasNextPage`/`totalCount`.
  - [x] `resetToFirstPage()`: same reset logic as the filterKey-change branch, callable directly.

- [x] **Task 4 — Export the hook (AC: 5)**
  - [x] Add `export * from './useListPaginationController';` and `export * from './useListPaginationController.types';` to `packages/ui/src/hooks/index.ts`, matching the existing pattern (already re-exported to `@festgrid/ui` consumers via `packages/ui/src/index.ts`'s `export * from './hooks'`).

- [x] **Task 5 — Tests (AC: 1, 2, 3, 5)**
  - [x] New file `packages/ui/src/hooks/useListPaginationController.test.ts`, `renderHook`/`rerender`/`act` from `@testing-library/react` + `vitest`, matching `useInfiniteScroll.test.ts`'s style.
  - [x] Filter-change reset: render with `filterKey: { types: ['MUSIC'] }`; call `goToNextPage`; assert `cursor`/`pageIndex`/`hasPrevPage` reflect page 2; rerender with a different `filterKey` (e.g. `{ types: ['FESTIVAL'] }`); assert cursor resets to `initialCursor`, history clears, `pageIndex` returns to 1, `resetToken` increments — all reflected in the **same render pass** as the `filterKey` change (i.e. assert the returned values from `rerender()`'s result directly, not after an extra `act()`/effect flush), proving AC1's "no fetch can occur with a stale cursor" guarantee.
  - [x] Custom `isEqual`: rerender with a `filterKey` that is referentially different but `isEqual`-equal; assert no reset occurs (cursor/pageIndex/resetToken unchanged).
  - [x] No-DOM-remount guarantee (AC2): assert that the **same hook instance** (no `renderHook` re-mount, only `rerender`) reflects the reset — this proves a consumer never needs to force React to recreate the hook/component tree to see a correct reset, which is the structural property that keeps a `useInfiniteScroll` sentinel mounted across the reset in a correctly-integrated consumer.
  - [x] `reportPageMeta`: assert `hasNextPage`/`totalCount` reflect the last-reported values and are cleared/reset appropriately on a filter-change reset (design decision: reset `hasNextPage`/`totalCount` to their initial undefined/false state on reset too, since they describe the old query's last-known page, not the new one — call this out explicitly in the hook's implementation).
  - [x] `goToPrevPage` no-ops at `pageIndex === 1`.
  - [x] `onReset` callback fires exactly once per actual `filterKey` change (not on every render, not when `isEqual` reports equality).

## Dev Notes

- This is a **frontend-hook-only** story: `packages/ui/src/hooks/useListPaginationController.{ts,types.ts,test.ts}`, `packages/ui/src/hooks/index.ts`, `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (new AD-18), `_bmad-output/project-context.md` (one new rule bullet). **No `apps/web` files are touched by this story** — wiring the hook into any real page (Discovery's `home-content.tsx`, the three moderator-tools pages, the FilterHub temporal-filter sweep) is explicitly out of scope; see sibling Stories 0.i5b/0.i5c/0.i5d, already written into `epics.md` under Epic 0.i5.
- Source of truth for scope: `_bmad-output/planning-artifacts/epics.md` Story 0.i5a. **Scope note (read before implementing):** the user's `bmad-create-story` invocation for this session asked to fold IDEA-011 + BUG-019 into one story and, if this story's scope doesn't reach BUG-019's concrete call site, to carve a follow-up. Investigation confirmed this story's scope (the shared mechanism) does **not** reach BUG-019's concrete call site (`home-content.tsx`) by design — that adoption already has its own already-existing sibling story, **Story 0.i5b** (`0-i5b-adopt-the-controller-in-discovery-event-list-surfaces`, already `backlog` in `sprint-status.yaml` and already fully specified in `epics.md`). Per `backlog-spec.md` §13 step 4's escalation rule, this satisfies the "note BUG-019 as needing its own follow-up carve" requirement — **no new backlog/epics.md entry is needed since that carve already exists**; see "Out of Scope" below.
- The user was asked via `AskUserQuestion` whether to (a) create only 0.i5a as originally formed, (b) merge 0.i5a+0.i5b into one story now, or (c) create both 0.i5a and 0.i5b in this session. **Answer: (a), create 0.i5a only.** This story's scope, ACs, and Out of Scope section reflect that choice.

### Architecture & UX Gate Findings

- No `epic-0-i5-readiness.md` sweep exists yet (only `epic-0-readiness.md` and `epic-0-i7-readiness.md` exist under `epic-readiness/`), so Gates 1, 2, and 3 were run fresh for this story (not cited from a swept report), per `story-split-gate.md`.
- **Gate 1 (Architecture/Infra Completeness):** No gap found. This story is a pure client-side state hook — it doesn't fetch data itself, only manages cursor/reset bookkeeping on top of already-existing GraphQL operations that already go through the standard `@tanstack/react-query` + `graphql-request` + codegen path. No new resolvers, fields, endpoints, DB/queue changes, or external-service calls. AD-18 is documentation-only, codifying already-unanimous existing behavior, not new runtime infrastructure.
- **Gate 2 (UI Complexity & Reusability):** No gap found. The prev/next/total surface is a plain data/callback shape derived from state the hook already owns — not a component, no render logic, and can't be meaningfully designed separately from the reset mechanism (the reset logic determines what that state shape looks like post-reset). **Flagged, not a gap:** the cited `EXPERIENCE.md` text covers the Filter Hub's real-time-update behavior but says nothing about pagination or a prev/next control — there is no existing UX spec authority for what a rendered prev/next control should look like. This is fine for this story (no UI is built here), but the sibling story that eventually renders prev/next UI (0.i5c/0.i5d) will need net-new UX spec work first, since `EXPERIENCE.md` doesn't cover it — noted for that story's own creation, not actionable here.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness):** No gap found. Every dependency this hook touches — `useDebounce` (already used by `SearchBar.tsx`), `nuqs` (already used by `FilterHub.tsx`/`home-content.tsx`), `@tanstack/react-query` (already used by both Discovery and moderator-tools consumers) — is pre-existing and already in active use elsewhere; this story introduces no new foundational dependency that other stories would also need. `useInfiniteScroll` is reused, not reimplemented (see Task 3).

### `packages/domain` reusability check

Explicitly considered and ruled out: `packages/domain` is for pure, framework-agnostic business logic importable by both frontend and backend (per `project-context.md`'s Code Organization rule), and would be the right home for a generic, cross-entity mechanism like the AD-1 Query DSL. Pagination/cursor UI state, however, is a pure React/client concern — no backend code would ever import it, and there is no request/response contract crossing the frontend/backend boundary here (the DSL for the actual query condition remains AD-1's job, unaffected by this story). `useListPaginationController` therefore belongs in `packages/ui/src/hooks/`, not `packages/domain`.

### State management categorization

Per `project-context.md`'s three-tier model (AD-4: Server State via react-query, URL State via `nuqs`, Client Global State via `zustand`), this hook's cursor/history/`resetToken` state fits **none of the three tiers** — it is local, hook-encapsulated implementation-detail state, the same category `useInfiniteScroll`'s own internal `node`/`error` `useState` already occupies (that hook is a project precedent, not itself categorized into AD-4's tiers either). AD-4 governs state with cross-cutting scope (shared across components, async/cached, or shareable via URL); a hook-local hook that a single list view owns and doesn't need to persist across reloads or share with a sibling component sits beneath that classification by design. `filterKey` itself remains whatever tier the consumer already uses for its filters (URL state via `nuqs`, per `FilterHub.tsx`'s existing pattern) — this hook only reads it as an opaque comparison value, it doesn't take ownership of it.

### Loader categorization

Not applicable — this story adds no new asynchronous operation of its own (no new fetch, no new mutation). It only restructures how existing consumers track pagination cursor/reset state around fetches they already perform; the Non-Blocking (Infinite Scroll)/Skeleton loader rules already documented in `project-context.md` continue to apply unchanged at each consumer's own call site (Stories 0.i5b/0.i5c/0.i5d).

### Analytics (AD-5) check

No new PostHog event is required by this story. The hook is headless and analytics-agnostic by design (matching `useInfiniteScroll`'s precedent, which also emits no analytics). Discovery's existing `filter_applied` event (`home-content.tsx`'s `handleFilterChange`) already fires at the call site regardless of this hook. If a future adopting story (0.i5c's moderator prev/next UI, for example) wants a "moderator paged forward" event, that is instrumented at the call site as usual — not this story's concern.

### i18n (AD-6) check

Not applicable. This story introduces no user-facing strings — it is a headless hook with no rendered UI, so there is nothing to route through `next-intl`.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No mismatch found — no changes required.
- **Impacted fields/contracts:** None. This story adds no DB columns, no GraphQL SDL fields, no resolver changes, and no new TypeScript types shared across a frontend/backend boundary. `useListPaginationController`'s types are internal to `packages/ui` and generic over caller-supplied `TFilterKey`/`TCursor` type parameters — they don't need to match any existing schema shape.
- **Required DB migration changes:** No changes required.
- **Required TypeScript type changes:** No changes required beyond the new hook's own types file (Task 2), which is net-new, not a modification to an existing shared type.
- **Backward compatibility and rollout notes:** Purely additive — a new exported hook nothing currently imports. Zero risk to existing consumers until Stories 0.i5b/0.i5c/0.i5d adopt it.
- **Verification checks:** New unit tests (Task 5) plus `tsc`/ESLint clean for `packages/ui`.

### Project Structure Notes

- New files only: `packages/ui/src/hooks/useListPaginationController.ts`, `.types.ts`, `.test.ts` — follows the exact existing sibling-hook file-triplet convention (`useInfiniteScroll.*`, `useWeeklyCalendarController.*`).
- One-line addition to the existing `packages/ui/src/hooks/index.ts` barrel file.
- Documentation-only edits to `festgrid-architecture-spine.md` (new AD-18 section) and `project-context.md` (one new bullet under "UI Patterns & UX Invariants").
- No `apps/web`, `apps/backend`, `packages/domain`, or `packages/database` files touched.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.i5a] (and sibling Stories 0.i5b/0.i5c/0.i5d/0.i5z for downstream context)
- [Source: _bmad-output/implementation-artifacts/backlog.yaml#IDEA-011, #BUG-018, #BUG-019, #BUG-020] (originating backlog rows)
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-1, #AD-4, #AD-8, #AD-10, #AD-11, #AD-14, #AD-17] (Binds/Prevents/Rule format precedent for new AD-18; AD-1/AD-4 cross-checked for Gate 3)
- [Source: _bmad-output/project-context.md#UI Patterns & UX Invariants, #State Management Architecture, #Code Organization] (existing rules cross-checked; new rule added here)
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md] ("Filtering" / "Main Experience Flow" sections — authoritative confirmation that Filter Hub already updates "in real-time with each selection," settling AD-18's rule as codification, not a fresh design choice)
- [Source: packages/ui/src/hooks/useInfiniteScroll.ts, useInfiniteScroll.types.ts, useInfiniteScroll.test.ts] (file-triplet convention and JSDoc/`@example` style to follow; the hook this story deliberately does NOT wrap, per Task 3)
- [Source: packages/ui/src/hooks/useWeeklyCalendarController.ts] ("...Controller" naming precedent)
- [Source: packages/ui/src/hooks/useDebounce.ts, packages/ui/src/features/events/SearchBar.tsx] (existing debounce-for-continuous-input precedent AD-18 cites)
- [Source: packages/ui/src/features/events/FilterHub.tsx] (confirms apply-on-change is already the unanimous discrete-control behavior — `onChange`/`nuqs` setters fire immediately, no Apply button exists)
- [Source: apps/web/src/app/[locale]/home-content.tsx] (Discovery's `useInfiniteQuery` with filters embedded directly in `queryKey` — the correct integration pattern AC2 documents; confirmed this file is NOT touched by this story, only by 0.i5b)
- [Source: apps/web/src/app/[locale]/moderator/tools/filter-panel.tsx] (the decorative, non-functional "Apply" button — onChange handlers already fire immediately, contradicting the button's implied semantics; the concrete cleanup target for AD-18 adoption in Story 0.i5c, not this story)
- [Source: apps/web/src/app/[locale]/moderator/tools/unprocessed-payloads-content.tsx, unprocessed-payloads-hooks.ts] (existing hand-rolled `useState<cursor>` + manual `setCursor(undefined)` reset-on-filter-change — the exact pattern `useListPaginationController` generalizes so a future page can't forget the reset)

### Backlog row history (IDEA-011, verbatim, moved from backlog.yaml 2026-09-18)

Reported by user on `event-list-bug-fixes-pagination` branch, in the same session as
BUG-018/019/020. Currently inconsistent across the app — e.g. moderator filter panels call
`handleFilterChange` on every `onChange` (apply-on-change), and BUG-019 shows that pattern can
cause append-instead-of-reload bugs; meanwhile no documented rule said whether a filter should
take effect immediately on change or only after an explicit Apply action. Needed a
cross-cutting decision (likely in `project-context.md` and/or a UX token/primitive) so all
list, discovery, and moderation views behave the same way.

**PROMOTED 2026-09-15 (bmad-create-story):** this story (0.i5a) settles this directly — new
AD-18 (architecture spine) + `project-context.md` rule, confirmed against EXPERIENCE.md's
Filter Hub spec ("updates in real-time with each selection") as codifying already-unanimous
existing behavior. Per epics.md's own note on this story, this idea does not get a separate
adoption story — this story's rule-writing task is its full implementation.

**VERIFIED 2026-09-17 (ritual-orchestrator batch, pre-dispatch check):** same stale-checkbox
situation as BUG-019 (its concrete-case row) — this story already `review` in
sprint-status.yaml. No new dispatch run. Plan doc checkbox corrected.

## Global Rules References

- [x] `_bmad-output/project-context.md` — UI Patterns & UX Invariants (new AD-18 bullet added here), State Management Architecture (AD-4 cross-check, see Dev Notes categorization), Code Organization (packages/domain applicability ruled out, see Dev Notes)
- [x] `story-content-structure.md` — this story's section order/status vocabulary
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-8/AD-10/AD-11/AD-14 (format precedent for new AD-18), AD-1/AD-4 (Gate 3 cross-check)
- [x] `docs/infrastructure/index.md` — reviewed; not applicable (frontend-only story, no backend compute/queue/DB touched)

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - `packages/ui/src/hooks/useListPaginationController.ts` (new) — hook implementation (Task 3).
  - `packages/ui/src/hooks/useListPaginationController.types.ts` (new) — types (Task 2).
  - `packages/ui/src/hooks/useListPaginationController.test.ts` (new) — unit tests (Task 5).
  - `packages/ui/src/hooks/index.ts` — add two barrel exports (Task 4).
  - `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — new `### AD-18: Filter Apply-Timing Convention` section, after AD-17 (Task 1).
  - `_bmad-output/project-context.md` — one new bullet under "UI Patterns & UX Invariants" (Task 1).
- **Rule Mapping:**
  - AD-8/AD-10/AD-11/AD-14 format precedent → Task 1's AD-18 section structure.
  - `story-split-gate.md` Gate 1/2/3 → all run fresh, no gap (Dev Notes → Architecture & UX Gate Findings).
  - Data Type Compatibility rule (this workflow) → dedicated Dev Notes section; no changes required.
  - Code Organization rule (packages/domain vs packages/ui) → dedicated Dev Notes section explicitly ruling out packages/domain.
  - State Management Architecture rule (AD-4 three-tier categorization) → dedicated Dev Notes section.
- **Verification Plan:**
  - `pnpm --filter @festgrid/ui test` (Vitest) — all new `useListPaginationController.test.ts` cases green, no regression in sibling hook tests.
  - `pnpm --filter @festgrid/ui lint` / `tsc` — clean for the three new files and the modified `index.ts`.
  - Manual read-through: confirm `festgrid-architecture-spine.md`'s new AD-18 section follows the exact Binds/Prevents/Rule structure of AD-14, and `project-context.md`'s new bullet is placed under "UI Patterns & UX Invariants," not a mismatched section.
  - Confirm (via `git diff`/file list) that no file under `apps/web`, `apps/backend`, `packages/domain`, or `packages/database` was touched — this story's boundary is `packages/ui` + two planning docs only.

## Pre-Coding Approval Gate

- [x] Scope confirmation — Tasks 1–5 above match the intended scope: build + document the shared controller and the apply-on-change rule; do NOT adopt the hook into any real page (Discovery, moderator tools) and do NOT touch BUG-019's concrete `home-content.tsx` call site (that is Story 0.i5b, already specified in `epics.md`).
- [x] Architecture and boundary confirmation — no `apps/web`/`apps/backend`/`packages/domain`/`packages/database` files touched; new hook lives in `packages/ui/src/hooks/` per the existing file-triplet convention; `packages/domain` applicability explicitly ruled out (Dev Notes).
- [x] Testing plan confirmation — Task 5's test list covers AC1 (reset-on-filter-change, including the same-render-pass guarantee), AC2 (no-remount-required structural guarantee), AC3 (prev/next/total bookkeeping), and AC5 (export + Vitest coverage matching sibling hooks).
- [x] Explicit human approval state — **approved** (via `AskUserQuestion`, 2026-09-15, "Approve, start coding")
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — all three gates run fresh for this story (no swept `epic-0-i5-readiness.md` exists yet), all three found no gap (Dev Notes → Architecture & UX Gate Findings). Gate 2's non-blocking flag (future prev/next UI needs net-new UX spec work) is noted for 0.i5c/0.i5d's own creation, not a prerequisite for this story.
- [x] **Scope decision confirmed:** user was asked via `AskUserQuestion` how to reconcile this session's "fold BUG-019 into one story" instruction against the pre-existing epic-0.i5a/0.i5b split, and explicitly chose "create 0.i5a only, as originally formed." BUG-019's concrete fix is deferred to already-existing Story 0.i5b, not silently dropped — see Dev Notes and Out of Scope.

## Testing Requirements

- [x] Unit tests — `packages/ui/src/hooks/useListPaginationController.test.ts` (Task 5), `@testing-library/react`'s `renderHook`/`rerender`/`act` + Vitest, matching `useInfiniteScroll.test.ts`'s existing style. `packages/ui` is not under the `packages/domain` 100%-coverage mandate, but should match the coverage depth of its sibling hook test files.
- [x] Integration tests — not applicable; no consumer wiring happens in this story (integration coverage for the hook-in-context lands with Stories 0.i5b/0.i5c/0.i5d).
- [x] E2E tests — not applicable; no user-facing surface changes in this story.

## Deliverables Checklist

- [x] `useListPaginationController` implemented, typed, and exported from `@festgrid/ui` per Tasks 2–4.
- [x] AC1 (reset-on-filter-change), AC2 (no-remount-required contract), AC3 (prev/next/total bookkeeping) all covered by passing unit tests.
- [x] `AD-18: Filter Apply-Timing Convention` written to the architecture spine, immediately after AD-17.
- [x] `project-context.md` gains the corresponding "UI Patterns & UX Invariants" bullet.
- [x] IDEA-011's `stories` field in `backlog.yaml` already references this story (set during `bmad-create-story`); BUG-019's `stories` field is deliberately left unset per its own AMENDED note — its concrete fix lands with Story 0.i5b, no new carve needed here.

## Out of Scope

- **BUG-019's concrete fix in `home-content.tsx`** — this story builds the generalized mechanism (reset-on-filter-change contract) but does not adopt it into Discovery's actual event list. That adoption, and therefore BUG-019's literal closure, is **Story 0.i5b** (`0-i5b-adopt-the-controller-in-discovery-event-list-surfaces`), already fully specified in `epics.md` and already `backlog` in `sprint-status.yaml` — no new backlog/epics.md entry needed; this satisfies the session's "note BUG-019 as needing its own follow-up carve" instruction via an already-existing carve rather than a new one.
- **BUG-018's concrete fix** — same reasoning; this story establishes the structural contract (AC2) that prevents the anti-pattern plausibly causing it, but the actual verification against Discovery's real DOM/scroll behavior happens in Story 0.i5b.
- **BUG-020's moderator-tools prev/next UI** — Story 0.i5c.
- **IDEA-019's temporal filter (Happening now/Upcoming/All)** — Story 0.i5d.
- **The CI-enforced ratchet** asserting no list surface manages pagination/filter state locally outside the controller — Story 0.i5z (depends on 0.i5a–0.i5d).
- **Rendered prev/next UI components** — not built by this story (headless hook only); Gate 2 flagged that whichever story renders this UI (0.i5c/0.i5d) will need net-new UX spec work first, since `EXPERIENCE.md` doesn't cover a prev/next control today.

## Definition of Done

- [x] AC 1–5 satisfied.
- [x] Required tests passing (Task 5 + Testing Requirements).
- [x] Lint and type checks passing for `packages/ui`.
- [x] Pre-Coding Approval Gate's scope decision item explicitly confirmed before this story is marked done.

## Completion Status

- [x] Complete — ready for review

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

None — implementation proceeded without needing a separate debug log; all verification commands and outcomes are captured in Completion Notes below.

### Completion Notes List

- Implemented `useListPaginationController` (`packages/ui/src/hooks/useListPaginationController.ts` + `.types.ts`) per Tasks 2–3: reset-on-filterKey-change computed synchronously during render (compare-ref pattern, not `useEffect`), `resetToken` counter, cursor-history-backed `goToNextPage`/`goToPrevPage`, consumer-reported `reportPageMeta`/`hasNextPage`/`totalCount` (cleared on reset), and `resetToFirstPage`. Deliberately does not compose `useInfiniteScroll` (Task 3 requirement) — top-of-file JSDoc documents the required `resetToken`/`cursor`-into-`queryKey` integration contract with an explicit "do NOT do this" `<List key={resetToken}>` counter-example.
- Exported the hook + types from `packages/ui/src/hooks/index.ts` (Task 4), matching the existing sibling-hook barrel pattern.
- Added `packages/ui/src/hooks/useListPaginationController.test.ts` (Task 5): 9 tests covering AC1 (reset-on-filter-change reflected in the same render pass, custom `isEqual`), AC2 (no-remount-required — same `renderHook` result instance across the reset), AC3 (`goToNextPage`/`goToPrevPage`/`pageIndex`/`hasPrevPage`/`reportPageMeta`/`resetToFirstPage`), and `onReset` firing exactly once per actual filterKey change (not on mount, not on equal-by-`isEqual` rerenders).
- Added `### AD-18: Filter Apply-Timing Convention` to `festgrid-architecture-spine.md`, immediately after AD-17, in the Binds/Prevents/Rule format matching AD-8/AD-10/AD-11/AD-14 (Task 1).
- Added the corresponding bullet to `project-context.md`'s "UI Patterns & UX Invariants" section, referencing AD-18 and naming `useListPaginationController` as the required mechanism (Task 1).
- Confirmed via `git status`/file list that only `packages/ui/src/hooks/*`, `festgrid-architecture-spine.md`, and `project-context.md` were touched — no `apps/web`, `apps/backend`, `packages/domain`, or `packages/database` files, matching the story's scope boundary and Implementation Plan's Verification Plan.
- **Verification Plan commands actually executed (per persistent workflow fact — not inferred from the plan):**
  - `pnpm --filter @festgrid/ui test -- useListPaginationController` → 9/9 new tests passed.
  - `pnpm --filter @festgrid/ui test` (full package suite) → 51 test files / 485 tests passed, no regressions in sibling hooks.
  - `pnpm lint` (repo root) → 0 errors (1136 pre-existing warnings, all in files this story did not touch).
  - `pnpm build` (repo root) → 7/7 tasks successful, including `packages/ui`'s typecheck/build and `apps/web`'s Next.js build.
  - Manual read-through confirmed AD-18 follows AD-14's exact Binds/Prevents/Rule structure and `project-context.md`'s new bullet sits under "UI Patterns & UX Invariants."

### File List

- `packages/ui/src/hooks/useListPaginationController.ts` (new)
- `packages/ui/src/hooks/useListPaginationController.types.ts` (new)
- `packages/ui/src/hooks/useListPaginationController.test.ts` (new)
- `packages/ui/src/hooks/index.ts` (modified — two barrel exports added)
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (modified — new AD-18 section)
- `_bmad-output/project-context.md` (modified — new UI Patterns & UX Invariants bullet)
- `_bmad-output/implementation-artifacts/0-i5a-build-the-shared-pagination-filter-controller.md` (modified — this story file: Pre-Coding Approval Gate, Tasks/Subtasks, Testing Requirements, Deliverables Checklist, Definition of Done, Completion Status, Dev Agent Record, Status)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — status transitions for `0-i5a-build-the-shared-pagination-filter-controller`)

### Change Log

- 2026-09-15: Story implemented end-to-end (Tasks 1–5). `useListPaginationController` built, tested (9 new unit tests, 485 total passing in `packages/ui`), and exported from `@festgrid/ui`. `AD-18: Filter Apply-Timing Convention` added to the architecture spine and `project-context.md`. `pnpm lint`/`pnpm build` both clean at the repo root. Status → review.
