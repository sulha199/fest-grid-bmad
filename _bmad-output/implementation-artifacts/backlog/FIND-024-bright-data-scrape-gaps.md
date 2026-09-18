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

## Carousel multi-image capture fixed; ownerDisplayName confirmed unfixable (2026-09-18, bmad-quick-dev)

**ownerDisplayName — confirmed unfixable, closing this half of the finding.** Every top-level
field on both real run examples (`brightdata-run-examples/`, ~35 keys each) was enumerated by
hand: `user_posted` (username), `user_posted_id`, `profile_url`, `profile_image_link`,
`followers`, `posts_count`, `is_verified`, `partnership_details` (all-null in both samples),
`coauthor_producers`, `tagged_users[].full_name` (people/brands tagged *in* the post, not the
poster). None represents the account's own display name distinct from its username. No further
action possible without a different Bright Data dataset/API tier exposing that field — nothing
left to implement here.

**Carousel/multi-image capture — fixed.** Vendor-schema research against the two real run
fixtures on hand (`slemancityhall` and `diamondprofessionalid`/`jogjacoffeeweek`, 9 carousel
records total between them) found no evidence of an Apify-`childPosts`-equivalent nested
structure: every `content_type: "Carousel"` record instead lists every slide's URL directly
in the same top-level `photos` array the mapper already reads `photos[0]` from for `imageUrl`
(counts of 2, 4, 5, 6, 9, 11, 18 photos observed). This is based on two accounts' historical
scrape output, not a documented Bright Data API contract — if a future run surfaces a different
shape (e.g. a nested carousel-item structure on some other content type), that would need its
own follow-up. The extraction itself does not gate on `content_type` at all (deliberately —
see the mapper's inline comment and the dedicated test proving independence from that field);
it keys purely on `photos.length > 1`, which is simpler and doesn't depend on `content_type`
being present or correctly labeled.

Known limitation carried over from `persistScrapedPost`'s existing insert-only behavior
(`onConflictDoNothing`, established by Story 3.3e for `additionalImageUrls` specifically): a
post already persisted before this fix shipped will not be backfilled with its carousel slides
on a later re-scrape of the same `postUrl` — only newly-inserted posts get this data. This
matches the same limitation the Apify path already accepted for this exact field; not new to
this fix.

Fix shipped: `mapBrightDataRecordToScrapedPost` (`brightdata-record-mapper.ts`) now extracts
`photos.slice(1)` (string entries only, defensively filtered) into `additionalImageUrls: string[]`
— mirroring Story 3.3e's Apify field of the identical name/shape — and `process-brightdata-result.ts`
forwards it to `persistScrapedPost` (same class of gap BUG-032 fixed for `hashtags` on this call
site). No new schema/type/DB work was needed: `ScrapedPost`, `scrapedPostSchema`,
`PersistScrapedPostParams`, and the `posts.additional_image_urls` column all already exist from
3.3e; this was purely wiring the Bright Data vendor path into infrastructure that was already
generic across vendors. 6 new tests added (4 mapper-level, 2 end-to-end), all passing; `tsc
--noEmit` clean; lint clean (0 errors, pre-existing warnings only).

Both of FIND-024's remaining gaps are now closed — one via a working fix, the other via
confirmed research showing no fix is currently possible.
