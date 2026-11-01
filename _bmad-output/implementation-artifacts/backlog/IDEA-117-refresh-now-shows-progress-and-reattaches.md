---
backlog_id: IDEA-117
title: "\"Refresh now\" for a subscribed account shows progress and re-attaches instead of scraping twice"
captured: 2026-11-02
---

# IDEA-117: "Refresh now" for a subscribed account shows progress and re-attaches instead of scraping twice

## Capture

`triggerAccountScrape` (`apps/backend/src/lib/scraper/trigger-scrape-for-account.ts`) enqueues a scrape job on the SQS queue and the
user sees nothing after that; a second click enqueues a second scrape. A job linked to the queued run gives progress and the
re-attach rule.

## Where it lives

Epic 10, Story 10.11 (depends on 10.1a, 10.3, 10.4).
