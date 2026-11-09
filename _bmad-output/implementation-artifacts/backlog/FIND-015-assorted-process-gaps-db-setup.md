---
backlog_id: FIND-015
title: "Assorted process gaps: DB setup docs, an irreversible enum migration, disabled lint gate"
captured: 2026-09-05
---

# FIND-015: Assorted process gaps: DB setup docs, an irreversible enum migration, disabled lint gate

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

DW-042 (vague local Postgres setup), DW-051 (first ALTER TYPE ADD VALUE migration in the repo; Postgres has no DROP VALUE, no process doc flags the one-way-door risk), DW-052 (historical diff-hygiene note, not re-checkable), DW-058 (apps/backend's lint script dropped --max-warnings 0 against 868 pre-existing warnings).
