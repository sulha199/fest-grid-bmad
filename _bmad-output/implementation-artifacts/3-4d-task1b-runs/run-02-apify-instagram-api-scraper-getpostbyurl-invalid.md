# Task 1b — Run 2: apify/instagram-api-scraper - getPostByUrl, INVALID post URL

Part of [3-4d-per-use-case-actor-selection-and-sync-path-timeout.md](../3-4d-per-use-case-actor-selection-and-sync-path-timeout.md) Task 1b. Part 1 (revised 2026-08-14). This is the run that actually matters -- resolvers.ts:993-994's 'if (!scrapedPost) return SCRAPE_FAILED' depends on this actor cleanly returning empty/null for a nonexistent post, not throwing or hanging.

**Expected:** 0 items returned, cleanly -- NOT an unhandled exception, NOT truthy-but-garbage data.

**Input params:** `{"directUrls": ["https://www.instagram.com/p/ZZZZZZZZZZZ/"], "resultsType": "posts", "resultsLimit": 1}`

* **Date/Time:** 2026-08-15 16:30:47
* **Run ID:** [tpKVTiJPmq7amit9A](https://console.apify.com/actors/RB9HEZitC8hIUXAha/runs/tpKVTiJPmq7amit9A#output)
* **Duration:** 1 m 1 s

- Success (Y/N): Y
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
    "url": "https://www.instagram.com/p/ZZZZZZZZZZZ/",
    "username": "p",
    "error": "not_found",
    "errorDescription": "Post does not exist"
  }
]
```
