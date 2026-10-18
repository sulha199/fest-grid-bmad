/**
 * Two pagination measurements on a bench database, against the REAL list SQL:
 *  1. TIE STABILITY: Query.events orders by the next-upcoming date ONLY (no unique tie-break) and pages with OFFSET. Many events share
 *     a date, so consecutive pages are separate sorts of tied rows. Fetch the first PAGES pages exactly as the web client does
 *     (limit 21 = page size 20 + 1 for hasMore, offset += 20) and compare with the ground-truth order (key, id): count duplicated and
 *     missing events across the pages.
 *  2. DEEP PAGES: OFFSET cost vs a keyset (seek) predicate, on the maintained-key variant.
 *
 *   DATABASE_URL=postgres://.../bench BACKEND_PORT=4001 npx tsx scripts/poc-event-insight/perf-pagination.ts [--pages 20] [--out f.md]
 */
import { writeFileSync } from 'node:fs';
import postgres from 'postgres';
import { buildSchema, capture, mainSelect, webOperation, type Captured } from './perf-bench.js';
import { loadBackendEnv } from '../../src/env.js';

const arg = (n: string, d?: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const inline = (c: Captured) => c.sql.replace(/\$(\d+)/g, (_, n) => `'${String(c.params[Number(n) - 1]).replace(/'/g, "''")}'`);

async function main() {
  const client = postgres(loadBackendEnv().databaseUrl as string, { max: 1, prepare: false });
  const base = inline(mainSelect(await capture(buildSchema(), { user: null }, webOperation('getEvents'), { limit: 20 })));
  const lower = base.toLowerCase();
  const orderAt = lower.indexOf('order by');
  const head = base.slice(0, orderAt);
  const baseOrder = base.slice(orderAt, lower.lastIndexOf('limit'));
  const PAGES = Number(arg('pages', '20'));
  const SIZE = Number(arg('size', '10')); // the Discovery client requests limit 10 (+1 the resolver adds for hasMore)
  const out: string[] = [];

  // ---- 1. tie stability. The select list starts with "events"."id", so the first column of each row is the id.
  await client.unsafe(`SET jit = off`);
  const ids = async (sql: string) => (await client.unsafe(sql)).map((r) => String(Object.values(r)[0]));
  const seen = new Map<string, number>(); const order: string[] = [];
  for (let p = 0; p < PAGES; p++) {
    const rows = (await ids(`${head}\n${baseOrder} limit ${SIZE + 1} offset ${p * SIZE}`)).slice(0, SIZE); // the client shows SIZE and uses the extra row for hasMore
    for (const id of rows) { seen.set(id, (seen.get(id) ?? 0) + 1); order.push(id); }
  }
  const truth = await ids(`${head}\n${baseOrder.replace(/ASC\s*$/, 'ASC, "events"."id" ASC')} limit ${PAGES * SIZE}`);
  const truthSet = new Set(truth);
  const dup = [...seen.values()].filter((n) => n > 1).length;
  const missing = truth.filter((id) => !seen.has(id)).length;
  const outsideTruth = order.filter((id) => !truthSet.has(id)).length;
  out.push(`**Tie stability** — ${PAGES} consecutive pages of ${SIZE} (the Discovery client's page size), current ORDER BY (no tie-break): ${order.length} rows fetched, **${dup} events returned on more than one page**, **${missing} of the true first ${PAGES * SIZE} events never returned** (${outsideTruth} returned events are not in the true first ${PAGES * SIZE}, i.e. were reached only through a different tie order).`);

  // ---- 2. deep pages: offset vs keyset on the maintained key (bench_open_key must exist: run perf-features.ts first)
  const vis = head.slice(head.indexOf(' where (EXISTS'));
  const sel = head.slice(0, head.indexOf(' where (EXISTS'));
  const rows = [`| page position | OFFSET | keyset (seek) |`, `|---|--:|--:|`];
  for (const pos of [0, 200, 2000, 10000]) {
    const [anchor] = await client.unsafe(`select bench_open_key::text k, id::text i from events where bench_open_key is not null and deleted_at is null order by bench_open_key, id offset ${Math.max(0, pos - 1)} limit 1`);
    const med = async (sql: string) => { const t: number[] = []; for (let i = 0; i < 5; i++) { const r = await client.unsafe(`EXPLAIN (ANALYZE) ${sql}`); t.push(Number((r.map((x: Record<string, unknown>) => Object.values(x)[0]).join('\n').match(/Execution Time: ([\d.]+) ms/) ?? [])[1])); } return t.sort((a, b) => a - b)[2]; };
    const offsetMs = await med(`${sel} where ("events"."bench_open_key" is not null) and ${vis.slice(vis.indexOf('where') > -1 ? 7 : 7)} order by "events"."bench_open_key", "events"."id" limit 21 offset ${pos}`);
    const keysetMs = pos === 0 ? offsetMs : await med(`${sel} where ("events"."bench_open_key" is not null) and ("events"."bench_open_key", "events"."id") > ('${anchor.k}'::date, '${anchor.i}'::uuid) and ${vis.slice(7)} order by "events"."bench_open_key", "events"."id" limit 21`);
    rows.push(`| ${pos} | ${offsetMs.toFixed(1)} ms | ${keysetMs.toFixed(1)} ms |`);
  }
  out.push('\n**Deep pages** (maintained key + (key,id) index, JIT off, median of 5):\n\n' + rows.join('\n'));
  const text = out.join('\n') + '\n';
  if (arg('out')) writeFileSync(arg('out') as string, text);
  console.log(text);
  await client.end();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
