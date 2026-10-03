// Story 3.6n (AC9, AD-29 backfill-ownership split, 2026-10-03): backfills the two
// extraction_audit_logs columns this story's own face-blur stage produces ground truth for.
// AD-29 backfill-ownership decision: each story writes only the outcome it itself produces --
// this story owns 'no_face_reported' and the real detected count; Story 3.6o owns
// 'event_relevance_gate' by reusing this SAME helper (implemented once here, per Gate 3 reuse
// discipline -- do not let 3.6o duplicate this update logic).
//
// DB-coupled (imports the Drizzle table), so this stays in apps/backend, never packages/domain,
// per project-context.md's Code Organization rule -- same placement as write-extraction-audit-
// log.ts, which inserted the row this function updates.
import { db } from '../../db/client.js';
import { extractionAuditLogs } from '@festgrid/database';
import { eq } from 'drizzle-orm';

export interface BackfillFaceDetectionAuditResultParams {
  actualFaceDetectionCount: number | null;
  faceDetectionSkippedReason: 'no_face_reported' | 'event_relevance_gate' | null;
}

/**
 * Updates the extraction_audit_logs row `auditLogId` (written earlier in this same extraction
 * attempt by writeExtractionAuditLog, Story 3.6p) with this story's own ground-truth face-
 * detection outcome.
 *
 * Best-effort, mirroring writeExtractionAuditLog's own defensive-write precedent: wrapped in
 * its own try/catch, logs and returns on failure, never throws. No-ops (logs a warning, does
 * not throw) when `auditLogId` is `null` -- the earlier writeExtractionAuditLog call failed or
 * was skipped, so there is no row to target.
 */
export async function backfillFaceDetectionAuditResult(
  auditLogId: string | null,
  result: BackfillFaceDetectionAuditResultParams
): Promise<void> {
  if (!auditLogId) {
    // console.debug, not console.log/console.warn: this is an expected, common degenerate path
    // (any test or real extraction attempt where the earlier writeExtractionAuditLog write
    // failed/was skipped, e.g. a synthetic test postId with no matching posts row). Several
    // existing test files in this suite (e.g. process-ai-job.carousel-completeness.test.ts)
    // assert EXACT console.log/console.warn call counts for unrelated features; logging this
    // common no-op there would silently inflate those counts and break unrelated assertions.
    console.debug('[backfillFaceDetectionAuditResult] No-op: auditLogId is null (earlier writeExtractionAuditLog write failed or was skipped).');
    return;
  }

  try {
    await db
      .update(extractionAuditLogs)
      .set({
        actualFaceDetectionCount: result.actualFaceDetectionCount,
        faceDetectionSkippedReason: result.faceDetectionSkippedReason,
      })
      .where(eq(extractionAuditLogs.id, auditLogId));
  } catch (error) {
    console.error(`[backfillFaceDetectionAuditResult] Failed to backfill extraction_audit_logs row ${auditLogId}:`, error);
  }
}

export let backfillFaceDetectionAuditResultSeam = backfillFaceDetectionAuditResult;
export function setBackfillFaceDetectionAuditResultSeam(fn: typeof backfillFaceDetectionAuditResult) {
  backfillFaceDetectionAuditResultSeam = fn;
}
