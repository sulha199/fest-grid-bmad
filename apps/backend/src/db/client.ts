import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@festgrid/database";
import { loadBackendEnv } from "../env.js";

const env = loadBackendEnv();

if (!env.databaseUrl) {
  throw new Error("DATABASE_URL is not defined in environment variables.");
}

const client = postgres(env.databaseUrl);
export const db = drizzle(client, { schema });
