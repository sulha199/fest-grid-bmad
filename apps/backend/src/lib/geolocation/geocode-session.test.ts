import test, { mock } from 'node:test';
import * as assert from 'node:assert';
import { createGeocodeSession, GeocodeBudgetExhaustedError } from './geocode-session.js';

test('memo runs a lookup once per key, also while it is still in flight, and shares a failure', async () => {
  const session = createGeocodeSession();
  let runs = 0;
  const slow = () =>
    new Promise<string>((resolve) => {
      runs++;
      setTimeout(() => resolve('answer'), 5);
    });
  const [a, b] = await Promise.all([session.memo('k', slow), session.memo('k', slow)]);
  assert.strictEqual(a, 'answer');
  assert.strictEqual(b, 'answer');
  assert.strictEqual(runs, 1);
  assert.strictEqual(await session.memo('k', slow), 'answer');
  assert.strictEqual(runs, 1);

  let failures = 0;
  const failing = () => {
    failures++;
    return Promise.reject(new Error('503'));
  };
  await assert.rejects(session.memo('bad', failing), /503/);
  await assert.rejects(session.memo('bad', failing), /503/);
  assert.strictEqual(failures, 1, 'a failed lookup is not retried within the request');
});

test('a budget counts uncached calls, refuses past it, and logs the exhaustion once', () => {
  const warn = mock.method(console, 'warn', () => {});
  try {
    const session = createGeocodeSession({ budget: 2 });
    session.spend();
    session.spend();
    assert.strictEqual(session.spent, 2);
    assert.throws(() => session.spend(), GeocodeBudgetExhaustedError);
    assert.throws(() => session.spend(), /budget/);
    assert.strictEqual(session.spent, 2, 'a refused call is not counted');
    assert.strictEqual(session.budget, 2);
    assert.strictEqual(warn.mock.calls.filter((c) => String(c.arguments[0]).includes('geocode-budget-exhausted')).length, 1);
  } finally {
    warn.mock.restore();
  }
});

test('a session without a budget never refuses', () => {
  const session = createGeocodeSession();
  for (let i = 0; i < 100; i++) session.spend();
  assert.strictEqual(session.spent, 100);
  assert.strictEqual(session.budget, undefined);
});
