# Tracks experiment — gemini-3.5-flash-lite, 2 runs/post, 12 posts

- usable responses: 24/24
- fully correct runs (count in range, every expected track present, nothing fabricated, allAges right): 18/24
- runs with a fabricated number: 0/24
- runs with the right number of tracks: 24/24

| post | runs fully correct | tracks returned | misses (run 1) |
|---|:-:|---|---|
| lomba-mewarnai | 2/2 | 2, 2 | — |
| porseni-stikes | 2/2 | 3, 3 | — |
| fixture-drum-contest | 0/2 | 1, 1 | no track matches {"ageMin":[7],"ageMax":[16]} |
| ho-coding-camp | 2/2 | 1, 1 | — |
| ho-layang-layang | 2/2 | 3, 3 | — |
| syn-family-day | 2/2 | 1, 1 | — |
| syn-senam-lansia | 2/2 | 1, 1 | — |
| ho-srikandi-run | 2/2 | 1, 1 | — |
| trk-fun-run-categories | 0/2 | 4, 4 | no track matches {"ageMin":[6],"ageMax":[10]} |
| trk-kelas-musik | 0/2 | 3, 3 | no track matches {"ageMin":[5],"ageMax":[8]}; no track matches {"ageMin":[13],"ageMax":[17]} |
| trk-karya-tulis | 2/2 | 1, 2 | — |
| trk-debat | 2/2 | 1, 1 | — |

## Raw tracks, run 1

**lomba-mewarnai** (allAges=false)
```json
[{"label":"Kategori A: Paud /TK","lifeStages":["early_childhood"],"genderFocus":"all"},{"label":"Kategori B: 1 - 3 SD","lifeStages":["child"],"genderFocus":"all"}]
```
**porseni-stikes** (allAges=false)
```json
[{"label":"BASKET PUTRA 3x3","lifeStages":["young_adult","adult"],"genderFocus":"men"},{"label":"Ganda Putra","lifeStages":["young_adult","adult"],"genderFocus":"men"},{"label":"Ganda Campuran","lifeStages":["young_adult","adult"],"genderFocus":"all"}]
```
**fixture-drum-contest** (allAges=false)
```json
[{"label":"Usia 7-16 Tahun","ageMin":7,"lifeStages":["child","teen"],"genderFocus":"all"}]
```
**ho-coding-camp** (allAges=false)
```json
[{"label":"anak usia 8–12 tahun","ageMin":8,"ageMax":12,"lifeStages":["child"],"genderFocus":"all"}]
```
**ho-layang-layang** (allAges=false)
```json
[{"label":"Kategori anak","lifeStages":["child"],"genderFocus":"all"},{"label":"remaja","lifeStages":["teen"],"genderFocus":"all"},{"label":"dewasa","lifeStages":["adult"],"genderFocus":"all"}]
```
**syn-family-day** (allAges=false)
```json
[{"label":"Anak di bawah 12 tahun","ageMax":12,"lifeStages":["early_childhood","child"],"genderFocus":"all"}]
```
**syn-senam-lansia** (allAges=false)
```json
[{"label":"Lansia usia 60 tahun ke atas","ageMin":60,"lifeStages":["senior"],"genderFocus":"all"}]
```
**ho-srikandi-run** (allAges=true)
```json
[{"label":"SRIKANDI RUN 5K","lifeStages":["early_childhood","child","teen","young_adult","adult","senior"],"genderFocus":"women"}]
```
**trk-fun-run-categories** (allAges=false)
```json
[{"label":"Kids Dash 1K","ageMin":6,"lifeStages":["child"],"genderFocus":"all"},{"label":"5K Terbuka","ageMin":12,"lifeStages":["teen","young_adult","adult","senior"],"genderFocus":"all"},{"label":"10K Kompetitif","ageMin":17,"lifeStages":["teen","young_adult","adult","senior"],"genderFocus":"all"},{"label":"Master 10K","ageMin":45,"lifeStages":["adult","senior"],"genderFocus":"all"}]
```
**trk-kelas-musik** (allAges=false)
```json
[{"label":"Piano Anak (usia 5–8 tahun)","ageMin":5,"lifeStages":["early_childhood","child"],"genderFocus":"all"},{"label":"Piano Remaja (13–17 tahun)","ageMin":13,"lifeStages":["teen"],"genderFocus":"all"},{"label":"Kelas Dewasa Pemula","lifeStages":["adult"],"genderFocus":"all"}]
```
**trk-karya-tulis** (allAges=false)
```json
[{"label":"pelajar SMA/sederajat ATAU mahasiswa S1","lifeStages":["teen","young_adult"],"genderFocus":"all"}]
```
**trk-debat** (allAges=false)
```json
[{"label":"mahasiswa aktif, usia maksimal 25 tahun","ageMax":25,"lifeStages":["young_adult"],"genderFocus":"all"}]
```
