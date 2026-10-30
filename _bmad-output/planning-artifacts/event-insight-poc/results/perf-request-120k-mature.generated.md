### bench120k mature (85% ended, 13k open): 120012 events, 13394 with something still open

**A. One Discovery page (limit 10, offset 0), every statement the resolver runs**

| request | statement | JIT on (ms) | JIT off (ms) |
|---|---|--:|--:|
| anonymous, as shipped (selects totalCount) | select b.oid, b.typarray
      from pg_c | 0.4 | 0.4 |
| anonymous, as shipped (selects totalCount) | events page | 305.3 | 223.4 |
| anonymous, as shipped (selects totalCount) | schedules (IN batch) | 0.0 | 0.0 |
| anonymous, as shipped (selects totalCount) | count(*) | 100.6 | 111.3 |
| **anonymous, as shipped (selects totalCount)** | **4 statements, total** | **406.4** | **335.1** |
| anonymous, without totalCount | events page | 294.1 | 223.4 |
| anonymous, without totalCount | schedules (IN batch) | 0.1 | 0.1 |
| **anonymous, without totalCount** | **2 statements, total** | **294.2** | **223.5** |
| signed in, as shipped (selects totalCount) | user settings | 0.0 | 0.0 |
| signed in, as shipped (selects totalCount) | events page | 279.6 | 226.5 |
| signed in, as shipped (selects totalCount) | schedules (IN batch) | 0.1 | 0.0 |
| signed in, as shipped (selects totalCount) | count(*) | 109.3 | 147.0 |
| **signed in, as shipped (selects totalCount)** | **4 statements, total** | **389.0** | **373.6** |
| signed in, without totalCount | user settings | 0.1 | 0.1 |
| signed in, without totalCount | events page | 289.5 | 215.0 |
| signed in, without totalCount | schedules (IN batch) | 0.1 | 0.0 |
| **signed in, without totalCount** | **3 statements, total** | **289.7** | **215.1** |

**B. Response size, 10 events (the real GraphQL JSON)**

| shape | bytes | per event |
|---|--:|--:|
| full card (the shared GetEvents fields) | 7634 | 763 |
| ids only | 506 | 51 |

**C. "Ids first, hydrate by id" using only code that exists today**

| step (signed in) | rows | JIT on (ms) | JIT off (ms) | response bytes |
|---|--:|--:|--:|--:|
| ids only, limit 10 (today's order) | 10 | 280.4 | 247.2 | 506 |
| ids only, limit 200 (today's order) | 200 | 256.3 | 172.5 | 9246 |
| ids only, limit 1000 (today's order) | 1000 | 253.1 | 225.7 | 46046 |
| hydrate 10 ids by `id in [...]` (the Favorites path) | 10 | 0.5 | 0.3 | 7616 |
