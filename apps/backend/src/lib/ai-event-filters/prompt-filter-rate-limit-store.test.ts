import test from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { promptFilterRateLimits, users } from '@festgrid/database';
import { db } from '../../db/client.js';
import { checkAndRecordPromptFilterRateLimit } from './prompt-filter-rate-limit-store.js';

// Epic 9 review (P12) -- the limiter must hold under concurrency, not just for sequential calls.
test('prompt-filter-rate-limit-store: concurrency', async (t) => {
  const originalMax = process.env.PROMPT_FILTER_RATE_LIMIT_MAX_REQUESTS;
  const originalWindow = process.env.PROMPT_FILTER_RATE_LIMIT_WINDOW_MINUTES;
  const [user] = await db.select().from(users).limit(1);
  assert.ok(user, 'at least one seeded user is required');

  t.after(async () => {
    await db.delete(promptFilterRateLimits).where(eq(promptFilterRateLimits.userId, user.id));
    if (originalMax === undefined) delete process.env.PROMPT_FILTER_RATE_LIMIT_MAX_REQUESTS;
    else process.env.PROMPT_FILTER_RATE_LIMIT_MAX_REQUESTS = originalMax;
    if (originalWindow === undefined) delete process.env.PROMPT_FILTER_RATE_LIMIT_WINDOW_MINUTES;
    else process.env.PROMPT_FILTER_RATE_LIMIT_WINDOW_MINUTES = originalWindow;
  });

  await t.test('twelve parallel first-ever requests with a limit of 3 allow exactly 3 and never throw', async () => {
    process.env.PROMPT_FILTER_RATE_LIMIT_MAX_REQUESTS = '3';
    process.env.PROMPT_FILTER_RATE_LIMIT_WINDOW_MINUTES = '10';
    await db.delete(promptFilterRateLimits).where(eq(promptFilterRateLimits.userId, user.id));

    const results = await Promise.all(Array.from({ length: 12 }, () => checkAndRecordPromptFilterRateLimit(user.id)));

    assert.equal(results.filter(Boolean).length, 3);
    const [row] = await db.select().from(promptFilterRateLimits).where(eq(promptFilterRateLimits.userId, user.id));
    assert.equal(row.requestCount, 3);
  });

  await t.test('parallel requests against an existing row never allow more than the remaining budget', async () => {
    process.env.PROMPT_FILTER_RATE_LIMIT_MAX_REQUESTS = '5';
    await db.delete(promptFilterRateLimits).where(eq(promptFilterRateLimits.userId, user.id));
    await db.insert(promptFilterRateLimits).values({ userId: user.id, requestCount: 3, windowStartAt: new Date() });

    const results = await Promise.all(Array.from({ length: 10 }, () => checkAndRecordPromptFilterRateLimit(user.id)));

    assert.ok(results.filter(Boolean).length <= 2, `allowed ${results.filter(Boolean).length}, budget was 2`);
    const [row] = await db.select().from(promptFilterRateLimits).where(eq(promptFilterRateLimits.userId, user.id));
    assert.ok(row.requestCount <= 5);
  });
});
