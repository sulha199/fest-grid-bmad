import test from 'node:test';
import assert from 'node:assert';
import { db } from '../../db/client.js';
import { scraperActorRuns, socialMediaAccountProfiles } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import {
  PROVIDER_PROBE_INTERVAL_MS,
  getDegradedProviders,
  getProviderRunHealth,
  resetProviderProbeClaimsForTests,
  shouldSkipDegradedProvider,
  type ScraperVendor,
} from './provider-run-health-store.js';

// BUG-074 / IDEA-095: provider health read from what the runs delivered, not from whether a trigger
// was accepted. Each test inserts a full sample (20 runs) newer than anything already in the table,
// so the sample is deterministic whatever else the database holds.
test('provider-run-health-store', async (t) => {
  let profileId: string;
  let sequence = 0;

  t.before(async () => {
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({
        accountId: 'run-health-test-' + Date.now(),
        platform: 'instagram',
        username: 'run_health_test_user',
        displayName: 'Run Health Test User',
      })
      .returning({ id: socialMediaAccountProfiles.id });
    profileId = profile.id;
  });

  t.beforeEach(() => {
    resetProviderProbeClaimsForTests();
  });

  t.afterEach(async () => {
    await db.delete(scraperActorRuns).where(eq(scraperActorRuns.profileId, profileId));
  });

  t.after(async () => {
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profileId));
  });

  type Kind = 'ok' | 'empty' | 'failed' | 'pending';

  /** Inserts one run per entry of `kinds`, newest first, finishing one second apart from `from` ago. */
  async function insertRuns(vendor: ScraperVendor, kinds: Kind[], from = 0) {
    const now = Date.now();
    await db.insert(scraperActorRuns).values(
      kinds.map((kind, index) => {
        sequence += 1;
        return {
          vendor,
          triggerMode: 'ASYNC' as const,
          profileId,
          runId: `run-health-test-${vendor}-${sequence}-${now}`,
          rawInput: {},
          status: kind === 'failed' ? ('FAILED' as const) : kind === 'pending' ? ('PENDING' as const) : ('SUCCEEDED' as const),
          itemCount: kind === 'ok' ? 3 : kind === 'pending' ? null : 0,
          completedAt: kind === 'pending' ? null : new Date(now - (from + index) * 1000),
        };
      })
    );
  }

  const repeat = (kind: Kind, n: number): Kind[] => Array.from({ length: n }, () => kind);

  await t.test('a fleet of failed runs is degraded as VENDOR_FAILURE', async () => {
    await insertRuns('BRIGHTDATA', repeat('failed', 20));

    const health = await getProviderRunHealth('BRIGHTDATA');

    assert.strictEqual(health.degraded, true);
    assert.strictEqual(health.reason, 'VENDOR_FAILURE');
    assert.strictEqual(health.sampled, 20);
    assert.strictEqual(health.failed, 20);
  });

  await t.test('a fleet of zero-item "SUCCEEDED" runs is degraded as ALL_EMPTY (the runs the old code stored on 2026-10-21)', async () => {
    await insertRuns('BRIGHTDATA', repeat('empty', 20));

    const health = await getProviderRunHealth('BRIGHTDATA');

    assert.strictEqual(health.degraded, true);
    assert.strictEqual(health.reason, 'ALL_EMPTY');
  });

  await t.test('a normal mix of runs with and without posts is healthy', async () => {
    await insertRuns('BRIGHTDATA', [...repeat('ok', 10), ...repeat('empty', 10)]);

    const health = await getProviderRunHealth('BRIGHTDATA');

    assert.strictEqual(health.degraded, false);
    assert.strictEqual(health.ok, 10);
  });

  await t.test('one newest run with posts clears a degraded provider (a successful probe)', async () => {
    await insertRuns('BRIGHTDATA', ['ok', ...repeat('failed', 19)]);

    assert.strictEqual((await getProviderRunHealth('BRIGHTDATA')).degraded, false);
  });

  await t.test('unfinished runs are ignored: they say nothing about the provider yet', async () => {
    await insertRuns('BRIGHTDATA', [...repeat('pending', 5), ...repeat('failed', 20)]);

    const health = await getProviderRunHealth('BRIGHTDATA');

    assert.strictEqual(health.sampled, 20);
    assert.strictEqual(health.degraded, true);
  });

  await t.test('providers are judged separately', async () => {
    await insertRuns('APIFY', repeat('failed', 20));
    await insertRuns('BRIGHTDATA', [...repeat('ok', 10), ...repeat('empty', 10)]);

    assert.strictEqual((await getProviderRunHealth('APIFY')).degraded, true);
    assert.strictEqual((await getProviderRunHealth('BRIGHTDATA')).degraded, false);
    assert.deepStrictEqual([...(await getDegradedProviders())], ['APIFY']);
  });

  await t.test('getDegradedProviders is empty when nothing is degraded', async () => {
    await insertRuns('APIFY', [...repeat('ok', 10), ...repeat('empty', 10)]);
    await insertRuns('BRIGHTDATA', [...repeat('ok', 10), ...repeat('empty', 10)]);

    assert.strictEqual((await getDegradedProviders()).size, 0);
  });

  await t.test('shouldSkipDegradedProvider never skips a healthy provider', async () => {
    await insertRuns('BRIGHTDATA', [...repeat('ok', 10), ...repeat('empty', 10)]);

    for (let i = 0; i < 3; i += 1) {
      assert.strictEqual(await shouldSkipDegradedProvider('BRIGHTDATA'), false);
    }
  });

  await t.test('a degraded provider lets exactly one probe through per interval, then is skipped', async () => {
    await insertRuns('BRIGHTDATA', repeat('failed', 20));
    const start = Date.now();

    const first = await shouldSkipDegradedProvider('BRIGHTDATA', start);
    const second = await shouldSkipDegradedProvider('BRIGHTDATA', start + 1000);
    const third = await shouldSkipDegradedProvider('BRIGHTDATA', start + PROVIDER_PROBE_INTERVAL_MS - 1);

    assert.strictEqual(first, false, 'the first trigger is the probe');
    assert.strictEqual(second, true);
    assert.strictEqual(third, true);
  });

  await t.test('the next probe is allowed once the interval has passed', async () => {
    await insertRuns('BRIGHTDATA', repeat('failed', 20));
    const start = Date.now();

    await shouldSkipDegradedProvider('BRIGHTDATA', start);
    const afterInterval = await shouldSkipDegradedProvider('BRIGHTDATA', start + PROVIDER_PROBE_INTERVAL_MS);

    assert.strictEqual(afterInterval, false);
  });

  await t.test('concurrent triggers in one batch share a single probe', async () => {
    await insertRuns('BRIGHTDATA', repeat('failed', 20));

    const decisions = await Promise.all(Array.from({ length: 38 }, () => shouldSkipDegradedProvider('BRIGHTDATA')));

    assert.strictEqual(decisions.filter((skipped) => !skipped).length, 1, 'exactly one of the 38 targets probes');
    assert.strictEqual(decisions.filter((skipped) => skipped).length, 37);
  });

  await t.test('probes are tracked per provider', async () => {
    await insertRuns('APIFY', repeat('failed', 20));
    await insertRuns('BRIGHTDATA', repeat('failed', 20));

    assert.strictEqual(await shouldSkipDegradedProvider('APIFY'), false);
    assert.strictEqual(await shouldSkipDegradedProvider('BRIGHTDATA'), false);
    assert.strictEqual(await shouldSkipDegradedProvider('APIFY'), true);
    assert.strictEqual(await shouldSkipDegradedProvider('BRIGHTDATA'), true);
  });
});
