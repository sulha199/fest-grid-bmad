/**
 * Measures VARIANTS of the real Discovery list query on a bench database (see perf-bench.ts). The baseline SQL is what
 * the real resolver emits; each variant changes only the sort key / a join / a window around it, so a number here is the
 * cost of THAT change against the same select list, the same visibility predicate, the same data.
 *
 *   DATABASE_URL=postgres://.../bench BACKEND_PORT=4001 npx tsx scripts/poc-event-insight/perf-variants.ts [--label bench30k] [--out <file.md>]
 *
 * It ADDS columns/indexes prefixed bench_ to `events` (the maintained-key variants). Scratch databases only.
 */
import { writeFileSync } from 'node:fs';
import postgres from 'postgres';
import { buildSchema, capture, mainSelect, webOperation, type Captured } from './perf-bench.js';
import { loadBackendEnv } from '../../src/env.js';
import type { GraphQLContext } from '../../src/lib/auth/context.js';

const arg = (n: string, d?: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };

function inline(c: Captured): string {
  return c.sql.replace(/\$(\d+)/g, (_, n) => `'${String(c.params[Number(n) - 1]).replace(/'/g, "''")}'`);
}
const TODAY = new Date().toISOString().slice(0, 10);
const KEY = (alias: string) => `COALESCE(min(${alias}.event_start_date) FILTER (WHERE COALESCE(${alias}.event_end_date, ${alias}.event_start_date) >= '${TODAY}'), min(${alias}.event_start_date) FILTER (WHERE ${alias}.is_main_schedule), min(${alias}.event_start_date))`;

async function main() {
  const label = arg('label', 'bench');
  const client = postgres(loadBackendEnv().databaseUrl as string, { max: 1, prepare: false });
  const schema = buildSchema();
  const cs = await capture(schema, { user: null } as GraphQLContext, webOperation('getEvents'), { limit: 20 });
  const base = inline(mainSelect(cs));
  const cut = base.toLowerCase().indexOf('\norder by');
  const head = base.slice(0, cut > 0 ? cut : base.toLowerCase().indexOf(' order by '));
  const orderIdx = base.toLowerCase().indexOf('order by');
  const baseOrder = base.slice(orderIdx, base.toLowerCase().lastIndexOf('limit'));
  const whereIdx = head.indexOf(' where (EXISTS');

  // ---- prepare the maintained-key variants (scratch columns)
  await client.unsafe(`ALTER TABLE events DROP COLUMN IF EXISTS bench_key`);
  await client.unsafe(`ALTER TABLE events DROP COLUMN IF EXISTS bench_last_end`);
  await client.unsafe(`ALTER TABLE events ADD COLUMN bench_key date, ADD COLUMN bench_last_end date`);
  await client.unsafe(`UPDATE events e SET bench_key = k.k, bench_last_end = k.le FROM (SELECT event_id, ${KEY('s')} AS k, max(COALESCE(s.event_end_date, s.event_start_date)) AS le FROM schedules s GROUP BY event_id) k WHERE k.event_id = e.id`);
  await client.unsafe(`CREATE INDEX IF NOT EXISTS bench_key_full_idx ON events (bench_key, id) WHERE deleted_at IS NULL`);
  await client.unsafe(`ANALYZE events`);
  // the "pruned" variant: events with nothing still open (the default hide-past setting, grace 0) leave the sort index (a nightly job would do this)
  await client.unsafe(`ALTER TABLE events DROP COLUMN IF EXISTS bench_key_pruned`);
  await client.unsafe(`ALTER TABLE events ADD COLUMN bench_key_pruned date`);
  await client.unsafe(`UPDATE events SET bench_key_pruned = bench_key WHERE bench_last_end >= current_date`);
  await client.unsafe(`CREATE INDEX IF NOT EXISTS bench_key_pruned_idx ON events (bench_key_pruned, id) WHERE deleted_at IS NULL AND bench_key_pruned IS NOT NULL`);
  await client.unsafe(`ANALYZE events`);

  const lateral = ` left join lateral (select ${KEY('s')} AS k from schedules s where s.event_id = "events"."id") sk on true`;
  const withLateral = head.slice(0, whereIdx) + lateral + head.slice(whereIdx);
  const variants: Array<{ name: string; jit: boolean; sql: (offset: number) => string }> = [
    { name: 'V0 current (JIT on, server default)', jit: true, sql: (o) => `${head}\n${baseOrder} limit 21 offset ${o}` },
    { name: 'V1 current, JIT off', jit: false, sql: (o) => `${head}\n${baseOrder} limit 21 offset ${o}` },
    { name: 'V2 current + `events.id` tie-break, JIT off', jit: false, sql: (o) => `${head}\n${baseOrder.replace(/ASC\s*$/, 'ASC, "events"."id" ASC')} limit 21 offset ${o}` },
    { name: 'V3 one LATERAL aggregate for the key + id, JIT off', jit: false, sql: (o) => `${withLateral}\norder by sk.k ASC, "events"."id" ASC limit 21 offset ${o}` },
    { name: 'V4 maintained `events.bench_key` + (key,id) index, JIT off', jit: false, sql: (o) => `${head}\norder by "events"."bench_key" ASC, "events"."id" ASC limit 21 offset ${o}` },
    { name: 'V5 maintained key, index holds only events with something still open (grace 0), JIT off', jit: false, sql: (o) => `${head.replace(' where (EXISTS', ' where ("events"."bench_key_pruned" is not null) and (EXISTS')}\norder by "events"."bench_key_pruned" ASC, "events"."id" ASC limit 21 offset ${o}` },
  ];

  const offsets = [0, 200, 2000];
  const rows: string[] = [`| variant | ${offsets.map((o) => `offset ${o}`).join(' | ')} |`, `|---|${offsets.map(() => '--:').join('|')}|`];
  const plans: Record<string, string> = {};
  for (const v of variants) {
    const cells: string[] = [];
    for (const off of offsets) {
      await client.unsafe(`SET jit = ${v.jit ? 'on' : 'off'}`);
      const times: number[] = [];
      for (let i = 0; i < 5; i++) {
        const r = await client.unsafe(`EXPLAIN (ANALYZE, BUFFERS) ${v.sql(off)}`);
        const t = r.map((x: Record<string, unknown>) => Object.values(x)[0]).join('\n');
        if (i === 0 && off === 0) plans[v.name] = t;
        times.push(Number((t.match(/Execution Time: ([\d.]+) ms/) ?? [])[1]));
      }
      times.sort((a, b) => a - b);
      cells.push(`${times[2].toFixed(1)} ms`);
    }
    rows.push(`| ${v.name} | ${cells.join(' | ')} |`);
    console.log(rows[rows.length - 1]);
  }
  const [counts] = await client.unsafe(`select (select count(*) from events)::int total, (select count(*) from events where bench_last_end >= current_date)::int open_events`);
  const out = `### ${label}: ${counts.total} events, ${counts.open_events} with something still open (median of 5 EXPLAIN ANALYZE runs, execution time)\n\n${rows.join('\n')}\n`;
  const file = arg('out');
  if (file) writeFileSync(file, out);
  const planFile = arg('plans');
  if (planFile) writeFileSync(planFile, Object.entries(plans).map(([k, v]) => `===== ${k}\n${v}\n`).join('\n'));
  console.log('\n' + out);
  await client.end();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
