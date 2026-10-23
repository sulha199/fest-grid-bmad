import test from 'node:test';
import assert from 'node:assert';
import { settleWithConcurrencyLimit } from './settle-with-concurrency-limit.js';

test('settleWithConcurrencyLimit', async (t) => {
  await t.test('never has more than `limit` calls in flight, and runs every item', async () => {
    let inFlight = 0;
    let peak = 0;
    const results = await settleWithConcurrencyLimit(Array.from({ length: 35 }, (_, i) => i), 3, async (n) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 2));
      inFlight -= 1;
      return n * 2;
    });
    assert.strictEqual(peak, 3);
    assert.strictEqual(results.length, 35);
    assert.deepStrictEqual(
      results.map((r) => (r.status === 'fulfilled' ? r.value : null)),
      Array.from({ length: 35 }, (_, i) => i * 2),
      'results keep the input order'
    );
  });

  await t.test('captures a rejection like allSettled and keeps going', async () => {
    const results = await settleWithConcurrencyLimit([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error('boom');
      return n;
    });
    assert.deepStrictEqual(results.map((r) => r.status), ['fulfilled', 'rejected', 'fulfilled']);
    assert.strictEqual((results[1] as PromiseRejectedResult).reason.message, 'boom');
  });

  await t.test('a limit below 1 (or NaN) still makes progress, one at a time', async () => {
    for (const limit of [0, -4, Number.NaN]) {
      let inFlight = 0;
      let peak = 0;
      await settleWithConcurrencyLimit([1, 2, 3], limit, async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight -= 1;
      });
      assert.strictEqual(peak, 1);
    }
  });

  await t.test('no items settles to an empty list', async () => {
    assert.deepStrictEqual(await settleWithConcurrencyLimit([], 3, async () => 1), []);
  });
});
