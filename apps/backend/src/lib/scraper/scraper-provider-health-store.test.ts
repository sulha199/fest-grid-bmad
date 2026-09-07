import test from 'node:test';
import assert from 'node:assert';
import { db } from '../../db/client.js';
import { scraperProviderHealth } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import {
  recordProviderHealthCheck,
  getProvidersNeedingAlert,
  markProviderAlertSent,
} from './scraper-provider-health-store.js';

test('scraper-provider-health-store tracking', async (t) => {
  const provider = 'test-provider-' + Date.now();

  t.after(async () => {
    await db.delete(scraperProviderHealth).where(eq(scraperProviderHealth.provider, provider));
  });

  await t.test('missing row: full failure creates a row with consecutiveFailureDays = 1', async () => {
    await recordProviderHealthCheck(provider, { attempted: 5, succeeded: 0 });

    const [row] = await db
      .select()
      .from(scraperProviderHealth)
      .where(eq(scraperProviderHealth.provider, provider));

    assert.ok(row);
    assert.strictEqual(row.consecutiveFailureDays, 1);
    assert.ok(row.lastCheckedAt);
  });

  await t.test('another full failure day increments the counter', async () => {
    await recordProviderHealthCheck(provider, { attempted: 3, succeeded: 0 });

    const [row] = await db
      .select()
      .from(scraperProviderHealth)
      .where(eq(scraperProviderHealth.provider, provider));

    assert.strictEqual(row.consecutiveFailureDays, 2);
  });

  await t.test('any success resets the counter to 0', async () => {
    await recordProviderHealthCheck(provider, { attempted: 4, succeeded: 1 });

    const [row] = await db
      .select()
      .from(scraperProviderHealth)
      .where(eq(scraperProviderHealth.provider, provider));

    assert.strictEqual(row.consecutiveFailureDays, 0);
  });

  await t.test('getProvidersNeedingAlert respects the threshold', async () => {
    // Bring the counter back up to 2 consecutive failure days.
    await recordProviderHealthCheck(provider, { attempted: 2, succeeded: 0 });
    await recordProviderHealthCheck(provider, { attempted: 2, succeeded: 0 });

    const belowThreshold = await getProvidersNeedingAlert(3, 3);
    assert.ok(
      !belowThreshold.some((r) => r.provider === provider),
      'Should not be returned when consecutiveFailureDays (2) is below the threshold (3)'
    );

    const atThreshold = await getProvidersNeedingAlert(2, 3);
    assert.ok(
      atThreshold.some((r) => r.provider === provider),
      'Should be returned when consecutiveFailureDays (2) meets the threshold (2)'
    );
  });

  await t.test('getProvidersNeedingAlert respects the cooldown after an alert was sent', async () => {
    await markProviderAlertSent(provider);

    const withinCooldown = await getProvidersNeedingAlert(2, 3);
    assert.ok(
      !withinCooldown.some((r) => r.provider === provider),
      'A provider past threshold but within cooldown should not be returned'
    );

    // Backdate lastAlertSentAt past the cooldown window to simulate cooldown expiry.
    const backdated = new Date();
    backdated.setDate(backdated.getDate() - 10);
    await db
      .update(scraperProviderHealth)
      .set({ lastAlertSentAt: backdated })
      .where(eq(scraperProviderHealth.provider, provider));

    const afterCooldown = await getProvidersNeedingAlert(2, 3);
    assert.ok(
      afterCooldown.some((r) => r.provider === provider),
      'Should be returned again once the cooldown window has elapsed'
    );
  });
});
