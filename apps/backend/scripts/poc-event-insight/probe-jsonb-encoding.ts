/**
 * Probe (scratch database only, local-only guard): why is `schedules.location_details` a JSON *string* in production (BUG-068)?
 * Inserts the same object through Drizzle's `jsonb()` column with postgres.js in the configurations that matter, then reads back
 * `jsonb_typeof()`. A temporary table is used and dropped; nothing of the application's is touched.
 *
 * The second part rehearses the fix order for production: a row written the old way (JSON string), a row written after the fix (object), what the
 * application's Drizzle reads return for both, and the one-statement migration.
 *
 *   DATABASE_URL=postgres://postgres@127.0.0.1:PORT/db BACKEND_PORT=4001 npx tsx scripts/poc-event-insight/probe-jsonb-encoding.ts
 */
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { pgTable, jsonb, integer } from 'drizzle-orm/pg-core';
import { scratchDatabaseUrl } from './scratch-guard.js';

const t = pgTable('probe_jsonb_encoding', { id: integer('id').primaryKey(), j: jsonb('j') });
const value = { coordinates: { latitude: -7.7, longitude: 110.4 }, city: 'Yogyakarta' };

async function run(label: string, url: string, opts: Parameters<typeof postgres>[1], passthroughJson = false) {
  const client = postgres(url, { max: 1, onnotice: () => {}, ...opts });
  // what newer Drizzle versions do for the date types in their postgres-js driver, applied to json/jsonb: let the value Drizzle already stringified through
  if (passthroughJson) for (const oid of ['114', '3802']) (client.options.serializers as Record<string, unknown>)[oid] = (v: unknown) => v;
  const db = drizzle(client);
  await client.unsafe('DROP TABLE IF EXISTS probe_jsonb_encoding');
  await client.unsafe('CREATE TABLE probe_jsonb_encoding (id int primary key, j jsonb)');
  await db.insert(t).values({ id: 1, j: value });                                            // Drizzle jsonb, object value
  await client.unsafe(`INSERT INTO probe_jsonb_encoding VALUES (2, $1::jsonb)`, [JSON.stringify(value)] as never);   // plain text param cast to jsonb
  if (!passthroughJson) await client.unsafe(`INSERT INTO probe_jsonb_encoding VALUES (3, $1)`, [client.json(value as never)] as never);    // postgres.js' own json helper (not meaningful once the serializer is a passthrough)
  const rows = await client.unsafe('SELECT id, jsonb_typeof(j) AS t, left(j::text, 40) AS sample FROM probe_jsonb_encoding ORDER BY id');
  await client.unsafe('DROP TABLE probe_jsonb_encoding');
  await client.end();
  console.log(`${label.padEnd(34)} | drizzle jsonb: ${rows[0].t.padEnd(7)} | text param ::jsonb: ${rows[1].t.padEnd(7)} | client.json(): ${rows[2]?.t ?? 'n/a'}`);
  return rows.map((r) => r.t);
}

function passthrough(client: ReturnType<typeof postgres>) {
  for (const oid of ['114', '3802']) (client.options.serializers as Record<string, unknown>)[oid] = (v: unknown) => v;
}

/** Old writer -> fixed writer -> migration; reads go through Drizzle in every state. */
async function fixOrder(url: string) {
  const oldClient = postgres(url, { max: 1, onnotice: () => {} });
  await oldClient.unsafe('DROP TABLE IF EXISTS probe_jsonb_encoding');
  await oldClient.unsafe('CREATE TABLE probe_jsonb_encoding (id int primary key, j jsonb)');
  await drizzle(oldClient).insert(t).values({ id: 1, j: value });                              // written by today's code: a JSON string
  await oldClient.end();
  const fixed = postgres(url, { max: 1, onnotice: () => {} }); passthrough(fixed);
  const db = drizzle(fixed);
  await db.insert(t).values({ id: 2, j: value });                                               // written after the fix: an object
  const show = async (step: string) => {
    const typeofs = (await fixed.unsafe('SELECT jsonb_typeof(j) AS t, j #>> \'{coordinates,latitude}\' AS sql_side FROM probe_jsonb_encoding ORDER BY id')).map((r) => `${r.t}/${r.sql_side ?? 'null'}`).join(', ');
    const read = (await db.select().from(t).orderBy(t.id)).map((r) => (r.j as { city?: string } | null)?.city ?? 'null').join(', ');
    console.log(`${step.padEnd(34)} | stored type/SQL ->> read: ${typeofs.padEnd(30)} | Drizzle read (city): ${read}`);
  };
  await show('after the fix, before migration');
  await fixed.unsafe(`UPDATE probe_jsonb_encoding SET j = (j #>> '{}')::jsonb WHERE jsonb_typeof(j) = 'string' AND left(j #>> '{}', 1) IN ('{', '[')`);
  await show('after the migration statement');
  await fixed.unsafe('DROP TABLE probe_jsonb_encoding');
  await fixed.end();
}

async function main() {
  const url = scratchDatabaseUrl(process.env.DATABASE_URL, 'probe-jsonb-encoding.ts');
  await run('default (prepare: true)', url, {});
  await run('prepare: false (pooler setting)', url, { prepare: false });
  await run('prepare: false + max_lifetime', url, { prepare: false, max_lifetime: 60 });
  await run('prepare: true + json passthrough', url, {}, true);
  await run('prepare: false + json passthrough', url, { prepare: false }, true);
  console.log('');
  await fixOrder(url);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
