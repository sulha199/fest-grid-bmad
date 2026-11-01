---
backlog_id: FIND-119
title: "A rescrape failure that spent no vendor credit still starts the 10-minute cooldown"
captured: 2026-11-02
---

# FIND-119: A rescrape failure that spent no vendor credit still starts the 10-minute cooldown

## Capture

`startPostReextractionPreview` writes a FAILED job (`recordFailedRescrape`) for any throw, including ones that happen before a vendor
call (no adapter registered, capacity exhausted, the DPA gate). That row starts the per-URL 10-minute cooldown, so on 2026-10-31 the
moderator's retry 20 s later (`6b7d2757`) was refused for no reason and fell back to the stored, expired links.

## Fix

Record the failure only when a vendor call actually started. Story 10.3 carries the same rule for the engine's cooldown.
