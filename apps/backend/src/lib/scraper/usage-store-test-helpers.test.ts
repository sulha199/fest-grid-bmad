import test from 'node:test';
import assert from 'node:assert';
import { db } from '../../db/client.js';
import { scraperProviderUsage } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { isProviderCapacityAvailable } from './usage-store.js';
import { clearApifyProviderUsage, APIFY_TEST_PROVIDER } from './usage-store-test-helpers.js';

test('clearApifyProviderUsage removes a leftover exhausted-capacity row', async () => {
  // Start from a clean slate in case a genuinely leftover row (from an interrupted prior run,
  // the exact scenario this helper guards against) already exists — the insert below would
  // otherwise fail on the provider's unique constraint.
  await clearApifyProviderUsage();

  // Simulate exactly the pollution scenario this helper guards against: a row left behind by an
  // interrupted prior run, with capacity already exhausted.
  await db.insert(scraperProviderUsage).values({
    provider: APIFY_TEST_PROVIDER,
    itemsUsedThisCycle: 10000,
    usageCycleResetAt: new Date(Date.now() + 86400000),
  });
  assert.strictEqual(await isProviderCapacityAvailable(APIFY_TEST_PROVIDER), false);

  await clearApifyProviderUsage();

  const rows = await db
    .select()
    .from(scraperProviderUsage)
    .where(eq(scraperProviderUsage.provider, APIFY_TEST_PROVIDER));
  assert.strictEqual(rows.length, 0);
  assert.strictEqual(await isProviderCapacityAvailable(APIFY_TEST_PROVIDER), true);
});
