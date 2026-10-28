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
*   **Restore:** the target must be PostgreSQL 17 or newer, with no `public` schema and with `pg_trgm` installed in a schema named `extensions`. The dump has no `CREATE EXTENSION` entries, and `public.events` has a trigram index on `extensions.gin_trgm_ops`, so without that prerequisite exactly that one index fails to build.
    ```
    psql "$TARGET_URL" -c "DROP SCHEMA public" -c "CREATE SCHEMA extensions" -c "CREATE EXTENSION pg_trgm SCHEMA extensions"
    pg_restore --no-owner --no-privileges --exit-on-error --dbname "$TARGET_URL" festgrid-prod-<timestamp>.dump
    ```
    `--no-owner` is needed because the `auth` objects belong to `supabase_admin` and `supabase_auth_admin`, which a plain PostgreSQL does not have.
*   **Restore test:** the [Production DB Restore Test](../../.github/workflows/prod-db-restore-test.yml) workflow runs those two commands after every successful backup (and on demand) in a throwaway `postgres:17` container, then runs [`scripts/compare-restored-db.sh`](../../scripts/compare-restored-db.sh) against production. It fails if a table is missing, a table is empty that is not empty in production, a row count is off by more than max(25 rows, 5%), or an object count (columns, NOT NULL columns, indexes, constraints, sequences, functions) differs. A manual run may name an older dump; production has moved on since then, so the live comparison is skipped for it. It also fails if the newest dump is 36 hours old or more, which catches a nightly backup that silently stopped.
*   **First rehearsal (2026-10-28, PostgreSQL 18.6 on a laptop):** restoring the first dump took 5 seconds. Into a bare empty database it reported exactly two errors, the harmless `schema "public" already exists` and the missing `extensions` schema above. With the prerequisite it restored with zero errors, and all 70 tables (25,457 rows), 125 `public` indexes, the foreign keys, sequences and functions matched production exactly.
