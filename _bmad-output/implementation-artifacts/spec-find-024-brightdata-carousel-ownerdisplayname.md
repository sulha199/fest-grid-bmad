---
title: 'FIND-024: Bright Data carousel multi-image capture; ownerDisplayName closed as unfixable'
type: 'bugfix'
created: '2026-09-18'
status: 'done'
route: 'one-shot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** FIND-024 flagged two open gaps in the Bright Data scrape path: (a) no confirmed
source field for `ownerDisplayName`, and (b) no carousel/`childPosts`-equivalent multi-image
capture (Bright Data's `photos` array was truncated to `photos[0]`, silently dropping every
other slide of a multi-image post).

**Approach:** Researched both against two real Bright Data run fixtures before touching code.
(a) confirmed unfixable — no candidate field exists anywhere in the ~35-key schema. (b) confirmed
cleanly scoped — Bright Data flattens every carousel slide directly into the same top-level
`photos` array `imageUrl` already reads `photos[0]` from (no nested structure at all, unlike
Apify's `childPosts[]`). Shipped: extract `photos.slice(1)` into `additionalImageUrls`, mirroring
Story 3.3e's Apify field of the same name/shape, and forward it at the `process-brightdata-result.ts`
call site (existing domain type / AJV schema / DB column / persist-layer param all already exist
from 3.3e — this was pure Bright Data wiring, no new infrastructure).

</frozen-after-approval>

## Suggested Review Order

1. [`apps/backend/src/lib/scraper/brightdata-record-mapper.ts`](../../apps/backend/src/lib/scraper/brightdata-record-mapper.ts) — core extraction logic (`additionalImageUrls` from `photos.slice(1)`).
2. [`apps/backend/src/lib/scraper/process-brightdata-result.ts`](../../apps/backend/src/lib/scraper/process-brightdata-result.ts) — one-line forwarding fix to `persistScrapedPost`.
3. [`apps/backend/src/lib/scraper/brightdata-record-mapper.test.ts`](../../apps/backend/src/lib/scraper/brightdata-record-mapper.test.ts) — mapping-level coverage (carousel, non-carousel, malformed entries, content_type independence, large array, duplicate URLs, all-fields-together).
4. [`apps/backend/src/lib/scraper/process-brightdata-result.test.ts`](../../apps/backend/src/lib/scraper/process-brightdata-result.test.ts) — end-to-end persistence coverage.
5. [`_bmad-output/implementation-artifacts/backlog/FIND-024-bright-data-scrape-gaps.md`](backlog/FIND-024-bright-data-scrape-gaps.md) — full research writeup and closure rationale for both gaps.

