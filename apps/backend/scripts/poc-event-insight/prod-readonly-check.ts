/**
 * Read-only verification pack for a REAL FestGrid database (production, a replica, or a restored snapshot). It answers, with aggregates only, the
 * questions the scratch-database work could not: the production `jit` setting, how large the catalogue really is, events per post, how many events
 * and schedules have a location, the country mix of stored pins, how many legacy accounts the bulk update would touch, and what today's list query
 * does on the real data (plan, cost, JIT, sequential scans — fed through plan-guard.ts).
 *
 * SAFETY, in layers (any one of them stops a write):
 *   1. The role is checked first: the pack REFUSES to run if the role is a superuser or can INSERT/UPDATE/DELETE/TRUNCATE on any hot table.
 *   2. Every statement runs inside `BEGIN READ ONLY`, with `SET LOCAL statement_timeout`, one connection, `application_name = festgrid-poc-readonly`.
 *   3. Every statement is checked by `assertReadOnlySql` (SELECT / SHOW / EXPLAIN of a SELECT; no DML/DDL, no side-effect functions, one statement).
 *   4. The pack's own statements never name a user-data table (tests enforce it), and print counts and ratios — never rows, captions or handles.
 * The only statements not written here are the two the real resolver emits for the web client's `getEvents` document (anonymous): a SELECT and a
 * count. They are captured, checked by (3), and run again under EXPLAIN (ANALYZE), which EXECUTES them: on production prefer a replica or off-peak.
 *
 *   DATABASE_URL='postgres://festgrid_poc_ro:…@host:port/db' BACKEND_PORT=4001 npx tsx scripts/poc-event-insight/prod-readonly-check.ts [--out report.md] [--no-explain] [--stats]
 *
 * Runs on a machine that can reach the database (it needs a raw TCP connection); it is NOT meant for a cloud sandbox. Credentials are read from
 * the process environment and never printed: only host, port and database name are.
 */
import { writeFileSync } from 'node:fs';
import { graphql } from 'graphql';
import postgres from 'postgres';
import { setSqlCaptureSink } from '../../src/db/client.js';
import { loadBackendEnv } from '../../src/env.js';
import { buildSchema, webOperation, type Captured } from './perf-bench.js';
import { analyzePlan, checkPlan, DEFAULT_PLAN_RULES, describe, type ExplainRoot } from './plan-guard.js';
import { assertReadOnlySql, describeTarget, PACK, STATS_ITEM } from './readonly-policy.js';

type Client = ReturnType<typeof postgres>;
async function readOnly<T>(client: Client, sql: string, timeout = '10s'): Promise<T[]> {
  assertReadOnlySql(sql);
  const rows = await client.begin('read only', async (tx) => {
    await tx.unsafe(`SET LOCAL statement_timeout = '${timeout}'`);
    return tx.unsafe(sql);
  });
  return rows as unknown as T[];
}

async function guardRole(client: Client): Promise<string[]> {
  const [r] = await readOnly<{ superuser: boolean; writable: string[] | null; sensitive: string[] | null; me: string }>(client, `select current_user as me, (select rolsuper from pg_roles where rolname = current_user) as superuser,
      (select array_agg(t) from unnest(array['events','schedules','posts','social_media_account_profiles','favorites','reports','users','api_keys','fcm_tokens','user_settings','user_locations','subscriptions','calendar_additions']) t
        where to_regclass('public.' || t) is not null and (has_table_privilege(current_user, 'public.' || t, 'INSERT') or has_table_privilege(current_user, 'public.' || t, 'UPDATE') or has_table_privilege(current_user, 'public.' || t, 'DELETE') or has_table_privilege(current_user, 'public.' || t, 'TRUNCATE'))) as writable,
      (select array_agg(t) from unnest(array['users','api_keys','fcm_tokens','user_settings','user_locations','subscriptions','calendar_additions']) t
        where to_regclass('public.' || t) is not null and has_any_column_privilege(current_user, 'public.' || t, 'SELECT')) as sensitive`);
  if (r.superuser || (r.writable && r.writable.length)) {
    throw new Error(`REFUSING to run: the connecting role "${r.me}" ${r.superuser ? 'is a superuser' : `can write to ${r.writable!.join(', ')}`}. Use the read-only role from prod-readonly/01-create-readonly-role.sql.`);
  }
  return r.sensitive && r.sensitive.length ? [`the role can read user-data tables (${r.sensitive.join(', ')}); this pack never queries them, but the recommended role has no access to them`] : [];
}

const fmt = (v: unknown): string => (v === null || v === undefined ? '' : typeof v === 'bigint' ? v.toString() : v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
function table(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return '_no rows_';
  const cols = Object.keys(rows[0]);
  return [`| ${cols.join(' | ')} |`, `|${cols.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${cols.map((c) => fmt(r[c]).replace(/\|/g, '\\|')).join(' | ')} |`)].join('\n');
}

async function capturePage(schema: ReturnType<typeof buildSchema>): Promise<Captured[]> {
  const out: Captured[] = [];
  setSqlCaptureSink((sql, params) => { out.push({ sql, params }); });
  try { await graphql({ schema, source: webOperation('getEvents'), variableValues: { limit: 10, offset: 0 }, contextValue: { user: null } }); } finally { setSqlCaptureSink(null); }
  return out.filter((c) => /^select/i.test(c.sql.trim()) && /from "(events|schedules)"/i.test(c.sql) && !/pg_catalog|typarray/i.test(c.sql));
}

async function main() {
  const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
  const flag = (n: string) => process.argv.includes(`--${n}`);
  const url = loadBackendEnv().databaseUrl as string;
  const client = postgres(url, { max: 1, prepare: false, connection: { application_name: 'festgrid-poc-readonly' } });
  const out: string[] = [`# Read-only production check — ${new Date().toISOString().slice(0, 16)}Z`, '', `Target: \`${describeTarget(url)}\` · aggregates only · every statement runs in \`BEGIN READ ONLY\` with a statement timeout`, ''];
  try {
    const warnings = await guardRole(client);
    for (const w of warnings) out.push(`> **Warning:** ${w}`, '');
    for (const item of [...PACK, ...(flag('stats') ? [STATS_ITEM] : [])]) {
      try {
        const rows = await readOnly<Record<string, unknown>>(client, item.sql);
        out.push(`## ${item.title}`, ...(item.note ? [`_${item.note}_`] : []), '', table(rows), '');
      } catch (e) { out.push(`## ${item.title}`, '', `_could not run: ${String((e as Error).message).slice(0, 160)}_`, ''); }
    }
    if (!flag('no-explain')) {
      out.push('## Today\'s Discovery statements on this data (EXPLAIN ANALYZE — executes them)', '', '_JIT is whatever the server default is; the guard rules are the starting values of plan-guard.ts._', '');
      const stmts = await capturePage(buildSchema());
      let failed = 0;
      for (const [i, s] of stmts.entries()) {
        const label = /^select\s+count\(/i.test(s.sql.trim()) ? 'count' : /from "events"/i.test(s.sql) ? 'page' : 'schedules batch';
        const explain = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${s.sql}`;
        assertReadOnlySql(explain);
        const rows = await client.begin('read only', async (tx) => { await tx.unsafe("SET LOCAL statement_timeout = '30s'"); return tx.unsafe(explain, s.params as never[]); });
        const raw = Object.values(rows[0])[0] as unknown;
        const a = analyzePlan((typeof raw === 'string' ? JSON.parse(raw) : raw) as ExplainRoot[]);
        const v = checkPlan(a, DEFAULT_PLAN_RULES);
        if (v.length) failed++;
        out.push(`- ${describe(`${label} statement ${i + 1}`, a, v)}`);
      }
      out.push('', `${failed} of ${stmts.length} statements violate the plan rules.`, '');
    }
  } finally { await client.end(); }
  const text = out.join('\n');
  console.log(text);
  if (arg('out')) writeFileSync(arg('out') as string, text + '\n');
}

if (process.argv[1]?.endsWith('prod-readonly-check.ts')) {
  main().then(() => process.exit(0)).catch((e) => { console.error(String((e as Error).message).replace(/postgres(ql)?:\/\/[^\s]+/g, 'postgres://…')); process.exit(1); });
}
