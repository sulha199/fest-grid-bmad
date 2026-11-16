import test from 'node:test';
import assert from 'node:assert';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { graphql } from 'graphql';
import { createSchema } from 'graphql-yoga';
import { jobs, scraperActorRuns, socialMediaAccountProfiles, unprocessedScraperPayloads, users } from '@festgrid/database';
import { decodeActorRunCursor, encodeActorRunCursor, resolvers } from './resolvers.js';

// The four moderator-tools lists (unprocessed payloads, actor runs, moderator accounts and, in
// event-merges.test.ts, suggested event matches) share one cursor: an offset into the filtered list.
// Every other test of these resolvers mocks `db.select()` or reads only the first page, so an
// off-by-one in the cursor (the last row of each page repeated at the top of the next) shipped unseen.
// These tests read real rows and walk the list the way the web client does: `after: endCursor`.

const moderatorContext = { user: { userId: 'test-moderator', role: 'moderator' as const } };
const PAGE_SIZE = 2;

type Connection = {
  edges: { node: { id: string }; cursor: string }[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  totalCount?: number;
};

async function walkPages(
  fetchPage: (after: string | null) => Promise<Connection>,
): Promise<{ pages: Connection[]; ids: string[] }> {
  const pages: Connection[] = [];
  let after: string | null = null;
  // A bound keeps a regression that never reports `hasNextPage: false` from hanging the run.
  for (let i = 0; i < 20; i++) {
    const page = await fetchPage(after);
    pages.push(page);
    if (!page.pageInfo.hasNextPage) break;
    after = page.pageInfo.endCursor;
  }
  return { pages, ids: pages.flatMap((p) => p.edges.map((e) => e.node.id)) };
}

function assertWalkedWithoutOverlap(walk: { pages: Connection[]; ids: string[] }, expectedIds: string[]) {
  assert.deepStrictEqual(
    walk.pages.map((p) => p.edges.length),
    [PAGE_SIZE, PAGE_SIZE, 1],
    'five rows at two per page read as 2 + 2 + 1',
  );
  assert.strictEqual(new Set(walk.ids).size, walk.ids.length, `no row may appear on two pages: ${walk.ids.join(', ')}`);
  assert.deepStrictEqual(walk.ids, expectedIds, 'every row exactly once, in list order');
  assert.deepStrictEqual(
    walk.pages.map((p) => p.pageInfo.hasNextPage),
    [true, true, false],
  );
}

test('encodeActorRunCursor / decodeActorRunCursor', async (t) => {
  await t.test('a cursor names the position after its row, so decoding it gives the next offset', () => {
    assert.strictEqual(decodeActorRunCursor(encodeActorRunCursor(1)), 1);
    assert.strictEqual(decodeActorRunCursor(encodeActorRunCursor(40)), 40);
  });
});

test('moderator list cursors page without overlap (real DB)', async (t) => {
  const suffix = `${Date.now()}-mlp`;

  await t.test('queryActorRuns', async (t) => {
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({ accountId: `acct-${suffix}-runs`, platform: 'instagram', username: `mlp_runs_${suffix}`, displayName: 'Pagination runs' })
      .returning({ id: socialMediaAccountProfiles.id });

    // Distinct createdAt values: the list is newest first, so the expected order is known exactly.
    const created: { id: string }[] = [];
    for (let i = 0; i < 5; i++) {
      const [run] = await db
        .insert(scraperActorRuns)
        .values({
          vendor: 'APIFY',
          triggerMode: 'SYNC',
          profileId: profile.id,
          runId: `${suffix}-run-${i}`,
          rawInput: {},
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
        })
        .returning({ id: scraperActorRuns.id });
      created.push(run);
    }
    t.after(async () => {
      await db.delete(scraperActorRuns).where(eq(scraperActorRuns.profileId, profile.id));
      await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
    });

    const queryActorRuns = (resolvers.Query as any).queryActorRuns;
    const walk = await walkPages((after) =>
      queryActorRuns({}, { filters: { profileId: profile.id }, first: PAGE_SIZE, after }, moderatorContext, {}),
    );

    assertWalkedWithoutOverlap(walk, created.map((r) => r.id).reverse());
    assert.strictEqual(walk.pages[0].totalCount, 5);
  });

  await t.test('queryModeratorAccountProfiles', async (t) => {
    const names = ['A', 'B', 'C', 'D', 'E'].map((letter) => `PgAcct-${suffix}-${letter}`);
    const rows = await db
      .insert(socialMediaAccountProfiles)
      .values(
        names.map((name, i) => ({
          accountId: `acct-${suffix}-acc-${i}`,
          platform: 'instagram',
          username: `mlp_acc_${suffix}_${i}`,
          displayName: name,
        })),
      )
      .returning({ id: socialMediaAccountProfiles.id, displayName: socialMediaAccountProfiles.displayName });
    t.after(async () => {
      await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, rows.map((r) => r.id)));
    });

    const queryModeratorAccountProfiles = (resolvers.Query as any).queryModeratorAccountProfiles;
    const walk = await walkPages((after) =>
      queryModeratorAccountProfiles({}, { filters: { search: `PgAcct-${suffix}` }, first: PAGE_SIZE, after }, moderatorContext, {}),
    );

    const idByName = new Map(rows.map((r) => [r.displayName, r.id]));
    assertWalkedWithoutOverlap(walk, names.map((n) => idByName.get(n)!));
    assert.strictEqual(walk.pages[0].totalCount, 5);
  });

  await t.test('queryUnprocessedPayloads', async (t) => {
    const parserVersion = `pg-${suffix}`;
    const created: { id: string }[] = [];
    for (let i = 0; i < 5; i++) {
      const [row] = await db
        .insert(unprocessedScraperPayloads)
        .values({
          rawPayload: { i },
          validationError: { message: 'pagination test' },
          context: { source: 'instagram', parserVersion },
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
        })
        .returning({ id: unprocessedScraperPayloads.id });
      created.push(row);
    }
    t.after(async () => {
      await db.delete(unprocessedScraperPayloads).where(inArray(unprocessedScraperPayloads.id, created.map((r) => r.id)));
    });

    const queryUnprocessedPayloads = (resolvers.Query as any).queryUnprocessedPayloads;
    const walk = await walkPages((after) =>
      queryUnprocessedPayloads({}, { filters: { parserVersion }, first: PAGE_SIZE, after }, moderatorContext, {}),
    );

    assertWalkedWithoutOverlap(walk, created.map((r) => r.id).reverse());
    assert.strictEqual(walk.pages[0].totalCount, 5);
  });
});

// Rows that share their sort key (`createdAt`, `displayName`) have no defined order among themselves unless
// the ORDER BY ends in a unique key, and under LIMIT/OFFSET Postgres may break such a tie differently for each
// page. Five rows with an identical key must come back in `id` order (newest-first lists: descending id), so
// the order is the same on every page query. Without the `id` tiebreaker they come back in physical order,
// which for random UUIDs is almost never id order.
test('rows that tie on the sort key page in id order (real DB)', async (t) => {
  const suffix = `${Date.now()}-tie`;
  const sameInstant = new Date(Date.UTC(2026, 0, 1, 12, 0, 0));
  const byIdAsc = (ids: string[]) => [...ids].sort();
  const byIdDesc = (ids: string[]) => [...ids].sort().reverse();

  await t.test('queryActorRuns', async (t) => {
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({ accountId: `acct-${suffix}-runs`, platform: 'instagram', username: `tie_runs_${suffix}`, displayName: 'Tie runs' })
      .returning({ id: socialMediaAccountProfiles.id });
    const rows = await db
      .insert(scraperActorRuns)
      .values(
        [0, 1, 2, 3, 4].map((i) => ({
          vendor: 'APIFY' as const,
          triggerMode: 'SYNC' as const,
          profileId: profile.id,
          runId: `${suffix}-run-${i}`,
          rawInput: {},
          createdAt: sameInstant,
        })),
      )
      .returning({ id: scraperActorRuns.id });
    t.after(async () => {
      await db.delete(scraperActorRuns).where(eq(scraperActorRuns.profileId, profile.id));
      await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
    });

    const queryActorRuns = (resolvers.Query as any).queryActorRuns;
    const walk = await walkPages((after) =>
      queryActorRuns({}, { filters: { profileId: profile.id }, first: PAGE_SIZE, after }, moderatorContext, {}),
    );
    assertWalkedWithoutOverlap(walk, byIdDesc(rows.map((r) => r.id)));
  });

  await t.test('queryModeratorAccountProfiles', async (t) => {
    const displayName = `PgTie-${suffix}`;
    const rows = await db
      .insert(socialMediaAccountProfiles)
      .values(
        [0, 1, 2, 3, 4].map((i) => ({
          accountId: `acct-${suffix}-acc-${i}`,
          platform: 'instagram',
          username: `tie_acc_${suffix}_${i}`,
          displayName,
        })),
      )
      .returning({ id: socialMediaAccountProfiles.id });
    t.after(async () => {
      await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, rows.map((r) => r.id)));
    });

    const queryModeratorAccountProfiles = (resolvers.Query as any).queryModeratorAccountProfiles;
    const walk = await walkPages((after) =>
      queryModeratorAccountProfiles({}, { filters: { search: displayName }, first: PAGE_SIZE, after }, moderatorContext, {}),
    );
    assertWalkedWithoutOverlap(walk, byIdAsc(rows.map((r) => r.id)));
  });

  await t.test('queryUnprocessedPayloads', async (t) => {
    const parserVersion = `tie-${suffix}`;
    const rows = await db
      .insert(unprocessedScraperPayloads)
      .values(
        [0, 1, 2, 3, 4].map((i) => ({
          rawPayload: { i },
          validationError: { message: 'tie test' },
          context: { source: 'instagram', parserVersion },
          createdAt: sameInstant,
        })),
      )
      .returning({ id: unprocessedScraperPayloads.id });
    t.after(async () => {
      await db.delete(unprocessedScraperPayloads).where(inArray(unprocessedScraperPayloads.id, rows.map((r) => r.id)));
    });

    const queryUnprocessedPayloads = (resolvers.Query as any).queryUnprocessedPayloads;
    const walk = await walkPages((after) =>
      queryUnprocessedPayloads({}, { filters: { parserVersion }, first: PAGE_SIZE, after }, moderatorContext, {}),
    );
    assertWalkedWithoutOverlap(walk, byIdDesc(rows.map((r) => r.id)));
  });
});

// Story 10.4 (Part A): `myJobs` pages with the same cursor (the position after its row) and ends its ORDER BY in `id`, so rows that share
// one `created_at` (a batch written in one transaction) are neither repeated nor skipped. Executed through the real schema, because the
// resolver reads the selection set.
test('myJobs pages without overlap when rows share one created_at (real DB)', async (t) => {
  const suffix = `${Date.now()}-jobs`;
  const schemaDir = path.resolve(process.cwd(), 'src/schema');
  const typeDefs = fs.readdirSync(schemaDir).filter((f) => f.endsWith('.graphql')).map((f) => fs.readFileSync(path.join(schemaDir, f), 'utf8')).join('\n');
  const schema = createSchema({ typeDefs, resolvers: resolvers as any });

  const [owner] = await db.insert(users).values({ email: `mlp-jobs-${suffix}@example.test` }).returning({ id: users.id });
  const sameInstant = new Date(Date.UTC(2026, 5, 1, 12, 0, 0));
  const rows = await db
    .insert(jobs)
    .values(
      [0, 1, 2, 3, 4].map((i) => ({
        type: 'reextract-post',
        ownerUserId: owner.id,
        trigger: 'USER' as const,
        inputKey: `mlp-${suffix}-${i}`,
        status: 'SUCCEEDED' as const,
        deadlineAt: new Date(),
        finishedAt: new Date(),
        createdAt: sameInstant,
      })),
    )
    .returning({ id: jobs.id });
  t.after(async () => {
    await db.delete(jobs).where(inArray(jobs.id, rows.map((r) => r.id)));
    await db.delete(users).where(eq(users.id, owner.id));
  });

  const source = `query($first: Int, $after: String) { myJobs(onlyEnded: true, first: $first, after: $after) { totalCount pageInfo { hasNextPage endCursor } edges { cursor node { id } } } }`;
  const walk = await walkPages(async (after) => {
    const result = await graphql({ schema, source, variableValues: { first: PAGE_SIZE, after }, contextValue: { user: { userId: owner.id, role: 'user' } } });
    assert.strictEqual(result.errors, undefined);
    return (result.data as any).myJobs as Connection;
  });
  assertWalkedWithoutOverlap(walk, rows.map((r) => r.id).sort().reverse());
  assert.strictEqual(walk.pages[0].totalCount, 5);
});
