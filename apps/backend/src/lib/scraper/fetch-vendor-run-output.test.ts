import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchApifyRunOutput, fetchBrightDataRunOutput } from './fetch-vendor-run-output.js';
import { getApifyClient } from './instagram-adapter.js';
import { getBrightDataProgress, getBrightDataSnapshot } from './brightdata-client.js';

vi.mock('./instagram-adapter.js');
vi.mock('./brightdata-client.js');

describe('fetch-vendor-run-output', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchApifyRunOutput', () => {
    it('should fetch successful run output', async () => {
      const mockClient = {
        run: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            id: 'run-123',
            status: 'SUCCEEDED',
            defaultDatasetId: 'dataset-123',
          }),
        }),
        dataset: vi.fn().mockReturnValue({
          listItems: vi.fn().mockResolvedValue({
            items: [
              { url: 'https://instagram.com/p/123', caption: 'Test post' },
            ],
          }),
        }),
      };

      (getApifyClient as any).mockReturnValue(mockClient);

      const result = await fetchApifyRunOutput('run-123');

      expect(result.status).toBe('SUCCEEDED');
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        url: 'https://instagram.com/p/123',
        caption: 'Test post',
      });
    });

    it('should handle failed runs', async () => {
      const mockClient = {
        run: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            id: 'run-123',
            status: 'FAILED',
          }),
        }),
      };

      (getApifyClient as any).mockReturnValue(mockClient);

      const result = await fetchApifyRunOutput('run-123');

      expect(result.status).toBe('FAILED');
      expect(result.items).toHaveLength(0);
    });

    it('should handle timeout status', async () => {
      const mockClient = {
        run: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            id: 'run-123',
            status: 'TIMED_OUT',
          }),
        }),
      };

      (getApifyClient as any).mockReturnValue(mockClient);

      const result = await fetchApifyRunOutput('run-123');

      expect(result.status).toBe('TIMED_OUT');
    });

    it('should handle aborted status', async () => {
      const mockClient = {
        run: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            id: 'run-123',
            status: 'ABORTED',
          }),
        }),
      };

      (getApifyClient as any).mockReturnValue(mockClient);

      const result = await fetchApifyRunOutput('run-123');

      expect(result.status).toBe('ABORTED');
    });

    it('should throw on API error', async () => {
      const mockClient = {
        run: vi.fn().mockReturnValue({
          get: vi.fn().mockRejectedValue(new Error('API error')),
        }),
      };

      (getApifyClient as any).mockReturnValue(mockClient);

      await expect(fetchApifyRunOutput('run-123')).rejects.toThrow('API error');
    });
  });

  describe('fetchBrightDataRunOutput', () => {
    it('should fetch successful snapshot output', async () => {
      (getBrightDataProgress as any).mockResolvedValue({
        status: 'ready',
      });

      (getBrightDataSnapshot as any).mockResolvedValue([
        { url: 'https://instagram.com/p/456', image_url: 'img.jpg' },
      ]);

      const result = await fetchBrightDataRunOutput('snapshot-456');

      expect(result.status).toBe('SUCCEEDED');
      expect(result.items).toHaveLength(1);
    });

    it('should map pending status', async () => {
      (getBrightDataProgress as any).mockResolvedValue({
        status: 'running',
      });

      const result = await fetchBrightDataRunOutput('snapshot-456');

      expect(result.status).toBe('PENDING');
      expect(result.items).toHaveLength(0);
    });

    it('should map failed status', async () => {
      (getBrightDataProgress as any).mockResolvedValue({
        status: 'failed',
      });

      const result = await fetchBrightDataRunOutput('snapshot-456');

      expect(result.status).toBe('FAILED');
    });

    it('should throw on API error', async () => {
      (getBrightDataProgress as any).mockRejectedValue(new Error('API error'));

      await expect(fetchBrightDataRunOutput('snapshot-456')).rejects.toThrow('API error');
    });
  });
});
