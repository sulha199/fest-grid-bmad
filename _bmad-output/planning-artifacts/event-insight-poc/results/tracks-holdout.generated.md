# Tracks experiment — gemini-3.5-flash-lite, 3 runs/post, 5 posts

- usable responses: 15/15
- fully correct runs (count in range, every expected track present, nothing fabricated, allAges right): 6/15
- runs with a fabricated number: 0/15
- runs with the right number of tracks: 15/15

| post | runs fully correct | tracks returned | misses (run 1) |
|---|:-:|---|---|
| htrk-badminton-u | 3/3 | 4, 4, 4 | — |
| htrk-lukis | 0/3 | 2, 2, 2 | no track matches {"ageMin":[3],"ageMax":[5]}; no track matches {"ageMin":[6],"ageMax":[12]} |
| htrk-renang | 0/3 | 3, 3, 3 | no track matches {"ageMin":[13],"ageMax":[15]}; no track matches {"ageMin":[16],"ageMax":[18]} |
| htrk-posyandu | 0/3 | 2, 2, 2 | no track matches {"ageMin":[10],"ageMax":[19]} |
| htrk-bazaar-trap | 3/3 | 1, 1, 1 | — |

## Raw tracks, run 1

**htrk-badminton-u** (allAges=false)
```json
[{"label":"U-13","ageMax":13,"lifeStages":["child","teen"],"genderFocus":"all"},{"label":"U-17","ageMax":17,"lifeStages":["teen"],"genderFocus":"all"},{"label":"Umum","lifeStages":["young_adult","adult"],"genderFocus":"all"},{"label":"Ganda Putri","lifeStages":["young_adult","adult","teen","senior"],"genderFocus":"women"}]
```
**htrk-lukis** (allAges=false)
```json
[{"label":"Kelas Balita","ageMin":3,"lifeStages":["early_childhood"],"genderFocus":"all"},{"label":"Kelas Anak","ageMin":6,"lifeStages":["child"],"genderFocus":"all"}]
```
**htrk-renang** (allAges=false)
```json
[{"label":"KU I (13–15 tahun)","ageMin":13,"lifeStages":["teen"],"genderFocus":"all"},{"label":"KU II (16–18 tahun)","ageMin":16,"lifeStages":["teen","young_adult"],"genderFocus":"all"},{"label":"Senior (19+ tahun)","ageMin":19,"lifeStages":["young_adult","adult","senior"],"genderFocus":"all"}]
```
**htrk-posyandu** (allAges=false)
```json
[{"label":"remaja usia 10–19 tahun","ageMin":10,"lifeStages":["teen"],"genderFocus":"all"},{"label":"lansia usia ≥ 60 tahun","ageMin":60,"lifeStages":["senior"],"genderFocus":"all"}]
```
**htrk-bazaar-trap** (allAges=true)
```json
[{"label":"Semua Usia","lifeStages":["early_childhood","child","teen","young_adult","adult","senior"],"genderFocus":"all"}]
```
