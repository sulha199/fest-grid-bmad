---
backlog_id: BUG-048
title: "WeeklyCalendarView's desktop single-day grid-item cell never adopted EventCardCalendarGridItem -- renders a plain untokened text pill instead"
captured: 2026-09-26
---

# BUG-048: WeeklyCalendarView's desktop single-day grid-item cell never adopted EventCardCalendarGridItem -- renders a plain untokened text pill instead

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

Fixed 2026-09-26 (bmad-quick-dev): grid cell now composes EventCardCalendarGridItem, plus a shared status-badge amendment (AC-STATUS-1, VM5+VM6). See the spec file for detail/decisions. AMENDED 2026-09-28 (see design-artifacts/UX-festgrid-run-1/MASONRY-CARD-SESSION-CHANGES-2026-09-27.md items 7 and 12): the grid-cell/spanning-bar adoption above is UNCHANGED, but the status-badge half of this fix did NOT survive intact -- item 7 (2026-09-27) removed the status badge from VM5/VM6 entirely, reversing AC-STATUS-1 back to 2026-09-14's original 'no status badge' decision; item 12 (2026-09-28) then re-added a badge, but far narrower than AC-STATUS-1's original scope -- only for the `inHours`/`endsAt` states (formatEventStatus's `state` field), rendered under location/venue, with no nearby-badge-parity claim either way. Any future work referencing this bug's AC-STATUS-1 scope should target item 12's narrower rule, not this note's original 'shared status-badge amendment' description.
