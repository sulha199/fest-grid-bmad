import test from 'node:test';
import assert from 'node:assert';
import { db } from '../../db/client.js';
import {
  brightdataPendingJobs,
  posts,
  scraperActorRuns,
  scraperProviderUsage,
  socialMediaAccountProfiles,
} from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { attemptBrightDataTrigger } from './trigger-brightdata-for-target.js';
import { setTriggerBrightDataJob, mapBrightDataDateToStartDate, type BrightDataTriggerInput } from './brightdata-client.js';
import { PROVIDER_PROBES_PER_INTERVAL, resetProviderProbeClaimsForTests } from './provider-run-health-store.js';

// BUG-074: the Bright Data start date is derived from the newest stored post, never from the
// finish time of an earlier run (the 2026-10-21 outage "succeeded" with zero items every day and
// each such run moved the cursor forward, silently skipping the posts published in between).
test('attemptBrightDataTrigger start date', async (t) => {
  let profileId: string;
  let brightdataUsageExistedBefore: boolean;
  let triggerInputs: BrightDataTriggerInput[] = [];

  t.before(async () => {
    const [existingUsage] = await db
      .select()
      .from(scraperProviderUsage)
      .where(eq(scraperProviderUsage.provider, 'brightdata'));
    brightdataUsageExistedBefore = Boolean(existingUsage);

    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({
        accountId: 'bd-trigger-test-' + Date.now(),
        platform: 'instagram',
        username: 'bd_trigger_test_user',
        displayName: 'BD Trigger Test User',
        // The start-date rules below are those of a seeded profile; the unseeded one has its own test.
        historySeededAt: new Date(),
      })
      .returning({ id: socialMediaAccountProfiles.id });
    profileId = profile.id;

    setTriggerBrightDataJob(async (input) => {
      triggerInputs.push(input);
      return { snapshotId: `sd_trigger_test_${triggerInputs.length}_${Date.now()}` };
    });
  });

  t.beforeEach(() => {
    triggerInputs = [];
    resetProviderProbeClaimsForTests();
  });

  t.afterEach(async () => {
    await db.delete(brightdataPendingJobs).where(eq(brightdataPendingJobs.profileId, profileId));
    await db.delete(posts).where(eq(posts.accountId, profileId));
    await db.delete(scraperActorRuns).where(eq(scraperActorRuns.profileId, profileId));
  });

  t.after(async () => {
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profileId));
    if (!brightdataUsageExistedBefore) {
      await db.delete(scraperProviderUsage).where(eq(scraperProviderUsage.provider, 'brightdata'));
    }
  });

  const target = () => ({ profileId, username: 'bd_trigger_test_user' });

  await t.test('starts one day before the newest stored post', async () => {
    await db.insert(posts).values({
      accountId: profileId,
      platform: 'instagram',
      postUrl: 'https://www.instagram.com/p/bd-newest/',
      publishedAt: new Date('2026-10-20T15:30:00.000Z'),
    });

    const result = await attemptBrightDataTrigger(target(), '2026-10-13T00:00:00.000Z');

    assert.deepStrictEqual(result, { success: true });
    assert.strictEqual(triggerInputs.length, 1);
    assert.strictEqual(triggerInputs[0].startDate, '10-19-2026');
  });

  // A profile known only as a co-author holds posts that say nothing about its own timeline: its first
  // scrape must reach 30 days back, not start after them.
  await t.test('a profile whose history is not seeded starts 30 days back, whatever posts it holds', async () => {
    await db.update(socialMediaAccountProfiles).set({ historySeededAt: null }).where(eq(socialMediaAccountProfiles.id, profileId));
    try {
      await db.insert(posts).values({
        accountId: profileId,
        platform: 'instagram',
        postUrl: 'https://www.instagram.com/p/bd-coauthored/',
        publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      await attemptBrightDataTrigger(target(), new Date().toISOString());

      const expected = mapBrightDataDateToStartDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      assert.strictEqual(triggerInputs[0].startDate, expected);
    } finally {
      await db.update(socialMediaAccountProfiles).set({ historySeededAt: new Date() }).where(eq(socialMediaAccountProfiles.id, profileId));
    }
  });

  await t.test('a later zero-item "SUCCEEDED" run does not move the start date (the 2026-10-21 outage)', async () => {
    await db.insert(posts).values({
      accountId: profileId,
      platform: 'instagram',
      postUrl: 'https://www.instagram.com/p/bd-newest/',
      publishedAt: new Date('2026-10-20T15:30:00.000Z'),
    });
    await db.insert(scraperActorRuns).values({
      vendor: 'BRIGHTDATA',
      triggerMode: 'ASYNC',
      profileId,
      runId: 'bd-trigger-test-empty-run-' + Date.now(),
      rawInput: {},
      status: 'SUCCEEDED',
      itemCount: 0,
      completedAt: new Date('2026-10-22T03:00:00.000Z'),
    });

    await attemptBrightDataTrigger(target(), '2026-10-13T00:00:00.000Z');

    assert.strictEqual(triggerInputs[0].startDate, '10-19-2026');
  });

  await t.test('a profile with no stored post uses the caller\'s window, even if it has runs', async () => {
    await db.insert(scraperActorRuns).values({
      vendor: 'BRIGHTDATA',
      triggerMode: 'ASYNC',
      profileId,
      runId: 'bd-trigger-test-empty-run-nopost-' + Date.now(),
      rawInput: {},
      status: 'SUCCEEDED',
      itemCount: 0,
      completedAt: new Date('2026-10-22T03:00:00.000Z'),
    });

    await attemptBrightDataTrigger(target(), '2026-10-13T00:00:00.000Z');

    assert.strictEqual(triggerInputs[0].startDate, '10-13-2026');
  });

  await t.test('records the audit run with the start date it sent', async () => {
    await attemptBrightDataTrigger(target(), '2026-10-13T00:00:00.000Z');

    const runs = await db
      .select()
      .from(scraperActorRuns)
      .where(eq(scraperActorRuns.profileId, profileId));
    assert.strictEqual(runs.length, 1);
    assert.strictEqual(runs[0].status, 'PENDING');
    assert.strictEqual((runs[0].rawInput as { startDate: string }).startDate, '10-13-2026');
  });

  // IDEA-095: a provider whose recent runs all failed or came back empty is skipped, bar one probe.
  async function insertFailedBrightDataRuns(count: number) {
    const now = Date.now();
    await db.insert(scraperActorRuns).values(
      Array.from({ length: count }, (_, index) => ({
        vendor: 'BRIGHTDATA' as const,
        triggerMode: 'ASYNC' as const,
        profileId,
        runId: `bd-trigger-test-failed-${index}-${now}`,
        rawInput: {},
        status: 'FAILED' as const,
        itemCount: 0,
        completedAt: new Date(now - index * 1000),
      }))
    );
  }

  await t.test('a degraded provider is skipped with PROVIDER_DEGRADED, bar its few probes', async () => {
    await insertFailedBrightDataRuns(20);

    const results = [];
    for (let i = 0; i < PROVIDER_PROBES_PER_INTERVAL + 2; i += 1) {
      results.push(await attemptBrightDataTrigger(target(), '2026-10-13T00:00:00.000Z'));
    }

    const probes = results.slice(0, PROVIDER_PROBES_PER_INTERVAL);
    const skipped = results.slice(PROVIDER_PROBES_PER_INTERVAL);
    assert.ok(probes.every((r) => r.success === true), 'the first triggers are the probes and go through');
    assert.deepStrictEqual(skipped, [
      { success: false, failureReason: 'PROVIDER_DEGRADED' },
      { success: false, failureReason: 'PROVIDER_DEGRADED' },
    ]);
    assert.strictEqual(triggerInputs.length, PROVIDER_PROBES_PER_INTERVAL, 'nothing is sent to the vendor for a skipped target');
  });

  await t.test('a probe whose trigger fails gives its slot back, so a failing trigger cannot use up the probes', async () => {
    await insertFailedBrightDataRuns(20);
    setTriggerBrightDataJob(async () => {
      throw new Error('Bright Data trigger failed');
    });

    const failures = [];
    for (let i = 0; i < PROVIDER_PROBES_PER_INTERVAL + 2; i += 1) {
      failures.push(await attemptBrightDataTrigger(target(), '2026-10-13T00:00:00.000Z'));
    }
    // Every failing probe released its slot, so none of these was skipped as degraded.
    assert.ok(
      failures.every((r) => r.success === false && r.failureReason === 'TRIGGER_ERROR'),
      'each failed probe reports its own error and frees the slot'
    );

    setTriggerBrightDataJob(async (input) => {
      triggerInputs.push(input);
      return { snapshotId: `sd_trigger_test_after_${triggerInputs.length}_${Date.now()}` };
    });
    const afterwards = [];
    for (let i = 0; i < PROVIDER_PROBES_PER_INTERVAL + 1; i += 1) {
      afterwards.push(await attemptBrightDataTrigger(target(), '2026-10-13T00:00:00.000Z'));
    }
    assert.strictEqual(afterwards.filter((r) => r.success).length, PROVIDER_PROBES_PER_INTERVAL, 'the full number of probes is still available');
  });

  await t.test('a healthy provider is never skipped', async () => {
    for (let i = 0; i < 3; i += 1) {
      const result = await attemptBrightDataTrigger(target(), '2026-10-13T00:00:00.000Z');
      assert.deepStrictEqual(result, { success: true });
    }
    assert.strictEqual(triggerInputs.length, 3);
  });
});
