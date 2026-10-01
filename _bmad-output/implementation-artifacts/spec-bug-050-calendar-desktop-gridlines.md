---
title: 'BUG-050: calendar desktop gridlines hidden in the multi-day spanning-banner row'
type: 'bugfix'
created: '2026-09-26'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 63dcff288c0db0f91317a1ec2c6a36c092774610
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** On the desktop weekly calendar, vertical day-column gridlines break/disappear
specifically in the multi-day spanning-banner row. Root cause confirmed by code reading (CSS
mechanics are deterministic, no live render needed to discover it): `GRID_WEEKLY_CLASS`'s
`divide-x` draws borders via the `> * + *` DOM-sibling-adjacency selector, correct only when a
block's DOM children map 1:1 to the 7 columns in order — true for the day-header/day-cell rows
(always exactly 7 real children, each with its own opaque background right up to its own border,
so it's never covered), but **not** the spanning-banner row, whose 0–7 `<MultiDaySpanningBar>`
children sit in arbitrary columns via inline `gridColumn` — so `divide-x` borders land on
schedule-index boundaries, not day-column boundaries. Confirms the AC-GRID-1 candidate in
`_bmad-output/planning-artifacts/event-card-family-consolidated-acs.md` §2.7. BUG-048's
card-covering-gridlines alternative is ruled out: day cells (`DAY_CELL_CLASS`) have `p-2` padding,
so their own self-border is inset from any card content and never overlapped.

**Approach:** Leave the day-header/day-cell rows' `divide-x` untouched (already correct). Fix only
the spanning-banner row: stop deriving its column separators from DOM-sibling adjacency. Render a
fixed set of 7 always-present, content-independent marker elements as an absolutely-positioned
overlay painted *behind* the row's real cards, carrying `divide-x` itself instead of the real
schedule count. Same `grid-cols-7` equal-width basis as the other two rows guarantees
pixel-identical column-boundary x-positions across all three.

## Boundaries & Constraints

**Always:**
- Column-boundary x-positions must be pixel-identical across day-header row, spanning-banner row,
  and day-cell row (shared `grid-cols-7`, same container width).
- The fix touches only the spanning-banner row's rendering; day-header/day-cell rows' existing
  `divide-x` mechanism is not modified.
- The marker overlay must be `pointer-events-none` / `aria-hidden` and must not join the roving
  tabindex grid or the accessibility tree.
- Lines must paint behind real `<MultiDaySpanningBar>` cards (so a card's own opaque background
  legitimately covers only the internal boundaries within its own span — matching how a
  multi-day event reads as one continuous merged block) and remain visible in every column not
  covered by a card.

**Ask First:** none identified — mechanism swap is confined to one row's internal implementation,
no prop/type/behavior change visible to any consumer.

**Never:** do not touch `GRID_WEEKLY_CLASS`'s use on the day-header/day-cell rows; do not change
`MultiDaySpanningBar`'s `gridColumn`/`gridRow` placement logic; do not introduce a third-party CSS
grid-lines library for a 7-column fixed layout.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| No multi-day schedules in visible week | `spanningSchedules.length === 0` | Banner row doesn't render at all (unchanged) — header row's bottom edge and day-cell row's top edge remain visually adjacent, no discontinuity | N/A |
| One multi-day schedule spanning columns 2-4 | 1 entry, `startColIdx=2, spanCount=3` | All 6 column-boundary lines render at correct x-positions in the banner row; boundaries within the card's own span (2/3, 3/4) are covered by its opaque background (expected); boundaries outside it (0/1,1/2,4/5,5/6,6/7) stay visible | N/A |
| Multiple overlapping multi-day schedules (stacked rows) | 2+ entries, distinct `rowIdx` | Marker overlay spans the banner block's full height (background/overlay sizes to `inset-0` of the row container), so lines run continuously through every stacked sub-row | N/A |

</frozen-after-approval>

## Code Map

- `packages/ui/src/features/events/WeeklyCalendarView.tsx` — `GRID_WEEKLY_CLASS` (unchanged, still used by header/day-cell rows), the multi-day spanning banner block (~line 716-735), new `GridColumnGuides` helper component to add.
- `packages/ui/src/features/events/WeeklyCalendarView.test.tsx` — existing assertion `expect(banner).toHaveClass('grid-cols-7')` (line ~253) must keep passing; add new coverage for the guide markers.
- `packages/visual-audit/weekly-calendar-gridlines.spec.ts` (new, committed) — real Playwright/Chromium geometry proof, reusing `src/render.ts`'s `mountManifestEntry` + `src/compare/computed-style.ts`'s `getElementSnapshots` directly (not a registered manifest; no existing `Rule` kind checks cross-selector x-position parity across two rows). Runs via `pnpm --filter visual-audit test:manifests`.
- `_bmad-output/implementation-artifacts/backlog.yaml` — `BUG-050` entry (line ~1600) — now `status: done`.

## Tasks & Acceptance

**Execution:**
- [x] `packages/ui/src/features/events/WeeklyCalendarView.tsx` -- add a local `GridColumnGuides` component (absolutely-positioned `inset-0 grid grid-cols-7 divide-x divide-gray-200 pointer-events-none` overlay with exactly 7 empty marker children, `aria-hidden`, `data-testid="grid-column-guides"`) with a doc comment explaining the DOM-adjacency-vs-grid-placement root cause -- decouples the line mechanism from schedule count -- render it as the first child inside the spanning-banner row's container (add `relative` to that container, keep `grid grid-cols-7 bg-white`, drop `divide-x divide-gray-200` from it since the guide now supplies the lines), before the `spanningSchedules.map(...)`.
- [x] `packages/ui/src/features/events/WeeklyCalendarView.test.tsx` -- add a test asserting `grid-column-guides` renders exactly 7 marker children inside the banner when `spanningSchedules.length > 0`, and that the banner element itself no longer carries `divide-x` -- proves the mechanism swap without depending on real layout/JSDOM box metrics.
- [x] `_bmad-output/implementation-artifacts/backlog.yaml` -- flip `BUG-050` to `status: done, closed: 2026-09-26`, `spec: spec-bug-050-calendar-desktop-gridlines.md`, note summarizing the confirmed root cause and fix, matching BUG-045/048/049's entry shape.
- [x] `packages/ui/src/features/events/WeeklyCalendarView.tsx` + `EventCardCalendarGridItem.tsx` -- added the established `/** @jsxImportSource react */` pragma (precedent: `EventCardMediaPrimitives.tsx`) so both files can be live-mounted by `packages/visual-audit`'s Playwright harness; a documented no-op for this package's own build (verified: `EventCardCalendarGridItem.tsx` lacking it is exactly what surfaced a "not a valid React child" mount failure during live verification, isolated to the banner path).
- [x] **(code-review round 1, patch)** `packages/visual-audit/weekly-calendar-gridlines.spec.ts` -- committed the live-render geometry proof (previously an uncommitted ad hoc script) as a permanent Playwright spec: single-multiday-schedule x-position parity, two-stacked-schedule full-banner-height coverage, and zero-schedule absence, all against the real mounted `WeeklyCalendarView`. Runs automatically under `pnpm --filter visual-audit test:manifests` (matches the package's existing `*.spec.ts` convention, no new manifest/Rule kind).
- [x] **(code-review round 1, patch)** `packages/ui/src/features/events/WeeklyCalendarView.tsx` -- extracted `DAYS_PER_WEEK = 7` and used it in both `visibleDays`' construction loop and `GridColumnGuides`' marker count (previously two independent hardcoded `7`s).
- [x] **(code-review round 1, patch)** `packages/ui/src/features/events/WeeklyCalendarView.tsx` -- added `isolate` to the banner row's container class and `-z-10` to `GridColumnGuides`, making "guide paints behind every card" an explicit CSS stacking guarantee instead of one contingent on sibling `<MultiDaySpanningBar>`/its internal layers never gaining an explicit z-index of their own.
- [x] **(code-review round 1, patch)** `packages/ui/src/features/events/WeeklyCalendarView.test.tsx` -- added jsdom coverage for the two previously-untested branches: zero multi-day schedules (banner/guide both absent) and the stacked-overlapping-schedules case (single guide overlay, still 7 markers).

**Acceptance Criteria:**
- Given a visible week with at least one multi-day schedule, when the desktop calendar renders, then all 6 column-boundary gridlines are visible at pixel-identical x-positions across the day-header row, spanning-banner row, and day-cell row, except where a spanning card's own body legitimately covers an internal boundary within its own span.
- Given a visible week with zero multi-day schedules, when the desktop calendar renders, then the banner row doesn't render and the header/day-cell rows' gridlines remain visually continuous and unchanged (regression guard on the already-correct rows).
- Given the mechanism swap, when `pnpm --filter @festgrid/ui test`, `pnpm --filter @festgrid/ui lint`, and `pnpm --filter web build` run, then all pass clean.

## Spec Change Log

**Code-review round 1 (2026-09-26, Blind Hunter + Edge Case Hunter, no loopback — all findings routed `patch`, none `intent_gap`/`bad_spec`):**
- Blind Hunter's core finding: the fix's own load-bearing pixel-alignment claim had no committed, repeatable proof — only an uncommitted ad hoc script plus a jsdom test that checks markup shape, not real layout. Amended: committed `packages/visual-audit/weekly-calendar-gridlines.spec.ts` (real Playwright/Chromium geometry proof, 3 scenarios) as a permanent regression guard. Known-bad state avoided: an unreproducible empirical claim recorded in `backlog.yaml` that no future reviewer could check.
- Blind Hunter: `GridColumnGuides`' behind-the-cards stacking relied on implicit DOM-order/z-index-auto behavior, fragile to a future z-index addition on `MultiDaySpanningBar`/its internal layers. Amended: `isolate` on the banner row container + explicit `-z-10` on the guide overlay, making it a real CSS stacking guarantee.
- Blind Hunter: `Array.from({ length: 7 })` was a second, independent "7 days" constant, desyncable from `visibleDays`' own loop. Amended: extracted shared `DAYS_PER_WEEK` constant, used by both.
- Edge Case Hunter + Blind Hunter (same finding, deduplicated): no test coverage for the zero-multiday-schedule branch or the stacked/multi-row banner case. Amended: added both as jsdom tests, plus as two of the three committed Playwright geometry-proof scenarios.
- Rejected: Edge Case Hunter's claim that `MultiDaySpanningBar`'s root lacks `position:relative` (disproven by re-reading the code — it already has `className="relative w-full"`); an RTL `divide-x` concern (speculative, and if real, equally pre-existing on the untouched header/day-cell rows, not introduced by this diff); `backlog.yaml`'s `touches: [pkg:ui, web:...]` tagging (matches the established BUG-048/049 convention verbatim, not a new inconsistency); spec-vs-backlog status mismatch (expected mid-workflow artifact, resolves at step 5).
- KEEP: the core fix (7 fixed marker divs replacing `divide-x`'s DOM-adjacency dependency) needed no changes — every finding was about strengthening its verification/robustness, not its correctness.
- Incidental fixes surfaced while committing the geometry proof (not review findings, caught by `pnpm build`'s own type-check): the proof's relative import of `WeeklyCalendarView` must use the `.js` extension convention (NodeNext), not a literal `.tsx` extension; its `schedules` fixture needed the real `WeeklyCalendarViewScheduleShape[]` type, not `unknown[]`.

## Design Notes

Why not the ACs doc's other suggested direction (a background-image gradient on the row)? The
day-header/day-cell rows' own opaque, edge-to-edge cells would fully hide a parent-level
background gradient (their own self-border is what makes `divide-x` work there); the guide-marker
approach reuses that exact same self-border mechanism on dedicated, always-7, content-free markers
instead — provably identical in effect to the two already-correct rows, not a second mechanism.

Why no new `packages/visual-audit` *manifest*: that package's `Rule` vocabulary
(`sibling-dimension`, `intra-box-ratio`, `overflow`, `color`, `placement-order`) has no kind for
"do these two different selector sets' x-positions match pairwise," and adding one is real
shared-infrastructure design work, disproportionate to one bugfix. `weekly-calendar-gridlines.spec.ts`
sidesteps that by reusing the package's existing `mountManifestEntry`/`getElementSnapshots` helpers
directly, as a plain committed `*.spec.ts` (same relative-import style `manifests-proof.spec.ts`
already uses) — a real, repeatable, Chromium-rendered geometry proof without inventing a new `Rule`
kind. (Code-review round 1: this replaced an original plan to leave the check as an uncommitted ad
hoc script — Blind Hunter correctly flagged that as leaving the fix's own load-bearing claim
unreproducible by anyone else.)

## Verification

**Commands:**
- `pnpm --filter @festgrid/ui test -- WeeklyCalendarView` -- expected: existing + new tests pass, including the pre-existing `grid-cols-7` class assertion. Actual: 57/57 passed.
- `pnpm --filter visual-audit test:manifests` (includes the new `weekly-calendar-gridlines.spec.ts`, run separately from turbo's `test` pipeline per this package's own `package.json` scripts) -- expected: all pass, including the committed geometry proof. Actual: 20/20 passed, 0px x-delta across all 7 columns in both the single- and stacked-multiday scenarios; stacked-schedule overlay height covers the full multi-row banner.
- Repo-wide gate (`npx tsx src/run-check.ts --kind <lint|build|test>`, unfiltered, per this workflow's Lint/Build/Test Gate step) -- expected: all pass. Actual: 8/8 lint, 8/8 build, 12/12 test tasks passed (final run, after the code-review patches and the `.tsx`-extension/type fixes `pnpm build` first caught in `weekly-calendar-gridlines.spec.ts`).

**Manual checks (if no CLI):**
- Run the app locally (`run` skill / dev server), open the desktop calendar for a week containing a multi-day event and a week without one, and visually confirm continuous vertical gridlines across all 7 columns in both cases.

## Suggested Review Order

**The fix itself**

- Entry point: the new overlay mechanism, why `divide-x` alone can't work here, and the `isolate`/`-z-10` stacking guarantee added in review.
  [`WeeklyCalendarView.tsx:206`](../../packages/ui/src/features/events/WeeklyCalendarView.tsx#L206)

- Where the overlay is wired in: replaces `divide-x` on this one row only, header/day-cell rows untouched.
  [`WeeklyCalendarView.tsx:785-791`](../../packages/ui/src/features/events/WeeklyCalendarView.tsx#L785)

- The banner row's own container class: keeps `grid-cols-7` (alignment basis) but drops `divide-x`, adds `relative isolate`.
  [`WeeklyCalendarView.tsx:52-64`](../../packages/ui/src/features/events/WeeklyCalendarView.tsx#L52)

- Single source of truth for "7 days," used by both the guide markers and the pre-existing week-construction loop.
  [`WeeklyCalendarView.tsx:44-48`](../../packages/ui/src/features/events/WeeklyCalendarView.tsx#L44)

**Committed geometry proof (real Playwright render, not jsdom)**

- Core claim under test: guide markers land pixel-identical (≤1px) to the day-header row's 7 cells with a spanning card present.
  [`weekly-calendar-gridlines.spec.ts:68`](../../packages/visual-audit/weekly-calendar-gridlines.spec.ts#L68)

- Riskiest case: 2+ stacked overlapping schedules — one overlay must still cover the whole multi-row banner height.
  [`weekly-calendar-gridlines.spec.ts:108`](../../packages/visual-audit/weekly-calendar-gridlines.spec.ts#L108)

- Regression guard: zero multi-day schedules renders no banner/overlay at all, matching pre-fix behavior.
  [`weekly-calendar-gridlines.spec.ts:155`](../../packages/visual-audit/weekly-calendar-gridlines.spec.ts#L155)

**Supporting changes**

- `EventCardCalendarGridItem.tsx` needed the same JSX-runtime pragma as `WeeklyCalendarView.tsx` to be mountable by the Playwright proof above.
  [`EventCardCalendarGridItem.tsx:3`](../../packages/ui/src/features/events/EventCardCalendarGridItem.tsx#L3)

- jsdom coverage: markup-shape proof (classes/testid/child count) for the mechanism swap, plus the two branches added in review.
  [`WeeklyCalendarView.test.tsx:268`](../../packages/ui/src/features/events/WeeklyCalendarView.test.tsx#L268)

- Bug closed out on the board with the confirmed root cause and fix summary.
  [`backlog.yaml:1600`](./backlog.yaml#L1600)
