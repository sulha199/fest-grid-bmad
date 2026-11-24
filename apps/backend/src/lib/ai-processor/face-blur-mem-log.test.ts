import test from 'node:test';
import * as assert from 'node:assert';
import sharp from 'sharp';
import { logFaceBlurMem, memorySnapshot } from './face-blur-mem-log.js';

test('face-blur-mem logging helper', async (t) => {
  await t.test('logs one prefixed single-line JSON with stage, fields and rss/external in MB', () => {
    const lines: string[] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => void lines.push(args.join(' '));
    try {
      logFaceBlurMem('detect', { postId: 'p1', faceCount: 2 });
    } finally {
      console.log = original;
    }
    assert.strictEqual(lines.length, 1);
    assert.ok(lines[0].startsWith('face-blur-mem '), lines[0]);
    assert.ok(!lines[0].includes('\n'));
    const payload = JSON.parse(lines[0].slice('face-blur-mem '.length));
    assert.strictEqual(payload.stage, 'detect');
    assert.strictEqual(payload.postId, 'p1');
    assert.strictEqual(payload.faceCount, 2);
    assert.ok(Number.isInteger(payload.rssMb) && payload.rssMb > 0);
    assert.ok(Number.isInteger(payload.externalMb) && payload.externalMb >= 0);
    assert.ok(Number.isInteger(payload.maxRssMb) && payload.maxRssMb >= payload.rssMb - 1, 'maxRssMb is the high-water mark');
    for (const key of ['heapUsedMb', 'heapTotalMb', 'arrayBuffersMb', 'sharpCacheMb', 'sharpCacheHighMb', 'sharpCacheItems', 'sharpQueue', 'sharpProcess']) {
      assert.ok(Number.isInteger(payload[key]) && payload[key] >= 0, `${key} is a non-negative integer: ${payload[key]}`);
    }
    assert.ok(payload.heapUsedMb > 0 && payload.heapTotalMb >= payload.heapUsedMb);
  });

  await t.test('never throws when console.log or process.memoryUsage fails', () => {
    const originalLog = console.log;
    const originalMem = process.memoryUsage;
    console.log = () => {
      throw new Error('log sink down');
    };
    try {
      assert.doesNotThrow(() => logFaceBlurMem('detect'));
      console.log = originalLog;
      process.memoryUsage = (() => {
        throw new Error('no memory info');
      }) as unknown as typeof process.memoryUsage;
      assert.doesNotThrow(() => logFaceBlurMem('detect'));
    } finally {
      console.log = originalLog;
      process.memoryUsage = originalMem;
    }
    assert.ok(memorySnapshot().rssMb > 0);
  });

  await t.test('a throwing sharp.cache does not make the log throw and keeps the process figures', (t2) => {
    t2.mock.method(sharp, 'cache', () => {
      throw new Error('sharp unavailable');
    });
    const lines: string[] = [];
    t2.mock.method(console, 'log', (...args: unknown[]) => void lines.push(args.join(' ')));
    assert.doesNotThrow(() => logFaceBlurMem('detect'));
    assert.strictEqual(lines.length, 1);
    const payload = JSON.parse(lines[0].slice('face-blur-mem '.length));
    assert.ok(payload.rssMb > 0 && Number.isInteger(payload.heapUsedMb));
    assert.strictEqual(payload.sharpCacheMb, undefined);
  });

  await t.test('reports sharp cache/counter values in their own units (cache memory is already MB)', (t2) => {
    t2.mock.method(sharp, 'cache', () => ({
      memory: { current: 12, high: 20, max: 50 },
      items: { current: 7, high: 9, max: 100 },
      files: { current: 0, max: 20 },
    }));
    t2.mock.method(sharp, 'counters', () => ({ queue: 2, process: 1 }));
    const snapshot = memorySnapshot();
    assert.strictEqual(snapshot.sharpCacheMb, 12);
    assert.strictEqual(snapshot.sharpCacheHighMb, 20);
    assert.strictEqual(snapshot.sharpCacheItems, 7);
    assert.strictEqual(snapshot.sharpQueue, 2);
    assert.strictEqual(snapshot.sharpProcess, 1);
  });
});
