---
backlog_id: BUG-032
title: "Hashtags not persisted into the posts table (investigate & fix)"
captured: 2026-09-15
---

# BUG-032 — Hashtags not persisted into the posts table

## Capture

User report via `bmad-help` (2026-09-15). Scraped posts' hashtags are not being
persisted into the `posts` table. Task: investigate the root cause and fix it.

## Related sibling

`FIND-024` already documents that the **Bright Data** path never captures or
forwards hashtags to `persistScrapedPost`:

- `apps/backend/src/lib/scraper/brightdata-record-mapper.ts` —
  `mapBrightDataRecordToScrapedPost` never reads/maps `hashtags` at all.
- `apps/backend/src/lib/scraper/process-brightdata-result.ts` — its call to
  `persistScrapedPost` forwards content/imageUrl/videoUrl/originalPostUrl/
  locationName/ownerDisplayName/ownerUsername/publishedAt/scraperActorRunId but
  **not** hashtags.

Before scoping BUG-032, verify whether this report is the same root cause
(Bright Data path) or a separate persistence gap on the Apify path
(`instagram-adapter.ts` / `process-scrape-job.ts` — which FIND-024 notes does
capture hashtags, so the persistence layer itself needs checking there too).

## Fix expectation

Once root cause is confirmed, land the persistence fix plus a regression test so
hashtag search / hashtag display (see IDEA-030 item 3) has data to render.
