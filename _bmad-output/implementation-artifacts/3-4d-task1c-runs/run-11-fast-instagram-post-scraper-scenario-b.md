# Task 1c — Run 11: instagram-scraper/fast-instagram-post-scraper — Scenario B (precise split)

Part of [3-4d-per-use-case-actor-selection-and-sync-path-timeout.md](../3-4d-per-use-case-actor-selection-and-sync-path-timeout.md) Task 1c. **Caveat (same as Runs 2/5/8): "exactly 3" is stale by test time** — expect more than 3 due to real new posts since 2026-08-13. Check any returned item's timestamp against the 3 known pinned timestamps (`2026-08-01T03:58:43Z`, `2026-08-04T05:21:00Z`, `2026-08-04T14:07:36Z`).

**Input params:** `{"instagramUsernames": ["pakuwonmall.jogja"], "postsPerProfile": 15, "recent": "2026-08-13", "retries": 3}`

* **Date/Time:** 2026-08-14 15:16:38
* **Run ID:** [QngrdmI8JpMP5Y8iO](https://console.apify.com/actors/Gv87i5PtUqPlLcM2W/runs/QngrdmI8JpMP5Y8iO#output)
* **Duration:** 7 s
* Cost ($):
  *
  * **result (12):** \$0.012
  * **Processing Fee (Filtered Items) (3):** \$0.00237
  * **Restricted profile (0):** \$0.00
  * **Actor Start (1):** \$0.00005

- Items returned (count):
- Output (paste full JSON):

```json
[
  {
    "id": "3963399684031061677_2237970730",
    "pk": "3963399684031061677",
    "type": "Image",
    "image": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=5arN_J-sk_AQ7kNvwFVffLS&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHZFCpVfVyR9S9WEvUlwAIu_uYS-4NTyGwPLq_Y7e-zlw&oe=6A84A079&_nc_sid=7a9f4b",
    "shortcode": "DcA0wN9kR6t",
    "product_type": "carousel_container",
    "hashtags": [
      "#pakuwonmalljogja"
    ],
    "mentions": [],
    "location": null,
    "caption": "See your freedom, and see it in style with @saturdays.lifestyle \n\n🤩 Nikmati potongan 17% dengan minimum pembelian 1,495k (tidak berlaku untuk produk kolaborasi). Kunjungi SATURDAYS di Pakuwon Mall Yogyakarta, Lantai 1, mulai 15–21 Agustus.\n\n#pakuwonmalljogja",
    "comment_count": 0,
    "like_count": 1,
    "view_count": null,
    "has_audio": null,
    "usertags": null,
    "clips_metadata": null,
    "from_url": "https://www.instagram.com/pakuwonmall.jogja/",
    "post_url": "https://www.instagram.com/p/DcA0wN9kR6t/",
    "video_duration": null,
    "user": {
      "pk": "2237970730",
      "profile_pic_url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=L9VCN6COaTMQ7kNvwHOtFy0&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQEM_oL-JrA3TqdAkw0HaavzLRi54AM8nCTvpERnqwDeWQ&oe=6A84A633&_nc_sid=7a9f4b",
      "username": "pakuwonmall.jogja",
      "is_private": false,
      "is_embeds_disabled": false,
      "is_unpublished": false,
      "is_verified": true,
      "friendship_status": null,
      "latest_besties_reel_media": null,
      "latest_reel_media": null,
      "live_broadcast_visibility": null,
      "live_broadcast_id": null,
      "show_account_transparency_details": true,
      "transparency_product": null,
      "transparency_product_enabled": false,
      "transparency_label": null,
      "ai_agent_owner_username": null,
      "id": "2237970730",
      "aigm_account_label_info": null,
      "hd_profile_pic_url_info": {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=L9VCN6COaTMQ7kNvwHOtFy0&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGSwOGkAaLzHNq-6Ef-eLq1M-C4wS7L_s0lWwJa9u0Lnw&oe=6A84A633&_nc_sid=7a9f4b"
      },
      "__typename": "XDTUserDict",
      "full_name": "Pakuwon Mall Jogja"
    },
    "images": [
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwE21woK&_nc_oc=AdrYgsP6BAluIg2pcsmJ6675zwy3L79rRDkcUqmP4u2MBCWEGi61mL0O0bwYneUtsSk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHFqRWLKYx1GLFJWYE6C8hTacDNyW8B_histph3nT_e6A&oe=6A84A079",
        "height": 1472,
        "width": 1179
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwE21woK&_nc_oc=AdrYgsP6BAluIg2pcsmJ6675zwy3L79rRDkcUqmP4u2MBCWEGi61mL0O0bwYneUtsSk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEWncMvnoCa0FVIAFjOjlWR-vZVJnYOoX9bMXlxgZiJvA&oe=6A84A079",
        "height": 899,
        "width": 720
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwE21woK&_nc_oc=AdrYgsP6BAluIg2pcsmJ6675zwy3L79rRDkcUqmP4u2MBCWEGi61mL0O0bwYneUtsSk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQE2FwDz0b_2PUpILVc_0seFkgyrWiEjKk5of8nJeHcZow&oe=6A84A079",
        "height": 799,
        "width": 640
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwE21woK&_nc_oc=AdrYgsP6BAluIg2pcsmJ6675zwy3L79rRDkcUqmP4u2MBCWEGi61mL0O0bwYneUtsSk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGC0T7cX6NCqNQh_Z_4iuNpOxtEvmp9_3ZjljEEW6pEqA&oe=6A84A079",
        "height": 599,
        "width": 480
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwE21woK&_nc_oc=AdrYgsP6BAluIg2pcsmJ6675zwy3L79rRDkcUqmP4u2MBCWEGi61mL0O0bwYneUtsSk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFRsZW778bgi4RtwzxU93jfxCFTwjomTuGOgzPtiA7gkw&oe=6A84A079",
        "height": 400,
        "width": 320
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwE21woK&_nc_oc=AdrYgsP6BAluIg2pcsmJ6675zwy3L79rRDkcUqmP4u2MBCWEGi61mL0O0bwYneUtsSk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGxCp_04JkW2OSfMckPSduTNyhnK0rAUehKkn6-Z_9L0A&oe=6A84A079",
        "height": 300,
        "width": 240
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwE21woK&_nc_oc=AdrYgsP6BAluIg2pcsmJ6675zwy3L79rRDkcUqmP4u2MBCWEGi61mL0O0bwYneUtsSk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQG_qPRvc1PEGZFSaAHfX2hm1wcEMDO7-ooXJjU5aTYoEg&oe=6A84A079",
        "height": 1080,
        "width": 1080
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwE21woK&_nc_oc=AdrYgsP6BAluIg2pcsmJ6675zwy3L79rRDkcUqmP4u2MBCWEGi61mL0O0bwYneUtsSk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEe6eZqBRGWWDAhR5lgULQzwIPdu7QrOI7AnSvKgoV-Yg&oe=6A84A079",
        "height": 750,
        "width": 750
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwE21woK&_nc_oc=AdrYgsP6BAluIg2pcsmJ6675zwy3L79rRDkcUqmP4u2MBCWEGi61mL0O0bwYneUtsSk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEIs36ZA5aAY2iUbaks4ppDUJOsypciNZgDVzE0WbJOLA&oe=6A84A079",
        "height": 640,
        "width": 640
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s480x480_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwE21woK&_nc_oc=AdrYgsP6BAluIg2pcsmJ6675zwy3L79rRDkcUqmP4u2MBCWEGi61mL0O0bwYneUtsSk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGxEtR_KkfgU5yhuveHBuyElfI43bQDLgndMcDv9Nc1IQ&oe=6A84A079",
        "height": 480,
        "width": 480
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s320x320_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwE21woK&_nc_oc=AdrYgsP6BAluIg2pcsmJ6675zwy3L79rRDkcUqmP4u2MBCWEGi61mL0O0bwYneUtsSk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEF_0ANZPqLrcaoHis3HKwaesfXMR1Z5PFlxqkKYDsmBA&oe=6A84A079",
        "height": 320,
        "width": 320
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s240x240_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwE21woK&_nc_oc=AdrYgsP6BAluIg2pcsmJ6675zwy3L79rRDkcUqmP4u2MBCWEGi61mL0O0bwYneUtsSk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHcwZUoHIJeqkvFw_lJ9sgLRzYJhatSWSsrfVeEVtEQWQ&oe=6A84A079",
        "height": 240,
        "width": 240
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s150x150_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwE21woK&_nc_oc=AdrYgsP6BAluIg2pcsmJ6675zwy3L79rRDkcUqmP4u2MBCWEGi61mL0O0bwYneUtsSk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEYc5kCLPJfwsMt7iDkD5tiY0komDsoGU7UJHGrS06InA&oe=6A84A079",
        "height": 150,
        "width": 150
      }
    ],
    "video_versions": null,
    "carousel_media_count": 2,
    "carousel_media": [
      {
        "id": "3963399359387099922_2237970730",
        "pk": "3963399359387099922",
        "accessibility_caption": null,
        "is_dash_eligible": null,
        "video_dash_manifest": null,
        "media_type": 1,
        "original_height": 1472,
        "original_width": 1179,
        "inventory_source": null,
        "user": null,
        "usertags": null,
        "image_versions2": {
          "candidates": [
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwE21woK&_nc_oc=AdrYgsP6BAluIg2pcsmJ6675zwy3L79rRDkcUqmP4u2MBCWEGi61mL0O0bwYneUtsSk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHFqRWLKYx1GLFJWYE6C8hTacDNyW8B_histph3nT_e6A&oe=6A84A079",
              "height": 1472,
              "width": 1179
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwE21woK&_nc_oc=AdrYgsP6BAluIg2pcsmJ6675zwy3L79rRDkcUqmP4u2MBCWEGi61mL0O0bwYneUtsSk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEWncMvnoCa0FVIAFjOjlWR-vZVJnYOoX9bMXlxgZiJvA&oe=6A84A079",
              "height": 899,
              "width": 720
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwE21woK&_nc_oc=AdrYgsP6BAluIg2pcsmJ6675zwy3L79rRDkcUqmP4u2MBCWEGi61mL0O0bwYneUtsSk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQE2FwDz0b_2PUpILVc_0seFkgyrWiEjKk5of8nJeHcZow&oe=6A84A079",
              "height": 799,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwE21woK&_nc_oc=AdrYgsP6BAluIg2pcsmJ6675zwy3L79rRDkcUqmP4u2MBCWEGi61mL0O0bwYneUtsSk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGC0T7cX6NCqNQh_Z_4iuNpOxtEvmp9_3ZjljEEW6pEqA&oe=6A84A079",
              "height": 599,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwE21woK&_nc_oc=AdrYgsP6BAluIg2pcsmJ6675zwy3L79rRDkcUqmP4u2MBCWEGi61mL0O0bwYneUtsSk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFRsZW778bgi4RtwzxU93jfxCFTwjomTuGOgzPtiA7gkw&oe=6A84A079",
              "height": 400,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwE21woK&_nc_oc=AdrYgsP6BAluIg2pcsmJ6675zwy3L79rRDkcUqmP4u2MBCWEGi61mL0O0bwYneUtsSk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGxCp_04JkW2OSfMckPSduTNyhnK0rAUehKkn6-Z_9L0A&oe=6A84A079",
              "height": 300,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwE21woK&_nc_oc=AdrYgsP6BAluIg2pcsmJ6675zwy3L79rRDkcUqmP4u2MBCWEGi61mL0O0bwYneUtsSk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQG_qPRvc1PEGZFSaAHfX2hm1wcEMDO7-ooXJjU5aTYoEg&oe=6A84A079",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwE21woK&_nc_oc=AdrYgsP6BAluIg2pcsmJ6675zwy3L79rRDkcUqmP4u2MBCWEGi61mL0O0bwYneUtsSk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEe6eZqBRGWWDAhR5lgULQzwIPdu7QrOI7AnSvKgoV-Yg&oe=6A84A079",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwE21woK&_nc_oc=AdrYgsP6BAluIg2pcsmJ6675zwy3L79rRDkcUqmP4u2MBCWEGi61mL0O0bwYneUtsSk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEIs36ZA5aAY2iUbaks4ppDUJOsypciNZgDVzE0WbJOLA&oe=6A84A079",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s480x480_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwE21woK&_nc_oc=AdrYgsP6BAluIg2pcsmJ6675zwy3L79rRDkcUqmP4u2MBCWEGi61mL0O0bwYneUtsSk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGxEtR_KkfgU5yhuveHBuyElfI43bQDLgndMcDv9Nc1IQ&oe=6A84A079",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s320x320_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwE21woK&_nc_oc=AdrYgsP6BAluIg2pcsmJ6675zwy3L79rRDkcUqmP4u2MBCWEGi61mL0O0bwYneUtsSk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEF_0ANZPqLrcaoHis3HKwaesfXMR1Z5PFlxqkKYDsmBA&oe=6A84A079",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s240x240_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwE21woK&_nc_oc=AdrYgsP6BAluIg2pcsmJ6675zwy3L79rRDkcUqmP4u2MBCWEGi61mL0O0bwYneUtsSk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHcwZUoHIJeqkvFw_lJ9sgLRzYJhatSWSsrfVeEVtEQWQ&oe=6A84A079",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s150x150_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwE21woK&_nc_oc=AdrYgsP6BAluIg2pcsmJ6675zwy3L79rRDkcUqmP4u2MBCWEGi61mL0O0bwYneUtsSk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEYc5kCLPJfwsMt7iDkD5tiY0komDsoGU7UJHGrS06InA&oe=6A84A079",
              "height": 150,
              "width": 150
            }
          ]
        },
        "carousel_parent_id": "3963399684031061677_2237970730",
        "sharing_friction_info": {
          "bloks_app_url": null,
          "should_have_sharing_friction": false
        },
        "preview": null,
        "organic_tracking_token": null,
        "saved_collection_ids": null,
        "has_viewer_saved": null,
        "video_versions": null,
        "media_overlay_info": null,
        "code": null,
        "display_uri": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=5arN_J-sk_AQ7kNvwFVffLS&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHZFCpVfVyR9S9WEvUlwAIu_uYS-4NTyGwPLq_Y7e-zlw&oe=6A84A079&_nc_sid=7a9f4b",
        "number_of_qualities": null,
        "product_type": "carousel_item",
        "carousel_media": null,
        "taken_at": 1786694081,
        "previous_submitter": null,
        "link": null,
        "story_cta": null,
        "has_liked": null,
        "like_count": null,
        "logging_info_token": null,
        "has_audio": null,
        "clips_metadata": null
      },
      {
        "id": "3963399365443567878_2237970730",
        "pk": "3963399365443567878",
        "accessibility_caption": null,
        "is_dash_eligible": null,
        "video_dash_manifest": null,
        "media_type": 1,
        "original_height": 1598,
        "original_width": 1280,
        "inventory_source": null,
        "user": null,
        "usertags": null,
        "image_versions2": {
          "candidates": [
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773677339_18549990886074731_8172470030301429879_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5OTM2NTQ0MzU2Nzg3OA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=rQ3qJwMO5EAQ7kNvwF4xqSX&_nc_oc=AdqOv7jSwUEgLMVaws1mTAaX7szd9F5fMSsRQK_iTLW51BUgaoUUUpIJfXcRVjENjTg&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEBCkIGy2eovN7nn7BUObn4FuLzDgOJ3Kax07wlvDM31Q&oe=6A849BF1",
              "height": 1598,
              "width": 1280
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773677339_18549990886074731_8172470030301429879_n.jpg?stp=dst-jpg_e35_p1080x1080_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5OTM2NTQ0MzU2Nzg3OA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=rQ3qJwMO5EAQ7kNvwF4xqSX&_nc_oc=AdqOv7jSwUEgLMVaws1mTAaX7szd9F5fMSsRQK_iTLW51BUgaoUUUpIJfXcRVjENjTg&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFh0NUnkTTepJ7jFan5zjYmwfgjFMUoAxrhO-R-Lp7FXA&oe=6A849BF1",
              "height": 1348,
              "width": 1080
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773677339_18549990886074731_8172470030301429879_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5OTM2NTQ0MzU2Nzg3OA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=rQ3qJwMO5EAQ7kNvwF4xqSX&_nc_oc=AdqOv7jSwUEgLMVaws1mTAaX7szd9F5fMSsRQK_iTLW51BUgaoUUUpIJfXcRVjENjTg&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQE6MqBToYxEd27nyRpk44iU9yqsRub-6EB5Jt6kF1yjmQ&oe=6A849BF1",
              "height": 899,
              "width": 720
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773677339_18549990886074731_8172470030301429879_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5OTM2NTQ0MzU2Nzg3OA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=rQ3qJwMO5EAQ7kNvwF4xqSX&_nc_oc=AdqOv7jSwUEgLMVaws1mTAaX7szd9F5fMSsRQK_iTLW51BUgaoUUUpIJfXcRVjENjTg&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEdzJVNcnl4d0RfGvfQYgzPqsRAXZSlEI4qaQDsWOLJQg&oe=6A849BF1",
              "height": 799,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773677339_18549990886074731_8172470030301429879_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5OTM2NTQ0MzU2Nzg3OA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=rQ3qJwMO5EAQ7kNvwF4xqSX&_nc_oc=AdqOv7jSwUEgLMVaws1mTAaX7szd9F5fMSsRQK_iTLW51BUgaoUUUpIJfXcRVjENjTg&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFQeAs0HikAtoyXD8JW6gNyMUWDmYqHRljA4ZBAHn5TQQ&oe=6A849BF1",
              "height": 599,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773677339_18549990886074731_8172470030301429879_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5OTM2NTQ0MzU2Nzg3OA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=rQ3qJwMO5EAQ7kNvwF4xqSX&_nc_oc=AdqOv7jSwUEgLMVaws1mTAaX7szd9F5fMSsRQK_iTLW51BUgaoUUUpIJfXcRVjENjTg&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEgCLqvCvIuzQOIiPkPblD2BCkviYbu1cFF6kURk7PYLg&oe=6A849BF1",
              "height": 400,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773677339_18549990886074731_8172470030301429879_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5OTM2NTQ0MzU2Nzg3OA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=rQ3qJwMO5EAQ7kNvwF4xqSX&_nc_oc=AdqOv7jSwUEgLMVaws1mTAaX7szd9F5fMSsRQK_iTLW51BUgaoUUUpIJfXcRVjENjTg&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQH3T7HHFE4zOoAvm7DpldsHt7uA210VYY8AcSZXhBVrwA&oe=6A849BF1",
              "height": 300,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773677339_18549990886074731_8172470030301429879_n.jpg?stp=c0.159.1280.1280a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5OTM2NTQ0MzU2Nzg3OA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=rQ3qJwMO5EAQ7kNvwF4xqSX&_nc_oc=AdqOv7jSwUEgLMVaws1mTAaX7szd9F5fMSsRQK_iTLW51BUgaoUUUpIJfXcRVjENjTg&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQF13MNgEWZp8ZAI0iuFWdPIewO72yfLYqjthnzkcwoOFQ&oe=6A849BF1",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773677339_18549990886074731_8172470030301429879_n.jpg?stp=c0.159.1280.1280a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5OTM2NTQ0MzU2Nzg3OA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=rQ3qJwMO5EAQ7kNvwF4xqSX&_nc_oc=AdqOv7jSwUEgLMVaws1mTAaX7szd9F5fMSsRQK_iTLW51BUgaoUUUpIJfXcRVjENjTg&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHiPZX-GLqh0rBPx9kOF3iqjKPgjcJ_w9lOVVzPsH1Jww&oe=6A849BF1",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773677339_18549990886074731_8172470030301429879_n.jpg?stp=c0.159.1280.1280a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5OTM2NTQ0MzU2Nzg3OA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=rQ3qJwMO5EAQ7kNvwF4xqSX&_nc_oc=AdqOv7jSwUEgLMVaws1mTAaX7szd9F5fMSsRQK_iTLW51BUgaoUUUpIJfXcRVjENjTg&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHx9i1RS1ul9gNkYQjm3HqECdB-sEV35gxMmU8EcCcnog&oe=6A849BF1",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773677339_18549990886074731_8172470030301429879_n.jpg?stp=c0.159.1280.1280a_dst-jpg_e35_s480x480_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5OTM2NTQ0MzU2Nzg3OA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=rQ3qJwMO5EAQ7kNvwF4xqSX&_nc_oc=AdqOv7jSwUEgLMVaws1mTAaX7szd9F5fMSsRQK_iTLW51BUgaoUUUpIJfXcRVjENjTg&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHI1YxuLkJ-K70reUJYiyL7WLB4YajrEz2DjQ2YVHXnjA&oe=6A849BF1",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773677339_18549990886074731_8172470030301429879_n.jpg?stp=c0.159.1280.1280a_dst-jpg_e35_s320x320_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5OTM2NTQ0MzU2Nzg3OA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=rQ3qJwMO5EAQ7kNvwF4xqSX&_nc_oc=AdqOv7jSwUEgLMVaws1mTAaX7szd9F5fMSsRQK_iTLW51BUgaoUUUpIJfXcRVjENjTg&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGRK8d3BRk9UYOdZ01rSOYlmyZJ0T6jH19eXMxsBVJPlg&oe=6A849BF1",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773677339_18549990886074731_8172470030301429879_n.jpg?stp=c0.159.1280.1280a_dst-jpg_e35_s240x240_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5OTM2NTQ0MzU2Nzg3OA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=rQ3qJwMO5EAQ7kNvwF4xqSX&_nc_oc=AdqOv7jSwUEgLMVaws1mTAaX7szd9F5fMSsRQK_iTLW51BUgaoUUUpIJfXcRVjENjTg&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGcW3wCcHkrn8pk7W6VxduycruVNHbgzNng_8mmQ2XKEg&oe=6A849BF1",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773677339_18549990886074731_8172470030301429879_n.jpg?stp=c0.159.1280.1280a_dst-jpg_e35_s150x150_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5OTM2NTQ0MzU2Nzg3OA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=rQ3qJwMO5EAQ7kNvwF4xqSX&_nc_oc=AdqOv7jSwUEgLMVaws1mTAaX7szd9F5fMSsRQK_iTLW51BUgaoUUUpIJfXcRVjENjTg&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGs_xMHd-Oy5CIX8Ensdd0_3eFC4KZVevQX6iF4DFXVkg&oe=6A849BF1",
              "height": 150,
              "width": 150
            }
          ]
        },
        "carousel_parent_id": "3963399684031061677_2237970730",
        "sharing_friction_info": {
          "bloks_app_url": null,
          "should_have_sharing_friction": false
        },
        "preview": null,
        "organic_tracking_token": null,
        "saved_collection_ids": null,
        "has_viewer_saved": null,
        "video_versions": null,
        "media_overlay_info": null,
        "code": null,
        "display_uri": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773677339_18549990886074731_8172470030301429879_n.jpg?stp=c0.159.1280.1280a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=862obGXlU7sQ7kNvwGP_0GT&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHhcBBE5QOKhC469hwAJBPlrWwrsnqE5A3gq00hp9OKlw&oe=6A849BF1&_nc_sid=7a9f4b",
        "number_of_qualities": null,
        "product_type": "carousel_item",
        "carousel_media": null,
        "taken_at": 1786694081,
        "previous_submitter": null,
        "link": null,
        "story_cta": null,
        "has_liked": null,
        "like_count": null,
        "logging_info_token": null,
        "has_audio": null,
        "clips_metadata": null
      }
    ],
    "coauthor_producers": [],
    "timeline_pinned_user_ids": [],
    "date": "2026-08-14T07:54:42.000Z",
    "crawled_at": "2026-08-14T08:16:43.756Z"
  },
  {
    "id": "3963398885586570584_2237970730",
    "pk": "3963398885586570584",
    "type": "Image",
    "image": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=c0.202.1620.1620a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=fDu0SuWidG0Q7kNvwFnbQOR&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGkhA4kGjyQjZxgKJ2gMqdh82NMXnNQ6wyR8nLdDerCdw&oe=6A849592&_nc_sid=7a9f4b",
    "shortcode": "DcA0kmWkQ1Y",
    "product_type": "carousel_container",
    "hashtags": [
      "#pakuwonmalljogja"
    ],
    "mentions": [],
    "location": null,
    "caption": "🇮🇩✨ SPESIAL PROMO KEMERDEKAAN DI BUNAACA! ✨🇮🇩\n\nMerdeka makin manis! 😍🍩 Nikmati promo BUY 2 GET 1 FREE untuk semua varian yang tersedia!\n\n📅 17 Agustus 2026\n\n📍 Bunaaca Pakuwon Mall Jogja — LG Floor, depan Lobby B\n\n#pakuwonmalljogja",
    "comment_count": 0,
    "like_count": 9,
    "view_count": null,
    "has_audio": null,
    "usertags": null,
    "clips_metadata": null,
    "from_url": "https://www.instagram.com/pakuwonmall.jogja/",
    "post_url": "https://www.instagram.com/p/DcA0kmWkQ1Y/",
    "video_duration": null,
    "user": {
      "pk": "2237970730",
      "profile_pic_url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=L9VCN6COaTMQ7kNvwHOtFy0&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQEM_oL-JrA3TqdAkw0HaavzLRi54AM8nCTvpERnqwDeWQ&oe=6A84A633&_nc_sid=7a9f4b",
      "username": "pakuwonmall.jogja",
      "is_private": false,
      "is_embeds_disabled": false,
      "is_unpublished": false,
      "is_verified": true,
      "friendship_status": null,
      "latest_besties_reel_media": null,
      "latest_reel_media": null,
      "live_broadcast_visibility": null,
      "live_broadcast_id": null,
      "show_account_transparency_details": true,
      "transparency_product": null,
      "transparency_product_enabled": false,
      "transparency_label": null,
      "ai_agent_owner_username": null,
      "id": "2237970730",
      "aigm_account_label_info": null,
      "hd_profile_pic_url_info": {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=L9VCN6COaTMQ7kNvwHOtFy0&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGSwOGkAaLzHNq-6Ef-eLq1M-C4wS7L_s0lWwJa9u0Lnw&oe=6A84A633&_nc_sid=7a9f4b"
      },
      "__typename": "XDTUserDict",
      "full_name": "Pakuwon Mall Jogja"
    },
    "images": [
      {
        "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwFuSKIB&_nc_oc=AdotBnDFH2e1c0mhNAzGnD3F_CBRQxcSCaWPGVi_ga1N7VdrkkPaQ7lYXwSzjKjJDyc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQE2OSTJUXQ12nt_C_YsTKofQJt-ZzO_c9YKcb3_7Ub0lg&oe=6A849592",
        "height": 2025,
        "width": 1620
      },
      {
        "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=dst-jpg_e35_p1080x1080_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwFuSKIB&_nc_oc=AdotBnDFH2e1c0mhNAzGnD3F_CBRQxcSCaWPGVi_ga1N7VdrkkPaQ7lYXwSzjKjJDyc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGgY8ejPI_M4L53_4V-HjqfHTMiSKYRrlh_WxDzXl0ekA&oe=6A849592",
        "height": 1350,
        "width": 1080
      },
      {
        "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwFuSKIB&_nc_oc=AdotBnDFH2e1c0mhNAzGnD3F_CBRQxcSCaWPGVi_ga1N7VdrkkPaQ7lYXwSzjKjJDyc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHkU1yD_mtyCF6m6FCmKNwSlQn5hmfSTqEButWlHWzg6Q&oe=6A849592",
        "height": 900,
        "width": 720
      },
      {
        "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwFuSKIB&_nc_oc=AdotBnDFH2e1c0mhNAzGnD3F_CBRQxcSCaWPGVi_ga1N7VdrkkPaQ7lYXwSzjKjJDyc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEO1IFyhJIBdK2D9XeVjG0mwv4BXEfPGiMI3xhFDKQoVw&oe=6A849592",
        "height": 800,
        "width": 640
      },
      {
        "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwFuSKIB&_nc_oc=AdotBnDFH2e1c0mhNAzGnD3F_CBRQxcSCaWPGVi_ga1N7VdrkkPaQ7lYXwSzjKjJDyc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHzH2prat5pEMIMrgIdPXcFfYgXji9MEQ-48XY2FHQbkw&oe=6A849592",
        "height": 600,
        "width": 480
      },
      {
        "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwFuSKIB&_nc_oc=AdotBnDFH2e1c0mhNAzGnD3F_CBRQxcSCaWPGVi_ga1N7VdrkkPaQ7lYXwSzjKjJDyc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEOP1Y-Jany__JHN2T3Az9Yi0N6Aoeoz4quHVDI7rnSAA&oe=6A849592",
        "height": 400,
        "width": 320
      },
      {
        "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwFuSKIB&_nc_oc=AdotBnDFH2e1c0mhNAzGnD3F_CBRQxcSCaWPGVi_ga1N7VdrkkPaQ7lYXwSzjKjJDyc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHPaXGbga27zvmQ9MLTLI3rLzOqggxekTrqfNUDgT78KQ&oe=6A849592",
        "height": 300,
        "width": 240
      },
      {
        "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=c0.202.1620.1620a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwFuSKIB&_nc_oc=AdotBnDFH2e1c0mhNAzGnD3F_CBRQxcSCaWPGVi_ga1N7VdrkkPaQ7lYXwSzjKjJDyc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGPAsrC7DHRBwyQaLtcVB4LmxD4q9wNA9N-dhapXDQ9oA&oe=6A849592",
        "height": 1080,
        "width": 1080
      },
      {
        "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=c0.202.1620.1620a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwFuSKIB&_nc_oc=AdotBnDFH2e1c0mhNAzGnD3F_CBRQxcSCaWPGVi_ga1N7VdrkkPaQ7lYXwSzjKjJDyc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGf1D5A8JShCjxDSHw_uhDAEGho8BizGJi1RcCzQYDOmw&oe=6A849592",
        "height": 750,
        "width": 750
      },
      {
        "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=c0.202.1620.1620a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwFuSKIB&_nc_oc=AdotBnDFH2e1c0mhNAzGnD3F_CBRQxcSCaWPGVi_ga1N7VdrkkPaQ7lYXwSzjKjJDyc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQF9SwOoGzdu7DXViZolMEYTsX3FCvXsCDGGIRxtPgNrmQ&oe=6A849592",
        "height": 640,
        "width": 640
      },
      {
        "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=c0.202.1620.1620a_dst-jpg_e35_s480x480_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwFuSKIB&_nc_oc=AdotBnDFH2e1c0mhNAzGnD3F_CBRQxcSCaWPGVi_ga1N7VdrkkPaQ7lYXwSzjKjJDyc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHVG5IDN_05wL1mJjBZEOe6AOS-P3DK8rz2hpULm8IEng&oe=6A849592",
        "height": 480,
        "width": 480
      },
      {
        "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=c0.202.1620.1620a_dst-jpg_e35_s320x320_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwFuSKIB&_nc_oc=AdotBnDFH2e1c0mhNAzGnD3F_CBRQxcSCaWPGVi_ga1N7VdrkkPaQ7lYXwSzjKjJDyc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEoNVbUbfwvO-KEk-fQ8xKBmF2P5XShQNV-ncRlOmAgLA&oe=6A849592",
        "height": 320,
        "width": 320
      },
      {
        "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=c0.202.1620.1620a_dst-jpg_e35_s240x240_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwFuSKIB&_nc_oc=AdotBnDFH2e1c0mhNAzGnD3F_CBRQxcSCaWPGVi_ga1N7VdrkkPaQ7lYXwSzjKjJDyc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEKPMpf0GGxZfPYBftaOG6ATBovyRZf5kOzqga7KJfxYQ&oe=6A849592",
        "height": 240,
        "width": 240
      },
      {
        "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=c0.202.1620.1620a_dst-jpg_e35_s150x150_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwFuSKIB&_nc_oc=AdotBnDFH2e1c0mhNAzGnD3F_CBRQxcSCaWPGVi_ga1N7VdrkkPaQ7lYXwSzjKjJDyc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQE16dVV_39b-IYoyfuOW7A_1Xx4biiLFTz0yLSlDCiInQ&oe=6A849592",
        "height": 150,
        "width": 150
      }
    ],
    "video_versions": null,
    "carousel_media_count": 2,
    "carousel_media": [
      {
        "id": "3963398729117297599_2237970730",
        "pk": "3963398729117297599",
        "accessibility_caption": null,
        "is_dash_eligible": null,
        "video_dash_manifest": null,
        "media_type": 1,
        "original_height": 2025,
        "original_width": 1620,
        "inventory_source": null,
        "user": null,
        "usertags": null,
        "image_versions2": {
          "candidates": [
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwFuSKIB&_nc_oc=AdotBnDFH2e1c0mhNAzGnD3F_CBRQxcSCaWPGVi_ga1N7VdrkkPaQ7lYXwSzjKjJDyc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQE2OSTJUXQ12nt_C_YsTKofQJt-ZzO_c9YKcb3_7Ub0lg&oe=6A849592",
              "height": 2025,
              "width": 1620
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=dst-jpg_e35_p1080x1080_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwFuSKIB&_nc_oc=AdotBnDFH2e1c0mhNAzGnD3F_CBRQxcSCaWPGVi_ga1N7VdrkkPaQ7lYXwSzjKjJDyc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGgY8ejPI_M4L53_4V-HjqfHTMiSKYRrlh_WxDzXl0ekA&oe=6A849592",
              "height": 1350,
              "width": 1080
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwFuSKIB&_nc_oc=AdotBnDFH2e1c0mhNAzGnD3F_CBRQxcSCaWPGVi_ga1N7VdrkkPaQ7lYXwSzjKjJDyc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHkU1yD_mtyCF6m6FCmKNwSlQn5hmfSTqEButWlHWzg6Q&oe=6A849592",
              "height": 900,
              "width": 720
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwFuSKIB&_nc_oc=AdotBnDFH2e1c0mhNAzGnD3F_CBRQxcSCaWPGVi_ga1N7VdrkkPaQ7lYXwSzjKjJDyc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEO1IFyhJIBdK2D9XeVjG0mwv4BXEfPGiMI3xhFDKQoVw&oe=6A849592",
              "height": 800,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwFuSKIB&_nc_oc=AdotBnDFH2e1c0mhNAzGnD3F_CBRQxcSCaWPGVi_ga1N7VdrkkPaQ7lYXwSzjKjJDyc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHzH2prat5pEMIMrgIdPXcFfYgXji9MEQ-48XY2FHQbkw&oe=6A849592",
              "height": 600,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwFuSKIB&_nc_oc=AdotBnDFH2e1c0mhNAzGnD3F_CBRQxcSCaWPGVi_ga1N7VdrkkPaQ7lYXwSzjKjJDyc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEOP1Y-Jany__JHN2T3Az9Yi0N6Aoeoz4quHVDI7rnSAA&oe=6A849592",
              "height": 400,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwFuSKIB&_nc_oc=AdotBnDFH2e1c0mhNAzGnD3F_CBRQxcSCaWPGVi_ga1N7VdrkkPaQ7lYXwSzjKjJDyc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHPaXGbga27zvmQ9MLTLI3rLzOqggxekTrqfNUDgT78KQ&oe=6A849592",
              "height": 300,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=c0.202.1620.1620a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwFuSKIB&_nc_oc=AdotBnDFH2e1c0mhNAzGnD3F_CBRQxcSCaWPGVi_ga1N7VdrkkPaQ7lYXwSzjKjJDyc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGPAsrC7DHRBwyQaLtcVB4LmxD4q9wNA9N-dhapXDQ9oA&oe=6A849592",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=c0.202.1620.1620a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwFuSKIB&_nc_oc=AdotBnDFH2e1c0mhNAzGnD3F_CBRQxcSCaWPGVi_ga1N7VdrkkPaQ7lYXwSzjKjJDyc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGf1D5A8JShCjxDSHw_uhDAEGho8BizGJi1RcCzQYDOmw&oe=6A849592",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=c0.202.1620.1620a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwFuSKIB&_nc_oc=AdotBnDFH2e1c0mhNAzGnD3F_CBRQxcSCaWPGVi_ga1N7VdrkkPaQ7lYXwSzjKjJDyc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQF9SwOoGzdu7DXViZolMEYTsX3FCvXsCDGGIRxtPgNrmQ&oe=6A849592",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=c0.202.1620.1620a_dst-jpg_e35_s480x480_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwFuSKIB&_nc_oc=AdotBnDFH2e1c0mhNAzGnD3F_CBRQxcSCaWPGVi_ga1N7VdrkkPaQ7lYXwSzjKjJDyc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHVG5IDN_05wL1mJjBZEOe6AOS-P3DK8rz2hpULm8IEng&oe=6A849592",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=c0.202.1620.1620a_dst-jpg_e35_s320x320_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwFuSKIB&_nc_oc=AdotBnDFH2e1c0mhNAzGnD3F_CBRQxcSCaWPGVi_ga1N7VdrkkPaQ7lYXwSzjKjJDyc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEoNVbUbfwvO-KEk-fQ8xKBmF2P5XShQNV-ncRlOmAgLA&oe=6A849592",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=c0.202.1620.1620a_dst-jpg_e35_s240x240_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwFuSKIB&_nc_oc=AdotBnDFH2e1c0mhNAzGnD3F_CBRQxcSCaWPGVi_ga1N7VdrkkPaQ7lYXwSzjKjJDyc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEKPMpf0GGxZfPYBftaOG6ATBovyRZf5kOzqga7KJfxYQ&oe=6A849592",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=c0.202.1620.1620a_dst-jpg_e35_s150x150_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwFuSKIB&_nc_oc=AdotBnDFH2e1c0mhNAzGnD3F_CBRQxcSCaWPGVi_ga1N7VdrkkPaQ7lYXwSzjKjJDyc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQE16dVV_39b-IYoyfuOW7A_1Xx4biiLFTz0yLSlDCiInQ&oe=6A849592",
              "height": 150,
              "width": 150
            }
          ]
        },
        "carousel_parent_id": "3963398885586570584_2237970730",
        "sharing_friction_info": {
          "bloks_app_url": null,
          "should_have_sharing_friction": false
        },
        "preview": null,
        "organic_tracking_token": null,
        "saved_collection_ids": null,
        "has_viewer_saved": null,
        "video_versions": null,
        "media_overlay_info": null,
        "code": null,
        "display_uri": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=c0.202.1620.1620a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=fDu0SuWidG0Q7kNvwFnbQOR&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGkhA4kGjyQjZxgKJ2gMqdh82NMXnNQ6wyR8nLdDerCdw&oe=6A849592&_nc_sid=7a9f4b",
        "number_of_qualities": null,
        "product_type": "carousel_item",
        "carousel_media": null,
        "taken_at": 1786693986,
        "previous_submitter": null,
        "link": null,
        "story_cta": null,
        "has_liked": null,
        "like_count": null,
        "logging_info_token": null,
        "has_audio": null,
        "clips_metadata": null
      },
      {
        "id": "3963398747177918526_2237970730",
        "pk": "3963398747177918526",
        "accessibility_caption": null,
        "is_dash_eligible": null,
        "video_dash_manifest": null,
        "media_type": 1,
        "original_height": 2700,
        "original_width": 2160,
        "inventory_source": null,
        "user": null,
        "usertags": null,
        "image_versions2": {
          "candidates": [
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774993881_18549990505074731_1733467400335382529_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=106&ig_cache_key=Mzk2MzM5ODc0NzE3NzkxODUyNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjE2MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Fp63TX-CxpEQ7kNvwEzaE1A&_nc_oc=AdpUdYT80RWeKnEnSaKIWSLSAm5Ixwj220MFztoWw5FLLa3O-UbwLVchsXKe0kLX40I&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHoIYalwUU5feB790yKtonjz1mPm21X92ldK6Y-QMXXtg&oe=6A84ADE7",
              "height": 2700,
              "width": 2160
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774993881_18549990505074731_1733467400335382529_n.jpg?stp=dst-jpg_e35_p1080x1080_tt6&_nc_cat=106&ig_cache_key=Mzk2MzM5ODc0NzE3NzkxODUyNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjE2MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Fp63TX-CxpEQ7kNvwEzaE1A&_nc_oc=AdpUdYT80RWeKnEnSaKIWSLSAm5Ixwj220MFztoWw5FLLa3O-UbwLVchsXKe0kLX40I&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFO0n2dm1ZHBo1a-PLtWF3fF_AFGgQx1tnBuxzV0q064g&oe=6A84ADE7",
              "height": 1350,
              "width": 1080
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774993881_18549990505074731_1733467400335382529_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=106&ig_cache_key=Mzk2MzM5ODc0NzE3NzkxODUyNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjE2MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Fp63TX-CxpEQ7kNvwEzaE1A&_nc_oc=AdpUdYT80RWeKnEnSaKIWSLSAm5Ixwj220MFztoWw5FLLa3O-UbwLVchsXKe0kLX40I&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEpx66c-C4lGtkpRwF8vAN_eY8uTdZaSVUXmGmOGvTyXA&oe=6A84ADE7",
              "height": 900,
              "width": 720
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774993881_18549990505074731_1733467400335382529_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=106&ig_cache_key=Mzk2MzM5ODc0NzE3NzkxODUyNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjE2MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Fp63TX-CxpEQ7kNvwEzaE1A&_nc_oc=AdpUdYT80RWeKnEnSaKIWSLSAm5Ixwj220MFztoWw5FLLa3O-UbwLVchsXKe0kLX40I&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGKNMzYZmIlmXaLmV5-sR2FcXAUHGu-2USgSYnQ1vFv7g&oe=6A84ADE7",
              "height": 800,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774993881_18549990505074731_1733467400335382529_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=106&ig_cache_key=Mzk2MzM5ODc0NzE3NzkxODUyNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjE2MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Fp63TX-CxpEQ7kNvwEzaE1A&_nc_oc=AdpUdYT80RWeKnEnSaKIWSLSAm5Ixwj220MFztoWw5FLLa3O-UbwLVchsXKe0kLX40I&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQF9tRjpTCv9bvyuTCE0HcVKGqRoAPbapvubiXZj0Dh2Xg&oe=6A84ADE7",
              "height": 600,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774993881_18549990505074731_1733467400335382529_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=106&ig_cache_key=Mzk2MzM5ODc0NzE3NzkxODUyNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjE2MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Fp63TX-CxpEQ7kNvwEzaE1A&_nc_oc=AdpUdYT80RWeKnEnSaKIWSLSAm5Ixwj220MFztoWw5FLLa3O-UbwLVchsXKe0kLX40I&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHGh39eDk5jHZlVaCkYs-F3TuSypfACOt5i6tO7roxSvw&oe=6A84ADE7",
              "height": 400,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774993881_18549990505074731_1733467400335382529_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=106&ig_cache_key=Mzk2MzM5ODc0NzE3NzkxODUyNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjE2MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Fp63TX-CxpEQ7kNvwEzaE1A&_nc_oc=AdpUdYT80RWeKnEnSaKIWSLSAm5Ixwj220MFztoWw5FLLa3O-UbwLVchsXKe0kLX40I&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFw64VwXwmu6DWn5onsfOMH4Uuy7fmr7emHeFUJHZbb8w&oe=6A84ADE7",
              "height": 300,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774993881_18549990505074731_1733467400335382529_n.jpg?stp=c0.270.2160.2160a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=106&ig_cache_key=Mzk2MzM5ODc0NzE3NzkxODUyNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjE2MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Fp63TX-CxpEQ7kNvwEzaE1A&_nc_oc=AdpUdYT80RWeKnEnSaKIWSLSAm5Ixwj220MFztoWw5FLLa3O-UbwLVchsXKe0kLX40I&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHb16Z7mcCfH0YImR245E9hcCWbbaCuyw1UsjpOSU-dEg&oe=6A84ADE7",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774993881_18549990505074731_1733467400335382529_n.jpg?stp=c0.270.2160.2160a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=106&ig_cache_key=Mzk2MzM5ODc0NzE3NzkxODUyNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjE2MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Fp63TX-CxpEQ7kNvwEzaE1A&_nc_oc=AdpUdYT80RWeKnEnSaKIWSLSAm5Ixwj220MFztoWw5FLLa3O-UbwLVchsXKe0kLX40I&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFqSP30TaPoC8I-fulLtmxNC0oYMzqq28K8wbsNVNjmZw&oe=6A84ADE7",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774993881_18549990505074731_1733467400335382529_n.jpg?stp=c0.270.2160.2160a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=106&ig_cache_key=Mzk2MzM5ODc0NzE3NzkxODUyNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjE2MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Fp63TX-CxpEQ7kNvwEzaE1A&_nc_oc=AdpUdYT80RWeKnEnSaKIWSLSAm5Ixwj220MFztoWw5FLLa3O-UbwLVchsXKe0kLX40I&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQECRSoYc0zIKe9j-dDY8ceehy7ToXM7KlQrLmVB-isH_Q&oe=6A84ADE7",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774993881_18549990505074731_1733467400335382529_n.jpg?stp=c0.270.2160.2160a_dst-jpg_e35_s480x480_tt6&_nc_cat=106&ig_cache_key=Mzk2MzM5ODc0NzE3NzkxODUyNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjE2MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Fp63TX-CxpEQ7kNvwEzaE1A&_nc_oc=AdpUdYT80RWeKnEnSaKIWSLSAm5Ixwj220MFztoWw5FLLa3O-UbwLVchsXKe0kLX40I&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQH2UYFfmRX1NZNkOREG4MizEfQplUDFHqLsELuofrPcpQ&oe=6A84ADE7",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774993881_18549990505074731_1733467400335382529_n.jpg?stp=c0.270.2160.2160a_dst-jpg_e35_s320x320_tt6&_nc_cat=106&ig_cache_key=Mzk2MzM5ODc0NzE3NzkxODUyNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjE2MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Fp63TX-CxpEQ7kNvwEzaE1A&_nc_oc=AdpUdYT80RWeKnEnSaKIWSLSAm5Ixwj220MFztoWw5FLLa3O-UbwLVchsXKe0kLX40I&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFkG4Sbj6rs_xC-7zkM_QBonEhB318icbPb9bEe7hXBjw&oe=6A84ADE7",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774993881_18549990505074731_1733467400335382529_n.jpg?stp=c0.270.2160.2160a_dst-jpg_e35_s240x240_tt6&_nc_cat=106&ig_cache_key=Mzk2MzM5ODc0NzE3NzkxODUyNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjE2MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Fp63TX-CxpEQ7kNvwEzaE1A&_nc_oc=AdpUdYT80RWeKnEnSaKIWSLSAm5Ixwj220MFztoWw5FLLa3O-UbwLVchsXKe0kLX40I&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEXRKmcI1n2C6Bvn1EaAq67or_muT1D6iR9y-S_q5RqNQ&oe=6A84ADE7",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774993881_18549990505074731_1733467400335382529_n.jpg?stp=c0.270.2160.2160a_dst-jpg_e35_s150x150_tt6&_nc_cat=106&ig_cache_key=Mzk2MzM5ODc0NzE3NzkxODUyNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjE2MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Fp63TX-CxpEQ7kNvwEzaE1A&_nc_oc=AdpUdYT80RWeKnEnSaKIWSLSAm5Ixwj220MFztoWw5FLLa3O-UbwLVchsXKe0kLX40I&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHsGK7ppdJe2OdIKomWAdQmt86p_V3vAHQEaa-kn60N1A&oe=6A84ADE7",
              "height": 150,
              "width": 150
            }
          ]
        },
        "carousel_parent_id": "3963398885586570584_2237970730",
        "sharing_friction_info": {
          "bloks_app_url": null,
          "should_have_sharing_friction": false
        },
        "preview": null,
        "organic_tracking_token": null,
        "saved_collection_ids": null,
        "has_viewer_saved": null,
        "video_versions": null,
        "media_overlay_info": null,
        "code": null,
        "display_uri": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774993881_18549990505074731_1733467400335382529_n.jpg?stp=c0.270.2160.2160a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=OhgUGUHQj50Q7kNvwEX9cbC&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQFnPTxQbTyVob7FjykOiiT42kJuFgJjgas8vgl4iFzHPA&oe=6A84ADE7&_nc_sid=7a9f4b",
        "number_of_qualities": null,
        "product_type": "carousel_item",
        "carousel_media": null,
        "taken_at": 1786693986,
        "previous_submitter": null,
        "link": null,
        "story_cta": null,
        "has_liked": null,
        "like_count": null,
        "logging_info_token": null,
        "has_audio": null,
        "clips_metadata": null
      }
    ],
    "coauthor_producers": [],
    "timeline_pinned_user_ids": [],
    "date": "2026-08-14T07:53:07.000Z",
    "crawled_at": "2026-08-14T08:16:43.756Z"
  },
  {
    "id": "3963395413478023137_2237970730",
    "pk": "3963395413478023137",
    "type": "Video",
    "image": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773756666_18549989311074731_7591783819368902774_n.jpg?stp=c0.469.1206.1206a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=ddJVZdEXwSsQ7kNvwHg8Ipy&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGpLDg9ER6gi5efxfkC1-HpgDrP8hVNoskSr6LWGigb5A&oe=6A849B87&_nc_sid=7a9f4b",
    "shortcode": "DcAzyEsxR_h",
    "product_type": "clips",
    "hashtags": [
      "#pakuwonmalljogja"
    ],
    "mentions": [
      "@juli_iskandar",
      "@vickyratihw",
      "@tanpurnomosidi"
    ],
    "location": null,
    "caption": "🔥 CRUNCHMATE NOW OPEN! 🔥\n\nCrunchmate sekarang hadir di Pakuwon Mall Jogja LG Floor! 🤩✨\nJangan sampai lewatkan PROMO SPESIAL BUY 1 GET 1!\n📅 14–20 Agustus 2026\n\nYuk cobain Crunchmate sekarang! 😋🔥\n\n#pakuwonmalljogja",
    "comment_count": 0,
    "like_count": 12,
    "view_count": null,
    "has_audio": true,
    "usertags": [
      {
        "user": {
          "pk": "1228374574",
          "full_name": "Juliaty Iskandar",
          "username": "juli_iskandar",
          "profile_pic_url": "https://scontent-atl3-1.cdninstagram.com/v/t51.2885-19/54800477_2189592477793980_624948081216978944_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby45NjAuYzIifQ&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_cat=100&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=Iz2JRul0k6kQ7kNvwGS7iPT&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQEJzXeoF_r3k1OQFfLnoZvNYRAIZVhvsnbDtR49oCuZiQ&oe=6A8492D0&_nc_sid=7a9f4b",
          "is_verified": false,
          "id": "1228374574",
          "aigm_account_label_info": null
        },
        "position": [
          0,
          0
        ]
      },
      {
        "user": {
          "pk": "1581178877",
          "full_name": "Vicky Ratih",
          "username": "vickyratihw",
          "profile_pic_url": "https://scontent-atl3-2.cdninstagram.com/v/t51.2885-19/145976495_717061658996801_8615672779095137678_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby43MjAuYzIifQ&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_cat=105&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=NEQAeZQ5-dcQ7kNvwFfa8MA&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQFnsqG13qZ3U63vA-xuQub2w2GK9Edai04YBCk9p-WQlA&oe=6A849B1B&_nc_sid=7a9f4b",
          "is_verified": false,
          "id": "1581178877",
          "aigm_account_label_info": null
        },
        "position": [
          0,
          0
        ]
      },
      {
        "user": {
          "pk": "4012187437",
          "full_name": "Tan Purnomosidi",
          "username": "tanpurnomosidi",
          "profile_pic_url": "https://scontent-atl3-1.cdninstagram.com/v/t51.2885-19/122597843_342367900160616_7189706853388346855_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_cat=100&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=z4pokypaePIQ7kNvwFjTJOH&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQE46a-M6IKcKYiyb_OYTo02hA-2QgxBMpxQi7A6G8Gdvg&oe=6A849E78&_nc_sid=7a9f4b",
          "is_verified": true,
          "id": "4012187437",
          "aigm_account_label_info": null
        },
        "position": [
          0,
          0
        ]
      }
    ],
    "clips_metadata": {
      "audio_type": "original_sounds",
      "achievements_info": {
        "show_achievements": false
      },
      "music_info": null,
      "original_sound_info": {
        "original_audio_title": "Original audio",
        "should_mute_audio": false,
        "audio_asset_id": "38065605813030603",
        "consumption_info": {
          "is_trending_in_clips": false,
          "should_mute_audio_reason": "",
          "should_mute_audio_reason_type": null
        },
        "ig_artist": {
          "username": "pakuwonmall.jogja",
          "id": "2237970730",
          "profile_pic_url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=L9VCN6COaTMQ7kNvwHOtFy0&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQEM_oL-JrA3TqdAkw0HaavzLRi54AM8nCTvpERnqwDeWQ&oe=6A84A633&_nc_sid=7a9f4b"
        },
        "is_explicit": false,
        "audio_filter_infos": []
      },
      "originality_info": null,
      "is_shared_to_fb": false
    },
    "from_url": "https://www.instagram.com/pakuwonmall.jogja/",
    "post_url": "https://www.instagram.com/p/DcAzyEsxR_h/",
    "video_duration": 29.467,
    "user": {
      "pk": "2237970730",
      "profile_pic_url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=L9VCN6COaTMQ7kNvwHOtFy0&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQEM_oL-JrA3TqdAkw0HaavzLRi54AM8nCTvpERnqwDeWQ&oe=6A84A633&_nc_sid=7a9f4b",
      "username": "pakuwonmall.jogja",
      "is_private": false,
      "is_embeds_disabled": false,
      "is_unpublished": false,
      "is_verified": true,
      "friendship_status": null,
      "latest_besties_reel_media": null,
      "latest_reel_media": null,
      "live_broadcast_visibility": null,
      "live_broadcast_id": null,
      "show_account_transparency_details": true,
      "transparency_product": null,
      "transparency_product_enabled": false,
      "transparency_label": null,
      "ai_agent_owner_username": null,
      "id": "2237970730",
      "aigm_account_label_info": null,
      "hd_profile_pic_url_info": {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=L9VCN6COaTMQ7kNvwHOtFy0&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGSwOGkAaLzHNq-6Ef-eLq1M-C4wS7L_s0lWwJa9u0Lnw&oe=6A84A633&_nc_sid=7a9f4b"
      },
      "__typename": "XDTUserDict",
      "full_name": "Pakuwon Mall Jogja"
    },
    "images": [
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773756666_18549989311074731_7591783819368902774_n.jpg?stp=dst-jpg_e15_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5NTQxMzQ3ODAyMzEzNzE4NTQ5OTg5MzA1MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=mzszszFNp7QQ7kNvwHPUcH1&_nc_oc=AdoIpU0bp7WrsbCo1e4RaS4w2urKQGqCkF3p5HGGLTzSVR8Zp9CZ9w7ild7FWOg4zqs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEcJKOCpgEFY-wJGJHzlLlkw_p2YuZvCjgMeVxDYibs0g&oe=6A849B87",
        "height": 2144,
        "width": 1206
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773756666_18549989311074731_7591783819368902774_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5NTQxMzQ3ODAyMzEzNzE4NTQ5OTg5MzA1MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=mzszszFNp7QQ7kNvwHPUcH1&_nc_oc=AdoIpU0bp7WrsbCo1e4RaS4w2urKQGqCkF3p5HGGLTzSVR8Zp9CZ9w7ild7FWOg4zqs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFhMvowwDLSmfweEkmXVKiBxLGCmikEXklumDMlQO_5Lw&oe=6A849B87",
        "height": 1920,
        "width": 1080
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773756666_18549989311074731_7591783819368902774_n.jpg?stp=dst-jpg_e35_p720x720_sh2.08_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5NTQxMzQ3ODAyMzEzNzE4NTQ5OTg5MzA1MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=mzszszFNp7QQ7kNvwHPUcH1&_nc_oc=AdoIpU0bp7WrsbCo1e4RaS4w2urKQGqCkF3p5HGGLTzSVR8Zp9CZ9w7ild7FWOg4zqs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFoAF40wv18Hf7ZjOx2rLaWws5hVOwbA-oJJreY1OUoXQ&oe=6A849B87",
        "height": 1280,
        "width": 720
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773756666_18549989311074731_7591783819368902774_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5NTQxMzQ3ODAyMzEzNzE4NTQ5OTg5MzA1MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=mzszszFNp7QQ7kNvwHPUcH1&_nc_oc=AdoIpU0bp7WrsbCo1e4RaS4w2urKQGqCkF3p5HGGLTzSVR8Zp9CZ9w7ild7FWOg4zqs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQF57HuhndEvNuB4-MW_dY9CESu23KHa10KiXEnhdLu8Jg&oe=6A849B87",
        "height": 1138,
        "width": 640
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773756666_18549989311074731_7591783819368902774_n.jpg?stp=dst-jpg_e15_p480x480_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5NTQxMzQ3ODAyMzEzNzE4NTQ5OTg5MzA1MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=mzszszFNp7QQ7kNvwHPUcH1&_nc_oc=AdoIpU0bp7WrsbCo1e4RaS4w2urKQGqCkF3p5HGGLTzSVR8Zp9CZ9w7ild7FWOg4zqs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQH_vmnoxOjuY2IiOf7vtF_HjzxQmJNfHD6mnwjKgqvdTg&oe=6A849B87",
        "height": 853,
        "width": 480
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773756666_18549989311074731_7591783819368902774_n.jpg?stp=dst-jpg_e15_p320x320_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5NTQxMzQ3ODAyMzEzNzE4NTQ5OTg5MzA1MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=mzszszFNp7QQ7kNvwHPUcH1&_nc_oc=AdoIpU0bp7WrsbCo1e4RaS4w2urKQGqCkF3p5HGGLTzSVR8Zp9CZ9w7ild7FWOg4zqs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEw54HRiLbldZoJ0nE5e6IQD6Oanx2UUjJYq4Uo-UoFqA&oe=6A849B87",
        "height": 569,
        "width": 320
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773756666_18549989311074731_7591783819368902774_n.jpg?stp=dst-jpg_e15_p240x240_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5NTQxMzQ3ODAyMzEzNzE4NTQ5OTg5MzA1MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=mzszszFNp7QQ7kNvwHPUcH1&_nc_oc=AdoIpU0bp7WrsbCo1e4RaS4w2urKQGqCkF3p5HGGLTzSVR8Zp9CZ9w7ild7FWOg4zqs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEI7_U4dKWR8J0bcNNEF4VB-V5gZNJdIJc1d7CpE97xYQ&oe=6A849B87",
        "height": 427,
        "width": 240
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773756666_18549989311074731_7591783819368902774_n.jpg?stp=c0.469.1206.1206a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5NTQxMzQ3ODAyMzEzNzE4NTQ5OTg5MzA1MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=mzszszFNp7QQ7kNvwHPUcH1&_nc_oc=AdoIpU0bp7WrsbCo1e4RaS4w2urKQGqCkF3p5HGGLTzSVR8Zp9CZ9w7ild7FWOg4zqs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEWs2ZjOnav_y3u9PlQj4meFg95gCR-Nwbk7Nt9ACy-0w&oe=6A849B87",
        "height": 1080,
        "width": 1080
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773756666_18549989311074731_7591783819368902774_n.jpg?stp=c0.469.1206.1206a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5NTQxMzQ3ODAyMzEzNzE4NTQ5OTg5MzA1MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=mzszszFNp7QQ7kNvwHPUcH1&_nc_oc=AdoIpU0bp7WrsbCo1e4RaS4w2urKQGqCkF3p5HGGLTzSVR8Zp9CZ9w7ild7FWOg4zqs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHmQ-Pvkq8SMJY-QCSKw400JK8wA0o5yb616ZHhGgEojQ&oe=6A849B87",
        "height": 750,
        "width": 750
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773756666_18549989311074731_7591783819368902774_n.jpg?stp=c0.469.1206.1206a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5NTQxMzQ3ODAyMzEzNzE4NTQ5OTg5MzA1MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=mzszszFNp7QQ7kNvwHPUcH1&_nc_oc=AdoIpU0bp7WrsbCo1e4RaS4w2urKQGqCkF3p5HGGLTzSVR8Zp9CZ9w7ild7FWOg4zqs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQECV5DSOkU5ZNDaqxmH4AbpD94t0LNacwvpZJvnelCvGA&oe=6A849B87",
        "height": 640,
        "width": 640
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773756666_18549989311074731_7591783819368902774_n.jpg?stp=c0.469.1206.1206a_dst-jpg_e15_s480x480_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5NTQxMzQ3ODAyMzEzNzE4NTQ5OTg5MzA1MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=mzszszFNp7QQ7kNvwHPUcH1&_nc_oc=AdoIpU0bp7WrsbCo1e4RaS4w2urKQGqCkF3p5HGGLTzSVR8Zp9CZ9w7ild7FWOg4zqs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHwLjuHFIrPOa7oCOz5oKyn5-J0FrFCwkic-4waFIQNBA&oe=6A849B87",
        "height": 480,
        "width": 480
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773756666_18549989311074731_7591783819368902774_n.jpg?stp=c0.469.1206.1206a_dst-jpg_e15_s320x320_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5NTQxMzQ3ODAyMzEzNzE4NTQ5OTg5MzA1MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=mzszszFNp7QQ7kNvwHPUcH1&_nc_oc=AdoIpU0bp7WrsbCo1e4RaS4w2urKQGqCkF3p5HGGLTzSVR8Zp9CZ9w7ild7FWOg4zqs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEijjGw5lHUFhiSqnNrpsrosrJU5MoqHJ6SQji9dfE8jg&oe=6A849B87",
        "height": 320,
        "width": 320
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773756666_18549989311074731_7591783819368902774_n.jpg?stp=c0.469.1206.1206a_dst-jpg_e15_s240x240_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5NTQxMzQ3ODAyMzEzNzE4NTQ5OTg5MzA1MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=mzszszFNp7QQ7kNvwHPUcH1&_nc_oc=AdoIpU0bp7WrsbCo1e4RaS4w2urKQGqCkF3p5HGGLTzSVR8Zp9CZ9w7ild7FWOg4zqs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFUV-tBk7yq3gIEpvn5IBmmarVuZe7Ji38b2Su7w1qNRA&oe=6A849B87",
        "height": 240,
        "width": 240
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773756666_18549989311074731_7591783819368902774_n.jpg?stp=c0.469.1206.1206a_dst-jpg_e15_s150x150_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5NTQxMzQ3ODAyMzEzNzE4NTQ5OTg5MzA1MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=mzszszFNp7QQ7kNvwHPUcH1&_nc_oc=AdoIpU0bp7WrsbCo1e4RaS4w2urKQGqCkF3p5HGGLTzSVR8Zp9CZ9w7ild7FWOg4zqs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFEMQjZI23yTxPtYmFzW3W9xZ_bMwjFeYfpXDNtWHRFqg&oe=6A849B87",
        "height": 150,
        "width": 150
      }
    ],
    "video_versions": [
      {
        "width": 720,
        "height": 1280,
        "url": "https://scontent-atl3-3.cdninstagram.com/o1/v/t2/f2/m86/AQPW1xBV6GTA3dwXu0_G8_z4xkzuX9IOsruu9nkYqRbzMCrZoPvIk_5m9r16I6ZjbyquJu3xnSu2D2Id-Qjor2mOrrzz1HAgg36yKRA.mp4?_nc_cat=111&_nc_sid=5e9851&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_ohc=QDOA9g00bsQQ7kNvwHZjUdK&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTU5NjYyOTkwODU2NDczMywiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjoyOSwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=599f7cf31d94d0a9&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC8wQTRGNjdGRjZDNUNCNjE4QUVBNzAwMjM1NjZGMTZBRV92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyL0UyNEMwNUREQjQzM0EzQ0ZGNTQ2ODA0Qjc1NTgwOUI5X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACb6q83oi4jWBRUCKAJDMywXQD13S8an754YEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&_nc_zt=28&oh=00_AQGdYHt8eqJLj5KlkbpWytDzy-ROEhhoDzvDRVFzsjEkJw&oe=6A80A6D0",
        "type": 101
      },
      {
        "width": 720,
        "height": 1280,
        "url": "https://scontent-atl3-3.cdninstagram.com/o1/v/t2/f2/m86/AQPW1xBV6GTA3dwXu0_G8_z4xkzuX9IOsruu9nkYqRbzMCrZoPvIk_5m9r16I6ZjbyquJu3xnSu2D2Id-Qjor2mOrrzz1HAgg36yKRA.mp4?_nc_cat=111&_nc_sid=5e9851&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_ohc=QDOA9g00bsQQ7kNvwHZjUdK&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTU5NjYyOTkwODU2NDczMywiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjoyOSwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=599f7cf31d94d0a9&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC8wQTRGNjdGRjZDNUNCNjE4QUVBNzAwMjM1NjZGMTZBRV92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyL0UyNEMwNUREQjQzM0EzQ0ZGNTQ2ODA0Qjc1NTgwOUI5X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACb6q83oi4jWBRUCKAJDMywXQD13S8an754YEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&_nc_zt=28&oh=00_AQGdYHt8eqJLj5KlkbpWytDzy-ROEhhoDzvDRVFzsjEkJw&oe=6A80A6D0",
        "type": 102
      },
      {
        "width": 720,
        "height": 1280,
        "url": "https://scontent-atl3-3.cdninstagram.com/o1/v/t2/f2/m86/AQPW1xBV6GTA3dwXu0_G8_z4xkzuX9IOsruu9nkYqRbzMCrZoPvIk_5m9r16I6ZjbyquJu3xnSu2D2Id-Qjor2mOrrzz1HAgg36yKRA.mp4?_nc_cat=111&_nc_sid=5e9851&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_ohc=QDOA9g00bsQQ7kNvwHZjUdK&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTU5NjYyOTkwODU2NDczMywiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjoyOSwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=599f7cf31d94d0a9&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC8wQTRGNjdGRjZDNUNCNjE4QUVBNzAwMjM1NjZGMTZBRV92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyL0UyNEMwNUREQjQzM0EzQ0ZGNTQ2ODA0Qjc1NTgwOUI5X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACb6q83oi4jWBRUCKAJDMywXQD13S8an754YEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&_nc_zt=28&oh=00_AQGdYHt8eqJLj5KlkbpWytDzy-ROEhhoDzvDRVFzsjEkJw&oe=6A80A6D0",
        "type": 103
      }
    ],
    "carousel_media_count": null,
    "carousel_media": null,
    "coauthor_producers": [],
    "timeline_pinned_user_ids": [],
    "date": "2026-08-14T07:47:26.000Z",
    "crawled_at": "2026-08-14T08:16:43.756Z"
  },
  {
    "id": "3963391870218908290_2237970730",
    "pk": "3963391870218908290",
    "type": "Image",
    "image": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=c0.187.1179.1179a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=AaQoeHLV-NgQ7kNvwEQH9ct&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQH_3C87mEaIhX3556g4Qwzd59qBLdiUMlMJhHZAQ_g6LA&oe=6A84A99B&_nc_sid=7a9f4b",
    "shortcode": "DcAy-gyEbKC",
    "product_type": "carousel_container",
    "hashtags": [
      "#JETE",
      "#JETEIndonesia",
      "#MerdekaBelanja",
      "#MerdekaHemat",
      "#PromoJETE"
    ],
    "mentions": [],
    "location": null,
    "caption": "🇮🇩 MERDEKA BELANJA, MERDEKA HEMAT! 🇮🇩\n\nRayakan kemerdekaan dengan promo spesial dari JETE! 🔥\nNikmati DISKON 50% OFF ALL ITEMS khusus produk JETE! 🎉\n\n🗓️ 15–17 Agustus 2026\n\nSaatnya lengkapi kebutuhan gadget kamu dengan harga lebih hemat! ⚡\nJangan sampai kelewatan, cuma 3 hari!\n\n#JETE #JETEIndonesia #MerdekaBelanja #MerdekaHemat #PromoJETE",
    "comment_count": 0,
    "like_count": 0,
    "view_count": null,
    "has_audio": null,
    "usertags": null,
    "clips_metadata": null,
    "from_url": "https://www.instagram.com/pakuwonmall.jogja/",
    "post_url": "https://www.instagram.com/p/DcAy-gyEbKC/",
    "video_duration": null,
    "user": {
      "pk": "2237970730",
      "profile_pic_url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=L9VCN6COaTMQ7kNvwHOtFy0&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQEM_oL-JrA3TqdAkw0HaavzLRi54AM8nCTvpERnqwDeWQ&oe=6A84A633&_nc_sid=7a9f4b",
      "username": "pakuwonmall.jogja",
      "is_private": false,
      "is_embeds_disabled": false,
      "is_unpublished": false,
      "is_verified": true,
      "friendship_status": null,
      "latest_besties_reel_media": null,
      "latest_reel_media": null,
      "live_broadcast_visibility": null,
      "live_broadcast_id": null,
      "show_account_transparency_details": true,
      "transparency_product": null,
      "transparency_product_enabled": false,
      "transparency_label": null,
      "ai_agent_owner_username": null,
      "id": "2237970730",
      "aigm_account_label_info": null,
      "hd_profile_pic_url_info": {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=L9VCN6COaTMQ7kNvwHOtFy0&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGSwOGkAaLzHNq-6Ef-eLq1M-C4wS7L_s0lWwJa9u0Lnw&oe=6A84A633&_nc_sid=7a9f4b"
      },
      "__typename": "XDTUserDict",
      "full_name": "Pakuwon Mall Jogja"
    },
    "images": [
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwHvSWA9&_nc_oc=AdoGJRg9KXF_i5Hs666OtW2UUh9WWbxxXsSCsKc31LxsoJHfh8MZSWh5IDuKaM_vyqM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGAzdj7Nnzg9UZ3GagCqvoQZg2gQDUWScAx7IH60bSYVQ&oe=6A84A99B",
        "height": 1553,
        "width": 1179
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwHvSWA9&_nc_oc=AdoGJRg9KXF_i5Hs666OtW2UUh9WWbxxXsSCsKc31LxsoJHfh8MZSWh5IDuKaM_vyqM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHb3WfSvQfGC75ejHNxwg61q3dBVe1IvSD0rraYuc5Y1g&oe=6A84A99B",
        "height": 948,
        "width": 720
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwHvSWA9&_nc_oc=AdoGJRg9KXF_i5Hs666OtW2UUh9WWbxxXsSCsKc31LxsoJHfh8MZSWh5IDuKaM_vyqM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQE3hEZcFn6iMKO1Z1lMVIDCAGZcecF8hn7vo1_91cQrMw&oe=6A84A99B",
        "height": 843,
        "width": 640
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwHvSWA9&_nc_oc=AdoGJRg9KXF_i5Hs666OtW2UUh9WWbxxXsSCsKc31LxsoJHfh8MZSWh5IDuKaM_vyqM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFHMCGvP3itinnR45JYpT5OVezfTdM_9SWOuKbQDdqZ-w&oe=6A84A99B",
        "height": 632,
        "width": 480
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwHvSWA9&_nc_oc=AdoGJRg9KXF_i5Hs666OtW2UUh9WWbxxXsSCsKc31LxsoJHfh8MZSWh5IDuKaM_vyqM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEC6_6z_ddlncyqKGWdP3v4csVkC3B_kCIc1laZlA0BpQ&oe=6A84A99B",
        "height": 422,
        "width": 320
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwHvSWA9&_nc_oc=AdoGJRg9KXF_i5Hs666OtW2UUh9WWbxxXsSCsKc31LxsoJHfh8MZSWh5IDuKaM_vyqM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEI44cyXcdHuZ6BpV3hijAia6DUP1Xs2j62BxsuV5PxMg&oe=6A84A99B",
        "height": 316,
        "width": 240
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=c0.187.1179.1179a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwHvSWA9&_nc_oc=AdoGJRg9KXF_i5Hs666OtW2UUh9WWbxxXsSCsKc31LxsoJHfh8MZSWh5IDuKaM_vyqM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFvRJmQfTj1NDnNtMEvf-OiYVE7sU7R3D-nMxlDH177Qg&oe=6A84A99B",
        "height": 1080,
        "width": 1080
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=c0.187.1179.1179a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwHvSWA9&_nc_oc=AdoGJRg9KXF_i5Hs666OtW2UUh9WWbxxXsSCsKc31LxsoJHfh8MZSWh5IDuKaM_vyqM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHUtHvD008_Ds0JMePRkVJennE7cHXFVK7e-anj04zxuA&oe=6A84A99B",
        "height": 750,
        "width": 750
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=c0.187.1179.1179a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwHvSWA9&_nc_oc=AdoGJRg9KXF_i5Hs666OtW2UUh9WWbxxXsSCsKc31LxsoJHfh8MZSWh5IDuKaM_vyqM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGp5DsMnJdABHweaIpqqjA1q5W7Sz1qtC3K5nrB7Qkrvg&oe=6A84A99B",
        "height": 640,
        "width": 640
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=c0.187.1179.1179a_dst-jpg_e35_s480x480_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwHvSWA9&_nc_oc=AdoGJRg9KXF_i5Hs666OtW2UUh9WWbxxXsSCsKc31LxsoJHfh8MZSWh5IDuKaM_vyqM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGr7-Zw0u9piw9-9vkt2y6cOZZXEsomMp1vsy39jb2TbA&oe=6A84A99B",
        "height": 480,
        "width": 480
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=c0.187.1179.1179a_dst-jpg_e35_s320x320_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwHvSWA9&_nc_oc=AdoGJRg9KXF_i5Hs666OtW2UUh9WWbxxXsSCsKc31LxsoJHfh8MZSWh5IDuKaM_vyqM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQH4c5u1MC6yUi7JKigvae9-teLbb7B161jb8xMdJx3K4w&oe=6A84A99B",
        "height": 320,
        "width": 320
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=c0.187.1179.1179a_dst-jpg_e35_s240x240_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwHvSWA9&_nc_oc=AdoGJRg9KXF_i5Hs666OtW2UUh9WWbxxXsSCsKc31LxsoJHfh8MZSWh5IDuKaM_vyqM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHqsVi6CBASLhW3SNjyp4q8qIyjFLS1pcFxScxUUbQVEg&oe=6A84A99B",
        "height": 240,
        "width": 240
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=c0.187.1179.1179a_dst-jpg_e35_s150x150_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwHvSWA9&_nc_oc=AdoGJRg9KXF_i5Hs666OtW2UUh9WWbxxXsSCsKc31LxsoJHfh8MZSWh5IDuKaM_vyqM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGo6TsphTPGdzLpK2y3jcAhplVvR-g0Dix9HAGq-09ncQ&oe=6A84A99B",
        "height": 150,
        "width": 150
      }
    ],
    "video_versions": null,
    "carousel_media_count": 2,
    "carousel_media": [
      {
        "id": "3963391725485245627_2237970730",
        "pk": "3963391725485245627",
        "accessibility_caption": null,
        "is_dash_eligible": null,
        "video_dash_manifest": null,
        "media_type": 1,
        "original_height": 1553,
        "original_width": 1179,
        "inventory_source": null,
        "user": null,
        "usertags": null,
        "image_versions2": {
          "candidates": [
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwHvSWA9&_nc_oc=AdoGJRg9KXF_i5Hs666OtW2UUh9WWbxxXsSCsKc31LxsoJHfh8MZSWh5IDuKaM_vyqM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGAzdj7Nnzg9UZ3GagCqvoQZg2gQDUWScAx7IH60bSYVQ&oe=6A84A99B",
              "height": 1553,
              "width": 1179
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwHvSWA9&_nc_oc=AdoGJRg9KXF_i5Hs666OtW2UUh9WWbxxXsSCsKc31LxsoJHfh8MZSWh5IDuKaM_vyqM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHb3WfSvQfGC75ejHNxwg61q3dBVe1IvSD0rraYuc5Y1g&oe=6A84A99B",
              "height": 948,
              "width": 720
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwHvSWA9&_nc_oc=AdoGJRg9KXF_i5Hs666OtW2UUh9WWbxxXsSCsKc31LxsoJHfh8MZSWh5IDuKaM_vyqM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQE3hEZcFn6iMKO1Z1lMVIDCAGZcecF8hn7vo1_91cQrMw&oe=6A84A99B",
              "height": 843,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwHvSWA9&_nc_oc=AdoGJRg9KXF_i5Hs666OtW2UUh9WWbxxXsSCsKc31LxsoJHfh8MZSWh5IDuKaM_vyqM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFHMCGvP3itinnR45JYpT5OVezfTdM_9SWOuKbQDdqZ-w&oe=6A84A99B",
              "height": 632,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwHvSWA9&_nc_oc=AdoGJRg9KXF_i5Hs666OtW2UUh9WWbxxXsSCsKc31LxsoJHfh8MZSWh5IDuKaM_vyqM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEC6_6z_ddlncyqKGWdP3v4csVkC3B_kCIc1laZlA0BpQ&oe=6A84A99B",
              "height": 422,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwHvSWA9&_nc_oc=AdoGJRg9KXF_i5Hs666OtW2UUh9WWbxxXsSCsKc31LxsoJHfh8MZSWh5IDuKaM_vyqM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEI44cyXcdHuZ6BpV3hijAia6DUP1Xs2j62BxsuV5PxMg&oe=6A84A99B",
              "height": 316,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=c0.187.1179.1179a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwHvSWA9&_nc_oc=AdoGJRg9KXF_i5Hs666OtW2UUh9WWbxxXsSCsKc31LxsoJHfh8MZSWh5IDuKaM_vyqM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFvRJmQfTj1NDnNtMEvf-OiYVE7sU7R3D-nMxlDH177Qg&oe=6A84A99B",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=c0.187.1179.1179a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwHvSWA9&_nc_oc=AdoGJRg9KXF_i5Hs666OtW2UUh9WWbxxXsSCsKc31LxsoJHfh8MZSWh5IDuKaM_vyqM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHUtHvD008_Ds0JMePRkVJennE7cHXFVK7e-anj04zxuA&oe=6A84A99B",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=c0.187.1179.1179a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwHvSWA9&_nc_oc=AdoGJRg9KXF_i5Hs666OtW2UUh9WWbxxXsSCsKc31LxsoJHfh8MZSWh5IDuKaM_vyqM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGp5DsMnJdABHweaIpqqjA1q5W7Sz1qtC3K5nrB7Qkrvg&oe=6A84A99B",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=c0.187.1179.1179a_dst-jpg_e35_s480x480_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwHvSWA9&_nc_oc=AdoGJRg9KXF_i5Hs666OtW2UUh9WWbxxXsSCsKc31LxsoJHfh8MZSWh5IDuKaM_vyqM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGr7-Zw0u9piw9-9vkt2y6cOZZXEsomMp1vsy39jb2TbA&oe=6A84A99B",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=c0.187.1179.1179a_dst-jpg_e35_s320x320_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwHvSWA9&_nc_oc=AdoGJRg9KXF_i5Hs666OtW2UUh9WWbxxXsSCsKc31LxsoJHfh8MZSWh5IDuKaM_vyqM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQH4c5u1MC6yUi7JKigvae9-teLbb7B161jb8xMdJx3K4w&oe=6A84A99B",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=c0.187.1179.1179a_dst-jpg_e35_s240x240_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwHvSWA9&_nc_oc=AdoGJRg9KXF_i5Hs666OtW2UUh9WWbxxXsSCsKc31LxsoJHfh8MZSWh5IDuKaM_vyqM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHqsVi6CBASLhW3SNjyp4q8qIyjFLS1pcFxScxUUbQVEg&oe=6A84A99B",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=c0.187.1179.1179a_dst-jpg_e35_s150x150_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwHvSWA9&_nc_oc=AdoGJRg9KXF_i5Hs666OtW2UUh9WWbxxXsSCsKc31LxsoJHfh8MZSWh5IDuKaM_vyqM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGo6TsphTPGdzLpK2y3jcAhplVvR-g0Dix9HAGq-09ncQ&oe=6A84A99B",
              "height": 150,
              "width": 150
            }
          ]
        },
        "carousel_parent_id": "3963391870218908290_2237970730",
        "sharing_friction_info": {
          "bloks_app_url": null,
          "should_have_sharing_friction": false
        },
        "preview": null,
        "organic_tracking_token": null,
        "saved_collection_ids": null,
        "has_viewer_saved": null,
        "video_versions": null,
        "media_overlay_info": null,
        "code": null,
        "display_uri": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=c0.187.1179.1179a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=AaQoeHLV-NgQ7kNvwEQH9ct&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQH_3C87mEaIhX3556g4Qwzd59qBLdiUMlMJhHZAQ_g6LA&oe=6A84A99B&_nc_sid=7a9f4b",
        "number_of_qualities": null,
        "product_type": "carousel_item",
        "carousel_media": null,
        "taken_at": 1786693150,
        "previous_submitter": null,
        "link": null,
        "story_cta": null,
        "has_liked": null,
        "like_count": null,
        "logging_info_token": null,
        "has_audio": null,
        "clips_metadata": null
      },
      {
        "id": "3963391730602226991_2237970730",
        "pk": "3963391730602226991",
        "accessibility_caption": null,
        "is_dash_eligible": null,
        "video_dash_manifest": null,
        "media_type": 1,
        "original_height": 1419,
        "original_width": 1080,
        "inventory_source": null,
        "user": null,
        "usertags": null,
        "image_versions2": {
          "candidates": [
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774126206_18549987868074731_4694917732896217054_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5MTczMDYwMjIyNjk5MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=d0lEgnt4zpsQ7kNvwFoZLs0&_nc_oc=AdrF-Hy784B_eaauGIN59nZnXJax47f-yKw9UqahgLq4KeMFzj3mGEoWe2tZtYdN6OY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGgkF6JVSGk3PqZBdYxb57c2MZjjelHB65ILDuBVPlsbA&oe=6A84A9B3",
              "height": 1419,
              "width": 1080
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774126206_18549987868074731_4694917732896217054_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5MTczMDYwMjIyNjk5MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=d0lEgnt4zpsQ7kNvwFoZLs0&_nc_oc=AdrF-Hy784B_eaauGIN59nZnXJax47f-yKw9UqahgLq4KeMFzj3mGEoWe2tZtYdN6OY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHxNsLTU2NROFQ8RqnQF8s-aVKmt7iNJGbwoIGUmMkx2g&oe=6A84A9B3",
              "height": 946,
              "width": 720
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774126206_18549987868074731_4694917732896217054_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5MTczMDYwMjIyNjk5MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=d0lEgnt4zpsQ7kNvwFoZLs0&_nc_oc=AdrF-Hy784B_eaauGIN59nZnXJax47f-yKw9UqahgLq4KeMFzj3mGEoWe2tZtYdN6OY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGO5y3jLpciCoIEazlm1FcNTfN0Eowfn7ojC9PuTcPZGw&oe=6A84A9B3",
              "height": 841,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774126206_18549987868074731_4694917732896217054_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5MTczMDYwMjIyNjk5MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=d0lEgnt4zpsQ7kNvwFoZLs0&_nc_oc=AdrF-Hy784B_eaauGIN59nZnXJax47f-yKw9UqahgLq4KeMFzj3mGEoWe2tZtYdN6OY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHhbJ_LPO3l1DcaUTgTdEtmX0xFRDcbPkb-JlKXHoOBTQ&oe=6A84A9B3",
              "height": 631,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774126206_18549987868074731_4694917732896217054_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5MTczMDYwMjIyNjk5MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=d0lEgnt4zpsQ7kNvwFoZLs0&_nc_oc=AdrF-Hy784B_eaauGIN59nZnXJax47f-yKw9UqahgLq4KeMFzj3mGEoWe2tZtYdN6OY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFiIbcPE8aJ1ZcLNV3ZAe9nmv-wEVWh06Rz954TN3W4iA&oe=6A84A9B3",
              "height": 420,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774126206_18549987868074731_4694917732896217054_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5MTczMDYwMjIyNjk5MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=d0lEgnt4zpsQ7kNvwFoZLs0&_nc_oc=AdrF-Hy784B_eaauGIN59nZnXJax47f-yKw9UqahgLq4KeMFzj3mGEoWe2tZtYdN6OY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHKv_zOpijlKQcyEFKx_K-wu3zwqTBSMSpHjK5_tuzRgQ&oe=6A84A9B3",
              "height": 315,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774126206_18549987868074731_4694917732896217054_n.jpg?stp=c0.169.1080.1080a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5MTczMDYwMjIyNjk5MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=d0lEgnt4zpsQ7kNvwFoZLs0&_nc_oc=AdrF-Hy784B_eaauGIN59nZnXJax47f-yKw9UqahgLq4KeMFzj3mGEoWe2tZtYdN6OY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHZJx98pviH55h0EtKT71AUBVj_cHMjdiTZEIqf2wan5w&oe=6A84A9B3",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774126206_18549987868074731_4694917732896217054_n.jpg?stp=c0.169.1080.1080a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5MTczMDYwMjIyNjk5MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=d0lEgnt4zpsQ7kNvwFoZLs0&_nc_oc=AdrF-Hy784B_eaauGIN59nZnXJax47f-yKw9UqahgLq4KeMFzj3mGEoWe2tZtYdN6OY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQF4MrMRlOGRYU6wirwjpxERkpHzJEfouA1So2tfhkoelA&oe=6A84A9B3",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774126206_18549987868074731_4694917732896217054_n.jpg?stp=c0.169.1080.1080a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5MTczMDYwMjIyNjk5MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=d0lEgnt4zpsQ7kNvwFoZLs0&_nc_oc=AdrF-Hy784B_eaauGIN59nZnXJax47f-yKw9UqahgLq4KeMFzj3mGEoWe2tZtYdN6OY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGRYJ-o1curw2wARI5Bz9i2uFFpibkYq7er--ehAptYDQ&oe=6A84A9B3",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774126206_18549987868074731_4694917732896217054_n.jpg?stp=c0.169.1080.1080a_dst-jpg_e35_s480x480_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5MTczMDYwMjIyNjk5MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=d0lEgnt4zpsQ7kNvwFoZLs0&_nc_oc=AdrF-Hy784B_eaauGIN59nZnXJax47f-yKw9UqahgLq4KeMFzj3mGEoWe2tZtYdN6OY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFUy-qxHOU75hVdeash-MvTjVeyKZjSFtXmSABBCkX6rw&oe=6A84A9B3",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774126206_18549987868074731_4694917732896217054_n.jpg?stp=c0.169.1080.1080a_dst-jpg_e35_s320x320_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5MTczMDYwMjIyNjk5MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=d0lEgnt4zpsQ7kNvwFoZLs0&_nc_oc=AdrF-Hy784B_eaauGIN59nZnXJax47f-yKw9UqahgLq4KeMFzj3mGEoWe2tZtYdN6OY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQH_0HpEZOmrt8qUXwlNN3-bcIxrStVRfrOa59r9RcldPA&oe=6A84A9B3",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774126206_18549987868074731_4694917732896217054_n.jpg?stp=c0.169.1080.1080a_dst-jpg_e35_s240x240_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5MTczMDYwMjIyNjk5MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=d0lEgnt4zpsQ7kNvwFoZLs0&_nc_oc=AdrF-Hy784B_eaauGIN59nZnXJax47f-yKw9UqahgLq4KeMFzj3mGEoWe2tZtYdN6OY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGipKs3mWN9IK_Xz4fe70N2KYIsg_Rwavvg1M2uM5IlYg&oe=6A84A9B3",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774126206_18549987868074731_4694917732896217054_n.jpg?stp=c0.169.1080.1080a_dst-jpg_e35_s150x150_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5MTczMDYwMjIyNjk5MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=d0lEgnt4zpsQ7kNvwFoZLs0&_nc_oc=AdrF-Hy784B_eaauGIN59nZnXJax47f-yKw9UqahgLq4KeMFzj3mGEoWe2tZtYdN6OY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHc6nI6WAKmqpoiwXgnyeztLAKkSQxhJWZq-JYmPwVvLw&oe=6A84A9B3",
              "height": 150,
              "width": 150
            }
          ]
        },
        "carousel_parent_id": "3963391870218908290_2237970730",
        "sharing_friction_info": {
          "bloks_app_url": null,
          "should_have_sharing_friction": false
        },
        "preview": null,
        "organic_tracking_token": null,
        "saved_collection_ids": null,
        "has_viewer_saved": null,
        "video_versions": null,
        "media_overlay_info": null,
        "code": null,
        "display_uri": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774126206_18549987868074731_4694917732896217054_n.jpg?stp=c0.169.1080.1080a_dst-jpg_e15_fr_s1080x1080_tt6&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=KmDo8Xvqq5EQ7kNvwG0jbiD&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQFiISfe8gPjHp1fqM0V2jEATtrvcomRV3RcifYRNPQ7Rw&oe=6A84A9B3&_nc_sid=7a9f4b",
        "number_of_qualities": null,
        "product_type": "carousel_item",
        "carousel_media": null,
        "taken_at": 1786693150,
        "previous_submitter": null,
        "link": null,
        "story_cta": null,
        "has_liked": null,
        "like_count": null,
        "logging_info_token": null,
        "has_audio": null,
        "clips_metadata": null
      }
    ],
    "coauthor_producers": [],
    "timeline_pinned_user_ids": [],
    "date": "2026-08-14T07:39:10.000Z",
    "crawled_at": "2026-08-14T08:16:43.756Z"
  },
  {
    "id": "3963390113577264213_2237970730",
    "pk": "3963390113577264213",
    "type": "Image",
    "image": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=dnVhxIs_J7IQ7kNvwFzLS_w&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHZ1EQwYd_h4q_9D6FC1w6y6wQJfeMqDG574hLUUHoJUg&oe=6A84A534&_nc_sid=7a9f4b",
    "shortcode": "DcAyk8yEWRV",
    "product_type": "carousel_container",
    "hashtags": [
      "#pakuwonmalljogja"
    ],
    "mentions": [],
    "location": null,
    "caption": "🇮🇩 MAKAN STEAK + MINUM DI @holycow_id CUMA 81 RIBUAN 🇮🇩\n\n‼️ *PROMO KEMERDEKAAN* ‼️\n\n1 Holychicken! Steak Series + 1 Flavored Tea\n\n*CUMA Rp 81.000++*\n\n_(Pilihan menu: Holychicken! Steak, African Chicken Steak dan Piccata Chicken Steak)_\n\n🗓 *16 - 17 Agustus 2026*\n\n Ajak teman makanmu & langsung aja ke @holycow_id TKP Yogyakarta Lantai 2 & nikmatin promonya sebelum kehabisan!🔥\n \nUntuk info lainnya cek @holycow_id ‼️\n\nSyarat & Ketentuan:\n- Hanya berlaku untuk transaksi Dine In\n- Berlaku hanya pada pilihan menu Holychicken! steak, African Chicken Steak & Piccata Steak saja.\n- Harga belum termasuk Tax & Service\n- Hanya berlaku pada tanggal 16 - 17 Agustus 2026\n- Tidak dapat digabungkan dengan promo lain & tidak berlaku untuk pembayaran dengan voucher\n- Berlaku di semua TKP Steak Hotel by HOLYCOW! Termasuk Steak Hotel by HOLYCOW! Express, (Tidak berlaku di TKP Bandara Halim Perdana Kusuma)\"\n\n#pakuwonmalljogja",
    "comment_count": 0,
    "like_count": 1,
    "view_count": null,
    "has_audio": null,
    "usertags": null,
    "clips_metadata": null,
    "from_url": "https://www.instagram.com/pakuwonmall.jogja/",
    "post_url": "https://www.instagram.com/p/DcAyk8yEWRV/",
    "video_duration": null,
    "user": {
      "pk": "2237970730",
      "profile_pic_url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=L9VCN6COaTMQ7kNvwHOtFy0&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQEM_oL-JrA3TqdAkw0HaavzLRi54AM8nCTvpERnqwDeWQ&oe=6A84A633&_nc_sid=7a9f4b",
      "username": "pakuwonmall.jogja",
      "is_private": false,
      "is_embeds_disabled": false,
      "is_unpublished": false,
      "is_verified": true,
      "friendship_status": null,
      "latest_besties_reel_media": null,
      "latest_reel_media": null,
      "live_broadcast_visibility": null,
      "live_broadcast_id": null,
      "show_account_transparency_details": true,
      "transparency_product": null,
      "transparency_product_enabled": false,
      "transparency_label": null,
      "ai_agent_owner_username": null,
      "id": "2237970730",
      "aigm_account_label_info": null,
      "hd_profile_pic_url_info": {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=L9VCN6COaTMQ7kNvwHOtFy0&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGSwOGkAaLzHNq-6Ef-eLq1M-C4wS7L_s0lWwJa9u0Lnw&oe=6A84A633&_nc_sid=7a9f4b"
      },
      "__typename": "XDTUserDict",
      "full_name": "Pakuwon Mall Jogja"
    },
    "images": [
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwGsjXYK&_nc_oc=AdrGv-47NpAJ6bbZqeWjCvQPRzyR3kGi7pEGJimQ4h7I2_ynJYI9fyAdS1sQxldtxnM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEOY_8asrLCf8YX35ikiy_UsV8HVs4nIxWkkbCq8tqVQw&oe=6A84A534",
        "height": 1600,
        "width": 1279
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_p1080x1080_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwGsjXYK&_nc_oc=AdrGv-47NpAJ6bbZqeWjCvQPRzyR3kGi7pEGJimQ4h7I2_ynJYI9fyAdS1sQxldtxnM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFYSzS4w30c3_kCvSzUpQXr2ejstUe6R70DK2Naz3eDUg&oe=6A84A534",
        "height": 1351,
        "width": 1080
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwGsjXYK&_nc_oc=AdrGv-47NpAJ6bbZqeWjCvQPRzyR3kGi7pEGJimQ4h7I2_ynJYI9fyAdS1sQxldtxnM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEAF8wVFzTliZxDho3wNLowa-lCwgm8_G_OQdDHCEH6TQ&oe=6A84A534",
        "height": 901,
        "width": 720
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwGsjXYK&_nc_oc=AdrGv-47NpAJ6bbZqeWjCvQPRzyR3kGi7pEGJimQ4h7I2_ynJYI9fyAdS1sQxldtxnM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFrtQEJSqOZpkBe46d6d65R4V-HfwzAza1YEq6VddayIg&oe=6A84A534",
        "height": 801,
        "width": 640
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwGsjXYK&_nc_oc=AdrGv-47NpAJ6bbZqeWjCvQPRzyR3kGi7pEGJimQ4h7I2_ynJYI9fyAdS1sQxldtxnM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQF02e7CxVTYP4m0LF04oQ7Mxv4bezI-a52skPUbdRGkFw&oe=6A84A534",
        "height": 600,
        "width": 480
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwGsjXYK&_nc_oc=AdrGv-47NpAJ6bbZqeWjCvQPRzyR3kGi7pEGJimQ4h7I2_ynJYI9fyAdS1sQxldtxnM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHyr8qpANGiC2rjvpeiCA078p3UuqnRt285-X7CYSGdQQ&oe=6A84A534",
        "height": 400,
        "width": 320
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwGsjXYK&_nc_oc=AdrGv-47NpAJ6bbZqeWjCvQPRzyR3kGi7pEGJimQ4h7I2_ynJYI9fyAdS1sQxldtxnM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFxz7j6Q3aQL_-yfrsM6gpn9xFyt0pC3jQ0mN3nYQD60w&oe=6A84A534",
        "height": 300,
        "width": 240
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwGsjXYK&_nc_oc=AdrGv-47NpAJ6bbZqeWjCvQPRzyR3kGi7pEGJimQ4h7I2_ynJYI9fyAdS1sQxldtxnM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEmrB7KW_RfinzYU0Z9zswYv2XKHHcFZALX8veebA2LSw&oe=6A84A534",
        "height": 1080,
        "width": 1080
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwGsjXYK&_nc_oc=AdrGv-47NpAJ6bbZqeWjCvQPRzyR3kGi7pEGJimQ4h7I2_ynJYI9fyAdS1sQxldtxnM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGqo3FPCh3dkBY7IHc6VjFqHK4ErndSx3w_RKW7HFVPbw&oe=6A84A534",
        "height": 750,
        "width": 750
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwGsjXYK&_nc_oc=AdrGv-47NpAJ6bbZqeWjCvQPRzyR3kGi7pEGJimQ4h7I2_ynJYI9fyAdS1sQxldtxnM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHevGEYOxdPB-FFIT5nBgyQK4ahFIEevutryedOFZrycQ&oe=6A84A534",
        "height": 640,
        "width": 640
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s480x480_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwGsjXYK&_nc_oc=AdrGv-47NpAJ6bbZqeWjCvQPRzyR3kGi7pEGJimQ4h7I2_ynJYI9fyAdS1sQxldtxnM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFTYx3LcOXKlNEtMNV_V4sJ_OlzkJWGVawPhybvXZ-A4A&oe=6A84A534",
        "height": 480,
        "width": 480
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s320x320_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwGsjXYK&_nc_oc=AdrGv-47NpAJ6bbZqeWjCvQPRzyR3kGi7pEGJimQ4h7I2_ynJYI9fyAdS1sQxldtxnM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHv5fBL0uqY56kAcHCLUXlNZFrRGLixp_pwEq1MZKu-jg&oe=6A84A534",
        "height": 320,
        "width": 320
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s240x240_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwGsjXYK&_nc_oc=AdrGv-47NpAJ6bbZqeWjCvQPRzyR3kGi7pEGJimQ4h7I2_ynJYI9fyAdS1sQxldtxnM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFGZGtzcUIICyK-7DEN3-UC1BCVkO_a4p9aJJXl390bgw&oe=6A84A534",
        "height": 240,
        "width": 240
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s150x150_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwGsjXYK&_nc_oc=AdrGv-47NpAJ6bbZqeWjCvQPRzyR3kGi7pEGJimQ4h7I2_ynJYI9fyAdS1sQxldtxnM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHz91CKI3cxiisW2ktIRJb-0xsbFGEH-PDcuFbKH4T-xg&oe=6A84A534",
        "height": 150,
        "width": 150
      }
    ],
    "video_versions": null,
    "carousel_media_count": 2,
    "carousel_media": [
      {
        "id": "3963389966914225522_2237970730",
        "pk": "3963389966914225522",
        "accessibility_caption": null,
        "is_dash_eligible": null,
        "video_dash_manifest": null,
        "media_type": 1,
        "original_height": 1600,
        "original_width": 1279,
        "inventory_source": null,
        "user": null,
        "usertags": null,
        "image_versions2": {
          "candidates": [
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwGsjXYK&_nc_oc=AdrGv-47NpAJ6bbZqeWjCvQPRzyR3kGi7pEGJimQ4h7I2_ynJYI9fyAdS1sQxldtxnM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEOY_8asrLCf8YX35ikiy_UsV8HVs4nIxWkkbCq8tqVQw&oe=6A84A534",
              "height": 1600,
              "width": 1279
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_p1080x1080_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwGsjXYK&_nc_oc=AdrGv-47NpAJ6bbZqeWjCvQPRzyR3kGi7pEGJimQ4h7I2_ynJYI9fyAdS1sQxldtxnM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFYSzS4w30c3_kCvSzUpQXr2ejstUe6R70DK2Naz3eDUg&oe=6A84A534",
              "height": 1351,
              "width": 1080
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwGsjXYK&_nc_oc=AdrGv-47NpAJ6bbZqeWjCvQPRzyR3kGi7pEGJimQ4h7I2_ynJYI9fyAdS1sQxldtxnM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEAF8wVFzTliZxDho3wNLowa-lCwgm8_G_OQdDHCEH6TQ&oe=6A84A534",
              "height": 901,
              "width": 720
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwGsjXYK&_nc_oc=AdrGv-47NpAJ6bbZqeWjCvQPRzyR3kGi7pEGJimQ4h7I2_ynJYI9fyAdS1sQxldtxnM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFrtQEJSqOZpkBe46d6d65R4V-HfwzAza1YEq6VddayIg&oe=6A84A534",
              "height": 801,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwGsjXYK&_nc_oc=AdrGv-47NpAJ6bbZqeWjCvQPRzyR3kGi7pEGJimQ4h7I2_ynJYI9fyAdS1sQxldtxnM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQF02e7CxVTYP4m0LF04oQ7Mxv4bezI-a52skPUbdRGkFw&oe=6A84A534",
              "height": 600,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwGsjXYK&_nc_oc=AdrGv-47NpAJ6bbZqeWjCvQPRzyR3kGi7pEGJimQ4h7I2_ynJYI9fyAdS1sQxldtxnM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHyr8qpANGiC2rjvpeiCA078p3UuqnRt285-X7CYSGdQQ&oe=6A84A534",
              "height": 400,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwGsjXYK&_nc_oc=AdrGv-47NpAJ6bbZqeWjCvQPRzyR3kGi7pEGJimQ4h7I2_ynJYI9fyAdS1sQxldtxnM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFxz7j6Q3aQL_-yfrsM6gpn9xFyt0pC3jQ0mN3nYQD60w&oe=6A84A534",
              "height": 300,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwGsjXYK&_nc_oc=AdrGv-47NpAJ6bbZqeWjCvQPRzyR3kGi7pEGJimQ4h7I2_ynJYI9fyAdS1sQxldtxnM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEmrB7KW_RfinzYU0Z9zswYv2XKHHcFZALX8veebA2LSw&oe=6A84A534",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwGsjXYK&_nc_oc=AdrGv-47NpAJ6bbZqeWjCvQPRzyR3kGi7pEGJimQ4h7I2_ynJYI9fyAdS1sQxldtxnM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGqo3FPCh3dkBY7IHc6VjFqHK4ErndSx3w_RKW7HFVPbw&oe=6A84A534",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwGsjXYK&_nc_oc=AdrGv-47NpAJ6bbZqeWjCvQPRzyR3kGi7pEGJimQ4h7I2_ynJYI9fyAdS1sQxldtxnM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHevGEYOxdPB-FFIT5nBgyQK4ahFIEevutryedOFZrycQ&oe=6A84A534",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s480x480_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwGsjXYK&_nc_oc=AdrGv-47NpAJ6bbZqeWjCvQPRzyR3kGi7pEGJimQ4h7I2_ynJYI9fyAdS1sQxldtxnM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFTYx3LcOXKlNEtMNV_V4sJ_OlzkJWGVawPhybvXZ-A4A&oe=6A84A534",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s320x320_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwGsjXYK&_nc_oc=AdrGv-47NpAJ6bbZqeWjCvQPRzyR3kGi7pEGJimQ4h7I2_ynJYI9fyAdS1sQxldtxnM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHv5fBL0uqY56kAcHCLUXlNZFrRGLixp_pwEq1MZKu-jg&oe=6A84A534",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s240x240_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwGsjXYK&_nc_oc=AdrGv-47NpAJ6bbZqeWjCvQPRzyR3kGi7pEGJimQ4h7I2_ynJYI9fyAdS1sQxldtxnM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFGZGtzcUIICyK-7DEN3-UC1BCVkO_a4p9aJJXl390bgw&oe=6A84A534",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s150x150_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwGsjXYK&_nc_oc=AdrGv-47NpAJ6bbZqeWjCvQPRzyR3kGi7pEGJimQ4h7I2_ynJYI9fyAdS1sQxldtxnM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHz91CKI3cxiisW2ktIRJb-0xsbFGEH-PDcuFbKH4T-xg&oe=6A84A534",
              "height": 150,
              "width": 150
            }
          ]
        },
        "carousel_parent_id": "3963390113577264213_2237970730",
        "sharing_friction_info": {
          "bloks_app_url": null,
          "should_have_sharing_friction": false
        },
        "preview": null,
        "organic_tracking_token": null,
        "saved_collection_ids": null,
        "has_viewer_saved": null,
        "video_versions": null,
        "media_overlay_info": null,
        "code": null,
        "display_uri": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=dnVhxIs_J7IQ7kNvwFzLS_w&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHZ1EQwYd_h4q_9D6FC1w6y6wQJfeMqDG574hLUUHoJUg&oe=6A84A534&_nc_sid=7a9f4b",
        "number_of_qualities": null,
        "product_type": "carousel_item",
        "carousel_media": null,
        "taken_at": 1786692940,
        "previous_submitter": null,
        "link": null,
        "story_cta": null,
        "has_liked": null,
        "like_count": null,
        "logging_info_token": null,
        "has_audio": null,
        "clips_metadata": null
      },
      {
        "id": "3963389973591710994_2237970730",
        "pk": "3963389973591710994",
        "accessibility_caption": null,
        "is_dash_eligible": null,
        "video_dash_manifest": null,
        "media_type": 1,
        "original_height": 1600,
        "original_width": 1279,
        "inventory_source": null,
        "user": null,
        "usertags": null,
        "image_versions2": {
          "candidates": [
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774184470_18549987364074731_6828912551799453495_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=100&ig_cache_key=Mzk2MzM4OTk3MzU5MTcxMDk5NA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Tg8OKqOcftoQ7kNvwHW8qDe&_nc_oc=AdrwbMYilOUsk4kTdRFej-vbUcgnAgGv1l-oJpRhBVK1e3K2wVUHMkYEPRXOHJ6i-O8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHdR21-Ggib5ok7Xy3IU80XTVAJi25NaKIxIkRIoyud9g&oe=6A84A1DC",
              "height": 1600,
              "width": 1279
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774184470_18549987364074731_6828912551799453495_n.jpg?stp=dst-jpg_e35_p1080x1080_tt6&_nc_cat=100&ig_cache_key=Mzk2MzM4OTk3MzU5MTcxMDk5NA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Tg8OKqOcftoQ7kNvwHW8qDe&_nc_oc=AdrwbMYilOUsk4kTdRFej-vbUcgnAgGv1l-oJpRhBVK1e3K2wVUHMkYEPRXOHJ6i-O8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGA3AcY-Y4f_W_0KWkle_VdF-FGlgybrh5DznvyF9P-DA&oe=6A84A1DC",
              "height": 1351,
              "width": 1080
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774184470_18549987364074731_6828912551799453495_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=100&ig_cache_key=Mzk2MzM4OTk3MzU5MTcxMDk5NA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Tg8OKqOcftoQ7kNvwHW8qDe&_nc_oc=AdrwbMYilOUsk4kTdRFej-vbUcgnAgGv1l-oJpRhBVK1e3K2wVUHMkYEPRXOHJ6i-O8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFiNg0GEKGdDjZg6AOV40zY7WUmest77LUd1F1SvnNqqw&oe=6A84A1DC",
              "height": 901,
              "width": 720
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774184470_18549987364074731_6828912551799453495_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=100&ig_cache_key=Mzk2MzM4OTk3MzU5MTcxMDk5NA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Tg8OKqOcftoQ7kNvwHW8qDe&_nc_oc=AdrwbMYilOUsk4kTdRFej-vbUcgnAgGv1l-oJpRhBVK1e3K2wVUHMkYEPRXOHJ6i-O8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQE26NsJrK9ZfLYGdYgRLjoWsWqVdkKShsBO2RyBhjSEOA&oe=6A84A1DC",
              "height": 801,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774184470_18549987364074731_6828912551799453495_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=100&ig_cache_key=Mzk2MzM4OTk3MzU5MTcxMDk5NA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Tg8OKqOcftoQ7kNvwHW8qDe&_nc_oc=AdrwbMYilOUsk4kTdRFej-vbUcgnAgGv1l-oJpRhBVK1e3K2wVUHMkYEPRXOHJ6i-O8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFsP4yAy-Zyf6xXNhjR2jUrAUg3f9mGLauROotWXcOMNg&oe=6A84A1DC",
              "height": 600,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774184470_18549987364074731_6828912551799453495_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=100&ig_cache_key=Mzk2MzM4OTk3MzU5MTcxMDk5NA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Tg8OKqOcftoQ7kNvwHW8qDe&_nc_oc=AdrwbMYilOUsk4kTdRFej-vbUcgnAgGv1l-oJpRhBVK1e3K2wVUHMkYEPRXOHJ6i-O8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGBLWYaLunEIvme42EsuIG30em65oFYldiFuxLgodZxMw&oe=6A84A1DC",
              "height": 400,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774184470_18549987364074731_6828912551799453495_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=100&ig_cache_key=Mzk2MzM4OTk3MzU5MTcxMDk5NA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Tg8OKqOcftoQ7kNvwHW8qDe&_nc_oc=AdrwbMYilOUsk4kTdRFej-vbUcgnAgGv1l-oJpRhBVK1e3K2wVUHMkYEPRXOHJ6i-O8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFrxBm_G8WRToCQE4Q_EXpCrfMUCPUIQyzJpe0gb32v_w&oe=6A84A1DC",
              "height": 300,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774184470_18549987364074731_6828912551799453495_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=100&ig_cache_key=Mzk2MzM4OTk3MzU5MTcxMDk5NA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Tg8OKqOcftoQ7kNvwHW8qDe&_nc_oc=AdrwbMYilOUsk4kTdRFej-vbUcgnAgGv1l-oJpRhBVK1e3K2wVUHMkYEPRXOHJ6i-O8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGjuPKJ5bqC39-RAZkHESiQNLi2R6xRaiAKevR7ypbzVA&oe=6A84A1DC",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774184470_18549987364074731_6828912551799453495_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=100&ig_cache_key=Mzk2MzM4OTk3MzU5MTcxMDk5NA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Tg8OKqOcftoQ7kNvwHW8qDe&_nc_oc=AdrwbMYilOUsk4kTdRFej-vbUcgnAgGv1l-oJpRhBVK1e3K2wVUHMkYEPRXOHJ6i-O8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEJYcFTzJknZ5Mpexy3aXqh0bzS3oS1JS0WKAenbKP3wQ&oe=6A84A1DC",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774184470_18549987364074731_6828912551799453495_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=100&ig_cache_key=Mzk2MzM4OTk3MzU5MTcxMDk5NA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Tg8OKqOcftoQ7kNvwHW8qDe&_nc_oc=AdrwbMYilOUsk4kTdRFej-vbUcgnAgGv1l-oJpRhBVK1e3K2wVUHMkYEPRXOHJ6i-O8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGxmpztm0e4yjhdWwDMCYhaoggUhuHbu9Cs4TRxrei4QQ&oe=6A84A1DC",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774184470_18549987364074731_6828912551799453495_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s480x480_tt6&_nc_cat=100&ig_cache_key=Mzk2MzM4OTk3MzU5MTcxMDk5NA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Tg8OKqOcftoQ7kNvwHW8qDe&_nc_oc=AdrwbMYilOUsk4kTdRFej-vbUcgnAgGv1l-oJpRhBVK1e3K2wVUHMkYEPRXOHJ6i-O8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEQ--UCCj7Nwg9K2EFMpm8thNF5OMEk4DDfG5IeHXrIsQ&oe=6A84A1DC",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774184470_18549987364074731_6828912551799453495_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s320x320_tt6&_nc_cat=100&ig_cache_key=Mzk2MzM4OTk3MzU5MTcxMDk5NA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Tg8OKqOcftoQ7kNvwHW8qDe&_nc_oc=AdrwbMYilOUsk4kTdRFej-vbUcgnAgGv1l-oJpRhBVK1e3K2wVUHMkYEPRXOHJ6i-O8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFp4_CaIhuR-wP7kzOnz7gjYS2hKdw4JeK6L0SFPGVxgg&oe=6A84A1DC",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774184470_18549987364074731_6828912551799453495_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s240x240_tt6&_nc_cat=100&ig_cache_key=Mzk2MzM4OTk3MzU5MTcxMDk5NA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Tg8OKqOcftoQ7kNvwHW8qDe&_nc_oc=AdrwbMYilOUsk4kTdRFej-vbUcgnAgGv1l-oJpRhBVK1e3K2wVUHMkYEPRXOHJ6i-O8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEeQ_ftPuMOIsc4DWSFamSUOG-2yIzguq-ETcDBLw6-YQ&oe=6A84A1DC",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774184470_18549987364074731_6828912551799453495_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s150x150_tt6&_nc_cat=100&ig_cache_key=Mzk2MzM4OTk3MzU5MTcxMDk5NA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Tg8OKqOcftoQ7kNvwHW8qDe&_nc_oc=AdrwbMYilOUsk4kTdRFej-vbUcgnAgGv1l-oJpRhBVK1e3K2wVUHMkYEPRXOHJ6i-O8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFx2z5WWhrnf2OWzuVeTQaK7yRQQGn1P5oAcwpP71qXKg&oe=6A84A1DC",
              "height": 150,
              "width": 150
            }
          ]
        },
        "carousel_parent_id": "3963390113577264213_2237970730",
        "sharing_friction_info": {
          "bloks_app_url": null,
          "should_have_sharing_friction": false
        },
        "preview": null,
        "organic_tracking_token": null,
        "saved_collection_ids": null,
        "has_viewer_saved": null,
        "video_versions": null,
        "media_overlay_info": null,
        "code": null,
        "display_uri": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774184470_18549987364074731_6828912551799453495_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=4KKKNZ7wuooQ7kNvwGf9zas&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHz2ZsXwmL9-m16KibTmiHhVTnMcio1KS3Pq25i5WrLIg&oe=6A84A1DC&_nc_sid=7a9f4b",
        "number_of_qualities": null,
        "product_type": "carousel_item",
        "carousel_media": null,
        "taken_at": 1786692940,
        "previous_submitter": null,
        "link": null,
        "story_cta": null,
        "has_liked": null,
        "like_count": null,
        "logging_info_token": null,
        "has_audio": null,
        "clips_metadata": null
      }
    ],
    "coauthor_producers": [],
    "timeline_pinned_user_ids": [],
    "date": "2026-08-14T07:35:41.000Z",
    "crawled_at": "2026-08-14T08:16:43.756Z"
  },
  {
    "id": "3963381371133254330_5583800796",
    "pk": "3963381371133254330",
    "type": "Video",
    "image": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774905443_18451629595184797_1785892812524699280_n.jpg?stp=c0.471.1217.1217a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_cat=101&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=rmZ0fhDJ2kcQ7kNvwG631fl&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQFE6hdLJir0-wD_fBavkhrherB1KQ9yvgTaWPe8zUKkSg&oe=6A848EF5&_nc_sid=7a9f4b",
    "shortcode": "DcAwluvzFq6",
    "product_type": "clips",
    "hashtags": [
      "#PlayWithUs",
      "#PakuwonMallJogja",
      "#PlaygroundJogja",
      "#WisataAnakJogja",
      "#EventJogja"
    ],
    "mentions": [
      "@pakuwonmall.jogja",
      "@travellingkejogja",
      "@jogjajalanmakan",
      "@jogjaniceinfo",
      "@kolaborasijateng"
    ],
    "location": {
      "pk": "350725118605524",
      "lat": -7.7599800319605,
      "lng": 110.39890560439,
      "name": "Pakuwon Mall Jogja",
      "profile_pic_url": null,
      "__typename": "XDTLocationDict"
    },
    "caption": "The BIG Playground in Jogja balik lagi! 🥳✨\n\nDari tanggal 7 - 16 Agustus 2026, Pakuwon Mall Jogja menghadirkan kembali Play With Us di Grand Atrium! 🎮🏎️\n\nWahananya lengkap dan seru-seru banget:\n🏎️ Diecast Playland\n🚗 Big Foot Cars Sirkuit\n🚜 RC Excavator Area\n🧗 RC Adventure Arena\n🏎️ F1 Race Simulator\n\nTiket masuknya terjangkau banget, mulai dari Rp 35.000 aja! Pas banget buat ajak si kecil main minggu ini!\n\n📍 Grand Atrium - Pakuwon Mall Jogja\n📅 7 - 16 Agustus 2026\n\nJangan sampai kelewatan ya! 😉👇\n\n#PlayWithUs #PakuwonMallJogja #PlaygroundJogja #WisataAnakJogja #EventJogja KulinerJogja InfoJogja",
    "comment_count": 2,
    "like_count": 21,
    "view_count": null,
    "has_audio": true,
    "usertags": [
      {
        "user": {
          "pk": "2237970730",
          "full_name": "Pakuwon Mall Jogja",
          "username": "pakuwonmall.jogja",
          "profile_pic_url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=L9VCN6COaTMQ7kNvwHOtFy0&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQEM_oL-JrA3TqdAkw0HaavzLRi54AM8nCTvpERnqwDeWQ&oe=6A84A633&_nc_sid=7a9f4b",
          "is_verified": true,
          "id": "2237970730",
          "aigm_account_label_info": null
        },
        "position": [
          0,
          0
        ]
      },
      {
        "user": {
          "pk": "3935681658",
          "full_name": "Travelling Ke Jogja",
          "username": "travellingkejogja",
          "profile_pic_url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-19/615267211_18437987830129659_618848764352237694_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby45NTcuYzIifQ&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_cat=103&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=LIcP1SCMPJYQ7kNvwGWBPj3&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQF1XrjFtIPURR58R6TdzXmp-2fH_54BLe7tW3dpo2R8Tg&oe=6A84B458&_nc_sid=7a9f4b",
          "is_verified": false,
          "id": "3935681658",
          "aigm_account_label_info": null
        },
        "position": [
          0,
          0
        ]
      },
      {
        "user": {
          "pk": "58358071611",
          "full_name": "KulineranJogja",
          "username": "jogjajalanmakan",
          "profile_pic_url": "https://scontent-atl3-3.cdninstagram.com/v/t51.2885-19/503134034_17957002415951612_2203695640052218324_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby40NTMuYzIifQ&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=108&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=NT8hBhqAQu0Q7kNvwFLrOsd&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQH-ZTVsstBSEW_y2o1D2j8-JkMTyft-seRBVh0nZxdiIQ&oe=6A84B59D&_nc_sid=7a9f4b",
          "is_verified": false,
          "id": "58358071611",
          "aigm_account_label_info": null
        },
        "position": [
          0,
          0
        ]
      },
      {
        "user": {
          "pk": "72514061469",
          "full_name": "Jogja Nice Info",
          "username": "jogjaniceinfo",
          "profile_pic_url": "https://scontent-atl3-2.cdninstagram.com/v/t51.2885-19/476246031_1175898783868049_2571657218397445928_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby41MDAuYzIifQ&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_cat=105&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=Bg_y-hr151cQ7kNvwHvzslI&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGODaDmeBNBM4qWq7fwMwgT4PFiPxE0X527bPz8q3etTQ&oe=6A8493D3&_nc_sid=7a9f4b",
          "is_verified": false,
          "id": "72514061469",
          "aigm_account_label_info": null
        },
        "position": [
          0,
          0
        ]
      },
      {
        "user": {
          "pk": "79589453676",
          "full_name": "KOLABORASI JAWA TENGAH | Media Promosi & Informasi di Jateng",
          "username": "kolaborasijateng",
          "profile_pic_url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-19/635010153_17853252258653677_2013522932633231966_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_cat=1&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=OiJqpJco89wQ7kNvwFTDEWb&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGoqAsqkC00nKjh_CYpMIowXKz-w1wnce8gGL4Q0KKHnw&oe=6A84A7C3&_nc_sid=7a9f4b",
          "is_verified": true,
          "id": "79589453676",
          "aigm_account_label_info": null
        },
        "position": [
          0,
          0
        ]
      }
    ],
    "clips_metadata": {
      "audio_type": "original_sounds",
      "achievements_info": {
        "show_achievements": false
      },
      "music_info": null,
      "original_sound_info": {
        "original_audio_title": "Original audio",
        "should_mute_audio": false,
        "audio_asset_id": "27760578416927145",
        "consumption_info": {
          "is_trending_in_clips": false,
          "should_mute_audio_reason": "",
          "should_mute_audio_reason_type": null
        },
        "ig_artist": {
          "username": "tikanoviia",
          "id": "5583800796",
          "profile_pic_url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-19/764422827_18449884999184797_5609079917339959651_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_cat=101&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=trwzeMeArjEQ7kNvwFU2q0P&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHQm_yWg-rta2ZWubowhBdb9pcYrYQSZZFxai1mf43YZw&oe=6A84870B&_nc_sid=7a9f4b"
        },
        "is_explicit": false,
        "audio_filter_infos": []
      },
      "originality_info": null,
      "is_shared_to_fb": false
    },
    "from_url": "https://www.instagram.com/pakuwonmall.jogja/",
    "post_url": "https://www.instagram.com/p/DcAwluvzFq6/",
    "video_duration": 37.104,
    "user": {
      "pk": "5583800796",
      "profile_pic_url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-19/764422827_18449884999184797_5609079917339959651_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_cat=101&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=trwzeMeArjEQ7kNvwFU2q0P&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHQm_yWg-rta2ZWubowhBdb9pcYrYQSZZFxai1mf43YZw&oe=6A84870B&_nc_sid=7a9f4b",
      "username": "tikanoviia",
      "is_private": false,
      "is_embeds_disabled": false,
      "is_unpublished": false,
      "is_verified": false,
      "friendship_status": null,
      "latest_besties_reel_media": null,
      "latest_reel_media": null,
      "live_broadcast_visibility": null,
      "live_broadcast_id": null,
      "show_account_transparency_details": true,
      "transparency_product": null,
      "transparency_product_enabled": false,
      "transparency_label": null,
      "ai_agent_owner_username": null,
      "id": "5583800796",
      "aigm_account_label_info": null,
      "hd_profile_pic_url_info": {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-19/764422827_18449884999184797_5609079917339959651_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_cat=101&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=trwzeMeArjEQ7kNvwFU2q0P&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQEWPofdRJQRvJ30FCQ5PATjf9EVjUq2XoSxxCVQ9-ZCVA&oe=6A84870B&_nc_sid=7a9f4b"
      },
      "__typename": "XDTUserDict",
      "full_name": "Jogja. Visit. Riview. Endorse beauty jogja"
    },
    "images": [
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774905443_18451629595184797_1785892812524699280_n.jpg?stp=dst-jpg_e15_tt6&_nc_cat=105&ig_cache_key=Mzk2MzM4MTM3MTEzMzI1NDMzMDE4NDUxNjI5NTkyMTg0Nzk3.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMTcuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=JycmgP1YCyEQ7kNvwFjyurr&_nc_oc=AdqLw2_tyPJ9yDn1NG0NSKDzPH1sitP65fTtyEbjemO4VSL8s8SwZRLfOyJbNA9zZaM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEZFVhdm_II5v9xbnC6Z0UyySVh4BPdX_jzGcFbpURrVw&oe=6A848EF5",
        "height": 2160,
        "width": 1217
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774905443_18451629595184797_1785892812524699280_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_cat=105&ig_cache_key=Mzk2MzM4MTM3MTEzMzI1NDMzMDE4NDUxNjI5NTkyMTg0Nzk3.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMTcuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=JycmgP1YCyEQ7kNvwFjyurr&_nc_oc=AdqLw2_tyPJ9yDn1NG0NSKDzPH1sitP65fTtyEbjemO4VSL8s8SwZRLfOyJbNA9zZaM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHyG18Qz9DJoOwtLcfw0kBOze_XWuhV1tzpzgUtZARV_Q&oe=6A848EF5",
        "height": 1917,
        "width": 1080
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774905443_18451629595184797_1785892812524699280_n.jpg?stp=dst-jpg_e35_p720x720_sh2.08_tt6&_nc_cat=105&ig_cache_key=Mzk2MzM4MTM3MTEzMzI1NDMzMDE4NDUxNjI5NTkyMTg0Nzk3.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMTcuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=JycmgP1YCyEQ7kNvwFjyurr&_nc_oc=AdqLw2_tyPJ9yDn1NG0NSKDzPH1sitP65fTtyEbjemO4VSL8s8SwZRLfOyJbNA9zZaM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHwe1LyyP9XVLouPELMQ08TS1IaJextSqJ5-JnmuSsipg&oe=6A848EF5",
        "height": 1278,
        "width": 720
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774905443_18451629595184797_1785892812524699280_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=105&ig_cache_key=Mzk2MzM4MTM3MTEzMzI1NDMzMDE4NDUxNjI5NTkyMTg0Nzk3.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMTcuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=JycmgP1YCyEQ7kNvwFjyurr&_nc_oc=AdqLw2_tyPJ9yDn1NG0NSKDzPH1sitP65fTtyEbjemO4VSL8s8SwZRLfOyJbNA9zZaM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHYstH_7536RWscWEDQ6T-4qlSl7ooTq3elbkWkONDVRA&oe=6A848EF5",
        "height": 1136,
        "width": 640
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774905443_18451629595184797_1785892812524699280_n.jpg?stp=dst-jpg_e15_p480x480_tt6&_nc_cat=105&ig_cache_key=Mzk2MzM4MTM3MTEzMzI1NDMzMDE4NDUxNjI5NTkyMTg0Nzk3.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMTcuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=JycmgP1YCyEQ7kNvwFjyurr&_nc_oc=AdqLw2_tyPJ9yDn1NG0NSKDzPH1sitP65fTtyEbjemO4VSL8s8SwZRLfOyJbNA9zZaM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQE7MTrtUQXRDoEqM7YhhR58uu5bok0xMhm5U-ouqMbE3Q&oe=6A848EF5",
        "height": 852,
        "width": 480
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774905443_18451629595184797_1785892812524699280_n.jpg?stp=dst-jpg_e15_p320x320_tt6&_nc_cat=105&ig_cache_key=Mzk2MzM4MTM3MTEzMzI1NDMzMDE4NDUxNjI5NTkyMTg0Nzk3.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMTcuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=JycmgP1YCyEQ7kNvwFjyurr&_nc_oc=AdqLw2_tyPJ9yDn1NG0NSKDzPH1sitP65fTtyEbjemO4VSL8s8SwZRLfOyJbNA9zZaM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGmOGZLwfjTzoe_B2beuIYk5qbU2oEzlaVAF_-5CjsRsw&oe=6A848EF5",
        "height": 568,
        "width": 320
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774905443_18451629595184797_1785892812524699280_n.jpg?stp=dst-jpg_e15_p240x240_tt6&_nc_cat=105&ig_cache_key=Mzk2MzM4MTM3MTEzMzI1NDMzMDE4NDUxNjI5NTkyMTg0Nzk3.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMTcuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=JycmgP1YCyEQ7kNvwFjyurr&_nc_oc=AdqLw2_tyPJ9yDn1NG0NSKDzPH1sitP65fTtyEbjemO4VSL8s8SwZRLfOyJbNA9zZaM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEHglOJKZBhAHfEbp0q__Ts-El_rG-KQGFZ9CrLwkHnoQ&oe=6A848EF5",
        "height": 426,
        "width": 240
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774905443_18451629595184797_1785892812524699280_n.jpg?stp=c0.471.1217.1217a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_cat=105&ig_cache_key=Mzk2MzM4MTM3MTEzMzI1NDMzMDE4NDUxNjI5NTkyMTg0Nzk3.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMTcuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=JycmgP1YCyEQ7kNvwFjyurr&_nc_oc=AdqLw2_tyPJ9yDn1NG0NSKDzPH1sitP65fTtyEbjemO4VSL8s8SwZRLfOyJbNA9zZaM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEPrG1TuIrBsdNtkQFtph3T_8X9cuNmR1i7AD1sysZOcQ&oe=6A848EF5",
        "height": 1080,
        "width": 1080
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774905443_18451629595184797_1785892812524699280_n.jpg?stp=c0.471.1217.1217a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=105&ig_cache_key=Mzk2MzM4MTM3MTEzMzI1NDMzMDE4NDUxNjI5NTkyMTg0Nzk3.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMTcuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=JycmgP1YCyEQ7kNvwFjyurr&_nc_oc=AdqLw2_tyPJ9yDn1NG0NSKDzPH1sitP65fTtyEbjemO4VSL8s8SwZRLfOyJbNA9zZaM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGtT90gV4wla9xQIS_SNTuB1sO4TAJQrI1jZKgW8qV2mw&oe=6A848EF5",
        "height": 750,
        "width": 750
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774905443_18451629595184797_1785892812524699280_n.jpg?stp=c0.471.1217.1217a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=105&ig_cache_key=Mzk2MzM4MTM3MTEzMzI1NDMzMDE4NDUxNjI5NTkyMTg0Nzk3.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMTcuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=JycmgP1YCyEQ7kNvwFjyurr&_nc_oc=AdqLw2_tyPJ9yDn1NG0NSKDzPH1sitP65fTtyEbjemO4VSL8s8SwZRLfOyJbNA9zZaM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEAy-dHR4-U_LIYi4RmbjLlg0Hw7dJTcRHlIb3LszBnjA&oe=6A848EF5",
        "height": 640,
        "width": 640
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774905443_18451629595184797_1785892812524699280_n.jpg?stp=c0.471.1217.1217a_dst-jpg_e15_s480x480_tt6&_nc_cat=105&ig_cache_key=Mzk2MzM4MTM3MTEzMzI1NDMzMDE4NDUxNjI5NTkyMTg0Nzk3.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMTcuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=JycmgP1YCyEQ7kNvwFjyurr&_nc_oc=AdqLw2_tyPJ9yDn1NG0NSKDzPH1sitP65fTtyEbjemO4VSL8s8SwZRLfOyJbNA9zZaM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGr0QtSOrvagVvykZ9Z9QQwJTaDj-Ymtlsab3SRDKythw&oe=6A848EF5",
        "height": 480,
        "width": 480
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774905443_18451629595184797_1785892812524699280_n.jpg?stp=c0.471.1217.1217a_dst-jpg_e15_s320x320_tt6&_nc_cat=105&ig_cache_key=Mzk2MzM4MTM3MTEzMzI1NDMzMDE4NDUxNjI5NTkyMTg0Nzk3.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMTcuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=JycmgP1YCyEQ7kNvwFjyurr&_nc_oc=AdqLw2_tyPJ9yDn1NG0NSKDzPH1sitP65fTtyEbjemO4VSL8s8SwZRLfOyJbNA9zZaM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGezInuUTa-TUwUy_oT3hJRuzI9Krv4Wcl1r2wUsjQuDw&oe=6A848EF5",
        "height": 320,
        "width": 320
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774905443_18451629595184797_1785892812524699280_n.jpg?stp=c0.471.1217.1217a_dst-jpg_e15_s240x240_tt6&_nc_cat=105&ig_cache_key=Mzk2MzM4MTM3MTEzMzI1NDMzMDE4NDUxNjI5NTkyMTg0Nzk3.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMTcuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=JycmgP1YCyEQ7kNvwFjyurr&_nc_oc=AdqLw2_tyPJ9yDn1NG0NSKDzPH1sitP65fTtyEbjemO4VSL8s8SwZRLfOyJbNA9zZaM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFmP3Z7LN2x9Qby_-JQzisYk6SLBbsXzN1qTQW2IG_zng&oe=6A848EF5",
        "height": 240,
        "width": 240
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774905443_18451629595184797_1785892812524699280_n.jpg?stp=c0.471.1217.1217a_dst-jpg_e15_s150x150_tt6&_nc_cat=105&ig_cache_key=Mzk2MzM4MTM3MTEzMzI1NDMzMDE4NDUxNjI5NTkyMTg0Nzk3.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMTcuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=JycmgP1YCyEQ7kNvwFjyurr&_nc_oc=AdqLw2_tyPJ9yDn1NG0NSKDzPH1sitP65fTtyEbjemO4VSL8s8SwZRLfOyJbNA9zZaM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEXdULONf0pnra93RHwo2AnQ90lPBLckt_BHsMNNiMYmw&oe=6A848EF5",
        "height": 150,
        "width": 150
      }
    ],
    "video_versions": [
      {
        "width": 720,
        "height": 1280,
        "url": "https://scontent-atl3-2.cdninstagram.com/o1/v/t2/f2/m86/AQO9kR_ciied0fswp2LUBawsDCnx3MwCq0eQzRWkhrX76Fsi851c8-69h1KJ-fetFnVvKc6BQbgAs0rFPy9nLhoAIPX1oH06aFPIPvw.mp4?_nc_cat=101&_nc_sid=5e9851&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_ohc=KsBQAWG-Z2QQ7kNvwFip6P9&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MjUyMDgxMDU0NTA5MTgyMiwiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjozNywidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=8c2c88aa60a04e68&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC9ERTQyRTZBNzVDNzEyMzQ2MDk1MENFQzdEQUZCOTZBNF92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyL0E0NEQ5QTU0NzBFQzkzNzQyQkRDODIzQjRCQkI4MEI0X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACbc07CRvqr6CBUCKAJDMywXQEKMzMzMzM0YEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&_nc_zt=28&oh=00_AQGi0tp7S0g8wAF7lJ8pp6nmKAWzwgHr-qW5pxoOsqKD0w&oe=6A80BF5E",
        "type": 101
      },
      {
        "width": 720,
        "height": 1280,
        "url": "https://scontent-atl3-2.cdninstagram.com/o1/v/t2/f2/m86/AQO9kR_ciied0fswp2LUBawsDCnx3MwCq0eQzRWkhrX76Fsi851c8-69h1KJ-fetFnVvKc6BQbgAs0rFPy9nLhoAIPX1oH06aFPIPvw.mp4?_nc_cat=101&_nc_sid=5e9851&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_ohc=KsBQAWG-Z2QQ7kNvwFip6P9&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MjUyMDgxMDU0NTA5MTgyMiwiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjozNywidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=8c2c88aa60a04e68&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC9ERTQyRTZBNzVDNzEyMzQ2MDk1MENFQzdEQUZCOTZBNF92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyL0E0NEQ5QTU0NzBFQzkzNzQyQkRDODIzQjRCQkI4MEI0X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACbc07CRvqr6CBUCKAJDMywXQEKMzMzMzM0YEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&_nc_zt=28&oh=00_AQGi0tp7S0g8wAF7lJ8pp6nmKAWzwgHr-qW5pxoOsqKD0w&oe=6A80BF5E",
        "type": 102
      },
      {
        "width": 720,
        "height": 1280,
        "url": "https://scontent-atl3-2.cdninstagram.com/o1/v/t2/f2/m86/AQO9kR_ciied0fswp2LUBawsDCnx3MwCq0eQzRWkhrX76Fsi851c8-69h1KJ-fetFnVvKc6BQbgAs0rFPy9nLhoAIPX1oH06aFPIPvw.mp4?_nc_cat=101&_nc_sid=5e9851&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_ohc=KsBQAWG-Z2QQ7kNvwFip6P9&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MjUyMDgxMDU0NTA5MTgyMiwiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjozNywidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=8c2c88aa60a04e68&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC9ERTQyRTZBNzVDNzEyMzQ2MDk1MENFQzdEQUZCOTZBNF92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyL0E0NEQ5QTU0NzBFQzkzNzQyQkRDODIzQjRCQkI4MEI0X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACbc07CRvqr6CBUCKAJDMywXQEKMzMzMzM0YEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&_nc_zt=28&oh=00_AQGi0tp7S0g8wAF7lJ8pp6nmKAWzwgHr-qW5pxoOsqKD0w&oe=6A80BF5E",
        "type": 103
      }
    ],
    "carousel_media_count": null,
    "carousel_media": null,
    "coauthor_producers": [
      {
        "pk": "2237970730",
        "profile_pic_url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=L9VCN6COaTMQ7kNvwHOtFy0&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQEM_oL-JrA3TqdAkw0HaavzLRi54AM8nCTvpERnqwDeWQ&oe=6A84A633&_nc_sid=7a9f4b",
        "is_unpublished": null,
        "username": "pakuwonmall.jogja",
        "is_verified": true,
        "id": "2237970730",
        "aigm_account_label_info": null,
        "__typename": "XDTUserDict",
        "full_name": "Pakuwon Mall Jogja",
        "friendship_status": null,
        "supervision_info": null
      }
    ],
    "timeline_pinned_user_ids": [],
    "date": "2026-08-14T07:26:05.000Z",
    "crawled_at": "2026-08-14T08:16:43.756Z"
  },
  {
    "id": "3963290610605662960_38851997261",
    "pk": "3963290610605662960",
    "type": "Image",
    "image": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773519823_18095763680293262_8938356023924758124_n.jpg?stp=c0.409.3277.3277a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_cat=102&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=uxVNS2ZUuKQQ7kNvwGAX7AR&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQEZ6-ReiLqX46TOjoj_K1C2jXU3dy6RABCJnwzOvEhDWw&oe=6A848B24&_nc_sid=7a9f4b",
    "shortcode": "DcAb8_ayqLw",
    "product_type": "feed",
    "hashtags": [],
    "mentions": [
      "@pakuwonmall.jogja"
    ],
    "location": null,
    "caption": "BUY POTATO MOZZA, FREE ORIGINAL! \n\nCheesy, crunchy, and even better with a FREE Original! 🤤\nDon’t miss it! 🩷🖤\n\n📍 Available at Pakuwon Mall Jogja, LG\n📆 August 14-20, 2026",
    "comment_count": 2,
    "like_count": 93,
    "view_count": null,
    "has_audio": null,
    "usertags": [
      {
        "user": {
          "pk": "2237970730",
          "full_name": "Pakuwon Mall Jogja",
          "username": "pakuwonmall.jogja",
          "profile_pic_url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=L9VCN6COaTMQ7kNvwHOtFy0&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQEM_oL-JrA3TqdAkw0HaavzLRi54AM8nCTvpERnqwDeWQ&oe=6A84A633&_nc_sid=7a9f4b",
          "is_verified": true,
          "id": "2237970730",
          "aigm_account_label_info": null
        },
        "position": [
          0.5,
          0.5
        ]
      }
    ],
    "clips_metadata": null,
    "from_url": "https://www.instagram.com/pakuwonmall.jogja/",
    "post_url": "https://www.instagram.com/p/DcAb8_ayqLw/",
    "video_duration": null,
    "user": {
      "pk": "38851997261",
      "profile_pic_url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-19/662721383_18075054686293262_6929357337730779975_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_cat=102&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=VKPv3NVqtG4Q7kNvwH2Ogej&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQFOif5s4LGsljdZn4w9lg_PiMITTvXjoDGNlXIfl1-sPw&oe=6A84A30C&_nc_sid=7a9f4b",
      "username": "crunchmate.id",
      "is_private": false,
      "is_embeds_disabled": false,
      "is_unpublished": false,
      "is_verified": false,
      "friendship_status": null,
      "latest_besties_reel_media": null,
      "latest_reel_media": null,
      "live_broadcast_visibility": null,
      "live_broadcast_id": null,
      "show_account_transparency_details": true,
      "transparency_product": null,
      "transparency_product_enabled": false,
      "transparency_label": null,
      "ai_agent_owner_username": null,
      "id": "38851997261",
      "aigm_account_label_info": null,
      "hd_profile_pic_url_info": {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-19/662721383_18075054686293262_6929357337730779975_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_cat=102&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=VKPv3NVqtG4Q7kNvwH2Ogej&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQFNBnbjBliIDCQMHxfeRqpKMRAYRb57NmMEvxK5FyDefQ&oe=6A84A30C&_nc_sid=7a9f4b"
      },
      "__typename": "XDTUserDict",
      "full_name": "Crunchmate.id"
    },
    "images": [
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773519823_18095763680293262_8938356023924758124_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=110&ig_cache_key=Mzk2MzI5MDYxMDYwNTY2Mjk2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMzI3Ny5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=bR_QmgaA9WgQ7kNvwHn56Nz&_nc_oc=AdpttaZZxsdRl8MwsP-8oYTHxkF7TrId2Ynx2sz0KsGfN8XjltmhhCV3qVZcA-xndso&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHZyX4sDXcsAHxI92RI6lzKXavn-wLfd-56szgAnkuGbg&oe=6A848B24",
        "height": 4096,
        "width": 3277
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773519823_18095763680293262_8938356023924758124_n.jpg?stp=dst-jpg_e35_p1080x1080_tt6&_nc_cat=110&ig_cache_key=Mzk2MzI5MDYxMDYwNTY2Mjk2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMzI3Ny5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=bR_QmgaA9WgQ7kNvwHn56Nz&_nc_oc=AdpttaZZxsdRl8MwsP-8oYTHxkF7TrId2Ynx2sz0KsGfN8XjltmhhCV3qVZcA-xndso&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFyicLr6VU3bFBq9kxSBPj5U4bW69BlDWmc_JE6hTdP7w&oe=6A848B24",
        "height": 1350,
        "width": 1080
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773519823_18095763680293262_8938356023924758124_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=110&ig_cache_key=Mzk2MzI5MDYxMDYwNTY2Mjk2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMzI3Ny5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=bR_QmgaA9WgQ7kNvwHn56Nz&_nc_oc=AdpttaZZxsdRl8MwsP-8oYTHxkF7TrId2Ynx2sz0KsGfN8XjltmhhCV3qVZcA-xndso&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGM4TEjlWyp2F3-yMb0WiwNR16JTQPhBlgXA6u13I3FIQ&oe=6A848B24",
        "height": 900,
        "width": 720
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773519823_18095763680293262_8938356023924758124_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=110&ig_cache_key=Mzk2MzI5MDYxMDYwNTY2Mjk2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMzI3Ny5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=bR_QmgaA9WgQ7kNvwHn56Nz&_nc_oc=AdpttaZZxsdRl8MwsP-8oYTHxkF7TrId2Ynx2sz0KsGfN8XjltmhhCV3qVZcA-xndso&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQElroeauVCxxZcFN99O0NxFpyEtaHdqX6dMdS9opM3inQ&oe=6A848B24",
        "height": 800,
        "width": 640
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773519823_18095763680293262_8938356023924758124_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=110&ig_cache_key=Mzk2MzI5MDYxMDYwNTY2Mjk2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMzI3Ny5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=bR_QmgaA9WgQ7kNvwHn56Nz&_nc_oc=AdpttaZZxsdRl8MwsP-8oYTHxkF7TrId2Ynx2sz0KsGfN8XjltmhhCV3qVZcA-xndso&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFGjBuovyZjFcFVQEFjczaEhG9vMis7IAqtuk-NHxH7iQ&oe=6A848B24",
        "height": 600,
        "width": 480
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773519823_18095763680293262_8938356023924758124_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=110&ig_cache_key=Mzk2MzI5MDYxMDYwNTY2Mjk2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMzI3Ny5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=bR_QmgaA9WgQ7kNvwHn56Nz&_nc_oc=AdpttaZZxsdRl8MwsP-8oYTHxkF7TrId2Ynx2sz0KsGfN8XjltmhhCV3qVZcA-xndso&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEExq1g7ARrOXVIHoOyMFGOgleK1jaPMEb6yg3cFnMRlQ&oe=6A848B24",
        "height": 400,
        "width": 320
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773519823_18095763680293262_8938356023924758124_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=110&ig_cache_key=Mzk2MzI5MDYxMDYwNTY2Mjk2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMzI3Ny5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=bR_QmgaA9WgQ7kNvwHn56Nz&_nc_oc=AdpttaZZxsdRl8MwsP-8oYTHxkF7TrId2Ynx2sz0KsGfN8XjltmhhCV3qVZcA-xndso&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEmVM2EWgWmLcba7Sg2E-CyX7tqD7hXyVIbQCPO-gzaTA&oe=6A848B24",
        "height": 300,
        "width": 240
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773519823_18095763680293262_8938356023924758124_n.jpg?stp=c0.409.3277.3277a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=110&ig_cache_key=Mzk2MzI5MDYxMDYwNTY2Mjk2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMzI3Ny5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=bR_QmgaA9WgQ7kNvwHn56Nz&_nc_oc=AdpttaZZxsdRl8MwsP-8oYTHxkF7TrId2Ynx2sz0KsGfN8XjltmhhCV3qVZcA-xndso&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGUyTgFnnrDL2BvCkUp7Q0EN1pjmYaAtchnOywGUG-F2Q&oe=6A848B24",
        "height": 1080,
        "width": 1080
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773519823_18095763680293262_8938356023924758124_n.jpg?stp=c0.409.3277.3277a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=110&ig_cache_key=Mzk2MzI5MDYxMDYwNTY2Mjk2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMzI3Ny5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=bR_QmgaA9WgQ7kNvwHn56Nz&_nc_oc=AdpttaZZxsdRl8MwsP-8oYTHxkF7TrId2Ynx2sz0KsGfN8XjltmhhCV3qVZcA-xndso&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFra33KVV9_mG3s9SLPWntptwtN0vJGnWf0T3OprhLs5A&oe=6A848B24",
        "height": 750,
        "width": 750
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773519823_18095763680293262_8938356023924758124_n.jpg?stp=c0.409.3277.3277a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=110&ig_cache_key=Mzk2MzI5MDYxMDYwNTY2Mjk2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMzI3Ny5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=bR_QmgaA9WgQ7kNvwHn56Nz&_nc_oc=AdpttaZZxsdRl8MwsP-8oYTHxkF7TrId2Ynx2sz0KsGfN8XjltmhhCV3qVZcA-xndso&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGds6DlZCVmbYlTbnagcUD4C074IIRYfGskpQBBBtXWcw&oe=6A848B24",
        "height": 640,
        "width": 640
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773519823_18095763680293262_8938356023924758124_n.jpg?stp=c0.409.3277.3277a_dst-jpg_e35_s480x480_tt6&_nc_cat=110&ig_cache_key=Mzk2MzI5MDYxMDYwNTY2Mjk2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMzI3Ny5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=bR_QmgaA9WgQ7kNvwHn56Nz&_nc_oc=AdpttaZZxsdRl8MwsP-8oYTHxkF7TrId2Ynx2sz0KsGfN8XjltmhhCV3qVZcA-xndso&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHz5Kr0tCF2w6Cai-xLpYokKZREMsUqcFVI04waYveBJQ&oe=6A848B24",
        "height": 480,
        "width": 480
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773519823_18095763680293262_8938356023924758124_n.jpg?stp=c0.409.3277.3277a_dst-jpg_e35_s320x320_tt6&_nc_cat=110&ig_cache_key=Mzk2MzI5MDYxMDYwNTY2Mjk2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMzI3Ny5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=bR_QmgaA9WgQ7kNvwHn56Nz&_nc_oc=AdpttaZZxsdRl8MwsP-8oYTHxkF7TrId2Ynx2sz0KsGfN8XjltmhhCV3qVZcA-xndso&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQF9lNHd44dEz5vtSvhGTiMJszFp6-9GBmqHyUrJkRr0Ew&oe=6A848B24",
        "height": 320,
        "width": 320
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773519823_18095763680293262_8938356023924758124_n.jpg?stp=c0.409.3277.3277a_dst-jpg_e35_s240x240_tt6&_nc_cat=110&ig_cache_key=Mzk2MzI5MDYxMDYwNTY2Mjk2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMzI3Ny5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=bR_QmgaA9WgQ7kNvwHn56Nz&_nc_oc=AdpttaZZxsdRl8MwsP-8oYTHxkF7TrId2Ynx2sz0KsGfN8XjltmhhCV3qVZcA-xndso&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGGmQMfvD2PaicxmB9FRrQ37UUVaD_cVJkWKSDDQLmJ_w&oe=6A848B24",
        "height": 240,
        "width": 240
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773519823_18095763680293262_8938356023924758124_n.jpg?stp=c0.409.3277.3277a_dst-jpg_e35_s150x150_tt6&_nc_cat=110&ig_cache_key=Mzk2MzI5MDYxMDYwNTY2Mjk2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMzI3Ny5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=bR_QmgaA9WgQ7kNvwHn56Nz&_nc_oc=AdpttaZZxsdRl8MwsP-8oYTHxkF7TrId2Ynx2sz0KsGfN8XjltmhhCV3qVZcA-xndso&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFpGLW582WKFmdf9SEcUMllPZrv1bWLDKOvXq_vWOCcog&oe=6A848B24",
        "height": 150,
        "width": 150
      }
    ],
    "video_versions": null,
    "carousel_media_count": null,
    "carousel_media": null,
    "coauthor_producers": [
      {
        "pk": "2237970730",
        "profile_pic_url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=L9VCN6COaTMQ7kNvwHOtFy0&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQEM_oL-JrA3TqdAkw0HaavzLRi54AM8nCTvpERnqwDeWQ&oe=6A84A633&_nc_sid=7a9f4b",
        "is_unpublished": null,
        "username": "pakuwonmall.jogja",
        "is_verified": true,
        "id": "2237970730",
        "aigm_account_label_info": null,
        "__typename": "XDTUserDict",
        "full_name": "Pakuwon Mall Jogja",
        "friendship_status": null,
        "supervision_info": null
      }
    ],
    "timeline_pinned_user_ids": [],
    "date": "2026-08-14T04:19:31.000Z",
    "crawled_at": "2026-08-14T08:16:43.756Z"
  },
  {
    "id": "3963231873169665456_38851997261",
    "pk": "3963231873169665456",
    "type": "Image",
    "image": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773686629_18095748581293262_1334211002783647391_n.jpg?stp=c0.169.1350.1350a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_cat=102&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=RuYm3rFB_h8Q7kNvwHj2iNH&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQF3gKiPYipt9Lrv4odrbBBwoxVdeR1MZ6SmFjDU8bfuwg&oe=6A84AE37&_nc_sid=7a9f4b",
    "shortcode": "DcAOmP6yK2w",
    "product_type": "feed",
    "hashtags": [
      "#CrunchmateJogja",
      "#Crunchmate",
      "#jogjafoodies",
      "#PakuwonMallJogja"
    ],
    "mentions": [
      "@pakuwonmall.jogja"
    ],
    "location": null,
    "caption": "JOGJA, WE’RE HERE‼️\n\nSomething crispy, cheesy & delicious has officially landed at Pakuwon Mall Jogja! 🇰🇷🔥\n\nSay hello to Crunchmate your best spot for Korean snacks! And yashhh .. we’re celebrating our GRAND OPENING With a special promo 👇🏻\n\nBUY 1 GET 1\nBuy Korean Snack Potato Mozza and FREE Korean Snack  Original\n\nSo, who’s ready for their first CRUNCH? 👀🩷🖤\n📍 Crunchmate — Pakuwon Mall Jogja, LG\n📅 August 14, 2026\n\nTag your snack buddy and come say ANYEONG! 🇰🇷✨\n#CrunchmateJogja #Crunchmate #jogjafoodies #PakuwonMallJogja",
    "comment_count": 0,
    "like_count": 40,
    "view_count": null,
    "has_audio": null,
    "usertags": [
      {
        "user": {
          "pk": "2237970730",
          "full_name": "Pakuwon Mall Jogja",
          "username": "pakuwonmall.jogja",
          "profile_pic_url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=L9VCN6COaTMQ7kNvwHOtFy0&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQEM_oL-JrA3TqdAkw0HaavzLRi54AM8nCTvpERnqwDeWQ&oe=6A84A633&_nc_sid=7a9f4b",
          "is_verified": true,
          "id": "2237970730",
          "aigm_account_label_info": null
        },
        "position": [
          0.63526570048309,
          0.98366012983024
        ]
      }
    ],
    "clips_metadata": null,
    "from_url": "https://www.instagram.com/pakuwonmall.jogja/",
    "post_url": "https://www.instagram.com/p/DcAOmP6yK2w/",
    "video_duration": null,
    "user": {
      "pk": "38851997261",
      "profile_pic_url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-19/662721383_18075054686293262_6929357337730779975_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_cat=102&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=VKPv3NVqtG4Q7kNvwH2Ogej&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQFOif5s4LGsljdZn4w9lg_PiMITTvXjoDGNlXIfl1-sPw&oe=6A84A30C&_nc_sid=7a9f4b",
      "username": "crunchmate.id",
      "is_private": false,
      "is_embeds_disabled": false,
      "is_unpublished": false,
      "is_verified": false,
      "friendship_status": null,
      "latest_besties_reel_media": null,
      "latest_reel_media": null,
      "live_broadcast_visibility": null,
      "live_broadcast_id": null,
      "show_account_transparency_details": true,
      "transparency_product": null,
      "transparency_product_enabled": false,
      "transparency_label": null,
      "ai_agent_owner_username": null,
      "id": "38851997261",
      "aigm_account_label_info": null,
      "hd_profile_pic_url_info": {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-19/662721383_18075054686293262_6929357337730779975_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_cat=102&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=VKPv3NVqtG4Q7kNvwH2Ogej&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQFNBnbjBliIDCQMHxfeRqpKMRAYRb57NmMEvxK5FyDefQ&oe=6A84A30C&_nc_sid=7a9f4b"
      },
      "__typename": "XDTUserDict",
      "full_name": "Crunchmate.id"
    },
    "images": [
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773686629_18095748581293262_1334211002783647391_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=111&ig_cache_key=Mzk2MzIzMTg3MzE2OTY2NTQ1Ng%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=9WICmp3CiZAQ7kNvwHClxRL&_nc_oc=AdqUaVz9VaoqAX1lsGOvM57FtS1Kag9i6Rt66a4KfA2ozMpBJHuZe0uO-FCV3aFWjPs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEZQkF01V5gFd6rrg8AhgfX0kTgrblLcz6NW6ZEAPHPwA&oe=6A84AE37",
        "height": 1688,
        "width": 1350
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773686629_18095748581293262_1334211002783647391_n.jpg?stp=dst-jpg_e35_p1080x1080_tt6&_nc_cat=111&ig_cache_key=Mzk2MzIzMTg3MzE2OTY2NTQ1Ng%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=9WICmp3CiZAQ7kNvwHClxRL&_nc_oc=AdqUaVz9VaoqAX1lsGOvM57FtS1Kag9i6Rt66a4KfA2ozMpBJHuZe0uO-FCV3aFWjPs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEaTQyWIQjdGs9J64gjb_XnmjncGUKU_IGFnzIumtqKVw&oe=6A84AE37",
        "height": 1350,
        "width": 1080
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773686629_18095748581293262_1334211002783647391_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=111&ig_cache_key=Mzk2MzIzMTg3MzE2OTY2NTQ1Ng%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=9WICmp3CiZAQ7kNvwHClxRL&_nc_oc=AdqUaVz9VaoqAX1lsGOvM57FtS1Kag9i6Rt66a4KfA2ozMpBJHuZe0uO-FCV3aFWjPs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQECN3VZL4MHXH4DrMoR6kuBhJ6NMZ0Px-rDH85c3vDYcw&oe=6A84AE37",
        "height": 900,
        "width": 720
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773686629_18095748581293262_1334211002783647391_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=111&ig_cache_key=Mzk2MzIzMTg3MzE2OTY2NTQ1Ng%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=9WICmp3CiZAQ7kNvwHClxRL&_nc_oc=AdqUaVz9VaoqAX1lsGOvM57FtS1Kag9i6Rt66a4KfA2ozMpBJHuZe0uO-FCV3aFWjPs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQH3hb6fCzcwfPcfD-gsQgY02wA_4nPY6WTkQbdV1T0jbg&oe=6A84AE37",
        "height": 800,
        "width": 640
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773686629_18095748581293262_1334211002783647391_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=111&ig_cache_key=Mzk2MzIzMTg3MzE2OTY2NTQ1Ng%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=9WICmp3CiZAQ7kNvwHClxRL&_nc_oc=AdqUaVz9VaoqAX1lsGOvM57FtS1Kag9i6Rt66a4KfA2ozMpBJHuZe0uO-FCV3aFWjPs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGvv_GSeTZxfAhFd_Hre981rMT0CgrOKc2Bh8UdfVPhVQ&oe=6A84AE37",
        "height": 600,
        "width": 480
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773686629_18095748581293262_1334211002783647391_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=111&ig_cache_key=Mzk2MzIzMTg3MzE2OTY2NTQ1Ng%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=9WICmp3CiZAQ7kNvwHClxRL&_nc_oc=AdqUaVz9VaoqAX1lsGOvM57FtS1Kag9i6Rt66a4KfA2ozMpBJHuZe0uO-FCV3aFWjPs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHglvn6cOY8SsbdcH7UVCkle9nO2McuNrQqgbpLhB41yg&oe=6A84AE37",
        "height": 400,
        "width": 320
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773686629_18095748581293262_1334211002783647391_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=111&ig_cache_key=Mzk2MzIzMTg3MzE2OTY2NTQ1Ng%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=9WICmp3CiZAQ7kNvwHClxRL&_nc_oc=AdqUaVz9VaoqAX1lsGOvM57FtS1Kag9i6Rt66a4KfA2ozMpBJHuZe0uO-FCV3aFWjPs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHFvBf1Vbo2iFsR4xoQ47nERYBxxqQ_T-p-DkuPKhQymA&oe=6A84AE37",
        "height": 300,
        "width": 240
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773686629_18095748581293262_1334211002783647391_n.jpg?stp=c0.169.1350.1350a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=111&ig_cache_key=Mzk2MzIzMTg3MzE2OTY2NTQ1Ng%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=9WICmp3CiZAQ7kNvwHClxRL&_nc_oc=AdqUaVz9VaoqAX1lsGOvM57FtS1Kag9i6Rt66a4KfA2ozMpBJHuZe0uO-FCV3aFWjPs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFxRlY9puTZ_g2Zc_Trm9N1kUlBB7CGzLWvEc0aCqIVxA&oe=6A84AE37",
        "height": 1080,
        "width": 1080
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773686629_18095748581293262_1334211002783647391_n.jpg?stp=c0.169.1350.1350a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=111&ig_cache_key=Mzk2MzIzMTg3MzE2OTY2NTQ1Ng%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=9WICmp3CiZAQ7kNvwHClxRL&_nc_oc=AdqUaVz9VaoqAX1lsGOvM57FtS1Kag9i6Rt66a4KfA2ozMpBJHuZe0uO-FCV3aFWjPs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHIIkZSKDJvcA-hJ8od4UhYOc7TGF1RYm5JBhlEC7kF2Q&oe=6A84AE37",
        "height": 750,
        "width": 750
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773686629_18095748581293262_1334211002783647391_n.jpg?stp=c0.169.1350.1350a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=111&ig_cache_key=Mzk2MzIzMTg3MzE2OTY2NTQ1Ng%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=9WICmp3CiZAQ7kNvwHClxRL&_nc_oc=AdqUaVz9VaoqAX1lsGOvM57FtS1Kag9i6Rt66a4KfA2ozMpBJHuZe0uO-FCV3aFWjPs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHMEF8jVe-e6e4JYkmCv1M_zuMoaGg6Qk8X_o5NABSFjw&oe=6A84AE37",
        "height": 640,
        "width": 640
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773686629_18095748581293262_1334211002783647391_n.jpg?stp=c0.169.1350.1350a_dst-jpg_e35_s480x480_tt6&_nc_cat=111&ig_cache_key=Mzk2MzIzMTg3MzE2OTY2NTQ1Ng%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=9WICmp3CiZAQ7kNvwHClxRL&_nc_oc=AdqUaVz9VaoqAX1lsGOvM57FtS1Kag9i6Rt66a4KfA2ozMpBJHuZe0uO-FCV3aFWjPs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQH0Ptt1QI2sJu4EIZB0oF4n51BNdDoMbwJg_o3Rvk8RAQ&oe=6A84AE37",
        "height": 480,
        "width": 480
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773686629_18095748581293262_1334211002783647391_n.jpg?stp=c0.169.1350.1350a_dst-jpg_e35_s320x320_tt6&_nc_cat=111&ig_cache_key=Mzk2MzIzMTg3MzE2OTY2NTQ1Ng%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=9WICmp3CiZAQ7kNvwHClxRL&_nc_oc=AdqUaVz9VaoqAX1lsGOvM57FtS1Kag9i6Rt66a4KfA2ozMpBJHuZe0uO-FCV3aFWjPs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEUmgUK4K-K-iGLzeuMg47wDANoBP35BXiaZVpNSMpQjw&oe=6A84AE37",
        "height": 320,
        "width": 320
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773686629_18095748581293262_1334211002783647391_n.jpg?stp=c0.169.1350.1350a_dst-jpg_e35_s240x240_tt6&_nc_cat=111&ig_cache_key=Mzk2MzIzMTg3MzE2OTY2NTQ1Ng%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=9WICmp3CiZAQ7kNvwHClxRL&_nc_oc=AdqUaVz9VaoqAX1lsGOvM57FtS1Kag9i6Rt66a4KfA2ozMpBJHuZe0uO-FCV3aFWjPs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQG5HMsUrm9olGaWFDsm0sz6tRoz0yngSo4F7o88p2cu1A&oe=6A84AE37",
        "height": 240,
        "width": 240
      },
      {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773686629_18095748581293262_1334211002783647391_n.jpg?stp=c0.169.1350.1350a_dst-jpg_e35_s150x150_tt6&_nc_cat=111&ig_cache_key=Mzk2MzIzMTg3MzE2OTY2NTQ1Ng%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=9WICmp3CiZAQ7kNvwHClxRL&_nc_oc=AdqUaVz9VaoqAX1lsGOvM57FtS1Kag9i6Rt66a4KfA2ozMpBJHuZe0uO-FCV3aFWjPs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGN6AAgztrttuBm80cowV-U16pGUASELj9H3vEXhIXXDw&oe=6A84AE37",
        "height": 150,
        "width": 150
      }
    ],
    "video_versions": null,
    "carousel_media_count": null,
    "carousel_media": null,
    "coauthor_producers": [
      {
        "pk": "2237970730",
        "profile_pic_url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=L9VCN6COaTMQ7kNvwHOtFy0&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQEM_oL-JrA3TqdAkw0HaavzLRi54AM8nCTvpERnqwDeWQ&oe=6A84A633&_nc_sid=7a9f4b",
        "is_unpublished": null,
        "username": "pakuwonmall.jogja",
        "is_verified": true,
        "id": "2237970730",
        "aigm_account_label_info": null,
        "__typename": "XDTUserDict",
        "full_name": "Pakuwon Mall Jogja",
        "friendship_status": null,
        "supervision_info": null
      }
    ],
    "timeline_pinned_user_ids": [],
    "date": "2026-08-14T02:32:07.000Z",
    "crawled_at": "2026-08-14T08:16:43.756Z"
  },
  {
    "id": "3963187739466369600_2237970730",
    "pk": "3963187739466369600",
    "type": "Image",
    "image": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e15_fr_s1080x1080_tt6&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=RFZqVCccIfcQ7kNvwEeZ_wO&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHrTOLvb9zi2c3HiHlRe2nHB_g-85ofm7LEPwYoX7pUQw&oe=6A84A629&_nc_sid=7a9f4b",
    "shortcode": "DcAEkBNE4pA",
    "product_type": "carousel_container",
    "hashtags": [
      "#pakuwonmalljogja"
    ],
    "mentions": [],
    "location": null,
    "caption": "PAKUWON MALL JOGJA MERDEKA SALE 🇮🇩‼️\n\nNikmati berbagai promo dari tenant favoritmu hanya di Pakuwon Mall Jogja 😍\n\n#pakuwonmalljogja",
    "comment_count": 2,
    "like_count": 55,
    "view_count": null,
    "has_audio": null,
    "usertags": null,
    "clips_metadata": null,
    "from_url": "https://www.instagram.com/pakuwonmall.jogja/",
    "post_url": "https://www.instagram.com/p/DcAEkBNE4pA/",
    "video_duration": null,
    "user": {
      "pk": "2237970730",
      "profile_pic_url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=L9VCN6COaTMQ7kNvwHOtFy0&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQEM_oL-JrA3TqdAkw0HaavzLRi54AM8nCTvpERnqwDeWQ&oe=6A84A633&_nc_sid=7a9f4b",
      "username": "pakuwonmall.jogja",
      "is_private": false,
      "is_embeds_disabled": false,
      "is_unpublished": false,
      "is_verified": true,
      "friendship_status": null,
      "latest_besties_reel_media": null,
      "latest_reel_media": null,
      "live_broadcast_visibility": null,
      "live_broadcast_id": null,
      "show_account_transparency_details": true,
      "transparency_product": null,
      "transparency_product_enabled": false,
      "transparency_label": null,
      "ai_agent_owner_username": null,
      "id": "2237970730",
      "aigm_account_label_info": null,
      "hd_profile_pic_url_info": {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=L9VCN6COaTMQ7kNvwHOtFy0&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGSwOGkAaLzHNq-6Ef-eLq1M-C4wS7L_s0lWwJa9u0Lnw&oe=6A84A633&_nc_sid=7a9f4b"
      },
      "__typename": "XDTUserDict",
      "full_name": "Pakuwon Mall Jogja"
    },
    "images": [
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwH88BgQ&_nc_oc=AdreGhKwMM9X6kr7SqxZzQ8MRPdCXT0o5XaRhUmN-cZgBpD2Hhrk9x-bQQM4bG0I0B8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQG0JgR2lW-DtQLxncmrQ8giaZZWaZrjGB4ucGLJTKOYCg&oe=6A84A629",
        "height": 1350,
        "width": 1080
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwH88BgQ&_nc_oc=AdreGhKwMM9X6kr7SqxZzQ8MRPdCXT0o5XaRhUmN-cZgBpD2Hhrk9x-bQQM4bG0I0B8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHHuujIlaWKQmq5NFguCiTWuCxehutVrHAXuFmbZfrIxA&oe=6A84A629",
        "height": 900,
        "width": 720
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwH88BgQ&_nc_oc=AdreGhKwMM9X6kr7SqxZzQ8MRPdCXT0o5XaRhUmN-cZgBpD2Hhrk9x-bQQM4bG0I0B8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHZAgRLb12dakoDKLcelrDLUX3cYkcLjRCqUTuuTK3PeA&oe=6A84A629",
        "height": 800,
        "width": 640
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwH88BgQ&_nc_oc=AdreGhKwMM9X6kr7SqxZzQ8MRPdCXT0o5XaRhUmN-cZgBpD2Hhrk9x-bQQM4bG0I0B8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFhv-PsXTPG9Pk9-z7W8mMvdbW00gtXbcLkUyOso_rW-w&oe=6A84A629",
        "height": 600,
        "width": 480
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwH88BgQ&_nc_oc=AdreGhKwMM9X6kr7SqxZzQ8MRPdCXT0o5XaRhUmN-cZgBpD2Hhrk9x-bQQM4bG0I0B8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEgKtxUdkDnzbCz7aFoVpzC4SJsrJuwBC_107cNzf-DOg&oe=6A84A629",
        "height": 400,
        "width": 320
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwH88BgQ&_nc_oc=AdreGhKwMM9X6kr7SqxZzQ8MRPdCXT0o5XaRhUmN-cZgBpD2Hhrk9x-bQQM4bG0I0B8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQG_dPhaoTJic2yRugtjM1XldF4CqtU9VF36Kg1yLd6UbA&oe=6A84A629",
        "height": 300,
        "width": 240
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwH88BgQ&_nc_oc=AdreGhKwMM9X6kr7SqxZzQ8MRPdCXT0o5XaRhUmN-cZgBpD2Hhrk9x-bQQM4bG0I0B8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQH5WHM87GrXrQu-LVazDN6UGk5KqjvTVpPyStqtqlXHHw&oe=6A84A629",
        "height": 1080,
        "width": 1080
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwH88BgQ&_nc_oc=AdreGhKwMM9X6kr7SqxZzQ8MRPdCXT0o5XaRhUmN-cZgBpD2Hhrk9x-bQQM4bG0I0B8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQET0uoFYOAxn2Pmh4JBp52q9cv2VHSB7wlWNF_W4na0ww&oe=6A84A629",
        "height": 750,
        "width": 750
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwH88BgQ&_nc_oc=AdreGhKwMM9X6kr7SqxZzQ8MRPdCXT0o5XaRhUmN-cZgBpD2Hhrk9x-bQQM4bG0I0B8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEYTgaob8DBOIl9wntG-WreWUV5BiqrFrqjdWxHRxaJ9g&oe=6A84A629",
        "height": 640,
        "width": 640
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s480x480_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwH88BgQ&_nc_oc=AdreGhKwMM9X6kr7SqxZzQ8MRPdCXT0o5XaRhUmN-cZgBpD2Hhrk9x-bQQM4bG0I0B8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEbR29W8-t-ReZQICRp-ptLI41M6qFNzJPf07pyTaWjdg&oe=6A84A629",
        "height": 480,
        "width": 480
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s320x320_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwH88BgQ&_nc_oc=AdreGhKwMM9X6kr7SqxZzQ8MRPdCXT0o5XaRhUmN-cZgBpD2Hhrk9x-bQQM4bG0I0B8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQE_JoYx7c0ZnORNZkXlEqEoSMB5vLlVK_-JE9oVHBxLYQ&oe=6A84A629",
        "height": 320,
        "width": 320
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s240x240_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwH88BgQ&_nc_oc=AdreGhKwMM9X6kr7SqxZzQ8MRPdCXT0o5XaRhUmN-cZgBpD2Hhrk9x-bQQM4bG0I0B8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHbGkjqAb_QbqiRPrBaAT_iZxUvI6yvfuGbKAMR9xHTfg&oe=6A84A629",
        "height": 240,
        "width": 240
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s150x150_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwH88BgQ&_nc_oc=AdreGhKwMM9X6kr7SqxZzQ8MRPdCXT0o5XaRhUmN-cZgBpD2Hhrk9x-bQQM4bG0I0B8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFA6kmuepu9ae-hOftinWVnDz1agImXrZoxBiCOCvna9A&oe=6A84A629",
        "height": 150,
        "width": 150
      }
    ],
    "video_versions": null,
    "carousel_media_count": 6,
    "carousel_media": [
      {
        "id": "3963187120441374997_2237970730",
        "pk": "3963187120441374997",
        "accessibility_caption": null,
        "is_dash_eligible": null,
        "video_dash_manifest": null,
        "media_type": 1,
        "original_height": 1350,
        "original_width": 1080,
        "inventory_source": null,
        "user": null,
        "usertags": null,
        "image_versions2": {
          "candidates": [
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwH88BgQ&_nc_oc=AdreGhKwMM9X6kr7SqxZzQ8MRPdCXT0o5XaRhUmN-cZgBpD2Hhrk9x-bQQM4bG0I0B8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQG0JgR2lW-DtQLxncmrQ8giaZZWaZrjGB4ucGLJTKOYCg&oe=6A84A629",
              "height": 1350,
              "width": 1080
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwH88BgQ&_nc_oc=AdreGhKwMM9X6kr7SqxZzQ8MRPdCXT0o5XaRhUmN-cZgBpD2Hhrk9x-bQQM4bG0I0B8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHHuujIlaWKQmq5NFguCiTWuCxehutVrHAXuFmbZfrIxA&oe=6A84A629",
              "height": 900,
              "width": 720
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwH88BgQ&_nc_oc=AdreGhKwMM9X6kr7SqxZzQ8MRPdCXT0o5XaRhUmN-cZgBpD2Hhrk9x-bQQM4bG0I0B8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHZAgRLb12dakoDKLcelrDLUX3cYkcLjRCqUTuuTK3PeA&oe=6A84A629",
              "height": 800,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwH88BgQ&_nc_oc=AdreGhKwMM9X6kr7SqxZzQ8MRPdCXT0o5XaRhUmN-cZgBpD2Hhrk9x-bQQM4bG0I0B8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFhv-PsXTPG9Pk9-z7W8mMvdbW00gtXbcLkUyOso_rW-w&oe=6A84A629",
              "height": 600,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwH88BgQ&_nc_oc=AdreGhKwMM9X6kr7SqxZzQ8MRPdCXT0o5XaRhUmN-cZgBpD2Hhrk9x-bQQM4bG0I0B8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEgKtxUdkDnzbCz7aFoVpzC4SJsrJuwBC_107cNzf-DOg&oe=6A84A629",
              "height": 400,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwH88BgQ&_nc_oc=AdreGhKwMM9X6kr7SqxZzQ8MRPdCXT0o5XaRhUmN-cZgBpD2Hhrk9x-bQQM4bG0I0B8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQG_dPhaoTJic2yRugtjM1XldF4CqtU9VF36Kg1yLd6UbA&oe=6A84A629",
              "height": 300,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwH88BgQ&_nc_oc=AdreGhKwMM9X6kr7SqxZzQ8MRPdCXT0o5XaRhUmN-cZgBpD2Hhrk9x-bQQM4bG0I0B8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQH5WHM87GrXrQu-LVazDN6UGk5KqjvTVpPyStqtqlXHHw&oe=6A84A629",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwH88BgQ&_nc_oc=AdreGhKwMM9X6kr7SqxZzQ8MRPdCXT0o5XaRhUmN-cZgBpD2Hhrk9x-bQQM4bG0I0B8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQET0uoFYOAxn2Pmh4JBp52q9cv2VHSB7wlWNF_W4na0ww&oe=6A84A629",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwH88BgQ&_nc_oc=AdreGhKwMM9X6kr7SqxZzQ8MRPdCXT0o5XaRhUmN-cZgBpD2Hhrk9x-bQQM4bG0I0B8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEYTgaob8DBOIl9wntG-WreWUV5BiqrFrqjdWxHRxaJ9g&oe=6A84A629",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s480x480_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwH88BgQ&_nc_oc=AdreGhKwMM9X6kr7SqxZzQ8MRPdCXT0o5XaRhUmN-cZgBpD2Hhrk9x-bQQM4bG0I0B8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEbR29W8-t-ReZQICRp-ptLI41M6qFNzJPf07pyTaWjdg&oe=6A84A629",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s320x320_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwH88BgQ&_nc_oc=AdreGhKwMM9X6kr7SqxZzQ8MRPdCXT0o5XaRhUmN-cZgBpD2Hhrk9x-bQQM4bG0I0B8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQE_JoYx7c0ZnORNZkXlEqEoSMB5vLlVK_-JE9oVHBxLYQ&oe=6A84A629",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s240x240_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwH88BgQ&_nc_oc=AdreGhKwMM9X6kr7SqxZzQ8MRPdCXT0o5XaRhUmN-cZgBpD2Hhrk9x-bQQM4bG0I0B8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHbGkjqAb_QbqiRPrBaAT_iZxUvI6yvfuGbKAMR9xHTfg&oe=6A84A629",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s150x150_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwH88BgQ&_nc_oc=AdreGhKwMM9X6kr7SqxZzQ8MRPdCXT0o5XaRhUmN-cZgBpD2Hhrk9x-bQQM4bG0I0B8&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFA6kmuepu9ae-hOftinWVnDz1agImXrZoxBiCOCvna9A&oe=6A84A629",
              "height": 150,
              "width": 150
            }
          ]
        },
        "carousel_parent_id": "3963187739466369600_2237970730",
        "sharing_friction_info": {
          "bloks_app_url": null,
          "should_have_sharing_friction": false
        },
        "preview": null,
        "organic_tracking_token": null,
        "saved_collection_ids": null,
        "has_viewer_saved": null,
        "video_versions": null,
        "media_overlay_info": null,
        "code": null,
        "display_uri": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e15_fr_s1080x1080_tt6&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=RFZqVCccIfcQ7kNvwEeZ_wO&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHrTOLvb9zi2c3HiHlRe2nHB_g-85ofm7LEPwYoX7pUQw&oe=6A84A629&_nc_sid=7a9f4b",
        "number_of_qualities": null,
        "product_type": "carousel_item",
        "carousel_media": null,
        "taken_at": 1786668815,
        "previous_submitter": null,
        "link": null,
        "story_cta": null,
        "has_liked": null,
        "like_count": null,
        "logging_info_token": null,
        "has_audio": null,
        "clips_metadata": null
      },
      {
        "id": "3963187121053532667_2237970730",
        "pk": "3963187121053532667",
        "accessibility_caption": null,
        "is_dash_eligible": null,
        "video_dash_manifest": null,
        "media_type": 1,
        "original_height": 1350,
        "original_width": 1080,
        "inventory_source": null,
        "user": null,
        "usertags": null,
        "image_versions2": {
          "candidates": [
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773714201_18549917278074731_831497186886304937_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=107&ig_cache_key=Mzk2MzE4NzEyMTA1MzUzMjY2Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wmOiCYwiW8kQ7kNvwESL9GQ&_nc_oc=AdosMKSjwGNdem1eGIqItkq45tvKtrz2e7J31QKvNulWbd2ximbGcLtu8-cnijGkQLs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEc9LOp_IAOz15JLhYkwKcfG3zYmmEOMEhZQD0i7H5yxw&oe=6A84ADA1",
              "height": 1350,
              "width": 1080
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773714201_18549917278074731_831497186886304937_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=107&ig_cache_key=Mzk2MzE4NzEyMTA1MzUzMjY2Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wmOiCYwiW8kQ7kNvwESL9GQ&_nc_oc=AdosMKSjwGNdem1eGIqItkq45tvKtrz2e7J31QKvNulWbd2ximbGcLtu8-cnijGkQLs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHP7henU5O5eOy9xr3Z2p0hIyOUVPP5chDNAhrxmbdUsQ&oe=6A84ADA1",
              "height": 900,
              "width": 720
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773714201_18549917278074731_831497186886304937_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=107&ig_cache_key=Mzk2MzE4NzEyMTA1MzUzMjY2Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wmOiCYwiW8kQ7kNvwESL9GQ&_nc_oc=AdosMKSjwGNdem1eGIqItkq45tvKtrz2e7J31QKvNulWbd2ximbGcLtu8-cnijGkQLs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEygaoau_HLDx42NvI9llGi_MseOGa6kSkqDM9ewNKWZg&oe=6A84ADA1",
              "height": 800,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773714201_18549917278074731_831497186886304937_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=107&ig_cache_key=Mzk2MzE4NzEyMTA1MzUzMjY2Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wmOiCYwiW8kQ7kNvwESL9GQ&_nc_oc=AdosMKSjwGNdem1eGIqItkq45tvKtrz2e7J31QKvNulWbd2ximbGcLtu8-cnijGkQLs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEvPUgxdtZmmh-shlQGB9mfQH1rqhI7yp6VGRBxNRhZqw&oe=6A84ADA1",
              "height": 600,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773714201_18549917278074731_831497186886304937_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=107&ig_cache_key=Mzk2MzE4NzEyMTA1MzUzMjY2Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wmOiCYwiW8kQ7kNvwESL9GQ&_nc_oc=AdosMKSjwGNdem1eGIqItkq45tvKtrz2e7J31QKvNulWbd2ximbGcLtu8-cnijGkQLs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQF3vLsoerv8Gejwt9gHOIFPEkbuo3t4vIfhEdbXbKegZA&oe=6A84ADA1",
              "height": 400,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773714201_18549917278074731_831497186886304937_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=107&ig_cache_key=Mzk2MzE4NzEyMTA1MzUzMjY2Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wmOiCYwiW8kQ7kNvwESL9GQ&_nc_oc=AdosMKSjwGNdem1eGIqItkq45tvKtrz2e7J31QKvNulWbd2ximbGcLtu8-cnijGkQLs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGpSw50teJFF71LNXlFfnjn11i6KdqvMSuzdc1Y3dGjdg&oe=6A84ADA1",
              "height": 300,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773714201_18549917278074731_831497186886304937_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=107&ig_cache_key=Mzk2MzE4NzEyMTA1MzUzMjY2Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wmOiCYwiW8kQ7kNvwESL9GQ&_nc_oc=AdosMKSjwGNdem1eGIqItkq45tvKtrz2e7J31QKvNulWbd2ximbGcLtu8-cnijGkQLs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQH8Y54eM5kDAvudrxqTTqqWb3H89-w7WjWc3DoQYMtRnw&oe=6A84ADA1",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773714201_18549917278074731_831497186886304937_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=107&ig_cache_key=Mzk2MzE4NzEyMTA1MzUzMjY2Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wmOiCYwiW8kQ7kNvwESL9GQ&_nc_oc=AdosMKSjwGNdem1eGIqItkq45tvKtrz2e7J31QKvNulWbd2ximbGcLtu8-cnijGkQLs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGKB_LUECwATu0Mgtl57qNCPDcKovHemmXeAYfLycgQmQ&oe=6A84ADA1",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773714201_18549917278074731_831497186886304937_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=107&ig_cache_key=Mzk2MzE4NzEyMTA1MzUzMjY2Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wmOiCYwiW8kQ7kNvwESL9GQ&_nc_oc=AdosMKSjwGNdem1eGIqItkq45tvKtrz2e7J31QKvNulWbd2ximbGcLtu8-cnijGkQLs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQENTVDvtUzfDogf2zKp1yoYh3_adWRPK_iw591qNBsipQ&oe=6A84ADA1",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773714201_18549917278074731_831497186886304937_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s480x480_tt6&_nc_cat=107&ig_cache_key=Mzk2MzE4NzEyMTA1MzUzMjY2Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wmOiCYwiW8kQ7kNvwESL9GQ&_nc_oc=AdosMKSjwGNdem1eGIqItkq45tvKtrz2e7J31QKvNulWbd2ximbGcLtu8-cnijGkQLs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFRk6TWX0bGnklVaFejJY4u-Z5Y4FuOo1BvraXTcVwI6A&oe=6A84ADA1",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773714201_18549917278074731_831497186886304937_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s320x320_tt6&_nc_cat=107&ig_cache_key=Mzk2MzE4NzEyMTA1MzUzMjY2Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wmOiCYwiW8kQ7kNvwESL9GQ&_nc_oc=AdosMKSjwGNdem1eGIqItkq45tvKtrz2e7J31QKvNulWbd2ximbGcLtu8-cnijGkQLs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFWUTlFiv8h1aitwXOVRxQ5_4lxzHBoU3B3jqMKFFoE_g&oe=6A84ADA1",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773714201_18549917278074731_831497186886304937_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s240x240_tt6&_nc_cat=107&ig_cache_key=Mzk2MzE4NzEyMTA1MzUzMjY2Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wmOiCYwiW8kQ7kNvwESL9GQ&_nc_oc=AdosMKSjwGNdem1eGIqItkq45tvKtrz2e7J31QKvNulWbd2ximbGcLtu8-cnijGkQLs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEDFlSrRFC_-OYuB9z__Mu5txMZw9wPJRqiiljlwMQsxA&oe=6A84ADA1",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773714201_18549917278074731_831497186886304937_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s150x150_tt6&_nc_cat=107&ig_cache_key=Mzk2MzE4NzEyMTA1MzUzMjY2Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wmOiCYwiW8kQ7kNvwESL9GQ&_nc_oc=AdosMKSjwGNdem1eGIqItkq45tvKtrz2e7J31QKvNulWbd2ximbGcLtu8-cnijGkQLs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGu40J1gJr8H65L2t8GH3mspgPJaO55gEUGKfhcL2tDmg&oe=6A84ADA1",
              "height": 150,
              "width": 150
            }
          ]
        },
        "carousel_parent_id": "3963187739466369600_2237970730",
        "sharing_friction_info": {
          "bloks_app_url": null,
          "should_have_sharing_friction": false
        },
        "preview": null,
        "organic_tracking_token": null,
        "saved_collection_ids": null,
        "has_viewer_saved": null,
        "video_versions": null,
        "media_overlay_info": null,
        "code": null,
        "display_uri": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773714201_18549917278074731_831497186886304937_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e15_fr_s1080x1080_tt6&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=wszykQOiUNoQ7kNvwG-TJym&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHJa75diBViA0mc_6PspnhRGX4y2rRPn4iy80pm9ukHmA&oe=6A84ADA1&_nc_sid=7a9f4b",
        "number_of_qualities": null,
        "product_type": "carousel_item",
        "carousel_media": null,
        "taken_at": 1786668815,
        "previous_submitter": null,
        "link": null,
        "story_cta": null,
        "has_liked": null,
        "like_count": null,
        "logging_info_token": null,
        "has_audio": null,
        "clips_metadata": null
      },
      {
        "id": "3963187121590626706_2237970730",
        "pk": "3963187121590626706",
        "accessibility_caption": null,
        "is_dash_eligible": null,
        "video_dash_manifest": null,
        "media_type": 1,
        "original_height": 1350,
        "original_width": 1080,
        "inventory_source": null,
        "user": null,
        "usertags": null,
        "image_versions2": {
          "candidates": [
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773811749_18549917314074731_2734247693651828101_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=101&ig_cache_key=Mzk2MzE4NzEyMTU5MDYyNjcwNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=yB-hhIAUWKUQ7kNvwEy05UX&_nc_oc=AdrEJSS7xV18vlasbV7XE2w_RBHzUNxqOdc-MR97aTxlhwGUDjH-4iDr4s5sxg2Xxco&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEcEnRreUZtUydeDz4KmCHkan1MrstOwWApbGfUyGO25w&oe=6A848D82",
              "height": 1350,
              "width": 1080
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773811749_18549917314074731_2734247693651828101_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=101&ig_cache_key=Mzk2MzE4NzEyMTU5MDYyNjcwNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=yB-hhIAUWKUQ7kNvwEy05UX&_nc_oc=AdrEJSS7xV18vlasbV7XE2w_RBHzUNxqOdc-MR97aTxlhwGUDjH-4iDr4s5sxg2Xxco&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFOVbxzmWwbzxWoW4DGHvH-l-X0CbGS1wy5UDm3giKr8A&oe=6A848D82",
              "height": 900,
              "width": 720
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773811749_18549917314074731_2734247693651828101_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=101&ig_cache_key=Mzk2MzE4NzEyMTU5MDYyNjcwNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=yB-hhIAUWKUQ7kNvwEy05UX&_nc_oc=AdrEJSS7xV18vlasbV7XE2w_RBHzUNxqOdc-MR97aTxlhwGUDjH-4iDr4s5sxg2Xxco&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFuZ3IFmKN8SBvTYlFE6TRXw5ZqF57XOoKwYkZmg3THHg&oe=6A848D82",
              "height": 800,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773811749_18549917314074731_2734247693651828101_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=101&ig_cache_key=Mzk2MzE4NzEyMTU5MDYyNjcwNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=yB-hhIAUWKUQ7kNvwEy05UX&_nc_oc=AdrEJSS7xV18vlasbV7XE2w_RBHzUNxqOdc-MR97aTxlhwGUDjH-4iDr4s5sxg2Xxco&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHmXm6Pz_86bCYHJWDvOjHJXLlNZExZGqDDQ6PxcNabxw&oe=6A848D82",
              "height": 600,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773811749_18549917314074731_2734247693651828101_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=101&ig_cache_key=Mzk2MzE4NzEyMTU5MDYyNjcwNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=yB-hhIAUWKUQ7kNvwEy05UX&_nc_oc=AdrEJSS7xV18vlasbV7XE2w_RBHzUNxqOdc-MR97aTxlhwGUDjH-4iDr4s5sxg2Xxco&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHcFmutZpLbmxJZHOwD42iAjOVU_cu6o5nu8_9gcjiHPQ&oe=6A848D82",
              "height": 400,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773811749_18549917314074731_2734247693651828101_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=101&ig_cache_key=Mzk2MzE4NzEyMTU5MDYyNjcwNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=yB-hhIAUWKUQ7kNvwEy05UX&_nc_oc=AdrEJSS7xV18vlasbV7XE2w_RBHzUNxqOdc-MR97aTxlhwGUDjH-4iDr4s5sxg2Xxco&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEKBXo0CMX3qJwXWBJdHWQTe97DBskGNYE6VnbU0djUDg&oe=6A848D82",
              "height": 300,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773811749_18549917314074731_2734247693651828101_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=101&ig_cache_key=Mzk2MzE4NzEyMTU5MDYyNjcwNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=yB-hhIAUWKUQ7kNvwEy05UX&_nc_oc=AdrEJSS7xV18vlasbV7XE2w_RBHzUNxqOdc-MR97aTxlhwGUDjH-4iDr4s5sxg2Xxco&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHj-9HpLmZIHZ95IkKdPwU2Czaa_d6Y5ul4AFUsQsjJRQ&oe=6A848D82",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773811749_18549917314074731_2734247693651828101_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=101&ig_cache_key=Mzk2MzE4NzEyMTU5MDYyNjcwNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=yB-hhIAUWKUQ7kNvwEy05UX&_nc_oc=AdrEJSS7xV18vlasbV7XE2w_RBHzUNxqOdc-MR97aTxlhwGUDjH-4iDr4s5sxg2Xxco&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGKVerqOgjUhIShOrY8g-8haPKlYHZn1s9G25ujvptqmQ&oe=6A848D82",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773811749_18549917314074731_2734247693651828101_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=101&ig_cache_key=Mzk2MzE4NzEyMTU5MDYyNjcwNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=yB-hhIAUWKUQ7kNvwEy05UX&_nc_oc=AdrEJSS7xV18vlasbV7XE2w_RBHzUNxqOdc-MR97aTxlhwGUDjH-4iDr4s5sxg2Xxco&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEK1dsoF6WJdlbthScgKL5AvtM4vE2vI1vJTbHYrJ4HsQ&oe=6A848D82",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773811749_18549917314074731_2734247693651828101_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s480x480_tt6&_nc_cat=101&ig_cache_key=Mzk2MzE4NzEyMTU5MDYyNjcwNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=yB-hhIAUWKUQ7kNvwEy05UX&_nc_oc=AdrEJSS7xV18vlasbV7XE2w_RBHzUNxqOdc-MR97aTxlhwGUDjH-4iDr4s5sxg2Xxco&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHhzx29Q2YLSE8-eJaMueZLP3-rY37MZub8jXoTtxdHhQ&oe=6A848D82",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773811749_18549917314074731_2734247693651828101_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s320x320_tt6&_nc_cat=101&ig_cache_key=Mzk2MzE4NzEyMTU5MDYyNjcwNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=yB-hhIAUWKUQ7kNvwEy05UX&_nc_oc=AdrEJSS7xV18vlasbV7XE2w_RBHzUNxqOdc-MR97aTxlhwGUDjH-4iDr4s5sxg2Xxco&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFMBP36cPTmejSB7UUivj6P4YLuoWvpcz88Rmilvm21hA&oe=6A848D82",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773811749_18549917314074731_2734247693651828101_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s240x240_tt6&_nc_cat=101&ig_cache_key=Mzk2MzE4NzEyMTU5MDYyNjcwNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=yB-hhIAUWKUQ7kNvwEy05UX&_nc_oc=AdrEJSS7xV18vlasbV7XE2w_RBHzUNxqOdc-MR97aTxlhwGUDjH-4iDr4s5sxg2Xxco&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGNqKSC6JGwRVeuLck4KYIX84j2_NO2S6mi7ZOrxUG62g&oe=6A848D82",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773811749_18549917314074731_2734247693651828101_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s150x150_tt6&_nc_cat=101&ig_cache_key=Mzk2MzE4NzEyMTU5MDYyNjcwNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=yB-hhIAUWKUQ7kNvwEy05UX&_nc_oc=AdrEJSS7xV18vlasbV7XE2w_RBHzUNxqOdc-MR97aTxlhwGUDjH-4iDr4s5sxg2Xxco&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFS0tCZqoquJphkXBSIBpalaboxNHLFY8v6BtAyVTfj1g&oe=6A848D82",
              "height": 150,
              "width": 150
            }
          ]
        },
        "carousel_parent_id": "3963187739466369600_2237970730",
        "sharing_friction_info": {
          "bloks_app_url": null,
          "should_have_sharing_friction": false
        },
        "preview": null,
        "organic_tracking_token": null,
        "saved_collection_ids": null,
        "has_viewer_saved": null,
        "video_versions": null,
        "media_overlay_info": null,
        "code": null,
        "display_uri": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773811749_18549917314074731_2734247693651828101_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e15_fr_s1080x1080_tt6&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=xuKpCM1YRdEQ7kNvwExPzFr&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQFr2m1fayxOzmdEq768lf8VyBj_gVol7O1L_QFFt9tXaw&oe=6A848D82&_nc_sid=7a9f4b",
        "number_of_qualities": null,
        "product_type": "carousel_item",
        "carousel_media": null,
        "taken_at": 1786668815,
        "previous_submitter": null,
        "link": null,
        "story_cta": null,
        "has_liked": null,
        "like_count": null,
        "logging_info_token": null,
        "has_audio": null,
        "clips_metadata": null
      },
      {
        "id": "3963187121355678060_2237970730",
        "pk": "3963187121355678060",
        "accessibility_caption": null,
        "is_dash_eligible": null,
        "video_dash_manifest": null,
        "media_type": 1,
        "original_height": 1350,
        "original_width": 1080,
        "inventory_source": null,
        "user": null,
        "usertags": null,
        "image_versions2": {
          "candidates": [
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773725407_18549917287074731_5028384550837806014_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMTM1NTY3ODA2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=UXuACi-QUMYQ7kNvwE2kYFf&_nc_oc=Adp7SnYBz4r_hOCWUC0EO1j5zJziMkI-EXrlZ39sRj6xzKbjcO-rfWZFgch5HtZ4PeQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFj62q1EcmodfM49QIxPuBnvsXQPc7SDGM4cahdM3w2zA&oe=6A84A96C",
              "height": 1350,
              "width": 1080
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773725407_18549917287074731_5028384550837806014_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMTM1NTY3ODA2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=UXuACi-QUMYQ7kNvwE2kYFf&_nc_oc=Adp7SnYBz4r_hOCWUC0EO1j5zJziMkI-EXrlZ39sRj6xzKbjcO-rfWZFgch5HtZ4PeQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHjS_hjM-5V1kMEOVJ1kzmZ-l0x-nNXgWM8hSVsQD0kuA&oe=6A84A96C",
              "height": 900,
              "width": 720
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773725407_18549917287074731_5028384550837806014_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMTM1NTY3ODA2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=UXuACi-QUMYQ7kNvwE2kYFf&_nc_oc=Adp7SnYBz4r_hOCWUC0EO1j5zJziMkI-EXrlZ39sRj6xzKbjcO-rfWZFgch5HtZ4PeQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHGN6tpAJlb_tObQ-_5C49EFPzNF-8e-jFK-kRycSsT7w&oe=6A84A96C",
              "height": 800,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773725407_18549917287074731_5028384550837806014_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMTM1NTY3ODA2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=UXuACi-QUMYQ7kNvwE2kYFf&_nc_oc=Adp7SnYBz4r_hOCWUC0EO1j5zJziMkI-EXrlZ39sRj6xzKbjcO-rfWZFgch5HtZ4PeQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFduoQZusn7OgFmO_ZjPRV-HJsdIE-_L4RaUtDbrW4Rpg&oe=6A84A96C",
              "height": 600,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773725407_18549917287074731_5028384550837806014_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMTM1NTY3ODA2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=UXuACi-QUMYQ7kNvwE2kYFf&_nc_oc=Adp7SnYBz4r_hOCWUC0EO1j5zJziMkI-EXrlZ39sRj6xzKbjcO-rfWZFgch5HtZ4PeQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFFIDqjkUBxLxe9dzK7_nkvFXerkKtwH58J1zybjzXz0g&oe=6A84A96C",
              "height": 400,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773725407_18549917287074731_5028384550837806014_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMTM1NTY3ODA2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=UXuACi-QUMYQ7kNvwE2kYFf&_nc_oc=Adp7SnYBz4r_hOCWUC0EO1j5zJziMkI-EXrlZ39sRj6xzKbjcO-rfWZFgch5HtZ4PeQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQH_rNxM7D8Lke2U6n8UQ-Ln1i4h0ZXd9efNEoVc9ukf2g&oe=6A84A96C",
              "height": 300,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773725407_18549917287074731_5028384550837806014_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMTM1NTY3ODA2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=UXuACi-QUMYQ7kNvwE2kYFf&_nc_oc=Adp7SnYBz4r_hOCWUC0EO1j5zJziMkI-EXrlZ39sRj6xzKbjcO-rfWZFgch5HtZ4PeQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGxdH4syDZBAn-zJf7rAGUfmYgo1peIjIr8C7VkWeca1g&oe=6A84A96C",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773725407_18549917287074731_5028384550837806014_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMTM1NTY3ODA2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=UXuACi-QUMYQ7kNvwE2kYFf&_nc_oc=Adp7SnYBz4r_hOCWUC0EO1j5zJziMkI-EXrlZ39sRj6xzKbjcO-rfWZFgch5HtZ4PeQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHZIBqWzxkQwfKXC7bk_39ndz3cvlF483SGX7fcNDVZZg&oe=6A84A96C",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773725407_18549917287074731_5028384550837806014_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMTM1NTY3ODA2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=UXuACi-QUMYQ7kNvwE2kYFf&_nc_oc=Adp7SnYBz4r_hOCWUC0EO1j5zJziMkI-EXrlZ39sRj6xzKbjcO-rfWZFgch5HtZ4PeQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGH2GOVdgjy3z6on-TRK8Bst1-t2X7ifNL0sRDcCF05bA&oe=6A84A96C",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773725407_18549917287074731_5028384550837806014_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s480x480_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMTM1NTY3ODA2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=UXuACi-QUMYQ7kNvwE2kYFf&_nc_oc=Adp7SnYBz4r_hOCWUC0EO1j5zJziMkI-EXrlZ39sRj6xzKbjcO-rfWZFgch5HtZ4PeQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQE_owB4jOPik2BkaZyrsCEdbhRELTfMDozON-ZKfAIOhg&oe=6A84A96C",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773725407_18549917287074731_5028384550837806014_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s320x320_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMTM1NTY3ODA2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=UXuACi-QUMYQ7kNvwE2kYFf&_nc_oc=Adp7SnYBz4r_hOCWUC0EO1j5zJziMkI-EXrlZ39sRj6xzKbjcO-rfWZFgch5HtZ4PeQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQH7M4FBLlvKyV5xW30LqwlbHIHppE5EczCdcuzDBYH7GA&oe=6A84A96C",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773725407_18549917287074731_5028384550837806014_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s240x240_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMTM1NTY3ODA2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=UXuACi-QUMYQ7kNvwE2kYFf&_nc_oc=Adp7SnYBz4r_hOCWUC0EO1j5zJziMkI-EXrlZ39sRj6xzKbjcO-rfWZFgch5HtZ4PeQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHsKX2a-7Qin70QOtmQ6CrwYKF4SKXqiQPJ9tqCAwl-Xw&oe=6A84A96C",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773725407_18549917287074731_5028384550837806014_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s150x150_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMTM1NTY3ODA2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=UXuACi-QUMYQ7kNvwE2kYFf&_nc_oc=Adp7SnYBz4r_hOCWUC0EO1j5zJziMkI-EXrlZ39sRj6xzKbjcO-rfWZFgch5HtZ4PeQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFa9b8x6lXihnIoc2SVm1iIaNh6F__oWJvjz1v8Fwgavw&oe=6A84A96C",
              "height": 150,
              "width": 150
            }
          ]
        },
        "carousel_parent_id": "3963187739466369600_2237970730",
        "sharing_friction_info": {
          "bloks_app_url": null,
          "should_have_sharing_friction": false
        },
        "preview": null,
        "organic_tracking_token": null,
        "saved_collection_ids": null,
        "has_viewer_saved": null,
        "video_versions": null,
        "media_overlay_info": null,
        "code": null,
        "display_uri": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773725407_18549917287074731_5028384550837806014_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e15_fr_s1080x1080_tt6&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=MMDOMG_Hm-kQ7kNvwH_fR98&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQFZfnQKUFUDGaDx1OwpJ8_CATLKVtwxaJ8sc3t1amqwJQ&oe=6A84A96C&_nc_sid=7a9f4b",
        "number_of_qualities": null,
        "product_type": "carousel_item",
        "carousel_media": null,
        "taken_at": 1786668815,
        "previous_submitter": null,
        "link": null,
        "story_cta": null,
        "has_liked": null,
        "like_count": null,
        "logging_info_token": null,
        "has_audio": null,
        "clips_metadata": null
      },
      {
        "id": "3963187123276587738_2237970730",
        "pk": "3963187123276587738",
        "accessibility_caption": null,
        "is_dash_eligible": null,
        "video_dash_manifest": null,
        "media_type": 1,
        "original_height": 1350,
        "original_width": 1080,
        "inventory_source": null,
        "user": null,
        "usertags": null,
        "image_versions2": {
          "candidates": [
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774281083_18549917305074731_8908467008525322143_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=104&ig_cache_key=Mzk2MzE4NzEyMzI3NjU4NzczOA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=OxHr2SEQarQQ7kNvwFy2-Hb&_nc_oc=Adr7Y3WVwIRx2-U4cX7px8A8nzI82QvWNfWKko6bZJDal12PvqRwXF2qH60tBJ2dWpU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGb1Tk_uYRgLTsvazEYT-OmwKgLx_WqDj5xpEhRUL2rYA&oe=6A84AAE1",
              "height": 1350,
              "width": 1080
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774281083_18549917305074731_8908467008525322143_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=104&ig_cache_key=Mzk2MzE4NzEyMzI3NjU4NzczOA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=OxHr2SEQarQQ7kNvwFy2-Hb&_nc_oc=Adr7Y3WVwIRx2-U4cX7px8A8nzI82QvWNfWKko6bZJDal12PvqRwXF2qH60tBJ2dWpU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGaZQCUe6u4JqDGnGtKoTSBVGGEWiIrR12JjE64tbuWtA&oe=6A84AAE1",
              "height": 900,
              "width": 720
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774281083_18549917305074731_8908467008525322143_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=104&ig_cache_key=Mzk2MzE4NzEyMzI3NjU4NzczOA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=OxHr2SEQarQQ7kNvwFy2-Hb&_nc_oc=Adr7Y3WVwIRx2-U4cX7px8A8nzI82QvWNfWKko6bZJDal12PvqRwXF2qH60tBJ2dWpU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEYr17c_16hW19qpXbPp-E7TtaWjhTVMGWnPIgWb_NuAg&oe=6A84AAE1",
              "height": 800,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774281083_18549917305074731_8908467008525322143_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=104&ig_cache_key=Mzk2MzE4NzEyMzI3NjU4NzczOA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=OxHr2SEQarQQ7kNvwFy2-Hb&_nc_oc=Adr7Y3WVwIRx2-U4cX7px8A8nzI82QvWNfWKko6bZJDal12PvqRwXF2qH60tBJ2dWpU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGEgVklgYFx57w1rQRcNJDjXqat23qWHn5evKpGvYs9ww&oe=6A84AAE1",
              "height": 600,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774281083_18549917305074731_8908467008525322143_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=104&ig_cache_key=Mzk2MzE4NzEyMzI3NjU4NzczOA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=OxHr2SEQarQQ7kNvwFy2-Hb&_nc_oc=Adr7Y3WVwIRx2-U4cX7px8A8nzI82QvWNfWKko6bZJDal12PvqRwXF2qH60tBJ2dWpU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGjBzSt5ZWkCciKUqIR-ALppfkyCfkfbFDZ5G7fH3d75g&oe=6A84AAE1",
              "height": 400,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774281083_18549917305074731_8908467008525322143_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=104&ig_cache_key=Mzk2MzE4NzEyMzI3NjU4NzczOA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=OxHr2SEQarQQ7kNvwFy2-Hb&_nc_oc=Adr7Y3WVwIRx2-U4cX7px8A8nzI82QvWNfWKko6bZJDal12PvqRwXF2qH60tBJ2dWpU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHvkMhQxsmHKzkLb_LwFxSQ8h8TBv-kHPVRyJ1qP7jMdQ&oe=6A84AAE1",
              "height": 300,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774281083_18549917305074731_8908467008525322143_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=104&ig_cache_key=Mzk2MzE4NzEyMzI3NjU4NzczOA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=OxHr2SEQarQQ7kNvwFy2-Hb&_nc_oc=Adr7Y3WVwIRx2-U4cX7px8A8nzI82QvWNfWKko6bZJDal12PvqRwXF2qH60tBJ2dWpU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFvwEavw7ljiCH7y1JDFlpW_WomVXhIrS5XbfXOIfxupg&oe=6A84AAE1",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774281083_18549917305074731_8908467008525322143_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=104&ig_cache_key=Mzk2MzE4NzEyMzI3NjU4NzczOA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=OxHr2SEQarQQ7kNvwFy2-Hb&_nc_oc=Adr7Y3WVwIRx2-U4cX7px8A8nzI82QvWNfWKko6bZJDal12PvqRwXF2qH60tBJ2dWpU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEj4RVbgqgkrgc0QrRimXqt88CtJBACcAl4o6XNXK97Pg&oe=6A84AAE1",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774281083_18549917305074731_8908467008525322143_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=104&ig_cache_key=Mzk2MzE4NzEyMzI3NjU4NzczOA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=OxHr2SEQarQQ7kNvwFy2-Hb&_nc_oc=Adr7Y3WVwIRx2-U4cX7px8A8nzI82QvWNfWKko6bZJDal12PvqRwXF2qH60tBJ2dWpU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFzDYdIXKk4qldaTkcIZ5pQnDu7FUkt81m1kll2gsDetg&oe=6A84AAE1",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774281083_18549917305074731_8908467008525322143_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s480x480_tt6&_nc_cat=104&ig_cache_key=Mzk2MzE4NzEyMzI3NjU4NzczOA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=OxHr2SEQarQQ7kNvwFy2-Hb&_nc_oc=Adr7Y3WVwIRx2-U4cX7px8A8nzI82QvWNfWKko6bZJDal12PvqRwXF2qH60tBJ2dWpU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHW8QtIfD876hKiXAVLu3ede36XCDQ9kzLzRFnS6UJf9w&oe=6A84AAE1",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774281083_18549917305074731_8908467008525322143_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s320x320_tt6&_nc_cat=104&ig_cache_key=Mzk2MzE4NzEyMzI3NjU4NzczOA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=OxHr2SEQarQQ7kNvwFy2-Hb&_nc_oc=Adr7Y3WVwIRx2-U4cX7px8A8nzI82QvWNfWKko6bZJDal12PvqRwXF2qH60tBJ2dWpU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEcsOo5p_dMPBvPV1frZmEJYBIpXjBSoFEFRJcX7ATB6g&oe=6A84AAE1",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774281083_18549917305074731_8908467008525322143_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s240x240_tt6&_nc_cat=104&ig_cache_key=Mzk2MzE4NzEyMzI3NjU4NzczOA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=OxHr2SEQarQQ7kNvwFy2-Hb&_nc_oc=Adr7Y3WVwIRx2-U4cX7px8A8nzI82QvWNfWKko6bZJDal12PvqRwXF2qH60tBJ2dWpU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHXAucv6KOpJ58-UbFRu2np0NdK2ufj7ljeH8L--j648Q&oe=6A84AAE1",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774281083_18549917305074731_8908467008525322143_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s150x150_tt6&_nc_cat=104&ig_cache_key=Mzk2MzE4NzEyMzI3NjU4NzczOA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=OxHr2SEQarQQ7kNvwFy2-Hb&_nc_oc=Adr7Y3WVwIRx2-U4cX7px8A8nzI82QvWNfWKko6bZJDal12PvqRwXF2qH60tBJ2dWpU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGSYVQATDJGSZDK8hcLq6vDaoSgbvWNs5WrmtaJ5rG-sw&oe=6A84AAE1",
              "height": 150,
              "width": 150
            }
          ]
        },
        "carousel_parent_id": "3963187739466369600_2237970730",
        "sharing_friction_info": {
          "bloks_app_url": null,
          "should_have_sharing_friction": false
        },
        "preview": null,
        "organic_tracking_token": null,
        "saved_collection_ids": null,
        "has_viewer_saved": null,
        "video_versions": null,
        "media_overlay_info": null,
        "code": null,
        "display_uri": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774281083_18549917305074731_8908467008525322143_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e15_fr_s1080x1080_tt6&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=e7CrzoBYuNoQ7kNvwF40TnF&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQG17GFHMggEWrPnhL-HV9rOJqUulThLgHIpgSdowmNerQ&oe=6A84AAE1&_nc_sid=7a9f4b",
        "number_of_qualities": null,
        "product_type": "carousel_item",
        "carousel_media": null,
        "taken_at": 1786668815,
        "previous_submitter": null,
        "link": null,
        "story_cta": null,
        "has_liked": null,
        "like_count": null,
        "logging_info_token": null,
        "has_audio": null,
        "clips_metadata": null
      },
      {
        "id": "3963187127403706219_2237970730",
        "pk": "3963187127403706219",
        "accessibility_caption": null,
        "is_dash_eligible": null,
        "video_dash_manifest": null,
        "media_type": 1,
        "original_height": 1350,
        "original_width": 1080,
        "inventory_source": null,
        "user": null,
        "usertags": null,
        "image_versions2": {
          "candidates": [
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/772714522_18549917329074731_7712275684327689571_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=106&ig_cache_key=Mzk2MzE4NzEyNzQwMzcwNjIxOQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=MXx0pnAfv74Q7kNvwFywm6R&_nc_oc=AdrHQ7N_pX2RI81U14gLqgJaM1K_HQHBHf7UGn_2mjw0NS6IMe4gbWbcvf0tOmqBZGA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGnY24tyDK_faTA3ITPXF5FjjX7CsAwYcr9FDN7zhGkNQ&oe=6A84A6FD",
              "height": 1350,
              "width": 1080
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/772714522_18549917329074731_7712275684327689571_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=106&ig_cache_key=Mzk2MzE4NzEyNzQwMzcwNjIxOQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=MXx0pnAfv74Q7kNvwFywm6R&_nc_oc=AdrHQ7N_pX2RI81U14gLqgJaM1K_HQHBHf7UGn_2mjw0NS6IMe4gbWbcvf0tOmqBZGA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQG90aY9kZPXb6033KSPEM389J1Uu3zvsfzAgDKr5eie6w&oe=6A84A6FD",
              "height": 900,
              "width": 720
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/772714522_18549917329074731_7712275684327689571_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=106&ig_cache_key=Mzk2MzE4NzEyNzQwMzcwNjIxOQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=MXx0pnAfv74Q7kNvwFywm6R&_nc_oc=AdrHQ7N_pX2RI81U14gLqgJaM1K_HQHBHf7UGn_2mjw0NS6IMe4gbWbcvf0tOmqBZGA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGA7bduOM-po8RMxC9Gtz6MUW5JlzbbLQ2ybs7YM-_gUg&oe=6A84A6FD",
              "height": 800,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/772714522_18549917329074731_7712275684327689571_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=106&ig_cache_key=Mzk2MzE4NzEyNzQwMzcwNjIxOQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=MXx0pnAfv74Q7kNvwFywm6R&_nc_oc=AdrHQ7N_pX2RI81U14gLqgJaM1K_HQHBHf7UGn_2mjw0NS6IMe4gbWbcvf0tOmqBZGA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGlIIHRHJoYcLjDxkNIMqrWsFOOnDc81dUdSe1L4ftM_g&oe=6A84A6FD",
              "height": 600,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/772714522_18549917329074731_7712275684327689571_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=106&ig_cache_key=Mzk2MzE4NzEyNzQwMzcwNjIxOQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=MXx0pnAfv74Q7kNvwFywm6R&_nc_oc=AdrHQ7N_pX2RI81U14gLqgJaM1K_HQHBHf7UGn_2mjw0NS6IMe4gbWbcvf0tOmqBZGA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHqYoDQTYLlFGei3_zAm664EU5klaG1f2wu6_HbKJ3xiQ&oe=6A84A6FD",
              "height": 400,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/772714522_18549917329074731_7712275684327689571_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=106&ig_cache_key=Mzk2MzE4NzEyNzQwMzcwNjIxOQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=MXx0pnAfv74Q7kNvwFywm6R&_nc_oc=AdrHQ7N_pX2RI81U14gLqgJaM1K_HQHBHf7UGn_2mjw0NS6IMe4gbWbcvf0tOmqBZGA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFW1eUndGAu6hq4ebVoJC5G2WAXG1FTTAS3SDri9HbdOQ&oe=6A84A6FD",
              "height": 300,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/772714522_18549917329074731_7712275684327689571_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=106&ig_cache_key=Mzk2MzE4NzEyNzQwMzcwNjIxOQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=MXx0pnAfv74Q7kNvwFywm6R&_nc_oc=AdrHQ7N_pX2RI81U14gLqgJaM1K_HQHBHf7UGn_2mjw0NS6IMe4gbWbcvf0tOmqBZGA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGDAsq7ycACM1ZEHzR2PG21Uoh3zyvByuhdoZ6fwz86Yg&oe=6A84A6FD",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/772714522_18549917329074731_7712275684327689571_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=106&ig_cache_key=Mzk2MzE4NzEyNzQwMzcwNjIxOQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=MXx0pnAfv74Q7kNvwFywm6R&_nc_oc=AdrHQ7N_pX2RI81U14gLqgJaM1K_HQHBHf7UGn_2mjw0NS6IMe4gbWbcvf0tOmqBZGA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEEmIOgsP6-Ntsvq6AYZzmWotWbrbKTPw7oq_8REIncPg&oe=6A84A6FD",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/772714522_18549917329074731_7712275684327689571_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=106&ig_cache_key=Mzk2MzE4NzEyNzQwMzcwNjIxOQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=MXx0pnAfv74Q7kNvwFywm6R&_nc_oc=AdrHQ7N_pX2RI81U14gLqgJaM1K_HQHBHf7UGn_2mjw0NS6IMe4gbWbcvf0tOmqBZGA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGIHgCLNBNyeyNyfxuE1VfV5SUgdg-OWi6w0giOUQaSUw&oe=6A84A6FD",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/772714522_18549917329074731_7712275684327689571_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s480x480_tt6&_nc_cat=106&ig_cache_key=Mzk2MzE4NzEyNzQwMzcwNjIxOQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=MXx0pnAfv74Q7kNvwFywm6R&_nc_oc=AdrHQ7N_pX2RI81U14gLqgJaM1K_HQHBHf7UGn_2mjw0NS6IMe4gbWbcvf0tOmqBZGA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGzLNyFE3rRwzTsDnqsV50FMVbLC8ADoF1m7DEXCVg65A&oe=6A84A6FD",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/772714522_18549917329074731_7712275684327689571_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s320x320_tt6&_nc_cat=106&ig_cache_key=Mzk2MzE4NzEyNzQwMzcwNjIxOQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=MXx0pnAfv74Q7kNvwFywm6R&_nc_oc=AdrHQ7N_pX2RI81U14gLqgJaM1K_HQHBHf7UGn_2mjw0NS6IMe4gbWbcvf0tOmqBZGA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEJJxbLrYfm1MbXZ8K3M9BN63oaLD5uwoUKbpRCJ0mOFQ&oe=6A84A6FD",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/772714522_18549917329074731_7712275684327689571_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s240x240_tt6&_nc_cat=106&ig_cache_key=Mzk2MzE4NzEyNzQwMzcwNjIxOQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=MXx0pnAfv74Q7kNvwFywm6R&_nc_oc=AdrHQ7N_pX2RI81U14gLqgJaM1K_HQHBHf7UGn_2mjw0NS6IMe4gbWbcvf0tOmqBZGA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQH1Aa9SV4RGLFx72MJPVajRyQ4edtucZ7p8MFbg9Mcd8g&oe=6A84A6FD",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/772714522_18549917329074731_7712275684327689571_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s150x150_tt6&_nc_cat=106&ig_cache_key=Mzk2MzE4NzEyNzQwMzcwNjIxOQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=MXx0pnAfv74Q7kNvwFywm6R&_nc_oc=AdrHQ7N_pX2RI81U14gLqgJaM1K_HQHBHf7UGn_2mjw0NS6IMe4gbWbcvf0tOmqBZGA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHqgppsoatNCo4dOEkdD5LX_jeWjn5ahyTKs5v-fS2fDg&oe=6A84A6FD",
              "height": 150,
              "width": 150
            }
          ]
        },
        "carousel_parent_id": "3963187739466369600_2237970730",
        "sharing_friction_info": {
          "bloks_app_url": null,
          "should_have_sharing_friction": false
        },
        "preview": null,
        "organic_tracking_token": null,
        "saved_collection_ids": null,
        "has_viewer_saved": null,
        "video_versions": null,
        "media_overlay_info": null,
        "code": null,
        "display_uri": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/772714522_18549917329074731_7712275684327689571_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e15_fr_s1080x1080_tt6&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=sE-YQuJGWCYQ7kNvwF3vXB3&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQFBBcSfhDnArgRCBDwzNYMEs3G8bktUQRWV933UZDEa1w&oe=6A84A6FD&_nc_sid=7a9f4b",
        "number_of_qualities": null,
        "product_type": "carousel_item",
        "carousel_media": null,
        "taken_at": 1786668815,
        "previous_submitter": null,
        "link": null,
        "story_cta": null,
        "has_liked": null,
        "like_count": null,
        "logging_info_token": null,
        "has_audio": null,
        "clips_metadata": null
      }
    ],
    "coauthor_producers": [],
    "timeline_pinned_user_ids": [],
    "date": "2026-08-14T00:53:36.000Z",
    "crawled_at": "2026-08-14T08:16:43.756Z"
  },
  {
    "id": "3962867082392210475_2237970730",
    "pk": "3962867082392210475",
    "type": "Image",
    "image": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=FFka95e64qsQ7kNvwEIcxBO&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQEKppiNPtkM5IcmmZp3sCPbhWN7Z51QV-xBaM5mMFJb5w&oe=6A84A355&_nc_sid=7a9f4b",
    "shortcode": "Db-7p2CE4wr",
    "product_type": "carousel_container",
    "hashtags": [
      "#ELLEIndonesia",
      "#ElleWatches",
      "#JamTanganElle",
      "#pakuwonmalljogja"
    ],
    "mentions": [],
    "location": null,
    "caption": "Grand Opening ELLE Flagship Store @ellewatchindonesia ✨\nParisian chic, now within reach. Enjoy 17% + 8% OFF all ELLE watches!\n\nVisit our store at Pakuwon Mall Jogja, Ground Floor or contact our Customer Service 085 777 111 666 for more info.\n\n#ELLEIndonesia #ElleWatches #JamTanganElle #pakuwonmalljogja",
    "comment_count": 0,
    "like_count": 82,
    "view_count": null,
    "has_audio": null,
    "usertags": null,
    "clips_metadata": null,
    "from_url": "https://www.instagram.com/pakuwonmall.jogja/",
    "post_url": "https://www.instagram.com/p/Db-7p2CE4wr/",
    "video_duration": null,
    "user": {
      "pk": "2237970730",
      "profile_pic_url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=L9VCN6COaTMQ7kNvwHOtFy0&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQEM_oL-JrA3TqdAkw0HaavzLRi54AM8nCTvpERnqwDeWQ&oe=6A84A633&_nc_sid=7a9f4b",
      "username": "pakuwonmall.jogja",
      "is_private": false,
      "is_embeds_disabled": false,
      "is_unpublished": false,
      "is_verified": true,
      "friendship_status": null,
      "latest_besties_reel_media": null,
      "latest_reel_media": null,
      "live_broadcast_visibility": null,
      "live_broadcast_id": null,
      "show_account_transparency_details": true,
      "transparency_product": null,
      "transparency_product_enabled": false,
      "transparency_label": null,
      "ai_agent_owner_username": null,
      "id": "2237970730",
      "aigm_account_label_info": null,
      "hd_profile_pic_url_info": {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=L9VCN6COaTMQ7kNvwHOtFy0&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGSwOGkAaLzHNq-6Ef-eLq1M-C4wS7L_s0lWwJa9u0Lnw&oe=6A84A633&_nc_sid=7a9f4b"
      },
      "__typename": "XDTUserDict",
      "full_name": "Pakuwon Mall Jogja"
    },
    "images": [
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwGvVEAr&_nc_oc=AdqAZpqYKXvMDEKjdnWeXNS91Dusm6WV-7JlS1Rwubdq4gs2rbGQBqNzV9ANrd9FG2k&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFl9FGviycQAg-Ov_WxzxYU49a0n4pnF2iijqqHk1E9yQ&oe=6A84A355",
        "height": 1472,
        "width": 1179
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwGvVEAr&_nc_oc=AdqAZpqYKXvMDEKjdnWeXNS91Dusm6WV-7JlS1Rwubdq4gs2rbGQBqNzV9ANrd9FG2k&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFYRyiDHc7f-FTH3uKMkklHznHVtFN6l0KqnlgVFExnCA&oe=6A84A355",
        "height": 899,
        "width": 720
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwGvVEAr&_nc_oc=AdqAZpqYKXvMDEKjdnWeXNS91Dusm6WV-7JlS1Rwubdq4gs2rbGQBqNzV9ANrd9FG2k&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGN6uHtSJRwxGtmdhA1bjNJpoj0ujASkIDV6WyR73gzoQ&oe=6A84A355",
        "height": 799,
        "width": 640
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwGvVEAr&_nc_oc=AdqAZpqYKXvMDEKjdnWeXNS91Dusm6WV-7JlS1Rwubdq4gs2rbGQBqNzV9ANrd9FG2k&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHhPTjB-111vy3pcOgRVm7TEs0mJ1jbx3VcB228G38qCg&oe=6A84A355",
        "height": 599,
        "width": 480
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwGvVEAr&_nc_oc=AdqAZpqYKXvMDEKjdnWeXNS91Dusm6WV-7JlS1Rwubdq4gs2rbGQBqNzV9ANrd9FG2k&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQE8cEwFJUaUf94AyiuY3Th-VqTUz4GjtgYMRPO_xqT6MQ&oe=6A84A355",
        "height": 400,
        "width": 320
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwGvVEAr&_nc_oc=AdqAZpqYKXvMDEKjdnWeXNS91Dusm6WV-7JlS1Rwubdq4gs2rbGQBqNzV9ANrd9FG2k&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHGemufoNyDRvcmcD7iYIhDY_lfQc2vKNsv4Wn2wFzDLA&oe=6A84A355",
        "height": 300,
        "width": 240
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwGvVEAr&_nc_oc=AdqAZpqYKXvMDEKjdnWeXNS91Dusm6WV-7JlS1Rwubdq4gs2rbGQBqNzV9ANrd9FG2k&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEMcMpYvNUxd07N4RHtCpT9Tp3JckS44SDAOxdU-FU_mw&oe=6A84A355",
        "height": 1080,
        "width": 1080
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwGvVEAr&_nc_oc=AdqAZpqYKXvMDEKjdnWeXNS91Dusm6WV-7JlS1Rwubdq4gs2rbGQBqNzV9ANrd9FG2k&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGZqLjj-DNPZM6vjsj4QFjOVcL6ibLTHZvlrsN6sLuWpw&oe=6A84A355",
        "height": 750,
        "width": 750
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwGvVEAr&_nc_oc=AdqAZpqYKXvMDEKjdnWeXNS91Dusm6WV-7JlS1Rwubdq4gs2rbGQBqNzV9ANrd9FG2k&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFaWIa-P9ZE9vSUdg7g9WVUPSJ2LcgSiHND_BwHTu-NVQ&oe=6A84A355",
        "height": 640,
        "width": 640
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s480x480_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwGvVEAr&_nc_oc=AdqAZpqYKXvMDEKjdnWeXNS91Dusm6WV-7JlS1Rwubdq4gs2rbGQBqNzV9ANrd9FG2k&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGQ_t23eFnTQOyabgrrGXVLGxOH2LnE-pwIWcoQv_bqZg&oe=6A84A355",
        "height": 480,
        "width": 480
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s320x320_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwGvVEAr&_nc_oc=AdqAZpqYKXvMDEKjdnWeXNS91Dusm6WV-7JlS1Rwubdq4gs2rbGQBqNzV9ANrd9FG2k&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQG32ItUqZROi5U0OSGf3YPwiTBujwdnen49VAjLIy4yBw&oe=6A84A355",
        "height": 320,
        "width": 320
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s240x240_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwGvVEAr&_nc_oc=AdqAZpqYKXvMDEKjdnWeXNS91Dusm6WV-7JlS1Rwubdq4gs2rbGQBqNzV9ANrd9FG2k&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHqHz0DtiCswMsFJgPsnGfmp68yMN8DXL-P8J1lxA46Yw&oe=6A84A355",
        "height": 240,
        "width": 240
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s150x150_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwGvVEAr&_nc_oc=AdqAZpqYKXvMDEKjdnWeXNS91Dusm6WV-7JlS1Rwubdq4gs2rbGQBqNzV9ANrd9FG2k&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEwwrMdzp9t47YMK_yyxb3GmmHgb5QHgxXo2b4WZyQ3dQ&oe=6A84A355",
        "height": 150,
        "width": 150
      }
    ],
    "video_versions": null,
    "carousel_media_count": 2,
    "carousel_media": [
      {
        "id": "3962866927189944972_2237970730",
        "pk": "3962866927189944972",
        "accessibility_caption": null,
        "is_dash_eligible": null,
        "video_dash_manifest": null,
        "media_type": 1,
        "original_height": 1472,
        "original_width": 1179,
        "inventory_source": null,
        "user": null,
        "usertags": null,
        "image_versions2": {
          "candidates": [
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwGvVEAr&_nc_oc=AdqAZpqYKXvMDEKjdnWeXNS91Dusm6WV-7JlS1Rwubdq4gs2rbGQBqNzV9ANrd9FG2k&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFl9FGviycQAg-Ov_WxzxYU49a0n4pnF2iijqqHk1E9yQ&oe=6A84A355",
              "height": 1472,
              "width": 1179
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwGvVEAr&_nc_oc=AdqAZpqYKXvMDEKjdnWeXNS91Dusm6WV-7JlS1Rwubdq4gs2rbGQBqNzV9ANrd9FG2k&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFYRyiDHc7f-FTH3uKMkklHznHVtFN6l0KqnlgVFExnCA&oe=6A84A355",
              "height": 899,
              "width": 720
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwGvVEAr&_nc_oc=AdqAZpqYKXvMDEKjdnWeXNS91Dusm6WV-7JlS1Rwubdq4gs2rbGQBqNzV9ANrd9FG2k&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGN6uHtSJRwxGtmdhA1bjNJpoj0ujASkIDV6WyR73gzoQ&oe=6A84A355",
              "height": 799,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwGvVEAr&_nc_oc=AdqAZpqYKXvMDEKjdnWeXNS91Dusm6WV-7JlS1Rwubdq4gs2rbGQBqNzV9ANrd9FG2k&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHhPTjB-111vy3pcOgRVm7TEs0mJ1jbx3VcB228G38qCg&oe=6A84A355",
              "height": 599,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwGvVEAr&_nc_oc=AdqAZpqYKXvMDEKjdnWeXNS91Dusm6WV-7JlS1Rwubdq4gs2rbGQBqNzV9ANrd9FG2k&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQE8cEwFJUaUf94AyiuY3Th-VqTUz4GjtgYMRPO_xqT6MQ&oe=6A84A355",
              "height": 400,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwGvVEAr&_nc_oc=AdqAZpqYKXvMDEKjdnWeXNS91Dusm6WV-7JlS1Rwubdq4gs2rbGQBqNzV9ANrd9FG2k&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHGemufoNyDRvcmcD7iYIhDY_lfQc2vKNsv4Wn2wFzDLA&oe=6A84A355",
              "height": 300,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwGvVEAr&_nc_oc=AdqAZpqYKXvMDEKjdnWeXNS91Dusm6WV-7JlS1Rwubdq4gs2rbGQBqNzV9ANrd9FG2k&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEMcMpYvNUxd07N4RHtCpT9Tp3JckS44SDAOxdU-FU_mw&oe=6A84A355",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwGvVEAr&_nc_oc=AdqAZpqYKXvMDEKjdnWeXNS91Dusm6WV-7JlS1Rwubdq4gs2rbGQBqNzV9ANrd9FG2k&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGZqLjj-DNPZM6vjsj4QFjOVcL6ibLTHZvlrsN6sLuWpw&oe=6A84A355",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwGvVEAr&_nc_oc=AdqAZpqYKXvMDEKjdnWeXNS91Dusm6WV-7JlS1Rwubdq4gs2rbGQBqNzV9ANrd9FG2k&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFaWIa-P9ZE9vSUdg7g9WVUPSJ2LcgSiHND_BwHTu-NVQ&oe=6A84A355",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s480x480_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwGvVEAr&_nc_oc=AdqAZpqYKXvMDEKjdnWeXNS91Dusm6WV-7JlS1Rwubdq4gs2rbGQBqNzV9ANrd9FG2k&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGQ_t23eFnTQOyabgrrGXVLGxOH2LnE-pwIWcoQv_bqZg&oe=6A84A355",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s320x320_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwGvVEAr&_nc_oc=AdqAZpqYKXvMDEKjdnWeXNS91Dusm6WV-7JlS1Rwubdq4gs2rbGQBqNzV9ANrd9FG2k&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQG32ItUqZROi5U0OSGf3YPwiTBujwdnen49VAjLIy4yBw&oe=6A84A355",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s240x240_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwGvVEAr&_nc_oc=AdqAZpqYKXvMDEKjdnWeXNS91Dusm6WV-7JlS1Rwubdq4gs2rbGQBqNzV9ANrd9FG2k&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHqHz0DtiCswMsFJgPsnGfmp68yMN8DXL-P8J1lxA46Yw&oe=6A84A355",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s150x150_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwGvVEAr&_nc_oc=AdqAZpqYKXvMDEKjdnWeXNS91Dusm6WV-7JlS1Rwubdq4gs2rbGQBqNzV9ANrd9FG2k&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEwwrMdzp9t47YMK_yyxb3GmmHgb5QHgxXo2b4WZyQ3dQ&oe=6A84A355",
              "height": 150,
              "width": 150
            }
          ]
        },
        "carousel_parent_id": "3962867082392210475_2237970730",
        "sharing_friction_info": {
          "bloks_app_url": null,
          "should_have_sharing_friction": false
        },
        "preview": null,
        "organic_tracking_token": null,
        "saved_collection_ids": null,
        "has_viewer_saved": null,
        "video_versions": null,
        "media_overlay_info": null,
        "code": null,
        "display_uri": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=FFka95e64qsQ7kNvwEIcxBO&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQEKppiNPtkM5IcmmZp3sCPbhWN7Z51QV-xBaM5mMFJb5w&oe=6A84A355&_nc_sid=7a9f4b",
        "number_of_qualities": null,
        "product_type": "carousel_item",
        "carousel_media": null,
        "taken_at": 1786630590,
        "previous_submitter": null,
        "link": null,
        "story_cta": null,
        "has_liked": null,
        "like_count": null,
        "logging_info_token": null,
        "has_audio": null,
        "clips_metadata": null
      },
      {
        "id": "3962866929362565897_2237970730",
        "pk": "3962866929362565897",
        "accessibility_caption": null,
        "is_dash_eligible": null,
        "video_dash_manifest": null,
        "media_type": 1,
        "original_height": 1348,
        "original_width": 1080,
        "inventory_source": null,
        "user": null,
        "usertags": null,
        "image_versions2": {
          "candidates": [
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774059549_18549779836074731_2421445589124863786_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2NjkyOTM2MjU2NTg5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=hR5qD571FYAQ7kNvwGHOINW&_nc_oc=AdrD6cGHxsrIZzQSH-kZR9t0JgfrpA7WCv2AzZllLChBcs1uxmUuCtpreuJCs4A9H8g&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEcYn4k3mocek3h9Zm0WPSY5IefPGs2GFGQJXwQb1meZg&oe=6A849207",
              "height": 1348,
              "width": 1080
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774059549_18549779836074731_2421445589124863786_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2NjkyOTM2MjU2NTg5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=hR5qD571FYAQ7kNvwGHOINW&_nc_oc=AdrD6cGHxsrIZzQSH-kZR9t0JgfrpA7WCv2AzZllLChBcs1uxmUuCtpreuJCs4A9H8g&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGO3J07H56Ei7KhbkmW37FWw4C0cMi4hn1skG3talnQew&oe=6A849207",
              "height": 899,
              "width": 720
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774059549_18549779836074731_2421445589124863786_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2NjkyOTM2MjU2NTg5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=hR5qD571FYAQ7kNvwGHOINW&_nc_oc=AdrD6cGHxsrIZzQSH-kZR9t0JgfrpA7WCv2AzZllLChBcs1uxmUuCtpreuJCs4A9H8g&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGtYpkFvZAlDjt1vEz49gNP8b-DADVMvYXSUxxCIk3waQ&oe=6A849207",
              "height": 799,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774059549_18549779836074731_2421445589124863786_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2NjkyOTM2MjU2NTg5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=hR5qD571FYAQ7kNvwGHOINW&_nc_oc=AdrD6cGHxsrIZzQSH-kZR9t0JgfrpA7WCv2AzZllLChBcs1uxmUuCtpreuJCs4A9H8g&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQELf6y5JOW3f19jLOucxAjYJZpZoSUQ8siVwYtFsujcQQ&oe=6A849207",
              "height": 599,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774059549_18549779836074731_2421445589124863786_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2NjkyOTM2MjU2NTg5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=hR5qD571FYAQ7kNvwGHOINW&_nc_oc=AdrD6cGHxsrIZzQSH-kZR9t0JgfrpA7WCv2AzZllLChBcs1uxmUuCtpreuJCs4A9H8g&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGRL7xh5F_18tSLZnu6OmVcQROZLYu_kzAW2BIGzlQeJA&oe=6A849207",
              "height": 399,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774059549_18549779836074731_2421445589124863786_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2NjkyOTM2MjU2NTg5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=hR5qD571FYAQ7kNvwGHOINW&_nc_oc=AdrD6cGHxsrIZzQSH-kZR9t0JgfrpA7WCv2AzZllLChBcs1uxmUuCtpreuJCs4A9H8g&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEf6rs5mVBLdsKJUQxDcoFHxV9k65vGkkIElbemkOMNjA&oe=6A849207",
              "height": 300,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774059549_18549779836074731_2421445589124863786_n.jpg?stp=c0.134.1080.1080a_dst-jpg_e35_s1080x1079_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2NjkyOTM2MjU2NTg5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=hR5qD571FYAQ7kNvwGHOINW&_nc_oc=AdrD6cGHxsrIZzQSH-kZR9t0JgfrpA7WCv2AzZllLChBcs1uxmUuCtpreuJCs4A9H8g&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQF_BIG70yDxOPkeZlQr5FTlFo8PMtnuo5QF30eUoV09uA&oe=6A849207",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774059549_18549779836074731_2421445589124863786_n.jpg?stp=c0.134.1080.1080a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2NjkyOTM2MjU2NTg5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=hR5qD571FYAQ7kNvwGHOINW&_nc_oc=AdrD6cGHxsrIZzQSH-kZR9t0JgfrpA7WCv2AzZllLChBcs1uxmUuCtpreuJCs4A9H8g&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQE126YMpJgPLUFEUh7ON4rdP8rL9oc2BmoZ9_WitA6E5g&oe=6A849207",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774059549_18549779836074731_2421445589124863786_n.jpg?stp=c0.134.1080.1080a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2NjkyOTM2MjU2NTg5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=hR5qD571FYAQ7kNvwGHOINW&_nc_oc=AdrD6cGHxsrIZzQSH-kZR9t0JgfrpA7WCv2AzZllLChBcs1uxmUuCtpreuJCs4A9H8g&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEL6JutyJA2g1Zq6D_RSSP0DDQtrYDe7J2CW3hjAhsbKA&oe=6A849207",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774059549_18549779836074731_2421445589124863786_n.jpg?stp=c0.134.1080.1080a_dst-jpg_e35_s480x480_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2NjkyOTM2MjU2NTg5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=hR5qD571FYAQ7kNvwGHOINW&_nc_oc=AdrD6cGHxsrIZzQSH-kZR9t0JgfrpA7WCv2AzZllLChBcs1uxmUuCtpreuJCs4A9H8g&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFXherwXO4NwfpvUHY5WYnEJITW852EKjmngsO0SQnAjA&oe=6A849207",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774059549_18549779836074731_2421445589124863786_n.jpg?stp=c0.134.1080.1080a_dst-jpg_e35_s320x320_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2NjkyOTM2MjU2NTg5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=hR5qD571FYAQ7kNvwGHOINW&_nc_oc=AdrD6cGHxsrIZzQSH-kZR9t0JgfrpA7WCv2AzZllLChBcs1uxmUuCtpreuJCs4A9H8g&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGeXHoj3oFuYM7pFG8XZ-1-ilL1BwvS-YBxFt4uemG8Nw&oe=6A849207",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774059549_18549779836074731_2421445589124863786_n.jpg?stp=c0.134.1080.1080a_dst-jpg_e35_s240x240_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2NjkyOTM2MjU2NTg5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=hR5qD571FYAQ7kNvwGHOINW&_nc_oc=AdrD6cGHxsrIZzQSH-kZR9t0JgfrpA7WCv2AzZllLChBcs1uxmUuCtpreuJCs4A9H8g&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGVnQqR-jyz1Aw6BYqpU90TNpxFXiqtbWOCgJHuGNfmpg&oe=6A849207",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/774059549_18549779836074731_2421445589124863786_n.jpg?stp=c0.134.1080.1080a_dst-jpg_e35_s150x150_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2NjkyOTM2MjU2NTg5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=hR5qD571FYAQ7kNvwGHOINW&_nc_oc=AdrD6cGHxsrIZzQSH-kZR9t0JgfrpA7WCv2AzZllLChBcs1uxmUuCtpreuJCs4A9H8g&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFAsVN-DIfxWEXyjH49ytKUO4QBS3tWSF0MGqQHBGFpYg&oe=6A849207",
              "height": 150,
              "width": 150
            }
          ]
        },
        "carousel_parent_id": "3962867082392210475_2237970730",
        "sharing_friction_info": {
          "bloks_app_url": null,
          "should_have_sharing_friction": false
        },
        "preview": null,
        "organic_tracking_token": null,
        "saved_collection_ids": null,
        "has_viewer_saved": null,
        "video_versions": null,
        "media_overlay_info": null,
        "code": null,
        "display_uri": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774059549_18549779836074731_2421445589124863786_n.jpg?stp=c0.134.1080.1080a_dst-jpg_e15_fr_s1080x1080_tt6&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=Pegm_zpRvawQ7kNvwHgrUnN&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHMc-yH-YnjTN-U04zblVKHo8BScuzA-i-nJvvOB360og&oe=6A849207&_nc_sid=7a9f4b",
        "number_of_qualities": null,
        "product_type": "carousel_item",
        "carousel_media": null,
        "taken_at": 1786630590,
        "previous_submitter": null,
        "link": null,
        "story_cta": null,
        "has_liked": null,
        "like_count": null,
        "logging_info_token": null,
        "has_audio": null,
        "clips_metadata": null
      }
    ],
    "coauthor_producers": [],
    "timeline_pinned_user_ids": [],
    "date": "2026-08-13T14:16:31.000Z",
    "crawled_at": "2026-08-14T08:16:43.756Z"
  },
  {
    "id": "3962865174512370672_2237970730",
    "pk": "3962865174512370672",
    "type": "Image",
    "image": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=c0.256.2048.2048a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=FGpPLN37LN4Q7kNvwFjrZcE&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHyirfWb-oE1f-4LLz2xCivWRju7iTMVHcAfaOX88k0KA&oe=6A848DC1&_nc_sid=7a9f4b",
    "shortcode": "Db-7OFLk4Pw",
    "product_type": "carousel_container",
    "hashtags": [
      "#TouslesJours",
      "#promomerdeka",
      "#pakuwonmalljogja"
    ],
    "mentions": [],
    "location": null,
    "caption": "🇮🇩 Celebrate Indonesia’s Independence Day with your favorite treats from @TouslesJours.id ! ✨\n\nFrom 14–18 August 2026, enjoy special Independence Day offers:\n 17% OFF — All Items\n 45% OFF — All Beverages\n 10% OFF — Credit & Debit Card Bank Mandiri\nSee you There!\n\n#TouslesJours #promomerdeka #pakuwonmalljogja",
    "comment_count": 0,
    "like_count": 50,
    "view_count": null,
    "has_audio": null,
    "usertags": null,
    "clips_metadata": null,
    "from_url": "https://www.instagram.com/pakuwonmall.jogja/",
    "post_url": "https://www.instagram.com/p/Db-7OFLk4Pw/",
    "video_duration": null,
    "user": {
      "pk": "2237970730",
      "profile_pic_url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=L9VCN6COaTMQ7kNvwHOtFy0&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQEM_oL-JrA3TqdAkw0HaavzLRi54AM8nCTvpERnqwDeWQ&oe=6A84A633&_nc_sid=7a9f4b",
      "username": "pakuwonmall.jogja",
      "is_private": false,
      "is_embeds_disabled": false,
      "is_unpublished": false,
      "is_verified": true,
      "friendship_status": null,
      "latest_besties_reel_media": null,
      "latest_reel_media": null,
      "live_broadcast_visibility": null,
      "live_broadcast_id": null,
      "show_account_transparency_details": true,
      "transparency_product": null,
      "transparency_product_enabled": false,
      "transparency_label": null,
      "ai_agent_owner_username": null,
      "id": "2237970730",
      "aigm_account_label_info": null,
      "hd_profile_pic_url_info": {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=L9VCN6COaTMQ7kNvwHOtFy0&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGSwOGkAaLzHNq-6Ef-eLq1M-C4wS7L_s0lWwJa9u0Lnw&oe=6A84A633&_nc_sid=7a9f4b"
      },
      "__typename": "XDTUserDict",
      "full_name": "Pakuwon Mall Jogja"
    },
    "images": [
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwH0v6Jl&_nc_oc=AdpRK2_wd31PHN7ir5JCogKgJ_7BgdsV0di1HhNdPmAPvr4zRJXmtDasgkMS5an2bos&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHSiT-DHNwxNKvm_5CCBlUfPsCLe5roz7rOfWt25JHOqw&oe=6A848DC1",
        "height": 2560,
        "width": 2048
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=dst-jpg_e35_p1080x1080_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwH0v6Jl&_nc_oc=AdpRK2_wd31PHN7ir5JCogKgJ_7BgdsV0di1HhNdPmAPvr4zRJXmtDasgkMS5an2bos&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHWlh69HPSQSGjwCloKe-US9EU8u4JXYHYfOUA8qFNwpQ&oe=6A848DC1",
        "height": 1350,
        "width": 1080
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwH0v6Jl&_nc_oc=AdpRK2_wd31PHN7ir5JCogKgJ_7BgdsV0di1HhNdPmAPvr4zRJXmtDasgkMS5an2bos&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQF_Fm5ivhM_R6_F473vN0xfw6kA9YEeA_mwitqLaiUPog&oe=6A848DC1",
        "height": 900,
        "width": 720
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwH0v6Jl&_nc_oc=AdpRK2_wd31PHN7ir5JCogKgJ_7BgdsV0di1HhNdPmAPvr4zRJXmtDasgkMS5an2bos&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQF0xhnxJ6H10mjoiYCnDMmEZez-ZriPk2tN76MYB5jPbg&oe=6A848DC1",
        "height": 800,
        "width": 640
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwH0v6Jl&_nc_oc=AdpRK2_wd31PHN7ir5JCogKgJ_7BgdsV0di1HhNdPmAPvr4zRJXmtDasgkMS5an2bos&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEryO5daR3tlry1F7itKIhwfLRHVTXueIOAgDksysYv4A&oe=6A848DC1",
        "height": 600,
        "width": 480
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwH0v6Jl&_nc_oc=AdpRK2_wd31PHN7ir5JCogKgJ_7BgdsV0di1HhNdPmAPvr4zRJXmtDasgkMS5an2bos&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGcVwQc_SNqEwQIKeQgaD80SWMfALmhYgnNpaSIPCivGg&oe=6A848DC1",
        "height": 400,
        "width": 320
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwH0v6Jl&_nc_oc=AdpRK2_wd31PHN7ir5JCogKgJ_7BgdsV0di1HhNdPmAPvr4zRJXmtDasgkMS5an2bos&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQExJxWMSu954m582QVL3Th9URLwPWlXTPn2cBnwGJ1Haw&oe=6A848DC1",
        "height": 300,
        "width": 240
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=c0.256.2048.2048a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwH0v6Jl&_nc_oc=AdpRK2_wd31PHN7ir5JCogKgJ_7BgdsV0di1HhNdPmAPvr4zRJXmtDasgkMS5an2bos&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQH83Zb3X4RjJDGXlRjLp33_HZkmI9QszQjvhEeOFfpNGQ&oe=6A848DC1",
        "height": 1080,
        "width": 1080
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=c0.256.2048.2048a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwH0v6Jl&_nc_oc=AdpRK2_wd31PHN7ir5JCogKgJ_7BgdsV0di1HhNdPmAPvr4zRJXmtDasgkMS5an2bos&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFL7GnS1bawOiqcOpQJAy0cmbHMaDXLoeoYDWj7Z0xlVQ&oe=6A848DC1",
        "height": 750,
        "width": 750
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=c0.256.2048.2048a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwH0v6Jl&_nc_oc=AdpRK2_wd31PHN7ir5JCogKgJ_7BgdsV0di1HhNdPmAPvr4zRJXmtDasgkMS5an2bos&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFu2VFm_r8Xu6cHzftXJn6RE9o1UDZxZfeZgNE1oY6M2A&oe=6A848DC1",
        "height": 640,
        "width": 640
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=c0.256.2048.2048a_dst-jpg_e35_s480x480_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwH0v6Jl&_nc_oc=AdpRK2_wd31PHN7ir5JCogKgJ_7BgdsV0di1HhNdPmAPvr4zRJXmtDasgkMS5an2bos&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFOJtfq-TPu2bBLncPERYtlK7WYBaYiO6LBxnsBUr7zog&oe=6A848DC1",
        "height": 480,
        "width": 480
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=c0.256.2048.2048a_dst-jpg_e35_s320x320_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwH0v6Jl&_nc_oc=AdpRK2_wd31PHN7ir5JCogKgJ_7BgdsV0di1HhNdPmAPvr4zRJXmtDasgkMS5an2bos&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEVz2rB8ZohLaaNEWp28bCpH8bwun102gLVUPiWyNGP0A&oe=6A848DC1",
        "height": 320,
        "width": 320
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=c0.256.2048.2048a_dst-jpg_e35_s240x240_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwH0v6Jl&_nc_oc=AdpRK2_wd31PHN7ir5JCogKgJ_7BgdsV0di1HhNdPmAPvr4zRJXmtDasgkMS5an2bos&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHUp6n3WY1llm92IfVUHP6s8H6bHJFIAbvz35bMdeGy7w&oe=6A848DC1",
        "height": 240,
        "width": 240
      },
      {
        "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=c0.256.2048.2048a_dst-jpg_e35_s150x150_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwH0v6Jl&_nc_oc=AdpRK2_wd31PHN7ir5JCogKgJ_7BgdsV0di1HhNdPmAPvr4zRJXmtDasgkMS5an2bos&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEGlNLrVrXN5t98WxWGdGxax3n8F7KbQShdynZKiuUH6Q&oe=6A848DC1",
        "height": 150,
        "width": 150
      }
    ],
    "video_versions": null,
    "carousel_media_count": 3,
    "carousel_media": [
      {
        "id": "3962864762920878214_2237970730",
        "pk": "3962864762920878214",
        "accessibility_caption": null,
        "is_dash_eligible": null,
        "video_dash_manifest": null,
        "media_type": 1,
        "original_height": 2560,
        "original_width": 2048,
        "inventory_source": null,
        "user": null,
        "usertags": null,
        "image_versions2": {
          "candidates": [
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwH0v6Jl&_nc_oc=AdpRK2_wd31PHN7ir5JCogKgJ_7BgdsV0di1HhNdPmAPvr4zRJXmtDasgkMS5an2bos&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHSiT-DHNwxNKvm_5CCBlUfPsCLe5roz7rOfWt25JHOqw&oe=6A848DC1",
              "height": 2560,
              "width": 2048
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=dst-jpg_e35_p1080x1080_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwH0v6Jl&_nc_oc=AdpRK2_wd31PHN7ir5JCogKgJ_7BgdsV0di1HhNdPmAPvr4zRJXmtDasgkMS5an2bos&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHWlh69HPSQSGjwCloKe-US9EU8u4JXYHYfOUA8qFNwpQ&oe=6A848DC1",
              "height": 1350,
              "width": 1080
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwH0v6Jl&_nc_oc=AdpRK2_wd31PHN7ir5JCogKgJ_7BgdsV0di1HhNdPmAPvr4zRJXmtDasgkMS5an2bos&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQF_Fm5ivhM_R6_F473vN0xfw6kA9YEeA_mwitqLaiUPog&oe=6A848DC1",
              "height": 900,
              "width": 720
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwH0v6Jl&_nc_oc=AdpRK2_wd31PHN7ir5JCogKgJ_7BgdsV0di1HhNdPmAPvr4zRJXmtDasgkMS5an2bos&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQF0xhnxJ6H10mjoiYCnDMmEZez-ZriPk2tN76MYB5jPbg&oe=6A848DC1",
              "height": 800,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwH0v6Jl&_nc_oc=AdpRK2_wd31PHN7ir5JCogKgJ_7BgdsV0di1HhNdPmAPvr4zRJXmtDasgkMS5an2bos&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEryO5daR3tlry1F7itKIhwfLRHVTXueIOAgDksysYv4A&oe=6A848DC1",
              "height": 600,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwH0v6Jl&_nc_oc=AdpRK2_wd31PHN7ir5JCogKgJ_7BgdsV0di1HhNdPmAPvr4zRJXmtDasgkMS5an2bos&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGcVwQc_SNqEwQIKeQgaD80SWMfALmhYgnNpaSIPCivGg&oe=6A848DC1",
              "height": 400,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwH0v6Jl&_nc_oc=AdpRK2_wd31PHN7ir5JCogKgJ_7BgdsV0di1HhNdPmAPvr4zRJXmtDasgkMS5an2bos&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQExJxWMSu954m582QVL3Th9URLwPWlXTPn2cBnwGJ1Haw&oe=6A848DC1",
              "height": 300,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=c0.256.2048.2048a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwH0v6Jl&_nc_oc=AdpRK2_wd31PHN7ir5JCogKgJ_7BgdsV0di1HhNdPmAPvr4zRJXmtDasgkMS5an2bos&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQH83Zb3X4RjJDGXlRjLp33_HZkmI9QszQjvhEeOFfpNGQ&oe=6A848DC1",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=c0.256.2048.2048a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwH0v6Jl&_nc_oc=AdpRK2_wd31PHN7ir5JCogKgJ_7BgdsV0di1HhNdPmAPvr4zRJXmtDasgkMS5an2bos&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFL7GnS1bawOiqcOpQJAy0cmbHMaDXLoeoYDWj7Z0xlVQ&oe=6A848DC1",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=c0.256.2048.2048a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwH0v6Jl&_nc_oc=AdpRK2_wd31PHN7ir5JCogKgJ_7BgdsV0di1HhNdPmAPvr4zRJXmtDasgkMS5an2bos&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFu2VFm_r8Xu6cHzftXJn6RE9o1UDZxZfeZgNE1oY6M2A&oe=6A848DC1",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=c0.256.2048.2048a_dst-jpg_e35_s480x480_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwH0v6Jl&_nc_oc=AdpRK2_wd31PHN7ir5JCogKgJ_7BgdsV0di1HhNdPmAPvr4zRJXmtDasgkMS5an2bos&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFOJtfq-TPu2bBLncPERYtlK7WYBaYiO6LBxnsBUr7zog&oe=6A848DC1",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=c0.256.2048.2048a_dst-jpg_e35_s320x320_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwH0v6Jl&_nc_oc=AdpRK2_wd31PHN7ir5JCogKgJ_7BgdsV0di1HhNdPmAPvr4zRJXmtDasgkMS5an2bos&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEVz2rB8ZohLaaNEWp28bCpH8bwun102gLVUPiWyNGP0A&oe=6A848DC1",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=c0.256.2048.2048a_dst-jpg_e35_s240x240_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwH0v6Jl&_nc_oc=AdpRK2_wd31PHN7ir5JCogKgJ_7BgdsV0di1HhNdPmAPvr4zRJXmtDasgkMS5an2bos&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHUp6n3WY1llm92IfVUHP6s8H6bHJFIAbvz35bMdeGy7w&oe=6A848DC1",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=c0.256.2048.2048a_dst-jpg_e35_s150x150_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwH0v6Jl&_nc_oc=AdpRK2_wd31PHN7ir5JCogKgJ_7BgdsV0di1HhNdPmAPvr4zRJXmtDasgkMS5an2bos&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEGlNLrVrXN5t98WxWGdGxax3n8F7KbQShdynZKiuUH6Q&oe=6A848DC1",
              "height": 150,
              "width": 150
            }
          ]
        },
        "carousel_parent_id": "3962865174512370672_2237970730",
        "sharing_friction_info": {
          "bloks_app_url": null,
          "should_have_sharing_friction": false
        },
        "preview": null,
        "organic_tracking_token": null,
        "saved_collection_ids": null,
        "has_viewer_saved": null,
        "video_versions": null,
        "media_overlay_info": null,
        "code": null,
        "display_uri": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=c0.256.2048.2048a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=FGpPLN37LN4Q7kNvwFjrZcE&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHyirfWb-oE1f-4LLz2xCivWRju7iTMVHcAfaOX88k0KA&oe=6A848DC1&_nc_sid=7a9f4b",
        "number_of_qualities": null,
        "product_type": "carousel_item",
        "carousel_media": null,
        "taken_at": 1786630363,
        "previous_submitter": null,
        "link": null,
        "story_cta": null,
        "has_liked": null,
        "like_count": null,
        "logging_info_token": null,
        "has_audio": null,
        "clips_metadata": null
      },
      {
        "id": "3962864768985674045_2237970730",
        "pk": "3962864768985674045",
        "accessibility_caption": null,
        "is_dash_eligible": null,
        "video_dash_manifest": null,
        "media_type": 1,
        "original_height": 1351,
        "original_width": 1081,
        "inventory_source": null,
        "user": null,
        "usertags": null,
        "image_versions2": {
          "candidates": [
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773359776_18549779074074731_1818713941597627892_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2ODk4NTY3NDA0NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=AIgLG5dX6ukQ7kNvwFddqzP&_nc_oc=AdqelJqJXeelm6ay7WRwnA2nq8iHZVsRXjbHAi7fE4l6NPYnNGsyMQWfXa67DheEGoI&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEKAbXoVKVx08QR1R8qrkVbA4X-slRgDjIyi7izjFcHoQ&oe=6A8496E6",
              "height": 1351,
              "width": 1081
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773359776_18549779074074731_1818713941597627892_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2ODk4NTY3NDA0NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=AIgLG5dX6ukQ7kNvwFddqzP&_nc_oc=AdqelJqJXeelm6ay7WRwnA2nq8iHZVsRXjbHAi7fE4l6NPYnNGsyMQWfXa67DheEGoI&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFo8WU8tin2wvZ8rUmEKkCDpxG1KlhzW5huJYUjBR2OnA&oe=6A8496E6",
              "height": 900,
              "width": 720
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773359776_18549779074074731_1818713941597627892_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2ODk4NTY3NDA0NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=AIgLG5dX6ukQ7kNvwFddqzP&_nc_oc=AdqelJqJXeelm6ay7WRwnA2nq8iHZVsRXjbHAi7fE4l6NPYnNGsyMQWfXa67DheEGoI&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGlKJeE7Yb2srgC4Na6uFX_UlBKNz9X8xeM0kecCc1bEQ&oe=6A8496E6",
              "height": 800,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773359776_18549779074074731_1818713941597627892_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2ODk4NTY3NDA0NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=AIgLG5dX6ukQ7kNvwFddqzP&_nc_oc=AdqelJqJXeelm6ay7WRwnA2nq8iHZVsRXjbHAi7fE4l6NPYnNGsyMQWfXa67DheEGoI&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEwfXjx7zaVG--8eUv_eT4uU8TMvRqP8lYX_G17odyikw&oe=6A8496E6",
              "height": 600,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773359776_18549779074074731_1818713941597627892_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2ODk4NTY3NDA0NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=AIgLG5dX6ukQ7kNvwFddqzP&_nc_oc=AdqelJqJXeelm6ay7WRwnA2nq8iHZVsRXjbHAi7fE4l6NPYnNGsyMQWfXa67DheEGoI&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGxtbcpFIr1As7QH3S7fcETmRdiOHqCAKy_-puTU_WY_Q&oe=6A8496E6",
              "height": 400,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773359776_18549779074074731_1818713941597627892_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2ODk4NTY3NDA0NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=AIgLG5dX6ukQ7kNvwFddqzP&_nc_oc=AdqelJqJXeelm6ay7WRwnA2nq8iHZVsRXjbHAi7fE4l6NPYnNGsyMQWfXa67DheEGoI&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQF96m3TU2zJSFCub74tkA9lR3vDCHcgrW7lXmsQmJRPhw&oe=6A8496E6",
              "height": 300,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773359776_18549779074074731_1818713941597627892_n.jpg?stp=c0.135.1081.1081a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2ODk4NTY3NDA0NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=AIgLG5dX6ukQ7kNvwFddqzP&_nc_oc=AdqelJqJXeelm6ay7WRwnA2nq8iHZVsRXjbHAi7fE4l6NPYnNGsyMQWfXa67DheEGoI&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFJ-2JzcmZcYA2ThvxhAZeoPq2IiYSstaSGQHWPCV6MIg&oe=6A8496E6",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773359776_18549779074074731_1818713941597627892_n.jpg?stp=c0.135.1081.1081a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2ODk4NTY3NDA0NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=AIgLG5dX6ukQ7kNvwFddqzP&_nc_oc=AdqelJqJXeelm6ay7WRwnA2nq8iHZVsRXjbHAi7fE4l6NPYnNGsyMQWfXa67DheEGoI&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEhvo8Sss5zf-bbZ-Mt0hBmJureAtuI5OcEx8MIZO_EAw&oe=6A8496E6",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773359776_18549779074074731_1818713941597627892_n.jpg?stp=c0.135.1081.1081a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2ODk4NTY3NDA0NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=AIgLG5dX6ukQ7kNvwFddqzP&_nc_oc=AdqelJqJXeelm6ay7WRwnA2nq8iHZVsRXjbHAi7fE4l6NPYnNGsyMQWfXa67DheEGoI&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFEWU50azn22e8t_UrDqfc78S7bD4w3vNYBVIFRDKLNXg&oe=6A8496E6",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773359776_18549779074074731_1818713941597627892_n.jpg?stp=c0.135.1081.1081a_dst-jpg_e35_s480x480_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2ODk4NTY3NDA0NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=AIgLG5dX6ukQ7kNvwFddqzP&_nc_oc=AdqelJqJXeelm6ay7WRwnA2nq8iHZVsRXjbHAi7fE4l6NPYnNGsyMQWfXa67DheEGoI&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFNmqRUDA0-rfdhDDCVTkNMiOJPQwja0HvpPSFg-P1hmw&oe=6A8496E6",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773359776_18549779074074731_1818713941597627892_n.jpg?stp=c0.135.1081.1081a_dst-jpg_e35_s320x320_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2ODk4NTY3NDA0NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=AIgLG5dX6ukQ7kNvwFddqzP&_nc_oc=AdqelJqJXeelm6ay7WRwnA2nq8iHZVsRXjbHAi7fE4l6NPYnNGsyMQWfXa67DheEGoI&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGldhMym5pOYnQMasex4h4tTeCpIAn-eXk0vfCJyJPf8g&oe=6A8496E6",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773359776_18549779074074731_1818713941597627892_n.jpg?stp=c0.135.1081.1081a_dst-jpg_e35_s240x240_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2ODk4NTY3NDA0NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=AIgLG5dX6ukQ7kNvwFddqzP&_nc_oc=AdqelJqJXeelm6ay7WRwnA2nq8iHZVsRXjbHAi7fE4l6NPYnNGsyMQWfXa67DheEGoI&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQF2P7d6AMkFJLtHv9cDcxt5PUOyEYDSNgonHpxmJZoy4A&oe=6A8496E6",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-2.cdninstagram.com/v/t51.82787-15/773359776_18549779074074731_1818713941597627892_n.jpg?stp=c0.135.1081.1081a_dst-jpg_e35_s150x150_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2ODk4NTY3NDA0NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=AIgLG5dX6ukQ7kNvwFddqzP&_nc_oc=AdqelJqJXeelm6ay7WRwnA2nq8iHZVsRXjbHAi7fE4l6NPYnNGsyMQWfXa67DheEGoI&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHo6qDtpWHHdU1zZ2uwoH3jzEuGuSWDahRdQz0v2Dj_2w&oe=6A8496E6",
              "height": 150,
              "width": 150
            }
          ]
        },
        "carousel_parent_id": "3962865174512370672_2237970730",
        "sharing_friction_info": {
          "bloks_app_url": null,
          "should_have_sharing_friction": false
        },
        "preview": null,
        "organic_tracking_token": null,
        "saved_collection_ids": null,
        "has_viewer_saved": null,
        "video_versions": null,
        "media_overlay_info": null,
        "code": null,
        "display_uri": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773359776_18549779074074731_1818713941597627892_n.jpg?stp=c0.135.1081.1081a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=qAQlzaW4fSEQ7kNvwHFhoWw&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGRc1MHqsXGoT6FbUZ_kUx_Babgyq6qlTB3WvTXGx-W7g&oe=6A8496E6&_nc_sid=7a9f4b",
        "number_of_qualities": null,
        "product_type": "carousel_item",
        "carousel_media": null,
        "taken_at": 1786630363,
        "previous_submitter": null,
        "link": null,
        "story_cta": null,
        "has_liked": null,
        "like_count": null,
        "logging_info_token": null,
        "has_audio": null,
        "clips_metadata": null
      },
      {
        "id": "3962864770437025224_2237970730",
        "pk": "3962864770437025224",
        "accessibility_caption": null,
        "is_dash_eligible": null,
        "video_dash_manifest": null,
        "media_type": 1,
        "original_height": 1351,
        "original_width": 1081,
        "inventory_source": null,
        "user": null,
        "usertags": null,
        "image_versions2": {
          "candidates": [
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/773450308_18549779077074731_1935136921061811438_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=103&ig_cache_key=Mzk2Mjg2NDc3MDQzNzAyNTIyNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=vcsD61hPzNMQ7kNvwF80zBc&_nc_oc=AdrW7CgqEknlGtL5OQZa66_SkVaSZGzpJMC8vt8WhvIpos8pFH1M7a16cqdmceCPSHo&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEVjXE1MrtetXT47_sYEKI8p6rvCAB1y6avixJ2BVLH2g&oe=6A848865",
              "height": 1351,
              "width": 1081
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/773450308_18549779077074731_1935136921061811438_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=103&ig_cache_key=Mzk2Mjg2NDc3MDQzNzAyNTIyNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=vcsD61hPzNMQ7kNvwF80zBc&_nc_oc=AdrW7CgqEknlGtL5OQZa66_SkVaSZGzpJMC8vt8WhvIpos8pFH1M7a16cqdmceCPSHo&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEjRkjBA0m9FERf0gac9-pBafOdWPtJwf-gkl1PVxBtdA&oe=6A848865",
              "height": 900,
              "width": 720
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/773450308_18549779077074731_1935136921061811438_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=103&ig_cache_key=Mzk2Mjg2NDc3MDQzNzAyNTIyNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=vcsD61hPzNMQ7kNvwF80zBc&_nc_oc=AdrW7CgqEknlGtL5OQZa66_SkVaSZGzpJMC8vt8WhvIpos8pFH1M7a16cqdmceCPSHo&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHbOmJ3bI_PdCbrJfcuX3hlHogetY_LiSXL7xPV7RGGTg&oe=6A848865",
              "height": 800,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/773450308_18549779077074731_1935136921061811438_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=103&ig_cache_key=Mzk2Mjg2NDc3MDQzNzAyNTIyNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=vcsD61hPzNMQ7kNvwF80zBc&_nc_oc=AdrW7CgqEknlGtL5OQZa66_SkVaSZGzpJMC8vt8WhvIpos8pFH1M7a16cqdmceCPSHo&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHT3PijpYw5iF2l_KsD6UkJGAdHLudFRJL15sn7gvOa3w&oe=6A848865",
              "height": 600,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/773450308_18549779077074731_1935136921061811438_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=103&ig_cache_key=Mzk2Mjg2NDc3MDQzNzAyNTIyNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=vcsD61hPzNMQ7kNvwF80zBc&_nc_oc=AdrW7CgqEknlGtL5OQZa66_SkVaSZGzpJMC8vt8WhvIpos8pFH1M7a16cqdmceCPSHo&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHI4In_WVtLIHXU_gCgk3s2T5tEtkZLdaZr0OaUeM4p4w&oe=6A848865",
              "height": 400,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/773450308_18549779077074731_1935136921061811438_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=103&ig_cache_key=Mzk2Mjg2NDc3MDQzNzAyNTIyNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=vcsD61hPzNMQ7kNvwF80zBc&_nc_oc=AdrW7CgqEknlGtL5OQZa66_SkVaSZGzpJMC8vt8WhvIpos8pFH1M7a16cqdmceCPSHo&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGYywFOm-uVl1LadS18O1A_K295r62H_n6JEvvN-MyeOw&oe=6A848865",
              "height": 300,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/773450308_18549779077074731_1935136921061811438_n.jpg?stp=c0.135.1081.1081a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=103&ig_cache_key=Mzk2Mjg2NDc3MDQzNzAyNTIyNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=vcsD61hPzNMQ7kNvwF80zBc&_nc_oc=AdrW7CgqEknlGtL5OQZa66_SkVaSZGzpJMC8vt8WhvIpos8pFH1M7a16cqdmceCPSHo&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGmxU-3Qe6N-vGWr-HjLmfGCZfR4FvL2Ydc-UIkF_TDRw&oe=6A848865",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/773450308_18549779077074731_1935136921061811438_n.jpg?stp=c0.135.1081.1081a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=103&ig_cache_key=Mzk2Mjg2NDc3MDQzNzAyNTIyNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=vcsD61hPzNMQ7kNvwF80zBc&_nc_oc=AdrW7CgqEknlGtL5OQZa66_SkVaSZGzpJMC8vt8WhvIpos8pFH1M7a16cqdmceCPSHo&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHkDnXE-aJCYv8elQ32FmW-WBbduRh1WTHri3QAcga_DQ&oe=6A848865",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/773450308_18549779077074731_1935136921061811438_n.jpg?stp=c0.135.1081.1081a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=103&ig_cache_key=Mzk2Mjg2NDc3MDQzNzAyNTIyNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=vcsD61hPzNMQ7kNvwF80zBc&_nc_oc=AdrW7CgqEknlGtL5OQZa66_SkVaSZGzpJMC8vt8WhvIpos8pFH1M7a16cqdmceCPSHo&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHvuM3j-YxGzgcfcHY70S6dRHv8OsU1eK2bxYocCoG7wQ&oe=6A848865",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/773450308_18549779077074731_1935136921061811438_n.jpg?stp=c0.135.1081.1081a_dst-jpg_e35_s480x480_tt6&_nc_cat=103&ig_cache_key=Mzk2Mjg2NDc3MDQzNzAyNTIyNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=vcsD61hPzNMQ7kNvwF80zBc&_nc_oc=AdrW7CgqEknlGtL5OQZa66_SkVaSZGzpJMC8vt8WhvIpos8pFH1M7a16cqdmceCPSHo&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQH5JFgV2rE95lUo8mAtzapA4olv56sPm5KMv_YEA1L38A&oe=6A848865",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/773450308_18549779077074731_1935136921061811438_n.jpg?stp=c0.135.1081.1081a_dst-jpg_e35_s320x320_tt6&_nc_cat=103&ig_cache_key=Mzk2Mjg2NDc3MDQzNzAyNTIyNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=vcsD61hPzNMQ7kNvwF80zBc&_nc_oc=AdrW7CgqEknlGtL5OQZa66_SkVaSZGzpJMC8vt8WhvIpos8pFH1M7a16cqdmceCPSHo&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHBtca3aiqpe2wG4rDw6Iw4uJ_zG3ysG-0hA19l4qNJuQ&oe=6A848865",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/773450308_18549779077074731_1935136921061811438_n.jpg?stp=c0.135.1081.1081a_dst-jpg_e35_s240x240_tt6&_nc_cat=103&ig_cache_key=Mzk2Mjg2NDc3MDQzNzAyNTIyNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=vcsD61hPzNMQ7kNvwF80zBc&_nc_oc=AdrW7CgqEknlGtL5OQZa66_SkVaSZGzpJMC8vt8WhvIpos8pFH1M7a16cqdmceCPSHo&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQElLYt-s2ty1sKescIIXWjihPH7P3fxg14zXdPodfQvHQ&oe=6A848865",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/773450308_18549779077074731_1935136921061811438_n.jpg?stp=c0.135.1081.1081a_dst-jpg_e35_s150x150_tt6&_nc_cat=103&ig_cache_key=Mzk2Mjg2NDc3MDQzNzAyNTIyNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=vcsD61hPzNMQ7kNvwF80zBc&_nc_oc=AdrW7CgqEknlGtL5OQZa66_SkVaSZGzpJMC8vt8WhvIpos8pFH1M7a16cqdmceCPSHo&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEro1ZRAUUBHquSa9oopeTIZQCeuDYuFjUYGZgMESt3uQ&oe=6A848865",
              "height": 150,
              "width": 150
            }
          ]
        },
        "carousel_parent_id": "3962865174512370672_2237970730",
        "sharing_friction_info": {
          "bloks_app_url": null,
          "should_have_sharing_friction": false
        },
        "preview": null,
        "organic_tracking_token": null,
        "saved_collection_ids": null,
        "has_viewer_saved": null,
        "video_versions": null,
        "media_overlay_info": null,
        "code": null,
        "display_uri": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773450308_18549779077074731_1935136921061811438_n.jpg?stp=c0.135.1081.1081a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=AiNZnCOGUrEQ7kNvwEvRNmT&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQEvYQjaQ4ABf1JIyBzmiexONTvkKrpp5goOH3nQwuRaUA&oe=6A848865&_nc_sid=7a9f4b",
        "number_of_qualities": null,
        "product_type": "carousel_item",
        "carousel_media": null,
        "taken_at": 1786630363,
        "previous_submitter": null,
        "link": null,
        "story_cta": null,
        "has_liked": null,
        "like_count": null,
        "logging_info_token": null,
        "has_audio": null,
        "clips_metadata": null
      }
    ],
    "coauthor_producers": [],
    "timeline_pinned_user_ids": [],
    "date": "2026-08-13T14:12:43.000Z",
    "crawled_at": "2026-08-14T08:16:43.756Z"
  },
  {
    "id": "3962862498097316445_2237970730",
    "pk": "3962862498097316445",
    "type": "Video",
    "image": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-15/773863104_18549778204074731_6753476794430800343_n.jpg?stp=c0.469.1206.1206a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=-VQ5JFdVgCgQ7kNvwHmex7F&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQEQrRnCukxvs23n-2yYSEPfibEa17Cxpvi5tnUw8E_TRQ&oe=6A84886B&_nc_sid=7a9f4b",
    "shortcode": "Db-6nIkzsJd",
    "product_type": "clips",
    "hashtags": [
      "#pakuwonmalljogja"
    ],
    "mentions": [
      "@juli_iskandar",
      "@vickyratihw",
      "@tanpurnomosidi",
      "@ellewatchindonesia"
    ],
    "location": null,
    "caption": "ELLE WATCH IS NOW AVAILABLE! ✨\n\nTemukan koleksi jam tangan ELLE sekarang di Watch Studio, Pakuwon Mall Jogja! ⌚💖\nTampil stylish, elegan, dan timeless di setiap momen. \n\n📍 Ground Floor, Pakuwon Mall Jogja\n\n#pakuwonmalljogja",
    "comment_count": 0,
    "like_count": 12,
    "view_count": null,
    "has_audio": true,
    "usertags": [
      {
        "user": {
          "pk": "1228374574",
          "full_name": "Juliaty Iskandar",
          "username": "juli_iskandar",
          "profile_pic_url": "https://scontent-atl3-1.cdninstagram.com/v/t51.2885-19/54800477_2189592477793980_624948081216978944_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby45NjAuYzIifQ&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_cat=100&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=Iz2JRul0k6kQ7kNvwGS7iPT&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQEJzXeoF_r3k1OQFfLnoZvNYRAIZVhvsnbDtR49oCuZiQ&oe=6A8492D0&_nc_sid=7a9f4b",
          "is_verified": false,
          "id": "1228374574",
          "aigm_account_label_info": null
        },
        "position": [
          0,
          0
        ]
      },
      {
        "user": {
          "pk": "1581178877",
          "full_name": "Vicky Ratih",
          "username": "vickyratihw",
          "profile_pic_url": "https://scontent-atl3-2.cdninstagram.com/v/t51.2885-19/145976495_717061658996801_8615672779095137678_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby43MjAuYzIifQ&_nc_ht=scontent-atl3-2.cdninstagram.com&_nc_cat=105&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=NEQAeZQ5-dcQ7kNvwFfa8MA&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQFnsqG13qZ3U63vA-xuQub2w2GK9Edai04YBCk9p-WQlA&oe=6A849B1B&_nc_sid=7a9f4b",
          "is_verified": false,
          "id": "1581178877",
          "aigm_account_label_info": null
        },
        "position": [
          0,
          0
        ]
      },
      {
        "user": {
          "pk": "4012187437",
          "full_name": "Tan Purnomosidi",
          "username": "tanpurnomosidi",
          "profile_pic_url": "https://scontent-atl3-1.cdninstagram.com/v/t51.2885-19/122597843_342367900160616_7189706853388346855_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_cat=100&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=z4pokypaePIQ7kNvwFjTJOH&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQE46a-M6IKcKYiyb_OYTo02hA-2QgxBMpxQi7A6G8Gdvg&oe=6A849E78&_nc_sid=7a9f4b",
          "is_verified": true,
          "id": "4012187437",
          "aigm_account_label_info": null
        },
        "position": [
          0,
          0
        ]
      },
      {
        "user": {
          "pk": "18870279538",
          "full_name": "ELLE Watch Indonesia",
          "username": "ellewatchindonesia",
          "profile_pic_url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-19/728833598_18119358160631539_7399830227988371889_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4zMjAuYzIifQ&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=107&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=kvTWyc8VRAsQ7kNvwFYAU5U&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGGgK5Jzm0iSp3nJIXySPBi-WHWwVAb-ao_P4teX6BJZQ&oe=6A8487BC&_nc_sid=7a9f4b",
          "is_verified": false,
          "id": "18870279538",
          "aigm_account_label_info": null
        },
        "position": [
          0.0653594807,
          0.016339870200000002
        ]
      }
    ],
    "clips_metadata": {
      "audio_type": "licensed_music",
      "achievements_info": {
        "show_achievements": false
      },
      "music_info": {
        "music_consumption_info": {
          "should_mute_audio": false,
          "should_mute_audio_reason": "",
          "is_trending_in_clips": false,
          "audio_filter_infos": []
        },
        "music_asset_info": {
          "audio_cluster_id": "2517064202142191",
          "title": "Infinite Reflections",
          "display_artist": "Mia Donnelly",
          "is_explicit": false,
          "cover_artwork_thumbnail_uri": "https://scontent-atl3-1.xx.fbcdn.net/v/t39.30808-6/771956285_71061393640494_4663288867027829485_n.jpg?stp=dst-jpg_s168x128_tt6&_nc_cat=103&ccb=1-7&_nc_sid=2f2557&_nc_ohc=PyQjV1sqNRgQ7kNvwGqWCV5&_nc_oc=AdrUeF10F-mzNvBQyZOlQl7gxTNVbpGW0OkLUWfkMEp-pfiiONNCqYZqtboBubWnLuY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.xx&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a20f&oh=00_AQHesR5Fgx1E_B6pLyws2UK_t_kAoeqADLKgmQNtiuldwg&oe=6A84AB54"
        }
      },
      "original_sound_info": null,
      "originality_info": null,
      "is_shared_to_fb": false
    },
    "from_url": "https://www.instagram.com/pakuwonmall.jogja/",
    "post_url": "https://www.instagram.com/p/Db-6nIkzsJd/",
    "video_duration": 21.5,
    "user": {
      "pk": "2237970730",
      "profile_pic_url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=L9VCN6COaTMQ7kNvwHOtFy0&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQEM_oL-JrA3TqdAkw0HaavzLRi54AM8nCTvpERnqwDeWQ&oe=6A84A633&_nc_sid=7a9f4b",
      "username": "pakuwonmall.jogja",
      "is_private": false,
      "is_embeds_disabled": false,
      "is_unpublished": false,
      "is_verified": true,
      "friendship_status": null,
      "latest_besties_reel_media": null,
      "latest_reel_media": null,
      "live_broadcast_visibility": null,
      "live_broadcast_id": null,
      "show_account_transparency_details": true,
      "transparency_product": null,
      "transparency_product_enabled": false,
      "transparency_label": null,
      "ai_agent_owner_username": null,
      "id": "2237970730",
      "aigm_account_label_info": null,
      "hd_profile_pic_url_info": {
        "url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=L9VCN6COaTMQ7kNvwHOtFy0&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGSwOGkAaLzHNq-6Ef-eLq1M-C4wS7L_s0lWwJa9u0Lnw&oe=6A84A633&_nc_sid=7a9f4b"
      },
      "__typename": "XDTUserDict",
      "full_name": "Pakuwon Mall Jogja"
    },
    "images": [
      {
        "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/773863104_18549778204074731_6753476794430800343_n.jpg?stp=dst-jpg_e15_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2MjQ5ODA5NzMxNjQ0NTE4NTQ5Nzc4MTk4MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=zRvBXCq30VsQ7kNvwEUMIhT&_nc_oc=AdqSaY1prLAAmDgXWNpKOMJGSOO5Xe-F4hyXQApYdAvBZnPd0ZIxGoOcxIu2YgDbBa0&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFK_hjx458lZwEtbKQuNBroc8d1E4uzRb0UzHHvZQJcZg&oe=6A84886B",
        "height": 2144,
        "width": 1206
      },
      {
        "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/773863104_18549778204074731_6753476794430800343_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2MjQ5ODA5NzMxNjQ0NTE4NTQ5Nzc4MTk4MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=zRvBXCq30VsQ7kNvwEUMIhT&_nc_oc=AdqSaY1prLAAmDgXWNpKOMJGSOO5Xe-F4hyXQApYdAvBZnPd0ZIxGoOcxIu2YgDbBa0&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHi2JmzO0CbK1tq4lt9EveHjMhXLwCQ7yEZWKgdeygBXg&oe=6A84886B",
        "height": 1920,
        "width": 1080
      },
      {
        "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/773863104_18549778204074731_6753476794430800343_n.jpg?stp=dst-jpg_e35_p720x720_sh2.08_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2MjQ5ODA5NzMxNjQ0NTE4NTQ5Nzc4MTk4MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=zRvBXCq30VsQ7kNvwEUMIhT&_nc_oc=AdqSaY1prLAAmDgXWNpKOMJGSOO5Xe-F4hyXQApYdAvBZnPd0ZIxGoOcxIu2YgDbBa0&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQH49SZ_22_sLWtWZdvQxfiAcC0Axf-jz6Dwwo88Jph2gg&oe=6A84886B",
        "height": 1280,
        "width": 720
      },
      {
        "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/773863104_18549778204074731_6753476794430800343_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2MjQ5ODA5NzMxNjQ0NTE4NTQ5Nzc4MTk4MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=zRvBXCq30VsQ7kNvwEUMIhT&_nc_oc=AdqSaY1prLAAmDgXWNpKOMJGSOO5Xe-F4hyXQApYdAvBZnPd0ZIxGoOcxIu2YgDbBa0&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGPHHh-cvNlz-z3bXETVckZtSAJLX-ywjcslt3bStj0xQ&oe=6A84886B",
        "height": 1138,
        "width": 640
      },
      {
        "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/773863104_18549778204074731_6753476794430800343_n.jpg?stp=dst-jpg_e15_p480x480_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2MjQ5ODA5NzMxNjQ0NTE4NTQ5Nzc4MTk4MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=zRvBXCq30VsQ7kNvwEUMIhT&_nc_oc=AdqSaY1prLAAmDgXWNpKOMJGSOO5Xe-F4hyXQApYdAvBZnPd0ZIxGoOcxIu2YgDbBa0&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFLaMX8GEjA7C4EBaDROnq-yHM5WCKB5fjKfHdAco65BA&oe=6A84886B",
        "height": 853,
        "width": 480
      },
      {
        "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/773863104_18549778204074731_6753476794430800343_n.jpg?stp=dst-jpg_e15_p320x320_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2MjQ5ODA5NzMxNjQ0NTE4NTQ5Nzc4MTk4MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=zRvBXCq30VsQ7kNvwEUMIhT&_nc_oc=AdqSaY1prLAAmDgXWNpKOMJGSOO5Xe-F4hyXQApYdAvBZnPd0ZIxGoOcxIu2YgDbBa0&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQF-T5PytrYF5rkVG2GLLr7Fja3VixmDtnsP1LHj8jbfQA&oe=6A84886B",
        "height": 569,
        "width": 320
      },
      {
        "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/773863104_18549778204074731_6753476794430800343_n.jpg?stp=dst-jpg_e15_p240x240_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2MjQ5ODA5NzMxNjQ0NTE4NTQ5Nzc4MTk4MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=zRvBXCq30VsQ7kNvwEUMIhT&_nc_oc=AdqSaY1prLAAmDgXWNpKOMJGSOO5Xe-F4hyXQApYdAvBZnPd0ZIxGoOcxIu2YgDbBa0&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQHNpeC-LBVyjA0PgP9v_objf0IHTBroRWYZhSynDtNC-w&oe=6A84886B",
        "height": 427,
        "width": 240
      },
      {
        "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/773863104_18549778204074731_6753476794430800343_n.jpg?stp=c0.469.1206.1206a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2MjQ5ODA5NzMxNjQ0NTE4NTQ5Nzc4MTk4MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=zRvBXCq30VsQ7kNvwEUMIhT&_nc_oc=AdqSaY1prLAAmDgXWNpKOMJGSOO5Xe-F4hyXQApYdAvBZnPd0ZIxGoOcxIu2YgDbBa0&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGuTTu4Jilah6FQHyWlhDsEdZ3_A8aX5RFqcY23Wi7mpg&oe=6A84886B",
        "height": 1080,
        "width": 1080
      },
      {
        "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/773863104_18549778204074731_6753476794430800343_n.jpg?stp=c0.469.1206.1206a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2MjQ5ODA5NzMxNjQ0NTE4NTQ5Nzc4MTk4MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=zRvBXCq30VsQ7kNvwEUMIhT&_nc_oc=AdqSaY1prLAAmDgXWNpKOMJGSOO5Xe-F4hyXQApYdAvBZnPd0ZIxGoOcxIu2YgDbBa0&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQFZ-0esyY9EXZG_nkY8p8o3CWNCoCPBF8aQ_Gj211lnbA&oe=6A84886B",
        "height": 750,
        "width": 750
      },
      {
        "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/773863104_18549778204074731_6753476794430800343_n.jpg?stp=c0.469.1206.1206a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2MjQ5ODA5NzMxNjQ0NTE4NTQ5Nzc4MTk4MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=zRvBXCq30VsQ7kNvwEUMIhT&_nc_oc=AdqSaY1prLAAmDgXWNpKOMJGSOO5Xe-F4hyXQApYdAvBZnPd0ZIxGoOcxIu2YgDbBa0&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGDV2yW9NULO-__3DlkN_VwvyvhmdeYOK-9_xL_8Lhz5A&oe=6A84886B",
        "height": 640,
        "width": 640
      },
      {
        "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/773863104_18549778204074731_6753476794430800343_n.jpg?stp=c0.469.1206.1206a_dst-jpg_e15_s480x480_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2MjQ5ODA5NzMxNjQ0NTE4NTQ5Nzc4MTk4MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=zRvBXCq30VsQ7kNvwEUMIhT&_nc_oc=AdqSaY1prLAAmDgXWNpKOMJGSOO5Xe-F4hyXQApYdAvBZnPd0ZIxGoOcxIu2YgDbBa0&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQGUB8eI7I-aF0hsKkWTFjg16m8qz6ObEjPnIgHOk1_--A&oe=6A84886B",
        "height": 480,
        "width": 480
      },
      {
        "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/773863104_18549778204074731_6753476794430800343_n.jpg?stp=c0.469.1206.1206a_dst-jpg_e15_s320x320_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2MjQ5ODA5NzMxNjQ0NTE4NTQ5Nzc4MTk4MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=zRvBXCq30VsQ7kNvwEUMIhT&_nc_oc=AdqSaY1prLAAmDgXWNpKOMJGSOO5Xe-F4hyXQApYdAvBZnPd0ZIxGoOcxIu2YgDbBa0&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEj_SderPqR-_cnBHkTuZNC143u3aSogK-Nl1u2NNu7wg&oe=6A84886B",
        "height": 320,
        "width": 320
      },
      {
        "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/773863104_18549778204074731_6753476794430800343_n.jpg?stp=c0.469.1206.1206a_dst-jpg_e15_s240x240_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2MjQ5ODA5NzMxNjQ0NTE4NTQ5Nzc4MTk4MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=zRvBXCq30VsQ7kNvwEUMIhT&_nc_oc=AdqSaY1prLAAmDgXWNpKOMJGSOO5Xe-F4hyXQApYdAvBZnPd0ZIxGoOcxIu2YgDbBa0&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQE4mL-nyUg_ppVkf3N8YaWE54xorQ0UXPSuSUDBKaJh2A&oe=6A84886B",
        "height": 240,
        "width": 240
      },
      {
        "url": "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-15/773863104_18549778204074731_6753476794430800343_n.jpg?stp=c0.469.1206.1206a_dst-jpg_e15_s150x150_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2MjQ5ODA5NzMxNjQ0NTE4NTQ5Nzc4MTk4MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=zRvBXCq30VsQ7kNvwEUMIhT&_nc_oc=AdqSaY1prLAAmDgXWNpKOMJGSOO5Xe-F4hyXQApYdAvBZnPd0ZIxGoOcxIu2YgDbBa0&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&oh=00_AQEnMpq2GY65vMLPROKpUBMaMvnkXALt_RmCulYrOXCSaA&oe=6A84886B",
        "height": 150,
        "width": 150
      }
    ],
    "video_versions": [
      {
        "width": 720,
        "height": 1280,
        "url": "https://scontent-atl3-1.cdninstagram.com/o1/v/t2/f2/m86/AQPxSh7VvKkX1upeIUsUcOqx1cOrBbDZgdgUmrWWwc9aWGQijquX5p1Xy4KVTZpuZVGK29pU60_nZQfdq0w84Pg4P6aJt1pI-e07Tpk.mp4?_nc_cat=103&_nc_sid=5e9851&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_ohc=Du2ez4r2alIQ7kNvwHyRfqy&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTc1MzQwNDEwMjQ2Mzg5NSwiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjoyMSwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=da7e036ff4ca17a5&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC8wMjRFOERENEIzODgzNzc1QTNDOTA1ODhBMjk0QTBCN192aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyL0YzNDFFQzQwN0Q2MDlCRTdFOEU3MUY3OUQwOTUwNTgyX2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACauxubKxq2dBhUCKAJDMywXQDWAAAAAAAAYEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&_nc_zt=28&oh=00_AQG8X-_yCyKFDYR0kx2JvyMafuub4IzwRRf_8Pr-3_UXuQ&oe=6A80B960",
        "type": 101
      },
      {
        "width": 720,
        "height": 1280,
        "url": "https://scontent-atl3-1.cdninstagram.com/o1/v/t2/f2/m86/AQPxSh7VvKkX1upeIUsUcOqx1cOrBbDZgdgUmrWWwc9aWGQijquX5p1Xy4KVTZpuZVGK29pU60_nZQfdq0w84Pg4P6aJt1pI-e07Tpk.mp4?_nc_cat=103&_nc_sid=5e9851&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_ohc=Du2ez4r2alIQ7kNvwHyRfqy&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTc1MzQwNDEwMjQ2Mzg5NSwiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjoyMSwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=da7e036ff4ca17a5&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC8wMjRFOERENEIzODgzNzc1QTNDOTA1ODhBMjk0QTBCN192aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyL0YzNDFFQzQwN0Q2MDlCRTdFOEU3MUY3OUQwOTUwNTgyX2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACauxubKxq2dBhUCKAJDMywXQDWAAAAAAAAYEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&_nc_zt=28&oh=00_AQG8X-_yCyKFDYR0kx2JvyMafuub4IzwRRf_8Pr-3_UXuQ&oe=6A80B960",
        "type": 102
      },
      {
        "width": 720,
        "height": 1280,
        "url": "https://scontent-atl3-1.cdninstagram.com/o1/v/t2/f2/m86/AQPxSh7VvKkX1upeIUsUcOqx1cOrBbDZgdgUmrWWwc9aWGQijquX5p1Xy4KVTZpuZVGK29pU60_nZQfdq0w84Pg4P6aJt1pI-e07Tpk.mp4?_nc_cat=103&_nc_sid=5e9851&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_ohc=Du2ez4r2alIQ7kNvwHyRfqy&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTc1MzQwNDEwMjQ2Mzg5NSwiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjoyMSwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=da7e036ff4ca17a5&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC8wMjRFOERENEIzODgzNzc1QTNDOTA1ODhBMjk0QTBCN192aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyL0YzNDFFQzQwN0Q2MDlCRTdFOEU3MUY3OUQwOTUwNTgyX2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACauxubKxq2dBhUCKAJDMywXQDWAAAAAAAAYEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&_nc_ss=7a22e&_nc_zt=28&oh=00_AQG8X-_yCyKFDYR0kx2JvyMafuub4IzwRRf_8Pr-3_UXuQ&oe=6A80B960",
        "type": 103
      }
    ],
    "carousel_media_count": null,
    "carousel_media": null,
    "coauthor_producers": [
      {
        "pk": "18870279538",
        "profile_pic_url": "https://scontent-atl3-3.cdninstagram.com/v/t51.82787-19/728833598_18119358160631539_7399830227988371889_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4zMjAuYzIifQ&_nc_ht=scontent-atl3-3.cdninstagram.com&_nc_cat=107&_nc_oc=Q6cZ2gEhBdN_5WmO2S-ukDOV_C4Hcq1Y2vmlZERnI3k1GFNzfhYdGy0jnFgbjf5YZrLTa3s&_nc_ohc=kvTWyc8VRAsQ7kNvwFYAU5U&_nc_gid=FzbwtlfbeqD6bOhgE8OIxA&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGGgK5Jzm0iSp3nJIXySPBi-WHWwVAb-ao_P4teX6BJZQ&oe=6A8487BC&_nc_sid=7a9f4b",
        "is_unpublished": null,
        "username": "ellewatchindonesia",
        "is_verified": false,
        "id": "18870279538",
        "aigm_account_label_info": null,
        "__typename": "XDTUserDict",
        "full_name": "ELLE Watch Indonesia",
        "friendship_status": null,
        "supervision_info": null
      }
    ],
    "timeline_pinned_user_ids": [],
    "date": "2026-08-13T14:08:13.000Z",
    "crawled_at": "2026-08-14T08:16:43.757Z"
  }
]
```
