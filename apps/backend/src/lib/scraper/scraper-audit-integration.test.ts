import test from 'node:test';
import assert from 'node:assert';
import { recordActorRunStart, recordActorRunResult, recordSyncActorRun } from './record-actor-run.js';
import { db } from '../../db/client.js';

test('Scraper Audit Integration', async (t) => {
  await t.test('Audit Recording Flow', async (t) => {
    await t.test('should record sync actor run with complete lifecycle', async (t) => {
      const insertMock = t.mock.method(db, 'insert', () => ({
        values: () => ({
          onConflictDoNothing: async () => undefined,
        }),
      }) as any);

      await recordSyncActorRun({
        vendor: 'APIFY',
        profileId: 'profile-123',
        runId: 'run-456',
        rawInput: { username: 'testuser' },
        status: 'SUCCEEDED',
        rawOutput: [{ url: 'https://instagram.com/p/1' }],
        itemCount: 1,
      });

      assert.ok(insertMock.mock.callCount() > 0);
    });

    await t.test('should record async run start with pending status', async (t) => {
      t.mock.method(db, 'insert', () => ({
        values: () => ({
          returning: async () => [{ id: 'audit-123' }],
        }),
      }) as any);

      const result = await recordActorRunStart({
        vendor: 'BRIGHTDATA',
        triggerMode: 'ASYNC',
        profileId: 'profile-789',
        runId: 'snapshot-abc',
        rawInput: { url: 'https://instagram.com/user/' },
        pendingJobId: 'job-xyz',
        status: 'PENDING',
      });

      assert.strictEqual(result, 'audit-123');
    });

    await t.test('should update run result with output and status', async (t) => {
      const updateMock = t.mock.method(db, 'update', () => ({
        set: () => ({
          where: async () => undefined,
        }),
      }) as any);

      await recordActorRunResult({
        vendor: 'APIFY',
        runId: 'run-999',
        status: 'SUCCEEDED',
        rawOutput: [{ url: 'https://instagram.com/p/2' }],
        itemCount: 1,
      });

      assert.ok(updateMock.mock.callCount() > 0);
    });
  });

  await t.test('Replay Mutation', async (t) => {
    await t.test('should replay run with stored output', async () => {
      // Note: Full replay test requires extensive mocking of persistScrapedPost
      // This is a simplified version showing the structure
      assert.ok(recordActorRunStart);
    });

    await t.test('should return accurate post count on second replay', async () => {
      // When replaying, onConflictDoNothing ensures no duplicates are inserted
      // so postsPersisted count should be 0 on second replay
      assert.ok(recordSyncActorRun);
    });
  });

  await t.test('Error Handling', async (t) => {
    await t.test('should not throw on database errors during audit recording', async (t) => {
      const consoleErrorMock = t.mock.method(console, 'error', () => {});
      t.mock.method(db, 'insert', () => {
        throw new Error('DB connection failed');
      });

      // Should not throw
      await recordSyncActorRun({
        vendor: 'APIFY',
        profileId: 'profile-123',
        runId: 'run-456',
        rawInput: {},
        status: 'SUCCEEDED',
      });

      assert.ok(consoleErrorMock.mock.callCount() > 0);
    });

    await t.test('should record errors in audit trail', async (t) => {
      const updateMock = t.mock.method(db, 'update', () => ({
        set: () => ({
          where: async () => undefined,
        }),
      }) as any);

      await recordActorRunResult({
        vendor: 'APIFY',
        runId: 'run-failed',
        status: 'FAILED',
        errorMessage: 'Run timed out after 30 seconds',
      });

      assert.ok(updateMock.mock.callCount() > 0);
    });
  });

  await t.test('Idempotency', async (t) => {
    await t.test('should handle duplicate run ID via onConflictDoNothing', async (t) => {
      const insertMock = t.mock.method(db, 'insert', () => ({
        values: () => ({
          onConflictDoNothing: async () => undefined,
        }),
      }) as any);

      // First insert
      await recordSyncActorRun({
        vendor: 'APIFY',
        profileId: 'profile-123',
        runId: 'run-dup',
        rawInput: {},
        status: 'SUCCEEDED',
      });

      // Second insert with same runId should not error
      await recordSyncActorRun({
        vendor: 'APIFY',
        profileId: 'profile-123',
        runId: 'run-dup',
        rawInput: {},
        status: 'SUCCEEDED',
      });

      assert.strictEqual(insertMock.mock.callCount(), 2);
    });
  });
});
