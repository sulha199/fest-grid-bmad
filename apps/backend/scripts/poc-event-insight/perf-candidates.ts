/**
 * Candidate generation for per-user ranking, built so that a slow table scan is not an available plan.
 *
 * perf-scoring.ts generated candidates with an array-overlap predicate over `events` (`bench_audience && ladder OR no audience`, in date order,
 * LIMIT K). At 91k open events the planner flipped that to a parallel sequential scan plus a sort (31-47 ms, 54 requests/s under 8 clients).
 * Here the same candidates come from a JUNCTION table of audience-area keys — one row per (event, area), indexed `(area_key, open_key, event_id)`
 * — merged branch by branch: one ordered index range scan per rung of the user's area ladder, each with its own LIMIT K, plus one partial-index
 * range scan for events with no audience area. The work is bounded by (rungs + 1) x K index entries whatever the table size, and there is no
 * cheaper plan for the planner to prefer.
 *
 * Every query is also fed through plan-guard.ts (EXPLAIN JSON): a sequential scan of a hot table, a cost above the JIT cliff, JIT itself, or
 * work amplification is reported as a violation.
 *
 * Run perf-features.ts first (it creates bench_open_key / bench_audience). Scratch databases only: this adds a table `bench_event_area` and two indexes.
 *
 *   DATABASE_URL=postgres://.../bench BACKEND_PORT=4001 npx tsx scripts/poc-event-insight/perf-candidates.ts [--label x] [--out f.md] [--sql-dir d]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import postgres from 'postgres';
import { loadBackendEnv } from '../../src/env.js';
import { analyzePlan, checkPlan, DEFAULT_PLAN_RULES, describe, type ExplainRoot } from './plan-guard.js';

const arg = (n: string, d?: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };

async function main() {
  const label = arg('label', 'bench');
  const client = postgres(loadBackendEnv().databaseUrl as string, { max: 1, prepare: false });
  const have = await client.unsafe(`select count(*)::int c from information_schema.columns where table_name='events' and column_name in ('bench_open_key','bench_audience')`);
  if (have[0].c !== 2) throw new Error('run perf-features.ts on this database first');

  await client.unsafe(`DROP TABLE IF EXISTS bench_event_area`);
  await client.unsafe(`CREATE TABLE bench_event_area AS SELECT e.id AS event_id, a.area_key, e.bench_open_key AS open_key FROM events e CROSS JOIN LATERAL unnest(e.bench_audience) AS a(area_key) WHERE e.bench_open_key IS NOT NULL AND e.deleted_at IS NULL`);
  await client.unsafe(`CREATE INDEX bench_event_area_idx ON bench_event_area (area_key, open_key, event_id)`);
  await client.unsafe(`DROP INDEX IF EXISTS bench_no_audience_idx`);
  await client.unsafe(`CREATE INDEX bench_no_audience_idx ON events (bench_open_key, id) WHERE deleted_at IS NULL AND bench_open_key IS NOT NULL AND cardinality(bench_audience) = 0`);
  await client.unsafe(`ANALYZE bench_event_area`); await client.unsafe(`ANALYZE events`);

  const LADDER = ['sleman', 'yogyakarta', 'bantul'];
  const HZ = `current_date + 60`;
  const overlap = (k: number) => `SELECT id, bench_open_key FROM events WHERE deleted_at IS NULL AND bench_open_key IS NOT NULL AND bench_open_key <= ${HZ} AND (bench_audience && ARRAY[${LADDER.map((x) => `'${x}'`).join(',')}] OR cardinality(bench_audience) = 0) ORDER BY bench_open_key, id LIMIT ${k}`;
  const junction = (k: number) => `SELECT event_id AS id, open_key FROM (
      ${LADDER.map((a) => `(SELECT event_id, open_key FROM bench_event_area WHERE area_key = '${a}' AND open_key <= ${HZ} ORDER BY open_key, event_id LIMIT ${k})`).join('\n      UNION ALL\n      ')}
      UNION ALL
      (SELECT id, bench_open_key FROM events WHERE deleted_at IS NULL AND bench_open_key IS NOT NULL AND bench_open_key <= ${HZ} AND cardinality(bench_audience) = 0 ORDER BY bench_open_key, id LIMIT ${k})
    ) u ORDER BY open_key, id LIMIT ${k}`;

  const run = async (sql: string, jit = false) => {
    await client.unsafe(`SET jit = ${jit ? 'on' : 'off'}`);
    const times: number[] = []; let last: ExplainRoot[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await client.unsafe(`EXPLAIN (ANALYZE, FORMAT JSON) ${sql}`);
      const json = (Object.values(r[0])[0] as unknown) as ExplainRoot[];
      last = typeof json === 'string' ? JSON.parse(json) : json;
      times.push(last[0]['Execution Time'] as number);
    }
    times.sort((a, b) => a - b);
    return { ms: times[2], analysis: analyzePlan(last) };
  };

  const rows = [`| K | form | median ms | rows returned | rows scanned | plan-guard |`, `|--:|---|--:|--:|--:|---|`];
  const log: string[] = [];
  for (const k of [300, 1000, 3000, 10000]) {
    for (const [name, sql] of [['array overlap + OR', overlap(k)], ['junction branches', junction(k)]] as const) {
      const r = await run(sql);
      const v = checkPlan(r.analysis, { ...DEFAULT_PLAN_RULES, maxScannedRows: 4 * k + 100 });   // a candidate query may read about 4 index entries per candidate
      rows.push(`| ${k} | ${name} | ${r.ms.toFixed(1)} | ${r.analysis.returnedRows} | ${r.analysis.scannedRows} | ${v.length ? v.map((x) => x.rule).join(', ') : 'ok'} |`);
      log.push(describe(`K=${k} ${name}`, r.analysis, v));
    }
  }
  console.log(log.join('\n'));

  // the same, with an artificially bad statistics situation: how robust is each form when the planner is told rows are cheap?
  if (arg('sql-dir')) {
    mkdirSync(arg('sql-dir') as string, { recursive: true });
    for (const k of [1000, 3000]) { writeFileSync(`${arg('sql-dir')}/overlap-${k}.sql`, `${overlap(k)};\n`); writeFileSync(`${arg('sql-dir')}/junction-${k}.sql`, `${junction(k)};\n`); }
  }
  const [{ total, open }] = await client.unsafe(`select (select count(*) from events)::int total, (select count(*) from events where bench_open_key is not null)::int open`);
  const out = `### ${label}: ${total} events, ${open} open; ladder ${LADDER.join(' > ')}, horizon 60 days\n\n${rows.join('\n')}\n`;
  if (arg('out')) writeFileSync(arg('out') as string, out);
  console.log('\n' + out);
  await client.end();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
