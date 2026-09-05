import test from 'node:test';
import * as assert from 'node:assert';
import { db } from '../../db/client.js';
import { users } from '@festgrid/database';
import { inArray, eq } from 'drizzle-orm';
import { sendScraperAuditAlert } from './send-scraper-audit-alert.js';

test('sendScraperAuditAlert tests', async (t) => {
  const testRunId = Date.now();
  const createdUsers: any[] = [];

  t.after(async () => {
    if (createdUsers.length > 0) {
      await db.delete(users).where(inArray(users.id, createdUsers.map((u) => u.id)));
    }
  });

  const createUser = async (email: string, name: string, role: 'user' | 'moderator') => {
    const [user] = await db
      .insert(users)
      .values({ email, name, role })
      .returning();
    createdUsers.push(user);
    return user;
  };

  const mod1 = await createUser(`sa-mod1-${testRunId}@example.com`, 'Mod One', 'moderator');
  const mod2 = await createUser(`sa-mod2-${testRunId}@example.com`, 'Mod Two', 'moderator');
  const regularUser = await createUser(`sa-user-${testRunId}@example.com`, 'Regular User', 'user');

  await t.test('Happy path: dispatches notifications to all moderators', async () => {
    const calls: any[] = [];
    const mockSendTemplatedEmail = async (templateKey: string, to: string, variables: any) => {
      calls.push({ templateKey, to, variables });
      return 'mock-msg-id';
    };

    await sendScraperAuditAlert(
      { source: 'recordActorRunStart', message: 'DB error', context: '{"vendor":"APIFY"}' },
      { sendTemplatedEmail: mockSendTemplatedEmail as any }
    );

    assert.ok(calls.length >= 2, 'Should send to at least the 2 test moderators');
    const emails = calls.map((c) => c.to);
    assert.ok(emails.includes(mod1.email), 'Should include mod1');
    assert.ok(emails.includes(mod2.email), 'Should include mod2');
    assert.ok(!emails.includes(regularUser.email), 'Should not send to regular user');

    for (const call of calls) {
      assert.strictEqual(call.templateKey, 'SCRAPER_AUDIT_TRAIL_FAILURE_ALERT');
      assert.strictEqual(call.variables.source, 'recordActorRunStart');
      assert.strictEqual(call.variables.message, 'DB error');
      assert.strictEqual(call.variables.context, '{"vendor":"APIFY"}');
      assert.ok(call.variables.moderatorReviewUrl.endsWith('/moderator/items'));
    }
  });

  await t.test('Zero moderators case: does not throw and does not notify', async () => {
    await db.delete(users).where(inArray(users.id, [mod1.id, mod2.id]));

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

      await sendScraperAuditAlert(
        { source: 'persistUnprocessedPayload', message: 'FK violation', context: '{}' },
        { sendTemplatedEmail: mockSendTemplatedEmail as any }
      );

      assert.strictEqual(calls.length, 0, 'No calls should be made when there are no moderators');
    } finally {
      if (otherModeratorIds.length > 0) {
        await db.update(users).set({ role: 'moderator' }).where(inArray(users.id, otherModeratorIds));
      }
    }
  });

  await t.test('Partial-failure case: one moderator send rejects, the other resolves successfully', async () => {
    const newMod1 = await createUser(`sa-newMod1-${testRunId}@example.com`, 'Mod One', 'moderator');
    const newMod2 = await createUser(`sa-newMod2-${testRunId}@example.com`, 'Mod Two', 'moderator');

    const calls: any[] = [];
    const mockSendTemplatedEmail = async (templateKey: string, to: string, variables: any) => {
      calls.push({ templateKey, to, variables });
      if (to === newMod1.email) {
        throw new Error('SES simulated delivery failure');
      }
      return 'mock-msg-id';
    };

    await sendScraperAuditAlert(
      { source: 'recordActorRunResult', message: 'DB error', context: '{}' },
      { sendTemplatedEmail: mockSendTemplatedEmail as any }
    );

    assert.ok(calls.length >= 2, 'Should attempt at least the 2 calls');
  });
});
