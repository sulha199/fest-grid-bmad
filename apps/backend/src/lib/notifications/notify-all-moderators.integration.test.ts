import test from 'node:test';
import assert from 'node:assert/strict';
import { inArray } from 'drizzle-orm';
import { alertEmailRateLimits, users } from '@festgrid/database';
import { db } from '../../db/client.js';
import { deleteModeratorNotifyKeys } from '../test-support/moderator-notify-throttle-cleanup.js';
import { buildModeratorNotifyThrottleKey, findActiveModeratorRecipients, notifyAllModerators } from './notify-all-moderators.js';

// Story 0.i1a (Task 6.4): the real lookup and the real throttle store against Postgres, with a recording fake
// for the sender (nothing is ever mailed). Rows created here (users, throttle rows) are deleted at the end;
// pre-existing rows are never touched (row-count ratchet, Story 0.51).
test('notifyAllModerators against real Postgres (fake sender)', async (t) => {
  const run = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const createdUserIds: string[] = [];
  const throttleKeys = new Set<string>();
  const keyOf = (entity: string, recipientUserId?: string) => {
    const key = buildModeratorNotifyThrottleKey('DANGEROUS_EVENT_MODERATOR_ALERT', entity, recipientUserId);
    throttleKeys.add(key);
    return key;
  };

  t.after(async () => {
    await deleteModeratorNotifyKeys(throttleKeys);
    if (createdUserIds.length > 0) await db.delete(users).where(inArray(users.id, createdUserIds));
  });

  const createUser = async (label: string, role: 'user' | 'moderator', deleted = false) => {
    const [user] = await db
      .insert(users)
      .values({ email: `${label}-${run}@example.invalid`, name: label, role, deletedAt: deleted ? new Date() : null })
      .returning();
    createdUserIds.push(user.id);
    return user;
  };

  const activeMod = await createUser('active-mod', 'moderator');
  const otherMod = await createUser('other-mod', 'moderator');
  const plainUser = await createUser('plain-user', 'user');
  const deletedMod = await createUser('deleted-mod', 'moderator', true);

  const fakeSender = () => {
    const sent: { to: string; variables: any }[] = [];
    return {
      sent,
      fn: async (_key: string, to: string, variables: any) => {
        sent.push({ to, variables });
        return 'fake-id';
      },
    };
  };

  await t.test('the lookup returns an active moderator and not a user or a soft-deleted moderator (AC1)', async () => {
    const ids = (await findActiveModeratorRecipients()).map((r) => r.id);
    assert.ok(ids.includes(activeMod.id));
    assert.ok(!ids.includes(plainUser.id));
    assert.ok(!ids.includes(deletedMod.id));
  });

  await t.test('the lookup by id returns the moderator only (AC6)', async () => {
    assert.deepEqual((await findActiveModeratorRecipients(activeMod.id)).map((r) => r.id), [activeMod.id]);
    assert.deepEqual(await findActiveModeratorRecipients(plainUser.id), []);
    assert.deepEqual(await findActiveModeratorRecipients(deletedMod.id), []);
    assert.deepEqual(await findActiveModeratorRecipients('00000000-0000-4000-8000-000000000000'), []);
  });

  await t.test('all-moderators mode mails the active moderators once, then throttles (AC1, AC3)', async () => {
    const sender = fakeSender();
    const vars = { eventName: `Integration Event ${run}` };
    keyOf(vars.eventName);
    const first = await notifyAllModerators('DANGEROUS_EVENT_MODERATOR_ALERT', vars, {}, { sendTemplatedEmail: sender.fn });
    assert.equal(first.status, 'sent');
    const to = sender.sent.map((s) => s.to);
    assert.ok(to.includes(activeMod.email));
    assert.ok(to.includes(otherMod.email));
    assert.ok(!to.includes(plainUser.email));
    assert.ok(!to.includes(deletedMod.email));
    const count = sender.sent.length;
    const second = await notifyAllModerators('DANGEROUS_EVENT_MODERATOR_ALERT', vars, {}, { sendTemplatedEmail: sender.fn });
    assert.deepEqual(second, { status: 'throttled' });
    assert.equal(sender.sent.length, count);
  });

  await t.test('single mode mails the one moderator; non-moderators are refused and spend no budget (AC6)', async () => {
    const sender = fakeSender();
    const vars = { eventName: `Single Event ${run}` };
    keyOf(vars.eventName, activeMod.id);
    keyOf(vars.eventName, otherMod.id);
    const ok = await notifyAllModerators('DANGEROUS_EVENT_MODERATOR_ALERT', vars, { recipientUserId: activeMod.id }, { sendTemplatedEmail: sender.fn });
    assert.deepEqual(ok, { status: 'sent', recipients: 1, sent: 1, failed: 0 });
    assert.deepEqual(sender.sent.map((s) => s.to), [activeMod.email]);
    for (const id of [plainUser.id, deletedMod.id, '00000000-0000-4000-8000-000000000000']) {
      const refused = await notifyAllModerators('DANGEROUS_EVENT_MODERATOR_ALERT', vars, { recipientUserId: id }, { sendTemplatedEmail: sender.fn });
      assert.deepEqual(refused, { status: 'refused_not_moderator' });
    }
    assert.equal(sender.sent.length, 1);
    const other = await notifyAllModerators('DANGEROUS_EVENT_MODERATOR_ALERT', vars, { recipientUserId: otherMod.id }, { sendTemplatedEmail: sender.fn });
    assert.equal(other.status, 'sent', 'the slot is per recipient');
  });

  await t.test('a total send failure releases the real throttle slot so the retry is sent (AC3, AC7)', async () => {
    const vars = { eventName: `Retry Event ${run}` };
    keyOf(vars.eventName, activeMod.id);
    const failing = await notifyAllModerators('DANGEROUS_EVENT_MODERATOR_ALERT', vars, { recipientUserId: activeMod.id }, {
      sendTemplatedEmail: async () => { throw new Error('SES simulated failure'); },
    });
    assert.equal(failing.status, 'failed');
    const sender = fakeSender();
    const retry = await notifyAllModerators('DANGEROUS_EVENT_MODERATOR_ALERT', vars, { recipientUserId: activeMod.id }, { sendTemplatedEmail: sender.fn });
    assert.equal(retry.status, 'sent');
  });

  await t.test('the throttle rows hold a hashed key, never the entity text (AC3)', async () => {
    const rows = await db
      .select({ key: alertEmailRateLimits.key })
      .from(alertEmailRateLimits)
      .where(inArray(alertEmailRateLimits.key, [...throttleKeys]));
    assert.equal(rows.length, 4, 'one row per tracked key');
    assert.ok(rows.every((r) => !r.key.includes(run)));
  });

});
