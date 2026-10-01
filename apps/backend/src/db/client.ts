import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@festgrid/database";
import { loadBackendEnv } from "../env.js";

const env = loadBackendEnv();

if (!env.databaseUrl) {
  throw new Error("DATABASE_URL is not defined in environment variables.");
}

// Lambda scales by spinning up new containers under concurrency, and each container
// opens its own fresh connection pool on first query. postgres.js defaults to max: 10
// per pool, so a modest burst of concurrent invocations can open far more connections
// than a direct (non-pgbouncer) Postgres instance allows, causing intermittent
// connection-refused errors across unrelated resolvers. Capping at 1 matches the
// one-request-at-a-time-per-container model and the existing pattern already used in
// lib/auth/user-provisioning.ts.
//
// DATABASE_URL must point at Supabase's transaction-mode pooler (port 6543), not the
// session-mode pooler (port 5432) — session mode caps total concurrent client
// connections across all Lambda containers (pool_size, e.g. 15), which a burst of
// concurrent invocations blows through even at max: 1 per container. prepare: false
// is required in transaction mode since prepared statements can't be reused across
// the backend connections the pooler rotates between queries.
const client = postgres(env.databaseUrl, { idle_timeout: 5, max: 1, prepare: false, debug });

// --- Query-count instrumentation (Story 1.3j, AC8) ---
// The backend suite has no prior instrumented query-count precedent, so this small hook is
// added at the one place every resolver query funnels through (db/client.ts). It is inert in
// production: `debugEnabled` starts false and is only turned on transiently by integration
// tests that assert an O(1)-not-O(N) query count. postgres.js invokes the `debug` callback
// (connection.js) once per executed query, so counting there gives an accurate round-trip count.
let debugEnabled = false;
let executedQueryCount = 0;

function debug(): void {
  if (debugEnabled) {
    executedQueryCount++;
  }
}

export function enableQueryDebug(enabled: boolean): void {
  debugEnabled = enabled;
}

export function resetExecutedQueryCount(): void {
  executedQueryCount = 0;
}

export function getExecutedQueryCount(): number {
  return executedQueryCount;
}

export const db = drizzle(client, { schema });
