import * as dotenv from 'dotenv';
import { resolve } from 'path';

export interface DatabaseEnv {
  databaseUrl: string;
}

export function loadDatabaseEnv(baseDir: string): DatabaseEnv {
  dotenv.config({ path: resolve(baseDir, '../../.env') });
  dotenv.config({ path: resolve(baseDir, '.env'), override: true });

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not defined in environment variables.');
  }

  return { databaseUrl };
}
