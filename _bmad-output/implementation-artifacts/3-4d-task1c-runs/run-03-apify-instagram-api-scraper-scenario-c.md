# Task 1c — Run 3: apify/instagram-api-scraper — Scenario C (zero-boundary)

Part of [3-4d-per-use-case-actor-selection-and-sync-path-timeout.md](../3-4d-per-use-case-actor-selection-and-sync-path-timeout.md) Task 1c. Expected: 0 items, ~$0 cost for a correctly-behaving actor — **but given Run 2 already confirmed this actor leaks all 3 pinned posts regardless of cutoff, expect those same 3 pinned posts to appear here too, with nonzero cost.** That would confirm (not contradict) the bug — a genuine 0 here would actually be the surprising result worth double-checking.

`T + 1s` derived from Run 4's newest known post (`2026-08-14T03:30:36.000Z`, "Elise Suede Mules" post) → `2026-08-14T03:30:37.000Z`. **Re-verify this is still current before running** — if real time has moved on since Run 4, do a fresh `resultsLimit: 1` check first and recompute; otherwise a genuinely new post showing up here isn't a filter bug, just a stale cutoff.

**Input params:** `{"directUrls": ["https://www.instagram.com/pakuwonmall.jogja/"], "resultsType": "posts", "resultsLimit": 15, "onlyPostsNewerThan": "2026-08-14T03:30:37.000Z"}`

* **Date/Time:** 2026-08-14 14:43
* **Run ID:** [0AdZ5XKdHesPBNRgS](https://console.apify.com/actors/RB9HEZitC8hIUXAha/runs/0AdZ5XKdHesPBNRgS#output)
* **Duration:** 39 s

- Cost ($):
  * **Result:** 7 results × \$0.0023 = **\$0.0161**
  * **Actor start:** 1 × **\$0.001**
  * **Search result:** 0 results = **\$0.00**
  * **Add-on (Date filter):** 7 items × \$0.0013 = **\$0.0091**
- Items returned (count):
- Output (paste full JSON):

```json
[
  {
    "id": "3963381371133254330",
    "type": "Video",
    "shortCode": "DcAwluvzFq6",
    "caption": "The BIG Playground in Jogja balik lagi! 🥳✨\n\nDari tanggal 7 - 16 Agustus 2026, Pakuwon Mall Jogja menghadirkan kembali Play With Us di Grand Atrium! 🎮🏎️\n\nWahananya lengkap dan seru-seru banget:\n🏎️ Diecast Playland\n🚗 Big Foot Cars Sirkuit\n🚜 RC Excavator Area\n🧗 RC Adventure Arena\n🏎️ F1 Race Simulator\n\nTiket masuknya terjangkau banget, mulai dari Rp 35.000 aja! Pas banget buat ajak si kecil main minggu ini!\n\n📍 Grand Atrium - Pakuwon Mall Jogja\n📅 7 - 16 Agustus 2026\n\nJangan sampai kelewatan ya! 😉👇\n\n#PlayWithUs #PakuwonMallJogja #PlaygroundJogja #WisataAnakJogja #EventJogja KulinerJogja InfoJogja",
    "hashtags": [
      "PlayWithUs",
      "PakuwonMallJogja",
      "PlaygroundJogja",
      "WisataAnakJogja",
      "EventJogja"
    ],
    "mentions": [],
    "url": "https://www.instagram.com/p/DcAwluvzFq6/",
    "commentsCount": 1,
    "firstComment": "Seru pol, besok kesini lagi liburan anak anak ya😍",
    "latestComments": [
      {
        "id": "18105768653595723",
        "text": "Seru pol, besok kesini lagi liburan anak anak ya😍",
        "ownerUsername": "andinni____",
        "ownerProfilePicUrl": "https://instagram.fvlc1-2.fna.fbcdn.net/v/t51.82787-19/659081377_18580585957015629_6737835718861610814_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=instagram.fvlc1-2.fna.fbcdn.net&_nc_cat=109&_nc_oc=Q6cZ2gHCWNJTCe3fG5reNkRLl0cYojDPsADBDcph9myuYtZs2RKH7fKSWpMxdl3VFgwJeow&_nc_ohc=p0aDD6uCy04Q7kNvwEap69O&_nc_gid=vTDkDO602vm_-hbce2pSXQ&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQEfkS8z_dFBoeEZ3iuB7WpeuTW_FNrMun5LraoeqI1CyQ&oe=6A84AAAA&_nc_sid=c6f216",
        "timestamp": "2026-08-14T07:35:32.000Z",
        "repliesCount": null,
        "replies": null,
        "likesCount": 0,
        "owner": {
          "username": "andinni____",
          "profile_pic_url": "https://instagram.fvlc1-2.fna.fbcdn.net/v/t51.82787-19/659081377_18580585957015629_6737835718861610814_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=instagram.fvlc1-2.fna.fbcdn.net&_nc_cat=109&_nc_oc=Q6cZ2gHCWNJTCe3fG5reNkRLl0cYojDPsADBDcph9myuYtZs2RKH7fKSWpMxdl3VFgwJeow&_nc_ohc=p0aDD6uCy04Q7kNvwEap69O&_nc_gid=vTDkDO602vm_-hbce2pSXQ&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQEfkS8z_dFBoeEZ3iuB7WpeuTW_FNrMun5LraoeqI1CyQ&oe=6A84AAAA&_nc_sid=c6f216",
          "is_verified": false,
          "id": "1504527628",
          "full_name": null,
          "is_mentionable": null,
          "is_private": null,
          "profile_pic_id": null,
          "latest_reel_media": null
        }
      }
    ],
    "dimensionsHeight": 1916,
    "dimensionsWidth": 1080,
    "displayUrl": "https://instagram.fvlc1-2.fna.fbcdn.net/v/t51.82787-15/774905443_18451629595184797_1785892812524699280_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=instagram.fvlc1-2.fna.fbcdn.net&_nc_cat=101&_nc_oc=Q6cZ2gHCWNJTCe3fG5reNkRLl0cYojDPsADBDcph9myuYtZs2RKH7fKSWpMxdl3VFgwJeow&_nc_ohc=rmZ0fhDJ2kcQ7kNvwGsISpT&_nc_gid=vTDkDO602vm_-hbce2pSXQ&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQGPHmdnJ6enK2r81KV_hV8-tGqZLJGxDmNdC_dGHtan0g&oe=6A848EF5&_nc_sid=c6f216",
    "images": [],
    "videoUrl": "https://instagram.fvlc1-2.fna.fbcdn.net/o1/v/t2/f2/m86/AQO9kR_ciied0fswp2LUBawsDCnx3MwCq0eQzRWkhrX76Fsi851c8-69h1KJ-fetFnVvKc6BQbgAs0rFPy9nLhoAIPX1oH06aFPIPvw.mp4?_nc_cat=101&_nc_oc=AdqYuZoSSe9Y7ph-jrx2eJTg9zblRIs38JZw5R6bXsPf2bXaLQeAu2RbqaE_JnfMunY&_nc_sid=5e9851&_nc_ht=instagram.fvlc1-2.fna.fbcdn.net&_nc_ohc=KsBQAWG-Z2QQ7kNvwHdxwTd&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MjUyMDgxMDU0NTA5MTgyMiwiYXNzZXRfYWdlX2RheXMiOjAsInZpX3VzZWNhc2VfaWQiOjEwMDk5LCJkdXJhdGlvbl9zIjozNywidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&vs=8c2c88aa60a04e68&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC9ERTQyRTZBNzVDNzEyMzQ2MDk1MENFQzdEQUZCOTZBNF92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyL0E0NEQ5QTU0NzBFQzkzNzQyQkRDODIzQjRCQkI4MEI0X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACbc07CRvqr6CBUCKAJDMywXQEKMzMzMzM0YEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=vTDkDO602vm_-hbce2pSXQ&_nc_zt=28&_nc_ss=7a22e&oh=00_AQGoXCG_es06M8shMv2tAc42J5YyfvP3PRJj9m6qxKjqBw&oe=6A80BF5E",
    "likesCount": 11,
    "videoViewCount": 184,
    "timestamp": "2026-08-14T07:26:05.000Z",
    "childPosts": [],
    "locationName": "Pakuwon Mall Jogja",
    "locationId": "350725118605524",
    "ownerUsername": "tikanoviia",
    "ownerId": "5583800796",
    "productType": "clips",
    "paidPartnership": false,
    "taggedUsers": [
      {
        "full_name": "KOLABORASI JAWA TENGAH | Media Promosi & Informasi di Jateng",
        "id": "79589453676",
        "is_verified": true,
        "profile_pic_url": "https://instagram.fvlc1-2.fna.fbcdn.net/v/t51.82787-19/635010153_17853252258653677_2013522932633231966_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=instagram.fvlc1-2.fna.fbcdn.net&_nc_cat=101&_nc_oc=Q6cZ2gHCWNJTCe3fG5reNkRLl0cYojDPsADBDcph9myuYtZs2RKH7fKSWpMxdl3VFgwJeow&_nc_ohc=OiJqpJco89wQ7kNvwG7tjQo&_nc_gid=vTDkDO602vm_-hbce2pSXQ&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQHStl1iGeLoEOGG6FxFr8wm21wb5y_p_sxtMbTnPWn1wQ&oe=6A84A7C3&_nc_sid=c6f216",
        "username": "kolaborasijateng"
      },
      {
        "full_name": "Pakuwon Mall Jogja",
        "id": "2237970730",
        "is_verified": true,
        "profile_pic_url": "https://instagram.fvlc1-2.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fvlc1-2.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gHCWNJTCe3fG5reNkRLl0cYojDPsADBDcph9myuYtZs2RKH7fKSWpMxdl3VFgwJeow&_nc_ohc=L9VCN6COaTMQ7kNvwHsdM_b&_nc_gid=vTDkDO602vm_-hbce2pSXQ&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQFLhsU-TQ8eGTA4fS_dMuf3gDTIm43pCLY6Z0CuuC1_WQ&oe=6A84A633&_nc_sid=c6f216",
        "username": "pakuwonmall.jogja"
      },
      {
        "full_name": "Jogja Nice Info",
        "id": "72514061469",
        "is_verified": false,
        "profile_pic_url": "https://instagram.fvlc2-1.fna.fbcdn.net/v/t51.2885-19/476246031_1175898783868049_2571657218397445928_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby41MDAuYzIifQ&_nc_ht=instagram.fvlc2-1.fna.fbcdn.net&_nc_cat=105&_nc_oc=Q6cZ2gHCWNJTCe3fG5reNkRLl0cYojDPsADBDcph9myuYtZs2RKH7fKSWpMxdl3VFgwJeow&_nc_ohc=Bg_y-hr151cQ7kNvwEhzEbr&_nc_gid=vTDkDO602vm_-hbce2pSXQ&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQG3KD4lPLcSuJDD7OfsepmtCpKGdU2nfIMJlX579oCcVQ&oe=6A8493D3&_nc_sid=c6f216",
        "username": "jogjaniceinfo"
      },
      {
        "full_name": "Travelling Ke Jogja",
        "id": "3935681658",
        "is_verified": false,
        "profile_pic_url": "https://instagram.fvlc2-1.fna.fbcdn.net/v/t51.82787-19/615267211_18437987830129659_618848764352237694_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby45NTcuYzIifQ&_nc_ht=instagram.fvlc2-1.fna.fbcdn.net&_nc_cat=103&_nc_oc=Q6cZ2gHCWNJTCe3fG5reNkRLl0cYojDPsADBDcph9myuYtZs2RKH7fKSWpMxdl3VFgwJeow&_nc_ohc=LIcP1SCMPJYQ7kNvwHk4DKE&_nc_gid=vTDkDO602vm_-hbce2pSXQ&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQGezZmHRnZlAeqXBCnYg4oa_PT9dqQQLX_ZBQEYT9_Sww&oe=6A84B458&_nc_sid=c6f216",
        "username": "travellingkejogja"
      },
      {
        "full_name": "KulineranJogja",
        "id": "58358071611",
        "is_verified": false,
        "profile_pic_url": "https://instagram.fvlc1-2.fna.fbcdn.net/v/t51.2885-19/503134034_17957002415951612_2203695640052218324_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby40NTMuYzIifQ&_nc_ht=instagram.fvlc1-2.fna.fbcdn.net&_nc_cat=108&_nc_oc=Q6cZ2gHCWNJTCe3fG5reNkRLl0cYojDPsADBDcph9myuYtZs2RKH7fKSWpMxdl3VFgwJeow&_nc_ohc=NT8hBhqAQu0Q7kNvwFThF1S&_nc_gid=vTDkDO602vm_-hbce2pSXQ&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQFftaC6jfxU3NVc-_OLAJTcVzQ9hkWxXpOSXCycZ5KE-g&oe=6A84B59D&_nc_sid=c6f216",
        "username": "jogjajalanmakan"
      }
    ],
    "coauthorProducers": [
      {
        "id": "2237970730",
        "is_verified": true,
        "profile_pic_url": "https://instagram.fvlc1-2.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzIifQ&_nc_ht=instagram.fvlc1-2.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gHCWNJTCe3fG5reNkRLl0cYojDPsADBDcph9myuYtZs2RKH7fKSWpMxdl3VFgwJeow&_nc_ohc=L9VCN6COaTMQ7kNvwHsdM_b&_nc_gid=vTDkDO602vm_-hbce2pSXQ&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQFLhsU-TQ8eGTA4fS_dMuf3gDTIm43pCLY6Z0CuuC1_WQ&oe=6A84A633&_nc_sid=c6f216",
        "username": "pakuwonmall.jogja"
      }
    ],
    "isCommentsDisabled": false,
    "inputUrl": "https://www.instagram.com/pakuwonmall.jogja/",
    "audioUrl": "https://instagram.fvlc2-1.fna.fbcdn.net/o1/v/t2/f2/m78/AQOG0Z3V_3mRrTG6Xh0wLQIeowYubt-fq9yeD0nzIVBMTiEPlA2rmUi4DBf4i1UGguiwE5xaxU5QBj5BLuUHeJuwpEWWDYCawZA18l4.mp4?_nc_cat=103&_nc_oc=AdpUsfHbSwhpFo--W_UMe1h6D_CjBSteFgvaPlJV9uBNPP9_p17zsjQLsUcWaEvawdY&_nc_sid=9ca052&_nc_ht=instagram.fvlc2-1.fna.fbcdn.net&_nc_ohc=tfMZvgKdkBAQ7kNvwFDYzzu&efg=eyJ2ZW5jb2RlX3RhZyI6ImlnLXhwdmRzLmNsaXBzLmMyLUMzLmRhc2hfbG5faGVhYWNfdmJyM19hdWRpbyIsInZpZGVvX2lkIjpudWxsLCJvaWxfdXJsZ2VuX2FwcF9pZCI6OTM2NjE5NzQzMzkyNDU5LCJjbGllbnRfbmFtZSI6ImlnIiwieHB2X2Fzc2V0X2lkIjoyNTIwODEwNTQ1MDkxODIyLCJhc3NldF9hZ2VfZGF5cyI6MCwidmlfdXNlY2FzZV9pZCI6MTAwOTksImR1cmF0aW9uX3MiOjM3LCJiaXRyYXRlIjo1Mzk1MSwidXJsZ2VuX3NvdXJjZSI6Ind3dyJ9&ccb=17-1&_nc_gid=vTDkDO602vm_-hbce2pSXQ&_nc_ss=7a22e&_nc_zt=28&oh=00_AQHfr9MPgz7EQ0HMyjxbrp_npPJ3zE6kjcuHGKlgGWIG9w&oe=6A80A828",
    "alt": null,
    "videoPlayCount": 693,
    "ownerFullName": "Jogja. Visit. Riview. Endorse beauty jogja",
    "videoDuration": 37.103,
    "musicInfo": {
      "artist_name": "tikanoviia",
      "song_name": "Original audio",
      "uses_original_audio": true,
      "should_mute_audio": false,
      "should_mute_audio_reason": "",
      "audio_id": "27760578416927145"
    }
  },
  {
    "id": "3963290610605662960",
    "type": "Image",
    "shortCode": "DcAb8_ayqLw",
    "caption": "BUY POTATO MOZZA, FREE ORIGINAL! \n\nCheesy, crunchy, and even better with a FREE Original! 🤤\nDon’t miss it! 🩷🖤\n\n📍 Available at Pakuwon Mall Jogja, LG\n📆 August 14-20, 2026",
    "hashtags": [],
    "mentions": [],
    "url": "https://www.instagram.com/p/DcAb8_ayqLw/",
    "commentsCount": 2,
    "firstComment": "gaskan jajan ngga sih 😍 @echa_arina",
    "latestComments": [
      {
        "id": "17954417718226951",
        "text": "gaskan jajan ngga sih 😍 @echa_arina",
        "ownerUsername": "lazhimah",
        "ownerProfilePicUrl": "https://instagram.fyyz1-2.fna.fbcdn.net/v/t51.82787-19/773541475_18614285953002427_2968476299496409794_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMxIn0&_nc_ht=instagram.fyyz1-2.fna.fbcdn.net&_nc_cat=107&_nc_oc=Q6cZ2gGtir54ZeJmk6ppVKiMUO1QGoGGQGWO_RMFOQ4FViC3Qd3lTlWcdg3UGW5x7QNWfVms-q3ez0R7FsW_2Ez0JHwi&_nc_ohc=GSw3WxcqJt8Q7kNvwFIe1Uf&_nc_gid=NeNk-PTNQdAhWuEddfV_yw&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQFzuzbubNaFwkZ5FTo2W2JZxNvglMwme_uMfIctrYoCrw&oe=6A849244&_nc_sid=c6f216",
        "timestamp": "2026-08-14T06:55:41.000Z",
        "repliesCount": null,
        "replies": null,
        "likesCount": 0,
        "owner": {
          "username": "lazhimah",
          "profile_pic_url": "https://instagram.fyyz1-2.fna.fbcdn.net/v/t51.82787-19/773541475_18614285953002427_2968476299496409794_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMxIn0&_nc_ht=instagram.fyyz1-2.fna.fbcdn.net&_nc_cat=107&_nc_oc=Q6cZ2gGtir54ZeJmk6ppVKiMUO1QGoGGQGWO_RMFOQ4FViC3Qd3lTlWcdg3UGW5x7QNWfVms-q3ez0R7FsW_2Ez0JHwi&_nc_ohc=GSw3WxcqJt8Q7kNvwFIe1Uf&_nc_gid=NeNk-PTNQdAhWuEddfV_yw&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQFzuzbubNaFwkZ5FTo2W2JZxNvglMwme_uMfIctrYoCrw&oe=6A849244&_nc_sid=c6f216",
          "is_verified": false,
          "id": "1618562426",
          "full_name": null,
          "is_mentionable": null,
          "is_private": null,
          "profile_pic_id": null,
          "latest_reel_media": null
        }
      },
      {
        "id": "18089549090236890",
        "text": "@lazhimah ayoo gass jajan sblm tgl 20",
        "ownerUsername": "echa_arina",
        "ownerProfilePicUrl": "https://instagram.fyyz1-2.fna.fbcdn.net/v/t51.82787-19/729618309_18599687812035058_3571918577265655758_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby45NDEuYzEifQ&_nc_ht=instagram.fyyz1-2.fna.fbcdn.net&_nc_cat=110&_nc_oc=Q6cZ2gGtir54ZeJmk6ppVKiMUO1QGoGGQGWO_RMFOQ4FViC3Qd3lTlWcdg3UGW5x7QNWfVms-q3ez0R7FsW_2Ez0JHwi&_nc_ohc=qofFpxyTWvYQ7kNvwH7U7cz&_nc_gid=NeNk-PTNQdAhWuEddfV_yw&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQG_wPyKwaaokLoNkv14wBH-jFNbixSPhq5MHVCz3DgTyg&oe=6A84A9E9&_nc_sid=c6f216",
        "timestamp": "2026-08-14T06:56:37.000Z",
        "repliesCount": null,
        "replies": null,
        "likesCount": 0,
        "owner": {
          "username": "echa_arina",
          "profile_pic_url": "https://instagram.fyyz1-2.fna.fbcdn.net/v/t51.82787-19/729618309_18599687812035058_3571918577265655758_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby45NDEuYzEifQ&_nc_ht=instagram.fyyz1-2.fna.fbcdn.net&_nc_cat=110&_nc_oc=Q6cZ2gGtir54ZeJmk6ppVKiMUO1QGoGGQGWO_RMFOQ4FViC3Qd3lTlWcdg3UGW5x7QNWfVms-q3ez0R7FsW_2Ez0JHwi&_nc_ohc=qofFpxyTWvYQ7kNvwH7U7cz&_nc_gid=NeNk-PTNQdAhWuEddfV_yw&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQG_wPyKwaaokLoNkv14wBH-jFNbixSPhq5MHVCz3DgTyg&oe=6A84A9E9&_nc_sid=c6f216",
          "is_verified": true,
          "id": "340003057",
          "full_name": null,
          "is_mentionable": null,
          "is_private": null,
          "profile_pic_id": null,
          "latest_reel_media": null
        }
      }
    ],
    "dimensionsHeight": 1349,
    "dimensionsWidth": 1080,
    "displayUrl": "https://instagram.fyyz1-1.fna.fbcdn.net/v/t51.82787-15/773519823_18095763680293262_8938356023924758124_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=instagram.fyyz1-1.fna.fbcdn.net&_nc_cat=102&_nc_oc=Q6cZ2gGtir54ZeJmk6ppVKiMUO1QGoGGQGWO_RMFOQ4FViC3Qd3lTlWcdg3UGW5x7QNWfVms-q3ez0R7FsW_2Ez0JHwi&_nc_ohc=uxVNS2ZUuKQQ7kNvwE1reB5&_nc_gid=NeNk-PTNQdAhWuEddfV_yw&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQFxMvK5_wiab6bWgTJSMppILUrdiGaHvTJHZfP3keu5og&oe=6A848B24&_nc_sid=c6f216",
    "images": [],
    "alt": "Photo by Crunchmate.id on August 13, 2026. May be an image of popcorn, wafer, fritter, durian, poster and text that says 'CRUNCHMATE 케이핫도그 BUY BUY1GET 1 GET 1 Buy Potato Mozza BuyPotatoMozzaFreeOriginal Free Original ONLY 14-20 14- 14 20 August Pakuwon Mall Jogja (LG Floor) ਹ crunchmate.id'.",
    "likesCount": 81,
    "timestamp": "2026-08-14T04:19:31.000Z",
    "childPosts": [],
    "ownerUsername": "crunchmate.id",
    "ownerId": "38851997261",
    "paidPartnership": false,
    "taggedUsers": [
      {
        "full_name": "Pakuwon Mall Jogja",
        "id": "2237970730",
        "is_verified": true,
        "profile_pic_url": "https://instagram.fyyz1-2.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzEifQ&_nc_ht=instagram.fyyz1-2.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gGtir54ZeJmk6ppVKiMUO1QGoGGQGWO_RMFOQ4FViC3Qd3lTlWcdg3UGW5x7QNWfVms-q3ez0R7FsW_2Ez0JHwi&_nc_ohc=L9VCN6COaTMQ7kNvwGOFwnQ&_nc_gid=NeNk-PTNQdAhWuEddfV_yw&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQGCG3QpnZOIKtzlXnAna2ZbC8_IdP-P8N7ZTnGxe0sOzA&oe=6A84A633&_nc_sid=c6f216",
        "username": "pakuwonmall.jogja"
      }
    ],
    "coauthorProducers": [
      {
        "id": "2237970730",
        "is_verified": true,
        "profile_pic_url": "https://instagram.fyyz1-2.fna.fbcdn.net/v/t51.82787-19/760232892_18546284812074731_7112163529722685657_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby44ODYuYzEifQ&_nc_ht=instagram.fyyz1-2.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gGtir54ZeJmk6ppVKiMUO1QGoGGQGWO_RMFOQ4FViC3Qd3lTlWcdg3UGW5x7QNWfVms-q3ez0R7FsW_2Ez0JHwi&_nc_ohc=L9VCN6COaTMQ7kNvwGOFwnQ&_nc_gid=NeNk-PTNQdAhWuEddfV_yw&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQGCG3QpnZOIKtzlXnAna2ZbC8_IdP-P8N7ZTnGxe0sOzA&oe=6A84A633&_nc_sid=c6f216",
        "username": "pakuwonmall.jogja"
      }
    ],
    "isCommentsDisabled": false,
    "inputUrl": "https://www.instagram.com/pakuwonmall.jogja/",
    "ownerFullName": "Crunchmate.id",
    "originalWidth": 3277,
    "originalHeight": 4096
  },
  {
    "id": "3956336239959704459",
    "type": "Image",
    "shortCode": "DbnutlCzYOL",
    "caption": "Malaysia Healthcare Expo Yogyakarta hadir kembali di Pakuwon Mall Jogja!🇲🇾🏥\n\nCari informasi seputar medical check-up, pengobatan, hingga medical tourism langsung dari rumah sakit ternama di Malaysia!\n\nCatat tanggalnya! \n🗓 20–23 Agustus 2026\n📍 Grand Atrium, Ground Floor\n\nJangan lewatkan kesempatan untuk merencanakan perjalanan kesehatan Anda dengan mudah dan nyaman 🤍\n\n#pakuwonmalljogja",
    "hashtags": [
      "pakuwonmalljogja"
    ],
    "mentions": [],
    "url": "https://www.instagram.com/p/DbnutlCzYOL/",
    "commentsCount": 0,
    "firstComment": "",
    "latestComments": [],
    "dimensionsHeight": 1440,
    "dimensionsWidth": 1080,
    "displayUrl": "https://instagram.fmex10-7.fna.fbcdn.net/v/t51.82787-15/764693584_18547370830074731_2050476874872495205_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=instagram.fmex10-7.fna.fbcdn.net&_nc_cat=111&_nc_oc=Q6cZ2gH51AyMgQ0eGbcSjGDQiRzqC2H0TbGI37k-_ksSaK6dp40vkAHSq8Tj9Sf93NSjuWxz_eSy7Ulr-qTMpIJiGRBk&_nc_ohc=Sh7NmirKDzMQ7kNvwHpK9oq&_nc_gid=IQ9PpUmaOTNu82gvjLobMw&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQGPTfygKd091X8QLuJgGIPpeY28E8P8tQyTDVVaLeEQoQ&oe=6A849D44&_nc_sid=c6f216",
    "images": [],
    "alt": "Photo by Pakuwon Mall Jogja on August 04, 2026. May be an image of text.",
    "likesCount": 38,
    "timestamp": "2026-08-04T14:07:36.000Z",
    "childPosts": [],
    "ownerFullName": "Pakuwon Mall Jogja",
    "ownerUsername": "pakuwonmall.jogja",
    "ownerId": "2237970730",
    "paidPartnership": false,
    "isPinned": true,
    "isCommentsDisabled": false,
    "inputUrl": "https://www.instagram.com/pakuwonmall.jogja/",
    "originalWidth": 3072,
    "originalHeight": 4096
  },
  {
    "id": "3956074067262283706",
    "type": "Image",
    "shortCode": "DbmzGdsTZ-6",
    "caption": "🚗💨 Something BIG is racing your way!\n\nSiap-siap seru-seruan di Play With Us Vol. 2 Hobby & Toys Expo! 🎮🏎️\n\nDiecast, Race Simulator, dan masih banyak keseruan lainnya! \n\n🗓️ 7–16 Agustus\n📍 Grand Atrium Pakuwon Mall Jogja\n\nMark your calendar and stay tuned! 👀🔥\n\n#pakuwonmalljogja",
    "hashtags": [
      "pakuwonmalljogja"
    ],
    "mentions": [],
    "url": "https://www.instagram.com/p/DbmzGdsTZ-6/",
    "commentsCount": 11,
    "firstComment": "Gak worth it gess. Mosok sing nganter melu bayar 😅😅😅",
    "latestComments": [
      {
        "id": "18089380946542972",
        "text": "Gak worth it gess. Mosok sing nganter melu bayar 😅😅😅",
        "ownerUsername": "albertusgal",
        "ownerProfilePicUrl": "https://scontent-waw2-2.cdninstagram.com/v/t51.82787-19/554441992_18418262776110438_7822145412851270602_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=scontent-waw2-2.cdninstagram.com&_nc_cat=106&_nc_oc=Q6cZ2gEolgfN40mA5u6Nbq1rPm1-oYEMe-2lnW26ebuO6ouLH-6eJcqBW25hQVpbI2O6dxo&_nc_ohc=No9dRbzoXQcQ7kNvwH-Rn4V&_nc_gid=nYmOEPG5oYMyrzf6VVbj7A&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQHDTG9x68v2JrRTTtHGM50LqcmYqQ0XM7TCNwv7ndq6tw&oe=6A84A074&_nc_sid=c6f216",
        "timestamp": "2026-08-07T11:42:06.000Z",
        "repliesCount": null,
        "replies": null,
        "likesCount": 0,
        "owner": {
          "username": "albertusgal",
          "profile_pic_url": "https://scontent-waw2-2.cdninstagram.com/v/t51.82787-19/554441992_18418262776110438_7822145412851270602_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=scontent-waw2-2.cdninstagram.com&_nc_cat=106&_nc_oc=Q6cZ2gEolgfN40mA5u6Nbq1rPm1-oYEMe-2lnW26ebuO6ouLH-6eJcqBW25hQVpbI2O6dxo&_nc_ohc=No9dRbzoXQcQ7kNvwH-Rn4V&_nc_gid=nYmOEPG5oYMyrzf6VVbj7A&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQHDTG9x68v2JrRTTtHGM50LqcmYqQ0XM7TCNwv7ndq6tw&oe=6A84A074&_nc_sid=c6f216",
          "is_verified": false,
          "id": "3251574437",
          "full_name": null,
          "is_mentionable": null,
          "is_private": null,
          "profile_pic_id": null,
          "latest_reel_media": null
        }
      },
      {
        "id": "18102894257267499",
        "text": "Huwaa wekeend main ke sini aja @deoalifprasetya",
        "ownerUsername": "lazhimah",
        "ownerProfilePicUrl": "https://scontent-waw2-1.cdninstagram.com/v/t51.82787-19/773541475_18614285953002427_2968476299496409794_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=scontent-waw2-1.cdninstagram.com&_nc_cat=107&_nc_oc=Q6cZ2gEolgfN40mA5u6Nbq1rPm1-oYEMe-2lnW26ebuO6ouLH-6eJcqBW25hQVpbI2O6dxo&_nc_ohc=GSw3WxcqJt8Q7kNvwEd8Oe0&_nc_gid=nYmOEPG5oYMyrzf6VVbj7A&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQFt08JecxrCIiXfBM6KC10_erRwcpDWWG9s3_kOLBarrw&oe=6A849244&_nc_sid=c6f216",
        "timestamp": "2026-08-06T06:51:01.000Z",
        "repliesCount": null,
        "replies": null,
        "likesCount": 0,
        "owner": {
          "username": "lazhimah",
          "profile_pic_url": "https://scontent-waw2-1.cdninstagram.com/v/t51.82787-19/773541475_18614285953002427_2968476299496409794_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=scontent-waw2-1.cdninstagram.com&_nc_cat=107&_nc_oc=Q6cZ2gEolgfN40mA5u6Nbq1rPm1-oYEMe-2lnW26ebuO6ouLH-6eJcqBW25hQVpbI2O6dxo&_nc_ohc=GSw3WxcqJt8Q7kNvwEd8Oe0&_nc_gid=nYmOEPG5oYMyrzf6VVbj7A&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQFt08JecxrCIiXfBM6KC10_erRwcpDWWG9s3_kOLBarrw&oe=6A849244&_nc_sid=c6f216",
          "is_verified": false,
          "id": "1618562426",
          "full_name": null,
          "is_mentionable": null,
          "is_private": null,
          "profile_pic_id": null,
          "latest_reel_media": null
        }
      },
      {
        "id": "18112820950758140",
        "text": "❤️❤️ pasti seru 🙌",
        "ownerUsername": "bubblehousesolo",
        "ownerProfilePicUrl": "https://scontent-waw2-1.cdninstagram.com/v/t51.2885-19/440624507_1182046363171129_5322391667183195767_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby41NTQuYzIifQ&_nc_ht=scontent-waw2-1.cdninstagram.com&_nc_cat=101&_nc_oc=Q6cZ2gEolgfN40mA5u6Nbq1rPm1-oYEMe-2lnW26ebuO6ouLH-6eJcqBW25hQVpbI2O6dxo&_nc_ohc=PohmSMpnVqoQ7kNvwGESzBH&_nc_gid=nYmOEPG5oYMyrzf6VVbj7A&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQEk7YbeG1-Vu2ajqt4FzJ4cyXYPP8YTnu1NtxJBgAnmQQ&oe=6A84897E&_nc_sid=c6f216",
        "timestamp": "2026-08-05T12:31:33.000Z",
        "repliesCount": null,
        "replies": null,
        "likesCount": 0,
        "owner": {
          "username": "bubblehousesolo",
          "profile_pic_url": "https://scontent-waw2-1.cdninstagram.com/v/t51.2885-19/440624507_1182046363171129_5322391667183195767_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby41NTQuYzIifQ&_nc_ht=scontent-waw2-1.cdninstagram.com&_nc_cat=101&_nc_oc=Q6cZ2gEolgfN40mA5u6Nbq1rPm1-oYEMe-2lnW26ebuO6ouLH-6eJcqBW25hQVpbI2O6dxo&_nc_ohc=PohmSMpnVqoQ7kNvwGESzBH&_nc_gid=nYmOEPG5oYMyrzf6VVbj7A&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQEk7YbeG1-Vu2ajqt4FzJ4cyXYPP8YTnu1NtxJBgAnmQQ&oe=6A84897E&_nc_sid=c6f216",
          "is_verified": false,
          "id": "60255182610",
          "full_name": null,
          "is_mentionable": null,
          "is_private": null,
          "profile_pic_id": null,
          "latest_reel_media": null
        }
      },
      {
        "id": "18615679594055779",
        "text": "Keren 😍",
        "ownerUsername": "rcdiggerfunland",
        "ownerProfilePicUrl": "https://scontent-waw2-2.cdninstagram.com/v/t51.82787-19/656858784_17950713678069135_1866464135413677950_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=scontent-waw2-2.cdninstagram.com&_nc_cat=103&_nc_oc=Q6cZ2gEolgfN40mA5u6Nbq1rPm1-oYEMe-2lnW26ebuO6ouLH-6eJcqBW25hQVpbI2O6dxo&_nc_ohc=-766O0_2FOMQ7kNvwECrJvm&_nc_gid=nYmOEPG5oYMyrzf6VVbj7A&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQF_ZOzEPKOb8zbDU-ZZcc8vX3lc8cCOIff5FuAnNtu1nA&oe=6A84A8B5&_nc_sid=c6f216",
        "timestamp": "2026-08-05T12:28:37.000Z",
        "repliesCount": null,
        "replies": null,
        "likesCount": 0,
        "owner": {
          "username": "rcdiggerfunland",
          "profile_pic_url": "https://scontent-waw2-2.cdninstagram.com/v/t51.82787-19/656858784_17950713678069135_1866464135413677950_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=scontent-waw2-2.cdninstagram.com&_nc_cat=103&_nc_oc=Q6cZ2gEolgfN40mA5u6Nbq1rPm1-oYEMe-2lnW26ebuO6ouLH-6eJcqBW25hQVpbI2O6dxo&_nc_ohc=-766O0_2FOMQ7kNvwECrJvm&_nc_gid=nYmOEPG5oYMyrzf6VVbj7A&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQF_ZOzEPKOb8zbDU-ZZcc8vX3lc8cCOIff5FuAnNtu1nA&oe=6A84A8B5&_nc_sid=c6f216",
          "is_verified": false,
          "id": "61977629134",
          "full_name": null,
          "is_mentionable": null,
          "is_private": null,
          "profile_pic_id": null,
          "latest_reel_media": null
        }
      },
      {
        "id": "18456403453141699",
        "text": "@andhikayogap @yohanes193 gas bapak²",
        "ownerUsername": "yusufn271",
        "ownerProfilePicUrl": "https://scontent-waw2-1.cdninstagram.com/v/t51.82787-19/720950184_18358495942211252_7614012765317166874_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=scontent-waw2-1.cdninstagram.com&_nc_cat=108&_nc_oc=Q6cZ2gEolgfN40mA5u6Nbq1rPm1-oYEMe-2lnW26ebuO6ouLH-6eJcqBW25hQVpbI2O6dxo&_nc_ohc=RUx0IRjTTiwQ7kNvwFXKsTP&_nc_gid=nYmOEPG5oYMyrzf6VVbj7A&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQEz431Ka22LEUoaYSC2YRYqsdLeIgQiQKrlbWSONUtb6g&oe=6A84A678&_nc_sid=c6f216",
        "timestamp": "2026-08-05T04:23:52.000Z",
        "repliesCount": null,
        "replies": null,
        "likesCount": 0,
        "owner": {
          "username": "yusufn271",
          "profile_pic_url": "https://scontent-waw2-1.cdninstagram.com/v/t51.82787-19/720950184_18358495942211252_7614012765317166874_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=scontent-waw2-1.cdninstagram.com&_nc_cat=108&_nc_oc=Q6cZ2gEolgfN40mA5u6Nbq1rPm1-oYEMe-2lnW26ebuO6ouLH-6eJcqBW25hQVpbI2O6dxo&_nc_ohc=RUx0IRjTTiwQ7kNvwFXKsTP&_nc_gid=nYmOEPG5oYMyrzf6VVbj7A&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQEz431Ka22LEUoaYSC2YRYqsdLeIgQiQKrlbWSONUtb6g&oe=6A84A678&_nc_sid=c6f216",
          "is_verified": false,
          "id": "6255859251",
          "full_name": null,
          "is_mentionable": null,
          "is_private": null,
          "profile_pic_id": null,
          "latest_reel_media": null
        }
      },
      {
        "id": "18162236158415247",
        "text": "@albertusgal ortunya jg kena 45 kak ??",
        "ownerUsername": "dinaratripra",
        "ownerProfilePicUrl": "https://scontent-waw2-1.cdninstagram.com/v/t51.2885-19/428885362_374441691889799_2132980116582235024_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=scontent-waw2-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEolgfN40mA5u6Nbq1rPm1-oYEMe-2lnW26ebuO6ouLH-6eJcqBW25hQVpbI2O6dxo&_nc_ohc=7de9ZV0lCqEQ7kNvwFFiip2&_nc_gid=nYmOEPG5oYMyrzf6VVbj7A&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQGHJeFrbUhIhCbFLZJ2gfLbli18QLKNvXNF9m20S1GODA&oe=6A84AB17&_nc_sid=c6f216",
        "timestamp": "2026-08-07T15:46:58.000Z",
        "repliesCount": null,
        "replies": null,
        "likesCount": 0,
        "owner": {
          "username": "dinaratripra",
          "profile_pic_url": "https://scontent-waw2-1.cdninstagram.com/v/t51.2885-19/428885362_374441691889799_2132980116582235024_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4xMDgwLmMyIn0&_nc_ht=scontent-waw2-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEolgfN40mA5u6Nbq1rPm1-oYEMe-2lnW26ebuO6ouLH-6eJcqBW25hQVpbI2O6dxo&_nc_ohc=7de9ZV0lCqEQ7kNvwFFiip2&_nc_gid=nYmOEPG5oYMyrzf6VVbj7A&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQGHJeFrbUhIhCbFLZJ2gfLbli18QLKNvXNF9m20S1GODA&oe=6A84AB17&_nc_sid=c6f216",
          "is_verified": false,
          "id": "4826549407",
          "full_name": null,
          "is_mentionable": null,
          "is_private": null,
          "profile_pic_id": null,
          "latest_reel_media": null
        }
      },
      {
        "id": "18106765067333078",
        "text": "@albertusgal makasi infonya lur",
        "ownerUsername": "jogjalur",
        "ownerProfilePicUrl": "https://scontent-waw2-2.cdninstagram.com/v/t51.82787-19/660819202_18069905933352542_7301423639684390727_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby41OTEuYzIifQ&_nc_ht=scontent-waw2-2.cdninstagram.com&_nc_cat=102&_nc_oc=Q6cZ2gEolgfN40mA5u6Nbq1rPm1-oYEMe-2lnW26ebuO6ouLH-6eJcqBW25hQVpbI2O6dxo&_nc_ohc=QxUWbl1IOIAQ7kNvwFfeQCK&_nc_gid=nYmOEPG5oYMyrzf6VVbj7A&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQGHCOPlct3egoK9yU1SHm6Zwy7bpS70s5L4YTPTz5vrnw&oe=6A849577&_nc_sid=c6f216",
        "timestamp": "2026-08-08T08:32:38.000Z",
        "repliesCount": null,
        "replies": null,
        "likesCount": 0,
        "owner": {
          "username": "jogjalur",
          "profile_pic_url": "https://scontent-waw2-2.cdninstagram.com/v/t51.82787-19/660819202_18069905933352542_7301423639684390727_n.jpg?stp=dst-jpg_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby41OTEuYzIifQ&_nc_ht=scontent-waw2-2.cdninstagram.com&_nc_cat=102&_nc_oc=Q6cZ2gEolgfN40mA5u6Nbq1rPm1-oYEMe-2lnW26ebuO6ouLH-6eJcqBW25hQVpbI2O6dxo&_nc_ohc=QxUWbl1IOIAQ7kNvwFfeQCK&_nc_gid=nYmOEPG5oYMyrzf6VVbj7A&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQGHCOPlct3egoK9yU1SHm6Zwy7bpS70s5L4YTPTz5vrnw&oe=6A849577&_nc_sid=c6f216",
          "is_verified": false,
          "id": "40702176541",
          "full_name": null,
          "is_mentionable": null,
          "is_private": null,
          "profile_pic_id": null,
          "latest_reel_media": null
        }
      }
    ],
    "dimensionsHeight": 1350,
    "dimensionsWidth": 1080,
    "displayUrl": "https://scontent-waw2-1.cdninstagram.com/v/t51.82787-15/764800395_18547284985074731_2507257377805797516_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=scontent-waw2-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEolgfN40mA5u6Nbq1rPm1-oYEMe-2lnW26ebuO6ouLH-6eJcqBW25hQVpbI2O6dxo&_nc_ohc=lY0Mt5_Z3vIQ7kNvwGjB1zw&_nc_gid=nYmOEPG5oYMyrzf6VVbj7A&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQF7_hrJC-dLWflxe54KL7afvSCFQAa66GcTGzc3HXmXBQ&oe=6A8491A7&_nc_sid=c6f216",
    "images": [],
    "alt": "Photo by Pakuwon Mall Jogja on August 03, 2026. May be an image of text that says 'PAKUWON MALL JOGJA VOL. 2 Fomected သျပတော PLAY WITH US HOBBy & TOYS EXPO 7- 7-16 16 AUG GRAND ATRIUM ET SUPPORTED SUPPORTEDBV BVI Le Mir Minerale PLAYGROUND DIECAST RC EXCAVATOR & ADVENTURE •RACE SIMULATOR COLLABORATION ΗΣΤΗ: Selaras ImiiNa PLAY WIN! Esimsports. SVUYUE PAKUWONGROUP PAKUWON GROUP paluwenmalljogja.com 2 @pakuwonmalljogja @pakuwonmaljogja 0274 2831 888'.",
    "likesCount": 82,
    "timestamp": "2026-08-04T05:21:00.000Z",
    "childPosts": [],
    "ownerFullName": "Pakuwon Mall Jogja",
    "ownerUsername": "pakuwonmall.jogja",
    "ownerId": "2237970730",
    "paidPartnership": false,
    "isPinned": true,
    "isCommentsDisabled": false,
    "inputUrl": "https://www.instagram.com/pakuwonmall.jogja/",
    "originalWidth": 1350,
    "originalHeight": 1688
  },
  {
    "id": "3953858113186553813",
    "type": "Image",
    "shortCode": "Dbe7QFox9_V",
    "caption": "Agustus makin seru di Pakuwon Mall Jogja 😍✨\n\nCatat tanggalnya dan jangan sampai ketinggalan berbagai event seru sepanjang bulan ini! \n\nYuk, ajak keluarga dan temanmu menikmati berbagai promo, pameran, dan event seru hanya di Pakuwon Mall Jogja ❤️",
    "hashtags": [],
    "mentions": [],
    "url": "https://www.instagram.com/p/Dbe7QFox9_V/",
    "commentsCount": 0,
    "firstComment": "",
    "latestComments": [],
    "dimensionsHeight": 1349,
    "dimensionsWidth": 1080,
    "displayUrl": "https://scontent-waw2-1.cdninstagram.com/v/t51.82787-15/762404551_18546413440074731_2761473844030928548_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=scontent-waw2-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gEQdOUMsjRtkmueJwC36nb71qJlsZWcuPKrJLVy4RNIF29TQv1pjfvvdFf8NoFvezQ&_nc_ohc=xZgePBoSreoQ7kNvwEtNa9l&_nc_gid=7s-uXgWEFB56-Q2KikLD3g&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQFZwKnkbOsBFD9mcRtRk2UmUiRp8Bnv_XpmyP8azLz1Tw&oe=6A849580&_nc_sid=c6f216",
    "images": [],
    "alt": "Photo by Pakuwon Mall Jogja on July 31, 2026. May be an image of poster, magazine and text.",
    "likesCount": 48,
    "timestamp": "2026-08-01T03:58:43.000Z",
    "childPosts": [],
    "ownerFullName": "Pakuwon Mall Jogja",
    "ownerUsername": "pakuwonmall.jogja",
    "ownerId": "2237970730",
    "paidPartnership": false,
    "isPinned": true,
    "isCommentsDisabled": false,
    "inputUrl": "https://www.instagram.com/pakuwonmall.jogja/",
    "originalWidth": 1350,
    "originalHeight": 1687
  },
  {
    "id": "3963391870218908290",
    "type": "Sidecar",
    "shortCode": "DcAy-gyEbKC",
    "caption": "🇮🇩 MERDEKA BELANJA, MERDEKA HEMAT! 🇮🇩\n\nRayakan kemerdekaan dengan promo spesial dari JETE! 🔥\nNikmati DISKON 50% OFF ALL ITEMS khusus produk JETE! 🎉\n\n🗓️ 15–17 Agustus 2026\n\nSaatnya lengkapi kebutuhan gadget kamu dengan harga lebih hemat! ⚡\nJangan sampai kelewatan, cuma 3 hari!\n\n#JETE #JETEIndonesia #MerdekaBelanja #MerdekaHemat #PromoJETE",
    "hashtags": [
      "JETE",
      "JETEIndonesia",
      "MerdekaBelanja",
      "MerdekaHemat",
      "PromoJETE"
    ],
    "mentions": [],
    "url": "https://www.instagram.com/p/DcAy-gyEbKC/",
    "commentsCount": 0,
    "firstComment": "",
    "latestComments": [],
    "dimensionsHeight": 1553,
    "dimensionsWidth": 1179,
    "displayUrl": "https://scontent-lhr6-1.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwFtuwYk&_nc_oc=AdrowpVj33noF4D7nihzf8evGN26x3yqLxuQ3zPisHQf2WwHCZHMq-5onKBhLse9E-o&_nc_zt=23&_nc_ht=scontent-lhr6-1.cdninstagram.com&_nc_gid=potClGfxf8EvHru1lZ0QvQ&_nc_ss=7ca8c&oh=00_AQEvdtuxVm9vMUaDpAjv3QSG6frxi8V1jw4Qu4adpfotIQ&oe=6A84A99B",
    "images": [
      "https://scontent-lhr6-1.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwFtuwYk&_nc_oc=AdrowpVj33noF4D7nihzf8evGN26x3yqLxuQ3zPisHQf2WwHCZHMq-5onKBhLse9E-o&_nc_zt=23&_nc_ht=scontent-lhr6-1.cdninstagram.com&_nc_gid=potClGfxf8EvHru1lZ0QvQ&_nc_ss=7ca8c&oh=00_AQEvdtuxVm9vMUaDpAjv3QSG6frxi8V1jw4Qu4adpfotIQ&oe=6A84A99B",
      "https://scontent-lhr6-1.cdninstagram.com/v/t51.82787-15/774126206_18549987868074731_4694917732896217054_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5MTczMDYwMjIyNjk5MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kCq2k3DBkGkQ7kNvwEtN4_W&_nc_oc=AdomLgUTHAi9HsBX0H_gtK6JacE3qlQB-2RC1KhHtayf109yI1TdOcp_i9tja-YjN4Y&_nc_zt=23&_nc_ht=scontent-lhr6-1.cdninstagram.com&_nc_gid=potClGfxf8EvHru1lZ0QvQ&_nc_ss=7ca8c&oh=00_AQFqONKf4t2TPVskQUv2l-Ca7QbofrTT4e4MBPRvagx6sA&oe=6A84A9B3"
    ],
    "alt": "Photo by Pakuwon Mall Jogja on August 14, 2026.",
    "likesCount": 0,
    "timestamp": "2026-08-14T07:39:10.000Z",
    "childPosts": [
      {
        "id": "3963391725485245627",
        "type": "Image",
        "caption": "",
        "hashtags": [],
        "mentions": [],
        "url": "https://www.instagram.com/p/DcAy8Z_RUS7/",
        "commentsCount": 0,
        "firstComment": "",
        "latestComments": [],
        "dimensionsHeight": 1553,
        "dimensionsWidth": 1179,
        "displayUrl": "https://scontent-lhr6-1.cdninstagram.com/v/t51.82787-15/770719784_18549987859074731_3723800803113725787_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=108&ig_cache_key=Mzk2MzM5MTcyNTQ4NTI0NTYyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_QNGYe0U20IQ7kNvwFtuwYk&_nc_oc=AdrowpVj33noF4D7nihzf8evGN26x3yqLxuQ3zPisHQf2WwHCZHMq-5onKBhLse9E-o&_nc_zt=23&_nc_ht=scontent-lhr6-1.cdninstagram.com&_nc_gid=potClGfxf8EvHru1lZ0QvQ&_nc_ss=7ca8c&oh=00_AQEvdtuxVm9vMUaDpAjv3QSG6frxi8V1jw4Qu4adpfotIQ&oe=6A84A99B",
        "images": [],
        "alt": "Photo by Pakuwon Mall Jogja on August 14, 2026. May be an image of speaker, phone, wrist watch, digital audio player, camcorder, projector, camera, screen and text that says 'PAKUWONMALI MALL JOGJA ITE 100 ไมั JETE - JETE EEEE JETE'.",
        "likesCount": 0,
        "timestamp": "2026-08-14T07:39:10.000Z",
        "childPosts": [],
        "ownerId": "17841402241909746",
        "shortCode": "DcAy8Z_RUS7",
        "originalHeight": 1553,
        "originalWidth": 1179,
        "ownerUsername": "pakuwonmall.jogja"
      },
      {
        "id": "3963391730602226991",
        "type": "Image",
        "caption": "",
        "hashtags": [],
        "mentions": [],
        "url": "https://www.instagram.com/p/DcAy8ewRDUv/",
        "commentsCount": 0,
        "firstComment": "",
        "latestComments": [],
        "dimensionsHeight": 1419,
        "dimensionsWidth": 1080,
        "displayUrl": "https://scontent-lhr6-1.cdninstagram.com/v/t51.82787-15/774126206_18549987868074731_4694917732896217054_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=103&ig_cache_key=Mzk2MzM5MTczMDYwMjIyNjk5MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kCq2k3DBkGkQ7kNvwEtN4_W&_nc_oc=AdomLgUTHAi9HsBX0H_gtK6JacE3qlQB-2RC1KhHtayf109yI1TdOcp_i9tja-YjN4Y&_nc_zt=23&_nc_ht=scontent-lhr6-1.cdninstagram.com&_nc_gid=potClGfxf8EvHru1lZ0QvQ&_nc_ss=7ca8c&oh=00_AQFqONKf4t2TPVskQUv2l-Ca7QbofrTT4e4MBPRvagx6sA&oe=6A84A9B3",
        "images": [],
        "alt": "Photo by Pakuwon Mall Jogja on August 14, 2026. May be an image of text that says 'JETE DORAN. GADGET MERDEKA BELANJA MERDEKAHEMAT HEMAT Diskon 50% % OFF E Periode 15, Periode:15,16,17Agustus2026 16, 17 Agustus 2026 JETE JSTE *Berlaku di JETE Official Store dan Doran Gadget Store *Khusus Produk susProdukJETE JETE'.",
        "likesCount": 0,
        "timestamp": "2026-08-14T07:39:10.000Z",
        "childPosts": [],
        "ownerId": "17841402241909746",
        "shortCode": "DcAy8ewRDUv",
        "originalHeight": 1419,
        "originalWidth": 1080,
        "ownerUsername": "pakuwonmall.jogja"
      }
    ],
    "ownerFullName": "Pakuwon Mall Jogja",
    "ownerUsername": "pakuwonmall.jogja",
    "ownerId": "2237970730",
    "paidPartnership": false,
    "isCommentsDisabled": false,
    "inputUrl": "https://www.instagram.com/pakuwonmall.jogja/",
    "originalHeight": 1553,
    "originalWidth": 1179,
    "productType": "carousel_container"
  },
  {
    "id": "3963390113577264213",
    "type": "Sidecar",
    "shortCode": "DcAyk8yEWRV",
    "caption": "🇮🇩 MAKAN STEAK + MINUM DI @holycow_id CUMA 81 RIBUAN 🇮🇩\n\n‼️ *PROMO KEMERDEKAAN* ‼️\n\n1 Holychicken! Steak Series + 1 Flavored Tea\n\n*CUMA Rp 81.000++*\n\n_(Pilihan menu: Holychicken! Steak, African Chicken Steak dan Piccata Chicken Steak)_\n\n🗓 *16 - 17 Agustus 2026*\n\n Ajak teman makanmu & langsung aja ke @holycow_id TKP Yogyakarta Lantai 2 & nikmatin promonya sebelum kehabisan!🔥\n \nUntuk info lainnya cek @holycow_id ‼️\n\nSyarat & Ketentuan:\n- Hanya berlaku untuk transaksi Dine In\n- Berlaku hanya pada pilihan menu Holychicken! steak, African Chicken Steak & Piccata Steak saja.\n- Harga belum termasuk Tax & Service\n- Hanya berlaku pada tanggal 16 - 17 Agustus 2026\n- Tidak dapat digabungkan dengan promo lain & tidak berlaku untuk pembayaran dengan voucher\n- Berlaku di semua TKP Steak Hotel by HOLYCOW! Termasuk Steak Hotel by HOLYCOW! Express, (Tidak berlaku di TKP Bandara Halim Perdana Kusuma)\"\n\n#pakuwonmalljogja",
    "hashtags": [
      "pakuwonmalljogja"
    ],
    "mentions": [
      "holycow_id"
    ],
    "url": "https://www.instagram.com/p/DcAyk8yEWRV/",
    "commentsCount": 0,
    "firstComment": "",
    "latestComments": [],
    "dimensionsHeight": 1351,
    "dimensionsWidth": 1080,
    "displayUrl": "https://scontent-icn2-1.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=scontent-icn2-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gFnFh_KlRGmplT3V1_4EIe_jBlmg4QlMyhQ3iAfSb-RID_qRZe7BOwI0SxIvN0v0Xw&_nc_ohc=W1VcytymR_gQ7kNvwEK9eg7&_nc_gid=kI3Q38Ds7Blj1_ShZVtl1w&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQFOBWtQAr1fBTDv3q8GfUUpyaYIqVcHqE7uNxZ-onoKOA&oe=6A84A534&_nc_sid=c6f216",
    "images": [
      "https://scontent-icn2-1.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=scontent-icn2-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gFnFh_KlRGmplT3V1_4EIe_jBlmg4QlMyhQ3iAfSb-RID_qRZe7BOwI0SxIvN0v0Xw&_nc_ohc=W1VcytymR_gQ7kNvwEK9eg7&_nc_gid=kI3Q38Ds7Blj1_ShZVtl1w&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQFOBWtQAr1fBTDv3q8GfUUpyaYIqVcHqE7uNxZ-onoKOA&oe=6A84A534&_nc_sid=c6f216",
      "https://scontent-icn2-1.cdninstagram.com/v/t51.82787-15/774184470_18549987364074731_6828912551799453495_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=scontent-icn2-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gFnFh_KlRGmplT3V1_4EIe_jBlmg4QlMyhQ3iAfSb-RID_qRZe7BOwI0SxIvN0v0Xw&_nc_ohc=4KKKNZ7wuooQ7kNvwFhTcwY&_nc_gid=kI3Q38Ds7Blj1_ShZVtl1w&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQFdQ42L446-Y_sBW8yTdAU0trrWntyZPYWVXPrJbpRN0g&oe=6A84A1DC&_nc_sid=c6f216"
    ],
    "alt": "Photo by Pakuwon Mall Jogja on August 14, 2026.",
    "likesCount": 1,
    "timestamp": "2026-08-14T07:35:41.000Z",
    "childPosts": [
      {
        "id": "3963389966914225522",
        "type": "Image",
        "caption": "",
        "hashtags": [],
        "mentions": [],
        "url": "https://www.instagram.com/p/DcAyi0MRQVy/",
        "commentsCount": 0,
        "firstComment": "",
        "latestComments": [],
        "dimensionsHeight": 1351,
        "dimensionsWidth": 1080,
        "displayUrl": "https://scontent-icn2-1.cdninstagram.com/v/t51.82787-15/773950070_18549987349074731_3840514891962634551_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=scontent-icn2-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gFnFh_KlRGmplT3V1_4EIe_jBlmg4QlMyhQ3iAfSb-RID_qRZe7BOwI0SxIvN0v0Xw&_nc_ohc=W1VcytymR_gQ7kNvwEK9eg7&_nc_gid=kI3Q38Ds7Blj1_ShZVtl1w&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQFOBWtQAr1fBTDv3q8GfUUpyaYIqVcHqE7uNxZ-onoKOA&oe=6A84A534&_nc_sid=c6f216",
        "images": [],
        "alt": "Photo by Pakuwon Mall Jogja on August 14, 2026. May be an image of chow mein, fried rice, noodles and text.",
        "likesCount": null,
        "timestamp": null,
        "childPosts": [],
        "ownerId": null,
        "shortCode": "DcAyi0MRQVy",
        "originalWidth": 1279,
        "originalHeight": 1600
      },
      {
        "id": "3963389973591710994",
        "type": "Image",
        "caption": "",
        "hashtags": [],
        "mentions": [],
        "url": "https://www.instagram.com/p/DcAyi6aR10S/",
        "commentsCount": 0,
        "firstComment": "",
        "latestComments": [],
        "dimensionsHeight": 1351,
        "dimensionsWidth": 1080,
        "displayUrl": "https://scontent-icn2-1.cdninstagram.com/v/t51.82787-15/774184470_18549987364074731_6828912551799453495_n.jpg?stp=dst-jpg_e35_p1080x1080_sh2.08_tt6&_nc_ht=scontent-icn2-1.cdninstagram.com&_nc_cat=111&_nc_oc=Q6cZ2gFnFh_KlRGmplT3V1_4EIe_jBlmg4QlMyhQ3iAfSb-RID_qRZe7BOwI0SxIvN0v0Xw&_nc_ohc=4KKKNZ7wuooQ7kNvwFhTcwY&_nc_gid=kI3Q38Ds7Blj1_ShZVtl1w&edm=ADp7STQBAAAA&ccb=7-5&oh=00_AQFdQ42L446-Y_sBW8yTdAU0trrWntyZPYWVXPrJbpRN0g&oe=6A84A1DC&_nc_sid=c6f216",
        "images": [],
        "alt": "Photo by Pakuwon Mall Jogja on August 14, 2026. May be an image of text that says 'oycω NOTEL BY STEAK HALAL PROMO KEMERDEKAAN 1 HOLYCHICKEN! STEAK SERIES FLAVORED TEA RP 81.000 ++ CHICKEN PICCATA STEAK stenk HOL HOLYCHICKEN! STEAK AFRICAN CHICKEN STEAK 16-17 16-17AGUSTUS2026 - 17 AGUSTUS 2026 16 *Hara belum termasuk service charge *Htargabelumnenae & pajak www.holycowsteak.com Xo@halycow_id ® holycow_ic X'.",
        "likesCount": null,
        "timestamp": null,
        "childPosts": [],
        "ownerId": null,
        "shortCode": "DcAyi6aR10S",
        "originalWidth": 1279,
        "originalHeight": 1600
      }
    ],
    "ownerFullName": "Pakuwon Mall Jogja",
    "ownerUsername": "pakuwonmall.jogja",
    "ownerId": "2237970730",
    "paidPartnership": false,
    "isCommentsDisabled": false,
    "inputUrl": "https://www.instagram.com/pakuwonmall.jogja/",
    "originalWidth": 1279,
    "originalHeight": 1600
  }
]
```
