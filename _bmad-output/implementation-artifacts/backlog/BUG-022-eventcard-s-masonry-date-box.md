---
backlog_id: BUG-022
title: "EventCard's masonry date box shows startDate even while the event is ongoing, contradicting its own TILL sub-badge"
captured: 2026-09-07
---

# BUG-022: EventCard's masonry date box shows startDate even while the event is ongoing, contradicting its own TILL sub-badge

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

Never actually landed despite being marked promoted against Story 1.3b's supposed AC19 — direct code reading 2026-09-26 confirmed EventCard.tsx still always derives the date-box's month/day from startDate regardless of `started`. Superseded by BUG-047's unified context-date rule, which fixes this and BUG-040's overlapping surface in one pass rather than two.
