# Task 1b — Run 4: apify/instagram-post-scraper - getPostByUrl, INVALID post URL

Part of [3-4d-per-use-case-actor-selection-and-sync-path-timeout.md](../3-4d-per-use-case-actor-selection-and-sync-path-timeout.md) Task 1b. Part 1 (revised 2026-08-14). This is the run that actually matters -- same reasoning as Run 2, for this actor instead.

**Expected:** 0 items returned, cleanly -- NOT an unhandled exception, NOT truthy-but-garbage data.

**Input params:** `{"username": ["https://www.instagram.com/p/ZZZZZZZZZZZ/"], "dataDetailLevel": "basicData"}`

* **Date/Time:** 2026-08-15 16:35:30
* **Run ID:** [mbyk7AyffKl4q4UgW](https://console.apify.com/actors/nH2AHrwxeTRJoN5hX/runs/mbyk7AyffKl4q4UgW#output)
* **Duration:** 1 m 5 s

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
    "url": "https://www.instagram.com/p/ZZZZZZZZZZZ/",
    "username": "p",
    "error": "not_found",
    "errorDescription": "Post does not exist"
  }
]
```
