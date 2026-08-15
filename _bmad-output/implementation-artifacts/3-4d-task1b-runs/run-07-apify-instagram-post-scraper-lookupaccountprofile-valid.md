# Task 1b — Run 7: apify/instagram-post-scraper - lookupAccountProfile, VALID handle

Part of [3-4d-per-use-case-actor-selection-and-sync-path-timeout.md](../3-4d-per-use-case-actor-selection-and-sync-path-timeout.md) Task 1b. Part 2 (revised 2026-08-14). Baseline/sanity half of a pair with Run 8 (same actor, invalid handle). No details-only mode -- extract profile fields from the returned post's embedded owner info.

**Expected:** 1 post returned; its embedded owner fields (ownerFullName, ownerUsername) usable as profile data.

**Input params:** `{"username": ["https://www.instagram.com/pakuwonmall.jogja/"], "resultsLimit": 1, "dataDetailLevel": "basicData"}`

* **Date/Time:** 2026-08-15 16:38
* **Run ID:** [Yg2gbWe51nihBesWR](https://console.apify.com/actors/nH2AHrwxeTRJoN5hX/runs/Yg2gbWe51nihBesWR#output)
* **Duration:** 9 s

- Success (Y/N):
- Cost ($):
  * **Post (1):** \$0.0017
  * **Post details (0):** \$0.00
- Items returned (count):
- Output (paste full JSON):

```json
[
  {
    "caption": "GET READY FOR INDONESIA SHOPPING FESTIVAL! 🛍️\n\nSaatnya belanja lebih hemat dan makin beruntung! 🤩 Nikmati promo spesial dari berbagai tenant favorit dengan diskon hingga 80%, sekaligus dapatkan kesempatan memenangkan Grand Prize yang spektakuler!\n\n🗓️ 7–23 Agustus 2026\n🎟️ Tukarkan struk belanja minimal Rp100.000 untuk mendapatkan kupon undian berhadiah.\n\nJangan lewatkan promo-promo terbaik dari tenant favoritmu, belanja sepuasnya, dan siapa tahu kamu jadi pemenang berikutnya! ✨\n\n#pakuwonmalljogja",
    "commentsCount": 0,
    "dimensionsHeight": 1350,
    "dimensionsWidth": 1080,
    "displayUrl": "https://instagram.fyhu2-1.fna.fbcdn.net/v/t51.82787-15/764373463_18547291300074731_6625151285942470618_n.jpg?stp=dst-jpg_e15_fr_p1080x1080_tt6&_nc_ht=instagram.fyhu2-1.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gERW0_PLDBMck_uC3Zu4_9owTAB7NVfVFXZDHhepRhahcYrZc2gw0l4a9sOX4lU3DI&_nc_ohc=TKAegoZmhpwQ7kNvwH_q_GY&_nc_gid=LbH8T2bU6jCa18eyFtSc8Q&edm=APU89FABAAAA&ccb=7-5&oh=00_AQGDnEA-YP5Ng_wpTIpZG9nYDmHJFbIhwwaHpqsBQewKWg&oe=6A85EDB2&_nc_sid=bc0c2c",
    "hashtags": [
      "pakuwonmalljogja"
    ],
    "id": "3956094642433492398",
    "isCommentsDisabled": false,
    "isPinned": true,
    "likesCount": 33,
    "ownerFullName": "Pakuwon Mall Jogja",
    "ownerId": "2237970730",
    "ownerUsername": "pakuwonmall.jogja",
    "shortCode": "Dbm3x30EwWu",
    "timestamp": "2026-08-04T06:00:53.000Z",
    "type": "Sidecar",
    "url": "https://www.instagram.com/p/Dbm3x30EwWu/"
  }
]
```
