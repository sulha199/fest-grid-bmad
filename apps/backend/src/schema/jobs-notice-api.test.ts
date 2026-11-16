import test from 'node:test';
import assert from 'node:assert/strict';
import { graphql } from 'graphql';
import { createSchema } from 'graphql-yoga';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { eq, inArray } from 'drizzle-orm';
import { jobs, userSettings, users } from '@festgrid/database';
import { db } from '../db/client.js';
import { resolvers } from './resolvers.js';
import { createFixtures } from '../lib/job-engine/job-engine-test-support.js';

// Story 10.13 Task 5 -- the badge count, markJobsOpened and acknowledgeJobEnded against a real Postgres. A fake `context.user`, no real auth.
// Every row is a child of a fixture user (deleted with it) or deleted here.

const schemaDir = path.resolve(process.cwd(), 'src/schema');
const typeDefs = fs.readdirSync(schemaDir).filter((f) => f.endsWith('.graphql')).map((f) => fs.readFileSync(path.join(schemaDir, f), 'utf8')).join('\n');
const schema = createSchema({ typeDefs, resolvers: resolvers as any });
type Viewer = { userId: string; role: 'user' | 'moderator' } | null;
const run = (source: string, viewer: Viewer, variableValues: Record<string, unknown> = {}) => graphql({ schema, source, variableValues, contextValue: { user: viewer } });
const COUNT = '{ jobsFinishedSinceLastOpened }';
const OPEN = 'mutation { markJobsOpened }';
const ACK = 'mutation($id: ID!) { acknowledgeJobEnded(jobId: $id) }';
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

test('Jobs notice API (Story 10.13, real Postgres)', async (t) => {
  const fx = createFixtures('notice-api');
  const systemJobIds: string[] = [];
  t.after(async () => {
    await fx.cleanup();
    if (systemJobIds.length > 0) await db.delete(jobs).where(inArray(jobs.id, systemJobIds));
  });
  const me = await fx.makeUser('user');
  const other = await fx.makeUser('user');
  const meViewer: Viewer = { userId: me, role: 'user' };
  let n = 0;
  const makeJob = async (owner: string | null, finishedAgoMs: number, status: 'SUCCEEDED' | 'FAILED' | 'EXPIRED' | 'RUNNING' = 'SUCCEEDED') => {
    const [row] = await db
      .insert(jobs)
      .values({
        type: fx.defineType(), ownerUserId: owner, trigger: owner === null ? 'SYSTEM' : 'USER', inputKey: `notice-${fx.suffix}-${n++}`, status,
        deadlineAt: new Date(Date.now() + 10 * MIN), finishedAt: status === 'RUNNING' ? null : new Date(Date.now() - finishedAgoMs),
      })
      .returning({ id: jobs.id });
    if (owner === null) systemJobIds.push(row.id);
    return row.id;
  };

  await t.test('every field needs a session', async () => {
    for (const source of [COUNT, OPEN]) {
      const result = await run(source, null);
      assert.equal(result.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED', source);
    }
    const ack = await run(ACK, null, { id: '00000000-0000-4000-8000-000000000000' });
    assert.equal(ack.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');
  });

  await t.test('counts only my own ended user jobs since the watermark: not a system job, not another user, not an open job, not past retention', async () => {
    await db.insert(userSettings).values({ userId: me, jobsLastOpenedAt: new Date(Date.now() - 2 * DAY) });
    await makeJob(me, 5 * MIN);
    await makeJob(me, 1 * MIN, 'FAILED');
    await makeJob(me, 3 * MIN, 'EXPIRED');
    await makeJob(me, 0, 'RUNNING');
    await makeJob(null, 2 * MIN);
    await makeJob(other, 2 * MIN);
    assert.equal((await run(COUNT, meViewer)).data?.jobsFinishedSinceLastOpened, 3);
    await makeJob(me, 40 * DAY);
    await db.update(userSettings).set({ jobsLastOpenedAt: new Date(Date.now() - 60 * DAY) }).where(eq(userSettings.userId, me));
    assert.equal((await run(COUNT, meViewer)).data?.jobsFinishedSinceLastOpened, 3, 'a job past the retention is hidden from the count');
  });

  await t.test('a job that ended before the watermark is not counted', async () => {
    await db.update(userSettings).set({ jobsLastOpenedAt: new Date(Date.now() - 2 * MIN) }).where(eq(userSettings.userId, me));
    assert.equal((await run(COUNT, meViewer)).data?.jobsFinishedSinceLastOpened, 1, 'only the 1-minute job ended after it');
  });

  await t.test('markJobsOpened clears the count', async () => {
    assert.equal((await run(OPEN, meViewer)).data?.markJobsOpened, true);
    assert.equal((await run(COUNT, meViewer)).data?.jobsFinishedSinceLastOpened, 0);
  });

  await t.test('a user with no settings row is counted from account creation, and markJobsOpened creates the row', async () => {
    const fresh = await fx.makeUser('user');
    await db.update(users).set({ createdAt: new Date(Date.now() - DAY) }).where(eq(users.id, fresh));
    await makeJob(fresh, 1000);
    const viewer: Viewer = { userId: fresh, role: 'user' };
    assert.equal((await run(COUNT, viewer)).data?.jobsFinishedSinceLastOpened, 1);
    await run(OPEN, viewer);
    assert.equal((await run(COUNT, viewer)).data?.jobsFinishedSinceLastOpened, 0);
  });

  await t.test('the count stops at 99', async () => {
    const heavy = await fx.makeUser('user');
    await db.update(users).set({ createdAt: new Date(Date.now() - DAY) }).where(eq(users.id, heavy));
    await db.insert(jobs).values(
      Array.from({ length: 105 }, (_, i) => ({
        type: fx.defineType(), ownerUserId: heavy, trigger: 'USER' as const, inputKey: `cap-${fx.suffix}-${i}`, status: 'SUCCEEDED' as const,
        deadlineAt: new Date(Date.now() + 10 * MIN), finishedAt: new Date(Date.now() - 1000),
      }))
    );
    assert.equal((await run(COUNT, { userId: heavy, role: 'user' })).data?.jobsFinishedSinceLastOpened, 99);
  });

  await t.test('acknowledgeJobEnded sets the mark on my own ended job once, and is a silent false for anything else', async () => {
    const mine = await makeJob(me, MIN);
    const theirs = await makeJob(other, MIN);
    const system = await makeJob(null, MIN);
    const open = await makeJob(me, 0, 'RUNNING');
    const mark = async (id: string) => (await db.select({ at: jobs.ownerNotifiedAt }).from(jobs).where(eq(jobs.id, id)))[0].at;
    for (const id of [theirs, system, open, '00000000-0000-4000-8000-000000000000', 'not-a-uuid']) {
      assert.equal((await run(ACK, meViewer, { id })).data?.acknowledgeJobEnded, false, id);
    }
    assert.equal(await mark(theirs), null);
    assert.equal(await mark(system), null);
    assert.equal(await mark(open), null);
    assert.equal((await run(ACK, meViewer, { id: mine })).data?.acknowledgeJobEnded, true);
    assert.ok((await mark(mine)) instanceof Date);
    assert.equal((await run(ACK, meViewer, { id: mine })).data?.acknowledgeJobEnded, false, 'already acknowledged');
  });
});

test('a settings row created by any path starts the badge watermark at the account creation, so unseen ended jobs are never hidden (Story 10.13 review fix)', async (t) => {
  const fx = createFixtures('notice-watermark');
  t.after(() => fx.cleanup());
  const { getOrCreateUserSettings } = await import('../lib/user-settings/get-or-create-user-settings.js');
  const viewerOf = (userId: string): Viewer => ({ userId, role: 'user' });
  let n = 0;
  const endedJob = async (owner: string) => {
    // The account is older than the job (a fresh fixture user would be created after it ended).
    await db.update(users).set({ createdAt: new Date(Date.now() - DAY) }).where(eq(users.id, owner));
    await db.insert(jobs).values({
      type: fx.defineType(), ownerUserId: owner, trigger: 'USER', inputKey: `wm-${fx.suffix}-${n++}`, status: 'SUCCEEDED',
      deadlineAt: new Date(Date.now() + 10 * MIN), finishedAt: new Date(Date.now() - MIN),
    });
  };
  const watermark = async (userId: string) => (await db.select({ at: userSettings.jobsLastOpenedAt }).from(userSettings).where(eq(userSettings.userId, userId)))[0]?.at;
  const createdAt = async (userId: string) => (await db.select({ at: users.createdAt }).from(users).where(eq(users.id, userId)))[0].at;

  const viaGetOrCreate = await fx.makeUser('user');
  await endedJob(viaGetOrCreate);
  assert.equal((await run(COUNT, viewerOf(viaGetOrCreate))).data?.jobsFinishedSinceLastOpened, 1, 'no row: measured from the account creation');
  await getOrCreateUserSettings(viaGetOrCreate);
  assert.equal((await watermark(viaGetOrCreate))?.getTime(), (await createdAt(viaGetOrCreate)).getTime(), 'the row the helper created agrees with the fallback');
  assert.equal((await run(COUNT, viewerOf(viaGetOrCreate))).data?.jobsFinishedSinceLastOpened, 1, 'creating the row hides nothing');
  const again = await getOrCreateUserSettings(viaGetOrCreate);
  assert.equal(again.jobsLastOpenedAt.getTime(), (await createdAt(viaGetOrCreate)).getTime(), 'an existing row is not moved');

  const viaOpen = await fx.makeUser('user');
  await endedJob(viaOpen);
  assert.equal((await run(OPEN, viewerOf(viaOpen))).data?.markJobsOpened, true);
  assert.ok((await watermark(viaOpen))!.getTime() > (await createdAt(viaOpen)).getTime(), 'an explicit open still means now');
  assert.equal((await run(COUNT, viewerOf(viaOpen))).data?.jobsFinishedSinceLastOpened, 0);
});
