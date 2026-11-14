import test from 'node:test';
import assert from 'node:assert/strict';
import { renderEmailTemplate } from '@festgrid/domain';
import {
  buildModeratorNotifyThrottleKey,
  notifyAllModerators,
  type ModeratorRecipient,
  type NotifyModeratorsDeps,
} from './notify-all-moderators.js';

// Story 0.i1a: every dependency is injected, so this file touches no database and no mail service.
const MOD_A: ModeratorRecipient = { id: 'mod-a', email: 'a@example.invalid' };
const MOD_B: ModeratorRecipient = { id: 'mod-b', email: 'b@example.invalid' };
const MOD_C: ModeratorRecipient = { id: 'mod-c', email: 'c@example.invalid' };
const PAYLOAD = `<script>alert(1)</script>"'&`;

type Sent = { templateKey: string; to: string; variables: any };

function harness(overrides: NotifyModeratorsDeps & { moderators?: ModeratorRecipient[] } = {}) {
  const sent: Sent[] = [];
  const claimed = new Set<string>();
  const taken: string[] = [];
  const released: string[] = [];
  const limits: unknown[] = [];
  const moderators = overrides.moderators ?? [MOD_A, MOD_B, MOD_C];
  const deps: NotifyModeratorsDeps = {
    sendTemplatedEmail: async (templateKey: string, to: string, variables: any) => {
      sent.push({ templateKey, to, variables });
      return 'fake-id';
    },
    findRecipients: async (recipientUserId?: string) =>
      recipientUserId === undefined ? moderators : moderators.filter((m) => m.id === recipientUserId),
    takeBudget: async (key: string, l) => {
      taken.push(key);
      limits.push(l);
      if (claimed.has(key)) return false;
      claimed.add(key);
      return true;
    },
    releaseBudget: async (key: string) => {
      released.push(key);
      claimed.delete(key);
    },
    pruneThrottle: async () => {},
    ...overrides,
  };
  return { deps, sent, claimed, taken, released, limits };
}

test('three moderators give three sends, each carrying the helper-built review URL (AC1)', async () => {
  const h = harness();
  const result = await notifyAllModerators('DANGEROUS_EVENT_MODERATOR_ALERT', { eventName: 'E1' }, {}, h.deps);
  assert.deepEqual(result, { status: 'sent', recipients: 3, sent: 3, failed: 0 });
  assert.deepEqual(h.sent.map((s) => s.to).sort(), [MOD_A.email, MOD_B.email, MOD_C.email]);
  for (const s of h.sent) {
    assert.equal(s.templateKey, 'DANGEROUS_EVENT_MODERATOR_ALERT');
    assert.equal(s.variables.eventName, 'E1');
    assert.ok(s.variables.moderatorReviewUrl.endsWith('/moderator/items'));
  }
  assert.deepEqual(h.limits[0], { maxSends: 1, windowMinutes: 60 });
});

test('a caller-supplied moderatorReviewUrl is a type error and is overwritten at runtime (AC1)', async () => {
  const h = harness();
  await notifyAllModerators(
    'DANGEROUS_EVENT_MODERATOR_ALERT',
    // @ts-expect-error the review URL is built by the helper only
    { eventName: 'E1', moderatorReviewUrl: 'https://evil.example.invalid/phish' },
    {},
    h.deps
  );
  assert.ok(h.sent.length > 0);
  for (const s of h.sent) assert.ok(!s.variables.moderatorReviewUrl.includes('evil.example.invalid'));
});

test('the review URL is /moderator/tools for the provider template and /moderator/items for the others (AC1)', async () => {
  const h = harness({ moderators: [MOD_A] });
  await notifyAllModerators(
    'SCRAPER_PROVIDER_DOWN_MODERATOR_ALERT',
    { provider: 'p', consecutiveFailureDays: 2, failureReasonSummary: 's' },
    {},
    h.deps
  );
  await notifyAllModerators('SCRAPER_AUDIT_TRAIL_FAILURE_ALERT', { source: 's', message: 'm', context: 'c' }, {}, h.deps);
  await notifyAllModerators(
    'DEFAULT_LOCATION_CHANGE_MODERATOR_ALERT',
    { accountDisplayName: 'A', previousLocationText: 'x', newLocationText: 'y' },
    {},
    h.deps
  );
  await notifyAllModerators(
    'DEFAULT_LOCATION_CHANGE_AWAITING_APPROVAL_ALERT',
    { accountDisplayName: 'A', previousLocationText: 'x', newLocationText: 'y', confidenceScorePercent: '70' },
    {},
    h.deps
  );
  assert.deepEqual(
    h.sent.map((s) => s.variables.moderatorReviewUrl.replace(/^.*(\/moderator\/[a-z]+)$/, '$1')),
    ['/moderator/tools', '/moderator/items', '/moderator/items', '/moderator/items']
  );
});

test('a second call for the same template and entity inside the window is throttled with zero sends (AC3)', async () => {
  const h = harness();
  await notifyAllModerators('DANGEROUS_EVENT_MODERATOR_ALERT', { eventName: 'E1' }, {}, h.deps);
  const sentAfterFirst = h.sent.length;
  const second = await notifyAllModerators('DANGEROUS_EVENT_MODERATOR_ALERT', { eventName: 'E1' }, {}, h.deps);
  assert.deepEqual(second, { status: 'throttled' });
  assert.equal(h.sent.length, sentAfterFirst);
});

test('a different entity, and a different template with the same entity, are not throttled (AC3)', async () => {
  const h = harness({ moderators: [MOD_A] });
  await notifyAllModerators('DANGEROUS_EVENT_MODERATOR_ALERT', { eventName: 'E1' }, {}, h.deps);
  const other = await notifyAllModerators('DANGEROUS_EVENT_MODERATOR_ALERT', { eventName: 'E2' }, {}, h.deps);
  const otherTemplate = await notifyAllModerators(
    'DEFAULT_LOCATION_CHANGE_MODERATOR_ALERT',
    { accountDisplayName: 'E1', previousLocationText: 'x', newLocationText: 'y' },
    {},
    h.deps
  );
  assert.equal(other.status, 'sent');
  assert.equal(otherTemplate.status, 'sent');
});

test('an explicit entityKey overrides the default entity (AC3)', async () => {
  const h = harness({ moderators: [MOD_A] });
  await notifyAllModerators('DANGEROUS_EVENT_MODERATOR_ALERT', { eventName: 'Same name' }, { entityKey: 'event-1' }, h.deps);
  const sameName = await notifyAllModerators('DANGEROUS_EVENT_MODERATOR_ALERT', { eventName: 'Same name' }, { entityKey: 'event-2' }, h.deps);
  const sameEntity = await notifyAllModerators('DANGEROUS_EVENT_MODERATOR_ALERT', { eventName: 'Renamed' }, { entityKey: 'event-1' }, h.deps);
  assert.equal(sameName.status, 'sent');
  assert.equal(sameEntity.status, 'throttled');
});

test('the audit-trail default entity is the source: same source with a different message is throttled (AC3)', async () => {
  const h = harness({ moderators: [MOD_A] });
  const first = await notifyAllModerators('SCRAPER_AUDIT_TRAIL_FAILURE_ALERT', { source: 'recordActorRunStart', message: 'm1', context: 'c1' }, {}, h.deps);
  const sameSource = await notifyAllModerators('SCRAPER_AUDIT_TRAIL_FAILURE_ALERT', { source: 'recordActorRunStart', message: 'm2', context: 'c2' }, {}, h.deps);
  const otherSource = await notifyAllModerators('SCRAPER_AUDIT_TRAIL_FAILURE_ALERT', { source: 'recordActorRunEnd', message: 'm1', context: 'c1' }, {}, h.deps);
  assert.equal(first.status, 'sent');
  assert.equal(sameSource.status, 'throttled');
  assert.equal(otherSource.status, 'sent');
});

test('the throttle key hashes the entity: no entity text appears in it (AC3)', async () => {
  const h = harness({ moderators: [MOD_A] });
  await notifyAllModerators('DANGEROUS_EVENT_MODERATOR_ALERT', { eventName: 'Secret Festival Name' }, {}, h.deps);
  assert.match(h.taken[0], /^moderator-notify:DANGEROUS_EVENT_MODERATOR_ALERT:[0-9a-f]{32}$/);
  assert.ok(!h.taken[0].includes('Secret'));
  assert.notEqual(
    buildModeratorNotifyThrottleKey('DANGEROUS_EVENT_MODERATOR_ALERT', 'x'),
    buildModeratorNotifyThrottleKey('DANGEROUS_EVENT_MODERATOR_ALERT', 'x', 'u1')
  );
});

test('a partial failure is sent with failed 1 and keeps the throttle slot (AC7)', async () => {
  const h = harness({
    sendTemplatedEmail: async (_k: string, to: string) => {
      if (to === MOD_A.email) throw new Error('SES simulated failure');
      return 'ok';
    },
  });
  const result = await notifyAllModerators('DANGEROUS_EVENT_MODERATOR_ALERT', { eventName: 'E1' }, {}, h.deps);
  assert.deepEqual(result, { status: 'sent', recipients: 3, sent: 2, failed: 1 });
  assert.equal(h.released.length, 0);
});

test('a total failure is failed, releases the slot once, and a retry then goes through (AC7)', async () => {
  let failing = true;
  const sent: string[] = [];
  const h = harness({
    sendTemplatedEmail: async (_k: string, to: string) => {
      if (failing) throw new Error('SES simulated failure');
      sent.push(to);
      return 'ok';
    },
  });
  const first = await notifyAllModerators('DANGEROUS_EVENT_MODERATOR_ALERT', { eventName: 'E1' }, {}, h.deps);
  assert.deepEqual(first, { status: 'failed', recipients: 3, failed: 3 });
  assert.equal(h.released.length, 1);
  failing = false;
  const retry = await notifyAllModerators('DANGEROUS_EVENT_MODERATOR_ALERT', { eventName: 'E1' }, {}, h.deps);
  assert.equal(retry.status, 'sent');
  assert.equal(sent.length, 3);
});

test('no moderators spends no budget (AC7)', async () => {
  const h = harness({ moderators: [] });
  const result = await notifyAllModerators('DANGEROUS_EVENT_MODERATOR_ALERT', { eventName: 'E1' }, {}, h.deps);
  assert.deepEqual(result, { status: 'no_moderators' });
  assert.equal(h.taken.length, 0);
  assert.equal(h.sent.length, 0);
});

test('a throttle error sends nothing and answers error/throttle (fail closed) (AC3, AC7)', async () => {
  const h = harness({ takeBudget: async () => { throw new Error('DB_DOWN'); } });
  const result = await notifyAllModerators('DANGEROUS_EVENT_MODERATOR_ALERT', { eventName: 'E1' }, {}, h.deps);
  assert.deepEqual(result, { status: 'error', stage: 'throttle' });
  assert.equal(h.sent.length, 0);
});

test('a lookup error answers error/lookup and spends no budget (AC7)', async () => {
  const h = harness({ findRecipients: async () => { throw new Error('DB_DOWN'); } });
  const result = await notifyAllModerators('DANGEROUS_EVENT_MODERATOR_ALERT', { eventName: 'E1' }, {}, h.deps);
  assert.deepEqual(result, { status: 'error', stage: 'lookup' });
  assert.equal(h.taken.length, 0);
});

test('the helper never rejects, even when the sender throws synchronously or a release fails (AC7)', async () => {
  const h = harness({
    sendTemplatedEmail: (() => { throw new Error('sync boom'); }) as any,
    releaseBudget: async () => { throw new Error('release boom'); },
  });
  const result = await notifyAllModerators('DANGEROUS_EVENT_MODERATOR_ALERT', { eventName: 'E1' }, {}, h.deps);
  assert.equal(result.status, 'failed');
});

test('a failing prune does not change a sent result (AC7)', async () => {
  const h = harness({ pruneThrottle: async () => { throw new Error('prune boom'); } });
  const result = await notifyAllModerators('DANGEROUS_EVENT_MODERATOR_ALERT', { eventName: 'E1' }, {}, h.deps);
  assert.equal(result.status, 'sent');
});

test('the result and the logs hold no address, name or variable value (AC7)', async () => {
  const lines: string[] = [];
  const origInfo = console.info;
  const origError = console.error;
  console.info = (...a: unknown[]) => { lines.push(a.map(String).join(' ')); };
  console.error = (...a: unknown[]) => { lines.push(a.map(String).join(' ')); };
  try {
    const h = harness({
      sendTemplatedEmail: async (_k: string, to: string) => {
        if (to === MOD_A.email) throw new Error('SES simulated failure');
        return 'ok';
      },
    });
    const result = await notifyAllModerators('DANGEROUS_EVENT_MODERATOR_ALERT', { eventName: 'Private Event Title' }, {}, h.deps);
    const all = JSON.stringify(result) + lines.join('\n');
    assert.ok(!all.includes('example.invalid'));
    assert.ok(!all.includes('Private Event Title'));
    assert.ok(lines.some((l) => l.includes('mod-a')), 'the failed send names the user id');
  } finally {
    console.info = origInfo;
    console.error = origError;
  }
});

// ---- single-recipient mode (AC6) ----

test('single mode: a moderator id sends exactly one mail to that user (AC6)', async () => {
  const h = harness();
  const result = await notifyAllModerators('DANGEROUS_EVENT_MODERATOR_ALERT', { eventName: 'E1' }, { recipientUserId: MOD_B.id }, h.deps);
  assert.deepEqual(result, { status: 'sent', recipients: 1, sent: 1, failed: 0 });
  assert.deepEqual(h.sent.map((s) => s.to), [MOD_B.email]);
});

test('single mode: an id that is not an active moderator is refused with no send and no budget spent (AC6)', async () => {
  const h = harness();
  const result = await notifyAllModerators('DANGEROUS_EVENT_MODERATOR_ALERT', { eventName: 'E1' }, { recipientUserId: 'a-plain-user-id' }, h.deps);
  assert.deepEqual(result, { status: 'refused_not_moderator' });
  assert.equal(h.sent.length, 0);
  assert.equal(h.taken.length, 0);
});

test('single mode: the throttle slot is per recipient and differs from the all-moderators slot (AC6)', async () => {
  const h = harness();
  const a = await notifyAllModerators('DANGEROUS_EVENT_MODERATOR_ALERT', { eventName: 'E1' }, { recipientUserId: MOD_A.id }, h.deps);
  const b = await notifyAllModerators('DANGEROUS_EVENT_MODERATOR_ALERT', { eventName: 'E1' }, { recipientUserId: MOD_B.id }, h.deps);
  const again = await notifyAllModerators('DANGEROUS_EVENT_MODERATOR_ALERT', { eventName: 'E1' }, { recipientUserId: MOD_A.id }, h.deps);
  const everyone = await notifyAllModerators('DANGEROUS_EVENT_MODERATOR_ALERT', { eventName: 'E1' }, {}, h.deps);
  assert.equal(a.status, 'sent');
  assert.equal(b.status, 'sent');
  assert.equal(again.status, 'throttled');
  assert.equal(everyone.status, 'sent');
  assert.equal(new Set(h.taken).size, 3);
});

// ---- rendering through the helper (AC2) ----

test('through the helper, a script-bearing payload renders escaped for the dangerous-report and audit-trail templates (AC2)', async () => {
  const rendered: { html: string; subject: string; text: string }[] = [];
  const h = harness({
    moderators: [MOD_A],
    sendTemplatedEmail: async (templateKey: any, _to: string, variables: any) => {
      rendered.push(renderEmailTemplate(templateKey, variables));
      return 'ok';
    },
  });
  await notifyAllModerators('DANGEROUS_EVENT_MODERATOR_ALERT', { eventName: PAYLOAD }, {}, h.deps);
  await notifyAllModerators(
    'SCRAPER_AUDIT_TRAIL_FAILURE_ALERT',
    { source: PAYLOAD, message: PAYLOAD, context: PAYLOAD },
    {},
    h.deps
  );
  await notifyAllModerators(
    'SCRAPER_PROVIDER_DOWN_MODERATOR_ALERT',
    { provider: PAYLOAD, consecutiveFailureDays: 2, failureReasonSummary: PAYLOAD },
    {},
    h.deps
  );
  assert.equal(rendered.length, 3);
  for (const r of rendered) {
    assert.ok(!r.html.includes('<script'));
    assert.ok(r.html.includes('&lt;script&gt;'));
  }
});
