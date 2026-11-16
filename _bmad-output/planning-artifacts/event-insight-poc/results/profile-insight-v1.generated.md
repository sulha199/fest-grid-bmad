# Profile insight (country + reach) — prompt v1, gemini-3.5-flash-lite, 3 runs/profile, 16 profiles (5 real, 11 synthetic)

- usable responses: 48/48

**Deterministic signals alone** (no model; 16 profiles): resolved 13/16 · **wrong country 0** · unresolved where a country was expected 0

**All profiles** (48 runs)
- model, raw — fully correct: 47/48 · **wrong country: 0/48** · country UNKNOWN where one was expected: 0/48 · reach right: 47/48 · areas right: 48/48 · **national/unspecified given a place: 0/48**
- model, guarded — fully correct: 47/48 · **wrong country: 0/48** · UNKNOWN where expected: 0/48 · guard actions fired: 0/48
- model claims a country that no deterministic signal supports: 0/48
- signals + guarded model — **wrong country: 0/48** · unresolved where a country was expected: 0/48

**Real profiles** (15 runs)
- model, raw — fully correct: 15/15 · **wrong country: 0/15** · country UNKNOWN where one was expected: 0/15 · reach right: 15/15 · areas right: 15/15 · **national/unspecified given a place: 0/15**
- model, guarded — fully correct: 15/15 · **wrong country: 0/15** · UNKNOWN where expected: 0/15 · guard actions fired: 0/15
- model claims a country that no deterministic signal supports: 0/15
- signals + guarded model — **wrong country: 0/15** · unresolved where a country was expected: 0/15

**Synthetic profiles** (33 runs)
- model, raw — fully correct: 32/33 · **wrong country: 0/33** · country UNKNOWN where one was expected: 0/33 · reach right: 32/33 · areas right: 33/33 · **national/unspecified given a place: 0/33**
- model, guarded — fully correct: 32/33 · **wrong country: 0/33** · UNKNOWN where expected: 0/33 · guard actions fired: 0/33
- model claims a country that no deterministic signal supports: 0/33
- signals + guarded model — **wrong country: 0/33** · unresolved where a country was expected: 0/33

| profile | origin | signals | model country (run 1) | reach (runs) | reach areas (run 1) | combined (run 1) | misses (run 1, guarded) |
|---|---|---|---|---|---|---|---|
| plazaambarrukmo | real | ID | ID, ID, ID | local, local, local | Yogyakarta | ID (signals+model) | — |
| infoeventjogja | real | ID | ID, ID, ID | regional, regional, regional | Yogyakarta; Jawa Tengah | ID (signals+model) | — |
| wanitatamajogja | real | ID | ID, ID, ID | local, local, local | Yogyakarta | ID (signals+model) | — |
| pakuwonmall.jogja | real | ID | ID, ID, ID | local, local, local | Jogja | ID (signals+model) | — |
| chaanakyaekadantaolympiad | real | ID | ID, ID, ID | national, national, national | — | ID (signals+model) | — |
| syn-dinas-sleman | synthetic | ID | ID, ID, ID | local, local, local | Kabupaten Sleman | ID (signals+model) | — |
| syn-telco-nasional | synthetic | ID | ID, ID, ID | national, national, national | — | ID (signals+model) | — |
| syn-kl-hall | synthetic | MY | MY, MY, MY | local, local, local | Kuala Lumpur | MY (signals+model) | — |
| syn-sg-makers | synthetic | SG | SG, SG, SG | local, local, local | Ubi | SG (signals+model) | — |
| syn-melb-indo | synthetic | AU | AU, AU, AU | regional, regional, regional | Victoria | AU (signals+model) | — |
| syn-delhi-academy | synthetic | IN | IN, IN, IN | local, local, local | South Delhi | IN (signals+model) | — |
| syn-global-coffee | synthetic | no-signal | UNKNOWN, UNKNOWN, UNKNOWN | unspecified, local, unspecified | — | unresolved (no-evidence) | — |
| syn-empty | synthetic | no-signal | UNKNOWN, UNKNOWN, UNKNOWN | unspecified, unspecified, unspecified | — | unresolved (no-evidence) | — |
| syn-canggu-yoga | synthetic | ID | ID, ID, ID | local, local, local | Canggu | ID (signals+model) | — |
| syn-johor-sukan | synthetic | MY | MY, MY, MY | local, local, local | Johor Bahru | MY (signals+model) | — |
| syn-warung-tanpa-kota | synthetic | no-signal | UNKNOWN, UNKNOWN, UNKNOWN | unspecified, local, local | — | unresolved (no-evidence) | — |
