# Task 1c — Run 6: apify/instagram-post-scraper — Scenario C (zero-boundary)

**✅ RE-RUN COMPLETE AND VALID (2026-08-14).** Result: 6 items returned, all 6 independently verified newer than the `2026-08-14T07:54:43.000Z` cutoff, zero matches against the 3 known pinned timestamps. **Not a literal 0-item result** — but that's expected, not a bug: ~5 hours passed between deriving `T` (from Run 8, ~15:04:59) and actually executing this run (19:41:47), and the account genuinely posted 6 more times in that window (08:28–12:12). Cost was $0.0102 for those 6 items ($0.0017/item, the actor's normal per-post rate) — a correct "pay for what's actually new" outcome, not a leak. This confirms `apify/instagram-post-scraper` passes all three scenarios cleanly. See the main story's Dev Notes "Task 1c Conclusions" for the finalized recommendation.

*(Original invalid attempt, for the record: the first try's pasted output echoed `"newer_than_cutoff_iso": "2026-08-10T00:00:00.000Z"` on every item — Scenario A's cutoff, not this run's — because the Apify console's input box wasn't updated before clicking Run. That data was cleared before this re-run.)*

Part of [3-4d-per-use-case-actor-selection-and-sync-path-timeout.md](../3-4d-per-use-case-actor-selection-and-sync-path-timeout.md) Task 1c. Expected: 0 items, ~$0 cost — this actor's `skipPinnedPosts: true` already confirmed clean of pinned posts in Run 4, so unlike Run 3 (the `apify/instagram-api-scraper` equivalent, confirmed to leak pinned posts even at this exact test), this one really should come back empty if the actor's cutoff filtering works correctly overall.

`T + 1s` updated to the freshest known data point: Run 8's newest returned post (`taken_at: 1786694082` → `2026-08-14T07:54:42.000Z`, same account, ran later than Run 5) → `2026-08-14T07:54:43.000Z`. This matches the value already used for Run 9. **Re-verify before running** — if meaningful time has passed since Run 8, do a fresh `resultsLimit: 1` check first and recompute; a genuinely new post appearing here isn't a filter bug, just a stale cutoff. **Double-check the Apify console's input box actually shows this exact `onlyPostsNewerThan` value before clicking Run** — that's what went wrong last time.

**Input params:** `{"username": ["https://www.instagram.com/pakuwonmall.jogja/"], "resultsLimit": 15, "dataDetailLevel": "basicData", "skipPinnedPosts": true, "onlyPostsNewerThan": "2026-08-14T07:54:43.000Z"}`

* **Date/Time:** 2026-08-14 19:41:47
* **Run ID:** [Pzfp8h2UfO4cow6ok](https://console.apify.com/actors/nH2AHrwxeTRJoN5hX/runs/Pzfp8h2UfO4cow6ok#input)
* **Duration:** 28 s

- Cost ($):
  * **Post (6):** \$0.0102
  * **Post details (0):** \$0.00
- Items returned (count): 6
- Output (paste full JSON):

```json
[
  {
    "caption": "Celebrate Independence Day with a little extra sparkle ✨\n\nMake your Pandora moments count with our Limited Time Only offers:\n\n🛍️ Online: Buy 2 & enjoy 10% OFF, or buy 3 or more & enjoy 15% OFF*\n💖 Offline: Enjoy 3 FOR 2* — because one more charm is always a good idea 😉\n\nShop your favourites and create a story that's uniquely yours.\n\n*T&Cs Apply\n\n#PandoraID #pakuwonmalljogja",
    "commentsCount": 0,
    "dimensionsHeight": 1348,
    "dimensionsWidth": 1080,
    "displayUrl": "https://scontent-gru2-1.cdninstagram.com/v/t51.82787-15/774282120_18550046104074731_8383713883278733876_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=scontent-gru2-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gG9yoGjXSHLpIqb0KEI_XQBFH9RHFfhQbDbp-Ck-Gg7CE9nLWy1dw5yjsXqxhC9NtU&_nc_ohc=YhHLACbwSnsQ7kNvwF7RaXg&_nc_gid=ZLAWh1ZLGjvVp3Tc9qA31A&edm=APU89FABAAAA&ccb=7-5&oh=00_AQEtsFOiYmVVqogsXB6F78VDHfxZtxx8KubeZvE9m__Jgw&oe=6A84E974&_nc_sid=bc0c2c",
    "hashtags": [
      "PandoraID",
      "pakuwonmalljogja"
    ],
    "id": "3963529569051570616",
    "isCommentsDisabled": false,
    "likesCount": 5,
    "ownerFullName": "Pakuwon Mall Jogja",
    "ownerId": "2237970730",
    "ownerUsername": "pakuwonmall.jogja",
    "shortCode": "DcBSSS0E3G4",
    "timestamp": "2026-08-14T12:12:45.000Z",
    "type": "Sidecar",
    "url": "https://www.instagram.com/p/DcBSSS0E3G4/"
  },
  {
    "caption": "MERDEKA COMBO! 🇲🇨\n\nRayakan momen kemerdekaan dengan pilihan promo spesial dari Kopi Si Kaya On The Go – Pakuwon Mall Jogja!\n\nPilihan promo yang bisa kamu nikmati:\n- 17K COMBO (Bun/Crackers + Teh O/Teh C/Kopi O/Kopi C\n- 81K COMBO BAGEL\n- 81K BUNDLE ANY 4 DRINKS\n\n🗓️ Berlaku 15-17 Agustus 2026\n\nYuk, pilih combo favoritmu dan rayakan kemerdekaan bareng Kopi Si Kaya!\n\n#KopiSiKaya #KopiSiKayaOnTheGo #ToastandTalks #PromoKopiSiKaya #PakuwonMallJogja",
    "coauthorProducers": [
      {
        "id": "2237970730",
        "is_verified": true,
        "profile_pic_url": "https://scontent-gru2-1.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-gru2-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gG9yoGjXSHLpIqb0KEI_XQBFH9RHFfhQbDbp-Ck-Gg7CE9nLWy1dw5yjsXqxhC9NtU&_nc_ohc=L9VCN6COaTMQ7kNvwFM2NDf&_nc_gid=ZLAWh1ZLGjvVp3Tc9qA31A&edm=APU89FABAAAA&ccb=7-5&oh=00_AQGtIUxXCwFmJPL5mFLBlFVRkSJF7nicaLFmiBnlSUowCw&oe=6A84DE73&_nc_sid=bc0c2c",
        "username": "pakuwonmall.jogja"
      }
    ],
    "commentsCount": 0,
    "dimensionsHeight": 1349,
    "dimensionsWidth": 1080,
    "displayUrl": "https://scontent-gru2-2.cdninstagram.com/v/t51.82787-15/776020817_17952065757238445_4120597132949601584_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=scontent-gru2-2.cdninstagram.com&_nc_cat=105&_nc_oc=Q6cZ2gG9yoGjXSHLpIqb0KEI_XQBFH9RHFfhQbDbp-Ck-Gg7CE9nLWy1dw5yjsXqxhC9NtU&_nc_ohc=3jE83_c1wzYQ7kNvwEVxmFC&_nc_gid=ZLAWh1ZLGjvVp3Tc9qA31A&edm=APU89FABAAAA&ccb=7-5&oh=00_AQGmYTh_MdWgczTDKDTYqtVzxh8pB2YkqSfCK374hurJ_w&oe=6A84E2A9&_nc_sid=bc0c2c",
    "hashtags": [
      "KopiSiKaya",
      "KopiSiKayaOnTheGo",
      "ToastandTalks",
      "PromoKopiSiKaya",
      "PakuwonMallJogja"
    ],
    "id": "3963519006095153684",
    "isCommentsDisabled": false,
    "likesCount": 1,
    "ownerId": "67061918444",
    "ownerUsername": "kopisikaya",
    "shortCode": "DcBP4lSz5oU",
    "timestamp": "2026-08-14T11:59:17.000Z",
    "type": "Image",
    "url": "https://www.instagram.com/p/DcBP4lSz5oU/"
  },
  {
    "caption": "Saatnya ajak si kecil seru-seruan di Play With Us, THE BIG PLAYGROUND IN JOGJA!🏎️✨\n\nPakuwon Mall Jogja kembali menghadirkan Play With Us di Grand Atrium Pakuwon Mall Jogja mulai **7–16 Agustus 2026🎉\n\nBanyak aktivitas seru yang bisa dicoba, mulai dari:\n🏎️ Diecast Playland\n🚗 Big Foot Cars Sirkuit\n🚜 RC Excavator Area\n🏁 RC Adventure Arena\n🏎️ F1 Race Simulator\n\nYang paling bikin happy, harga bermainnya mulai dari Rp35.000 aja!😍\n\nYuk, ajak keluarga dan si kecil main sepuasnya di Play With Us, THE BIG PLAYGROUND IN JOGJA Jangan sampai kelewatan karena event nya cuma sampai 16 Agustus 2026! 💛\n\n📍 Grand Atrium – Pakuwon Mall Jogja\n📅 7–16 Agustus 2026\n\n#PakuwonMallJogja #PlayWithUs #TheBigPlaygroundInJogja #PlayWithUsJogja #familyfun",
    "coauthorProducers": [
      {
        "id": "2237970730",
        "is_verified": true,
        "profile_pic_url": "https://scontent-gru2-1.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-gru2-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gG9yoGjXSHLpIqb0KEI_XQBFH9RHFfhQbDbp-Ck-Gg7CE9nLWy1dw5yjsXqxhC9NtU&_nc_ohc=L9VCN6COaTMQ7kNvwFM2NDf&_nc_gid=ZLAWh1ZLGjvVp3Tc9qA31A&edm=APU89FABAAAA&ccb=7-5&oh=00_AQGtIUxXCwFmJPL5mFLBlFVRkSJF7nicaLFmiBnlSUowCw&oe=6A84DE73&_nc_sid=bc0c2c",
        "username": "pakuwonmall.jogja"
      }
    ],
    "commentsCount": 7,
    "dimensionsHeight": 1920,
    "dimensionsWidth": 1080,
    "displayUrl": "https://scontent-gru2-1.cdninstagram.com/v/t51.82787-15/774125930_18619269760015629_67835409652362321_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=scontent-gru2-1.cdninstagram.com&_nc_cat=109&_nc_oc=Q6cZ2gG9yoGjXSHLpIqb0KEI_XQBFH9RHFfhQbDbp-Ck-Gg7CE9nLWy1dw5yjsXqxhC9NtU&_nc_ohc=XeDRDhWIipwQ7kNvwH7oVJz&_nc_gid=ZLAWh1ZLGjvVp3Tc9qA31A&edm=APU89FABAAAA&ccb=7-5&oh=00_AQF2BCNQI_XP0Enr9NtspRllVio3oGIHEyIOkzzTNV6DCg&oe=6A84C93F&_nc_sid=bc0c2c",
    "hashtags": [
      "PakuwonMallJogja",
      "PlayWithUs",
      "TheBigPlaygroundInJogja",
      "PlayWithUsJogja",
      "familyfun"
    ],
    "id": "3963510959263891816",
    "isCommentsDisabled": false,
    "likesCount": -1,
    "ownerId": "1504527628",
    "ownerUsername": "andinni____",
    "productType": "clips",
    "shortCode": "DcBODfGSsFo",
    "timestamp": "2026-08-14T11:41:08.000Z",
    "type": "Video",
    "url": "https://www.instagram.com/p/DcBODfGSsFo/",
    "videoUrl": "https://scontent-gru2-2.cdninstagram.com/o1/v/t2/f2/m86/AQPM0GKlTqwruN8X40AsKgKFIXao2uqL4OotdnQ5FkVzGG1OwDSGPv6AhH7d6zMEF0tYUpciJpkFlZK29VvIWfnbOXACuGsZgEB2Nhw.mp4?_nc_cat=106&_nc_sid=5e9851&_nc_ht=scontent-gru2-2.cdninstagram.com&_nc_ohc=l5CRC9MbpsMQ7kNvwHIFxjk&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MzIyODYzNDE4NzMzODE2MiwiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjo0NywidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=c177a8e7240f8a4c&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC9BNjRFMTYxRUVERDEyRDYzODQwNDBEMDM0M0QzRjlCOV92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyLzVENDdDQzE2NkNBQkUyNTUwQzhEOTg2MzNDQUUwOTg1X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACbkxsSdn5u8CxUCKAJDMywXQEfZmZmZmZoYEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=ZLAWh1ZLGjvVp3Tc9qA31A&_nc_ss=7a22e&_nc_zt=28&oh=00_AQHTXrx0thHkFODHs6YtumHIKzThDx5F-_vIiTtvw-XBWA&oe=6A80D39F"
  },
  {
    "caption": "THE BIG PLAYGROUND IN JOGJA VOL 2 balik lagi guuyysss..!! Buruan ke grand atrium @pakuwonmall.jogja krn cuma sampe tgl 16 Agustus 2026🏁🏎️🏎️🏎️",
    "coauthorProducers": [
      {
        "id": "2237970730",
        "is_verified": true,
        "profile_pic_url": "https://scontent-gru2-1.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-gru2-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gG9yoGjXSHLpIqb0KEI_XQBFH9RHFfhQbDbp-Ck-Gg7CE9nLWy1dw5yjsXqxhC9NtU&_nc_ohc=L9VCN6COaTMQ7kNvwFM2NDf&_nc_gid=ZLAWh1ZLGjvVp3Tc9qA31A&edm=APU89FABAAAA&ccb=7-5&oh=00_AQGtIUxXCwFmJPL5mFLBlFVRkSJF7nicaLFmiBnlSUowCw&oe=6A84DE73&_nc_sid=bc0c2c",
        "username": "pakuwonmall.jogja"
      }
    ],
    "commentsCount": 5,
    "dimensionsHeight": 1333,
    "dimensionsWidth": 750,
    "displayUrl": "https://scontent-gru1-2.cdninstagram.com/v/t51.82787-15/774312863_18617003917037326_2688743888406303735_n.jpg?stp=dst-jpg_e15_tt6&_nc_ht=scontent-gru1-2.cdninstagram.com&_nc_cat=110&_nc_oc=Q6cZ2gG9yoGjXSHLpIqb0KEI_XQBFH9RHFfhQbDbp-Ck-Gg7CE9nLWy1dw5yjsXqxhC9NtU&_nc_ohc=95SuRJYPhMsQ7kNvwFKCbsO&_nc_gid=ZLAWh1ZLGjvVp3Tc9qA31A&edm=APU89FABAAAA&ccb=7-5&oh=00_AQGiCwq1c5KBbqIILLAvZXafj1KsMXlLTx1TSOHCGa86ow&oe=6A84DB0D&_nc_sid=bc0c2c",
    "hashtags": [],
    "id": "3963502674808673028",
    "isCommentsDisabled": false,
    "likesCount": -1,
    "ownerId": "515621325",
    "ownerUsername": "huttamydewy",
    "productType": "clips",
    "shortCode": "DcBMK7mSBME",
    "timestamp": "2026-08-14T11:21:03.000Z",
    "type": "Video",
    "url": "https://www.instagram.com/p/DcBMK7mSBME/",
    "videoUrl": "https://scontent-gru1-2.cdninstagram.com/o1/v/t2/f2/m86/AQObfY6WsNlXP5B9HgJUkloL_psFxMN9AMWdP1oLF3tG6Q5wxkhJlWLfx_rlWcI-idRuu8VqXNceYX8DoXbNo05_pOY0gCBTKVYJsro.mp4?_nc_cat=100&_nc_sid=5e9851&_nc_ht=scontent-gru1-2.cdninstagram.com&_nc_ohc=HNjl8qHnR_YQ7kNvwGNBrOg&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTA1MDg5NTM3NDM2NDI3OSwiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjo0MCwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=aab59c37b98401d7&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC9FRjRBNzMxQkNEQUNCNUUwRjAwQzQxOENBNUJBNTk4Nl92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyLzY0NDdFOEYzMjIyNUJBMjJGMjdBODRFOEY5Q0Q4NTg1X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACbuueHXlPLdAxUCKAJDMywXQERAAAAAAAAYEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=ZLAWh1ZLGjvVp3Tc9qA31A&_nc_ss=7a22e&_nc_zt=28&oh=00_AQE6RxJnaL_M7ssRPOjTECmHLsXlAQnymUD_0y3mm9HRXg&oe=6A810039"
  },
  {
    "caption": "Bingung weekend kemana? 🚗💨\n\nSaatnya ajak keluarga dan si kecil seru-seruan di Play With Us Vol. 2 – Hobby & Toys Expo! 🎮🏎️✨\n\nBukan cuma bisa lihat-lihat, di sini ada banyak aktivitas seru yang bisa dicoba, mulai dari Diecast, Race Simulator, RC Excavator & Adventure, sampai berbagai keseruan lainnya! 🏁🚙🔥\n\nCocok banget buat mengisi weekend sambil bermain, eksplorasi, dan quality time bareng keluarga. 👨‍👩‍👧‍👦💕\n\n📅 7–16 Agustus\n📍 Grand Atrium Pakuwon Mall Jogja\n\nJadi, weekend ini mau ke mana? 😉\nYuk, Play With Us! 🎮🏎️💨",
    "coauthorProducers": [
      {
        "id": "2237970730",
        "is_verified": true,
        "profile_pic_url": "https://scontent-gru2-1.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-gru2-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gG9yoGjXSHLpIqb0KEI_XQBFH9RHFfhQbDbp-Ck-Gg7CE9nLWy1dw5yjsXqxhC9NtU&_nc_ohc=L9VCN6COaTMQ7kNvwFM2NDf&_nc_gid=ZLAWh1ZLGjvVp3Tc9qA31A&edm=APU89FABAAAA&ccb=7-5&oh=00_AQGtIUxXCwFmJPL5mFLBlFVRkSJF7nicaLFmiBnlSUowCw&oe=6A84DE73&_nc_sid=bc0c2c",
        "username": "pakuwonmall.jogja"
      }
    ],
    "commentsCount": 0,
    "dimensionsHeight": 1920,
    "dimensionsWidth": 1080,
    "displayUrl": "https://scontent-gru2-1.cdninstagram.com/v/t51.82787-15/774042750_18626639923056491_1073548536915615324_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=scontent-gru2-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gG9yoGjXSHLpIqb0KEI_XQBFH9RHFfhQbDbp-Ck-Gg7CE9nLWy1dw5yjsXqxhC9NtU&_nc_ohc=LYXlNDlIq0sQ7kNvwHG7vgF&_nc_gid=ZLAWh1ZLGjvVp3Tc9qA31A&edm=APU89FABAAAA&ccb=7-5&oh=00_AQGYzc-xtXHWOmQk6IL_nNNNaxWv62SNc9HpIGbGwS6GIw&oe=6A84D232&_nc_sid=bc0c2c",
    "hashtags": [],
    "id": "3963497298734785601",
    "isCommentsDisabled": false,
    "likesCount": 8,
    "ownerId": "638968490",
    "ownerUsername": "joannaanastasia",
    "productType": "clips",
    "shortCode": "DcBK8svTqRB",
    "timestamp": "2026-08-14T11:09:56.000Z",
    "type": "Video",
    "url": "https://www.instagram.com/p/DcBK8svTqRB/",
    "videoUrl": "https://scontent-gru1-2.cdninstagram.com/o1/v/t2/f2/m86/AQNprisVr6NqNdzDvq9D0xkkF3DM-KUCKFSDQW8G3_5jW6qIePYW1ShaAcUZPY1zIrGGjQJ1MtQZ4cPf1_aU6xYjfW-4vcjKKFJuUhM.mp4?_nc_cat=100&_nc_sid=5e9851&_nc_ht=scontent-gru1-2.cdninstagram.com&_nc_ohc=sbuW89DWSm8Q7kNvwE2P9w1&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MjI2NTE0MDY4MDkwODEyOSwiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjo1OCwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=1ff2a600400694ed&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC9EQTQ0NjIwMEZCQ0ZFN0JFNjdBRjQ4RDlDMEJERDVCMl92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyL0YzNEY0Rjc5QkQ4NjRGOTMzRDgwNDk1OTM1QTIyOUIxX2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACbC9baaxYiGCBUCKAJDMywXQE1AAAAAAAAYEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=ZLAWh1ZLGjvVp3Tc9qA31A&_nc_ss=7a22e&_nc_zt=28&oh=00_AQGgrGh9t6AtnZ327rDcl39Nn3Fc7Cxlvy9rKn0pJpNbNg&oe=6A80DB15"
  },
  {
    "caption": "MERDEKA SALE IS HERE! 🇮🇩❤️\n\nSiap-siap berburu promo spesial dari berbagai tenant F&B di Pakuwon Mall Jogja! Dari yang gurih sampai manis, ada banyak promo menarik yang wajib kamu cek! 👀🔥\n\nSwipe sampai akhir & pilih promo favoritmu! 👉\n\n🇮🇩 Celebrate Independence, Celebrate the Deals!\n\n#pakuwonmalljogja",
    "commentsCount": 5,
    "dimensionsHeight": 1350,
    "dimensionsWidth": 1080,
    "displayUrl": "https://scontent-gru2-1.cdninstagram.com/v/t51.82787-15/774342449_18549998737074731_906163973461713220_n.jpg?stp=dst-jpg_e15_fr_p1080x1080_tt6&_nc_ht=scontent-gru2-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gG9yoGjXSHLpIqb0KEI_XQBFH9RHFfhQbDbp-Ck-Gg7CE9nLWy1dw5yjsXqxhC9NtU&_nc_ohc=mwhOA-9pAPoQ7kNvwHIVQhr&_nc_gid=ZLAWh1ZLGjvVp3Tc9qA31A&edm=APU89FABAAAA&ccb=7-5&oh=00_AQGyH3MYbErYM6O2aHpQLgSbO465Oc-lNgiwLLriFG-6sw&oe=6A84C478&_nc_sid=bc0c2c",
    "hashtags": [
      "pakuwonmalljogja"
    ],
    "id": "3963416742659724501",
    "isCommentsDisabled": false,
    "likesCount": 100,
    "ownerFullName": "Pakuwon Mall Jogja",
    "ownerId": "2237970730",
    "ownerUsername": "pakuwonmall.jogja",
    "shortCode": "DcA4odDEZTV",
    "timestamp": "2026-08-14T08:28:35.000Z",
    "type": "Sidecar",
    "url": "https://www.instagram.com/p/DcA4odDEZTV/"
  }
]
```
