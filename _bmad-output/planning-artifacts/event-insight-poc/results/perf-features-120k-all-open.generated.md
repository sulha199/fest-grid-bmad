### bench120k, every event open: 120012 events, 98404 open (visible), 30693 dated within the next 60 days

| test | ms (median of 5) |
|---|--:|
| C0 TODAY's list query unchanged (3 sub-selects), JIT off (rows returned: 21) | 894.6 |
| P0 date only: maintained key + (key,id) index (rows returned: 21) | 0.5 |
| P1 + area tier (array overlap) as the first sort term (rows returned: 21) | 119.6 |
| P1b area tier as three index-ordered branches merged (date only) (rows returned: 21) | 137.2 |
| P1b at offset 200 (rows returned: 21) | 122.5 |
| P2 + freshness boost inside the tier (bounded 7 days, 3-day decay) (rows returned: 21) | 173.1 |
| P3 + "already seen" penalty (200 ids, +14 days, not within 3 days) (rows returned: 21) | 191.4 |
| P3b tier branches + freshness + seen, windowed by the 21-day rule (rows returned: 21) | 59.4 |
| P3b at offset 200 (rows returned: 21) | 140.1 |
| P3 at offset 200 (rows returned: 21) | 213.3 |
| S0 strict filter, today's ORDER BY (3 sub-selects) (rows returned: 0) | 59.8 |
| S1 strict filter, maintained key (rows returned: 0) | 57.8 |
| S2 score EVERY visible event, order by score desc then key (rows returned: 21) | 457.6 |
| S3 near-miss lane: visible events matching >= 3 of 4 leaves, by score then key (rows returned: 21) | 385.7 |
| S4 near-miss lane as an OR of the four leave-one-out conjunctions (rows returned: 21) | 641.3 |
| S5 bounded near-miss: score only the 300 soonest visible events (>= 2 of 4) (rows returned: 21) | 5.2 |
| P3h personalized order over the NEXT 60 DAYS only (index range, then rank) (rows returned: 21) | 66.9 |
| P3h at offset 200 (rows returned: 21) | 69.8 |
| P3h, 14 days (rows returned: 21) | 29.1 |
