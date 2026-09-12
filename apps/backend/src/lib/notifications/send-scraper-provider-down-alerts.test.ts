import test from 'node:test';
import * as assert from 'node:assert';
import { db } from '../../db/client.js';
import { users, scraperProviderHealth } from '@festgrid/database';
import { inArray, eq } from 'drizzle-orm';
import { sendScraperProviderDownAlerts } from './send-scraper-provider-down-alerts.js';

test('sendScraperProviderDownAlerts tests', async (t) => {
  const testRunId = Date.now();
  const provider = `test-provider-${testRunId}`;
  const provider2 = `test-provider2-${testRunId}`;
  const provider3 = `test-provider3-${testRunId}`;
  const createdUsers: any[] = [];

  t.after(async () => {
    if (createdUsers.length > 0) {
      await db.delete(users).where(inArray(users.id, createdUsers.map((u) => u.id)));
    }
    await db.delete(scraperProviderHealth).where(eq(scraperProviderHealth.provider, provider));
    await db.delete(scraperProviderHealth).where(eq(scraperProviderHealth.provider, provider2));
    await db.delete(scraperProviderHealth).where(eq(scraperProviderHealth.provider, provider3));
  });

  const createUser = async (email: string, name: string, role: 'user' | 'moderator') => {
    const [user] = await db.insert(users).values({ email, name, role }).returning();
    createdUsers.push(user);
    return user;
  };

  const seedHealthRow = async (
    consecutiveFailureDays: number,
    lastAlertSentAt: Date | null = null,
    lastFailureReason: string | null = null
  ) => {
    await db.delete(scraperProviderHealth).where(eq(scraperProviderHealth.provider, provider));
    await db.insert(scraperProviderHealth).values({
      provider,
      consecutiveFailureDays,
      lastCheckedAt: new Date(),
      lastAlertSentAt: lastAlertSentAt ?? undefined,
      lastFailureReason,
    });
  };

  const mod1 = await createUser(`mod1-${testRunId}@example.com`, 'Mod One', 'moderator');
  const mod2 = await createUser(`mod2-${testRunId}@example.com`, 'Mod Two', 'moderator');
  const regularUser = await createUser(`user-${testRunId}@example.com`, 'Regular User', 'user');

  await t.test('no qualifying provider: sends no email', async () => {
    await seedHealthRow(0);

    const calls: any[] = [];
    const mockSendTemplatedEmail = async (templateKey: string, to: string, variables: any) => {
      calls.push({ templateKey, to, variables });
      return 'mock-msg-id';
    };

    await sendScraperProviderDownAlerts({ sendTemplatedEmail: mockSendTemplatedEmail as any });

    assert.strictEqual(
      calls.filter((c) => c.variables?.provider === provider).length,
      0,
      'No alert should be sent for a provider below threshold'
    );
  });

  await t.test('qualifying provider with zero moderators: logs and returns without throwing', async () => {
    await seedHealthRow(5);

    const otherModerators = await db.select().from(users).where(eq(users.role, 'moderator'));
    const otherModeratorIds = otherModerators.map((m) => m.id);
    if (otherModeratorIds.length > 0) {
      await db.update(users).set({ role: 'user' }).where(inArray(users.id, otherModeratorIds));
    }

    try {
      const calls: any[] = [];
      const mockSendTemplatedEmail = async (templateKey: string, to: string, variables: any) => {
        calls.push({ templateKey, to, variables });
        return 'mock-msg-id';
      };

      await sendScraperProviderDownAlerts({ sendTemplatedEmail: mockSendTemplatedEmail as any });

      assert.strictEqual(calls.length, 0, 'No calls should be made when there are no moderators');
    } finally {
      if (otherModeratorIds.length > 0) {
        await db.update(users).set({ role: 'moderator' }).where(inArray(users.id, otherModeratorIds));
      }
    }
  });

  await t.test('qualifying provider with moderators: each moderator emailed, alert marked sent once', async () => {
    await seedHealthRow(5);

    const calls: any[] = [];
    const mockSendTemplatedEmail = async (templateKey: string, to: string, variables: any) => {
      calls.push({ templateKey, to, variables });
      return 'mock-msg-id';
    };

    await sendScraperProviderDownAlerts({ sendTemplatedEmail: mockSendTemplatedEmail as any });

    const providerCalls = calls.filter((c) => c.variables?.provider === provider);
    assert.ok(providerCalls.length >= 2, 'Should send to at least the 2 test moderators');
    const emails = providerCalls.map((c) => c.to);
    assert.ok(emails.includes(mod1.email));
    assert.ok(emails.includes(mod2.email));
    assert.ok(!emails.includes(regularUser.email));

    providerCalls.forEach((c) => {
      assert.strictEqual(c.templateKey, 'SCRAPER_PROVIDER_DOWN_MODERATOR_ALERT');
      assert.strictEqual(c.variables.consecutiveFailureDays, 5);
      assert.ok(c.variables.moderatorReviewUrl.endsWith('/moderator/tools'));
    });

    const [row] = await db
      .select()
      .from(scraperProviderHealth)
      .where(eq(scraperProviderHealth.provider, provider));
    assert.ok(row.lastAlertSentAt, 'lastAlertSentAt should be stamped after a successful send');
  });

  await t.test('a send failure for one moderator does not prevent others from being alerted', async () => {
    await seedHealthRow(5);

    const calls: any[] = [];
    const mockSendTemplatedEmail = async (templateKey: string, to: string, variables: any) => {
      calls.push({ templateKey, to, variables });
      if (to === mod1.email) {
        throw new Error('SES simulated delivery failure');
      }
      return 'mock-msg-id';
    };

    await sendScraperProviderDownAlerts({ sendTemplatedEmail: mockSendTemplatedEmail as any });

    const providerCalls = calls.filter((c) => c.variables?.provider === provider);
    assert.ok(providerCalls.length >= 2, 'Should attempt at least the 2 calls');

    const [row] = await db
      .select()
      .from(scraperProviderHealth)
      .where(eq(scraperProviderHealth.provider, provider));
    assert.ok(row.lastAlertSentAt, 'lastAlertSentAt should still be stamped since mod2 succeeded');
  });

  await t.test('dual vendors past threshold: independent, non-masking dispatches with per-provider cooldown', async () => {
    // Two independent eligible providers (both fresh, never alerted, past threshold) with
    // distinct failure reasons/days -- a simultaneous dual-vendor outage (AC5).
    await seedHealthRow(5, null, 'TRIGGER_ERROR');
    await db.delete(scraperProviderHealth).where(eq(scraperProviderHealth.provider, provider2));
    await db.insert(scraperProviderHealth).values({
      provider: provider2,
      consecutiveFailureDays: 7,
      lastFailureReason: 'CAPACITY_EXHAUSTED',
      lastCheckedAt: new Date(),
    });
    // A third provider that is just-alerted (in cooldown) must NOT block the two eligible
    // providers above, nor be dispatched itself.
    await db.delete(scraperProviderHealth).where(eq(scraperProviderHealth.provider, provider3));
    await db.insert(scraperProviderHealth).values({
      provider: provider3,
      consecutiveFailureDays: 6,
      lastFailureReason: 'TRIGGER_ERROR',
      lastCheckedAt: new Date(),
      lastAlertSentAt: new Date(),
    });

    const calls: any[] = [];
    const mockSendTemplatedEmail = async (templateKey: string, to: string, variables: any) => {
      calls.push({ templateKey, to, variables });
      return 'mock-msg-id';
    };

    await sendScraperProviderDownAlerts({ sendTemplatedEmail: mockSendTemplatedEmail as any });

    const provider1Calls = calls.filter((c) => c.variables?.provider === provider);
    const provider2Calls = calls.filter((c) => c.variables?.provider === provider2);
    const provider3Calls = calls.filter((c) => c.variables?.provider === provider3);

    // Both eligible providers dispatch independently in the same call -- neither masks the other.
    assert.ok(provider1Calls.length >= 2, 'Eligible provider 1 should be emailed to all moderators');
    assert.ok(provider2Calls.length >= 2, 'Eligible provider 2 should be emailed to all moderators');
    // The in-cooldown provider is skipped while the fresh ones still fire.
    assert.strictEqual(provider3Calls.length, 0, 'In-cooldown provider should be skipped');

    // Each eligible provider carries its own distinct content (reason + days) -- no overwrite.
    provider1Calls.forEach((c) => {
      assert.strictEqual(c.variables.consecutiveFailureDays, 5);
      assert.ok(c.variables.failureReasonSummary.includes('real trigger/API error'));
    });
    provider2Calls.forEach((c) => {
      assert.strictEqual(c.variables.consecutiveFailureDays, 7);
      assert.ok(c.variables.failureReasonSummary.includes('capacity/budget limit'));
    });

    // markProviderAlertSent is applied independently per dispatched provider.
    const [row1] = await db
      .select()
      .from(scraperProviderHealth)
      .where(eq(scraperProviderHealth.provider, provider));
    const [row2] = await db
      .select()
      .from(scraperProviderHealth)
      .where(eq(scraperProviderHealth.provider, provider2));
    assert.ok(row1.lastAlertSentAt, 'Eligible provider 1 should be marked sent');
    assert.ok(row2.lastAlertSentAt, 'Eligible provider 2 should be marked sent');
  });
});
