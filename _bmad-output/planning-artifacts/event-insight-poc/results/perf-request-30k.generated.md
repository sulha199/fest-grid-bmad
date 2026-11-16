### bench30k: 30012 events, 22337 with something still open

**A. One Discovery page (limit 10, offset 0), every statement the resolver runs**

| request | statement | JIT on (ms) | JIT off (ms) |
|---|---|--:|--:|
| anonymous, as shipped (selects totalCount) | select b.oid, b.typarray
      from pg_c | 0.4 | 0.4 |
| anonymous, as shipped (selects totalCount) | events page | 930.3 | 203.6 |
| anonymous, as shipped (selects totalCount) | schedules (IN batch) | 0.0 | 0.0 |
| anonymous, as shipped (selects totalCount) | count(*) | 50.7 | 39.8 |
| **anonymous, as shipped (selects totalCount)** | **4 statements, total** | **981.4** | **243.8** |
| anonymous, without totalCount | select b.oid, b.typarray
      from pg_c | 0.4 | 0.6 |
| anonymous, without totalCount | events page | 884.7 | 194.2 |
| anonymous, without totalCount | schedules (IN batch) | 0.0 | 0.0 |
| **anonymous, without totalCount** | **3 statements, total** | **885.2** | **194.9** |
| signed in, as shipped (selects totalCount) | select b.oid, b.typarray
      from pg_c | 0.3 | 0.4 |
| signed in, as shipped (selects totalCount) | user settings | 0.1 | 0.0 |
| signed in, as shipped (selects totalCount) | events page | 244.8 | 167.1 |
| signed in, as shipped (selects totalCount) | schedules (IN batch) | 0.1 | 0.0 |
| signed in, as shipped (selects totalCount) | count(*) | 63.0 | 51.4 |
| **signed in, as shipped (selects totalCount)** | **5 statements, total** | **308.3** | **219.0** |
| signed in, without totalCount | user settings | 0.0 | 0.1 |
| signed in, without totalCount | events page | 232.1 | 188.0 |
| signed in, without totalCount | schedules (IN batch) | 0.1 | 0.1 |
| **signed in, without totalCount** | **3 statements, total** | **232.2** | **188.2** |

**B. Response size, 10 events (the real GraphQL JSON)**

| shape | bytes | per event |
|---|--:|--:|
| full card (the shared GetEvents fields) | 7948 | 795 |
| ids only | 506 | 51 |

**C. "Ids first, hydrate by id" using only code that exists today**

| step (signed in) | rows | JIT on (ms) | JIT off (ms) | response bytes |
|---|--:|--:|--:|--:|
| ids only, limit 10 (today's order) | 10 | 210.8 | 163.6 | 506 |
| ids only, limit 200 (today's order) | 200 | 219.2 | 188.8 | 9246 |
| ids only, limit 1000 (today's order) | 1000 | 267.1 | 164.8 | 46046 |
| hydrate 10 ids by `id in [...]` (the Favorites path) | 10 | 0.3 | 0.3 | 7930 |
