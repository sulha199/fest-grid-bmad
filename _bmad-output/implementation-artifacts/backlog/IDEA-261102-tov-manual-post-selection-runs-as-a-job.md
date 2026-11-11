---
backlog_id: IDEA-261102-tov
title: "Manual post selection runs as a job and shows on the Jobs page"
captured: 2026-11-02
---

# IDEA-261102-tov: Manual post selection runs as a job and shows on the Jobs page

## Capture

`selectPostsForExtraction` (`apps/backend/src/schema/resolvers.ts`) checks the user's Gemini key quota and subscriptions, claims each
post atomically (`enqueuePostForProcessing`, `posts.queued_for_extraction_at`, 30-minute TTL) and sends it to the AI queue. It returns
at once, but the user has no way to follow the extraction after leaving the selection screen, and it is not
on the Jobs page. The product owner asked for every long process to be one job type in Epic 10, including this one.

## Where it lives

Epic 10, Story 10.12a (depends on 10.1a, 10.3, 10.4). PRD section 3.10 and FR129.
It stays open through a post's automatic retries (bound 26 hours, AD-52) and counts toward the limit of 3 like every job, because a
post's extraction can re-scrape expired images (AD-51); PRD open item OI-5 covers the cost of that (decided 2026-11-11).
