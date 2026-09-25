# Story 0.45: Replace GridContainer's masonry engine with JS shortest-column placement

## Story Details

- Epic: 0
- Story ID: 0.45
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want `GridContainer`'s (`packages/ui/src/core/grid-container.tsx`) masonry consumer path replaced with a real JS shortest-column-placement algorithm (measure each card's rendered height, place each next item into whichever column is currently shortest) instead of its current plain-CSS-Grid implementation, and `EventCard.tsx`'s masonry variant's `max-w-[230px]` cap removed in favor of the card filling its actual column width with its internal elements/font-size scaling responsively,
So that the Discovery masonry surface (`EventListView.tsx`) achieves true Pinterest-style independent per-column height flow instead of CSS Grid's row-locked height (Architecture Spine AD-27), and cards stop centering inside wide, mostly-empty grid cells on desktop viewports (user-reported, code-confirmed regression).

## Acceptance Criteria

1. **Given** `GridContainer` today only implements plain CSS Grid, **When** this story ships, **Then** `GridContainer` gains a new `layout?: 'css-grid' | 'masonry'` prop, defaulting to `'css-grid'` — every existing non-masonry consumer (standard `baseCols=1` grids, e.g. Favorites/Subscriptions pages) is unaffected, and `grid-container.test.tsx`'s existing assertions for the default/`css-grid` path continue to pass unmodified.
2. **Given** AD-27 Rule 1 (JS shortest-column placement, the standard Pinterest/`react-masonry-css` algorithm), **When** `layout="masonry"` is set, **Then** a new hand-rolled hook `useMasonryLayout` (`packages/ui/src/hooks/useMasonryLayout.ts`, exported from `packages/ui/src/hooks/index.ts` alongside `useInfiniteScroll`/`useListPaginationController`/`useCollapseHeaderOnScroll`) measures each child's rendered height post-mount/post-remeasure and assigns each item to whichever column currently has the shortest accumulated height — no third-party masonry library is added (see Dev Notes "Library vs. hand-rolled decision").
3. **Given** DESIGN.md's `components.grid.masonry` token (`design-artifacts/UX-festgrid-run-1/DESIGN.md:37`) documents `GridContainer(baseCols=2, colsStep=1)` as producing 2/3/4/5/6 columns across base/md/lg/xl/2xl (Gate 2 finding), **When** `layout="masonry"` computes its column count, **Then** it derives the count from the same `baseCols`/`colsStep` formula already used by the `css-grid` path (same 5 breakpoint thresholds: 768/1024/1280/1536px, matching Tailwind's `md`/`lg`/`xl`/`2xl`), so `EventListView`'s existing `baseCols={2} colsStep={1}` continues to yield exactly 2/3/4/5/6 columns — no silent deviation from the validated token.
4. **Given** AD-27's rejection of CSS Grid's row-locked height and of CSS multi-column's reading-order regression, **When** `layout="masonry"` renders, **Then** columns are equal-width flex tracks (`flex-1 min-w-0`, no CSS Grid fractional-column sizing) that vary independently in height, and item placement order approximates today's row-major left-to-right reading order (not column-major) — verified structurally per AC9, not just by inspection.
5. **Given** AD-27 Rule 2's required hydration/layout-shift strategy (deferred to this story), **When** the component first renders server-side (no measured heights available yet), **Then** `useMasonryLayout` places items round-robin across the current breakpoint's column count as an estimated first pass, then — after hydration, once `ResizeObserver`-backed measurement of each item's real rendered height completes (mirroring the `measure()` + `ResizeObserver` idiom already established by `swipe-to-reveal.tsx`) — reflows items into true shortest-column placement; the reflow also re-triggers on a column-count-changing breakpoint resize and on any subsequent height change of an already-placed item (e.g. an async-loading `EventCard` thumbnail growing the card).
6. **Given** `EventListView.tsx`'s two `GridContainer` call sites (the `status === 'loading'` skeleton grid, line 23, and the success-state grid, line 64) both pass `baseCols={2} colsStep={1}`, **When** this story ships, **Then** both call sites add `layout="masonry"` so the skeleton grid and the real grid use the same engine (preventing a loading→loaded layout jump).
7. **Given** `EventCard.tsx`'s masonry variant caps at `max-w-[230px]` regardless of its actual grid-cell width (`EventCard.tsx:239`, and its loading-skeleton twin at `EventCard.tsx:146`), **When** this story ships, **Then** both `max-w-[230px]` occurrences are removed so the masonry card fills its actual column width (`w-full` within the flex column track), eliminating the wide-viewport centered-card/empty-gap regression.
8. **Given** the user wants the card's internal elements/font-size to scale responsively at larger column widths instead of a hard width cap, **When** column width grows on wider viewports, **Then** this reuses the existing CSS-container-query mechanism already established for the masonry card (`EVENT_CARD_CONTAINER_CLASS = '[container-type:inline-size]'` on the card root, `EVENT_CARD_BADGE_TEXT_SIZE_CLASS`'s `[@container(min-width:200px)]:` pattern, Story 1.i1l) — not a second, viewport-breakpoint-based mechanism, since the card's own rendered width (not the viewport) is what now varies under the JS masonry engine. At minimum, the card title (`h3`, currently a fixed `text-sm`) gains one additional `@container` step for wider columns, using the same arbitrary-variant technique; any other elements scaled follow the same container-query-only rule.
9. **Given** AD-27 Rule 3 ("verified by AD-26's rule-based audit mode, not a bespoke one-off test"), **When** this story ships, **Then** a new, real manifest entry is added at `packages/visual-audit/manifests/grid-container-masonry.ts` — `renderScope: 'multi-instance'`, `mode: 'rule'`, using the `react-component` `RenderSpec` (AD-26 Review Follow-up mechanism) to mount the **real** `GridContainer`(`layout="masonry"`) + real `EventCard` components with fixture props of varying content lengths (not the existing synthetic `masonry-column-width-invariant.ts` fixture-div proof-of-concept, which stays as-is as an engine proof, not this story's real check) — encoding: (a) a `sibling-dimension` rule asserting all column tracks share one width (≤2px tolerance), and (b) a rule proving placement order approximates left-to-right (e.g. asserting the first N items land one-per-column in index order, N = column count). This is the manifest entry this story's own `bmad-dev-story` Definition of Done runs and must pass — not a bespoke Playwright script.
10. **Given** i18n applicability (`story-content-structure.md`), **When** this story ships, **Then** no new user-facing strings are introduced — this is purely structural/layout and CSS work; explicitly confirmed N/A.
11. **Given** the pure column-assignment logic is the most failure-prone part of this story, **When** this story ships, **Then** `useMasonryLayout` has a dedicated `useMasonryLayout.test.ts` (Vitest + `@testing-library/react`'s `renderHook`, matching `useListPaginationController.test.ts`'s existing pattern) covering: shortest-column selection with unequal heights, the round-robin SSR-estimate first pass, reflow-on-remeasure, and reflow-on-column-count-change; and `grid-container.test.tsx` gains coverage for the new `layout="masonry"` path (column track count/equal-width classes) alongside its existing default-path assertions (AC1).

## Tasks / Subtasks

- [ ] Task 1 — `GridContainer` `layout` prop and column-count derivation (AC1, AC3)
  - [ ] Add `layout?: 'css-grid' | 'masonry'` to `GridContainerProps` (`grid-container.types.ts`), default `'css-grid'`.
  - [ ] Extract the existing `baseCols`/`colsStep` → per-breakpoint column-count formula into a shared helper usable by both the `css-grid` (Tailwind class lookup) and `masonry` (JS column count) paths, so both stay derived from one source instead of two independently-maintained tables.
- [ ] Task 2 — `useMasonryLayout` hook (AC2, AC4, AC5, AC11)
  - [ ] Implement `packages/ui/src/hooks/useMasonryLayout.ts` + `.types.ts`: takes item count/refs and the current column count, returns column assignments.
  - [ ] SSR/first-paint estimate: round-robin assignment by index (no measurement dependency).
  - [ ] Post-hydration: measure each item's rendered height (`ResizeObserver`, mirroring `swipe-to-reveal.tsx`'s `measure()` idiom); reflow into true shortest-column placement.
  - [ ] Recompute column count and re-run placement on a breakpoint-crossing container/window resize.
  - [ ] Re-run placement when an already-placed item's measured height changes (e.g. async image load).
  - [ ] Export from `packages/ui/src/hooks/index.ts`.
  - [ ] Unit tests: `useMasonryLayout.test.ts`.
- [ ] Task 3 — `GridContainer` masonry render path (AC4)
  - [ ] When `layout="masonry"`, render N equal-width (`flex-1 min-w-0`) column tracks wired to `useMasonryLayout`'s assignments, instead of the CSS Grid classes.
  - [ ] Translate the existing `gap` prop (e.g. `gap-x-2 gap-y-6`) into the flex-track model (row-level horizontal gap between tracks, per-track vertical gap between stacked items).
  - [ ] Update `grid-container.test.tsx` for the new path (AC11).
- [ ] Task 4 — Wire `EventListView.tsx` to `layout="masonry"` (AC6)
  - [ ] Add `layout="masonry"` to both `GridContainer` call sites (loading skeleton line 23, success grid line 64).
- [ ] Task 5 — Remove `EventCard.tsx`'s masonry width cap and add container-query scaling (AC7, AC8)
  - [ ] Remove `max-w-[230px]` at `EventCard.tsx:239` (real render) and `EventCard.tsx:146` (loading skeleton); confirm `w-full` alone governs width within the new flex column track.
  - [ ] Add at least one additional `@container` step to the card title's font-size (and any other element judged to need it during implementation), following `EVENT_CARD_BADGE_TEXT_SIZE_CLASS`'s existing arbitrary-variant pattern — no new viewport-breakpoint-based sizing.
  - [ ] Update `EventCard.test.tsx`'s `max-w-[230px]` assertions (currently at lines ~971/993) to assert the cap's removal and the new container-query class instead.
- [ ] Task 6 — Real visual-audit manifest entry (AC9)
  - [ ] Author `packages/visual-audit/manifests/grid-container-masonry.ts` per AC9; register it in `packages/visual-audit/manifests/index.ts`.
  - [ ] Confirm it runs and passes via `packages/visual-audit`'s public API (`pnpm --filter @festgrid/visual-audit test` or the manifest-runner entrypoint Story 0.43 exposed).
- [ ] Task 7 — DESIGN.md reconciliation (AC3)
  - [ ] Confirm `components.grid.masonry` token's documented breakpoint→column-count table still matches after this story (it should, per AC3's derivation requirement); if the flex-track implementation changes the token's literal Tailwind-class description (`grid grid-cols-2 md:grid-cols-3...`), update the token's comment to describe the new flex-track shape while keeping the same column-count semantics.
- [ ] Task 8 — Full regression pass (Definition of Done)
  - [ ] `pnpm --filter @festgrid/ui test`, `pnpm --filter @festgrid/ui lint`, `pnpm --filter @festgrid/visual-audit test`.

## Dev Notes

- **This session's own prior investigation (do not re-diagnose):** `EventCard.tsx:239`'s `max-w-[230px]` (and its skeleton twin at line 146) caps every masonry card regardless of actual grid-cell width; `EventListView.tsx`'s two `GridContainer` call sites (lines 23, 64) both pass `baseCols={2} colsStep={1}`; `GridContainer`'s current implementation (`grid-container.tsx`) is plain CSS Grid (`grid-cols-N` Tailwind classes) for all `baseCols`/`colsStep` configurations, including the "masonry" one — CSS Grid ties every row's height to its tallest cell across all columns, so it cannot let one column flow independently past a shorter card in another column. All three facts are already confirmed by direct code reading, not re-derived here.
- **Files read completely for this story (UPDATE, not NEW):** `packages/ui/src/core/grid-container.tsx`, `grid-container.types.ts`, `grid-container.test.tsx`; `packages/ui/src/features/events/EventCard.tsx`, `EventCard.test.tsx`, `EventCardMediaPrimitives.tsx` (container-query mechanism); `packages/ui/src/features/events/EventListView.tsx`; `packages/visual-audit/src/manifest.ts`, `manifests/masonry-column-width-invariant.ts`, `manifests/index.ts`.

### Library vs. hand-rolled decision (AD-27 Deferred item 1)

Web-researched 2026-09-25 (not training-data assumption):
- **`react-masonry-css`** — latest published version `1.0.16`, last published **5 years ago**. Effectively unmaintained. [Source: npmjs.com/package/react-masonry-css]
- **`react-masonry-component`** — wraps the older Masonry.js (jQuery-plugin heritage), not a modern hooks-first API; ~89.6k weekly downloads but architecturally the oldest of the candidates. [Source: npmtrends.com/react-masonry-component]
- **`masonic`** (`jaredLunde/masonic`) — the most actively-engineered option (~79.6k weekly downloads), but it is a **virtualized/windowed** masonry library — solving a different, harder problem (thousands of items, windowing) than this list's real scale, and its windowing model would need to be reconciled with `EventListView`'s existing `useInfiniteScroll`/`useListPaginationController` infinite-scroll machinery rather than composing cleanly with it. Last published ~1 year ago (April 2025). [Source: npmjs.com/package/masonic, github.com/jaredLunde/masonic]
- **`react-responsive-masonry`** — lighter, CSS-flexbox-based, updated as recently as April 2026, but implements column-major (CSS-multi-column-style) placement internally — the exact reading-order regression AD-27 already rejected. [Source: npmjs.com/package/react-responsive-masonry]

**Decision: hand-rolled hook (`useMasonryLayout`), not a library.** None of the maintained options both (a) implement true shortest-column placement with left-to-right-approximate order and (b) avoid the windowing complexity `masonic` requires. This also matches this codebase's own strong, consistent precedent: every non-trivial piece of reusable layout/interaction logic in `packages/ui` (`useInfiniteScroll`, `useListPaginationController`, `useCollapseHeaderOnScroll`, `useWeeklyCalendarController`, `swipe-to-reveal.tsx`'s `measure()`) is a hand-rolled hook, never a third-party layout library — and `project-context.md`'s Code Quality rules explicitly route "reusable React hooks or stateful UI logic" to `packages/ui/src/hooks/`. A hand-rolled hook also keeps full control over the SSR/hydration strategy (below), which every evaluated library either doesn't address at all or addresses in a way incompatible with this app's SSR'd list pages.

### Hydration / layout-shift strategy decision (AD-27 Deferred item 2)

**Decision: estimated-height first pass (round-robin by index), reflowed post-hydration once real heights are measured** — the first of AD-27 Rule 2's two named options, not a skeleton-held approach. Rationale:
- `EventListView.tsx` already has its own dedicated loading-skeleton state (`status === 'loading'`, rendering `skeletonCount` blank `EventCard loading={true}` items) for the *initial data fetch*. A second, separate "skeleton held until masonry measurement completes" state would be a redundant, confusing third loading state layered on top of that, for a reflow that (per the `swipe-to-reveal.tsx` `measure()` precedent) typically completes within a frame or two of mount.
- Round-robin placement keeps content visible and crawlable at first paint (no CLS-inducing blank hold), and reflowing a few cards between columns on measurement is a strictly smaller visual disturbance than the current production bug (large empty inter-column gaps) it replaces.
- Reuses this codebase's own established idiom exactly: `swipe-to-reveal.tsx`'s `measure()` (called once on mount, re-run via `ResizeObserver`) and `useCollapseHeaderOnScroll`'s "measure once on mount, gate behavior on it" pattern — no new pattern invented.

### Architecture & UX Gate Findings

Story Split Gates run fresh for this story (the existing `_bmad-output/planning-artifacts/epic-readiness/epic-0-readiness.md` sweep is `swept: true` but its `stories_covered` frontmatter only lists Stories 0.1–0.19 — it predates and does not cover this AD-27 scope, so it was treated as not covering this story per the skill's own escape-hatch guard).

- **Gate 1 (Winston, Architecture/Infrastructure Completeness): No gap found.** Entirely within `packages/ui`, a presentational package. No DB/ORM/domain-package call, no external-service call from frontend, no new API surface/resolver/mutation, no auth/secrets/business-rules added, no new infra dependency — `packages/visual-audit` is already `done` (Story 0.43 + its hard prerequisite Story 0.44, both `done` in `sprint-status.yaml`), so citing it (AC9) uses already-shipped infra, not an unbuilt one.
- **Gate 2 (Freya, UI Complexity & Reusability): No split required, one AC-completeness finding incorporated.** `DESIGN.md:34-37`'s `components.grid.masonry` token explicitly documents itself as "the *output* of `GridContainer(baseCols, colsStep)` ... not hand-maintained separately from the component" (2/3/4/5/6 columns across breakpoints). The new hook must preserve that same breakpoint→column-count table rather than silently deviating — captured as AC3/Task 1/Task 7 rather than as grounds to split the hook into its own story (it is already this story's explicit, first-class, named deliverable, not scope silently buried inside something else). No responsive-font-scaling or max-width spec exists in DESIGN.md for `EventCard`'s masonry variant (its sizes there are fixed px tokens) — the "scale responsively" work is genuinely new UX territory with nothing pre-specified to contradict, addressed via the existing container-query mechanism (AC8) rather than inventing a new one.
- **Gate 3 (Winston, Foundational/Cross-Cutting Dependency Completeness): No gap found.** The hook needs only React state/`useEffect`/`ResizeObserver` on DOM `GridContainer` already renders — no global shell, i18n, analytics, or GraphQL/codegen dependency. `packages/visual-audit` (AD-26/Story 0.43) and its Story 0.44 prerequisite are both `done`; citing it and authoring a new manifest entry (AC9) is expected, in-scope authoring — precedent already executed successfully by Story 1.i1n's `event-card-date-box-overflow.ts`. The hydration/measurement idiom (`swipe-to-reveal.tsx`'s `measure()` + `ResizeObserver`, `usePrefersReducedMotion`'s client-update pattern) is existing precedent to reuse, not a missing shared utility to build first.

### Data Type Compatibility & Migration Requirements

- No mismatch found. This story introduces no database schema, no GraphQL types, and no new TypeScript models consumed across a DB/API/frontend boundary — it is a pure presentational-layer change within `packages/ui`.

### Project Structure Notes

- Modifies existing files in place: `packages/ui/src/core/grid-container.tsx`/`.types.ts`/`.test.tsx`; `packages/ui/src/features/events/EventCard.tsx`/`.test.tsx`; `packages/ui/src/features/events/EventListView.tsx`.
- New files: `packages/ui/src/hooks/useMasonryLayout.ts`, `.types.ts`, `.test.ts` (matching the existing hooks folder's flat-file-per-hook convention); `packages/visual-audit/manifests/grid-container-masonry.ts`.
- No conflicts detected with the existing monorepo structure.

### References

- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-27] — full rule set this story implements, including the two Deferred decisions resolved above.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-26] — the visual-audit tool this story's AC9 consumes (Rule 1a multi-instance render scope; Rule 3 manifest-declares-what's-checked; Review Follow-up `react-component` RenderSpec).
- [Source: _bmad-output/planning-artifacts/architecture/architecture-festgrid-2026-09-22/.memlog.md, lines 16-20, 26-27] — full decision trail: native CSS masonry ruled out (Safari-only 2026), CSS multi-column rejected (reading-order regression), JS shortest-column adopted.
- [Source: _bmad-output/implementation-artifacts/backlog.yaml#IDEA-050] — originating backlog row, including the 2026-09-25 scope-widening note (user-reported max-width bug, code-confirmed).
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md:33-37] — `components.grid.masonry`/`grid.base` tokens.
- [Source: design-artifacts/UX-festgrid-run-1/prototypes/event-card-masonry/default-with-thumbnail.html:13-16, prototypes/validation-log.md:7-8] — real validated card widths (175px mobile 2-col, 269px desktop xl:5-col).
- [Source: packages/ui/src/features/events/EventCardMediaPrimitives.tsx:50-82] — existing container-query mechanism (`EVENT_CARD_CONTAINER_CLASS`, `EVENT_CARD_BADGE_TEXT_SIZE_CLASS`) this story's AC8 extends.
- [Source: packages/ui/src/core/swipe-to-reveal.tsx] — `measure()` + `ResizeObserver` idiom precedent for AC5's hydration reflow.
- [Source: packages/ui/src/hooks/useListPaginationController.ts, useCollapseHeaderOnScroll.ts] — hand-rolled-hook precedent informing the library-vs-hand-rolled decision.

## Global Rules References

- [x] project-context.md — Code Organization (`packages/ui/src/hooks` convention), UI Patterns & UX Invariants ("Page Containers & Grids" — `GridContainer` mandate), Testing Rules (testing-trophy/Vitest pattern already established by `grid-container.test.tsx`/`EventCard.test.tsx`).
- [x] story-content-structure.md — canonical section order followed.
- [x] architecture spine — AD-27 (this story), AD-26 (consumed via AC9).
- [x] infrastructure docs — not applicable (no AWS/infra surface introduced).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - Update: `packages/ui/src/core/grid-container.tsx`, `grid-container.types.ts`, `grid-container.test.tsx`
  - Update: `packages/ui/src/features/events/EventCard.tsx`, `EventCard.test.tsx`, `EventCardMediaPrimitives.tsx` (container-query additions)
  - Update: `packages/ui/src/features/events/EventListView.tsx`
  - New: `packages/ui/src/hooks/useMasonryLayout.ts`, `useMasonryLayout.types.ts`, `useMasonryLayout.test.ts`
  - Update: `packages/ui/src/hooks/index.ts` (export)
  - New: `packages/visual-audit/manifests/grid-container-masonry.ts`
  - Update: `packages/visual-audit/manifests/index.ts` (registration)
  - Possible update: `design-artifacts/UX-festgrid-run-1/DESIGN.md` (Task 7, if the token's literal class description needs reconciling)
- **Rule Mapping:** AC1→`layout` prop; AC2/AC11→`useMasonryLayout` hook + tests; AC3→shared column-count derivation; AC4→flex-track render path; AC5→SSR-estimate + post-hydration reflow; AC6→`EventListView` wiring; AC7→`max-w-[230px]` removal; AC8→container-query scaling extension; AC9→real `grid-container-masonry.ts` manifest entry; AC10→i18n N/A confirmation; AC11→test coverage.
- **Verification Plan:** `pnpm --filter @festgrid/ui test` (hook + component tests), `pnpm --filter @festgrid/ui lint`, `pnpm --filter @festgrid/visual-audit test` (running the new `grid-container-masonry.ts` manifest entry end-to-end against real `GridContainer`/`EventCard`), manual check that `EventListView`'s Discovery masonry surface no longer shows large empty inter-column gaps at 2xl viewport widths.

## Pre-Coding Approval Gate

- [ ] Scope confirmation
- [ ] Architecture and boundary confirmation
- [ ] Testing plan confirmation
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — all three gates report "No gap found" (Gate 2's DESIGN.md-preservation note is incorporated as AC3/Task 7, not a blocking prerequisite); `packages/visual-audit` (Story 0.43) and its Story 0.44 prerequisite are both `done` in `sprint-status.yaml`.

## Testing Requirements

- [ ] Unit tests for `useMasonryLayout` (shortest-column selection, SSR round-robin estimate, reflow-on-remeasure, reflow-on-breakpoint-change)
- [ ] Component tests for `GridContainer`'s new `layout="masonry"` path and unchanged `css-grid` default path
- [ ] `EventCard.test.tsx` updated for the removed `max-w-[230px]` cap and new container-query class
- [ ] Integration proof: the new `packages/visual-audit/manifests/grid-container-masonry.ts` manifest entry passing end-to-end against the real `GridContainer`/`EventCard` components

## Deliverables Checklist

- [ ] `GridContainer` `layout` prop (`css-grid` default / `masonry`)
- [ ] `useMasonryLayout` hook, exported from `packages/ui/src/hooks`
- [ ] `EventListView.tsx` wired to `layout="masonry"` at both call sites
- [ ] `EventCard.tsx` `max-w-[230px]` cap removed (real + skeleton), container-query scaling extended
- [ ] Real `packages/visual-audit/manifests/grid-container-masonry.ts` manifest entry, registered and passing
- [ ] All new/updated tests passing; lint clean

## Out of Scope

- Authoring manifest entries for any other component/variant (only `GridContainer`'s masonry variant, per AC9).
- Retrofitting `layout="masonry"` onto any `GridContainer` consumer other than `EventListView.tsx` (no other masonry consumer exists today).
- Virtualization/windowing of the masonry list (deliberately not adopting `masonic`'s approach — see Dev Notes; `useInfiniteScroll`/`useListPaginationController` remain the pagination mechanism, unchanged).
- Any DESIGN.md/EXPERIENCE.md rewrite beyond reconciling the `components.grid.masonry` token's literal class description (Task 7) if the implementation changes it.

## Definition of Done

- [ ] AC satisfaction (AC1–AC11)
- [ ] Required tests passing (unit + the new visual-audit manifest entry)
- [ ] Lint and type checks passing for `packages/ui` and `packages/visual-audit`

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
