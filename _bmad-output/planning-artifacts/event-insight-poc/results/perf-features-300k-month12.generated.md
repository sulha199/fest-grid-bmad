### bench300: 300012 events, 22196 open (visible), 7573 dated within the next 60 days

| test | ms (median of 5) |
|---|--:|
| C0 TODAY's list query unchanged (3 sub-selects), JIT off (rows returned: 21) | 528.9 |
| P0 date only: maintained key + (key,id) index (rows returned: 21) | 0.5 |
| P1 + area tier (array overlap) as the first sort term (rows returned: 21) | 57.9 |
| P1b area tier as three index-ordered branches merged (date only) (rows returned: 21) | 42.4 |
| P1b at offset 200 (rows returned: 21) | 57.7 |
| P2 + freshness boost inside the tier (bounded 7 days, 3-day decay) (rows returned: 21) | 65.9 |
| P3 + "already seen" penalty (200 ids, +14 days, not within 3 days) (rows returned: 21) | 62.8 |
| P3b tier branches + freshness + seen, windowed by the 21-day rule (rows returned: 21) | 49.9 |
| P3b at offset 200 (rows returned: 21) | 79.8 |
| P3 at offset 200 (rows returned: 21) | 72.3 |
| S0 strict filter, today's ORDER BY (3 sub-selects) (rows returned: 0) | 10.0 |
| S1 strict filter, maintained key (rows returned: 0) | 8.4 |
| S2 score EVERY visible event, order by score desc then key (rows returned: 21) | 281.2 |
| S3 near-miss lane: visible events matching >= 3 of 4 leaves, by score then key (rows returned: 21) | 151.7 |
| S4 near-miss lane as an OR of the four leave-one-out conjunctions (rows returned: 21) | 705.4 |
| S5 bounded near-miss: score only the 300 soonest visible events (>= 2 of 4) (rows returned: 21) | 5.8 |
| P3h personalized order over the NEXT 60 DAYS only (index range, then rank) (rows returned: 21) | 26.7 |
| P3h at offset 200 (rows returned: 21) | 133.3 |
| P3h, 14 days (rows returned: 21) | 49.2 |
| I1 ids only: area tier + date (rows returned: 21) | 37.9 |
| I3 ids only: tier + freshness + seen (all open events) (rows returned: 21) | 53.1 |
| I3h ids only: tier + freshness + seen over the next 60 days (rows returned: 21) | 23.9 |
| I3h ids only, 200 ids (a pinned session list) (rows returned: 200) | 45.2 |
