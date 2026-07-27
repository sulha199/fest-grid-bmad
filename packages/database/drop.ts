import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '.env') });
dotenv.config({ path: resolve(__dirname, '../../.env') });

const runDrop = async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('No DATABASE_URL');
  
  const sql = postgres(connectionString, { max: 1 });
  
  console.log('Dropping all tables...');
  await sql`DROP SCHEMA public CASCADE;`;
  await sql`CREATE SCHEMA public;`;
  await sql`DROP SCHEMA IF EXISTS drizzle CASCADE;`;
  await sql`GRANT ALL ON SCHEMA public TO postgres;`;
  await sql`GRANT ALL ON SCHEMA public TO public;`;
  
  console.log('Schema dropped and recreated.');
  await sql.end();
};

runDrop().catch(console.error);
