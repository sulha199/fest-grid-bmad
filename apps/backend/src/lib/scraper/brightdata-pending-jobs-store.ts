import { db } from '../../db/client.js';
import { brightdataPendingJobs } from '@festgrid/database';
import { eq, and } from 'drizzle-orm';
import { randomBytes } from 'crypto';

export interface BrightdataPendingJob {
  id: string;
  profileId: string;
  snapshotId: string;
  webhookToken: string;
  status: 'PENDING' | 'COMPLETED' | 'EXPIRED';
  expiresAt: Date;
  scraperActorRunId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function createPendingJob({
  profileId,
  snapshotId,
  scraperActorRunId,
}: {
  profileId: string;
  snapshotId: string;
  scraperActorRunId?: string | null;
}): Promise<{ webhookToken: string; id: string }> {
  const webhookToken = randomBytes(24).toString('hex');
  const { BRIGHTDATA_JOB_TIMEOUT_MINUTES = 180 } = process.env;
  const timeoutMinutes = parseInt(BRIGHTDATA_JOB_TIMEOUT_MINUTES as string, 10);
  const expiresAt = new Date(Date.now() + timeoutMinutes * 60_000);

  const [result] = await db
    .insert(brightdataPendingJobs)
    .values({
      profileId,
      snapshotId,
      webhookToken,
      status: 'PENDING',
      expiresAt,
      scraperActorRunId,
    })
    .returning({ id: brightdataPendingJobs.id, webhookToken: brightdataPendingJobs.webhookToken });

  return { webhookToken: result.webhookToken, id: result.id };
}

export async function findPendingJobByToken(
  webhookToken: string
): Promise<BrightdataPendingJob | undefined> {
  const [row] = await db
    .select()
    .from(brightdataPendingJobs)
    .where(eq(brightdataPendingJobs.webhookToken, webhookToken));

  return row;
}

export async function markPendingJobCompleted(id: string): Promise<void> {
  await db
    .update(brightdataPendingJobs)
    .set({ status: 'COMPLETED' })
    .where(eq(brightdataPendingJobs.id, id));
}

export async function markPendingJobExpired(id: string): Promise<void> {
  await db
    .update(brightdataPendingJobs)
    .set({ status: 'EXPIRED' })
    .where(eq(brightdataPendingJobs.id, id));
}

export async function findExpiredPendingJobs(): Promise<BrightdataPendingJob[]> {
  const now = new Date();
  return db
    .select()
    .from(brightdataPendingJobs)
    .where(eq(brightdataPendingJobs.status, 'PENDING'))
    .then((rows) =>
      rows.filter((row) => row.expiresAt < now)
    );
}

export async function findPendingJobsByProfileId(profileId: string): Promise<BrightdataPendingJob[]> {
  return db
    .select()
    .from(brightdataPendingJobs)
    .where(
      and(
        eq(brightdataPendingJobs.profileId, profileId),
        eq(brightdataPendingJobs.status, 'PENDING')
      )
    );
}
