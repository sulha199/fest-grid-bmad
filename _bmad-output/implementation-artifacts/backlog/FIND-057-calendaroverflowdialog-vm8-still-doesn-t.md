---
backlog_id: FIND-057
title: "CalendarOverflowDialog (VM8) still doesn't render a status badge -- EventCardCalendarGridItem's status-badge treatment (VM5/VM6) never reaches it"
captured: 2026-09-26
---

# FIND-057: CalendarOverflowDialog (VM8) still doesn't render a status badge -- EventCardCalendarGridItem's status-badge treatment (VM5/VM6) never reaches it

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

Deferred from: code review of spec-bug-048-eventcardcalendargriditem-single-day-adoption.md (2026-09-26). CalendarOverflowDialogItemShape has no date fields to pass through yet; extending it (a subset of WeeklyCalendarViewScheduleShape) is the fix. RE-SCOPED 2026-09-28: the target this row should match against changed twice since it was filed -- BUG-048's original AC-STATUS-1 badge (all 8 states) was removed 2026-09-27, then re-added 2026-09-28 far narrower (see MASONRY-CARD-SESSION-CHANGES-2026-09-27.md item 12): only `inHours`/`endsAt`, gated on formatEventStatus's `state` field, rendered under location/venue. If this finding is ever picked up, extend CalendarOverflowDialogItemShape to match VM5/VM6's CURRENT narrow rule, not BUG-048's original full-scope one.
