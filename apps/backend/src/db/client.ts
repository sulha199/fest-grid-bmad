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
const client = postgres(env.databaseUrl, { idle_timeout: 5, max: 1 });
export const db = drizzle(client, { schema });
