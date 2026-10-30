### bench300k (month-12 shape: 300k total, ~25k open): 300012 events, 22196 with something still open

**A. One Discovery page (limit 10, offset 0), every statement the resolver runs**

| request | statement | JIT on (ms) | JIT off (ms) |
|---|---|--:|--:|
| anonymous, as shipped (selects totalCount) | select b.oid, b.typarray
      from pg_c | 0.5 | 0.5 |
| anonymous, as shipped (selects totalCount) | events page | 1319.2 | 545.1 |
| anonymous, as shipped (selects totalCount) | schedules (IN batch) | 0.0 | 0.0 |
| anonymous, as shipped (selects totalCount) | count(*) | 314.4 | 225.7 |
| **anonymous, as shipped (selects totalCount)** | **4 statements, total** | **1634.1** | **771.4** |
| anonymous, without totalCount | select b.oid, b.typarray
      from pg_c | 0.4 | 0.4 |
| anonymous, without totalCount | events page | 1184.0 | 469.7 |
| anonymous, without totalCount | schedules (IN batch) | 0.0 | 0.1 |
| **anonymous, without totalCount** | **3 statements, total** | **1184.5** | **470.1** |
| signed in, as shipped (selects totalCount) | select b.oid, b.typarray
      from pg_c | 0.9 | 0.7 |
| signed in, as shipped (selects totalCount) | user settings | 0.1 | 0.1 |
| signed in, as shipped (selects totalCount) | events page | 1276.5 | 581.2 |
| signed in, as shipped (selects totalCount) | schedules (IN batch) | 0.1 | 0.0 |
| signed in, as shipped (selects totalCount) | count(*) | 242.0 | 211.6 |
| **signed in, as shipped (selects totalCount)** | **5 statements, total** | **1519.6** | **793.7** |
| signed in, without totalCount | select b.oid, b.typarray
      from pg_c | 0.5 | 0.5 |
| signed in, without totalCount | user settings | 0.1 | 0.1 |
| signed in, without totalCount | events page | 1347.4 | 621.6 |
| signed in, without totalCount | schedules (IN batch) | 0.0 | 0.0 |
| **signed in, without totalCount** | **4 statements, total** | **1348.0** | **622.2** |

**B. Response size, 10 events (the real GraphQL JSON)**

| shape | bytes | per event |
|---|--:|--:|
| full card (the shared GetEvents fields) | 8307 | 831 |
| ids only | 506 | 51 |

**C. "Ids first, hydrate by id" using only code that exists today**

| step (signed in) | rows | JIT on (ms) | JIT off (ms) | response bytes |
|---|--:|--:|--:|--:|
| ids only, limit 10 (today's order) | 10 | 1199.9 | 570.7 | 506 |
| ids only, limit 200 (today's order) | 200 | 1145.7 | 551.4 | 9246 |
| ids only, limit 1000 (today's order) | 1000 | 1094.1 | 649.1 | 46046 |
| hydrate 10 ids by `id in [...]` (the Favorites path) | 10 | 0.8 | 0.8 | 8289 |
