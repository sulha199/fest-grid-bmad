---
backlog_id: FIND-020
title: "Scraper audit-trail alert lacks throttling/dedup, duplicates an existing moderator-notify pattern, and depends on the same DB it may be reporting on"
captured: 2026-09-05
---

# FIND-020: Scraper audit-trail alert lacks throttling/dedup, duplicates an existing moderator-notify pattern, and depends on the same DB it may be reporting on

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

Deferred from: quick-dev fix of scraper-audit-trail-alerting (2026-09-05). 5 findings (excludes the HTML-escaping finding, tracked separately as FIND-021 per its user-visible impact). Triaged 2026-09-18 alongside FIND-034 (same scraper/infra-reliability neighborhood). Deferred from: bmad-quick-dev BUG-015,FIND-020 intent (2026-09-18) -- split from a combined BUG-015+FIND-020 quick-dev pass (multi-goal check), user chose to do BUG-015 first since it was the live risk; this row's own scope (DB-persisted cooldown + getModeratorEmails() dedup reuse) is unchanged, still pending its own dispatch.
