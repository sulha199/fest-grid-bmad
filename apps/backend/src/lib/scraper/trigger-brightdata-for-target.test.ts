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
import { setTriggerBrightDataJob, type BrightDataTriggerInput } from './brightdata-client.js';
import { resetProviderProbeClaimsForTests } from './provider-run-health-store.js';

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

  await t.test('a degraded provider is skipped with PROVIDER_DEGRADED, bar one probe', async () => {
    await insertFailedBrightDataRuns(20);

    const probe = await attemptBrightDataTrigger(target(), '2026-10-13T00:00:00.000Z');
    const skipped = await attemptBrightDataTrigger(target(), '2026-10-13T00:00:00.000Z');

    assert.deepStrictEqual(probe, { success: true }, 'the first trigger is the probe and goes through');
    assert.deepStrictEqual(skipped, { success: false, failureReason: 'PROVIDER_DEGRADED' });
    assert.strictEqual(triggerInputs.length, 1, 'nothing is sent to the vendor for the skipped target');
  });

  await t.test('a healthy provider is never skipped', async () => {
    for (let i = 0; i < 3; i += 1) {
      const result = await attemptBrightDataTrigger(target(), '2026-10-13T00:00:00.000Z');
      assert.deepStrictEqual(result, { success: true });
    }
    assert.strictEqual(triggerInputs.length, 3);
  });
});
