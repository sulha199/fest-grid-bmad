import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { resolve } from 'path';
import { loadDatabaseEnv } from './env';

const runMigrate = async () => {
  const { databaseUrl: connectionString } = loadDatabaseEnv(__dirname);

  // for migrations
  const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1') || !connectionString.includes('supabase');
  const migrationClient = postgres(connectionString, { 
    max: 1,
    ssl: isLocal ? false : 'require' 
  });
  const db = drizzle(migrationClient);

  console.log('Running migrations...');

  await migrate(db, { migrationsFolder: resolve(__dirname, './migrations') });

  console.log('Migrations completed successfully');

  await migrationClient.end();
  process.exit(0);
};

runMigrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
