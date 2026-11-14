import test from 'node:test';
import assert from 'node:assert/strict';
import { graphql } from 'graphql';
import { createSchema } from 'graphql-yoga';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getTableName, inArray, eq, or } from 'drizzle-orm';
import { jobAttempts, jobs, posts, socialMediaAccountProfiles, users } from '@festgrid/database';
import { registerJobTypePresentation, REEXTRACT_POST_JOB_TYPE } from '@festgrid/domain/jobs';
import { db } from '../db/client.js';
import { resolvers } from './resolvers.js';
import { createFixtures } from '../lib/job-engine/job-engine-test-support.js';

// Story 10.4 (Part A) -- the Jobs read API against a real Postgres: scope, retention (hide-only), leak canaries, queue and waiting info,
// steps, retry, pagination errors. No vendor call and no Lambda invoke (the invoke seam is stubbed). Every row it creates is deleted.

const schemaDir = path.resolve(process.cwd(), 'src/schema');
const typeDefs = fs
  .readdirSync(schemaDir)
  .filter((f) => f.endsWith('.graphql'))
  .map((f) => fs.readFileSync(path.join(schemaDir, f), 'utf8'))
  .join('\n');
const schema = createSchema({ typeDefs, resolvers: resolvers as any });

type Viewer = { userId: string; role: 'user' | 'moderator' } | null;
async function run(source: string, variableValues: Record<string, unknown>, viewer: Viewer) {
  return graphql({ schema, source, variableValues, contextValue: { user: viewer } });
}
const codeOf = (result: { errors?: readonly { extensions?: Record<string, unknown> }[] }) => result.errors?.[0]?.extensions?.code;

const JOB_FIELDS = `
  id type trigger status isCancelled reasonCode reasonRetryAfter reasonQueueMaxWaitMinutes createdAt startedAt finishedAt deadlineAt
  completedAfterDeadline
  subject { kind accountId platform username displayName profileImageUrl postCount postCode postId }
  steps { key state done total }
  queue { position maxConcurrent expiresAt }
  waiting { waitingFor resumeAt done total }
  outcome { kind eventCount postCount previewApplyUntil previewApplied }
  canRetry retryNotBefore
  owner { displayName }
  moderatorDetails { attempts { provider outcome budgetMs elapsedMs reasonCode } engineReasonCode engineMessage }`;
const JOB_QUERY = `query($id: ID!) { job(id: $id) { ${JOB_FIELDS} } }`;
const MY_JOBS_QUERY = `query($filter: JobsFilter, $onlyEnded: Boolean, $first: Int, $after: String) {
  myJobs(filter: $filter, onlyEnded: $onlyEnded, first: $first, after: $after) { totalCount pageInfo { hasNextPage endCursor } edges { cursor node { id status } } } }`;
const ACTIVE_QUERY = `query($filter: JobsFilter, $subject: JobSubjectInput, $ended: Int) {
  activeJobs(filter: $filter, subject: $subject, endedWithinMinutes: $ended) { id status type } }`;
const RETRY_MUTATION = `mutation($id: ID!) { retryJob(jobId: $id) { outcome errorCode activeCount reservedCount cap maxQueued retryNotBefore job { id status type } } }`;

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

test('Jobs read API (Story 10.4 Part A, real Postgres)', async (t) => {
  const fx = createFixtures('jobs-read');
  const suffix = fx.suffix;
  const createdJobIds: string[] = [];
  const createdProfileIds: string[] = [];
  const createdPostIds: string[] = [];
  const saved = { max: process.env.MAX_CONCURRENT_JOBS_PER_USER, queued: process.env.MAX_QUEUED_JOBS_PER_USER };

  const userId = await fx.makeUser('user');
  const otherUserId = await fx.makeUser('user');
  const moderatorId = await fx.makeUser('moderator');
  const user: Viewer = { userId, role: 'user' };
  const moderator: Viewer = { userId: moderatorId, role: 'moderator' };
  await db.update(users).set({ name: `Owner Name ${suffix}` }).where(eq(users.id, otherUserId));

  const accountType = fx.defineType();
  registerJobTypePresentation({ engineType: accountType, graphqlType: 'SUBSCRIBE', phases: ['lookup', 'classify', 'scrape'], subjectKind: 'ACCOUNT', outcomeKind: 'ACCOUNT' });
  const postsType = fx.defineType();
  registerJobTypePresentation({ engineType: postsType, graphqlType: 'EXTRACT_SELECTED_POSTS', phases: ['extract'], subjectKind: 'POSTS', outcomeKind: 'EVENTS' });
  const unregisteredType = fx.defineType(); // a definition with no presentation: reads as OTHER

  let counter = 0;
  async function makeJob(over: Partial<typeof jobs.$inferInsert> = {}): Promise<string> {
    const [row] = await db
      .insert(jobs)
      .values({
        type: accountType,
        ownerUserId: userId,
        trigger: 'USER',
        inputKey: `k-${suffix}-${counter++}`,
        status: 'SUCCEEDED',
        deadlineAt: new Date(Date.now() + 10 * MINUTE),
        admittedAt: new Date(Date.now() - 5 * MINUTE),
        finishedAt: new Date(),
        ...over,
      })
      .returning({ id: jobs.id });
    createdJobIds.push(row.id);
    return row.id;
  }

  t.after(async () => {
    process.env.MAX_CONCURRENT_JOBS_PER_USER = saved.max;
    process.env.MAX_QUEUED_JOBS_PER_USER = saved.queued;
    if (saved.max === undefined) delete process.env.MAX_CONCURRENT_JOBS_PER_USER;
    if (saved.queued === undefined) delete process.env.MAX_QUEUED_JOBS_PER_USER;
    // jobs first (attempts cascade), including the retries a test started and the SYSTEM rows; then posts, profiles, users
    await db.delete(jobs).where(or(inArray(jobs.ownerUserId, [userId, otherUserId, moderatorId]), inArray(jobs.id, createdJobIds)));
    if (createdPostIds.length) await db.delete(posts).where(inArray(posts.id, createdPostIds));
    if (createdProfileIds.length) await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, createdProfileIds));
    await fx.cleanup();
  });
  fx.stubInvoke();

  await t.test('an unauthenticated call is UNAUTHENTICATED on every new root field', async () => {
    const id = await makeJob();
    assert.equal(codeOf(await run(JOB_QUERY, { id }, null)), 'UNAUTHENTICATED');
    assert.equal(codeOf(await run(MY_JOBS_QUERY, {}, null)), 'UNAUTHENTICATED');
    assert.equal(codeOf(await run(ACTIVE_QUERY, {}, null)), 'UNAUTHENTICATED');
    assert.equal(codeOf(await run(RETRY_MUTATION, { id }, null)), 'UNAUTHENTICATED');
  });

  await t.test('scope: an ordinary user sees only their own USER jobs; others and system jobs read like a missing id', async () => {
    const mine = await makeJob();
    const theirs = await makeJob({ ownerUserId: otherUserId });
    const system = await makeJob({ ownerUserId: null, trigger: 'SYSTEM' });

    assert.equal((await run(JOB_QUERY, { id: mine }, user)).data?.job && ((await run(JOB_QUERY, { id: mine }, user)).data as any).job.id, mine);
    for (const id of [theirs, system, '00000000-0000-4000-8000-000000000000', 'not-a-uuid']) {
      const result = await run(JOB_QUERY, { id }, user);
      assert.equal(result.errors, undefined);
      assert.equal((result.data as any).job, null, `job(${id}) reads null`);
    }
    const listed = ((await run(MY_JOBS_QUERY, { first: 50 }, user)).data as any).myJobs.edges.map((e: any) => e.node.id);
    assert.ok(listed.includes(mine));
    assert.ok(!listed.includes(theirs) && !listed.includes(system));

    // a moderator sees any job by id, and widens the lists only with the moderator-only arguments
    for (const id of [mine, theirs, system]) {
      assert.equal(((await run(JOB_QUERY, { id }, moderator)).data as any).job.id, id);
    }
    const modMine = ((await run(MY_JOBS_QUERY, { first: 50 }, moderator)).data as any).myJobs.edges.map((e: any) => e.node.id);
    assert.ok(!modMine.includes(mine), 'MINE for a moderator is the moderator’s own jobs');
    const all = ((await run(MY_JOBS_QUERY, { first: 50, filter: { scope: 'ALL_USERS' } }, moderator)).data as any).myJobs.edges.map((e: any) => e.node.id);
    assert.ok(all.includes(mine) && all.includes(theirs) && !all.includes(system), 'ALL_USERS lists every user’s USER jobs, not system ones');
    const withSystem = ((await run(MY_JOBS_QUERY, { first: 50, filter: { scope: 'ALL_USERS', includeSystem: true } }, moderator)).data as any).myJobs.edges.map((e: any) => e.node.id);
    assert.ok(withSystem.includes(system));
  });

  await t.test('FORBIDDEN: ALL_USERS and includeSystem need a moderator (after requireAuth); defaults and false are fine', async () => {
    for (const filter of [{ scope: 'ALL_USERS' }, { includeSystem: true }]) {
      assert.equal(codeOf(await run(MY_JOBS_QUERY, { filter }, user)), 'FORBIDDEN');
      assert.equal(codeOf(await run(ACTIVE_QUERY, { filter }, user)), 'FORBIDDEN');
    }
    assert.equal((await run(MY_JOBS_QUERY, { filter: { scope: 'MINE', includeSystem: false } }, user)).errors, undefined);
  });

  await t.test('retention is hide-only: a finished job past the retention is hidden from all three reads, still in the table, an open one is not hidden', async () => {
    const old = await makeJob({ finishedAt: new Date(Date.now() - 31 * DAY), createdAt: new Date(Date.now() - 32 * DAY) });
    const recent = await makeJob({ finishedAt: new Date(Date.now() - 29 * DAY), createdAt: new Date(Date.now() - 30 * DAY) });
    const openOld = await makeJob({ status: 'RUNNING', finishedAt: null, createdAt: new Date(Date.now() - 40 * DAY) });

    assert.equal(((await run(JOB_QUERY, { id: old }, user)).data as any).job, null);
    assert.equal(((await run(JOB_QUERY, { id: old }, moderator)).data as any).job, null, 'a moderator by id too');
    assert.equal(((await run(JOB_QUERY, { id: recent }, user)).data as any).job.id, recent);
    const finished = ((await run(MY_JOBS_QUERY, { first: 50, onlyEnded: true }, user)).data as any).myJobs.edges.map((e: any) => e.node.id);
    assert.ok(!finished.includes(old) && finished.includes(recent));
    const active = ((await run(ACTIVE_QUERY, { ended: 60 }, user)).data as any).activeJobs.map((j: any) => j.id);
    assert.ok(active.includes(openOld));
    const [row] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, old));
    assert.ok(row, 'nothing was deleted: the row is still there');
  });

  await t.test('no leak: caption, preview, image URLs and vendor names never appear; owner and moderatorDetails are null for a user and no job_attempts query runs', async () => {
    const CAPTION = `SECRET-CAPTION-${suffix}`;
    const PREVIEW = `SECRET-PREVIEW-${suffix}`;
    const IMAGE = `https://cdn.example.test/signed-${suffix}.jpg?sig=SECRETSIG`;
    const [profile] = await db.insert(socialMediaAccountProfiles).values({ accountId: `acct-${suffix}-l`, platform: 'instagram', username: `leak_${suffix}`, displayName: 'Leak' }).returning({ id: socialMediaAccountProfiles.id });
    createdProfileIds.push(profile.id);
    const [post] = await db
      .insert(posts)
      .values({ accountId: profile.id, platform: 'instagram', postUrl: `https://www.instagram.com/p/Leak${suffix}/`, platformPostId: 'DcntzF0mB7z', publishedAt: new Date(), content: CAPTION, imageUrl: IMAGE })
      .returning({ id: posts.id });
    createdPostIds.push(post.id);

    const id = await makeJob({
      type: REEXTRACT_POST_JOB_TYPE,
      inputKey: post.id,
      status: 'SUCCEEDED_WITH_LIMITS',
      reasonCode: 'COOLDOWN',
      errorMessage: `engine plain words ${suffix}`,
      input: { postId: post.id, held: { content: CAPTION, imageUrl: IMAGE, postUrl: IMAGE, publishedAt: new Date().toISOString() } },
      resultData: { refresh: { outcome: 'COOLDOWN', retryAfter: new Date(Date.now() + 5 * MINUTE).toISOString() }, events: [{ title: PREVIEW }], extracted: { caption: CAPTION }, imageUrl: IMAGE },
    });
    await db.insert(jobAttempts).values({ jobId: id, provider: 'BRIGHTDATA', outcome: 'FAILED', budgetMs: 20000, elapsedMs: 19000, reasonCode: 'HANDLER_ERROR' });

    const tables: string[] = [];
    const originalSelect = db.select.bind(db);
    (db as any).select = (...args: any[]) => {
      const builder = (originalSelect as any)(...args);
      const from = builder.from.bind(builder);
      builder.from = (table: any) => {
        tables.push(getTableName(table));
        return from(table);
      };
      return builder;
    };
    let userResult;
    try {
      userResult = await run(JOB_QUERY, { id }, user);
    } finally {
      (db as any).select = originalSelect;
    }
    assert.equal(userResult.errors, undefined);
    assert.ok(!tables.includes('job_attempts'), 'no query reaches job_attempts for an ordinary user');
    const userText = JSON.stringify(userResult.data);
    for (const secret of [CAPTION, PREVIEW, IMAGE, 'SECRETSIG', 'BRIGHT', 'APIFY', `engine plain words`, 'HANDLER_ERROR', 'cdn.example.test']) {
      assert.ok(!userText.includes(secret), `user response must not contain ${secret}`);
    }
    const job = (userResult.data as any).job;
    assert.equal(job.owner, null);
    assert.equal(job.moderatorDetails, null);
    assert.equal(job.subject.postCode, 'DcntzF0mB7z', 'a post is identified by its public short code only');
    assert.equal(job.subject.postId, post.id);
    assert.equal(job.reasonCode, 'COOLDOWN');

    const modText = JSON.stringify((await run(JOB_QUERY, { id }, moderator)).data);
    for (const secret of [CAPTION, PREVIEW, IMAGE, 'SECRETSIG']) {
      assert.ok(!modText.includes(secret), `moderator response must not contain ${secret}`);
    }
    const modJob = JSON.parse(modText).job;
    assert.equal(modJob.moderatorDetails.engineMessage, `engine plain words ${suffix}`);
    assert.equal(modJob.moderatorDetails.engineReasonCode, 'COOLDOWN');
    assert.deepEqual(modJob.moderatorDetails.attempts, [{ provider: 'BRIGHT_DATA', outcome: 'FAILED', budgetMs: 20000, elapsedMs: 19000, reasonCode: 'GENERIC' }]);
  });

  await t.test('a post not in the database is named by the short code of its URL, never the URL', async () => {
    const id = await makeJob({ type: REEXTRACT_POST_JOB_TYPE, input: { url: `https://www.instagram.com/p/ABCdef123/?utm=${suffix}` }, inputKey: `url:instagram:ABCdef123-${suffix}` });
    const text = JSON.stringify((await run(JOB_QUERY, { id }, user)).data);
    assert.ok(text.includes('"postCode":"ABCdef123"'));
    assert.ok(!text.includes('instagram.com') && !text.includes('utm='));
  });

  await t.test('batched lookups: a page of jobs makes one query per lookup table, not one per row', async () => {
    const [profile] = await db.insert(socialMediaAccountProfiles).values({ accountId: `acct-${suffix}-b`, platform: 'instagram', username: `batch_${suffix}`, displayName: 'Batch', profileImageUrl: 'https://cdn.example.test/avatar.jpg' }).returning({ id: socialMediaAccountProfiles.id });
    createdProfileIds.push(profile.id);
    const ids = [];
    for (let i = 0; i < 3; i++) ids.push(await makeJob({ input: { accountId: profile.id }, createdAt: new Date(Date.now() + 1000 + i) }));
    const tables: string[] = [];
    const originalSelect = db.select.bind(db);
    (db as any).select = (...args: any[]) => {
      const builder = (originalSelect as any)(...args);
      const from = builder.from.bind(builder);
      builder.from = (table: any) => {
        tables.push(getTableName(table));
        return from(table);
      };
      return builder;
    };
    let result;
    try {
      result = await run(`query { myJobs(first: 3) { edges { node { id subject { kind username displayName platform } } } } }`, {}, user);
    } finally {
      (db as any).select = originalSelect;
    }
    assert.equal(result.errors, undefined);
    const nodes = (result.data as any).myJobs.edges.map((e: any) => e.node);
    assert.deepEqual(nodes.map((n: any) => n.id), ids.reverse());
    assert.equal(nodes[0].subject.username, `batch_${suffix}`);
    assert.equal(tables.filter((n) => n === 'social_media_account_profiles').length, 1);
    assert.equal(tables.filter((n) => n === 'jobs').length, 1);
    assert.ok(!tables.includes('users') && !tables.includes('job_attempts') && !tables.includes('posts'));
  });

  await t.test('queue: positions among the owner’s waiting jobs, oldest first, with maxConcurrent and expiresAt; an admitted QUEUED job reads RUNNING', async () => {
    const q = await fx.makeUser('user');
    const base = Date.now() - 20 * MINUTE;
    const first = await makeJob({ ownerUserId: q, status: 'QUEUED', admittedAt: null, finishedAt: null, queuedSince: new Date(base) });
    const second = await makeJob({ ownerUserId: q, status: 'QUEUED', admittedAt: null, finishedAt: null, queuedSince: new Date(base + MINUTE) });
    const admitted = await makeJob({ ownerUserId: q, status: 'QUEUED', admittedAt: new Date(), finishedAt: null });
    const viewer: Viewer = { userId: q, role: 'user' };
    const a = ((await run(JOB_QUERY, { id: first }, viewer)).data as any).job;
    const b = ((await run(JOB_QUERY, { id: second }, viewer)).data as any).job;
    assert.equal(a.status, 'QUEUED');
    assert.equal(a.queue.position, 1);
    assert.equal(b.queue.position, 2);
    assert.equal(a.queue.maxConcurrent, 3);
    assert.equal(new Date(a.queue.expiresAt).getTime(), base + 30 * MINUTE);
    assert.deepEqual(a.steps.map((s: any) => s.state), ['PENDING', 'PENDING', 'PENDING']);
    const adm = ((await run(JOB_QUERY, { id: admitted }, viewer)).data as any).job;
    assert.equal(adm.status, 'RUNNING');
    assert.equal(adm.queue, null);
    assert.deepEqual(adm.steps.map((s: any) => s.state), ['CURRENT', 'PENDING', 'PENDING']);
  });

  await t.test('waiting, steps, late result, cancel and the GENERIC mapping of an engine-internal reason', async () => {
    const resumeAt = new Date(Date.now() + 5 * MINUTE);
    const waiting = ((await run(JOB_QUERY, { id: await makeJob({ status: 'WAITING', phase: 'classify', finishedAt: null, resumeAt }) }, user)).data as any).job;
    assert.equal(waiting.waiting.waitingFor, 'RETRY_AT');
    assert.equal(new Date(waiting.waiting.resumeAt).getTime(), resumeAt.getTime());
    assert.deepEqual(waiting.steps.map((s: any) => `${s.key}:${s.state}`), ['lookup:DONE', 'classify:CURRENT', 'scrape:PENDING']);
    const forResult = ((await run(JOB_QUERY, { id: await makeJob({ status: 'WAITING', phase: 'scrape', finishedAt: null }) }, user)).data as any).job;
    assert.equal(forResult.waiting.waitingFor, 'RESULT_FROM_PROVIDER');

    const ok = ((await run(JOB_QUERY, { id: await makeJob({ status: 'SUCCEEDED', phase: 'scrape', completedAfterDeadline: true }) }, user)).data as any).job;
    assert.deepEqual(ok.steps.map((s: any) => s.state), ['DONE', 'DONE', 'DONE']);
    assert.equal(ok.completedAfterDeadline, true);
    assert.equal(ok.outcome.kind, 'ACCOUNT');
    assert.equal(ok.canRetry, false, 'a type with no retry starter is never retryable');

    const failed = ((await run(JOB_QUERY, { id: await makeJob({ status: 'FAILED', phase: 'classify', reasonCode: 'HANDLER_ERROR' }) }, user)).data as any).job;
    assert.equal(failed.reasonCode, 'GENERIC');
    assert.deepEqual(failed.steps.map((s: any) => `${s.key}:${s.state}`), ['lookup:DONE', 'classify:CURRENT', 'scrape:PENDING']);

    const cancelled = ((await run(JOB_QUERY, { id: await makeJob({ status: 'FAILED', reasonCode: 'CANCELLED' }) }, user)).data as any).job;
    assert.equal(cancelled.isCancelled, true);
    const expired = ((await run(JOB_QUERY, { id: await makeJob({ status: 'EXPIRED', reasonCode: 'WAITED_TOO_LONG', admittedAt: null }) }, user)).data as any).job;
    assert.equal(expired.reasonQueueMaxWaitMinutes, 30);
    assert.deepEqual(expired.steps.map((s: any) => s.state), ['PENDING', 'PENDING', 'PENDING'], 'dropped from the queue before it started');
  });

  await t.test('unknown job type: OTHER with no steps and no subject; POSTS subject counts only', async () => {
    const other = ((await run(JOB_QUERY, { id: await makeJob({ type: unregisteredType, input: { accountId: 'x' } }) }, user)).data as any).job;
    assert.equal(other.type, 'OTHER');
    assert.deepEqual(other.steps, []);
    assert.equal(other.subject.kind, 'NONE');
    const posts3 = ((await run(JOB_QUERY, { id: await makeJob({ type: postsType, input: { postIds: ['a', 'b', 'c'] } }) }, user)).data as any).job;
    assert.equal(posts3.type, 'EXTRACT_SELECTED_POSTS');
    assert.deepEqual(JSON.parse(JSON.stringify(posts3.subject)), { kind: 'POSTS', accountId: null, platform: null, username: null, displayName: null, profileImageUrl: null, postCount: 3, postCode: null, postId: null });
  });

  await t.test('owner label for a moderator is the user name only; a SYSTEM job has none', async () => {
    const id = await makeJob({ ownerUserId: otherUserId });
    const job = ((await run(JOB_QUERY, { id }, moderator)).data as any).job;
    assert.deepEqual(JSON.parse(JSON.stringify(job.owner)), { displayName: `Owner Name ${suffix}` });
    const system = ((await run(JOB_QUERY, { id: await makeJob({ ownerUserId: null, trigger: 'SYSTEM' }) }, moderator)).data as any).job;
    assert.equal(system.owner, null);
    assert.equal(system.trigger, 'SYSTEM');
  });

  await t.test('activeJobs: open jobs only, newest first, endedWithinMinutes adds recently ended ones, subject narrows', async () => {
    const aId = fx.defineType();
    registerJobTypePresentation({ engineType: aId, graphqlType: 'ACCOUNT_REFRESH', phases: ['go'], subjectKind: 'ACCOUNT', outcomeKind: 'ACCOUNT' });
    const acct = '11111111-1111-4111-8111-111111111111';
    const open = await makeJob({ type: aId, status: 'RUNNING', finishedAt: null, input: { accountId: acct } });
    const other = await makeJob({ type: aId, status: 'QUEUED', admittedAt: null, finishedAt: null, queuedSince: new Date(), input: { accountId: '22222222-2222-4222-8222-222222222222' } });
    const justEnded = await makeJob({ type: aId, status: 'SUCCEEDED', finishedAt: new Date(Date.now() - 5 * MINUTE), input: { accountId: acct } });
    const longAgo = await makeJob({ type: aId, status: 'SUCCEEDED', finishedAt: new Date(Date.now() - 90 * MINUTE), input: { accountId: acct } });

    const ids = async (vars: Record<string, unknown>) => ((await run(ACTIVE_QUERY, vars, user)).data as any).activeJobs.map((j: any) => j.id) as string[];
    const subject = { type: 'ACCOUNT_REFRESH', accountId: acct };
    assert.deepEqual(await ids({ subject }), [open]);
    assert.deepEqual((await ids({ subject, ended: 30 })).sort(), [open, justEnded].sort());
    assert.ok(!(await ids({ subject, ended: 5000 })).includes(longAgo), 'endedWithinMinutes is clamped to 60');
    const typed = await ids({ subject: { type: 'ACCOUNT_REFRESH' } });
    assert.ok(typed.includes(open) && typed.includes(other) && !typed.includes(justEnded));
    assert.deepEqual(await ids({ subject: { type: 'ADMIN_OPERATION' } }), []);
    assert.deepEqual(await ids({ subject: { type: 'REEXTRACT_REFRESH', postUrlKey: 'url:instagram:none' } }), []);
  });

  await t.test('myJobs: onlyEnded, totalCount only when selected, page size clamped to 50, a bad cursor is BAD_REQUEST', async () => {
    const u = await fx.makeUser('user');
    const viewer: Viewer = { userId: u, role: 'user' };
    const ended = [];
    for (let i = 0; i < 3; i++) ended.push(await makeJob({ ownerUserId: u, createdAt: new Date(Date.now() - (10 + i) * MINUTE) }));
    await makeJob({ ownerUserId: u, status: 'RUNNING', finishedAt: null });
    const onlyEnded = (await run(MY_JOBS_QUERY, { onlyEnded: true }, viewer)).data as any;
    assert.deepEqual(onlyEnded.myJobs.edges.map((e: any) => e.node.id), ended);
    assert.equal(onlyEnded.myJobs.totalCount, 3);
    const noTotal = await run(`query { myJobs(first: 1000) { edges { node { id } } } }`, {}, viewer);
    assert.equal(noTotal.errors, undefined);
    assert.equal(codeOf(await run(MY_JOBS_QUERY, { after: 'not-a-cursor' }, viewer)), 'BAD_REQUEST');
    assert.equal(codeOf(await run(MY_JOBS_QUERY, { after: Buffer.from('-4').toString('base64') }, viewer)), 'BAD_REQUEST');
  });

  await t.test('canRetry: owner only, ended jobs only, retryable reasons, a registered starter; COOLDOWN carries retryNotBefore', async () => {
    const m = await fx.makeUser('moderator');
    const mod: Viewer = { userId: m, role: 'moderator' };
    const retryAfter = new Date(Date.now() + 5 * MINUTE);
    const canRetry = async (over: Partial<typeof jobs.$inferInsert>, viewer: Viewer = mod) =>
      ((await run(JOB_QUERY, { id: await makeJob({ ownerUserId: m, type: REEXTRACT_POST_JOB_TYPE, input: { postId: '33333333-3333-4333-8333-333333333333' }, ...over }) }, viewer)).data as any).job;
    assert.equal((await canRetry({ status: 'FAILED', reasonCode: 'TIMED_OUT' })).canRetry, true);
    assert.equal((await canRetry({ status: 'FAILED', reasonCode: 'HANDLER_ERROR' })).canRetry, true);
    assert.equal((await canRetry({ status: 'FAILED', reasonCode: 'POST_UNAVAILABLE' })).canRetry, false);
    assert.equal((await canRetry({ status: 'RUNNING', finishedAt: null })).canRetry, false);
    assert.equal((await canRetry({ status: 'SUCCEEDED' })).canRetry, false);
    const cooldown = await canRetry({ status: 'SUCCEEDED_WITH_LIMITS', reasonCode: 'COOLDOWN', resultData: { refresh: { outcome: 'COOLDOWN', retryAfter: retryAfter.toISOString() } } });
    assert.equal(cooldown.canRetry, true);
    assert.equal(new Date(cooldown.retryNotBefore).getTime(), retryAfter.getTime());
    assert.equal(new Date(cooldown.reasonRetryAfter).getTime(), retryAfter.getTime());
    // not the owner: a different moderator viewing it gets no Retry
    const jobId = await makeJob({ ownerUserId: m, type: REEXTRACT_POST_JOB_TYPE, status: 'FAILED', reasonCode: 'TIMED_OUT' });
    assert.equal(((await run(JOB_QUERY, { id: jobId }, moderator)).data as any).job.canRetry, false);
  });

  await t.test('retryJob: STARTED, then REUSED while the new job is open; the held caption is never copied; other failures', async () => {
    const m = await fx.makeUser('moderator');
    const mod: Viewer = { userId: m, role: 'moderator' };
    const CAPTION = `HELD-CAPTION-${suffix}`;
    const postId = '44444444-4444-4444-8444-444444444444';
    const old = await makeJob({
      ownerUserId: m, type: REEXTRACT_POST_JOB_TYPE, status: 'FAILED', reasonCode: 'TIMED_OUT', inputKey: postId,
      input: { postId, held: { content: CAPTION, postUrl: 'https://www.instagram.com/p/x/', publishedAt: new Date().toISOString() } },
    });
    const started = (await run(RETRY_MUTATION, { id: old }, mod)).data as any;
    assert.equal(started.retryJob.outcome, 'STARTED');
    assert.notEqual(started.retryJob.job.id, old);
    assert.equal(started.retryJob.job.type, 'REEXTRACT_REFRESH');
    createdJobIds.push(started.retryJob.job.id);
    const [fresh] = await db.select({ input: jobs.input, inputKey: jobs.inputKey }).from(jobs).where(eq(jobs.id, started.retryJob.job.id));
    assert.equal(fresh.inputKey, postId);
    assert.ok(!JSON.stringify(fresh.input).includes(CAPTION) && !('held' in (fresh.input as object)), 'the held caption is never copied');
    assert.deepEqual(fx.invoked, [started.retryJob.job.id], 'the new job was handed to its host through the invoke seam');

    const again = (await run(RETRY_MUTATION, { id: old }, mod)).data as any;
    assert.equal(again.retryJob.outcome, 'REUSED');
    assert.equal(again.retryJob.job.id, started.retryJob.job.id);

    // unhappy paths
    assert.equal(codeOf(await run(RETRY_MUTATION, { id: started.retryJob.job.id }, mod)), 'BAD_REQUEST', 'a job still open cannot be retried');
    assert.equal(codeOf(await run(RETRY_MUTATION, { id: old }, moderator)), 'NOT_FOUND', 'another user’s job');
    assert.equal(codeOf(await run(RETRY_MUTATION, { id: '55555555-5555-4555-8555-555555555555' }, mod)), 'NOT_FOUND');
    assert.equal(codeOf(await run(RETRY_MUTATION, { id: 'nope' }, mod)), 'NOT_FOUND');
    const noStarter = await makeJob({ ownerUserId: m, type: accountType, status: 'FAILED', reasonCode: 'TIMED_OUT' });
    assert.equal(codeOf(await run(RETRY_MUTATION, { id: noStarter }, mod)), 'BAD_REQUEST', 'a type with no retry starter');
    const demoted = await makeJob({ ownerUserId: m, type: REEXTRACT_POST_JOB_TYPE, status: 'FAILED', reasonCode: 'TIMED_OUT' });
    assert.equal(codeOf(await run(RETRY_MUTATION, { id: demoted }, { userId: m, role: 'user' })), 'BAD_REQUEST', 'the re-extract start path stays moderator-only');
  });

  await t.test('retryJob: a COOLDOWN ending is REFUSED with its time; a full queue is REFUSED / JOB_QUEUE_FULL with maxQueued', async () => {
    const m = await fx.makeUser('moderator');
    const mod: Viewer = { userId: m, role: 'moderator' };
    const retryAfter = new Date(Date.now() + 5 * MINUTE);
    const cooling = await makeJob({ ownerUserId: m, type: REEXTRACT_POST_JOB_TYPE, status: 'SUCCEEDED_WITH_LIMITS', reasonCode: 'COOLDOWN', input: { postId: '66666666-6666-4666-8666-666666666666' }, resultData: { refresh: { outcome: 'COOLDOWN', retryAfter: retryAfter.toISOString() } } });
    const cool = (await run(RETRY_MUTATION, { id: cooling }, mod)).data as any;
    assert.equal(cool.retryJob.outcome, 'REFUSED');
    assert.equal(cool.retryJob.errorCode, 'COOLDOWN');
    assert.equal(new Date(cool.retryJob.retryNotBefore).getTime(), retryAfter.getTime());
    assert.equal(cool.retryJob.job, null);

    process.env.MAX_CONCURRENT_JOBS_PER_USER = '1';
    process.env.MAX_QUEUED_JOBS_PER_USER = '1';
    await makeJob({ ownerUserId: m, status: 'RUNNING', finishedAt: null });
    await makeJob({ ownerUserId: m, status: 'QUEUED', admittedAt: null, finishedAt: null, queuedSince: new Date() });
    const failedOld = await makeJob({ ownerUserId: m, type: REEXTRACT_POST_JOB_TYPE, status: 'FAILED', reasonCode: 'TIMED_OUT', input: { postId: '77777777-7777-4777-8777-777777777777' }, inputKey: '77777777-7777-4777-8777-777777777777' });
    const full = (await run(RETRY_MUTATION, { id: failedOld }, mod)).data as any;
    assert.equal(full.retryJob.outcome, 'REFUSED');
    assert.equal(full.retryJob.errorCode, 'JOB_QUEUE_FULL');
    assert.equal(full.retryJob.maxQueued, 1);
  });
  await t.test('aliased fields never pull a whole column into the select (input: id, errorMessage: id), and nothing leaks', async () => {
    const CAPTION = `ALIAS-CAPTION-${suffix}`;
    const id = await makeJob({ errorMessage: `alias engine words ${suffix}`, input: { accountId: 'x', held: { content: CAPTION } }, resultData: { events: [{ title: CAPTION }] } });
    const selected: string[][] = [];
    const originalSelect = db.select.bind(db);
    (db as any).select = (...args: any[]) => {
      if (args[0] && typeof args[0] === 'object') selected.push(Object.keys(args[0]));
      return (originalSelect as any)(...args);
    };
    let result;
    try {
      result = await run(`query($id: ID!) { job(id: $id) { input: id errorMessage: id resultData: id workerClaimedAt: id inputKey: id realId: id } }`, { id }, user);
    } finally {
      (db as any).select = originalSelect;
    }
    const keys = selected.flat();
    for (const banned of ['input', 'resultData', 'errorMessage', 'workerClaimedAt', 'inputKey']) {
      assert.ok(!keys.includes(banned), `the select must not carry ${banned}`);
    }
    const text = JSON.stringify(result.data ?? {});
    assert.ok(!text.includes(CAPTION) && !text.includes('alias engine words'));
  });

  await t.test('retention also covers a terminal job with no finished_at (measured from created_at) and retryJob', async () => {
    const m = await fx.makeUser('moderator');
    const mod: Viewer = { userId: m, role: 'moderator' };
    const oldNoEnd = await makeJob({ finishedAt: null, createdAt: new Date(Date.now() - 40 * DAY) });
    const freshNoEnd = await makeJob({ finishedAt: null, createdAt: new Date(Date.now() - 1 * DAY) });
    assert.equal(((await run(JOB_QUERY, { id: oldNoEnd }, user)).data as any).job, null);
    assert.equal(((await run(JOB_QUERY, { id: freshNoEnd }, user)).data as any).job.id, freshNoEnd);
    const listed = ((await run(MY_JOBS_QUERY, { first: 50, onlyEnded: true }, user)).data as any).myJobs.edges.map((e: any) => e.node.id);
    assert.ok(!listed.includes(oldNoEnd) && listed.includes(freshNoEnd));

    const oldFailed = await makeJob({ ownerUserId: m, type: REEXTRACT_POST_JOB_TYPE, status: 'FAILED', reasonCode: 'TIMED_OUT', input: { postId: '88888888-8888-4888-8888-888888888888' }, finishedAt: new Date(Date.now() - 31 * DAY), createdAt: new Date(Date.now() - 32 * DAY) });
    assert.equal(codeOf(await run(RETRY_MUTATION, { id: oldFailed }, mod)), 'NOT_FOUND', 'retry of a job past retention reads like a missing job');
  });
});
