# Task 1c — Run 10: instagram-scraper/fast-instagram-post-scraper — Scenario A (baseline)

Part of [3-4d-per-use-case-actor-selection-and-sync-path-timeout.md](../3-4d-per-use-case-actor-selection-and-sync-path-timeout.md) Task 1c. Expected: ≥10 items. Check any returned item's timestamp against the 3 known pinned timestamps (`2026-08-01T03:58:43Z`, `2026-08-04T05:21:00Z`, `2026-08-04T14:07:36Z`) — no `isPinned` field here either.

**Input params:** `{"instagramUsernames": ["pakuwonmall.jogja"], "postsPerProfile": 15, "recent": "2026-08-10", "retries": 3}`

* **Date/Time:** 2026-08-14 15:14:43
* **Run ID:** [tfLceNBkCXGAxtOg2](https://console.apify.com/actors/Gv87i5PtUqPlLcM2W/runs/tfLceNBkCXGAxtOg2#output)
* **Duration:** 8 s

- Cost ($):
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
    "image": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=5arN_J-sk_AQ7kNvwGT81GH&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHmNi6IFn5Cmd7G5hM-KffHaEBBIXpI0fKjYJDmZ_BPrQ&oe=6A84A079&_nc_sid=7a9f4b",
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
      "profile_pic_url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=L9VCN6COaTMQ7kNvwEtchDb&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGtAYN3nq3QGfxuCkn1E-5A4KCex9UNKdqu4rb5CDdvxA&oe=6A84A633&_nc_sid=7a9f4b",
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
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=L9VCN6COaTMQ7kNvwEtchDb&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHlusG19xf_r4IJPwxyrxIMODZbnUgAD9M5lUitKOejtQ&oe=6A84A633&_nc_sid=7a9f4b"
      },
      "__typename": "XDTUserDict",
      "full_name": "Pakuwon Mall Jogja"
    },
    "images": [
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwGEwAYM&_nc_oc=AdoGFh1cZEXi-A1t-HJG09lZLTUFC4-bzLVZrwAxz5dUvtg6k9zD28QC4cb0w1WvwVc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEcOs8_mGb2Co1KjBQGsJ36vfdRG1Zf7lLL1NBPL2hbFg&oe=6A84A079",
        "height": 1472,
        "width": 1179
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwGEwAYM&_nc_oc=AdoGFh1cZEXi-A1t-HJG09lZLTUFC4-bzLVZrwAxz5dUvtg6k9zD28QC4cb0w1WvwVc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQG_0L7JqD094pM18ey7QxXMXoYG-iJLJ5xfepFYnTba4w&oe=6A84A079",
        "height": 899,
        "width": 720
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwGEwAYM&_nc_oc=AdoGFh1cZEXi-A1t-HJG09lZLTUFC4-bzLVZrwAxz5dUvtg6k9zD28QC4cb0w1WvwVc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHjomeQ4baLXn5eOT5WKEoiRurtUR7zxg22_ny3Y0C9Qw&oe=6A84A079",
        "height": 799,
        "width": 640
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwGEwAYM&_nc_oc=AdoGFh1cZEXi-A1t-HJG09lZLTUFC4-bzLVZrwAxz5dUvtg6k9zD28QC4cb0w1WvwVc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFs0ANNiS9MEfr4iyzVCeg8gcTiAhfOnF4QSV0iDna2uA&oe=6A84A079",
        "height": 599,
        "width": 480
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwGEwAYM&_nc_oc=AdoGFh1cZEXi-A1t-HJG09lZLTUFC4-bzLVZrwAxz5dUvtg6k9zD28QC4cb0w1WvwVc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFCFQoFzyv8M2-84rtGXVolDiBJBgHFmEMShHCeBn5XJg&oe=6A84A079",
        "height": 400,
        "width": 320
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwGEwAYM&_nc_oc=AdoGFh1cZEXi-A1t-HJG09lZLTUFC4-bzLVZrwAxz5dUvtg6k9zD28QC4cb0w1WvwVc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEwg6Ly03TQISipB3kx1_s71RbX-8fE4AZ0aDMsXNG_Pw&oe=6A84A079",
        "height": 300,
        "width": 240
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwGEwAYM&_nc_oc=AdoGFh1cZEXi-A1t-HJG09lZLTUFC4-bzLVZrwAxz5dUvtg6k9zD28QC4cb0w1WvwVc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEaJwmTSYaGA69SCmd7irUlcDre57pX_K8C3u3bao1aVQ&oe=6A84A079",
        "height": 1080,
        "width": 1080
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwGEwAYM&_nc_oc=AdoGFh1cZEXi-A1t-HJG09lZLTUFC4-bzLVZrwAxz5dUvtg6k9zD28QC4cb0w1WvwVc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGL0pWPN0QzcTc6QpSJx9uq74xeA_Hr5hzLgLreD61wlA&oe=6A84A079",
        "height": 750,
        "width": 750
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwGEwAYM&_nc_oc=AdoGFh1cZEXi-A1t-HJG09lZLTUFC4-bzLVZrwAxz5dUvtg6k9zD28QC4cb0w1WvwVc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEQ36YA0FmCl5BFx5GdP8io3fW0CJIdfbMzGgOyfqcKeA&oe=6A84A079",
        "height": 640,
        "width": 640
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s480x480_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwGEwAYM&_nc_oc=AdoGFh1cZEXi-A1t-HJG09lZLTUFC4-bzLVZrwAxz5dUvtg6k9zD28QC4cb0w1WvwVc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHjs4by8V9BfnEMX-R3uI_hYk8oLRn0FYZscYPc7ujadw&oe=6A84A079",
        "height": 480,
        "width": 480
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s320x320_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwGEwAYM&_nc_oc=AdoGFh1cZEXi-A1t-HJG09lZLTUFC4-bzLVZrwAxz5dUvtg6k9zD28QC4cb0w1WvwVc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQE-MEFMMtRrUDgYGsdVSgVIBEkbJxcaJriT-YcKWCjRrQ&oe=6A84A079",
        "height": 320,
        "width": 320
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s240x240_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwGEwAYM&_nc_oc=AdoGFh1cZEXi-A1t-HJG09lZLTUFC4-bzLVZrwAxz5dUvtg6k9zD28QC4cb0w1WvwVc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHYiuZkTcq5Z9zwAW1eqcBIMAvA4g8aXDLVMkx6x4TgVw&oe=6A84A079",
        "height": 240,
        "width": 240
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s150x150_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwGEwAYM&_nc_oc=AdoGFh1cZEXi-A1t-HJG09lZLTUFC4-bzLVZrwAxz5dUvtg6k9zD28QC4cb0w1WvwVc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGkWIm-b7hr6WqZ__0oUMilK-8i4b8CGWQkzs7PZBNpfQ&oe=6A84A079",
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
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwGEwAYM&_nc_oc=AdoGFh1cZEXi-A1t-HJG09lZLTUFC4-bzLVZrwAxz5dUvtg6k9zD28QC4cb0w1WvwVc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEcOs8_mGb2Co1KjBQGsJ36vfdRG1Zf7lLL1NBPL2hbFg&oe=6A84A079",
              "height": 1472,
              "width": 1179
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwGEwAYM&_nc_oc=AdoGFh1cZEXi-A1t-HJG09lZLTUFC4-bzLVZrwAxz5dUvtg6k9zD28QC4cb0w1WvwVc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQG_0L7JqD094pM18ey7QxXMXoYG-iJLJ5xfepFYnTba4w&oe=6A84A079",
              "height": 899,
              "width": 720
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwGEwAYM&_nc_oc=AdoGFh1cZEXi-A1t-HJG09lZLTUFC4-bzLVZrwAxz5dUvtg6k9zD28QC4cb0w1WvwVc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHjomeQ4baLXn5eOT5WKEoiRurtUR7zxg22_ny3Y0C9Qw&oe=6A84A079",
              "height": 799,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwGEwAYM&_nc_oc=AdoGFh1cZEXi-A1t-HJG09lZLTUFC4-bzLVZrwAxz5dUvtg6k9zD28QC4cb0w1WvwVc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFs0ANNiS9MEfr4iyzVCeg8gcTiAhfOnF4QSV0iDna2uA&oe=6A84A079",
              "height": 599,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwGEwAYM&_nc_oc=AdoGFh1cZEXi-A1t-HJG09lZLTUFC4-bzLVZrwAxz5dUvtg6k9zD28QC4cb0w1WvwVc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFCFQoFzyv8M2-84rtGXVolDiBJBgHFmEMShHCeBn5XJg&oe=6A84A079",
              "height": 400,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwGEwAYM&_nc_oc=AdoGFh1cZEXi-A1t-HJG09lZLTUFC4-bzLVZrwAxz5dUvtg6k9zD28QC4cb0w1WvwVc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEwg6Ly03TQISipB3kx1_s71RbX-8fE4AZ0aDMsXNG_Pw&oe=6A84A079",
              "height": 300,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwGEwAYM&_nc_oc=AdoGFh1cZEXi-A1t-HJG09lZLTUFC4-bzLVZrwAxz5dUvtg6k9zD28QC4cb0w1WvwVc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEaJwmTSYaGA69SCmd7irUlcDre57pX_K8C3u3bao1aVQ&oe=6A84A079",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwGEwAYM&_nc_oc=AdoGFh1cZEXi-A1t-HJG09lZLTUFC4-bzLVZrwAxz5dUvtg6k9zD28QC4cb0w1WvwVc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGL0pWPN0QzcTc6QpSJx9uq74xeA_Hr5hzLgLreD61wlA&oe=6A84A079",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwGEwAYM&_nc_oc=AdoGFh1cZEXi-A1t-HJG09lZLTUFC4-bzLVZrwAxz5dUvtg6k9zD28QC4cb0w1WvwVc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEQ36YA0FmCl5BFx5GdP8io3fW0CJIdfbMzGgOyfqcKeA&oe=6A84A079",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s480x480_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwGEwAYM&_nc_oc=AdoGFh1cZEXi-A1t-HJG09lZLTUFC4-bzLVZrwAxz5dUvtg6k9zD28QC4cb0w1WvwVc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHjs4by8V9BfnEMX-R3uI_hYk8oLRn0FYZscYPc7ujadw&oe=6A84A079",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s320x320_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwGEwAYM&_nc_oc=AdoGFh1cZEXi-A1t-HJG09lZLTUFC4-bzLVZrwAxz5dUvtg6k9zD28QC4cb0w1WvwVc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQE-MEFMMtRrUDgYGsdVSgVIBEkbJxcaJriT-YcKWCjRrQ&oe=6A84A079",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s240x240_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwGEwAYM&_nc_oc=AdoGFh1cZEXi-A1t-HJG09lZLTUFC4-bzLVZrwAxz5dUvtg6k9zD28QC4cb0w1WvwVc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHYiuZkTcq5Z9zwAW1eqcBIMAvA4g8aXDLVMkx6x4TgVw&oe=6A84A079",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s150x150_tt6&_nc_cat=109&ig_cache_key=Mzk2MzM5OTM1OTM4NzA5OTkyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=NORQgDBz2gwQ7kNvwGEwAYM&_nc_oc=AdoGFh1cZEXi-A1t-HJG09lZLTUFC4-bzLVZrwAxz5dUvtg6k9zD28QC4cb0w1WvwVc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGkWIm-b7hr6WqZ__0oUMilK-8i4b8CGWQkzs7PZBNpfQ&oe=6A84A079",
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
        "display_uri": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774105447_18549990862074731_3759248133167476863_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=5arN_J-sk_AQ7kNvwGT81GH&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHmNi6IFn5Cmd7G5hM-KffHaEBBIXpI0fKjYJDmZ_BPrQ&oe=6A84A079&_nc_sid=7a9f4b",
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
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773677339_18549990886074731_8172470030301429879_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5OTM2NTQ0MzU2Nzg3OA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=rQ3qJwMO5EAQ7kNvwFJYyVy&_nc_oc=Adqr_NH0iGDWfAdeTTDARyKU9FpkOMoavqw6K--au6XQjxEWD_f4LznohMnZQAeFvTE&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGYXQ1FDV7J9JH8KgzBl9RZc4Rb3Chjw4ErpJfoR_BsSA&oe=6A849BF1",
              "height": 1598,
              "width": 1280
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773677339_18549990886074731_8172470030301429879_n.jpg?stp=dst-jpg_e35_p1080x1080_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5OTM2NTQ0MzU2Nzg3OA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=rQ3qJwMO5EAQ7kNvwFJYyVy&_nc_oc=Adqr_NH0iGDWfAdeTTDARyKU9FpkOMoavqw6K--au6XQjxEWD_f4LznohMnZQAeFvTE&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQH1zwIxDRDcbbYX0Fu0J1wMVsrYPe8B-vjF2XIcnqcprg&oe=6A849BF1",
              "height": 1348,
              "width": 1080
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773677339_18549990886074731_8172470030301429879_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5OTM2NTQ0MzU2Nzg3OA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=rQ3qJwMO5EAQ7kNvwFJYyVy&_nc_oc=Adqr_NH0iGDWfAdeTTDARyKU9FpkOMoavqw6K--au6XQjxEWD_f4LznohMnZQAeFvTE&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQH31sSsdAuC0nSsA-4ikhVHbM_G8iAvFeh01cwFL-WUeA&oe=6A849BF1",
              "height": 899,
              "width": 720
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773677339_18549990886074731_8172470030301429879_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5OTM2NTQ0MzU2Nzg3OA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=rQ3qJwMO5EAQ7kNvwFJYyVy&_nc_oc=Adqr_NH0iGDWfAdeTTDARyKU9FpkOMoavqw6K--au6XQjxEWD_f4LznohMnZQAeFvTE&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGCD_tvwAExKOrmxxUIwjTraY9RBqKvwAZFwg7_Gh3Rtg&oe=6A849BF1",
              "height": 799,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773677339_18549990886074731_8172470030301429879_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5OTM2NTQ0MzU2Nzg3OA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=rQ3qJwMO5EAQ7kNvwFJYyVy&_nc_oc=Adqr_NH0iGDWfAdeTTDARyKU9FpkOMoavqw6K--au6XQjxEWD_f4LznohMnZQAeFvTE&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEKlK6IWd0ti6Pj51cB-g70gDIMAjmQs13pl2dTDx2-9A&oe=6A849BF1",
              "height": 599,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773677339_18549990886074731_8172470030301429879_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5OTM2NTQ0MzU2Nzg3OA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=rQ3qJwMO5EAQ7kNvwFJYyVy&_nc_oc=Adqr_NH0iGDWfAdeTTDARyKU9FpkOMoavqw6K--au6XQjxEWD_f4LznohMnZQAeFvTE&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHGr8qt9Thk1dPLBZYbb1-gRdtthOoFIm0YeK09cYjpFw&oe=6A849BF1",
              "height": 400,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773677339_18549990886074731_8172470030301429879_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5OTM2NTQ0MzU2Nzg3OA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=rQ3qJwMO5EAQ7kNvwFJYyVy&_nc_oc=Adqr_NH0iGDWfAdeTTDARyKU9FpkOMoavqw6K--au6XQjxEWD_f4LznohMnZQAeFvTE&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQF6F59CBP1Oln2TYpZPRjRTu1G19-mqyoEG9OX8Nmh9Sw&oe=6A849BF1",
              "height": 300,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773677339_18549990886074731_8172470030301429879_n.jpg?stp=c0.159.1280.1280a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5OTM2NTQ0MzU2Nzg3OA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=rQ3qJwMO5EAQ7kNvwFJYyVy&_nc_oc=Adqr_NH0iGDWfAdeTTDARyKU9FpkOMoavqw6K--au6XQjxEWD_f4LznohMnZQAeFvTE&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFtwVI2T-JIh7x4_GCbSfDCHZ6P4cg01lFpTJUvLbjX8w&oe=6A849BF1",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773677339_18549990886074731_8172470030301429879_n.jpg?stp=c0.159.1280.1280a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5OTM2NTQ0MzU2Nzg3OA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=rQ3qJwMO5EAQ7kNvwFJYyVy&_nc_oc=Adqr_NH0iGDWfAdeTTDARyKU9FpkOMoavqw6K--au6XQjxEWD_f4LznohMnZQAeFvTE&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHwlQGvfa1BT-EFqUK96mkUBFs1_IENltAVwraiszJT3w&oe=6A849BF1",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773677339_18549990886074731_8172470030301429879_n.jpg?stp=c0.159.1280.1280a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5OTM2NTQ0MzU2Nzg3OA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=rQ3qJwMO5EAQ7kNvwFJYyVy&_nc_oc=Adqr_NH0iGDWfAdeTTDARyKU9FpkOMoavqw6K--au6XQjxEWD_f4LznohMnZQAeFvTE&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGKBKlEC-Yca3_lSYsDhmhwluivsJXXJxOBeWyISjYgQg&oe=6A849BF1",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773677339_18549990886074731_8172470030301429879_n.jpg?stp=c0.159.1280.1280a_dst-jpg_e35_s480x480_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5OTM2NTQ0MzU2Nzg3OA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=rQ3qJwMO5EAQ7kNvwFJYyVy&_nc_oc=Adqr_NH0iGDWfAdeTTDARyKU9FpkOMoavqw6K--au6XQjxEWD_f4LznohMnZQAeFvTE&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFgnATQyHfWdZwtfuskuCWX1lr93R0TI8_GCWMpb3p4CQ&oe=6A849BF1",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773677339_18549990886074731_8172470030301429879_n.jpg?stp=c0.159.1280.1280a_dst-jpg_e35_s320x320_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5OTM2NTQ0MzU2Nzg3OA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=rQ3qJwMO5EAQ7kNvwFJYyVy&_nc_oc=Adqr_NH0iGDWfAdeTTDARyKU9FpkOMoavqw6K--au6XQjxEWD_f4LznohMnZQAeFvTE&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHQ71OE3zphe7neeqn_4yo2qT6-pjeqs9AxBvce9pCxIw&oe=6A849BF1",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773677339_18549990886074731_8172470030301429879_n.jpg?stp=c0.159.1280.1280a_dst-jpg_e35_s240x240_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5OTM2NTQ0MzU2Nzg3OA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=rQ3qJwMO5EAQ7kNvwFJYyVy&_nc_oc=Adqr_NH0iGDWfAdeTTDARyKU9FpkOMoavqw6K--au6XQjxEWD_f4LznohMnZQAeFvTE&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQF0hcxsZFzhGoEMCJbK7sdVtKVb6IwUKD9x-Be3dXmaPg&oe=6A849BF1",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773677339_18549990886074731_8172470030301429879_n.jpg?stp=c0.159.1280.1280a_dst-jpg_e35_s150x150_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5OTM2NTQ0MzU2Nzg3OA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=rQ3qJwMO5EAQ7kNvwFJYyVy&_nc_oc=Adqr_NH0iGDWfAdeTTDARyKU9FpkOMoavqw6K--au6XQjxEWD_f4LznohMnZQAeFvTE&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGdIYdVzQYMIuV8eN2i8TK1uJSByhplhHQrg6YAuqwCuA&oe=6A849BF1",
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
        "display_uri": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773677339_18549990886074731_8172470030301429879_n.jpg?stp=c0.159.1280.1280a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=862obGXlU7sQ7kNvwGRMoKf&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQE8sd-TAaxQpdktcA-LoVVIqkjwaVAUg3munYhlJiX1jQ&oe=6A849BF1&_nc_sid=7a9f4b",
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
    "crawled_at": "2026-08-14T08:14:50.847Z"
  },
  {
    "id": "3963398885586570584_2237970730",
    "pk": "3963398885586570584",
    "type": "Image",
    "image": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=c0.202.1620.1620a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=fDu0SuWidG0Q7kNvwE_A78e&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHIlJ4dG0cB2rFLB15JRfzBwiYr0yZbZ6kBxBDAsHPF0Q&oe=6A849592&_nc_sid=7a9f4b",
    "shortcode": "DcA0kmWkQ1Y",
    "product_type": "carousel_container",
    "hashtags": [
      "#pakuwonmalljogja"
    ],
    "mentions": [],
    "location": null,
    "caption": "🇮🇩✨ SPESIAL PROMO KEMERDEKAAN DI BUNAACA! ✨🇮🇩\n\nMerdeka makin manis! 😍🍩 Nikmati promo BUY 2 GET 1 FREE untuk semua varian yang tersedia!\n\n📅 17 Agustus 2026\n\n📍 Bunaaca Pakuwon Mall Jogja — LG Floor, depan Lobby B\n\n#pakuwonmalljogja",
    "comment_count": 0,
    "like_count": 8,
    "view_count": null,
    "has_audio": null,
    "usertags": null,
    "clips_metadata": null,
    "from_url": "https://www.instagram.com/pakuwonmall.jogja/",
    "post_url": "https://www.instagram.com/p/DcA0kmWkQ1Y/",
    "video_duration": null,
    "user": {
      "pk": "2237970730",
      "profile_pic_url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=L9VCN6COaTMQ7kNvwEtchDb&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGtAYN3nq3QGfxuCkn1E-5A4KCex9UNKdqu4rb5CDdvxA&oe=6A84A633&_nc_sid=7a9f4b",
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
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=L9VCN6COaTMQ7kNvwEtchDb&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHlusG19xf_r4IJPwxyrxIMODZbnUgAD9M5lUitKOejtQ&oe=6A84A633&_nc_sid=7a9f4b"
      },
      "__typename": "XDTUserDict",
      "full_name": "Pakuwon Mall Jogja"
    },
    "images": [
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwHGrdez&_nc_oc=AdreF3oILrbt9iJzhv03iNhmVHiaPihedd9ms7NpZ-MIp-zqT3o2v5JqiT1V0grN-yY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQF2ImyYEn4JbYZt9SuavKzn-HDsDCDUV_eAQdW7hR_0Lw&oe=6A849592",
        "height": 2025,
        "width": 1620
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=dst-jpg_e35_p1080x1080_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwHGrdez&_nc_oc=AdreF3oILrbt9iJzhv03iNhmVHiaPihedd9ms7NpZ-MIp-zqT3o2v5JqiT1V0grN-yY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGHNJ8YSh2tCt3GbH2tl3rFiZgZV73ew5Gd3b-qJdQviw&oe=6A849592",
        "height": 1350,
        "width": 1080
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwHGrdez&_nc_oc=AdreF3oILrbt9iJzhv03iNhmVHiaPihedd9ms7NpZ-MIp-zqT3o2v5JqiT1V0grN-yY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFKUw62DalwuubznpJBiFPW6xW7KE_tvZkl6tKSuABj1w&oe=6A849592",
        "height": 900,
        "width": 720
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwHGrdez&_nc_oc=AdreF3oILrbt9iJzhv03iNhmVHiaPihedd9ms7NpZ-MIp-zqT3o2v5JqiT1V0grN-yY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQE-XvEqX936Ry2sBCcdIS0yq3huU3kowa9Kz8nkJTN7hQ&oe=6A849592",
        "height": 800,
        "width": 640
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwHGrdez&_nc_oc=AdreF3oILrbt9iJzhv03iNhmVHiaPihedd9ms7NpZ-MIp-zqT3o2v5JqiT1V0grN-yY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEeAnf40xd8gcveukf4xcF_O5YdPJ3nmgrkITGVBkmrbA&oe=6A849592",
        "height": 600,
        "width": 480
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwHGrdez&_nc_oc=AdreF3oILrbt9iJzhv03iNhmVHiaPihedd9ms7NpZ-MIp-zqT3o2v5JqiT1V0grN-yY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFZMjiZjmlOUNxe72PV3z_vYytUtvbBAQ2dd7v9A0fGiA&oe=6A849592",
        "height": 400,
        "width": 320
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwHGrdez&_nc_oc=AdreF3oILrbt9iJzhv03iNhmVHiaPihedd9ms7NpZ-MIp-zqT3o2v5JqiT1V0grN-yY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEKz99FEcRTmvdO2qxK2IK_FzuVJjm1JWB1-dBxHspOEw&oe=6A849592",
        "height": 300,
        "width": 240
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=c0.202.1620.1620a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwHGrdez&_nc_oc=AdreF3oILrbt9iJzhv03iNhmVHiaPihedd9ms7NpZ-MIp-zqT3o2v5JqiT1V0grN-yY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFxRsY4AJfG9rmo2QFb4-RrtOvvgztDzXp8aOCJAyAMww&oe=6A849592",
        "height": 1080,
        "width": 1080
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=c0.202.1620.1620a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwHGrdez&_nc_oc=AdreF3oILrbt9iJzhv03iNhmVHiaPihedd9ms7NpZ-MIp-zqT3o2v5JqiT1V0grN-yY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFbSZt-CW6V9t96IYYko59TIKdzWYiZGpH3x-Nx7-T4ew&oe=6A849592",
        "height": 750,
        "width": 750
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=c0.202.1620.1620a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwHGrdez&_nc_oc=AdreF3oILrbt9iJzhv03iNhmVHiaPihedd9ms7NpZ-MIp-zqT3o2v5JqiT1V0grN-yY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHxeCqvkuZWiAvp3uswENGJUP4zfdPve71Hkm-BQCZUMA&oe=6A849592",
        "height": 640,
        "width": 640
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=c0.202.1620.1620a_dst-jpg_e35_s480x480_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwHGrdez&_nc_oc=AdreF3oILrbt9iJzhv03iNhmVHiaPihedd9ms7NpZ-MIp-zqT3o2v5JqiT1V0grN-yY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQH_9SuIH7Pk8Uwx5zO_ReNojqpKxgMFRsSokN75OTywxg&oe=6A849592",
        "height": 480,
        "width": 480
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=c0.202.1620.1620a_dst-jpg_e35_s320x320_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwHGrdez&_nc_oc=AdreF3oILrbt9iJzhv03iNhmVHiaPihedd9ms7NpZ-MIp-zqT3o2v5JqiT1V0grN-yY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEIILx-RlfEsiy_WpgZX9HWjgg0QnsotezOllhndptMdA&oe=6A849592",
        "height": 320,
        "width": 320
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=c0.202.1620.1620a_dst-jpg_e35_s240x240_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwHGrdez&_nc_oc=AdreF3oILrbt9iJzhv03iNhmVHiaPihedd9ms7NpZ-MIp-zqT3o2v5JqiT1V0grN-yY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGBUjY0ky3c9u69QD_AzOHBVs1yiN6lJJdQGIshYxCmsQ&oe=6A849592",
        "height": 240,
        "width": 240
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=c0.202.1620.1620a_dst-jpg_e35_s150x150_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwHGrdez&_nc_oc=AdreF3oILrbt9iJzhv03iNhmVHiaPihedd9ms7NpZ-MIp-zqT3o2v5JqiT1V0grN-yY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHflhLhcGTieekOmISIrlzUtYZQ_iAgjMy8fii0s6bFdw&oe=6A849592",
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
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwHGrdez&_nc_oc=AdreF3oILrbt9iJzhv03iNhmVHiaPihedd9ms7NpZ-MIp-zqT3o2v5JqiT1V0grN-yY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQF2ImyYEn4JbYZt9SuavKzn-HDsDCDUV_eAQdW7hR_0Lw&oe=6A849592",
              "height": 2025,
              "width": 1620
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=dst-jpg_e35_p1080x1080_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwHGrdez&_nc_oc=AdreF3oILrbt9iJzhv03iNhmVHiaPihedd9ms7NpZ-MIp-zqT3o2v5JqiT1V0grN-yY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGHNJ8YSh2tCt3GbH2tl3rFiZgZV73ew5Gd3b-qJdQviw&oe=6A849592",
              "height": 1350,
              "width": 1080
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwHGrdez&_nc_oc=AdreF3oILrbt9iJzhv03iNhmVHiaPihedd9ms7NpZ-MIp-zqT3o2v5JqiT1V0grN-yY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFKUw62DalwuubznpJBiFPW6xW7KE_tvZkl6tKSuABj1w&oe=6A849592",
              "height": 900,
              "width": 720
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwHGrdez&_nc_oc=AdreF3oILrbt9iJzhv03iNhmVHiaPihedd9ms7NpZ-MIp-zqT3o2v5JqiT1V0grN-yY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQE-XvEqX936Ry2sBCcdIS0yq3huU3kowa9Kz8nkJTN7hQ&oe=6A849592",
              "height": 800,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwHGrdez&_nc_oc=AdreF3oILrbt9iJzhv03iNhmVHiaPihedd9ms7NpZ-MIp-zqT3o2v5JqiT1V0grN-yY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEeAnf40xd8gcveukf4xcF_O5YdPJ3nmgrkITGVBkmrbA&oe=6A849592",
              "height": 600,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwHGrdez&_nc_oc=AdreF3oILrbt9iJzhv03iNhmVHiaPihedd9ms7NpZ-MIp-zqT3o2v5JqiT1V0grN-yY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFZMjiZjmlOUNxe72PV3z_vYytUtvbBAQ2dd7v9A0fGiA&oe=6A849592",
              "height": 400,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwHGrdez&_nc_oc=AdreF3oILrbt9iJzhv03iNhmVHiaPihedd9ms7NpZ-MIp-zqT3o2v5JqiT1V0grN-yY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEKz99FEcRTmvdO2qxK2IK_FzuVJjm1JWB1-dBxHspOEw&oe=6A849592",
              "height": 300,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=c0.202.1620.1620a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwHGrdez&_nc_oc=AdreF3oILrbt9iJzhv03iNhmVHiaPihedd9ms7NpZ-MIp-zqT3o2v5JqiT1V0grN-yY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFxRsY4AJfG9rmo2QFb4-RrtOvvgztDzXp8aOCJAyAMww&oe=6A849592",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=c0.202.1620.1620a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwHGrdez&_nc_oc=AdreF3oILrbt9iJzhv03iNhmVHiaPihedd9ms7NpZ-MIp-zqT3o2v5JqiT1V0grN-yY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFbSZt-CW6V9t96IYYko59TIKdzWYiZGpH3x-Nx7-T4ew&oe=6A849592",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=c0.202.1620.1620a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwHGrdez&_nc_oc=AdreF3oILrbt9iJzhv03iNhmVHiaPihedd9ms7NpZ-MIp-zqT3o2v5JqiT1V0grN-yY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHxeCqvkuZWiAvp3uswENGJUP4zfdPve71Hkm-BQCZUMA&oe=6A849592",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=c0.202.1620.1620a_dst-jpg_e35_s480x480_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwHGrdez&_nc_oc=AdreF3oILrbt9iJzhv03iNhmVHiaPihedd9ms7NpZ-MIp-zqT3o2v5JqiT1V0grN-yY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQH_9SuIH7Pk8Uwx5zO_ReNojqpKxgMFRsSokN75OTywxg&oe=6A849592",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=c0.202.1620.1620a_dst-jpg_e35_s320x320_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwHGrdez&_nc_oc=AdreF3oILrbt9iJzhv03iNhmVHiaPihedd9ms7NpZ-MIp-zqT3o2v5JqiT1V0grN-yY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEIILx-RlfEsiy_WpgZX9HWjgg0QnsotezOllhndptMdA&oe=6A849592",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=c0.202.1620.1620a_dst-jpg_e35_s240x240_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwHGrdez&_nc_oc=AdreF3oILrbt9iJzhv03iNhmVHiaPihedd9ms7NpZ-MIp-zqT3o2v5JqiT1V0grN-yY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGBUjY0ky3c9u69QD_AzOHBVs1yiN6lJJdQGIshYxCmsQ&oe=6A849592",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=c0.202.1620.1620a_dst-jpg_e35_s150x150_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5ODcyOTExNzI5NzU5OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYyMC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BmrB2QObEq4Q7kNvwHGrdez&_nc_oc=AdreF3oILrbt9iJzhv03iNhmVHiaPihedd9ms7NpZ-MIp-zqT3o2v5JqiT1V0grN-yY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHflhLhcGTieekOmISIrlzUtYZQ_iAgjMy8fii0s6bFdw&oe=6A849592",
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
        "display_uri": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=c0.202.1620.1620a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=fDu0SuWidG0Q7kNvwE_A78e&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHIlJ4dG0cB2rFLB15JRfzBwiYr0yZbZ6kBxBDAsHPF0Q&oe=6A849592&_nc_sid=7a9f4b",
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
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774993881_18549990505074731_1733467400335382529_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=106&ig_cache_key=Mzk2MzM5ODc0NzE3NzkxODUyNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjE2MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Fp63TX-CxpEQ7kNvwGVjgiT&_nc_oc=AdqOjW6G9RW7H9vp9fYYfC4rodDVfLXiPWsfnsrk14iRNDQoxeu4AGyKPzQqaUUUhJQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHQXXjmqOFVuqi0XPw4RCabY3_LMYAZjHQGGUgz5QjNkw&oe=6A84ADE7",
              "height": 2700,
              "width": 2160
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774993881_18549990505074731_1733467400335382529_n.jpg?stp=dst-jpg_e35_p1080x1080_tt6&_nc_cat=106&ig_cache_key=Mzk2MzM5ODc0NzE3NzkxODUyNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjE2MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Fp63TX-CxpEQ7kNvwGVjgiT&_nc_oc=AdqOjW6G9RW7H9vp9fYYfC4rodDVfLXiPWsfnsrk14iRNDQoxeu4AGyKPzQqaUUUhJQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHcjSSMnJhJpDYXlM_aUnIdr81MQrwxmri61wLeUVlhUA&oe=6A84ADE7",
              "height": 1350,
              "width": 1080
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774993881_18549990505074731_1733467400335382529_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=106&ig_cache_key=Mzk2MzM5ODc0NzE3NzkxODUyNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjE2MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Fp63TX-CxpEQ7kNvwGVjgiT&_nc_oc=AdqOjW6G9RW7H9vp9fYYfC4rodDVfLXiPWsfnsrk14iRNDQoxeu4AGyKPzQqaUUUhJQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFIJebUBBH97OBpIMMa5y5qRPO9BYvvpDgxTKaOLVDm4w&oe=6A84ADE7",
              "height": 900,
              "width": 720
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774993881_18549990505074731_1733467400335382529_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=106&ig_cache_key=Mzk2MzM5ODc0NzE3NzkxODUyNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjE2MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Fp63TX-CxpEQ7kNvwGVjgiT&_nc_oc=AdqOjW6G9RW7H9vp9fYYfC4rodDVfLXiPWsfnsrk14iRNDQoxeu4AGyKPzQqaUUUhJQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQE3etvvHpjHPf0IgP668Ilx-3vR7-vL6tsuwYzXFW3SmQ&oe=6A84ADE7",
              "height": 800,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774993881_18549990505074731_1733467400335382529_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=106&ig_cache_key=Mzk2MzM5ODc0NzE3NzkxODUyNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjE2MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Fp63TX-CxpEQ7kNvwGVjgiT&_nc_oc=AdqOjW6G9RW7H9vp9fYYfC4rodDVfLXiPWsfnsrk14iRNDQoxeu4AGyKPzQqaUUUhJQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHJxylM-Djj90g5PsKDYQq1kI0YmnsRoemz9y2lYmtejg&oe=6A84ADE7",
              "height": 600,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774993881_18549990505074731_1733467400335382529_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=106&ig_cache_key=Mzk2MzM5ODc0NzE3NzkxODUyNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjE2MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Fp63TX-CxpEQ7kNvwGVjgiT&_nc_oc=AdqOjW6G9RW7H9vp9fYYfC4rodDVfLXiPWsfnsrk14iRNDQoxeu4AGyKPzQqaUUUhJQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEK7i6bZlqGOKkx4yWFOyX8TYQbVpQxrAXdGU7c6SwfWA&oe=6A84ADE7",
              "height": 400,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774993881_18549990505074731_1733467400335382529_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=106&ig_cache_key=Mzk2MzM5ODc0NzE3NzkxODUyNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjE2MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Fp63TX-CxpEQ7kNvwGVjgiT&_nc_oc=AdqOjW6G9RW7H9vp9fYYfC4rodDVfLXiPWsfnsrk14iRNDQoxeu4AGyKPzQqaUUUhJQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQE8dtOVe1c9fUTe8OAvInhX4FWTcF00SW5U8-UlW0IiPQ&oe=6A84ADE7",
              "height": 300,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774993881_18549990505074731_1733467400335382529_n.jpg?stp=c0.270.2160.2160a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=106&ig_cache_key=Mzk2MzM5ODc0NzE3NzkxODUyNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjE2MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Fp63TX-CxpEQ7kNvwGVjgiT&_nc_oc=AdqOjW6G9RW7H9vp9fYYfC4rodDVfLXiPWsfnsrk14iRNDQoxeu4AGyKPzQqaUUUhJQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHaqdgVYSvCmmMByo0ZDPRnW3BOnKmI8wb51RJrG5aFcg&oe=6A84ADE7",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774993881_18549990505074731_1733467400335382529_n.jpg?stp=c0.270.2160.2160a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=106&ig_cache_key=Mzk2MzM5ODc0NzE3NzkxODUyNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjE2MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Fp63TX-CxpEQ7kNvwGVjgiT&_nc_oc=AdqOjW6G9RW7H9vp9fYYfC4rodDVfLXiPWsfnsrk14iRNDQoxeu4AGyKPzQqaUUUhJQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQF1m9jwv7r2pmZpLnXBrAK5lREOpXJ16gsrVKJ64IEE2A&oe=6A84ADE7",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774993881_18549990505074731_1733467400335382529_n.jpg?stp=c0.270.2160.2160a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=106&ig_cache_key=Mzk2MzM5ODc0NzE3NzkxODUyNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjE2MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Fp63TX-CxpEQ7kNvwGVjgiT&_nc_oc=AdqOjW6G9RW7H9vp9fYYfC4rodDVfLXiPWsfnsrk14iRNDQoxeu4AGyKPzQqaUUUhJQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEb6UOxgsgvb0yY2G86_6aHnpzjjvtLikfpiaP8He2NwQ&oe=6A84ADE7",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774993881_18549990505074731_1733467400335382529_n.jpg?stp=c0.270.2160.2160a_dst-jpg_e35_s480x480_tt6&_nc_cat=106&ig_cache_key=Mzk2MzM5ODc0NzE3NzkxODUyNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjE2MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Fp63TX-CxpEQ7kNvwGVjgiT&_nc_oc=AdqOjW6G9RW7H9vp9fYYfC4rodDVfLXiPWsfnsrk14iRNDQoxeu4AGyKPzQqaUUUhJQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHAigZ5rKlra6W0_YbbZV1DyOwqdzhxCopxloAEZBFPAA&oe=6A84ADE7",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774993881_18549990505074731_1733467400335382529_n.jpg?stp=c0.270.2160.2160a_dst-jpg_e35_s320x320_tt6&_nc_cat=106&ig_cache_key=Mzk2MzM5ODc0NzE3NzkxODUyNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjE2MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Fp63TX-CxpEQ7kNvwGVjgiT&_nc_oc=AdqOjW6G9RW7H9vp9fYYfC4rodDVfLXiPWsfnsrk14iRNDQoxeu4AGyKPzQqaUUUhJQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEgNKqUE2w8NvRw7oTGDTJXOKxVXY6-RIredqIjy98idQ&oe=6A84ADE7",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774993881_18549990505074731_1733467400335382529_n.jpg?stp=c0.270.2160.2160a_dst-jpg_e35_s240x240_tt6&_nc_cat=106&ig_cache_key=Mzk2MzM5ODc0NzE3NzkxODUyNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjE2MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Fp63TX-CxpEQ7kNvwGVjgiT&_nc_oc=AdqOjW6G9RW7H9vp9fYYfC4rodDVfLXiPWsfnsrk14iRNDQoxeu4AGyKPzQqaUUUhJQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHSxAmz1jN6B0ut8vlKH7UYv3dzeaBkcGFunxofS19XqQ&oe=6A84ADE7",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774993881_18549990505074731_1733467400335382529_n.jpg?stp=c0.270.2160.2160a_dst-jpg_e35_s150x150_tt6&_nc_cat=106&ig_cache_key=Mzk2MzM5ODc0NzE3NzkxODUyNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjE2MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Fp63TX-CxpEQ7kNvwGVjgiT&_nc_oc=AdqOjW6G9RW7H9vp9fYYfC4rodDVfLXiPWsfnsrk14iRNDQoxeu4AGyKPzQqaUUUhJQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGU-JhmtX-2ojOrQHM9s8L3n6Rd4ExWoBE2rFV31rbIYQ&oe=6A84ADE7",
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
        "display_uri": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774993881_18549990505074731_1733467400335382529_n.jpg?stp=c0.270.2160.2160a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=OhgUGUHQj50Q7kNvwFjrCfi&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGYxvYE57DX-kMrWS0CPoiG8Mw5Z2Sf06yD86UVPEJ54A&oe=6A84ADE7&_nc_sid=7a9f4b",
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
    "crawled_at": "2026-08-14T08:14:50.847Z"
  },
  {
    "id": "3963395413478023137_2237970730",
    "pk": "3963395413478023137",
    "type": "Video",
    "image": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773756666_18549989311074731_7591783819368902774_n.jpg?stp=c0.469.1206.1206a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=ddJVZdEXwSsQ7kNvwG00iDN&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQE-H_gLbYADanAd8EjD345YD21WL7BqRWEkeMSlsijUqA&oe=6A849B87&_nc_sid=7a9f4b",
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
          "profile_pic_url": "https://scontent-ord5-2.cdninstagram.com/v/t51.2885-19/54800477_2189592477793980_624948081216978944_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby45NjAuYzIifQ&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_cat=100&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=Iz2JRul0k6kQ7kNvwHjRMdH&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHRHvRdPJVhB8K-jfp0_4Jhe_Kh2b6axxPUNG2lHcMD_w&oe=6A8492D0&_nc_sid=7a9f4b",
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
          "profile_pic_url": "https://scontent-ord5-2.cdninstagram.com/v/t51.2885-19/145976495_717061658996801_8615672779095137678_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby43MjAuYzIifQ&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_cat=105&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=NEQAeZQ5-dcQ7kNvwGe0AYW&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHVmYPkW9fTK63s6o6zIFVKURvCweFVhucmSPb8a2qxRA&oe=6A849B1B&_nc_sid=7a9f4b",
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
          "profile_pic_url": "https://scontent-ord5-2.cdninstagram.com/v/t51.2885-19/122597843_342367900160616_7189706853388346855_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_cat=100&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=z4pokypaePIQ7kNvwEdhpQf&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQFJbthpL4xkpk4E8JkSY7x-Gw6JkL-xLAqOG5IZ9TrDZw&oe=6A849E78&_nc_sid=7a9f4b",
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
          "profile_pic_url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=L9VCN6COaTMQ7kNvwEtchDb&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGtAYN3nq3QGfxuCkn1E-5A4KCex9UNKdqu4rb5CDdvxA&oe=6A84A633&_nc_sid=7a9f4b"
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
      "profile_pic_url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=L9VCN6COaTMQ7kNvwEtchDb&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGtAYN3nq3QGfxuCkn1E-5A4KCex9UNKdqu4rb5CDdvxA&oe=6A84A633&_nc_sid=7a9f4b",
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
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=L9VCN6COaTMQ7kNvwEtchDb&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHlusG19xf_r4IJPwxyrxIMODZbnUgAD9M5lUitKOejtQ&oe=6A84A633&_nc_sid=7a9f4b"
      },
      "__typename": "XDTUserDict",
      "full_name": "Pakuwon Mall Jogja"
    },
    "images": [
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773756666_18549989311074731_7591783819368902774_n.jpg?stp=dst-jpg_e15_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5NTQxMzQ3ODAyMzEzNzE4NTQ5OTg5MzA1MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=mzszszFNp7QQ7kNvwH_FOlj&_nc_oc=AdoYjFyNvOYxe0nzrIpOGhyiaR5OeCMZhhL3IKh8dv59f8WRo4zxGrWj4ktQc-ugwzo&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQH--vkyKQh45IHFZRaWvWvhOIgirFfaxCBJWdFK_NOxzw&oe=6A849B87",
        "height": 2144,
        "width": 1206
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773756666_18549989311074731_7591783819368902774_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5NTQxMzQ3ODAyMzEzNzE4NTQ5OTg5MzA1MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=mzszszFNp7QQ7kNvwH_FOlj&_nc_oc=AdoYjFyNvOYxe0nzrIpOGhyiaR5OeCMZhhL3IKh8dv59f8WRo4zxGrWj4ktQc-ugwzo&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFaMhIwTP-HDUJgVvYyaMLUrdey-wT0etlUmZD8EciNmg&oe=6A849B87",
        "height": 1920,
        "width": 1080
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773756666_18549989311074731_7591783819368902774_n.jpg?stp=dst-jpg_e35_p720x720_sh2.08_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5NTQxMzQ3ODAyMzEzNzE4NTQ5OTg5MzA1MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=mzszszFNp7QQ7kNvwH_FOlj&_nc_oc=AdoYjFyNvOYxe0nzrIpOGhyiaR5OeCMZhhL3IKh8dv59f8WRo4zxGrWj4ktQc-ugwzo&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGBwrMPJg2iF4l82aHdLc_iom1BGv0N-9XpJqMb2Qb4yw&oe=6A849B87",
        "height": 1280,
        "width": 720
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773756666_18549989311074731_7591783819368902774_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5NTQxMzQ3ODAyMzEzNzE4NTQ5OTg5MzA1MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=mzszszFNp7QQ7kNvwH_FOlj&_nc_oc=AdoYjFyNvOYxe0nzrIpOGhyiaR5OeCMZhhL3IKh8dv59f8WRo4zxGrWj4ktQc-ugwzo&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQF2O2hSReAj8x3qx3MaZP8QssOoWsmstTPdejAQ7QIa9g&oe=6A849B87",
        "height": 1138,
        "width": 640
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773756666_18549989311074731_7591783819368902774_n.jpg?stp=dst-jpg_e15_p480x480_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5NTQxMzQ3ODAyMzEzNzE4NTQ5OTg5MzA1MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=mzszszFNp7QQ7kNvwH_FOlj&_nc_oc=AdoYjFyNvOYxe0nzrIpOGhyiaR5OeCMZhhL3IKh8dv59f8WRo4zxGrWj4ktQc-ugwzo&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEYuaA2r1z45mVD5euBRuNp1AzqWCagG5n0DVu8i2hwZQ&oe=6A849B87",
        "height": 853,
        "width": 480
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773756666_18549989311074731_7591783819368902774_n.jpg?stp=dst-jpg_e15_p320x320_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5NTQxMzQ3ODAyMzEzNzE4NTQ5OTg5MzA1MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=mzszszFNp7QQ7kNvwH_FOlj&_nc_oc=AdoYjFyNvOYxe0nzrIpOGhyiaR5OeCMZhhL3IKh8dv59f8WRo4zxGrWj4ktQc-ugwzo&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGMHE4wHgNNd6EJPOboC0dxiFcYUY6rxu_snLOfPYZ_rA&oe=6A849B87",
        "height": 569,
        "width": 320
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773756666_18549989311074731_7591783819368902774_n.jpg?stp=dst-jpg_e15_p240x240_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5NTQxMzQ3ODAyMzEzNzE4NTQ5OTg5MzA1MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=mzszszFNp7QQ7kNvwH_FOlj&_nc_oc=AdoYjFyNvOYxe0nzrIpOGhyiaR5OeCMZhhL3IKh8dv59f8WRo4zxGrWj4ktQc-ugwzo&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFdHoBNA3C4WxJVV1xaE-YNsXBrsbkPnB53LsExismGKA&oe=6A849B87",
        "height": 427,
        "width": 240
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773756666_18549989311074731_7591783819368902774_n.jpg?stp=c0.469.1206.1206a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5NTQxMzQ3ODAyMzEzNzE4NTQ5OTg5MzA1MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=mzszszFNp7QQ7kNvwH_FOlj&_nc_oc=AdoYjFyNvOYxe0nzrIpOGhyiaR5OeCMZhhL3IKh8dv59f8WRo4zxGrWj4ktQc-ugwzo&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQF4NnBZiwywn0khLPv6s8nFNOSApKsBrDb731hncjb3dA&oe=6A849B87",
        "height": 1080,
        "width": 1080
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773756666_18549989311074731_7591783819368902774_n.jpg?stp=c0.469.1206.1206a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5NTQxMzQ3ODAyMzEzNzE4NTQ5OTg5MzA1MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=mzszszFNp7QQ7kNvwH_FOlj&_nc_oc=AdoYjFyNvOYxe0nzrIpOGhyiaR5OeCMZhhL3IKh8dv59f8WRo4zxGrWj4ktQc-ugwzo&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFP5luQPHyePrmwJerDB9pQyjGbu9cwaoIv_6C1JC_44Q&oe=6A849B87",
        "height": 750,
        "width": 750
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773756666_18549989311074731_7591783819368902774_n.jpg?stp=c0.469.1206.1206a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5NTQxMzQ3ODAyMzEzNzE4NTQ5OTg5MzA1MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=mzszszFNp7QQ7kNvwH_FOlj&_nc_oc=AdoYjFyNvOYxe0nzrIpOGhyiaR5OeCMZhhL3IKh8dv59f8WRo4zxGrWj4ktQc-ugwzo&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGnAk9oROjoHWCDeha5JDzQ_2N611IbiUFzyYvQYB18Qg&oe=6A849B87",
        "height": 640,
        "width": 640
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773756666_18549989311074731_7591783819368902774_n.jpg?stp=c0.469.1206.1206a_dst-jpg_e15_s480x480_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5NTQxMzQ3ODAyMzEzNzE4NTQ5OTg5MzA1MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=mzszszFNp7QQ7kNvwH_FOlj&_nc_oc=AdoYjFyNvOYxe0nzrIpOGhyiaR5OeCMZhhL3IKh8dv59f8WRo4zxGrWj4ktQc-ugwzo&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQE_cv20gdlvNTEHCd7RRaP0-mTCBfyuq1o2lY83_jW5Hw&oe=6A849B87",
        "height": 480,
        "width": 480
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773756666_18549989311074731_7591783819368902774_n.jpg?stp=c0.469.1206.1206a_dst-jpg_e15_s320x320_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5NTQxMzQ3ODAyMzEzNzE4NTQ5OTg5MzA1MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=mzszszFNp7QQ7kNvwH_FOlj&_nc_oc=AdoYjFyNvOYxe0nzrIpOGhyiaR5OeCMZhhL3IKh8dv59f8WRo4zxGrWj4ktQc-ugwzo&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGF7sZxcrXqUa8gkJhKcQtSdgCGosxk0Se5q7FuuRID0A&oe=6A849B87",
        "height": 320,
        "width": 320
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773756666_18549989311074731_7591783819368902774_n.jpg?stp=c0.469.1206.1206a_dst-jpg_e15_s240x240_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5NTQxMzQ3ODAyMzEzNzE4NTQ5OTg5MzA1MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=mzszszFNp7QQ7kNvwH_FOlj&_nc_oc=AdoYjFyNvOYxe0nzrIpOGhyiaR5OeCMZhhL3IKh8dv59f8WRo4zxGrWj4ktQc-ugwzo&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEQ9ScjNNXzu60djNFPojI_NjzXOgc9FrPi6e3v1JBZYA&oe=6A849B87",
        "height": 240,
        "width": 240
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773756666_18549989311074731_7591783819368902774_n.jpg?stp=c0.469.1206.1206a_dst-jpg_e15_s150x150_tt6&_nc_cat=111&ig_cache_key=Mzk2MzM5NTQxMzQ3ODAyMzEzNzE4NTQ5OTg5MzA1MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=mzszszFNp7QQ7kNvwH_FOlj&_nc_oc=AdoYjFyNvOYxe0nzrIpOGhyiaR5OeCMZhhL3IKh8dv59f8WRo4zxGrWj4ktQc-ugwzo&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGS4ritJYt-9KSsQgVOZM2KPlg6rSr8bDgTQa16Gftj2g&oe=6A849B87",
        "height": 150,
        "width": 150
      }
    ],
    "video_versions": [
      {
        "width": 720,
        "height": 1280,
        "url": "https://scontent-ord5-1.cdninstagram.com/o1/v/t2/f2/m86/AQPW1xBV6GTA3dwXu0_G8_z4xkzuX9IOsruu9nkYqRbzMCrZoPvIk_5m9r16I6ZjbyquJu3xnSu2D2Id-Qjor2mOrrzz1HAgg36yKRA.mp4?_nc_cat=111&_nc_sid=5e9851&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_ohc=QDOA9g00bsQQ7kNvwE-q_R7&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTU5NjYyOTkwODU2NDczMywiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjoyOSwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=599f7cf31d94d0a9&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC8wQTRGNjdGRjZDNUNCNjE4QUVBNzAwMjM1NjZGMTZBRV92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyL0UyNEMwNUREQjQzM0EzQ0ZGNTQ2ODA0Qjc1NTgwOUI5X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACb6q83oi4jWBRUCKAJDMywXQD13S8an754YEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&_nc_zt=28&oh=00_AQE7s_PXGsKgeUZJBYh5n6FuwfrUsMLrue99OJmM8dFglA&oe=6A80A6D0",
        "type": 101
      },
      {
        "width": 720,
        "height": 1280,
        "url": "https://scontent-ord5-1.cdninstagram.com/o1/v/t2/f2/m86/AQPW1xBV6GTA3dwXu0_G8_z4xkzuX9IOsruu9nkYqRbzMCrZoPvIk_5m9r16I6ZjbyquJu3xnSu2D2Id-Qjor2mOrrzz1HAgg36yKRA.mp4?_nc_cat=111&_nc_sid=5e9851&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_ohc=QDOA9g00bsQQ7kNvwE-q_R7&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTU5NjYyOTkwODU2NDczMywiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjoyOSwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=599f7cf31d94d0a9&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC8wQTRGNjdGRjZDNUNCNjE4QUVBNzAwMjM1NjZGMTZBRV92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyL0UyNEMwNUREQjQzM0EzQ0ZGNTQ2ODA0Qjc1NTgwOUI5X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACb6q83oi4jWBRUCKAJDMywXQD13S8an754YEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&_nc_zt=28&oh=00_AQE7s_PXGsKgeUZJBYh5n6FuwfrUsMLrue99OJmM8dFglA&oe=6A80A6D0",
        "type": 102
      },
      {
        "width": 720,
        "height": 1280,
        "url": "https://scontent-ord5-1.cdninstagram.com/o1/v/t2/f2/m86/AQPW1xBV6GTA3dwXu0_G8_z4xkzuX9IOsruu9nkYqRbzMCrZoPvIk_5m9r16I6ZjbyquJu3xnSu2D2Id-Qjor2mOrrzz1HAgg36yKRA.mp4?_nc_cat=111&_nc_sid=5e9851&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_ohc=QDOA9g00bsQQ7kNvwE-q_R7&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTU5NjYyOTkwODU2NDczMywiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjoyOSwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=599f7cf31d94d0a9&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC8wQTRGNjdGRjZDNUNCNjE4QUVBNzAwMjM1NjZGMTZBRV92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyL0UyNEMwNUREQjQzM0EzQ0ZGNTQ2ODA0Qjc1NTgwOUI5X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACb6q83oi4jWBRUCKAJDMywXQD13S8an754YEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&_nc_zt=28&oh=00_AQE7s_PXGsKgeUZJBYh5n6FuwfrUsMLrue99OJmM8dFglA&oe=6A80A6D0",
        "type": 103
      }
    ],
    "carousel_media_count": null,
    "carousel_media": null,
    "coauthor_producers": [],
    "timeline_pinned_user_ids": [],
    "date": "2026-08-14T07:47:26.000Z",
    "crawled_at": "2026-08-14T08:14:50.847Z"
  },
  {
    "id": "3963391870218908290_2237970730",
    "pk": "3963391870218908290",
    "type": "Image",
    "image": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=c0.187.1179.1179a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=AaQoeHLV-NgQ7kNvwG_aHvb&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQE2VuADSCDVN744iRWhPhkthcNnJ7ICN5CY5JAzZ__Ntw&oe=6A84A99B&_nc_sid=7a9f4b",
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
      "profile_pic_url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=L9VCN6COaTMQ7kNvwEtchDb&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGtAYN3nq3QGfxuCkn1E-5A4KCex9UNKdqu4rb5CDdvxA&oe=6A84A633&_nc_sid=7a9f4b",
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
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=L9VCN6COaTMQ7kNvwEtchDb&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHlusG19xf_r4IJPwxyrxIMODZbnUgAD9M5lUitKOejtQ&oe=6A84A633&_nc_sid=7a9f4b"
      },
      "__typename": "XDTUserDict",
      "full_name": "Pakuwon Mall Jogja"
    },
    "images": [
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwEi8szI&_nc_oc=AdqSjCUwdJKDmscZtQEK8uk2qvOgQ0jkvNWSrHXK-2lkrkbCNlOoup3RNVtkS1chLRA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGe8O4zgOpEkHO6dOTETI0_uWso1gFoL3M2wUKe4V9cLw&oe=6A84A99B",
        "height": 1553,
        "width": 1179
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwEi8szI&_nc_oc=AdqSjCUwdJKDmscZtQEK8uk2qvOgQ0jkvNWSrHXK-2lkrkbCNlOoup3RNVtkS1chLRA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGhMFG4GUoh6d8u6zjZcH-8n8sWcvMcE3VHMooe8SoAmg&oe=6A84A99B",
        "height": 948,
        "width": 720
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwEi8szI&_nc_oc=AdqSjCUwdJKDmscZtQEK8uk2qvOgQ0jkvNWSrHXK-2lkrkbCNlOoup3RNVtkS1chLRA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGQ9S-Ce3k2D7wHf3uLGzj-_xwkrhTETdayA6n1L7x0oQ&oe=6A84A99B",
        "height": 843,
        "width": 640
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwEi8szI&_nc_oc=AdqSjCUwdJKDmscZtQEK8uk2qvOgQ0jkvNWSrHXK-2lkrkbCNlOoup3RNVtkS1chLRA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHgvIOYxPFzqRS1DyW0OjwJROtQR7MOVDsB1p1b-bQCUA&oe=6A84A99B",
        "height": 632,
        "width": 480
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwEi8szI&_nc_oc=AdqSjCUwdJKDmscZtQEK8uk2qvOgQ0jkvNWSrHXK-2lkrkbCNlOoup3RNVtkS1chLRA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEbA5IZpPvwKnwx0cOieVFJIzQYM9zE5XavbZIat0pqjQ&oe=6A84A99B",
        "height": 422,
        "width": 320
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwEi8szI&_nc_oc=AdqSjCUwdJKDmscZtQEK8uk2qvOgQ0jkvNWSrHXK-2lkrkbCNlOoup3RNVtkS1chLRA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQH6Pw9wDp1JuFFN8bzlaLa9Pm14EAL0Xrd7FffDam8Y6w&oe=6A84A99B",
        "height": 316,
        "width": 240
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=c0.187.1179.1179a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwEi8szI&_nc_oc=AdqSjCUwdJKDmscZtQEK8uk2qvOgQ0jkvNWSrHXK-2lkrkbCNlOoup3RNVtkS1chLRA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGgUUjyYa50wBOGHGIpfb0xFeurVagaVVGXqpFRQizBbQ&oe=6A84A99B",
        "height": 1080,
        "width": 1080
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=c0.187.1179.1179a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwEi8szI&_nc_oc=AdqSjCUwdJKDmscZtQEK8uk2qvOgQ0jkvNWSrHXK-2lkrkbCNlOoup3RNVtkS1chLRA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQG8t7K7HYT-JRuIUO2J8oNOEG_ySvPrwho7QHr2HzaB0A&oe=6A84A99B",
        "height": 750,
        "width": 750
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=c0.187.1179.1179a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwEi8szI&_nc_oc=AdqSjCUwdJKDmscZtQEK8uk2qvOgQ0jkvNWSrHXK-2lkrkbCNlOoup3RNVtkS1chLRA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGnSSIJc8Dxgg9QVMe-Ap2Y621BjnWi376rcGv-Oi4FXQ&oe=6A84A99B",
        "height": 640,
        "width": 640
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=c0.187.1179.1179a_dst-jpg_e35_s480x480_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwEi8szI&_nc_oc=AdqSjCUwdJKDmscZtQEK8uk2qvOgQ0jkvNWSrHXK-2lkrkbCNlOoup3RNVtkS1chLRA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGSx8Pt9HevFv5Y0d0eQoFnlF_-syokOhriyo9jd_7g3Q&oe=6A84A99B",
        "height": 480,
        "width": 480
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=c0.187.1179.1179a_dst-jpg_e35_s320x320_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwEi8szI&_nc_oc=AdqSjCUwdJKDmscZtQEK8uk2qvOgQ0jkvNWSrHXK-2lkrkbCNlOoup3RNVtkS1chLRA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHFerZGTi_OxuDHYpEufWmv6BELsNqWNLf6XIxH23ecQw&oe=6A84A99B",
        "height": 320,
        "width": 320
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=c0.187.1179.1179a_dst-jpg_e35_s240x240_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwEi8szI&_nc_oc=AdqSjCUwdJKDmscZtQEK8uk2qvOgQ0jkvNWSrHXK-2lkrkbCNlOoup3RNVtkS1chLRA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGM4MxHaGUbVwaw3aL0xkECsr4n8BwzHdilaOQjrOIunA&oe=6A84A99B",
        "height": 240,
        "width": 240
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=c0.187.1179.1179a_dst-jpg_e35_s150x150_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwEi8szI&_nc_oc=AdqSjCUwdJKDmscZtQEK8uk2qvOgQ0jkvNWSrHXK-2lkrkbCNlOoup3RNVtkS1chLRA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHvFLWKiFgVXtSNRkVZY9tOEpDRGCug_R623OtdbkqtGA&oe=6A84A99B",
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
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwEi8szI&_nc_oc=AdqSjCUwdJKDmscZtQEK8uk2qvOgQ0jkvNWSrHXK-2lkrkbCNlOoup3RNVtkS1chLRA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGe8O4zgOpEkHO6dOTETI0_uWso1gFoL3M2wUKe4V9cLw&oe=6A84A99B",
              "height": 1553,
              "width": 1179
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwEi8szI&_nc_oc=AdqSjCUwdJKDmscZtQEK8uk2qvOgQ0jkvNWSrHXK-2lkrkbCNlOoup3RNVtkS1chLRA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGhMFG4GUoh6d8u6zjZcH-8n8sWcvMcE3VHMooe8SoAmg&oe=6A84A99B",
              "height": 948,
              "width": 720
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwEi8szI&_nc_oc=AdqSjCUwdJKDmscZtQEK8uk2qvOgQ0jkvNWSrHXK-2lkrkbCNlOoup3RNVtkS1chLRA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGQ9S-Ce3k2D7wHf3uLGzj-_xwkrhTETdayA6n1L7x0oQ&oe=6A84A99B",
              "height": 843,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwEi8szI&_nc_oc=AdqSjCUwdJKDmscZtQEK8uk2qvOgQ0jkvNWSrHXK-2lkrkbCNlOoup3RNVtkS1chLRA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHgvIOYxPFzqRS1DyW0OjwJROtQR7MOVDsB1p1b-bQCUA&oe=6A84A99B",
              "height": 632,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwEi8szI&_nc_oc=AdqSjCUwdJKDmscZtQEK8uk2qvOgQ0jkvNWSrHXK-2lkrkbCNlOoup3RNVtkS1chLRA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEbA5IZpPvwKnwx0cOieVFJIzQYM9zE5XavbZIat0pqjQ&oe=6A84A99B",
              "height": 422,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwEi8szI&_nc_oc=AdqSjCUwdJKDmscZtQEK8uk2qvOgQ0jkvNWSrHXK-2lkrkbCNlOoup3RNVtkS1chLRA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQH6Pw9wDp1JuFFN8bzlaLa9Pm14EAL0Xrd7FffDam8Y6w&oe=6A84A99B",
              "height": 316,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=c0.187.1179.1179a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwEi8szI&_nc_oc=AdqSjCUwdJKDmscZtQEK8uk2qvOgQ0jkvNWSrHXK-2lkrkbCNlOoup3RNVtkS1chLRA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGgUUjyYa50wBOGHGIpfb0xFeurVagaVVGXqpFRQizBbQ&oe=6A84A99B",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=c0.187.1179.1179a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwEi8szI&_nc_oc=AdqSjCUwdJKDmscZtQEK8uk2qvOgQ0jkvNWSrHXK-2lkrkbCNlOoup3RNVtkS1chLRA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQG8t7K7HYT-JRuIUO2J8oNOEG_ySvPrwho7QHr2HzaB0A&oe=6A84A99B",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=c0.187.1179.1179a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwEi8szI&_nc_oc=AdqSjCUwdJKDmscZtQEK8uk2qvOgQ0jkvNWSrHXK-2lkrkbCNlOoup3RNVtkS1chLRA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGnSSIJc8Dxgg9QVMe-Ap2Y621BjnWi376rcGv-Oi4FXQ&oe=6A84A99B",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=c0.187.1179.1179a_dst-jpg_e35_s480x480_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwEi8szI&_nc_oc=AdqSjCUwdJKDmscZtQEK8uk2qvOgQ0jkvNWSrHXK-2lkrkbCNlOoup3RNVtkS1chLRA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGSx8Pt9HevFv5Y0d0eQoFnlF_-syokOhriyo9jd_7g3Q&oe=6A84A99B",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=c0.187.1179.1179a_dst-jpg_e35_s320x320_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwEi8szI&_nc_oc=AdqSjCUwdJKDmscZtQEK8uk2qvOgQ0jkvNWSrHXK-2lkrkbCNlOoup3RNVtkS1chLRA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHFerZGTi_OxuDHYpEufWmv6BELsNqWNLf6XIxH23ecQw&oe=6A84A99B",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=c0.187.1179.1179a_dst-jpg_e35_s240x240_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwEi8szI&_nc_oc=AdqSjCUwdJKDmscZtQEK8uk2qvOgQ0jkvNWSrHXK-2lkrkbCNlOoup3RNVtkS1chLRA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGM4MxHaGUbVwaw3aL0xkECsr4n8BwzHdilaOQjrOIunA&oe=6A84A99B",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=c0.187.1179.1179a_dst-jpg_e35_s150x150_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwEi8szI&_nc_oc=AdqSjCUwdJKDmscZtQEK8uk2qvOgQ0jkvNWSrHXK-2lkrkbCNlOoup3RNVtkS1chLRA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHvFLWKiFgVXtSNRkVZY9tOEpDRGCug_R623OtdbkqtGA&oe=6A84A99B",
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
        "display_uri": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=c0.187.1179.1179a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=AaQoeHLV-NgQ7kNvwG_aHvb&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQE2VuADSCDVN744iRWhPhkthcNnJ7ICN5CY5JAzZ__Ntw&oe=6A84A99B&_nc_sid=7a9f4b",
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
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774126206_18549987868074731_4694917732896217054_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5MTczMDYwMjIyNjk5MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=d0lEgnt4zpsQ7kNvwF47dky&_nc_oc=AdoNP_Q3XxuftCmCQELs6RUhCDx56IAdcmOzdXwebO0ATnhx9dcAYxNfSk1HTgR3U2U&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQH53vTe6qDi56NVy89xRKE6UGZCkAWL61ritkcPYtGe5A&oe=6A84A9B3",
              "height": 1419,
              "width": 1080
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774126206_18549987868074731_4694917732896217054_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5MTczMDYwMjIyNjk5MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=d0lEgnt4zpsQ7kNvwF47dky&_nc_oc=AdoNP_Q3XxuftCmCQELs6RUhCDx56IAdcmOzdXwebO0ATnhx9dcAYxNfSk1HTgR3U2U&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQE3M0aB5HnDkxr3jU79mv41eDjfxS6U3-gsT8cP_EWNDQ&oe=6A84A9B3",
              "height": 946,
              "width": 720
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774126206_18549987868074731_4694917732896217054_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5MTczMDYwMjIyNjk5MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=d0lEgnt4zpsQ7kNvwF47dky&_nc_oc=AdoNP_Q3XxuftCmCQELs6RUhCDx56IAdcmOzdXwebO0ATnhx9dcAYxNfSk1HTgR3U2U&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFHdj2JYtA1x7p-T49sIIARsFgUBkAujlgloyZ133qMWw&oe=6A84A9B3",
              "height": 841,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774126206_18549987868074731_4694917732896217054_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5MTczMDYwMjIyNjk5MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=d0lEgnt4zpsQ7kNvwF47dky&_nc_oc=AdoNP_Q3XxuftCmCQELs6RUhCDx56IAdcmOzdXwebO0ATnhx9dcAYxNfSk1HTgR3U2U&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFgUO86wNkzxXFFaQdJT6N6KYwOT6KgPKZ_y3-jlOp31w&oe=6A84A9B3",
              "height": 631,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774126206_18549987868074731_4694917732896217054_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5MTczMDYwMjIyNjk5MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=d0lEgnt4zpsQ7kNvwF47dky&_nc_oc=AdoNP_Q3XxuftCmCQELs6RUhCDx56IAdcmOzdXwebO0ATnhx9dcAYxNfSk1HTgR3U2U&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQF2_x_PopJZzVBMpnxw1CjttOI2xjlS00r-TH9jb09RTg&oe=6A84A9B3",
              "height": 420,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774126206_18549987868074731_4694917732896217054_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5MTczMDYwMjIyNjk5MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=d0lEgnt4zpsQ7kNvwF47dky&_nc_oc=AdoNP_Q3XxuftCmCQELs6RUhCDx56IAdcmOzdXwebO0ATnhx9dcAYxNfSk1HTgR3U2U&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHRDNftibwFtkfKuj3hole507VqRBzpq_SbCFQfOyiF0A&oe=6A84A9B3",
              "height": 315,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774126206_18549987868074731_4694917732896217054_n.jpg?stp=c0.169.1080.1080a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5MTczMDYwMjIyNjk5MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=d0lEgnt4zpsQ7kNvwF47dky&_nc_oc=AdoNP_Q3XxuftCmCQELs6RUhCDx56IAdcmOzdXwebO0ATnhx9dcAYxNfSk1HTgR3U2U&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFkIYLdK9pUcjLDacD6MHvn53XSYcVYuhlHnBSaagPxbA&oe=6A84A9B3",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774126206_18549987868074731_4694917732896217054_n.jpg?stp=c0.169.1080.1080a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5MTczMDYwMjIyNjk5MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=d0lEgnt4zpsQ7kNvwF47dky&_nc_oc=AdoNP_Q3XxuftCmCQELs6RUhCDx56IAdcmOzdXwebO0ATnhx9dcAYxNfSk1HTgR3U2U&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEVLyS139noqWb5f9tSvgOmXcWI9MSphDns3henpxQ5cQ&oe=6A84A9B3",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774126206_18549987868074731_4694917732896217054_n.jpg?stp=c0.169.1080.1080a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5MTczMDYwMjIyNjk5MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=d0lEgnt4zpsQ7kNvwF47dky&_nc_oc=AdoNP_Q3XxuftCmCQELs6RUhCDx56IAdcmOzdXwebO0ATnhx9dcAYxNfSk1HTgR3U2U&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHoj8tmUB6n-0JmVfr9rI6FcUZwJAcKDo4VjIB9LI1dRQ&oe=6A84A9B3",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774126206_18549987868074731_4694917732896217054_n.jpg?stp=c0.169.1080.1080a_dst-jpg_e35_s480x480_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5MTczMDYwMjIyNjk5MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=d0lEgnt4zpsQ7kNvwF47dky&_nc_oc=AdoNP_Q3XxuftCmCQELs6RUhCDx56IAdcmOzdXwebO0ATnhx9dcAYxNfSk1HTgR3U2U&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEa35HgGiBoyKjiEeBLBPk0dfIXM2c0Hf2hRFV_-7ZZsA&oe=6A84A9B3",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774126206_18549987868074731_4694917732896217054_n.jpg?stp=c0.169.1080.1080a_dst-jpg_e35_s320x320_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5MTczMDYwMjIyNjk5MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=d0lEgnt4zpsQ7kNvwF47dky&_nc_oc=AdoNP_Q3XxuftCmCQELs6RUhCDx56IAdcmOzdXwebO0ATnhx9dcAYxNfSk1HTgR3U2U&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGUtWF4g1cxhWD7JiIaGE88oqdOoNPJnm8hAw5drM1LPg&oe=6A84A9B3",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774126206_18549987868074731_4694917732896217054_n.jpg?stp=c0.169.1080.1080a_dst-jpg_e35_s240x240_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5MTczMDYwMjIyNjk5MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=d0lEgnt4zpsQ7kNvwF47dky&_nc_oc=AdoNP_Q3XxuftCmCQELs6RUhCDx56IAdcmOzdXwebO0ATnhx9dcAYxNfSk1HTgR3U2U&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHWa4YTk4GiRw5FMQtkKSVFLFMNyjGrtvUAP8FnZ1Gmeg&oe=6A84A9B3",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774126206_18549987868074731_4694917732896217054_n.jpg?stp=c0.169.1080.1080a_dst-jpg_e35_s150x150_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5MTczMDYwMjIyNjk5MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=d0lEgnt4zpsQ7kNvwF47dky&_nc_oc=AdoNP_Q3XxuftCmCQELs6RUhCDx56IAdcmOzdXwebO0ATnhx9dcAYxNfSk1HTgR3U2U&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGadIAnj_wA19B7-0iIPYcEK2RvxYGrIcYBHrzZ2mpSHQ&oe=6A84A9B3",
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
        "display_uri": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774126206_18549987868074731_4694917732896217054_n.jpg?stp=c0.169.1080.1080a_dst-jpg_e15_fr_s1080x1080_tt6&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=KmDo8Xvqq5EQ7kNvwHQMmY3&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHaV06ezNNP5p54DsNGJrrmqpVVc72_PNeiRepLiv7xUA&oe=6A84A9B3&_nc_sid=7a9f4b",
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
    "crawled_at": "2026-08-14T08:14:50.847Z"
  },
  {
    "id": "3963390113577264213_2237970730",
    "pk": "3963390113577264213",
    "type": "Image",
    "image": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=dnVhxIs_J7IQ7kNvwF7SuKg&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHbHBYHM5ZZnmKiR9f-WWyZw8TYskTcu0ZK_Yjsiq7h-g&oe=6A84A534&_nc_sid=7a9f4b",
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
      "profile_pic_url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=L9VCN6COaTMQ7kNvwEtchDb&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGtAYN3nq3QGfxuCkn1E-5A4KCex9UNKdqu4rb5CDdvxA&oe=6A84A633&_nc_sid=7a9f4b",
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
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=L9VCN6COaTMQ7kNvwEtchDb&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHlusG19xf_r4IJPwxyrxIMODZbnUgAD9M5lUitKOejtQ&oe=6A84A633&_nc_sid=7a9f4b"
      },
      "__typename": "XDTUserDict",
      "full_name": "Pakuwon Mall Jogja"
    },
    "images": [
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwFAU1n_&_nc_oc=Adr_D-rrovYY5yIo8k1YMMXhlNH5da7G0uC8GELJ152-WJHYdwIbA9kwDt_wfi2lruU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQE9i8TP_KuUkdfbtMFkYnM_2QtYFNDkOTjYndWzczv-Gw&oe=6A84A534",
        "height": 1600,
        "width": 1279
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_p1080x1080_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwFAU1n_&_nc_oc=Adr_D-rrovYY5yIo8k1YMMXhlNH5da7G0uC8GELJ152-WJHYdwIbA9kwDt_wfi2lruU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEGhyeqowD5eC8pga9KwY4NMQo7cvVL1HIF2lNW4quJCA&oe=6A84A534",
        "height": 1351,
        "width": 1080
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwFAU1n_&_nc_oc=Adr_D-rrovYY5yIo8k1YMMXhlNH5da7G0uC8GELJ152-WJHYdwIbA9kwDt_wfi2lruU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHu-GsUg9WtJYCJ_2IaOt_liBk1YBv4S-YarDsKxb6UPw&oe=6A84A534",
        "height": 901,
        "width": 720
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwFAU1n_&_nc_oc=Adr_D-rrovYY5yIo8k1YMMXhlNH5da7G0uC8GELJ152-WJHYdwIbA9kwDt_wfi2lruU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQExVICm0nr8rJBIlnhq6OWvq9lDKdbwXDZOaTDomUEKHw&oe=6A84A534",
        "height": 801,
        "width": 640
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwFAU1n_&_nc_oc=Adr_D-rrovYY5yIo8k1YMMXhlNH5da7G0uC8GELJ152-WJHYdwIbA9kwDt_wfi2lruU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQE1Xv4eGhgWOLdfSv2Ac0FWMcZqheFfpnSqPOyNXHAPjg&oe=6A84A534",
        "height": 600,
        "width": 480
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwFAU1n_&_nc_oc=Adr_D-rrovYY5yIo8k1YMMXhlNH5da7G0uC8GELJ152-WJHYdwIbA9kwDt_wfi2lruU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQF9OfBxSGWovQPtXW4V46GjKlJdLTYQrUD6OdZ3a8Jflg&oe=6A84A534",
        "height": 400,
        "width": 320
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwFAU1n_&_nc_oc=Adr_D-rrovYY5yIo8k1YMMXhlNH5da7G0uC8GELJ152-WJHYdwIbA9kwDt_wfi2lruU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHGZU7Y2XWkDS7Yapg9_at7_qnbBStvzutRiJca2J8hzQ&oe=6A84A534",
        "height": 300,
        "width": 240
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwFAU1n_&_nc_oc=Adr_D-rrovYY5yIo8k1YMMXhlNH5da7G0uC8GELJ152-WJHYdwIbA9kwDt_wfi2lruU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHi-GMOHxGg2jY1VejC1zqIit2MQHoOo39PhK_l_Zunaw&oe=6A84A534",
        "height": 1080,
        "width": 1080
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwFAU1n_&_nc_oc=Adr_D-rrovYY5yIo8k1YMMXhlNH5da7G0uC8GELJ152-WJHYdwIbA9kwDt_wfi2lruU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFhgDQTdyRyJRWBrTfZCAnCM69rG43pCYMyD1fIibKKDw&oe=6A84A534",
        "height": 750,
        "width": 750
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwFAU1n_&_nc_oc=Adr_D-rrovYY5yIo8k1YMMXhlNH5da7G0uC8GELJ152-WJHYdwIbA9kwDt_wfi2lruU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFpwO6OSdLBKHvpVZre7lJ00aU_WJru8pV8yXcr0eRjwQ&oe=6A84A534",
        "height": 640,
        "width": 640
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s480x480_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwFAU1n_&_nc_oc=Adr_D-rrovYY5yIo8k1YMMXhlNH5da7G0uC8GELJ152-WJHYdwIbA9kwDt_wfi2lruU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEwZRhwQpbHQ-vkBI5X0jmX2GXrlRXnG4JTZN5weLQbdQ&oe=6A84A534",
        "height": 480,
        "width": 480
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s320x320_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwFAU1n_&_nc_oc=Adr_D-rrovYY5yIo8k1YMMXhlNH5da7G0uC8GELJ152-WJHYdwIbA9kwDt_wfi2lruU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFMKTyHRSwJsa4GwWzXJzjQmg2FSH0o77XA2SIxaSwM2A&oe=6A84A534",
        "height": 320,
        "width": 320
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s240x240_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwFAU1n_&_nc_oc=Adr_D-rrovYY5yIo8k1YMMXhlNH5da7G0uC8GELJ152-WJHYdwIbA9kwDt_wfi2lruU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFfTJtf2C2vg422ePnCFUxLEdPHMqwrhLhdcKmcnOTHnw&oe=6A84A534",
        "height": 240,
        "width": 240
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s150x150_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwFAU1n_&_nc_oc=Adr_D-rrovYY5yIo8k1YMMXhlNH5da7G0uC8GELJ152-WJHYdwIbA9kwDt_wfi2lruU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQE0b05cq5oR3ENGyRl7TKDvFk0h8jNV0zp8MdEljhoyMA&oe=6A84A534",
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
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwFAU1n_&_nc_oc=Adr_D-rrovYY5yIo8k1YMMXhlNH5da7G0uC8GELJ152-WJHYdwIbA9kwDt_wfi2lruU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQE9i8TP_KuUkdfbtMFkYnM_2QtYFNDkOTjYndWzczv-Gw&oe=6A84A534",
              "height": 1600,
              "width": 1279
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_p1080x1080_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwFAU1n_&_nc_oc=Adr_D-rrovYY5yIo8k1YMMXhlNH5da7G0uC8GELJ152-WJHYdwIbA9kwDt_wfi2lruU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEGhyeqowD5eC8pga9KwY4NMQo7cvVL1HIF2lNW4quJCA&oe=6A84A534",
              "height": 1351,
              "width": 1080
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwFAU1n_&_nc_oc=Adr_D-rrovYY5yIo8k1YMMXhlNH5da7G0uC8GELJ152-WJHYdwIbA9kwDt_wfi2lruU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHu-GsUg9WtJYCJ_2IaOt_liBk1YBv4S-YarDsKxb6UPw&oe=6A84A534",
              "height": 901,
              "width": 720
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwFAU1n_&_nc_oc=Adr_D-rrovYY5yIo8k1YMMXhlNH5da7G0uC8GELJ152-WJHYdwIbA9kwDt_wfi2lruU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQExVICm0nr8rJBIlnhq6OWvq9lDKdbwXDZOaTDomUEKHw&oe=6A84A534",
              "height": 801,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwFAU1n_&_nc_oc=Adr_D-rrovYY5yIo8k1YMMXhlNH5da7G0uC8GELJ152-WJHYdwIbA9kwDt_wfi2lruU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQE1Xv4eGhgWOLdfSv2Ac0FWMcZqheFfpnSqPOyNXHAPjg&oe=6A84A534",
              "height": 600,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwFAU1n_&_nc_oc=Adr_D-rrovYY5yIo8k1YMMXhlNH5da7G0uC8GELJ152-WJHYdwIbA9kwDt_wfi2lruU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQF9OfBxSGWovQPtXW4V46GjKlJdLTYQrUD6OdZ3a8Jflg&oe=6A84A534",
              "height": 400,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwFAU1n_&_nc_oc=Adr_D-rrovYY5yIo8k1YMMXhlNH5da7G0uC8GELJ152-WJHYdwIbA9kwDt_wfi2lruU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHGZU7Y2XWkDS7Yapg9_at7_qnbBStvzutRiJca2J8hzQ&oe=6A84A534",
              "height": 300,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwFAU1n_&_nc_oc=Adr_D-rrovYY5yIo8k1YMMXhlNH5da7G0uC8GELJ152-WJHYdwIbA9kwDt_wfi2lruU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHi-GMOHxGg2jY1VejC1zqIit2MQHoOo39PhK_l_Zunaw&oe=6A84A534",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwFAU1n_&_nc_oc=Adr_D-rrovYY5yIo8k1YMMXhlNH5da7G0uC8GELJ152-WJHYdwIbA9kwDt_wfi2lruU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFhgDQTdyRyJRWBrTfZCAnCM69rG43pCYMyD1fIibKKDw&oe=6A84A534",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwFAU1n_&_nc_oc=Adr_D-rrovYY5yIo8k1YMMXhlNH5da7G0uC8GELJ152-WJHYdwIbA9kwDt_wfi2lruU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFpwO6OSdLBKHvpVZre7lJ00aU_WJru8pV8yXcr0eRjwQ&oe=6A84A534",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s480x480_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwFAU1n_&_nc_oc=Adr_D-rrovYY5yIo8k1YMMXhlNH5da7G0uC8GELJ152-WJHYdwIbA9kwDt_wfi2lruU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEwZRhwQpbHQ-vkBI5X0jmX2GXrlRXnG4JTZN5weLQbdQ&oe=6A84A534",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s320x320_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwFAU1n_&_nc_oc=Adr_D-rrovYY5yIo8k1YMMXhlNH5da7G0uC8GELJ152-WJHYdwIbA9kwDt_wfi2lruU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFMKTyHRSwJsa4GwWzXJzjQmg2FSH0o77XA2SIxaSwM2A&oe=6A84A534",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s240x240_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwFAU1n_&_nc_oc=Adr_D-rrovYY5yIo8k1YMMXhlNH5da7G0uC8GELJ152-WJHYdwIbA9kwDt_wfi2lruU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFfTJtf2C2vg422ePnCFUxLEdPHMqwrhLhdcKmcnOTHnw&oe=6A84A534",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s150x150_tt6&_nc_cat=110&ig_cache_key=Mzk2MzM4OTk2NjkxNDIyNTUyMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Mrka6HVwDv0Q7kNvwFAU1n_&_nc_oc=Adr_D-rrovYY5yIo8k1YMMXhlNH5da7G0uC8GELJ152-WJHYdwIbA9kwDt_wfi2lruU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQE0b05cq5oR3ENGyRl7TKDvFk0h8jNV0zp8MdEljhoyMA&oe=6A84A534",
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
        "display_uri": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=dnVhxIs_J7IQ7kNvwF7SuKg&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHbHBYHM5ZZnmKiR9f-WWyZw8TYskTcu0ZK_Yjsiq7h-g&oe=6A84A534&_nc_sid=7a9f4b",
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
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774184470_18549987364074731_6828912551799453495_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=100&ig_cache_key=Mzk2MzM4OTk3MzU5MTcxMDk5NA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Tg8OKqOcftoQ7kNvwFmbgd9&_nc_oc=AdpMI3FkdHbun4lkJ6M8n4cZHWNihjID9a4AjfsFLPKgE_jNwv_pGTC-q6s9mXgzQSg&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFOM_0gAf0aliyj-MIS1RYFTdv-bY7ySCCI-54Ahej9qw&oe=6A84A1DC",
              "height": 1600,
              "width": 1279
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774184470_18549987364074731_6828912551799453495_n.jpg?stp=dst-jpg_e35_p1080x1080_tt6&_nc_cat=100&ig_cache_key=Mzk2MzM4OTk3MzU5MTcxMDk5NA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Tg8OKqOcftoQ7kNvwFmbgd9&_nc_oc=AdpMI3FkdHbun4lkJ6M8n4cZHWNihjID9a4AjfsFLPKgE_jNwv_pGTC-q6s9mXgzQSg&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQELzKhr2z2UxC3dVk5hzLWu5ikiAJovUMNLDxjyu5RTBg&oe=6A84A1DC",
              "height": 1351,
              "width": 1080
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774184470_18549987364074731_6828912551799453495_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=100&ig_cache_key=Mzk2MzM4OTk3MzU5MTcxMDk5NA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Tg8OKqOcftoQ7kNvwFmbgd9&_nc_oc=AdpMI3FkdHbun4lkJ6M8n4cZHWNihjID9a4AjfsFLPKgE_jNwv_pGTC-q6s9mXgzQSg&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQETbx7BKrqkaRRh_jMpDuWvo5EnBw1TXNGmBhPd5-ZGtw&oe=6A84A1DC",
              "height": 901,
              "width": 720
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774184470_18549987364074731_6828912551799453495_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=100&ig_cache_key=Mzk2MzM4OTk3MzU5MTcxMDk5NA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Tg8OKqOcftoQ7kNvwFmbgd9&_nc_oc=AdpMI3FkdHbun4lkJ6M8n4cZHWNihjID9a4AjfsFLPKgE_jNwv_pGTC-q6s9mXgzQSg&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFBmL_z0CvWv3Ra62-oKTKbxCP1aHL-UwFfc5rD_YO69w&oe=6A84A1DC",
              "height": 801,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774184470_18549987364074731_6828912551799453495_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=100&ig_cache_key=Mzk2MzM4OTk3MzU5MTcxMDk5NA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Tg8OKqOcftoQ7kNvwFmbgd9&_nc_oc=AdpMI3FkdHbun4lkJ6M8n4cZHWNihjID9a4AjfsFLPKgE_jNwv_pGTC-q6s9mXgzQSg&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHWkqWKTmHeKqA0LZ0YwUeIMi8mPPPIMzfDwVRDri-9xQ&oe=6A84A1DC",
              "height": 600,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774184470_18549987364074731_6828912551799453495_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=100&ig_cache_key=Mzk2MzM4OTk3MzU5MTcxMDk5NA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Tg8OKqOcftoQ7kNvwFmbgd9&_nc_oc=AdpMI3FkdHbun4lkJ6M8n4cZHWNihjID9a4AjfsFLPKgE_jNwv_pGTC-q6s9mXgzQSg&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHRw7LwzYg4SHxp2Om3EdBhD09FmkWX6GqOxYJX3yl9Vw&oe=6A84A1DC",
              "height": 400,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774184470_18549987364074731_6828912551799453495_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=100&ig_cache_key=Mzk2MzM4OTk3MzU5MTcxMDk5NA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Tg8OKqOcftoQ7kNvwFmbgd9&_nc_oc=AdpMI3FkdHbun4lkJ6M8n4cZHWNihjID9a4AjfsFLPKgE_jNwv_pGTC-q6s9mXgzQSg&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQF5-SstL_4Vvge8gCMxbxA34N1vRonBzSC-O2ccHWOFSw&oe=6A84A1DC",
              "height": 300,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774184470_18549987364074731_6828912551799453495_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=100&ig_cache_key=Mzk2MzM4OTk3MzU5MTcxMDk5NA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Tg8OKqOcftoQ7kNvwFmbgd9&_nc_oc=AdpMI3FkdHbun4lkJ6M8n4cZHWNihjID9a4AjfsFLPKgE_jNwv_pGTC-q6s9mXgzQSg&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQE_IEyBI1P8gK7xErg9ZJX7Uf7qM5eYDYRhW9VniZChmA&oe=6A84A1DC",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774184470_18549987364074731_6828912551799453495_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=100&ig_cache_key=Mzk2MzM4OTk3MzU5MTcxMDk5NA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Tg8OKqOcftoQ7kNvwFmbgd9&_nc_oc=AdpMI3FkdHbun4lkJ6M8n4cZHWNihjID9a4AjfsFLPKgE_jNwv_pGTC-q6s9mXgzQSg&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFsUNfz_Rodlir5hfJW_M_RSJhmrijM77laIryMnuI2HA&oe=6A84A1DC",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774184470_18549987364074731_6828912551799453495_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=100&ig_cache_key=Mzk2MzM4OTk3MzU5MTcxMDk5NA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Tg8OKqOcftoQ7kNvwFmbgd9&_nc_oc=AdpMI3FkdHbun4lkJ6M8n4cZHWNihjID9a4AjfsFLPKgE_jNwv_pGTC-q6s9mXgzQSg&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGCmI7W3mmgFbjSRaJ4TWBFEwhLaqLCIXhUdrqTMHvzOQ&oe=6A84A1DC",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774184470_18549987364074731_6828912551799453495_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s480x480_tt6&_nc_cat=100&ig_cache_key=Mzk2MzM4OTk3MzU5MTcxMDk5NA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Tg8OKqOcftoQ7kNvwFmbgd9&_nc_oc=AdpMI3FkdHbun4lkJ6M8n4cZHWNihjID9a4AjfsFLPKgE_jNwv_pGTC-q6s9mXgzQSg&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEtoyPhwATlQSKmDeuVqXOMSVOMukGkwf8NTU4GDnntOw&oe=6A84A1DC",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774184470_18549987364074731_6828912551799453495_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s320x320_tt6&_nc_cat=100&ig_cache_key=Mzk2MzM4OTk3MzU5MTcxMDk5NA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Tg8OKqOcftoQ7kNvwFmbgd9&_nc_oc=AdpMI3FkdHbun4lkJ6M8n4cZHWNihjID9a4AjfsFLPKgE_jNwv_pGTC-q6s9mXgzQSg&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQE02eTtByBbdfL9_3rCobRokVX3Tmwe3gFJJ2c6VIgYeg&oe=6A84A1DC",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774184470_18549987364074731_6828912551799453495_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s240x240_tt6&_nc_cat=100&ig_cache_key=Mzk2MzM4OTk3MzU5MTcxMDk5NA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Tg8OKqOcftoQ7kNvwFmbgd9&_nc_oc=AdpMI3FkdHbun4lkJ6M8n4cZHWNihjID9a4AjfsFLPKgE_jNwv_pGTC-q6s9mXgzQSg&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQG3zCyLMYbmOFLXpjCYkfoZIv_VRjphs7PDSwMaD2hkIA&oe=6A84A1DC",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774184470_18549987364074731_6828912551799453495_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s150x150_tt6&_nc_cat=100&ig_cache_key=Mzk2MzM4OTk3MzU5MTcxMDk5NA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Tg8OKqOcftoQ7kNvwFmbgd9&_nc_oc=AdpMI3FkdHbun4lkJ6M8n4cZHWNihjID9a4AjfsFLPKgE_jNwv_pGTC-q6s9mXgzQSg&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHnbr8NalkXY-JcT94tnnb_uU2ccU1EOnxdws5-R6D_GQ&oe=6A84A1DC",
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
        "display_uri": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774184470_18549987364074731_6828912551799453495_n.jpg?stp=c0.160.1279.1279a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=4KKKNZ7wuooQ7kNvwHf2ZWG&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHcLqRXZAFwLpsGAIW8dt8D8CuZAEjrSwoma4rPjEB8wQ&oe=6A84A1DC&_nc_sid=7a9f4b",
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
    "crawled_at": "2026-08-14T08:14:50.847Z"
  },
  {
    "id": "3963381371133254330_5583800796",
    "pk": "3963381371133254330",
    "type": "Video",
    "image": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774905443_18451629595184797_1785892812524699280_n.jpg?stp=c0.471.1217.1217a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=101&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=rmZ0fhDJ2kcQ7kNvwGxjlSH&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQEASJYj9myvZhbZUe38HmT7KxWvPwwIvdXc0RG4up9N7A&oe=6A848EF5&_nc_sid=7a9f4b",
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
    "like_count": 20,
    "view_count": null,
    "has_audio": true,
    "usertags": [
      {
        "user": {
          "pk": "2237970730",
          "full_name": "Pakuwon Mall Jogja",
          "username": "pakuwonmall.jogja",
          "profile_pic_url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=L9VCN6COaTMQ7kNvwEtchDb&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGtAYN3nq3QGfxuCkn1E-5A4KCex9UNKdqu4rb5CDdvxA&oe=6A84A633&_nc_sid=7a9f4b",
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
          "profile_pic_url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-19/615267211_18437987830129659_618848764352237694_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby45NTcuYzIifQ&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_cat=103&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=LIcP1SCMPJYQ7kNvwH6oyvL&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHJ--pHO2JQafnwa4t1OtQ0ZSzmFOfu2tbyBYHl44yCXA&oe=6A84B458&_nc_sid=7a9f4b",
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
          "profile_pic_url": "https://scontent-ord5-1.cdninstagram.com/v/t51.2885-19/503134034_17957002415951612_2203695640052218324_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby40NTMuYzIifQ&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=108&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=NT8hBhqAQu0Q7kNvwF74g4s&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHbIrPsIa3K6xqfoAyZoiY_uywTFj6LPIfcZJv8Q6KQ_A&oe=6A84B59D&_nc_sid=7a9f4b",
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
          "profile_pic_url": "https://scontent-ord5-2.cdninstagram.com/v/t51.2885-19/476246031_1175898783868049_2571657218397445928_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby41MDAuYzIifQ&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_cat=105&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=Bg_y-hr151cQ7kNvwEDjg5z&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQFIohu58aN2G6UpxdQx5lDl_AEZyY_A3Yb6fp7tNJujXQ&oe=6A8493D3&_nc_sid=7a9f4b",
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
          "profile_pic_url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-19/635010153_17853252258653677_2013522932633231966_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_cat=1&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=OiJqpJco89wQ7kNvwEG7FUS&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQFlFrHGRNf9QWSxVK9RHaS6IfxtgOOF67rmP-07nHJ3Vw&oe=6A84A7C3&_nc_sid=7a9f4b",
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
          "profile_pic_url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-19/764422827_18449884999184797_5609079917339959651_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=101&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=trwzeMeArjEQ7kNvwFvQpCQ&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQFdvlzujgJtMxNIKolAboeRIZ9-00GwAr6V8DFxN4ddrQ&oe=6A84870B&_nc_sid=7a9f4b"
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
      "profile_pic_url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-19/764422827_18449884999184797_5609079917339959651_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=101&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=trwzeMeArjEQ7kNvwFvQpCQ&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQFdvlzujgJtMxNIKolAboeRIZ9-00GwAr6V8DFxN4ddrQ&oe=6A84870B&_nc_sid=7a9f4b",
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
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-19/764422827_18449884999184797_5609079917339959651_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=101&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=trwzeMeArjEQ7kNvwFvQpCQ&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHjx5z3BJpFHTAjE44Pi06H5Pj4PCMFuTz9jQtBGraAuw&oe=6A84870B&_nc_sid=7a9f4b"
      },
      "__typename": "XDTUserDict",
      "full_name": "Jogja. Visit. Riview. Endorse beauty jogja"
    },
    "images": [
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774905443_18451629595184797_1785892812524699280_n.jpg?stp=dst-jpg_e15_tt6&_nc_cat=105&ig_cache_key=Mzk2MzM4MTM3MTEzMzI1NDMzMDE4NDUxNjI5NTkyMTg0Nzk3.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMTcuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=JycmgP1YCyEQ7kNvwHXRxuc&_nc_oc=AdrfKy8e3070cNvESn4RZT-5f18RbwSwfV-dYLHR7AqwuMNiRQL6M2ePXBGaE2E2XNQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEkWKn1i5qonQ86DtGYEdNaO0JW8UV9fxU8ABkBpunw_Q&oe=6A848EF5",
        "height": 2160,
        "width": 1217
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774905443_18451629595184797_1785892812524699280_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_cat=105&ig_cache_key=Mzk2MzM4MTM3MTEzMzI1NDMzMDE4NDUxNjI5NTkyMTg0Nzk3.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMTcuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=JycmgP1YCyEQ7kNvwHXRxuc&_nc_oc=AdrfKy8e3070cNvESn4RZT-5f18RbwSwfV-dYLHR7AqwuMNiRQL6M2ePXBGaE2E2XNQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGxl3r4xiEIZBgnH2tNvVa8b8h1K0llOiK6vobmRWpjKw&oe=6A848EF5",
        "height": 1917,
        "width": 1080
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774905443_18451629595184797_1785892812524699280_n.jpg?stp=dst-jpg_e35_p720x720_sh2.08_tt6&_nc_cat=105&ig_cache_key=Mzk2MzM4MTM3MTEzMzI1NDMzMDE4NDUxNjI5NTkyMTg0Nzk3.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMTcuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=JycmgP1YCyEQ7kNvwHXRxuc&_nc_oc=AdrfKy8e3070cNvESn4RZT-5f18RbwSwfV-dYLHR7AqwuMNiRQL6M2ePXBGaE2E2XNQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHfMDMNE2goJeq4QzCs8U0aZJXkS4HOFSYn0DOJWtsU5w&oe=6A848EF5",
        "height": 1278,
        "width": 720
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774905443_18451629595184797_1785892812524699280_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=105&ig_cache_key=Mzk2MzM4MTM3MTEzMzI1NDMzMDE4NDUxNjI5NTkyMTg0Nzk3.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMTcuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=JycmgP1YCyEQ7kNvwHXRxuc&_nc_oc=AdrfKy8e3070cNvESn4RZT-5f18RbwSwfV-dYLHR7AqwuMNiRQL6M2ePXBGaE2E2XNQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQF-oFgS4vkaARcnZbroWBaxd5y2Q8i6XvnrRTcTJQBySA&oe=6A848EF5",
        "height": 1136,
        "width": 640
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774905443_18451629595184797_1785892812524699280_n.jpg?stp=dst-jpg_e15_p480x480_tt6&_nc_cat=105&ig_cache_key=Mzk2MzM4MTM3MTEzMzI1NDMzMDE4NDUxNjI5NTkyMTg0Nzk3.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMTcuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=JycmgP1YCyEQ7kNvwHXRxuc&_nc_oc=AdrfKy8e3070cNvESn4RZT-5f18RbwSwfV-dYLHR7AqwuMNiRQL6M2ePXBGaE2E2XNQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEGKCtRBIoR20iTrLVXYAjLG0iM6N7RAC1mklr2aDkCpw&oe=6A848EF5",
        "height": 852,
        "width": 480
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774905443_18451629595184797_1785892812524699280_n.jpg?stp=dst-jpg_e15_p320x320_tt6&_nc_cat=105&ig_cache_key=Mzk2MzM4MTM3MTEzMzI1NDMzMDE4NDUxNjI5NTkyMTg0Nzk3.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMTcuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=JycmgP1YCyEQ7kNvwHXRxuc&_nc_oc=AdrfKy8e3070cNvESn4RZT-5f18RbwSwfV-dYLHR7AqwuMNiRQL6M2ePXBGaE2E2XNQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGdxWHTPcyAedNGNuqFJPKeNFGC5Bo24aCuy-5MqUUHgQ&oe=6A848EF5",
        "height": 568,
        "width": 320
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774905443_18451629595184797_1785892812524699280_n.jpg?stp=dst-jpg_e15_p240x240_tt6&_nc_cat=105&ig_cache_key=Mzk2MzM4MTM3MTEzMzI1NDMzMDE4NDUxNjI5NTkyMTg0Nzk3.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMTcuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=JycmgP1YCyEQ7kNvwHXRxuc&_nc_oc=AdrfKy8e3070cNvESn4RZT-5f18RbwSwfV-dYLHR7AqwuMNiRQL6M2ePXBGaE2E2XNQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHZ9qS71rNalaokTL-hMSFC1Wka3ttbV2oVZBwL0GO6rw&oe=6A848EF5",
        "height": 426,
        "width": 240
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774905443_18451629595184797_1785892812524699280_n.jpg?stp=c0.471.1217.1217a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_cat=105&ig_cache_key=Mzk2MzM4MTM3MTEzMzI1NDMzMDE4NDUxNjI5NTkyMTg0Nzk3.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMTcuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=JycmgP1YCyEQ7kNvwHXRxuc&_nc_oc=AdrfKy8e3070cNvESn4RZT-5f18RbwSwfV-dYLHR7AqwuMNiRQL6M2ePXBGaE2E2XNQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFEw0LR3Y31mgLruP7B8Tx_AOSp5RznqWLopYvO6zz08A&oe=6A848EF5",
        "height": 1080,
        "width": 1080
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774905443_18451629595184797_1785892812524699280_n.jpg?stp=c0.471.1217.1217a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=105&ig_cache_key=Mzk2MzM4MTM3MTEzMzI1NDMzMDE4NDUxNjI5NTkyMTg0Nzk3.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMTcuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=JycmgP1YCyEQ7kNvwHXRxuc&_nc_oc=AdrfKy8e3070cNvESn4RZT-5f18RbwSwfV-dYLHR7AqwuMNiRQL6M2ePXBGaE2E2XNQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQG1EWoyUlXSF9nrto7PmIkbEuL1Fw-zJfM_2zIWgUFjvQ&oe=6A848EF5",
        "height": 750,
        "width": 750
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774905443_18451629595184797_1785892812524699280_n.jpg?stp=c0.471.1217.1217a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=105&ig_cache_key=Mzk2MzM4MTM3MTEzMzI1NDMzMDE4NDUxNjI5NTkyMTg0Nzk3.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMTcuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=JycmgP1YCyEQ7kNvwHXRxuc&_nc_oc=AdrfKy8e3070cNvESn4RZT-5f18RbwSwfV-dYLHR7AqwuMNiRQL6M2ePXBGaE2E2XNQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEBtvfReurUOgxhwZ29Iwwa25KVItj7RwSYjLbFDCwglQ&oe=6A848EF5",
        "height": 640,
        "width": 640
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774905443_18451629595184797_1785892812524699280_n.jpg?stp=c0.471.1217.1217a_dst-jpg_e15_s480x480_tt6&_nc_cat=105&ig_cache_key=Mzk2MzM4MTM3MTEzMzI1NDMzMDE4NDUxNjI5NTkyMTg0Nzk3.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMTcuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=JycmgP1YCyEQ7kNvwHXRxuc&_nc_oc=AdrfKy8e3070cNvESn4RZT-5f18RbwSwfV-dYLHR7AqwuMNiRQL6M2ePXBGaE2E2XNQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQF1YVzGNPg45unaFRDz3r_m5rvEIHstl9mQzvuMLvDBTw&oe=6A848EF5",
        "height": 480,
        "width": 480
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774905443_18451629595184797_1785892812524699280_n.jpg?stp=c0.471.1217.1217a_dst-jpg_e15_s320x320_tt6&_nc_cat=105&ig_cache_key=Mzk2MzM4MTM3MTEzMzI1NDMzMDE4NDUxNjI5NTkyMTg0Nzk3.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMTcuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=JycmgP1YCyEQ7kNvwHXRxuc&_nc_oc=AdrfKy8e3070cNvESn4RZT-5f18RbwSwfV-dYLHR7AqwuMNiRQL6M2ePXBGaE2E2XNQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHnSg2CGI14Zas5v0EbK7bDD9jZwhThrHL_Zv70GSa96A&oe=6A848EF5",
        "height": 320,
        "width": 320
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774905443_18451629595184797_1785892812524699280_n.jpg?stp=c0.471.1217.1217a_dst-jpg_e15_s240x240_tt6&_nc_cat=105&ig_cache_key=Mzk2MzM4MTM3MTEzMzI1NDMzMDE4NDUxNjI5NTkyMTg0Nzk3.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMTcuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=JycmgP1YCyEQ7kNvwHXRxuc&_nc_oc=AdrfKy8e3070cNvESn4RZT-5f18RbwSwfV-dYLHR7AqwuMNiRQL6M2ePXBGaE2E2XNQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHHn2Pc7X1fl4xWRUhTfe3z1mD0B0RAwwFCgx-IBULq3Q&oe=6A848EF5",
        "height": 240,
        "width": 240
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774905443_18451629595184797_1785892812524699280_n.jpg?stp=c0.471.1217.1217a_dst-jpg_e15_s150x150_tt6&_nc_cat=105&ig_cache_key=Mzk2MzM4MTM3MTEzMzI1NDMzMDE4NDUxNjI5NTkyMTg0Nzk3.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMTcuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=JycmgP1YCyEQ7kNvwHXRxuc&_nc_oc=AdrfKy8e3070cNvESn4RZT-5f18RbwSwfV-dYLHR7AqwuMNiRQL6M2ePXBGaE2E2XNQ&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGbcvHg24UFxHpCb7O_AU8j-chLS82qz1DzxVQBhuaCtA&oe=6A848EF5",
        "height": 150,
        "width": 150
      }
    ],
    "video_versions": [
      {
        "width": 720,
        "height": 1280,
        "url": "https://scontent-ord5-1.cdninstagram.com/o1/v/t2/f2/m86/AQO9kR_ciied0fswp2LUBawsDCnx3MwCq0eQzRWkhrX76Fsi851c8-69h1KJ-fetFnVvKc6BQbgAs0rFPy9nLhoAIPX1oH06aFPIPvw.mp4?_nc_cat=101&_nc_sid=5e9851&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_ohc=KsBQAWG-Z2QQ7kNvwG_P07F&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MjUyMDgxMDU0NTA5MTgyMiwiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjozNywidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=8c2c88aa60a04e68&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC9ERTQyRTZBNzVDNzEyMzQ2MDk1MENFQzdEQUZCOTZBNF92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyL0E0NEQ5QTU0NzBFQzkzNzQyQkRDODIzQjRCQkI4MEI0X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACbc07CRvqr6CBUCKAJDMywXQEKMzMzMzM0YEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&_nc_zt=28&oh=00_AQHBnHAHt_vh5iwHvuZ1lqnbndR6A8Au-nVjbP4YT6b8gA&oe=6A80BF5E",
        "type": 101
      },
      {
        "width": 720,
        "height": 1280,
        "url": "https://scontent-ord5-1.cdninstagram.com/o1/v/t2/f2/m86/AQO9kR_ciied0fswp2LUBawsDCnx3MwCq0eQzRWkhrX76Fsi851c8-69h1KJ-fetFnVvKc6BQbgAs0rFPy9nLhoAIPX1oH06aFPIPvw.mp4?_nc_cat=101&_nc_sid=5e9851&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_ohc=KsBQAWG-Z2QQ7kNvwG_P07F&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MjUyMDgxMDU0NTA5MTgyMiwiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjozNywidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=8c2c88aa60a04e68&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC9ERTQyRTZBNzVDNzEyMzQ2MDk1MENFQzdEQUZCOTZBNF92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyL0E0NEQ5QTU0NzBFQzkzNzQyQkRDODIzQjRCQkI4MEI0X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACbc07CRvqr6CBUCKAJDMywXQEKMzMzMzM0YEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&_nc_zt=28&oh=00_AQHBnHAHt_vh5iwHvuZ1lqnbndR6A8Au-nVjbP4YT6b8gA&oe=6A80BF5E",
        "type": 102
      },
      {
        "width": 720,
        "height": 1280,
        "url": "https://scontent-ord5-1.cdninstagram.com/o1/v/t2/f2/m86/AQO9kR_ciied0fswp2LUBawsDCnx3MwCq0eQzRWkhrX76Fsi851c8-69h1KJ-fetFnVvKc6BQbgAs0rFPy9nLhoAIPX1oH06aFPIPvw.mp4?_nc_cat=101&_nc_sid=5e9851&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_ohc=KsBQAWG-Z2QQ7kNvwG_P07F&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MjUyMDgxMDU0NTA5MTgyMiwiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjozNywidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=8c2c88aa60a04e68&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC9ERTQyRTZBNzVDNzEyMzQ2MDk1MENFQzdEQUZCOTZBNF92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyL0E0NEQ5QTU0NzBFQzkzNzQyQkRDODIzQjRCQkI4MEI0X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACbc07CRvqr6CBUCKAJDMywXQEKMzMzMzM0YEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&_nc_zt=28&oh=00_AQHBnHAHt_vh5iwHvuZ1lqnbndR6A8Au-nVjbP4YT6b8gA&oe=6A80BF5E",
        "type": 103
      }
    ],
    "carousel_media_count": null,
    "carousel_media": null,
    "coauthor_producers": [
      {
        "pk": "2237970730",
        "profile_pic_url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=L9VCN6COaTMQ7kNvwEtchDb&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGtAYN3nq3QGfxuCkn1E-5A4KCex9UNKdqu4rb5CDdvxA&oe=6A84A633&_nc_sid=7a9f4b",
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
    "crawled_at": "2026-08-14T08:14:50.847Z"
  },
  {
    "id": "3963290610605662960_38851997261",
    "pk": "3963290610605662960",
    "type": "Image",
    "image": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773519823_18095763680293262_8938356023924758124_n.jpg?stp=c0.409.3277.3277a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_cat=102&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=uxVNS2ZUuKQQ7kNvwHIgV6f&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGuEEt_BKmhFyy2jB63BOQUIFir85vivxY8IBcAMfP36w&oe=6A848B24&_nc_sid=7a9f4b",
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
          "profile_pic_url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=L9VCN6COaTMQ7kNvwEtchDb&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGtAYN3nq3QGfxuCkn1E-5A4KCex9UNKdqu4rb5CDdvxA&oe=6A84A633&_nc_sid=7a9f4b",
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
      "profile_pic_url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-19/662721383_18075054686293262_6929357337730779975_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_cat=102&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=VKPv3NVqtG4Q7kNvwFSkPpr&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHw3RBM4aNzAxx7aWHh0rLEEqZLTcBeLqTfpfL3PXWRwg&oe=6A84A30C&_nc_sid=7a9f4b",
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
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-19/662721383_18075054686293262_6929357337730779975_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_cat=102&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=VKPv3NVqtG4Q7kNvwFSkPpr&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQF-gNKpgPnYoyHMIbQwO_6eJoja4GlFNlLK7AxTsLv4UA&oe=6A84A30C&_nc_sid=7a9f4b"
      },
      "__typename": "XDTUserDict",
      "full_name": "Crunchmate.id"
    },
    "images": [
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773519823_18095763680293262_8938356023924758124_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=110&ig_cache_key=Mzk2MzI5MDYxMDYwNTY2Mjk2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMzI3Ny5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=bR_QmgaA9WgQ7kNvwHZ0J1a&_nc_oc=AdqyyfKANpyNGFbOad9BhpfdtAm7bG6oor5ZUm6vccY_vlssAiFiJz3A3NXgfgJmaiA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGFJ5Qn7OnTN63zel9Tdvv1ezROppxZca5QL4EN2LW7Mw&oe=6A848B24",
        "height": 4096,
        "width": 3277
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773519823_18095763680293262_8938356023924758124_n.jpg?stp=dst-jpg_e35_p1080x1080_tt6&_nc_cat=110&ig_cache_key=Mzk2MzI5MDYxMDYwNTY2Mjk2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMzI3Ny5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=bR_QmgaA9WgQ7kNvwHZ0J1a&_nc_oc=AdqyyfKANpyNGFbOad9BhpfdtAm7bG6oor5ZUm6vccY_vlssAiFiJz3A3NXgfgJmaiA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEwiXNIKTPinrA-DdKIXFbj8WEVVRQcHaIPYOsPOu716A&oe=6A848B24",
        "height": 1350,
        "width": 1080
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773519823_18095763680293262_8938356023924758124_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=110&ig_cache_key=Mzk2MzI5MDYxMDYwNTY2Mjk2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMzI3Ny5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=bR_QmgaA9WgQ7kNvwHZ0J1a&_nc_oc=AdqyyfKANpyNGFbOad9BhpfdtAm7bG6oor5ZUm6vccY_vlssAiFiJz3A3NXgfgJmaiA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEvg-74GDNPiqQJ32u3dda1ydVaziExw7VcT85g7eJmFQ&oe=6A848B24",
        "height": 900,
        "width": 720
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773519823_18095763680293262_8938356023924758124_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=110&ig_cache_key=Mzk2MzI5MDYxMDYwNTY2Mjk2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMzI3Ny5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=bR_QmgaA9WgQ7kNvwHZ0J1a&_nc_oc=AdqyyfKANpyNGFbOad9BhpfdtAm7bG6oor5ZUm6vccY_vlssAiFiJz3A3NXgfgJmaiA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHm0MTgJezJPI0MFRktwCO5d52tkAvXKMPQ8VRbRmzmtw&oe=6A848B24",
        "height": 800,
        "width": 640
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773519823_18095763680293262_8938356023924758124_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=110&ig_cache_key=Mzk2MzI5MDYxMDYwNTY2Mjk2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMzI3Ny5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=bR_QmgaA9WgQ7kNvwHZ0J1a&_nc_oc=AdqyyfKANpyNGFbOad9BhpfdtAm7bG6oor5ZUm6vccY_vlssAiFiJz3A3NXgfgJmaiA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGvKIiCOV9JKyyCbUlvg8NIHXDggqF0n8ARH1yrBnylzA&oe=6A848B24",
        "height": 600,
        "width": 480
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773519823_18095763680293262_8938356023924758124_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=110&ig_cache_key=Mzk2MzI5MDYxMDYwNTY2Mjk2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMzI3Ny5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=bR_QmgaA9WgQ7kNvwHZ0J1a&_nc_oc=AdqyyfKANpyNGFbOad9BhpfdtAm7bG6oor5ZUm6vccY_vlssAiFiJz3A3NXgfgJmaiA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHm_E7B5HVx5-t_2ZQZNiNn2uBPfV5WpsCBiF6VkjotbQ&oe=6A848B24",
        "height": 400,
        "width": 320
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773519823_18095763680293262_8938356023924758124_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=110&ig_cache_key=Mzk2MzI5MDYxMDYwNTY2Mjk2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMzI3Ny5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=bR_QmgaA9WgQ7kNvwHZ0J1a&_nc_oc=AdqyyfKANpyNGFbOad9BhpfdtAm7bG6oor5ZUm6vccY_vlssAiFiJz3A3NXgfgJmaiA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEwFmUSdv3Db_dQ8lXR8Y-k3ZAg8870M4vWqV9a9kgY3Q&oe=6A848B24",
        "height": 300,
        "width": 240
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773519823_18095763680293262_8938356023924758124_n.jpg?stp=c0.409.3277.3277a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=110&ig_cache_key=Mzk2MzI5MDYxMDYwNTY2Mjk2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMzI3Ny5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=bR_QmgaA9WgQ7kNvwHZ0J1a&_nc_oc=AdqyyfKANpyNGFbOad9BhpfdtAm7bG6oor5ZUm6vccY_vlssAiFiJz3A3NXgfgJmaiA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGkY_TYYdMT-1p75Mwno6VhU7c7qrdeMMjF_bxdh0UHSQ&oe=6A848B24",
        "height": 1080,
        "width": 1080
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773519823_18095763680293262_8938356023924758124_n.jpg?stp=c0.409.3277.3277a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=110&ig_cache_key=Mzk2MzI5MDYxMDYwNTY2Mjk2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMzI3Ny5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=bR_QmgaA9WgQ7kNvwHZ0J1a&_nc_oc=AdqyyfKANpyNGFbOad9BhpfdtAm7bG6oor5ZUm6vccY_vlssAiFiJz3A3NXgfgJmaiA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEBPDl82hCio8hPSm4sbYys5ZL14VQHMoYU-Uxb94sOCg&oe=6A848B24",
        "height": 750,
        "width": 750
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773519823_18095763680293262_8938356023924758124_n.jpg?stp=c0.409.3277.3277a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=110&ig_cache_key=Mzk2MzI5MDYxMDYwNTY2Mjk2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMzI3Ny5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=bR_QmgaA9WgQ7kNvwHZ0J1a&_nc_oc=AdqyyfKANpyNGFbOad9BhpfdtAm7bG6oor5ZUm6vccY_vlssAiFiJz3A3NXgfgJmaiA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEzJWBssuKfvPL59Il0ulFsp9gmOXsZCDJUFfJZeGKJmg&oe=6A848B24",
        "height": 640,
        "width": 640
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773519823_18095763680293262_8938356023924758124_n.jpg?stp=c0.409.3277.3277a_dst-jpg_e35_s480x480_tt6&_nc_cat=110&ig_cache_key=Mzk2MzI5MDYxMDYwNTY2Mjk2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMzI3Ny5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=bR_QmgaA9WgQ7kNvwHZ0J1a&_nc_oc=AdqyyfKANpyNGFbOad9BhpfdtAm7bG6oor5ZUm6vccY_vlssAiFiJz3A3NXgfgJmaiA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGVsE9hAYxXLgxn6m2v96hjwNaqIb53SaxUmaN-qXbqXw&oe=6A848B24",
        "height": 480,
        "width": 480
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773519823_18095763680293262_8938356023924758124_n.jpg?stp=c0.409.3277.3277a_dst-jpg_e35_s320x320_tt6&_nc_cat=110&ig_cache_key=Mzk2MzI5MDYxMDYwNTY2Mjk2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMzI3Ny5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=bR_QmgaA9WgQ7kNvwHZ0J1a&_nc_oc=AdqyyfKANpyNGFbOad9BhpfdtAm7bG6oor5ZUm6vccY_vlssAiFiJz3A3NXgfgJmaiA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQF7WMWxxelIJRfIlMf_GwSotLcFBe-gOwvDHjrEjvUDeQ&oe=6A848B24",
        "height": 320,
        "width": 320
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773519823_18095763680293262_8938356023924758124_n.jpg?stp=c0.409.3277.3277a_dst-jpg_e35_s240x240_tt6&_nc_cat=110&ig_cache_key=Mzk2MzI5MDYxMDYwNTY2Mjk2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMzI3Ny5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=bR_QmgaA9WgQ7kNvwHZ0J1a&_nc_oc=AdqyyfKANpyNGFbOad9BhpfdtAm7bG6oor5ZUm6vccY_vlssAiFiJz3A3NXgfgJmaiA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEekgMbTuRKc0hvI0ZEssLwMKinoQA-f7mP1ybrSraaQQ&oe=6A848B24",
        "height": 240,
        "width": 240
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773519823_18095763680293262_8938356023924758124_n.jpg?stp=c0.409.3277.3277a_dst-jpg_e35_s150x150_tt6&_nc_cat=110&ig_cache_key=Mzk2MzI5MDYxMDYwNTY2Mjk2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMzI3Ny5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=bR_QmgaA9WgQ7kNvwHZ0J1a&_nc_oc=AdqyyfKANpyNGFbOad9BhpfdtAm7bG6oor5ZUm6vccY_vlssAiFiJz3A3NXgfgJmaiA&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEwGVxOiqQPASvQ3Re7DrMOmydp-Omw59H9d1jVvZY-Ig&oe=6A848B24",
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
        "profile_pic_url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=L9VCN6COaTMQ7kNvwEtchDb&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGtAYN3nq3QGfxuCkn1E-5A4KCex9UNKdqu4rb5CDdvxA&oe=6A84A633&_nc_sid=7a9f4b",
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
    "crawled_at": "2026-08-14T08:14:50.847Z"
  },
  {
    "id": "3963231873169665456_38851997261",
    "pk": "3963231873169665456",
    "type": "Image",
    "image": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773686629_18095748581293262_1334211002783647391_n.jpg?stp=c0.169.1350.1350a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_cat=102&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=RuYm3rFB_h8Q7kNvwHWEUoz&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQFZXwMUQsQ6F9BTuBWxJgAlDuUZIuHPsDlIVqk1Rn13Gg&oe=6A84AE37&_nc_sid=7a9f4b",
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
          "profile_pic_url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=L9VCN6COaTMQ7kNvwEtchDb&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGtAYN3nq3QGfxuCkn1E-5A4KCex9UNKdqu4rb5CDdvxA&oe=6A84A633&_nc_sid=7a9f4b",
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
      "profile_pic_url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-19/662721383_18075054686293262_6929357337730779975_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_cat=102&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=VKPv3NVqtG4Q7kNvwFSkPpr&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHw3RBM4aNzAxx7aWHh0rLEEqZLTcBeLqTfpfL3PXWRwg&oe=6A84A30C&_nc_sid=7a9f4b",
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
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-19/662721383_18075054686293262_6929357337730779975_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_cat=102&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=VKPv3NVqtG4Q7kNvwFSkPpr&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQF-gNKpgPnYoyHMIbQwO_6eJoja4GlFNlLK7AxTsLv4UA&oe=6A84A30C&_nc_sid=7a9f4b"
      },
      "__typename": "XDTUserDict",
      "full_name": "Crunchmate.id"
    },
    "images": [
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773686629_18095748581293262_1334211002783647391_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=111&ig_cache_key=Mzk2MzIzMTg3MzE2OTY2NTQ1Ng%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=9WICmp3CiZAQ7kNvwGrPXyO&_nc_oc=AdoDYCSvA5NeV6jOkBa2CeXMuhcAYa3E9_LyfWgP0e3dOCYJwGpVJOhEqtXvqUd1UWk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGfKhD2vc8ARZODhA6tgYrXWLdOsCmH9b3NYwwPLJ7LYQ&oe=6A84AE37",
        "height": 1688,
        "width": 1350
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773686629_18095748581293262_1334211002783647391_n.jpg?stp=dst-jpg_e35_p1080x1080_tt6&_nc_cat=111&ig_cache_key=Mzk2MzIzMTg3MzE2OTY2NTQ1Ng%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=9WICmp3CiZAQ7kNvwGrPXyO&_nc_oc=AdoDYCSvA5NeV6jOkBa2CeXMuhcAYa3E9_LyfWgP0e3dOCYJwGpVJOhEqtXvqUd1UWk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHPur9lr5L5m2C4NBuzuWB7q1diZKlAJA4xyS2BBK7D0Q&oe=6A84AE37",
        "height": 1350,
        "width": 1080
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773686629_18095748581293262_1334211002783647391_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=111&ig_cache_key=Mzk2MzIzMTg3MzE2OTY2NTQ1Ng%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=9WICmp3CiZAQ7kNvwGrPXyO&_nc_oc=AdoDYCSvA5NeV6jOkBa2CeXMuhcAYa3E9_LyfWgP0e3dOCYJwGpVJOhEqtXvqUd1UWk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHRJiSxnA7Y-nE_58jkfK9aUzZgnaSZaDlsWdVTYXVZWA&oe=6A84AE37",
        "height": 900,
        "width": 720
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773686629_18095748581293262_1334211002783647391_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=111&ig_cache_key=Mzk2MzIzMTg3MzE2OTY2NTQ1Ng%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=9WICmp3CiZAQ7kNvwGrPXyO&_nc_oc=AdoDYCSvA5NeV6jOkBa2CeXMuhcAYa3E9_LyfWgP0e3dOCYJwGpVJOhEqtXvqUd1UWk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEMd6eVu1qsCOEiH6vNjx5rJLyp9wsbG6L4vp8_VNc_nA&oe=6A84AE37",
        "height": 800,
        "width": 640
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773686629_18095748581293262_1334211002783647391_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=111&ig_cache_key=Mzk2MzIzMTg3MzE2OTY2NTQ1Ng%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=9WICmp3CiZAQ7kNvwGrPXyO&_nc_oc=AdoDYCSvA5NeV6jOkBa2CeXMuhcAYa3E9_LyfWgP0e3dOCYJwGpVJOhEqtXvqUd1UWk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEHEG5Etxb4hWm0IwlwrEXBT23EQT4uTTCjmH4iLZ8Dww&oe=6A84AE37",
        "height": 600,
        "width": 480
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773686629_18095748581293262_1334211002783647391_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=111&ig_cache_key=Mzk2MzIzMTg3MzE2OTY2NTQ1Ng%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=9WICmp3CiZAQ7kNvwGrPXyO&_nc_oc=AdoDYCSvA5NeV6jOkBa2CeXMuhcAYa3E9_LyfWgP0e3dOCYJwGpVJOhEqtXvqUd1UWk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGu4f0lyv3vRGDH6fQaJ8M4MmyYo4sGKM-9ET5fmoHGNQ&oe=6A84AE37",
        "height": 400,
        "width": 320
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773686629_18095748581293262_1334211002783647391_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=111&ig_cache_key=Mzk2MzIzMTg3MzE2OTY2NTQ1Ng%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=9WICmp3CiZAQ7kNvwGrPXyO&_nc_oc=AdoDYCSvA5NeV6jOkBa2CeXMuhcAYa3E9_LyfWgP0e3dOCYJwGpVJOhEqtXvqUd1UWk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGMofu5rKr7OhXAajEr6oQB6tQtaGB_FajjTXn6jpRPIA&oe=6A84AE37",
        "height": 300,
        "width": 240
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773686629_18095748581293262_1334211002783647391_n.jpg?stp=c0.169.1350.1350a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=111&ig_cache_key=Mzk2MzIzMTg3MzE2OTY2NTQ1Ng%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=9WICmp3CiZAQ7kNvwGrPXyO&_nc_oc=AdoDYCSvA5NeV6jOkBa2CeXMuhcAYa3E9_LyfWgP0e3dOCYJwGpVJOhEqtXvqUd1UWk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHX4GzFacGwawCC55OaMoCOLKN81NhMwpMJhK3mSMPWmw&oe=6A84AE37",
        "height": 1080,
        "width": 1080
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773686629_18095748581293262_1334211002783647391_n.jpg?stp=c0.169.1350.1350a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=111&ig_cache_key=Mzk2MzIzMTg3MzE2OTY2NTQ1Ng%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=9WICmp3CiZAQ7kNvwGrPXyO&_nc_oc=AdoDYCSvA5NeV6jOkBa2CeXMuhcAYa3E9_LyfWgP0e3dOCYJwGpVJOhEqtXvqUd1UWk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQENFeBIgcwqJLWmk4DBUW5UUzqlOWuLZBm8HQMKhiH0Sw&oe=6A84AE37",
        "height": 750,
        "width": 750
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773686629_18095748581293262_1334211002783647391_n.jpg?stp=c0.169.1350.1350a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=111&ig_cache_key=Mzk2MzIzMTg3MzE2OTY2NTQ1Ng%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=9WICmp3CiZAQ7kNvwGrPXyO&_nc_oc=AdoDYCSvA5NeV6jOkBa2CeXMuhcAYa3E9_LyfWgP0e3dOCYJwGpVJOhEqtXvqUd1UWk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGScrf9tYbVQ0whGayzOt1FGv_Z-sFCjq18LIfTJ7LM5w&oe=6A84AE37",
        "height": 640,
        "width": 640
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773686629_18095748581293262_1334211002783647391_n.jpg?stp=c0.169.1350.1350a_dst-jpg_e35_s480x480_tt6&_nc_cat=111&ig_cache_key=Mzk2MzIzMTg3MzE2OTY2NTQ1Ng%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=9WICmp3CiZAQ7kNvwGrPXyO&_nc_oc=AdoDYCSvA5NeV6jOkBa2CeXMuhcAYa3E9_LyfWgP0e3dOCYJwGpVJOhEqtXvqUd1UWk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEEUxAGLFgLnZ8tOdAg7qi_vz6LPzg5e_NsQ-5_up-dmw&oe=6A84AE37",
        "height": 480,
        "width": 480
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773686629_18095748581293262_1334211002783647391_n.jpg?stp=c0.169.1350.1350a_dst-jpg_e35_s320x320_tt6&_nc_cat=111&ig_cache_key=Mzk2MzIzMTg3MzE2OTY2NTQ1Ng%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=9WICmp3CiZAQ7kNvwGrPXyO&_nc_oc=AdoDYCSvA5NeV6jOkBa2CeXMuhcAYa3E9_LyfWgP0e3dOCYJwGpVJOhEqtXvqUd1UWk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFj9JqD1WMbg6eoaDqD6r6e83h6sVsmNk_ggE_eXMO2Yg&oe=6A84AE37",
        "height": 320,
        "width": 320
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773686629_18095748581293262_1334211002783647391_n.jpg?stp=c0.169.1350.1350a_dst-jpg_e35_s240x240_tt6&_nc_cat=111&ig_cache_key=Mzk2MzIzMTg3MzE2OTY2NTQ1Ng%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=9WICmp3CiZAQ7kNvwGrPXyO&_nc_oc=AdoDYCSvA5NeV6jOkBa2CeXMuhcAYa3E9_LyfWgP0e3dOCYJwGpVJOhEqtXvqUd1UWk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFxVAaU22IAfFfGw7UPKMAKJWvlywM-SM1AMqAMFscedA&oe=6A84AE37",
        "height": 240,
        "width": 240
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773686629_18095748581293262_1334211002783647391_n.jpg?stp=c0.169.1350.1350a_dst-jpg_e35_s150x150_tt6&_nc_cat=111&ig_cache_key=Mzk2MzIzMTg3MzE2OTY2NTQ1Ng%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=9WICmp3CiZAQ7kNvwGrPXyO&_nc_oc=AdoDYCSvA5NeV6jOkBa2CeXMuhcAYa3E9_LyfWgP0e3dOCYJwGpVJOhEqtXvqUd1UWk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQG4xv50gKCiUqcasrkyTCjj3taA5UiEfK_N6fvO1lP9ww&oe=6A84AE37",
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
        "profile_pic_url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=L9VCN6COaTMQ7kNvwEtchDb&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGtAYN3nq3QGfxuCkn1E-5A4KCex9UNKdqu4rb5CDdvxA&oe=6A84A633&_nc_sid=7a9f4b",
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
    "crawled_at": "2026-08-14T08:14:50.847Z"
  },
  {
    "id": "3963187739466369600_2237970730",
    "pk": "3963187739466369600",
    "type": "Image",
    "image": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e15_fr_s1080x1080_tt6&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=RFZqVCccIfcQ7kNvwHNh30B&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHj3h8IjYUHpqeEeWfC3NW4gq4q3n7CozvCU1z1lynDQQ&oe=6A84A629&_nc_sid=7a9f4b",
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
      "profile_pic_url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=L9VCN6COaTMQ7kNvwEtchDb&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGtAYN3nq3QGfxuCkn1E-5A4KCex9UNKdqu4rb5CDdvxA&oe=6A84A633&_nc_sid=7a9f4b",
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
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=L9VCN6COaTMQ7kNvwEtchDb&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHlusG19xf_r4IJPwxyrxIMODZbnUgAD9M5lUitKOejtQ&oe=6A84A633&_nc_sid=7a9f4b"
      },
      "__typename": "XDTUserDict",
      "full_name": "Pakuwon Mall Jogja"
    },
    "images": [
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwGPPwGo&_nc_oc=Adq8Q6mX0iBWSwn7KKZNgFMIdISWNvhp-fblANXZDMx45Q1mvkAr6WknEw2ESXbOD7c&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQE59P-2KvAuW0NkvilnUIGDb9t_1-tPZ_I3Rbi5_6Lqnw&oe=6A84A629",
        "height": 1350,
        "width": 1080
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwGPPwGo&_nc_oc=Adq8Q6mX0iBWSwn7KKZNgFMIdISWNvhp-fblANXZDMx45Q1mvkAr6WknEw2ESXbOD7c&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHrxYyzCnkVoeS6KGDEdWVsLd_ZwQDKSC7Dq-STCBrCCw&oe=6A84A629",
        "height": 900,
        "width": 720
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwGPPwGo&_nc_oc=Adq8Q6mX0iBWSwn7KKZNgFMIdISWNvhp-fblANXZDMx45Q1mvkAr6WknEw2ESXbOD7c&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFxLmWh6UWXtJDFj9L4Ng1-qm8Y5xNT6ncmPg1X3hHHwQ&oe=6A84A629",
        "height": 800,
        "width": 640
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwGPPwGo&_nc_oc=Adq8Q6mX0iBWSwn7KKZNgFMIdISWNvhp-fblANXZDMx45Q1mvkAr6WknEw2ESXbOD7c&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQE3J5ZBadwknAI368L_6mfZ85ysXCMtJjRLLwy8jkLSYw&oe=6A84A629",
        "height": 600,
        "width": 480
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwGPPwGo&_nc_oc=Adq8Q6mX0iBWSwn7KKZNgFMIdISWNvhp-fblANXZDMx45Q1mvkAr6WknEw2ESXbOD7c&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGlLa9eApMtqwiUjG6BQpm08bhmqSFbi3hXFZgAcehV_Q&oe=6A84A629",
        "height": 400,
        "width": 320
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwGPPwGo&_nc_oc=Adq8Q6mX0iBWSwn7KKZNgFMIdISWNvhp-fblANXZDMx45Q1mvkAr6WknEw2ESXbOD7c&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQESOYok2YZN_z-UI1-Kon6K-gksS0nOtmKn23XIRmCc2w&oe=6A84A629",
        "height": 300,
        "width": 240
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwGPPwGo&_nc_oc=Adq8Q6mX0iBWSwn7KKZNgFMIdISWNvhp-fblANXZDMx45Q1mvkAr6WknEw2ESXbOD7c&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFu4iunkGegqieofsdKRMVSOZ7Cq1tgL1KQhWXf9MK3pA&oe=6A84A629",
        "height": 1080,
        "width": 1080
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwGPPwGo&_nc_oc=Adq8Q6mX0iBWSwn7KKZNgFMIdISWNvhp-fblANXZDMx45Q1mvkAr6WknEw2ESXbOD7c&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHorXJxSFX-b0sZhHXuQoWia2mEJpiQe156YTFWQYTFlQ&oe=6A84A629",
        "height": 750,
        "width": 750
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwGPPwGo&_nc_oc=Adq8Q6mX0iBWSwn7KKZNgFMIdISWNvhp-fblANXZDMx45Q1mvkAr6WknEw2ESXbOD7c&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQF1AQKfVYZUFEnUHlayJh5Ac_Ut3HyU2RSbvFpAJhRMyQ&oe=6A84A629",
        "height": 640,
        "width": 640
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s480x480_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwGPPwGo&_nc_oc=Adq8Q6mX0iBWSwn7KKZNgFMIdISWNvhp-fblANXZDMx45Q1mvkAr6WknEw2ESXbOD7c&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQF8jG_QBXVrMckDXcFrhkUVS6IU1lt0uBtJ9wa8kL2XYA&oe=6A84A629",
        "height": 480,
        "width": 480
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s320x320_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwGPPwGo&_nc_oc=Adq8Q6mX0iBWSwn7KKZNgFMIdISWNvhp-fblANXZDMx45Q1mvkAr6WknEw2ESXbOD7c&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHNA0l-yansKpqyRwkXUVXYu6IcqERXZt_mhP0j6hAhOg&oe=6A84A629",
        "height": 320,
        "width": 320
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s240x240_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwGPPwGo&_nc_oc=Adq8Q6mX0iBWSwn7KKZNgFMIdISWNvhp-fblANXZDMx45Q1mvkAr6WknEw2ESXbOD7c&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFTOfvz6BUkANiz3oJyhCXEtzeJ0JsQ7qinD16FaibshA&oe=6A84A629",
        "height": 240,
        "width": 240
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s150x150_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwGPPwGo&_nc_oc=Adq8Q6mX0iBWSwn7KKZNgFMIdISWNvhp-fblANXZDMx45Q1mvkAr6WknEw2ESXbOD7c&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFcFQRaFTnfzYvf_30u6eLqjYQ39Xd51bg7Jmc8BusaaQ&oe=6A84A629",
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
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwGPPwGo&_nc_oc=Adq8Q6mX0iBWSwn7KKZNgFMIdISWNvhp-fblANXZDMx45Q1mvkAr6WknEw2ESXbOD7c&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQE59P-2KvAuW0NkvilnUIGDb9t_1-tPZ_I3Rbi5_6Lqnw&oe=6A84A629",
              "height": 1350,
              "width": 1080
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwGPPwGo&_nc_oc=Adq8Q6mX0iBWSwn7KKZNgFMIdISWNvhp-fblANXZDMx45Q1mvkAr6WknEw2ESXbOD7c&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHrxYyzCnkVoeS6KGDEdWVsLd_ZwQDKSC7Dq-STCBrCCw&oe=6A84A629",
              "height": 900,
              "width": 720
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwGPPwGo&_nc_oc=Adq8Q6mX0iBWSwn7KKZNgFMIdISWNvhp-fblANXZDMx45Q1mvkAr6WknEw2ESXbOD7c&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFxLmWh6UWXtJDFj9L4Ng1-qm8Y5xNT6ncmPg1X3hHHwQ&oe=6A84A629",
              "height": 800,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwGPPwGo&_nc_oc=Adq8Q6mX0iBWSwn7KKZNgFMIdISWNvhp-fblANXZDMx45Q1mvkAr6WknEw2ESXbOD7c&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQE3J5ZBadwknAI368L_6mfZ85ysXCMtJjRLLwy8jkLSYw&oe=6A84A629",
              "height": 600,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwGPPwGo&_nc_oc=Adq8Q6mX0iBWSwn7KKZNgFMIdISWNvhp-fblANXZDMx45Q1mvkAr6WknEw2ESXbOD7c&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGlLa9eApMtqwiUjG6BQpm08bhmqSFbi3hXFZgAcehV_Q&oe=6A84A629",
              "height": 400,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwGPPwGo&_nc_oc=Adq8Q6mX0iBWSwn7KKZNgFMIdISWNvhp-fblANXZDMx45Q1mvkAr6WknEw2ESXbOD7c&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQESOYok2YZN_z-UI1-Kon6K-gksS0nOtmKn23XIRmCc2w&oe=6A84A629",
              "height": 300,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwGPPwGo&_nc_oc=Adq8Q6mX0iBWSwn7KKZNgFMIdISWNvhp-fblANXZDMx45Q1mvkAr6WknEw2ESXbOD7c&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFu4iunkGegqieofsdKRMVSOZ7Cq1tgL1KQhWXf9MK3pA&oe=6A84A629",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwGPPwGo&_nc_oc=Adq8Q6mX0iBWSwn7KKZNgFMIdISWNvhp-fblANXZDMx45Q1mvkAr6WknEw2ESXbOD7c&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHorXJxSFX-b0sZhHXuQoWia2mEJpiQe156YTFWQYTFlQ&oe=6A84A629",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwGPPwGo&_nc_oc=Adq8Q6mX0iBWSwn7KKZNgFMIdISWNvhp-fblANXZDMx45Q1mvkAr6WknEw2ESXbOD7c&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQF1AQKfVYZUFEnUHlayJh5Ac_Ut3HyU2RSbvFpAJhRMyQ&oe=6A84A629",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s480x480_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwGPPwGo&_nc_oc=Adq8Q6mX0iBWSwn7KKZNgFMIdISWNvhp-fblANXZDMx45Q1mvkAr6WknEw2ESXbOD7c&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQF8jG_QBXVrMckDXcFrhkUVS6IU1lt0uBtJ9wa8kL2XYA&oe=6A84A629",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s320x320_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwGPPwGo&_nc_oc=Adq8Q6mX0iBWSwn7KKZNgFMIdISWNvhp-fblANXZDMx45Q1mvkAr6WknEw2ESXbOD7c&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHNA0l-yansKpqyRwkXUVXYu6IcqERXZt_mhP0j6hAhOg&oe=6A84A629",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s240x240_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwGPPwGo&_nc_oc=Adq8Q6mX0iBWSwn7KKZNgFMIdISWNvhp-fblANXZDMx45Q1mvkAr6WknEw2ESXbOD7c&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFTOfvz6BUkANiz3oJyhCXEtzeJ0JsQ7qinD16FaibshA&oe=6A84A629",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s150x150_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=HXnqHy3AzoEQ7kNvwGPPwGo&_nc_oc=Adq8Q6mX0iBWSwn7KKZNgFMIdISWNvhp-fblANXZDMx45Q1mvkAr6WknEw2ESXbOD7c&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFcFQRaFTnfzYvf_30u6eLqjYQ39Xd51bg7Jmc8BusaaQ&oe=6A84A629",
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
        "display_uri": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e15_fr_s1080x1080_tt6&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=RFZqVCccIfcQ7kNvwHNh30B&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHj3h8IjYUHpqeEeWfC3NW4gq4q3n7CozvCU1z1lynDQQ&oe=6A84A629&_nc_sid=7a9f4b",
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
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773714201_18549917278074731_831497186886304937_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=107&ig_cache_key=Mzk2MzE4NzEyMTA1MzUzMjY2Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wmOiCYwiW8kQ7kNvwFTTG1L&_nc_oc=Adr4juAJNooSyCnY3t-x-xiPkWTJmPJ_xZe_u8LMz_JlE840y4SAMWmpDmPOtKLUwH4&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHE92t6w7U2hJSF6hW4lF3GVg2uzSRJU-yiBlFy9qGcQA&oe=6A84ADA1",
              "height": 1350,
              "width": 1080
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773714201_18549917278074731_831497186886304937_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=107&ig_cache_key=Mzk2MzE4NzEyMTA1MzUzMjY2Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wmOiCYwiW8kQ7kNvwFTTG1L&_nc_oc=Adr4juAJNooSyCnY3t-x-xiPkWTJmPJ_xZe_u8LMz_JlE840y4SAMWmpDmPOtKLUwH4&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGMvMB-WbFv0mhX4j77wP-TnjcesinVPDsSBUK4KFBEOw&oe=6A84ADA1",
              "height": 900,
              "width": 720
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773714201_18549917278074731_831497186886304937_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=107&ig_cache_key=Mzk2MzE4NzEyMTA1MzUzMjY2Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wmOiCYwiW8kQ7kNvwFTTG1L&_nc_oc=Adr4juAJNooSyCnY3t-x-xiPkWTJmPJ_xZe_u8LMz_JlE840y4SAMWmpDmPOtKLUwH4&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHFVtG9ob6iOLtQM-_jORhUxXcDDnwOr1caGs00wwiqjA&oe=6A84ADA1",
              "height": 800,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773714201_18549917278074731_831497186886304937_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=107&ig_cache_key=Mzk2MzE4NzEyMTA1MzUzMjY2Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wmOiCYwiW8kQ7kNvwFTTG1L&_nc_oc=Adr4juAJNooSyCnY3t-x-xiPkWTJmPJ_xZe_u8LMz_JlE840y4SAMWmpDmPOtKLUwH4&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGCwthm6AsZLo3IG8dFjSnSBdsyu0TrzvxYqif3_6gGvQ&oe=6A84ADA1",
              "height": 600,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773714201_18549917278074731_831497186886304937_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=107&ig_cache_key=Mzk2MzE4NzEyMTA1MzUzMjY2Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wmOiCYwiW8kQ7kNvwFTTG1L&_nc_oc=Adr4juAJNooSyCnY3t-x-xiPkWTJmPJ_xZe_u8LMz_JlE840y4SAMWmpDmPOtKLUwH4&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQElS4l8slv-66Xn_ujOXav6axP80fB2T_R9K6ZFGEmrqw&oe=6A84ADA1",
              "height": 400,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773714201_18549917278074731_831497186886304937_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=107&ig_cache_key=Mzk2MzE4NzEyMTA1MzUzMjY2Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wmOiCYwiW8kQ7kNvwFTTG1L&_nc_oc=Adr4juAJNooSyCnY3t-x-xiPkWTJmPJ_xZe_u8LMz_JlE840y4SAMWmpDmPOtKLUwH4&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGjl_lyLRzgXK1VYE18drqB3d1W4wLSxbGQ1TuzQP_gXA&oe=6A84ADA1",
              "height": 300,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773714201_18549917278074731_831497186886304937_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=107&ig_cache_key=Mzk2MzE4NzEyMTA1MzUzMjY2Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wmOiCYwiW8kQ7kNvwFTTG1L&_nc_oc=Adr4juAJNooSyCnY3t-x-xiPkWTJmPJ_xZe_u8LMz_JlE840y4SAMWmpDmPOtKLUwH4&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGcvm55yEQEuJCaC6xBESgy8Ic2caRNyMtWwmZ2aJ-59w&oe=6A84ADA1",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773714201_18549917278074731_831497186886304937_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=107&ig_cache_key=Mzk2MzE4NzEyMTA1MzUzMjY2Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wmOiCYwiW8kQ7kNvwFTTG1L&_nc_oc=Adr4juAJNooSyCnY3t-x-xiPkWTJmPJ_xZe_u8LMz_JlE840y4SAMWmpDmPOtKLUwH4&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHv-qyyAj6o01_ep07-RR-2V0m5jciNg_vMuZlhuefCiw&oe=6A84ADA1",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773714201_18549917278074731_831497186886304937_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=107&ig_cache_key=Mzk2MzE4NzEyMTA1MzUzMjY2Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wmOiCYwiW8kQ7kNvwFTTG1L&_nc_oc=Adr4juAJNooSyCnY3t-x-xiPkWTJmPJ_xZe_u8LMz_JlE840y4SAMWmpDmPOtKLUwH4&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEPukeuWIvKgPjFPOGTkQRnk2TLHlIrjX81BSSWsbVKSg&oe=6A84ADA1",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773714201_18549917278074731_831497186886304937_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s480x480_tt6&_nc_cat=107&ig_cache_key=Mzk2MzE4NzEyMTA1MzUzMjY2Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wmOiCYwiW8kQ7kNvwFTTG1L&_nc_oc=Adr4juAJNooSyCnY3t-x-xiPkWTJmPJ_xZe_u8LMz_JlE840y4SAMWmpDmPOtKLUwH4&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGRxno483ulHpM5MEXmWXWMSbnLq0obeN0w3U60xDGtyQ&oe=6A84ADA1",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773714201_18549917278074731_831497186886304937_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s320x320_tt6&_nc_cat=107&ig_cache_key=Mzk2MzE4NzEyMTA1MzUzMjY2Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wmOiCYwiW8kQ7kNvwFTTG1L&_nc_oc=Adr4juAJNooSyCnY3t-x-xiPkWTJmPJ_xZe_u8LMz_JlE840y4SAMWmpDmPOtKLUwH4&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFN5h1PEk3j59lkvfZvyNRYWomgcL_gy58L0ThyIETbqQ&oe=6A84ADA1",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773714201_18549917278074731_831497186886304937_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s240x240_tt6&_nc_cat=107&ig_cache_key=Mzk2MzE4NzEyMTA1MzUzMjY2Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wmOiCYwiW8kQ7kNvwFTTG1L&_nc_oc=Adr4juAJNooSyCnY3t-x-xiPkWTJmPJ_xZe_u8LMz_JlE840y4SAMWmpDmPOtKLUwH4&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFFEC3J6xPEExH1BM9ghUPNH7-wdUXmoG46TfbjDulNWw&oe=6A84ADA1",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773714201_18549917278074731_831497186886304937_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s150x150_tt6&_nc_cat=107&ig_cache_key=Mzk2MzE4NzEyMTA1MzUzMjY2Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wmOiCYwiW8kQ7kNvwFTTG1L&_nc_oc=Adr4juAJNooSyCnY3t-x-xiPkWTJmPJ_xZe_u8LMz_JlE840y4SAMWmpDmPOtKLUwH4&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQG-BW_wCOWnVNRDtEB-MaP8k9wKSrukBL9KK9S4OnNlIg&oe=6A84ADA1",
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
        "display_uri": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773714201_18549917278074731_831497186886304937_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e15_fr_s1080x1080_tt6&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=wszykQOiUNoQ7kNvwGbpmx0&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQFP3oGpluV5siiqYHYtCwC5UYGpbBZUUSs1ofwdO_Tpyg&oe=6A84ADA1&_nc_sid=7a9f4b",
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
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773811749_18549917314074731_2734247693651828101_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=101&ig_cache_key=Mzk2MzE4NzEyMTU5MDYyNjcwNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=yB-hhIAUWKUQ7kNvwHTKTVP&_nc_oc=AdrePaf1GR7zD5RygouC1VcjJjkaT0kaY3iFiVW5LZHF2K2ANz9fuui2m0Vy2qEZsAk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQETgcRLJ_Y6yhOMjAPwCDKpxSLm0R9YsSJ8pPNRpYrqiQ&oe=6A848D82",
              "height": 1350,
              "width": 1080
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773811749_18549917314074731_2734247693651828101_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=101&ig_cache_key=Mzk2MzE4NzEyMTU5MDYyNjcwNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=yB-hhIAUWKUQ7kNvwHTKTVP&_nc_oc=AdrePaf1GR7zD5RygouC1VcjJjkaT0kaY3iFiVW5LZHF2K2ANz9fuui2m0Vy2qEZsAk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGXiKbwPFTVdoynopIHxBvok0zC6Nnh8cZeaDoBGLScOQ&oe=6A848D82",
              "height": 900,
              "width": 720
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773811749_18549917314074731_2734247693651828101_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=101&ig_cache_key=Mzk2MzE4NzEyMTU5MDYyNjcwNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=yB-hhIAUWKUQ7kNvwHTKTVP&_nc_oc=AdrePaf1GR7zD5RygouC1VcjJjkaT0kaY3iFiVW5LZHF2K2ANz9fuui2m0Vy2qEZsAk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFakooAZcKNpUDc4em8Qk-XTEgbn0KVBkKzNRbprzmOAw&oe=6A848D82",
              "height": 800,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773811749_18549917314074731_2734247693651828101_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=101&ig_cache_key=Mzk2MzE4NzEyMTU5MDYyNjcwNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=yB-hhIAUWKUQ7kNvwHTKTVP&_nc_oc=AdrePaf1GR7zD5RygouC1VcjJjkaT0kaY3iFiVW5LZHF2K2ANz9fuui2m0Vy2qEZsAk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGUkrFG8TGwkbw035ErFLYfCnsiH_OY3q4KBjxfbPTm_w&oe=6A848D82",
              "height": 600,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773811749_18549917314074731_2734247693651828101_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=101&ig_cache_key=Mzk2MzE4NzEyMTU5MDYyNjcwNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=yB-hhIAUWKUQ7kNvwHTKTVP&_nc_oc=AdrePaf1GR7zD5RygouC1VcjJjkaT0kaY3iFiVW5LZHF2K2ANz9fuui2m0Vy2qEZsAk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQF06hXD_cyji9W0QvlrYewwrDdZeomz5lnYOGKzNROWuQ&oe=6A848D82",
              "height": 400,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773811749_18549917314074731_2734247693651828101_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=101&ig_cache_key=Mzk2MzE4NzEyMTU5MDYyNjcwNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=yB-hhIAUWKUQ7kNvwHTKTVP&_nc_oc=AdrePaf1GR7zD5RygouC1VcjJjkaT0kaY3iFiVW5LZHF2K2ANz9fuui2m0Vy2qEZsAk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHPCVv7U3tPZsz1YNnPlM1maCJJp6v-E8CzuyglwBIY6g&oe=6A848D82",
              "height": 300,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773811749_18549917314074731_2734247693651828101_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=101&ig_cache_key=Mzk2MzE4NzEyMTU5MDYyNjcwNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=yB-hhIAUWKUQ7kNvwHTKTVP&_nc_oc=AdrePaf1GR7zD5RygouC1VcjJjkaT0kaY3iFiVW5LZHF2K2ANz9fuui2m0Vy2qEZsAk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHN0aCwFBo9ylKesDMl_zCo9VsgB6ZtxoeQ8tC70ww_fw&oe=6A848D82",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773811749_18549917314074731_2734247693651828101_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=101&ig_cache_key=Mzk2MzE4NzEyMTU5MDYyNjcwNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=yB-hhIAUWKUQ7kNvwHTKTVP&_nc_oc=AdrePaf1GR7zD5RygouC1VcjJjkaT0kaY3iFiVW5LZHF2K2ANz9fuui2m0Vy2qEZsAk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEgBPh5oKlC2TX7WUpQtkITTuflb-W88wCYuSGNJUowWg&oe=6A848D82",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773811749_18549917314074731_2734247693651828101_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=101&ig_cache_key=Mzk2MzE4NzEyMTU5MDYyNjcwNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=yB-hhIAUWKUQ7kNvwHTKTVP&_nc_oc=AdrePaf1GR7zD5RygouC1VcjJjkaT0kaY3iFiVW5LZHF2K2ANz9fuui2m0Vy2qEZsAk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHQvjHkisD0KdD-EqqYx-rH_Kyf0Sz76elRwjYicp_VKQ&oe=6A848D82",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773811749_18549917314074731_2734247693651828101_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s480x480_tt6&_nc_cat=101&ig_cache_key=Mzk2MzE4NzEyMTU5MDYyNjcwNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=yB-hhIAUWKUQ7kNvwHTKTVP&_nc_oc=AdrePaf1GR7zD5RygouC1VcjJjkaT0kaY3iFiVW5LZHF2K2ANz9fuui2m0Vy2qEZsAk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGfLXgiRefsulPtIx2yQ4Ldix1UJK2eABVx4RzDXZOmIg&oe=6A848D82",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773811749_18549917314074731_2734247693651828101_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s320x320_tt6&_nc_cat=101&ig_cache_key=Mzk2MzE4NzEyMTU5MDYyNjcwNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=yB-hhIAUWKUQ7kNvwHTKTVP&_nc_oc=AdrePaf1GR7zD5RygouC1VcjJjkaT0kaY3iFiVW5LZHF2K2ANz9fuui2m0Vy2qEZsAk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHvCbyUaUGNkYLzqjQWt3aIM4pr5kWDZoq7EPLKwtAgKQ&oe=6A848D82",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773811749_18549917314074731_2734247693651828101_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s240x240_tt6&_nc_cat=101&ig_cache_key=Mzk2MzE4NzEyMTU5MDYyNjcwNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=yB-hhIAUWKUQ7kNvwHTKTVP&_nc_oc=AdrePaf1GR7zD5RygouC1VcjJjkaT0kaY3iFiVW5LZHF2K2ANz9fuui2m0Vy2qEZsAk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFk0KgzlI8ecyb6NSNwNEbwfk3WduS6dn6nrhrWV71AuA&oe=6A848D82",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773811749_18549917314074731_2734247693651828101_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s150x150_tt6&_nc_cat=101&ig_cache_key=Mzk2MzE4NzEyMTU5MDYyNjcwNg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=yB-hhIAUWKUQ7kNvwHTKTVP&_nc_oc=AdrePaf1GR7zD5RygouC1VcjJjkaT0kaY3iFiVW5LZHF2K2ANz9fuui2m0Vy2qEZsAk&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEHAWcDNowyKfpMZXe9poUffOKAHNI57FQwMaLJL9JtIA&oe=6A848D82",
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
        "display_uri": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773811749_18549917314074731_2734247693651828101_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e15_fr_s1080x1080_tt6&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=xuKpCM1YRdEQ7kNvwHs3nhG&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQEcJVPSSeTIAh36rl9ig5ZXtXFrJS-vjFLmTrxEFAQWVg&oe=6A848D82&_nc_sid=7a9f4b",
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
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773725407_18549917287074731_5028384550837806014_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMTM1NTY3ODA2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=UXuACi-QUMYQ7kNvwGriRux&_nc_oc=AdqH96RA1f0CB0EHRnn_87PsHMyoR5Nk4C-S7g5NmEflUpAlcYw8hOlEveSUXbB6Eac&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFVTe8bLk-ziJUeXZot1okJdVei884q-wFGxDsPlsYH1Q&oe=6A84A96C",
              "height": 1350,
              "width": 1080
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773725407_18549917287074731_5028384550837806014_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMTM1NTY3ODA2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=UXuACi-QUMYQ7kNvwGriRux&_nc_oc=AdqH96RA1f0CB0EHRnn_87PsHMyoR5Nk4C-S7g5NmEflUpAlcYw8hOlEveSUXbB6Eac&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEUORJaIyRbM_H4W3XKDmf8x-R5fdH1Zbwjah3NwCFP3g&oe=6A84A96C",
              "height": 900,
              "width": 720
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773725407_18549917287074731_5028384550837806014_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMTM1NTY3ODA2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=UXuACi-QUMYQ7kNvwGriRux&_nc_oc=AdqH96RA1f0CB0EHRnn_87PsHMyoR5Nk4C-S7g5NmEflUpAlcYw8hOlEveSUXbB6Eac&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQF81nLjo7RgyL8ZzN-47mk809alornxagiXnVvRDwn7VA&oe=6A84A96C",
              "height": 800,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773725407_18549917287074731_5028384550837806014_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMTM1NTY3ODA2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=UXuACi-QUMYQ7kNvwGriRux&_nc_oc=AdqH96RA1f0CB0EHRnn_87PsHMyoR5Nk4C-S7g5NmEflUpAlcYw8hOlEveSUXbB6Eac&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGUl4VoL-QFKmiQoR-0aIIVmIIMCWJjAZKJ3eSGdGpcag&oe=6A84A96C",
              "height": 600,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773725407_18549917287074731_5028384550837806014_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMTM1NTY3ODA2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=UXuACi-QUMYQ7kNvwGriRux&_nc_oc=AdqH96RA1f0CB0EHRnn_87PsHMyoR5Nk4C-S7g5NmEflUpAlcYw8hOlEveSUXbB6Eac&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQG7g_q3-LgPKGZzXHwDAerggJLgH9Jd5jlSj4JrEz-Qtg&oe=6A84A96C",
              "height": 400,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773725407_18549917287074731_5028384550837806014_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMTM1NTY3ODA2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=UXuACi-QUMYQ7kNvwGriRux&_nc_oc=AdqH96RA1f0CB0EHRnn_87PsHMyoR5Nk4C-S7g5NmEflUpAlcYw8hOlEveSUXbB6Eac&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQG3SqVygJKvM26TsqYFG0lKDD3g5ESbHlVYJtKAP3m24Q&oe=6A84A96C",
              "height": 300,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773725407_18549917287074731_5028384550837806014_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMTM1NTY3ODA2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=UXuACi-QUMYQ7kNvwGriRux&_nc_oc=AdqH96RA1f0CB0EHRnn_87PsHMyoR5Nk4C-S7g5NmEflUpAlcYw8hOlEveSUXbB6Eac&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGi7zzWJHN5_elNtl-1E6KdH6wL7lsc81oyFPawevQJxA&oe=6A84A96C",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773725407_18549917287074731_5028384550837806014_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMTM1NTY3ODA2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=UXuACi-QUMYQ7kNvwGriRux&_nc_oc=AdqH96RA1f0CB0EHRnn_87PsHMyoR5Nk4C-S7g5NmEflUpAlcYw8hOlEveSUXbB6Eac&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEyYpII2TUpkaObmc88YYHir0DgoDwaTvyrGO4F1ZL6Ig&oe=6A84A96C",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773725407_18549917287074731_5028384550837806014_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMTM1NTY3ODA2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=UXuACi-QUMYQ7kNvwGriRux&_nc_oc=AdqH96RA1f0CB0EHRnn_87PsHMyoR5Nk4C-S7g5NmEflUpAlcYw8hOlEveSUXbB6Eac&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEap-CTLGuyOn1asKGwdDLgf9v6aseoOykjRkoxJraaWA&oe=6A84A96C",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773725407_18549917287074731_5028384550837806014_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s480x480_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMTM1NTY3ODA2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=UXuACi-QUMYQ7kNvwGriRux&_nc_oc=AdqH96RA1f0CB0EHRnn_87PsHMyoR5Nk4C-S7g5NmEflUpAlcYw8hOlEveSUXbB6Eac&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEh5cR_ApTFekgkPT4PaRusct8QsiXU2PVkXRDOp6XoCg&oe=6A84A96C",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773725407_18549917287074731_5028384550837806014_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s320x320_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMTM1NTY3ODA2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=UXuACi-QUMYQ7kNvwGriRux&_nc_oc=AdqH96RA1f0CB0EHRnn_87PsHMyoR5Nk4C-S7g5NmEflUpAlcYw8hOlEveSUXbB6Eac&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEj441hq6--R8Dugwko0jvxWPs9BKmlIYNU0xC-ZU3Aug&oe=6A84A96C",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773725407_18549917287074731_5028384550837806014_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s240x240_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMTM1NTY3ODA2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=UXuACi-QUMYQ7kNvwGriRux&_nc_oc=AdqH96RA1f0CB0EHRnn_87PsHMyoR5Nk4C-S7g5NmEflUpAlcYw8hOlEveSUXbB6Eac&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQExdNtwqQYvtBGyYLWsswIFhMJK9IRgSkMyI83vODdI9w&oe=6A84A96C",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773725407_18549917287074731_5028384550837806014_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s150x150_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMTM1NTY3ODA2MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=UXuACi-QUMYQ7kNvwGriRux&_nc_oc=AdqH96RA1f0CB0EHRnn_87PsHMyoR5Nk4C-S7g5NmEflUpAlcYw8hOlEveSUXbB6Eac&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFvJfLMHb1UxPpyoD7vdznf2fkqcVFg1ike9QF86r0w7Q&oe=6A84A96C",
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
        "display_uri": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773725407_18549917287074731_5028384550837806014_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e15_fr_s1080x1080_tt6&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=MMDOMG_Hm-kQ7kNvwEEUlJp&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHajLUl6SaXHPF5ZzFNgWFM2U7yNf494u9QJF0hSFytig&oe=6A84A96C&_nc_sid=7a9f4b",
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
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774281083_18549917305074731_8908467008525322143_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=104&ig_cache_key=Mzk2MzE4NzEyMzI3NjU4NzczOA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=OxHr2SEQarQQ7kNvwHqGJUf&_nc_oc=Adpkj_LhQZRaGp1_Vp4xRnTMMvl6oxXxtvUc4g1IO465GxknYceH0j3JA8Yf8vpclzc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGhUP9nMijHPcPpM9adKT_M1TPrdBuxx9KPU6CkxpQnFQ&oe=6A84AAE1",
              "height": 1350,
              "width": 1080
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774281083_18549917305074731_8908467008525322143_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=104&ig_cache_key=Mzk2MzE4NzEyMzI3NjU4NzczOA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=OxHr2SEQarQQ7kNvwHqGJUf&_nc_oc=Adpkj_LhQZRaGp1_Vp4xRnTMMvl6oxXxtvUc4g1IO465GxknYceH0j3JA8Yf8vpclzc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHx4bZsqQd03mqUhi86fvBgni4KpVQp2su7wZU0fF5Hhw&oe=6A84AAE1",
              "height": 900,
              "width": 720
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774281083_18549917305074731_8908467008525322143_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=104&ig_cache_key=Mzk2MzE4NzEyMzI3NjU4NzczOA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=OxHr2SEQarQQ7kNvwHqGJUf&_nc_oc=Adpkj_LhQZRaGp1_Vp4xRnTMMvl6oxXxtvUc4g1IO465GxknYceH0j3JA8Yf8vpclzc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFBMUhAVeNNsHbQjvKlN3rwUrVtfYg3gauHknLpk1Qzgw&oe=6A84AAE1",
              "height": 800,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774281083_18549917305074731_8908467008525322143_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=104&ig_cache_key=Mzk2MzE4NzEyMzI3NjU4NzczOA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=OxHr2SEQarQQ7kNvwHqGJUf&_nc_oc=Adpkj_LhQZRaGp1_Vp4xRnTMMvl6oxXxtvUc4g1IO465GxknYceH0j3JA8Yf8vpclzc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGOLCDUNS8zFCMLE0UDXmtioOLySyY2S2AWXCOmcGC33A&oe=6A84AAE1",
              "height": 600,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774281083_18549917305074731_8908467008525322143_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=104&ig_cache_key=Mzk2MzE4NzEyMzI3NjU4NzczOA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=OxHr2SEQarQQ7kNvwHqGJUf&_nc_oc=Adpkj_LhQZRaGp1_Vp4xRnTMMvl6oxXxtvUc4g1IO465GxknYceH0j3JA8Yf8vpclzc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGgGZIIdODMo8T1a6fed3QKFKwjblOCAtpjk1GwGBEKxw&oe=6A84AAE1",
              "height": 400,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774281083_18549917305074731_8908467008525322143_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=104&ig_cache_key=Mzk2MzE4NzEyMzI3NjU4NzczOA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=OxHr2SEQarQQ7kNvwHqGJUf&_nc_oc=Adpkj_LhQZRaGp1_Vp4xRnTMMvl6oxXxtvUc4g1IO465GxknYceH0j3JA8Yf8vpclzc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHefKVinl48ZK2S0eic5ji30qVJDRavqLs5wSStj-flEA&oe=6A84AAE1",
              "height": 300,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774281083_18549917305074731_8908467008525322143_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=104&ig_cache_key=Mzk2MzE4NzEyMzI3NjU4NzczOA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=OxHr2SEQarQQ7kNvwHqGJUf&_nc_oc=Adpkj_LhQZRaGp1_Vp4xRnTMMvl6oxXxtvUc4g1IO465GxknYceH0j3JA8Yf8vpclzc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFlWwEo3YYRQZmnAqJOvxdhhHGTUP9RNEUzrRyunEVTAg&oe=6A84AAE1",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774281083_18549917305074731_8908467008525322143_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=104&ig_cache_key=Mzk2MzE4NzEyMzI3NjU4NzczOA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=OxHr2SEQarQQ7kNvwHqGJUf&_nc_oc=Adpkj_LhQZRaGp1_Vp4xRnTMMvl6oxXxtvUc4g1IO465GxknYceH0j3JA8Yf8vpclzc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQET_ocWYx-SVD62e6NJgd88yRWwdqQ5hFov1b6hKUmIfQ&oe=6A84AAE1",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774281083_18549917305074731_8908467008525322143_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=104&ig_cache_key=Mzk2MzE4NzEyMzI3NjU4NzczOA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=OxHr2SEQarQQ7kNvwHqGJUf&_nc_oc=Adpkj_LhQZRaGp1_Vp4xRnTMMvl6oxXxtvUc4g1IO465GxknYceH0j3JA8Yf8vpclzc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGdQX6QdmdiI6nmPwuVEQNZQxFpwviG7so9UDuU9OLd_w&oe=6A84AAE1",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774281083_18549917305074731_8908467008525322143_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s480x480_tt6&_nc_cat=104&ig_cache_key=Mzk2MzE4NzEyMzI3NjU4NzczOA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=OxHr2SEQarQQ7kNvwHqGJUf&_nc_oc=Adpkj_LhQZRaGp1_Vp4xRnTMMvl6oxXxtvUc4g1IO465GxknYceH0j3JA8Yf8vpclzc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFrylod2AEUJMryvY0s1txqgiW_JJz19wDaQ_WU2UorUQ&oe=6A84AAE1",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774281083_18549917305074731_8908467008525322143_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s320x320_tt6&_nc_cat=104&ig_cache_key=Mzk2MzE4NzEyMzI3NjU4NzczOA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=OxHr2SEQarQQ7kNvwHqGJUf&_nc_oc=Adpkj_LhQZRaGp1_Vp4xRnTMMvl6oxXxtvUc4g1IO465GxknYceH0j3JA8Yf8vpclzc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGDY1BzynCSmIeGhlVw9_Oab8NpeGYmlEz5lkq8iZ5IzQ&oe=6A84AAE1",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774281083_18549917305074731_8908467008525322143_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s240x240_tt6&_nc_cat=104&ig_cache_key=Mzk2MzE4NzEyMzI3NjU4NzczOA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=OxHr2SEQarQQ7kNvwHqGJUf&_nc_oc=Adpkj_LhQZRaGp1_Vp4xRnTMMvl6oxXxtvUc4g1IO465GxknYceH0j3JA8Yf8vpclzc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGM8MNOJbkOkTuITwVeC9He7OW7RUiEvGLtb6w_MPVGbg&oe=6A84AAE1",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774281083_18549917305074731_8908467008525322143_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s150x150_tt6&_nc_cat=104&ig_cache_key=Mzk2MzE4NzEyMzI3NjU4NzczOA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=OxHr2SEQarQQ7kNvwHqGJUf&_nc_oc=Adpkj_LhQZRaGp1_Vp4xRnTMMvl6oxXxtvUc4g1IO465GxknYceH0j3JA8Yf8vpclzc&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGRSGt4QK_xx0ml-Vc1aV4Z6xBpxFmlR3aLCgbM6-OHdg&oe=6A84AAE1",
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
        "display_uri": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774281083_18549917305074731_8908467008525322143_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e15_fr_s1080x1080_tt6&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=e7CrzoBYuNoQ7kNvwERcpKh&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQH0E-rIxW5RZ1vr8HqKuCDQrDdl2DXj2tM7NmM_VOK4nA&oe=6A84AAE1&_nc_sid=7a9f4b",
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
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/772714522_18549917329074731_7712275684327689571_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=106&ig_cache_key=Mzk2MzE4NzEyNzQwMzcwNjIxOQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=MXx0pnAfv74Q7kNvwEWO8ss&_nc_oc=AdpMQg1EOVuiJ-mLfShx6_Lvky9ObUeMxsnxH1mWvO0JXZ_UlIGBnBd86g8kfBoMf9s&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQH1_hpmnf2-XyGeV73ip6o--nYNsCnSvIDfvFjuaBczfQ&oe=6A84A6FD",
              "height": 1350,
              "width": 1080
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/772714522_18549917329074731_7712275684327689571_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=106&ig_cache_key=Mzk2MzE4NzEyNzQwMzcwNjIxOQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=MXx0pnAfv74Q7kNvwEWO8ss&_nc_oc=AdpMQg1EOVuiJ-mLfShx6_Lvky9ObUeMxsnxH1mWvO0JXZ_UlIGBnBd86g8kfBoMf9s&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGk9XKD6talrCLRZfczJUJ_yMrIz5EXXJRBuAobAbswoA&oe=6A84A6FD",
              "height": 900,
              "width": 720
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/772714522_18549917329074731_7712275684327689571_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=106&ig_cache_key=Mzk2MzE4NzEyNzQwMzcwNjIxOQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=MXx0pnAfv74Q7kNvwEWO8ss&_nc_oc=AdpMQg1EOVuiJ-mLfShx6_Lvky9ObUeMxsnxH1mWvO0JXZ_UlIGBnBd86g8kfBoMf9s&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEJvKCtVnEfedE7D_Sa4hpr3PwWBITWkNqh4euPdBD_6A&oe=6A84A6FD",
              "height": 800,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/772714522_18549917329074731_7712275684327689571_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=106&ig_cache_key=Mzk2MzE4NzEyNzQwMzcwNjIxOQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=MXx0pnAfv74Q7kNvwEWO8ss&_nc_oc=AdpMQg1EOVuiJ-mLfShx6_Lvky9ObUeMxsnxH1mWvO0JXZ_UlIGBnBd86g8kfBoMf9s&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGGJ4mOgVE4BLgMyyigzZMBTr1xFO4DCG455Tr_BUPu_Q&oe=6A84A6FD",
              "height": 600,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/772714522_18549917329074731_7712275684327689571_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=106&ig_cache_key=Mzk2MzE4NzEyNzQwMzcwNjIxOQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=MXx0pnAfv74Q7kNvwEWO8ss&_nc_oc=AdpMQg1EOVuiJ-mLfShx6_Lvky9ObUeMxsnxH1mWvO0JXZ_UlIGBnBd86g8kfBoMf9s&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEkqzWFqwENj0WAtERHOuUyFwuWUkHekqnE528D4jSdTA&oe=6A84A6FD",
              "height": 400,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/772714522_18549917329074731_7712275684327689571_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=106&ig_cache_key=Mzk2MzE4NzEyNzQwMzcwNjIxOQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=MXx0pnAfv74Q7kNvwEWO8ss&_nc_oc=AdpMQg1EOVuiJ-mLfShx6_Lvky9ObUeMxsnxH1mWvO0JXZ_UlIGBnBd86g8kfBoMf9s&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHhOjFAd6GBCZQMA_fw2IkulVbreYdhcMounj1nSPYdIQ&oe=6A84A6FD",
              "height": 300,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/772714522_18549917329074731_7712275684327689571_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=106&ig_cache_key=Mzk2MzE4NzEyNzQwMzcwNjIxOQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=MXx0pnAfv74Q7kNvwEWO8ss&_nc_oc=AdpMQg1EOVuiJ-mLfShx6_Lvky9ObUeMxsnxH1mWvO0JXZ_UlIGBnBd86g8kfBoMf9s&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHuLSkj-IDs9iHLSBaxg8gZK3YdCvBsJDE7PLQmTMrbdQ&oe=6A84A6FD",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/772714522_18549917329074731_7712275684327689571_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=106&ig_cache_key=Mzk2MzE4NzEyNzQwMzcwNjIxOQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=MXx0pnAfv74Q7kNvwEWO8ss&_nc_oc=AdpMQg1EOVuiJ-mLfShx6_Lvky9ObUeMxsnxH1mWvO0JXZ_UlIGBnBd86g8kfBoMf9s&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGOlfXebuU5zjz3FI8wYQekb-mspfjNs6jx2Go68_KXDA&oe=6A84A6FD",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/772714522_18549917329074731_7712275684327689571_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=106&ig_cache_key=Mzk2MzE4NzEyNzQwMzcwNjIxOQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=MXx0pnAfv74Q7kNvwEWO8ss&_nc_oc=AdpMQg1EOVuiJ-mLfShx6_Lvky9ObUeMxsnxH1mWvO0JXZ_UlIGBnBd86g8kfBoMf9s&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHaMIsLbEsrrcLNj0FRb6Ectj8lMnbYlh-BgeGDR49AFQ&oe=6A84A6FD",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/772714522_18549917329074731_7712275684327689571_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s480x480_tt6&_nc_cat=106&ig_cache_key=Mzk2MzE4NzEyNzQwMzcwNjIxOQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=MXx0pnAfv74Q7kNvwEWO8ss&_nc_oc=AdpMQg1EOVuiJ-mLfShx6_Lvky9ObUeMxsnxH1mWvO0JXZ_UlIGBnBd86g8kfBoMf9s&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGo5vhMdwIV2LUC3T_wrySLwr9kM2tgq0BDtDALLfifFA&oe=6A84A6FD",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/772714522_18549917329074731_7712275684327689571_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s320x320_tt6&_nc_cat=106&ig_cache_key=Mzk2MzE4NzEyNzQwMzcwNjIxOQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=MXx0pnAfv74Q7kNvwEWO8ss&_nc_oc=AdpMQg1EOVuiJ-mLfShx6_Lvky9ObUeMxsnxH1mWvO0JXZ_UlIGBnBd86g8kfBoMf9s&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHgb8Srl2_X1RVd27lF3o9ePFMgNkVURbXZCqng8inJdQ&oe=6A84A6FD",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/772714522_18549917329074731_7712275684327689571_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s240x240_tt6&_nc_cat=106&ig_cache_key=Mzk2MzE4NzEyNzQwMzcwNjIxOQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=MXx0pnAfv74Q7kNvwEWO8ss&_nc_oc=AdpMQg1EOVuiJ-mLfShx6_Lvky9ObUeMxsnxH1mWvO0JXZ_UlIGBnBd86g8kfBoMf9s&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGnPg4P8IyInqDEP9AOhWelqQmbijS9_Tkq7NO_ZkZJCQ&oe=6A84A6FD",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/772714522_18549917329074731_7712275684327689571_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e35_s150x150_tt6&_nc_cat=106&ig_cache_key=Mzk2MzE4NzEyNzQwMzcwNjIxOQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=MXx0pnAfv74Q7kNvwEWO8ss&_nc_oc=AdpMQg1EOVuiJ-mLfShx6_Lvky9ObUeMxsnxH1mWvO0JXZ_UlIGBnBd86g8kfBoMf9s&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHEnObYEfGQaHvk_zXbPtCgdcK1MtJ6WuJ_0sgYbg-OIw&oe=6A84A6FD",
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
        "display_uri": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/772714522_18549917329074731_7712275684327689571_n.jpg?stp=c0.135.1080.1080a_dst-jpg_e15_fr_s1080x1080_tt6&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=sE-YQuJGWCYQ7kNvwHYtZGR&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHkKCq3AyqAh5M6QCgxbc6p43PORiQBvCvHtR5y_JK1Sw&oe=6A84A6FD&_nc_sid=7a9f4b",
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
    "crawled_at": "2026-08-14T08:14:50.847Z"
  },
  {
    "id": "3962867082392210475_2237970730",
    "pk": "3962867082392210475",
    "type": "Image",
    "image": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=FFka95e64qsQ7kNvwEpilVj&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQEwxrcvvSzIDk4q6GRLt3G8O6o7mQtgRs9GcRjqrCOEAw&oe=6A84A355&_nc_sid=7a9f4b",
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
      "profile_pic_url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=L9VCN6COaTMQ7kNvwEtchDb&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGtAYN3nq3QGfxuCkn1E-5A4KCex9UNKdqu4rb5CDdvxA&oe=6A84A633&_nc_sid=7a9f4b",
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
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=L9VCN6COaTMQ7kNvwEtchDb&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHlusG19xf_r4IJPwxyrxIMODZbnUgAD9M5lUitKOejtQ&oe=6A84A633&_nc_sid=7a9f4b"
      },
      "__typename": "XDTUserDict",
      "full_name": "Pakuwon Mall Jogja"
    },
    "images": [
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwHLextI&_nc_oc=AdpOyNTpbbZCfI3aVhuCxxfanzFaol9j4a1blvopyVoQNnTra3KN8fqAdQIf_Tu4TxM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEVuoqX6MA2x8Tek6RBc2uNGf4jR3VwjK6pD9YSj4o4Dw&oe=6A84A355",
        "height": 1472,
        "width": 1179
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwHLextI&_nc_oc=AdpOyNTpbbZCfI3aVhuCxxfanzFaol9j4a1blvopyVoQNnTra3KN8fqAdQIf_Tu4TxM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQG_vcAmCSyIusV3w5ceeWz5FjrUfzm0VqJn3ilknZ8C6g&oe=6A84A355",
        "height": 899,
        "width": 720
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwHLextI&_nc_oc=AdpOyNTpbbZCfI3aVhuCxxfanzFaol9j4a1blvopyVoQNnTra3KN8fqAdQIf_Tu4TxM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHvRb0M_k1HieRrtD37_SuoSqTKtYwjeJUEefJMvRdJCQ&oe=6A84A355",
        "height": 799,
        "width": 640
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwHLextI&_nc_oc=AdpOyNTpbbZCfI3aVhuCxxfanzFaol9j4a1blvopyVoQNnTra3KN8fqAdQIf_Tu4TxM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFSObmULlP3hD8QADW8tXuUm6R4cSSXgLajGFLBl_FHTw&oe=6A84A355",
        "height": 599,
        "width": 480
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwHLextI&_nc_oc=AdpOyNTpbbZCfI3aVhuCxxfanzFaol9j4a1blvopyVoQNnTra3KN8fqAdQIf_Tu4TxM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFhSTYNxUeclw7vWIBH9ao3S4sZWKCzSH_k-73VtWreBg&oe=6A84A355",
        "height": 400,
        "width": 320
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwHLextI&_nc_oc=AdpOyNTpbbZCfI3aVhuCxxfanzFaol9j4a1blvopyVoQNnTra3KN8fqAdQIf_Tu4TxM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHkCo3ExYpmEaW81Ig33T1w88JCH77J8xyVyh1TBNA_mQ&oe=6A84A355",
        "height": 300,
        "width": 240
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwHLextI&_nc_oc=AdpOyNTpbbZCfI3aVhuCxxfanzFaol9j4a1blvopyVoQNnTra3KN8fqAdQIf_Tu4TxM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFK5K-dG94ANH_dxB_08EeeZEoS6RzSSWvTQRmOnbGvXw&oe=6A84A355",
        "height": 1080,
        "width": 1080
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwHLextI&_nc_oc=AdpOyNTpbbZCfI3aVhuCxxfanzFaol9j4a1blvopyVoQNnTra3KN8fqAdQIf_Tu4TxM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEYuY-Gae8RVQ5Png_6zP5sQUef_Yivr36rckfMo8xDig&oe=6A84A355",
        "height": 750,
        "width": 750
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwHLextI&_nc_oc=AdpOyNTpbbZCfI3aVhuCxxfanzFaol9j4a1blvopyVoQNnTra3KN8fqAdQIf_Tu4TxM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEqkGyRW8K5lCr9cOeAbEDLxBJetOpblVKaNi_xI0CAPQ&oe=6A84A355",
        "height": 640,
        "width": 640
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s480x480_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwHLextI&_nc_oc=AdpOyNTpbbZCfI3aVhuCxxfanzFaol9j4a1blvopyVoQNnTra3KN8fqAdQIf_Tu4TxM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQES8sLjjwk4v-7N1m0so0sbXRrRhkwVXgcvOg5MIv7UOg&oe=6A84A355",
        "height": 480,
        "width": 480
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s320x320_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwHLextI&_nc_oc=AdpOyNTpbbZCfI3aVhuCxxfanzFaol9j4a1blvopyVoQNnTra3KN8fqAdQIf_Tu4TxM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHdIpUoQtXbotR68OIFujp9prZHMjlNplX6NBov2fIGcw&oe=6A84A355",
        "height": 320,
        "width": 320
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s240x240_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwHLextI&_nc_oc=AdpOyNTpbbZCfI3aVhuCxxfanzFaol9j4a1blvopyVoQNnTra3KN8fqAdQIf_Tu4TxM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQG8B2_3XOi3g9ZpeQ9GcsfIu-UWRrIoFckAWTZ4kz3hNg&oe=6A84A355",
        "height": 240,
        "width": 240
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s150x150_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwHLextI&_nc_oc=AdpOyNTpbbZCfI3aVhuCxxfanzFaol9j4a1blvopyVoQNnTra3KN8fqAdQIf_Tu4TxM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGrayNJyub3MKd-izc2PLdnQ1qdchIGrsUtRps6HV0Hng&oe=6A84A355",
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
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwHLextI&_nc_oc=AdpOyNTpbbZCfI3aVhuCxxfanzFaol9j4a1blvopyVoQNnTra3KN8fqAdQIf_Tu4TxM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEVuoqX6MA2x8Tek6RBc2uNGf4jR3VwjK6pD9YSj4o4Dw&oe=6A84A355",
              "height": 1472,
              "width": 1179
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwHLextI&_nc_oc=AdpOyNTpbbZCfI3aVhuCxxfanzFaol9j4a1blvopyVoQNnTra3KN8fqAdQIf_Tu4TxM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQG_vcAmCSyIusV3w5ceeWz5FjrUfzm0VqJn3ilknZ8C6g&oe=6A84A355",
              "height": 899,
              "width": 720
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwHLextI&_nc_oc=AdpOyNTpbbZCfI3aVhuCxxfanzFaol9j4a1blvopyVoQNnTra3KN8fqAdQIf_Tu4TxM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHvRb0M_k1HieRrtD37_SuoSqTKtYwjeJUEefJMvRdJCQ&oe=6A84A355",
              "height": 799,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwHLextI&_nc_oc=AdpOyNTpbbZCfI3aVhuCxxfanzFaol9j4a1blvopyVoQNnTra3KN8fqAdQIf_Tu4TxM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFSObmULlP3hD8QADW8tXuUm6R4cSSXgLajGFLBl_FHTw&oe=6A84A355",
              "height": 599,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwHLextI&_nc_oc=AdpOyNTpbbZCfI3aVhuCxxfanzFaol9j4a1blvopyVoQNnTra3KN8fqAdQIf_Tu4TxM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFhSTYNxUeclw7vWIBH9ao3S4sZWKCzSH_k-73VtWreBg&oe=6A84A355",
              "height": 400,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwHLextI&_nc_oc=AdpOyNTpbbZCfI3aVhuCxxfanzFaol9j4a1blvopyVoQNnTra3KN8fqAdQIf_Tu4TxM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHkCo3ExYpmEaW81Ig33T1w88JCH77J8xyVyh1TBNA_mQ&oe=6A84A355",
              "height": 300,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwHLextI&_nc_oc=AdpOyNTpbbZCfI3aVhuCxxfanzFaol9j4a1blvopyVoQNnTra3KN8fqAdQIf_Tu4TxM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFK5K-dG94ANH_dxB_08EeeZEoS6RzSSWvTQRmOnbGvXw&oe=6A84A355",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwHLextI&_nc_oc=AdpOyNTpbbZCfI3aVhuCxxfanzFaol9j4a1blvopyVoQNnTra3KN8fqAdQIf_Tu4TxM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEYuY-Gae8RVQ5Png_6zP5sQUef_Yivr36rckfMo8xDig&oe=6A84A355",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwHLextI&_nc_oc=AdpOyNTpbbZCfI3aVhuCxxfanzFaol9j4a1blvopyVoQNnTra3KN8fqAdQIf_Tu4TxM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEqkGyRW8K5lCr9cOeAbEDLxBJetOpblVKaNi_xI0CAPQ&oe=6A84A355",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s480x480_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwHLextI&_nc_oc=AdpOyNTpbbZCfI3aVhuCxxfanzFaol9j4a1blvopyVoQNnTra3KN8fqAdQIf_Tu4TxM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQES8sLjjwk4v-7N1m0so0sbXRrRhkwVXgcvOg5MIv7UOg&oe=6A84A355",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s320x320_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwHLextI&_nc_oc=AdpOyNTpbbZCfI3aVhuCxxfanzFaol9j4a1blvopyVoQNnTra3KN8fqAdQIf_Tu4TxM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHdIpUoQtXbotR68OIFujp9prZHMjlNplX6NBov2fIGcw&oe=6A84A355",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s240x240_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwHLextI&_nc_oc=AdpOyNTpbbZCfI3aVhuCxxfanzFaol9j4a1blvopyVoQNnTra3KN8fqAdQIf_Tu4TxM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQG8B2_3XOi3g9ZpeQ9GcsfIu-UWRrIoFckAWTZ4kz3hNg&oe=6A84A355",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s150x150_tt6&_nc_cat=104&ig_cache_key=Mzk2Mjg2NjkyNzE4OTk0NDk3Mg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=wpihxM29qGYQ7kNvwHLextI&_nc_oc=AdpOyNTpbbZCfI3aVhuCxxfanzFaol9j4a1blvopyVoQNnTra3KN8fqAdQIf_Tu4TxM&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGrayNJyub3MKd-izc2PLdnQ1qdchIGrsUtRps6HV0Hng&oe=6A84A355",
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
        "display_uri": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=c0.146.1179.1179a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=FFka95e64qsQ7kNvwEpilVj&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQEwxrcvvSzIDk4q6GRLt3G8O6o7mQtgRs9GcRjqrCOEAw&oe=6A84A355&_nc_sid=7a9f4b",
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
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774059549_18549779836074731_2421445589124863786_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2NjkyOTM2MjU2NTg5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=hR5qD571FYAQ7kNvwHN_8fM&_nc_oc=AdqmZDFu9-BGOUeRCDKJQ-gBpEelSAU0uRFDzsuaT9LNrTceQetkQ8bmI66zPzw8y6I&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHG8ZtZTMg7-LDwbigu8yPnhFW9yeDc0yXTniAXVMtCcQ&oe=6A849207",
              "height": 1348,
              "width": 1080
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774059549_18549779836074731_2421445589124863786_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2NjkyOTM2MjU2NTg5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=hR5qD571FYAQ7kNvwHN_8fM&_nc_oc=AdqmZDFu9-BGOUeRCDKJQ-gBpEelSAU0uRFDzsuaT9LNrTceQetkQ8bmI66zPzw8y6I&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHghYtVmcl4oz1F_n5YknTKmQ_jOmGtwUmwfMRHEMEVyg&oe=6A849207",
              "height": 899,
              "width": 720
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774059549_18549779836074731_2421445589124863786_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2NjkyOTM2MjU2NTg5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=hR5qD571FYAQ7kNvwHN_8fM&_nc_oc=AdqmZDFu9-BGOUeRCDKJQ-gBpEelSAU0uRFDzsuaT9LNrTceQetkQ8bmI66zPzw8y6I&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFyp7fBhgiPvTtD6nNMilv-VkUwwU-ocVsGGqQ2dxLADA&oe=6A849207",
              "height": 799,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774059549_18549779836074731_2421445589124863786_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2NjkyOTM2MjU2NTg5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=hR5qD571FYAQ7kNvwHN_8fM&_nc_oc=AdqmZDFu9-BGOUeRCDKJQ-gBpEelSAU0uRFDzsuaT9LNrTceQetkQ8bmI66zPzw8y6I&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQG5X6CQPrhisTRdNEruG42Vi1LtGE4yowU1Bi5vkoaaoQ&oe=6A849207",
              "height": 599,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774059549_18549779836074731_2421445589124863786_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2NjkyOTM2MjU2NTg5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=hR5qD571FYAQ7kNvwHN_8fM&_nc_oc=AdqmZDFu9-BGOUeRCDKJQ-gBpEelSAU0uRFDzsuaT9LNrTceQetkQ8bmI66zPzw8y6I&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQG5JmeWVe9SGxRRJv8_bZ3rr6BoExMcCjkuZb1HgqLcvQ&oe=6A849207",
              "height": 399,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774059549_18549779836074731_2421445589124863786_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2NjkyOTM2MjU2NTg5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=hR5qD571FYAQ7kNvwHN_8fM&_nc_oc=AdqmZDFu9-BGOUeRCDKJQ-gBpEelSAU0uRFDzsuaT9LNrTceQetkQ8bmI66zPzw8y6I&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQElg6nOKeqDxaDNTlzdTMYbQTotA-0QvGqCj3aCbL8I6g&oe=6A849207",
              "height": 300,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774059549_18549779836074731_2421445589124863786_n.jpg?stp=c0.134.1080.1080a_dst-jpg_e35_s1080x1079_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2NjkyOTM2MjU2NTg5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=hR5qD571FYAQ7kNvwHN_8fM&_nc_oc=AdqmZDFu9-BGOUeRCDKJQ-gBpEelSAU0uRFDzsuaT9LNrTceQetkQ8bmI66zPzw8y6I&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFAylHPDLPFWzTQqQ5vTIOp7d8hbb215xbmZMZwINoclQ&oe=6A849207",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774059549_18549779836074731_2421445589124863786_n.jpg?stp=c0.134.1080.1080a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2NjkyOTM2MjU2NTg5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=hR5qD571FYAQ7kNvwHN_8fM&_nc_oc=AdqmZDFu9-BGOUeRCDKJQ-gBpEelSAU0uRFDzsuaT9LNrTceQetkQ8bmI66zPzw8y6I&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEUAOuqiQv2A2v_sx9lBL2iVXUsOBLh-1Kp27ddc7YPFQ&oe=6A849207",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774059549_18549779836074731_2421445589124863786_n.jpg?stp=c0.134.1080.1080a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2NjkyOTM2MjU2NTg5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=hR5qD571FYAQ7kNvwHN_8fM&_nc_oc=AdqmZDFu9-BGOUeRCDKJQ-gBpEelSAU0uRFDzsuaT9LNrTceQetkQ8bmI66zPzw8y6I&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHBpVjun3rqX1KzLVuq_W8aHeNWS6BqRPyG_JNtZAj0Ow&oe=6A849207",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774059549_18549779836074731_2421445589124863786_n.jpg?stp=c0.134.1080.1080a_dst-jpg_e35_s480x480_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2NjkyOTM2MjU2NTg5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=hR5qD571FYAQ7kNvwHN_8fM&_nc_oc=AdqmZDFu9-BGOUeRCDKJQ-gBpEelSAU0uRFDzsuaT9LNrTceQetkQ8bmI66zPzw8y6I&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHYaTA2M18gJYFZfXs6tN-tKzs6FyiM_w7SUOuBENeq2Q&oe=6A849207",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774059549_18549779836074731_2421445589124863786_n.jpg?stp=c0.134.1080.1080a_dst-jpg_e35_s320x320_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2NjkyOTM2MjU2NTg5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=hR5qD571FYAQ7kNvwHN_8fM&_nc_oc=AdqmZDFu9-BGOUeRCDKJQ-gBpEelSAU0uRFDzsuaT9LNrTceQetkQ8bmI66zPzw8y6I&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQG5eWgpV6sLntWgDSh8shkKimqW8YQCsRDRshSyrdUlRA&oe=6A849207",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774059549_18549779836074731_2421445589124863786_n.jpg?stp=c0.134.1080.1080a_dst-jpg_e35_s240x240_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2NjkyOTM2MjU2NTg5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=hR5qD571FYAQ7kNvwHN_8fM&_nc_oc=AdqmZDFu9-BGOUeRCDKJQ-gBpEelSAU0uRFDzsuaT9LNrTceQetkQ8bmI66zPzw8y6I&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEKOQVNxYS0Yk_tmE4peMs8rh4ECJUxG78U5QqiX8CsZg&oe=6A849207",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774059549_18549779836074731_2421445589124863786_n.jpg?stp=c0.134.1080.1080a_dst-jpg_e35_s150x150_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2NjkyOTM2MjU2NTg5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=hR5qD571FYAQ7kNvwHN_8fM&_nc_oc=AdqmZDFu9-BGOUeRCDKJQ-gBpEelSAU0uRFDzsuaT9LNrTceQetkQ8bmI66zPzw8y6I&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFrSDfMeNkPI0ngH9jZIgOaIuSlU1uuWuty6qSRKxhhHQ&oe=6A849207",
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
        "display_uri": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774059549_18549779836074731_2421445589124863786_n.jpg?stp=c0.134.1080.1080a_dst-jpg_e15_fr_s1080x1080_tt6&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=Pegm_zpRvawQ7kNvwGiE_ni&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGAkYAYkAG04WKMuxm9wL2jYfaOqa8_Z8bl1eJ6RA_WbA&oe=6A849207&_nc_sid=7a9f4b",
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
    "crawled_at": "2026-08-14T08:14:50.847Z"
  },
  {
    "id": "3962865174512370672_2237970730",
    "pk": "3962865174512370672",
    "type": "Image",
    "image": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=c0.256.2048.2048a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=FGpPLN37LN4Q7kNvwFOqitb&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHMfYWr7gfGlBBS_ktBSEf1NExp1LmLyT0jIhnshzPpRg&oe=6A848DC1&_nc_sid=7a9f4b",
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
      "profile_pic_url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=L9VCN6COaTMQ7kNvwEtchDb&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGtAYN3nq3QGfxuCkn1E-5A4KCex9UNKdqu4rb5CDdvxA&oe=6A84A633&_nc_sid=7a9f4b",
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
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=L9VCN6COaTMQ7kNvwEtchDb&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHlusG19xf_r4IJPwxyrxIMODZbnUgAD9M5lUitKOejtQ&oe=6A84A633&_nc_sid=7a9f4b"
      },
      "__typename": "XDTUserDict",
      "full_name": "Pakuwon Mall Jogja"
    },
    "images": [
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwFO9Jpi&_nc_oc=AdrOMVdJ0HsU5ZgqwDsxgBjBARm4wOuY4EI0BTbbI4VxcNoBXCM8tsjkcDQjijkOlgU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEY-DmOHCSTwy3RaVRiKCfpG0JQYdQq_TLN7MWnY-Ijog&oe=6A848DC1",
        "height": 2560,
        "width": 2048
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=dst-jpg_e35_p1080x1080_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwFO9Jpi&_nc_oc=AdrOMVdJ0HsU5ZgqwDsxgBjBARm4wOuY4EI0BTbbI4VxcNoBXCM8tsjkcDQjijkOlgU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFonhpxtOisDnUwTadfDB1-XVnTnO4hq-kQo4FSAzdRkA&oe=6A848DC1",
        "height": 1350,
        "width": 1080
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwFO9Jpi&_nc_oc=AdrOMVdJ0HsU5ZgqwDsxgBjBARm4wOuY4EI0BTbbI4VxcNoBXCM8tsjkcDQjijkOlgU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEOiwXQMojvZagXlVIZsEXSuGCokrEaZ-VnIvDKWYQY6g&oe=6A848DC1",
        "height": 900,
        "width": 720
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwFO9Jpi&_nc_oc=AdrOMVdJ0HsU5ZgqwDsxgBjBARm4wOuY4EI0BTbbI4VxcNoBXCM8tsjkcDQjijkOlgU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGmmwFqU6a6f5AC4dye5V6lskA9girL3LKan-SDpeZtFA&oe=6A848DC1",
        "height": 800,
        "width": 640
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwFO9Jpi&_nc_oc=AdrOMVdJ0HsU5ZgqwDsxgBjBARm4wOuY4EI0BTbbI4VxcNoBXCM8tsjkcDQjijkOlgU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEsnJuyonvP20foTBnhvjt9jrBvVRVMtAZdD4ehPuermA&oe=6A848DC1",
        "height": 600,
        "width": 480
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwFO9Jpi&_nc_oc=AdrOMVdJ0HsU5ZgqwDsxgBjBARm4wOuY4EI0BTbbI4VxcNoBXCM8tsjkcDQjijkOlgU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFwog218JsMrA6ElGqIr_ByhONrZ97XPnejXodYYxgQCw&oe=6A848DC1",
        "height": 400,
        "width": 320
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwFO9Jpi&_nc_oc=AdrOMVdJ0HsU5ZgqwDsxgBjBARm4wOuY4EI0BTbbI4VxcNoBXCM8tsjkcDQjijkOlgU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGOE31Go7U2aHV6Z9UZYr_cwAkmLbQOEESrryfcQIzAdw&oe=6A848DC1",
        "height": 300,
        "width": 240
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=c0.256.2048.2048a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwFO9Jpi&_nc_oc=AdrOMVdJ0HsU5ZgqwDsxgBjBARm4wOuY4EI0BTbbI4VxcNoBXCM8tsjkcDQjijkOlgU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQE5MWdgWvztsJXHSE9Cy6GOwqOY6EaBLYf3H0xRyUuuAw&oe=6A848DC1",
        "height": 1080,
        "width": 1080
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=c0.256.2048.2048a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwFO9Jpi&_nc_oc=AdrOMVdJ0HsU5ZgqwDsxgBjBARm4wOuY4EI0BTbbI4VxcNoBXCM8tsjkcDQjijkOlgU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGjB7fjt9nAd6DwvVuKoL8Jyy9sov2ijzIGu4qVS0B8NQ&oe=6A848DC1",
        "height": 750,
        "width": 750
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=c0.256.2048.2048a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwFO9Jpi&_nc_oc=AdrOMVdJ0HsU5ZgqwDsxgBjBARm4wOuY4EI0BTbbI4VxcNoBXCM8tsjkcDQjijkOlgU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQE15Elp2g9LJNeYggKYM60kxYFSGJgtOkVxlEK45qDzHA&oe=6A848DC1",
        "height": 640,
        "width": 640
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=c0.256.2048.2048a_dst-jpg_e35_s480x480_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwFO9Jpi&_nc_oc=AdrOMVdJ0HsU5ZgqwDsxgBjBARm4wOuY4EI0BTbbI4VxcNoBXCM8tsjkcDQjijkOlgU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQH4Q7j4mAacNkiYX4Z4YFQi2xKILj6a5dg3_Z3Jox_XEg&oe=6A848DC1",
        "height": 480,
        "width": 480
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=c0.256.2048.2048a_dst-jpg_e35_s320x320_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwFO9Jpi&_nc_oc=AdrOMVdJ0HsU5ZgqwDsxgBjBARm4wOuY4EI0BTbbI4VxcNoBXCM8tsjkcDQjijkOlgU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQH50W_PJlKfv414bfM_wdJGtgmFh41JjKvrG_LftS0Cxg&oe=6A848DC1",
        "height": 320,
        "width": 320
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=c0.256.2048.2048a_dst-jpg_e35_s240x240_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwFO9Jpi&_nc_oc=AdrOMVdJ0HsU5ZgqwDsxgBjBARm4wOuY4EI0BTbbI4VxcNoBXCM8tsjkcDQjijkOlgU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQE_z1G_6e5h1JYjwh-gUOg2gITYYZexTSJjpH45eW67mA&oe=6A848DC1",
        "height": 240,
        "width": 240
      },
      {
        "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=c0.256.2048.2048a_dst-jpg_e35_s150x150_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwFO9Jpi&_nc_oc=AdrOMVdJ0HsU5ZgqwDsxgBjBARm4wOuY4EI0BTbbI4VxcNoBXCM8tsjkcDQjijkOlgU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHg3v455voNGoEu2292QZI6zqN2GV-mM_ibJjov8pWd3A&oe=6A848DC1",
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
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwFO9Jpi&_nc_oc=AdrOMVdJ0HsU5ZgqwDsxgBjBARm4wOuY4EI0BTbbI4VxcNoBXCM8tsjkcDQjijkOlgU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEY-DmOHCSTwy3RaVRiKCfpG0JQYdQq_TLN7MWnY-Ijog&oe=6A848DC1",
              "height": 2560,
              "width": 2048
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=dst-jpg_e35_p1080x1080_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwFO9Jpi&_nc_oc=AdrOMVdJ0HsU5ZgqwDsxgBjBARm4wOuY4EI0BTbbI4VxcNoBXCM8tsjkcDQjijkOlgU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFonhpxtOisDnUwTadfDB1-XVnTnO4hq-kQo4FSAzdRkA&oe=6A848DC1",
              "height": 1350,
              "width": 1080
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwFO9Jpi&_nc_oc=AdrOMVdJ0HsU5ZgqwDsxgBjBARm4wOuY4EI0BTbbI4VxcNoBXCM8tsjkcDQjijkOlgU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEOiwXQMojvZagXlVIZsEXSuGCokrEaZ-VnIvDKWYQY6g&oe=6A848DC1",
              "height": 900,
              "width": 720
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwFO9Jpi&_nc_oc=AdrOMVdJ0HsU5ZgqwDsxgBjBARm4wOuY4EI0BTbbI4VxcNoBXCM8tsjkcDQjijkOlgU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGmmwFqU6a6f5AC4dye5V6lskA9girL3LKan-SDpeZtFA&oe=6A848DC1",
              "height": 800,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwFO9Jpi&_nc_oc=AdrOMVdJ0HsU5ZgqwDsxgBjBARm4wOuY4EI0BTbbI4VxcNoBXCM8tsjkcDQjijkOlgU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEsnJuyonvP20foTBnhvjt9jrBvVRVMtAZdD4ehPuermA&oe=6A848DC1",
              "height": 600,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwFO9Jpi&_nc_oc=AdrOMVdJ0HsU5ZgqwDsxgBjBARm4wOuY4EI0BTbbI4VxcNoBXCM8tsjkcDQjijkOlgU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFwog218JsMrA6ElGqIr_ByhONrZ97XPnejXodYYxgQCw&oe=6A848DC1",
              "height": 400,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwFO9Jpi&_nc_oc=AdrOMVdJ0HsU5ZgqwDsxgBjBARm4wOuY4EI0BTbbI4VxcNoBXCM8tsjkcDQjijkOlgU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGOE31Go7U2aHV6Z9UZYr_cwAkmLbQOEESrryfcQIzAdw&oe=6A848DC1",
              "height": 300,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=c0.256.2048.2048a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwFO9Jpi&_nc_oc=AdrOMVdJ0HsU5ZgqwDsxgBjBARm4wOuY4EI0BTbbI4VxcNoBXCM8tsjkcDQjijkOlgU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQE5MWdgWvztsJXHSE9Cy6GOwqOY6EaBLYf3H0xRyUuuAw&oe=6A848DC1",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=c0.256.2048.2048a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwFO9Jpi&_nc_oc=AdrOMVdJ0HsU5ZgqwDsxgBjBARm4wOuY4EI0BTbbI4VxcNoBXCM8tsjkcDQjijkOlgU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGjB7fjt9nAd6DwvVuKoL8Jyy9sov2ijzIGu4qVS0B8NQ&oe=6A848DC1",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=c0.256.2048.2048a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwFO9Jpi&_nc_oc=AdrOMVdJ0HsU5ZgqwDsxgBjBARm4wOuY4EI0BTbbI4VxcNoBXCM8tsjkcDQjijkOlgU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQE15Elp2g9LJNeYggKYM60kxYFSGJgtOkVxlEK45qDzHA&oe=6A848DC1",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=c0.256.2048.2048a_dst-jpg_e35_s480x480_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwFO9Jpi&_nc_oc=AdrOMVdJ0HsU5ZgqwDsxgBjBARm4wOuY4EI0BTbbI4VxcNoBXCM8tsjkcDQjijkOlgU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQH4Q7j4mAacNkiYX4Z4YFQi2xKILj6a5dg3_Z3Jox_XEg&oe=6A848DC1",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=c0.256.2048.2048a_dst-jpg_e35_s320x320_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwFO9Jpi&_nc_oc=AdrOMVdJ0HsU5ZgqwDsxgBjBARm4wOuY4EI0BTbbI4VxcNoBXCM8tsjkcDQjijkOlgU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQH50W_PJlKfv414bfM_wdJGtgmFh41JjKvrG_LftS0Cxg&oe=6A848DC1",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=c0.256.2048.2048a_dst-jpg_e35_s240x240_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwFO9Jpi&_nc_oc=AdrOMVdJ0HsU5ZgqwDsxgBjBARm4wOuY4EI0BTbbI4VxcNoBXCM8tsjkcDQjijkOlgU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQE_z1G_6e5h1JYjwh-gUOg2gITYYZexTSJjpH45eW67mA&oe=6A848DC1",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=c0.256.2048.2048a_dst-jpg_e35_s150x150_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2MjkyMDg3ODIxNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMjA0OC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kWu_fsSCRM4Q7kNvwFO9Jpi&_nc_oc=AdrOMVdJ0HsU5ZgqwDsxgBjBARm4wOuY4EI0BTbbI4VxcNoBXCM8tsjkcDQjijkOlgU&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHg3v455voNGoEu2292QZI6zqN2GV-mM_ibJjov8pWd3A&oe=6A848DC1",
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
        "display_uri": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=c0.256.2048.2048a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=FGpPLN37LN4Q7kNvwFOqitb&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHMfYWr7gfGlBBS_ktBSEf1NExp1LmLyT0jIhnshzPpRg&oe=6A848DC1&_nc_sid=7a9f4b",
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
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773359776_18549779074074731_1818713941597627892_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2ODk4NTY3NDA0NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=AIgLG5dX6ukQ7kNvwFDD9HV&_nc_oc=AdrAMQOElN0JKeHXTCAQ7AMMgyto5WhgYsPvif7HLK1rJ4xEVrMfmznjD3J5C4aofEY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFGMTJpSz6IDSzCPzMcXZ31gICxV43_C-OShu3psyiFcg&oe=6A8496E6",
              "height": 1351,
              "width": 1081
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773359776_18549779074074731_1818713941597627892_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2ODk4NTY3NDA0NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=AIgLG5dX6ukQ7kNvwFDD9HV&_nc_oc=AdrAMQOElN0JKeHXTCAQ7AMMgyto5WhgYsPvif7HLK1rJ4xEVrMfmznjD3J5C4aofEY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFc9bm4QhXtwFYzciRkT3Shug_AG8Uym186GwEIrQIfwA&oe=6A8496E6",
              "height": 900,
              "width": 720
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773359776_18549779074074731_1818713941597627892_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2ODk4NTY3NDA0NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=AIgLG5dX6ukQ7kNvwFDD9HV&_nc_oc=AdrAMQOElN0JKeHXTCAQ7AMMgyto5WhgYsPvif7HLK1rJ4xEVrMfmznjD3J5C4aofEY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQF-mHA41rAD7I8tNNRon6PieWA00JdAEpuVKpr_qrLVNw&oe=6A8496E6",
              "height": 800,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773359776_18549779074074731_1818713941597627892_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2ODk4NTY3NDA0NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=AIgLG5dX6ukQ7kNvwFDD9HV&_nc_oc=AdrAMQOElN0JKeHXTCAQ7AMMgyto5WhgYsPvif7HLK1rJ4xEVrMfmznjD3J5C4aofEY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFLhnOkQ7t0BSvpeARXRV08v9GZAy1Jy1sP7wDAkzUcjQ&oe=6A8496E6",
              "height": 600,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773359776_18549779074074731_1818713941597627892_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2ODk4NTY3NDA0NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=AIgLG5dX6ukQ7kNvwFDD9HV&_nc_oc=AdrAMQOElN0JKeHXTCAQ7AMMgyto5WhgYsPvif7HLK1rJ4xEVrMfmznjD3J5C4aofEY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHT7UZFqJH6w94K-BnHMMor-T8jIxt_rnlOrECdN2GsEw&oe=6A8496E6",
              "height": 400,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773359776_18549779074074731_1818713941597627892_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2ODk4NTY3NDA0NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=AIgLG5dX6ukQ7kNvwFDD9HV&_nc_oc=AdrAMQOElN0JKeHXTCAQ7AMMgyto5WhgYsPvif7HLK1rJ4xEVrMfmznjD3J5C4aofEY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQE1ZqRGzJSfuNyCD5CiJdklZbrDQztVg3RDl0z9G5yCkg&oe=6A8496E6",
              "height": 300,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773359776_18549779074074731_1818713941597627892_n.jpg?stp=c0.135.1081.1081a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2ODk4NTY3NDA0NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=AIgLG5dX6ukQ7kNvwFDD9HV&_nc_oc=AdrAMQOElN0JKeHXTCAQ7AMMgyto5WhgYsPvif7HLK1rJ4xEVrMfmznjD3J5C4aofEY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEN4ssRJbTEL0KYmEImR1T3L-YntSuXummj8rSBu6kaTg&oe=6A8496E6",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773359776_18549779074074731_1818713941597627892_n.jpg?stp=c0.135.1081.1081a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2ODk4NTY3NDA0NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=AIgLG5dX6ukQ7kNvwFDD9HV&_nc_oc=AdrAMQOElN0JKeHXTCAQ7AMMgyto5WhgYsPvif7HLK1rJ4xEVrMfmznjD3J5C4aofEY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHIMjPhZ4X2tEh2NmUzQPNYvQmlPDGTKA2yhP3oAnRFEQ&oe=6A8496E6",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773359776_18549779074074731_1818713941597627892_n.jpg?stp=c0.135.1081.1081a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2ODk4NTY3NDA0NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=AIgLG5dX6ukQ7kNvwFDD9HV&_nc_oc=AdrAMQOElN0JKeHXTCAQ7AMMgyto5WhgYsPvif7HLK1rJ4xEVrMfmznjD3J5C4aofEY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHbqQURWt1ppPpWSlpyde8EU7xq6HnoFtgaOaLtJ57M0A&oe=6A8496E6",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773359776_18549779074074731_1818713941597627892_n.jpg?stp=c0.135.1081.1081a_dst-jpg_e35_s480x480_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2ODk4NTY3NDA0NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=AIgLG5dX6ukQ7kNvwFDD9HV&_nc_oc=AdrAMQOElN0JKeHXTCAQ7AMMgyto5WhgYsPvif7HLK1rJ4xEVrMfmznjD3J5C4aofEY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQH_B8kq_u65d0Zh14dZgOthGV6PiGFYBpbBZBr9G3Lrjg&oe=6A8496E6",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773359776_18549779074074731_1818713941597627892_n.jpg?stp=c0.135.1081.1081a_dst-jpg_e35_s320x320_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2ODk4NTY3NDA0NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=AIgLG5dX6ukQ7kNvwFDD9HV&_nc_oc=AdrAMQOElN0JKeHXTCAQ7AMMgyto5WhgYsPvif7HLK1rJ4xEVrMfmznjD3J5C4aofEY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHQhkFiokdGEeiEWrr86iGaPC4ObM5usKYIOh4RXjorMg&oe=6A8496E6",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773359776_18549779074074731_1818713941597627892_n.jpg?stp=c0.135.1081.1081a_dst-jpg_e35_s240x240_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2ODk4NTY3NDA0NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=AIgLG5dX6ukQ7kNvwFDD9HV&_nc_oc=AdrAMQOElN0JKeHXTCAQ7AMMgyto5WhgYsPvif7HLK1rJ4xEVrMfmznjD3J5C4aofEY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHRx_KnH2oChAnDXPvw9zzOGO9NV2YcGicjk3PImfw79Q&oe=6A8496E6",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773359776_18549779074074731_1818713941597627892_n.jpg?stp=c0.135.1081.1081a_dst-jpg_e35_s150x150_tt6&_nc_cat=102&ig_cache_key=Mzk2Mjg2NDc2ODk4NTY3NDA0NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=AIgLG5dX6ukQ7kNvwFDD9HV&_nc_oc=AdrAMQOElN0JKeHXTCAQ7AMMgyto5WhgYsPvif7HLK1rJ4xEVrMfmznjD3J5C4aofEY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGG3BJg6cvZWaaVbsUqKh4bfDGWH15phuwX0SeIS0jaeg&oe=6A8496E6",
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
        "display_uri": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773359776_18549779074074731_1818713941597627892_n.jpg?stp=c0.135.1081.1081a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=qAQlzaW4fSEQ7kNvwE4jcuI&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHuyw5lbvaMnEt1HeCxiDeUYo8SRz1yaZAW412dychCqw&oe=6A8496E6&_nc_sid=7a9f4b",
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
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773450308_18549779077074731_1935136921061811438_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=103&ig_cache_key=Mzk2Mjg2NDc3MDQzNzAyNTIyNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=vcsD61hPzNMQ7kNvwFWnqfd&_nc_oc=AdqgSMvq0QbUeV-BB1XzK62eXgJg2S0pp4q4RzpEUGp1-v1u5tcmNn7VdFseFR1lIWs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHUl21ZqyoSYD9dN7dV2TooA13pfC4u_pHITeQY3gnKmQ&oe=6A848865",
              "height": 1351,
              "width": 1081
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773450308_18549779077074731_1935136921061811438_n.jpg?stp=dst-jpg_e35_p720x720_tt6&_nc_cat=103&ig_cache_key=Mzk2Mjg2NDc3MDQzNzAyNTIyNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=vcsD61hPzNMQ7kNvwFWnqfd&_nc_oc=AdqgSMvq0QbUeV-BB1XzK62eXgJg2S0pp4q4RzpEUGp1-v1u5tcmNn7VdFseFR1lIWs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHmMkFT49yGg0wwTjGdqaMgsU2b4_0leBQ_1SSqPrQPUA&oe=6A848865",
              "height": 900,
              "width": 720
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773450308_18549779077074731_1935136921061811438_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=103&ig_cache_key=Mzk2Mjg2NDc3MDQzNzAyNTIyNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=vcsD61hPzNMQ7kNvwFWnqfd&_nc_oc=AdqgSMvq0QbUeV-BB1XzK62eXgJg2S0pp4q4RzpEUGp1-v1u5tcmNn7VdFseFR1lIWs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEmqpEXyIJgogg1LRCOIKDPulfVdEJHtgYIjXsPKzedRQ&oe=6A848865",
              "height": 800,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773450308_18549779077074731_1935136921061811438_n.jpg?stp=dst-jpg_e35_p480x480_tt6&_nc_cat=103&ig_cache_key=Mzk2Mjg2NDc3MDQzNzAyNTIyNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=vcsD61hPzNMQ7kNvwFWnqfd&_nc_oc=AdqgSMvq0QbUeV-BB1XzK62eXgJg2S0pp4q4RzpEUGp1-v1u5tcmNn7VdFseFR1lIWs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQF1YN039xTwhxXvUKNi9JZEA56RqdzovotQFohUbRDh0w&oe=6A848865",
              "height": 600,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773450308_18549779077074731_1935136921061811438_n.jpg?stp=dst-jpg_e35_p320x320_tt6&_nc_cat=103&ig_cache_key=Mzk2Mjg2NDc3MDQzNzAyNTIyNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=vcsD61hPzNMQ7kNvwFWnqfd&_nc_oc=AdqgSMvq0QbUeV-BB1XzK62eXgJg2S0pp4q4RzpEUGp1-v1u5tcmNn7VdFseFR1lIWs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQETlmRvwI7MOAX9s8CEeClsx0_NHr-AcfmwM3SCwWO_fw&oe=6A848865",
              "height": 400,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773450308_18549779077074731_1935136921061811438_n.jpg?stp=dst-jpg_e35_p240x240_tt6&_nc_cat=103&ig_cache_key=Mzk2Mjg2NDc3MDQzNzAyNTIyNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=vcsD61hPzNMQ7kNvwFWnqfd&_nc_oc=AdqgSMvq0QbUeV-BB1XzK62eXgJg2S0pp4q4RzpEUGp1-v1u5tcmNn7VdFseFR1lIWs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFa_1UfJisV-s1FP53f3T_a9hx5nabkfdFOz6MyQlR61w&oe=6A848865",
              "height": 300,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773450308_18549779077074731_1935136921061811438_n.jpg?stp=c0.135.1081.1081a_dst-jpg_e35_s1080x1080_tt6&_nc_cat=103&ig_cache_key=Mzk2Mjg2NDc3MDQzNzAyNTIyNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=vcsD61hPzNMQ7kNvwFWnqfd&_nc_oc=AdqgSMvq0QbUeV-BB1XzK62eXgJg2S0pp4q4RzpEUGp1-v1u5tcmNn7VdFseFR1lIWs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFgHsacOxfOK_RJDLVVbAJTGMHmJfITEloTcdEHPMg_Yw&oe=6A848865",
              "height": 1080,
              "width": 1080
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773450308_18549779077074731_1935136921061811438_n.jpg?stp=c0.135.1081.1081a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=103&ig_cache_key=Mzk2Mjg2NDc3MDQzNzAyNTIyNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=vcsD61hPzNMQ7kNvwFWnqfd&_nc_oc=AdqgSMvq0QbUeV-BB1XzK62eXgJg2S0pp4q4RzpEUGp1-v1u5tcmNn7VdFseFR1lIWs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGzS0Eb81kfavxARmnsuEEmgEgsce2halWfM9NIfVYjEQ&oe=6A848865",
              "height": 750,
              "width": 750
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773450308_18549779077074731_1935136921061811438_n.jpg?stp=c0.135.1081.1081a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=103&ig_cache_key=Mzk2Mjg2NDc3MDQzNzAyNTIyNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=vcsD61hPzNMQ7kNvwFWnqfd&_nc_oc=AdqgSMvq0QbUeV-BB1XzK62eXgJg2S0pp4q4RzpEUGp1-v1u5tcmNn7VdFseFR1lIWs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQF43PW0YZrA0nLDEzocDQOk-wNkmDANBszj1mkeLgdWWg&oe=6A848865",
              "height": 640,
              "width": 640
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773450308_18549779077074731_1935136921061811438_n.jpg?stp=c0.135.1081.1081a_dst-jpg_e35_s480x480_tt6&_nc_cat=103&ig_cache_key=Mzk2Mjg2NDc3MDQzNzAyNTIyNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=vcsD61hPzNMQ7kNvwFWnqfd&_nc_oc=AdqgSMvq0QbUeV-BB1XzK62eXgJg2S0pp4q4RzpEUGp1-v1u5tcmNn7VdFseFR1lIWs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFiOanccwEaPw4q9ebf19GIOKrpXj2CZYi2iVUO6cpocw&oe=6A848865",
              "height": 480,
              "width": 480
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773450308_18549779077074731_1935136921061811438_n.jpg?stp=c0.135.1081.1081a_dst-jpg_e35_s320x320_tt6&_nc_cat=103&ig_cache_key=Mzk2Mjg2NDc3MDQzNzAyNTIyNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=vcsD61hPzNMQ7kNvwFWnqfd&_nc_oc=AdqgSMvq0QbUeV-BB1XzK62eXgJg2S0pp4q4RzpEUGp1-v1u5tcmNn7VdFseFR1lIWs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEOJcA7WZhM6KrWbxvZdJd5sxIlnTVzZIJR7AZE89HA8w&oe=6A848865",
              "height": 320,
              "width": 320
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773450308_18549779077074731_1935136921061811438_n.jpg?stp=c0.135.1081.1081a_dst-jpg_e35_s240x240_tt6&_nc_cat=103&ig_cache_key=Mzk2Mjg2NDc3MDQzNzAyNTIyNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=vcsD61hPzNMQ7kNvwFWnqfd&_nc_oc=AdqgSMvq0QbUeV-BB1XzK62eXgJg2S0pp4q4RzpEUGp1-v1u5tcmNn7VdFseFR1lIWs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFeSEMH2aRaD6LZYaKvoxKS89Mj-vTwJm7cVKAJPSrK5A&oe=6A848865",
              "height": 240,
              "width": 240
            },
            {
              "url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-15/773450308_18549779077074731_1935136921061811438_n.jpg?stp=c0.135.1081.1081a_dst-jpg_e35_s150x150_tt6&_nc_cat=103&ig_cache_key=Mzk2Mjg2NDc3MDQzNzAyNTIyNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=vcsD61hPzNMQ7kNvwFWnqfd&_nc_oc=AdqgSMvq0QbUeV-BB1XzK62eXgJg2S0pp4q4RzpEUGp1-v1u5tcmNn7VdFseFR1lIWs&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEbqsv4aJwXQca99ZRv42xTU-swlE_axp3pfgGnBcax-Q&oe=6A848865",
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
        "display_uri": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773450308_18549779077074731_1935136921061811438_n.jpg?stp=c0.135.1081.1081a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=AiNZnCOGUrEQ7kNvwHc6pJ9&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHMN_kRlYA3-q0ylTE2hK2ynsOqffWgUTkCh7XACQGspw&oe=6A848865&_nc_sid=7a9f4b",
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
    "crawled_at": "2026-08-14T08:14:50.847Z"
  },
  {
    "id": "3962862498097316445_2237970730",
    "pk": "3962862498097316445",
    "type": "Video",
    "image": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773863104_18549778204074731_6753476794430800343_n.jpg?stp=c0.469.1206.1206a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=-VQ5JFdVgCgQ7kNvwHexgGt&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQG4345Iic91ciytMO3TKmhuqWlMNiTig4b6npJhULvS9g&oe=6A84886B&_nc_sid=7a9f4b",
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
          "profile_pic_url": "https://scontent-ord5-2.cdninstagram.com/v/t51.2885-19/54800477_2189592477793980_624948081216978944_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby45NjAuYzIifQ&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_cat=100&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=Iz2JRul0k6kQ7kNvwHjRMdH&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHRHvRdPJVhB8K-jfp0_4Jhe_Kh2b6axxPUNG2lHcMD_w&oe=6A8492D0&_nc_sid=7a9f4b",
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
          "profile_pic_url": "https://scontent-ord5-2.cdninstagram.com/v/t51.2885-19/145976495_717061658996801_8615672779095137678_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby43MjAuYzIifQ&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_cat=105&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=NEQAeZQ5-dcQ7kNvwGe0AYW&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHVmYPkW9fTK63s6o6zIFVKURvCweFVhucmSPb8a2qxRA&oe=6A849B1B&_nc_sid=7a9f4b",
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
          "profile_pic_url": "https://scontent-ord5-2.cdninstagram.com/v/t51.2885-19/122597843_342367900160616_7189706853388346855_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_cat=100&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=z4pokypaePIQ7kNvwEdhpQf&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQFJbthpL4xkpk4E8JkSY7x-Gw6JkL-xLAqOG5IZ9TrDZw&oe=6A849E78&_nc_sid=7a9f4b",
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
          "profile_pic_url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-19/728833598_18119358160631539_7399830227988371889_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4zMjAuYzIifQ&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_cat=107&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=kvTWyc8VRAsQ7kNvwFm3EJD&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQEx1IiiBllSXEUM28pjCWvmY9i8J-tF_6469artmu_5vQ&oe=6A8487BC&_nc_sid=7a9f4b",
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
          "cover_artwork_thumbnail_uri": "https://scontent-ord5-2.xx.fbcdn.net/v/t39.30808-6/771956285_71061393640494_4663288867027829485_n.jpg?stp=dst-jpg_s168x128_tt6&_nc_cat=103&ccb=1-7&_nc_sid=2f2557&_nc_ohc=PyQjV1sqNRgQ7kNvwHCMqdS&_nc_oc=Ado0z095x2g7oxpCY1ibZ76XKK1kvYt287mWDSDXZOjhiSaZKmyI5hy4KQKUsR9n9Hw&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-2.xx&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a20f&oh=00_AQE83jot9o88BYi8Nk9SVM_knhWhkxmGeYUqnE1sISpqiw&oe=6A84AB54"
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
      "profile_pic_url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=L9VCN6COaTMQ7kNvwEtchDb&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQGtAYN3nq3QGfxuCkn1E-5A4KCex9UNKdqu4rb5CDdvxA&oe=6A84A633&_nc_sid=7a9f4b",
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
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=L9VCN6COaTMQ7kNvwEtchDb&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQHlusG19xf_r4IJPwxyrxIMODZbnUgAD9M5lUitKOejtQ&oe=6A84A633&_nc_sid=7a9f4b"
      },
      "__typename": "XDTUserDict",
      "full_name": "Pakuwon Mall Jogja"
    },
    "images": [
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773863104_18549778204074731_6753476794430800343_n.jpg?stp=dst-jpg_e15_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2MjQ5ODA5NzMxNjQ0NTE4NTQ5Nzc4MTk4MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=zRvBXCq30VsQ7kNvwG9YqaU&_nc_oc=AdrjMEKTOd6oAIDZXCAZzyMkG7geWkv1go1ywfvfhF9IWOYsVv3tZ0lowjPDu-WRfcY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEjn2G9BccEhip2orw40zwcFtLK775uoW_yo77Xf0y6VA&oe=6A84886B",
        "height": 2144,
        "width": 1206
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773863104_18549778204074731_6753476794430800343_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2MjQ5ODA5NzMxNjQ0NTE4NTQ5Nzc4MTk4MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=zRvBXCq30VsQ7kNvwG9YqaU&_nc_oc=AdrjMEKTOd6oAIDZXCAZzyMkG7geWkv1go1ywfvfhF9IWOYsVv3tZ0lowjPDu-WRfcY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHhEvl_SrsPXG6tIumIQPYJWmbgTPhP7XjbdJ7C0t7jUA&oe=6A84886B",
        "height": 1920,
        "width": 1080
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773863104_18549778204074731_6753476794430800343_n.jpg?stp=dst-jpg_e35_p720x720_sh2.08_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2MjQ5ODA5NzMxNjQ0NTE4NTQ5Nzc4MTk4MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=zRvBXCq30VsQ7kNvwG9YqaU&_nc_oc=AdrjMEKTOd6oAIDZXCAZzyMkG7geWkv1go1ywfvfhF9IWOYsVv3tZ0lowjPDu-WRfcY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGP3T_3ZEo9EMxnkGMJKAglTwsJ3JeQh2qbSTVTPktUuw&oe=6A84886B",
        "height": 1280,
        "width": 720
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773863104_18549778204074731_6753476794430800343_n.jpg?stp=dst-jpg_e35_p640x640_sh2.08_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2MjQ5ODA5NzMxNjQ0NTE4NTQ5Nzc4MTk4MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=zRvBXCq30VsQ7kNvwG9YqaU&_nc_oc=AdrjMEKTOd6oAIDZXCAZzyMkG7geWkv1go1ywfvfhF9IWOYsVv3tZ0lowjPDu-WRfcY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGMPjNk41GH_xtToL38hhpY5bC6w3VsexnM4byvk5Kzww&oe=6A84886B",
        "height": 1138,
        "width": 640
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773863104_18549778204074731_6753476794430800343_n.jpg?stp=dst-jpg_e15_p480x480_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2MjQ5ODA5NzMxNjQ0NTE4NTQ5Nzc4MTk4MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=zRvBXCq30VsQ7kNvwG9YqaU&_nc_oc=AdrjMEKTOd6oAIDZXCAZzyMkG7geWkv1go1ywfvfhF9IWOYsVv3tZ0lowjPDu-WRfcY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEYmDHrUeQPLuL13YzJjp-E2KDwBtmqNDbfqEZpZpI_bw&oe=6A84886B",
        "height": 853,
        "width": 480
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773863104_18549778204074731_6753476794430800343_n.jpg?stp=dst-jpg_e15_p320x320_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2MjQ5ODA5NzMxNjQ0NTE4NTQ5Nzc4MTk4MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=zRvBXCq30VsQ7kNvwG9YqaU&_nc_oc=AdrjMEKTOd6oAIDZXCAZzyMkG7geWkv1go1ywfvfhF9IWOYsVv3tZ0lowjPDu-WRfcY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEBC9L9fRzmEJC6G2G8snzcYpuoYjtwV4ihmTfW5HNVbw&oe=6A84886B",
        "height": 569,
        "width": 320
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773863104_18549778204074731_6753476794430800343_n.jpg?stp=dst-jpg_e15_p240x240_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2MjQ5ODA5NzMxNjQ0NTE4NTQ5Nzc4MTk4MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=zRvBXCq30VsQ7kNvwG9YqaU&_nc_oc=AdrjMEKTOd6oAIDZXCAZzyMkG7geWkv1go1ywfvfhF9IWOYsVv3tZ0lowjPDu-WRfcY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEOkVznt6Ex542QtWHp__qPk3Xsee-aW4u3a4CLcwIf6g&oe=6A84886B",
        "height": 427,
        "width": 240
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773863104_18549778204074731_6753476794430800343_n.jpg?stp=c0.469.1206.1206a_dst-jpg_e35_s1080x1080_sh2.08_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2MjQ5ODA5NzMxNjQ0NTE4NTQ5Nzc4MTk4MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=zRvBXCq30VsQ7kNvwG9YqaU&_nc_oc=AdrjMEKTOd6oAIDZXCAZzyMkG7geWkv1go1ywfvfhF9IWOYsVv3tZ0lowjPDu-WRfcY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGjL5EtRFDprxlmXPhsGz_yBJv0_Q6enZHMcXNUdwQHmQ&oe=6A84886B",
        "height": 1080,
        "width": 1080
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773863104_18549778204074731_6753476794430800343_n.jpg?stp=c0.469.1206.1206a_dst-jpg_e35_s750x750_sh2.08_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2MjQ5ODA5NzMxNjQ0NTE4NTQ5Nzc4MTk4MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=zRvBXCq30VsQ7kNvwG9YqaU&_nc_oc=AdrjMEKTOd6oAIDZXCAZzyMkG7geWkv1go1ywfvfhF9IWOYsVv3tZ0lowjPDu-WRfcY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQFI1Se2oVTK9-P28GdN_H-5akJzVVl7TnUBU0yCe-Sf6A&oe=6A84886B",
        "height": 750,
        "width": 750
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773863104_18549778204074731_6753476794430800343_n.jpg?stp=c0.469.1206.1206a_dst-jpg_e35_s640x640_sh2.08_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2MjQ5ODA5NzMxNjQ0NTE4NTQ5Nzc4MTk4MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=zRvBXCq30VsQ7kNvwG9YqaU&_nc_oc=AdrjMEKTOd6oAIDZXCAZzyMkG7geWkv1go1ywfvfhF9IWOYsVv3tZ0lowjPDu-WRfcY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQGWbvecymOgqzFJIva0XLzOnYpFgwpTCyqF_YVW0fsbiA&oe=6A84886B",
        "height": 640,
        "width": 640
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773863104_18549778204074731_6753476794430800343_n.jpg?stp=c0.469.1206.1206a_dst-jpg_e15_s480x480_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2MjQ5ODA5NzMxNjQ0NTE4NTQ5Nzc4MTk4MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=zRvBXCq30VsQ7kNvwG9YqaU&_nc_oc=AdrjMEKTOd6oAIDZXCAZzyMkG7geWkv1go1ywfvfhF9IWOYsVv3tZ0lowjPDu-WRfcY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHyINKuZNQSzX3194dYGQGOlKIJFx5y00CYpoH1rxGDgQ&oe=6A84886B",
        "height": 480,
        "width": 480
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773863104_18549778204074731_6753476794430800343_n.jpg?stp=c0.469.1206.1206a_dst-jpg_e15_s320x320_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2MjQ5ODA5NzMxNjQ0NTE4NTQ5Nzc4MTk4MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=zRvBXCq30VsQ7kNvwG9YqaU&_nc_oc=AdrjMEKTOd6oAIDZXCAZzyMkG7geWkv1go1ywfvfhF9IWOYsVv3tZ0lowjPDu-WRfcY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQEpDTjKEWrzSdVRmbPkL4UcRj7P7qLT_tSVGFogUUKssg&oe=6A84886B",
        "height": 320,
        "width": 320
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773863104_18549778204074731_6753476794430800343_n.jpg?stp=c0.469.1206.1206a_dst-jpg_e15_s240x240_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2MjQ5ODA5NzMxNjQ0NTE4NTQ5Nzc4MTk4MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=zRvBXCq30VsQ7kNvwG9YqaU&_nc_oc=AdrjMEKTOd6oAIDZXCAZzyMkG7geWkv1go1ywfvfhF9IWOYsVv3tZ0lowjPDu-WRfcY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQErAviB4FiJkv2J6vSM6hZ_OL1weY61gF35TKUZzUi2ug&oe=6A84886B",
        "height": 240,
        "width": 240
      },
      {
        "url": "https://scontent-ord5-1.cdninstagram.com/v/t51.82787-15/773863104_18549778204074731_6753476794430800343_n.jpg?stp=c0.469.1206.1206a_dst-jpg_e15_s150x150_tt6&_nc_cat=106&ig_cache_key=Mzk2Mjg2MjQ5ODA5NzMxNjQ0NTE4NTQ5Nzc4MTk4MDc0NzMx.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjEyMDYuc2RyLnZpZGVvX2RlZmF1bHRfY292ZXJfZnJhbWUuQzMifQ%3D%3D&_nc_ohc=zRvBXCq30VsQ7kNvwG9YqaU&_nc_oc=AdrjMEKTOd6oAIDZXCAZzyMkG7geWkv1go1ywfvfhF9IWOYsVv3tZ0lowjPDu-WRfcY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent-ord5-1.cdninstagram.com&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&oh=00_AQHiaNCSfD6DovpHgQo-JM9tx5RuZiVmAGKBxI5vJMJ0Nw&oe=6A84886B",
        "height": 150,
        "width": 150
      }
    ],
    "video_versions": [
      {
        "width": 720,
        "height": 1280,
        "url": "https://scontent-ord5-2.cdninstagram.com/o1/v/t2/f2/m86/AQPxSh7VvKkX1upeIUsUcOqx1cOrBbDZgdgUmrWWwc9aWGQijquX5p1Xy4KVTZpuZVGK29pU60_nZQfdq0w84Pg4P6aJt1pI-e07Tpk.mp4?_nc_cat=103&_nc_sid=5e9851&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_ohc=Du2ez4r2alIQ7kNvwHP9jWm&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTc1MzQwNDEwMjQ2Mzg5NSwiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjoyMSwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=da7e036ff4ca17a5&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC8wMjRFOERENEIzODgzNzc1QTNDOTA1ODhBMjk0QTBCN192aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyL0YzNDFFQzQwN0Q2MDlCRTdFOEU3MUY3OUQwOTUwNTgyX2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACauxubKxq2dBhUCKAJDMywXQDWAAAAAAAAYEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&_nc_zt=28&oh=00_AQEtLWAqr0BJQ4cn8yz480agW_ONYXzMWEdONFpN8Uyx6w&oe=6A80B960",
        "type": 101
      },
      {
        "width": 720,
        "height": 1280,
        "url": "https://scontent-ord5-2.cdninstagram.com/o1/v/t2/f2/m86/AQPxSh7VvKkX1upeIUsUcOqx1cOrBbDZgdgUmrWWwc9aWGQijquX5p1Xy4KVTZpuZVGK29pU60_nZQfdq0w84Pg4P6aJt1pI-e07Tpk.mp4?_nc_cat=103&_nc_sid=5e9851&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_ohc=Du2ez4r2alIQ7kNvwHP9jWm&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTc1MzQwNDEwMjQ2Mzg5NSwiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjoyMSwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=da7e036ff4ca17a5&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC8wMjRFOERENEIzODgzNzc1QTNDOTA1ODhBMjk0QTBCN192aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyL0YzNDFFQzQwN0Q2MDlCRTdFOEU3MUY3OUQwOTUwNTgyX2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACauxubKxq2dBhUCKAJDMywXQDWAAAAAAAAYEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&_nc_zt=28&oh=00_AQEtLWAqr0BJQ4cn8yz480agW_ONYXzMWEdONFpN8Uyx6w&oe=6A80B960",
        "type": 102
      },
      {
        "width": 720,
        "height": 1280,
        "url": "https://scontent-ord5-2.cdninstagram.com/o1/v/t2/f2/m86/AQPxSh7VvKkX1upeIUsUcOqx1cOrBbDZgdgUmrWWwc9aWGQijquX5p1Xy4KVTZpuZVGK29pU60_nZQfdq0w84Pg4P6aJt1pI-e07Tpk.mp4?_nc_cat=103&_nc_sid=5e9851&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_ohc=Du2ez4r2alIQ7kNvwHP9jWm&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTc1MzQwNDEwMjQ2Mzg5NSwiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjoyMSwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=da7e036ff4ca17a5&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC8wMjRFOERENEIzODgzNzc1QTNDOTA1ODhBMjk0QTBCN192aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyL0YzNDFFQzQwN0Q2MDlCRTdFOEU3MUY3OUQwOTUwNTgyX2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACauxubKxq2dBhUCKAJDMywXQDWAAAAAAAAYEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=xqUxc5ForAzglmCJLbuc7A&_nc_ss=7a22e&_nc_zt=28&oh=00_AQEtLWAqr0BJQ4cn8yz480agW_ONYXzMWEdONFpN8Uyx6w&oe=6A80B960",
        "type": 103
      }
    ],
    "carousel_media_count": null,
    "carousel_media": null,
    "coauthor_producers": [
      {
        "pk": "18870279538",
        "profile_pic_url": "https://scontent-ord5-2.cdninstagram.com/v/t51.82787-19/728833598_18119358160631539_7399830227988371889_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4zMjAuYzIifQ&_nc_ht=scontent-ord5-2.cdninstagram.com&_nc_cat=107&_nc_oc=Q6cZ2gF4A3Gk5V31ImJrtyWIQytNrUCoHwUT5O4VyeVOoJSr1PHLiQIpmAxRPhzqjC8hYc0&_nc_ohc=kvTWyc8VRAsQ7kNvwFm3EJD&_nc_gid=xqUxc5ForAzglmCJLbuc7A&edm=AP4sbd4BAAAA&ccb=7-5&oh=00_AQEx1IiiBllSXEUM28pjCWvmY9i8J-tF_6469artmu_5vQ&oe=6A8487BC&_nc_sid=7a9f4b",
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
    "crawled_at": "2026-08-14T08:14:50.847Z"
  }
]
```
