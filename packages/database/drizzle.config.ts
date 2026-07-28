import { defineConfig } from 'drizzle-kit';
import { loadDatabaseEnv } from './env';

const { databaseUrl } = loadDatabaseEnv(__dirname);

export default defineConfig({
  schema: './schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
});
