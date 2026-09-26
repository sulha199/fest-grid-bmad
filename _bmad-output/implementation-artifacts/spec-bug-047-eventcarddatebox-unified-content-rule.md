---
title: 'BUG-047: EventCardDateBox unified context-date-driven numeric-only content rule'
type: 'bugfix'
created: '2026-09-26'
status: 'done'
review_loop_iteration: 1
context: []
baseline_commit: '8165a1302676fa0b15a0cee1eb18b6e47b590056'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `EventCardDateBox`'s content rule is split across two divergent, word-capable
mechanisms (`formatShortEventDateTimeParts` for masonry, `computeCalendarSegmentDateBoxContent`'s
till-overload for the calendar list row), neither of which shows the end date once an event has
started (BUG-022) or stays numeric-only (BUG-040/1.i1n's now-superseded word-safe-sizing patch).

**Approach:** Replace both with one new, dedicated, numeric-only computation parameterized by a
context date (masonry: `now`; calendar: `currentDayStr`) that shows the end date while
started-and-not-yet-ended, else the start date — plus masonry-only date-box width/height
invariants (AC-DATE-4/5). `formatShortEventDateTimeParts`/`formatShortEventDateTime`/
`formatRelativeDayOrDate`/`formatEventStatus` are NOT touched.

## Boundaries & Constraints

**Always:**
- New function(s) live in `format-event-date.ts`, are entirely separate from
  `formatShortEventDateTimeParts` (which stays byte-for-byte unchanged, still exported, still
  covered by its own existing unit tests).
- **CORRECTED (review loop 1, 2026-09-26 — see Spec Change Log):** Masonry `notYetEnded` is
  `!(endDayDiff < 0 || (endDayDiff === 0 && !!endTime && now.getTime() >= endDateTime.getTime()))`,
  where `endDayDiff = getCalendarDayDifference(getLocalDateInTimezone(now, timezone),
  getLocalDateInTimezone(endDateTime, timezone))` — day-difference based, mirroring
  `formatEventStatus`'s own already-tested `ended` computation in this same file (reusing its two
  building blocks, `getLocalDateInTimezone`/`getCalendarDayDifference`, independently — never
  calling into `formatEventStatus` itself or duplicating its full return-value logic). An end day
  with no known `endTime` is never "ended" for its whole calendar day; a precise timestamp compare
  only applies once an `endTime` is actually known. The originally-specified strict `now.getTime()
  < endDateTime.getTime()` is superseded — it re-broke BUG-022 for multi-day events with no
  precise end time (`endDateTime` collapses to midnight of the end date via `combineDateTime`'s
  existing behavior, so `notYetEnded` went false for nearly the entire still-ongoing last day).
  Calendar `notYetEnded` is unaffected by this correction — it still uses `<=` on `YYYY-MM-DD` day
  strings (`currentDayStr <= effectiveEnd`), which was never the buggy half.
- Masonry's end-date computation reuses `EventCard.tsx`'s own hoisted `effectiveEndDate`/
  `endDateTime` values (the ones its TILL badge already derives) — computed once, passed into the
  new function, never re-derived a second way.
- Calendar's amber corner tag (`tillLabel`) is populated in **every** case via the existing,
  unchanged `computeCalendarSegmentTillText` — not just the former "continuing segment" case.
- `EventCardDateBox`'s `dayVariant` prop and its `'word'` sizing branch are deleted once no caller
  passes it (confirmed: only `EventCard.tsx` and `WeeklyCalendarView.tsx`'s list variant ever did).
- AC-DATE-4 (fixed day-slot width) and AC-DATE-5 (height parity) apply to masonry `size='default'`
  only — never touch the calendar row's `size='compact'` box.
- Update `EVENT-CARD-DESIGN.md`'s `event_card_date_box` token (the `>>>`-flagged block) to describe
  the new rule.

**Ask First:** none outstanding — the last open question (last/only-day comparison operator) is
resolved above.

**Never:** do not modify `formatShortEventDateTimeParts`, `formatShortEventDateTime`,
`formatRelativeDayOrDate`, or `formatEventStatus`. Do not touch VM5/VM6 (no date-box, out of
scope). Do not change `computeCalendarSegmentTillText`'s own logic.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output |
|---|---|---|
| Masonry, not started | `now < startDateTime` | month/day = start date |
| Masonry, started+ongoing (endTime known) | `startDateTime <= now`, `endDayDiff===0 && now < endDateTime`, or `endDayDiff>0` | month/day = end date |
| Masonry, started+ongoing (endTime unknown, same end day) | `startDateTime <= now`, `endDayDiff===0`, no `endTime` | month/day = end date (never "ends" mid-day without a known time) |
| Masonry, already ended | `endDayDiff < 0`, or (`endDayDiff===0 && endTime known && now >= endDateTime`) | month/day = start date |
| Calendar, first day of multi-day | `currentDayStr === startDate < effectiveEnd` | month/day = end date; corner tag = "till" |
| Calendar, last day of multi-day | `currentDayStr === effectiveEnd` | month/day = end date (`<=`); corner tag = "till {end time}" or "till" |
| Calendar, single-day event | `currentDayStr === startDate === effectiveEnd` | month/day = end date (== start date); corner tag per `computeCalendarSegmentTillText` |

</frozen-after-approval>

## Code Map

- `packages/ui/src/features/events/format-event-date.ts` — add `computeEventCardDateBoxParts` (masonry); rewrite `computeCalendarSegmentDateBoxContent` (calendar, drop `dayVariant`, always populate `tillLabel`)
- `packages/ui/src/features/events/EventCard.tsx` — hoist `effectiveEndDate`/`endDateTime`; call new function for both VM1 (inline text) and VM2 (`EventCardDateBox`); drop `dayVariant` prop
- `packages/ui/src/features/events/WeeklyCalendarView.tsx` — drop `dayVariant` prop passed to `EventCardDateBox`
- `packages/ui/src/features/events/EventCardMediaPrimitives.tsx` — delete `dayVariant`/`'word'` branch; add AC-DATE-4 fixed-width classes to `size='default'` day slot only
- `packages/ui/src/features/events/EventCardMediaPrimitives.types.ts` — remove `dayVariant` from `EventCardDateBoxProps`
- `packages/ui/src/features/events/format-event-date.test.ts`, `EventCard.test.tsx`, `EventCardMediaPrimitives.test.tsx` — rewrite word-content assertions; add new-function unit tests
- `packages/visual-audit/manifests/event-card-date-box-overflow.ts` + its `manifests/index.ts` registration + its `manifests-proof.spec.ts` describe block — delete (tests dead word-variant machinery)
- `packages/visual-audit/vendor/tailwind.config.cjs` — regenerate offline bundle for new day-slot classes; fix stale comment
- `design-artifacts/UX-festgrid-run-1/EVENT-CARD-DESIGN.md` — rewrite `event_card_date_box` token's `>>>`-flagged section
- `_bmad-output/implementation-artifacts/backlog.yaml` — flip BUG-047 to done

## Tasks & Acceptance

**Execution:**
- [x] `format-event-date.ts` -- add `computeEventCardDateBoxParts(locale, timezone, now, startDateTime, endDateTime)`; rewrite `computeCalendarSegmentDateBoxContent` per the `<=` rule, dropping `dayVariant` -- implements AC-DATE-1/2/3
- [x] `EventCard.tsx` -- hoist end-date computation above the `started` TILL-badge check; wire both VM1/VM2 to the new function; keep Clock-icon-on-`hasTime`-today logic untouched
- [x] `WeeklyCalendarView.tsx` -- drop `dayVariant` prop at the `EventCardDateBox` call site
- [x] `EventCardMediaPrimitives.tsx`/`.types.ts` -- delete `dayVariant`; add `tabular-nums`/`min-w` to `size='default'` day slot (AC-DATE-4); add `h-full` to `size='default'` root span (AC-DATE-5, real gap found — see Design Notes)
- [x] Delete `event-card-date-box-overflow.ts` + its two registrations; regenerate vendored Tailwind CSS
- [x] Rewrite affected unit tests; add context-date function tests (not-started/started-ongoing/ended × now-context/day-context)
- [x] Playwright/visual check: masonry date-box shows end date once started+ongoing (BUG-022 repro, live-verified); verified AC-DATE-5 height parity empirically in `isMasonryDefault` (found and fixed a real gap)
- [x] `EVENT-CARD-DESIGN.md` + `backlog.yaml` doc updates
- [x] Review loop 1: Blind Hunter + Edge Case Hunter passes run, findings classified and resolved (1 intent_gap fixed per user decision — see Spec Change Log; several patches applied; 2 items deferred to `deferred-work.md`); full lint/build/test + visual-audit manifest suites re-verified green after the fix

**Acceptance Criteria:**
- Given a masonry card whose event started yesterday and ends tomorrow, when rendered, then the date-box shows tomorrow's (end) date, not yesterday's start date.
- Given a masonry card whose event already ended, when rendered, then the date-box shows the start date.
- Given a calendar list-row card on the last day of a 3-day event, when rendered, then month/day show real end-date digits and the corner tag carries the till/time text (never a word or bare time string in the day slot).
- Given a masonry `size='default'` date-box, when the day is "3" vs "23", then the box's rendered width is identical.
- No production code path can produce `EventCardDateBox`'s former `dayVariant='word'` sizing.

## Spec Change Log

- **2026-09-26, review loop 1 — bad_spec/intent_gap (root cause inside frozen intent):** Blind
  Hunter and Edge Case Hunter independently found that masonry's frozen `notYetEnded` rule
  (strict `now.getTime() < endDateTime.getTime()`) re-broke BUG-022 for multi-day events with no
  precise `endTime`: `combineDateTime` collapses an absent `endTime` to midnight of the effective
  end date, so `notYetEnded` went false for nearly the entire still-ongoing last day, reverting
  the date-box to the start date while the TILL badge (day-diff based) still correctly showed
  "till". User-directed fix (2026-09-26): `notYetEnded` is now
  `!(endDayDiff < 0 || (endDayDiff === 0 && !!endTime && now.getTime() >= endDateTime.getTime()))`
  — day-difference based via `getLocalDateInTimezone`/`getCalendarDayDifference`, mirroring
  `formatEventStatus`'s own already-tested `ended` semantics, implemented independently (not by
  calling into `formatEventStatus` or duplicating its full return shape). **KEEP:** everything
  else in this spec — the calendar side's `<=` day-string rule, the `started` computation, the
  shared `resolveEventCardDateBoxTarget` structure, AC-DATE-4/5, and the dead-code deletions — was
  independently confirmed correct by both reviewers and is unaffected by this correction.
  Known-bad state avoided: the date-box silently contradicting its own TILL sub-badge for the
  common "no precise end time" event shape, for up to a full calendar day per occurrence.

## Design Notes

VM1 (prominent poster) has no `EventCardDateBox` — it's inline JSX (`EventCard.tsx`). Naively
gluing `computeEventCardDateBoxParts`'s `month`/`day` strings together in a fixed order would lose
locale-correct part ordering (some locales put the day before the month), so VM1 instead calls a
second new function, `formatEventCardDateBoxLine`, sharing the same internal
`resolveEventCardDateBoxTarget` started/notYetEnded resolution but returning one Intl-formatted
"month day" string in the locale's own order. Both functions live in `format-event-date.ts`. The
Clock-icon condition (`hasTime && dayDiff === 0`, computed from `getEventDayDiff` — untouched) is
unchanged, since it decorates the month slot, not the day slot AC-DATE-1 governs.

**AC-DATE-5 finding:** NOT already structurally correct as speculated. The `top_row_default` row's
`flex items-stretch` DOES stretch `EventCardDateBox`'s wrapper `<div>` to the thumbnail's height —
but `EventCardDateBox`'s own root `<span>` (the visible slate-800 box) had no height rule of its
own, so it only filled its natural content height (~102px) inside that taller (~230px) invisible
wrapper, leaving the visible box shorter than the thumbnail. Confirmed via a temporary Playwright
check (real render, `sibling-dimension` rule) before and after; fixed with `h-full` on the span,
gated to `size==='default'` only (masonry), leaving the calendar list row's `size='compact'` box
untouched. Re-verified green after the fix (0.00px delta), then the temp check was removed.

## Verification

**Commands:**
- `pnpm --filter @festgrid/ui test` -- expected: all green, including rewritten date-box suites
- `pnpm --filter @festgrid/ui build` && repo-wide `pnpm build` -- expected: clean
- `pnpm -w lint` -- expected: clean
- `pnpm --filter @festgrid/visual-audit build:vendor-tailwind` -- regenerate offline CSS after new day-slot classes
- `pnpm --filter @festgrid/visual-audit test` (Playwright) -- expected: remaining manifests green, deleted manifest's describe block removed

**Manual checks (if no CLI):**
- Live/Playwright render of a masonry card for an ongoing event (started, not ended) — confirm date-box shows end date, matching the TILL sub-badge.
- Live render of `isMasonryDefault` — confirm date-box height equals thumbnail height (AC-DATE-5); note in Dev Notes whether this needed a code change or was already structurally correct.

## Suggested Review Order

**Core rule: the context-date computation**

- Entry point — the corrected `notYetEnded` logic (review loop 1's fix is here: day-difference based, mirrors `formatEventStatus`'s own `ended` semantics instead of a raw strict-timestamp compare).
  [`format-event-date.ts:417`](../../packages/ui/src/features/events/format-event-date.ts#L417)

- The rewritten calendar-row sibling — `<=` on day strings, `tillLabel` now populated via `computeCalendarSegmentTillText` in every case, not just the former "continuing segment".
  [`format-event-date.ts:496`](../../packages/ui/src/features/events/format-event-date.ts#L496)

- VM1's one-line text — a second thin function sharing the same target resolution, kept separate so locale-correct part ordering isn't lost by gluing two pre-formatted strings.
  [`format-event-date.ts:458`](../../packages/ui/src/features/events/format-event-date.ts#L458)

**EventCard.tsx wiring**

- Single hoisted `now` for the whole render (post-review fix) — the date-box, TILL badge, and status badge all read the same instant.
  [`EventCard.tsx:177`](../../packages/ui/src/features/events/EventCard.tsx#L177)

- VM2's `dateBoxParts` call site — the hoisted `effectiveEndDate`/`endDateTime` (TILL badge's own values) feed straight into the new function, never re-derived.
  [`EventCard.tsx:196`](../../packages/ui/src/features/events/EventCard.tsx#L196)

- VM1's `dateBoxLine` render — the old `formatShortEventDateTime` string is gone from this call site.
  [`EventCard.tsx:397`](../../packages/ui/src/features/events/EventCard.tsx#L397)

- `WeeklyCalendarView.tsx`'s list-row call site — same function, `dayVariant` prop dropped.
  [`WeeklyCalendarView.tsx:1063`](../../packages/ui/src/features/events/WeeklyCalendarView.tsx#L1063)

**Sizing invariants (AC-DATE-4/5)**

- AC-DATE-5's real fix — `h-full` on `EventCardDateBox`'s root span, masonry `size='default'` only (the actual gap the empirical check found).
  [`EventCardMediaPrimitives.tsx:325`](../../packages/ui/src/features/events/EventCardMediaPrimitives.tsx#L325)

- AC-DATE-4's fix — `tabular-nums`/`min-w-[2ch]` on the day slot, same `size='default'` scope.
  [`EventCardMediaPrimitives.tsx:315`](../../packages/ui/src/features/events/EventCardMediaPrimitives.tsx#L315)

- The permanent regression guard added during code review, replacing the deleted overflow manifest's lost coverage.
  [`event-card-date-box-sizing.ts:44`](../../packages/visual-audit/manifests/event-card-date-box-sizing.ts#L44)

**Design doc**

- The rewritten `event_card_date_box` token — the `>>>`-flagged block, corrected to describe the shipped rule (and no longer contradicting the AC-DATE-5 fix, a review finding).
  [`EVENT-CARD-DESIGN.md:310`](../../design-artifacts/UX-festgrid-run-1/EVENT-CARD-DESIGN.md#L310)

**Tests (peripherals)**

- The corrected-behavior unit tests for the review-loop-1 fix — the exact previously-broken scenario, now passing.
  [`format-event-date.test.ts:434`](../../packages/ui/src/features/events/format-event-date.test.ts#L434)

- The end-to-end integration regression test reproducing the same scenario through the real component.
  [`EventCard.test.tsx:634`](../../packages/ui/src/features/events/EventCard.test.tsx#L634)
