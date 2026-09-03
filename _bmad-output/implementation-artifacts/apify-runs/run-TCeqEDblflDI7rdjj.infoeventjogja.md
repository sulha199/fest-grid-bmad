# Apify Instagram Scraper Smoke Test

- **Actor:** `figue~instagram-profile-scraper` — Figue: Instagram Profile Scraper
- **Target:** [@infoeventjogja](https://www.instagram.com/infoeventjogja/)
- **Date/Time:** 2026-09-02 16:56
- **Run ID:** [TCeqEDblflDI7rdjj](https://console.apify.com/actors/98ivcMaUAxs5pu9tV/runs/TCeqEDblflDI7rdjj)
- **Status:** SUCCEEDED
- **Duration:** 13 s
- **Cost ($):** $0.004 (exact total: $0.0036)

### Cost Breakdown
- **result:** 1 × $0.0011 = **$0.0011**
- **Actor Start:** 1 × $0.0025 = **$0.0025**

### Input Params
```json
{
  "profiles": [
    "infoeventjogja"
  ],
  "includeRecentPosts": false
}
```

### Output
```json
[
  {
    "username": "infoeventjogja",
    "full_name": null,
    "url": "https://www.instagram.com/infoeventjogja/",
    "inputUrl": "https://www.instagram.com/infoeventjogja/",
    "scrapedAt": "2026-09-02T16:54:07.936Z",
    "error": "Instagram rate-limited every attempt for this profile — please try again later",
    "errorCode": "RATE_LIMITED",
    "httpStatus": 401
  }
]
```
