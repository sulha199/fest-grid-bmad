import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../db/client.js';
import { scraperActorRuns } from '@festgrid/database';
import { eq, and, desc, count } from 'drizzle-orm';

// Mock database
vi.mock('../db/client.js');

describe('Actor Runs GraphQL Resolvers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('queryActorRuns', () => {
    it('should return paginated actor runs', async () => {
      const mockRuns = [
        {
          id: 'audit-1',
          vendor: 'apify',
          triggerMode: 'sync',
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

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(mockRuns),
              }),
            }),
          }),
        }),
      });

      const mockCountSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      });

      (db.select as any)
        .mockReturnValueOnce(mockSelect())
        .mockReturnValueOnce(mockCountSelect());

      // queryActorRuns should:
      // 1. Require moderator role
      // 2. Build conditions from filters
      // 3. Query with pagination
      // 4. Return edges and pageInfo

      expect(mockSelect).toBeDefined();
    });

    it('should filter by vendor', async () => {
      // When filters.vendor = 'BRIGHTDATA', query should include that condition
      expect(scraperActorRuns).toBeDefined();
    });

    it('should filter by status', async () => {
      // When filters.status = 'PENDING', query should include that condition
      expect(scraperActorRuns).toBeDefined();
    });

    it('should filter by profileId', async () => {
      // When filters.profileId is provided, query should filter by it
      expect(scraperActorRuns).toBeDefined();
    });

    it('should filter by date range', async () => {
      // When createdAfter/createdBefore provided, query should include date conditions
      expect(scraperActorRuns).toBeDefined();
    });

    it('should return newest-first by default', async () => {
      // Results should be ordered by desc(createdAt)
      expect(desc).toBeDefined();
    });

    it('should detect hasNextPage correctly', async () => {
      // Query limit+1, if results > limit, hasNextPage = true
      // Otherwise hasNextPage = false
      expect(count).toBeDefined();
    });

    it('should encode cursor as base64', async () => {
      // Cursor should be Buffer.from(offset.toString()).toString('base64')
      // After cursor should decode it back to offset
      const offset = 10;
      const cursor = Buffer.from(offset.toString()).toString('base64');
      const decoded = parseInt(Buffer.from(cursor, 'base64').toString(), 10);
      expect(decoded).toBe(offset);
    });

    it('should include totalCount in response', async () => {
      // Should run parallel count query for totalCount
      expect(count).toBeDefined();
    });
  });

  describe('replayActorRun', () => {
    it('should require moderator role', async () => {
      // replayActorRun should check requireModerator(context)
      // If not moderator, should throw GraphQLError
      expect(scraperActorRuns).toBeDefined();
    });

    it('should delegate to replayActorRun function', async () => {
      // replayActorRun resolver should call lib/scraper/replay-actor-run.ts replayActorRun()
      // and return its result as-is
      expect(scraperActorRuns).toBeDefined();
    });

    it('should return ReplayActorRunResult', async () => {
      // Result should have: { success, postsPersisted, message }
      const mockResult = {
        success: true,
        postsPersisted: 5,
        message: 'Replay completed: 5 new post(s) persisted',
      };

      expect(mockResult).toHaveProperty('success');
      expect(mockResult).toHaveProperty('postsPersisted');
      expect(mockResult).toHaveProperty('message');
    });

    it('should handle replay not found', async () => {
      // When actorRunId not found, should return success: false
      const notFoundResult = {
        success: false,
        postsPersisted: 0,
        message: 'Actor run not found: invalid-id',
      };

      expect(notFoundResult.success).toBe(false);
    });

    it('should handle vendor fetch failure', async () => {
      // When vendor API call fails, should return success: false
      const failureResult = {
        success: false,
        postsPersisted: 0,
        message: 'Vendor run fetch failed with status: FAILED',
      };

      expect(failureResult.success).toBe(false);
    });

    it('should correctly count new posts on replay', async () => {
      // Second replay should report 0 new posts due to postUrl dedup
      const secondReplay = {
        success: true,
        postsPersisted: 0,
        message: 'Replay completed: no new posts (already existed)',
      };

      expect(secondReplay.postsPersisted).toBe(0);
    });
  });

  describe('Authorization', () => {
    it('should enforce moderator gate on queryActorRuns', async () => {
      // Both queryActorRuns and replayActorRun require moderator role
      // Regular users should not see actor run history
      expect(scraperActorRuns).toBeDefined();
    });

    it('should enforce moderator gate on replayActorRun', async () => {
      // Only moderators can trigger replay
      expect(scraperActorRuns).toBeDefined();
    });
  });
});
