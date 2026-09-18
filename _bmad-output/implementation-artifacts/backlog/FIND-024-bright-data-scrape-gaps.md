---
backlog_id: FIND-024
title: "Bright Data scrape path never captures or forwards hashtags (and has no carousel/childPosts equivalent) to persistScrapedPost"
captured: 2026-09-12
---

# FIND-024 — Bright Data scrape path missing hashtags/location/owner fields

## Capture

Found while tracing every `persistScrapedPost(` call site during Story 3.3e's creation, to
confirm where the new `additionalImageUrls` field needed wiring. Two sibling gaps in the same
family, both pre-existing and both left out of 3.3e's scope since it is
Apify/instagram-adapter.ts-only (AC1):

1. `mapBrightDataRecordToScrapedPost` (`apps/backend/src/lib/scraper/brightdata-record-mapper.ts`)
   never reads/maps `hashtags`, `locationName`, `ownerDisplayName`, or `ownerUsername` from
   Bright Data's raw record at all, unlike `instagram-adapter.ts`'s
   `mapApifyItemToScrapedPost`, which captures all four.
2. Even if it did, `process-brightdata-result.ts`'s call to `persistScrapedPost` only forwards
   `content`/`imageUrl`/`videoUrl`/`originalPostUrl`/`locationName`/`ownerDisplayName`/
   `ownerUsername`/`publishedAt`/`scraperActorRunId` — `hashtags` is missing there too (same
   class of gap 3.3e's AC6 fixed for the Apify path, `process-scrape-job.ts`).

Net effect: hashtag search (Sections 3.1/3.7) silently does not work for any post scraped via
Bright Data (Story 3.4a), regardless of whether Bright Data's own dataset actually includes
hashtag data (unconfirmed at capture time — needed checking Bright Data's Instagram Posts
dataset schema, the same way `brightdata-record-mapper.ts`'s existing comment records that
photos/videos/description were confirmed against that schema). Bright Data has no Apify
`childPosts`-equivalent multi-image capture either, so a future Bright Data carousel-image
story would need its own vendor-schema research, not a mechanical port of 3.3e's Apify-specific
logic. Effort `xs` because the hashtags half mirrors 3.3e's own one-line AC6 fix exactly, once
(1)'s mapping gap is closed first.

## Verified, 2026-09-17 (bmad-quick-dev investigation)

BUG-032's user report is a duplicate confirmation of this finding. Apify path is working
correctly (mapper extracts hashtags at `instagram-adapter.ts:256-258`,
`process-scrape-job.ts:36` forwards hashtags, `persistScrapedPost` accepts/persists at
`persist-scraped-post.ts:19,36,92`). Bright Data path is broken as documented: mapper extracts
nothing (`brightdata-record-mapper.ts:63-72`), call site doesn't forward hashtags
(`process-brightdata-result.ts:20-33` missing the `hashtags` parameter). Both issues are
isolated to the Bright Data vendor only. Fix scope: research whether Bright Data's Instagram
Posts dataset schema includes hashtags, extract+lowercase if present, add the `hashtags`
parameter to `process-brightdata-result.ts`'s call. See
`backlog/BUG-032-hashtags-not-persisted-into-post-table.md` for the full code-traced evidence
and fix design.

## Hashtags + location/username fixed, via BUG-032 (2026-09-17, 2 sessions)

Hashtags gap fixed via mapper extraction with `#`-strip + lowercase, `process-brightdata-result.ts`
forwarding, and regression tests. LocationName gap also fixed in the same continuation session:
`brightdata-record-mapper.ts` lines 37-39 extract `location_details.name` with a guard for
missing/populated `location_details` (a real `jogjacoffeeweek` run shows `location_details` can
exist with only `profile_pic_url` set); `ownerUsername` extracted from the top-level
`user_posted` field; both use the conditional-spread pattern (`instagram-adapter.ts:251-253`
precedent). This finding's two of three flagged gaps are now closed.

## Still open

- `ownerDisplayName` — no confirmed source field in Bright Data's schema.
  `tagged_users[].full_name` is not the poster's own display name, only users tagged *in* the
  post.
- No carousel/`childPosts`-equivalent multi-image capture for Bright Data — needs its own
  vendor-schema research, not a mechanical port of 3.3e's Apify-specific logic.
