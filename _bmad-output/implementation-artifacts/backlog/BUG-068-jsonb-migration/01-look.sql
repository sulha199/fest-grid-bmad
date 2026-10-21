-- BUG-068 jsonb migration, step 1 of 3 (and the check afterwards): LOOK. READ-ONLY - it changes nothing and can run as a read-only role. Run it again after 02-apply.sql.
--   psql "$DATABASE_URL" -f 01-look.sql
-- For each of the 27 columns that Drizzle's plain jsonb() writes (and customJsonb will write correctly from now on): how many values are
-- JSON text stored inside a jsonb string (the BUG-068 shape, what 02-apply.sql converts), how many strings are something else (left alone),
-- how many are already objects/arrays, and how many bytes the string rows hold. 'core' = columns SQL reads or is about to read; 'rest' = journal,
-- job and cache columns that only Drizzle reads (converted only with -v include_rest=1).
\set ON_ERROR_STOP on
WITH cols(grp, tbl, col) AS (VALUES
  ('core','schedules','location_details'), ('core','social_media_account_profiles','default_location'), ('core','user_locations','location_details'),
  ('core','default_location_change_requests','previous_location'), ('core','default_location_change_requests','new_location'),
  ('core','events','links'), ('core','posts','additional_image_urls'),
  ('rest','social_media_account_profiles','discovery_source'), ('rest','geolocation_cache','result'), ('rest','widgets','filters'),
  ('rest','ai_event_filters','resolved_filter'), ('rest','corrections','proposed_data'),
  ('rest','account_profile_merges','twin_snapshot'), ('rest','account_profile_merges','evidence'), ('rest','account_profile_merges','repointed'),
  ('rest','event_merges','repointed_favorite_ids'), ('rest','event_merges','deduped_favorite_ids'), ('rest','event_merges','repointed_calendar_addition_ids'),
  ('rest','event_merges','deduped_calendar_addition_ids'), ('rest','event_merges','repointed_report_ids'), ('rest','event_merges','repointed_event_post_ids'),
  ('rest','event_merges','repointed_alias_ids'), ('rest','extraction_audit_logs','events_completeness'),
  ('rest','manual_extraction_jobs','request_payload'), ('rest','manual_extraction_jobs','result_data'),
  ('rest','scraper_actor_runs','raw_input'), ('rest','scraper_actor_runs','raw_output'))
SELECT string_agg(format($q$SELECT %L AS grp, %L AS "table.column", count(*) AS rows, count(%I) AS non_null,
    count(*) FILTER (WHERE jsonb_typeof(%I) = 'string' AND left(%I #>> '{}', 1) IN ('{', '[')) AS json_text_in_string__will_convert,
    count(*) FILTER (WHERE jsonb_typeof(%I) = 'string' AND left(%I #>> '{}', 1) NOT IN ('{', '[')) AS other_strings__left_alone,
    count(*) FILTER (WHERE jsonb_typeof(%I) IN ('object', 'array')) AS objects_or_arrays,
    pg_size_pretty(coalesce(sum(pg_column_size(%I)) FILTER (WHERE jsonb_typeof(%I) = 'string'), 0)) AS bytes_in_strings FROM %I$q$,
    grp, tbl || '.' || col, col, col, col, col, col, col, col, col, tbl), E'\nUNION ALL\n' ORDER BY grp, tbl, col) AS q FROM cols \gset
\echo '== per column (core first). Expect json_text_in_string__will_convert = 0 and objects_or_arrays = non_null once the migration has run.'
SELECT :'q' AS q \gexec
