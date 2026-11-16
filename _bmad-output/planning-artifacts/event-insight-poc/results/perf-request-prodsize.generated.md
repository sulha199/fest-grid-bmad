### Scratch database sized like production (1,412 events, 1,082 open, jit off, PostgreSQL 16.15). This is NOT production data: it is the repo seed grown to the same row count

**A. One Discovery page (limit 10, offset 0), every statement the resolver runs**

| request | statement | JIT on (ms) | JIT off (ms) |
|---|---|--:|--:|
| anonymous, as shipped (selects totalCount) | select b.oid, b.typarray
      from pg_c | 0.5 | 0.4 |
| anonymous, as shipped (selects totalCount) | events page | 11.9 | 7.7 |
| anonymous, as shipped (selects totalCount) | schedules (IN batch) | 0.0 | 0.0 |
| anonymous, as shipped (selects totalCount) | count(*) | 1.9 | 2.0 |
| **anonymous, as shipped (selects totalCount)** | **4 statements, total** | **14.2** | **10.1** |
| anonymous, without totalCount | events page | 8.0 | 8.2 |
| anonymous, without totalCount | schedules (IN batch) | 0.0 | 0.0 |
| **anonymous, without totalCount** | **2 statements, total** | **8.1** | **8.2** |
| signed in, as shipped (selects totalCount) | user settings | 0.0 | 0.0 |
| signed in, as shipped (selects totalCount) | events page | 7.9 | 7.8 |
| signed in, as shipped (selects totalCount) | schedules (IN batch) | 0.0 | 0.0 |
| signed in, as shipped (selects totalCount) | count(*) | 2.2 | 2.0 |
| **signed in, as shipped (selects totalCount)** | **4 statements, total** | **10.2** | **9.9** |
| signed in, without totalCount | user settings | 0.0 | 0.0 |
| signed in, without totalCount | events page | 8.6 | 9.2 |
| signed in, without totalCount | schedules (IN batch) | 0.0 | 0.0 |
| **signed in, without totalCount** | **3 statements, total** | **8.7** | **9.2** |

**B. Response size, 10 events (the real GraphQL JSON)**

| shape | bytes | per event |
|---|--:|--:|
| full card (the shared GetEvents fields) | 7963 | 796 |
| ids only | 506 | 51 |

**C. "Ids first, hydrate by id" using only code that exists today**

| step (signed in) | rows | JIT on (ms) | JIT off (ms) | response bytes |
|---|--:|--:|--:|--:|
| ids only, limit 10 (today's order) | 10 | 12.2 | 10.7 | 506 |
| ids only, limit 200 (today's order) | 200 | 7.0 | 7.6 | 9246 |
| ids only, limit 1000 (today's order) | 1000 | 7.4 | 7.3 | 46046 |
| hydrate 10 ids by `id in [...]` (the Favorites path) | 10 | 0.6 | 0.5 | 7946 |
