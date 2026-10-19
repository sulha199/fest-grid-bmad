/**
 * What does ONE Discovery request cost the database, statement by statement — and what would "ids first, hydrate by id" cost?
 * Runs the web client's own `getEvents` operation through the REAL resolvers (the harness of perf-bench.ts), captures EVERY
 * statement, and times each with EXPLAIN (ANALYZE):
 *
 *   A  one page (limit 10), anonymous and signed in: every statement, JIT on and off — and the same operation WITHOUT `totalCount`
 *      (the shared GetEvents document selects it; the resolver runs a separate count query whenever it is selected)
 *   B  the response size in bytes (the real GraphQL JSON): 10 full items vs 10 ids
 *   C  the split with NO new backend code: ids only (`items { id }`, what Favorites already does) for K = 10 / 200 / 1000, then
 *      hydrating one page by `id in [...]` (the existing Favorites path)
 *
 *   DATABASE_URL=postgres://.../bench BACKEND_PORT=4001 npx tsx scripts/poc-event-insight/perf-request.ts [--label x] [--out f.md] [--user <uuid>]
 *
 * Scratch databases only: it does not modify data, but it SETs jit on its own session.
 */
import { writeFileSync } from 'node:fs';
import { graphql } from 'graphql';
import postgres from 'postgres';
import { setSqlCaptureSink } from '../../src/db/client.js';
import { loadBackendEnv } from '../../src/env.js';
import { scratchDatabaseUrl } from './scratch-guard.js';
import { buildSchema, webOperation, type Captured } from './perf-bench.js';
import type { GraphQLContext } from '../../src/lib/auth/context.js';

const arg = (n: string, d?: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };

async function run(schema: ReturnType<typeof buildSchema>, ctx: GraphQLContext, source: string, vars: Record<string, unknown>) {
  const stmts: Captured[] = [];
  setSqlCaptureSink((sql, params) => { stmts.push({ sql, params }); });
  let data: unknown;
  try {
    const r = await graphql({ schema, source, variableValues: vars, contextValue: ctx });
    if (r.errors?.length) console.error('GraphQL errors:', r.errors.map((e) => e.message));
    data = r.data;
  } finally { setSqlCaptureSink(null); }
  return { stmts, data, bytes: Buffer.byteLength(JSON.stringify({ data }), 'utf8') };
}

const kind = (s: string): string => {
  const t = s.trim().toLowerCase();
  if (/^select\s+count\(/.test(t)) return 'count(*)';
  if (t.includes('from "user_settings"') || t.includes('user_settings')) return 'user settings';
  if (t.includes('from "schedules"') && !t.includes('from "events"')) return 'schedules (IN batch)';
  if (t.startsWith('select') && t.includes('from "events"')) return 'events page';
  return t.slice(0, 40);
};

async function timeStmt(client: ReturnType<typeof postgres>, c: Captured, jit: boolean): Promise<number> {
  await client.unsafe(`SET jit = ${jit ? 'on' : 'off'}`);
  const times: number[] = [];
  for (let i = 0; i < 5; i++) {
    const rows = await client.unsafe(`EXPLAIN (ANALYZE) ${c.sql}`, c.params as never[]);
    const text = rows.map((r: Record<string, unknown>) => Object.values(r)[0]).join('\n');
    times.push(Number((text.match(/Execution Time: ([\d.]+) ms/) ?? [])[1]));
  }
  times.sort((a, b) => a - b);
  return times[2];
}

async function main() {
  const label = arg('label', 'bench');
  const client = postgres(scratchDatabaseUrl(loadBackendEnv().databaseUrl, 'perf-request.ts'), { max: 1, prepare: false });
  const schema = buildSchema();
  const web = webOperation('getEvents');
  const noCount = web.replace(/\n\s*totalCount/, '');
  if (noCount === web) throw new Error('could not strip totalCount from the web operation');
  const idsOnly = `query ids($limit: Int, $offset: Int, $query: EventQueryConditionInput) { events(limit: $limit, offset: $offset, query: $query) { items { id } hasMore } }`;
  const userId = arg('user', '8d01845c-dc75-4e71-890d-49893bfa366e') as string;
  const contexts: Array<[string, GraphQLContext]> = [['anonymous', { user: null }], ['signed in', { user: { userId, role: 'user' } }]];

  const [{ total, open }] = await client.unsafe(`select (select count(*) from events)::int total, (select count(distinct event_id) from schedules where coalesce(event_end_date, event_start_date) >= current_date)::int open`);
  const out: string[] = [`### ${label}: ${total} events, ${open} with something still open\n`];

  // ---- A: every statement of one page request
  const A: string[] = ['| request | statement | JIT on (ms) | JIT off (ms) |', '|---|---|--:|--:|'];
  const sums: Record<string, [number, number]> = {};
  for (const [who, ctx] of contexts) {
    for (const [docName, doc] of [['as shipped (selects totalCount)', web], ['without totalCount', noCount]] as const) {
      const r = await run(schema, ctx, doc, { limit: 10, offset: 0 });
      let on = 0, off = 0;
      for (const s of r.stmts) {
        const a = await timeStmt(client, s, true); const b = await timeStmt(client, s, false);
        on += a; off += b;
        A.push(`| ${who}, ${docName} | ${kind(s.sql)} | ${a.toFixed(1)} | ${b.toFixed(1)} |`);
      }
      A.push(`| **${who}, ${docName}** | **${r.stmts.length} statements, total** | **${on.toFixed(1)}** | **${off.toFixed(1)}** |`);
      sums[`${who} / ${docName}`] = [on, off];
      console.log(`${who} / ${docName}: ${r.stmts.length} statements, ${on.toFixed(1)} ms (JIT on), ${off.toFixed(1)} ms (JIT off)`);
    }
  }
  out.push('**A. One Discovery page (limit 10, offset 0), every statement the resolver runs**\n', ...A, '');

  // ---- B: response size, real JSON
  const pageFull = await run(schema, contexts[1][1], web, { limit: 10, offset: 0 });
  const pageIds = await run(schema, contexts[1][1], idsOnly, { limit: 10, offset: 0 });
  const items = ((pageFull.data as { events: { items: Array<{ id: string }> } }).events.items) ?? [];
  out.push('**B. Response size, 10 events (the real GraphQL JSON)**\n', '| shape | bytes | per event |', '|---|--:|--:|',
    `| full card (the shared GetEvents fields) | ${pageFull.bytes} | ${Math.round(pageFull.bytes / Math.max(1, items.length))} |`,
    `| ids only | ${pageIds.bytes} | ${Math.round(pageIds.bytes / Math.max(1, items.length))} |`, '');

  // ---- C: the split without new backend code
  const C: string[] = ['| step (signed in) | rows | JIT on (ms) | JIT off (ms) | response bytes |', '|---|--:|--:|--:|--:|'];
  for (const k of [10, 200, 1000]) {
    const r = await run(schema, contexts[1][1], idsOnly, { limit: k, offset: 0 });
    let on = 0, off = 0;
    for (const s of r.stmts) { on += await timeStmt(client, s, true); off += await timeStmt(client, s, false); }
    const n = ((r.data as { events: { items: unknown[] } }).events.items ?? []).length;
    C.push(`| ids only, limit ${k} (today's order) | ${n} | ${on.toFixed(1)} | ${off.toFixed(1)} | ${r.bytes} |`);
  }
  const ids = items.map((i) => i.id);
  if (ids.length) {
    const hydrate = await run(schema, contexts[1][1], noCount, { limit: ids.length, offset: 0, query: { operator: 'and', conditions: [{ field: 'id', operator: 'in', value: ids }] } });
    let on = 0, off = 0;
    for (const s of hydrate.stmts) { on += await timeStmt(client, s, true); off += await timeStmt(client, s, false); }
    C.push(`| hydrate ${ids.length} ids by \`id in [...]\` (the Favorites path) | ${ids.length} | ${on.toFixed(1)} | ${off.toFixed(1)} | ${hydrate.bytes} |`);
    console.log(`hydrate ${ids.length}: ${on.toFixed(1)} ms JIT on, ${off.toFixed(1)} ms JIT off`);
  }
  out.push('**C. "Ids first, hydrate by id" using only code that exists today**\n', ...C, '');

  const text = out.join('\n');
  if (arg('out')) writeFileSync(arg('out') as string, text);
  console.log('\n' + text);
  await client.end();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
