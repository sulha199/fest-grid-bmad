# Task 1b — Run 1: apify/instagram-api-scraper - getPostByUrl, VALID post URL

Part of [3-4d-per-use-case-actor-selection-and-sync-path-timeout.md](../3-4d-per-use-case-actor-selection-and-sync-path-timeout.md) Task 1b. Part 1 (revised 2026-08-14 -- see Dev Notes 'Task 1b Part 1 Revised'). Baseline/sanity half of a pair with Run 2 (same actor, invalid post URL).

**Expected:** 1 item returned, matching the target post.

**Input params:** `{"directUrls": ["https://www.instagram.com/p/Db9-oj1EaiF/"], "resultsType": "posts", "resultsLimit": 1}`

* **Date/Time:** 2026-08-15 16:27:51
* **Run ID:** [8bf5z1HQpxOUkKYcn](https://console.apify.com/actors/RB9HEZitC8hIUXAha/runs/8bf5z1HQpxOUkKYcn#output)
* **Duration:** 7 s

- Success (Y/N):Y
- Cost ($):
  * **Result (1):** \$0.0023
  * **Actor start (1):** \$0.001
  * **Search result (0):** \$0.00
  * **Add-on: Date filter (0):** \$0.00
- Items returned (count):
- Output (paste full JSON):

```json
[
  {
    "inputUrl": "https://www.instagram.com/p/Db9-oj1EaiF/",
    "id": "3962598713289975941",
    "type": "Sidecar",
    "shortCode": "Db9-oj1EaiF",
    "caption": "Lagi cari skincare, makeup, body care, dan parfum lokal? Ke MY SKIN BUT BETTER aja!\n\nLagi ada diskon sampai 50% ditambah extra discount sampai 15k dan banyaaak banget free giftnya loh!\nAyo buruan agendain ke storenya!\n\n#pakuwonmalljogja",
    "hashtags": [
      "pakuwonmalljogja"
    ],
    "mentions": [],
    "url": "https://www.instagram.com/p/Db9-oj1EaiF/",
    "commentsCount": 0,
    "firstComment": "",
    "latestComments": [],
    "dimensionsHeight": 1348,
    "dimensionsWidth": 1080,
    "displayUrl": "https://scontent-lax3-2.cdninstagram.com/v/t51.82787-15/773155657_18549672562074731_4050104637918995153_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=scontent-lax3-2.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gHU__OE-YUegJGqKAzB0TmSSqiRdb37F0ZHGSj5SPUNUpg7wQYzMh2JD5TxSIR9L4w&_nc_ohc=jpsfgcuttEQQ7kNvwFewg-x&_nc_gid=-p8BmcqoZi5frL8pTLjxlQ&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQEeBp5XCVYQLiuD14QRM5Ar1-jibQ4DgMYB0Zs3mJJFkA&oe=6A85EE48&_nc_sid=c6f216",
    "images": [
      "https://scontent-lax3-2.cdninstagram.com/v/t51.82787-15/773155657_18549672562074731_4050104637918995153_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=scontent-lax3-2.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gHU__OE-YUegJGqKAzB0TmSSqiRdb37F0ZHGSj5SPUNUpg7wQYzMh2JD5TxSIR9L4w&_nc_ohc=jpsfgcuttEQQ7kNvwFewg-x&_nc_gid=-p8BmcqoZi5frL8pTLjxlQ&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQEeBp5XCVYQLiuD14QRM5Ar1-jibQ4DgMYB0Zs3mJJFkA&oe=6A85EE48&_nc_sid=c6f216",
      "https://scontent-lax3-2.cdninstagram.com/v/t51.82787-15/772840060_18549672595074731_84578541425128604_n.jpg?stp=dst-jpg_e15_fr_p1080x1080_tt6&_nc_ht=scontent-lax3-2.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gHU__OE-YUegJGqKAzB0TmSSqiRdb37F0ZHGSj5SPUNUpg7wQYzMh2JD5TxSIR9L4w&_nc_ohc=EPfDSVv3ZBwQ7kNvwFmuL5W&_nc_gid=-p8BmcqoZi5frL8pTLjxlQ&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQFvdZY2uZkfUra3efuJ9FdPsCpUjWekbeN4DrFFZ9Ls9Q&oe=6A861EDB&_nc_sid=c6f216"
    ],
    "alt": "Photo by Pakuwon Mall Jogja on August 12, 2026.",
    "likesCount": 7,
    "timestamp": "2026-08-13T05:23:19.000Z",
    "childPosts": [
      {
        "id": "3962598269334811351",
        "type": "Image",
        "shortCode": "Db9-iGXR3LX",
        "caption": "",
        "hashtags": [],
        "mentions": [],
        "url": "https://www.instagram.com/p/Db9-iGXR3LX/",
        "commentsCount": 0,
        "firstComment": "",
        "latestComments": [],
        "dimensionsHeight": 1348,
        "dimensionsWidth": 1080,
        "displayUrl": "https://scontent-lax3-2.cdninstagram.com/v/t51.82787-15/773155657_18549672562074731_4050104637918995153_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=scontent-lax3-2.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gHU__OE-YUegJGqKAzB0TmSSqiRdb37F0ZHGSj5SPUNUpg7wQYzMh2JD5TxSIR9L4w&_nc_ohc=jpsfgcuttEQQ7kNvwFewg-x&_nc_gid=-p8BmcqoZi5frL8pTLjxlQ&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQEeBp5XCVYQLiuD14QRM5Ar1-jibQ4DgMYB0Zs3mJJFkA&oe=6A85EE48&_nc_sid=c6f216",
        "images": [],
        "alt": "Photo by Pakuwon Mall Jogja on August 12, 2026. May be an image of one or more people, makeup, hair product, ointment, cosmetics, hand cream, lotion and text.",
        "likesCount": null,
        "timestamp": null,
        "childPosts": [],
        "ownerId": null,
        "originalWidth": 1179,
        "originalHeight": 1472
      },
      {
        "id": "3962598271096242180",
        "type": "Image",
        "shortCode": "Db9-iIARMAE",
        "caption": "",
        "hashtags": [],
        "mentions": [],
        "url": "https://www.instagram.com/p/Db9-iIARMAE/",
        "commentsCount": 0,
        "firstComment": "",
        "latestComments": [],
        "dimensionsHeight": 1348,
        "dimensionsWidth": 1080,
        "displayUrl": "https://scontent-lax3-2.cdninstagram.com/v/t51.82787-15/772840060_18549672595074731_84578541425128604_n.jpg?stp=dst-jpg_e15_fr_p1080x1080_tt6&_nc_ht=scontent-lax3-2.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gHU__OE-YUegJGqKAzB0TmSSqiRdb37F0ZHGSj5SPUNUpg7wQYzMh2JD5TxSIR9L4w&_nc_ohc=EPfDSVv3ZBwQ7kNvwFmuL5W&_nc_gid=-p8BmcqoZi5frL8pTLjxlQ&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQFvdZY2uZkfUra3efuJ9FdPsCpUjWekbeN4DrFFZ9Ls9Q&oe=6A861EDB&_nc_sid=c6f216",
        "images": [],
        "alt": "Photo by Pakuwon Mall Jogja on August 12, 2026. May be an image of one or more people, makeup, pallette, cosmetics, hand cream and text that says 'MY SKİN BUTBETTER BUT AE.HAUSY INDIE BRAND Sale 554はー UP to 50 % OFF Raine Raine លបរ់តទ\"ា FACE Pow XTRA DISCOUNT UP to 15K FREE GIFT EL 제 Mete t0u MY SKIN BUT BETTER LG Floor, Pakuwon Mall Jogja'.",
        "likesCount": null,
        "timestamp": null,
        "childPosts": [],
        "ownerId": null,
        "originalWidth": 1080,
        "originalHeight": 1348
      }
    ],
    "ownerFullName": "Pakuwon Mall Jogja",
    "ownerUsername": "pakuwonmall.jogja",
    "ownerId": "2237970730",
    "paidPartnership": false,
    "isCommentsDisabled": false,
    "originalWidth": 1179,
    "originalHeight": 1472
  }
]
```
