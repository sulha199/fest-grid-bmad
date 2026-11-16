| query (8 concurrent clients, 4 cores, 12 s each) | jit | mean latency ms | requests/s |
|---|---|--:|--:|
| today's list query | on | 1807.015 | 4.427190 |
| today's list query | off | 319.265 | 25.057589 |
| maintained key, open-events index (date order) | off | 3.838 | 2084.422617 |
| personalized (area tier + freshness + seen) over ALL open events | off | 230.246 | 34.745434 |
| personalized over the next 60 days only | off | 104.537 | 76.527981 |
| close-matches lane, bounded to the 300 soonest | off | 12.447 | 642.708385 |
