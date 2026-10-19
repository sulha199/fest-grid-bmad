### bench120: 120012 events, 90907 open; tier 0+1 within 60 days: 16836

| candidates K | candidates found | generation only | + FREE score, top 200 | + PAID score (12 terms), top 200 | PAID marginal µs per candidate |
|--:|--:|--:|--:|--:|--:|
| 300 | 300 | 0.8 ms | 1.2 ms | 1.9 ms | 3.6 |
| 1000 | 1000 | 3.7 ms | 3.4 ms | 5.0 ms | 1.3 |
| 3000 | 3000 | 33.2 ms | 31.8 ms | 40.5 ms | 2.4 |
| 10000 | 10000 | 32.1 ms | 39.9 ms | 62.1 ms | 3.0 |
| 30000 | 16836 | 31.2 ms | 48.3 ms | 99.1 ms | 4.0 |

Same PAID query for K = 3000 with the server default JIT on: 41.1 ms.
