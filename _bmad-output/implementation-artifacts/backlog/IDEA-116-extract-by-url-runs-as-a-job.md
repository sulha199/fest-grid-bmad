---
backlog_id: IDEA-116
title: "Extract-by-URL runs as a job instead of inside the 28-second request"
captured: 2026-11-02
---

# IDEA-116: Extract-by-URL runs as a job instead of inside the 28-second request

## Capture

`extractEventDataFromUrl` (`apps/backend/src/schema/resolvers.ts`, around line 1677) scrapes the URL and calls Gemini inside the API
Lambda's 28 s limit, and calls `getScraperAdapter` outside its inner try, so a missing adapter (BUG-100) surfaces as an unhandled
error. Moving it onto the engine and the post-scraper chain removes the limit and gives it failover.

## Where it lives

Epic 10, Story 10.10 (depends on 10.1a, 10.2, 10.4).
