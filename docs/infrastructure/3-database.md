# 3. Database

*   **Service:** **Supabase** (PostgreSQL)
*   **Description:** A managed PostgreSQL database.
*   **Reasoning:** Supabase provides a generous free tier for its PostgreSQL database, along with other useful features like authentication and storage. It's a more sustainable long-term free option compared to the 12-month free tiers of some cloud providers.

## Connection Pooling

`DATABASE_URL` **must** point at Supabase's **transaction-mode pooler (port `6543`)**, never the session-mode pooler (port `5432`). Session mode holds one pooler slot per connected client for the connection's entire lifetime and caps *total* concurrent clients across all Lambda containers at the project's `pool_size` (15) — a routine burst of concurrent Lambda invocations (e.g. a handful of dashboard queries firing right after login) exceeds that ceiling, and every resolver needing a DB connection at that moment fails with `PostgresError: (EMAXCONNSESSION) max clients reached in session mode`. Transaction mode releases the connection back to the pool between queries instead, so far more concurrent Lambda containers can share the same backend slots.

The `postgres()` client in `apps/backend/src/db/client.ts` **must** be constructed with `prepare: false` whenever pointed at a transaction-mode pooler — prepared statements can't be reused across the backend connections the pooler rotates between queries.

See [incident: connection pool exhaustion, 2026-08-27](./incidents/2026-08-27-connection-pool-exhaustion.md) for the investigation that surfaced this.

## Row Level Security

Every table in the `public` schema has row level security (RLS) enabled (migration `0084_enable_row_level_security.sql`). Supabase publishes `public` through an automatic REST API that the public anon key can call, so RLS is the lock that keeps that API from returning rows. The web app does not use that API for data (all data goes through the GraphQL backend), and the backend connects as the table owner, which bypasses RLS, so the app is unaffected.

- A signed-in user can read their own `users` row, `user_settings`, `user_locations`, `subscriptions` and `calendar_additions`, and read and write their own `favorites` (`users.id` is the Supabase auth uid, so `auth.uid()` compares directly).
- `api_keys`, `fcm_tokens`, `prompt_filter_rate_limits` and all scraper, moderation and catalog tables have no policy, so they are server-only.
- `apps/backend/src/db/row-level-security.test.ts` fails CI if any table in `public` has RLS disabled. A migration that creates a table must also enable RLS on it.

The manual Supabase and AWS steps for rolling this out are in [supabase-rls-and-kms-rollout.md](./supabase-rls-and-kms-rollout.md).

---
