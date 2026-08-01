import * as dotenv from 'dotenv';
import { resolve } from 'path';

export interface BackendEnv {
  port: number;
  supabaseUrl?: string;
  databaseUrl?: string;
}

export function loadBackendEnv(): BackendEnv {
  // Read relative to cwd assuming it is run from apps/backend
  dotenv.config({ path: resolve(process.cwd(), '../../.env') });
  
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  const portStr = process.env.BACKEND_PORT;
  if (!portStr) {
    throw new Error('BACKEND_PORT is not defined in environment variables.');
  }

  const port = parseInt(portStr, 10);
  if (isNaN(port)) {
    throw new Error('BACKEND_PORT must be a valid number.');
  }

  // eslint-disable-next-line turbo/no-undeclared-env-vars
  return { port, supabaseUrl: process.env.SUPABASE_URL, databaseUrl: process.env.DATABASE_URL };
}
