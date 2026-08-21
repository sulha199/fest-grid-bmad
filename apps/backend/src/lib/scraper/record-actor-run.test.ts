import test from 'node:test';
import assert from 'node:assert';
import { recordActorRunStart, recordActorRunResult, recordSyncActorRun } from './record-actor-run.js';
import { db } from '../../db/client.js';

test('record-actor-run', async (t) => {
  await t.test('recordActorRunStart', async (t) => {
    await t.test('should insert a new pending actor run', async (t) => {
      t.mock.method(db, 'insert', () => ({
        values: () => ({
          returning: async () => [{ id: 'run-123' }],
        }),
      }) as any);

      const result = await recordActorRunStart({
        vendor: 'APIFY',
        triggerMode: 'ASYNC',
        profileId: 'profile-123',
        runId: 'apify-run-123',
        rawInput: { username: 'testuser' },
      });

      assert.strictEqual(result, 'run-123');
    });

    await t.test('should catch and log database errors without throwing', async (t) => {
      const consoleErrorMock = t.mock.method(console, 'error', () => {});
      t.mock.method(db, 'insert', () => {
        throw new Error('DB error');
      });

      const result = await recordActorRunStart({
        vendor: 'APIFY',
        triggerMode: 'ASYNC',
        profileId: 'profile-123',
        runId: 'apify-run-123',
        rawInput: { username: 'testuser' },
      });

      assert.strictEqual(result, null);
      assert.ok(consoleErrorMock.mock.callCount() > 0);
    });
  });

  await t.test('recordActorRunResult', async (t) => {
    await t.test('should update actor run result by id', async (t) => {
      const updateMock = t.mock.method(db, 'update', () => ({
        set: () => ({
          where: async () => undefined,
        }),
      }) as any);

      await recordActorRunResult({
        id: 'run-123',
        vendor: 'APIFY',
        runId: 'apify-run-123',
        status: 'SUCCEEDED',
        rawOutput: [{ url: 'https://instagram.com/p/123' }],
        itemCount: 1,
      });

      assert.ok(updateMock.mock.callCount() > 0);
    });

    await t.test('should catch and log database errors without throwing', async (t) => {
      const consoleErrorMock = t.mock.method(console, 'error', () => {});
      t.mock.method(db, 'update', () => {
        throw new Error('DB error');
      });

      await recordActorRunResult({
        id: 'run-123',
        vendor: 'APIFY',
        runId: 'apify-run-123',
        status: 'SUCCEEDED',
      });

      assert.ok(consoleErrorMock.mock.callCount() > 0);
    });
  });

  await t.test('recordSyncActorRun', async (t) => {
    await t.test('should insert a complete sync actor run', async (t) => {
      const insertMock = t.mock.method(db, 'insert', () => ({
        values: () => ({
          onConflictDoNothing: async () => undefined,
        }),
      }) as any);

      await recordSyncActorRun({
        vendor: 'APIFY',
        profileId: 'profile-123',
        runId: 'apify-run-123',
        rawInput: { username: 'testuser' },
        status: 'SUCCEEDED',
        rawOutput: [{ url: 'https://instagram.com/p/123' }],
        itemCount: 1,
      });

      assert.ok(insertMock.mock.callCount() > 0);
    });

    await t.test('should handle conflicts gracefully', async (t) => {
      const insertMock = t.mock.method(db, 'insert', () => ({
        values: () => ({
          onConflictDoNothing: async () => undefined,
        }),
      }) as any);

      await recordSyncActorRun({
        vendor: 'APIFY',
        profileId: 'profile-123',
        runId: 'apify-run-123',
        rawInput: { username: 'testuser' },
        status: 'FAILED',
        errorMessage: 'Timeout',
      });

      assert.ok(insertMock.mock.callCount() > 0);
    });

    await t.test('should catch and log database errors without throwing', async (t) => {
      const consoleErrorMock = t.mock.method(console, 'error', () => {});
      t.mock.method(db, 'insert', () => {
        throw new Error('DB error');
      });

      await recordSyncActorRun({
        vendor: 'APIFY',
        profileId: 'profile-123',
        runId: 'apify-run-123',
        rawInput: { username: 'testuser' },
        status: 'SUCCEEDED',
      });

      assert.ok(consoleErrorMock.mock.callCount() > 0);
    });
  });
});
