---
backlog_id: FIND-050
title: "count-badge-react-mount demo manifest's overflow rule is a trivially-passing single-element sibling cluster, enforces nothing"
captured: 2026-09-25
---

# FIND-050: count-badge-react-mount demo manifest's overflow rule is a trivially-passing single-element sibling cluster, enforces nothing

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

Deferred by the reviewer, 2026-09-25 second-pass code review on Story 0.43: this manifest is a demo/proof entry, not a real audited component -- a single-member sibling-dimension cluster always passes by definition. Fix when a real future story actually audits CountBadge's overflow behavior; not blocking for Story 0.43 itself. packages/visual-audit/manifests/count-badge-react-mount.ts:61-66.
