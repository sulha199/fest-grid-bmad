import test from 'node:test';
import assert from 'node:assert/strict';
import { graphql } from 'graphql';
import { createSchema } from 'graphql-yoga';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { inArray, or } from 'drizzle-orm';
import { jobs } from '@festgrid/database';
import { REEXTRACT_POST_JOB_TYPE } from '@festgrid/domain/jobs';
import { db } from '../db/client.js';
import { resolvers } from './resolvers.js';
import { createFixtures } from '../lib/job-engine/job-engine-test-support.js';

// Story 10.6a (Part A, AC1 and AC2) -- `Job.refresh`, the moderator-only refresh report of a Re-extract job, against a real Postgres.
// Canaries (a caption-like string, an image-link-like string, a vendor name) are planted in `result_data`, including inside a malformed
// `images` entry, and must never reach the response. No vendor call, no Lambda invoke. Every row it creates is deleted.

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

const REFRESH_FIELDS = `refresh { outcome saved lateResultPending retryAfter expiredLinks images { position role state } imagesAvailable imagesRead previewImageCap }`;
const JOB_QUERY = `query($id: ID!) { job(id: $id) { id ${REFRESH_FIELDS} } }`;
const JOB_WITHOUT_REFRESH = `query($id: ID!) { job(id: $id) { id status steps { key state } } }`;
const MY_JOBS_QUERY = `query($filter: JobsFilter) { myJobs(filter: $filter, first: 50) { edges { node { id ${REFRESH_FIELDS} } } } }`;
const ACTIVE_QUERY = `query($subject: JobSubjectInput) { activeJobs(subject: $subject, endedWithinMinutes: 30) { id ${REFRESH_FIELDS} } }`;

const MINUTE = 60_000;
/** graphql-js builds null-prototype objects; compare plain data. */
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

test('Job.refresh (Story 10.6a Part A, real Postgres)', async (t) => {
  const fx = createFixtures('job-refresh');
  const suffix = fx.suffix;
  const createdJobIds: string[] = [];
  const moderatorId = await fx.makeUser('moderator');
  const userId = await fx.makeUser('user');
  const moderator: Viewer = { userId: moderatorId, role: 'moderator' };
  const user: Viewer = { userId, role: 'user' };

  const CAPTION = `CANARY-CAPTION-${suffix}`;
  const IMAGE_LINK = `https://cdn.example.test/canary-${suffix}.jpg?sig=CANARYSIG`;
  const VENDOR = `CANARY-VENDOR-${suffix}`;

  let counter = 0;
  async function makeJob(over: Partial<typeof jobs.$inferInsert> = {}): Promise<string> {
    const [row] = await db
      .insert(jobs)
      .values({
        type: REEXTRACT_POST_JOB_TYPE,
        ownerUserId: moderatorId,
        trigger: 'USER',
        inputKey: `refresh-${suffix}-${counter++}`,
        input: { postId: '11111111-1111-4111-8111-111111111111' },
        status: 'SUCCEEDED_WITH_LIMITS',
        reasonCode: 'NO_PROVIDER_REACHABLE',
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
    await db.delete(jobs).where(or(inArray(jobs.ownerUserId, [moderatorId, userId]), inArray(jobs.id, createdJobIds)));
    await fx.cleanup();
  });
  fx.stubInvoke();

  const result = (over: Record<string, unknown> = {}) => ({
    refresh: { outcome: 'NO_PROVIDER_REACHABLE', reasons: ['COVER_EXPIRED'], saved: false, lateResultPending: false, retryAfter: null, expiredLinks: 3 },
    imagesAvailable: 5,
    imagesSent: 2,
    imageCap: 10,
    images: [
      { position: 0, role: 'COVER', state: 'NOT_READ_EXPIRED' },
      { position: 1, role: 'SLIDE', state: 'READ' },
      { position: 2, role: 'SLIDE', state: 'READ' },
      { position: 3, role: 'SLIDE', state: 'NOT_READ_EXPIRED' },
      { position: 4, role: 'SLIDE', state: 'NOT_SENT_OVER_CAP' },
    ],
    events: [{ eventName: CAPTION }],
    ...over,
  });

  await t.test('a moderator reads the report with its images, by job, myJobs and activeJobs', async () => {
    const id = await makeJob({ resultData: result() });
    const expected = {
      outcome: 'NO_PROVIDER_REACHABLE',
      saved: false,
      lateResultPending: false,
      retryAfter: null,
      expiredLinks: 3,
      images: [
        { position: 0, role: 'COVER', state: 'NOT_READ_EXPIRED' },
        { position: 1, role: 'SLIDE', state: 'READ' },
        { position: 2, role: 'SLIDE', state: 'READ' },
        { position: 3, role: 'SLIDE', state: 'NOT_READ_EXPIRED' },
        { position: 4, role: 'SLIDE', state: 'NOT_SENT_OVER_CAP' },
      ],
      imagesAvailable: 5,
      imagesRead: 2,
      previewImageCap: 10,
    };
    const byId = await run(JOB_QUERY, { id }, moderator);
    assert.equal(byId.errors, undefined);
    assert.deepEqual(plain((byId.data as any).job.refresh), expected);

    const listed = await run(MY_JOBS_QUERY, {}, moderator);
    assert.equal(listed.errors, undefined);
    assert.deepEqual(plain((listed.data as any).myJobs.edges.find((e: any) => e.node.id === id).node.refresh), expected);

    const active = await run(ACTIVE_QUERY, { subject: { type: 'REEXTRACT_REFRESH', postId: '11111111-1111-4111-8111-111111111111' } }, moderator);
    assert.equal(active.errors, undefined);
    assert.deepEqual(plain((active.data as any).activeJobs.find((j: any) => j.id === id).refresh), expected);
  });

  await t.test('the saved and late-result flags and the cooldown time come from their paths', async () => {
    const retryAfter = new Date(Date.now() + 8 * MINUTE);
    const id = await makeJob({
      resultData: result({ refresh: { outcome: 'COOLDOWN', reasons: [], saved: true, lateResultPending: true, retryAfter: retryAfter.toISOString(), expiredLinks: 0 } }),
    });
    const refresh = ((await run(JOB_QUERY, { id }, moderator)).data as any).job.refresh;
    assert.equal(refresh.saved, true);
    assert.equal(refresh.lateResultPending, true);
    assert.equal(new Date(refresh.retryAfter).getTime(), retryAfter.getTime());
    // retryAfter is a COOLDOWN-only value: another outcome never reports one
    const other = await makeJob({ resultData: result({ refresh: { outcome: 'TIMED_OUT', saved: false, lateResultPending: false, retryAfter: retryAfter.toISOString(), expiredLinks: 1 } }) });
    assert.equal(((await run(JOB_QUERY, { id: other }, moderator)).data as any).job.refresh.retryAfter, null);
  });

  await t.test('an ordinary user reads null, even for their own job, and the result paths are never selected for them', async () => {
    const id = await makeJob({ ownerUserId: userId, resultData: result() });
    const selected: string[][] = [];
    const originalSelect = db.select.bind(db);
    (db as any).select = (...args: any[]) => {
      if (args[0] && typeof args[0] === 'object') selected.push(Object.keys(args[0]));
      return (originalSelect as any)(...args);
    };
    let response;
    try {
      response = await run(JOB_QUERY, { id }, user);
    } finally {
      (db as any).select = originalSelect;
    }
    assert.equal(response.errors, undefined);
    assert.equal((response.data as any).job.refresh, null);
    const keys = selected.flat();
    for (const key of ['refreshSaved', 'refreshLateResultPending', 'refreshExpiredLinks', 'resultImagesAvailable', 'resultImagesSent', 'resultImageCap', 'resultImages']) {
      assert.ok(!keys.includes(key), `no ${key} path for an ordinary user`);
    }
  });

  await t.test('the paths are selected only when the client selects refresh', async () => {
    const id = await makeJob({ resultData: result() });
    const selected: string[][] = [];
    const originalSelect = db.select.bind(db);
    (db as any).select = (...args: any[]) => {
      if (args[0] && typeof args[0] === 'object') selected.push(Object.keys(args[0]));
      return (originalSelect as any)(...args);
    };
    try {
      assert.equal((await run(JOB_WITHOUT_REFRESH, { id }, moderator)).errors, undefined);
      assert.ok(!selected.flat().includes('resultImages') && !selected.flat().includes('refreshSaved'));
      assert.equal((await run(JOB_QUERY, { id }, moderator)).errors, undefined);
      assert.ok(selected.flat().includes('resultImages') && selected.flat().includes('refreshSaved'));
    } finally {
      (db as any).select = originalSelect;
    }
  });

  await t.test('every other job type reads null, and so does a job that has not run its refresh phase', async () => {
    const otherType = fx.defineType();
    const other = await makeJob({ type: otherType, resultData: result() });
    assert.equal(((await run(JOB_QUERY, { id: other }, moderator)).data as any).job.refresh, null);
    const noRefreshYet = await makeJob({ status: 'RUNNING', finishedAt: null, resultData: null });
    assert.equal(((await run(JOB_QUERY, { id: noRefreshYet }, moderator)).data as any).job.refresh, null);
    const noReport = await makeJob({ resultData: { events: [] } });
    assert.equal(((await run(JOB_QUERY, { id: noReport }, moderator)).data as any).job.refresh, null);
  });

  await t.test('an unknown outcome reads as no report', async () => {
    const id = await makeJob({ resultData: result({ refresh: { outcome: `VENDOR_${VENDOR}`, saved: true } }) });
    const response = await run(JOB_QUERY, { id }, moderator);
    assert.equal(response.errors, undefined);
    assert.equal((response.data as any).job.refresh, null);
  });

  await t.test('a job finished before the image list existed reads an empty list, counts from the preview and the default cap', async () => {
    const id = await makeJob({ resultData: { refresh: { outcome: 'NO_PROVIDER_REACHABLE', saved: false, lateResultPending: false, retryAfter: null, expiredLinks: 2 }, imagesAvailable: 4, imagesSent: 1, events: [] } });
    const refresh = ((await run(JOB_QUERY, { id }, moderator)).data as any).job.refresh;
    assert.deepEqual(refresh.images, []);
    assert.equal(refresh.imagesAvailable, 4);
    assert.equal(refresh.imagesRead, 1);
    assert.equal(refresh.previewImageCap, 10, 'the default of MAX_REEXTRACT_CAROUSEL_IMAGES');
  });

  await t.test('a failed phase 2 (no preview) still reads the phase-1 report with an empty list and zero counts', async () => {
    const id = await makeJob({
      status: 'FAILED',
      reasonCode: 'EXTRACTION_FAILED',
      resultData: { refresh: { outcome: 'REFRESHED', reasons: ['COVER_EXPIRED'], saved: true, lateResultPending: false, retryAfter: null, expiredLinks: 0 } },
    });
    const refresh = ((await run(JOB_QUERY, { id }, moderator)).data as any).job.refresh;
    assert.deepEqual([refresh.outcome, refresh.saved, refresh.images, refresh.imagesAvailable, refresh.imagesRead], ['REFRESHED', true, [], 0, 0]);
  });

  await t.test('leak canaries: a caption, an image link and a vendor name planted anywhere in result_data never reach the response', async () => {
    const id = await makeJob({
      input: { postId: '11111111-1111-4111-8111-111111111111', held: { content: CAPTION, imageUrl: IMAGE_LINK } },
      errorMessage: `engine words ${VENDOR}`,
      resultData: result({
        refresh: { outcome: 'REFRESHED', reasons: [], saved: true, lateResultPending: false, retryAfter: null, expiredLinks: 0, provider: VENDOR, imageUrl: IMAGE_LINK, caption: CAPTION },
        imageUrl: IMAGE_LINK,
        extracted: { caption: CAPTION },
        images: [
          { position: 0, role: 'COVER', state: 'READ', url: IMAGE_LINK, caption: CAPTION, vendor: VENDOR },
          { position: 1, role: 'SLIDE', state: `NOT_READ_${IMAGE_LINK}` },
          { position: 2, role: 'SLIDE', state: 'READ', extra: { url: IMAGE_LINK } },
          { position: -1, role: 'SLIDE', state: 'READ' },
          { position: 3, role: VENDOR, state: 'READ' },
          { position: '4', role: 'SLIDE', state: 'READ' },
          IMAGE_LINK,
          null,
        ],
      }),
    });
    const response = await run(JOB_QUERY, { id }, moderator);
    assert.equal(response.errors, undefined);
    const text = JSON.stringify(response.data);
    for (const canary of [CAPTION, IMAGE_LINK, VENDOR, 'CANARYSIG', 'canary-']) assert.ok(!text.includes(canary), `the response must not carry ${canary}`);
    // only the two well-formed entries survive, field by field
    assert.deepEqual(plain((response.data as any).job.refresh.images), [
      { position: 0, role: 'COVER', state: 'READ' },
      { position: 2, role: 'SLIDE', state: 'READ' },
    ]);
  });

  await t.test('a stored images value that is not an array reads as an empty list, and the list is bounded', async () => {
    const notArray = await makeJob({ resultData: result({ images: { position: 0, role: 'COVER', state: 'READ' } }) });
    assert.deepEqual(((await run(JOB_QUERY, { id: notArray }, moderator)).data as any).job.refresh.images, []);
    const huge = Array.from({ length: 500 }, (_, i) => ({ position: i, role: 'SLIDE', state: 'READ' }));
    const bounded = await makeJob({ resultData: result({ images: huge }) });
    assert.equal(((await run(JOB_QUERY, { id: bounded }, moderator)).data as any).job.refresh.images.length, 100);
  });

  await t.test('an unauthenticated call is still UNAUTHENTICATED', async () => {
    const id = await makeJob({ resultData: result() });
    assert.equal((await run(JOB_QUERY, { id }, null)).errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');
  });

  // Story 10.6a review fix: a FAILED phase 2 now keeps `{ refresh: report }` as its result (it used to be null). Two things read that report for a
  // FAILED job: the step list (a refresh that was not needed is shown as skipped) and the retry rule (a cooldown keeps its `retryAfter`).
  await t.test('a FAILED job that keeps its report: a refresh that was not needed reads as a skipped step, and the report stays readable', async () => {
    const id = await makeJob({
      status: 'FAILED',
      reasonCode: 'EXTRACTION_FAILED',
      phase: 'preview',
      resultData: { refresh: { outcome: 'NOT_NEEDED', reasons: [], saved: false, lateResultPending: false, retryAfter: null, expiredLinks: 0 } },
    });
    const res = await run(`query($id: ID!) { job(id: $id) { steps { key state } ${REFRESH_FIELDS} } }`, { id }, moderator);
    assert.equal(res.errors, undefined);
    const job = plain((res.data as any).job);
    assert.deepEqual(job.steps.map((step: { key: string; state: string }) => [step.key, step.state]), [['refresh', 'SKIPPED'], ['preview', 'CURRENT']]);
    assert.equal(job.refresh.outcome, 'NOT_NEEDED');
    assert.deepEqual(job.refresh.images, []);
  });

  await t.test('a FAILED cooldown job keeps refresh.retryAfter, and the retry rule reads it (Retry at that time)', async () => {
    const retryAfter = new Date(Date.now() + 8 * MINUTE);
    const id = await makeJob({
      status: 'FAILED',
      reasonCode: 'COOLDOWN',
      phase: 'refresh',
      resultData: { refresh: { outcome: 'COOLDOWN', reasons: [], saved: false, lateResultPending: false, retryAfter: retryAfter.toISOString(), expiredLinks: 0 } },
    });
    const res = await run(`query($id: ID!) { job(id: $id) { canRetry retryNotBefore ${REFRESH_FIELDS} } }`, { id }, moderator);
    assert.equal(res.errors, undefined);
    const job = plain((res.data as any).job);
    assert.equal(new Date(job.refresh.retryAfter).getTime(), retryAfter.getTime());
    assert.equal(job.canRetry, true);
    assert.equal(new Date(job.retryNotBefore).getTime(), retryAfter.getTime());
  });
});
