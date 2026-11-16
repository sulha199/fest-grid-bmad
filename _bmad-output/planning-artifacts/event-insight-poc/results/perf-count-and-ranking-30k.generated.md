### bench: 30012 events, 22337 open (visible), 7685 dated within the next 60 days

| test | ms (median of 5) |
|---|--:|
| C0 TODAY's list query unchanged (3 sub-selects), JIT off (rows returned: 21) | 194.7 |
| P0 date only: maintained key + (key,id) index (rows returned: 21) | 0.6 |
| P1 + area tier (array overlap) as the first sort term (rows returned: 21) | 32.0 |
| P1b area tier as three index-ordered branches merged (date only) (rows returned: 21) | 29.9 |
| P1b at offset 200 (rows returned: 21) | 49.3 |
| P2 + freshness boost inside the tier (bounded 7 days, 3-day decay) (rows returned: 21) | 45.8 |
| P3 + "already seen" penalty (200 ids, +14 days, not within 3 days) (rows returned: 21) | 47.5 |
| P3b tier branches + freshness + seen, windowed by the 21-day rule (rows returned: 21) | 13.6 |
| P3b at offset 200 (rows returned: 21) | 32.3 |
| P3 at offset 200 (rows returned: 21) | 46.9 |
| S0 strict filter, today's ORDER BY (3 sub-selects) (rows returned: 0) | 24.8 |
| S1 strict filter, maintained key (rows returned: 0) | 24.5 |
| S2 score EVERY visible event, order by score desc then key (rows returned: 21) | 144.6 |
| S3 near-miss lane: visible events matching >= 3 of 4 leaves, by score then key (rows returned: 21) | 99.3 |
| S4 near-miss lane as an OR of the four leave-one-out conjunctions (rows returned: 21) | 130.6 |
| S5 bounded near-miss: score only the 300 soonest visible events (>= 2 of 4) (rows returned: 21) | 5.2 |
| P3h personalized order over the NEXT 60 DAYS only (index range, then rank) (rows returned: 21) | 23.9 |
| P3h at offset 200 (rows returned: 21) | 27.1 |
| P3h, 14 days (rows returned: 21) | 16.2 |
| I1 ids only: area tier + date (rows returned: 21) | 23.6 |
| I3 ids only: tier + freshness + seen (all open events) (rows returned: 21) | 29.5 |
| I3h ids only: tier + freshness + seen over the next 60 days (rows returned: 21) | 16.2 |
| I3h ids only, 200 ids (a pinned session list) (rows returned: 200) | 16.8 |
| N0 TODAY's count statement, as the resolver emits it (a separate query per page) (rows returned: NaN) | 49.5 |
| N1 exact count(*) over open events (maintained key + visibility predicate) (rows returned: NaN) | 37.1 |
| N2 exact count(*) from the open-events index alone (no visibility predicate) (rows returned: NaN) | 7.3 |
| N3 capped count: stop after 1,001 open events ("1000+") (rows returned: NaN) | 2.1 |
| N4 exact count under the four-leaf filter (rows returned: NaN) | 25.4 |
| N5 capped count (1,001) under the four-leaf filter (rows returned: NaN) | 25.2 |
