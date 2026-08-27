# 3. Database

*   **Service:** **Supabase** (PostgreSQL)
*   **Description:** A managed PostgreSQL database.
*   **Reasoning:** Supabase provides a generous free tier for its PostgreSQL database, along with other useful features like authentication and storage. It's a more sustainable long-term free option compared to the 12-month free tiers of some cloud providers.

## Connection Pooling

`DATABASE_URL` **must** point at Supabase's **transaction-mode pooler (port `6543`)**, never the session-mode pooler (port `5432`). Session mode holds one pooler slot per connected client for the connection's entire lifetime and caps *total* concurrent clients across all Lambda containers at the project's `pool_size` (15) — a routine burst of concurrent Lambda invocations (e.g. a handful of dashboard queries firing right after login) exceeds that ceiling, and every resolver needing a DB connection at that moment fails with `PostgresError: (EMAXCONNSESSION) max clients reached in session mode`. Transaction mode releases the connection back to the pool between queries instead, so far more concurrent Lambda containers can share the same backend slots.

The `postgres()` client in `apps/backend/src/db/client.ts` **must** be constructed with `prepare: false` whenever pointed at a transaction-mode pooler — prepared statements can't be reused across the backend connections the pooler rotates between queries.

See [incident: connection pool exhaustion, 2026-08-27](./incidents/2026-08-27-connection-pool-exhaustion.md) for the investigation that surfaced this.
