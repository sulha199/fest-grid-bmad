\echo ## Server settings
select current_setting('server_version') as server_version, current_setting('jit') as jit, current_setting('jit_above_cost') as jit_above_cost, current_setting('jit_inline_above_cost') as jit_inline_above_cost, current_setting('jit_optimize_above_cost') as jit_optimize_above_cost, current_setting('max_connections') as max_connections, current_setting('shared_buffers') as shared_buffers, current_setting('work_mem') as work_mem, current_setting('max_parallel_workers_per_gather') as max_parallel;
\echo ## Table sizes (planner estimates)
select c.relname as table_name, c.reltuples::bigint as estimated_rows, pg_size_pretty(pg_total_relation_size(c.oid)) as total_size from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relname in ('events','schedules','posts','social_media_account_profiles','favorites','reports') order by pg_total_relation_size(c.oid) desc;
\echo ## Events
select count(*) filter (where deleted_at is null) as events, count(*) filter (where deleted_at is not null) as soft_deleted, count(distinct post_id) filter (where deleted_at is null) as posts_with_events, round(count(*) filter (where deleted_at is null)::numeric / nullif(count(distinct post_id) filter (where deleted_at is null), 0), 2) as events_per_event_post, count(*) filter (where deleted_at is null and detail_level = 'stub') as stubs from events;
\echo ## Events created per month
select date_trunc('month', created_at)::date as month, count(*) as events from events where deleted_at is null and created_at > now() - interval '13 months' group by 1 order by 1 desc;
\echo ## Open (visible) events
select count(distinct s.event_id) as open_events from schedules s join events e on e.id = s.event_id where e.deleted_at is null and coalesce(s.event_end_date, s.event_start_date) >= current_date;
\echo ## Schedules and locations
select count(*) as schedules, round(count(*)::numeric / nullif(count(distinct event_id), 0), 2) as schedules_per_event, count(*) filter (where location_details is null) as no_location, count(*) filter (where location_details is not null and location_details->'coordinates' is null) as location_without_coordinates, count(*) filter (where location_details->>'adminArea' is not null) as with_admin_area, count(*) filter (where (location_details->>'confidence') ~ '^[0-9]+(\.[0-9]+)?$' and (location_details->>'confidence')::float < 0.5) as low_confidence_pins from schedules;
\echo ## Country of stored pins
select coalesce(location_details->>'countryCode', '(none)') as country_code, count(*) as schedules from schedules group by 1 order by 2 desc limit 15;
\echo ## Accounts by classification
select coalesce(account_type::text, '(null)') as account_type, coalesce(account_type_status::text, '(null)') as account_type_status, count(*) as accounts, count(*) filter (where default_location is null) as without_default_location from social_media_account_profiles group by 1, 2 order by 3 desc;
\echo ## Index use (least used first)
select relname as table_name, indexrelname as index_name, idx_scan as scans, pg_size_pretty(pg_relation_size(indexrelid)) as size from pg_stat_user_indexes where schemaname = 'public' and relname in ('events','schedules','posts') order by idx_scan asc, pg_relation_size(indexrelid) desc limit 15;
