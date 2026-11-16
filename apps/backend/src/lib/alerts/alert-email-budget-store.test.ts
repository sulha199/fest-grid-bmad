import test from 'node:test';
import assert from 'node:assert/strict';
import { eq, like, inArray } from 'drizzle-orm';
import { alertEmailRateLimits } from '@festgrid/database';
import { db } from '../../db/client.js';
import {
  MODERATOR_NOTIFY_KEY_PREFIX,
  pruneModeratorNotifyThrottle,
  releaseAlertEmailBudget,
  takeAlertEmailBudget,
} from './alert-email-budget-store.js';

// Story 0.i1a (Task 3, AC3): the store with caller-supplied limits, the release and the prune, against real
// Postgres. Every key is unique to this run and every row is deleted at the end (row-count ratchet, Story
// 0.51); the shared `reportSystemError` row is never written.
test('alert-email-budget-store with caller limits, release and prune (real Postgres)', async (t) => {
  const run = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const keyOf = (name: string) => `${MODERATOR_NOTIFY_KEY_PREFIX}test-${run}-${name}`;
  const created: string[] = [];
  const track = (key: string) => {
    created.push(key);
    return key;
  };
  const limits = { maxSends: 1, windowMinutes: 60 };

  t.after(async () => {
    if (created.length > 0) await db.delete(alertEmailRateLimits).where(inArray(alertEmailRateLimits.key, created));
  });

  await t.test('with { maxSends: 1 } the second call in the window is denied (AC3)', async () => {
    const key = track(keyOf('second'));
    assert.equal(await takeAlertEmailBudget(key, limits), true);
    assert.equal(await takeAlertEmailBudget(key, limits), false);
  });

  await t.test('five parallel calls allow exactly one (the compare-and-swap) (AC3)', async () => {
    const key = track(keyOf('parallel'));
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => takeAlertEmailBudget(key, limits)));
    assert.equal(results.filter(Boolean).length, 1);
  });

  await t.test('a row whose window opened in the past allows again (AC3)', async () => {
    const key = track(keyOf('rollover'));
    assert.equal(await takeAlertEmailBudget(key, limits), true);
    await db
      .update(alertEmailRateLimits)
      .set({ windowStartAt: new Date(Date.now() - 61 * 60 * 1000) })
      .where(eq(alertEmailRateLimits.key, key));
    assert.equal(await takeAlertEmailBudget(key, limits), true);
  });

  await t.test('releaseAlertEmailBudget lets the next call through and never goes below zero', async () => {
    const key = track(keyOf('release'));
    assert.equal(await takeAlertEmailBudget(key, limits), true);
    await releaseAlertEmailBudget(key);
    assert.equal(await takeAlertEmailBudget(key, limits), true);
    await releaseAlertEmailBudget(key);
    await releaseAlertEmailBudget(key);
    const [row] = await db.select().from(alertEmailRateLimits).where(eq(alertEmailRateLimits.key, key));
    assert.equal(row.sendCount, 0);
    await releaseAlertEmailBudget(keyOf('never-existed'));
  });

  await t.test('releaseAlertEmailBudget swallows a database error', async (t) => {
    t.mock.method(db, 'update', () => {
      throw new Error('DB_DOWN');
    });
    const errors: string[] = [];
    t.mock.method(console, 'error', (...a: unknown[]) => errors.push(a.map(String).join(' ')));
    await releaseAlertEmailBudget(keyOf('db-down'));
    assert.ok(errors.some((e) => e.includes('Failed to release')));
  });

  await t.test('without limits the caller still gets the system-error budget rule (a key of its own)', async () => {
    const key = track(`test-system-${run}`);
    assert.equal(await takeAlertEmailBudget(key), true);
  });

  await t.test('prune removes only an old moderator-notify row, never another channel (AC3)', async () => {
    const oldKey = track(keyOf('old'));
    const freshKey = track(keyOf('fresh'));
    const otherChannelKey = track(`reportSystemError-test-${run}`);
    const longAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    await db.insert(alertEmailRateLimits).values([
      { key: oldKey, sendCount: 1, windowStartAt: longAgo },
      { key: freshKey, sendCount: 1, windowStartAt: new Date() },
      { key: otherChannelKey, sendCount: 1, windowStartAt: longAgo },
    ]);
    await pruneModeratorNotifyThrottle();
    const left = await db
      .select({ key: alertEmailRateLimits.key })
      .from(alertEmailRateLimits)
      .where(like(alertEmailRateLimits.key, `%${run}%`));
    const keys = left.map((r) => r.key);
    assert.ok(!keys.includes(oldKey), 'the old moderator-notify row is gone');
    assert.ok(keys.includes(freshKey), 'a recent row stays');
    assert.ok(keys.includes(otherChannelKey), 'another channel is never touched');
  });

  await t.test('prune swallows a database error', async (t) => {
    t.mock.method(db, 'delete', () => {
      throw new Error('DB_DOWN');
    });
    const errors: string[] = [];
    t.mock.method(console, 'error', (...a: unknown[]) => errors.push(a.map(String).join(' ')));
    await pruneModeratorNotifyThrottle();
    assert.ok(errors.some((e) => e.includes('Failed to prune')));
  });
});
