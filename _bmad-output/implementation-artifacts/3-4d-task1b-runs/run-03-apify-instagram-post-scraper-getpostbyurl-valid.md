# Task 1b — Run 3: apify/instagram-post-scraper - getPostByUrl, VALID post URL

Part of [3-4d-per-use-case-actor-selection-and-sync-path-timeout.md](../3-4d-per-use-case-actor-selection-and-sync-path-timeout.md) Task 1b. Part 1 (revised 2026-08-14). Baseline/sanity half of a pair with Run 4 (same actor, invalid post URL). No resultsLimit -- the actor's own docs say it doesn't apply in post-URL mode.

**Expected:** 1 item returned, matching the target post.

**Input params:** `{"username": ["https://www.instagram.com/p/Db9-oj1EaiF/"], "dataDetailLevel": "basicData"}`

* **Date/Time:** 2026-08-15 16:33:45
* **Run ID:** [42LcKLguOUYw1w8Kb](https://console.apify.com/actors/nH2AHrwxeTRJoN5hX/runs/42LcKLguOUYw1w8Kb#output)
* **Duration:** 16 s

- Success (Y/N):
- Cost ($):
  * **Post (1):** \$0.0017
  * **Post details (0):** \$0.00
- Items returned (count):
- Output (paste full JSON):

```json
[
  {
    "caption": "Lagi cari skincare, makeup, body care, dan parfum lokal? Ke MY SKIN BUT BETTER aja!\n\nLagi ada diskon sampai 50% ditambah extra discount sampai 15k dan banyaaak banget free giftnya loh!\nAyo buruan agendain ke storenya!\n\n#pakuwonmalljogja",
    "commentsCount": 0,
    "dimensionsHeight": 1348,
    "dimensionsWidth": 1080,
    "displayUrl": "https://scontent-nrt6-1.cdninstagram.com/v/t51.82787-15/773155657_18549672562074731_4050104637918995153_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=scontent-nrt6-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF86tjvozfCOxf6W33ArTGJOOWqeZVRDGhwNRopOnqWcNUGCqc2ESMYZyIg6etNW-o&_nc_ohc=jpsfgcuttEQQ7kNvwGt__YZ&_nc_gid=3EL0MEzkfOhxoXsVtjBjkA&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQGAuctZvBDqHza_cCuVJuT2y34MT2FlVnKiVHMxmMyy4Q&oe=6A85EE48&_nc_sid=c6f216",
    "hashtags": [
      "pakuwonmalljogja"
    ],
    "id": "3962598713289975941",
    "inputUrl": "https://www.instagram.com/p/Db9-oj1EaiF/",
    "isCommentsDisabled": false,
    "likesCount": 7,
    "ownerFullName": "Pakuwon Mall Jogja",
    "ownerId": "2237970730",
    "ownerUsername": "pakuwonmall.jogja",
    "shortCode": "Db9-oj1EaiF",
    "timestamp": "2026-08-13T05:23:19.000Z",
    "type": "Sidecar",
    "url": "https://www.instagram.com/p/Db9-oj1EaiF/"
  }
]
```
