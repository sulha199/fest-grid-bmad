import test from 'node:test';
import assert from 'node:assert';
import { db } from '../../db/client.js';
import { scraperProviderUsage } from '@festgrid/database';
import { recordProviderUsage, isProviderCapacityAvailable, markProviderCapacityExhausted, EXHAUSTED_RECHECK_DAYS } from './usage-store.js';
import { eq } from 'drizzle-orm';

test('usage-store scraper capacity tracking', async (t) => {
  const provider = 'test-provider-' + Date.now();

  t.afterEach(async () => {
    await db.delete(scraperProviderUsage).where(eq(scraperProviderUsage.provider, provider));
  });

  await t.test('missing row defaults to capacity available', async () => {
    const isAvailable = await isProviderCapacityAvailable(provider);
    assert.strictEqual(isAvailable, true);
  });

  await t.test('creates provider row and records usage', async () => {
    await recordProviderUsage(provider, 100);

    const [row] = await db.select().from(scraperProviderUsage).where(eq(scraperProviderUsage.provider, provider));
    assert.ok(row);
    assert.strictEqual(row.itemsUsedThisCycle, 100);

    const isAvailable = await isProviderCapacityAvailable(provider);
    assert.strictEqual(isAvailable, true);
  });

  await t.test('accumulates usage if cycle is not elapsed', async () => {
    await recordProviderUsage(provider, 100);
    await recordProviderUsage(provider, 50);

    const [row] = await db.select().from(scraperProviderUsage).where(eq(scraperProviderUsage.provider, provider));
    assert.strictEqual(row.itemsUsedThisCycle, 150);
  });

  await t.test('resets usage if cycle has elapsed', async () => {
    await recordProviderUsage(provider, 100);

    // Conceptually expire the row by backdating usageCycleResetAt to 10 days ago
    const backdated = new Date();
    backdated.setDate(backdated.getDate() - 40); // 40 days ago is > 30 days default cycle

    await db.update(scraperProviderUsage).set({
      usageCycleResetAt: backdated,
    }).where(eq(scraperProviderUsage.provider, provider));

    // Recording new usage should reset the count to the new item count
    await recordProviderUsage(provider, 20);

    const [row] = await db.select().from(scraperProviderUsage).where(eq(scraperProviderUsage.provider, provider));
    assert.strictEqual(row.itemsUsedThisCycle, 20);
    assert.ok(row.usageCycleResetAt.getTime() > backdated.getTime());
    // usageCycleResetAt is the new cycle's START, not a future "next reset" (which would make
    // the following cycle last 2x cycleDays).
    assert.ok(row.usageCycleResetAt.getTime() <= Date.now());
  });

  await t.test('capacity check respects threshold boundaries', async () => {
    // Under default settings:
    // scraperPricePerThousandItemsUsd = 2.70
    // scraperMonthlyBudgetUsd = 5.00
    // scraperCapacityThresholdRatio = 0.9 -> budgetLimit = 4.50 USD
    // 4.50 USD is equivalent to: (4.50 / 2.70) * 1000 = 1666.67 items
    // Let's test boundary:
    // 1600 items = 1.6 * 2.70 = 4.32 USD (under 4.50 limit)
    // 1700 items = 1.7 * 2.70 = 4.59 USD (over 4.50 limit)

    await recordProviderUsage(provider, 1600);
    const availableUnder = await isProviderCapacityAvailable(provider);
    assert.strictEqual(availableUnder, true);

    // Record extra 100 items to put us over the threshold
    await recordProviderUsage(provider, 100);
    const availableOver = await isProviderCapacityAvailable(provider);
    assert.strictEqual(availableOver, false);
  });

  // Story 10.2 (IDEA-101): a provider whose monthly cap is known to be used up is skipped for the rest of the cycle.
  await t.test('markProviderCapacityExhausted creates the row and sets the end of the current cycle', async () => {
    const before = Date.now();
    await markProviderCapacityExhausted(provider);
    const [row] = await db.select().from(scraperProviderUsage).where(eq(scraperProviderUsage.provider, provider));
    assert.ok(row.capacityExhaustedUntil instanceof Date);
    // the end of the cycle or the re-check interval from now, whichever is sooner (a fresh row: the re-check)
    assert.ok(Math.abs(row.capacityExhaustedUntil!.getTime() - (Date.now() + EXHAUSTED_RECHECK_DAYS * 24 * 60 * 60 * 1000)) < 5000);
    assert.ok(row.usageCycleResetAt.getTime() >= before - 1000);
    assert.strictEqual(await isProviderCapacityAvailable(provider), false);
  });

  await t.test('an exhausted provider is unavailable even with zero recorded items, until the cycle ends', async () => {
    await recordProviderUsage(provider, 1);
    await markProviderCapacityExhausted(provider);
    assert.strictEqual(await isProviderCapacityAvailable(provider), false);
    // the cycle ends: the memory no longer applies (capacity_exhausted_until is in the past) and the usage resets
    const longAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    await db.update(scraperProviderUsage).set({ usageCycleResetAt: longAgo, capacityExhaustedUntil: new Date(longAgo.getTime() + 30 * 24 * 60 * 60 * 1000) }).where(eq(scraperProviderUsage.provider, provider));
    assert.strictEqual(await isProviderCapacityAvailable(provider), true);
  });

  await t.test('marking again within the same cycle keeps the same end of cycle (idempotent)', async () => {
    await markProviderCapacityExhausted(provider);
    const [first] = await db.select().from(scraperProviderUsage).where(eq(scraperProviderUsage.provider, provider));
    await markProviderCapacityExhausted(provider);
    const [second] = await db.select().from(scraperProviderUsage).where(eq(scraperProviderUsage.provider, provider));
    assert.ok(Math.abs(second.capacityExhaustedUntil!.getTime() - first.capacityExhaustedUntil!.getTime()) < 5000, 'a repeat re-marks the same window, not a longer one');
    assert.strictEqual(second.usageCycleResetAt.getTime(), first.usageCycleResetAt.getTime());
  });

  await t.test('marking a provider whose cycle has already elapsed starts a fresh cycle first', async () => {
    await recordProviderUsage(provider, 5);
    const longAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    await db.update(scraperProviderUsage).set({ usageCycleResetAt: longAgo }).where(eq(scraperProviderUsage.provider, provider));
    await markProviderCapacityExhausted(provider);
    const [row] = await db.select().from(scraperProviderUsage).where(eq(scraperProviderUsage.provider, provider));
    assert.ok(row.usageCycleResetAt.getTime() > Date.now() - 60_000, 'a new cycle started now');
    assert.ok(Math.abs(row.capacityExhaustedUntil!.getTime() - (Date.now() + EXHAUSTED_RECHECK_DAYS * 24 * 60 * 60 * 1000)) < 5000, 'the re-lock after a fresh cycle is also capped at the re-check interval, never a month');
    assert.strictEqual(row.itemsUsedThisCycle, 0);
  });

  await t.test('recording usage after the cycle rolled over clears the exhausted marker', async () => {
    await markProviderCapacityExhausted(provider);
    const longAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    await db.update(scraperProviderUsage).set({ usageCycleResetAt: longAgo }).where(eq(scraperProviderUsage.provider, provider));
    await recordProviderUsage(provider, 2);
    const [row] = await db.select().from(scraperProviderUsage).where(eq(scraperProviderUsage.provider, provider));
    assert.strictEqual(row.capacityExhaustedUntil, null);
    assert.strictEqual(row.itemsUsedThisCycle, 2);
  });

  await t.test('near the end of our cycle the cycle end is sooner than the re-check, and it wins', async () => {
    await recordProviderUsage(provider, 1);
    const startedAgo = (30 - 1) * 24 * 60 * 60 * 1000; // one day of the 30-day cycle left
    await db.update(scraperProviderUsage).set({ usageCycleResetAt: new Date(Date.now() - startedAgo) }).where(eq(scraperProviderUsage.provider, provider));
    await markProviderCapacityExhausted(provider);
    const [row] = await db.select().from(scraperProviderUsage).where(eq(scraperProviderUsage.provider, provider));
    const untilMs = row.capacityExhaustedUntil!.getTime() - Date.now();
    assert.ok(untilMs > 0 && untilMs < 25 * 60 * 60 * 1000, 'about one day, not three');
  });
});
