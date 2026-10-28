-- Row level security (RLS) for the public schema.
--
-- WHY: Supabase publishes the `public` schema through an auto-generated REST API (PostgREST).
-- Anyone holding the project's public anon key (it ships in the web bundle because the web app
-- uses supabase-js for sign-in) can call it, and what they may read or write is decided by table
-- grants plus RLS. FestGrid's web app never reads tables through that API: every read and write
-- goes through the GraphQL backend, which connects as the table owner. So this migration closes
-- a door nothing needs open (default deny) and adds a few narrow, tested owner policies.
--
-- WHAT IT DOES
--   1. Makes the migration portable. Supabase already provides the roles `anon` and
--      `authenticated` and the function `auth.uid()`; a plain Postgres (CI, local dev) does not,
--      so stand-ins are created only when absent. On Supabase every guard below is a no-op.
--   2. Enables RLS on every table in `public`. With RLS on and no policy, every role except the
--      table owner (and roles with BYPASSRLS, such as Supabase's postgres and service_role) sees
--      and changes no rows. The backend connects as the owner, so it is unaffected.
--   3. Adds owner policies for `authenticated` on the tables a signed-in user legitimately owns:
--      read-only on users, user_settings, user_locations, subscriptions and calendar_additions,
--      and read/write on favorites (the one table with a write policy, so the `with check`
--      clause is exercised too). users.id IS the Supabase auth uid (lib/auth/user-provisioning.ts
--      inserts users.id = the JWT `sub`), so `auth.uid()` compares directly.
--      `(select auth.uid())` is deliberate: wrapping the call in a sub-select lets Postgres
--      evaluate it once per statement instead of once per row.
--   Deliberately NO policy on api_keys, fcm_tokens, prompt_filter_rate_limits or any scraper,
--   moderation or catalog table: those stay server-only.
--
-- GUARD: apps/backend/src/db/row-level-security.test.ts fails CI when a table in `public` has
-- RLS disabled, so a table added later cannot slip through. Add `ALTER TABLE ... ENABLE ROW LEVEL
-- SECURITY` to the migration that creates it.
--
-- ROLLBACK (per table): ALTER TABLE public.<table> DISABLE ROW LEVEL SECURITY;
-- See docs/infrastructure/supabase-rls-and-kms-rollout.md for the manual Supabase steps.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF to_regprocedure('auth.uid()') IS NULL THEN
    CREATE SCHEMA IF NOT EXISTS auth;
    -- Same definition Supabase ships: read the `sub` claim PostgREST sets for each request.
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $fn$
      SELECT coalesce(
        nullif(current_setting('request.jwt.claim.sub', true), ''),
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
      )::uuid
    $fn$;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
  END IF;
END $$;
--> statement-breakpoint
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
--> statement-breakpoint
CREATE POLICY "users_select_own" ON "users" FOR SELECT TO authenticated USING ("id" = (SELECT auth.uid()));
--> statement-breakpoint
CREATE POLICY "user_settings_select_own" ON "user_settings" FOR SELECT TO authenticated USING ("user_id" = (SELECT auth.uid()));
--> statement-breakpoint
CREATE POLICY "user_locations_select_own" ON "user_locations" FOR SELECT TO authenticated USING ("user_id" = (SELECT auth.uid()));
--> statement-breakpoint
CREATE POLICY "subscriptions_select_own" ON "subscriptions" FOR SELECT TO authenticated USING ("user_id" = (SELECT auth.uid()));
--> statement-breakpoint
CREATE POLICY "calendar_additions_select_own" ON "calendar_additions" FOR SELECT TO authenticated USING ("user_id" = (SELECT auth.uid()));
--> statement-breakpoint
CREATE POLICY "favorites_manage_own" ON "favorites" FOR ALL TO authenticated USING ("user_id" = (SELECT auth.uid())) WITH CHECK ("user_id" = (SELECT auth.uid()));
