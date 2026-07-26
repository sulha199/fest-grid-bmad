import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '.env') });
dotenv.config({ path: resolve(__dirname, '../../.env') });

const runMigrate = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined');
  }

  const connectionString = process.env.DATABASE_URL;

  // for migrations
  const migrationClient = postgres(connectionString, { 
    max: 1,
    ssl: 'require' 
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
