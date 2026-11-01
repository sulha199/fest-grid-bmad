---
backlog_id: IDEA-104
title: "Store each Bright Data run's records, errors, error codes and new-post count, and classify its success rate"
captured: 2026-10-31
---

# IDEA-104: Store each Bright Data run's records, errors, error codes and new-post count, and classify its success rate

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

D1-D3 of the yield design: a separate classifyBrightDataYield (complete / partial-expected / partial-retryable / partial-unknown), read the free progress call after the posts are saved. No retry mechanism until a transient error code is observed (371 snapshots: only dead_page, 44 of 44). Built in PR #130 (stacked on #129): classifyBrightDataYield, scraper_actor_runs.records_reported / errors_reported / error_codes / new_posts (migration 0089), reportBrightDataYield in the webhook and the sweep, new_posts for Bright Data and Apify async deliveries. The SQS path does not record new_posts yet.
