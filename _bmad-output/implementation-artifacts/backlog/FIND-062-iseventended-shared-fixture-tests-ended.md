---
backlog_id: FIND-062
title: "isEventEnded shared-fixture tests (ended-cases.ts) fail in any non-UTC time zone"
captured: 2026-10-02
---

# FIND-062: isEventEnded shared-fixture tests (ended-cases.ts) fail in any non-UTC time zone

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

Fixed incidentally during Story 3.20's dev-story run (unrelated repo-wide test-gate failure, fixed per the user's explicit instruction rather than deferred). Pinned TZ: 'UTC' in packages/ui/vitest.config.ts's test.env (FIND-062's own suggested fix) rather than changing isEventEnded's production behavior, which 0-i5d's Dev Notes document as deliberate (mirrors the SQL side's naive/no-timezone-conversion comparison). Confirmed failing before the fix on this machine's local (non-UTC) timezone, passing after.
