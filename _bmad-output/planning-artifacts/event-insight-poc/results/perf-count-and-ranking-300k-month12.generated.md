### bench300: 300012 events, 22196 open (visible), 7573 dated within the next 60 days

| test | ms (median of 5) |
|---|--:|
| C0 TODAY's list query unchanged (3 sub-selects), JIT off (rows returned: 21) | 503.3 |
| P0 date only: maintained key + (key,id) index (rows returned: 21) | 0.5 |
| P1 + area tier (array overlap) as the first sort term (rows returned: 21) | 29.5 |
| P1b area tier as three index-ordered branches merged (date only) (rows returned: 21) | 31.7 |
| P1b at offset 200 (rows returned: 21) | 44.3 |
| P2 + freshness boost inside the tier (bounded 7 days, 3-day decay) (rows returned: 21) | 41.1 |
| P3 + "already seen" penalty (200 ids, +14 days, not within 3 days) (rows returned: 21) | 40.2 |
| P3b tier branches + freshness + seen, windowed by the 21-day rule (rows returned: 21) | 18.0 |
| P3b at offset 200 (rows returned: 21) | 43.2 |
| P3 at offset 200 (rows returned: 21) | 42.8 |
| S0 strict filter, today's ORDER BY (3 sub-selects) (rows returned: 0) | 9.6 |
| S1 strict filter, maintained key (rows returned: 0) | 9.8 |
| S2 score EVERY visible event, order by score desc then key (rows returned: 21) | 296.8 |
| S3 near-miss lane: visible events matching >= 3 of 4 leaves, by score then key (rows returned: 21) | 137.6 |
| S4 near-miss lane as an OR of the four leave-one-out conjunctions (rows returned: 21) | 735.7 |
| S5 bounded near-miss: score only the 300 soonest visible events (>= 2 of 4) (rows returned: 21) | 5.0 |
| P3h personalized order over the NEXT 60 DAYS only (index range, then rank) (rows returned: 21) | 19.1 |
| P3h at offset 200 (rows returned: 21) | 117.8 |
| P3h, 14 days (rows returned: 21) | 43.0 |
| I1 ids only: area tier + date (rows returned: 21) | 20.5 |
| I3 ids only: tier + freshness + seen (all open events) (rows returned: 21) | 30.1 |
| I3h ids only: tier + freshness + seen over the next 60 days (rows returned: 21) | 15.6 |
| I3h ids only, 200 ids (a pinned session list) (rows returned: 200) | 42.7 |
| N0 TODAY's count statement, as the resolver emits it (a separate query per page) (rows returned: NaN) | 243.8 |
| N1 exact count(*) over open events (maintained key + visibility predicate) (rows returned: NaN) | 65.9 |
| N2 exact count(*) from the open-events index alone (no visibility predicate) (rows returned: NaN) | 7.5 |
| N3 capped count: stop after 1,001 open events ("1000+") (rows returned: NaN) | 53.7 |
| N4 exact count under the four-leaf filter (rows returned: NaN) | 14.7 |
| N5 capped count (1,001) under the four-leaf filter (rows returned: NaN) | 11.7 |
