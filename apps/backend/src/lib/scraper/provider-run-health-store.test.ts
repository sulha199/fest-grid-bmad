import test from 'node:test';
import assert from 'node:assert';
import { db } from '../../db/client.js';
import { scraperActorRuns, socialMediaAccountProfiles } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import {
  PROVIDER_PROBES_PER_INTERVAL,
  PROVIDER_PROBE_INTERVAL_MS,
  gateDegradedProvider,
  getDegradedProviders,
  getProviderRunHealth,
  releaseProviderProbe,
  resetProviderProbeClaimsForTests,
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

  /**
   * Inserts one run per entry of `kinds`, newest first, finishing one second apart from `from` seconds
   * ago, all `ageHours` older on top of that.
   */
  async function insertRuns(vendor: ScraperVendor, kinds: Kind[], from = 0, ageHours = 0) {
    const now = Date.now() - ageHours * 3_600_000;
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

  await t.test('a newest run the vendor did not fail clears a VENDOR_FAILURE: a probe that finds nothing new proves it is answering', async () => {
    await insertRuns('BRIGHTDATA', ['empty', ...repeat('failed', 19)]);

    assert.strictEqual((await getProviderRunHealth('BRIGHTDATA')).degraded, false);
  });

  await t.test('runs older than the recency window are ignored: a flag with no fresh evidence expires', async () => {
    await insertRuns('BRIGHTDATA', repeat('failed', 20), 0, 100);

    const health = await getProviderRunHealth('BRIGHTDATA');

    assert.strictEqual(health.sampled, 0);
    assert.strictEqual(health.degraded, false);
  });

  await t.test('the gate proceeds for a healthy provider, every time', async () => {
    await insertRuns('BRIGHTDATA', [...repeat('ok', 10), ...repeat('empty', 10)]);

    for (let i = 0; i < 5; i += 1) {
      assert.strictEqual(await gateDegradedProvider('BRIGHTDATA'), 'proceed');
    }
  });

  await t.test('a degraded provider lets a few probes through per interval, then is skipped', async () => {
    await insertRuns('BRIGHTDATA', repeat('failed', 20));
    const start = Date.now();

    const decisions: string[] = [];
    for (let i = 0; i < PROVIDER_PROBES_PER_INTERVAL + 2; i += 1) {
      decisions.push(await gateDegradedProvider('BRIGHTDATA', start + i * 1000));
    }
    const justBeforeNextInterval = await gateDegradedProvider('BRIGHTDATA', start + PROVIDER_PROBE_INTERVAL_MS - 1);

    assert.deepStrictEqual(decisions, [...repeat('probe' as Kind, PROVIDER_PROBES_PER_INTERVAL), 'skip', 'skip']);
    assert.strictEqual(justBeforeNextInterval, 'skip');
  });

  await t.test('the next probes are allowed once the interval has passed', async () => {
    await insertRuns('BRIGHTDATA', repeat('failed', 20));
    const start = Date.now();

    for (let i = 0; i < PROVIDER_PROBES_PER_INTERVAL; i += 1) {
      await gateDegradedProvider('BRIGHTDATA', start);
    }
    assert.strictEqual(await gateDegradedProvider('BRIGHTDATA', start + 1000), 'skip');

    assert.strictEqual(await gateDegradedProvider('BRIGHTDATA', start + PROVIDER_PROBE_INTERVAL_MS), 'probe');
  });

  await t.test('concurrent triggers in one batch share the probes: 38 targets, only the allowed number probe', async () => {
    await insertRuns('BRIGHTDATA', repeat('failed', 20));

    const decisions = await Promise.all(Array.from({ length: 38 }, () => gateDegradedProvider('BRIGHTDATA')));

    assert.strictEqual(decisions.filter((d) => d === 'probe').length, PROVIDER_PROBES_PER_INTERVAL);
    assert.strictEqual(decisions.filter((d) => d === 'skip').length, 38 - PROVIDER_PROBES_PER_INTERVAL);
    assert.strictEqual(decisions.filter((d) => d === 'proceed').length, 0);
  });

  await t.test('a probe that failed before reaching the vendor gives its slot back to the next target', async () => {
    await insertRuns('BRIGHTDATA', repeat('failed', 20));
    const start = Date.now();

    for (let i = 0; i < PROVIDER_PROBES_PER_INTERVAL; i += 1) {
      assert.strictEqual(await gateDegradedProvider('BRIGHTDATA', start), 'probe');
    }
    assert.strictEqual(await gateDegradedProvider('BRIGHTDATA', start), 'skip', 'all slots in use');

    releaseProviderProbe('BRIGHTDATA');

    assert.strictEqual(await gateDegradedProvider('BRIGHTDATA', start), 'probe', 'the released slot is available again');
    assert.strictEqual(await gateDegradedProvider('BRIGHTDATA', start), 'skip');
  });

  await t.test('releasing a probe nobody holds is harmless and never goes below zero', async () => {
    releaseProviderProbe('BRIGHTDATA');
    await insertRuns('BRIGHTDATA', repeat('failed', 20));
    const start = Date.now();

    assert.strictEqual(await gateDegradedProvider('BRIGHTDATA', start), 'probe');
    releaseProviderProbe('BRIGHTDATA');
    releaseProviderProbe('BRIGHTDATA');
    releaseProviderProbe('BRIGHTDATA');

    const decisions: string[] = [];
    for (let i = 0; i < PROVIDER_PROBES_PER_INTERVAL + 1; i += 1) {
      decisions.push(await gateDegradedProvider('BRIGHTDATA', start));
    }
    assert.strictEqual(decisions.filter((d) => d === 'probe').length, PROVIDER_PROBES_PER_INTERVAL, 'no more than the allowed probes, however often it was released');
  });

  await t.test('probes are tracked per provider', async () => {
    await insertRuns('APIFY', repeat('failed', 20));
    await insertRuns('BRIGHTDATA', repeat('failed', 20));
    const start = Date.now();

    for (let i = 0; i < PROVIDER_PROBES_PER_INTERVAL; i += 1) {
      assert.strictEqual(await gateDegradedProvider('APIFY', start), 'probe');
    }
    assert.strictEqual(await gateDegradedProvider('APIFY', start), 'skip');
    assert.strictEqual(await gateDegradedProvider('BRIGHTDATA', start), 'probe', "Apify's used probes do not use Bright Data's");
  });
});
