### bench120: 120012 events, 90907 open (visible), 30693 dated within the next 60 days

| test | ms (median of 5) |
|---|--:|
| C0 TODAY's list query unchanged (3 sub-selects), JIT off (rows returned: 21) | 902.4 |
| P0 date only: maintained key + (key,id) index (rows returned: 21) | 0.5 |
| P1 + area tier (array overlap) as the first sort term (rows returned: 21) | 122.7 |
| P1b area tier as three index-ordered branches merged (date only) (rows returned: 21) | 202.4 |
| P1b at offset 200 (rows returned: 21) | 145.2 |
| P2 + freshness boost inside the tier (bounded 7 days, 3-day decay) (rows returned: 21) | 165.3 |
| P3 + "already seen" penalty (200 ids, +14 days, not within 3 days) (rows returned: 21) | 165.6 |
| P3b tier branches + freshness + seen, windowed by the 21-day rule (rows returned: 21) | 84.4 |
| P3b at offset 200 (rows returned: 21) | 146.8 |
| P3 at offset 200 (rows returned: 21) | 171.6 |
| S0 strict filter, today's ORDER BY (3 sub-selects) (rows returned: 0) | 55.6 |
| S1 strict filter, maintained key (rows returned: 0) | 51.7 |
| S2 score EVERY visible event, order by score desc then key (rows returned: 21) | 475.8 |
| S3 near-miss lane: visible events matching >= 3 of 4 leaves, by score then key (rows returned: 21) | 353.5 |
| S4 near-miss lane as an OR of the four leave-one-out conjunctions (rows returned: 21) | 637.6 |
| S5 bounded near-miss: score only the 300 soonest visible events (>= 2 of 4) (rows returned: 21) | 6.9 |
| P3h personalized order over the NEXT 60 DAYS only (index range, then rank) (rows returned: 21) | 70.8 |
| P3h at offset 200 (rows returned: 21) | 76.6 |
| P3h, 14 days (rows returned: 21) | 30.6 |
| I1 ids only: area tier + date (rows returned: 21) | 60.2 |
| I3 ids only: tier + freshness + seen (all open events) (rows returned: 21) | 111.4 |
| I3h ids only: tier + freshness + seen over the next 60 days (rows returned: 21) | 63.9 |
| I3h ids only, 200 ids (a pinned session list) (rows returned: 200) | 52.1 |
