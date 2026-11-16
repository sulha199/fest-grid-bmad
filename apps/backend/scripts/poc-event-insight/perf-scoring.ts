/**
 * Per-user scoring cost: how many candidates can a request afford to score?
 *
 * Two-stage shape (the only one that scales when every user has a different score):
 *   1. candidate generation from indexes — tier 0 (my area ladder) and tier 1 (no audience area) events within the next 60 days, in date
 *      order, at most K of them (the maintained key + open-events index of perf-features.ts)
 *   2. score those K in the database and return the top ids — a FREE score (tier + freshness + seen) and a PAID score (12 terms: interests,
 *      types, three "vibe" distances, budget, distance from the user, weekday, freshness, seen, area tier)
 *
 * The scoring terms are SYNTHETIC (the event-side columns are random numbers added by this script): the point is the cost per scored
 * candidate and where the budget runs out, not the quality of the ranking. Run perf-features.ts first on the same database (it creates
 * bench_open_key / bench_audience / bench_ingested and the open-events index).
 *
 *   DATABASE_URL=postgres://.../bench BACKEND_PORT=4001 npx tsx scripts/poc-event-insight/perf-scoring.ts [--label x] [--out f.md] [--sql-dir d]   (--sql-dir writes the queries for pgbench)
 */
import { writeFileSync } from 'node:fs';
import postgres from 'postgres';
import { loadBackendEnv } from '../../src/env.js';
import { scratchDatabaseUrl } from './scratch-guard.js';

const arg = (n: string, d?: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };

async function main() {
  const label = arg('label', 'bench');
  const client = postgres(scratchDatabaseUrl(loadBackendEnv().databaseUrl, 'perf-scoring.ts'), { max: 1, prepare: false });
  const have = await client.unsafe(`select count(*)::int c from information_schema.columns where table_name='events' and column_name in ('bench_open_key','bench_audience','bench_ingested')`);
  if (have[0].c !== 3) throw new Error('run perf-features.ts on this database first (it creates the bench_* columns)');

  for (const c of ['bench_v1', 'bench_v2', 'bench_v3', 'bench_price', 'bench_lat', 'bench_lng', 'bench_dow', 'bench_interest']) await client.unsafe(`ALTER TABLE events DROP COLUMN IF EXISTS ${c}`);
  await client.unsafe(`ALTER TABLE events ADD COLUMN bench_v1 smallint, ADD COLUMN bench_v2 smallint, ADD COLUMN bench_v3 smallint, ADD COLUMN bench_price int, ADD COLUMN bench_lat double precision, ADD COLUMN bench_lng double precision, ADD COLUMN bench_dow smallint, ADD COLUMN bench_interest text[]`);
  await client.unsafe(`UPDATE events SET bench_v1 = floor(random()*101), bench_v2 = floor(random()*101), bench_v3 = floor(random()*101),
      bench_price = (ARRAY[0,0,0,25000,50000,100000,250000,500000])[1+floor(random()*8)::int], bench_lat = -8 + random()*3, bench_lng = 106 + random()*8,
      bench_dow = floor(random()*7), bench_interest = ARRAY[(ARRAY['music','art','food','sport','tech','family','yoga','film','market','dance'])[1+floor(random()*10)::int], (ARRAY['music','art','food','sport','tech','family','yoga','film','market','dance'])[1+floor(random()*10)::int]]`);
  await client.unsafe(`ANALYZE events`);
  const [{ open }] = await client.unsafe(`select count(*)::int open from events where bench_open_key is not null`);
  const seen = (await client.unsafe(`select id from events where bench_open_key is not null order by random() limit 200`)).map((r) => `'${r.id}'`).join(',');

  const LADDER = `ARRAY['sleman','yogyakarta','bantul']`;
  const TIER = `CASE WHEN bench_audience && ${LADDER} THEN 0 WHEN cardinality(bench_audience) = 0 THEN 1 ELSE 2 END`;
  const FRESH = `(7 * GREATEST(0, 1 - EXTRACT(EPOCH FROM (now() - bench_ingested)) / 259200.0))`;
  const SEEN = `(CASE WHEN id = ANY(ARRAY[${seen}]::uuid[]) AND (bench_open_key - current_date) > 3 THEN 14 ELSE 0 END)`;
  const DAYS = `(bench_open_key - current_date)`;
  const FREE = `${DAYS} - ${FRESH} + ${SEEN}`;
  // PAID: a bounded pull of up to 21 days for a perfect fit (score 0..1), plus the free terms.
  const FIT = `((3.0 * (bench_interest && ARRAY['music','food','market'])::int
        + 2.0 * ((types && ARRAY['CONCERT','FESTIVAL'])::int)
        + 2.0 * (1 - abs(bench_v1 - 70) / 100.0) + 2.0 * (1 - abs(bench_v2 - 30) / 100.0) + 1.0 * (1 - abs(bench_v3 - 50) / 100.0)
        + 1.5 * (bench_price <= 100000)::int
        + 2.0 * GREATEST(0, 1 - (111.2 * sqrt(power(bench_lat - (-7.8), 2) + power(cos(radians(-7.8)) * (bench_lng - 110.37), 2))) / 30.0)
        + 1.0 * (bench_dow IN (5, 6))::int
        + 0.5 * (categories && ARRAY['MUSIC','FOOD'])::int) / 15.0)`;
  const PAID = `${DAYS} - 21 * ${FIT} - ${FRESH} + ${SEEN}`;
  const cand = (k: number) => `SELECT id, bench_open_key, bench_audience, bench_ingested, bench_v1, bench_v2, bench_v3, bench_price, bench_lat, bench_lng, bench_dow, bench_interest, types, categories FROM events
      WHERE deleted_at IS NULL AND bench_open_key IS NOT NULL AND bench_open_key <= current_date + 60
        AND (bench_audience && ${LADDER} OR cardinality(bench_audience) = 0) ORDER BY bench_open_key, id LIMIT ${k}`;
  const q = {
    gen: (k: number) => `SELECT id FROM (${cand(k)}) c`,
    free: (k: number) => `SELECT id FROM (${cand(k)}) cand ORDER BY ${TIER}, ${FREE}, id LIMIT 200`,
    paid: (k: number) => `SELECT id FROM (${cand(k)}) cand ORDER BY ${TIER}, ${PAID}, id LIMIT 200`,
  };

  const time = async (sql: string, jit = false): Promise<number> => {
    await client.unsafe(`SET jit = ${jit ? 'on' : 'off'}`);
    const ts: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await client.unsafe(`EXPLAIN (ANALYZE) ${sql}`);
      ts.push(Number((r.map((x: Record<string, unknown>) => Object.values(x)[0]).join('\n').match(/Execution Time: ([\d.]+) ms/) ?? [])[1]));
    }
    ts.sort((a, b) => a - b);
    return ts[2];
  };
  if (arg('sql-dir')) {
    const { mkdirSync, writeFileSync: w } = await import('node:fs');
    mkdirSync(arg('sql-dir') as string, { recursive: true });
    for (const k of [300, 1000, 3000, 10000]) for (const name of ['free', 'paid'] as const) w(`${arg('sql-dir')}/${name}-${k}.sql`, `${q[name](k)};\n`);
  }
  const [{ pool }] = await client.unsafe(`select count(*)::int pool from events where deleted_at is null and bench_open_key is not null and bench_open_key <= current_date + 60 and (bench_audience && ${LADDER} or cardinality(bench_audience) = 0)`);

  const rows = [`| candidates K | candidates found | generation only | + FREE score, top 200 | + PAID score (12 terms), top 200 | PAID marginal µs per candidate |`, `|--:|--:|--:|--:|--:|--:|`];
  let paid3000On = NaN;
  for (const k of [300, 1000, 3000, 10000, 30000]) {
    const found = Math.min(k, pool);
    const g = await time(q.gen(k)); const f = await time(q.free(k)); const p = await time(q.paid(k));
    rows.push(`| ${k} | ${found} | ${g.toFixed(1)} ms | ${f.toFixed(1)} ms | ${p.toFixed(1)} ms | ${found ? (((p - g) * 1000) / found).toFixed(1) : '-'} |`);
    console.log(rows[rows.length - 1]);
    if (k === 3000) paid3000On = await time(q.paid(k), true);
  }
  const out = `### ${label}: ${(await client.unsafe(`select count(*)::int c from events`))[0].c} events, ${open} open; tier 0+1 within 60 days: ${pool}\n\n${rows.join('\n')}\n\nSame PAID query for K = 3000 with the server default JIT on: ${paid3000On.toFixed(1)} ms.\n`;
  if (arg('out')) writeFileSync(arg('out') as string, out);
  console.log('\n' + out);
  await client.end();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
