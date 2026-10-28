# Row level security and fail-closed KMS: rollout runbook

This runbook covers the **manual steps you perform in Supabase and AWS** around two changes:

1. **Migration `0084_enable_row_level_security.sql`**: enables row level security (RLS) on every table in the `public` schema and adds a few owner policies.
2. **Fail-closed KMS** (`apps/backend/src/lib/ai-gateway/kms.ts`): BYOK API keys can no longer be stored or read as plain base64 when KMS fails.

Do the steps in order. Parts A and B are read-only checks. The only changes are the merge (Part C) and the optional hardening (Part F).

## What changes, in plain words

- **RLS.** Supabase exposes the `public` schema through an automatic REST API. The public *anon key* (it is in the web bundle) is enough to call it, and RLS decides which rows come back. FestGrid's web app never reads tables that way (it uses supabase-js for sign-in only; all data goes through the GraphQL backend). The migration turns RLS on everywhere, so by default nobody using the REST API sees any row. The backend connects as the table owner and is **not** filtered.
- **Policies.** A signed-in user can read their own `users` row, `user_settings`, `user_locations`, `subscriptions` and `calendar_additions`, and read/write their own `favorites`. `api_keys`, `fcm_tokens`, `prompt_filter_rate_limits` and every scraper, moderation and catalog table have no policy and stay server-only.
- **KMS.** Before, when KMS failed the code silently stored the key as base64 of the plaintext. Now encrypt throws, and decrypt throws unless `BYOK_ALLOW_LEGACY_BASE64_FALLBACK=true` (a temporary switch for old rows).

## Part A. Before merging (read-only checks, Supabase dashboard and SQL editor)

1. **Note the current backup.** Dashboard, Database, Backups. Write down the latest backup time. If the plan has no backups, take a `pg_dump` of the database first.
2. **Look at the current exposure.** Dashboard, Advisors, Security Advisor. Look for *RLS Disabled in Public* warnings and write down which tables are listed. Then Project Settings, Data API: note which schemas are exposed (normally `public`) and whether the Data API is enabled.
3. **Prove the exposure (before).** Replace the two values from Project Settings, API (project URL and the *anon* public key), then run from a terminal:
   ```sh
   curl -s "https://<project-ref>.supabase.co/rest/v1/events?select=id&limit=1" \
     -H "apikey: <anon-key>" -H "Authorization: Bearer <anon-key>"
   curl -s "https://<project-ref>.supabase.co/rest/v1/api_keys?select=id&limit=1" \
     -H "apikey: <anon-key>" -H "Authorization: Bearer <anon-key>"
   ```
   If these return rows, or an error other than an empty list, the tables are reachable with the public key today. After the migration both must return `[]` (or a permission error). Save this "before" output.
4. **Confirm the backend role is not filtered by RLS.** In the SQL editor:
   ```sql
   select rolname, rolsuper, rolbypassrls from pg_roles
   where rolname in ('postgres', 'service_role', 'authenticator', 'anon', 'authenticated');
   select tableowner, count(*) from pg_tables where schemaname = 'public' group by tableowner;
   ```
   Expect every public table to be owned by `postgres`. The user in the `DATABASE_URL` secret (the part before `@`, for example `postgres.<project-ref>`) must be that `postgres` role. **If the role in `DATABASE_URL` is anything else, stop and do not merge.** The table owner bypasses RLS by default, which is what protects the backend.
5. **Check for legacy API keys (KMS).** Real KMS ciphertext is about 200 to 300 characters in base64. A key an older build stored as base64 of the plaintext is about 52 characters.
   ```sql
   select count(*) as legacy_looking from api_keys where length(key_encrypted) < 120;
   select id, user_id, length(key_encrypted) as len, created_at
   from api_keys order by created_at desc limit 20;
   ```
   - `0` rows: nothing to do.
   - more than `0`: those keys will stop decrypting once the fix is live. Either ask those users to re-add their key (the new code encrypts it properly), or set `BYOK_ALLOW_LEGACY_BASE64_FALLBACK=true` on the API and AI Processor Lambdas for the transition (Part F), then flip it back after the keys are re-added.
6. **Check the KMS wiring in AWS.** Lambda console, the API, AI Processor and Scraper functions, Configuration, Environment variables: `BYOK_KMS_KEY_ID` must be set. The CDK stack already grants those roles `kms:Encrypt` and `kms:Decrypt` on the key (`kmsKey.grantEncryptDecrypt`), so the fail-closed code can reach KMS.

## Part B. Review the pull request

1. CI must be green, including the new tests: `src/db/row-level-security.test.ts` (RLS on every table, anon sees nothing, a user sees only their own rows, `WITH CHECK` rejects another user's row) and `src/lib/ai-gateway/kms.test.ts` (fail-closed encrypt and decrypt).
2. Read the migration comments in `0084_enable_row_level_security.sql`. On Supabase the role and `auth.uid()` guards at the top do nothing, because those objects already exist.

## Part C. Merge and deploy

1. Merge. The `db-migrate` job (production `DATABASE_URL`) runs migration 0084 before `deploy-infrastructure`.
2. If the migration job fails, nothing was half-applied (the migrator runs it in one transaction). Read the job log, then follow Part E.

## Part D. Verify (after the deploy)

1. **Every table has RLS** (expect `0` rows back):
   ```sql
   select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity;
   ```
2. **Policies exist** (expect 6):
   ```sql
   select tablename, policyname, cmd from pg_policies where schemaname = 'public' order by 1;
   ```
3. **Repeat the two `curl` calls from A3.** Both must now return `[]`.
4. **Smoke-test the app:** sign in, open the feed, favorite an event, save a location, change a setting, add a Gemini key. If any of these fail, go to Part E.
5. **Optional, prove the owner policy.** Sign in on the web app, copy the access token from the browser storage, then:
   ```sh
   curl -s "https://<project-ref>.supabase.co/rest/v1/favorites?select=user_id" \
     -H "apikey: <anon-key>" -H "Authorization: Bearer <user-access-token>"
   ```
   Only that user's own favorites come back.
6. **Re-run the Security Advisor.** *RLS Disabled in Public* should be gone. *RLS Enabled, No Policy* notices for the server-only tables are expected and intended.

## Part E. Rollback

- **One table misbehaves:** in the SQL editor, `alter table public.<table> disable row level security;`. The policies stay in place but inactive.
- **All tables:**
  ```sql
  do $$ declare t record; begin
    for t in select tablename from pg_tables where schemaname = 'public' loop
      execute format('alter table public.%I disable row level security', t.tablename);
    end loop;
  end $$;
  ```
- **KMS decrypt errors in production:** set `BYOK_ALLOW_LEGACY_BASE64_FALLBACK=true` on the API and AI Processor Lambdas (CDK environment or the Lambda console) while you investigate. Do not leave it on: it brings back the old fail-open decrypt.

## Part F. Optional hardening and follow-ups

- **Turn off the Data API** (Project Settings, Data API) if you are sure nothing uses it. FestGrid only uses Supabase Auth, which keeps working.
- **Take the anon role's table privileges away** as a second lock behind RLS:
  ```sql
  revoke all on all tables in schema public from anon;
  alter default privileges in schema public revoke all on tables from anon;
  ```
- **Alarm on KMS failures.** The backend now logs `Could not decrypt API key` and `KMS could not encrypt the API key` on the failure paths. Create a CloudWatch metric filter and alarm on those strings for the API and AI Processor log groups.
- **New tables.** Every future migration that creates a table must also enable RLS on it; the CI guard fails otherwise.
- **Drizzle.** The installed `drizzle-orm` (0.30) cannot describe RLS in `schema.ts`, so policies live in hand-written SQL migrations. Newer Drizzle versions can express them with `pgPolicy` and `.enableRLS()`; consider that when upgrading.
