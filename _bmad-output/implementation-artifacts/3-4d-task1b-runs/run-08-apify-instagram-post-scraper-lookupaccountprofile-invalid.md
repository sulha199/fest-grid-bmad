# Task 1b — Run 8: apify/instagram-post-scraper - lookupAccountProfile, INVALID handle

Part of [3-4d-per-use-case-actor-selection-and-sync-path-timeout.md](../3-4d-per-use-case-actor-selection-and-sync-path-timeout.md) Task 1b. Part 2 (revised 2026-08-14). This is the run that actually matters -- same reasoning as Run 6, for this actor instead. Since it has no dedicated details mode, worth checking whether not-found is distinguishable from a generic scrape error.

**Expected:** 0 items returned, cleanly -- NOT an unhandled exception, NOT truthy-but-garbage data.

**Input params:** `{"username": ["https://www.instagram.com/pakuwonmall.jogjasfdfdsfsdf/"], "resultsLimit": 1, "dataDetailLevel": "basicData"}`

* **Date/Time:** 2026-08-15 16:39:33
* **Run ID:** [fobl1WOCjypEINLoS](https://console.apify.com/actors/nH2AHrwxeTRJoN5hX/runs/fobl1WOCjypEINLoS#output)
* **Duration:** 10 s

- Success (Y/N):
- Cost ($):
  * **Post (1):** \$0.0017
  * **Post details (0):** \$0.00
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
