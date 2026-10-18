**Tie stability** — 20 consecutive pages of 10 (the Discovery client's page size), current ORDER BY (no tie-break): 200 rows fetched, **48 events returned on more than one page**, **98 of the true first 200 events never returned** (10 returned events are not in the true first 200, i.e. were reached only through a different tie order).

**Deep pages** (maintained key + (key,id) index, JIT off, median of 5):

| page position | OFFSET | keyset (seek) |
|---|--:|--:|
| 0 | 0.3 ms | 0.3 ms |
| 200 | 2.6 ms | 0.3 ms |
| 2000 | 18.7 ms | 0.3 ms |
| 10000 | 130.0 ms | 0.4 ms |
