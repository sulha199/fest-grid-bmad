---
backlog_id: IDEA-261102-tov
title: "Manual post selection runs as a job and shows on the Jobs page"
captured: 2026-11-02
---

# IDEA-261102-tov: Manual post selection runs as a job and shows on the Jobs page

## Capture

`selectPostsForExtraction` (`apps/backend/src/schema/resolvers.ts`) checks the user's Gemini key quota and subscriptions, claims each
post atomically (`enqueuePostForProcessing`, `posts.queued_for_extraction_at`, 30-minute TTL) and sends it to the AI queue. It returns
at once and makes no vendor call, but the user has no way to follow the extraction after leaving the selection screen, and it is not
on the Jobs page. The product owner asked for every long process to be one job type in Epic 10, including this one.

## Where it lives

Epic 10, Story 10.12a (depends on 10.1a, 10.3, 10.4). PRD section 3.10 and FR129. It is the one job type that makes no vendor call,
so it counts against `MAX_CONCURRENT_EXTRACTION_JOBS_PER_USER` (default 2) and not against the vendor limit of 3 (FR121).
