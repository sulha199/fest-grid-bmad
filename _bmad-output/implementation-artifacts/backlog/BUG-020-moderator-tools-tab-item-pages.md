---
backlog_id: BUG-020
title: "Moderator tools tab-item pages lack previous-page navigation and total/page info in their simple pagination"
captured: 2026-09-07
---

# BUG-020: Moderator tools tab-item pages lack previous-page navigation and total/page info in their simple pagination

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

Reported by user on event-list-bug-fixes-pagination branch. Affected pages: apps/web/src/app/[locale]/moderator/tools/unprocessed-payloads-content.tsx, actor-runs-content.tsx, and moderator-accounts-content.tsx. All three use cursor-based pagination but only render a single 'Load more' button (hasNextPage) with no way to go back to the previous page, and they do not surface totalCount or any 'current page' indicator. Fix should add a prev-page control alongside next, and display totalCount + current page info so moderators can orient themselves in the result set.
