/**
 * Story 3.6r / AC6 -- promotes `cc-024-explain-baseline-2026-10-01.md`'s throwaway capture
 * script into a committed, reusable one. Reproduces that doc's "Reproducing" section
 * methodology exactly: build the real GraphQL schema via `createSchema({ typeDefs, resolvers })`,
 * run the same four scenarios (`getEvents` plain/limit 20; `getEvents` temporal filter
 * `UPCOMING`; `getEvents` filtered by a subscribed account; `eventBySlug` mid-table event)
 * through `graphql()` with the web client's real field selections (`apps/web/src/features/
 * events/queries.graphql`'s own `getEvents`/`getEventBySlug` operations, parsed and re-printed
 * verbatim -- not a hand-reduced selection), capture the executed SQL + params via
 * `db/client.ts`'s SQL-capture sink (the module every resolver actually queries through -- a
 * second, separate `postgres()` client would never see those queries), then re-run each
 * captured statement prefixed with `EXPLAIN (ANALYZE, BUFFERS)` and print a table in the same
 * shape as the baseline doc's own.
 *
 * Standalone top-level script (matches `backfill-post-media-keys.ts`'s "standalone `tsx`-invoked
 * script, not nested under `lib/`" precedent) -- deliberately in `apps/backend`, not
 * `packages/database`, since it builds the real GraphQL schema via
 * `createSchema({ typeDefs, resolvers })` and `packages/database` must never depend on
 * `apps/backend`.
 *
 * Usage: `pnpm --filter @festgrid/backend exec tsx src/explain-events-queries.ts` (run against a
 * `seed:volume`-loaded database for meaningful EXPLAIN evidence; run `seed:volume:clean`
 * afterward -- volume rows break DB-backed tests).
 */
import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { createSchema } from 'graphql-yoga';
import { graphql, parse, print, type OperationDefinitionNode } from 'graphql';
import postgres from 'postgres';
import { eq, and, sql } from 'drizzle-orm';
import { resolvers } from './schema/resolvers.js';
import { db, setSqlCaptureSink } from './db/client.js';
import { users, subscriptions, socialMediaAccountProfiles, events } from '@festgrid/database';
import { activeOnly } from '@festgrid/graphql-select';
import { buildEventsQueryCondition } from '@festgrid/domain/events';
import { loadBackendEnv } from './env.js';
import type { GraphQLContext } from './lib/auth/context.js';

interface CapturedStatement {
  sql: string;
  params: unknown[];
}

interface ScenarioResult {
  name: string;
  statementCount: number;
  mainSelectMs: number | null;
  totalCountMs: number | null;
  seqScansInMainSelect: string[];
}

function buildSchema() {
  const schemaDir = resolve(process.cwd(), 'src/schema');
  const files = readdirSync(schemaDir).filter((f) => f.endsWith('.graphql'));
  const typeDefs = files.map((f) => readFileSync(join(schemaDir, f), 'utf8')).join('\n');
  return createSchema<GraphQLContext>({ typeDefs, resolvers });
}

/** Extracts and re-prints one named operation verbatim from the web client's own query file --
 * not a hand-reduced selection -- so the captured plans reflect the real client's field shape. */
function extractWebClientOperation(operationName: string): string {
  const queriesPath = resolve(process.cwd(), '../web/src/features/events/queries.graphql');
  const source = readFileSync(queriesPath, 'utf8');
  const document = parse(source);
  const operation = document.definitions.find(
    (def): def is OperationDefinitionNode => def.kind === 'OperationDefinition' && def.name?.value === operationName
  );
  if (!operation) {
    throw new Error(`Could not find operation "${operationName}" in ${queriesPath}`);
  }
  return print(operation);
}

async function runScenario(
  schema: ReturnType<typeof buildSchema>,
  context: GraphQLContext,
  name: string,
  source: string,
  variableValues: Record<string, unknown>
): Promise<CapturedStatement[]> {
  const captured: CapturedStatement[] = [];
  setSqlCaptureSink((sql, params) => {
    captured.push({ sql, params });
  });
  try {
    const result = await graphql({ schema, source, variableValues, contextValue: context });
    if (result.errors && result.errors.length > 0) {
      console.error(`[explain-events-queries] Scenario "${name}" returned GraphQL errors:`, result.errors);
    }
  } finally {
    setSqlCaptureSink(null);
  }
  return captured;
}

/** Re-runs one captured statement under EXPLAIN (ANALYZE, BUFFERS) and extracts the execution
 * time (ms) and the list of distinct relations hit by a Seq Scan node, from the text plan. */
async function explainStatement(sqlClient: ReturnType<typeof postgres>, stmt: CapturedStatement): Promise<{ ms: number | null; seqScans: string[] }> {
  const trimmed = stmt.sql.trim();
  // Skip transaction-control / non-SELECT statements -- nothing meaningful to EXPLAIN.
  if (!/^select/i.test(trimmed)) {
    return { ms: null, seqScans: [] };
  }
  const rows = await sqlClient.unsafe(`EXPLAIN (ANALYZE, BUFFERS) ${trimmed}`, stmt.params as never[]);
  const planText = rows.map((r: Record<string, unknown>) => Object.values(r)[0]).join('\n');
  const msMatch = planText.match(/Execution Time: ([\d.]+) ms/);
  const seqScans = Array.from(planText.matchAll(/Seq Scan on (\w+)/g)).map((m) => m[1]);
  return { ms: msMatch ? Number(msMatch[1]) : null, seqScans: Array.from(new Set(seqScans)) };
}

async function runGetEventsScenario(
  schema: ReturnType<typeof buildSchema>,
  context: GraphQLContext,
  sqlClient: ReturnType<typeof postgres>,
  name: string,
  source: string,
  variableValues: Record<string, unknown>
): Promise<ScenarioResult> {
  const captured = await runScenario(schema, context, name, source, variableValues);
  const selects = captured.filter((s) => /^select/i.test(s.sql.trim()));

  // Story 2.7's main `getEvents` select orders by a correlated "next upcoming schedule"
  // subquery and is reliably the single largest statement; `totalCount` is a separate,
  // smaller `count(*)` statement. Heuristic matches the baseline doc's own table shape.
  let mainSelect: CapturedStatement | null = null;
  let totalCountSelect: CapturedStatement | null = null;
  for (const s of selects) {
    if (/count\(/i.test(s.sql) && /^select\s+count/i.test(s.sql.trim())) {
      totalCountSelect = s;
    } else if (!mainSelect || s.sql.length > mainSelect.sql.length) {
      mainSelect = s;
    }
  }

  const mainExplain = mainSelect ? await explainStatement(sqlClient, mainSelect) : { ms: null, seqScans: [] };
  const totalCountExplain = totalCountSelect ? await explainStatement(sqlClient, totalCountSelect) : { ms: null, seqScans: [] };

  return {
    name,
    statementCount: captured.length,
    mainSelectMs: mainExplain.ms,
    totalCountMs: totalCountExplain.ms,
    seqScansInMainSelect: mainExplain.seqScans,
  };
}

async function runEventBySlugScenario(
  schema: ReturnType<typeof buildSchema>,
  context: GraphQLContext,
  sqlClient: ReturnType<typeof postgres>,
  source: string,
  variableValues: Record<string, unknown>
): Promise<ScenarioResult> {
  const captured = await runScenario(schema, context, 'eventBySlug (mid-table event)', source, variableValues);
  const selects = captured.filter((s) => /^select/i.test(s.sql.trim()));

  let maxMs = 0;
  const seqScans = new Set<string>();
  for (const s of selects) {
    const { ms, seqScans: scans } = await explainStatement(sqlClient, s);
    if (ms !== null) maxMs = Math.max(maxMs, ms);
    scans.forEach((t) => seqScans.add(t));
  }

  return {
    name: 'eventBySlug (mid-table event)',
    statementCount: selects.length,
    mainSelectMs: maxMs,
    totalCountMs: null,
    seqScansInMainSelect: Array.from(seqScans),
  };
}

function renderTable(results: ScenarioResult[]): string {
  const header = '| Scenario | Statements | Main select | `totalCount` select | Seq scans in main select |\n|---|---|---|---|---|';
  const rows = results.map((r) => {
    const main = r.mainSelectMs !== null ? `**${r.mainSelectMs.toFixed(1)} ms**` : 'n/a';
    const totalCount = r.totalCountMs !== null ? `${r.totalCountMs.toFixed(1)} ms` : '—';
    const scans = r.seqScansInMainSelect.length > 0 ? r.seqScansInMainSelect.join(', ') : 'none';
    return `| ${r.name} | ${r.statementCount} | ${main} | ${totalCount} | ${scans} |`;
  });
  return [header, ...rows].join('\n');
}

async function main(): Promise<void> {
  const env = loadBackendEnv();
  if (!env.databaseUrl) {
    throw new Error('DATABASE_URL is not defined -- cannot run EXPLAIN re-run.');
  }
  const explainClient = postgres(env.databaseUrl, { max: 1, prepare: false });

  const schema = buildSchema();

  const [moderator] = await db.select({ id: users.id }).from(users).where(eq(users.role, 'moderator')).limit(1);
  const context: GraphQLContext = moderator ? { user: { userId: moderator.id, role: 'moderator' } } : { user: null };

  let subscribedAccountId: string | null = null;
  if (moderator) {
    const [sub] = await db
      .select({ accountId: subscriptions.accountId })
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, moderator.id), activeOnly(subscriptions)))
      .limit(1);
    subscribedAccountId = sub?.accountId ?? null;
  }
  if (!subscribedAccountId) {
    const [anyProfile] = await db.select({ id: socialMediaAccountProfiles.id }).from(socialMediaAccountProfiles).limit(1);
    subscribedAccountId = anyProfile?.id ?? null;
  }

  const [eventCountRow] = (await db.execute(
    sql`SELECT count(*)::text AS count FROM events WHERE deleted_at IS NULL`
  )) as unknown as Array<{ count: string }>;
  const midOffset = Math.floor(Number(eventCountRow?.count ?? 0) / 2);
  const [midEvent] = await db.select({ slug: events.slug }).from(events).where(activeOnly(events)).limit(1).offset(midOffset);

  const getEventsQuery = extractWebClientOperation('getEvents');
  const getEventBySlugQuery = extractWebClientOperation('getEventBySlug');

  const results: ScenarioResult[] = [];

  results.push(await runGetEventsScenario(schema, context, explainClient, 'getEvents plain, limit 20', getEventsQuery, { limit: 20 }));

  // The web client's own getEvents operation only declares `$query: EventQueryConditionInput`
  // (no `$filter` argument reaches the server at all -- `EventFilterInput` is translated into
  // the `query` DSL tree client-side before the request is sent). Reproduce that translation
  // here via the same shared `buildEventsQueryCondition` the client/server both use, so the
  // `query` variable sent below is exactly the shape a real client request would carry.
  const upcomingCondition = buildEventsQueryCondition({ filter: { temporalFilter: 'UPCOMING' }, currentDate: new Date() });
  results.push(
    await runGetEventsScenario(schema, context, explainClient, 'getEvents temporal filter UPCOMING', getEventsQuery, {
      limit: 20,
      query: upcomingCondition,
    })
  );

  const accountCondition = subscribedAccountId
    ? buildEventsQueryCondition({ filter: { accountId: subscribedAccountId }, currentDate: new Date() })
    : undefined;
  results.push(
    await runGetEventsScenario(schema, context, explainClient, 'getEvents filtered by a subscribed account', getEventsQuery, {
      limit: 20,
      query: accountCondition,
    })
  );

  if (midEvent) {
    results.push(await runEventBySlugScenario(schema, context, explainClient, getEventBySlugQuery, { slug: midEvent.slug }));
  } else {
    console.warn('[explain-events-queries] No events found -- skipping eventBySlug scenario.');
  }

  const table = renderTable(results);
  console.log('\n' + table + '\n');
  console.log('Copy this table into a dated cc-024-explain-after-3.6r-<date>.md comparison doc (see cc-024-explain-baseline-2026-10-01.md for the format).');

  await explainClient.end();
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('[explain-events-queries] Failed:', error);
    process.exit(1);
  });
