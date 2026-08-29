import test from 'node:test';
import * as assert from 'node:assert';
import { db } from '../../db/client.js';
import { users } from '@festgrid/database';
import { inArray, eq } from 'drizzle-orm';
import { sendDangerousReportModeratorAlerts } from './send-dangerous-report-moderator-alerts.js';

test('sendDangerousReportModeratorAlerts tests', async (t) => {
  const testRunId = Date.now();
  const createdUsers: any[] = [];

  // Helper to clean up created entities
  t.after(async () => {
    if (createdUsers.length > 0) {
      await db.delete(users).where(inArray(users.id, createdUsers.map(u => u.id)));
    }
  });

  const createUser = async (email: string, name: string, role: 'user' | 'moderator') => {
    const [user] = await db
      .insert(users)
      .values({
        email,
        name,
        role,
      })
      .returning();
    createdUsers.push(user);
    return user;
  };

  // Seed users: 2 moderators and 1 regular user
  const mod1 = await createUser(`mod1-${testRunId}@example.com`, 'Mod One', 'moderator');
  const mod2 = await createUser(`mod2-${testRunId}@example.com`, 'Mod Two', 'moderator');
  const regularUser = await createUser(`user-${testRunId}@example.com`, 'Regular User', 'user');

  await t.test('Happy path: dispatches notifications to all moderators', async () => {
    const calls: any[] = [];
    const mockSendTemplatedEmail = async (templateKey: string, to: string, variables: any) => {
      calls.push({ templateKey, to, variables });
      return 'mock-msg-id';
    };

    await sendDangerousReportModeratorAlerts('Test Event 1', {
      sendTemplatedEmail: mockSendTemplatedEmail as any,
    });

    assert.ok(calls.length >= 2, 'Should send to at least the 2 test moderators');
    const emails = calls.map((c) => c.to);
    assert.ok(emails.includes(mod1.email), 'Should include mod1');
    assert.ok(emails.includes(mod2.email), 'Should include mod2');
    assert.ok(!emails.includes(regularUser.email), 'Should not send to regular user');

    for (const call of calls) {
      assert.strictEqual(call.templateKey, 'DANGEROUS_EVENT_MODERATOR_ALERT');
      assert.strictEqual(call.variables.eventName, 'Test Event 1');
      assert.ok(call.variables.moderatorReviewUrl.endsWith('/moderator/items'));
    }
  });

  await t.test('Zero moderators case: does not throw and does not notify', async () => {
    await db.delete(users).where(inArray(users.id, [mod1.id, mod2.id]));

    // Any OTHER real moderators in the shared users table (this project's own seed data
    // includes a real moderator account) must also be neutralized for the duration of
    // this one assertion, then restored exactly. Demoting/promoting the role column in
    // place -- not deleting and reinserting -- means we never touch anyone's real row id.
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

      await sendDangerousReportModeratorAlerts('Test Event Zero', {
        sendTemplatedEmail: mockSendTemplatedEmail as any,
      });

      assert.strictEqual(calls.length, 0, 'No calls should be made when there are no moderators');
    } finally {
      if (otherModeratorIds.length > 0) {
        await db.update(users).set({ role: 'moderator' }).where(inArray(users.id, otherModeratorIds));
      }
    }
  });

  await t.test('Partial-failure case: one moderator send rejects, the other resolves successfully', async () => {
    // Recreate them so subsequent tests have them
    const newMod1 = await createUser(`newMod1-${testRunId}@example.com`, 'Mod One', 'moderator');
    const newMod2 = await createUser(`newMod2-${testRunId}@example.com`, 'Mod Two', 'moderator');

    const calls: any[] = [];
    const mockSendTemplatedEmail = async (templateKey: string, to: string, variables: any) => {
      calls.push({ templateKey, to, variables });
      if (to === newMod1.email) {
        throw new Error('SES simulated delivery failure');
      }
      return 'mock-msg-id';
    };

    // Should resolve without throwing
    await sendDangerousReportModeratorAlerts('Test Event Partial', {
      sendTemplatedEmail: mockSendTemplatedEmail as any,
    });

    assert.ok(calls.length >= 2, 'Should attempt at least the 2 calls');
  });

  await t.test('All-failure case: all moderator sends reject', async () => {
    const calls: any[] = [];
    const mockSendTemplatedEmail = async (templateKey: string, to: string, variables: any) => {
      calls.push({ templateKey, to, variables });
      throw new Error('SES simulated delivery failure');
    };

    // Should resolve without throwing
    await sendDangerousReportModeratorAlerts('Test Event All Fail', {
      sendTemplatedEmail: mockSendTemplatedEmail as any,
    });

    assert.ok(calls.length >= 2, 'Should attempt at least the 2 calls');
  });
});