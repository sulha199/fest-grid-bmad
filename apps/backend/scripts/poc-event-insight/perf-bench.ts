/**
 * Measurement bench for the most-used endpoint (Query.events). Runs the REAL resolvers through graphql() with the web
 * client's own getEvents operation (the method src/explain-events-queries.ts established), captures the SQL the resolver
 * emits, then re-runs it under EXPLAIN (ANALYZE, BUFFERS) -- and re-runs VARIANTS of that SQL (a changed ORDER BY / WHERE)
 * so a proposed ranking can be measured against the real query instead of argued about.
 *
 *   DATABASE_URL=postgres://.../bench BACKEND_PORT=4001 npx tsx scripts/poc-event-insight/perf-bench.ts [--out <dir>]
 *
 * Needs a seeded database (packages/database: `pnpm seed` then `pnpm seed:volume`). Run only against a SCRATCH database.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSchema } from 'graphql-yoga';
import { graphql, parse, print, type OperationDefinitionNode } from 'graphql';
import postgres from 'postgres';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { resolvers } from '../../src/schema/resolvers.js';
import { setSqlCaptureSink } from '../../src/db/client.js';
import { loadBackendEnv } from '../../src/env.js';
import { scratchDatabaseUrl } from './scratch-guard.js';
import type { GraphQLContext } from '../../src/lib/auth/context.js';

export interface Captured { sql: string; params: unknown[] }

export function buildSchema() {
  const schemaDir = resolve(process.cwd(), 'src/schema');
  const typeDefs = readdirSync(schemaDir).filter((f) => f.endsWith('.graphql')).map((f) => readFileSync(join(schemaDir, f), 'utf8')).join('\n');
  return createSchema<GraphQLContext>({ typeDefs, resolvers });
}

export function webOperation(name: string): string {
  const source = readFileSync(resolve(process.cwd(), '../web/src/features/events/queries.graphql'), 'utf8');
  const op = parse(source).definitions.find((d): d is OperationDefinitionNode => d.kind === 'OperationDefinition' && d.name?.value === name);
  if (!op) throw new Error(`no operation ${name}`);
  return print(op);
}

export async function capture(schema: ReturnType<typeof buildSchema>, context: GraphQLContext, source: string, variableValues: Record<string, unknown>): Promise<Captured[]> {
  const out: Captured[] = [];
  setSqlCaptureSink((sql, params) => { out.push({ sql, params }); });
  try {
    const r = await graphql({ schema, source, variableValues, contextValue: context });
    if (r.errors?.length) console.error('GraphQL errors:', r.errors);
  } finally { setSqlCaptureSink(null); }
  return out;
}

export const mainSelect = (cs: Captured[]) => cs.filter((c) => /^select/i.test(c.sql.trim()) && !/^select\s+count/i.test(c.sql.trim())).sort((a, b) => b.sql.length - a.sql.length)[0];

export async function explain(client: ReturnType<typeof postgres>, c: Captured, runs = 3): Promise<{ ms: number; plan: string }> {
  let best = Infinity; let plan = '';
  for (let i = 0; i < runs; i++) {
    const rows = await client.unsafe(`EXPLAIN (ANALYZE, BUFFERS) ${c.sql}`, c.params as never[]);
    const text = rows.map((r: Record<string, unknown>) => Object.values(r)[0]).join('\n');
    const m = text.match(/Execution Time: ([\d.]+) ms/);
    const ms = m ? Number(m[1]) : Infinity;
    if (ms < best) { best = ms; plan = text; }
  }
  return { ms: best, plan };
}

async function main() {
  const env = loadBackendEnv();
  const client = postgres(scratchDatabaseUrl(env.databaseUrl, 'perf-bench.ts'), { max: 1, prepare: false });
  const schema = buildSchema();
  const outDir = resolve(process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : '.');
  mkdirSync(outDir, { recursive: true });
  const anon: GraphQLContext = { user: null };
  const op = webOperation('getEvents');
  const cs = await capture(schema, anon, op, { limit: 20 });
  const main = mainSelect(cs);
  writeFileSync(resolve(outDir, 'plain-main.sql'), main.sql + '\n-- params: ' + JSON.stringify(main.params) + '\n');
  const e = await explain(client, main);
  writeFileSync(resolve(outDir, 'plain-main.plan.txt'), e.plan);
  console.log(`plain getEvents (anonymous, limit 20): ${e.ms.toFixed(1)} ms`);
  await client.end();
}
if (process.argv[1]?.endsWith('perf-bench.ts')) main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
