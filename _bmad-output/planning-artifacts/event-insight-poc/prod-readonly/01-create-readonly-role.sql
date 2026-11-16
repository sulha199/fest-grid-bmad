-- 01-create-readonly-role.sql — a read-only role for the production check (apps/backend/scripts/poc-event-insight/prod-readonly-check.ts).
--
-- Run as the database OWNER, preferably on a READ REPLICA, a restored snapshot or a branch — not on the primary if you can avoid it.
-- 1. Replace REPLACE_WITH_A_LONG_RANDOM_PASSWORD below. Do not commit the edited file.
-- 2. It grants SELECT on COLUMNS, not tables: no captions (posts.content), no users, no API keys, no push tokens, no settings, no saved
--    locations, no subscriptions, no calendar entries, no favorite owners.
-- 3. When you are done, run 02-drop-readonly-role.sql.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'festgrid_poc_ro') THEN
    CREATE ROLE festgrid_poc_ro LOGIN PASSWORD 'REPLACE_WITH_A_LONG_RANDOM_PASSWORD'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2;
  END IF;
END $$;

-- belt and braces: every session of this role is read-only, short, and cannot hold locks
ALTER ROLE festgrid_poc_ro SET default_transaction_read_only = on;
ALTER ROLE festgrid_poc_ro SET statement_timeout = '10s';
ALTER ROLE festgrid_poc_ro SET lock_timeout = '2s';
ALTER ROLE festgrid_poc_ro SET idle_in_transaction_session_timeout = '15s';

DO $$ BEGIN EXECUTE format('GRANT CONNECT ON DATABASE %I TO festgrid_poc_ro', current_database()); END $$;
GRANT USAGE ON SCHEMA public TO festgrid_poc_ro;

-- exactly what the list query and the aggregate checks read
GRANT SELECT (id, slug, event_name, location, types, categories, post_id, detail_level, merged_into_event_id, deleted_at, created_at, updated_at, links) ON public.events TO festgrid_poc_ro;
GRANT SELECT ON public.schedules TO festgrid_poc_ro;   -- dates and places of events: already public in the app
GRANT SELECT (id, account_id, image_url, durable_image_url, durable_thumbnail_url, image_url_expires_at, video_url, post_url, original_post_url, published_at, additional_image_urls) ON public.posts TO festgrid_poc_ro;   -- not `content`
GRANT SELECT (id, is_image_storage_opted_in, account_type, account_type_status, default_location) ON public.social_media_account_profiles TO festgrid_poc_ro;
GRANT SELECT (event_id, deleted_at) ON public.favorites TO festgrid_poc_ro;   -- the list query counts favorites per event; not who

-- If row-level security is ON for these tables the application bypasses it as the owner, but this role will see no rows. Then add, per table:
--   CREATE POLICY poc_ro_select ON public.events FOR SELECT TO festgrid_poc_ro USING (true);   -- events, schedules, posts, social_media_account_profiles, favorites
--
-- Optional, only on a replica: lets the pack's --stats flag read pg_stat_statements (query TEXT of other roles' normalized statements).
--   GRANT pg_read_all_stats TO festgrid_poc_ro;
