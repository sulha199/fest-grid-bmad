# Audience-area experiment — gemini-3.5-flash-lite, 3 runs/post, 20 posts

- usable responses: 60/60

**All posts** (60 runs)
- fully correct: 50/60
- geoScope right: 56/60
- every expected audience area found with an accepted basis: 52/60
- **venue-derived area on a nationwide/international event: 0/60**
- **forbidden area (venue / account-name / artist-origin leak): 0/60**
- venue area added next to a stated area: 0/60
- stated area not in the post text: 0/60

**Posts written for this experiment (unseen)** (36 runs)
- fully correct: 31/36
- geoScope right: 34/36
- every expected audience area found with an accepted basis: 33/36
- **venue-derived area on a nationwide/international event: 0/36**
- **forbidden area (venue / account-name / artist-origin leak): 0/36**
- venue area added next to a stated area: 0/36
- stated area not in the post text: 0/36

**Posts re-used from the first study (cald-conference was a known failure)** (24 runs)
- fully correct: 19/24
- geoScope right: 22/24
- every expected audience area found with an accepted basis: 19/24
- **venue-derived area on a nationwide/international event: 0/24**
- **forbidden area (venue / account-name / artist-origin leak): 0/24**
- venue area added next to a stated area: 0/24
- stated area not in the post text: 0/24

| post | fully correct | scope | areas returned (run 1) | misses (run 1) |
|---|:-:|---|---|---|
| cald-conference † | 0/3 | international, international, international | — | missing asia (stated); got [] |
| futsal-mfc † | 3/3 | region, region, region | DIY (stated); Jawa Tengah (stated) | — |
| syn-pameran-origin † | 1/3 | national, city, national | — | scope=national, accept city|venue_local · missing jakarta (stated|venue); got [] |
| syn-webinar-nasional † | 3/3 | national, national, national | — | — |
| ho-layang-layang † | 3/3 | region, region, region | Jawa (stated); Bali (stated) | — |
| uss-market † | 3/3 | city, city, city | Yogyakarta (stated) | — |
| syn-expat-bali † | 3/3 | venue_local, venue_local, venue_local | Canggu (venue) | — |
| lomba-mewarnai † | 3/3 | region, region, region | Jogja dan sekitarnya (stated) | — |
| ar-nasional-ugm | 3/3 | national, national, national | — | — |
| ar-bus-surabaya | 3/3 | region, region, region | Surabaya (stated); Sidoarjo (stated) | — |
| ar-guru-bantul | 3/3 | region, region, region | Bantul (stated) | — |
| ar-zoom-diy | 3/3 | region, region, region | DIY (stated) | — |
| ar-zoom-global | 3/3 | international, international, international | — | — |
| ar-tour | 3/3 | region, region, region | Jakarta (stated); Bandung (stated); Yogyakarta (stated) | — |
| ar-melbourne | 3/3 | region, region, region | Victoria (stated) | — |
| ar-no-area-curator | 1/3 | national, national, unspecified | — | scope=national, accept unspecified|online |
| ar-kotabaru | 0/3 | venue_local, venue_local, venue_local | Kotabaru (venue) | missing yogyakarta (venue); got [Kotabaru:venue] |
| ar-kulonprogo | 3/3 | region, region, region | Kulon Progo (stated) | — |
| ar-jabodetabek | 3/3 | region, region, region | Jabodetabek (stated) | — |
| ar-hybrid-jateng | 3/3 | region, region, region | Jawa Tengah (stated) | — |
