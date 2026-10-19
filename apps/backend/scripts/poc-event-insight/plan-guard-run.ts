/**
 * Runs the plan guard against a database: the statements the real Discovery resolver emits for the web client's own `getEvents` document
 * (anonymous and signed in), plus any extra .sql files given with --sql. Exit code 1 when any statement violates the rules, so it can gate CI on
 * the volume seed (`pnpm seed:volume`).
 *
 *   DATABASE_URL=postgres://.../bench BACKEND_PORT=4001 npx tsx scripts/poc-event-insight/plan-guard-run.ts [--sql a.sql --sql b.sql] [--out report.txt]
 *
 * EXPLAIN (ANALYZE) executes the statement; use a scratch database.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { graphql } from 'graphql';
import postgres from 'postgres';
import { setSqlCaptureSink } from '../../src/db/client.js';
import { loadBackendEnv } from '../../src/env.js';
import { buildSchema, webOperation, type Captured } from './perf-bench.js';
import { analyzePlan, checkPlan, DEFAULT_PLAN_RULES, describe, type ExplainRoot } from './plan-guard.js';

const argAll = (n: string): string[] => process.argv.flatMap((a, i) => (a === `--${n}` ? [process.argv[i + 1]] : []));
const arg = (n: string) => argAll(n)[0];

async function statements(schema: ReturnType<typeof buildSchema>, ctx: { user: null | { userId: string; role: 'user' } }): Promise<Captured[]> {
  const out: Captured[] = [];
  setSqlCaptureSink((sql, params) => { out.push({ sql, params }); });
  try { await graphql({ schema, source: webOperation('getEvents'), variableValues: { limit: 10, offset: 0 }, contextValue: ctx }); } finally { setSqlCaptureSink(null); }
  return out;
}
const label = (s: string): string => {
  const t = s.trim().toLowerCase();
  if (/^select\s+count\(/.test(t)) return 'count(*)';
  if (t.startsWith('select') && t.includes('from "events"')) return 'events page';
  return t.slice(0, 30);
};

async function main() {
  const client = postgres(loadBackendEnv().databaseUrl as string, { max: 1, prepare: false });
  const schema = buildSchema();
  const jobs: Array<{ name: string; sql: string; params: unknown[] }> = [];
  for (const [who, ctx] of [['anonymous', { user: null }], ['signed in', { user: { userId: '8d01845c-dc75-4e71-890d-49893bfa366e', role: 'user' as const } }]] as const) {
    for (const s of await statements(schema, ctx)) {
      if (/^(select\s+b\.oid|select\s+.*user_settings|insert)/i.test(s.sql.trim()) || !/from "(events|schedules)"/i.test(s.sql)) continue;
      if (label(s.sql) === 'events page' || label(s.sql) === 'count(*)') jobs.push({ name: `Discovery page, ${who}: ${label(s.sql)}`, sql: s.sql, params: s.params });
    }
  }
  for (const f of argAll('sql')) jobs.push({ name: f.split('/').pop() as string, sql: readFileSync(f, 'utf8').trim().replace(/;$/, ''), params: [] });

  await client.unsafe('SET jit = on'); // the production default: the guard must see what a default connection would pay
  const lines: string[] = []; let failed = 0;
  for (const j of jobs) {
    const rows = await client.unsafe(`EXPLAIN (ANALYZE, FORMAT JSON) ${j.sql}`, j.params as never[]);
    const raw = Object.values(rows[0])[0] as unknown;
    const explain = (typeof raw === 'string' ? JSON.parse(raw) : raw) as ExplainRoot[];
    const a = analyzePlan(explain); const v = checkPlan(a, DEFAULT_PLAN_RULES);
    if (v.length) failed++;
    lines.push(describe(j.name, a, v));
  }
  lines.push('', `${failed} of ${jobs.length} statements violate the plan rules (${JSON.stringify({ ...DEFAULT_PLAN_RULES, noSeqScanOn: DEFAULT_PLAN_RULES.noSeqScanOn.length + ' relations' })})`);
  console.log(lines.join('\n'));
  if (arg('out')) writeFileSync(arg('out'), lines.join('\n') + '\n');
  await client.end();
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
