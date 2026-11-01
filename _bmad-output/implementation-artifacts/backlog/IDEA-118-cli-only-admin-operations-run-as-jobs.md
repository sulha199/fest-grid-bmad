---
backlog_id: IDEA-118
title: "Long admin operations that are CLI-only today run as moderator-visible jobs"
captured: 2026-11-02
---

# IDEA-118: Long admin operations that are CLI-only today run as moderator-visible jobs

## Capture

These operations need a developer with a shell today and have a dry-run then apply shape: the event dedup drain
(`drain-event-match-backlog.ts`, about 15 minutes for 299 rows), `expire-stale-match-suggestions.ts`, replaying late Bright Data
snapshots (`replay-late-brightdata-snapshots.ts`), and the backfills of post media keys, thumbnails and legacy slugs. Moderator
payload reprocessing (BUG-014) is the one that is a moderator feature but unbuilt.

## Decide per operation

Move it (dry run and apply as two job phases; writer credentials stay in the worker's secret) or record that it stays a CLI with the
reason. Do not move all of them blindly.

## Where it lives

Epic 10, Story 10.12 (depends on 10.1a, 10.4).
