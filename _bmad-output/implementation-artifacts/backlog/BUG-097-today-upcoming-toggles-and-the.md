---
backlog_id: BUG-097
title: "TODAY/UPCOMING toggles and the next-upcoming sort key still use the UTC date, so 'Today' is UTC's yesterday for Jakarta's first 7 hours"
captured: 2026-10-31
---

# BUG-097: TODAY/UPCOMING toggles and the next-upcoming sort key still use the UTC date, so 'Today' is UTC's yesterday for Jakarta's first 7 hours

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

Follow-up of BUG-096, split out on purpose. `resolveTodayISO` falls back to the UTC date and no caller passes the `timezone` option DW-074 added; `notEnded` has no timezone conversion and the shared ended-cases fixture is pinned to UTC (AD-20 Rule 4, FIND-062); Query.events' `today` (sort key) is the UTC date. Needs the same per-schedule zone rule as BUG-096 plus a decision for the logged-out viewer's zone. Found by code reading, not reproduced live.
