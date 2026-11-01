---
backlog_id: BUG-098
title: "A new subscription scrapes the last 7 days, and a profile known only as a co-author skips its history"
captured: 2026-10-31
---

# BUG-098: A new subscription scrapes the last 7 days, and a profile known only as a co-author skips its history

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

Found 2026-10-31: the first scrape was a 7-day window (biliardindonesia, 3,073 posts, gave 1), and 1,020 unsubscribed profiles hold co-authored posts that would have moved their cursor past their own history. Fixed: seeding scrape = newest 30 posts, none older than 30 days, until history_seeded_at is set; migration 0088 backfills it from last_scraped_at.
