import test from 'node:test';
import assert from 'node:assert';
import { db } from '../../db/client.js';
import { scraperProviderUsage } from '@festgrid/database';
import { recordProviderUsage, isProviderCapacityAvailable } from './usage-store.js';
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
});
