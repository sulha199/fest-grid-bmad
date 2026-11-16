import { jobVendorSnapshots } from '@festgrid/database';
import { db } from '../../db/client.js';
import { loadBackendEnv } from '../../env.js';

// Story 10.5 (AC1; PRD FR119) -- keeps a vendor snapshot that outlived its job's budget linked to the job, so the 5-minute job
// sweep (`collectLateVendorResults`) can still collect its records. Idempotent on the snapshot id, and it NEVER throws: the audit
// of a snapshot must not change what a post fetch returns.

export async function linkJobVendorSnapshot(input: {
  jobId: string;
  provider: 'APIFY' | 'BRIGHTDATA';
  snapshotId: string;
  now?: Date;
}): Promise<void> {
  try {
    const now = input.now ?? new Date();
    const waitUntil = new Date(now.getTime() + loadBackendEnv().brightdataSnapshotMaxWaitMinutes * 60_000);
    await db
      .insert(jobVendorSnapshots)
      .values({ jobId: input.jobId, provider: input.provider, snapshotId: input.snapshotId, waitUntil })
      .onConflictDoNothing({ target: jobVendorSnapshots.snapshotId });
  } catch (error) {
    console.error(`[job-engine] could not link snapshot ${input.snapshotId} to job ${input.jobId}:`, error);
  }
}
