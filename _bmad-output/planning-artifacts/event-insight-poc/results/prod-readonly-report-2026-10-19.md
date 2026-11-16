# Production read-only check 1 — 2026-10-19 (pack SQL via psql as readonly_2)

**Provenance.** Measured on the production primary, read-only (`BEGIN READ ONLY` … `ROLLBACK`, 60 s statement timeout). The SQL is the `PACK` array of `apps/backend/scripts/poc-event-insight/readonly-policy.ts` (each item checked by `assertReadOnlySql`), run through `psql` as the `readonly_2` role. It is **not** the pack's own report: `prod-readonly-check.ts` refuses any role other than `festgrid_poc_ro`, so the Discovery-statement `EXPLAIN (ANALYZE)` plan-rule verdicts were **not run**.

```text
BEGIN
SET

## Server settings
 server_version | jit | jit_above_cost | jit_inline_above_cost | jit_optimize_above_cost | max_connections | shared_buffers | work_mem | max_parallel_workers_per_gather | statement_timeout 
----------------+-----+----------------+-----------------------+-------------------------+-----------------+----------------+----------+---------------------------------+-------------------
 17.6           | off | 100000         | 500000                | 500000                  | 60              | 224MB          | 2184kB   | 1                               | 1min
(1 row)


## Table sizes (planner estimates)
          table_name           | estimated_rows | total_size 
-------------------------------+----------------+------------
 posts                         |           2337 | 6176 kB
 events                        |           1339 | 2480 kB
 schedules                     |           1720 | 1856 kB
 social_media_account_profiles |            500 | 336 kB
 favorites                     |              5 | 72 kB
 reports                       |             -1 | 32 kB
(6 rows)


## Events
 events | soft_deleted | posts_with_events | events_per_event_post | events_without_post | stubs 
--------+--------------+-------------------+-----------------------+---------------------+-------
   1394 |            0 |              1286 |                  1.08 |                   0 |   253
(1 row)


## Events created per month (last 13 months)
   month    | events 
------------+--------
 2026-10-01 |    929
 2026-09-01 |    434
 2026-08-01 |     31
(3 rows)


## Open (visible) events
 open_events 
-------------
         431
(1 row)


## JSON encoding of jsonb columns written through Drizzle
                  column_name                   | jsonb_type | rows 
------------------------------------------------+------------+------
 events.links                                   |            | 1147
 events.links                                   | string     |  247
 posts.additional_image_urls                    |            | 1841
 posts.additional_image_urls                    | string     |  496
 schedules.location_details                     | string     | 1460
 schedules.location_details                     |            |  265
 social_media_account_profiles.default_location |            |  472
 social_media_account_profiles.default_location | string     |   28
(8 rows)


## Schedules and locations
 schedules | schedules_per_event | no_location_at_all | pinned | pins_outside_indonesia_bbox | with_admin_area | with_venue_type | low_confidence_pins 
-----------+---------------------+--------------------+--------+-----------------------------+-----------------+-----------------+---------------------
      1725 |                1.24 |                265 |   1460 |                         379 |               0 |              37 |                 627
(1 row)


## Country of stored pins
 country_code | schedules 
--------------+-----------
 id           |       933
 (none)       |       425
 us           |       104
 fr           |        41
 dk           |        27
 my           |        24
 in           |        23
 es           |        19
 eg           |        13
 ca           |        11
 br           |        10
 lb           |         7
 pk           |         6
 et           |         6
 mx           |         6
(15 rows)


## Accounts by classification
     account_type      | account_type_status | accounts | without_default_location 
-----------------------+---------------------+----------+--------------------------
 (null)                | (null)              |      466 |                      463
 CURATOR_GUIDE         | CONFIRMED           |       17 |                        6
 ORGANIZER_VENUE_EVENT | CONFIRMED           |       16 |                        2
 (null)                | AWAITING_APPROVAL   |        1 |                        1
(4 rows)


## Index use (events, schedules, posts) — least used first
 table_name |            index_name            | scans |  size  
------------+----------------------------------+-------+--------
 events     | event_types_idx                  |     0 | 216 kB
 posts      | posts_platform_post_identity_idx |     0 | 160 kB
 events     | event_name_idx                   |     0 | 104 kB
 events     | event_location_idx               |     0 | 88 kB
 schedules  | schedules_slug_unique            |     0 | 88 kB
 schedules  | schedule_location_idx            |     0 | 80 kB
 schedules  | schedule_performers_idx          |     0 | 80 kB
 events     | event_categories_idx             |     1 | 232 kB
 posts      | idx_posts_scraper_actor_run_id   |     3 | 64 kB
 posts      | post_hashtags_idx                |    18 | 320 kB
 events     | idx_events_event_name_trgm       |   286 | 640 kB
 schedules  | schedules_pkey                   |   489 | 88 kB
 schedules  | schedule_coordinates_idx         |   523 | 80 kB
 events     | events_slug_unique               |  2017 | 136 kB
 posts      | posts_post_url_unique            |  4678 | 240 kB
(15 rows)

ROLLBACK
```
