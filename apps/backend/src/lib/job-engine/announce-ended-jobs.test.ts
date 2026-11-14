import test from 'node:test';
import assert from 'node:assert/strict';
import { eq, inArray } from 'drizzle-orm';
import type { Messaging } from 'firebase-admin/messaging';
import { fcmTokens, jobs, socialMediaAccountProfiles, userSettings } from '@festgrid/database';
import { registerJobTypePresentation } from '@festgrid/domain/jobs';
import { renderEmailTemplate } from '@festgrid/domain';
import { db } from '../../db/client.js';
import type { NotifyModeratorsDeps } from '../notifications/notify-all-moderators.js';
import { announceEndedJobs } from './announce-ended-jobs.js';
import { cancelJob } from './cancel-job.js';
import { createFixtures } from './job-engine-test-support.js';
import { settleJobFromLateResult } from './late-results.js';

// Story 10.13 Task 7.1, 7.1a, 7.2, 7.3 -- the announcer against real Postgres with FAKES for Firebase and for the moderator helper's
// dependencies: no real FCM call, no SES send, no vendor call, no Lambda invoke. Every row is a child of a fixture user (deleted by the
// fixture cleanup, which cascades jobs, settings and tokens) or is removed explicitly; the fake `takeBudget` leaves no throttle rows.

const fx = createFixtures('announce');
const profileIds: string[] = [];
test.after(async () => {
  await fx.cleanup();
  if (profileIds.length > 0) await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, profileIds));
});
test.beforeEach(() => fx.stubInvoke());

type Sent = { tokens: string[]; title: string; body: string; data: Record<string, string> };
type FakeOptions = { throwOnSend?: boolean; invalidTokens?: string[] };

function fakeMessaging(options: FakeOptions = {}) {
  const sent: Sent[] = [];
  const client = {
    sendEachForMulticast: async (payload: { tokens: string[]; notification: { title: string; body: string }; data: Record<string, string> }) => {
      if (options.throwOnSend) throw new Error('fcm down');
      sent.push({ tokens: payload.tokens, title: payload.notification.title, body: payload.notification.body, data: payload.data });
      return {
        responses: payload.tokens.map((token) =>
          options.invalidTokens?.includes(token) ? { success: false, error: { code: 'messaging/registration-token-not-registered' } } : { success: true }
        ),
      };
    },
  } as unknown as Messaging;
  return { sent, getMessaging: () => client };
}

type Mail = { key: string; to: string; variables: Record<string, unknown> };
function fakeModeratorDeps(options: { claim?: boolean; failSend?: boolean; recipients?: 'owner' | 'none' | 'throw'; ownerId?: string } = {}) {
  const mails: Mail[] = [];
  let claims = 0;
  const deps: NotifyModeratorsDeps = {
    sendTemplatedEmail: async (key, to, variables) => {
      if (options.failSend) throw new Error('ses down');
      mails.push({ key, to, variables: variables as Record<string, unknown> });
    },
    findRecipients: async (recipientUserId) => {
      if (options.recipients === 'throw') throw new Error('db blip');
      if (options.recipients === 'none') return [];
      return [{ id: recipientUserId as string, email: `mod-${recipientUserId}@example.test` }];
    },
    takeBudget: async () => {
      claims += 1;
      return options.claim ?? true;
    },
    releaseBudget: async () => {},
    pruneThrottle: async () => {},
  };
  return { mails, deps, claims: () => claims };
}

const NOW = new Date();
const secondsAgo = (s: number) => new Date(NOW.getTime() - s * 1000);
let seq = 0;

async function makeOwner(options: { role?: 'user' | 'moderator'; push?: boolean; token?: boolean; lastPushAt?: Date | null } = {}) {
  const ownerId = await fx.makeUser(options.role ?? 'user');
  const token = `announce-token-${fx.suffix}-${seq++}`;
  if (options.push !== undefined || options.lastPushAt) {
    await db.insert(userSettings).values({ userId: ownerId, pushNotificationsEnabled: options.push ?? true, lastJobPushAt: options.lastPushAt ?? null });
  }
  if (options.token !== false) await db.insert(fcmTokens).values({ token, userId: ownerId });
  return { ownerId, token };
}

async function makeEndedJob(ownerId: string | null, options: { ago?: number; status?: 'SUCCEEDED' | 'FAILED' | 'EXPIRED'; type?: string; input?: unknown; notified?: boolean; errorMessage?: string; resultData?: unknown } = {}) {
  const [row] = await db
    .insert(jobs)
    .values({
      type: options.type ?? fx.defineType(),
      ownerUserId: ownerId,
      trigger: ownerId === null ? 'SYSTEM' : 'USER',
      inputKey: `announce-${fx.suffix}-${seq++}`,
      input: options.input ?? null,
      status: options.status ?? 'SUCCEEDED',
      deadlineAt: secondsAgo(-600),
      admittedAt: secondsAgo(500),
      finishedAt: secondsAgo(options.ago ?? 120),
      ownerNotifiedAt: options.notified ? secondsAgo(10) : null,
      errorMessage: options.errorMessage ?? null,
      resultData: options.resultData ?? null,
    })
    .returning({ id: jobs.id });
  return row.id;
}

const notifiedAt = async (id: string) => (await db.select({ at: jobs.ownerNotifiedAt }).from(jobs).where(eq(jobs.id, id)))[0].at;
const lastPush = async (userId: string) => (await db.select({ at: userSettings.lastJobPushAt }).from(userSettings).where(eq(userSettings.userId, userId)))[0]?.at ?? null;
const mine = (sent: Sent[], token: string) => sent.filter((s) => s.tokens.includes(token));

test('one ended job is one push to its job page, marked handled, and the merge window starts', async () => {
  const { ownerId, token } = await makeOwner();
  const id = await makeEndedJob(ownerId);
  const fake = fakeMessaging();
  await announceEndedJobs({ ...fake, now: NOW });
  const pushes = mine(fake.sent, token);
  assert.equal(pushes.length, 1);
  assert.deepEqual(pushes[0].data, { type: 'JOB_FINISHED', path: `/jobs/${id}` });
  assert.match(pushes[0].body, /finished.*selesai/);
  assert.ok((await notifiedAt(id)) instanceof Date);
  assert.ok((await lastPush(ownerId)) instanceof Date, 'the settings row is created when the user had none');
});

test('three jobs ending inside the window merge into one push to /jobs', async () => {
  const { ownerId, token } = await makeOwner();
  const ids = [await makeEndedJob(ownerId), await makeEndedJob(ownerId, { status: 'FAILED' }), await makeEndedJob(ownerId, { status: 'EXPIRED' })];
  const fake = fakeMessaging();
  await announceEndedJobs({ ...fake, now: NOW });
  const pushes = mine(fake.sent, token);
  assert.equal(pushes.length, 1);
  assert.deepEqual(pushes[0].data, { type: 'JOB_FINISHED', path: '/jobs' });
  assert.match(pushes[0].body, /3 jobs finished/);
  for (const id of ids) assert.ok(await notifiedAt(id));
});

test('a job inside the window after a push is held, and goes out merged after the window closes', async () => {
  const { ownerId, token } = await makeOwner({ lastPushAt: secondsAgo(120) });
  const ids = [await makeEndedJob(ownerId), await makeEndedJob(ownerId)];
  const fake = fakeMessaging();
  await announceEndedJobs({ ...fake, now: NOW });
  assert.equal(mine(fake.sent, token).length, 0);
  assert.equal(await notifiedAt(ids[0]), null);
  await announceEndedJobs({ ...fake, now: new Date(NOW.getTime() + 9 * 60_000) });
  const pushes = mine(fake.sent, token);
  assert.equal(pushes.length, 1);
  assert.equal(pushes[0].data.path, '/jobs');
  for (const id of ids) assert.ok(await notifiedAt(id));
});

test('push setting off, and no registered device, mark the job handled with nothing sent', async () => {
  const off = await makeOwner({ push: false });
  const none = await makeOwner({ token: false });
  const a = await makeEndedJob(off.ownerId);
  const b = await makeEndedJob(none.ownerId);
  const fake = fakeMessaging();
  await announceEndedJobs({ ...fake, now: NOW });
  assert.equal(mine(fake.sent, off.token).length, 0);
  assert.ok(await notifiedAt(a));
  assert.ok(await notifiedAt(b));
});

test('a job the owner already saw (acknowledged), a job inside the grace and a job past the max age are not pushed', async () => {
  const { ownerId, token } = await makeOwner();
  const seen = await makeEndedJob(ownerId, { notified: true });
  const fresh = await makeEndedJob(ownerId, { ago: 10 });
  const old = await makeEndedJob(ownerId, { ago: 90 * 60 });
  const fake = fakeMessaging();
  await announceEndedJobs({ ...fake, now: NOW });
  assert.equal(mine(fake.sent, token).length, 0);
  assert.equal(await notifiedAt(fresh), null, 'held for a later run');
  assert.ok(await notifiedAt(old), 'marked handled');
  assert.ok(await notifiedAt(seen));
});

test('a system job never sends and is never marked', async () => {
  const id = await makeEndedJob(null);
  const fake = fakeMessaging();
  const moderator = fakeModeratorDeps();
  await announceEndedJobs({ ...fake, moderatorDeps: moderator.deps, now: NOW });
  assert.equal(await notifiedAt(id), null);
  assert.equal(moderator.claims(), 0);
  await db.delete(jobs).where(eq(jobs.id, id));
});

test('a late result that revives an expired job is announced again once; an owner cancel is not announced, a cancel by replacement is', async () => {
  const { ownerId, token } = await makeOwner();
  const id = await makeEndedJob(ownerId, { status: 'EXPIRED', notified: true });
  await db.update(jobs).set({ reasonCode: 'TIMED_OUT' }).where(eq(jobs.id, id));
  const [row] = await db.select({ id: jobs.id, ownerUserId: jobs.ownerUserId, deadlineAt: jobs.deadlineAt }).from(jobs).where(eq(jobs.id, id));
  assert.equal(await settleJobFromLateResult(row, { outcome: 'SUCCEEDED' }), true);
  assert.equal(await notifiedAt(id), null);
  await db.update(jobs).set({ finishedAt: secondsAgo(120) }).where(eq(jobs.id, id));
  const fake = fakeMessaging();
  await announceEndedJobs({ ...fake, now: NOW });
  await announceEndedJobs({ ...fake, now: NOW });
  assert.equal(mine(fake.sent, token).length, 1, 'announced again exactly once');

  const own = await db.insert(jobs).values({ type: fx.defineType(), ownerUserId: ownerId, trigger: 'USER', inputKey: `c1-${fx.suffix}`, deadlineAt: secondsAgo(-600) }).returning({ id: jobs.id });
  assert.equal(await cancelJob(own[0].id, ownerId), 'CANCELLED');
  assert.ok(await notifiedAt(own[0].id), 'the owner pressed Cancel and was watching');
  const replaced = await db.insert(jobs).values({ type: fx.defineType(), ownerUserId: ownerId, trigger: 'USER', inputKey: `c2-${fx.suffix}`, deadlineAt: secondsAgo(-600) }).returning({ id: jobs.id });
  assert.equal(await cancelJob(replaced[0].id, ownerId, { message: 'Replaced by a new request.' }), 'CANCELLED');
  assert.equal(await notifiedAt(replaced[0].id), null);
});

test('an invalid device token is deleted and the others are kept', async () => {
  const { ownerId, token } = await makeOwner();
  const second = `announce-token-${fx.suffix}-second`;
  await db.insert(fcmTokens).values({ token: second, userId: ownerId });
  await makeEndedJob(ownerId);
  const fake = fakeMessaging({ invalidTokens: [token] });
  await announceEndedJobs({ ...fake, now: NOW });
  const left = (await db.select({ token: fcmTokens.token }).from(fcmTokens).where(eq(fcmTokens.userId, ownerId))).map((r) => r.token);
  assert.deepEqual(left, [second]);
});

test('a Firebase initialisation failure and an FCM failure leave the jobs pending and unmarked', async () => {
  const a = await makeOwner();
  const b = await makeOwner();
  const idA = await makeEndedJob(a.ownerId);
  const idB = await makeEndedJob(b.ownerId);
  const errors: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => void errors.push(String(args[0]));
  try {
    await announceEndedJobs({ getMessaging: () => { throw new Error('no credentials'); }, now: NOW });
  } finally {
    console.error = originalError;
  }
  assert.equal(await notifiedAt(idA), null);
  assert.equal(await notifiedAt(idB), null);
  assert.equal(errors.filter((line) => line.includes('Firebase initialisation failed')).length, 1, 'reported once per run');
  assert.equal(await lastPush(a.ownerId), null);

  const failing = fakeMessaging({ throwOnSend: true });
  console.error = () => {};
  try {
    await announceEndedJobs({ ...failing, now: NOW });
  } finally {
    console.error = originalError;
  }
  assert.equal(await notifiedAt(idA), null);
  const ok = fakeMessaging();
  await announceEndedJobs({ ...ok, now: NOW });
  assert.ok(await notifiedAt(idA), 'retried and sent on the next run');
});

test('two overlapping runs send once', async () => {
  const { ownerId, token } = await makeOwner();
  await makeEndedJob(ownerId);
  const fake = fakeMessaging();
  await Promise.all([announceEndedJobs({ ...fake, now: NOW }), announceEndedJobs({ ...fake, now: NOW })]);
  assert.equal(mine(fake.sent, token).length, 1);
});

test('the push names the job type and the account handle only, never a vendor, caption, URL or error text', async () => {
  const CANARY = `canary-caption-${fx.suffix}`;
  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({ accountId: `announce-acct-${fx.suffix}`, platform: 'instagram', displayName: `Display ${CANARY}`, username: `announce_${fx.suffix.replace(/-/g, '_')}`.slice(0, 40) })
    .returning();
  profileIds.push(profile.id);
  const type = fx.defineType();
  registerJobTypePresentation({ engineType: type, graphqlType: 'ACCOUNT_REFRESH', phases: [], subjectKind: 'ACCOUNT', outcomeKind: 'ACCOUNT' });
  const poison = { accountId: profile.id, held: CANARY, url: `https://example.test/${CANARY}?sig=${CANARY}` };
  const { ownerId, token } = await makeOwner({ role: 'moderator' });
  await makeEndedJob(ownerId, { type, input: poison, status: 'FAILED', errorMessage: `apify bright ${CANARY}`, resultData: { caption: CANARY } });
  const fake = fakeMessaging();
  const moderator = fakeModeratorDeps();
  await announceEndedJobs({ ...fake, moderatorDeps: moderator.deps, now: NOW });

  const push = mine(fake.sent, token)[0];
  assert.match(push.body, new RegExp(`Account refresh finished: @${profile.username}`));
  assert.equal(moderator.mails.length, 1);
  const rendered = renderEmailTemplate('JOB_FINISHED_MODERATOR_NOTICE', moderator.mails[0].variables as never);
  for (const text of [JSON.stringify(push), JSON.stringify(moderator.mails[0].variables), rendered.subject, rendered.html, rendered.text]) {
    assert.ok(!text.includes(CANARY), 'the canary never appears');
    assert.ok(!/apify|bright|https?:\/\//i.test(text.replace(/https?:\/\/[^\s"<]*\/jobs/gi, '')), 'no vendor name or URL (the Jobs link of the mail excepted)');
  }
});

test('a moderator owner gets the helper called once per group, with the owner as recipient and only the three variables', async () => {
  const { ownerId, token } = await makeOwner({ role: 'moderator' });
  const ids = [await makeEndedJob(ownerId), await makeEndedJob(ownerId)];
  const fake = fakeMessaging();
  const moderator = fakeModeratorDeps();
  await announceEndedJobs({ ...fake, moderatorDeps: moderator.deps, now: NOW });
  assert.equal(moderator.mails.length, 1, 'one mail for the merged group');
  assert.equal(moderator.mails[0].to, `mod-${ownerId}@example.test`);
  assert.equal(moderator.mails[0].key, 'JOB_FINISHED_MODERATOR_NOTICE');
  assert.deepEqual(Object.keys(moderator.mails[0].variables).sort(), ['jobId', 'moderatorReviewUrl', 'summaryEn', 'summaryId']);
  assert.equal(moderator.mails[0].variables.jobId, [...ids].sort()[0]);
  assert.equal(mine(fake.sent, token).length, 1, 'a moderator also gets the push');
});

test('a non-moderator owner never causes a helper call', async () => {
  const { ownerId } = await makeOwner();
  await makeEndedJob(ownerId);
  const moderator = fakeModeratorDeps();
  await announceEndedJobs({ ...fakeMessaging(), moderatorDeps: moderator.deps, now: NOW });
  assert.equal(moderator.claims(), 0);
  assert.equal(moderator.mails.length, 0);
});

test('helper results sent, throttled, refused_not_moderator mark handled; a moderator with push off still gets the mail', async () => {
  const cases: Array<[string, Parameters<typeof fakeModeratorDeps>[0]]> = [
    ['sent', {}],
    ['throttled', { claim: false }],
    ['refused_not_moderator', { recipients: 'none' }],
  ];
  for (const [name, options] of cases) {
    const { ownerId } = await makeOwner({ role: 'moderator', push: false });
    const id = await makeEndedJob(ownerId);
    const moderator = fakeModeratorDeps(options);
    await announceEndedJobs({ ...fakeMessaging(), moderatorDeps: moderator.deps, now: NOW });
    assert.ok(await notifiedAt(id), `${name} is handled`);
    assert.equal(moderator.mails.length, name === 'sent' ? 1 : 0, name);
  }
});

test('a failed or errored mail for a mail-only owner stays pending and is retried; a sent push is never repeated for a mail failure', async () => {
  const mailOnly = await makeOwner({ role: 'moderator', push: false });
  const idA = await makeEndedJob(mailOnly.ownerId);
  for (const options of [{ failSend: true }, { recipients: 'throw' as const }]) {
    await announceEndedJobs({ ...fakeMessaging(), moderatorDeps: fakeModeratorDeps(options).deps, now: NOW });
    assert.equal(await notifiedAt(idA), null);
  }
  const retry = fakeModeratorDeps();
  await announceEndedJobs({ ...fakeMessaging(), moderatorDeps: retry.deps, now: NOW });
  assert.ok(await notifiedAt(idA));
  assert.equal(retry.mails.length, 1);

  const both = await makeOwner({ role: 'moderator' });
  const idB = await makeEndedJob(both.ownerId);
  const fake = fakeMessaging();
  await announceEndedJobs({ ...fake, moderatorDeps: fakeModeratorDeps({ failSend: true }).deps, now: NOW });
  assert.ok(await notifiedAt(idB), 'handled: the push went out');
  await announceEndedJobs({ ...fake, moderatorDeps: fakeModeratorDeps().deps, now: NOW });
  assert.equal(mine(fake.sent, both.token).length, 1, 'the push was not repeated');
});

test('the real helper (only SES and the budget faked) renders a summary with markup escaped and a one-line subject', async () => {
  const { ownerId } = await makeOwner({ role: 'moderator', push: false });
  const type = fx.defineType();
  registerJobTypePresentation({ engineType: type, graphqlType: 'EXTRACT_SELECTED_POSTS', phases: [], subjectKind: 'POSTS', outcomeKind: 'NONE' });
  await makeEndedJob(ownerId, { type, input: { postIds: ['a', 'b'] } });
  const mails: Mail[] = [];
  const deps: NotifyModeratorsDeps = {
    sendTemplatedEmail: async (key, to, variables) => void mails.push({ key, to, variables: variables as Record<string, unknown> }),
    takeBudget: async () => true,
    releaseBudget: async () => {},
    pruneThrottle: async () => {},
  };
  await announceEndedJobs({ ...fakeMessaging(), moderatorDeps: deps, now: NOW });
  assert.equal(mails.length, 1, 'the real recipient lookup found the active moderator');
  const rendered = renderEmailTemplate('JOB_FINISHED_MODERATOR_NOTICE', { ...(mails[0].variables as { jobId: string; summaryId: string; moderatorReviewUrl: string }), summaryEn: '<script>x</script> & "q"\nline' });
  assert.ok(!rendered.html.includes('<script>') && rendered.html.includes('&lt;script&gt;') && rendered.html.includes('&amp;'));
  assert.ok(!/[\r\n]/.test(rendered.subject));
  assert.match(String(mails[0].variables.summaryEn), /2 posts/);
  assert.match(String(mails[0].variables.moderatorReviewUrl), /\/jobs$/);
});
