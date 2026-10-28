# 3. Database

*   **Service:** **Supabase** (PostgreSQL)
*   **Description:** A managed PostgreSQL database.
*   **Reasoning:** Supabase provides a generous free tier for its PostgreSQL database, along with other useful features like authentication and storage. It's a more sustainable long-term free option compared to the 12-month free tiers of some cloud providers.

## Connection Pooling

`DATABASE_URL` **must** point at Supabase's **transaction-mode pooler (port `6543`)**, never the session-mode pooler (port `5432`). Session mode holds one pooler slot per connected client for the connection's entire lifetime and caps *total* concurrent clients across all Lambda containers at the project's `pool_size` (15) — a routine burst of concurrent Lambda invocations (e.g. a handful of dashboard queries firing right after login) exceeds that ceiling, and every resolver needing a DB connection at that moment fails with `PostgresError: (EMAXCONNSESSION) max clients reached in session mode`. Transaction mode releases the connection back to the pool between queries instead, so far more concurrent Lambda containers can share the same backend slots.

The `postgres()` client in `apps/backend/src/db/client.ts` **must** be constructed with `prepare: false` whenever pointed at a transaction-mode pooler — prepared statements can't be reused across the backend connections the pooler rotates between queries.

See [incident: connection pool exhaustion, 2026-08-27](./incidents/2026-08-27-connection-pool-exhaustion.md) for the investigation that surfaced this.

## Backups

The Supabase free plan has **no managed backups** (daily backups and point-in-time recovery need Pro), so the only backup is the nightly `pg_dump` run by the [Production DB Backup](../../.github/workflows/prod-db-backup.yml) GitHub Actions workflow. It also runs on demand (Actions → Production DB Backup → Run workflow).

*   **Schedule:** every night at 18:43 UTC (01:43 WIB), plus manual runs.
*   **What:** a custom-format `pg_dump` of the `public` (the app), `drizzle` (migration journal) and `auth` (Supabase Auth users) schemas. `storage` and `vault` are empty and left out. Roles and their passwords are not part of a `pg_dump`.
*   **Where:** `prod/festgrid-prod-<UTC timestamp>.dump` in `DbBackupBucket-prod` (CDK: `apps/infrastructure/lib/festgrid-backend-stack.ts`, output `dbBackupBucketName`). The bucket is private, SSE-S3 encrypted, TLS-only, retained on stack deletion, and expires every object after **30 days**. It is S3 and not a GitHub artifact because the repository is public.
*   **Credential:** `PROD_BACKUP_DATABASE_URL` in the `production` environment is the **session-mode pooler** URL (port `5432`) of a dedicated `backup_ro` role (`BYPASSRLS` + `pg_read_all_data`, no write grants). `pg_dump` cannot use the transaction pooler the app uses, and `backup_ro` is separate from `readonly_2` (which cannot read `api_keys`, row-level-security tables or other schemas, so a dump with it is incomplete).
*   **Why a runner and not a laptop:** `pg_dump` needs one long, fast connection to the pooler. From a home connection the bulk `COPY` ran at about 15 KB/s and the SSL session dropped mid-dump (2026-10-28). A GitHub runner next to `us-east-1` finishes the ~60 MB database in a minute or two. The dump holds one session-mode slot (of the pool's 15) for that time.
*   **Checks:** the workflow retries a failed dump three times, then fails unless the archive lists its table of contents, is at least 1 MiB, has data entries for `events`, `schedules` and `users`, and the uploaded object has the same size as the local file. A failed scheduled run e-mails whoever last edited the schedule.
*   **Version pin:** `PG_MAJOR` in the workflow (17 today) must be at least the server's major version, or `pg_dump` refuses. Raise it when Supabase upgrades the project.
*   **Restore:** `pg_restore --no-owner --no-privileges --dbname "$TARGET_URL" <file>.dump`. Restoring `auth` into a Supabase project owned by its own service roles may need `--schema` filtering; rehearse a restore into a scratch database before relying on it.
