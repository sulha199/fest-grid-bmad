---
title: 'WeeklyCalendarView: unified banded 7-column grid with per-column paging'
type: 'feature'
created: '2026-10-10'
status: 'draft'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-weekly-calendar-sticky-header-mobile-day-tabs.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The desktop layout stacks a multi-day banner above the single-day day-cell grid. A real week returns ~201 schedules, ~90 of them long-running multi-day promos, which pushes single-day events far down the page. The 5-per-cell cap plus "+N more" dialog is a second, disconnected paging mechanism.

**Approach:** One unified ordering (start date asc, end date asc, start time, id) rendered on desktop as a single 7-column grid where multi-day bars span the columns they cover. Paging is per column in append-only "bands" (infinite scroll plus a visible "Show more" button), so a later page never renders above an earlier one. Mobile keeps its per-day paging on the same sort key. The desktop "+N more" dialog and 5-per-cell cap are removed.

## Boundaries & Constraints

**Always:**
- Sort key everywhere (desktop, mobile, backend continuation): `eventStartDate` asc, `eventEndDate` (or start if null) asc, `eventStartTime` asc (untimed last), schedule `id`.
- Banding: band size `K` rows per column (`DESKTOP_BAND_SIZE`, proposed 6). A multi-day bar costs one slot in every column it covers. Packing happens only inside a band; no backfilling into earlier bands. Columns with fewer items leave real empty cells.
- Append-only: an item keeps the band it was first placed in. A late-arriving row that sorts earlier than placed rows goes into the next band, never above rendered ones.
- Paging: sentinel below the last band (`useInfiniteScroll`) plus a visible "Show more" button; progress line ("Showing X of Y schedules this week" / "All Y shown"); sentinel and button are removed when everything is loaded. Wrapper uses `[overflow-anchor:none]` as backstop (BUG-038 / spec-bug-046 pattern).
- Sticky day headers show the day's total and "+N below" while that day has unrendered items ("N+" when the day may have more on the server). Mobile tabs show per-day counts ("Fri 12", "20+" when the day hit the fetch window).
- Z-index follows AD-33 (Local `z-10` only inside an `isolate` owner; no raw `z-40/50/z-[…]`). Keyboard roving tabindex keeps working across the new grid, including bars.
- New UI strings are `labels` props with en/id entries (next-intl).

**Ask First:** Final value of `K`; whether to keep a "Starting this week only" toggle for long-running schedules; whether to keep a per-day focus view now that the desktop dialog goes; any backend change beyond ordering of the single-date continuation path.

**Never:** Change the week query's payload size/shape (out of scope), edit the frozen block of the shipped spec, add per-row field resolvers to `Query.events`, introduce global first-fit packing.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First paint | 201 schedules, K=6 | Band 1 only: each column ≤ K slots, bars spanning columns | N/A |
| Later page | scroll sentinel / click "Show more" | Band 2 appended below band 1; band 1 unchanged | N/A |
| Short column | Tue has 2 items, Fri 40 | Tue cells empty after item 2 in every band | N/A |
| Truncated day | Fri hit fetch window (20 singles) | Header "+N below"; continuation fetched for Fri when a band needs rows | Fetch error: keep rendered rows, button retries |
| Late row sorts earlier | continuation returns a row sorting before a placed bar | Placed in next band; nothing moves | N/A |
| All loaded | no unrendered, no server remainder | Sentinel and button gone; "All Y shown" | N/A |
| Empty week | 0 schedules | Empty grid + "no schedules" state | N/A |

</frozen-after-approval>

## Code Map

- `packages/ui/src/features/events/WeeklyCalendarView.tsx` -- banner (L1033-1081), day cells (L1083-1145), `dayBuckets`/`spanningSchedules`/`singleDayDayBuckets` (L551-679), roving nav (L681-767), mobile paging (L802-863), overflow dialog (L778-910, L1264).
- `packages/ui/src/features/events/WeeklyCalendarView.types.ts` -- props (`maxEventsPerDay`, `onOverflowRequested`, `overflowDialogData`, `moreLabel`, `moreMultiDayLabel`) and `labels`.
- `packages/domain/src/` (new `calendar/` or `query/` util) -- pure `compareSchedules` and `computeBands` (100% unit-tested per project-context).
- `packages/ui/src/features/events/CalendarOverflowDialog.tsx` -- deleted if no other importer remains (only WeeklyCalendarView imports it today).
- `apps/web/src/features/events/CalendarView.tsx` -- single `openOverflowDate` continuation query (L185-276) becomes up to 7 per-day continuations; `maxEventsPerDay={5}` removed.
- `apps/web/src/app/[locale]/feed/FeedCalendarView.tsx`, `.../[accountId]/AccountCalendarView.tsx`, `.../my-calendar/my-calendar-content.tsx` -- other consumers; remove dropped props.
- `apps/backend/src/schema/resolvers.ts` -- windowed path `dayRank` (L3486) and single-date tie-break in the flat path (L3701-3738): align to the unified key (matching schedule's start date, end date, time, id).
- `apps/web/e2e/calendar-banner-alignment.spec.ts`, `packages/visual-audit/weekly-calendar-gridlines.spec.ts` -- assume the old banner/cells; update.
- `apps/web/locales/{en,id}.json` -- labels (progress line, "+N below", "Show more", tab counts).

## Tasks & Acceptance

**Execution:**
- [ ] domain util -- `compareSchedules(a, b)` and `computeBands(items, columns, K, placedBands)` returning band rows with column/span placement, plus per-column totals -- one pure, tested ordering and packing source of truth
- [ ] `WeeklyCalendarView.tsx` -- replace banner + cells with one `grid-cols-7` of bands (bars use `col-span`, same column template as sticky headers); remove `maxEventsPerDay`, "+N more", dialog wiring; add sentinel/button/progress line; mobile uses `compareSchedules`
- [ ] `WeeklyCalendarView.tsx` -- sticky header totals / "+N below"; mobile tab counts
- [ ] `WeeklyCalendarView.tsx` -- rewrite roving tabindex over band layout: Left/Right move to the adjacent column in the same band row, Up/Down move within a column across bands (bars are one stop in their start column); coordinates keyed by schedule id, not day bucket index
- [ ] `CalendarView.tsx` + props -- per-day continuations for truncated days, requested as bands need rows; dedupe by schedule id; fire existing analytics events where still meaningful
- [ ] `resolvers.ts` -- order the windowed rank and single-date continuation by the unified key; add resolver tests
- [ ] Update/add tests: unit (domain), `WeeklyCalendarView.test.tsx`, `CalendarView.test.tsx`, e2e banner-alignment, AD-33 ratchet stays green; delete obsolete dialog/banner tests
- [ ] i18n en/id labels; docs: add a note to Story 1.i1g/1.i1h files and a Spec Change Log entry here

**Acceptance Criteria:**
- Given any loaded set, when a later page loads, then no newly rendered item appears above any previously rendered item.
- Given the sort rule, then ordering is start date asc, end date asc, start time, id, identical on desktop, mobile and the backend continuation query.
- Given a day with more items than rendered/loaded, then its sticky header shows "+N below"; given all loaded, the sentinel and button disappear and the progress line reads "All Y shown".
- Given a multi-day bar spanning Tue–Thu, then it occupies one slot in each of those columns and renders as one element spanning them.
- Given a short column, then its remaining cells in a band are empty (no backfill from later bands).
- Given keyboard focus on a card, when arrow keys are pressed, then focus moves as specified and never lands on a non-rendered id.
- `ad33-z-index-layering.ratchet.test.ts` passes; no raw `z-40/50/z-[…]`.

## Spec Change Log

## Design Notes

Band membership: an item's band = `floor(maxColumnRank / K)`, where `maxColumnRank` is its deepest 0-based rank across the columns it covers (ranks counted in sort order over loaded items). Inside a band, items are first-fit packed into rows (bars need one row across all their columns). Placement is persisted per item for the lifetime of the visible week, which is what makes late rows append-only.

Continuation caveat: with end-date-asc, a multi-day run starting on day D sorts after D's single-day rows, yet is already loaded (exempt from the window) while D's later singles are not. The append-only rule above resolves this on the client; the backend ordering must still match the key so pages do not duplicate or skip. Offset math for the single-date path must be reconciled during implementation (flat path pages events, not schedules).

`Y` in the progress line is the count of distinct loaded schedules, shown as "Y+" while any day may have more server rows (no new count query).

## Verification

**Commands:**
- `pnpm --filter @festgrid/domain build` -- expected: success (needed before UI tests)
- `cd _bmad-output/specs/ritual-session-orchestrator/mailbox-runner && npx tsx src/run-check.ts --kind lint|build|test` -- expected: no new failures beyond the known pre-existing list

**Manual checks:**
- Playwright (`/opt/pw-browsers/chromium`) at 1440px and 390px against production data: band 1 shows single-day events near the top; scrolling appends bands without scroll jump; headers show totals and "+N below".
