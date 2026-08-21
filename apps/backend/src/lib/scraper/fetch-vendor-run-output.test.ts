import test from 'node:test';
import assert from 'node:assert';
import { fetchApifyRunOutput, fetchBrightDataRunOutput } from './fetch-vendor-run-output.js';
import { setGetApifyClient } from './instagram-adapter.js';
import { setGetBrightDataProgress, setGetBrightDataSnapshot } from './brightdata-client.js';

test('fetch-vendor-run-output', async (t) => {
  await t.test('fetchApifyRunOutput', async (t) => {
    await t.test('should fetch successful run output', async () => {
      setGetApifyClient(() => ({
        run: () => ({
          get: async () => ({
            id: 'run-123',
            status: 'SUCCEEDED',
            defaultDatasetId: 'dataset-123',
          }),
        }),
        dataset: () => ({
          listItems: async () => ({
            items: [
              { url: 'https://instagram.com/p/123', caption: 'Test post' },
            ],
          }),
        }),
      } as any));

      const result = await fetchApifyRunOutput('run-123');

      assert.strictEqual(result.status, 'SUCCEEDED');
      assert.strictEqual(result.items.length, 1);
      assert.deepStrictEqual(result.items[0], {
        url: 'https://instagram.com/p/123',
        caption: 'Test post',
      });
    });

    await t.test('should handle failed runs', async () => {
      setGetApifyClient(() => ({
        run: () => ({
          get: async () => ({ id: 'run-123', status: 'FAILED' }),
        }),
      } as any));

      const result = await fetchApifyRunOutput('run-123');

      assert.strictEqual(result.status, 'FAILED');
      assert.strictEqual(result.items.length, 0);
    });

    await t.test('should handle timeout status', async () => {
      setGetApifyClient(() => ({
        run: () => ({
          get: async () => ({ id: 'run-123', status: 'TIMED_OUT' }),
        }),
      } as any));

      const result = await fetchApifyRunOutput('run-123');

      assert.strictEqual(result.status, 'TIMED_OUT');
    });

    await t.test('should handle aborted status', async () => {
      setGetApifyClient(() => ({
        run: () => ({
          get: async () => ({ id: 'run-123', status: 'ABORTED' }),
        }),
      } as any));

      const result = await fetchApifyRunOutput('run-123');

      assert.strictEqual(result.status, 'ABORTED');
    });

    await t.test('should throw on API error', async () => {
      setGetApifyClient(() => ({
        run: () => ({
          get: async () => {
            throw new Error('API error');
          },
        }),
      } as any));

      await assert.rejects(() => fetchApifyRunOutput('run-123'), /API error/);
    });
  });

  await t.test('fetchBrightDataRunOutput', async (t) => {
    await t.test('should fetch successful snapshot output', async () => {
      setGetBrightDataProgress(async () => ({ status: 'ready' }));
      setGetBrightDataSnapshot(async () => [
        { url: 'https://instagram.com/p/456', image_url: 'img.jpg' },
      ]);

      const result = await fetchBrightDataRunOutput('snapshot-456');

      assert.strictEqual(result.status, 'SUCCEEDED');
      assert.strictEqual(result.items.length, 1);
    });

    await t.test('should map pending status', async () => {
      setGetBrightDataProgress(async () => ({ status: 'running' }));

      const result = await fetchBrightDataRunOutput('snapshot-456');

      assert.strictEqual(result.status, 'PENDING');
      assert.strictEqual(result.items.length, 0);
    });

    await t.test('should map failed status', async () => {
      setGetBrightDataProgress(async () => ({ status: 'failed' }));

      const result = await fetchBrightDataRunOutput('snapshot-456');

      assert.strictEqual(result.status, 'FAILED');
    });

    await t.test('should throw on API error', async () => {
      setGetBrightDataProgress(async () => {
        throw new Error('API error');
      });

      await assert.rejects(() => fetchBrightDataRunOutput('snapshot-456'), /API error/);
    });
  });
});
