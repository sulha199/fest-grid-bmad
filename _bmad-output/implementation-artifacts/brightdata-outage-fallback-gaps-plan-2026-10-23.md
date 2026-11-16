# Bright Data outage: why the Apify fallback did not save the scrape (investigation + fix plan)

Date: 2026-10-23. Based on GitHub `master` @ `95bef1c0` (read from the remote, not the stale local tracking ref), prod `scraper_actor_runs` / `scraper_batch_runs` / `scraper_provider_*` (read-only), and the prod Scraper Lambda CloudWatch logs for the 03:13 UTC batch.

## 1. What is actually happening

**Bright Data is still down.** Since the 2026-10-21 batch, every Bright Data run returns zero records ("No records found. The data may not be available or has changed."). Today's three probe runs failed the same way. The same accounts return posts on Apify the same hour (`infoeventjogja` 13 items, `jogjaexpocenter` 6 items), so this is the vendor (or our BD account), not "nothing new". Our Bright Data request shape is unchanged since 2026-10-15 (`brightdata-client.ts` not touched), so a payload regression is unlikely but should be ruled out with a direct API call (see item E).

**The Apify fallback was missing on 10-21 and 10-22, and is only half working on 10-23.**

| Batch (03:13 UTC) | Code | What happened |
|---|---|---|
| 10-21, 10-22 | pre-hotfix | BD accepted all 38 triggers each day, returned `ready` with 0 records, which was recorded `SUCCEEDED`. Apify was only a fallback for a failed *trigger*, so nothing fell over. **Zero posts ingested on both days.** |
| 10-23 | hotfix deployed 10-22 12:51 UTC (PR #92, BUG-074 / IDEA-095) | The hotfix worked: BD flagged degraded (`ALL_EMPTY: 20 empty of last 20`), 3 probes sent, 35 targets routed on, probe results recorded `FAILED` and each re-queued. 246 posts ingested (catch-up). But the Apify side then failed in two ways below. |

### Gap A (P0): Apify async triggers rejected 402 `actor-memory-limit-exceeded`
`apps/backend/src/lambdas/scraper.ts` fires all 38 targets at once (`Promise.allSettled(targets.map(...))`). With Bright Data skipped, 35 targets hit `attemptApifyAsyncTrigger` at the same instant. Apify's account concurrent-memory cap fit about 4; **31 got HTTP 402 `actor-memory-limit-exceeded`**, logged 31 full stack traces, were classed `TRIGGER_ERROR` (a "real outage" reason), and fell to the SQS queue.

### Gap B (P0): the SQS fallback silently drops accounts when the Apify call exceeds 26s
The queue path (`processScrapeJob` -> `InstagramAdapter.getNewestPosts` -> `callApifyActor`) uses `APIFY_CALL_TIMEOUT_MS = 26_000`, a value sized for the API Lambda's 28s hard limit (`instagram-adapter.ts` ~L225). The scraper Lambda has a 300s limit but inherits the same 26s. Today **11 distinct profiles** (gik_pjs, infokonser, konserindonesia_, laridijogja, lippoplazajogja_official, lomba_jogjakarta, masjidjogokariyan, masjidmuhajirinnitikan, pakuwonmall.jogja, visitingjogja, wisatasleman) hit `VendorCallTimeoutError: Vendor call timed out after 26000ms`. Consequences:
- `processScrapeJob` catches and does not rethrow (AC7), then its `finally` **stamps `lastScrapedAt` anyway**, so the account looks freshly scraped.
- The audit row (`recordSyncActorRun`) is written only *after* a successful call, so a timeout leaves **no `scraper_actor_runs` row** (prod: 0 runs for those profiles today). Provider health and the audit trail never see the failure.
- The Apify actor run is not known to be aborted on timeout, so it may keep running (and billing) with its output discarded.
- These accounts are retried only by tomorrow's batch.

### Gap C (P1): scraper Lambda is at the 128 MB default
`festgrid-backend-stack.ts` `scraperLambda` sets timeout 300s but no `memorySize` (`sharedLambdaProps` has none), so it is 128 MB. CloudWatch REPORT lines for 10-23 show Max Memory Used 124-128 MB on every invocation, and two drain invocations ran the full 300,000 ms. CPU scales with memory, so this likely adds to the 26s timeouts and risks OOM.

### Gap D (P2): the batch metrics and alerts mislabel a healthy fallback
`scraper_batch_runs` for 10-23 reads `dispatched_succeeded=7, dispatched_failed=31`, but all 31 were successfully enqueued to SQS. Apify's tally also counts the 402s as `TRIGGER_ERROR`. Anyone reading these sees an Apify outage that is really a concurrency cap, and the real problem (Gap B, 11 silent drops) shows in neither number.

## 2. Work items for the implementing session

Work on a feature branch off `master`, TDD, follow `_bmad-output/project-context.md` and the PRD (`_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md`). Do not merge or deploy; open a PR for review. Backlog rows: read `_bmad-output/backlog/backlog-spec.md` and add BUG rows with the next free IDs (do not guess numbers).

**A. Bound Apify async trigger concurrency and classify 402 properly**
- In `lambdas/scraper.ts` (and check `trigger-scrape-for-account.ts` for the same pattern), cap concurrent triggers (small semaphore, `SCRAPE_TRIGGER_CONCURRENCY` env, default 3). Do not add a dependency if a 15-line helper does it.
- Verify against Apify docs whether `actor.start(input, { memory })` can lower per-run memory for `apify/instagram-api-scraper`; if it is safe, set it. If you cannot verify the minimum memory, leave it out and say so.
- Map `ApifyApiError` type `actor-memory-limit-exceeded` (status 402) to `CAPACITY_EXHAUSTED` (extend `ScraperTriggerFailureReason` only if needed), log one line instead of a stack trace, and make sure it releases a probe slot like other pre-vendor failures.
- Tests: a batch of N targets never exceeds the cap; a 402 yields `CAPACITY_EXHAUSTED` and still falls to SQS.

**B. Stop the silent drop on the queue path**
- Make the sync Apify timeout a parameter: keep 26s for API-Lambda callers, give the scraper-Lambda queue path a budget that fits its 300s / poll-and-drain design (propose a value, e.g. 120s, as a named constant or env; check `pollAndDrainQueue`'s 270s budget and SQS visibility timeout so a long call cannot cause duplicate delivery).
- On any failure in `processScrapeJob`: record a `FAILED` / `TIMED_OUT` sync audit row (so `getProviderRunHealth` sees it), and **do not stamp `lastScrapedAt`** (only a completed scrape stamps it). Decide whether to rethrow so SQS retries; if yes, confirm `maxReceiveCount`, the DLQ and visibility timeout in `festgrid-backend-stack.ts` so a hung account cannot loop on paid Apify runs. State the decision and cost bound in the PR.
- Check whether the Apify run is aborted when `callWithTimeout` fires; if not, abort it (or document why not).
- Tests: timeout leaves an audit row and no `lastScrapedAt` stamp; success path unchanged; the API-Lambda callers keep 26s.

**C. Raise scraper Lambda memory**
- Set an explicit `memorySize` on `scraperLambda` only (512 MB is the proposal; justify), CDK stack test updated. Note in the PR that CPU scales with memory. Update `docs/infrastructure/architecture-diagram.md` only if CLAUDE.md section 4 requires it for this change (it does not for a memory bump; say so).

**D. Honest batch accounting**
- Distinguish "queued to SQS" from "failed" in `completeScraperBatchRun` / `scraper_batch_runs` (new column needs a Drizzle migration under the repo's migration rules; if that is too heavy, log it and propose the column in the PR instead). Make sure the Apify provider-health tally does not treat 402/queue-fallback as an outage.
- Check what the new CloudWatch alarms from PR #95 (IDEA-096) cover. If nothing alarms on "zero new posts ingested in 24h" or "all of a provider's runs returned zero items", propose that alarm in the PR description (two silent days is the real detection gap).

**E. Bright Data root cause (needs the owner, not the cloud session)**
- Cloud session: add `apps/backend/scripts/debug-brightdata.ts` modelled on `scripts/debug-apify.ts` that triggers one snapshot for a given Instagram URL with and without `startDate` and prints the progress report, so the owner can run it with their token. Do not call Bright Data from the cloud session (no credentials there).
- Owner: check Bright Data dashboard (balance / account status / dataset `gd_lk5ns7kz21pck8jpis` status), run the script, open a vendor ticket if it still returns "No records found".

## 3. Not in scope / already handled
- The 11 dropped accounts need no manual action: tomorrow's 03:13 UTC batch re-includes them (`lastScrapedAt` older than `SCRAPE_SKIP_RECENT_HOURS=12`). After Gap B ships, optionally re-queue them.
- Provider degradation, probing, result classification and failed-run re-queue already exist (PR #92). Do not rebuild them.
- Twin profile rows (BUG-059) inflate some counts here (14 rows for 11 accounts); do not touch.

## 4. Evidence (for the PR description)
- Prod `scraper_actor_runs`, 10-21 and 10-22: 38 BRIGHTDATA `SUCCEEDED` runs per day, 0 items; 0 posts created on those days. 10-23: 3 BRIGHTDATA `FAILED`, 4 APIFY ASYNC, 25 APIFY SYNC `SUCCEEDED`.
- Scraper Lambda log group `/aws/lambda/FestgridBackendStack-prod-ScraperLambdaprodF94C650-iMFmm3gJwPEO`, 2026-10-23 03:13:38-03:13:58 UTC: 31x `actor-memory-limit-exceeded` (402) from `attemptApifyAsyncTrigger`; 03:18-03:30 UTC: 11x `VendorCallTimeoutError ... 26000ms` from `processScrapeJob`.
- Lambda config: MemorySize 128, Timeout 300.
