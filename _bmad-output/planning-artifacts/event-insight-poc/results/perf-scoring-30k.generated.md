### bench: 30012 events, 22337 open; tier 0+1 within 60 days: 4242

| candidates K | candidates found | generation only | + FREE score, top 200 | + PAID score (12 terms), top 200 | PAID marginal µs per candidate |
|--:|--:|--:|--:|--:|--:|
| 300 | 300 | 9.1 ms | 9.8 ms | 11.7 ms | 8.7 |
| 1000 | 1000 | 7.3 ms | 8.3 ms | 10.8 ms | 3.5 |
| 3000 | 3000 | 7.9 ms | 10.5 ms | 17.1 ms | 3.1 |
| 10000 | 4242 | 8.2 ms | 11.8 ms | 21.9 ms | 3.2 |
| 30000 | 4242 | 8.3 ms | 11.7 ms | 16.6 ms | 1.9 |

Same PAID query for K = 3000 with the server default JIT on: 16.9 ms.
