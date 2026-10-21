-- BUG-068 jsonb migration, step 2 of 3: APPLY. One transaction, all or nothing.
--   psql "$DATABASE_URL" -f 02-apply.sql                      # the 'core' columns (schedules.location_details, default_location, links, ...)
--   psql "$DATABASE_URL" -v include_rest=1 -f 02-apply.sql    # also the 'rest' columns (journals, jobs, cache, raw scraper payloads)
--   -v max_rows=N   per-column ceiling (default 200000); the whole run aborts and writes nothing if any column exceeds it
-- RUN ONLY AFTER the writer fix is deployed (customJsonb on the 27 columns): until then the app keeps writing JSON strings and this would have to be repeated.
-- Converts a jsonb STRING that holds JSON text of an object or array into the object/array itself:  (col #>> '{}')::jsonb.
-- Strings that are not JSON objects/arrays are left alone. Rows are matched by id; a row that changed between the snapshot and the update aborts the run.
-- The before-state of every changed value is kept in _bak_bug068 (a scratch table outside the drizzle migrations: export it, drop it later).
-- Reads through Drizzle are unaffected either way (customJsonb parses a legacy string on read); this exists so SQL-side readers (->>, @>, indexes) see the data.
\set ON_ERROR_STOP on
\if :{?include_rest}
\else
  \set include_rest 0
\endif
\if :{?max_rows}
\else
  \set max_rows 200000
\endif

BEGIN;
CREATE TABLE _bak_bug068 (tbl text NOT NULL, col text NOT NULL, id uuid NOT NULL, old_value jsonb NOT NULL, PRIMARY KEY (tbl, col, id));
SELECT set_config('bug068.include_rest', :'include_rest', true), set_config('bug068.max_rows', :'max_rows', true) \gset

DO $$
DECLARE
  c record; n bigint; m bigint; total bigint := 0;
BEGIN
  FOR c IN
    SELECT * FROM (VALUES
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
      ('rest','scraper_actor_runs','raw_input'), ('rest','scraper_actor_runs','raw_output')) v(grp, tbl, col)
    WHERE v.grp = 'core' OR current_setting('bug068.include_rest') = '1'
    ORDER BY v.tbl, v.col
  LOOP
    EXECUTE format($q$INSERT INTO _bak_bug068 SELECT %L, %L, id, %I FROM %I WHERE jsonb_typeof(%I) = 'string' AND left(%I #>> '{}', 1) IN ('{', '[')$q$,
                   c.tbl, c.col, c.col, c.tbl, c.col, c.col);
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > current_setting('bug068.max_rows')::bigint THEN
      RAISE EXCEPTION 'ABORT: %.% has % rows to convert, more than max_rows (%). Read 01-look.sql again; raise max_rows only on purpose. Nothing was written.', c.tbl, c.col, n, current_setting('bug068.max_rows');
    END IF;
    EXECUTE format($q$UPDATE %I t SET %I = (t.%I #>> '{}')::jsonb FROM _bak_bug068 b
                      WHERE b.tbl = %L AND b.col = %L AND b.id = t.id AND jsonb_typeof(t.%I) = 'string'$q$,
                   c.tbl, c.col, c.col, c.tbl, c.col, c.col);
    GET DIAGNOSTICS m = ROW_COUNT;
    IF m <> n THEN
      RAISE EXCEPTION 'ABORT: %.% expected to convert % rows but could convert % - some changed in the meantime. Nothing was written.', c.tbl, c.col, n, m;
    END IF;
    RAISE NOTICE '%.%: % converted', c.tbl, c.col, m;
    total := total + m;
  END LOOP;
  IF total = 0 THEN
    RAISE EXCEPTION 'ABORT: nothing to convert (already done, or the writer fix is not what you think it is). Nothing was written.';
  END IF;
  RAISE NOTICE 'TOTAL converted: %', total;
END $$;
COMMIT;
