import { db } from '../../db/client.js';
import { apifyPendingJobs } from '@festgrid/database';
import { eq, and } from 'drizzle-orm';
import { randomBytes } from 'crypto';

export interface ApifyPendingJob {
  id: string;
  profileId: string;
  runId: string;
  webhookToken: string;
  status: 'PENDING' | 'COMPLETED' | 'EXPIRED';
  expiresAt: Date;
  scraperActorRunId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function createPendingJob({
  profileId,
  runId,
  scraperActorRunId,
}: {
  profileId: string;
  runId: string;
  scraperActorRunId?: string | null;
}): Promise<{ webhookToken: string; id: string }> {
  const webhookToken = randomBytes(24).toString('hex');
  const { APIFY_JOB_TIMEOUT_MINUTES = 180 } = process.env;
  const timeoutMinutes = parseInt(APIFY_JOB_TIMEOUT_MINUTES as string, 10);
  const expiresAt = new Date(Date.now() + timeoutMinutes * 60_000);

  const [result] = await db
    .insert(apifyPendingJobs)
    .values({
      profileId,
      runId,
      webhookToken,
      status: 'PENDING',
      expiresAt,
      scraperActorRunId,
    })
    .returning({ id: apifyPendingJobs.id, webhookToken: apifyPendingJobs.webhookToken });

  return { webhookToken: result.webhookToken, id: result.id };
}

export async function findPendingJobByToken(
  webhookToken: string
): Promise<ApifyPendingJob | undefined> {
  const [row] = await db
    .select()
    .from(apifyPendingJobs)
    .where(eq(apifyPendingJobs.webhookToken, webhookToken));

  return row;
}

export async function markPendingJobCompleted(id: string): Promise<void> {
  await db
    .update(apifyPendingJobs)
    .set({ status: 'COMPLETED' })
    .where(eq(apifyPendingJobs.id, id));
}

export async function markPendingJobExpired(id: string): Promise<void> {
  await db
    .update(apifyPendingJobs)
    .set({ status: 'EXPIRED' })
    .where(eq(apifyPendingJobs.id, id));
}

export async function findExpiredPendingJobs(): Promise<ApifyPendingJob[]> {
  const now = new Date();
  return db
    .select()
    .from(apifyPendingJobs)
    .where(eq(apifyPendingJobs.status, 'PENDING'))
    .then((rows) =>
      rows.filter((row) => row.expiresAt < now)
    );
}

export async function findPendingJobsByProfileId(profileId: string): Promise<ApifyPendingJob[]> {
  return db
    .select()
    .from(apifyPendingJobs)
    .where(
      and(
        eq(apifyPendingJobs.profileId, profileId),
        eq(apifyPendingJobs.status, 'PENDING')
      )
    );
}
