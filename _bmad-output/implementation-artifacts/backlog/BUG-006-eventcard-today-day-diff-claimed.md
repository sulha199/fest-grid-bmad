---
backlog_id: BUG-006
title: "EventCard 'Today' day-diff — claimed product bug, verified to be the test-clock gap only"
captured: 2026-09-05
---

# BUG-006: EventCard 'Today' day-diff — claimed product bug, verified to be the test-clock gap only

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

DW-031. Verified 2026-09-05 against format-event-date.ts:66-71: getCalendarDayDifference anchors both sides to Date.UTC midnight from calendar-day parts, so diffMs is always an exact multiple of 86400000 and the floor is exact — no day-boundary defect exists in the product. The only real defect is the unmocked test clock, which is FIND-009. Kept as a row so the claim is not re-raised from the same evidence.
