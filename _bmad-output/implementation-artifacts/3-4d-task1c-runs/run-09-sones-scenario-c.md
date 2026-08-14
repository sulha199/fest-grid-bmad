# Task 1c — Run 9: sones/instagram-posts-scraper-lowcost — Scenario C (zero-boundary)

Part of [3-4d-per-use-case-actor-selection-and-sync-path-timeout.md](../3-4d-per-use-case-actor-selection-and-sync-path-timeout.md) Task 1c. Expected: 0 items, ~$0 cost. Any items back at all — especially matching one of the 3 known pinned timestamps (`2026-08-01T03:58:43Z`, `2026-08-04T05:21:00Z`, `2026-08-04T14:07:36Z`) — would reveal this actor has the same pinned-post bug already confirmed for `apify/instagram-api-scraper`.

`T + 1s` derived from Run 8's own returned data (max `taken_at` = `1786694082` = `2026-08-14T07:54:42.000Z`) → `2026-08-14T07:54:43.000Z`. This is more precise than reusing Run 5/6's value since it comes from `sones` itself, same account.

**⚠️ Major finding from Run 8, relevant to this run too:** Run 8's output includes a post timestamped `2026-08-04T06:00:53.000Z` explicitly flagged `"is_newer_than_cutoff": false` in the JSON — yet it was still returned despite a `2026-08-13T00:00:00Z` cutoff. This means `sones` does **not** filter server-side; it returns a fixed batch (up to `postsPerProfile`) regardless of the cutoff and just annotates each item with a computed boolean, leaving actual filtering to the caller. Current production code (`instagram-adapter.ts`) never checks this field — it maps every returned item as if it were genuinely new. **For this run specifically:** if the result isn't empty, check `is_newer_than_cutoff` on each returned item before concluding the actor "failed" — a nonzero item count with `is_newer_than_cutoff: false` on all of them would mean the same non-filtering behavior, not a pinned-post-style leak.

**Input params:** `{"usernames": ["pakuwonmall.jogja"], "postsPerProfile": 15, "newerThan": "2026-08-14T07:54:43.000Z", "proxy": {"useApifyProxy": true}, "maxRetries": 3, "maxConcurrentProfiles": 1, "delayBetweenProfiles": 250, "delayBetweenRequests": 500}`

* **Date/Time:** 2026-08-14 15:12:16
* **Run ID:** [h7eEcOBuuDjJvay3t](https://console.apify.com/actors/Y5mzw9TLFReI0d6gQ/runs/h7eEcOBuuDjJvay3t)
* **Duration:** 6 s

- Cost ($):
  * **post (12):** \$0.0036
  * **Actor Start (1):** \$0.005
- Items returned (count):
- Output (paste full JSON):

```json
[
  {
    "pk": "3956094642433492398",
    "id": "3956094642433492398_2237970730",
    "code": "Dbm3x30EwWu",
    "taken_at": 1785823253,
    "media_type": 8,
    "product_type": "carousel_container",
    "caption": {
      "pk": "18187508977403537",
      "text": "GET READY FOR INDONESIA SHOPPING FESTIVAL! 🛍️\n\nSaatnya belanja lebih hemat dan makin beruntung! 🤩 Nikmati promo spesial dari berbagai tenant favorit dengan diskon hingga 80%, sekaligus dapatkan kesempatan memenangkan Grand Prize yang spektakuler!\n\n🗓️ 7–23 Agustus 2026\n🎟️ Tukarkan struk belanja minimal Rp100.000 untuk mendapatkan kupon undian berhadiah.\n\nJangan lewatkan promo-promo terbaik dari tenant favoritmu, belanja sepuasnya, dan siapa tahu kamu jadi pemenang berikutnya! ✨\n\n#pakuwonmalljogja"
    },
    "like_count": 29,
    "comment_count": 0,
    "original_width": 1080,
    "original_height": 1350,
    "user": {
      "pk": "2237970730",
      "username": "pakuwonmall.jogja",
      "full_name": "Pakuwon Mall Jogja",
      "is_verified": true,
      "profile_pic_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fblr21-2.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gEu-LEw5daxX541lEiSxUxPZKcrV928pxTssZPvMPqA6C4TNxpiehqdLevVo1GxV5M&_nc_ohc=L9VCN6COaTMQ7kNvwG0TIqd&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQFTwHdjGQGRKLG9xFmU2gkSS6jWIvVpbZz3Gu1PJ9KT-A&oe=6A84A633&_nc_sid=ee9879"
    },
    "carousel_media": [
      {
        "pk": "3956094351184797729",
        "id": "3956094351184797729_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1350,
        "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/764373463_18547291300074731_6625151285942470618_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=105&ig_cache_key=Mzk1NjA5NDM1MTE4NDc5NzcyOQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=vDVCLCL91uEQ7kNvwH1MpDV&_nc_oc=Adogs0U1WL89S0f2jv6yLXd6eJFM4sB4RH1EjVIzUH6Ce77KTiqAUJKgAqTjQhEGxeg&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQEPOrjJemUW3IGybgLORR_pi2aOhJCLMjbWReCcz7-gpg&oe=6A849C32"
      },
      {
        "pk": "3956094352711512407",
        "id": "3956094352711512407_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1350,
        "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/763375083_18547291291074731_8940045769077676301_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=105&ig_cache_key=Mzk1NjA5NDM1MjcxMTUxMjQwNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=ZXjH0FqGg4sQ7kNvwGsB-58&_nc_oc=Ado8_oFT9AvhdWf4wwipq7fEHH8xnexsfZSYUqjJHi0YY4YD8PwkQxIRAqxa6Ovc_F0&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQGuYY7yyV1yJ0vL_NiP1LNV8Xj0nxgqvf12H4BoUmP5Gw&oe=6A84ABC8"
      },
      {
        "pk": "3956094356528409165",
        "id": "3956094356528409165_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1350,
        "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/762828649_18547291357074731_3495933672133029009_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=101&ig_cache_key=Mzk1NjA5NDM1NjUyODQwOTE2NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Fqi70fcgvugQ7kNvwFiFmvW&_nc_oc=Adpl9REu5f7oOIvRgOhWnJIFkKhJ2nH3U3tFnJrmOA3NwynsabQyDSK2Kx-75Op5NcI&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQF3UG666IZGJiMPNTbk7oK1SwsRbfiKZm2GiMCFkbX4NA&oe=6A849F79"
      },
      {
        "pk": "3956094354909530741",
        "id": "3956094354909530741_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1350,
        "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/764719268_18547291309074731_3021930272927779711_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=110&ig_cache_key=Mzk1NjA5NDM1NDkwOTUzMDc0MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=FAwemyCJkyYQ7kNvwGK3hhm&_nc_oc=AdqZXKCcKLyJbj_58WGgB-I1Oc2GEQ0Re9wzjL68p3VKtsDgABhp4HIdUQhslCLaWHA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQHfIbvjj14CKhSzNXoqHG11P-lexyRRViZen7p0eJ0Kpg&oe=6A848B72"
      },
      {
        "pk": "3956094355261715295",
        "id": "3956094355261715295_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1350,
        "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/765052041_18547291321074731_1830188309625751900_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=103&ig_cache_key=Mzk1NjA5NDM1NTI2MTcxNTI5NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=DotbowcVs7cQ7kNvwG7du5f&_nc_oc=AdrfqGIRB3r6tY0QBJVq-2AmSJst-QE4xGzP1aQ_N0kzc1h0UuJweMvUrjVAAcVZ9nI&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQFSqGmj7JsM7E9gOpcB7uxTeZSKtLYdJE-Q5utKh7MKHQ&oe=6A849A00"
      },
      {
        "pk": "3956094357685973312",
        "id": "3956094357685973312_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1350,
        "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/763332220_18547291360074731_8371349148896458578_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=107&ig_cache_key=Mzk1NjA5NDM1NzY4NTk3MzMxMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=W6CAqa2JATgQ7kNvwHAgA0H&_nc_oc=AdopbCXcjpS2pJaMZRbIVvQuwAS-y-Dr0GDWja7u78vz-T6ouoBXZ464Op9xffHqBiU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQGBMQhJd1iPuEMu4mGkOTURvO5HFUH8UhvqTkwpgMPMTA&oe=6A8487C4"
      },
      {
        "pk": "3956094358449416169",
        "id": "3956094358449416169_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1350,
        "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/764373463_18547291366074731_80672179490973639_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=102&ig_cache_key=Mzk1NjA5NDM1ODQ0OTQxNjE2OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=QIkiIK9eVWQQ7kNvwGGCIKj&_nc_oc=AdonecOZBERpnL4UUd1K9Xh-Tw9MYUm09PK0p8jJFGMH7wdgQ_r5orZ9SgD03g9R8x4&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQHoN_4qtw7dhej9-RlcVYYuolZc6ZXHbVTs3vUiMdOr0g&oe=6A84BB34"
      },
      {
        "pk": "3956094355605807523",
        "id": "3956094355605807523_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1350,
        "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/763112299_18547291336074731_9031499566455898762_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=104&ig_cache_key=Mzk1NjA5NDM1NTYwNTgwNzUyMw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=27t4AQIlfgQQ7kNvwGUgm-u&_nc_oc=AdrQ2-9ydjLEzoRn0-Tzur1Ls4EsOmMfCSa89JqWyfxLtWdb5fXxMLeckE-XrtXWUX4&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQGPbWoEBwLP1uzWBeZAJZGGBgR7_Xe69ZFbMM9QfJaROA&oe=6A84AA7B"
      },
      {
        "pk": "3956094356721490147",
        "id": "3956094356721490147_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1350,
        "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/763486821_18547291378074731_8588557685248871023_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=111&ig_cache_key=Mzk1NjA5NDM1NjcyMTQ5MDE0Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=1dkCTxYVMTYQ7kNvwGyhg4H&_nc_oc=AdpndghQYeEk95fB20w2MkLhSBlC7cuOImzK5qnaXqchyBGXQFeBSUyGmp8EeGikyng&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQEUKFDvgpPuu7oLA-wWjPgAf4akWLvxOQxGm90fKfdxuA&oe=6A848FCC"
      },
      {
        "pk": "3956094356738143971",
        "id": "3956094356738143971_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1350,
        "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/764752256_18547291363074731_7018336778015186283_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=103&ig_cache_key=Mzk1NjA5NDM1NjczODE0Mzk3MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=eJoCM0NNhy0Q7kNvwEGUCN_&_nc_oc=AdofdeOnnISerllS_zY43bgP0KLvf8fNXRzEh_OPv9keUNowTUIXjlXjg0Ipj0ONJPQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQE0asauhoQlgQwXCfR9D3om5i9VhRSI77q64jNVtGsLZA&oe=6A848E45"
      },
      {
        "pk": "3956094372189900691",
        "id": "3956094372189900691_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1350,
        "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/762737454_18547291387074731_3120110141880693049_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=104&ig_cache_key=Mzk1NjA5NDM3MjE4OTkwMDY5MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=tGh5yJ3BZOkQ7kNvwER8dLi&_nc_oc=AdqeDWdUGenvOn4hCn6QXI_7s0Rt4QHXHxyOcGyc4Hc-JtjqZ47Y2wSJb4HfMrGRZ8g&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQE8YEIBQkrKrKfZdT6GWzIwqKsJZuNYIc67zrL8oL7_EA&oe=6A84A623"
      }
    ],
    "coauthor_producers": [],
    "invited_coauthor_producers": [],
    "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/764373463_18547291300074731_6625151285942470618_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=105&ig_cache_key=Mzk1NjA5NDM1MTE4NDc5NzcyOQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=vDVCLCL91uEQ7kNvwH1MpDV&_nc_oc=Adogs0U1WL89S0f2jv6yLXd6eJFM4sB4RH1EjVIzUH6Ce77KTiqAUJKgAqTjQhEGxeg&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQEPOrjJemUW3IGybgLORR_pi2aOhJCLMjbWReCcz7-gpg&oe=6A849C32",
    "scraped_username": "pakuwonmall.jogja",
    "scraped_at": 1786695139,
    "post_url": "https://www.instagram.com/p/Dbm3x30EwWu/",
    "newer_than_cutoff": 1786694083,
    "newer_than_cutoff_iso": "2026-08-14T07:54:43.000Z",
    "is_newer_than_cutoff": false
  },
  {
    "pk": "3956336239959704459",
    "id": "3956336239959704459_2237970730",
    "code": "DbnutlCzYOL",
    "taken_at": 1785852456,
    "media_type": 1,
    "product_type": "feed",
    "caption": {
      "pk": "18056596610784564",
      "text": "Malaysia Healthcare Expo Yogyakarta hadir kembali di Pakuwon Mall Jogja!🇲🇾🏥\n\nCari informasi seputar medical check-up, pengobatan, hingga medical tourism langsung dari rumah sakit ternama di Malaysia!\n\nCatat tanggalnya! \n🗓 20–23 Agustus 2026\n📍 Grand Atrium, Ground Floor\n\nJangan lewatkan kesempatan untuk merencanakan perjalanan kesehatan Anda dengan mudah dan nyaman 🤍\n\n#pakuwonmalljogja"
    },
    "like_count": 38,
    "comment_count": 0,
    "original_width": 3072,
    "original_height": 4096,
    "user": {
      "pk": "2237970730",
      "username": "pakuwonmall.jogja",
      "full_name": "Pakuwon Mall Jogja",
      "is_verified": true,
      "profile_pic_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fblr21-2.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gEu-LEw5daxX541lEiSxUxPZKcrV928pxTssZPvMPqA6C4TNxpiehqdLevVo1GxV5M&_nc_ohc=L9VCN6COaTMQ7kNvwG0TIqd&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQFTwHdjGQGRKLG9xFmU2gkSS6jWIvVpbZz3Gu1PJ9KT-A&oe=6A84A633&_nc_sid=ee9879"
    },
    "coauthor_producers": [],
    "invited_coauthor_producers": [],
    "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/764693584_18547370830074731_2050476874872495205_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=106&ig_cache_key=Mzk1NjMzNjIzOTk1OTcwNDQ1OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMzA3Mi5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=5J-SNqpIErYQ7kNvwFtXxil&_nc_oc=AdqJQIbycdsSSEANkeglggoxajB5gkpIGUjJytRqbH5IukxdHPm7CUEw-d185PISprQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQEKVdZlrz-TZAGKWf4JnXstdS-DbNisr3p24ueeJ6w6iQ&oe=6A849D44",
    "scraped_username": "pakuwonmall.jogja",
    "scraped_at": 1786695139,
    "post_url": "https://www.instagram.com/p/DbnutlCzYOL/",
    "newer_than_cutoff": 1786694083,
    "newer_than_cutoff_iso": "2026-08-14T07:54:43.000Z",
    "is_newer_than_cutoff": false
  },
  {
    "pk": "3956074067262283706",
    "id": "3956074067262283706_2237970730",
    "code": "DbmzGdsTZ-6",
    "taken_at": 1785820860,
    "media_type": 1,
    "product_type": "feed",
    "caption": {
      "pk": "18002979155779613",
      "text": "🚗💨 Something BIG is racing your way!\n\nSiap-siap seru-seruan di Play With Us Vol. 2 Hobby & Toys Expo! 🎮🏎️\n\nDiecast, Race Simulator, dan masih banyak keseruan lainnya! \n\n🗓️ 7–16 Agustus\n📍 Grand Atrium Pakuwon Mall Jogja\n\nMark your calendar and stay tuned! 👀🔥\n\n#pakuwonmalljogja"
    },
    "like_count": 82,
    "comment_count": 11,
    "original_width": 1350,
    "original_height": 1688,
    "user": {
      "pk": "2237970730",
      "username": "pakuwonmall.jogja",
      "full_name": "Pakuwon Mall Jogja",
      "is_verified": true,
      "profile_pic_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fblr21-2.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gEu-LEw5daxX541lEiSxUxPZKcrV928pxTssZPvMPqA6C4TNxpiehqdLevVo1GxV5M&_nc_ohc=L9VCN6COaTMQ7kNvwG0TIqd&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQFTwHdjGQGRKLG9xFmU2gkSS6jWIvVpbZz3Gu1PJ9KT-A&oe=6A84A633&_nc_sid=ee9879"
    },
    "coauthor_producers": [],
    "invited_coauthor_producers": [],
    "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/764800395_18547284985074731_2507257377805797516_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=107&ig_cache_key=Mzk1NjA3NDA2NzI2MjI4MzcwNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=xB0--FJwidEQ7kNvwFUZ-Ql&_nc_oc=AdpElRi3kvtqCRQwB6JzQ6WSP9BWnUQfGx-u7_FXC9Zh48LeOJs7ahE8QpFpviLxXJw&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQFZNQry92SAAZW5Eb-3x9UbBbx8pGe-8NFNNpYsvga0gg&oe=6A8491A7",
    "scraped_username": "pakuwonmall.jogja",
    "scraped_at": 1786695139,
    "post_url": "https://www.instagram.com/p/DbmzGdsTZ-6/",
    "newer_than_cutoff": 1786694083,
    "newer_than_cutoff_iso": "2026-08-14T07:54:43.000Z",
    "is_newer_than_cutoff": false
  },
  {
    "pk": "3963399684031061677",
    "id": "3963399684031061677_2237970730",
    "code": "DcA0wN9kR6t",
    "taken_at": 1786694082,
    "media_type": 8,
    "product_type": "carousel_container",
    "caption": {
      "pk": "18107025394875385",
      "text": "See your freedom, and see it in style with @saturdays.lifestyle \n\n🤩 Nikmati potongan 17% dengan minimum pembelian 1,495k (tidak berlaku untuk produk kolaborasi). Kunjungi SATURDAYS di Pakuwon Mall Yogyakarta, Lantai 1, mulai 15–21 Agustus.\n\n#pakuwonmalljogja"
    },
    "like_count": 1,
    "comment_count": 0,
    "original_width": 1179,
    "original_height": 1472,
    "user": {
      "pk": "2237970730",
      "username": "pakuwonmall.jogja",
      "full_name": "Pakuwon Mall Jogja",
      "is_verified": true,
      "profile_pic_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fblr21-2.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gEu-LEw5daxX541lEiSxUxPZKcrV928pxTssZPvMPqA6C4TNxpiehqdLevVo1GxV5M&_nc_ohc=L9VCN6COaTMQ7kNvwG0TIqd&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQFTwHdjGQGRKLG9xFmU2gkSS6jWIvVpbZz3Gu1PJ9KT-A&oe=6A84A633&_nc_sid=ee9879"
    },
    "carousel_media": [
      {
        "pk": "3963399359387099922",
        "id": "3963399359387099922_2237970730",
        "media_type": 1,
        "original_width": 1179,
        "original_height": 1472,
        "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwGrjsjb&_nc_oc=AdpGqm5xXNRdkcPeu0ryU0tpcKZIcR2jSMK_GElEFFTQu_GkxO3ydZHFEQC9ymz0Ljw&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQElc8FtsAD-_LRo5P2t0bWwYRXAyFZWEkpqPWxgEgXodA&oe=6A84A079"
      },
      {
        "pk": "3963399365443567878",
        "id": "3963399365443567878_2237970730",
        "media_type": 1,
        "original_width": 1280,
        "original_height": 1598,
        "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/773677339_18549990886074731_8172470030301429879_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5OTM2NTQ0MzU2Nzg3OA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=rQ3qJwMO5EAQ7kNvwEkIrnp&_nc_oc=AdqkzlCgPTv-PO6rbZtuaWjuprnQ_xOvtiC6DpKgg7h18XQypOzPYEZkA0bjOp9ACXk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQHDr2khGhyv6O-qWmCBg6x_kazo2sOwGAhXbEmgJySpAA&oe=6A849BF1"
      }
    ],
    "coauthor_producers": [],
    "invited_coauthor_producers": [],
    "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwGrjsjb&_nc_oc=AdpGqm5xXNRdkcPeu0ryU0tpcKZIcR2jSMK_GElEFFTQu_GkxO3ydZHFEQC9ymz0Ljw&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQElc8FtsAD-_LRo5P2t0bWwYRXAyFZWEkpqPWxgEgXodA&oe=6A84A079",
    "scraped_username": "pakuwonmall.jogja",
    "scraped_at": 1786695139,
    "post_url": "https://www.instagram.com/p/DcA0wN9kR6t/",
    "newer_than_cutoff": 1786694083,
    "newer_than_cutoff_iso": "2026-08-14T07:54:43.000Z",
    "is_newer_than_cutoff": false
  },
  {
    "pk": "3963398885586570584",
    "id": "3963398885586570584_2237970730",
    "code": "DcA0kmWkQ1Y",
    "taken_at": 1786693987,
    "media_type": 8,
    "product_type": "carousel_container",
    "caption": {
      "pk": "18107668222854310",
      "text": "🇮🇩✨ SPESIAL PROMO KEMERDEKAAN DI BUNAACA! ✨🇮🇩\n\nMerdeka makin manis! 😍🍩 Nikmati promo BUY 2 GET 1 FREE untuk semua varian yang tersedia!\n\n📅 17 Agustus 2026\n\n📍 Bunaaca Pakuwon Mall Jogja — LG Floor, depan Lobby B\n\n#pakuwonmalljogja"
    },
    "like_count": 7,
    "comment_count": 0,
    "original_width": 1620,
    "original_height": 2025,
    "user": {
      "pk": "2237970730",
      "username": "pakuwonmall.jogja",
      "full_name": "Pakuwon Mall Jogja",
      "is_verified": true,
      "profile_pic_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fblr21-2.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gEu-LEw5daxX541lEiSxUxPZKcrV928pxTssZPvMPqA6C4TNxpiehqdLevVo1GxV5M&_nc_ohc=L9VCN6COaTMQ7kNvwG0TIqd&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQFTwHdjGQGRKLG9xFmU2gkSS6jWIvVpbZz3Gu1PJ9KT-A&oe=6A84A633&_nc_sid=ee9879"
    },
    "carousel_media": [
      {
        "pk": "3963398729117297599",
        "id": "3963398729117297599_2237970730",
        "media_type": 1,
        "original_width": 1620,
        "original_height": 2025,
        "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwGMG9Di&_nc_oc=AdppY8ZdQQulAqNHE6MuVpWH0BzUiq0ql7SVz8Q8C118EzvSbHkYW5mBanHza4oZXqE&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQEJO1FERJRnUm_bp54S-9ct9JbnanyuV6xAz62stWGuWw&oe=6A849592"
      },
      {
        "pk": "3963398747177918526",
        "id": "3963398747177918526_2237970730",
        "media_type": 1,
        "original_width": 2160,
        "original_height": 2700,
        "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/774993881_18549990505074731_1733467400335382529_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=106&ig_cache_key=Mzk2MzM5ODc0NzE3NzkxODUyNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjE2MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Fp63TX-CxpEQ7kNvwFfg7Qj&_nc_oc=AdpH357xubPJ9mUmj14WzeaWXv_H2LfBFifpaA3BD0j7Pl3XE7f4UQhMwQNll7nKZDo&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQGmujjchDlQRT4b8G4gy1NWBzAwW_OB7rU7mJM9C_Y39Q&oe=6A84ADE7"
      }
    ],
    "coauthor_producers": [],
    "invited_coauthor_producers": [],
    "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwGMG9Di&_nc_oc=AdppY8ZdQQulAqNHE6MuVpWH0BzUiq0ql7SVz8Q8C118EzvSbHkYW5mBanHza4oZXqE&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQEJO1FERJRnUm_bp54S-9ct9JbnanyuV6xAz62stWGuWw&oe=6A849592",
    "scraped_username": "pakuwonmall.jogja",
    "scraped_at": 1786695139,
    "post_url": "https://www.instagram.com/p/DcA0kmWkQ1Y/",
    "newer_than_cutoff": 1786694083,
    "newer_than_cutoff_iso": "2026-08-14T07:54:43.000Z",
    "is_newer_than_cutoff": false
  },
  {
    "pk": "3963395413478023137",
    "id": "3963395413478023137_2237970730",
    "code": "DcAzyEsxR_h",
    "taken_at": 1786693646,
    "media_type": 2,
    "product_type": "clips",
    "caption": {
      "pk": "18014955503730166",
      "text": "🔥 CRUNCHMATE NOW OPEN! 🔥\n\nCrunchmate sekarang hadir di Pakuwon Mall Jogja LG Floor! 🤩✨\nJangan sampai lewatkan PROMO SPESIAL BUY 1 GET 1!\n📅 14–20 Agustus 2026\n\nYuk cobain Crunchmate sekarang! 😋🔥\n\n#pakuwonmalljogja"
    },
    "like_count": 10,
    "comment_count": 0,
    "play_count": 866,
    "video_duration": 29.466,
    "original_width": 1080,
    "original_height": 1920,
    "user": {
      "pk": "2237970730",
      "username": "pakuwonmall.jogja",
      "full_name": "Pakuwon Mall Jogja",
      "is_verified": true,
      "profile_pic_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fblr21-2.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gEu-LEw5daxX541lEiSxUxPZKcrV928pxTssZPvMPqA6C4TNxpiehqdLevVo1GxV5M&_nc_ohc=L9VCN6COaTMQ7kNvwG0TIqd&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQFTwHdjGQGRKLG9xFmU2gkSS6jWIvVpbZz3Gu1PJ9KT-A&oe=6A84A633&_nc_sid=ee9879"
    },
    "usertags": {
      "in": [
        {
          "user": {
            "pk": "1228374574",
            "username": "juli_iskandar",
            "full_name": "Juliaty Iskandar",
            "is_verified": false,
            "profile_pic_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.2885-19/54800477_2189592477793980_624948081216978944_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby45NjAuYzIifQ&_nc_ht=instagram.fblr21-2.fna.fbcdn.net&_nc_cat=100&_nc_oc=Q6cZ2gEu-LEw5daxX541lEiSxUxPZKcrV928pxTssZPvMPqA6C4TNxpiehqdLevVo1GxV5M&_nc_ohc=Iz2JRul0k6kQ7kNvwFeRC3A&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQESPDoq0lv-u6RWefaZPytdak_LXhlJMHD-crLha7P85Q&oe=6A8492D0&_nc_sid=ee9879"
          },
          "position": [
            0,
            0
          ]
        },
        {
          "user": {
            "pk": "1581178877",
            "username": "vickyratihw",
            "full_name": "Vicky Ratih",
            "is_verified": false,
            "profile_pic_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.2885-19/145976495_717061658996801_8615672779095137678_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby43MjAuYzIifQ&_nc_ht=instagram.fblr21-2.fna.fbcdn.net&_nc_cat=105&_nc_oc=Q6cZ2gEu-LEw5daxX541lEiSxUxPZKcrV928pxTssZPvMPqA6C4TNxpiehqdLevVo1GxV5M&_nc_ohc=NEQAeZQ5-dcQ7kNvwE9GylN&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQGdWALo0VbUiOdvubWBNzpntvuc-Rwch-XvR-8rtZ5Zpg&oe=6A849B1B&_nc_sid=ee9879"
          },
          "position": [
            0,
            0
          ]
        },
        {
          "user": {
            "pk": "4012187437",
            "username": "tanpurnomosidi",
            "full_name": "Tan Purnomosidi",
            "is_verified": true,
            "profile_pic_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.2885-19/122597843_342367900160616_7189706853388346855_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=instagram.fblr21-2.fna.fbcdn.net&_nc_cat=100&_nc_oc=Q6cZ2gEu-LEw5daxX541lEiSxUxPZKcrV928pxTssZPvMPqA6C4TNxpiehqdLevVo1GxV5M&_nc_ohc=z4pokypaePIQ7kNvwFA3EV6&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQF1ylCNohwrlZYeBIoTWgd_ilU4zLIqVTi10T0txWXQHQ&oe=6A849E78&_nc_sid=ee9879"
          },
          "position": [
            0,
            0
          ]
        }
      ]
    },
    "coauthor_producers": [],
    "invited_coauthor_producers": [],
    "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/773756666_18549989311074731_7591783819368902774_n.jpg?stp=dst-jpg_e15_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5NTQxMzQ3ODAyMzEzNzE4NTQ5OTg5MzA1MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=mzszszFNp7QQ7kNvwGPIrnU&_nc_oc=AdpwYJ8ULCK5a4VuolElbpMLrb-PH33CehZbLV9Dqe0tUzD36yoSpWdInPOm8y7MXkM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQEmv7UuN_pRHFV0cpwI2A7j0WHJfGqqABFGvfoquiqerg&oe=6A849B87",
    "video_url": "https://instagram.fblr21-2.fna.fbcdn.net/o1/v/t2/f2/m86/AQPW1xBV6GTA3dwXu0_G8_z4xkzuX9IOsruu9nkYqRbzMCrZoPvIk_5m9r16I6ZjbyquJu3xnSu2D2Id-Qjor2mOrrzz1HAgg36yKRA.mp4?_nc_cat=111&_nc_oc=AdpW90bPhg6cnQApcTqr92PP43sj6VxSvP4otJABnd-1GsU7jiP-tnrPPdS2HUmBr3U&_nc_sid=5e9851&_nc_ht=instagram.fblr21-2.fna.fbcdn.net&_nc_ohc=QDOA9g00bsQQ7kNvwELNsDR&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTU5NjYyOTkwODU2NDczMywiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjoyOSwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=599f7cf31d94d0a9&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC8wQTRGNjdGRjZDNUNCNjE4QUVBNzAwMjM1NjZGMTZBRV92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyL0UyNEMwNUREQjQzM0EzQ0ZGNTQ2ODA0Qjc1NTgwOUI5X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACb6q83oi4jWBRUCKAJDMywXQD13S8an754YEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_zt=28&_nc_ss=7a22e&oh=00_AQF7fWjYtIqJvUqAfSBg8uA-0DZSwvMjRBSy9LiNMqcvHA&oe=6A80A6D0",
    "scraped_username": "pakuwonmall.jogja",
    "scraped_at": 1786695139,
    "post_url": "https://www.instagram.com/p/DcAzyEsxR_h/",
    "newer_than_cutoff": 1786694083,
    "newer_than_cutoff_iso": "2026-08-14T07:54:43.000Z",
    "is_newer_than_cutoff": false
  },
  {
    "pk": "3963391870218908290",
    "id": "3963391870218908290_2237970730",
    "code": "DcAy-gyEbKC",
    "taken_at": 1786693150,
    "media_type": 8,
    "product_type": "carousel_container",
    "caption": {
      "pk": "18031386119838770",
      "text": "🇮🇩 MERDEKA BELANJA, MERDEKA HEMAT! 🇮🇩\n\nRayakan kemerdekaan dengan promo spesial dari JETE! 🔥\nNikmati DISKON 50% OFF ALL ITEMS khusus produk JETE! 🎉\n\n🗓️ 15–17 Agustus 2026\n\nSaatnya lengkapi kebutuhan gadget kamu dengan harga lebih hemat! ⚡\nJangan sampai kelewatan, cuma 3 hari!\n\n#JETE #JETEIndonesia #MerdekaBelanja #MerdekaHemat #PromoJETE"
    },
    "like_count": 0,
    "comment_count": 0,
    "original_width": 1179,
    "original_height": 1553,
    "user": {
      "pk": "2237970730",
      "username": "pakuwonmall.jogja",
      "full_name": "Pakuwon Mall Jogja",
      "is_verified": true,
      "profile_pic_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fblr21-2.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gEu-LEw5daxX541lEiSxUxPZKcrV928pxTssZPvMPqA6C4TNxpiehqdLevVo1GxV5M&_nc_ohc=L9VCN6COaTMQ7kNvwG0TIqd&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQFTwHdjGQGRKLG9xFmU2gkSS6jWIvVpbZz3Gu1PJ9KT-A&oe=6A84A633&_nc_sid=ee9879"
    },
    "carousel_media": [
      {
        "pk": "3963391725485245627",
        "id": "3963391725485245627_2237970730",
        "media_type": 1,
        "original_width": 1179,
        "original_height": 1553,
        "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwGlFYZP&_nc_oc=AdobQ4ga64Sknu16ihPWrZJSrCx3Cu3oGgNZOOgd5MEQzZeolRKUPP3aZt5CLk8i7jI&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQE2RuywR-INc_HFjpZsekwLB-q5FBuyLV1kI6_IJr0iCQ&oe=6A84A99B"
      },
      {
        "pk": "3963391730602226991",
        "id": "3963391730602226991_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1419,
        "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/774126206_18549987868074731_4694917732896217054_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5MTczMDYwMjIyNjk5MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=d0lEgnt4zpsQ7kNvwGhm-wx&_nc_oc=AdomQDWeLe3GUvC9-CPX0-bqcO2Jvj1u_YX-YP2R6ihGuGhKdpZ7U7ScI3Kl77JXMe4&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQFA2Rh9jvpy7qwyVgWPOjkjnVmWNSBxz0JO0yd1K5nnhg&oe=6A84A9B3"
      }
    ],
    "coauthor_producers": [],
    "invited_coauthor_producers": [],
    "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwGlFYZP&_nc_oc=AdobQ4ga64Sknu16ihPWrZJSrCx3Cu3oGgNZOOgd5MEQzZeolRKUPP3aZt5CLk8i7jI&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQE2RuywR-INc_HFjpZsekwLB-q5FBuyLV1kI6_IJr0iCQ&oe=6A84A99B",
    "scraped_username": "pakuwonmall.jogja",
    "scraped_at": 1786695139,
    "post_url": "https://www.instagram.com/p/DcAy-gyEbKC/",
    "newer_than_cutoff": 1786694083,
    "newer_than_cutoff_iso": "2026-08-14T07:54:43.000Z",
    "is_newer_than_cutoff": false
  },
  {
    "pk": "3963390113577264213",
    "id": "3963390113577264213_2237970730",
    "code": "DcAyk8yEWRV",
    "taken_at": 1786692941,
    "media_type": 8,
    "product_type": "carousel_container",
    "caption": {
      "pk": "17990526807001418",
      "text": "🇮🇩 MAKAN STEAK + MINUM DI @holycow_id CUMA 81 RIBUAN 🇮🇩\n\n‼️ *PROMO KEMERDEKAAN* ‼️\n\n1 Holychicken! Steak Series + 1 Flavored Tea\n\n*CUMA Rp 81.000++*\n\n_(Pilihan menu: Holychicken! Steak, African Chicken Steak dan Piccata Chicken Steak)_\n\n🗓 *16 - 17 Agustus 2026*\n\n Ajak teman makanmu & langsung aja ke @holycow_id TKP Yogyakarta Lantai 2 & nikmatin promonya sebelum kehabisan!🔥\n \nUntuk info lainnya cek @holycow_id ‼️\n\nSyarat & Ketentuan:\n- Hanya berlaku untuk transaksi Dine In\n- Berlaku hanya pada pilihan menu Holychicken! steak, African Chicken Steak & Piccata Steak saja.\n- Harga belum termasuk Tax & Service\n- Hanya berlaku pada tanggal 16 - 17 Agustus 2026\n- Tidak dapat digabungkan dengan promo lain & tidak berlaku untuk pembayaran dengan voucher\n- Berlaku di semua TKP Steak Hotel by HOLYCOW! Termasuk Steak Hotel by HOLYCOW! Express, (Tidak berlaku di TKP Bandara Halim Perdana Kusuma)\"\n\n#pakuwonmalljogja"
    },
    "like_count": 1,
    "comment_count": 0,
    "original_width": 1279,
    "original_height": 1600,
    "user": {
      "pk": "2237970730",
      "username": "pakuwonmall.jogja",
      "full_name": "Pakuwon Mall Jogja",
      "is_verified": true,
      "profile_pic_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fblr21-2.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gEu-LEw5daxX541lEiSxUxPZKcrV928pxTssZPvMPqA6C4TNxpiehqdLevVo1GxV5M&_nc_ohc=L9VCN6COaTMQ7kNvwG0TIqd&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQFTwHdjGQGRKLG9xFmU2gkSS6jWIvVpbZz3Gu1PJ9KT-A&oe=6A84A633&_nc_sid=ee9879"
    },
    "carousel_media": [
      {
        "pk": "3963389966914225522",
        "id": "3963389966914225522_2237970730",
        "media_type": 1,
        "original_width": 1279,
        "original_height": 1600,
        "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwHFzLjS&_nc_oc=AdqDR_8qjYRDlNqTrySwJ-SYPSduDxzPMQtWQJ0FesqBkwfyT4qZHyszoy9cH0tP-Gc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQHLwi5_0zRhLK-zdDWt-Y7WHoNZAvPwk4aG-7huRmcEJw&oe=6A84A534"
      },
      {
        "pk": "3963389973591710994",
        "id": "3963389973591710994_2237970730",
        "media_type": 1,
        "original_width": 1279,
        "original_height": 1600,
        "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/774184470_18549987364074731_6828912551799453495_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=100&ig_cache_key=Mzk2MzM4OTk3MzU5MTcxMDk5NA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Tg8OKqOcftoQ7kNvwGA_uB8&_nc_oc=Adp4ST_h8-vZU3njCz6xbjFEuJqURdT6zJC2DaKjfNASGJuY8SXYZOzbKvYI_Eb0bX4&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQEHoM7g50DVUQBmhSmig-YEXrSfpLgdGSOXBfDJ9qXk9Q&oe=6A84A1DC"
      }
    ],
    "coauthor_producers": [],
    "invited_coauthor_producers": [],
    "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwHFzLjS&_nc_oc=AdqDR_8qjYRDlNqTrySwJ-SYPSduDxzPMQtWQJ0FesqBkwfyT4qZHyszoy9cH0tP-Gc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQHLwi5_0zRhLK-zdDWt-Y7WHoNZAvPwk4aG-7huRmcEJw&oe=6A84A534",
    "scraped_username": "pakuwonmall.jogja",
    "scraped_at": 1786695139,
    "post_url": "https://www.instagram.com/p/DcAyk8yEWRV/",
    "newer_than_cutoff": 1786694083,
    "newer_than_cutoff_iso": "2026-08-14T07:54:43.000Z",
    "is_newer_than_cutoff": false
  },
  {
    "pk": "3963381371133254330",
    "id": "3963381371133254330_5583800796",
    "code": "DcAwluvzFq6",
    "taken_at": 1786692365,
    "media_type": 2,
    "product_type": "clips",
    "caption": {
      "pk": "18118598980874844",
      "text": "The BIG Playground in Jogja balik lagi! 🥳✨\n\nDari tanggal 7 - 16 Agustus 2026, Pakuwon Mall Jogja menghadirkan kembali Play With Us di Grand Atrium! 🎮🏎️\n\nWahananya lengkap dan seru-seru banget:\n🏎️ Diecast Playland\n🚗 Big Foot Cars Sirkuit\n🚜 RC Excavator Area\n🧗 RC Adventure Arena\n🏎️ F1 Race Simulator\n\nTiket masuknya terjangkau banget, mulai dari Rp 35.000 aja! Pas banget buat ajak si kecil main minggu ini!\n\n📍 Grand Atrium - Pakuwon Mall Jogja\n📅 7 - 16 Agustus 2026\n\nJangan sampai kelewatan ya! 😉👇\n\n#PlayWithUs #PakuwonMallJogja #PlaygroundJogja #WisataAnakJogja #EventJogja KulinerJogja InfoJogja"
    },
    "like_count": 19,
    "comment_count": 1,
    "play_count": 1152,
    "video_duration": 37.103,
    "original_width": 1080,
    "original_height": 1920,
    "user": {
      "pk": "5583800796",
      "username": "tikanoviia",
      "full_name": "Jogja. Visit. Riview. Endorse beauty jogja",
      "is_verified": false,
      "profile_pic_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-19/764422827_18449884999184797_5609079917339959651_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=instagram.fblr21-2.fna.fbcdn.net&_nc_cat=101&_nc_oc=Q6cZ2gEu-LEw5daxX541lEiSxUxPZKcrV928pxTssZPvMPqA6C4TNxpiehqdLevVo1GxV5M&_nc_ohc=trwzeMeArjEQ7kNvwHPU5q1&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQE7nrfbeM4VQvkLvEGUVowXRGIMbWlvwCqEsDJOWKEgWw&oe=6A84870B&_nc_sid=ee9879"
    },
    "usertags": {
      "in": [
        {
          "user": {
            "pk": "2237970730",
            "username": "pakuwonmall.jogja",
            "full_name": "Pakuwon Mall Jogja",
            "is_verified": true,
            "profile_pic_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fblr21-2.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gEu-LEw5daxX541lEiSxUxPZKcrV928pxTssZPvMPqA6C4TNxpiehqdLevVo1GxV5M&_nc_ohc=L9VCN6COaTMQ7kNvwG0TIqd&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQFTwHdjGQGRKLG9xFmU2gkSS6jWIvVpbZz3Gu1PJ9KT-A&oe=6A84A633&_nc_sid=ee9879"
          },
          "position": [
            0,
            0
          ]
        },
        {
          "user": {
            "pk": "3935681658",
            "username": "travellingkejogja",
            "full_name": "Travelling Ke Jogja",
            "is_verified": false,
            "profile_pic_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-19/615267211_18437987830129659_618848764352237694_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby45NTcuYzIifQ&_nc_ht=instagram.fblr21-2.fna.fbcdn.net&_nc_cat=103&_nc_oc=Q6cZ2gEu-LEw5daxX541lEiSxUxPZKcrV928pxTssZPvMPqA6C4TNxpiehqdLevVo1GxV5M&_nc_ohc=LIcP1SCMPJYQ7kNvwG0fCFD&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQHgixDn9VnXO3m4bIySqwUlLpS3q89UDIfnK4K0d22Hzw&oe=6A84B458&_nc_sid=ee9879"
          },
          "position": [
            0,
            0
          ]
        },
        {
          "user": {
            "pk": "58358071611",
            "username": "jogjajalanmakan",
            "full_name": "KulineranJogja",
            "is_verified": false,
            "profile_pic_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.2885-19/503134034_17957002415951612_2203695640052218324_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby40NTMuYzIifQ&_nc_ht=instagram.fblr21-2.fna.fbcdn.net&_nc_cat=108&_nc_oc=Q6cZ2gEu-LEw5daxX541lEiSxUxPZKcrV928pxTssZPvMPqA6C4TNxpiehqdLevVo1GxV5M&_nc_ohc=NT8hBhqAQu0Q7kNvwE0Kjer&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQG2KpLMqfi1XfdDF1Q8VXUI3SJpRR4xoHLDydBFO2hGnQ&oe=6A84B59D&_nc_sid=ee9879"
          },
          "position": [
            0,
            0
          ]
        },
        {
          "user": {
            "pk": "72514061469",
            "username": "jogjaniceinfo",
            "full_name": "Jogja Nice Info",
            "is_verified": false,
            "profile_pic_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.2885-19/476246031_1175898783868049_2571657218397445928_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby41MDAuYzIifQ&_nc_ht=instagram.fblr21-2.fna.fbcdn.net&_nc_cat=105&_nc_oc=Q6cZ2gEu-LEw5daxX541lEiSxUxPZKcrV928pxTssZPvMPqA6C4TNxpiehqdLevVo1GxV5M&_nc_ohc=Bg_y-hr151cQ7kNvwEcoy0N&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQGQsJiiYuIcS2Zu8B-9zSOMWmJeMMZuldlTmumSr8a96w&oe=6A8493D3&_nc_sid=ee9879"
          },
          "position": [
            0,
            0
          ]
        },
        {
          "user": {
            "pk": "79589453676",
            "username": "kolaborasijateng",
            "full_name": "KOLABORASI JAWA TENGAH | Media Promosi & Informasi di Jateng",
            "is_verified": true,
            "profile_pic_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-19/635010153_17853252258653677_2013522932633231966_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=instagram.fblr21-2.fna.fbcdn.net&_nc_cat=1&_nc_oc=Q6cZ2gEu-LEw5daxX541lEiSxUxPZKcrV928pxTssZPvMPqA6C4TNxpiehqdLevVo1GxV5M&_nc_ohc=OiJqpJco89wQ7kNvwF1D79x&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQHhZkDmDyDiKtBn1qifivAgS3m6NPtTHil74mZKr4IpZA&oe=6A84A7C3&_nc_sid=ee9879"
          },
          "position": [
            0,
            0
          ]
        }
      ]
    },
    "location": {
      "pk": "350725118605524",
      "facebook_places_id": "350725118605524",
      "external_source": "facebook_places",
      "name": "Pakuwon Mall Jogja",
      "address": "Jl. Ring Road Utara Condong Catur",
      "city": "",
      "has_viewer_saved": false,
      "short_name": "Pakuwon Mall Jogja",
      "lng": 110.39890560439,
      "lat": -7.7599800319605
    },
    "coauthor_producers": [
      {
        "pk": "2237970730",
        "username": "pakuwonmall.jogja",
        "full_name": "Pakuwon Mall Jogja",
        "is_verified": true,
        "profile_pic_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fblr21-2.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gEu-LEw5daxX541lEiSxUxPZKcrV928pxTssZPvMPqA6C4TNxpiehqdLevVo1GxV5M&_nc_ohc=L9VCN6COaTMQ7kNvwG0TIqd&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQFTwHdjGQGRKLG9xFmU2gkSS6jWIvVpbZz3Gu1PJ9KT-A&oe=6A84A633&_nc_sid=ee9879"
      }
    ],
    "invited_coauthor_producers": [],
    "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/774905443_18451629595184797_1785892812524699280_n.jpg?stp=dst-jpg_e15_tt6&_nc_cat=105&ig_cache_key=Mzk2MzM4MTM3MTEzMzI1NDMzMDE4NDUxNjI5NTkyMTg0Nzk3.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMTcuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=JycmgP1YCyEQ7kNvwHSnTa6&_nc_oc=AdrroHr3WKtdYkRbzWGtNIpk0kvtMOYUClybTThuDLReYJyu_4Tmsnz_E7KT9ry4XIg&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQFIGRkxl2MxIAk0brNkkHBRnRsqLGQsBzr5PEaM34FMTQ&oe=6A848EF5",
    "video_url": "https://instagram.fblr21-2.fna.fbcdn.net/o1/v/t2/f2/m86/AQO9kR_ciied0fswp2LUBawsDCnx3MwCq0eQzRWkhrX76Fsi851c8-69h1KJ-fetFnVvKc6BQbgAs0rFPy9nLhoAIPX1oH06aFPIPvw.mp4?_nc_cat=101&_nc_oc=Adp3fNliBjW2HqfTn9XpCim0PEEIYek7YDcIzDMogTRVgK2Zw6uu2FEiGdux7yhMWyY&_nc_sid=5e9851&_nc_ht=instagram.fblr21-2.fna.fbcdn.net&_nc_ohc=KsBQAWG-Z2QQ7kNvwG4QzCy&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MjUyMDgxMDU0NTA5MTgyMiwiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjozNywidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=8c2c88aa60a04e68&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC9ERTQyRTZBNzVDNzEyMzQ2MDk1MENFQzdEQUZCOTZBNF92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyL0E0NEQ5QTU0NzBFQzkzNzQyQkRDODIzQjRCQkI4MEI0X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACbc07CRvqr6CBUCKAJDMywXQEKMzMzMzM0YEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_zt=28&_nc_ss=7a22e&oh=00_AQGRFATEsk97IwRW6wqo8NpI1cluewul06psASCMGEIa8w&oe=6A80BF5E",
    "scraped_username": "pakuwonmall.jogja",
    "scraped_at": 1786695139,
    "post_url": "https://www.instagram.com/p/DcAwluvzFq6/",
    "newer_than_cutoff": 1786694083,
    "newer_than_cutoff_iso": "2026-08-14T07:54:43.000Z",
    "is_newer_than_cutoff": false
  },
  {
    "pk": "3963290610605662960",
    "id": "3963290610605662960_38851997261",
    "code": "DcAb8_ayqLw",
    "taken_at": 1786681171,
    "media_type": 1,
    "product_type": "feed",
    "caption": {
      "pk": "17985166535862108",
      "text": "BUY POTATO MOZZA, FREE ORIGINAL! \n\nCheesy, crunchy, and even better with a FREE Original! 🤤\nDon’t miss it! 🩷🖤\n\n📍 Available at Pakuwon Mall Jogja, LG\n📆 August 14-20, 2026"
    },
    "like_count": 93,
    "comment_count": 2,
    "original_width": 3277,
    "original_height": 4096,
    "user": {
      "pk": "38851997261",
      "username": "crunchmate.id",
      "full_name": "Crunchmate.id",
      "is_verified": false,
      "profile_pic_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-19/662721383_18075054686293262_6929357337730779975_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=instagram.fblr21-2.fna.fbcdn.net&_nc_cat=102&_nc_oc=Q6cZ2gEu-LEw5daxX541lEiSxUxPZKcrV928pxTssZPvMPqA6C4TNxpiehqdLevVo1GxV5M&_nc_ohc=VKPv3NVqtG4Q7kNvwHvgidp&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQGEaFC-6hOHUTWnWWlo4yG7lWCakxgktgNWmYVdmuDHfw&oe=6A84A30C&_nc_sid=ee9879"
    },
    "usertags": {
      "in": [
        {
          "user": {
            "pk": "2237970730",
            "username": "pakuwonmall.jogja",
            "full_name": "Pakuwon Mall Jogja",
            "is_verified": true,
            "profile_pic_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fblr21-2.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gEu-LEw5daxX541lEiSxUxPZKcrV928pxTssZPvMPqA6C4TNxpiehqdLevVo1GxV5M&_nc_ohc=L9VCN6COaTMQ7kNvwG0TIqd&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQFTwHdjGQGRKLG9xFmU2gkSS6jWIvVpbZz3Gu1PJ9KT-A&oe=6A84A633&_nc_sid=ee9879"
          },
          "position": [
            0.5,
            0.5
          ]
        }
      ]
    },
    "coauthor_producers": [
      {
        "pk": "2237970730",
        "username": "pakuwonmall.jogja",
        "full_name": "Pakuwon Mall Jogja",
        "is_verified": true,
        "profile_pic_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fblr21-2.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gEu-LEw5daxX541lEiSxUxPZKcrV928pxTssZPvMPqA6C4TNxpiehqdLevVo1GxV5M&_nc_ohc=L9VCN6COaTMQ7kNvwG0TIqd&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQFTwHdjGQGRKLG9xFmU2gkSS6jWIvVpbZz3Gu1PJ9KT-A&oe=6A84A633&_nc_sid=ee9879"
      }
    ],
    "invited_coauthor_producers": [],
    "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/773519823_18095763680293262_8938356023924758124_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=110&ig_cache_key=Mzk2MzI5MDYxMDYwNTY2Mjk2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMzI3Ny5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=bR_QmgaA9WgQ7kNvwG84c3s&_nc_oc=AdqScvWzw-hj_kFpAv4cVxG0OYteaq2uMaPW4TpBPtXwg-P1S9S8Oz5BrN4jXKjCfWo&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQG5cDlaGBh5TW21Gw-2Y8yD8UZWKX2hTqWfW-a-UzQFUw&oe=6A848B24",
    "scraped_username": "pakuwonmall.jogja",
    "scraped_at": 1786695139,
    "post_url": "https://www.instagram.com/p/DcAb8_ayqLw/",
    "newer_than_cutoff": 1786694083,
    "newer_than_cutoff_iso": "2026-08-14T07:54:43.000Z",
    "is_newer_than_cutoff": false
  },
  {
    "pk": "3963231873169665456",
    "id": "3963231873169665456_38851997261",
    "code": "DcAOmP6yK2w",
    "taken_at": 1786674727,
    "media_type": 1,
    "product_type": "feed",
    "caption": {
      "pk": "17874674763548867",
      "text": "JOGJA, WE’RE HERE‼️\n\nSomething crispy, cheesy & delicious has officially landed at Pakuwon Mall Jogja! 🇰🇷🔥\n\nSay hello to Crunchmate your best spot for Korean snacks! And yashhh .. we’re celebrating our GRAND OPENING With a special promo 👇🏻\n\nBUY 1 GET 1\nBuy Korean Snack Potato Mozza and FREE Korean Snack  Original\n\nSo, who’s ready for their first CRUNCH? 👀🩷🖤\n📍 Crunchmate — Pakuwon Mall Jogja, LG\n📅 August 14, 2026\n\nTag your snack buddy and come say ANYEONG! 🇰🇷✨\n#CrunchmateJogja #Crunchmate #jogjafoodies #PakuwonMallJogja"
    },
    "like_count": 40,
    "comment_count": 0,
    "original_width": 1350,
    "original_height": 1688,
    "user": {
      "pk": "38851997261",
      "username": "crunchmate.id",
      "full_name": "Crunchmate.id",
      "is_verified": false,
      "profile_pic_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-19/662721383_18075054686293262_6929357337730779975_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=instagram.fblr21-2.fna.fbcdn.net&_nc_cat=102&_nc_oc=Q6cZ2gEu-LEw5daxX541lEiSxUxPZKcrV928pxTssZPvMPqA6C4TNxpiehqdLevVo1GxV5M&_nc_ohc=VKPv3NVqtG4Q7kNvwHvgidp&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQGEaFC-6hOHUTWnWWlo4yG7lWCakxgktgNWmYVdmuDHfw&oe=6A84A30C&_nc_sid=ee9879"
    },
    "usertags": {
      "in": [
        {
          "user": {
            "pk": "2237970730",
            "username": "pakuwonmall.jogja",
            "full_name": "Pakuwon Mall Jogja",
            "is_verified": true,
            "profile_pic_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fblr21-2.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gEu-LEw5daxX541lEiSxUxPZKcrV928pxTssZPvMPqA6C4TNxpiehqdLevVo1GxV5M&_nc_ohc=L9VCN6COaTMQ7kNvwG0TIqd&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQFTwHdjGQGRKLG9xFmU2gkSS6jWIvVpbZz3Gu1PJ9KT-A&oe=6A84A633&_nc_sid=ee9879"
          },
          "position": [
            0.63526570048309,
            0.98366012983024
          ]
        }
      ]
    },
    "coauthor_producers": [
      {
        "pk": "2237970730",
        "username": "pakuwonmall.jogja",
        "full_name": "Pakuwon Mall Jogja",
        "is_verified": true,
        "profile_pic_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fblr21-2.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gEu-LEw5daxX541lEiSxUxPZKcrV928pxTssZPvMPqA6C4TNxpiehqdLevVo1GxV5M&_nc_ohc=L9VCN6COaTMQ7kNvwG0TIqd&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQFTwHdjGQGRKLG9xFmU2gkSS6jWIvVpbZz3Gu1PJ9KT-A&oe=6A84A633&_nc_sid=ee9879"
      }
    ],
    "invited_coauthor_producers": [],
    "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/773686629_18095748581293262_1334211002783647391_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=111&ig_cache_key=Mzk2MzIzMTg3MzE2OTY2NTQ1Ng%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=9WICmp3CiZAQ7kNvwHF03z-&_nc_oc=Adq3adWcVg9Z_cZatJdkrSgRJlwxkKQ1d0aKJjKnUSpp_hgZhsUKUogB8OriRvRG_Ck&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQGNd6IaJh_ud5MgP4ZEOrB4lbSnJlq0sqUibQ4q3EfrNg&oe=6A84AE37",
    "scraped_username": "pakuwonmall.jogja",
    "scraped_at": 1786695139,
    "post_url": "https://www.instagram.com/p/DcAOmP6yK2w/",
    "newer_than_cutoff": 1786694083,
    "newer_than_cutoff_iso": "2026-08-14T07:54:43.000Z",
    "is_newer_than_cutoff": false
  },
  {
    "pk": "3963187739466369600",
    "id": "3963187739466369600_2237970730",
    "code": "DcAEkBNE4pA",
    "taken_at": 1786668816,
    "media_type": 8,
    "product_type": "carousel_container",
    "caption": {
      "pk": "17894838036596153",
      "text": "PAKUWON MALL JOGJA MERDEKA SALE 🇮🇩‼️\n\nNikmati berbagai promo dari tenant favoritmu hanya di Pakuwon Mall Jogja 😍\n\n#pakuwonmalljogja"
    },
    "like_count": 55,
    "comment_count": 2,
    "original_width": 1080,
    "original_height": 1350,
    "user": {
      "pk": "2237970730",
      "username": "pakuwonmall.jogja",
      "full_name": "Pakuwon Mall Jogja",
      "is_verified": true,
      "profile_pic_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fblr21-2.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gEu-LEw5daxX541lEiSxUxPZKcrV928pxTssZPvMPqA6C4TNxpiehqdLevVo1GxV5M&_nc_ohc=L9VCN6COaTMQ7kNvwG0TIqd&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQFTwHdjGQGRKLG9xFmU2gkSS6jWIvVpbZz3Gu1PJ9KT-A&oe=6A84A633&_nc_sid=ee9879"
    },
    "carousel_media": [
      {
        "pk": "3963187120441374997",
        "id": "3963187120441374997_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1350,
        "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwEpkvm2&_nc_oc=Adq96TeNUU4nJtMXuLsR2BasIHnrSv1BWrKhY7DylXRIrmDFwwvLvQbrbITFjXM7P4g&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQHe-PC8m3LwwuaxbF7rIsep1yFXiiCIwY3DqrUPk4bbTg&oe=6A84A629"
      },
      {
        "pk": "3963187121053532667",
        "id": "3963187121053532667_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1350,
        "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/773714201_18549917278074731_831497186886304937_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=107&ig_cache_key=Mzk2MzE4NzEyMTA1MzUzMjY2Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wmOiCYwiW8kQ7kNvwGK9xN4&_nc_oc=Ado7IWC3kOH39Tn2XAH5jWmgSFZv_tAY0NcduHUvCeB8aM8Ie32LghyOL7tdscNid7s&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQEeu8aHehOZlV-gGxuubojPMI76JsxghALrX-bE9cHHZg&oe=6A84ADA1"
      },
      {
        "pk": "3963187121590626706",
        "id": "3963187121590626706_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1350,
        "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/773811749_18549917314074731_2734247693651828101_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=101&ig_cache_key=Mzk2MzE4NzEyMTU5MDYyNjcwNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=yB-hhIAUWKUQ7kNvwFpAqrD&_nc_oc=AdpryxYmLc4GCzFsdZafwCE_mSsyz5XsqMvkjzX3JqAZp2_tpk-LT-QIHJ1crToaBJ8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQHyLqYZvUWaJFnz3p3Aogf2jxMgH9FuTFroICQRXZJKNw&oe=6A848D82"
      },
      {
        "pk": "3963187121355678060",
        "id": "3963187121355678060_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1350,
        "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/773725407_18549917287074731_5028384550837806014_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMTM1NTY3ODA2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=UXuACi-QUMYQ7kNvwHzqqLj&_nc_oc=AdqsZ5lE6P1R97Y1SoH8gk1lZe52p5rvwhweliauw8qtLBncQYZJ-ppKb1kaqPtB21o&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQHzDw1g56IgtllSrxa8OJw0iNEOJlaTum74N-4h1md83g&oe=6A84A96C"
      },
      {
        "pk": "3963187123276587738",
        "id": "3963187123276587738_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1350,
        "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/774281083_18549917305074731_8908467008525322143_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=104&ig_cache_key=Mzk2MzE4NzEyMzI3NjU4NzczOA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=OxHr2SEQarQQ7kNvwGWl_jH&_nc_oc=AdrvYAYIMYbNp-QTSbFFL4gnQACfsE1f6c9lO0IpW1V2x974eR1PwaORwB9JTB6AkB8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQHUx9CCc_vQKHyHbBXSksRFyc3-KhJCbKVYfXpDBm_buA&oe=6A84AAE1"
      },
      {
        "pk": "3963187127403706219",
        "id": "3963187127403706219_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1350,
        "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/772714522_18549917329074731_7712275684327689571_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=106&ig_cache_key=Mzk2MzE4NzEyNzQwMzcwNjIxOQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=MXx0pnAfv74Q7kNvwGQEtM3&_nc_oc=Adrs2QGgpLCXZ4CnjVGi2laZmfEpxfKMrbhPqhTJMS1bONYVq_REKvSIjy9J-gHHu8Y&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQH0N7ANxCGX_ku1dMVM28FKqCnIiZHV_yza3kOAErYh-g&oe=6A84A6FD"
      }
    ],
    "coauthor_producers": [],
    "invited_coauthor_producers": [],
    "image_url": "https://instagram.fblr21-2.fna.fbcdn.net/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwEpkvm2&_nc_oc=Adq96TeNUU4nJtMXuLsR2BasIHnrSv1BWrKhY7DylXRIrmDFwwvLvQbrbITFjXM7P4g&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fblr21-2.fna&_nc_gid=ZlQQPjLsEaKg0KO5cFCXVQ&_nc_ss=7a22e&oh=00_AQHe-PC8m3LwwuaxbF7rIsep1yFXiiCIwY3DqrUPk4bbTg&oe=6A84A629",
    "scraped_username": "pakuwonmall.jogja",
    "scraped_at": 1786695139,
    "post_url": "https://www.instagram.com/p/DcAEkBNE4pA/",
    "newer_than_cutoff": 1786694083,
    "newer_than_cutoff_iso": "2026-08-14T07:54:43.000Z",
    "is_newer_than_cutoff": false
  }
]
```
