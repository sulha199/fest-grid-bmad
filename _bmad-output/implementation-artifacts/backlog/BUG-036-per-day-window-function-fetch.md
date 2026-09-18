---
backlog_id: BUG-036
title: "Query.events' flat ORDER BY next-upcoming-date ASC LIMIT 1000 can let one popular day silently starve a later day in the same visible week"
captured: 2026-09-17
---

# BUG-036 — Calendar week fetch can starve a later day

## Capture

Found while designing FIND-026's calendar overflow fetch (Architecture Spine AD-23).
`CalendarView.tsx` fetches the entire visible week in one shot (`useGetEventsForCalendarQuery`,
`limit:1000`); the resolver's default ordering (`resolvers.ts:3130-3157`, Story 2.7's
next-upcoming-date ASC chain) has no per-day floor. If an early day in the week has enough
events to consume most/all of the 1000-row budget, a later day in the SAME week can come back
with zero or artificially few events — with no signal to the client that truncation happened,
unlike a correctly-capped day which at least shows "+N more". Pre-existing, independent of the
FIND-026 redesign — not a byproduct of it.

## Decided fix (AD-23)

Replace the flat ORDER BY/LIMIT with a SQL window function partitioned per day
(`ROW_NUMBER() OVER (PARTITION BY event_start_date ORDER BY event_start_time ASC NULLS LAST, id ASC) <= N`),
excluding multi-day/day-of-week-collapsed schedules from the partition (fetched unconditionally
alongside it, same exempt-set principle EXPERIENCE.md already established for rendering).

Sequencing (user-confirmed): ships in the same story as FIND-026/IDEA-025/IDEA-026's
calendar-overflow-dialog work, since both touch the same fetch surface, but tracked here as its
own row since it's an independently-discovered pre-existing defect.

## Promoted (2026-09-17 via bmad-create-story)

Deterministic match — Story 1.i1h's own epics.md section cites this row by id. Carved out of
IDEA-026's Story 1.i1f during Gate 2, alongside FIND-026's own overflow-dialog scope, into
Story 1.i1h — the per-day window-function fetch fix plus the resolver's outer-ORDER-BY
tie-break sort needed for the overflow dialog's own paginated continuation to stay stable. Not
yet implemented — Story 1.i1h is itself still `backlog` and has no story file on disk yet
(drafted only as an epics.md section pending its own `bmad-create-story` pass); once it's
drafted, fold this history into its Dev Notes alongside FIND-026's.
