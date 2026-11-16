import test from 'node:test';
import assert from 'node:assert/strict';
import { eq, inArray } from 'drizzle-orm';
import { jobVendorSnapshots, jobs, users } from '@festgrid/database';
import { db } from '../../db/client.js';
import { linkJobVendorSnapshot } from './link-job-vendor-snapshot.js';

// Story 10.5 AC1: the snapshot stays linked to the job; idempotent on the snapshot id; never throws.

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const userIds: string[] = [];

async function makeJob(): Promise<string> {
  const [user] = await db.insert(users).values({ email: `link-snap-${suffix}-${userIds.length}@example.test` }).returning({ id: users.id });
  userIds.push(user.id);
  const [job] = await db.insert(jobs).values({ type: `fixture-link-${suffix}`, ownerUserId: user.id, trigger: 'USER', inputKey: `k-${suffix}-${userIds.length}`, deadlineAt: new Date(Date.now() + 60_000) }).returning({ id: jobs.id });
  return job.id;
}

test.after(async () => {
  if (userIds.length > 0) await db.delete(users).where(inArray(users.id, userIds)); // jobs and links cascade
});

test('linkJobVendorSnapshot writes a PENDING link that waits until the configured bound', async () => {
  const jobId = await makeJob();
  const now = new Date('2026-11-11T10:00:00.000Z');
  await linkJobVendorSnapshot({ jobId, provider: 'BRIGHTDATA', snapshotId: `s_${suffix}_1`, now });
  const [row] = await db.select().from(jobVendorSnapshots).where(eq(jobVendorSnapshots.snapshotId, `s_${suffix}_1`));
  assert.equal(row.jobId, jobId);
  assert.equal(row.provider, 'BRIGHTDATA');
  assert.equal(row.status, 'PENDING');
  assert.equal(row.collectedAt, null);
  assert.equal(row.waitUntil.getTime() - now.getTime(), 480 * 60_000, 'the default bound is 480 minutes');
});

test('the wait bound follows BRIGHTDATA_SNAPSHOT_MAX_WAIT_MINUTES', async () => {
  const jobId = await makeJob();
  const saved = process.env.BRIGHTDATA_SNAPSHOT_MAX_WAIT_MINUTES;
  process.env.BRIGHTDATA_SNAPSHOT_MAX_WAIT_MINUTES = '60';
  try {
    const now = new Date('2026-11-11T10:00:00.000Z');
    await linkJobVendorSnapshot({ jobId, provider: 'BRIGHTDATA', snapshotId: `s_${suffix}_2`, now });
    const [row] = await db.select().from(jobVendorSnapshots).where(eq(jobVendorSnapshots.snapshotId, `s_${suffix}_2`));
    assert.equal(row.waitUntil.getTime() - now.getTime(), 60 * 60_000);
  } finally {
    if (saved === undefined) delete process.env.BRIGHTDATA_SNAPSHOT_MAX_WAIT_MINUTES;
    else process.env.BRIGHTDATA_SNAPSHOT_MAX_WAIT_MINUTES = saved;
  }
});

test('linking the same snapshot twice keeps one row and does not reset it', async () => {
  const jobId = await makeJob();
  await linkJobVendorSnapshot({ jobId, provider: 'BRIGHTDATA', snapshotId: `s_${suffix}_3`, now: new Date('2026-11-11T10:00:00.000Z') });
  await db.update(jobVendorSnapshots).set({ status: 'COLLECTED', collectedAt: new Date() }).where(eq(jobVendorSnapshots.snapshotId, `s_${suffix}_3`));
  await linkJobVendorSnapshot({ jobId, provider: 'BRIGHTDATA', snapshotId: `s_${suffix}_3`, now: new Date('2026-11-11T12:00:00.000Z') });
  const rows = await db.select().from(jobVendorSnapshots).where(eq(jobVendorSnapshots.snapshotId, `s_${suffix}_3`));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'COLLECTED', 'a collected link is not reopened by a repeat');
});

test('a link for an unknown job is logged and never throws', async () => {
  const logged: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { logged.push(args); };
  try {
    await linkJobVendorSnapshot({ jobId: '00000000-0000-4000-8000-000000000000', provider: 'BRIGHTDATA', snapshotId: `s_${suffix}_4` });
  } finally {
    console.error = original;
  }
  assert.equal(logged.length, 1);
  assert.equal(JSON.stringify(logged[0]).includes('caption'), false);
});

test('deleting the job removes its links (cascade)', async () => {
  const jobId = await makeJob();
  await linkJobVendorSnapshot({ jobId, provider: 'BRIGHTDATA', snapshotId: `s_${suffix}_5` });
  await db.delete(jobs).where(eq(jobs.id, jobId));
  assert.equal((await db.select().from(jobVendorSnapshots).where(eq(jobVendorSnapshots.snapshotId, `s_${suffix}_5`))).length, 0);
});
