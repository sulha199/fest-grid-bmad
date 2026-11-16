# Area kinds, qualifiers, coverage and heading roles — gemini-3.5-flash-lite, 2 runs per case (A: 18 posts, B: 8 roundups)

Gold labels are mine; membership graded only for Jabodetabek, Java, Kartamantul, DIY + Jawa Tengah. Small, hand-written, one labeller.

## A. Audience phrases

| case | gold kind | gold qualifier | model kind (runs) | model qualifier (runs) | members (recall / extras / unresolved) |
|---|---|---|---|---|---|
| jabodetabek (aggregate across 3 provinces) | metro_area | only | metro_area ; metro_area | only ; only | 6/9 / +0 / 0 ; 6/9 / +0 / 0 |
| pulau-jawa (island = 6 provinces) | island | only | island ; island | only ; only | 6/6 / +0 / 0 ; 6/6 / +0 / 0 |
| jogja-sekitarnya (qualifier) | admin_unit | and_surroundings | admin_unit ; admin_unit | and_surroundings ; and_surroundings | — |
| solo-raya (Raya = metro area) | metro_area | only | metro_area ; metro_area | only ; only | — |
| malang-raya (Raya = metro area) | metro_area | only | metro_area ; metro_area | only ; only | — |
| kartamantul (acronym metro area) | metro_area | only | metro_area ; metro_area | only ; only | 3/3 / +0 / 0 ; 3/3 / +0 / 0 |
| diy-jateng (two provinces) | admin_unit | only | admin_unit+admin_unit ; admin_unit+admin_unit | and_surroundings+only ; only+only | 2/2 / +0 / 0 ; 2/2 / +0 / 0 |
| bali-lombok (province + island) | admin_unit+island | only | admin_unit+island ; admin_unit+island | only+only ; only+only | — |
| indonesia-timur (region) | region | only | region ; region | only ; only | — |
| asia-tenggara (cross-border region) | region | only | region ; region | only ; only | — |
| seluruh-indonesia (country) | country | only | country ; country | only ; only | — |
| kota-batu (city) | admin_unit | only | admin_unit ; admin_unit | only ; only | — |
| kecamatan (district level) | admin_unit | only | admin_unit ; admin_unit | only ; only | — |
| jawa-selatan (part of an island) | island | part_of | island ; island | part_of ; part_of | — |
| pantura (informal region) | region | only | region ; region | only ; only | — |
| bandung-raya (Raya) | metro_area | only | metro_area ; metro_area | only ; only | — |
| jogja-bare (ambiguous: city or province) | admin_unit | only | admin_unit ; admin_unit | only ; only | — |
| gerbangkertosusila (acronym metro area) | metro_area | only | metro_area ; metro_area | only ; only | — |

- kind right (every gold kind present): 36/36 runs
- qualifier right: 35/36 runs
- membership recall where graded: 92% over 8 runs

## B. Places in a roundup heading

| case | gold | model (runs) | verdict (runs) |
|---|---|---|---|
| agenda-jogja (coverage) | Jogja:events_located_in | Jogja:events_located_in ; Jogja:events_located_in | right ; right |
| event-bandung (coverage) | Bandung:events_located_in | Bandung:events_located_in ; Bandung:events_located_in | right ; right |
| java-jazz (brand: must not become Java the island) | Java:brand_or_name | Java:brand_or_name ; Java:brand_or_name | right ; right |
| bali-united (club names) | Bali:brand_or_name, Bandung:brand_or_name | Bali:brand_or_name, Bandung:brand_or_name ; Bali:brand_or_name, Bandung:brand_or_name | right ; right |
| wisata-jogja-jakarta (place of events differs from audience) | Jogja:events_located_in, Jakarta:audience | Jogja:events_located_in, Jakarta:audience ; Jogja:events_located_in, Jakarta:audience | right ; right |
| no-place (no place in the heading; items in three cities must not leak) | none | — ; — | right ; right |
| jabodetabek-konser (aggregate heading; item 3 sits outside it) | Jabodetabek:events_located_in | Jabodetabek:events_located_in ; Jabodetabek:events_located_in | right ; right |
| online-national (national/online, no place) | none | — ; — | right ; right |

- heading read fully right: 16/16 runs; runs with a place the gold does not list (a leak from the items or an extra): 0/16
