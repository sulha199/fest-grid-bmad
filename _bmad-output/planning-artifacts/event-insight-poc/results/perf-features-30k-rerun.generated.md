### bench: 30012 events, 22337 open (visible), 7685 dated within the next 60 days

| test | ms (median of 5) |
|---|--:|
| C0 TODAY's list query unchanged (3 sub-selects), JIT off (rows returned: 21) | 170.1 |
| P0 date only: maintained key + (key,id) index (rows returned: 21) | 0.4 |
| P1 + area tier (array overlap) as the first sort term (rows returned: 21) | 30.8 |
| P1b area tier as three index-ordered branches merged (date only) (rows returned: 21) | 38.2 |
| P1b at offset 200 (rows returned: 21) | 46.4 |
| P2 + freshness boost inside the tier (bounded 7 days, 3-day decay) (rows returned: 21) | 40.2 |
| P3 + "already seen" penalty (200 ids, +14 days, not within 3 days) (rows returned: 21) | 37.8 |
| P3b tier branches + freshness + seen, windowed by the 21-day rule (rows returned: 21) | 8.2 |
| P3b at offset 200 (rows returned: 21) | 33.1 |
| P3 at offset 200 (rows returned: 21) | 48.2 |
| S0 strict filter, today's ORDER BY (3 sub-selects) (rows returned: 0) | 22.3 |
| S1 strict filter, maintained key (rows returned: 0) | 21.3 |
| S2 score EVERY visible event, order by score desc then key (rows returned: 21) | 124.8 |
| S3 near-miss lane: visible events matching >= 3 of 4 leaves, by score then key (rows returned: 21) | 70.9 |
| S4 near-miss lane as an OR of the four leave-one-out conjunctions (rows returned: 21) | 123.5 |
| S5 bounded near-miss: score only the 300 soonest visible events (>= 2 of 4) (rows returned: 21) | 4.3 |
| P3h personalized order over the NEXT 60 DAYS only (index range, then rank) (rows returned: 21) | 21.9 |
| P3h at offset 200 (rows returned: 21) | 26.7 |
| P3h, 14 days (rows returned: 21) | 13.9 |
| I1 ids only: area tier + date (rows returned: 21) | 22.1 |
| I3 ids only: tier + freshness + seen (all open events) (rows returned: 21) | 34.0 |
| I3h ids only: tier + freshness + seen over the next 60 days (rows returned: 21) | 19.4 |
| I3h ids only, 200 ids (a pinned session list) (rows returned: 200) | 21.0 |
