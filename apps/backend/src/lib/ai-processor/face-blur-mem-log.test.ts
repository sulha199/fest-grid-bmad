import test from 'node:test';
import * as assert from 'node:assert';
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
});
