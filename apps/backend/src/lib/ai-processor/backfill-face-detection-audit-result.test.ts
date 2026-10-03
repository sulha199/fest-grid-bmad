import test from 'node:test';
import * as assert from 'node:assert';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, posts, extractionAuditLogs } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { writeExtractionAuditLog } from './write-extraction-audit-log.js';
import { backfillFaceDetectionAuditResult } from './backfill-face-detection-audit-result.js';

test('backfillFaceDetectionAuditResult unit tests', async (t) => {
  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: 'test_acc_audit_backfill_' + Date.now(),
      platform: 'instagram',
      username: 'test.audit.backfill',
      displayName: 'Test Audit Backfill',
    })
    .returning();

  const [post] = await db
    .insert(posts)
    .values({
      accountId: profile.id,
      platform: 'instagram',
      postUrl: 'https://instagram.com/p/test_audit_backfill_' + Date.now(),
      publishedAt: new Date(),
    })
    .returning();

  t.after(async () => {
    await db.delete(posts).where(eq(posts.id, post.id));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
  });

  await t.test('updates the targeted row with the real count and null reason', async () => {
    const { id: auditLogId } = await writeExtractionAuditLog({
      postId: post.id,
      geminiModel: 'gemini-test',
      isEvent: true,
      hasFaceImage: true,
      faceImageCount: 1,
      minEventCount: null,
      actualEventCount: 1,
      groupingReason: null,
      eventsCompleteness: [],
    });

    await backfillFaceDetectionAuditResult(auditLogId, { actualFaceDetectionCount: 5, faceDetectionSkippedReason: null });

    const [row] = await db.select().from(extractionAuditLogs).where(eq(extractionAuditLogs.id, auditLogId));
    assert.strictEqual(row.actualFaceDetectionCount, 5);
    assert.strictEqual(row.faceDetectionSkippedReason, null);
  });

  await t.test('updates the targeted row with no_face_reported', async () => {
    const { id: auditLogId } = await writeExtractionAuditLog({
      postId: post.id,
      geminiModel: 'gemini-test',
      isEvent: true,
      hasFaceImage: false,
      faceImageCount: null,
      minEventCount: null,
      actualEventCount: 1,
      groupingReason: null,
      eventsCompleteness: [],
    });

    await backfillFaceDetectionAuditResult(auditLogId, { actualFaceDetectionCount: null, faceDetectionSkippedReason: 'no_face_reported' });

    const [row] = await db.select().from(extractionAuditLogs).where(eq(extractionAuditLogs.id, auditLogId));
    assert.strictEqual(row.actualFaceDetectionCount, null);
    assert.strictEqual(row.faceDetectionSkippedReason, 'no_face_reported');
  });

  await t.test('no-ops without throwing when auditLogId is null', async () => {
    await assert.doesNotReject(() =>
      backfillFaceDetectionAuditResult(null, { actualFaceDetectionCount: 1, faceDetectionSkippedReason: null })
    );
  });

  await t.test('a thrown DB error is caught and logged, not propagated', async () => {
    // A well-formed UUID that matches no real row -- the update affects zero rows but does not
    // throw (Drizzle's .update().where() with no match is a no-op, not an error). To exercise
    // the actual catch branch, pass a malformed id that fails the DB's uuid type coercion.
    await assert.doesNotReject(() =>
      backfillFaceDetectionAuditResult('not-a-valid-uuid', { actualFaceDetectionCount: 1, faceDetectionSkippedReason: null })
    );
  });
});
