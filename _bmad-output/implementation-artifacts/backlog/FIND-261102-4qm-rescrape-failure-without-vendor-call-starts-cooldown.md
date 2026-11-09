---
backlog_id: FIND-261102-4qm
title: "A rescrape failure that spent no vendor credit still starts the 10-minute cooldown"
captured: 2026-11-02
---

# FIND-261102-4qm: A rescrape failure that spent no vendor credit still starts the 10-minute cooldown

## Capture

`startPostReextractionPreview` writes a FAILED job (`recordFailedRescrape`) for any throw, including ones that happen before a vendor
call (no adapter registered, capacity exhausted, the DPA gate). That row starts the per-URL 10-minute cooldown, so on 2026-10-31 the
moderator's retry 20 s later (`6b7d2757`) was refused for no reason and fell back to the stored, expired links.

## Fix

Record the failure only when a vendor call actually started. Story 10.3 carries the same rule for the engine's cooldown.

## Outcome

Fixed in PR 184, merged 2026-11-09 (it replaced PR 181 after code review). The API Lambda sets no Apify audit context, so Apify's raw 402 memory-cap refusal reached the cooldown check as a plain `Error`; `normalizeApifyError` now types it, and two tests run the real adapter against a real 402. Left open as FIND-261109-u8q: Twitter/X.
