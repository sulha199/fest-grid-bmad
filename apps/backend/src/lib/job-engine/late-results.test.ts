import test from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { jobVendorSnapshots, jobs } from '@festgrid/database';
import type { LateResultOutcome } from '@festgrid/domain/jobs';
import { db } from '../../db/client.js';
import {
  getBrightDataProgress,
  getBrightDataSnapshot,
  setGetBrightDataProgress,
  setGetBrightDataSnapshot,
  type BrightDataProgressResponse,
} from '../scraper/brightdata-client.js';
import { createFixtures } from './job-engine-test-support.js';
import { registerLateResultHandler } from './job-registry.js';
import { collectLateVendorResults, settleJobFromLateResult } from './late-results.js';

// Story 10.5 (AC2 to AC6) -- collecting a vendor result that arrives after its job's run ended. Bright Data is replaced by its
// existing seams; the late-result handler is a fixture. No vendor call.

const fx = createFixtures('late');
const originalProgress = getBrightDataProgress;
const originalSnapshot = getBrightDataSnapshot;
let progressFor: (snapshotId: string) => BrightDataProgressResponse | Error = () => ({ status: 'running' });
let records: unknown[] = [{ url: 'https://www.instagram.com/p/AAA/' }];
const downloads: string[] = [];

test.beforeEach(() => {
  fx.stubInvoke();
  downloads.length = 0;
  progressFor = () => ({ status: 'running' });
  records = [{ url: 'https://www.instagram.com/p/AAA/' }];
  setGetBrightDataProgress(async (id) => {
    const answer = progressFor(id);
    if (answer instanceof Error) throw answer;
    return answer;
  });
  setGetBrightDataSnapshot(async (id) => {
    downloads.push(id);
    return records;
  });
});
test.after(async () => {
  setGetBrightDataProgress(originalProgress);
  setGetBrightDataSnapshot(originalSnapshot);
  await fx.cleanup();
});

const read = async (id: string) => (await db.select().from(jobs).where(eq(jobs.id, id)))[0];
const readLink = async (snapshotId: string) => (await db.select().from(jobVendorSnapshots).where(eq(jobVendorSnapshots.snapshotId, snapshotId)))[0];

let counter = 0;
async function setup(opts: {
  jobStatus: 'WAITING' | 'RUNNING' | 'EXPIRED' | 'FAILED' | 'SUCCEEDED';
  reasonCode?: string;
  deadlineMsAgo?: number;
  handler?: (input: { jobId: string; input: unknown; records: unknown[] }) => Promise<LateResultOutcome>;
  linkAgeMs?: number;
  waitMinutes?: number;
}) {
  const type = fx.defineType();
  const handlerCalls: Array<{ jobId: string; records: unknown[] }> = [];
  if (opts.handler !== null) {
    registerLateResultHandler(type, async (input) => {
      handlerCalls.push({ jobId: input.jobId, records: input.records });
      return (opts.handler ?? (async () => ({ outcome: 'SUCCEEDED', resultData: { refreshed: true } })))(input);
    });
  }
  const owner = await fx.makeUser();
  const now = Date.now();
  const [job] = await db
    .insert(jobs)
    .values({
      type,
      ownerUserId: owner,
      trigger: 'USER',
      inputKey: `late-${fx.suffix}-${counter++}`,
      input: { postId: 'p1' },
      status: opts.jobStatus,
      reasonCode: opts.reasonCode ?? null,
      admittedAt: new Date(now - 3_600_000),
      deadlineAt: new Date(now - (opts.deadlineMsAgo ?? 60_000)),
      ...(opts.jobStatus === 'EXPIRED' || opts.jobStatus === 'FAILED' || opts.jobStatus === 'SUCCEEDED' ? { finishedAt: new Date(now - 30_000) } : {}),
    })
    .returning();
  const snapshotId = `s_late_${fx.suffix}_${counter}`;
  const created = new Date(now - (opts.linkAgeMs ?? 600_000));
  await db.insert(jobVendorSnapshots).values({
    jobId: job.id,
    provider: 'BRIGHTDATA',
    snapshotId,
    createdAt: created,
    waitUntil: new Date(created.getTime() + (opts.waitMinutes ?? 480) * 60_000),
  });
  return { job, snapshotId, handlerCalls };
}

test('collectLateVendorResults', async (t) => {
  await t.test('a ready snapshot runs the handler once and finishes a job EXPIRED / TIMED_OUT as SUCCEEDED, completed after deadline (AC1, AC3)', async () => {
    const { job, snapshotId, handlerCalls } = await setup({ jobStatus: 'EXPIRED', reasonCode: 'TIMED_OUT' });
    progressFor = () => ({ status: 'ready' });
    assert.ok((await collectLateVendorResults()) >= 1);
    assert.equal(handlerCalls.length, 1);
    assert.deepEqual(handlerCalls[0].records, records);
    const row = await read(job.id);
    assert.equal(row.status, 'SUCCEEDED');
    assert.equal(row.completedAfterDeadline, true);
    assert.equal(row.reasonCode, null);
    assert.equal(row.errorMessage, null);
    assert.deepEqual(row.resultData, { refreshed: true });
    assert.ok(row.finishedAt && row.finishedAt.getTime() > Date.now() - 60_000);
    const link = await readLink(snapshotId);
    assert.equal(link.status, 'COLLECTED', 'COLLECTED only once the handler ran and the job was settled');
    assert.ok(link.collectedAt instanceof Date);
  });

  await t.test('a job still WAITING for the snapshot is finished too, and is not "after deadline" when it is still within its bound', async () => {
    const { job } = await setup({ jobStatus: 'WAITING', deadlineMsAgo: -3_600_000 }); // deadline an hour away
    progressFor = () => ({ status: 'ready' });
    await collectLateVendorResults();
    const row = await read(job.id);
    assert.equal(row.status, 'SUCCEEDED');
    assert.equal(row.completedAfterDeadline, false);
  });

  await t.test('the handler can end the job SUCCEEDED_WITH_LIMITS with its own reason', async () => {
    const { job } = await setup({
      jobStatus: 'WAITING',
      handler: async () => ({ outcome: 'SUCCEEDED_WITH_LIMITS', reasonCode: 'STORED_IMAGES_USED' }),
    });
    progressFor = () => ({ status: 'ready' });
    await collectLateVendorResults();
    const row = await read(job.id);
    assert.equal(row.status, 'SUCCEEDED_WITH_LIMITS');
    assert.equal(row.reasonCode, 'STORED_IMAGES_USED');
  });

  await t.test('a duplicate delivery is a no-op: the second sweep runs nothing (AC5)', async () => {
    const { job, handlerCalls } = await setup({ jobStatus: 'EXPIRED', reasonCode: 'TIMED_OUT' });
    progressFor = () => ({ status: 'ready' });
    await collectLateVendorResults();
    const finishedAt = (await read(job.id)).finishedAt;
    await collectLateVendorResults();
    assert.equal(handlerCalls.length, 1);
    assert.equal((await read(job.id)).finishedAt?.getTime(), finishedAt?.getTime());
  });

  await t.test('two sweeps at the same instant run the handler at most once (the claim is the only door)', async () => {
    const { handlerCalls } = await setup({ jobStatus: 'WAITING' });
    progressFor = () => ({ status: 'ready' });
    await Promise.all([collectLateVendorResults(), collectLateVendorResults()]);
    assert.equal(handlerCalls.length, 1);
  });

  await t.test('a snapshot still running is left alone (the job keeps waiting, no place held)', async () => {
    const { job, snapshotId, handlerCalls } = await setup({ jobStatus: 'WAITING' });
    for (const status of ['scheduled', 'building', 'running'] as const) {
      progressFor = () => ({ status });
      await collectLateVendorResults();
    }
    assert.equal(handlerCalls.length, 0);
    assert.deepEqual(downloads.filter((d) => d === snapshotId), []);
    assert.equal((await read(job.id)).status, 'WAITING');
    assert.equal((await readLink(snapshotId)).status, 'PENDING');
  });

  await t.test('past the wait bound a WAITING job ends EXPIRED / WAITED_TOO_LONG and the link is given up (AC6)', async () => {
    const { job, snapshotId, handlerCalls } = await setup({ jobStatus: 'WAITING', linkAgeMs: 61 * 60_000, waitMinutes: 60 });
    progressFor = () => ({ status: 'running' });
    await collectLateVendorResults();
    const row = await read(job.id);
    assert.equal(row.status, 'EXPIRED');
    assert.equal(row.reasonCode, 'WAITED_TOO_LONG');
    assert.equal((await readLink(snapshotId)).status, 'GAVE_UP');
    assert.equal(handlerCalls.length, 0);
  });

  await t.test('the bound never delays a ready snapshot: it is collected even past it', async () => {
    const { job, handlerCalls } = await setup({ jobStatus: 'EXPIRED', reasonCode: 'TIMED_OUT', linkAgeMs: 61 * 60_000, waitMinutes: 60 });
    progressFor = () => ({ status: 'ready' });
    await collectLateVendorResults();
    assert.equal(handlerCalls.length, 1);
    assert.equal((await read(job.id)).status, 'SUCCEEDED');
  });

  await t.test('a failed snapshot is given up and a WAITING job ends FAILED / VENDOR_RUN_FAILED', async () => {
    const { job, snapshotId, handlerCalls } = await setup({ jobStatus: 'WAITING' });
    progressFor = () => ({ status: 'failed', errorMessage: 'crawl error for https://secret.example/x' });
    await collectLateVendorResults();
    const row = await read(job.id);
    assert.equal(row.status, 'FAILED');
    assert.equal(row.reasonCode, 'VENDOR_RUN_FAILED');
    assert.equal(JSON.stringify(row).includes('secret.example'), false, 'the vendor text never reaches the job row');
    assert.equal((await readLink(snapshotId)).status, 'GAVE_UP');
    assert.equal(handlerCalls.length, 0);
  });

  await t.test('a job that ended FAILED or EXPIRED for another reason is never revived, but its records are still handed to the handler', async () => {
    for (const [jobStatus, reasonCode] of [['FAILED', 'CANCELLED'], ['EXPIRED', 'WAITED_TOO_LONG']] as const) {
      const { job, handlerCalls } = await setup({ jobStatus, reasonCode });
      progressFor = () => ({ status: 'ready' });
      await collectLateVendorResults();
      const row = await read(job.id);
      assert.equal(row.status, jobStatus, `${jobStatus} ${reasonCode ?? ''} is left as it is`);
      assert.equal(row.reasonCode ?? undefined, reasonCode);
      assert.equal(handlerCalls.length, 1, 'the handler still persisted the records by its own idempotent keys');
    }
  });

  await t.test('a job type with no late-result handler gives the link up with a warning and runs nothing', async () => {
    const { job, snapshotId } = await setup({ jobStatus: 'WAITING', handler: null as never });
    progressFor = () => ({ status: 'ready' });
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => { warnings.push(String(args[0])); };
    try {
      await collectLateVendorResults();
    } finally {
      console.warn = originalWarn;
    }
    assert.ok(warnings.some((w) => /no late-result handler/.test(w)));
    assert.equal((await readLink(snapshotId)).status, 'GAVE_UP');
    assert.equal((await read(job.id)).status, 'WAITING');
    assert.deepEqual(downloads.filter((d) => d === snapshotId), [], 'nothing was downloaded');
  });

  await t.test('a progress error is logged and retried on the next sweep; the sweep step never throws', async () => {
    const { job, snapshotId } = await setup({ jobStatus: 'WAITING' });
    progressFor = () => new Error('boom https://secret.example');
    const logged: unknown[][] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => { logged.push(args); };
    try {
      await collectLateVendorResults();
    } finally {
      console.error = originalError;
    }
    assert.ok(logged.length >= 1);
    assert.equal((await readLink(snapshotId)).status, 'PENDING');
    progressFor = () => ({ status: 'ready' });
    await collectLateVendorResults();
    assert.equal((await read(job.id)).status, 'SUCCEEDED');
  });

  await t.test('a download error leaves the link PENDING (nothing is claimed before the records are in hand)', async () => {
    const { snapshotId, handlerCalls } = await setup({ jobStatus: 'WAITING' });
    progressFor = () => ({ status: 'ready' });
    setGetBrightDataSnapshot(async () => {
      throw new Error('download failed');
    });
    const originalError = console.error;
    console.error = () => {};
    try {
      await collectLateVendorResults();
    } finally {
      console.error = originalError;
    }
    assert.equal((await readLink(snapshotId)).status, 'PENDING');
    assert.equal(handlerCalls.length, 0);
  });

  await t.test('a handler that throws puts the link back to PENDING for the next sweep and does not change the job', async () => {
    const { job, snapshotId } = await setup({
      jobStatus: 'WAITING',
      handler: async () => {
        throw new Error('persist failed');
      },
    });
    progressFor = () => ({ status: 'ready' });
    const originalError = console.error;
    console.error = () => {};
    try {
      await collectLateVendorResults();
    } finally {
      console.error = originalError;
    }
    assert.equal((await readLink(snapshotId)).status, 'PENDING');
    assert.equal((await readLink(snapshotId)).collectedAt, null);
    assert.equal((await read(job.id)).status, 'WAITING');
  });

  await t.test('settling a job promotes the owner\'s next queued job (the place freed by a finished job)', async () => {
    const { job } = await setup({ jobStatus: 'RUNNING' });
    const [queued] = await db
      .insert(jobs)
      .values({ type: job.type, ownerUserId: job.ownerUserId, trigger: 'USER', inputKey: `late-q-${fx.suffix}`, status: 'QUEUED', admittedAt: null, queuedSince: new Date(), deadlineAt: new Date(Date.now() + 600_000) })
      .returning();
    progressFor = () => ({ status: 'ready' });
    await collectLateVendorResults();
    assert.ok((await read(queued.id)).admittedAt instanceof Date);
    assert.ok(fx.invoked.includes(queued.id));
  });
});

test('collectLateVendorResults: review fixes', async (t) => {
  await t.test('a job whose OTHER provider already succeeded is not collected: the link is dropped, the handler does not overwrite it', async () => {
    const { job, snapshotId, handlerCalls } = await setup({ jobStatus: 'SUCCEEDED' });
    progressFor = () => ({ status: 'ready' });
    await collectLateVendorResults();
    assert.equal(handlerCalls.length, 0);
    assert.equal((await readLink(snapshotId)).status, 'GAVE_UP');
    assert.equal((await read(job.id)).status, 'SUCCEEDED');
    assert.deepEqual(downloads.filter((d) => d === snapshotId), [], 'nothing was even asked of the vendor');
  });

  await t.test('a QUEUED job (re-admitted while the snapshot ran) is settled by the late result, not re-run', async () => {
    const { job } = await setup({ jobStatus: 'WAITING' });
    await db.update(jobs).set({ status: 'QUEUED', admittedAt: null, queuedSince: new Date() }).where(eq(jobs.id, job.id));
    progressFor = () => ({ status: 'ready' });
    await collectLateVendorResults();
    assert.equal((await read(job.id)).status, 'SUCCEEDED');
  });

  await t.test('a link stuck COLLECTING (the Lambda died after the claim) goes back to PENDING and is collected on the next sweep', async () => {
    const { job, snapshotId, handlerCalls } = await setup({ jobStatus: 'WAITING' });
    await db.update(jobVendorSnapshots).set({ status: 'COLLECTING', updatedAt: new Date(Date.now() - 11 * 60_000) }).where(eq(jobVendorSnapshots.snapshotId, snapshotId));
    progressFor = () => ({ status: 'ready' });
    await collectLateVendorResults();
    assert.equal(handlerCalls.length, 1);
    assert.equal((await readLink(snapshotId)).status, 'COLLECTED');
    assert.equal((await read(job.id)).status, 'SUCCEEDED');
  });

  await t.test('a link claimed a moment ago (another sweep is working on it) is left alone', async () => {
    const { snapshotId, handlerCalls } = await setup({ jobStatus: 'WAITING' });
    await db.update(jobVendorSnapshots).set({ status: 'COLLECTING', updatedAt: new Date() }).where(eq(jobVendorSnapshots.snapshotId, snapshotId));
    progressFor = () => ({ status: 'ready' });
    await collectLateVendorResults();
    assert.equal(handlerCalls.length, 0);
    assert.equal((await readLink(snapshotId)).status, 'COLLECTING');
  });

  await t.test('a settle that throws (after the handler ran) releases the link for a retry, never leaves it COLLECTED unsettled', async () => {
    const { job, snapshotId } = await setup({
      jobStatus: 'WAITING',
      handler: async () => ({ outcome: 'FAILED' as never }), // an invalid ending: the settle refuses it
    });
    progressFor = () => ({ status: 'ready' });
    const originalError = console.error;
    console.error = () => {};
    try {
      await collectLateVendorResults();
    } finally {
      console.error = originalError;
    }
    assert.equal((await readLink(snapshotId)).status, 'PENDING');
    assert.equal((await read(job.id)).status, 'WAITING', 'the job was not written with the invalid ending');
  });

  await t.test('past the wait bound, a progress call that keeps failing gives the link up instead of polling forever', async () => {
    const { job, snapshotId } = await setup({ jobStatus: 'WAITING', linkAgeMs: 61 * 60_000, waitMinutes: 60 });
    progressFor = () => new Error('permanent 4xx');
    const originalError = console.error;
    console.error = () => {};
    try {
      await collectLateVendorResults();
    } finally {
      console.error = originalError;
    }
    assert.equal((await readLink(snapshotId)).status, 'GAVE_UP');
    assert.equal((await read(job.id)).reasonCode, 'WAITED_TOO_LONG');
  });

  await t.test('the hard stop: 24 hours past the bound even a ready snapshot is given up (a download or handler that always fails cannot retry forever)', async () => {
    const { job, snapshotId, handlerCalls } = await setup({ jobStatus: 'WAITING', linkAgeMs: (60 + 25 * 60) * 60_000, waitMinutes: 60 });
    progressFor = () => ({ status: 'ready' });
    await collectLateVendorResults();
    assert.equal((await readLink(snapshotId)).status, 'GAVE_UP');
    assert.equal(handlerCalls.length, 0);
    assert.equal((await read(job.id)).status, 'EXPIRED');
  });

  await t.test('a failed snapshot does not end the job while a second snapshot of the same job is still open', async () => {
    const { job, snapshotId } = await setup({ jobStatus: 'WAITING' });
    const secondId = `${snapshotId}_second`;
    await db.insert(jobVendorSnapshots).values({ jobId: job.id, provider: 'BRIGHTDATA', snapshotId: secondId, waitUntil: new Date(Date.now() + 3_600_000) });
    progressFor = (id) => (id === snapshotId ? { status: 'failed' } : { status: 'running' });
    await collectLateVendorResults();
    assert.equal((await readLink(snapshotId)).status, 'GAVE_UP');
    assert.equal((await read(job.id)).status, 'WAITING', 'the sibling may still deliver');
    progressFor = (id) => (id === secondId ? { status: 'ready' } : { status: 'failed' });
    await collectLateVendorResults();
    assert.equal((await read(job.id)).status, 'SUCCEEDED');
  });

  await t.test('SUCCEEDED_WITH_LIMITS without a reason is recorded UNSPECIFIED (FR117)', async () => {
    const { job } = await setup({ jobStatus: 'WAITING', handler: async () => ({ outcome: 'SUCCEEDED_WITH_LIMITS' }) });
    progressFor = () => ({ status: 'ready' });
    await collectLateVendorResults();
    const row = await read(job.id);
    assert.equal(row.status, 'SUCCEEDED_WITH_LIMITS');
    assert.equal(row.reasonCode, 'UNSPECIFIED');
  });

  await t.test('the job row and the logs never carry the raw error text', async () => {
    const { job } = await setup({
      jobStatus: 'WAITING',
      handler: async () => {
        throw new Error('insert into posts (caption) values (\'secret caption text\')');
      },
    });
    progressFor = () => ({ status: 'ready' });
    const logged: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => { logged.push(args.map(String).join(' ')); };
    try {
      await collectLateVendorResults();
    } finally {
      console.error = originalError;
    }
    assert.equal(logged.join('\n').includes('secret caption text'), false, 'errors are logged by name only');
    assert.equal(JSON.stringify(await read(job.id)).includes('secret caption text'), false);
  });
});

test('settleJobFromLateResult refuses an ending that may not be revised and reports it', async () => {
  const { job } = await setup({ jobStatus: 'FAILED', reasonCode: 'CANCELLED' });
  assert.equal(await settleJobFromLateResult(job, { outcome: 'SUCCEEDED' }), false);
  assert.equal((await read(job.id)).status, 'FAILED');
});
