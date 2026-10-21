# Queries behind prod-findings-and-event-groups-2026-10-19.md

Each file is plain SELECT SQL. Run one inside `BEGIN READ ONLY; SET LOCAL statement_timeout='60s'; ... ROLLBACK;` against a read-only role. No credentials, hosts or row data are stored here.

| File | Answers |
|---|---|
| pack.sql | the runbook's checks: settings, sizes, events, locations, legacy accounts, index use (its country/coordinate columns are artifacts, see loc*.sql) |
| loc.sql, loc2.sql, loc3.sql | pins in columns vs details, pins outside Indonesia, the double-encoded `location_details` and the parsed country mix |
| s1.sql, s4.sql | "Umbrella - Child" title groups; schedule-title to event-name matches |
| contain.sql, tight.sql | date-containment umbrellas (any span, 3 to 7 days) |
| cand.sql | matcher recall against same-name duplicate pairs |
| anniv.sql, anniv2.sql | the "8th Anniversary" keyword, its accounts and its coverage of the SCH family |
| dupposts.sql | duplicate posts (same platform id, same caption) |
