import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordActorRunStart, recordActorRunResult, recordSyncActorRun } from './record-actor-run.js';
import { db } from '../../db/client.js';

vi.mock('../../db/client.js');

describe('record-actor-run', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recordActorRunStart', () => {
    it('should insert a new pending actor run', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'run-123' }]),
        }),
      });

      (db.insert as any).mockReturnValue(mockInsert());

      const result = await recordActorRunStart({
        vendor: 'APIFY',
        triggerMode: 'ASYNC',
        profileId: 'profile-123',
        runId: 'apify-run-123',
        rawInput: { username: 'testuser' },
      });

      expect(result).toBe('run-123');
    });

    it('should catch and log database errors without throwing', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      (db.insert as any).mockImplementation(() => {
        throw new Error('DB error');
      });

      const result = await recordActorRunStart({
        vendor: 'APIFY',
        triggerMode: 'ASYNC',
        profileId: 'profile-123',
        runId: 'apify-run-123',
        rawInput: { username: 'testuser' },
      });

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('recordActorRunResult', () => {
    it('should update actor run result by id', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      (db.update as any).mockReturnValue(mockUpdate());

      await recordActorRunResult({
        id: 'run-123',
        vendor: 'APIFY',
        runId: 'apify-run-123',
        status: 'SUCCEEDED',
        rawOutput: [{ url: 'https://instagram.com/p/123' }],
        itemCount: 1,
      });

      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should catch and log database errors without throwing', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      (db.update as any).mockImplementation(() => {
        throw new Error('DB error');
      });

      await recordActorRunResult({
        id: 'run-123',
        vendor: 'APIFY',
        runId: 'apify-run-123',
        status: 'SUCCEEDED',
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('recordSyncActorRun', () => {
    it('should insert a complete sync actor run', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        }),
      });

      (db.insert as any).mockReturnValue(mockInsert());

      await recordSyncActorRun({
        vendor: 'APIFY',
        profileId: 'profile-123',
        runId: 'apify-run-123',
        rawInput: { username: 'testuser' },
        status: 'SUCCEEDED',
        rawOutput: [{ url: 'https://instagram.com/p/123' }],
        itemCount: 1,
      });

      expect(mockInsert).toHaveBeenCalled();
    });

    it('should handle conflicts gracefully', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        }),
      });

      (db.insert as any).mockReturnValue(mockInsert());

      await recordSyncActorRun({
        vendor: 'APIFY',
        profileId: 'profile-123',
        runId: 'apify-run-123',
        rawInput: { username: 'testuser' },
        status: 'FAILED',
        errorMessage: 'Timeout',
      });

      expect(mockInsert).toHaveBeenCalled();
    });

    it('should catch and log database errors without throwing', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      (db.insert as any).mockImplementation(() => {
        throw new Error('DB error');
      });

      await recordSyncActorRun({
        vendor: 'APIFY',
        profileId: 'profile-123',
        runId: 'apify-run-123',
        rawInput: { username: 'testuser' },
        status: 'SUCCEEDED',
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
