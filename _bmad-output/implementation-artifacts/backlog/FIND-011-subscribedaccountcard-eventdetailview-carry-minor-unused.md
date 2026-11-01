---
backlog_id: FIND-011
title: "SubscribedAccountCard/EventDetailView carry minor unused-prop and unscaled-variant cruft"
captured: 2026-09-05
---

# FIND-011: SubscribedAccountCard/EventDetailView carry minor unused-prop and unscaled-variant cruft

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

DW-011, DW-014. Fixed 2026-09-15 (bmad-quick-dev): removed the unused postedByLabel field end-to-end (EventDetailViewLabels type, mapper.ts, both test fixtures, en/id.json); SubscribedAccountCard's size="lg" now scales the adjacent displayName (text-lg) and username (text-base) text. The size="lg" scaling is a fractional overlap with Story 0.i6a (still backlog) -- 0.i6a's remaining scope is BUG-005's degenerate-input fallback only.
