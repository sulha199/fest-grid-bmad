---
backlog_id: BUG-101
title: "Apify's slide list repeats the cover, so Gemini receives it twice"
captured: 2026-11-02
---

# BUG-101: Apify's slide list repeats the cover, so Gemini receives it twice

## Capture

The Apify adapter maps every `childPosts[].displayUrl` into `additionalImageUrls`, but `childPosts[0]` is the cover. Measured on
prod 2026-11-02: all 354 stored Apify posts with slides have slide 0 equal to the cover (matched on the image file name), against 0 of
629 Bright Data posts. `build-gemini-request.ts` does not de-duplicate, so Gemini gets the cover twice, one of the
`MAX_REEXTRACT_CAROUSEL_IMAGES` slots is spent on it, and the preview's "N of M images" count is off by one.

## Fix

Drop the first child when it equals the cover in the adapter (the source fix lands in Story 10.2's chain), and compare by file name
at read time in `build-gemini-request.ts` so already-stored rows are covered without a backfill.
