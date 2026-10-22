---
backlog_id: IDEA-095
title: "Switch to Apify when Bright Data returns nothing (and back), instead of only when a trigger fails"
captured: 2026-10-22
---

# IDEA-095: fail over between scrapers on empty results (2026-10-22)

Follow-up to the Bright Data outage of 2026-10-21 (BUG-074). The two scrapers are already wired in as a chain, but the chain only reacts to a **trigger** that fails; a scrape that triggers fine and returns nothing is invisible to it.

## What exists

* `lib/scraper/trigger-scrape-for-account.ts`: Apify async trigger first, then Bright Data (Instagram only), then the SQS queue. A tier is skipped when its trigger returns `success: false`, e.g. `CAPACITY_EXHAUSTED` from `isProviderCapacityAvailable` (a monthly budget ratio per provider).
* `lib/scraper/scraper-provider-health-store.ts`: counts consecutive "full failure days" (no trigger of a provider succeeded) and alerts after a threshold. An all-empty day is not a failure day.
* Both webhooks (`lambdas/webhook.ts`, `lambdas/apify-webhook.ts`) record every finished run as `SUCCEEDED`.
* The vendors' prices differ: Bright Data about $1.50 per 1,000 records (the POC script's default, the owner's rate to confirm), Apify $0.0023 per result on the FREE plan with a $5 monthly cap shared with production.

## What is missing

1. A result-level health signal: per provider and day, the share of runs classified `vendor_failure` (BUG-074 section 5, Apify counterpart BUG-075).
2. A switch: when a provider's day is mostly `vendor_failure` (threshold to confirm, e.g. at least 10 runs and 80 %), route new triggers to the other provider until it recovers, and re-scrape the failed profiles from the post-based cursor so nothing in the gap is skipped.
3. A way back: probe the failed provider with a small scrape (one known account, a few posts) on a schedule and clear the flag after it returns data.
4. An alert at the first switch and at the return (needs the BUG-073 e-mail/push path), including the cost note: Apify's FREE cap is $5 a month, so a full-fleet failover for several days can exhaust it (38 profiles x 10 posts x about 1 run a day is about $0.87 a day at $0.0023).
5. A manual override the owner can set (provider order or a "pause provider" switch) without a deploy.

## Open

The failover thresholds and the Apify budget (upgrade the plan or raise `monthlyBudgetUsd`); whether Apify should stay first in the order given its cap; whether the provider order should live in config or in a table.
