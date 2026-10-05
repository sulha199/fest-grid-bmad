---
baseline_commit: 3c71e14
---

# Story 0.48: Mount-stable masonry engine — eliminate reflow remount + keyboard focus loss (FIND-052)

## Story Details

- Epic: 0
- Story ID: 0.48
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want `GridContainer`'s (`packages/ui/src/core/grid-container.tsx`) `layout="masonry"` render path rebuilt on a mount-stable DOM structure — one flat parent with every item keyed `key={itemIndex}` directly under it (never regrouped under a per-column parent), positioned via `position: absolute; transform: translate(x, y)` once real heights are known, with the container's own height sourced from a new `columnHeights` field `useMasonryLayout` exposes — instead of today's per-column `<div>` parents that force React to unmount+remount any item whose column assignment changes,
So that a column-count-changing viewport resize or an earlier item's async image-load height change (both routine, frequently-triggered events on Discovery's real masonry surface, confirmed in production-shaped measurements, not edge cases) stop unmounting/remounting the majority of the list and silently dropping a keyboard user's focus out from under them (FIND-052, deferred from Story 0.45's code review, 2026-09-26).

## Acceptance Criteria

1. **Given** `GridContainer`'s current masonry render path groups items under N per-column `<div data-grid-container-column>` parents (`grid-container.tsx:195-213`), **When** this story ships, **Then** `layout="masonry"` renders every item as a direct child of exactly ONE flat parent `<div>`, each still keyed `key={itemIndex}` — a key that, by construction, can never again cross a parent boundary on reflow, so React treats any column reassignment as an in-place prop/style update on the same DOM node, never an unmount+mount. No per-column wrapper `<div>` exists in the new DOM output.

2. **Given** AD-27/Story 0.45's required SSR-safe, non-CLS-inducing first paint (`project-context.md`'s "Non-Blocking (Initial Load): Use Skeleton screens... to reduce Cumulative Layout Shift") and that absolutely-positioned children contribute zero natural height to their parent, **When** this story ships, **Then** the masonry render path is two-phase, both phases already selectable from `useMasonryLayout`'s existing `hasMeasured` boolean (no new state needed):
   - **Phase 1 (`hasMeasured === false`: SSR output and the window before any item's first real measurement lands)** — every item is a normal, in-flow CSS Grid item: the flat parent is `display: grid; grid-template-columns: repeat(columnCount, 1fr)` (the SAME `gap` prop value as today, applied via the grid's native `gap`/`column-gap`/`row-gap`, unchanged from the current Tailwind-class mechanism), and each item carries an explicit inline `gridColumn: columnAssignments[itemIndex] + 1` with `gridRow: 'auto'` — native CSS Grid auto-placement then stacks multiple items sharing one explicit column into sequential rows automatically, with zero JS pixel/gap math and zero dependency on measured heights. The container has no explicit `height` style in this phase (grid auto-sizes to real content), so the browser computes a genuine non-zero height from real DOM content alone — identical first-paint safety to today's pre-fix behavior, not a regression.
   - **Phase 2 (`hasMeasured === true`: after the first real measurement lands, which happens essentially synchronously with mount per the hook's existing ref-callback-during-commit timing)** — every item switches to `position: absolute` (the flat parent gains `position: relative` as the containing block), KEEPS its `gridColumn` placement (so horizontal column position/width is still resolved by native CSS Grid geometry against the assigned grid area — no JS computation of column pixel width or gap needed for the X axis at all) plus `width: 100%` (to fill that grid area, since an absolutely-positioned element with explicit `gridColumn`/`gridRow` and no inset properties otherwise shrinks to content) and `transform: translateY(<item's own Y offset>px)` for the vertical masonry stack. The flat parent's own explicit `height` style is set to `Math.max(...columnHeights)` only in this phase.
   - The phase-2-only container `height` and per-item `position`/`transform` are pure style/attribute updates on already-mounted nodes — switching phases never remounts any item (verified by AC6's regression suite).

3. **Given** `useMasonryLayout`'s placement loop (`useMasonryLayout.ts:138-156`) already accumulates each column's running height internally (`colHeights`) but exposes neither that total nor each item's own offset within it, **When** this story ships, **Then** `UseMasonryLayoutResult` (`useMasonryLayout.types.ts`) gains two new fields, both derived from the same placement loop (no second pass, no new dependency array):
   - `columnHeights: number[]` — final accumulated height per column (`colHeights` at the end of the loop), the source for AC2 Phase 2's container `height`.
   - `itemOffsets: number[]` — parallel-indexed to `columnAssignments`; each item's own accumulated-height-so-far-in-its-column AT THE MOMENT it was placed (i.e. `colHeights[assignedColumn]` immediately before adding this item's own height) — the source for AC2 Phase 2's per-item `transform: translateY(...)`. This is a necessary elaboration beyond the literal "container height from columnHeights" brief: a per-item Y offset is required to actually transform-position each item, and `useMasonryLayout` is the only place with access to the raw per-item heights needed to compute it — pushing that accumulation into `GridContainer` would mean re-deriving (or re-exposing) the hook's internal `heights` map there instead.
   - Both fields are `[]`/all-zero when `columnCount <= 0` or `!hasMeasured`, matching the existing `columnAssignments`/`columns` fallback behavior for those states (Phase 1 doesn't read either field — see AC2).

4. **Given** today's per-column-parent DOM order makes native keyboard Tab order column-major (down column 1 fully, then column 2, …) within the row-major VISUAL placement Story 0.45 AC4 already established, **When** this story ships, **Then** the single flat parent's `key={itemIndex}`-ordered DOM makes native Tab order index-major instead — matching the cards' visual/reading order — in BOTH Phase 1 and Phase 2 (no phase-dependent tab-order difference, since DOM order is unchanged by the Phase 1→2 style switch). **This is an explicit, user-visible keyboard/screen-reader-navigation behavior change for the masonry surface (`EventListView.tsx`/Discovery) and must be called out as such** — not silently absorbed as an implementation detail of the remount fix — in the PR/changelog and in this story's own Dev Notes. Per Gate 2 (Freya) evaluation, no DESIGN.md/EXPERIENCE.md section specifies or constrains GridContainer-level (card-to-card) tab order today, so nothing in the authoritative UX spec contradicts this change; it is a net accessibility improvement (reading-order-aligned tab order) rather than a regression, but is still a real change to existing behavior some keyboard users may have adapted to.

5. **Given** DESIGN.md's `components.grid.masonry` token (`design-artifacts/UX-festgrid-run-1/DESIGN.md:37`) and Story 0.45's AC3 require the `baseCols`/`colsStep`-derived 2/3/4/5/6-column-across-breakpoints table to remain the single source of truth, **When** this story ships, **Then** `computeGridContainerColumnCounts`/`useActiveColumnCount` (the shared column-count derivation Story 0.45 built) are reused completely unchanged — this story only changes how `layout="masonry"` consumes `columnAssignments` for rendering, never how the column COUNT itself is computed — and `EventListView`'s existing `baseCols={2} colsStep={1}` continues to yield exactly 2/3/4/5/6 columns at base/md/lg/xl/2xl, each column still the grid's native equal-width track (verified structurally, not just by inspection, per AC9).

6. **Given** the FIND-052 investigation (`grid-container.find052.investigation.test.tsx`, 2026-10-05, 5/5 green) measured under the OLD per-column-parent design that a column-count-changing resize moved+remounted 4/6 items (losing focus) and an earlier item's height change moved+remounted 3/6 items (losing focus), while a same-breakpoint resize and an infinite-scroll append caused 0/6 churn, **When** this story ships, **Then** re-running the identical scenarios against the NEW mount-stable engine must show: items still change column where expected (the masonry placement algorithm itself is unchanged — reassignment is still correct and expected), but **zero items remount among those that change column**, and **keyboard focus survives every scenario**, in all of:
   - (a) a resize that stays within the same breakpoint (already 0/0, must remain so),
   - (b) a column-count-changing breakpoint resize (previously 4/6 remounted+focus-lost → now 0 remounted, focus survives),
   - (c) an earlier item's image-load-style height change cascading into later items' column reassignment (previously 3/6 remounted+focus-lost → now 0 remounted, focus survives),
   - (d) an infinite-scroll page append (already 0/0 for already-placed items, must remain so).

7. **Given** AC2's two-phase design is this story's own new addition (not something Story 0.45 or the FIND-052 investigation measured), **When** this story ships, **Then** a NEW regression scenario is added proving the Phase 1 → Phase 2 transition itself (the moment `hasMeasured` flips `false → true` on the very first item measurement) causes **zero remounts of any already-mounted item** — the two-phase switch is a pure style/attribute update, not a structural DOM change.

8. **Given** `packages/ui/src/core/grid-container.find052.investigation.test.tsx` was explicitly written as a throwaway investigation artifact ("NOT a regression suite, NOT wired into any CI gate," per its own header), **When** this story ships, **Then** it is promoted into this story's permanent regression suite: renamed to drop the "investigation" framing (e.g. `grid-container.masonry-mount-stability.test.tsx`), its header comment rewritten to describe it as a permanent regression suite proving the FIND-052 fix (not a throwaway measurement), and — critically — its assertions for scenarios (b) and (c) are REWRITTEN from "document the churn exists" (`expect(changed.length).toBeGreaterThan(0)` with no remount/focus assertion) to hard pass/fail proof of the fix (`remountedAmongChanged === 0`, `focusSurvived === true`), matching the already-strict style scenarios (a) and (d) use today. Its `snapshotColumns` helper (which currently infers column via `.closest('[data-grid-container-column]')`, a selector this story removes) is rewritten to read the item's own column-index data attribute directly (AC1's flat-parent design still exposes `data-grid-container-column-index` as a per-item attribute — see AC9). The new AC7 phase-transition scenario is added to this same file.

9. **Given** `[data-grid-container-column]`/`[data-grid-container-column-index]` currently identify a per-column WRAPPER element (removed by AC1) and are consumed by `grid-container.test.tsx`, `EventListView.test.tsx`, `packages/visual-audit/manifests/grid-container-masonry.ts`, and `packages/visual-audit/manifests-proof.spec.ts`, **When** this story ships, **Then**:
   - `data-grid-container-column-index={colIndex}` moves onto each ITEM wrapper itself (alongside the existing `data-grid-container-item`/`data-grid-container-item-index`), since there is no longer a separate column DOM node to carry it; the bare `data-grid-container-column` marker attribute is removed (nothing to mark).
   - `grid-container.test.tsx`'s masonry describe block is updated: the "N equal-width flex column track" assertion becomes an assertion over `gridTemplateColumns`/the per-item `gridColumn` style (Phase 1) instead of counting `[data-grid-container-column]` wrapper nodes; the "every item renders exactly once, carrying its original index" assertion is preserved (still valid under the flat-parent design, now trivially true — no column regrouping to traverse).
   - `EventListView.test.tsx`'s `columns.length).toBeGreaterThan(0)` assertion (lines ~189-190) is replaced with an equivalent check against the new per-item column-index attribute (e.g. distinct `data-grid-container-column-index` values present among rendered items).
   - `packages/visual-audit/manifests/grid-container-masonry.ts`'s AC9(a)/(b)-equivalent rules (`sibling-dimension`/`intra-box-ratio` on `[data-grid-container-column]`, `placement-order`'s `columnSelector`) are reworked against the new per-item selectors/grouping (e.g. grouping items client-side by their own `data-grid-container-column-index` value for the width/placement-order checks, since there is no longer a single element per column to measure directly).
   - `packages/visual-audit/manifests-proof.spec.ts`'s three tests reading `[data-grid-container-column]` (the width/height-independence assertions and the `flex-grow`-override negative canary) are reworked for the new DOM: the height-independence proof groups items by column-index and computes each column's own max bottom edge instead of reading one wrapper's `getBoundingClientRect().height`; the negative-canary CSS override is rebuilt against the new mechanism (Phase 1's `grid-template-columns`/per-item `gridColumn`, or Phase 2's per-item `transform`/`width`) since `flex-grow` no longer applies once the per-column flex-track model is removed.
   - All of the above continue passing: `pnpm --filter @festgrid/ui test`, `pnpm --filter @festgrid/visual-audit test`, `pnpm --filter @festgrid/visual-audit test:manifests`.

10. **Given** AC2 Phase 1 is the ONLY phase `packages/visual-audit/manifests/grid-container-masonry.ts` ever exercises (its render mechanism is `renderToStaticMarkup`, a one-shot server render with no client hydration — confirmed by that file's own existing header comment, "useMasonryLayout's item refs never attach... so columnAssignments always stays the round-robin-by-index estimate"), **When** this story ships, **Then** this existing manifest (or a new entry alongside it) gains an explicit assertion that Phase 1's SSR/first-paint render produces a non-collapsed, real (non-zero) height for the masonry container — this is the one genuine, real-browser-only proof available that AC2's CLS-avoidance requirement actually holds in the SSR state jsdom-based component tests cannot observe (jsdom has no real CSS layout engine; `packages/visual-audit`'s Playwright-backed manifest runner is this project's only mechanism for checking real computed layout, per its own established role — see Story 0.45's and 0.43's precedent).

11. **Given** `GridContainer`'s default `layout="css-grid"` path is untouched by this story, **When** this story ships, **Then** every existing non-masonry consumer and `grid-container.test.tsx`'s non-masonry assertions continue to pass byte-for-byte unmodified (matching Story 0.45 AC1's same unaffected-default-path guarantee).

12. **Given** i18n applicability (`story-content-structure.md`), **When** this story ships, **Then** no new user-facing strings are introduced — this is purely structural/layout/CSS and hook-internals work; explicitly confirmed N/A.

13. **Given** DESIGN.md's `components.grid.masonry` token comment (`design-artifacts/UX-festgrid-run-1/DESIGN.md:37`) currently describes the implementation as "N equal-width flex column tracks (`flex-1 min-w-0`, items-start)," which becomes inaccurate under this story's flat-parent/CSS-Grid/absolute-position design, **When** this story ships, **Then** the token's comment is reconciled to describe the new two-phase mechanism (mirroring Story 0.45's own Task 7 precedent) while explicitly preserving the documented column-count/equal-width semantics (2/3/4/5/6 columns, still equal-width — now via native CSS Grid tracks rather than flex tracks).

## Tasks / Subtasks

- [ ] Task 1 — `useMasonryLayout` gains `columnHeights`/`itemOffsets` (AC3)
  - [ ] Extend the placement loop (`useMasonryLayout.ts:138-156`) to record each item's offset-at-placement-time into a new `itemOffsets: number[]`, and the final `colHeights` into a new `columnHeights: number[]`, both returned from the hook.
  - [ ] Update `UseMasonryLayoutResult` (`useMasonryLayout.types.ts`) and its doc comments.
  - [ ] Extend `useMasonryLayout.test.ts` with new cases: `columnHeights` matches the sum of each column's item heights; `itemOffsets` matches each item's actual accumulated-before-it height; both are `[]`/zeroed when `columnCount <= 0` or unmeasured — following the existing file's established per-AC test-naming convention.
- [ ] Task 2 — `GridContainer` flat-parent, two-phase masonry render path (AC1, AC2, AC4, AC5)
  - [ ] Replace the per-column `<div>` grouping (`grid-container.tsx:189-215`) with one flat parent rendering every item directly, `key={itemIndex}`.
  - [ ] Phase 1 (`!hasMeasured`): flat parent `display: grid; grid-template-columns: repeat(columnCount, 1fr)` + existing `gap` prop; each item gets inline `gridColumn`/`gridRow: 'auto'`, no explicit container `height`.
  - [ ] Phase 2 (`hasMeasured`): flat parent gains `position: relative` + explicit `height: Math.max(...columnHeights)`; each item gains `position: absolute`, keeps `gridColumn`, adds `width: 100%` and `transform: translateY(itemOffsets[i]px)`.
  - [ ] Move `data-grid-container-column-index` onto each item; remove the bare `data-grid-container-column` marker (AC9).
  - [ ] Verify Tab order is index-major in both phases (AC4) — add a direct DOM-order assertion to `grid-container.test.tsx`'s masonry describe block.
- [ ] Task 3 — Promote the FIND-052 investigation test into a permanent regression suite (AC6, AC7, AC8)
  - [ ] Rename `grid-container.find052.investigation.test.tsx` → `grid-container.masonry-mount-stability.test.tsx` (or equivalent); rewrite its header comment to describe it as a permanent regression suite, not a throwaway investigation.
  - [ ] Rewrite `snapshotColumns`'s column-detection to read the item's own `data-grid-container-column-index` attribute directly (no more `.closest()`).
  - [ ] Rewrite scenario (b)/(c) assertions: from "churn documented, not asserted as pass/fail" to hard `remountedAmongChanged === 0` / `focusSurvived === true` assertions, matching (a)/(d)'s existing strictness.
  - [ ] Add the new AC7 scenario: the Phase 1→Phase 2 transition (first measurement landing) causes zero remounts of any already-mounted item.
  - [ ] Re-run and confirm all scenarios pass against the new engine.
- [ ] Task 4 — Update existing DOM-structure-dependent test/tooling consumers (AC9, AC10)
  - [ ] `grid-container.test.tsx`: update the masonry describe block's column-track assertions for the new DOM shape (AC9); confirm the non-masonry describe blocks are untouched (AC11).
  - [ ] `EventListView.test.tsx`: update the `[data-grid-container-column]` assertion (lines ~189-190) for the new per-item attribute.
  - [ ] `packages/visual-audit/manifests/grid-container-masonry.ts`: rework the `sibling-dimension`/`intra-box-ratio`/`placement-order` rules' selectors for the new per-item column-index attribute; add the AC10 non-collapsed-height assertion for the SSR/Phase-1-only render this manifest exercises.
  - [ ] `packages/visual-audit/manifests-proof.spec.ts`: rework the height-independence test (group by column-index, compute per-column max bottom edge) and the negative-canary CSS-override mechanism (no more `flex-grow`; override the new Phase 1 `grid-template-columns`/per-item `gridColumn` mechanism instead) to prove the new real checks can still genuinely fail.
  - [ ] Run `pnpm --filter @festgrid/visual-audit build:vendor-tailwind` if any new Tailwind/inline-style class usage needs the offline vendored CSS bundle updated (per Story 0.45's own precedent finding).
- [ ] Task 5 — DESIGN.md reconciliation (AC13)
  - [ ] Update `components.grid.masonry` token's comment (`design-artifacts/UX-festgrid-run-1/DESIGN.md:37`) to describe the flat-parent/two-phase/CSS-Grid+absolute-position mechanism, preserving the documented column-count/equal-width semantics.
- [ ] Task 6 — Full regression pass (Definition of Done)
  - [ ] `pnpm --filter @festgrid/ui test`, `pnpm --filter @festgrid/ui lint`, `pnpm --filter @festgrid/visual-audit test`, `pnpm --filter @festgrid/visual-audit test:manifests`.
  - [ ] Full repo-wide `pnpm test` / `pnpm lint` / `pnpm build` gate.

## Dev Notes

- **This session's own prior investigation (do not re-diagnose):** `grid-container.find052.investigation.test.tsx` (2026-10-05, 5/5 green) already measured the real-component magnitude of the bug under the CURRENT (pre-this-story) per-column-parent design: a column-count-changing resize moved+remounted 4/6 items and lost focus; an earlier item's height change moved+remounted 3/6 items (cascading past item 0 into later indices) and lost focus; same-breakpoint resize and infinite-scroll append were already churn-free (0/6). Root cause confirmed by direct code reading, not re-derived here: `grid-container.tsx`'s masonry path keys each item `key={itemIndex}` under a PER-COLUMN `<div>` parent — React key stability is scoped to one parent, so a key moving to a different column parent is unconditionally an unmount+mount, never a reconciled move, regardless of engine tuning. See `deferred-work.md`'s "FIND-052 investigation (bmad-quick-dev, 2026-10-05)" section for the full measurement table and the original proposed design this story implements (with one addition — AC2's two-phase render — this story adds to close a gap the investigation's design note didn't address; see below).
- **Files read completely for this story (UPDATE, not NEW):** `packages/ui/src/core/grid-container.tsx`, `grid-container.types.ts`, `grid-container.test.tsx`, `grid-container.find052.investigation.test.tsx`; `packages/ui/src/hooks/useMasonryLayout.ts`, `useMasonryLayout.types.ts`, `useMasonryLayout.test.ts`; `packages/ui/src/features/events/EventListView.test.tsx` (the two masonry-DOM-dependent describe blocks); `packages/visual-audit/manifests/grid-container-masonry.ts`; `packages/visual-audit/manifests-proof.spec.ts` (the `grid-container-masonry` describe block). Story 0.45's own story file (`0-45-replace-grid-containers-masonry-engine-with-shortest-column-placement.md`) read in full for precedent (library/hydration decisions, Gate findings, Dev Notes conventions).
- **What must be preserved (non-negotiable, verified by AC5/AC11):** the `baseCols`/`colsStep`-derived column COUNT formula (`computeGridContainerColumnCounts`, `useActiveColumnCount`) is completely unchanged by this story — only the masonry render path's DOM/CSS mechanism for consuming `columnAssignments` changes. The default `layout="css-grid"` path is untouched.

### Design decision: two-phase render (user-directed, 2026-10-05, via `AskUserQuestion`)

The FIND-052 investigation's own proposed design (`deferred-work.md`, "Recommendation: build the mount-stable engine...") specified transform-positioned absolute items and a `columnHeights`-sourced container height, but did not address what happens BEFORE any item has a real measured height — i.e. the SSR-rendered HTML and the window before the client's first ref-attach measurement lands. If items were absolutely positioned from the very first render (including server-rendered output), the container would have no natural height (absolutely-positioned children never contribute to a parent's intrinsic size) and would collapse to ~0px until real measurements arrive — a real Cumulative-Layout-Shift regression directly contradicting `project-context.md`'s explicit "Non-Blocking (Initial Load): Use Skeleton screens... to reduce Cumulative Layout Shift (CLS)" rule, and a materially WORSE first-paint experience than today's pre-fix behavior (today, flow-positioned children under per-column parents give the browser a real, correct height immediately, with zero JS/measurement dependency).

This was surfaced to the user via `AskUserQuestion` (the question was asked, then answered after a container restart interrupted the first attempt — see the session's own record). **User decision: two-phase render** (AC2) — Phase 1 (pre-measurement) keeps items in real, in-flow CSS Grid placement (`gridColumn` per item, auto row-stacking — no absolute positioning, no JS-computed height dependency, so the browser computes a genuine non-zero height exactly as it does today), switching to Phase 2 (absolute position + transform + `columnHeights`-sourced container height) only once the FIRST real measurement lands — which, per the hook's own existing ref-callback-during-commit timing, happens essentially synchronously with mount on the client, so the window where Phase 1 is visible to a hydrated client is imperceptibly brief; it only meaningfully matters for the genuinely-unmeasurable SSR/pre-hydration state (slow connections, no-JS, crawlers), which is exactly where it matters most for CLS. The mount-stability guarantee (AC1/AC6) only needs to hold for POST-hydration reflows (resize, image-load-driven reassignment) — it was never about the initial SSR/first-paint state, so this two-phase approach doesn't compromise the actual fix at all.

**Why CSS Grid (not JS-computed pixel positions) for the horizontal axis in both phases:** keeping each item's explicit `gridColumn` placement in Phase 2 too (not just Phase 1) means horizontal column position/width is ALWAYS resolved by the browser's native CSS Grid algorithm against the real container width — this avoids an entirely separate design fork the team considered (JS-measuring the container's own pixel width via a new container-level `ResizeObserver`, then hand-computing each item's `x` offset and width in pixels, parsing the `gap` prop's Tailwind class into a numeric value). CSS Grid's `gap`/`column-gap` property already consumes the SAME Tailwind `gap` classes this component already accepts, unchanged — no new gap-parsing logic, no new container-measurement surface, no px math for X at all. Per CSS Positioned Layout + CSS Grid: an absolutely-positioned element with explicit `grid-column`/`grid-row` still resolves its containing block to that grid area (not the whole grid container), so `width: 100%` on such an item fills exactly its assigned column's real track width. Only the Y axis (`transform: translateY`) needs a JS-computed value — exactly the value `itemOffsets` (AC3) now exposes, since the hook already has the only data (`heights`) needed to compute it.

### Architecture & UX Gate Findings

Story Split Gates run fresh for this story (the `_bmad-output/planning-artifacts/epic-readiness/epic-0-readiness.md` sweep is `swept: true` but its `stories_covered` frontmatter only lists Stories 0.1–0.19 — predates and does not cover this scope, same escape-hatch reasoning Story 0.45 already applied).

- **Gate 1 (Winston, Architecture/Infrastructure Completeness): No gap found.** Confirmed via direct import inspection of both touched files: only React primitives and the local `cn` util, no DB/ORM/domain-package call, no external/third-party service call from the frontend, no new API surface/resolver/mutation (`apps/backend` untouched), no auth/secrets/business-rules added, no new infra dependency. The only consumer, `EventListView.tsx`, needs no code change (same public `GridContainer`/`useMasonryLayout` contract — `columnHeights`/`itemOffsets` are additive fields on an existing hook return type).
- **Gate 2 (Freya, UI Complexity & Reusability): No split required.** This is an internal-mechanism rearchitecture of an already-built, already-shipped, already-adopted shared primitive (`GridContainer`/`useMasonryLayout`, Story 0.45) — not the introduction of a new reusable component/hook/util, so Gate 2's split trigger ("a reusable component/hook being newly introduced without its own story") doesn't apply; `GridContainer`/`useMasonryLayout` already have their dedicated story. Two incorporable findings folded directly into this story's ACs rather than a split: (1) DESIGN.md's `components.grid.masonry` token comment needs updating to match the new DOM mechanism (AC13, mirroring Story 0.45's own Task 7 precedent); (2) no DESIGN.md/EXPERIENCE.md section governs GridContainer-level (card-to-card) tab order — only within-one-card badge reading order is specified (EXPERIENCE.md "Masonry EventCard Badge Row") — so AC4's tab-order change contradicts no authoritative spec, but is still called out as its own explicit AC per this story's governing requirement.
- **Gate 3 (Winston, Foundational/Cross-Cutting Dependency Completeness): No gap found.** No first-introduction of any trigger category (app shell, i18n/analytics/observability foundation, GraphQL/codegen scaffold, named mandated utility, or any dependency referenced in project-context.md/architecture spine with no corresponding `epics.md` story). This is improvement-in-place on an already-shipped shared primitive; `EventListView.tsx` remains the sole `layout="masonry"` consumer (per Story 0.45's own Out of Scope — "no other masonry consumer exists today"), so no other epic/story inherits a new dependency from this change.

### Data Type Compatibility & Migration Requirements

- No mismatch found. This story introduces no database schema, no GraphQL types, and no new TypeScript models consumed across a DB/API/frontend boundary — it is a pure presentational-layer rearchitecture within `packages/ui`, extending one existing hook's return type with two additive, purely-numeric fields.

### Project Structure Notes

- Modifies existing files in place: `packages/ui/src/core/grid-container.tsx`/`.types.ts`/`.test.tsx`; `packages/ui/src/hooks/useMasonryLayout.ts`/`.types.ts`/`.test.ts`; `packages/ui/src/features/events/EventListView.test.tsx`; `packages/visual-audit/manifests/grid-container-masonry.ts`; `packages/visual-audit/manifests-proof.spec.ts`; `design-artifacts/UX-festgrid-run-1/DESIGN.md`.
- Renamed: `packages/ui/src/core/grid-container.find052.investigation.test.tsx` → a permanent regression-suite filename (e.g. `grid-container.masonry-mount-stability.test.tsx`).
- No new files; no conflicts detected with the existing monorepo structure.

### References

- [Source: _bmad-output/implementation-artifacts/deferred-work.md, "Deferred from: code review of story 0.45 (2026-09-26)" and "FIND-052 investigation (bmad-quick-dev, 2026-10-05)"] — originating finding, full measurement table, and the investigation's proposed design this story implements (with the AC2 two-phase addition).
- [Source: _bmad-output/implementation-artifacts/0-45-replace-grid-containers-masonry-engine-with-shortest-column-placement.md] — the engine this story rearchitects; library/hydration-strategy precedent; Task 7 DESIGN.md-reconciliation precedent.
- [Source: packages/ui/src/core/grid-container.find052.investigation.test.tsx] — promoted into this story's permanent regression suite per AC8.
- [Source: packages/ui/src/core/grid-container.tsx, packages/ui/src/hooks/useMasonryLayout.ts/.types.ts] — current implementation, read in full.
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md:33-37] — `components.grid.masonry`/`grid.base` tokens.
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md, "Accessibility Floor > Masonry EventCard Badge Row"] — confirms no existing spec governs card-to-card tab order (only within-card badge reading order).
- [Source: _bmad-output/project-context.md, "UI Patterns & UX Invariants > Loaders"] — the CLS/non-blocking-load rule motivating AC2's two-phase design.
- [Source: _bmad-output/implementation-artifacts/backlog.yaml#FIND-052] — originating backlog row.

## Global Rules References

- [x] project-context.md — Code Organization (`packages/ui`/`packages/ui/src/hooks` convention), UI Patterns & UX Invariants (CLS/non-blocking-load rule motivating AC2; "Page Containers & Grids" `GridContainer` mandate), Testing Rules (testing-trophy/Vitest pattern already established by `grid-container.test.tsx`/`useMasonryLayout.test.ts`; Meta-Testing tier for `packages/visual-audit`).
- [x] story-content-structure.md — canonical section order followed.
- [x] architecture spine — AD-27 (the masonry engine this story rearchitects; Story 0.45 implemented it), AD-26 (`packages/visual-audit`, consumed via AC10/Task 4).
- [x] infrastructure docs — not applicable (no AWS/infra surface introduced).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - Update: `packages/ui/src/core/grid-container.tsx`, `grid-container.types.ts` (doc comments only — no prop-shape change), `grid-container.test.tsx`
  - Update: `packages/ui/src/hooks/useMasonryLayout.ts`, `useMasonryLayout.types.ts`, `useMasonryLayout.test.ts`
  - Rename + rewrite: `packages/ui/src/core/grid-container.find052.investigation.test.tsx` → `grid-container.masonry-mount-stability.test.tsx`
  - Update: `packages/ui/src/features/events/EventListView.test.tsx` (DOM-selector assertions only — no `EventListView.tsx` production-code change, since `GridContainer`'s public contract is unchanged)
  - Update: `packages/visual-audit/manifests/grid-container-masonry.ts`, `packages/visual-audit/manifests-proof.spec.ts`
  - Update: `design-artifacts/UX-festgrid-run-1/DESIGN.md` (Task 5, AC13)
- **Rule Mapping:** AC1→flat-parent/single-key structure; AC2→two-phase Phase1(grid-flow)/Phase2(absolute+transform) render; AC3→`columnHeights`/`itemOffsets` hook fields; AC4→index-major tab order, explicitly documented; AC5→column-count-formula preservation (unchanged code path); AC6→promoted regression suite proving zero remounts/focus-survival; AC7→new phase-transition regression scenario; AC8→investigation-test promotion/rewrite; AC9→DOM-selector migration across test/tooling consumers; AC10→visual-audit non-collapsed-height proof for the SSR-only manifest render; AC11→css-grid default path untouched; AC12→i18n N/A; AC13→DESIGN.md token reconciliation.
- **Verification Plan:** `pnpm --filter @festgrid/ui test` (hook + component + promoted regression suite), `pnpm --filter @festgrid/ui lint`, `pnpm --filter @festgrid/visual-audit test` + `test:manifests` (reworked manifest/Playwright proof, including AC10's non-collapsed-height assertion and the rebuilt negative canary), full repo-wide `pnpm test`/`pnpm lint`/`pnpm build`.

## Pre-Coding Approval Gate

- [ ] Scope confirmation
- [ ] Architecture and boundary confirmation
- [ ] Testing plan confirmation
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — all three gates report "No gap found" (Gate 2's two findings incorporated as AC13/AC4 rather than blocking prerequisites). Two-phase render design question already resolved via `AskUserQuestion` (2026-10-05, user decision recorded in Dev Notes).

## Testing Requirements

- [ ] Unit tests for `useMasonryLayout`'s new `columnHeights`/`itemOffsets` fields
- [ ] Component tests for `GridContainer`'s rebuilt masonry path (Phase 1/Phase 2 DOM shape, index-major tab order) and unchanged `css-grid` default path
- [ ] Promoted regression suite (`grid-container.masonry-mount-stability.test.tsx`): zero remounts + focus-survival across all 4 original FIND-052 scenarios plus the new phase-transition scenario
- [ ] `packages/visual-audit` manifest + Playwright proof updated and passing, including a real-browser, non-collapsed-height assertion for the SSR-only (Phase 1) render

## Deliverables Checklist

- [ ] `GridContainer` masonry path rebuilt on one flat, mount-stable parent (two-phase render)
- [ ] `useMasonryLayout` exposes `columnHeights`/`itemOffsets`
- [ ] Zero remounts / focus-survival proven across all FIND-052 scenarios + the phase-transition scenario
- [ ] Index-major tab order, explicitly documented as a user-visible change
- [ ] All DOM-selector-dependent test/tooling consumers (`grid-container.test.tsx`, `EventListView.test.tsx`, `packages/visual-audit`'s manifest + Playwright proof) updated and passing
- [ ] DESIGN.md `components.grid.masonry` token comment reconciled
- [ ] All new/updated tests passing; lint clean

## Out of Scope

- Any change to the `baseCols`/`colsStep`-derived column COUNT formula, or to the `css-grid` (non-masonry) layout path.
- Retrofitting `layout="masonry"` onto any `GridContainer` consumer other than `EventListView.tsx` (still no other masonry consumer, per Story 0.45's own Out of Scope).
- Virtualization/windowing of the masonry list (unchanged from Story 0.45's decision).
- Any EventCard/visual-design change — this story is confined to `GridContainer`/`useMasonryLayout`'s internal DOM/CSS mechanism.

## Definition of Done

- [ ] AC satisfaction (AC1–AC13)
- [ ] Required tests passing (unit + promoted regression suite + visual-audit manifest/Playwright proof)
- [ ] Lint and type checks passing for `packages/ui` and `packages/visual-audit`

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
