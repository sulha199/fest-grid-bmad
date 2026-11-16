### bench30k: 30012 events, 22337 open (visible), 7685 dated within the next 60 days

| test | ms (median of 5) |
|---|--:|
| C0 TODAY's list query unchanged (3 sub-selects), JIT off (rows returned: 21) | 171.5 |
| P0 date only: maintained key + (key,id) index (rows returned: 21) | 0.3 |
| P1 + area tier (array overlap) as the first sort term (rows returned: 21) | 39.7 |
| P1b area tier as three index-ordered branches merged (date only) (rows returned: 21) | 39.0 |
| P1b at offset 200 (rows returned: 21) | 47.9 |
| P2 + freshness boost inside the tier (bounded 7 days, 3-day decay) (rows returned: 21) | 45.2 |
| P3 + "already seen" penalty (200 ids, +14 days, not within 3 days) (rows returned: 21) | 43.4 |
| P3b tier branches + freshness + seen, windowed by the 21-day rule (rows returned: 21) | 43.5 |
| P3b at offset 200 (rows returned: 21) | 67.4 |
| P3 at offset 200 (rows returned: 21) | 45.4 |
| S0 strict filter, today's ORDER BY (3 sub-selects) (rows returned: 0) | 29.6 |
| S1 strict filter, maintained key (rows returned: 0) | 44.4 |
| S2 score EVERY visible event, order by score desc then key (rows returned: 21) | 140.5 |
| S3 near-miss lane: visible events matching >= 3 of 4 leaves, by score then key (rows returned: 21) | 94.2 |
| S4 near-miss lane as an OR of the four leave-one-out conjunctions (rows returned: 21) | 138.7 |
| S5 bounded near-miss: score only the 300 soonest visible events (>= 2 of 4) (rows returned: 21) | 6.1 |
| P3h personalized order over the NEXT 60 DAYS only (index range, then rank) (rows returned: 21) | 28.4 |
| P3h at offset 200 (rows returned: 21) | 30.1 |
| P3h, 14 days (rows returned: 21) | 15.4 |
