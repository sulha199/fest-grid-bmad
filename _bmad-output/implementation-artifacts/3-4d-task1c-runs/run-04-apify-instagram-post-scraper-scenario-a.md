# Task 1c — Run 4: apify/instagram-post-scraper — Scenario A (baseline)

Part of [3-4d-per-use-case-actor-selection-and-sync-path-timeout.md](../3-4d-per-use-case-actor-selection-and-sync-path-timeout.md) Task 1c. Expected: ≥10 items, **zero** pinned-post timestamps (this actor uses `skipPinnedPosts: true`). **Confirmed clean 2026-08-14: none of the 3 known pinned timestamps (`2026-08-01T03:58:43Z`, `2026-08-04T05:21:00Z`, `2026-08-04T14:07:36Z`) appear in the output below** — `skipPinnedPosts` looks correct for this actor, unlike `apify/instagram-api-scraper` (see Run 2, which leaked all 3).

**⚠️ Data-quality flag:** the Date/Time and Run ID below are byte-identical to Run 1's (`Lg0Ta9EuGe2M4gejt`, `2026-08-14 10:35`) — that's almost certainly a copy-paste artifact, since a Run ID is unique per actor run and these are two different actors. The pasted JSON output itself looks like genuine, distinct `apify/instagram-post-scraper` data (different posts, different cost breakdown), so the output is likely real — just re-check and correct the Run ID/Date-Time fields against the actual Apify console run for this specific call before treating them as accurate.

**Input params:** `{"username": ["https://www.instagram.com/pakuwonmall.jogja/"], "resultsLimit": 15, "dataDetailLevel": "basicData", "skipPinnedPosts": true, "onlyPostsNewerThan": "2026-08-10"}`

---

* **Date/Time:** 2026-08-14 10:37:11
* **Run ID:** [9DRim9Lbsqt8lYCFm](https://console.apify.com/actors/nH2AHrwxeTRJoN5hX/runs/9DRim9Lbsqt8lYCFm#input)
* **Duration:** 43 s

- Cost ($): **Post:** 15 results × \$0.0017 = **\$0.0255**
- Items returned (count):
- Output (paste full JSON):

```json
[
  {
    "caption": "Effortless style meets practical utility with the Elise Suede Mules, featuring a tactile suede upper, refined lace-up detailing.\n\n#PEDROSHOES_OFFICIAL\n#PEDROSHOES_ID\n#EFFORTLESSESSENTIALS\n#pakuwonmalljogja",
    "commentsCount": 0,
    "dimensionsHeight": 1348,
    "dimensionsWidth": 1080,
    "displayUrl": "https://instagram.fvdc8-1.fna.fbcdn.net/v/t51.82787-15/772020722_18549945949074731_1830384479887634622_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=instagram.fvdc8-1.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gFaQuMFKE3WT0uLsMfDbKTWrc5ge0CCGqalVflt14lvPhrgl2Veb8xQcvYv7hU6NWo&_nc_ohc=sncki7cT57kQ7kNvwH2d1Iw&_nc_gid=-Nxn6rLjDMj2bfYuz8SGOw&edm=APU89FABAAAA&ccb=7-5&oh=00_AQF6MPk_MqXZYrG57_evaXt1duh1TxOnoRDlABCAkidw-w&oe=6A8475D0&_nc_sid=bc0c2c",
    "hashtags": [
      "PEDROSHOES_OFFICIAL",
      "PEDROSHOES_ID",
      "EFFORTLESSESSENTIALS",
      "pakuwonmalljogja"
    ],
    "id": "3963265688613523321",
    "isCommentsDisabled": false,
    "likesCount": 0,
    "ownerFullName": "Pakuwon Mall Jogja",
    "ownerId": "2237970730",
    "ownerUsername": "pakuwonmall.jogja",
    "shortCode": "DcAWSVATY95",
    "timestamp": "2026-08-14T03:30:36.000Z",
    "type": "Image",
    "url": "https://www.instagram.com/p/DcAWSVATY95/"
  },
  {
    "caption": "JOGJA, WE’RE HERE‼️\n\nSomething crispy, cheesy & delicious has officially landed at Pakuwon Mall Jogja! 🇰🇷🔥\n\nSay hello to Crunchmate your best spot for Korean snacks! And yashhh .. we’re celebrating our GRAND OPENING With a special promo 👇🏻\n\nBUY 1 GET 1\nBuy Korean Snack Potato Mozza and FREE Korean Snack  Original\n\nSo, who’s ready for their first CRUNCH? 👀🩷🖤\n📍 Crunchmate — Pakuwon Mall Jogja, LG\n📅 August 14, 2026\n\nTag your snack buddy and come say ANYEONG! 🇰🇷✨\n#CrunchmateJogja #Crunchmate #jogjafoodies #PakuwonMallJogja",
    "coauthorProducers": [
      {
        "id": "2237970730",
        "is_verified": true,
        "profile_pic_url": "https://instagram.fvdc8-1.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fvdc8-1.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gFaQuMFKE3WT0uLsMfDbKTWrc5ge0CCGqalVflt14lvPhrgl2Veb8xQcvYv7hU6NWo&_nc_ohc=L9VCN6COaTMQ7kNvwGnn5oR&_nc_gid=-Nxn6rLjDMj2bfYuz8SGOw&edm=APU89FABAAAA&ccb=7-5&oh=00_AQEpM1ASU-Saq28AB11Z7HY1DkgEwBfTnb3obHAo9scwRw&oe=6A846DF3&_nc_sid=bc0c2c",
        "username": "pakuwonmall.jogja"
      }
    ],
    "commentsCount": 0,
    "dimensionsHeight": 1350,
    "dimensionsWidth": 1080,
    "displayUrl": "https://instagram.fvdc8-1.fna.fbcdn.net/v/t51.82787-15/773686629_18095748581293262_1334211002783647391_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=instagram.fvdc8-1.fna.fbcdn.net&_nc_cat=102&_nc_oc=Q6cZ2gFaQuMFKE3WT0uLsMfDbKTWrc5ge0CCGqalVflt14lvPhrgl2Veb8xQcvYv7hU6NWo&_nc_ohc=RuYm3rFB_h8Q7kNvwHfW7wq&_nc_gid=-Nxn6rLjDMj2bfYuz8SGOw&edm=APU89FABAAAA&ccb=7-5&oh=00_AQF58Agzt1U9GRdiJHXyH6M785rJGU4vf3EmaL9AR2A1oQ&oe=6A8475F7&_nc_sid=bc0c2c",
    "hashtags": [
      "CrunchmateJogja",
      "Crunchmate",
      "jogjafoodies",
      "PakuwonMallJogja"
    ],
    "id": "3963231873169665456",
    "isCommentsDisabled": false,
    "likesCount": 15,
    "ownerId": "38851997261",
    "ownerUsername": "crunchmate.id",
    "shortCode": "DcAOmP6yK2w",
    "timestamp": "2026-08-14T02:32:07.000Z",
    "type": "Image",
    "url": "https://www.instagram.com/p/DcAOmP6yK2w/"
  },
  {
    "caption": "PAKUWON MALL JOGJA MERDEKA SALE 🇮🇩‼️\n\nNikmati berbagai promo dari tenant favoritmu hanya di Pakuwon Mall Jogja 😍\n\n#pakuwonmalljogja",
    "commentsCount": 0,
    "dimensionsHeight": 1350,
    "dimensionsWidth": 1080,
    "displayUrl": "https://instagram.fvdc8-1.fna.fbcdn.net/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=dst-jpg_e15_fr_p1080x1080_tt6&_nc_ht=instagram.fvdc8-1.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gFaQuMFKE3WT0uLsMfDbKTWrc5ge0CCGqalVflt14lvPhrgl2Veb8xQcvYv7hU6NWo&_nc_ohc=4a94UtAYoc0Q7kNvwGebXfK&_nc_gid=-Nxn6rLjDMj2bfYuz8SGOw&edm=APU89FABAAAA&ccb=7-5&oh=00_AQESCDA8aOktN2U5cHYQ2Xk4MVxbiUsQ54dOnh5W9Nsa6g&oe=6A846DE9&_nc_sid=bc0c2c",
    "hashtags": [
      "pakuwonmalljogja"
    ],
    "id": "3963187739466369600",
    "isCommentsDisabled": false,
    "likesCount": 30,
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
    "displayUrl": "https://instagram.fvdc8-1.fna.fbcdn.net/v/t51.82787-15/774149203_18549779845074731_7645033748992057915_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=instagram.fvdc8-1.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gFaQuMFKE3WT0uLsMfDbKTWrc5ge0CCGqalVflt14lvPhrgl2Veb8xQcvYv7hU6NWo&_nc_ohc=FFka95e64qsQ7kNvwFA7kYl&_nc_gid=-Nxn6rLjDMj2bfYuz8SGOw&edm=APU89FABAAAA&ccb=7-5&oh=00_AQGH482qQ02khdTM99_Wa3Aqkh2nG0n4fF_Xg2hPv7Sz1Q&oe=6A846B15&_nc_sid=bc0c2c",
    "hashtags": [
      "ELLEIndonesia",
      "ElleWatches",
      "JamTanganElle",
      "pakuwonmalljogja"
    ],
    "id": "3962867082392210475",
    "isCommentsDisabled": false,
    "likesCount": 64,
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
    "displayUrl": "https://instagram.fvdc8-1.fna.fbcdn.net/v/t51.82787-15/774993848_18549779059074731_9183944742106257245_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=instagram.fvdc8-1.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gFaQuMFKE3WT0uLsMfDbKTWrc5ge0CCGqalVflt14lvPhrgl2Veb8xQcvYv7hU6NWo&_nc_ohc=FGpPLN37LN4Q7kNvwG5PE0E&_nc_gid=-Nxn6rLjDMj2bfYuz8SGOw&edm=APU89FABAAAA&ccb=7-5&oh=00_AQEtxlpbNb04PCbnooeVn8YKi36V_zrSVmWrYdCuNN1z9w&oe=6A845581&_nc_sid=bc0c2c",
    "hashtags": [
      "TouslesJours",
      "promomerdeka",
      "pakuwonmalljogja"
    ],
    "id": "3962865174512370672",
    "isCommentsDisabled": false,
    "likesCount": 42,
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
    "commentsCount": 0,
    "dimensionsHeight": 1920,
    "dimensionsWidth": 1080,
    "displayUrl": "https://instagram.fvdc8-1.fna.fbcdn.net/v/t51.82787-15/773863104_18549778204074731_6753476794430800343_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=instagram.fvdc8-1.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gFaQuMFKE3WT0uLsMfDbKTWrc5ge0CCGqalVflt14lvPhrgl2Veb8xQcvYv7hU6NWo&_nc_ohc=-VQ5JFdVgCgQ7kNvwF2cXqr&_nc_gid=-Nxn6rLjDMj2bfYuz8SGOw&edm=APU89FABAAAA&ccb=7-5&oh=00_AQHdw2SA8bbvfwrr0Zr24zZTBrP6YOSPegkRnKXH1ePG3Q&oe=6A84502B&_nc_sid=bc0c2c",
    "hashtags": [
      "pakuwonmalljogja"
    ],
    "id": "3962862498097316445",
    "isCommentsDisabled": false,
    "likesCount": 11,
    "ownerFullName": "Pakuwon Mall Jogja",
    "ownerId": "2237970730",
    "ownerUsername": "pakuwonmall.jogja",
    "productType": "clips",
    "shortCode": "Db-6nIkzsJd",
    "timestamp": "2026-08-13T14:08:13.000Z",
    "type": "Video",
    "url": "https://www.instagram.com/p/Db-6nIkzsJd/",
    "videoUrl": "https://instagram.fvdc8-1.fna.fbcdn.net/o1/v/t2/f2/m86/AQPxSh7VvKkX1upeIUsUcOqx1cOrBbDZgdgUmrWWwc9aWGQijquX5p1Xy4KVTZpuZVGK29pU60_nZQfdq0w84Pg4P6aJt1pI-e07Tpk.mp4?_nc_cat=103&_nc_oc=AdrlIE3VbsSvOu1i1-By-9iuykF544JIsb7j8S_QtIiwp5S-Q5ElhsNXuCbdBR5mMHw&_nc_sid=5e9851&_nc_ht=instagram.fvdc8-1.fna.fbcdn.net&_nc_ohc=PCoEvGPF2p8Q7kNvwE5_l6d&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTc1MzQwNDEwMjQ2Mzg5NSwiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjoyMSwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=da7e036ff4ca17a5&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC8wMjRFOERENEIzODgzNzc1QTNDOTA1ODhBMjk0QTBCN192aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyL0YzNDFFQzQwN0Q2MDlCRTdFOEU3MUY3OUQwOTUwNTgyX2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACauxubKxq2dBhUCKAJDMywXQDWAAAAAAAAYEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=-Nxn6rLjDMj2bfYuz8SGOw&_nc_zt=28&_nc_ss=7a22e&oh=00_AQHmzdAFmThzQ5CNs-qQ5IjDIxZbXj_TYEJNPCtt6_Xx9w&oe=6A808120"
  },
  {
    "caption": "Merayakan Indonesia, mengenakan ceritanya.\nRuang Pertiwi hadir sebagai bagian dari Koleksi Kemerdekaan Batik Keris, menerjemahkan semangat negeri melalui motif dan busana yang penuh makna.\n\nLengkapi juga penampilan Anda dengan Independence Scarf dari @batikkerisonline dan nikmati promo spesial\n\n📅 7–23 Agustus 2026\nSelama persediaan masih ada.\n\n*Syarat dan ketentuan berlaku\n\nMari rayakan kemerdekaan dalam balutan karya Batik Keris. ❤🤍\n\n#Independence2026 #Batikkeris #Batik #pakuwonmalljogja",
    "commentsCount": 0,
    "dimensionsHeight": 1350,
    "dimensionsWidth": 1080,
    "displayUrl": "https://instagram.fvdc8-1.fna.fbcdn.net/v/t51.82787-15/774597496_18549777178074731_2048125699812060858_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=instagram.fvdc8-1.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gFaQuMFKE3WT0uLsMfDbKTWrc5ge0CCGqalVflt14lvPhrgl2Veb8xQcvYv7hU6NWo&_nc_ohc=yV19T7GZ9bwQ7kNvwF4-xHP&_nc_gid=-Nxn6rLjDMj2bfYuz8SGOw&edm=APU89FABAAAA&ccb=7-5&oh=00_AQHTnc6t7j_9ibExARE4P4ZJplfdLkwpBRLV8If61ATQdw&oe=6A846262&_nc_sid=bc0c2c",
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
    "commentsCount": 0,
    "dimensionsHeight": 1349,
    "dimensionsWidth": 1080,
    "displayUrl": "https://instagram.fvdc8-1.fna.fbcdn.net/v/t51.82787-15/772839750_18549774946074731_9206448212655855891_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=instagram.fvdc8-1.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gFaQuMFKE3WT0uLsMfDbKTWrc5ge0CCGqalVflt14lvPhrgl2Veb8xQcvYv7hU6NWo&_nc_ohc=CK3bt7jVOKUQ7kNvwE7mX9t&_nc_gid=-Nxn6rLjDMj2bfYuz8SGOw&edm=APU89FABAAAA&ccb=7-5&oh=00_AQFUktf8dbQmdOVeJI5V7ACE5lFjeW7jjOpoyVO2sMa4zg&oe=6A8458A4&_nc_sid=bc0c2c",
    "hashtags": [
      "pakuwonmalljogja"
    ],
    "id": "3962856697060636167",
    "isCommentsDisabled": false,
    "likesCount": 21,
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
    "displayUrl": "https://instagram.fvdc8-1.fna.fbcdn.net/v/t51.82787-15/773519990_18549773557074731_5335328448260200388_n.jpg?stp=dst-jpg_e15_tt6&_nc_ht=instagram.fvdc8-1.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gFaQuMFKE3WT0uLsMfDbKTWrc5ge0CCGqalVflt14lvPhrgl2Veb8xQcvYv7hU6NWo&_nc_ohc=PSqYbstIqToQ7kNvwGTostN&_nc_gid=-Nxn6rLjDMj2bfYuz8SGOw&edm=APU89FABAAAA&ccb=7-5&oh=00_AQG4-JfNdpPduYB1rFGayr0dmmTx09KxAAd6YTlGGSXqTA&oe=6A8457A5&_nc_sid=bc0c2c",
    "hashtags": [
      "pakuwonmalljogja"
    ],
    "id": "3962854765201584085",
    "isCommentsDisabled": false,
    "likesCount": 141,
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
    "displayUrl": "https://instagram.fbnu4-1.fna.fbcdn.net/v/t51.82787-15/773519738_18549770038074731_6264059328933683150_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=instagram.fbnu4-1.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gF7jl0zIXeXy_NciM5HpESJGvgXhAHZhXC6OuAy885gbXusmCxTgwp-6QxwqQw05-o&_nc_ohc=Kj9OGz9UO_sQ7kNvwFj9eAR&_nc_gid=3DwYG6hs092bgLgbutBVhQ&edm=APU89FABAAAA&ccb=7-5&oh=00_AQGm6QZq9XQF8LO0sgBZ8JMqTEmPqssBR6CzgDLjeTFpYQ&oe=6A84680A&_nc_sid=bc0c2c",
    "hashtags": [
      "Wacoal",
      "WacoalIndonesia"
    ],
    "id": "3962847381284946806",
    "isCommentsDisabled": false,
    "likesCount": 29,
    "ownerFullName": "Pakuwon Mall Jogja",
    "ownerId": "2237970730",
    "ownerUsername": "pakuwonmall.jogja",
    "shortCode": "Db-3LJ8k4N2",
    "timestamp": "2026-08-13T13:37:22.000Z",
    "type": "Sidecar",
    "url": "https://www.instagram.com/p/Db-3LJ8k4N2/"
  },
  {
    "caption": "🇮🇩 MERDEKA DEALS! 🇮🇩\n\nRayakan semangat kemerdekaan bareng Xing Fu Tang! ❤️🤍\nNikmati Diskon Rp17.845 untuk setiap pembelian minuman dengan minimal transaksi Rp50.000🧋\n\n📅 15–17 Agustus 2026\n📍 Berlaku di seluruh outlet Xing Fu Tang Indonesia\n\nS&K:\n* Minimal transaksi Rp50.000 (after tax)\n* Berlaku untuk all menu & all size\n* Promo hanya berlaku 1x transaksi/customer\n* Promo tidak dapat digabungkan dengan promo lain\n* Promo tidak berlaku kelipatan\n\n#pakuwonmalljogja",
    "commentsCount": 0,
    "dimensionsHeight": 1348,
    "dimensionsWidth": 1080,
    "displayUrl": "https://instagram.fbnu4-1.fna.fbcdn.net/v/t51.82787-15/772783068_18549768775074731_7389534232046848869_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=instagram.fbnu4-1.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gF7jl0zIXeXy_NciM5HpESJGvgXhAHZhXC6OuAy885gbXusmCxTgwp-6QxwqQw05-o&_nc_ohc=5_o6ktU1BPUQ7kNvwEqZJv9&_nc_gid=3DwYG6hs092bgLgbutBVhQ&edm=APU89FABAAAA&ccb=7-5&oh=00_AQHIO0coH_lMapM60ZgTQQDIKhkaUkTis4Z9pp5RCpKO6A&oe=6A847931&_nc_sid=bc0c2c",
    "hashtags": [
      "pakuwonmalljogja"
    ],
    "id": "3962845751470674051",
    "isCommentsDisabled": false,
    "likesCount": 10,
    "ownerFullName": "Pakuwon Mall Jogja",
    "ownerId": "2237970730",
    "ownerUsername": "pakuwonmall.jogja",
    "shortCode": "Db-2zcEE1CD",
    "timestamp": "2026-08-13T13:34:08.000Z",
    "type": "Sidecar",
    "url": "https://www.instagram.com/p/Db-2zcEE1CD/"
  },
  {
    "caption": "OPENING TOMORROW!!",
    "coauthorProducers": [
      {
        "id": "2237970730",
        "is_verified": true,
        "profile_pic_url": "https://instagram.fbnu4-1.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fbnu4-1.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gF7jl0zIXeXy_NciM5HpESJGvgXhAHZhXC6OuAy885gbXusmCxTgwp-6QxwqQw05-o&_nc_ohc=L9VCN6COaTMQ7kNvwFhpKet&_nc_gid=3DwYG6hs092bgLgbutBVhQ&edm=APU89FABAAAA&ccb=7-5&oh=00_AQEUr-_l-L0hn5J73QGTyMXQP6oTLDCQM0DNaAT4APKglQ&oe=6A846DF3&_nc_sid=bc0c2c",
        "username": "pakuwonmall.jogja"
      }
    ],
    "commentsCount": 0,
    "dimensionsHeight": 1333,
    "dimensionsWidth": 750,
    "displayUrl": "https://instagram.fbnu4-1.fna.fbcdn.net/v/t51.82787-15/773416631_18095656301293262_3909382485189648320_n.jpg?stp=dst-jpg_e15_tt6&_nc_ht=instagram.fbnu4-1.fna.fbcdn.net&_nc_cat=102&_nc_oc=Q6cZ2gF7jl0zIXeXy_NciM5HpESJGvgXhAHZhXC6OuAy885gbXusmCxTgwp-6QxwqQw05-o&_nc_ohc=_6TJgq1hwIIQ7kNvwEv-SRw&_nc_gid=3DwYG6hs092bgLgbutBVhQ&edm=APU89FABAAAA&ccb=7-5&oh=00_AQFptRM3Yjo-fjiVdc5ILfa6Ehb1ijpZ1ELAOtK1cx0MKg&oe=6A847B46&_nc_sid=bc0c2c",
    "hashtags": [],
    "id": "3962841703811491747",
    "isCommentsDisabled": false,
    "likesCount": 39,
    "ownerId": "38851997261",
    "ownerUsername": "crunchmate.id",
    "productType": "clips",
    "shortCode": "Db-14iYyaej",
    "timestamp": "2026-08-13T13:27:48.000Z",
    "type": "Video",
    "url": "https://www.instagram.com/p/Db-14iYyaej/",
    "videoUrl": "https://instagram.fbnu4-1.fna.fbcdn.net/o1/v/t2/f2/m86/AQMJJrm6ltAx9J6YQYa6USccJhoy6ISo5IJWZedS-_Gq7VFuYz2gbHsZnuwfJx-kx6bQK4m8vqj_aL80mkJobeDuVDmEQrgiOTSUeLI.mp4?_nc_cat=109&_nc_oc=AdrNNyJIU4ivzyZCRI7BNr62_jcg0JatHUBhtgGiuIpKXMBL7RFqMzg282ayDuUgJYw&_nc_sid=5e9851&_nc_ht=instagram.fbnu4-1.fna.fbcdn.net&_nc_ohc=hmgg6aQI14gQ7kNvwG-Rynm&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTgyODU4NzAxMTY0MzA3MywiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjoxNCwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=e9a8d6a83693808d&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC81OTQxNkI3RjMzQjA1OEE2RUFCMTdGN0Y0RjA2RURBNV92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyL0YxNDIzNjcwRTRCNjM2MTBDOTlDNUU2NzdDRkM4M0IwX2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACaC26j04sW_BhUCKAJDMywXQC1EGJN0vGoYEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=3DwYG6hs092bgLgbutBVhQ&_nc_zt=28&_nc_ss=7a22e&oh=00_AQFYYjqx6IZ3J5BLPMGWlNOq439tZia7OEpcCDpepcKMvA&oe=6A806AF6"
  },
  {
    "caption": "Lagi cari skincare, makeup, body care, dan parfum lokal? Ke MY SKIN BUT BETTER aja!\n\nLagi ada diskon sampai 50% ditambah extra discount sampai 15k dan banyaaak banget free giftnya loh!\nAyo buruan agendain ke storenya!\n\n#pakuwonmalljogja",
    "commentsCount": 0,
    "dimensionsHeight": 1348,
    "dimensionsWidth": 1080,
    "displayUrl": "https://instagram.fbnu4-1.fna.fbcdn.net/v/t51.82787-15/773155657_18549672562074731_4050104637918995153_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=instagram.fbnu4-1.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gF7jl0zIXeXy_NciM5HpESJGvgXhAHZhXC6OuAy885gbXusmCxTgwp-6QxwqQw05-o&_nc_ohc=Gz_mGkq8mPkQ7kNvwFyHWwJ&_nc_gid=3DwYG6hs092bgLgbutBVhQ&edm=APU89FABAAAA&ccb=7-5&oh=00_AQHYoYbRgtt0ujKGqUHix5Jn2FcJzz7ZzPVkTObmYy0weg&oe=6A846488&_nc_sid=bc0c2c",
    "hashtags": [
      "pakuwonmalljogja"
    ],
    "id": "3962598713289975941",
    "isCommentsDisabled": false,
    "likesCount": 7,
    "ownerFullName": "Pakuwon Mall Jogja",
    "ownerId": "2237970730",
    "ownerUsername": "pakuwonmall.jogja",
    "shortCode": "Db9-oj1EaiF",
    "timestamp": "2026-08-13T05:23:19.000Z",
    "type": "Sidecar",
    "url": "https://www.instagram.com/p/Db9-oj1EaiF/"
  },
  {
    "caption": "🍜 WARGA JOGJA, MERAPAT! 🔥\n\nAda kabar enak buat kamu yang lagi di Jogja! 👀\nBUY 1 GET 1 FREE RAMEN di Haraku Ramen!\n\nCukup beli 1 Ramen atau Donburi, kamu bisa dapat 1 Chicken Chashu Classic Ramen GRATISSS! 🤤🍜\n\n📅 10–16 Agustus 2026\n📍 Haraku Ramen, Pakuwon Mall Jogja – Lantai LG\n\nAjak teman, pasangan, atau keluarga buat ramen-an bareng. Promo ini cuma seminggu, ya! 👀🔥\n\nSyarat dan ketentuan berlaku. Promo hanya tersedia selama periode yang tercantum.\n\n#HarakuRamen #Jogja #RamenHalal #PromoJogja #KulinerJogja",
    "commentsCount": 0,
    "dimensionsHeight": 1349,
    "dimensionsWidth": 1080,
    "displayUrl": "https://instagram.fbnu4-1.fna.fbcdn.net/v/t51.82787-15/773995459_18549671992074731_8394848426978430625_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=instagram.fbnu4-1.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gF7jl0zIXeXy_NciM5HpESJGvgXhAHZhXC6OuAy885gbXusmCxTgwp-6QxwqQw05-o&_nc_ohc=l_mST7fihxcQ7kNvwFJe-OX&_nc_gid=3DwYG6hs092bgLgbutBVhQ&edm=APU89FABAAAA&ccb=7-5&oh=00_AQGT7UKEwQfy96iJvmYAU9y37Z_aoAQxR4ycrC3pxQT_Hw&oe=6A844E12&_nc_sid=bc0c2c",
    "hashtags": [
      "HarakuRamen",
      "Jogja",
      "RamenHalal",
      "PromoJogja",
      "KulinerJogja"
    ],
    "id": "3962597301428515348",
    "isCommentsDisabled": false,
    "likesCount": 77,
    "ownerFullName": "Pakuwon Mall Jogja",
    "ownerId": "2237970730",
    "ownerUsername": "pakuwonmall.jogja",
    "shortCode": "Db9-UA7kXIU",
    "timestamp": "2026-08-13T05:20:30.000Z",
    "type": "Sidecar",
    "url": "https://www.instagram.com/p/Db9-UA7kXIU/"
  },
  {
    "caption": "ANNYEONG, JOGJA! 👋🇰🇷💖\n\nYour next Korean snack obsession is almost here! 👀\n\nGet ready to meet CRUNCHMATE, the home of crispy corndogs, cheesy goodness, spicy topokki, and your new favorite Korean snacks. 🌭🧀🔥\n\n📍 COMING SOON — PAKUWON MALL JOGJA\n\nTag your bestie yang harus diajak jajan pas Crunchmate opening! 👇\n\n#Crunchmate #CrunchmateJogja #KoreanSnack #KulinerJogja #JogjaFoodies",
    "coauthorProducers": [
      {
        "id": "2237970730",
        "is_verified": true,
        "profile_pic_url": "https://instagram.fbnu4-1.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fbnu4-1.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gF7jl0zIXeXy_NciM5HpESJGvgXhAHZhXC6OuAy885gbXusmCxTgwp-6QxwqQw05-o&_nc_ohc=L9VCN6COaTMQ7kNvwFhpKet&_nc_gid=3DwYG6hs092bgLgbutBVhQ&edm=APU89FABAAAA&ccb=7-5&oh=00_AQEUr-_l-L0hn5J73QGTyMXQP6oTLDCQM0DNaAT4APKglQ&oe=6A846DF3&_nc_sid=bc0c2c",
        "username": "pakuwonmall.jogja"
      }
    ],
    "commentsCount": 1,
    "dimensionsHeight": 1350,
    "dimensionsWidth": 1080,
    "displayUrl": "https://instagram.fbnu4-1.fna.fbcdn.net/v/t51.82787-15/772956481_18095587409293262_5287144862366161487_n.jpg?stp=dst-jpg_e15_fr_p1080x1080_tt6&_nc_ht=instagram.fbnu4-1.fna.fbcdn.net&_nc_cat=102&_nc_oc=Q6cZ2gF7jl0zIXeXy_NciM5HpESJGvgXhAHZhXC6OuAy885gbXusmCxTgwp-6QxwqQw05-o&_nc_ohc=1DBQ4Orw6EAQ7kNvwF3SXaV&_nc_gid=3DwYG6hs092bgLgbutBVhQ&edm=APU89FABAAAA&ccb=7-5&oh=00_AQEyDtMmiUOzWoQHJ1q6UnNjODlyq5QAbbxH-UK0xTWkMA&oe=6A8451A0&_nc_sid=bc0c2c",
    "hashtags": [
      "Crunchmate",
      "CrunchmateJogja",
      "KoreanSnack",
      "KulinerJogja",
      "JogjaFoodies"
    ],
    "id": "3962526282592437840",
    "isCommentsDisabled": false,
    "likesCount": 121,
    "ownerId": "38851997261",
    "ownerUsername": "crunchmate.id",
    "shortCode": "Db9uKjfEkZQ",
    "timestamp": "2026-08-13T02:59:24.000Z",
    "type": "Sidecar",
    "url": "https://www.instagram.com/p/Db9uKjfEkZQ/"
  }
]
```
