---
backlog_id: IDEA-105
title: "Back off a profile's scrape after an empty run using its posting cadence (median gap between posting days)"
captured: 2026-10-31
---

# IDEA-105: Back off a profile's scrape after an empty run using its posting cadence (median gap between posting days)

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

E3-E4 of the seeding design, depends on BUG-098 and IDEA-104 (needs new_posts per run). Interval after an empty run = clamp(ceil(typical gap), 1, 3) days, never off, daily when confidence is insufficient. Backtest: 4% fewer scrapes, 1.3% of posts one day late; savings are cents, so repeat the backtest on 30 days of real data first. Built in the PR stacked on #130 (decision: cap 3 days, multiplier 1, SCRAPE_BACKOFF_MAX_DAYS=1 disables). Real-run check before building: on 10-29 and 10-31, 26% of Bright Data runs (10 of 38) found no new post (6 re-delivered only known posts, 3-4 delivered nothing). Not recorded for the SQS path, so a profile whose last run was a queue run stays daily.
