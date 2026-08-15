# Task 1b — Run 6: apify/instagram-api-scraper - lookupAccountProfile, INVALID handle

Part of [3-4d-per-use-case-actor-selection-and-sync-path-timeout.md](../3-4d-per-use-case-actor-selection-and-sync-path-timeout.md) Task 1b. Part 2 (revised 2026-08-14). This is the run that actually matters -- castVote's whole error path (resolvers.ts:1434) rests on 'if (!lookupResult) throw not-found', which is untested against a real invalid handle until now.

**Expected:** 0 items returned, cleanly -- NOT an unhandled exception, NOT truthy-but-garbage data.

**Input params:** `{"directUrls": ["https://www.instagram.com/pakuwonmall.jogjasfdfdsfsdf/"], "resultsType": "details", "resultsLimit": 1}`

* **Date/Time:** 2026-08-15 16:42
* **Run ID:** [zlqhH8folflKSuGaL](https://console.apify.com/actors/RB9HEZitC8hIUXAha/runs/zlqhH8folflKSuGaL#output)
* **Duration:** 20 s

- Success (Y/N):
- Cost ($):
  * **Result (1):** \$0.0023
  * **Actor start (1):** \$0.001
  * **Search result (0):** \$0.00
  * **Add-on: Date filter (0):** \$0.00
- Items returned (count):
- **Behavior observed** (pick one): [ ] Empty/clean not-found  [ ] Actor-level error/exception  [ ] Returned truthy but garbage/empty-field data  [ ] Other (describe):
- Output (paste full JSON):

```json
[
  {
    "url": "https://www.instagram.com/pakuwonmall.jogjasfdfdsfsdf/",
    "username": "pakuwonmall.jogjasfdfdsfsdf",
    "error": "not_found",
    "errorDescription": "Post does not exist"
  }
]
```
