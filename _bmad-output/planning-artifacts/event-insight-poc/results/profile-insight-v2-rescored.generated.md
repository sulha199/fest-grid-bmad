# Profile insight (country + reach + time zone) — prompt v2, gemini-3.5-flash-lite, 3 runs/profile, 18 profiles (5 real, 13 synthetic)

- usable responses: 54/54

**Deterministic signals alone** (no model; 18 profiles): resolved 15/18 · **wrong country 0** · unresolved where a country was expected 0

**Deterministic time-zone signals alone** (no model, no reach gate): resolved 11/18 · **wrong zone 0** · unresolved where a zone was expected 0

**All profiles** (54 runs)
- model, raw — fully correct: 51/54 · **wrong country: 0/54** · country UNKNOWN where one was expected: 0/54 · reach right: 51/54 · areas right: 54/54 · **national/unspecified given a place: 0/54**
- model, guarded — fully correct: 51/54 · **wrong country: 0/54** · UNKNOWN where expected: 0/54 · guard actions fired: 0/54
- model claims a country that no deterministic signal supports: 0/54
- signals + guarded model — **wrong country: 0/54** · unresolved where a country was expected: 0/54
- **time zone** — model raw: **wrong 0/54** · UNKNOWN where expected 0/54 · model guarded: **wrong 0/54** · UNKNOWN where expected 0/54 · a zone the signals do not confirm: 3/54
- **time zone, signals + guarded model + reach gate** — **wrong 0/54** · unresolved where a zone was expected 0/54

**Real profiles** (15 runs)
- model, raw — fully correct: 15/15 · **wrong country: 0/15** · country UNKNOWN where one was expected: 0/15 · reach right: 15/15 · areas right: 15/15 · **national/unspecified given a place: 0/15**
- model, guarded — fully correct: 15/15 · **wrong country: 0/15** · UNKNOWN where expected: 0/15 · guard actions fired: 0/15
- model claims a country that no deterministic signal supports: 0/15
- signals + guarded model — **wrong country: 0/15** · unresolved where a country was expected: 0/15
- **time zone** — model raw: **wrong 0/15** · UNKNOWN where expected 0/15 · model guarded: **wrong 0/15** · UNKNOWN where expected 0/15 · a zone the signals do not confirm: 3/15
- **time zone, signals + guarded model + reach gate** — **wrong 0/15** · unresolved where a zone was expected 0/15

**Synthetic profiles** (39 runs)
- model, raw — fully correct: 36/39 · **wrong country: 0/39** · country UNKNOWN where one was expected: 0/39 · reach right: 36/39 · areas right: 39/39 · **national/unspecified given a place: 0/39**
- model, guarded — fully correct: 36/39 · **wrong country: 0/39** · UNKNOWN where expected: 0/39 · guard actions fired: 0/39
- model claims a country that no deterministic signal supports: 0/39
- signals + guarded model — **wrong country: 0/39** · unresolved where a country was expected: 0/39
- **time zone** — model raw: **wrong 0/39** · UNKNOWN where expected 0/39 · model guarded: **wrong 0/39** · UNKNOWN where expected 0/39 · a zone the signals do not confirm: 0/39
- **time zone, signals + guarded model + reach gate** — **wrong 0/39** · unresolved where a zone was expected 0/39

| profile | origin | signals | model country (run 1) | reach (runs) | reach areas (run 1) | combined country (run 1) | zone: signals → model (runs) → combined (run 1) | misses (run 1, guarded) |
|---|---|---|---|---|---|---|---|---|
| plazaambarrukmo | real | ID | ID, ID, ID | local, local, local | Yogyakarta | ID (signals+model) | Asia/Jakarta → Asia/Jakarta, Asia/Jakarta, Asia/Jakarta → Asia/Jakarta (text) | — |
| infoeventjogja | real | ID | ID, ID, ID | regional, regional, regional | Yogyakarta; Bantul; Sleman | ID (signals+model) | Asia/Jakarta → Asia/Jakarta, Asia/Jakarta, Asia/Jakarta → Asia/Jakarta (text) | — |
| wanitatamajogja | real | ID | ID, ID, ID | local, local, local | Yogyakarta | ID (signals+model) | weak → Asia/Jakarta, Asia/Jakarta, Asia/Jakarta → Asia/Jakarta (model) | — |
| pakuwonmall.jogja | real | ID | ID, ID, ID | local, local, local | Yogyakarta | ID (signals+model) | Asia/Jakarta → Asia/Jakarta, Asia/Jakarta, Asia/Jakarta → Asia/Jakarta (text) | — |
| chaanakyaekadantaolympiad | real | ID | ID, ID, ID | national, national, national | — | ID (signals+model) | multi-zone → UNKNOWN, UNKNOWN, UNKNOWN → unresolved (multi-zone) | — |
| syn-dinas-sleman | synthetic | ID | ID, ID, ID | local, local, local | Sleman | ID (signals+model) | Asia/Jakarta → Asia/Jakarta, Asia/Jakarta, Asia/Jakarta → Asia/Jakarta (text) | — |
| syn-telco-nasional | synthetic | ID | ID, ID, ID | national, national, national | — | ID (signals+model) | multi-zone → UNKNOWN, UNKNOWN, UNKNOWN → unresolved (multi-zone) | — |
| syn-kl-hall | synthetic | MY | MY, MY, MY | local, local, local | Kuala Lumpur | MY (signals+model) | Asia/Kuala_Lumpur → Asia/Kuala_Lumpur, Asia/Kuala_Lumpur, Asia/Kuala_Lumpur → Asia/Kuala_Lumpur (text) | — |
| syn-sg-makers | synthetic | SG | SG, SG, SG | local, local, local | Ubi | SG (signals+model) | Asia/Singapore → Asia/Singapore, Asia/Singapore, Asia/Singapore → Asia/Singapore (text) | — |
| syn-melb-indo | synthetic | AU | AU, AU, AU | regional, regional, regional | Victoria | AU (signals+model) | Australia/Melbourne → Australia/Melbourne, Australia/Melbourne, Australia/Melbourne → Australia/Melbourne (text) | — |
| syn-delhi-academy | synthetic | IN | IN, IN, IN | local, local, local | South Delhi; New Delhi | IN (signals+model) | Asia/Kolkata → Asia/Kolkata, Asia/Kolkata, Asia/Kolkata → Asia/Kolkata (text) | — |
| syn-global-coffee | synthetic | no-signal | UNKNOWN, UNKNOWN, UNKNOWN | local, unspecified, local | — | unresolved (no-evidence) | no-signal → UNKNOWN, UNKNOWN, UNKNOWN → unresolved (no-evidence) | reach local, expected unspecified |
| syn-empty | synthetic | no-signal | UNKNOWN, UNKNOWN, UNKNOWN | unspecified, unspecified, unspecified | — | unresolved (no-evidence) | no-signal → UNKNOWN, UNKNOWN, UNKNOWN → unresolved (no-evidence) | — |
| syn-canggu-yoga | synthetic | ID | ID, ID, ID | local, local, local | Canggu; Bali | ID (signals+model) | Asia/Makassar → Asia/Makassar, Asia/Makassar, Asia/Makassar → Asia/Makassar (text) | — |
| syn-johor-sukan | synthetic | MY | MY, MY, MY | local, local, local | Johor Bahru | MY (signals+model) | Asia/Kuala_Lumpur → Asia/Kuala_Lumpur, Asia/Kuala_Lumpur, Asia/Kuala_Lumpur → Asia/Kuala_Lumpur (text) | — |
| syn-java-bali-curator | synthetic | ID | ID, ID, ID | regional, regional, international | Jawa; Bali | ID (signals+model) | multi-zone → UNKNOWN, UNKNOWN, UNKNOWN → unresolved (multi-zone) | — |
| syn-jayapura-komunitas | synthetic | ID | ID, ID, ID | local, local, local | Jayapura | ID (signals+model) | Asia/Jayapura → Asia/Jayapura, Asia/Jayapura, Asia/Jayapura → Asia/Jayapura (text) | — |
| syn-warung-tanpa-kota | synthetic | no-signal | UNKNOWN, UNKNOWN, UNKNOWN | unspecified, local, local | — | unresolved (no-evidence) | no-signal → UNKNOWN, UNKNOWN, UNKNOWN → unresolved (no-evidence) | — |
