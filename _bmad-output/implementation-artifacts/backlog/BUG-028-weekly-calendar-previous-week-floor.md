---
backlog_id: BUG-028
title: "WeeklyCalendarView's Previous-week navigation has no floor — users can browse arbitrarily far into the past"
captured: 2026-09-13
fixed: 2026-09-13
---

# BUG-028 — WeeklyCalendarView Previous-week has no floor

## Capture

Raised by user via ritual HIL during the epic-1-i1 batch (2026-09-13), while discussing the
desktop calendar redesign (IDEA-026). Verified: `useWeeklyCalendarController.ts`'s
`handlePrevWeek` unconditionally shifted the displayed week back 7 days with no lower bound,
and `WeeklyCalendarView.tsx`'s "Previous week" button was never disabled.

User confirmed the desired boundary: disable once the displayed week is today's week (or
earlier) — "Next" stays unbounded.

## Fixed, same session (commit dc2d6bc)

Direct implementation, not routed through `bmad-dev-story` since it was small/unambiguous:

- `useWeeklyCalendarController` now returns `isPrevWeekDisabled` (computed from
  `weekStart <= getWeekStart(todayStr)`).
- `handlePrevWeek` itself no-ops defensively when disabled.
- `WeeklyCalendarView` gained an `isPrevWeekDisabled?` prop wired to the button's `disabled`
  attribute.
- All 4 consumer pages (Discovery/CalendarView, Feed/FeedCalendarView,
  Account/AccountCalendarView, My Calendar) thread it through.

Lint/build/full test suite verified green, including new dedicated tests for the boundary in
both `useWeeklyCalendarController.test.tsx` and `WeeklyCalendarView.test.tsx`.
