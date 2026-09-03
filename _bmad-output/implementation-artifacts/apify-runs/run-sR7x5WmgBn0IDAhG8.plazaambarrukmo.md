# Apify Instagram Scraper Smoke Test

- **Actor:** `figue~instagram-profile-scraper` — Figue: Instagram Profile Scraper
- **Target:** [@plazaambarrukmo](https://www.instagram.com/plazaambarrukmo/)
- **Date/Time:** 2026-09-02 16:56
- **Run ID:** [sR7x5WmgBn0IDAhG8](https://console.apify.com/actors/98ivcMaUAxs5pu9tV/runs/sR7x5WmgBn0IDAhG8)
- **Status:** SUCCEEDED
- **Duration:** 14 s
- **Cost ($):** $0.004 (exact total: $0.0036)

### Cost Breakdown
- **result:** 1 × $0.0011 = **$0.0011**
- **Actor Start:** 1 × $0.0025 = **$0.0025**

### Input Params
```json
{
  "profiles": [
    "plazaambarrukmo"
  ],
  "includeRecentPosts": false
}
```

### Output
```json
[
  {
    "username": "plazaambarrukmo",
    "full_name": null,
    "url": "https://www.instagram.com/plazaambarrukmo/",
    "inputUrl": "https://www.instagram.com/plazaambarrukmo/",
    "scrapedAt": "2026-09-02T16:54:32.718Z",
    "error": "Instagram rate-limited every attempt for this profile — please try again later",
    "errorCode": "RATE_LIMITED",
    "httpStatus": 401
  }
]
```
