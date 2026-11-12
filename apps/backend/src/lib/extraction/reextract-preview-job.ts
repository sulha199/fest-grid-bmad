import { and, eq } from 'drizzle-orm';
import { jobs, manualExtractionJobs } from '@festgrid/database';
import { REEXTRACT_POST_JOB_TYPE, parseReextractPostInput, toExtractionError, toExtractionJobState } from '@festgrid/domain/jobs';
import type { ManualExtractionRequestPayload, ReextractionPreviewResult } from '@festgrid/domain/posts';
import { db } from '../../db/client.js';
import type { DbTransaction } from '../subscriptions/subscription-cap.js';
import { getManualExtractionJobStatus, type ManualExtractionJobStatusResult } from './manual-extraction-job.js';

// Story 10.6 (AC8; AD-40 Rules 3, 7 and 8; AD-53 Rule 17) -- a moderator re-extract preview now lives in one of two places until Story
// 10.9 decides on `manual_extraction_jobs` (PRD OI-4): the engine job `reextract-post` (`jobs.result_data`, a stored post that keeps its
// caption) or the manual job (a caption-less post, a URL not in the database). The two ids are both uuids and never collide; every
// reader of a preview (`postReextractionPreview`, Apply) goes through this file, so the screen sees one shape and neither query nor
// mutation changes. Both reads are owner-scoped: another moderator's job is "not found", never forbidden.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The status of a re-extract preview job in the shape `getManualExtractionJobStatus` returns, whichever table holds it. Null for an
 * unknown id, another user's job, or an id that is not a uuid. A manual correction job is returned too (its `mode` says so), as
 * before; the resolver rejects it.
 */
export async function getReextractPreviewJobStatus(jobId: string, userId: string, now: Date = new Date()): Promise<ManualExtractionJobStatusResult | null> {
  if (!UUID_PATTERN.test(jobId)) return null;

  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.ownerUserId, userId), eq(jobs.type, REEXTRACT_POST_JOB_TYPE)))
    .limit(1);
  if (!job) {
    return getManualExtractionJobStatus(jobId, userId, now);
  }

  const status = toExtractionJobState(job.status);
  if (status === 'FAILED') {
    const { errorCode, errorMessage } = toExtractionError(job.reasonCode, job.errorMessage);
    return { mode: 'REEXTRACT_PREVIEW', status, data: null, errorCode, errorMessage, completedAt: job.finishedAt };
  }
  return {
    mode: 'REEXTRACT_PREVIEW',
    status,
    // A job that succeeded with limits is still a finished preview: its `errorMessage` is the plain note about the images, not an error.
    data: status === 'SUCCEEDED' ? (job.resultData ?? null) : null,
    errorCode: null,
    errorMessage: null,
    completedAt: status === 'SUCCEEDED' ? (job.finishedAt ?? job.updatedAt) : null,
  };
}

/** Where a preview lives, and what Apply needs to read about it. */
export interface PreviewJobRef {
  source: 'ENGINE' | 'LEGACY';
  jobId: string;
  postId: string;
  result: ReextractionPreviewResult | null;
  /** When the preview finished: the 30-minute Apply window runs from it. */
  finishedAt: Date;
}

/** The finished preview job for Apply, owner-scoped; null when there is none (unknown, not the owner's, not finished, not a preview). */
export async function loadPreviewJobForApply(userId: string, jobId: string): Promise<PreviewJobRef | null> {
  const [engine] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.ownerUserId, userId), eq(jobs.type, REEXTRACT_POST_JOB_TYPE)))
    .limit(1);
  if (engine) {
    const input = parseReextractPostInput(engine.input);
    if (!input || (engine.status !== 'SUCCEEDED' && engine.status !== 'SUCCEEDED_WITH_LIMITS')) return null;
    return {
      source: 'ENGINE',
      jobId,
      postId: input.postId,
      result: engine.resultData as ReextractionPreviewResult | null,
      finishedAt: engine.finishedAt ?? engine.updatedAt,
    };
  }

  const [manual] = await db
    .select()
    .from(manualExtractionJobs)
    .where(and(eq(manualExtractionJobs.id, jobId), eq(manualExtractionJobs.requestedByUserId, userId)))
    .limit(1);
  const payload = manual?.requestPayload as ManualExtractionRequestPayload | undefined;
  if (!manual || payload?.mode !== 'REEXTRACT_PREVIEW' || manual.status !== 'SUCCEEDED') return null;
  return {
    source: 'LEGACY',
    jobId,
    postId: payload.message.postId,
    result: manual.resultData as ReextractionPreviewResult | null,
    finishedAt: manual.completedAt ?? manual.updatedAt,
  };
}

/** Locks the preview's row (`FOR UPDATE`) inside Apply's transaction and returns its current result, so two applies of one job serialize. */
export async function lockPreviewJobResult(tx: DbTransaction, ref: PreviewJobRef): Promise<ReextractionPreviewResult | null> {
  if (ref.source === 'ENGINE') {
    const [row] = await tx.select({ resultData: jobs.resultData }).from(jobs).where(eq(jobs.id, ref.jobId)).for('update');
    return (row?.resultData as ReextractionPreviewResult | null | undefined) ?? null;
  }
  const [row] = await tx.select({ resultData: manualExtractionJobs.resultData }).from(manualExtractionJobs).where(eq(manualExtractionJobs.id, ref.jobId)).for('update');
  return (row?.resultData as ReextractionPreviewResult | null | undefined) ?? null;
}

/** Writes the applied preview back to the table that holds it, inside Apply's transaction. */
export async function writePreviewJobResult(tx: DbTransaction, ref: PreviewJobRef, result: ReextractionPreviewResult): Promise<void> {
  if (ref.source === 'ENGINE') {
    await tx.update(jobs).set({ resultData: result, updatedAt: new Date() }).where(eq(jobs.id, ref.jobId));
    return;
  }
  await tx.update(manualExtractionJobs).set({ resultData: result, updatedAt: new Date() }).where(eq(manualExtractionJobs.id, ref.jobId));
}
