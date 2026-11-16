# Audience-area experiment — prompt v1, set holdout, gemini-3.5-flash-lite, 3 runs/post, 6 posts

- usable responses: 18/18

**All posts** (18 runs)
- fully correct: 12/18
- geoScope right: 15/18
- every expected audience area found with an accepted basis: 15/18
- **venue-derived area on a nationwide/international event: 0/18**
- **forbidden area (venue / account-name / artist-origin leak): 0/18**
- venue area added next to a stated area: 0/18
- stated area not in the post text: 0/18

**Posts written for this experiment (unseen)** (18 runs)
- fully correct: 12/18
- geoScope right: 15/18
- every expected audience area found with an accepted basis: 15/18
- **venue-derived area on a nationwide/international event: 0/18**
- **forbidden area (venue / account-name / artist-origin leak): 0/18**
- venue area added next to a stated area: 0/18
- stated area not in the post text: 0/18

**Posts re-used from the first study (cald-conference was a known failure)** (0 runs)
- fully correct: 0/0
- geoScope right: 0/0
- every expected audience area found with an accepted basis: 0/0
- **venue-derived area on a nationwide/international event: 0/0**
- **forbidden area (venue / account-name / artist-origin leak): 0/0**
- venue area added next to a stated area: 0/0
- stated area not in the post text: 0/0

| post | fully correct | scope | areas returned (run 1) | misses (run 1) |
|---|:-:|---|---|---|
| hd-catur-nasional | 3/3 | national, national, national | — | — |
| hd-pameran-umum | 3/3 | city, city, city | Yogyakarta (venue) | — |
| hd-prawirotaman | 0/3 | venue_local, venue_local, venue_local | Prawirotaman (venue) | missing yogyakarta (venue); got [Prawirotaman:venue] |
| hd-layang-bantul | 3/3 | region, region, region | Kabupaten Bantul (stated) | — |
| hd-no-place-curator | 0/3 | national, national, national | — | scope=national, accept unspecified|online |
| hd-olimpiade-nasional | 3/3 | national, national, national | — | — |
