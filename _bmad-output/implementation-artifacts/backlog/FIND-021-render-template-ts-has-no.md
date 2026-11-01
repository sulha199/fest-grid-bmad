---
backlog_id: FIND-021
title: "render-template.ts has no HTML-escaping; scraper-sourced content flows unescaped into moderator alert emails"
captured: 2026-09-05
---

# FIND-021: render-template.ts has no HTML-escaping; scraper-sourced content flows unescaped into moderator alert emails

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

Deferred from: quick-dev fix of scraper-audit-trail-alerting (2026-09-05). Pre-existing gap in the shared render engine, already reachable via existing templates (e.g. DANGEROUS_EVENT_MODERATOR_ALERT's eventName); this pass's new SCRAPER_AUDIT_TRAIL_FAILURE_ALERT template is a new consumer of scraper-influenced fields (postUrl, raw DB error text) routed through it.
