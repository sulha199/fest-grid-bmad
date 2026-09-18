---
backlog_id: BUG-033
title: "Schedule.isAddedToCalendar N+1 on the event-detail page — same shape as getEvents' BUG-030, scoped to one event's schedule list"
captured: 2026-09-15
---

# BUG-033 — Schedule.isAddedToCalendar N+1

## Capture

Found via `bmad-agent-architect` audit (2026-09-15).

`apps/backend/src/schema/resolvers.ts`'s `Schedule.isAddedToCalendar` field resolver
(~3727-3741) is invoked once per schedule row returned by the `schedules` field (~3619-3625) —
no DataLoader or batching exists anywhere in `apps/backend/src` (grepped, zero hits). For a
multi-schedule (recurring/multi-day) event this is N separate DB round trips for a single
`eventBySlug` call, doubled by BUG-035.

Same defect class as BUG-030's `getEvents` N+1 (per-row field resolver instead of a
batched/EXISTS-subquery form), just bounded by one event's schedule count instead of a full
page of events — lower severity than BUG-030 but same fix pattern applies (batch via the
schedule ids already known from the parent select, or a per-request DataLoader).

Not yet scoped into a story.
