---
backlog_id: FIND-051
title: "event-card-date-box-overflow manifest fixture never mounts the shipped 'number' day-variant class path and only covers size='default' — no live fixture for compact-row word rendering"
captured: 2026-09-25
---

# FIND-051: event-card-date-box-overflow manifest fixture never mounts the shipped 'number' day-variant class path and only covers size='default' — no live fixture for compact-row word rendering

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

Deferred by the reviewer, 2026-09-25 code review on Story 1.i1n: all literal-free enumerate branches (real-date fallback, hasTime time-string) collide on the same 'Wednesday' placeholder sample so dayVariantForSample mounts them as 'word'; collision is benign today (word classes fit every mounted content under 96px; compact row uses an identical class set on a shrink-0 box, yesterday ≈70px). Add a fixture variant if the date box ever gains new day-variants or sizes. Deferred from: 'Deferred from: code review of 1-i1n-fix-eventcarddatebox-overflow-on-word-time-content (2026-09-25)'. 1 finding. packages/visual-audit/manifests/event-card-date-box-overflow.ts.
