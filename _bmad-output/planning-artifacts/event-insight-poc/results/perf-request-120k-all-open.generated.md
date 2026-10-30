### bench120k, every event open (98k open): 120012 events, 90907 with something still open

**A. One Discovery page (limit 10, offset 0), every statement the resolver runs**

| request | statement | JIT on (ms) | JIT off (ms) |
|---|---|--:|--:|
| anonymous, as shipped (selects totalCount) | select b.oid, b.typarray
      from pg_c | 0.4 | 0.4 |
| anonymous, as shipped (selects totalCount) | events page | 1439.5 | 844.9 |
| anonymous, as shipped (selects totalCount) | schedules (IN batch) | 0.0 | 0.0 |
| anonymous, as shipped (selects totalCount) | count(*) | 276.1 | 302.0 |
| **anonymous, as shipped (selects totalCount)** | **4 statements, total** | **1716.0** | **1147.4** |
| anonymous, without totalCount | select b.oid, b.typarray
      from pg_c | 0.4 | 0.4 |
| anonymous, without totalCount | events page | 1505.0 | 891.6 |
| anonymous, without totalCount | schedules (IN batch) | 0.1 | 0.1 |
| **anonymous, without totalCount** | **3 statements, total** | **1505.5** | **892.1** |
| signed in, as shipped (selects totalCount) | select b.oid, b.typarray
      from pg_c | 0.5 | 0.5 |
| signed in, as shipped (selects totalCount) | user settings | 0.1 | 0.1 |
| signed in, as shipped (selects totalCount) | events page | 1977.3 | 1193.7 |
| signed in, as shipped (selects totalCount) | schedules (IN batch) | 0.1 | 0.1 |
| signed in, as shipped (selects totalCount) | count(*) | 336.4 | 254.6 |
| **signed in, as shipped (selects totalCount)** | **5 statements, total** | **2314.4** | **1448.8** |
| signed in, without totalCount | select b.oid, b.typarray
      from pg_c | 0.3 | 0.4 |
| signed in, without totalCount | user settings | 0.0 | 0.0 |
| signed in, without totalCount | events page | 2083.4 | 1100.7 |
| signed in, without totalCount | schedules (IN batch) | 0.0 | 0.0 |
| **signed in, without totalCount** | **4 statements, total** | **2083.8** | **1101.2** |

**B. Response size, 10 events (the real GraphQL JSON)**

| shape | bytes | per event |
|---|--:|--:|
| full card (the shared GetEvents fields) | 8317 | 832 |
| ids only | 506 | 51 |

**C. "Ids first, hydrate by id" using only code that exists today**

| step (signed in) | rows | JIT on (ms) | JIT off (ms) | response bytes |
|---|--:|--:|--:|--:|
| ids only, limit 10 (today's order) | 10 | 1638.9 | 991.4 | 506 |
| ids only, limit 200 (today's order) | 200 | 1484.0 | 951.1 | 9246 |
| ids only, limit 1000 (today's order) | 1000 | 1639.2 | 960.6 | 46046 |
| hydrate 10 ids by `id in [...]` (the Favorites path) | 10 | 0.9 | 0.7 | 8299 |
