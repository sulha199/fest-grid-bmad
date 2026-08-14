# Task 1c — Run 5: apify/instagram-post-scraper — Scenario B (precise split)

Part of [3-4d-per-use-case-actor-selection-and-sync-path-timeout.md](../3-4d-per-use-case-actor-selection-and-sync-path-timeout.md) Task 1c. **Caveat (2026-08-14, same as Run 2): the "exactly 3" prediction is stale by test time** — the account has kept posting since the doc's 2026-08-13 capture (Run 4 shows activity as recent as `2026-08-14T03:30:36Z`), so expect *more than 3* real new items here too, not exactly 3. Expect **zero** of the 3 known pinned timestamps (`2026-08-01T03:58:43Z`, `2026-08-04T05:21:00Z`, `2026-08-04T14:07:36Z`) — this actor's `skipPinnedPosts: true` already confirmed clean in Run 4.

**Input params:** `{"username": ["https://www.instagram.com/pakuwonmall.jogja/"], "resultsLimit": 15, "dataDetailLevel": "basicData", "skipPinnedPosts": true, "onlyPostsNewerThan": "2026-08-13T00:00:00.000Z"}`

* **Date/Time:** 2026-08-14 14:52:44
* **Run ID:** [gH45Y0Wc0aWUKBmqb](https://console.apify.com/actors/nH2AHrwxeTRJoN5hX/runs/gH45Y0Wc0aWUKBmqb#output)
* **Duration:** 35 s

- Cost ($):
  * **Post (15):** \$0.0255
  * **Post details (0):** \$0.00
- Items returned (count):
- Output (paste full JSON):

```json
[
  {
    "caption": "🇮🇩✨ SPESIAL PROMO KEMERDEKAAN DI BUNAACA! ✨🇮🇩\n\nMerdeka makin manis! 😍🍩 Nikmati promo BUY 2 GET 1 FREE untuk semua varian yang tersedia!\n\n📅 17 Agustus 2026\n\n📍 Bunaaca Pakuwon Mall Jogja — LG Floor, depan Lobby B\n\n#pakuwonmalljogja",
    "commentsCount": 0,
    "dimensionsHeight": 1350,
    "dimensionsWidth": 1080,
    "displayUrl": "https://instagram.ffuk5-1.fna.fbcdn.net/v/t51.82787-15/775166903_18549990493074731_9081685106337880888_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=instagram.ffuk5-1.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gHxu8T5-6M5PYnz_RRzIzFW-bgBhauXd42AIgdfcUvOdUwow8eB8BZ_HdKCLENQrO4&_nc_ohc=fDu0SuWidG0Q7kNvwHZoKR_&_nc_gid=_O_389kPWe0Kz-xyq6eLrg&edm=APU89FABAAAA&ccb=7-5&oh=00_AQHw8kp1HdCtw_SYjhCy3N2zXF4VPWo4j0bDoTnguEeWew&oe=6A849592&_nc_sid=bc0c2c",
    "hashtags": [
      "pakuwonmalljogja"
    ],
    "id": "3963398885586570584",
    "isCommentsDisabled": false,
    "likesCount": 0,
    "ownerFullName": "Pakuwon Mall Jogja",
    "ownerId": "2237970730",
    "ownerUsername": "pakuwonmall.jogja",
    "shortCode": "DcA0kmWkQ1Y",
    "timestamp": "2026-08-14T07:53:07.000Z",
    "type": "Sidecar",
    "url": "https://www.instagram.com/p/DcA0kmWkQ1Y/"
  },
  {
    "caption": "🔥 CRUNCHMATE NOW OPEN! 🔥\n\nCrunchmate sekarang hadir di Pakuwon Mall Jogja LG Floor! 🤩✨\nJangan sampai lewatkan PROMO SPESIAL BUY 1 GET 1!\n📅 14–20 Agustus 2026\n\nYuk cobain Crunchmate sekarang! 😋🔥\n\n#pakuwonmalljogja",
    "commentsCount": 0,
    "dimensionsHeight": 1920,
    "dimensionsWidth": 1080,
    "displayUrl": "https://instagram.ffuk5-1.fna.fbcdn.net/v/t51.82787-15/773756666_18549989311074731_7591783819368902774_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=instagram.ffuk5-1.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gHxu8T5-6M5PYnz_RRzIzFW-bgBhauXd42AIgdfcUvOdUwow8eB8BZ_HdKCLENQrO4&_nc_ohc=ddJVZdEXwSsQ7kNvwGizchc&_nc_gid=_O_389kPWe0Kz-xyq6eLrg&edm=APU89FABAAAA&ccb=7-5&oh=00_AQHvTjHxi0Z8o6GolrE6_oeTzo-o2cXM-6LI3JY_myj7BQ&oe=6A849B87&_nc_sid=bc0c2c",
    "hashtags": [
      "pakuwonmalljogja"
    ],
    "id": "3963395413478023137",
    "isCommentsDisabled": false,
    "likesCount": 3,
    "ownerFullName": "Pakuwon Mall Jogja",
    "ownerId": "2237970730",
    "ownerUsername": "pakuwonmall.jogja",
    "productType": "clips",
    "shortCode": "DcAzyEsxR_h",
    "timestamp": "2026-08-14T07:47:26.000Z",
    "type": "Video",
    "url": "https://www.instagram.com/p/DcAzyEsxR_h/",
    "videoUrl": "https://instagram.ffuk5-1.fna.fbcdn.net/o1/v/t2/f2/m86/AQPW1xBV6GTA3dwXu0_G8_z4xkzuX9IOsruu9nkYqRbzMCrZoPvIk_5m9r16I6ZjbyquJu3xnSu2D2Id-Qjor2mOrrzz1HAgg36yKRA.mp4?_nc_cat=111&_nc_oc=AdoIiKSTfi2_MyHXCnCmdUVAyVcaGdyIhm1WeKQPfTdobrTRLHgJfJkAyNa4UrhsZOo&_nc_sid=5e9851&_nc_ht=instagram.ffuk5-1.fna.fbcdn.net&_nc_ohc=QDOA9g00bsQQ7kNvwG7uAzu&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTU5NjYyOTkwODU2NDczMywiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjoyOSwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=599f7cf31d94d0a9&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC8wQTRGNjdGRjZDNUNCNjE4QUVBNzAwMjM1NjZGMTZBRV92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyL0UyNEMwNUREQjQzM0EzQ0ZGNTQ2ODA0Qjc1NTgwOUI5X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACb6q83oi4jWBRUCKAJDMywXQD13S8an754YEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=_O_389kPWe0Kz-xyq6eLrg&_nc_zt=28&_nc_ss=7a22e&oh=00_AQHDLbGdheyBnUkWQtoBiFBQ32gqPjrwD3iXbspmt2mgxg&oe=6A80A6D0"
  },
  {
    "caption": "🇮🇩 MERDEKA BELANJA, MERDEKA HEMAT! 🇮🇩\n\nRayakan kemerdekaan dengan promo spesial dari JETE! 🔥\nNikmati DISKON 50% OFF ALL ITEMS khusus produk JETE! 🎉\n\n🗓️ 15–17 Agustus 2026\n\nSaatnya lengkapi kebutuhan gadget kamu dengan harga lebih hemat! ⚡\nJangan sampai kelewatan, cuma 3 hari!\n\n#JETE #JETEIndonesia #MerdekaBelanja #MerdekaHemat #PromoJETE",
    "commentsCount": 0,
    "dimensionsHeight": 1422,
    "dimensionsWidth": 1080,
    "displayUrl": "https://instagram.ffuk5-1.fna.fbcdn.net/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=instagram.ffuk5-1.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gHxu8T5-6M5PYnz_RRzIzFW-bgBhauXd42AIgdfcUvOdUwow8eB8BZ_HdKCLENQrO4&_nc_ohc=AaQoeHLV-NgQ7kNvwHPB93e&_nc_gid=_O_389kPWe0Kz-xyq6eLrg&edm=APU89FABAAAA&ccb=7-5&oh=00_AQGEaAfIM3p3yFn55rOq-yU4WawlPJUtKaSZhue7IYljeQ&oe=6A84A99B&_nc_sid=bc0c2c",
    "hashtags": [
      "JETE",
      "JETEIndonesia",
      "MerdekaBelanja",
      "MerdekaHemat",
      "PromoJETE"
    ],
    "id": "3963391870218908290",
    "isCommentsDisabled": false,
    "likesCount": 0,
    "ownerFullName": "Pakuwon Mall Jogja",
    "ownerId": "2237970730",
    "ownerUsername": "pakuwonmall.jogja",
    "shortCode": "DcAy-gyEbKC",
    "timestamp": "2026-08-14T07:39:10.000Z",
    "type": "Sidecar",
    "url": "https://www.instagram.com/p/DcAy-gyEbKC/"
  },
  {
    "caption": "🇮🇩 MAKAN STEAK + MINUM DI @holycow_id CUMA 81 RIBUAN 🇮🇩\n\n‼️ *PROMO KEMERDEKAAN* ‼️\n\n1 Holychicken! Steak Series + 1 Flavored Tea\n\n*CUMA Rp 81.000++*\n\n_(Pilihan menu: Holychicken! Steak, African Chicken Steak dan Piccata Chicken Steak)_\n\n🗓 *16 - 17 Agustus 2026*\n\n Ajak teman makanmu & langsung aja ke @holycow_id TKP Yogyakarta Lantai 2 & nikmatin promonya sebelum kehabisan!🔥\n \nUntuk info lainnya cek @holycow_id ‼️\n\nSyarat & Ketentuan:\n- Hanya berlaku untuk transaksi Dine In\n- Berlaku hanya pada pilihan menu Holychicken! steak, African Chicken Steak & Piccata Steak saja.\n- Harga belum termasuk Tax & Service\n- Hanya berlaku pada tanggal 16 - 17 Agustus 2026\n- Tidak dapat digabungkan dengan promo lain & tidak berlaku untuk pembayaran dengan voucher\n- Berlaku di semua TKP Steak Hotel by HOLYCOW! Termasuk Steak Hotel by HOLYCOW! Express, (Tidak berlaku di TKP Bandara Halim Perdana Kusuma)\"\n\n#pakuwonmalljogja",
    "commentsCount": 0,
    "dimensionsHeight": 1351,
    "dimensionsWidth": 1080,
    "displayUrl": "https://instagram.ffuk5-1.fna.fbcdn.net/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=instagram.ffuk5-1.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gHxu8T5-6M5PYnz_RRzIzFW-bgBhauXd42AIgdfcUvOdUwow8eB8BZ_HdKCLENQrO4&_nc_ohc=dnVhxIs_J7IQ7kNvwF_lF8c&_nc_gid=_O_389kPWe0Kz-xyq6eLrg&edm=APU89FABAAAA&ccb=7-5&oh=00_AQHcYc_wKw_Cc7hrL49G9e0UJJuV_0EBRtdDfl9t8aC1OQ&oe=6A84A534&_nc_sid=bc0c2c",
    "hashtags": [
      "pakuwonmalljogja"
    ],
    "id": "3963390113577264213",
    "isCommentsDisabled": false,
    "likesCount": 1,
    "ownerFullName": "Pakuwon Mall Jogja",
    "ownerId": "2237970730",
    "ownerUsername": "pakuwonmall.jogja",
    "shortCode": "DcAyk8yEWRV",
    "timestamp": "2026-08-14T07:35:41.000Z",
    "type": "Sidecar",
    "url": "https://www.instagram.com/p/DcAyk8yEWRV/"
  },
  {
    "caption": "The BIG Playground in Jogja balik lagi! 🥳✨\n\nDari tanggal 7 - 16 Agustus 2026, Pakuwon Mall Jogja menghadirkan kembali Play With Us di Grand Atrium! 🎮🏎️\n\nWahananya lengkap dan seru-seru banget:\n🏎️ Diecast Playland\n🚗 Big Foot Cars Sirkuit\n🚜 RC Excavator Area\n🧗 RC Adventure Arena\n🏎️ F1 Race Simulator\n\nTiket masuknya terjangkau banget, mulai dari Rp 35.000 aja! Pas banget buat ajak si kecil main minggu ini!\n\n📍 Grand Atrium - Pakuwon Mall Jogja\n📅 7 - 16 Agustus 2026\n\nJangan sampai kelewatan ya! 😉👇\n\n#PlayWithUs #PakuwonMallJogja #PlaygroundJogja #WisataAnakJogja #EventJogja KulinerJogja InfoJogja",
    "coauthorProducers": [
      {
        "id": "2237970730",
        "is_verified": true,
        "profile_pic_url": "https://instagram.ffuk5-1.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.ffuk5-1.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gHxu8T5-6M5PYnz_RRzIzFW-bgBhauXd42AIgdfcUvOdUwow8eB8BZ_HdKCLENQrO4&_nc_ohc=L9VCN6COaTMQ7kNvwHyLDyE&_nc_gid=_O_389kPWe0Kz-xyq6eLrg&edm=APU89FABAAAA&ccb=7-5&oh=00_AQFm_hs0kdogfPzXtU5D_JPYN2gxVNqJRkArwZId36RWQQ&oe=6A84A633&_nc_sid=bc0c2c",
        "username": "pakuwonmall.jogja"
      }
    ],
    "commentsCount": 1,
    "dimensionsHeight": 1916,
    "dimensionsWidth": 1080,
    "displayUrl": "https://instagram.ffuk5-1.fna.fbcdn.net/v/t51.82787-15/774905443_18451629595184797_1785892812524699280_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=instagram.ffuk5-1.fna.fbcdn.net&_nc_cat=101&_nc_oc=Q6cZ2gHxu8T5-6M5PYnz_RRzIzFW-bgBhauXd42AIgdfcUvOdUwow8eB8BZ_HdKCLENQrO4&_nc_ohc=rmZ0fhDJ2kcQ7kNvwFRABhC&_nc_gid=_O_389kPWe0Kz-xyq6eLrg&edm=APU89FABAAAA&ccb=7-5&oh=00_AQHv4zxDnzjrJ6iiByllo6XGfUKhMPo448dmtEbclW3gFw&oe=6A848EF5&_nc_sid=bc0c2c",
    "hashtags": [
      "PlayWithUs",
      "PakuwonMallJogja",
      "PlaygroundJogja",
      "WisataAnakJogja",
      "EventJogja"
    ],
    "id": "3963381371133254330",
    "isCommentsDisabled": false,
    "likesCount": 15,
    "ownerId": "5583800796",
    "ownerUsername": "tikanoviia",
    "productType": "clips",
    "shortCode": "DcAwluvzFq6",
    "timestamp": "2026-08-14T07:26:05.000Z",
    "type": "Video",
    "url": "https://www.instagram.com/p/DcAwluvzFq6/",
    "videoUrl": "https://instagram.ffuk5-1.fna.fbcdn.net/o1/v/t2/f2/m86/AQO9kR_ciied0fswp2LUBawsDCnx3MwCq0eQzRWkhrX76Fsi851c8-69h1KJ-fetFnVvKc6BQbgAs0rFPy9nLhoAIPX1oH06aFPIPvw.mp4?_nc_cat=101&_nc_oc=Adp6V2roIoh4KAT7wUfUGo1uE-GkezE4xvzX1HPeu8weKg1xNdW2RM6ImgLzGVnzhLM&_nc_sid=5e9851&_nc_ht=instagram.ffuk5-1.fna.fbcdn.net&_nc_ohc=KsBQAWG-Z2QQ7kNvwFhId0j&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MjUyMDgxMDU0NTA5MTgyMiwiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjozNywidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=8c2c88aa60a04e68&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC9ERTQyRTZBNzVDNzEyMzQ2MDk1MENFQzdEQUZCOTZBNF92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyL0E0NEQ5QTU0NzBFQzkzNzQyQkRDODIzQjRCQkI4MEI0X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACbc07CRvqr6CBUCKAJDMywXQEKMzMzMzM0YEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=_O_389kPWe0Kz-xyq6eLrg&_nc_ss=7a22e&_nc_zt=28&oh=00_AQGBshjaRELknBGS7-R4CNB2-Ah6bFHGgdBKhmc7TsOcqA&oe=6A80BF5E"
  },
  {
    "caption": "BUY POTATO MOZZA, FREE ORIGINAL! \n\nCheesy, crunchy, and even better with a FREE Original! 🤤\nDon’t miss it! 🩷🖤\n\n📍 Available at Pakuwon Mall Jogja, LG\n📆 August 14-20, 2026",
    "coauthorProducers": [
      {
        "id": "2237970730",
        "is_verified": true,
        "profile_pic_url": "https://instagram.ffuk5-1.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.ffuk5-1.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gHxu8T5-6M5PYnz_RRzIzFW-bgBhauXd42AIgdfcUvOdUwow8eB8BZ_HdKCLENQrO4&_nc_ohc=L9VCN6COaTMQ7kNvwHyLDyE&_nc_gid=_O_389kPWe0Kz-xyq6eLrg&edm=APU89FABAAAA&ccb=7-5&oh=00_AQFm_hs0kdogfPzXtU5D_JPYN2gxVNqJRkArwZId36RWQQ&oe=6A84A633&_nc_sid=bc0c2c",
        "username": "pakuwonmall.jogja"
      }
    ],
    "commentsCount": 2,
    "dimensionsHeight": 1349,
    "dimensionsWidth": 1080,
    "displayUrl": "https://instagram.ffuk5-1.fna.fbcdn.net/v/t51.82787-15/773519823_18095763680293262_8938356023924758124_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=instagram.ffuk5-1.fna.fbcdn.net&_nc_cat=102&_nc_oc=Q6cZ2gHxu8T5-6M5PYnz_RRzIzFW-bgBhauXd42AIgdfcUvOdUwow8eB8BZ_HdKCLENQrO4&_nc_ohc=uxVNS2ZUuKQQ7kNvwE0NcH3&_nc_gid=_O_389kPWe0Kz-xyq6eLrg&edm=APU89FABAAAA&ccb=7-5&oh=00_AQGABM-CkSMxPzb98bpAzz9zuYdJud8eTo8iA3AIVbPjGA&oe=6A848B24&_nc_sid=bc0c2c",
    "hashtags": [],
    "id": "3963290610605662960",
    "isCommentsDisabled": false,
    "likesCount": 84,
    "ownerId": "38851997261",
    "ownerUsername": "crunchmate.id",
    "shortCode": "DcAb8_ayqLw",
    "timestamp": "2026-08-14T04:19:31.000Z",
    "type": "Image",
    "url": "https://www.instagram.com/p/DcAb8_ayqLw/"
  },
  {
    "caption": "JOGJA, WE’RE HERE‼️\n\nSomething crispy, cheesy & delicious has officially landed at Pakuwon Mall Jogja! 🇰🇷🔥\n\nSay hello to Crunchmate your best spot for Korean snacks! And yashhh .. we’re celebrating our GRAND OPENING With a special promo 👇🏻\n\nBUY 1 GET 1\nBuy Korean Snack Potato Mozza and FREE Korean Snack  Original\n\nSo, who’s ready for their first CRUNCH? 👀🩷🖤\n📍 Crunchmate — Pakuwon Mall Jogja, LG\n📅 August 14, 2026\n\nTag your snack buddy and come say ANYEONG! 🇰🇷✨\n#CrunchmateJogja #Crunchmate #jogjafoodies #PakuwonMallJogja",
    "coauthorProducers": [
      {
        "id": "2237970730",
        "is_verified": true,
        "profile_pic_url": "https://instagram.ffuk5-1.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.ffuk5-1.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gHxu8T5-6M5PYnz_RRzIzFW-bgBhauXd42AIgdfcUvOdUwow8eB8BZ_HdKCLENQrO4&_nc_ohc=L9VCN6COaTMQ7kNvwHyLDyE&_nc_gid=_O_389kPWe0Kz-xyq6eLrg&edm=APU89FABAAAA&ccb=7-5&oh=00_AQFm_hs0kdogfPzXtU5D_JPYN2gxVNqJRkArwZId36RWQQ&oe=6A84A633&_nc_sid=bc0c2c",
        "username": "pakuwonmall.jogja"
      }
    ],
    "commentsCount": 0,
    "dimensionsHeight": 1350,
    "dimensionsWidth": 1080,
    "displayUrl": "https://instagram.ffuk5-1.fna.fbcdn.net/v/t51.82787-15/773686629_18095748581293262_1334211002783647391_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=instagram.ffuk5-1.fna.fbcdn.net&_nc_cat=102&_nc_oc=Q6cZ2gHxu8T5-6M5PYnz_RRzIzFW-bgBhauXd42AIgdfcUvOdUwow8eB8BZ_HdKCLENQrO4&_nc_ohc=RuYm3rFB_h8Q7kNvwFEt2nc&_nc_gid=_O_389kPWe0Kz-xyq6eLrg&edm=APU89FABAAAA&ccb=7-5&oh=00_AQGM4zX3S-m6ju70iKuLPc5M-n0jPVH9_1zk_mTPxkt9EQ&oe=6A84AE37&_nc_sid=bc0c2c",
    "hashtags": [
      "CrunchmateJogja",
      "Crunchmate",
      "jogjafoodies",
      "PakuwonMallJogja"
    ],
    "id": "3963231873169665456",
    "isCommentsDisabled": false,
    "likesCount": 40,
    "ownerId": "38851997261",
    "ownerUsername": "crunchmate.id",
    "shortCode": "DcAOmP6yK2w",
    "timestamp": "2026-08-14T02:32:07.000Z",
    "type": "Image",
    "url": "https://www.instagram.com/p/DcAOmP6yK2w/"
  },
  {
    "caption": "PAKUWON MALL JOGJA MERDEKA SALE 🇮🇩‼️\n\nNikmati berbagai promo dari tenant favoritmu hanya di Pakuwon Mall Jogja 😍\n\n#pakuwonmalljogja",
    "commentsCount": 2,
    "dimensionsHeight": 1350,
    "dimensionsWidth": 1080,
    "displayUrl": "https://instagram.ffuk5-1.fna.fbcdn.net/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=dst-jpg_e15_fr_p1080x1080_tt6&_nc_ht=instagram.ffuk5-1.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gHxu8T5-6M5PYnz_RRzIzFW-bgBhauXd42AIgdfcUvOdUwow8eB8BZ_HdKCLENQrO4&_nc_ohc=RFZqVCccIfcQ7kNvwHsK44v&_nc_gid=_O_389kPWe0Kz-xyq6eLrg&edm=APU89FABAAAA&ccb=7-5&oh=00_AQHFyX2_rhubbf7PulICUVJdeZvBRBtRsFMM4VYg6unccg&oe=6A84A629&_nc_sid=bc0c2c",
    "hashtags": [
      "pakuwonmalljogja"
    ],
    "id": "3963187739466369600",
    "isCommentsDisabled": false,
    "likesCount": 53,
    "ownerFullName": "Pakuwon Mall Jogja",
    "ownerId": "2237970730",
    "ownerUsername": "pakuwonmall.jogja",
    "shortCode": "DcAEkBNE4pA",
    "timestamp": "2026-08-14T00:53:36.000Z",
    "type": "Sidecar",
    "url": "https://www.instagram.com/p/DcAEkBNE4pA/"
  },
  {
    "caption": "Grand Opening ELLE Flagship Store @ellewatchindonesia ✨\nParisian chic, now within reach. Enjoy 17% + 8% OFF all ELLE watches!\n\nVisit our store at Pakuwon Mall Jogja, Ground Floor or contact our Customer Service 085 777 111 666 for more info.\n\n#ELLEIndonesia #ElleWatches #JamTanganElle #pakuwonmalljogja",
    "commentsCount": 0,
    "dimensionsHeight": 1348,
    "dimensionsWidth": 1080,
    "displayUrl": "https://instagram.ffuk5-1.fna.fbcdn.net/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=instagram.ffuk5-1.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gHxu8T5-6M5PYnz_RRzIzFW-bgBhauXd42AIgdfcUvOdUwow8eB8BZ_HdKCLENQrO4&_nc_ohc=FFka95e64qsQ7kNvwElRRop&_nc_gid=_O_389kPWe0Kz-xyq6eLrg&edm=APU89FABAAAA&ccb=7-5&oh=00_AQFqY1QjrtudLTFPA0cenw9OLoFTLWgdw_vRdBQbLmJ1yA&oe=6A84A355&_nc_sid=bc0c2c",
    "hashtags": [
      "ELLEIndonesia",
      "ElleWatches",
      "JamTanganElle",
      "pakuwonmalljogja"
    ],
    "id": "3962867082392210475",
    "isCommentsDisabled": false,
    "likesCount": 82,
    "ownerFullName": "Pakuwon Mall Jogja",
    "ownerId": "2237970730",
    "ownerUsername": "pakuwonmall.jogja",
    "shortCode": "Db-7p2CE4wr",
    "timestamp": "2026-08-13T14:16:31.000Z",
    "type": "Sidecar",
    "url": "https://www.instagram.com/p/Db-7p2CE4wr/"
  },
  {
    "caption": "🇮🇩 Celebrate Indonesia’s Independence Day with your favorite treats from @TouslesJours.id ! ✨\n\nFrom 14–18 August 2026, enjoy special Independence Day offers:\n 17% OFF — All Items\n 45% OFF — All Beverages\n 10% OFF — Credit & Debit Card Bank Mandiri\nSee you There!\n\n#TouslesJours #promomerdeka #pakuwonmalljogja",
    "commentsCount": 0,
    "dimensionsHeight": 1350,
    "dimensionsWidth": 1080,
    "displayUrl": "https://scontent-ams2-1.cdninstagram.com/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=scontent-ams2-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gHjuLYzjgjXqP4G2NW11J-XUH3SRMLS-kgnkLpc3qqTC1owRfP326oeJSKkENU48N6l_reNHLOLYAPXWy8jHwju&_nc_ohc=FGpPLN37LN4Q7kNvwEC6cHN&_nc_gid=df5a5pvxnjcMC4uBjsDGng&edm=APU89FABAAAA&ccb=7-5&oh=00_AQHMTDxjsYIEJHSfD_9tjE6Ik_Kb1vuI13BIJOAa_mrH1A&oe=6A848DC1&_nc_sid=bc0c2c",
    "hashtags": [
      "TouslesJours",
      "promomerdeka",
      "pakuwonmalljogja"
    ],
    "id": "3962865174512370672",
    "isCommentsDisabled": false,
    "likesCount": 50,
    "ownerFullName": "Pakuwon Mall Jogja",
    "ownerId": "2237970730",
    "ownerUsername": "pakuwonmall.jogja",
    "shortCode": "Db-7OFLk4Pw",
    "timestamp": "2026-08-13T14:12:43.000Z",
    "type": "Sidecar",
    "url": "https://www.instagram.com/p/Db-7OFLk4Pw/"
  },
  {
    "caption": "ELLE WATCH IS NOW AVAILABLE! ✨\n\nTemukan koleksi jam tangan ELLE sekarang di Watch Studio, Pakuwon Mall Jogja! ⌚💖\nTampil stylish, elegan, dan timeless di setiap momen. \n\n📍 Ground Floor, Pakuwon Mall Jogja\n\n#pakuwonmalljogja",
    "coauthorProducers": [
      {
        "id": "18870279538",
        "is_verified": false,
        "profile_pic_url": "https://scontent-ams2-1.cdninstagram.com/v/t51.82787-19/728833598_18119358160631539_7399830227988371889_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4zMjAuYzIifQ&_nc_ht=scontent-ams2-1.cdninstagram.com&_nc_cat=107&_nc_oc=Q6cZ2gHjuLYzjgjXqP4G2NW11J-XUH3SRMLS-kgnkLpc3qqTC1owRfP326oeJSKkENU48N6l_reNHLOLYAPXWy8jHwju&_nc_ohc=kvTWyc8VRAsQ7kNvwHvlzE9&_nc_gid=df5a5pvxnjcMC4uBjsDGng&edm=APU89FABAAAA&ccb=7-5&oh=00_AQFSQe8S0ozFeU1dBoyOWNPfExlb-vKa_ouLExF6PlSaEg&oe=6A8487BC&_nc_sid=bc0c2c",
        "username": "ellewatchindonesia"
      }
    ],
    "commentsCount": 0,
    "dimensionsHeight": 1920,
    "dimensionsWidth": 1080,
    "displayUrl": "https://scontent-ams2-1.cdninstagram.com/v/t51.82787-15/773863104_18549778204074731_6753476794430800343_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=scontent-ams2-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gHjuLYzjgjXqP4G2NW11J-XUH3SRMLS-kgnkLpc3qqTC1owRfP326oeJSKkENU48N6l_reNHLOLYAPXWy8jHwju&_nc_ohc=-VQ5JFdVgCgQ7kNvwFYgowi&_nc_gid=df5a5pvxnjcMC4uBjsDGng&edm=APU89FABAAAA&ccb=7-5&oh=00_AQGp212VqpU9xSz7mOzi-9w9Gvh5QiX58_2QtWXWmrwnlQ&oe=6A84886B&_nc_sid=bc0c2c",
    "hashtags": [
      "pakuwonmalljogja"
    ],
    "id": "3962862498097316445",
    "isCommentsDisabled": false,
    "likesCount": 12,
    "ownerFullName": "Pakuwon Mall Jogja",
    "ownerId": "2237970730",
    "ownerUsername": "pakuwonmall.jogja",
    "productType": "clips",
    "shortCode": "Db-6nIkzsJd",
    "timestamp": "2026-08-13T14:08:13.000Z",
    "type": "Video",
    "url": "https://www.instagram.com/p/Db-6nIkzsJd/",
    "videoUrl": "https://scontent-ams2-1.cdninstagram.com/o1/v/t2/f2/m86/AQPxSh7VvKkX1upeIUsUcOqx1cOrBbDZgdgUmrWWwc9aWGQijquX5p1Xy4KVTZpuZVGK29pU60_nZQfdq0w84Pg4P6aJt1pI-e07Tpk.mp4?_nc_cat=103&_nc_sid=5e9851&_nc_ht=scontent-ams2-1.cdninstagram.com&_nc_ohc=Du2ez4r2alIQ7kNvwHeRo4V&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTc1MzQwNDEwMjQ2Mzg5NSwiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjoyMSwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=da7e036ff4ca17a5&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC8wMjRFOERENEIzODgzNzc1QTNDOTA1ODhBMjk0QTBCN192aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyL0YzNDFFQzQwN0Q2MDlCRTdFOEU3MUY3OUQwOTUwNTgyX2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACauxubKxq2dBhUCKAJDMywXQDWAAAAAAAAYEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=df5a5pvxnjcMC4uBjsDGng&_nc_ss=7a22e&_nc_zt=28&oh=00_AQGBq7algGridpz8hk9riTlkj0ulKiXMfsiP6bkofsDjaA&oe=6A80B960"
  },
  {
    "caption": "Merayakan Indonesia, mengenakan ceritanya.\nRuang Pertiwi hadir sebagai bagian dari Koleksi Kemerdekaan Batik Keris, menerjemahkan semangat negeri melalui motif dan busana yang penuh makna.\n\nLengkapi juga penampilan Anda dengan Independence Scarf dari @batikkerisonline dan nikmati promo spesial\n\n📅 7–23 Agustus 2026\nSelama persediaan masih ada.\n\n*Syarat dan ketentuan berlaku\n\nMari rayakan kemerdekaan dalam balutan karya Batik Keris. ❤🤍\n\n#Independence2026 #Batikkeris #Batik #pakuwonmalljogja",
    "commentsCount": 0,
    "dimensionsHeight": 1350,
    "dimensionsWidth": 1080,
    "displayUrl": "https://scontent-ams2-1.cdninstagram.com/v/t51.82787-15/774597496_18549777178074731_2048125699812060858_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=scontent-ams2-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gHjuLYzjgjXqP4G2NW11J-XUH3SRMLS-kgnkLpc3qqTC1owRfP326oeJSKkENU48N6l_reNHLOLYAPXWy8jHwju&_nc_ohc=yV19T7GZ9bwQ7kNvwH9Z2J-&_nc_gid=df5a5pvxnjcMC4uBjsDGng&edm=APU89FABAAAA&ccb=7-5&oh=00_AQHJWrYAvj2tbcj-m2eCoe6ggDDpWaJk_fy8qDuaZH8fTg&oe=6A849AA2&_nc_sid=bc0c2c",
    "hashtags": [
      "Independence2026",
      "Batikkeris",
      "Batik",
      "pakuwonmalljogja"
    ],
    "id": "3962861185922205953",
    "isCommentsDisabled": false,
    "likesCount": 1,
    "ownerFullName": "Pakuwon Mall Jogja",
    "ownerId": "2237970730",
    "ownerUsername": "pakuwonmall.jogja",
    "shortCode": "Db-6UChE4kB",
    "timestamp": "2026-08-13T14:04:48.000Z",
    "type": "Sidecar",
    "url": "https://www.instagram.com/p/Db-6UChE4kB/"
  },
  {
    "caption": "Merdeka! Spesial khusus untuk kamu yang umur 17 sampai 45 tahun!\n\nAjak temen / keluarga kamu yang umurnya bisa dapetin promo ini! 😋\n\nCuma 5 hari aja ya! yuk ke Kimukatsu Pakuwon Mall Jogja lantai UG sekarang! 🤩\n\n#pakuwonmalljogja",
    "commentsCount": 3,
    "dimensionsHeight": 1349,
    "dimensionsWidth": 1080,
    "displayUrl": "https://scontent-ams2-1.cdninstagram.com/v/t51.82787-15/772839750_18549774946074731_9206448212655855891_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=scontent-ams2-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gHjuLYzjgjXqP4G2NW11J-XUH3SRMLS-kgnkLpc3qqTC1owRfP326oeJSKkENU48N6l_reNHLOLYAPXWy8jHwju&_nc_ohc=zMhiOcOoL_oQ7kNvwFFO5Om&_nc_gid=df5a5pvxnjcMC4uBjsDGng&edm=APU89FABAAAA&ccb=7-5&oh=00_AQGKOj3NlJ3kYjY6M_yj0zcCH1UDeaqigKO_c_1gRNy3Iw&oe=6A8490E4&_nc_sid=bc0c2c",
    "hashtags": [
      "pakuwonmalljogja"
    ],
    "id": "3962856697060636167",
    "isCommentsDisabled": false,
    "likesCount": 31,
    "ownerFullName": "Pakuwon Mall Jogja",
    "ownerId": "2237970730",
    "ownerUsername": "pakuwonmall.jogja",
    "shortCode": "Db-5St8E7YH",
    "timestamp": "2026-08-13T13:55:53.000Z",
    "type": "Sidecar",
    "url": "https://www.instagram.com/p/Db-5St8E7YH/"
  },
  {
    "caption": "MERDEKA GRATIS MAKAN! 🇮🇩 🍴\n\nRayakan HUT ke-81 Indonesia di Pakuwon Mall Jogja! ❤️‍🔥\nDaftar jadi member PG dan dapatkan kesempatan menikmati voucher gratis makan pada 15–17 Agustus 2026! 🇮🇩✨\n\nCaranya gampang! \n1. Daftar menjadi member PG (GRATIS)\n2. Follow IG & TikTok Pakuwon Mall Jogja\n3. Dapatkan 1x kesempatan bermain Lucky Clown\ndan dapatkan voucher F&B!\n\nTukarkan voucher dengan produk tanpa syarat belanja! \n\nYuk, rayakan kemerdekaan dengan seru-seruan + makan gratis! ❤️🤍\n\n#pakuwonmalljogja",
    "commentsCount": 5,
    "dimensionsHeight": 1350,
    "dimensionsWidth": 1080,
    "displayUrl": "https://scontent-ams2-1.cdninstagram.com/v/t51.82787-15/773519990_18549773557074731_5335328448260200388_n.jpg?stp=dst-jpg_e15_tt6&_nc_ht=scontent-ams2-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gHjuLYzjgjXqP4G2NW11J-XUH3SRMLS-kgnkLpc3qqTC1owRfP326oeJSKkENU48N6l_reNHLOLYAPXWy8jHwju&_nc_ohc=PSqYbstIqToQ7kNvwG7agNI&_nc_gid=df5a5pvxnjcMC4uBjsDGng&edm=APU89FABAAAA&ccb=7-5&oh=00_AQFg4oqTUmt1ulKlVGdxHca7cX3UycygEuu9Fl228ucXQQ&oe=6A848FE5&_nc_sid=bc0c2c",
    "hashtags": [
      "pakuwonmalljogja"
    ],
    "id": "3962854765201584085",
    "isCommentsDisabled": false,
    "likesCount": 154,
    "ownerFullName": "Pakuwon Mall Jogja",
    "ownerId": "2237970730",
    "ownerUsername": "pakuwonmall.jogja",
    "shortCode": "Db-42mwTe_V",
    "timestamp": "2026-08-13T13:52:20.000Z",
    "type": "Image",
    "url": "https://www.instagram.com/p/Db-42mwTe_V/"
  },
  {
    "caption": "Celebrate the Spirit of Independence Day🇮🇩 with Special Offers!\n\nBuy 3 or more, get 25% OFF for ALL ITEMS! Promo valid 14 - 17 August 2026✨\n\nDon’t miss it! Let’s choose your favorite product and enjoy the promo. Happy Shopping!🛍️\n\n@wacoal_id\n#Wacoal #WacoalIndonesia",
    "commentsCount": 0,
    "dimensionsHeight": 1350,
    "dimensionsWidth": 1080,
    "displayUrl": "https://scontent-ams2-1.cdninstagram.com/v/t51.82787-15/773519738_18549770038074731_6264059328933683150_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=scontent-ams2-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gHjuLYzjgjXqP4G2NW11J-XUH3SRMLS-kgnkLpc3qqTC1owRfP326oeJSKkENU48N6l_reNHLOLYAPXWy8jHwju&_nc_ohc=Kj9OGz9UO_sQ7kNvwHGcfLo&_nc_gid=df5a5pvxnjcMC4uBjsDGng&edm=APU89FABAAAA&ccb=7-5&oh=00_AQHCxagFcBY2NvtczPHMETIljwTu51RUoGtTBFJ6nFnyig&oe=6A84A04A&_nc_sid=bc0c2c",
    "hashtags": [
      "Wacoal",
      "WacoalIndonesia"
    ],
    "id": "3962847381284946806",
    "isCommentsDisabled": false,
    "likesCount": 34,
    "ownerFullName": "Pakuwon Mall Jogja",
    "ownerId": "2237970730",
    "ownerUsername": "pakuwonmall.jogja",
    "shortCode": "Db-3LJ8k4N2",
    "timestamp": "2026-08-13T13:37:22.000Z",
    "type": "Sidecar",
    "url": "https://www.instagram.com/p/Db-3LJ8k4N2/"
  }
]
```
