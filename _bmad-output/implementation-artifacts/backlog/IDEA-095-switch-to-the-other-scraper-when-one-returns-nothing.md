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

## Built, 2026-10-22 (hotfix cut from `master`; commits `8f8e0455`, `dba05bcc`, `5f72e7da`, `5d3a8634`)

Built as part of the BUG-074 hotfix (see that file's "Fixed" section and AD-43). Against "What is missing":

| Item | Result |
|---|---|
| 1. A result-level health signal per provider | **Built, as a derived signal.** `evaluateProviderRunHealth` (domain, 100 % covered) over the newest 20 finished `scraper_actor_runs` of a vendor, runs from the last 72 h, at least 10 of them. Degraded = >= 80 % failed (`VENDOR_FAILURE`) or no post at all (`ALL_EMPTY`). *Deviation:* a sliding sample, not "per day". No table of its own. |
| 2. A switch to the other provider | **Built.** A degraded provider is skipped with `PROVIDER_DEGRADED` in both trigger functions, so the existing chains (batch: Bright Data, Apify, SQS; on-demand: Apify, Bright Data, SQS) fall through. A failed Bright Data run re-queues its profile to the SQS scrape path (behind the AD-34 gate and the Apify budget guard), which reads from the profile's own newest stored post. |
| 3. A way back | **Built, simplified.** A degraded provider gets 3 probe triggers per 6 h per process (a failed probe gives its slot back); a probe's own result clears it (a run with posts clears any degradation; a run the vendor did not fail clears a failure-based one). *Deviation:* the probes are ordinary targets, not one known canary account, and the claim is in process memory. Carried by **IDEA-097**. |
| 4. An alert at the first switch and at the return, with the cost note | **Partly.** The switch and the recovery are logged (`[Provider failover]`); a degraded day counts toward the existing provider-down e-mail (threshold 2 days, so a first alert about day 3). **No notification reaches a human in production** (SES, BUG-073). The Apify cost note is not in the alert text. Carried by **IDEA-096**. |
| 5. A manual override (provider order or a pause switch) | **Not built.** `BRIGHTDATA_SCRAPING_CONFIRMED=false` is a de-facto pause but needs a deploy and misuses a compliance flag. Carried by **IDEA-097**. |

"Open" items, answered: thresholds are provisional constants (20 / 10 / 0.8 / 72 h / 3 probes / 6 h); the provider order is still
encoded in two places (a route resolver is IDEA-097); the Apify budget is unchanged, and the async gate counts triggers, not items,
so it does not bound failover spend (**BUG-079**).
