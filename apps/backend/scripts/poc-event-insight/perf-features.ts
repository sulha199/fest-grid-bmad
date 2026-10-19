/**
 * Measures the cost of the proposed Discovery features on top of the real list query, on a bench database:
 *   P*  personalization of the sort (area tier, freshness boost, "already seen" penalty) over a maintained sort key
 *   S*  AI-filter matching: the strict query (today), scoring everything, a near-miss lane, a bounded near-miss lane
 * Predicates for the filter leaves are copied from what the real resolver compiles them to (category `&&` array,
 * adminArea `->>`, isFree ILIKE, dateRange EXISTS). Bench databases only: it ADDS bench_* columns to `events`.
 *
 *   DATABASE_URL=postgres://.../bench BACKEND_PORT=4001 npx tsx scripts/poc-event-insight/perf-features.ts [--label x] [--open-all] [--out f.md]
 */
import { writeFileSync } from 'node:fs';
import postgres from 'postgres';
import { buildSchema, capture, mainSelect, webOperation, type Captured } from './perf-bench.js';
import { loadBackendEnv } from '../../src/env.js';

const arg = (n: string, d?: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const has = (n: string) => process.argv.includes(`--${n}`);
const inline = (c: Captured) => c.sql.replace(/\$(\d+)/g, (_, n) => `'${String(c.params[Number(n) - 1]).replace(/'/g, "''")}'`);
const TODAY = new Date().toISOString().slice(0, 10);
const KEY = (a: string) => `COALESCE(min(${a}.event_start_date) FILTER (WHERE COALESCE(${a}.event_end_date, ${a}.event_start_date) >= '${TODAY}'), min(${a}.event_start_date) FILTER (WHERE ${a}.is_main_schedule), min(${a}.event_start_date))`;

async function main() {
  const label = arg('label', 'bench');
  const client = postgres(loadBackendEnv().databaseUrl as string, { max: 1, prepare: false });
  if (has('open-all')) {
    await client.unsafe(`UPDATE schedules SET event_start_date = event_start_date + 450, event_end_date = CASE WHEN event_end_date IS NULL THEN NULL ELSE event_end_date + 450 END WHERE event_start_date < current_date - 100`);
    await client.unsafe(`ANALYZE schedules`);
  }
  // maintained columns (what a trigger + nightly rollover would keep), scratch audience / ingestion-time data
  for (const c of ['bench_open_key', 'bench_audience', 'bench_ingested']) await client.unsafe(`ALTER TABLE events DROP COLUMN IF EXISTS ${c}`);
  await client.unsafe(`ALTER TABLE events ADD COLUMN bench_open_key date, ADD COLUMN bench_audience text[], ADD COLUMN bench_ingested timestamptz`);
  await client.unsafe(`UPDATE events e SET bench_open_key = k.k FROM (SELECT event_id, ${KEY('s')} AS k FROM schedules s GROUP BY event_id HAVING max(COALESCE(s.event_end_date, s.event_start_date)) >= '${TODAY}') k WHERE k.event_id = e.id`);
  await client.unsafe(`UPDATE events SET bench_ingested = now() - random() * interval '30 days',
    bench_audience = CASE WHEN random() < 0.4 THEN '{}'::text[] ELSE ARRAY[(ARRAY['sleman','bantul','yogyakarta','jakarta','bandung','surabaya','bali','semarang','solo','malang','medan','makassar'])[1 + floor(random()*12)::int]] END`);
  await client.unsafe(`DROP INDEX IF EXISTS bench_open_key_idx`);
  await client.unsafe(`CREATE INDEX bench_open_key_idx ON events (bench_open_key, id) WHERE deleted_at IS NULL AND bench_open_key IS NOT NULL`);
  await client.unsafe(`ANALYZE events`);

  const cs = await capture(buildSchema(), { user: null }, webOperation('getEvents'), { limit: 20 });
  const base = inline(mainSelect(cs));
  const lower = base.toLowerCase();
  // NOTE: the select list itself contains a `(SELECT count(*) FROM favorites WHERE ...)`, so ' where ' alone would cut inside it.
  const whereAt = base.indexOf(' where (EXISTS');
  if (whereAt < 0) throw new Error('could not find the visibility predicate in the captured SQL');
  const selectFrom = base.slice(0, whereAt);
  const vis = base.slice(whereAt + 7, lower.indexOf('order by')).trim(); // "(EXISTS(...) and events.deleted_at is null)"
  const baseOrder = base.slice(lower.indexOf('order by'), lower.lastIndexOf('limit'));
  const [{ open }] = await client.unsafe(`select count(*)::int open from events where bench_open_key is not null`);
  const [{ horizon60 }] = await client.unsafe(`select count(*)::int horizon60 from events where bench_open_key <= current_date + 60`);

  const seen = (await client.unsafe(`select id from events where bench_open_key is not null order by random() limit 200`)).map((r) => `'${r.id}'`).join(',');
  const L_CAT = `("events"."categories" && ARRAY['MUSIC'])`;
  const L_AREA = `(("schedules"."location_details"->>'adminArea') = 'Sleman')`;
  const L_FREE = `(("schedules"."ticket_price" ILIKE 'free' OR "schedules"."ticket_price" ILIKE 'gratis'))`;
  const L_DATE = `EXISTS (SELECT 1 FROM "schedules" sd WHERE sd."event_id" = "events"."id" AND daterange(sd."event_start_date", COALESCE(sd."event_end_date", sd."event_start_date"), '[]') && daterange('${TODAY}'::date, ('${TODAY}'::date + 6), '[]'))`;
  const leaves = [L_CAT, L_AREA, L_FREE, L_DATE];
  const score = leaves.map((l) => `(CASE WHEN ${l} THEN 1 ELSE 0 END)`).join(' + ');
  const strict = leaves.join(' AND ');
  const leaveOneOut = leaves.map((_, i) => `(${leaves.filter((__, j) => j !== i).join(' AND ')})`).join(' OR ');

  const TIER = `CASE WHEN "events"."bench_audience" && ARRAY['sleman','yogyakarta','bantul'] THEN 0 WHEN cardinality("events"."bench_audience") = 0 THEN 1 ELSE 2 END`;
  const FRESH = `(7 * GREATEST(0, 1 - EXTRACT(EPOCH FROM (now() - "events"."bench_ingested")) / 259200.0))`;
  const SEEN = `(CASE WHEN "events"."id" = ANY(ARRAY[${seen}]::uuid[]) AND ("events"."bench_open_key" - current_date) > 3 THEN 14 ELSE 0 END)`;
  const OPEN = `"events"."bench_open_key" IS NOT NULL AND ${vis}`;
  const lim = (o = 0) => `limit 21 offset ${o}`;
  const tests: Array<{ group: string; name: string; sql: string; jit?: boolean }> = [
    { group: 'P', name: 'P0 date only: maintained key + (key,id) index', sql: `${selectFrom} where ${OPEN} order by "events"."bench_open_key", "events"."id" ${lim()}` },
    { group: 'P', name: 'P1 + area tier (array overlap) as the first sort term', sql: `${selectFrom} where ${OPEN} order by ${TIER}, "events"."bench_open_key", "events"."id" ${lim()}` },
    { group: 'P', name: 'P2 + freshness boost inside the tier (bounded 7 days, 3-day decay)', sql: `${selectFrom} where ${OPEN} order by ${TIER}, ("events"."bench_open_key" - current_date) - ${FRESH}, "events"."id" ${lim()}` },
    { group: 'P', name: 'P3 + "already seen" penalty (200 ids, +14 days, not within 3 days)', sql: `${selectFrom} where ${OPEN} order by ${TIER}, ("events"."bench_open_key" - current_date) - ${FRESH} + ${SEEN}, "events"."id" ${lim()}` },
    { group: 'P', name: 'P3 at offset 200', sql: `${selectFrom} where ${OPEN} order by ${TIER}, ("events"."bench_open_key" - current_date) - ${FRESH} + ${SEEN}, "events"."id" ${lim(200)}` },
    { group: 'S', name: 'S0 strict filter, today\'s ORDER BY (3 sub-selects)', sql: `${selectFrom} where (${strict}) AND ${vis} ${baseOrder} ${lim()}`, jit: false },
    { group: 'S', name: 'S1 strict filter, maintained key', sql: `${selectFrom} where (${strict}) AND ${OPEN} order by "events"."bench_open_key", "events"."id" ${lim()}` },
    { group: 'S', name: 'S2 score EVERY visible event, order by score desc then key', sql: `${selectFrom} where ${OPEN} order by (${score}) DESC, "events"."bench_open_key", "events"."id" ${lim()}` },
    { group: 'S', name: 'S3 near-miss lane: visible events matching >= 3 of 4 leaves, by score then key', sql: `${selectFrom} where ${OPEN} AND (${score}) >= 3 order by (${score}) DESC, "events"."bench_open_key", "events"."id" ${lim()}` },
    { group: 'S', name: 'S4 near-miss lane as an OR of the four leave-one-out conjunctions', sql: `${selectFrom} where ${OPEN} AND (${leaveOneOut}) order by (${score}) DESC, "events"."bench_open_key", "events"."id" ${lim()}` },
    { group: 'S', name: 'S5 bounded near-miss: score only the 300 soonest visible events', sql: `select * from (${selectFrom} where ${OPEN} order by "events"."bench_open_key", "events"."id" limit 300) w order by 1 limit 0`, },
  ];
  // S5 needs the score on the outer level; build it as a CTE over the candidate ids to keep the select list intact
  const s5 = `with cand as (select "events"."id" as cid from "events" where ${OPEN} order by "events"."bench_open_key", "events"."id" limit 300)
    ${selectFrom} where "events"."id" in (select cid from cand) AND (${score}) >= 2 order by (${score}) DESC, "events"."bench_open_key", "events"."id" ${lim()}`;
  tests[tests.length - 1] = { group: 'S', name: 'S5 bounded near-miss: score only the 300 soonest visible events (>= 2 of 4)', sql: s5 };

  // Tier-merge: one branch per area tier, each walking the (key,id) index in key order with its tier predicate, then a final merge.
  // The window rule: top-(o+21) by (key - fresh + seen) all have key <= c + (seen penalty 14 + max freshness pull 7) = c + 21,
  // where c is the key of the (o+21)th event of that tier in pure key order.
  const LADDER = `ARRAY['sleman','yogyakarta','bantul']`;
  const TP = [`"events"."bench_audience" && ${LADDER}`, `cardinality("events"."bench_audience") = 0`, `(NOT "events"."bench_audience" && ${LADDER} AND cardinality("events"."bench_audience") > 0)`];
  const branch = (t: number, o: number, windowed: boolean, adjusted: boolean) => {
    const sd = adjusted ? `(("events"."bench_open_key" - current_date) - ${FRESH} + ${SEEN})` : `("events"."bench_open_key" - current_date)`;
    const cut = windowed
      ? ` AND "events"."bench_open_key" <= COALESCE((SELECT e2.bench_open_key FROM events e2 WHERE e2.deleted_at IS NULL AND e2.bench_open_key IS NOT NULL AND ${TP[t].replace(/"events"/g, 'e2')} ORDER BY e2.bench_open_key, e2.id OFFSET ${o + 20} LIMIT 1) + 21, 'infinity'::date)`
      : '';
    return `(select "events"."id" as eid, ${t} as t, ${sd} as sd from "events" where "events"."deleted_at" IS NULL AND "events"."bench_open_key" IS NOT NULL AND ${TP[t]}${cut} order by ${sd}, "events"."id" limit ${o + 21})`;
  };
  const tierMerge = (o: number, adjusted: boolean) => `${selectFrom} inner join (${[0, 1, 2].map((t) => branch(t, o, adjusted, adjusted)).join(' union all ')}) u on u.eid = "events"."id" where ${vis} order by u.t, u.sd, u.eid limit 21 offset ${o}`;
  // Horizon segmentation: personalize only the events dated within the next H days; everything later keeps pure date order after them.
  const HORIZON = `"events"."bench_open_key" <= current_date + 60`;
  tests.push(
    { group: 'P', name: 'P3h personalized order over the NEXT 60 DAYS only (index range, then rank)', sql: `${selectFrom} where ${OPEN} AND ${HORIZON} order by ${TIER}, ("events"."bench_open_key" - current_date) - ${FRESH} + ${SEEN}, "events"."id" ${lim()}` },
    { group: 'P', name: 'P3h at offset 200', sql: `${selectFrom} where ${OPEN} AND ${HORIZON} order by ${TIER}, ("events"."bench_open_key" - current_date) - ${FRESH} + ${SEEN}, "events"."id" ${lim(200)}` },
    { group: 'P', name: 'P3h, 14 days', sql: `${selectFrom} where ${OPEN} AND "events"."bench_open_key" <= current_date + 14 order by ${TIER}, ("events"."bench_open_key" - current_date) - ${FRESH} + ${SEEN}, "events"."id" ${lim()}` },
  );
  // I-series: the same orders, but the query returns ONLY events.id (no joins to posts / profiles / schedules, no select-list sub-selects) --
  // the ranking half of a "rank ids first, hydrate by id" request.
  const IDQ = (order: string, extra = '', o = 0) => `select "events"."id" from "events" where ${OPEN}${extra} order by ${order} limit 21 offset ${o}`;
  tests.push(
    { group: 'I', name: 'I1 ids only: area tier + date', sql: IDQ(`${TIER}, "events"."bench_open_key", "events"."id"`) },
    { group: 'I', name: 'I3 ids only: tier + freshness + seen (all open events)', sql: IDQ(`${TIER}, ("events"."bench_open_key" - current_date) - ${FRESH} + ${SEEN}, "events"."id"`) },
    { group: 'I', name: 'I3h ids only: tier + freshness + seen over the next 60 days', sql: IDQ(`${TIER}, ("events"."bench_open_key" - current_date) - ${FRESH} + ${SEEN}, "events"."id"`, ` AND ${HORIZON}`) },
    { group: 'I', name: 'I3h ids only, 200 ids (a pinned session list)', sql: IDQ(`${TIER}, ("events"."bench_open_key" - current_date) - ${FRESH} + ${SEEN}, "events"."id"`, ` AND ${HORIZON}`).replace('limit 21', 'limit 200') },
  );
  tests.splice(2, 0,
    { group: 'P', name: 'P1b area tier as three index-ordered branches merged (date only)', sql: tierMerge(0, false) },
    { group: 'P', name: 'P1b at offset 200', sql: tierMerge(200, false) });
  tests.splice(6, 0,
    { group: 'P', name: 'P3b tier branches + freshness + seen, windowed by the 21-day rule', sql: tierMerge(0, true) },
    { group: 'P', name: 'P3b at offset 200', sql: tierMerge(200, true) });

  tests.unshift({ group: 'C', name: 'C0 TODAY\'s list query unchanged (3 sub-selects), JIT off', sql: `${selectFrom} where ${vis} ${baseOrder} ${lim()}` });
  if (arg('dump')) { const { mkdirSync, writeFileSync: w } = await import('node:fs'); mkdirSync(arg('dump') as string, { recursive: true }); tests.forEach((t, i) => w(`${arg('dump')}/${String(i).padStart(2, '0')}-${t.name.slice(0, 12).replace(/\W+/g, '_')}.sql`, t.sql.replace(/limit 21/g, 'limit 11') + ';\n')); }
  if (has('dump-only')) { await client.end(); return; }
  const rows = [`| test | ms (median of 5) |`, `|---|--:|`];
  for (const t of tests) {
    await client.unsafe(`SET jit = ${t.jit === false || t.jit === undefined ? 'off' : 'on'}`);
    const times: number[] = [];
    let n = -1;
    for (let i = 0; i < 5; i++) {
      const r = await client.unsafe(`EXPLAIN (ANALYZE, BUFFERS) ${t.sql}`);
      const text = r.map((x: Record<string, unknown>) => Object.values(x)[0]).join('\n');
      times.push(Number((text.match(/Execution Time: ([\d.]+) ms/) ?? [])[1]));
      if (i === 0) n = Number((text.match(/^Limit.*actual time=[\d.]+\.\.[\d.]+ rows=(\d+)/m) ?? [])[1] ?? NaN);
    }
    times.sort((a, b) => a - b);
    rows.push(`| ${t.name} (rows returned: ${n}) | ${times[2].toFixed(1)} |`);
    console.log(rows[rows.length - 1]);
  }
  const out = `### ${label}: ${(await client.unsafe(`select count(*)::int c from events`))[0].c} events, ${open} open (visible), ${horizon60} dated within the next 60 days\n\n${rows.join('\n')}\n`;
  if (arg('out')) writeFileSync(arg('out') as string, out);
  console.log('\n' + out);
  await client.end();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
