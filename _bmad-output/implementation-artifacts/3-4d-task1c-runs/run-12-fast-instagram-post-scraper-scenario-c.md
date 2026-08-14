# Task 1c — Run 12: instagram-scraper/fast-instagram-post-scraper — Scenario C (zero-boundary)

Part of [3-4d-per-use-case-actor-selection-and-sync-path-timeout.md](../3-4d-per-use-case-actor-selection-and-sync-path-timeout.md) Task 1c. Expected: 0 items, ~$0 cost. Any items back — especially matching one of the 3 known pinned timestamps (`2026-08-01T03:58:43Z`, `2026-08-04T05:21:00Z`, `2026-08-04T14:07:36Z`) — would reveal the same pinned-post bug already confirmed for `apify/instagram-api-scraper`.

Tomorrow relative to the account's known activity (posts confirmed as recent as `2026-08-14T07:54:42Z` per Run 8) → `2026-08-15`. Date-only granularity means this is a coarser test than Runs 3/6/9's precise `T+1s` — it can't catch a post made later today, only confirm nothing from a full day ahead leaks through. **Given findings #5 and #6, don't be surprised by a nonzero result here either** — check for the 3 known pinned timestamps (`2026-08-01T03:58:43Z`, `2026-08-04T05:21:00Z`, `2026-08-04T14:07:36Z`) and for any `is_newer_than_cutoff`-style field (or equivalent) on returned items, same as Run 9.

**Input params:** `{"instagramUsernames": ["pakuwonmall.jogja"], "postsPerProfile": 15, "recent": "2026-08-15", "retries": 3}`

* **Date/Time:** 2026-08-14 15:21:28
* **Run ID:** [ocs3ZEFAgJEW3SC4h](https://console.apify.com/actors/Gv87i5PtUqPlLcM2W/runs/ocs3ZEFAgJEW3SC4h#output)
* **Duration:** 5 s
* Cost ($):
  *
  * **result (0):** \$0.00
  * **Processing Fee (Filtered Items) (15):** \$0.01185
  * **Restricted profile (0):** \$0.00
  * **Actor Start (1):** \$0.00005

- Items returned (count): 0
- Output (paste full JSON):

```json
[]
```
