import test from 'node:test';
import assert from 'node:assert';
import { buildDrainLongPollHint } from './drain-long-poll-hint.js';

test('buildDrainLongPollHint', async (t) => {
  await t.test('is false when nothing was enqueued', () => {
    const hint = buildDrainLongPollHint(false, () => 0);
    assert.deepStrictEqual([hint(), hint(), hint()], [false, false, false]);
  });

  await t.test('a resume pass that enqueued makes only the first receive long-poll', () => {
    const hint = buildDrainLongPollHint(true, () => 0);
    assert.deepStrictEqual([hint(), hint(), hint()], [true, false, false]);
  });

  await t.test('a chain step enqueued since the last call makes that receive long-poll, then clears', () => {
    const counts = [0, 2, 0, 1];
    const hint = buildDrainLongPollHint(false, () => counts.shift() ?? 0);
    assert.deepStrictEqual([hint(), hint(), hint(), hint(), hint()], [false, true, false, true, false]);
  });

  await t.test('reads the step count on every call, even while the resume hint is pending', () => {
    let reads = 0;
    const hint = buildDrainLongPollHint(true, () => { reads += 1; return 0; });
    hint();
    hint();
    assert.strictEqual(reads, 2);
  });
});
