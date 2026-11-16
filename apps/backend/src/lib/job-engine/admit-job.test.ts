import test from 'node:test';
import assert from 'node:assert/strict';
import { eq, inArray, and } from 'drizzle-orm';
import { jobs, subscriptions, users, socialMediaAccountProfiles } from '@festgrid/database';
import { registerJobTypeDefinition } from '@festgrid/domain/jobs';
import { db } from '../../db/client.js';
import { admitJob } from './admit-job.js';

// Story 10.3 Task 4 (AC1 to AC4, AC7) -- admitJob against real Postgres: reuse, queue, queue order, queue full, the cap
// (with reserved slots, moderator, already-held) and sharing. Fixture types only; no real job type exists yet.

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const PLAIN = `fixture-admit-plain-${suffix}`;
const SLOT = `fixture-admit-slot-${suffix}`;
const SHARED = `fixture-admit-shared-${suffix}`;
registerJobTypeDefinition({ type: PLAIN, host: 'scraper', maxDurationMs: 600_000 });
registerJobTypeDefinition({ type: SLOT, host: 'scraper', maxDurationMs: 600_000, reservesSubscriptionSlot: true });
registerJobTypeDefinition({ type: SHARED, host: 'scraper', maxDurationMs: 600_000, sharedAcrossUsers: true });

const userIds: string[] = [];
const profileIds: string[] = [];

async function makeUser(role: 'user' | 'moderator' = 'user'): Promise<string> {
  const [user] = await db
    .insert(users)
    .values({ email: `admit-${suffix}-${userIds.length}@example.test`, role })
    .returning({ id: users.id });
  userIds.push(user.id);
  return user.id;
}

async function giveSubscriptions(userId: string, n: number, deleted = 0): Promise<void> {
  for (let i = 0; i < n + deleted; i += 1) {
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({ platform: 'instagram', accountId: `admit-${suffix}-${profileIds.length}`, username: `admit-${suffix}-${profileIds.length}`, displayName: 'x' })
      .returning({ id: socialMediaAccountProfiles.id });
    profileIds.push(profile.id);
    await db.insert(subscriptions).values({ userId, accountId: profile.id, deletedAt: i >= n ? new Date() : null });
  }
}

test.after(async () => {
  if (userIds.length > 0) {
    // jobs and subscriptions cascade with their user
    await db.delete(users).where(inArray(users.id, userIds));
  }
  if (profileIds.length > 0) {
    await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, profileIds));
  }
});

test('admitJob', async (t) => {
  await t.test('an admitted job holds its place from admission: admitted_at and the whole-job bound are set at once', async () => {
    const owner = await makeUser();
    const result = await admitJob({ type: PLAIN, inputKey: 'a', payload: { n: 1 }, ownerUserId: owner });
    assert.equal(result && 'outcome' in result && result.outcome, 'ADMITTED');
    const [row] = await db.select().from(jobs).where(eq(jobs.ownerUserId, owner));
    assert.equal(row.status, 'QUEUED');
    assert.ok(row.admittedAt instanceof Date);
    assert.equal(row.queuedSince, null);
    assert.equal(row.deadlineAt.getTime() - row.admittedAt.getTime(), 600_000);
    assert.deepEqual(row.input, { n: 1 });
    assert.equal(row.trigger, 'USER');
  });

  await t.test('the same work started twice by one user is REUSED and writes no second row (AC1)', async () => {
    const owner = await makeUser();
    const first = await admitJob({ type: PLAIN, inputKey: 'same', ownerUserId: owner });
    const second = await admitJob({ type: PLAIN, inputKey: 'same', ownerUserId: owner });
    assert.ok('outcome' in first && 'outcome' in second);
    assert.equal(second.outcome, 'REUSED');
    assert.equal(second.jobId, first.jobId);
    assert.equal((await db.select().from(jobs).where(eq(jobs.ownerUserId, owner))).length, 1);
  });

  await t.test('an ended job is not reused: the same work may start again', async () => {
    const owner = await makeUser();
    const first = await admitJob({ type: PLAIN, inputKey: 'again', ownerUserId: owner });
    assert.ok('jobId' in first);
    await db.update(jobs).set({ status: 'SUCCEEDED', finishedAt: new Date() }).where(eq(jobs.id, first.jobId));
    const second = await admitJob({ type: PLAIN, inputKey: 'again', ownerUserId: owner });
    assert.ok('outcome' in second);
    assert.equal(second.outcome, 'ADMITTED');
    assert.notEqual(second.jobId, first.jobId);
  });

  await t.test('different users never reuse each other for a private type', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const first = await admitJob({ type: PLAIN, inputKey: 'private', ownerUserId: a });
    const second = await admitJob({ type: PLAIN, inputKey: 'private', ownerUserId: b });
    assert.ok('outcome' in first && 'outcome' in second);
    assert.equal(first.outcome, 'ADMITTED');
    assert.equal(second.outcome, 'ADMITTED');
  });

  await t.test('over the limit a job is QUEUED, not admitted, stamped queued_since, with its position (AC3, AC4)', async () => {
    const owner = await makeUser();
    const outcomes: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const r = await admitJob({ type: PLAIN, inputKey: `q-${i}`, ownerUserId: owner });
      assert.ok('outcome' in r);
      outcomes.push(r.outcome === 'QUEUED' ? `QUEUED:${r.position}` : r.outcome);
    }
    assert.deepEqual(outcomes, ['ADMITTED', 'ADMITTED', 'ADMITTED', 'QUEUED:1', 'QUEUED:2']);
    const queued = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.ownerUserId, owner), eq(jobs.status, 'QUEUED')));
    const waiting = queued.filter((j) => j.admittedAt === null);
    assert.equal(waiting.length, 2);
    for (const job of waiting) {
      assert.ok(job.queuedSince instanceof Date);
    }
  });

  await t.test('a place held by a RUNNING job counts; a WAITING job holds none (FR121)', async () => {
    const owner = await makeUser();
    for (let i = 0; i < 3; i += 1) {
      await admitJob({ type: PLAIN, inputKey: `h-${i}`, ownerUserId: owner });
    }
    const all = await db.select().from(jobs).where(eq(jobs.ownerUserId, owner));
    await db.update(jobs).set({ status: 'WAITING' }).where(eq(jobs.id, all[0].id));
    await db.update(jobs).set({ status: 'RUNNING' }).where(eq(jobs.id, all[1].id));
    const next = await admitJob({ type: PLAIN, inputKey: 'h-next', ownerUserId: owner });
    assert.ok('outcome' in next);
    assert.equal(next.outcome, 'ADMITTED', 'two held, one free');
    const after = await admitJob({ type: PLAIN, inputKey: 'h-after', ownerUserId: owner });
    assert.ok('outcome' in after);
    assert.equal(after.outcome, 'QUEUED');
  });

  await t.test('a start beyond MAX_QUEUED_JOBS_PER_USER is refused JOB_QUEUE_FULL (AC4)', async () => {
    const owner = await makeUser();
    for (let i = 0; i < 13; i += 1) {
      const r = await admitJob({ type: PLAIN, inputKey: `f-${i}`, ownerUserId: owner });
      assert.ok('outcome' in r, `start ${i}`);
    }
    const refused = await admitJob({ type: PLAIN, inputKey: 'f-14', ownerUserId: owner });
    assert.deepEqual(refused, { refused: 'JOB_QUEUE_FULL' });
    assert.equal((await db.select().from(jobs).where(eq(jobs.ownerUserId, owner))).length, 13);
  });

  await t.test('an unknown type and an unknown user write nothing', async () => {
    const owner = await makeUser();
    assert.deepEqual(await admitJob({ type: `nope-${suffix}`, inputKey: 'x', ownerUserId: owner }), { refused: 'UNKNOWN_JOB_TYPE' });
    assert.deepEqual(
      await admitJob({ type: PLAIN, inputKey: 'x', ownerUserId: '00000000-0000-4000-8000-000000000000' }),
      { refused: 'UNKNOWN_USER' }
    );
  });

  await t.test('the cap counts active subscriptions plus reserved slots and ignores soft-deleted ones (AC7)', async () => {
    const owner = await makeUser();
    await giveSubscriptions(owner, 3, 4); // 3 active, 4 soft-deleted
    const first = await admitJob({ type: SLOT, inputKey: 's1', ownerUserId: owner });
    const second = await admitJob({ type: SLOT, inputKey: 's2', ownerUserId: owner });
    const third = await admitJob({ type: SLOT, inputKey: 's3', ownerUserId: owner });
    assert.ok('outcome' in first && 'outcome' in second);
    assert.deepEqual(third, { refused: 'SUBSCRIPTION_CAP_REACHED', activeCount: 3, reservedCount: 2, cap: 5 });
  });

  await t.test('a job that ended releases its reserved slot (AC6)', async () => {
    const owner = await makeUser();
    await giveSubscriptions(owner, 4);
    const first = await admitJob({ type: SLOT, inputKey: 'r1', ownerUserId: owner });
    assert.ok('jobId' in first);
    assert.equal((await admitJob({ type: SLOT, inputKey: 'r2', ownerUserId: owner }) as { refused?: string }).refused, 'SUBSCRIPTION_CAP_REACHED');
    await db.update(jobs).set({ status: 'FAILED', reasonCode: 'CANCELLED', finishedAt: new Date() }).where(eq(jobs.id, first.jobId));
    const retry = await admitJob({ type: SLOT, inputKey: 'r2', ownerUserId: owner });
    assert.ok('outcome' in retry);
  });

  await t.test('reuse comes before the cap: restarting the same slot-reserving work uses no extra slot', async () => {
    const owner = await makeUser();
    await giveSubscriptions(owner, 4);
    const first = await admitJob({ type: SLOT, inputKey: 'same-slot', ownerUserId: owner });
    const again = await admitJob({ type: SLOT, inputKey: 'same-slot', ownerUserId: owner });
    assert.ok('outcome' in first && 'outcome' in again);
    assert.equal(again.outcome, 'REUSED');
  });

  await t.test('a moderator is exempt from the cap and an already-held account needs no slot', async () => {
    const moderator = await makeUser('moderator');
    await giveSubscriptions(moderator, 7);
    const mod = await admitJob({ type: SLOT, inputKey: 'm1', ownerUserId: moderator });
    assert.ok('outcome' in mod);

    const owner = await makeUser();
    await giveSubscriptions(owner, 5);
    const held = await admitJob({ type: SLOT, inputKey: 'h1', ownerUserId: owner, alreadyHeldSubscription: true });
    assert.ok('outcome' in held);
    const notHeld = await admitJob({ type: SLOT, inputKey: 'h2', ownerUserId: owner });
    assert.equal((notHeld as { refused?: string }).refused, 'SUBSCRIPTION_CAP_REACHED');
  });

  await t.test('a user above the cap keeps every subscription and cannot add another', async () => {
    const owner = await makeUser();
    await giveSubscriptions(owner, 8);
    const refused = await admitJob({ type: SLOT, inputKey: 'above', ownerUserId: owner });
    assert.deepEqual(refused, { refused: 'SUBSCRIPTION_CAP_REACHED', activeCount: 8, reservedCount: 0, cap: 5 });
    assert.equal((await db.select().from(subscriptions).where(eq(subscriptions.userId, owner))).length, 8);
  });

  await t.test('a type that does not reserve a slot ignores the cap', async () => {
    const owner = await makeUser();
    await giveSubscriptions(owner, 6);
    const r = await admitJob({ type: PLAIN, inputKey: 'nocap', ownerUserId: owner });
    assert.ok('outcome' in r);
  });

  await t.test('sharing: a second user joins the first as a follower: WAITING, leader set, no place held (AC2)', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const leader = await admitJob({ type: SHARED, inputKey: 'public', ownerUserId: a });
    const follower = await admitJob({ type: SHARED, inputKey: 'public', ownerUserId: b });
    assert.ok('outcome' in leader && 'outcome' in follower);
    assert.equal(leader.outcome, 'ADMITTED');
    assert.equal(follower.outcome, 'SHARED');
    const [row] = await db.select().from(jobs).where(eq(jobs.id, follower.jobId));
    assert.equal(row.status, 'WAITING');
    assert.equal(row.leaderJobId, leader.jobId);
    assert.equal(row.ownerUserId, b);
    assert.equal(row.phase, 'following-leader');
    assert.ok(row.admittedAt instanceof Date);

    // no place held: b can still admit three other jobs
    for (let i = 0; i < 3; i += 1) {
      const r = await admitJob({ type: PLAIN, inputKey: `b-${i}`, ownerUserId: b });
      assert.ok('outcome' in r);
      assert.equal(r.outcome, 'ADMITTED');
    }
  });

  await t.test('sharing: a follower is reused by its own owner, and a leader that has ended is not joined', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const c = await makeUser();
    const leader = await admitJob({ type: SHARED, inputKey: 'public-2', ownerUserId: a });
    assert.ok('jobId' in leader);
    const first = await admitJob({ type: SHARED, inputKey: 'public-2', ownerUserId: b });
    const again = await admitJob({ type: SHARED, inputKey: 'public-2', ownerUserId: b });
    assert.ok('outcome' in first && 'outcome' in again);
    assert.equal(again.outcome, 'REUSED');
    assert.equal(again.jobId, first.jobId);

    await db.update(jobs).set({ status: 'SUCCEEDED', finishedAt: new Date() }).where(eq(jobs.id, leader.jobId));
    const fresh = await admitJob({ type: SHARED, inputKey: 'public-2', ownerUserId: c });
    assert.ok('outcome' in fresh);
    assert.equal(fresh.outcome, 'ADMITTED', 'an ended leader is not joined');
  });

  await t.test('a type that is not shared is never joined across users, even with the same key', async () => {
    const a = await makeUser();
    const b = await makeUser();
    await admitJob({ type: PLAIN, inputKey: 'nj', ownerUserId: a });
    const r = await admitJob({ type: PLAIN, inputKey: 'nj', ownerUserId: b });
    assert.ok('outcome' in r);
    assert.equal(r.outcome, 'ADMITTED');
  });
});
