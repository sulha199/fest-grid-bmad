# Task 1c — Run 7: sones/instagram-posts-scraper-lowcost — Scenario A (baseline)

Part of [3-4d-per-use-case-actor-selection-and-sync-path-timeout.md](../3-4d-per-use-case-actor-selection-and-sync-path-timeout.md) Task 1c. Expected: ≥10 items. This actor has no `isPinned` field and no documented skip-pinned option — check any returned item's timestamp against the 3 known pinned timestamps (`2026-08-01T03:58:43Z`, `2026-08-04T05:21:00Z`, `2026-08-04T14:07:36Z`) to detect a leak.

**Input params:** `{"usernames": ["pakuwonmall.jogja"], "postsPerProfile": 15, "newerThan": "2026-08-10T00:00:00Z", "proxy": {"useApifyProxy": true}, "maxRetries": 3, "maxConcurrentProfiles": 1, "delayBetweenProfiles": 250, "delayBetweenRequests": 500}`

* **Date/Time:** 2026-08-14 15:01:41
* **Run ID:** [fFhJm3XhvumotqCUR](https://console.apify.com/actors/Y5mzw9TLFReI0d6gQ/runs/fFhJm3XhvumotqCUR#output)
* **Duration:** 14 s

- Cost ($):
  * **Post (15):** \$0.0045
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
      "profile_pic_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fath4-2.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gFu1djuJAwO6Euy1dkIhjpsGuIFs2tne_unpuGC3FqfsKEk6qiQ7pUrp5Xk_JLwOvI&_nc_ohc=L9VCN6COaTMQ7kNvwGFGUv5&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQERuQcO91LXyoR9lLgX773T6cjsLuT7eAhHzqROPUNLUQ&oe=6A84A633&_nc_sid=ee9879"
    },
    "carousel_media": [
      {
        "pk": "3956094351184797729",
        "id": "3956094351184797729_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1350,
        "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/764373463_18547291300074731_6625151285942470618_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=105&ig_cache_key=Mzk1NjA5NDM1MTE4NDc5NzcyOQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=vDVCLCL91uEQ7kNvwGZZGUr&_nc_oc=AdpYWBB4IG-jkZLdpx8GmENsUnx2WnoJM8_gihaCaZDgrfzWZp6b3uAfavRABEOWCVU&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQE_7NoJ1WV9nZHlgBTmVrxLWv8clTA94hwTLMXbibun4w&oe=6A849C32"
      },
      {
        "pk": "3956094352711512407",
        "id": "3956094352711512407_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1350,
        "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/763375083_18547291291074731_8940045769077676301_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=105&ig_cache_key=Mzk1NjA5NDM1MjcxMTUxMjQwNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=ZXjH0FqGg4sQ7kNvwGqTCyH&_nc_oc=AdrzUpq2mXfbu_KorL9EvyazP1e6HWeyKf8DXlwW151b-HjJeq9xaHoiHwBIk8cwC98&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQEBbM30e9KdRVwKzNhVk3Ox8kPBVYtgb4aWs_T3MDeMJg&oe=6A84ABC8"
      },
      {
        "pk": "3956094356528409165",
        "id": "3956094356528409165_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1350,
        "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/762828649_18547291357074731_3495933672133029009_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=101&ig_cache_key=Mzk1NjA5NDM1NjUyODQwOTE2NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Fqi70fcgvugQ7kNvwFtb0qa&_nc_oc=Adr3sXoviUmIdCi2YjMzIpcceyGBj3I397TERvEnOkXMxFrmpaAMtAXk6RoQqChscn4&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQG4bCNRlJZ8QwsPs5bWWDqrVyiWDR6HnyIUV4Oqa_Lv9w&oe=6A849F79"
      },
      {
        "pk": "3956094354909530741",
        "id": "3956094354909530741_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1350,
        "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/764719268_18547291309074731_3021930272927779711_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=110&ig_cache_key=Mzk1NjA5NDM1NDkwOTUzMDc0MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=FAwemyCJkyYQ7kNvwGsDEtD&_nc_oc=AdqUbKY3lp4ffe33sIPpkYRwwFBIpxzS2X584JY0w1llzT8QL3v89aCui1bkaJL3IR4&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQE4jjpW9vlz55qAZVrk2SosLt1Dcz692hQZYI2hvWgB3g&oe=6A848B72"
      },
      {
        "pk": "3956094355261715295",
        "id": "3956094355261715295_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1350,
        "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/765052041_18547291321074731_1830188309625751900_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=103&ig_cache_key=Mzk1NjA5NDM1NTI2MTcxNTI5NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=DotbowcVs7cQ7kNvwH_HXRA&_nc_oc=AdqiRwZlh4SpFmU_q8fGfuMcSeUeqHE3dkC_JF4Y8Dkjw4xN9Mp72RKEcUup40rhWKs&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQFu5ixdt87Dq_5Nt1czXv7ZrtsiL8Aa6IKdYVD4t9qm_w&oe=6A849A00"
      },
      {
        "pk": "3956094357685973312",
        "id": "3956094357685973312_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1350,
        "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/763332220_18547291360074731_8371349148896458578_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=107&ig_cache_key=Mzk1NjA5NDM1NzY4NTk3MzMxMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=W6CAqa2JATgQ7kNvwHq39ia&_nc_oc=AdrpZ2JYxLjA7edTZTVa_V2By3djKZ7CFhkHzI82rfIoGUGl6yzb1lzk0KOcpqRfkxI&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQHAXSNn1yyqH7vJsOXqwxXLfhSXTuvq-bSfQ7WGo0c9dQ&oe=6A8487C4"
      },
      {
        "pk": "3956094358449416169",
        "id": "3956094358449416169_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1350,
        "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/764373463_18547291366074731_80672179490973639_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=102&ig_cache_key=Mzk1NjA5NDM1ODQ0OTQxNjE2OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=QIkiIK9eVWQQ7kNvwG0wVax&_nc_oc=Adq7fYm1Fdr697tvLwzaa9tE9FYpe_1AUuLUhy_yL1laBbRLlbsPg2Vqu_uNNhu3UFU&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQFGpMnch21RQ7ccOBBiWOV0ccJUOqTczof0vzR99bagkg&oe=6A8482F4"
      },
      {
        "pk": "3956094355605807523",
        "id": "3956094355605807523_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1350,
        "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/763112299_18547291336074731_9031499566455898762_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=104&ig_cache_key=Mzk1NjA5NDM1NTYwNTgwNzUyMw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=27t4AQIlfgQQ7kNvwFgrg7F&_nc_oc=Adrj9VUmZW2wF0HdGvkP9Jo3AR3qFqz1qMoanE16iBeHu3LJltR2NhiDkaHNBV-cG20&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQGkKyjHl-DbSCSy3suqa7rNes5Q6TGi-yCQmdD4s_iMFQ&oe=6A84AA7B"
      },
      {
        "pk": "3956094356721490147",
        "id": "3956094356721490147_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1350,
        "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/763486821_18547291378074731_8588557685248871023_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=111&ig_cache_key=Mzk1NjA5NDM1NjcyMTQ5MDE0Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=1dkCTxYVMTYQ7kNvwGV1iAr&_nc_oc=AdpXJLjq9LfSAEAViPHQcjwNjWWSFASNUmzIPSIGOKyaHyUxBfUhTxE_ibLYQqHTji0&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQH64Zlu6lXO4rilZHczgOaIAS4hsJ3Ou2dbA-o_xvFGYg&oe=6A848FCC"
      },
      {
        "pk": "3956094356738143971",
        "id": "3956094356738143971_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1350,
        "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/764752256_18547291363074731_7018336778015186283_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=103&ig_cache_key=Mzk1NjA5NDM1NjczODE0Mzk3MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=eJoCM0NNhy0Q7kNvwGU4VT3&_nc_oc=Ado5V3sU6MRELgLm0Ml6yhdgq1hIi-yzq-tE6f9IES7zBkfNDOiP9r46cqfuoUPWQuU&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQFRtLow4OvKSqyBnrbctM9oY_aizdRxVz-qOUWEYXGr8w&oe=6A848E45"
      },
      {
        "pk": "3956094372189900691",
        "id": "3956094372189900691_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1350,
        "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/762737454_18547291387074731_3120110141880693049_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=104&ig_cache_key=Mzk1NjA5NDM3MjE4OTkwMDY5MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=tGh5yJ3BZOkQ7kNvwHz4d1m&_nc_oc=AdoSvsAo2yu6urr482Z49c-zaktlyV2ynAnmTPOWgPEJENOBEjTJkOlCHGvf0smk2Ac&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQGat5U0zh0MkbrqY3nkhB_4r4OXppKcMkxf2AwdZmKxnA&oe=6A84A623"
      }
    ],
    "coauthor_producers": [],
    "invited_coauthor_producers": [],
    "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/764373463_18547291300074731_6625151285942470618_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=105&ig_cache_key=Mzk1NjA5NDM1MTE4NDc5NzcyOQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=vDVCLCL91uEQ7kNvwGZZGUr&_nc_oc=AdpYWBB4IG-jkZLdpx8GmENsUnx2WnoJM8_gihaCaZDgrfzWZp6b3uAfavRABEOWCVU&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQE_7NoJ1WV9nZHlgBTmVrxLWv8clTA94hwTLMXbibun4w&oe=6A849C32",
    "scraped_username": "pakuwonmall.jogja",
    "scraped_at": 1786694508,
    "post_url": "https://www.instagram.com/p/Dbm3x30EwWu/",
    "newer_than_cutoff": 1786320000,
    "newer_than_cutoff_iso": "2026-08-10T00:00:00.000Z",
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
      "profile_pic_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fath4-2.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gFu1djuJAwO6Euy1dkIhjpsGuIFs2tne_unpuGC3FqfsKEk6qiQ7pUrp5Xk_JLwOvI&_nc_ohc=L9VCN6COaTMQ7kNvwGFGUv5&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQERuQcO91LXyoR9lLgX773T6cjsLuT7eAhHzqROPUNLUQ&oe=6A84A633&_nc_sid=ee9879"
    },
    "coauthor_producers": [],
    "invited_coauthor_producers": [],
    "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/764693584_18547370830074731_2050476874872495205_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=106&ig_cache_key=Mzk1NjMzNjIzOTk1OTcwNDQ1OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMzA3Mi5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=5J-SNqpIErYQ7kNvwEML-rt&_nc_oc=AdpP662kxQf2ksYp3VFKtoFnwmCi9TkEiiKljyFlel1p2JxO4ylvwogoV1JvT894T4M&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQHyZ9P8hSac91jXwkRPBa9Em113nPnBOIV6l1HqXz66UQ&oe=6A849D44",
    "scraped_username": "pakuwonmall.jogja",
    "scraped_at": 1786694508,
    "post_url": "https://www.instagram.com/p/DbnutlCzYOL/",
    "newer_than_cutoff": 1786320000,
    "newer_than_cutoff_iso": "2026-08-10T00:00:00.000Z",
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
      "profile_pic_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fath4-2.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gFu1djuJAwO6Euy1dkIhjpsGuIFs2tne_unpuGC3FqfsKEk6qiQ7pUrp5Xk_JLwOvI&_nc_ohc=L9VCN6COaTMQ7kNvwGFGUv5&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQERuQcO91LXyoR9lLgX773T6cjsLuT7eAhHzqROPUNLUQ&oe=6A84A633&_nc_sid=ee9879"
    },
    "coauthor_producers": [],
    "invited_coauthor_producers": [],
    "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/764800395_18547284985074731_2507257377805797516_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=107&ig_cache_key=Mzk1NjA3NDA2NzI2MjI4MzcwNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=xB0--FJwidEQ7kNvwG-uNOZ&_nc_oc=Adr1v-m16nVOYN1ah8cJFuUqrKVimz-68QnhyRsW8I6eVnCt1cgSRIYHysGLibqlwAw&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQEhDFeEDmQA1HisQ1rheuH5HkDIeug_Ssku4Ev8PerAIQ&oe=6A8491A7",
    "scraped_username": "pakuwonmall.jogja",
    "scraped_at": 1786694508,
    "post_url": "https://www.instagram.com/p/DbmzGdsTZ-6/",
    "newer_than_cutoff": 1786320000,
    "newer_than_cutoff_iso": "2026-08-10T00:00:00.000Z",
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
    "like_count": 0,
    "comment_count": 0,
    "original_width": 1179,
    "original_height": 1472,
    "user": {
      "pk": "2237970730",
      "username": "pakuwonmall.jogja",
      "full_name": "Pakuwon Mall Jogja",
      "is_verified": true,
      "profile_pic_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fath4-2.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gFu1djuJAwO6Euy1dkIhjpsGuIFs2tne_unpuGC3FqfsKEk6qiQ7pUrp5Xk_JLwOvI&_nc_ohc=L9VCN6COaTMQ7kNvwGFGUv5&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQERuQcO91LXyoR9lLgX773T6cjsLuT7eAhHzqROPUNLUQ&oe=6A84A633&_nc_sid=ee9879"
    },
    "carousel_media": [
      {
        "pk": "3963399359387099922",
        "id": "3963399359387099922_2237970730",
        "media_type": 1,
        "original_width": 1179,
        "original_height": 1472,
        "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwH4S2Yx&_nc_oc=Adojsrc7QBYajCklFpwY7X7DWhhqaKzwiTS0N-NEJm6BUG1lgCeiddkWiVVVsQc3Gk4&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQFwYztaMkQpKRLxiYl-_6XrjcGmCyS7fIchBVTbD57xfA&oe=6A84A079"
      },
      {
        "pk": "3963399365443567878",
        "id": "3963399365443567878_2237970730",
        "media_type": 1,
        "original_width": 1280,
        "original_height": 1598,
        "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/773677339_18549990886074731_8172470030301429879_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5OTM2NTQ0MzU2Nzg3OA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=rQ3qJwMO5EAQ7kNvwESkXlG&_nc_oc=Adq2At-JIFlYEuR4GThHAUW_egH6yXDuSWCU1BKw4nQ5hO55HwYoLvvqHttQN01sEd8&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQGXJo-QlGKscPXoLD73kuvg2IwflZMSCJLYZidv3_16xA&oe=6A849BF1"
      }
    ],
    "coauthor_producers": [],
    "invited_coauthor_producers": [],
    "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwH4S2Yx&_nc_oc=Adojsrc7QBYajCklFpwY7X7DWhhqaKzwiTS0N-NEJm6BUG1lgCeiddkWiVVVsQc3Gk4&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQFwYztaMkQpKRLxiYl-_6XrjcGmCyS7fIchBVTbD57xfA&oe=6A84A079",
    "scraped_username": "pakuwonmall.jogja",
    "scraped_at": 1786694508,
    "post_url": "https://www.instagram.com/p/DcA0wN9kR6t/",
    "newer_than_cutoff": 1786320000,
    "newer_than_cutoff_iso": "2026-08-10T00:00:00.000Z",
    "is_newer_than_cutoff": true
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
    "like_count": 4,
    "comment_count": 0,
    "original_width": 1620,
    "original_height": 2025,
    "user": {
      "pk": "2237970730",
      "username": "pakuwonmall.jogja",
      "full_name": "Pakuwon Mall Jogja",
      "is_verified": true,
      "profile_pic_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fath4-2.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gFu1djuJAwO6Euy1dkIhjpsGuIFs2tne_unpuGC3FqfsKEk6qiQ7pUrp5Xk_JLwOvI&_nc_ohc=L9VCN6COaTMQ7kNvwGFGUv5&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQERuQcO91LXyoR9lLgX773T6cjsLuT7eAhHzqROPUNLUQ&oe=6A84A633&_nc_sid=ee9879"
    },
    "carousel_media": [
      {
        "pk": "3963398729117297599",
        "id": "3963398729117297599_2237970730",
        "media_type": 1,
        "original_width": 1620,
        "original_height": 2025,
        "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwHpopgE&_nc_oc=Adolnju-OSEvmjz1Ya7sh3B3PaVSNvJIpQvodFwiRKPKpVozTv4PoYvIRGJrRInLH1c&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQEL2ipkhUHlr1qM6-JvVCa98M6YgmMpI0ncjcZCJv5o2g&oe=6A849592"
      },
      {
        "pk": "3963398747177918526",
        "id": "3963398747177918526_2237970730",
        "media_type": 1,
        "original_width": 2160,
        "original_height": 2700,
        "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/774993881_18549990505074731_1733467400335382529_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=106&ig_cache_key=Mzk2MzM5ODc0NzE3NzkxODUyNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjE2MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Fp63TX-CxpEQ7kNvwFIhBlC&_nc_oc=AdoU9h2CJFt7yvVGvqUuuQVgoHwuncyX6yvHDP9bN3oxMpxqfaiz3-94bQLHxea3HZQ&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQGl7-5Mqb19lDH5zLDic0J06HFQpoxzUDkHq2E2NLK4HA&oe=6A84ADE7"
      }
    ],
    "coauthor_producers": [],
    "invited_coauthor_producers": [],
    "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwHpopgE&_nc_oc=Adolnju-OSEvmjz1Ya7sh3B3PaVSNvJIpQvodFwiRKPKpVozTv4PoYvIRGJrRInLH1c&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQEL2ipkhUHlr1qM6-JvVCa98M6YgmMpI0ncjcZCJv5o2g&oe=6A849592",
    "scraped_username": "pakuwonmall.jogja",
    "scraped_at": 1786694508,
    "post_url": "https://www.instagram.com/p/DcA0kmWkQ1Y/",
    "newer_than_cutoff": 1786320000,
    "newer_than_cutoff_iso": "2026-08-10T00:00:00.000Z",
    "is_newer_than_cutoff": true
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
    "like_count": 6,
    "comment_count": 0,
    "play_count": 501,
    "video_duration": 29.466,
    "original_width": 1080,
    "original_height": 1920,
    "user": {
      "pk": "2237970730",
      "username": "pakuwonmall.jogja",
      "full_name": "Pakuwon Mall Jogja",
      "is_verified": true,
      "profile_pic_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fath4-2.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gFu1djuJAwO6Euy1dkIhjpsGuIFs2tne_unpuGC3FqfsKEk6qiQ7pUrp5Xk_JLwOvI&_nc_ohc=L9VCN6COaTMQ7kNvwGFGUv5&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQERuQcO91LXyoR9lLgX773T6cjsLuT7eAhHzqROPUNLUQ&oe=6A84A633&_nc_sid=ee9879"
    },
    "usertags": {
      "in": [
        {
          "user": {
            "pk": "1228374574",
            "username": "juli_iskandar",
            "full_name": "Juliaty Iskandar",
            "is_verified": false,
            "profile_pic_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.2885-19/54800477_2189592477793980_624948081216978944_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby45NjAuYzIifQ&_nc_ht=instagram.fath4-2.fna.fbcdn.net&_nc_cat=100&_nc_oc=Q6cZ2gFu1djuJAwO6Euy1dkIhjpsGuIFs2tne_unpuGC3FqfsKEk6qiQ7pUrp5Xk_JLwOvI&_nc_ohc=Iz2JRul0k6kQ7kNvwFr7yGO&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQF0jgPp0WD_vrm9hiP1iIfh_7dVpIcR-aj50oQ2H4ojkA&oe=6A8492D0&_nc_sid=ee9879"
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
            "profile_pic_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.2885-19/145976495_717061658996801_8615672779095137678_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby43MjAuYzIifQ&_nc_ht=instagram.fath4-2.fna.fbcdn.net&_nc_cat=105&_nc_oc=Q6cZ2gFu1djuJAwO6Euy1dkIhjpsGuIFs2tne_unpuGC3FqfsKEk6qiQ7pUrp5Xk_JLwOvI&_nc_ohc=NEQAeZQ5-dcQ7kNvwFF4pI6&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQEpFtN40kHw8XzKtPZMlMt7VNrBnuq-WdJ9ziLRjBZz4g&oe=6A849B1B&_nc_sid=ee9879"
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
            "profile_pic_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.2885-19/122597843_342367900160616_7189706853388346855_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=instagram.fath4-2.fna.fbcdn.net&_nc_cat=100&_nc_oc=Q6cZ2gFu1djuJAwO6Euy1dkIhjpsGuIFs2tne_unpuGC3FqfsKEk6qiQ7pUrp5Xk_JLwOvI&_nc_ohc=z4pokypaePIQ7kNvwFmkVgy&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQEXcYVunwlx3RGbON2mDUXa44uvy4ZO4CjhedWqphWaoA&oe=6A849E78&_nc_sid=ee9879"
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
    "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/773756666_18549989311074731_7591783819368902774_n.jpg?stp=dst-jpg_e15_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5NTQxMzQ3ODAyMzEzNzE4NTQ5OTg5MzA1MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=mzszszFNp7QQ7kNvwF-vktk&_nc_oc=AdrjuHiG4qb0e58RaJM7D9hZjHiKla-4X6b-fn_m18yPpvbUYJZvUbYQt1juFubRJAc&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQHPZTWYD9kPXFW0wMKD8qkSN3C5JTc18-_y0cCCtmMFoA&oe=6A849B87",
    "video_url": "https://instagram.fath4-2.fna.fbcdn.net/o1/v/t2/f2/m86/AQPW1xBV6GTA3dwXu0_G8_z4xkzuX9IOsruu9nkYqRbzMCrZoPvIk_5m9r16I6ZjbyquJu3xnSu2D2Id-Qjor2mOrrzz1HAgg36yKRA.mp4?_nc_cat=111&_nc_oc=AdpQ5V1DbDty7UvBzTIQ4auJQQmn3BapUloHqZXDKxwC0wkQfffFdhXNl5ay8x47ScY&_nc_sid=5e9851&_nc_ht=instagram.fath4-2.fna.fbcdn.net&_nc_ohc=QDOA9g00bsQQ7kNvwH-zfYG&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTU5NjYyOTkwODU2NDczMywiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjoyOSwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=599f7cf31d94d0a9&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC8wQTRGNjdGRjZDNUNCNjE4QUVBNzAwMjM1NjZGMTZBRV92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyL0UyNEMwNUREQjQzM0EzQ0ZGNTQ2ODA0Qjc1NTgwOUI5X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACb6q83oi4jWBRUCKAJDMywXQD13S8an754YEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_zt=28&_nc_ss=7a22e&oh=00_AQGegZ9chuO_njGTwF---PGFn_a7cMqiygV1LTgOgrP0gA&oe=6A80A6D0",
    "scraped_username": "pakuwonmall.jogja",
    "scraped_at": 1786694508,
    "post_url": "https://www.instagram.com/p/DcAzyEsxR_h/",
    "newer_than_cutoff": 1786320000,
    "newer_than_cutoff_iso": "2026-08-10T00:00:00.000Z",
    "is_newer_than_cutoff": true
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
      "profile_pic_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fath4-2.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gFu1djuJAwO6Euy1dkIhjpsGuIFs2tne_unpuGC3FqfsKEk6qiQ7pUrp5Xk_JLwOvI&_nc_ohc=L9VCN6COaTMQ7kNvwGFGUv5&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQERuQcO91LXyoR9lLgX773T6cjsLuT7eAhHzqROPUNLUQ&oe=6A84A633&_nc_sid=ee9879"
    },
    "carousel_media": [
      {
        "pk": "3963391725485245627",
        "id": "3963391725485245627_2237970730",
        "media_type": 1,
        "original_width": 1179,
        "original_height": 1553,
        "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwE99GIq&_nc_oc=AdooObbH5YzYBahqOEYWNmg24_i3UrMhDcbLQTsL-k_QOYpcdb8k4_kgdBleQfdxyng&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQEnvuqOgxEAdfXNA0xEsKC_Xlvh7L0gLsmCBl0TpTsNow&oe=6A84A99B"
      },
      {
        "pk": "3963391730602226991",
        "id": "3963391730602226991_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1419,
        "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/774126206_18549987868074731_4694917732896217054_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5MTczMDYwMjIyNjk5MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kCq2k3DBkGkQ7kNvwEAxKbX&_nc_oc=AdqyBqlPI3YDlTceJIkSSxyrjWF2uYb01jWc5G2iKoGI7g1JYo41U5IV8m4Kn7Sx0Fo&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQFs14tNaESOu5fen7_TfTNExZbSWi33eE4uzVY_conMfg&oe=6A84A9B3"
      }
    ],
    "coauthor_producers": [],
    "invited_coauthor_producers": [],
    "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwE99GIq&_nc_oc=AdooObbH5YzYBahqOEYWNmg24_i3UrMhDcbLQTsL-k_QOYpcdb8k4_kgdBleQfdxyng&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQEnvuqOgxEAdfXNA0xEsKC_Xlvh7L0gLsmCBl0TpTsNow&oe=6A84A99B",
    "scraped_username": "pakuwonmall.jogja",
    "scraped_at": 1786694508,
    "post_url": "https://www.instagram.com/p/DcAy-gyEbKC/",
    "newer_than_cutoff": 1786320000,
    "newer_than_cutoff_iso": "2026-08-10T00:00:00.000Z",
    "is_newer_than_cutoff": true
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
      "profile_pic_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fath4-2.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gFu1djuJAwO6Euy1dkIhjpsGuIFs2tne_unpuGC3FqfsKEk6qiQ7pUrp5Xk_JLwOvI&_nc_ohc=L9VCN6COaTMQ7kNvwGFGUv5&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQERuQcO91LXyoR9lLgX773T6cjsLuT7eAhHzqROPUNLUQ&oe=6A84A633&_nc_sid=ee9879"
    },
    "carousel_media": [
      {
        "pk": "3963389966914225522",
        "id": "3963389966914225522_2237970730",
        "media_type": 1,
        "original_width": 1279,
        "original_height": 1600,
        "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwFhFiQ6&_nc_oc=AdoT6D4_MbgJ4a8c0mw44XnD8Qu0zLMWmnQxqdeo0mgFKI9QulgEr6zeqeN_nc2x3aA&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQGBD5XYzkygF64aIaY20nL7pOZys4BXt5oXfRV5XrbVUg&oe=6A84A534"
      },
      {
        "pk": "3963389973591710994",
        "id": "3963389973591710994_2237970730",
        "media_type": 1,
        "original_width": 1279,
        "original_height": 1600,
        "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/774184470_18549987364074731_6828912551799453495_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=100&ig_cache_key=Mzk2MzM4OTk3MzU5MTcxMDk5NA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMiJ9&_nc_ohc=Tg8OKqOcftoQ7kNvwHN-Owf&_nc_oc=Adru3B0SbEzIK7l5qM1-yH7sLmsvlgGIgBwtPCYf-Zy3f-VCIpxr2O0u28-WtQWQMfI&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQGJx3SbovT4wdEM3e4TND2uEHOASKwer-W4804IKA54lA&oe=6A84A1DC"
      }
    ],
    "coauthor_producers": [],
    "invited_coauthor_producers": [],
    "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwFhFiQ6&_nc_oc=AdoT6D4_MbgJ4a8c0mw44XnD8Qu0zLMWmnQxqdeo0mgFKI9QulgEr6zeqeN_nc2x3aA&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQGBD5XYzkygF64aIaY20nL7pOZys4BXt5oXfRV5XrbVUg&oe=6A84A534",
    "scraped_username": "pakuwonmall.jogja",
    "scraped_at": 1786694508,
    "post_url": "https://www.instagram.com/p/DcAyk8yEWRV/",
    "newer_than_cutoff": 1786320000,
    "newer_than_cutoff_iso": "2026-08-10T00:00:00.000Z",
    "is_newer_than_cutoff": true
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
    "like_count": 17,
    "comment_count": 1,
    "play_count": 1028,
    "video_duration": 37.103,
    "original_width": 1080,
    "original_height": 1920,
    "user": {
      "pk": "5583800796",
      "username": "tikanoviia",
      "full_name": "Jogja. Visit. Riview. Endorse beauty jogja",
      "is_verified": false,
      "profile_pic_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-19/764422827_18449884999184797_5609079917339959651_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=instagram.fath4-2.fna.fbcdn.net&_nc_cat=101&_nc_oc=Q6cZ2gFu1djuJAwO6Euy1dkIhjpsGuIFs2tne_unpuGC3FqfsKEk6qiQ7pUrp5Xk_JLwOvI&_nc_ohc=trwzeMeArjEQ7kNvwF3iGXt&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQEntJ2JxPVLp_HLIKgxcVK3iVpM9mrcQMUm-ApY2dhjwQ&oe=6A84870B&_nc_sid=ee9879"
    },
    "usertags": {
      "in": [
        {
          "user": {
            "pk": "2237970730",
            "username": "pakuwonmall.jogja",
            "full_name": "Pakuwon Mall Jogja",
            "is_verified": true,
            "profile_pic_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fath4-2.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gFu1djuJAwO6Euy1dkIhjpsGuIFs2tne_unpuGC3FqfsKEk6qiQ7pUrp5Xk_JLwOvI&_nc_ohc=L9VCN6COaTMQ7kNvwGFGUv5&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQERuQcO91LXyoR9lLgX773T6cjsLuT7eAhHzqROPUNLUQ&oe=6A84A633&_nc_sid=ee9879"
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
            "profile_pic_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-19/615267211_18437987830129659_618848764352237694_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby45NTcuYzIifQ&_nc_ht=instagram.fath4-2.fna.fbcdn.net&_nc_cat=103&_nc_oc=Q6cZ2gFu1djuJAwO6Euy1dkIhjpsGuIFs2tne_unpuGC3FqfsKEk6qiQ7pUrp5Xk_JLwOvI&_nc_ohc=LIcP1SCMPJYQ7kNvwHiFWEn&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQFp4LIKNFub7lyrai4UsPbk_Vxc_pMPSqrz-u7tHpy0eA&oe=6A84B458&_nc_sid=ee9879"
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
            "profile_pic_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.2885-19/503134034_17957002415951612_2203695640052218324_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby40NTMuYzIifQ&_nc_ht=instagram.fath4-2.fna.fbcdn.net&_nc_cat=108&_nc_oc=Q6cZ2gFu1djuJAwO6Euy1dkIhjpsGuIFs2tne_unpuGC3FqfsKEk6qiQ7pUrp5Xk_JLwOvI&_nc_ohc=NT8hBhqAQu0Q7kNvwHxdDBB&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQG-JmNyjwOUcyOs4wjJvYoD0f9RZqqZEtP9-XOnPDVOYg&oe=6A84B59D&_nc_sid=ee9879"
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
            "profile_pic_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.2885-19/476246031_1175898783868049_2571657218397445928_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby41MDAuYzIifQ&_nc_ht=instagram.fath4-2.fna.fbcdn.net&_nc_cat=105&_nc_oc=Q6cZ2gFu1djuJAwO6Euy1dkIhjpsGuIFs2tne_unpuGC3FqfsKEk6qiQ7pUrp5Xk_JLwOvI&_nc_ohc=Bg_y-hr151cQ7kNvwEc9wMH&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQE0OdAeemYKTQ4XWf3C50po35DMDgpXMh0BkXl9BtowOQ&oe=6A8493D3&_nc_sid=ee9879"
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
            "profile_pic_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-19/635010153_17853252258653677_2013522932633231966_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=instagram.fath4-2.fna.fbcdn.net&_nc_cat=101&_nc_oc=Q6cZ2gFu1djuJAwO6Euy1dkIhjpsGuIFs2tne_unpuGC3FqfsKEk6qiQ7pUrp5Xk_JLwOvI&_nc_ohc=OiJqpJco89wQ7kNvwHMmxqG&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQFQqPSW3e2lp5w6UfzM4CmGOfRcimWVOlBrm5qBUCebYQ&oe=6A84A7C3&_nc_sid=ee9879"
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
        "profile_pic_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fath4-2.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gFu1djuJAwO6Euy1dkIhjpsGuIFs2tne_unpuGC3FqfsKEk6qiQ7pUrp5Xk_JLwOvI&_nc_ohc=L9VCN6COaTMQ7kNvwGFGUv5&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQERuQcO91LXyoR9lLgX773T6cjsLuT7eAhHzqROPUNLUQ&oe=6A84A633&_nc_sid=ee9879"
      }
    ],
    "invited_coauthor_producers": [],
    "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/774905443_18451629595184797_1785892812524699280_n.jpg?stp=dst-jpg_e15_tt6&_nc_cat=105&ig_cache_key=Mzk2MzM4MTM3MTEzMzI1NDMzMDE4NDUxNjI5NTkyMTg0Nzk3.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMTcuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=JycmgP1YCyEQ7kNvwGXxjp9&_nc_oc=AdqmdGzhkye_sCqhPp87gsPUvGe-yv-kN_YdjYxjhdJ9zxgnxk6Rt0uXUdUaZiC2fNw&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQFfZpY6igOMzOOgFWQ2_2kvg5n4E7nE47AdLUtLu9FPZA&oe=6A848EF5",
    "video_url": "https://instagram.fath4-2.fna.fbcdn.net/o1/v/t2/f2/m86/AQO9kR_ciied0fswp2LUBawsDCnx3MwCq0eQzRWkhrX76Fsi851c8-69h1KJ-fetFnVvKc6BQbgAs0rFPy9nLhoAIPX1oH06aFPIPvw.mp4?_nc_cat=101&_nc_oc=Adq4ZTHTeCx8-VrXr188ibvICpJuXe2yiTHH2Yx10L04bSxNqNPGlB_kpku7_qA2Kg0&_nc_sid=5e9851&_nc_ht=instagram.fath4-2.fna.fbcdn.net&_nc_ohc=KsBQAWG-Z2QQ7kNvwGRa0Q9&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MjUyMDgxMDU0NTA5MTgyMiwiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjozNywidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=8c2c88aa60a04e68&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC9ERTQyRTZBNzVDNzEyMzQ2MDk1MENFQzdEQUZCOTZBNF92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyL0E0NEQ5QTU0NzBFQzkzNzQyQkRDODIzQjRCQkI4MEI0X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACbc07CRvqr6CBUCKAJDMywXQEKMzMzMzM0YEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_zt=28&_nc_ss=7a22e&oh=00_AQFPZSfSusxcl8kZDiu2KQKYPxEnUbllwhwimAY8rGj4qg&oe=6A80BF5E",
    "scraped_username": "pakuwonmall.jogja",
    "scraped_at": 1786694508,
    "post_url": "https://www.instagram.com/p/DcAwluvzFq6/",
    "newer_than_cutoff": 1786320000,
    "newer_than_cutoff_iso": "2026-08-10T00:00:00.000Z",
    "is_newer_than_cutoff": true
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
    "like_count": 87,
    "comment_count": 2,
    "original_width": 3277,
    "original_height": 4096,
    "user": {
      "pk": "38851997261",
      "username": "crunchmate.id",
      "full_name": "Crunchmate.id",
      "is_verified": false,
      "profile_pic_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-19/662721383_18075054686293262_6929357337730779975_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=instagram.fath4-2.fna.fbcdn.net&_nc_cat=102&_nc_oc=Q6cZ2gFu1djuJAwO6Euy1dkIhjpsGuIFs2tne_unpuGC3FqfsKEk6qiQ7pUrp5Xk_JLwOvI&_nc_ohc=VKPv3NVqtG4Q7kNvwHcLKdu&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQFm6Mq4oeDQyIVpKA3QSJW5kAKbyRGi1Z_mYrlXO22Cjg&oe=6A84A30C&_nc_sid=ee9879"
    },
    "usertags": {
      "in": [
        {
          "user": {
            "pk": "2237970730",
            "username": "pakuwonmall.jogja",
            "full_name": "Pakuwon Mall Jogja",
            "is_verified": true,
            "profile_pic_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fath4-2.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gFu1djuJAwO6Euy1dkIhjpsGuIFs2tne_unpuGC3FqfsKEk6qiQ7pUrp5Xk_JLwOvI&_nc_ohc=L9VCN6COaTMQ7kNvwGFGUv5&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQERuQcO91LXyoR9lLgX773T6cjsLuT7eAhHzqROPUNLUQ&oe=6A84A633&_nc_sid=ee9879"
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
        "profile_pic_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fath4-2.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gFu1djuJAwO6Euy1dkIhjpsGuIFs2tne_unpuGC3FqfsKEk6qiQ7pUrp5Xk_JLwOvI&_nc_ohc=L9VCN6COaTMQ7kNvwGFGUv5&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQERuQcO91LXyoR9lLgX773T6cjsLuT7eAhHzqROPUNLUQ&oe=6A84A633&_nc_sid=ee9879"
      }
    ],
    "invited_coauthor_producers": [],
    "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/773519823_18095763680293262_8938356023924758124_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=110&ig_cache_key=Mzk2MzI5MDYxMDYwNTY2Mjk2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMzI3Ny5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=bR_QmgaA9WgQ7kNvwE2eQ1F&_nc_oc=AdpeOCH9t99--xr3XwrXkPOO7LicBnelqllA7WH6xV66fvoxZYw_aAqLskMtFz9-_KI&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQGBQYnzAr1CIepgaofLL1vkg6tXfYN95k1s5Cb6qTEIcw&oe=6A848B24",
    "scraped_username": "pakuwonmall.jogja",
    "scraped_at": 1786694508,
    "post_url": "https://www.instagram.com/p/DcAb8_ayqLw/",
    "newer_than_cutoff": 1786320000,
    "newer_than_cutoff_iso": "2026-08-10T00:00:00.000Z",
    "is_newer_than_cutoff": true
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
      "profile_pic_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-19/662721383_18075054686293262_6929357337730779975_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=instagram.fath4-2.fna.fbcdn.net&_nc_cat=102&_nc_oc=Q6cZ2gFu1djuJAwO6Euy1dkIhjpsGuIFs2tne_unpuGC3FqfsKEk6qiQ7pUrp5Xk_JLwOvI&_nc_ohc=VKPv3NVqtG4Q7kNvwHcLKdu&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQFm6Mq4oeDQyIVpKA3QSJW5kAKbyRGi1Z_mYrlXO22Cjg&oe=6A84A30C&_nc_sid=ee9879"
    },
    "usertags": {
      "in": [
        {
          "user": {
            "pk": "2237970730",
            "username": "pakuwonmall.jogja",
            "full_name": "Pakuwon Mall Jogja",
            "is_verified": true,
            "profile_pic_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fath4-2.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gFu1djuJAwO6Euy1dkIhjpsGuIFs2tne_unpuGC3FqfsKEk6qiQ7pUrp5Xk_JLwOvI&_nc_ohc=L9VCN6COaTMQ7kNvwGFGUv5&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQERuQcO91LXyoR9lLgX773T6cjsLuT7eAhHzqROPUNLUQ&oe=6A84A633&_nc_sid=ee9879"
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
        "profile_pic_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fath4-2.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gFu1djuJAwO6Euy1dkIhjpsGuIFs2tne_unpuGC3FqfsKEk6qiQ7pUrp5Xk_JLwOvI&_nc_ohc=L9VCN6COaTMQ7kNvwGFGUv5&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQERuQcO91LXyoR9lLgX773T6cjsLuT7eAhHzqROPUNLUQ&oe=6A84A633&_nc_sid=ee9879"
      }
    ],
    "invited_coauthor_producers": [],
    "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/773686629_18095748581293262_1334211002783647391_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=111&ig_cache_key=Mzk2MzIzMTg3MzE2OTY2NTQ1Ng%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=9WICmp3CiZAQ7kNvwHriank&_nc_oc=AdpYAqyrutjJP6ed2okoiYny6AwO7FwuCbetP5l9l5HBzIQvQeibWklbzlWmwPqkJIM&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQGh6maXZ-EbKcqeh7m3qPa3I7f59QzMU3aknyGm_ao0jw&oe=6A84AE37",
    "scraped_username": "pakuwonmall.jogja",
    "scraped_at": 1786694508,
    "post_url": "https://www.instagram.com/p/DcAOmP6yK2w/",
    "newer_than_cutoff": 1786320000,
    "newer_than_cutoff_iso": "2026-08-10T00:00:00.000Z",
    "is_newer_than_cutoff": true
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
    "like_count": 53,
    "comment_count": 2,
    "original_width": 1080,
    "original_height": 1350,
    "user": {
      "pk": "2237970730",
      "username": "pakuwonmall.jogja",
      "full_name": "Pakuwon Mall Jogja",
      "is_verified": true,
      "profile_pic_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fath4-2.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gFu1djuJAwO6Euy1dkIhjpsGuIFs2tne_unpuGC3FqfsKEk6qiQ7pUrp5Xk_JLwOvI&_nc_ohc=L9VCN6COaTMQ7kNvwGFGUv5&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQERuQcO91LXyoR9lLgX773T6cjsLuT7eAhHzqROPUNLUQ&oe=6A84A633&_nc_sid=ee9879"
    },
    "carousel_media": [
      {
        "pk": "3963187120441374997",
        "id": "3963187120441374997_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1350,
        "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwGA-yEK&_nc_oc=AdqnNvhHTt0ngIVsAkPLSEJ2Jx3HbRVhY6a7dwfrhLmO_pdsQ1DLD0Ou2YlCLoUZu0w&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQHR3ty2_G14IzvjsfJB207HKrXMvaKJHJTNqBdKy_L1jg&oe=6A84A629"
      },
      {
        "pk": "3963187121053532667",
        "id": "3963187121053532667_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1350,
        "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/773714201_18549917278074731_831497186886304937_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=107&ig_cache_key=Mzk2MzE4NzEyMTA1MzUzMjY2Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wmOiCYwiW8kQ7kNvwGWWIba&_nc_oc=Adosq22NOgBUzOVYjKpGR1bppP2B5aNreFPasnPeRniC3yukYYkpbUtIqAt9G5JfLm0&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQFrvpWtoU1GyoHR_LvM7P7xBZ_AUfNGdBKEdYtEmD2O1w&oe=6A84ADA1"
      },
      {
        "pk": "3963187121590626706",
        "id": "3963187121590626706_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1350,
        "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/773811749_18549917314074731_2734247693651828101_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=101&ig_cache_key=Mzk2MzE4NzEyMTU5MDYyNjcwNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=yB-hhIAUWKUQ7kNvwHW_eJE&_nc_oc=AdqTe9QOKTmOmEOX-ROpCIVoYp4z3B3OTE2Q6jQERzPQIYKyU-kKvpVEZQskl5xDnjs&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQHQrqJuMM1zmMlJIOlBq71IGueNeWf1aYqZ9x0w9UkUyg&oe=6A848D82"
      },
      {
        "pk": "3963187121355678060",
        "id": "3963187121355678060_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1350,
        "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/773725407_18549917287074731_5028384550837806014_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMTM1NTY3ODA2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=UXuACi-QUMYQ7kNvwF-D_eh&_nc_oc=AdrN3-ArKWMVNCCQ5F7GAeLd5cqmiQzXQMQBk-xt1d__VGE8PKnXiCIEc8SHrXePXj8&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQHLcPTC6EU4eBXmikpiWhyKsjWR4Fn9dK9lUsHW1MNIBw&oe=6A84A96C"
      },
      {
        "pk": "3963187123276587738",
        "id": "3963187123276587738_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1350,
        "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/774281083_18549917305074731_8908467008525322143_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=104&ig_cache_key=Mzk2MzE4NzEyMzI3NjU4NzczOA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=OxHr2SEQarQQ7kNvwGFnFvs&_nc_oc=Adp_kZMO8qzAC80ilP7WcSv66BwbMjENBWW1tDJK61SiJCg5Sz0SHqL5dIZ8NEH-STY&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQFAZa8QMXmd3Z0nNyK8tUja3upyjej8kQip4VF7LUtBLw&oe=6A84AAE1"
      },
      {
        "pk": "3963187127403706219",
        "id": "3963187127403706219_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1350,
        "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/772714522_18549917329074731_7712275684327689571_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=106&ig_cache_key=Mzk2MzE4NzEyNzQwMzcwNjIxOQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=MXx0pnAfv74Q7kNvwFK_CVV&_nc_oc=Adoeh6Pfm69zgUF1zBesxI7sHvlrucbQonvZ5g1O3LB67lw3hYl1fVFAR5Hj0M5hJ8c&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQG02D1AvrGu-OdjPahbXoeZrxPF5s3p8POAJ-bVxoOwlw&oe=6A84A6FD"
      }
    ],
    "coauthor_producers": [],
    "invited_coauthor_producers": [],
    "image_url": "https://instagram.fath4-2.fna.fbcdn.net/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwGA-yEK&_nc_oc=AdqnNvhHTt0ngIVsAkPLSEJ2Jx3HbRVhY6a7dwfrhLmO_pdsQ1DLD0Ou2YlCLoUZu0w&_nc_ad=z-m&_nc_cid=1033&_nc_zt=23&_nc_ht=instagram.fath4-2.fna&_nc_gid=vD-PlPo4GqJswML-EDRjEQ&_nc_ss=7a22e&oh=00_AQHR3ty2_G14IzvjsfJB207HKrXMvaKJHJTNqBdKy_L1jg&oe=6A84A629",
    "scraped_username": "pakuwonmall.jogja",
    "scraped_at": 1786694508,
    "post_url": "https://www.instagram.com/p/DcAEkBNE4pA/",
    "newer_than_cutoff": 1786320000,
    "newer_than_cutoff_iso": "2026-08-10T00:00:00.000Z",
    "is_newer_than_cutoff": true
  },
  {
    "pk": "3962867082392210475",
    "id": "3962867082392210475_2237970730",
    "code": "Db-7p2CE4wr",
    "taken_at": 1786630591,
    "media_type": 8,
    "product_type": "carousel_container",
    "caption": {
      "pk": "18061707971782620",
      "text": "Grand Opening ELLE Flagship Store @ellewatchindonesia ✨\nParisian chic, now within reach. Enjoy 17% + 8% OFF all ELLE watches!\n\nVisit our store at Pakuwon Mall Jogja, Ground Floor or contact our Customer Service 085 777 111 666 for more info.\n\n#ELLEIndonesia #ElleWatches #JamTanganElle #pakuwonmalljogja"
    },
    "like_count": 82,
    "comment_count": 0,
    "original_width": 1179,
    "original_height": 1472,
    "user": {
      "pk": "2237970730",
      "username": "pakuwonmall.jogja",
      "full_name": "Pakuwon Mall Jogja",
      "is_verified": true,
      "profile_pic_url": "https://scontent-dfw5-1.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-dfw5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gHhwVnsAGuT3K6GvqG5l8aMcRbTJ1OrvuBdMS79jELzsfijuieWQJcmNr0wFFgq-Jk&_nc_ohc=L9VCN6COaTMQ7kNvwEOs7N6&_nc_gid=j5mkO1JYxj2sUzAtb67aMg&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQGAXJw3dyvqb9sqdNoKfkjh42wahtVenfKfGzytMshzFQ&oe=6A84A633&_nc_sid=ee9879"
    },
    "carousel_media": [
      {
        "pk": "3962866927189944972",
        "id": "3962866927189944972_2237970730",
        "media_type": 1,
        "original_width": 1179,
        "original_height": 1472,
        "image_url": "https://scontent-dfw5-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwEqoEm9&_nc_oc=AdrxdhhSJ6gNII0cXK2klraILoOKP1hs0Rir8gwkKofSbCnyPypPuQwfWP5ryaKCQi0&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-dfw5-2.cdninstagram.com&_nc_gid=j5mkO1JYxj2sUzAtb67aMg&_nc_ss=7a22e&oh=00_AQGo0D9ZPFkGg13nGe1hNPw6Je7CHQ1fBGlt8dXFaQAcGw&oe=6A84A355"
      },
      {
        "pk": "3962866929362565897",
        "id": "3962866929362565897_2237970730",
        "media_type": 1,
        "original_width": 1080,
        "original_height": 1348,
        "image_url": "https://scontent-dfw5-1.cdninstagram.com/v/t51.82787-15/774059549_18549779836074731_2421445589124863786_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2NjkyOTM2MjU2NTg5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=hR5qD571FYAQ7kNvwEySVcF&_nc_oc=AdqxVlytM8ePAS668XFYmCUbDMIm8yofTcnMu4zUI7nEarMKT5OT18JIeVPAAvn0mvA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-dfw5-1.cdninstagram.com&_nc_gid=j5mkO1JYxj2sUzAtb67aMg&_nc_ss=7a22e&oh=00_AQGXv-wGw97SwiMW64lHLwe1qP-DAiF4NM4gg7E_HP8d4w&oe=6A849207"
      }
    ],
    "coauthor_producers": [],
    "invited_coauthor_producers": [],
    "image_url": "https://scontent-dfw5-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwEqoEm9&_nc_oc=AdrxdhhSJ6gNII0cXK2klraILoOKP1hs0Rir8gwkKofSbCnyPypPuQwfWP5ryaKCQi0&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-dfw5-2.cdninstagram.com&_nc_gid=j5mkO1JYxj2sUzAtb67aMg&_nc_ss=7a22e&oh=00_AQGo0D9ZPFkGg13nGe1hNPw6Je7CHQ1fBGlt8dXFaQAcGw&oe=6A84A355",
    "scraped_username": "pakuwonmall.jogja",
    "scraped_at": 1786694508,
    "post_url": "https://www.instagram.com/p/Db-7p2CE4wr/",
    "newer_than_cutoff": 1786320000,
    "newer_than_cutoff_iso": "2026-08-10T00:00:00.000Z",
    "is_newer_than_cutoff": true
  },
  {
    "pk": "3962865174512370672",
    "id": "3962865174512370672_2237970730",
    "code": "Db-7OFLk4Pw",
    "taken_at": 1786630363,
    "media_type": 8,
    "product_type": "carousel_container",
    "caption": {
      "pk": "18089497166227300",
      "text": "🇮🇩 Celebrate Indonesia’s Independence Day with your favorite treats from @TouslesJours.id ! ✨\n\nFrom 14–18 August 2026, enjoy special Independence Day offers:\n 17% OFF — All Items\n 45% OFF — All Beverages\n 10% OFF — Credit & Debit Card Bank Mandiri\nSee you There!\n\n#TouslesJours #promomerdeka #pakuwonmalljogja"
    },
    "like_count": 50,
    "comment_count": 0,
    "original_width": 2048,
    "original_height": 2560,
    "user": {
      "pk": "2237970730",
      "username": "pakuwonmall.jogja",
      "full_name": "Pakuwon Mall Jogja",
      "is_verified": true,
      "profile_pic_url": "https://scontent-dfw5-1.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-dfw5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gHhwVnsAGuT3K6GvqG5l8aMcRbTJ1OrvuBdMS79jELzsfijuieWQJcmNr0wFFgq-Jk&_nc_ohc=L9VCN6COaTMQ7kNvwEOs7N6&_nc_gid=j5mkO1JYxj2sUzAtb67aMg&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQGAXJw3dyvqb9sqdNoKfkjh42wahtVenfKfGzytMshzFQ&oe=6A84A633&_nc_sid=ee9879"
    },
    "carousel_media": [
      {
        "pk": "3962864762920878214",
        "id": "3962864762920878214_2237970730",
        "media_type": 1,
        "original_width": 2048,
        "original_height": 2560,
        "image_url": "https://scontent-dfw6-1.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwG9huux&_nc_oc=Adq14EmgMI--bfJReRcLmZulY8pEk_JXDKt3Yb2PXoIBMUYqZFsMmRQMPh0mZIe5eug&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-dfw6-1.cdninstagram.com&_nc_gid=j5mkO1JYxj2sUzAtb67aMg&_nc_ss=7a22e&oh=00_AQFjbVPIRL634vuWvJp0AfCMU1cZ7JN6JmKGt9wfSTdIeQ&oe=6A848DC1"
      },
      {
        "pk": "3962864768985674045",
        "id": "3962864768985674045_2237970730",
        "media_type": 1,
        "original_width": 1081,
        "original_height": 1351,
        "image_url": "https://scontent-dfw6-1.cdninstagram.com/v/t51.82787-15/773359776_18549779074074731_1818713941597627892_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2ODk4NTY3NDA0NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMiJ9&_nc_ohc=AIgLG5dX6ukQ7kNvwGqX0Db&_nc_oc=Adoxhtek8cMbFSGJ9EPJgBq8kDDxdsD_jUkJqS5FB0AApmB4mrcEag1klL4U5ODuhRo&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-dfw6-1.cdninstagram.com&_nc_gid=j5mkO1JYxj2sUzAtb67aMg&_nc_ss=7a22e&oh=00_AQEX9B-hqQml3ar7q3sMNM2L5COVuLfHjOrvj0JUK8kRtw&oe=6A8496E6"
      },
      {
        "pk": "3962864770437025224",
        "id": "3962864770437025224_2237970730",
        "media_type": 1,
        "original_width": 1081,
        "original_height": 1351,
        "image_url": "https://scontent-dfw6-1.cdninstagram.com/v/t51.82787-15/773450308_18549779077074731_1935136921061811438_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=103&ig_cache_key=Mzk2Mjg2NDc3MDQzNzAyNTIyNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=vcsD61hPzNMQ7kNvwF5NrEK&_nc_oc=AdrzO7Tkg7nm1AzgRM-8nRgOIT53v_2T9ljnmL5l1GS7oHXq0UjwysbUNAQwCB2HaBg&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-dfw6-1.cdninstagram.com&_nc_gid=j5mkO1JYxj2sUzAtb67aMg&_nc_ss=7a22e&oh=00_AQHvAuX7bMjcmyr-WLCTntPNkSOXxu6Yd20BPptSDoosng&oe=6A848865"
      }
    ],
    "coauthor_producers": [],
    "invited_coauthor_producers": [],
    "image_url": "https://scontent-dfw6-1.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwG9huux&_nc_oc=Adq14EmgMI--bfJReRcLmZulY8pEk_JXDKt3Yb2PXoIBMUYqZFsMmRQMPh0mZIe5eug&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-dfw6-1.cdninstagram.com&_nc_gid=j5mkO1JYxj2sUzAtb67aMg&_nc_ss=7a22e&oh=00_AQFjbVPIRL634vuWvJp0AfCMU1cZ7JN6JmKGt9wfSTdIeQ&oe=6A848DC1",
    "scraped_username": "pakuwonmall.jogja",
    "scraped_at": 1786694508,
    "post_url": "https://www.instagram.com/p/Db-7OFLk4Pw/",
    "newer_than_cutoff": 1786320000,
    "newer_than_cutoff_iso": "2026-08-10T00:00:00.000Z",
    "is_newer_than_cutoff": true
  },
  {
    "pk": "3962862498097316445",
    "id": "3962862498097316445_2237970730",
    "code": "Db-6nIkzsJd",
    "taken_at": 1786630093,
    "media_type": 2,
    "product_type": "clips",
    "caption": {
      "pk": "18005408402970978",
      "text": "ELLE WATCH IS NOW AVAILABLE! ✨\n\nTemukan koleksi jam tangan ELLE sekarang di Watch Studio, Pakuwon Mall Jogja! ⌚💖\nTampil stylish, elegan, dan timeless di setiap momen. \n\n📍 Ground Floor, Pakuwon Mall Jogja\n\n#pakuwonmalljogja"
    },
    "like_count": 12,
    "comment_count": 0,
    "play_count": 2689,
    "video_duration": 21.5,
    "original_width": 1080,
    "original_height": 1920,
    "user": {
      "pk": "2237970730",
      "username": "pakuwonmall.jogja",
      "full_name": "Pakuwon Mall Jogja",
      "is_verified": true,
      "profile_pic_url": "https://scontent-dfw5-1.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-dfw5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gHhwVnsAGuT3K6GvqG5l8aMcRbTJ1OrvuBdMS79jELzsfijuieWQJcmNr0wFFgq-Jk&_nc_ohc=L9VCN6COaTMQ7kNvwEOs7N6&_nc_gid=j5mkO1JYxj2sUzAtb67aMg&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQGAXJw3dyvqb9sqdNoKfkjh42wahtVenfKfGzytMshzFQ&oe=6A84A633&_nc_sid=ee9879"
    },
    "usertags": {
      "in": [
        {
          "user": {
            "pk": "1228374574",
            "username": "juli_iskandar",
            "full_name": "Juliaty Iskandar",
            "is_verified": false,
            "profile_pic_url": "https://scontent-dfw5-2.cdninstagram.com/v/t51.2885-19/54800477_2189592477793980_624948081216978944_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby45NjAuYzIifQ&_nc_ht=scontent-dfw5-2.cdninstagram.com&_nc_cat=100&_nc_oc=Q6cZ2gHhwVnsAGuT3K6GvqG5l8aMcRbTJ1OrvuBdMS79jELzsfijuieWQJcmNr0wFFgq-Jk&_nc_ohc=Iz2JRul0k6kQ7kNvwFrpVTR&_nc_gid=j5mkO1JYxj2sUzAtb67aMg&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQFiKbiHlHxVvHts0BbtZwqqb45ZUzJVpK8EwJSVWBsjTQ&oe=6A8492D0&_nc_sid=ee9879"
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
            "profile_pic_url": "https://scontent-dfw5-1.cdninstagram.com/v/t51.2885-19/145976495_717061658996801_8615672779095137678_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby43MjAuYzIifQ&_nc_ht=scontent-dfw5-1.cdninstagram.com&_nc_cat=105&_nc_oc=Q6cZ2gHhwVnsAGuT3K6GvqG5l8aMcRbTJ1OrvuBdMS79jELzsfijuieWQJcmNr0wFFgq-Jk&_nc_ohc=NEQAeZQ5-dcQ7kNvwFYr9_s&_nc_gid=j5mkO1JYxj2sUzAtb67aMg&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQEfYEGSbw4uGVrTOS-A_7bMdbPGGNgAnBfBMWD-fU95xw&oe=6A849B1B&_nc_sid=ee9879"
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
            "profile_pic_url": "https://scontent-dfw5-2.cdninstagram.com/v/t51.2885-19/122597843_342367900160616_7189706853388346855_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=scontent-dfw5-2.cdninstagram.com&_nc_cat=100&_nc_oc=Q6cZ2gHhwVnsAGuT3K6GvqG5l8aMcRbTJ1OrvuBdMS79jELzsfijuieWQJcmNr0wFFgq-Jk&_nc_ohc=z4pokypaePIQ7kNvwFahI7P&_nc_gid=j5mkO1JYxj2sUzAtb67aMg&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQGqzNL8wB50rczTnGR1Fmo5Ip4ejPYtIMAjxGs1mc1ZBw&oe=6A849E78&_nc_sid=ee9879"
          },
          "position": [
            0,
            0
          ]
        },
        {
          "user": {
            "pk": "18870279538",
            "username": "ellewatchindonesia",
            "full_name": "ELLE Watch Indonesia",
            "is_verified": false,
            "profile_pic_url": "https://scontent-dfw5-2.cdninstagram.com/v/t51.82787-19/728833598_18119358160631539_7399830227988371889_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4zMjAuYzIifQ&_nc_ht=scontent-dfw5-2.cdninstagram.com&_nc_cat=107&_nc_oc=Q6cZ2gHhwVnsAGuT3K6GvqG5l8aMcRbTJ1OrvuBdMS79jELzsfijuieWQJcmNr0wFFgq-Jk&_nc_ohc=kvTWyc8VRAsQ7kNvwEZ8KwV&_nc_gid=j5mkO1JYxj2sUzAtb67aMg&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQEiFtWZYo2oRZyNd5_mIWY5mz8kDx8VrRGdVL0eqC1bEQ&oe=6A8487BC&_nc_sid=ee9879"
          },
          "position": [
            0.0653594807,
            0.016339870200000002
          ]
        }
      ]
    },
    "coauthor_producers": [
      {
        "pk": "18870279538",
        "username": "ellewatchindonesia",
        "full_name": "ELLE Watch Indonesia",
        "is_verified": false,
        "profile_pic_url": "https://scontent-dfw5-2.cdninstagram.com/v/t51.82787-19/728833598_18119358160631539_7399830227988371889_n.jpg?stp=dst-jpg_e0_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4zMjAuYzIifQ&_nc_ht=scontent-dfw5-2.cdninstagram.com&_nc_cat=107&_nc_oc=Q6cZ2gHhwVnsAGuT3K6GvqG5l8aMcRbTJ1OrvuBdMS79jELzsfijuieWQJcmNr0wFFgq-Jk&_nc_ohc=kvTWyc8VRAsQ7kNvwEZ8KwV&_nc_gid=j5mkO1JYxj2sUzAtb67aMg&edm=ACWDqb8BAAAA&ccb=7-5&oh=00_AQEiFtWZYo2oRZyNd5_mIWY5mz8kDx8VrRGdVL0eqC1bEQ&oe=6A8487BC&_nc_sid=ee9879"
      }
    ],
    "invited_coauthor_producers": [],
    "image_url": "https://scontent-dfw5-1.cdninstagram.com/v/t51.82787-15/773863104_18549778204074731_6753476794430800343_n.jpg?stp=dst-jpg_e15_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2MjQ5ODA5NzMxNjQ0NTE4NTQ5Nzc4MTk4MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=zRvBXCq30VsQ7kNvwHVh2iV&_nc_oc=AdobGge1PN-kWjOQa1zBmziPWsm-IcE4Zu71CLJPNo3Io4I1dfnvaWySC-jJ8QxB-sw&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-dfw5-1.cdninstagram.com&_nc_gid=j5mkO1JYxj2sUzAtb67aMg&_nc_ss=7a22e&oh=00_AQFlhaMdTuBQyV15kGZCIB2rl6kR94i7YFqV4-UCP73__Q&oe=6A84886B",
    "video_url": "https://scontent-dfw6-1.cdninstagram.com/o1/v/t2/f2/m86/AQPxSh7VvKkX1upeIUsUcOqx1cOrBbDZgdgUmrWWwc9aWGQijquX5p1Xy4KVTZpuZVGK29pU60_nZQfdq0w84Pg4P6aJt1pI-e07Tpk.mp4?_nc_cat=103&_nc_sid=5e9851&_nc_ht=scontent-dfw6-1.cdninstagram.com&_nc_ohc=Du2ez4r2alIQ7kNvwFx5gw5&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTc1MzQwNDEwMjQ2Mzg5NSwiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjoyMSwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=da7e036ff4ca17a5&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC8wMjRFOERENEIzODgzNzc1QTNDOTA1ODhBMjk0QTBCN192aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyL0YzNDFFQzQwN0Q2MDlCRTdFOEU3MUY3OUQwOTUwNTgyX2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACauxubKxq2dBhUCKAJDMywXQDWAAAAAAAAYEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=j5mkO1JYxj2sUzAtb67aMg&_nc_ss=7a22e&_nc_zt=28&oh=00_AQGfB258GfEPx5ny9_CnpzyN7yeIegdWJaYOMOeR0p0Wlw&oe=6A80B960",
    "scraped_username": "pakuwonmall.jogja",
    "scraped_at": 1786694508,
    "post_url": "https://www.instagram.com/p/Db-6nIkzsJd/",
    "newer_than_cutoff": 1786320000,
    "newer_than_cutoff_iso": "2026-08-10T00:00:00.000Z",
    "is_newer_than_cutoff": true
  }
]
```
