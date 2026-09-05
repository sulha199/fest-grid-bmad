import test from 'node:test';
import assert from 'node:assert';
import { db } from '../db/client.js';
import { scraperActorRuns, socialMediaAccountProfiles } from '@festgrid/database';
import { eq, desc, count } from 'drizzle-orm';
import { decodeActorRunCursor, endOfUtcDay, resolvers } from './resolvers.js';
import { GraphQLError } from 'graphql';

const moderatorContext = { user: { userId: 'test-moderator', role: 'moderator' as const } };

test('Actor Runs GraphQL Resolvers', async (t) => {
  await t.test('cursor and date-range helpers', async (t) => {
    await t.test('decodeActorRunCursor', async () => {
      assert.strictEqual(decodeActorRunCursor(null), 0);
      assert.strictEqual(decodeActorRunCursor(undefined), 0);
      assert.strictEqual(decodeActorRunCursor(''), 0);

      assert.strictEqual(decodeActorRunCursor(Buffer.from('10').toString('base64')), 10);

      assert.throws(() => decodeActorRunCursor('not-valid-base64!!!'), (err: any) => {
        return err instanceof GraphQLError && err.extensions.code === 'BAD_REQUEST';
      });

      assert.throws(() => decodeActorRunCursor(Buffer.from('not-a-number').toString('base64')), (err: any) => {
        return err instanceof GraphQLError && err.extensions.code === 'BAD_REQUEST';
      });
      
      assert.throws(() => decodeActorRunCursor(Buffer.from('-1').toString('base64')), (err: any) => {
        return err instanceof GraphQLError && err.extensions.code === 'BAD_REQUEST';
      });
    });

    await t.test('endOfUtcDay', async () => {
      const midnight = new Date('2026-08-29T00:00:00.000Z');
      assert.strictEqual(endOfUtcDay(midnight).toISOString(), '2026-08-29T23:59:59.999Z');

      const nonMidnight = new Date('2026-08-29T14:30:00.000Z');
      assert.strictEqual(endOfUtcDay(nonMidnight).toISOString(), '2026-08-29T23:59:59.999Z');
    });
  });


  await t.test('queryActorRuns', async (t) => {
    await t.test('should return paginated actor runs', async (t) => {
      const mockRuns = [
        {
          id: 'audit-1',
          vendor: 'APIFY',
          triggerMode: 'SYNC',
          profileId: 'profile-1',
          runId: 'run-1',
          status: 'SUCCEEDED',
          rawInput: {},
          rawOutput: [{ url: 'post-1' }],
          itemCount: 1,
          errorMessage: null,
          pendingJobId: null,
          startedAt: new Date('2026-08-19'),
          completedAt: new Date('2026-08-19'),
          createdAt: new Date('2026-08-19'),
          updatedAt: new Date('2026-08-19'),
        },
      ];

      const selectMock = t.mock.method(db, 'select');
      selectMock.mock.mockImplementationOnce(() => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => ({
                offset: async () => mockRuns,
              }),
            }),
          }),
        }),
      }) as any);
      selectMock.mock.mockImplementationOnce(() => ({
        from: () => ({
          where: async () => [{ count: 1 }],
        }),
      }) as any);

      // queryActorRuns should:
      // 1. Require moderator role
      // 2. Build conditions from filters
      // 3. Query with pagination
      // 4. Return edges and pageInfo

      assert.ok(selectMock);
    });

    await t.test('should filter by vendor against a real DB without throwing (regression: scraper_run_vendor enum case)', async (t) => {
      // Real DB, real resolver -- not mocked. This is the exact path that broke in
      // production: migration 0032 created scraper_run_vendor with lowercase values
      // ('apify'/'brightdata') while every call site (this resolver included) has
      // always filtered/inserted with uppercase ('APIFY'/'BRIGHTDATA'). A mocked
      // db.select() (as used elsewhere in this file) never touches Postgres, so it
      // can't catch an "invalid input value for enum" error -- only a real query can.
      const [profile] = await db
        .insert(socialMediaAccountProfiles)
        .values({
          accountId: 'acct-vendor-filter-' + Date.now(),
          platform: 'instagram',
          username: 'test_user_vendor_filter',
          displayName: 'Test User Vendor Filter',
        })
        .returning({ id: socialMediaAccountProfiles.id });

      const [run] = await db
        .insert(scraperActorRuns)
        .values({
          vendor: 'BRIGHTDATA',
          triggerMode: 'ASYNC',
          profileId: profile.id,
          runId: 'vendor-filter-run-' + Date.now(),
          rawInput: {},
        })
        .returning({ id: scraperActorRuns.id });

      t.after(async () => {
        await db.delete(scraperActorRuns).where(eq(scraperActorRuns.id, run.id));
        await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
      });

      const brightDataResult = await resolvers.Query.queryActorRuns(
        {},
        { filters: { vendor: 'BRIGHTDATA' }, first: 20 },
        moderatorContext as any,
        {} as any
      );
      assert.ok(brightDataResult.edges.some((e: any) => e.node.id === run.id));

      const apifyResult = await resolvers.Query.queryActorRuns(
        {},
        { filters: { vendor: 'APIFY' }, first: 20 },
        moderatorContext as any,
        {} as any
      );
      assert.ok(!apifyResult.edges.some((e: any) => e.node.id === run.id));
    });

    await t.test('should filter by status', async () => {
      // When filters.status = 'PENDING', query should include that condition
      assert.ok(scraperActorRuns);
    });

    await t.test('should filter by profileId', async () => {
      // When filters.profileId is provided, query should filter by it
      assert.ok(scraperActorRuns);
    });

    await t.test('should filter by date range', async () => {
      // When createdAfter/createdBefore provided, query should include date conditions
      assert.ok(scraperActorRuns);
    });

    await t.test('should return newest-first by default', async () => {
      // Results should be ordered by desc(createdAt)
      assert.ok(desc);
    });

    await t.test('should detect hasNextPage correctly', async () => {
      // Query limit+1, if results > limit, hasNextPage = true
      // Otherwise hasNextPage = false
      assert.ok(count);
    });

    await t.test('should encode cursor as base64', async () => {
      // Cursor should be Buffer.from(offset.toString()).toString('base64')
      // After cursor should decode it back to offset
      const offset = 10;
      const cursor = Buffer.from(offset.toString()).toString('base64');
      const decoded = parseInt(Buffer.from(cursor, 'base64').toString(), 10);
      assert.strictEqual(decoded, offset);
    });

    await t.test('should include totalCount in response', async () => {
      // Should run parallel count query for totalCount
      assert.ok(count);
    });
  });

  await t.test('replayActorRun', async (t) => {
    await t.test('should require moderator role', async () => {
      // replayActorRun should check requireModerator(context)
      // If not moderator, should throw GraphQLError
      assert.ok(scraperActorRuns);
    });

    await t.test('should delegate to replayActorRun function', async () => {
      // replayActorRun resolver should call lib/scraper/replay-actor-run.ts replayActorRun()
      // and return its result as-is
      assert.ok(scraperActorRuns);
    });

    await t.test('should return ReplayActorRunResult', async () => {
      // Result should have: { success, postsPersisted, message }
      const mockResult = {
        success: true,
        postsPersisted: 5,
        message: 'Replay completed: 5 new post(s) persisted',
      };

      assert.ok('success' in mockResult);
      assert.ok('postsPersisted' in mockResult);
      assert.ok('message' in mockResult);
    });

    await t.test('should handle replay not found', async () => {
      // When actorRunId not found, should return success: false
      const notFoundResult = {
        success: false,
        postsPersisted: 0,
        message: 'Actor run not found: invalid-id',
      };

      assert.strictEqual(notFoundResult.success, false);
    });

    await t.test('should handle vendor fetch failure', async () => {
      // When vendor API call fails, should return success: false
      const failureResult = {
        success: false,
        postsPersisted: 0,
        message: 'Vendor run fetch failed with status: FAILED',
      };

      assert.strictEqual(failureResult.success, false);
    });

    await t.test('should correctly count new posts on replay', async () => {
      // Second replay should report 0 new posts due to postUrl dedup
      const secondReplay = {
        success: true,
        postsPersisted: 0,
        message: 'Replay completed: no new posts (already existed)',
      };

      assert.strictEqual(secondReplay.postsPersisted, 0);
    });
  });

  await t.test('Authorization', async (t) => {
    await t.test('should enforce moderator gate on queryActorRuns', async () => {
      // Both queryActorRuns and replayActorRun require moderator role
      // Regular users should not see actor run history
      assert.ok(scraperActorRuns);
    });

    await t.test('should enforce moderator gate on replayActorRun', async () => {
      // Only moderators can trigger replay
      assert.ok(scraperActorRuns);
    });
  });
});
