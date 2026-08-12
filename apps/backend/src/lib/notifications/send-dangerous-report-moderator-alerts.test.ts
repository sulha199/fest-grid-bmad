import test from 'node:test';
import * as assert from 'node:assert';
import { db } from '../../db/client.js';
import { users } from '@festgrid/database';
import { inArray } from 'drizzle-orm';
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

    assert.strictEqual(calls.length, 2, 'Should send to exactly 2 moderators');
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
    // To isolate, we can delete the seeded moderators or run with a mock sendTemplatedEmail.
    // However, the function queries the DB. Let's temporarily delete moderators in DB for this test,
    // and recreate/restore them, or we can just delete mod1 and mod2, run the test, and recreate them.
    // Actually, we can simply delete them, and recreate them or do the zero-moderator test first!
    // Let's delete the seeded moderators.
    await db.delete(users).where(inArray(users.id, [mod1.id, mod2.id]));

    const calls: any[] = [];
    const mockSendTemplatedEmail = async (templateKey: string, to: string, variables: any) => {
      calls.push({ templateKey, to, variables });
      return 'mock-msg-id';
    };

    await sendDangerousReportModeratorAlerts('Test Event Zero', {
      sendTemplatedEmail: mockSendTemplatedEmail as any,
    });

    assert.strictEqual(calls.length, 0, 'No calls should be made when there are no moderators');

    // Recreate them so subsequent tests have them
    const newMod1 = await createUser(`mod1-${testRunId}@example.com`, 'Mod One', 'moderator');
    const newMod2 = await createUser(`mod2-${testRunId}@example.com`, 'Mod Two', 'moderator');

    await t.test('Partial-failure case: one moderator send rejects, the other resolves successfully', async () => {
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

      assert.strictEqual(calls.length, 2, 'Should attempt both calls');
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

      assert.strictEqual(calls.length, 2, 'Should attempt both calls');
    });
  });
});
