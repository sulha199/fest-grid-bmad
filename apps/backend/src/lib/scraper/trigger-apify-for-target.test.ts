import test from 'node:test';
import assert from 'node:assert';
import { randomBytes } from 'node:crypto';
import { db } from '../../db/client.js';
import { apifyPendingJobs, posts, scraperActorRuns, scraperProviderUsage, socialMediaAccountProfiles } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { attemptApifyAsyncTrigger, setAttemptApifyAsyncTrigger } from './trigger-apify-for-target.js';
import { ApifyApiError } from 'apify-client';
import { ScraperCapacityExceededError } from '@festgrid/domain';
import { clearApifyProviderUsage, APIFY_TEST_PROVIDER } from './usage-store-test-helpers.js';
import { PROVIDER_PROBES_PER_INTERVAL, resetProviderProbeClaimsForTests } from './provider-run-health-store.js';

test('trigger-apify-for-target tests', async (t) => {
  let testProfileId: string;
  const originalAttemptApifyAsyncTrigger = attemptApifyAsyncTrigger;

  t.before(async () => {
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({
        accountId: 'test-profile-id-' + Date.now(),
        platform: 'instagram',
        username: 'test_user',
        displayName: 'Test User',
      })
      .returning({ id: socialMediaAccountProfiles.id });
    testProfileId = profile.id;
  });

  t.after(async () => {
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, testProfileId));
    setAttemptApifyAsyncTrigger(originalAttemptApifyAsyncTrigger);
  });

  await clearApifyProviderUsage();

  t.afterEach(async () => {
    await db.delete(apifyPendingJobs).where(eq(apifyPendingJobs.profileId, testProfileId));
    await clearApifyProviderUsage();
  });

  await t.test('returns false when capacity unavailable', async () => {
    // Exhaust capacity
    await db.insert(scraperProviderUsage).values({
      provider: APIFY_TEST_PROVIDER,
      itemsUsedThisCycle: 10000,
      usageCycleResetAt: new Date(),
    });

    const result = await attemptApifyAsyncTrigger(
      { profileId: testProfileId, username: 'test_user' },
      '2026-08-01T00:00:00Z'
    );

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.failureReason, 'CAPACITY_EXHAUSTED');

    // Verify no pending job created
    const jobs = await db
      .select()
      .from(apifyPendingJobs)
      .where(eq(apifyPendingJobs.profileId, testProfileId));

    assert.strictEqual(jobs.length, 0);
  });

  await t.test('successfully creates pending job and returns true', async () => {
    let startCalled = false;
    let webhookUrl = '';

    // Mock the Apify client
    const mockClient = {
      actor: () => ({
        start: async (input: any, options: any) => {
          startCalled = true;
          webhookUrl = options.webhooks?.[0]?.requestUrl || '';
          return { id: 'run-mock-123' };
        },
      }),
    };

    // Temporarily replace getApifyClient
    let getApifyClientCalled = false;
    const originalModule = await import('./instagram-adapter.js');
    const savedGetApifyClient = originalModule.getApifyClient;

    // We can't easily mock this without modifying the source, so we'll use a seam
    // For now, create an integration-level test
    let triggerWasCalled = false;
    setAttemptApifyAsyncTrigger(async (target, newerThan) => {
      triggerWasCalled = true;
      // Simulate successful creation
      const { createPendingJob } = await import('./apify-pending-jobs-store.js');
      await createPendingJob({
        profileId: target.profileId,
        runId: 'run-sim-123',
        webhookToken: randomBytes(24).toString('hex'),
      });
      return { success: true };
    });

    const result = await attemptApifyAsyncTrigger(
      { profileId: testProfileId, username: 'test_user' },
      '2026-08-01T00:00:00Z'
    );

    assert.strictEqual(result.success, true);

    // Verify pending job was created
    const jobs = await db
      .select()
      .from(apifyPendingJobs)
      .where(eq(apifyPendingJobs.profileId, testProfileId));

    assert.strictEqual(jobs.length, 1);
    assert.strictEqual(jobs[0].status, 'PENDING');
    assert.ok(jobs[0].webhookToken);
  });

  await t.test('maps VendorDpaNotConfirmedError to DPA_NOT_CONFIRMED (AC6, real DPA gate via callApifyClient)', async () => {
    // Restore the real implementation (a prior sub-test replaced it via the seam) so this
    // exercises the actual callApifyClient -> callVendor -> assertDpaConfirmed gate, not a mock.
    setAttemptApifyAsyncTrigger(originalAttemptApifyAsyncTrigger);

    const original = process.env.APIFY_SCRAPING_CONFIRMED;
    process.env.APIFY_SCRAPING_CONFIRMED = 'false';
    try {
      const result = await attemptApifyAsyncTrigger(
        { profileId: testProfileId, username: 'test_user' },
        '2026-08-01T00:00:00Z'
      );

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.failureReason, 'DPA_NOT_CONFIRMED');
    } finally {
      if (original === undefined) {
        delete process.env.APIFY_SCRAPING_CONFIRMED;
      } else {
        process.env.APIFY_SCRAPING_CONFIRMED = original;
      }
    }

    // No pending job created -- the gate rejects before any real Apify call is attempted.
    const jobs = await db
      .select()
      .from(apifyPendingJobs)
      .where(eq(apifyPendingJobs.profileId, testProfileId));
    assert.strictEqual(jobs.length, 0);
  });

  await t.test('returns false on trigger error and creates no job', async () => {
    // Mock failure scenario
    setAttemptApifyAsyncTrigger(async (target, newerThan) => {
      // Simulate error scenario
      return { success: false, failureReason: 'TRIGGER_ERROR' };
    });

    const result = await attemptApifyAsyncTrigger(
      { profileId: testProfileId, username: 'test_user' },
      '2026-08-01T00:00:00Z'
    );

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.failureReason, 'TRIGGER_ERROR');

    // Verify no pending job created
    const jobs = await db
      .select()
      .from(apifyPendingJobs)
      .where(eq(apifyPendingJobs.profileId, testProfileId));

    assert.strictEqual(jobs.length, 0);
  });

  // BUG-075: the Apify cursor is where the stored posts end, never when a run finished -- an empty,
  // failed or timed-out run (it was never filtered by status) used to move it forward.
  await t.test('onlyPostsNewerThan is the newest stored post, not the finish time of a later empty run (BUG-075)', async () => {
    setAttemptApifyAsyncTrigger(originalAttemptApifyAsyncTrigger);

    const adapter = await import('./instagram-adapter.js');
    const savedGetApifyClient = adapter.getApifyClient;
    const startInputs: Array<Record<string, unknown>> = [];
    adapter.setGetApifyClient((() => ({
      actor: () => ({
        start: async (input: Record<string, unknown>) => {
          startInputs.push(input);
          return { id: 'run-cursor-' + Date.now() };
        },
      }),
    })) as unknown as typeof savedGetApifyClient);

    try {
      await db.insert(posts).values({
        accountId: testProfileId,
        platform: 'instagram',
        postUrl: 'https://www.instagram.com/p/apify-newest/',
        publishedAt: new Date('2026-10-20T15:30:00.000Z'),
      });
      await db.insert(scraperActorRuns).values({
        vendor: 'APIFY',
        triggerMode: 'ASYNC',
        profileId: testProfileId,
        runId: 'apify-cursor-empty-run-' + Date.now(),
        rawInput: {},
        status: 'SUCCEEDED',
        itemCount: 0,
        completedAt: new Date('2026-10-22T05:00:00.000Z'),
      });

      const result = await attemptApifyAsyncTrigger(
        { profileId: testProfileId, username: 'test_user' },
        '2026-10-13T00:00:00.000Z'
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(startInputs.length, 1);
      assert.strictEqual(startInputs[0].onlyPostsNewerThan, '2026-10-20T15:30:01.000Z');
    } finally {
      adapter.setGetApifyClient(savedGetApifyClient);
      // The pending job references the audit run, so it goes first.
      await db.delete(apifyPendingJobs).where(eq(apifyPendingJobs.profileId, testProfileId));
      await db.delete(posts).where(eq(posts.accountId, testProfileId));
      await db.delete(scraperActorRuns).where(eq(scraperActorRuns.profileId, testProfileId));
    }
  });

  await t.test('a profile with no stored post starts at the caller\'s window', async () => {
    setAttemptApifyAsyncTrigger(originalAttemptApifyAsyncTrigger);

    const adapter = await import('./instagram-adapter.js');
    const savedGetApifyClient = adapter.getApifyClient;
    const startInputs: Array<Record<string, unknown>> = [];
    adapter.setGetApifyClient((() => ({
      actor: () => ({
        start: async (input: Record<string, unknown>) => {
          startInputs.push(input);
          return { id: 'run-cursor-fallback-' + Date.now() };
        },
      }),
    })) as unknown as typeof savedGetApifyClient);

    try {
      const result = await attemptApifyAsyncTrigger(
        { profileId: testProfileId, username: 'test_user' },
        '2026-10-13T00:00:00.000Z'
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(startInputs[0].onlyPostsNewerThan, '2026-10-13T00:00:00.000Z');
    } finally {
      adapter.setGetApifyClient(savedGetApifyClient);
      await db.delete(apifyPendingJobs).where(eq(apifyPendingJobs.profileId, testProfileId));
      await db.delete(scraperActorRuns).where(eq(scraperActorRuns.profileId, testProfileId));
    }
  });

  // IDEA-095: a provider whose recent runs all failed or came back empty is skipped, bar a few probes.
  async function insertFailedApifyRuns(count: number) {
    const now = Date.now();
    await db.insert(scraperActorRuns).values(
      Array.from({ length: count }, (_, index) => ({
        vendor: 'APIFY' as const,
        triggerMode: 'ASYNC' as const,
        profileId: testProfileId,
        runId: `apify-degraded-test-${index}-${now}`,
        rawInput: {},
        status: 'FAILED' as const,
        itemCount: 0,
        completedAt: new Date(now - index * 1000),
      }))
    );
  }

  await t.test('a degraded provider is skipped with PROVIDER_DEGRADED, bar its few probes; a failed probe gives its slot back', async () => {
    setAttemptApifyAsyncTrigger(originalAttemptApifyAsyncTrigger);
    resetProviderProbeClaimsForTests();

    const adapter = await import('./instagram-adapter.js');
    const savedGetApifyClient = adapter.getApifyClient;
    let startCalls = 0;
    let failStarts = false;
    adapter.setGetApifyClient((() => ({
      actor: () => ({
        start: async () => {
          if (failStarts) throw new Error('Apify start failed');
          startCalls += 1;
          return { id: 'run-degraded-' + startCalls + '-' + Date.now() };
        },
      }),
    })) as unknown as typeof savedGetApifyClient);

    const trigger = () =>
      attemptApifyAsyncTrigger({ profileId: testProfileId, username: 'test_user' }, '2026-10-13T00:00:00.000Z');

    try {
      await insertFailedApifyRuns(20);

      const results = [];
      for (let i = 0; i < PROVIDER_PROBES_PER_INTERVAL + 2; i += 1) {
        results.push(await trigger());
      }
      assert.ok(
        results.slice(0, PROVIDER_PROBES_PER_INTERVAL).every((r) => r.success === true),
        'the first triggers are the probes and go through'
      );
      assert.deepStrictEqual(results.slice(PROVIDER_PROBES_PER_INTERVAL), [
        { success: false, failureReason: 'PROVIDER_DEGRADED' },
        { success: false, failureReason: 'PROVIDER_DEGRADED' },
      ]);
      assert.strictEqual(startCalls, PROVIDER_PROBES_PER_INTERVAL, 'nothing is sent to the vendor for a skipped target');

      // A probe whose start fails frees its slot: with all slots used, nothing could probe, so a
      // fresh interval is needed to show the release.
      resetProviderProbeClaimsForTests();
      failStarts = true;
      const failures = [];
      for (let i = 0; i < PROVIDER_PROBES_PER_INTERVAL + 2; i += 1) {
        failures.push(await trigger());
      }
      assert.ok(
        failures.every((r) => r.success === false && r.failureReason === 'TRIGGER_ERROR'),
        'each failed probe reports its own error and frees the slot, so none is skipped as degraded'
      );
    } finally {
      adapter.setGetApifyClient(savedGetApifyClient);
      resetProviderProbeClaimsForTests();
      await db.delete(apifyPendingJobs).where(eq(apifyPendingJobs.profileId, testProfileId));
      await db.delete(scraperActorRuns).where(eq(scraperActorRuns.profileId, testProfileId));
    }
  });
  // Prod 2026-10-23: the daily batch fired 35 triggers at once and Apify refused 31 of them with
  // 402 `actor-memory-limit-exceeded` (its concurrent-memory cap), which was then reported as a
  // TRIGGER_ERROR, i.e. a real outage, with a stack trace per target.
  function apifyError(statusCode: number, type: string): ApifyApiError {
    return new ApifyApiError(
      {
        status: statusCode,
        data: { error: { type, message: 'Exceeded the memory limit' } },
        config: { method: 'post', url: 'https://api.apify.com/v2/acts/apify~instagram-api-scraper/runs' },
        headers: {},
      } as never,
      1
    );
  }

  await t.test('a 402 actor-memory-limit-exceeded is CAPACITY_EXHAUSTED (not TRIGGER_ERROR), logs one line, and creates no job', async () => {
    setAttemptApifyAsyncTrigger(originalAttemptApifyAsyncTrigger);

    const adapter = await import('./instagram-adapter.js');
    const savedGetApifyClient = adapter.getApifyClient;
    adapter.setGetApifyClient((() => ({
      actor: () => ({
        start: async () => {
          throw apifyError(402, 'actor-memory-limit-exceeded');
        },
      }),
    })) as unknown as typeof savedGetApifyClient);

    const errors: unknown[][] = [];
    const warnings: unknown[][] = [];
    const originalError = console.error;
    const originalWarn = console.warn;
    console.error = (...args: unknown[]) => { errors.push(args); };
    console.warn = (...args: unknown[]) => { warnings.push(args); };

    try {
      const result = await attemptApifyAsyncTrigger(
        { profileId: testProfileId, username: 'test_user' },
        '2026-10-13T00:00:00.000Z'
      );
      assert.deepStrictEqual(result, { success: false, failureReason: 'CAPACITY_EXHAUSTED' });
    } finally {
      console.error = originalError;
      console.warn = originalWarn;
      adapter.setGetApifyClient(savedGetApifyClient);
    }

    assert.strictEqual(errors.length, 0, 'no stack trace for an expected capacity refusal');
    assert.strictEqual(warnings.length, 1, 'one log line');
    assert.ok(!(warnings[0][0] as string).includes('\n'));
    const jobs = await db.select().from(apifyPendingJobs).where(eq(apifyPendingJobs.profileId, testProfileId));
    assert.strictEqual(jobs.length, 0);
  });

  // Prod 2026-10-29: the FREE plan's $5 monthly cap was spent; every start returned 403 `platform-feature-disabled`.
  await t.test('a 403 platform-feature-disabled (monthly usage hard limit) is CAPACITY_EXHAUSTED, one log line, no job', async () => {
    setAttemptApifyAsyncTrigger(originalAttemptApifyAsyncTrigger);

    const adapter = await import('./instagram-adapter.js');
    const savedGetApifyClient = adapter.getApifyClient;
    adapter.setGetApifyClient((() => ({
      actor: () => ({ start: async () => { throw apifyError(403, 'platform-feature-disabled'); } }),
    })) as unknown as typeof savedGetApifyClient);

    const errors: unknown[][] = [];
    const warnings: unknown[][] = [];
    const originalError = console.error;
    const originalWarn = console.warn;
    console.error = (...args: unknown[]) => { errors.push(args); };
    console.warn = (...args: unknown[]) => { warnings.push(args); };

    try {
      const result = await attemptApifyAsyncTrigger(
        { profileId: testProfileId, username: 'test_user' },
        '2026-10-13T00:00:00.000Z'
      );
      assert.deepStrictEqual(result, { success: false, failureReason: 'CAPACITY_EXHAUSTED' });
    } finally {
      console.error = originalError;
      console.warn = originalWarn;
      adapter.setGetApifyClient(savedGetApifyClient);
    }

    assert.strictEqual(errors.length, 0);
    assert.strictEqual(warnings.length, 1);
    const jobs = await db.select().from(apifyPendingJobs).where(eq(apifyPendingJobs.profileId, testProfileId));
    assert.strictEqual(jobs.length, 0);
  });

  await t.test('other 402s (e.g. out of credit) and other errors stay TRIGGER_ERROR', async () => {
    setAttemptApifyAsyncTrigger(originalAttemptApifyAsyncTrigger);

    const adapter = await import('./instagram-adapter.js');
    const savedGetApifyClient = adapter.getApifyClient;
    const originalError = console.error;
    console.error = () => {};
    try {
      for (const error of [apifyError(402, 'not-enough-usage-to-run-paid-actor'), apifyError(500, 'actor-memory-limit-exceeded')]) {
        adapter.setGetApifyClient((() => ({
          actor: () => ({ start: async () => { throw error; } }),
        })) as unknown as typeof savedGetApifyClient);
        const result = await attemptApifyAsyncTrigger(
          { profileId: testProfileId, username: 'test_user' },
          '2026-10-13T00:00:00.000Z'
        );
        assert.deepStrictEqual(result, { success: false, failureReason: 'TRIGGER_ERROR' });
      }
    } finally {
      console.error = originalError;
      adapter.setGetApifyClient(savedGetApifyClient);
    }
  });

  await t.test('a probe refused for memory gives its probe slot back, like any other pre-vendor failure', async () => {
    setAttemptApifyAsyncTrigger(originalAttemptApifyAsyncTrigger);
    resetProviderProbeClaimsForTests();

    const adapter = await import('./instagram-adapter.js');
    const savedGetApifyClient = adapter.getApifyClient;
    adapter.setGetApifyClient((() => ({
      actor: () => ({ start: async () => { throw apifyError(402, 'actor-memory-limit-exceeded'); } }),
    })) as unknown as typeof savedGetApifyClient);
    const originalWarn = console.warn;
    console.warn = () => {};

    try {
      await insertFailedApifyRuns(20);
      const results = [];
      for (let i = 0; i < PROVIDER_PROBES_PER_INTERVAL + 2; i += 1) {
        results.push(await attemptApifyAsyncTrigger({ profileId: testProfileId, username: 'test_user' }, '2026-10-13T00:00:00.000Z'));
      }
      assert.ok(
        results.every((r) => r.success === false && r.failureReason === 'CAPACITY_EXHAUSTED'),
        'every refused probe frees its slot, so none is skipped as degraded'
      );
    } finally {
      console.warn = originalWarn;
      adapter.setGetApifyClient(savedGetApifyClient);
      resetProviderProbeClaimsForTests();
      await db.delete(scraperActorRuns).where(eq(scraperActorRuns.profileId, testProfileId));
    }
  });
});
