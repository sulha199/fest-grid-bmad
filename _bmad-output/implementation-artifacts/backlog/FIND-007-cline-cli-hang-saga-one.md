---
backlog_id: FIND-007
title: "cline-cli hang saga: one root cause fixed and verified, later recurrences still unexplained"
captured: 2026-09-05
---

# FIND-007: cline-cli hang saga: one root cause fixed and verified, later recurrences still unexplained

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

DW-002, DW-004, DW-007 (chronological order is 007, then 004, then 002). DW-007's stale-hub-manifest fix was verified working at the time; DW-004's batch-10 and DW-002's batch-11 hangs are separate, later, still-unexplained recurrences. 2026-09-14 (bmad-quick-dev, 'documented'): record-consolidation half completed via docs/infrastructure/incidents/2026-09-01-cline-cli-hang-saga.md (commit 2c0aa58); later recurrences still unexplained, so no speculative fix attempted. The SDK act-path runner already has an idle watchdog + logging; CLI-path --timeout gap and a hang-detection heartbeat are recorded there for the next recurrence, deliberately not wired into live mailbox-runner tooling.
