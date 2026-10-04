import test from 'node:test';
import * as assert from 'node:assert';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, subscriptions, users, posts, extractionAuditLogs } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import {
  processAiJob,
  setCallGeminiSeam,
  callGeminiSeam,
  setMarkPostExtractedSeam,
  markPostExtractedSeam,
  setRehostPostImageSeam,
  rehostPostImageSeam,
  setBackfillAccountProfileAndInferDefaultLocationSeam,
  backfillAccountProfileAndInferDefaultLocationSeam
} from './process-ai-job.js';
import { setResolveLocationSeam, resolveLocationSeam } from './resolve-account-and-locations.js';
import { setSendSqsMessage, sendSqsMessage } from '../aws/send-sqs-message.js';
import { setDetectAndBlurFacesSeam, detectAndBlurFacesSeam } from './detect-and-blur-faces.js';
import { setUploadFaceBlurThumbnailSeam, uploadFaceBlurThumbnailSeam } from './upload-face-blur-thumbnail.js';
import { type GeminiExtractionPayload } from '@festgrid/domain';
import { type ProcessingJobMessage } from '@festgrid/domain/posts';
import { loadBackendEnv } from '../../env.js';

// Story 3.6p (AD-29, Task 4) — integration tests proving process-ai-job.ts writes exactly one
// extraction_audit_logs row per extraction attempt, with the correct shape/defaults, at all
// three exit points. Real-DB convention matching process-ai-job.carousel-completeness.test.ts:
// setCallGeminiSeam mocks Gemini, the inserted row is read back from the real DB by postId.
process.env.DATA_INGESTION_INLINE_FALLBACK_ENABLED = 'false';

function buildSchedule(title: string, date: string) {
  return { isMainSchedule: false, eventStartDate: date, title };
}

// extraction_audit_logs.post_id carries an FK to posts.id (AC1), so every case below needs a
// real posts row to insert against -- a bare UUID with no matching posts row would trip the FK
// constraint, which is exactly what Case F below deliberately exploits instead.
async function insertTestPost(accountId: string, postUrl: string): Promise<string> {
  const [row] = await db
    .insert(posts)
    .values({
      accountId,
      platform: 'instagram',
      postUrl,
      publishedAt: new Date('2026-08-29T10:24:17Z'),
    })
    .returning();
  return row.id;
}

test('processAiJob extraction_audit_logs write-path tests', async (t) => {
  const originalEnvQueueUrl = process.env.DATA_INGESTION_QUEUE_URL;
  const originalCallGeminiSeam = callGeminiSeam;
  const originalMarkPostExtractedSeam = markPostExtractedSeam;
  const originalRehostPostImageSeam = rehostPostImageSeam;
  const originalBackfillAccountProfileAndInferDefaultLocationSeam = backfillAccountProfileAndInferDefaultLocationSeam;
  const originalResolveLocationSeam = resolveLocationSeam;
  const originalSendSqsMessage = sendSqsMessage;
  const originalDetectAndBlurFacesSeam = detectAndBlurFacesSeam;
  const originalUploadFaceBlurThumbnailSeam = uploadFaceBlurThumbnailSeam;
  const originalFetch = globalThis.fetch;
  const originalBlurSetting = process.env.BLUR_FACES_BEFORE_AI;

  setBackfillAccountProfileAndInferDefaultLocationSeam(async () => {});

  const seededUsers = await db.select().from(users).limit(1);
  assert.ok(seededUsers.length > 0, 'Must have at least one seeded user');
  const user = seededUsers[0];

  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: 'platform-acc-audit-log-' + Date.now(),
      platform: 'instagram',
      displayName: 'Audit Log Fest Account',
      username: 'audit_log_' + Date.now(),
      isImageStorageOptedIn: true
    })
    .returning();

  await db
    .insert(subscriptions)
    .values({
      userId: user.id,
      accountId: profile.id,
      isNewlyAdded: true
    })
    .returning();

  const restoreSeams = () => {
    setCallGeminiSeam(originalCallGeminiSeam);
    setMarkPostExtractedSeam(originalMarkPostExtractedSeam);
    setRehostPostImageSeam(originalRehostPostImageSeam);
    setBackfillAccountProfileAndInferDefaultLocationSeam(
      originalBackfillAccountProfileAndInferDefaultLocationSeam
    );
    setResolveLocationSeam(originalResolveLocationSeam);
    setSendSqsMessage(originalSendSqsMessage);
    setDetectAndBlurFacesSeam(originalDetectAndBlurFacesSeam);
    setUploadFaceBlurThumbnailSeam(originalUploadFaceBlurThumbnailSeam);
    globalThis.fetch = originalFetch;
    if (originalBlurSetting === undefined) delete process.env.BLUR_FACES_BEFORE_AI;
    else process.env.BLUR_FACES_BEFORE_AI = originalBlurSetting;
  };

  t.after(async () => {
    // extraction_audit_logs rows cascade-delete when their posts row is deleted (AC1, ON DELETE
    // cascade), so deleting posts here is sufficient cleanup for both tables.
    await db.delete(posts).where(eq(posts.accountId, profile.id));
    await db.delete(subscriptions).where(eq(subscriptions.accountId, profile.id));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
    process.env.DATA_INGESTION_QUEUE_URL = originalEnvQueueUrl;
    restoreSeams();
  });

  t.beforeEach(() => {
    process.env.DATA_INGESTION_QUEUE_URL = 'https://sqs.mock-audit-log-url';
    setBackfillAccountProfileAndInferDefaultLocationSeam(async () => {});
  });

  t.afterEach(() => {
    restoreSeams();
  });

  await t.test('Case A: isEvent=false -> one row, actualEventCount 0, eventsCompleteness [], hasFaceImage/faceImageCount persisted', async () => {
    const postId = await insertTestPost(profile.id, 'https://www.instagram.com/p/audit-case-a/');
    const payload: GeminiExtractionPayload = {
      isEvent: false,
      events: [],
      hasFaceImage: true,
      faceImageCount: 2
    };

    const message: ProcessingJobMessage = {
      postId,
      accountId: profile.id,
      content: 'Not an event',
      postUrl: 'https://www.instagram.com/p/audit-case-a/',
      publishedAt: '2026-08-29T10:24:17Z'
    };

    setCallGeminiSeam(async () => ({ text: JSON.stringify(payload) }));
    setSendSqsMessage(async () => {});
    setMarkPostExtractedSeam(async () => ({} as any));

    await processAiJob(message);

    const rows = await db.select().from(extractionAuditLogs).where(eq(extractionAuditLogs.postId, postId));
    assert.strictEqual(rows.length, 1, 'Expected exactly one extraction_audit_logs row');
    const row = rows[0];
    assert.strictEqual(row.isEvent, false);
    assert.strictEqual(row.actualEventCount, 0);
    assert.deepStrictEqual(row.eventsCompleteness, []);
    assert.strictEqual(row.hasFaceImage, true);
    assert.strictEqual(row.faceImageCount, 2);
    const env = loadBackendEnv();
    assert.strictEqual(row.geminiModel, env.geminiModel);
  });

  await t.test('Case B: isEvent=true, zero-events defensive branch -> one row, actualEventCount 0, eventsCompleteness []', async () => {
    const postId = await insertTestPost(profile.id, 'https://www.instagram.com/p/audit-case-b/');
    const payload: GeminiExtractionPayload = {
      isEvent: true,
      events: []
    };

    const message: ProcessingJobMessage = {
      postId,
      accountId: profile.id,
      content: 'Reported event but zero events',
      postUrl: 'https://www.instagram.com/p/audit-case-b/',
      publishedAt: '2026-08-29T10:24:17Z'
    };

    setCallGeminiSeam(async () => ({ text: JSON.stringify(payload) }));
    setSendSqsMessage(async () => {});
    setMarkPostExtractedSeam(async () => ({} as any));

    await processAiJob(message);

    const rows = await db.select().from(extractionAuditLogs).where(eq(extractionAuditLogs.postId, postId));
    assert.strictEqual(rows.length, 1, 'Expected exactly one extraction_audit_logs row');
    assert.strictEqual(rows[0].isEvent, true);
    assert.strictEqual(rows[0].actualEventCount, 0);
    assert.deepStrictEqual(rows[0].eventsCompleteness, []);
  });

  await t.test('Case C: single event with full completeness signals -> actualScheduleCount is the extraction-time count', async () => {
    const postId = await insertTestPost(profile.id, 'https://www.instagram.com/p/audit-case-c/');
    const payload: GeminiExtractionPayload = {
      isEvent: true,
      events: [
        {
          eventName: 'Full Completeness Event',
          types: ['PERFORMANCE'],
          categories: ['MUSIC'],
          // Deliberately fewer schedules than minScheduleCount, to also prove this doesn't block the write.
          schedules: [
            buildSchedule('Day 1', '2026-10-25'),
            buildSchedule('Day 2', '2026-10-26')
          ],
          confidenceScore: 0.9,
          minScheduleCount: 3,
          expectedScheduleNames: ['Day 1', 'Day 2', 'Day 3']
        }
      ]
    };

    const message: ProcessingJobMessage = {
      postId,
      accountId: profile.id,
      content: 'Single event with completeness signals',
      postUrl: 'https://www.instagram.com/p/audit-case-c/',
      publishedAt: '2026-08-29T10:24:17Z'
    };

    setCallGeminiSeam(async () => ({ text: JSON.stringify(payload) }));
    setSendSqsMessage(async () => {});
    setMarkPostExtractedSeam(async () => ({} as any));
    setResolveLocationSeam(async () => ({ location: undefined }) as any);

    await processAiJob(message);

    const rows = await db.select().from(extractionAuditLogs).where(eq(extractionAuditLogs.postId, postId));
    assert.strictEqual(rows.length, 1, 'Expected exactly one extraction_audit_logs row');
    const row = rows[0];
    assert.strictEqual(row.actualEventCount, 1);
    assert.strictEqual(row.eventsCompleteness.length, 1);
    const entry = row.eventsCompleteness[0];
    assert.strictEqual(entry.eventIndex, 0);
    assert.strictEqual(entry.minScheduleCount, 3);
    assert.deepStrictEqual(entry.expectedScheduleNames, ['Day 1', 'Day 2', 'Day 3']);
    assert.strictEqual(entry.confidenceScore, 0.9);
    assert.strictEqual(entry.actualScheduleCount, 2, 'actualScheduleCount is the extraction-time count, not minScheduleCount');
  });

  await t.test('Case D: multi-event post with groupingReason/minEventCount -> absent-in-payload maps to null, not undefined', async () => {
    const postId = await insertTestPost(profile.id, 'https://www.instagram.com/p/audit-case-d/');
    const payload: GeminiExtractionPayload = {
      isEvent: true,
      groupingReason: 'separate-events',
      minEventCount: 2,
      events: [
        {
          eventName: 'Multi Event One',
          types: ['PERFORMANCE'],
          categories: ['MUSIC'],
          schedules: [buildSchedule('Multi Event One', '2026-10-25')],
          confidenceScore: 0.85
        },
        {
          eventName: 'Multi Event Two',
          types: ['PERFORMANCE'],
          categories: ['MUSIC'],
          schedules: [buildSchedule('Multi Event Two', '2026-10-26')],
          confidenceScore: 0.8
        }
      ]
    };

    const message: ProcessingJobMessage = {
      postId,
      accountId: profile.id,
      content: 'Multi-event roundup',
      postUrl: 'https://www.instagram.com/p/audit-case-d/',
      publishedAt: '2026-08-29T10:24:17Z'
    };

    setCallGeminiSeam(async () => ({ text: JSON.stringify(payload) }));
    setSendSqsMessage(async () => {});
    setMarkPostExtractedSeam(async () => ({} as any));
    setResolveLocationSeam(async () => ({ location: undefined }) as any);

    await processAiJob(message);

    const rows = await db.select().from(extractionAuditLogs).where(eq(extractionAuditLogs.postId, postId));
    assert.strictEqual(rows.length, 1, 'Expected exactly one extraction_audit_logs row');
    const row = rows[0];
    assert.strictEqual(row.actualEventCount, 2);
    assert.strictEqual(row.groupingReason, 'separate-events');
    assert.strictEqual(row.minEventCount, 2);
    assert.strictEqual(row.eventsCompleteness.length, 2);
    const [entry0, entry1] = row.eventsCompleteness.sort((a, b) => a.eventIndex - b.eventIndex);
    assert.strictEqual(entry0.eventIndex, 0);
    assert.strictEqual(entry1.eventIndex, 1);
    assert.strictEqual(entry0.minScheduleCount, null, 'absent minScheduleCount must map to null, not undefined');
    assert.strictEqual(entry0.expectedScheduleNames, null, 'absent expectedScheduleNames must map to null, not undefined');
    assert.strictEqual(entry1.minScheduleCount, null);
    assert.strictEqual(entry1.expectedScheduleNames, null);
  });

  await t.test('Case E: event-count truncation -> actualEventCount and eventsCompleteness.length both equal the truncated (capped) count', async () => {
    const postId = await insertTestPost(profile.id, 'https://www.instagram.com/p/audit-case-e/');
    const env = loadBackendEnv();

    const fifteenEvents = Array.from({ length: 15 }, (_, i) => ({
      eventName: `Roundup Event ${String(i + 1).padStart(2, '0')}`,
      types: ['OTHER'],
      categories: ['OTHER'],
      schedules: [{ isMainSchedule: true, eventStartDate: `2026-08-${String(i + 1).padStart(2, '0')}` }],
      confidenceScore: 0.8
    }));

    const message: ProcessingJobMessage = {
      postId,
      accountId: profile.id,
      content: 'Fifteen-item roundup',
      postUrl: 'https://www.instagram.com/p/audit-case-e/',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    setCallGeminiSeam(async () => ({
      text: JSON.stringify({ isEvent: true, groupingReason: 'roundup', events: fifteenEvents })
    }));
    setSendSqsMessage(async () => {});
    setMarkPostExtractedSeam(async () => ({} as any));
    setResolveLocationSeam(async () => ({ location: undefined }) as any);

    await processAiJob(message);

    const rows = await db.select().from(extractionAuditLogs).where(eq(extractionAuditLogs.postId, postId));
    assert.strictEqual(rows.length, 1, 'Expected exactly one extraction_audit_logs row');
    const row = rows[0];
    assert.strictEqual(row.actualEventCount, env.maxExtractedEventsPerPost, 'actualEventCount must be the truncated (capped) count, not the raw 15');
    assert.strictEqual(row.eventsCompleteness.length, env.maxExtractedEventsPerPost);
  });

  await t.test('Case F: audit-log insert failure (FK violation on an unknown postId) does not fail the extraction attempt', async () => {
    // No seam needed (per Task 4's own note): a postId with no matching posts row trips the
    // extraction_audit_logs.post_id FK constraint inside writeExtractionAuditLog's insert,
    // exercising the real try/catch in process-ai-job.ts without mocking anything. Every other
    // operation in processAiJob (markPostExtractedSeam, the posts.groupingReason update) is
    // either seam-controlled or tolerant of a non-matching row (a plain UPDATE affecting zero
    // rows does not throw), so this isolates the audit-log write's own failure.
    const unknownPostId = '00000000-0000-4000-8000-0000000000af';
    const payload: GeminiExtractionPayload = {
      isEvent: true,
      events: [
        {
          eventName: 'Orphan Post Event',
          types: ['PERFORMANCE'],
          categories: ['MUSIC'],
          schedules: [buildSchedule('Orphan Post Event', '2026-10-25')],
          confidenceScore: 0.9
        }
      ]
    };

    const message: ProcessingJobMessage = {
      postId: unknownPostId,
      accountId: profile.id,
      content: 'Post with no row in posts table',
      postUrl: 'https://www.instagram.com/p/audit-case-f/',
      publishedAt: '2026-08-29T10:24:17Z'
    };

    let markPostExtractedCalled = false;
    let sendSqsMessageCalled = false;

    setCallGeminiSeam(async () => ({ text: JSON.stringify(payload) }));
    setSendSqsMessage(async () => {
      sendSqsMessageCalled = true;
    });
    setMarkPostExtractedSeam(async () => {
      markPostExtractedCalled = true;
      return {} as any;
    });
    setResolveLocationSeam(async () => ({ location: undefined }) as any);

    await assert.doesNotReject(() => processAiJob(message), 'processAiJob must not throw when the audit-log insert fails');

    assert.strictEqual(markPostExtractedCalled, true, 'markPostExtracted should still be called despite the audit-log write failure');
    assert.strictEqual(sendSqsMessageCalled, true, 'the event should still enqueue despite the audit-log write failure');

    const rows = await db.select().from(extractionAuditLogs).where(eq(extractionAuditLogs.postId, unknownPostId));
    assert.strictEqual(rows.length, 0, 'No row should have been persisted, since the FK violation aborted the insert');
  });

  // ---- Story 3.21 (Task 5.3): aiImageInput/actualFaceDetectionCount wiring at all 3 insert paths ----

  function installImageFetchMock() {
    globalThis.fetch = (async () => ({
      ok: true,
      headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/jpeg' : null) },
      arrayBuffer: async () => Buffer.from('audit-log-wiring-original-bytes'),
    })) as any;
    // Never attempt a real S3 upload in these wiring tests -- only the inserted row's
    // aiImageInput/actualFaceDetectionCount columns are asserted here (Task 5.3). The test
    // profile has isImageStorageOptedIn: true (set above), so step 7.5a's rehost would also
    // otherwise run for real -- mock it too.
    setUploadFaceBlurThumbnailSeam(async () => null);
    setRehostPostImageSeam(async () => 'https://cdn.test.com/posts/audit-log-wiring-mock');
  }

  await t.test('Case G: isEvent=false path, mode off -> aiImageInput=original_mode_off, actualFaceDetectionCount null', async () => {
    process.env.BLUR_FACES_BEFORE_AI = 'false';
    installImageFetchMock();
    const postId = await insertTestPost(profile.id, 'https://www.instagram.com/p/audit-case-g/');
    const payload: GeminiExtractionPayload = { isEvent: false, events: [] };
    const message: ProcessingJobMessage = {
      postId,
      accountId: profile.id,
      content: 'Mode off, no event',
      imageUrl: 'https://test.com/audit-case-g.jpg',
      postUrl: 'https://www.instagram.com/p/audit-case-g/',
      publishedAt: '2026-08-29T10:24:17Z'
    };
    setCallGeminiSeam(async () => ({ text: JSON.stringify(payload) }));
    setSendSqsMessage(async () => {});
    setMarkPostExtractedSeam(async () => ({} as any));

    await processAiJob(message);

    const [row] = await db.select().from(extractionAuditLogs).where(eq(extractionAuditLogs.postId, postId));
    assert.strictEqual(row.aiImageInput, 'original_mode_off');
    assert.strictEqual(row.actualFaceDetectionCount, null);
  });

  await t.test('Case H: isEvent=true zero-events path, mode off -> aiImageInput=original_mode_off, actualFaceDetectionCount null', async () => {
    process.env.BLUR_FACES_BEFORE_AI = 'false';
    installImageFetchMock();
    const postId = await insertTestPost(profile.id, 'https://www.instagram.com/p/audit-case-h/');
    const payload: GeminiExtractionPayload = { isEvent: true, events: [] };
    const message: ProcessingJobMessage = {
      postId,
      accountId: profile.id,
      content: 'Mode off, zero events',
      imageUrl: 'https://test.com/audit-case-h.jpg',
      postUrl: 'https://www.instagram.com/p/audit-case-h/',
      publishedAt: '2026-08-29T10:24:17Z'
    };
    setCallGeminiSeam(async () => ({ text: JSON.stringify(payload) }));
    setSendSqsMessage(async () => {});
    setMarkPostExtractedSeam(async () => ({} as any));

    await processAiJob(message);

    const [row] = await db.select().from(extractionAuditLogs).where(eq(extractionAuditLogs.postId, postId));
    assert.strictEqual(row.aiImageInput, 'original_mode_off');
    assert.strictEqual(row.actualFaceDetectionCount, null);
  });

  await t.test('Case I: success path, mode off -> aiImageInput=original_mode_off, actualFaceDetectionCount null', async () => {
    process.env.BLUR_FACES_BEFORE_AI = 'false';
    installImageFetchMock();
    const postId = await insertTestPost(profile.id, 'https://www.instagram.com/p/audit-case-i/');
    const payload: GeminiExtractionPayload = {
      isEvent: true,
      events: [
        {
          eventName: 'Mode Off Success Event',
          types: ['PERFORMANCE'],
          categories: ['MUSIC'],
          schedules: [buildSchedule('Day 1', '2026-10-25')],
          confidenceScore: 0.9
        }
      ]
    };
    const message: ProcessingJobMessage = {
      postId,
      accountId: profile.id,
      content: 'Mode off, success',
      imageUrl: 'https://test.com/audit-case-i.jpg',
      postUrl: 'https://www.instagram.com/p/audit-case-i/',
      publishedAt: '2026-08-29T10:24:17Z'
    };
    setCallGeminiSeam(async () => ({ text: JSON.stringify(payload) }));
    setSendSqsMessage(async () => {});
    setMarkPostExtractedSeam(async () => ({} as any));
    setResolveLocationSeam(async () => ({ location: undefined }) as any);

    await processAiJob(message);

    const [row] = await db.select().from(extractionAuditLogs).where(eq(extractionAuditLogs.postId, postId));
    assert.strictEqual(row.aiImageInput, 'original_mode_off');
    assert.strictEqual(row.actualFaceDetectionCount, null);
  });

  await t.test('Case J: isEvent=false path, mode on + not opted in -> aiImageInput=blurred, actualFaceDetectionCount is the real count', async () => {
    process.env.BLUR_FACES_BEFORE_AI = 'true';
    installImageFetchMock();
    setDetectAndBlurFacesSeam(async () => ({ buffer: Buffer.from('blurred-bytes'), faceCount: 3 }));
    const postId = await insertTestPost(profile.id, 'https://www.instagram.com/p/audit-case-j/');
    const payload: GeminiExtractionPayload = { isEvent: false, events: [] };
    const message: ProcessingJobMessage = {
      postId,
      accountId: profile.id,
      content: 'Blurred, no event',
      imageUrl: 'https://test.com/audit-case-j.jpg',
      postUrl: 'https://www.instagram.com/p/audit-case-j/',
      publishedAt: '2026-08-29T10:24:17Z'
    };
    setCallGeminiSeam(async () => ({ text: JSON.stringify(payload) }));
    setSendSqsMessage(async () => {});
    setMarkPostExtractedSeam(async () => ({} as any));

    await processAiJob(message);

    const [row] = await db.select().from(extractionAuditLogs).where(eq(extractionAuditLogs.postId, postId));
    assert.strictEqual(row.aiImageInput, 'blurred');
    assert.strictEqual(row.actualFaceDetectionCount, 3);
  });

  await t.test('Case K: isEvent=true zero-events path, mode on + not opted in -> aiImageInput=blurred, actualFaceDetectionCount is the real count', async () => {
    process.env.BLUR_FACES_BEFORE_AI = 'true';
    installImageFetchMock();
    setDetectAndBlurFacesSeam(async () => ({ buffer: Buffer.from('blurred-bytes'), faceCount: 4 }));
    const postId = await insertTestPost(profile.id, 'https://www.instagram.com/p/audit-case-k/');
    const payload: GeminiExtractionPayload = { isEvent: true, events: [] };
    const message: ProcessingJobMessage = {
      postId,
      accountId: profile.id,
      content: 'Blurred, zero events',
      imageUrl: 'https://test.com/audit-case-k.jpg',
      postUrl: 'https://www.instagram.com/p/audit-case-k/',
      publishedAt: '2026-08-29T10:24:17Z'
    };
    setCallGeminiSeam(async () => ({ text: JSON.stringify(payload) }));
    setSendSqsMessage(async () => {});
    setMarkPostExtractedSeam(async () => ({} as any));

    await processAiJob(message);

    const [row] = await db.select().from(extractionAuditLogs).where(eq(extractionAuditLogs.postId, postId));
    assert.strictEqual(row.aiImageInput, 'blurred');
    assert.strictEqual(row.actualFaceDetectionCount, 4);
  });

  await t.test('Case L: success path, mode on + not opted in -> aiImageInput=blurred, actualFaceDetectionCount is the real count', async () => {
    process.env.BLUR_FACES_BEFORE_AI = 'true';
    installImageFetchMock();
    setDetectAndBlurFacesSeam(async () => ({ buffer: Buffer.from('blurred-bytes'), faceCount: 5 }));
    const postId = await insertTestPost(profile.id, 'https://www.instagram.com/p/audit-case-l/');
    const payload: GeminiExtractionPayload = {
      isEvent: true,
      events: [
        {
          eventName: 'Blurred Success Event',
          types: ['PERFORMANCE'],
          categories: ['MUSIC'],
          schedules: [buildSchedule('Day 1', '2026-10-25')],
          confidenceScore: 0.9
        }
      ]
    };
    const message: ProcessingJobMessage = {
      postId,
      accountId: profile.id,
      content: 'Blurred, success',
      imageUrl: 'https://test.com/audit-case-l.jpg',
      postUrl: 'https://www.instagram.com/p/audit-case-l/',
      publishedAt: '2026-08-29T10:24:17Z'
    };
    setCallGeminiSeam(async () => ({ text: JSON.stringify(payload) }));
    setSendSqsMessage(async () => {});
    setMarkPostExtractedSeam(async () => ({} as any));
    setResolveLocationSeam(async () => ({ location: undefined }) as any);

    await processAiJob(message);

    const [row] = await db.select().from(extractionAuditLogs).where(eq(extractionAuditLogs.postId, postId));
    assert.strictEqual(row.aiImageInput, 'blurred');
    assert.strictEqual(row.actualFaceDetectionCount, 5);
  });
  await t.test('Case M: carousel, mode on -> actualFaceDetectionCount is the sum across cover + slides, not the cover alone (AD-29 Rule 7)', async () => {
    process.env.BLUR_FACES_BEFORE_AI = 'true';
    installImageFetchMock();
    // Every image (cover + 2 slides) reports 2 faces -> total 6, cover alone 2.
    setDetectAndBlurFacesSeam(async () => ({ buffer: Buffer.from('blurred-bytes'), faceCount: 2 }));
    const postId = await insertTestPost(profile.id, 'https://www.instagram.com/p/audit-case-m/');
    const payload: GeminiExtractionPayload = {
      isEvent: true,
      events: [
        {
          eventName: 'Carousel Blurred Event',
          types: ['PERFORMANCE'],
          categories: ['MUSIC'],
          schedules: [buildSchedule('Day 1', '2026-10-25')],
          confidenceScore: 0.9
        }
      ]
    };
    const message: ProcessingJobMessage = {
      postId,
      accountId: profile.id,
      content: 'Blurred, carousel',
      imageUrl: 'https://test.com/audit-case-m.jpg',
      additionalImageUrls: ['https://test.com/audit-case-m-s1.jpg', 'https://test.com/audit-case-m-s2.jpg'],
      postUrl: 'https://www.instagram.com/p/audit-case-m/',
      publishedAt: '2026-08-29T10:24:17Z'
    };
    setCallGeminiSeam(async () => ({ text: JSON.stringify(payload) }));
    setSendSqsMessage(async () => {});
    setMarkPostExtractedSeam(async () => ({} as any));
    setResolveLocationSeam(async () => ({ location: undefined }) as any);

    await processAiJob(message);

    const [row] = await db.select().from(extractionAuditLogs).where(eq(extractionAuditLogs.postId, postId));
    assert.strictEqual(row.aiImageInput, 'blurred');
    assert.strictEqual(row.actualFaceDetectionCount, 6);
  });
});
