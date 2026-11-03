---
backlog_id: FIND-006
title: "Two ux-rework2 fixes shipped without automated tests (favorite cache-sync, scroll-anchor)"
captured: 2026-09-05
---

# FIND-006: Two ux-rework2 fixes shipped without automated tests (favorite cache-sync, scroll-anchor)

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

DW-001, DW-003. The unfavorite/decrement path across all 4 patched favorite caches is untested; the overflow-anchor scroll-flicker fix has no Playwright spec since jsdom can't exercise CSS scroll anchoring. VERIFIED 2026-09-17 (ritual-orchestrator batch, pre-dispatch check): closes via Story 2.i1a (BUG-008's story) per event-pages-remaining-backlog-plan.md's own framing, already `review` in sprint-status.yaml. No dispatch run against this row (it was never independently storied).
