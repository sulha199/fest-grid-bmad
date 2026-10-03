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
import {
  setDetectAndBlurFacesSeam,
  detectAndBlurFacesSeam
} from './detect-and-blur-faces.js';
import {
  setUploadFaceBlurThumbnailSeam,
  uploadFaceBlurThumbnailSeam
} from './upload-face-blur-thumbnail.js';
import {
  setBackfillFaceDetectionAuditResultSeam,
  backfillFaceDetectionAuditResultSeam
} from './backfill-face-detection-audit-result.js';
import { type GeminiExtractionPayload } from '@festgrid/domain';
import { type ProcessingJobMessage } from '@festgrid/domain/posts';

// Story 3.6n (Task 6/AC9) — integration tests for the new step-7.5b face-blur call site in
// process-ai-job.ts. The real detection/blur/upload logic is unit-tested with real fixtures in
// detect-and-blur-faces.test.ts; this file verifies the WIRING (opt-in independence, once-per-
// post, timeout guard, failure non-propagation, and the AC9 audit backfill contract) with
// detectAndBlurFacesSeam/uploadFaceBlurThumbnailSeam mocked -- matching this file family's
// existing convention of mocking rehostPostImageSeam at this level (process-ai-job.test.ts).
process.env.DATA_INGESTION_INLINE_FALLBACK_ENABLED = 'false';

function buildSchedule(title: string, date: string) {
  return { isMainSchedule: false, eventStartDate: date, title };
}

test('processAiJob face-blur thumbnail stage (Story 3.6n)', async (t) => {
  const originalEnvQueueUrl = process.env.DATA_INGESTION_QUEUE_URL;
  const originalCallGeminiSeam = callGeminiSeam;
  const originalMarkPostExtractedSeam = markPostExtractedSeam;
  const originalRehostPostImageSeam = rehostPostImageSeam;
  const originalBackfillAccountProfileAndInferDefaultLocationSeam = backfillAccountProfileAndInferDefaultLocationSeam;
  const originalResolveLocationSeam = resolveLocationSeam;
  const originalSendSqsMessage = sendSqsMessage;
  const originalDetectAndBlurFacesSeam = detectAndBlurFacesSeam;
  const originalUploadFaceBlurThumbnailSeam = uploadFaceBlurThumbnailSeam;
  const originalBackfillFaceDetectionAuditResultSeam = backfillFaceDetectionAuditResultSeam;

  const seededUsers = await db.select().from(users).limit(1);
  assert.ok(seededUsers.length > 0, 'Must have at least one seeded user');
  const user = seededUsers[0];

  const [optedInProfile] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: 'platform-acc-face-blur-optin-' + Date.now(),
      platform: 'instagram',
      displayName: 'Face Blur Opted-In Account',
      username: 'face_blur_optin_' + Date.now(),
      isImageStorageOptedIn: true
    })
    .returning();

  const [notOptedInProfile] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: 'platform-acc-face-blur-noopt-' + Date.now(),
      platform: 'instagram',
      displayName: 'Face Blur Non-Opted-In Account',
      username: 'face_blur_noopt_' + Date.now(),
      isImageStorageOptedIn: false
    })
    .returning();

  for (const profile of [optedInProfile, notOptedInProfile]) {
    await db.insert(subscriptions).values({ userId: user.id, accountId: profile.id, isNewlyAdded: true });
  }

  const restoreSeams = () => {
    setCallGeminiSeam(originalCallGeminiSeam);
    setMarkPostExtractedSeam(originalMarkPostExtractedSeam);
    setRehostPostImageSeam(originalRehostPostImageSeam);
    setBackfillAccountProfileAndInferDefaultLocationSeam(originalBackfillAccountProfileAndInferDefaultLocationSeam);
    setResolveLocationSeam(originalResolveLocationSeam);
    setSendSqsMessage(originalSendSqsMessage);
    setDetectAndBlurFacesSeam(originalDetectAndBlurFacesSeam);
    setUploadFaceBlurThumbnailSeam(originalUploadFaceBlurThumbnailSeam);
    setBackfillFaceDetectionAuditResultSeam(originalBackfillFaceDetectionAuditResultSeam);
  };

  t.after(async () => {
    for (const profile of [optedInProfile, notOptedInProfile]) {
      await db.delete(posts).where(eq(posts.accountId, profile.id));
      await db.delete(subscriptions).where(eq(subscriptions.accountId, profile.id));
      await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
    }
    process.env.DATA_INGESTION_QUEUE_URL = originalEnvQueueUrl;
    restoreSeams();
  });

  t.beforeEach(() => {
    process.env.DATA_INGESTION_QUEUE_URL = 'https://sqs.mock-face-blur-url';
    setBackfillAccountProfileAndInferDefaultLocationSeam(async () => {});
    setSendSqsMessage(async () => {});
    setMarkPostExtractedSeam(async () => ({}) as any);
    setResolveLocationSeam(async () => ({ location: undefined }) as any);
  });

  t.afterEach(() => {
    restoreSeams();
  });

  async function insertTestPost(accountId: string, postUrl: string): Promise<string> {
    const [row] = await db
      .insert(posts)
      .values({
        accountId,
        platform: 'instagram',
        postUrl,
        publishedAt: new Date('2026-10-03T10:00:00Z'),
      })
      .returning();
    return row.id;
  }

  function mockImageFetch(t2: { after: (fn: () => void) => void }) {
    const originalFetch = globalThis.fetch;
    t2.after(() => {
      globalThis.fetch = originalFetch;
    });
    globalThis.fetch = (async () => ({
      ok: true,
      headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/jpeg' : null) },
      arrayBuffer: async () => Buffer.from('mock-face-blur-image-bytes'),
    })) as any;
  }

  function singleEventPayload(hasFaceImage: boolean | undefined): GeminiExtractionPayload {
    return {
      isEvent: true,
      hasFaceImage,
      events: [
        {
          eventName: 'Face Blur Test Event',
          types: ['PERFORMANCE'],
          categories: ['MUSIC'],
          schedules: [buildSchedule('Day 1', '2026-11-01')],
          confidenceScore: 0.9
        }
      ]
    };
  }

  await t.test('Case A: hasFaceImage=true populates durableThumbnailUrl, opted-in account', async () => {
    mockImageFetch(t);
    const postId = await insertTestPost(optedInProfile.id, 'https://www.instagram.com/p/face-blur-a/');
    setCallGeminiSeam(async () => ({ text: JSON.stringify(singleEventPayload(true)) }));
    setRehostPostImageSeam(async () => 'https://cdn.test.com/posts/full-mock');
    setDetectAndBlurFacesSeam(async () => ({ buffer: Buffer.from('blurred-bytes'), faceCount: 2 }));
    let uploadCalledWith: any = null;
    setUploadFaceBlurThumbnailSeam(async (pid, buf) => {
      uploadCalledWith = { pid, buf };
      await db.update(posts).set({ durableThumbnailUrl: 'https://cdn.test.com/posts/thumb-mock' }).where(eq(posts.id, pid));
      return 'https://cdn.test.com/posts/thumb-mock';
    });

    const message: ProcessingJobMessage = {
      postId,
      accountId: optedInProfile.id,
      content: 'Face blur test',
      imageUrl: 'https://test.com/img.jpg',
      postUrl: 'https://www.instagram.com/p/face-blur-a/',
      publishedAt: '2026-10-03T10:00:00Z'
    };

    await processAiJob(message);

    assert.ok(uploadCalledWith, 'expected uploadFaceBlurThumbnailSeam to be called');
    assert.strictEqual(uploadCalledWith.pid, postId);
    assert.deepEqual(uploadCalledWith.buf, Buffer.from('blurred-bytes'));

    const [row] = await db.select().from(posts).where(eq(posts.id, postId));
    assert.strictEqual(row.durableThumbnailUrl, 'https://cdn.test.com/posts/thumb-mock');
  });

  await t.test('Case A2: hasFaceImage=true populates durableThumbnailUrl even when NOT opted into image storage', async () => {
    mockImageFetch(t);
    const postId = await insertTestPost(notOptedInProfile.id, 'https://www.instagram.com/p/face-blur-a2/');
    setCallGeminiSeam(async () => ({ text: JSON.stringify(singleEventPayload(true)) }));
    let rehostCalled = false;
    setRehostPostImageSeam(async () => {
      rehostCalled = true;
      return 'https://cdn.test.com/posts/full-mock';
    });
    setDetectAndBlurFacesSeam(async () => ({ buffer: Buffer.from('blurred-bytes'), faceCount: 1 }));
    setUploadFaceBlurThumbnailSeam(async (pid) => {
      await db.update(posts).set({ durableThumbnailUrl: 'https://cdn.test.com/posts/thumb-mock-2' }).where(eq(posts.id, pid));
      return 'https://cdn.test.com/posts/thumb-mock-2';
    });

    const message: ProcessingJobMessage = {
      postId,
      accountId: notOptedInProfile.id,
      content: 'Face blur test, non-opted-in',
      imageUrl: 'https://test.com/img.jpg',
      postUrl: 'https://www.instagram.com/p/face-blur-a2/',
      publishedAt: '2026-10-03T10:00:00Z'
    };

    await processAiJob(message);

    assert.strictEqual(rehostCalled, false, 'rehostPostImageSeam must stay opted-in-gated, unaffected by this story');
    const [row] = await db.select().from(posts).where(eq(posts.id, postId));
    assert.strictEqual(
      row.durableThumbnailUrl,
      'https://cdn.test.com/posts/thumb-mock-2',
      'durableThumbnailUrl must populate independent of isImageStorageOptedIn'
    );
  });

  await t.test('Case B: hasFaceImage=false skips detection entirely (no S3 call), durableThumbnailUrl stays null', async () => {
    mockImageFetch(t);
    const postId = await insertTestPost(optedInProfile.id, 'https://www.instagram.com/p/face-blur-b/');
    setCallGeminiSeam(async () => ({ text: JSON.stringify(singleEventPayload(false)) }));
    setRehostPostImageSeam(async () => 'https://cdn.test.com/posts/full-mock');
    let detectCalled = false;
    let uploadCalled = false;
    setDetectAndBlurFacesSeam(async () => {
      detectCalled = true;
      return { buffer: Buffer.from(''), faceCount: 0 };
    });
    setUploadFaceBlurThumbnailSeam(async () => {
      uploadCalled = true;
      return null;
    });

    const message: ProcessingJobMessage = {
      postId,
      accountId: optedInProfile.id,
      content: 'No face reported',
      imageUrl: 'https://test.com/img.jpg',
      postUrl: 'https://www.instagram.com/p/face-blur-b/',
      publishedAt: '2026-10-03T10:00:00Z'
    };

    await processAiJob(message);

    assert.strictEqual(detectCalled, false, 'detectAndBlurFacesSeam must not be called when hasFaceImage is false');
    assert.strictEqual(uploadCalled, false, 'uploadFaceBlurThumbnailSeam must not be called when hasFaceImage is false');
    const [row] = await db.select().from(posts).where(eq(posts.id, postId));
    assert.strictEqual(row.durableThumbnailUrl, null);
  });

  await t.test('Case C: multi-event post produces exactly one thumbnail, not one per event', async () => {
    mockImageFetch(t);
    const postId = await insertTestPost(optedInProfile.id, 'https://www.instagram.com/p/face-blur-c/');
    const payload: GeminiExtractionPayload = {
      isEvent: true,
      hasFaceImage: true,
      events: [
        {
          eventName: 'Multi Event One',
          types: ['PERFORMANCE'],
          categories: ['MUSIC'],
          schedules: [buildSchedule('Day 1', '2026-11-01')],
          confidenceScore: 0.9
        },
        {
          eventName: 'Multi Event Two',
          types: ['PERFORMANCE'],
          categories: ['MUSIC'],
          schedules: [buildSchedule('Day 1', '2026-11-02')],
          confidenceScore: 0.85
        }
      ]
    };
    setCallGeminiSeam(async () => ({ text: JSON.stringify(payload) }));
    setRehostPostImageSeam(async () => 'https://cdn.test.com/posts/full-mock');
    let detectCallCount = 0;
    setDetectAndBlurFacesSeam(async () => {
      detectCallCount += 1;
      return { buffer: Buffer.from('blurred-bytes'), faceCount: 1 };
    });
    let uploadCallCount = 0;
    setUploadFaceBlurThumbnailSeam(async (pid) => {
      uploadCallCount += 1;
      await db.update(posts).set({ durableThumbnailUrl: 'https://cdn.test.com/posts/thumb-mock-c' }).where(eq(posts.id, pid));
      return 'https://cdn.test.com/posts/thumb-mock-c';
    });

    const message: ProcessingJobMessage = {
      postId,
      accountId: optedInProfile.id,
      content: 'Multi-event post',
      imageUrl: 'https://test.com/img.jpg',
      postUrl: 'https://www.instagram.com/p/face-blur-c/',
      publishedAt: '2026-10-03T10:00:00Z'
    };

    await processAiJob(message);

    assert.strictEqual(detectCallCount, 1, 'expected detection to run exactly once per POST, not per event');
    assert.strictEqual(uploadCallCount, 1, 'expected exactly one thumbnail upload per post, not one per event');
  });

  await t.test('Case D: timeout guard skips the stage when remaining time is below the floor', async () => {
    mockImageFetch(t);
    const postId = await insertTestPost(optedInProfile.id, 'https://www.instagram.com/p/face-blur-d/');
    setCallGeminiSeam(async () => ({ text: JSON.stringify(singleEventPayload(true)) }));
    setRehostPostImageSeam(async () => 'https://cdn.test.com/posts/full-mock');
    let detectCalled = false;
    setDetectAndBlurFacesSeam(async () => {
      detectCalled = true;
      return { buffer: Buffer.from('blurred-bytes'), faceCount: 1 };
    });

    const message: ProcessingJobMessage = {
      postId,
      accountId: optedInProfile.id,
      content: 'Timeout guard test',
      imageUrl: 'https://test.com/img.jpg',
      postUrl: 'https://www.instagram.com/p/face-blur-d/',
      publishedAt: '2026-10-03T10:00:00Z'
    };

    // Default FACE_BLUR_MIN_REMAINING_TIME_MS is 60000 -- 100ms remaining is well below it.
    await processAiJob(message, { getRemainingTimeInMillis: () => 100 });

    assert.strictEqual(detectCalled, false, 'expected detection to be skipped when remaining time is below the floor');
    const [row] = await db.select().from(posts).where(eq(posts.id, postId));
    assert.strictEqual(row.durableThumbnailUrl, null);
  });

  await t.test('Case E: a thrown detection error is caught; processAiJob still completes', async () => {
    mockImageFetch(t);
    const postId = await insertTestPost(optedInProfile.id, 'https://www.instagram.com/p/face-blur-e/');
    setCallGeminiSeam(async () => ({ text: JSON.stringify(singleEventPayload(true)) }));
    setRehostPostImageSeam(async () => 'https://cdn.test.com/posts/full-mock');
    setDetectAndBlurFacesSeam(async () => {
      throw new Error('simulated detection failure');
    });
    let markExtractedCalled = false;
    setMarkPostExtractedSeam(async (pid: string) => {
      markExtractedCalled = true;
      return {} as any;
    });

    const message: ProcessingJobMessage = {
      postId,
      accountId: optedInProfile.id,
      content: 'Detection throws',
      imageUrl: 'https://test.com/img.jpg',
      postUrl: 'https://www.instagram.com/p/face-blur-e/',
      publishedAt: '2026-10-03T10:00:00Z'
    };

    await assert.doesNotReject(() => processAiJob(message));
    assert.strictEqual(markExtractedCalled, true, 'expected processAiJob to still complete (markPostExtracted called)');
    const [row] = await db.select().from(posts).where(eq(posts.id, postId));
    assert.strictEqual(row.durableThumbnailUrl, null);
  });

  await t.test('Case F (AC9): hasFaceImage=false backfills no_face_reported/null', async () => {
    mockImageFetch(t);
    const postId = await insertTestPost(optedInProfile.id, 'https://www.instagram.com/p/face-blur-f/');
    setCallGeminiSeam(async () => ({ text: JSON.stringify(singleEventPayload(false)) }));
    setRehostPostImageSeam(async () => 'https://cdn.test.com/posts/full-mock');

    const message: ProcessingJobMessage = {
      postId,
      accountId: optedInProfile.id,
      content: 'AC9 Case F',
      imageUrl: 'https://test.com/img.jpg',
      postUrl: 'https://www.instagram.com/p/face-blur-f/',
      publishedAt: '2026-10-03T10:00:00Z'
    };

    await processAiJob(message);

    const [row] = await db.select().from(extractionAuditLogs).where(eq(extractionAuditLogs.postId, postId));
    assert.strictEqual(row.faceDetectionSkippedReason, 'no_face_reported');
    assert.strictEqual(row.actualFaceDetectionCount, null);
  });

  await t.test('Case G (AC9): hasFaceImage=true and detection succeeds backfills the real count, reason=null', async () => {
    mockImageFetch(t);
    const postId = await insertTestPost(optedInProfile.id, 'https://www.instagram.com/p/face-blur-g/');
    setCallGeminiSeam(async () => ({ text: JSON.stringify(singleEventPayload(true)) }));
    setRehostPostImageSeam(async () => 'https://cdn.test.com/posts/full-mock');
    setDetectAndBlurFacesSeam(async () => ({ buffer: Buffer.from('blurred-bytes'), faceCount: 3 }));
    setUploadFaceBlurThumbnailSeam(async () => 'https://cdn.test.com/posts/thumb-mock-g');

    const message: ProcessingJobMessage = {
      postId,
      accountId: optedInProfile.id,
      content: 'AC9 Case G',
      imageUrl: 'https://test.com/img.jpg',
      postUrl: 'https://www.instagram.com/p/face-blur-g/',
      publishedAt: '2026-10-03T10:00:00Z'
    };

    await processAiJob(message);

    const [row] = await db.select().from(extractionAuditLogs).where(eq(extractionAuditLogs.postId, postId));
    assert.strictEqual(row.actualFaceDetectionCount, 3);
    assert.strictEqual(row.faceDetectionSkippedReason, null);
  });

  await t.test('Case H (AC9): timeout-guard skip leaves both audit columns null/null (documented gap)', async () => {
    mockImageFetch(t);
    const postId = await insertTestPost(optedInProfile.id, 'https://www.instagram.com/p/face-blur-h/');
    setCallGeminiSeam(async () => ({ text: JSON.stringify(singleEventPayload(true)) }));
    setRehostPostImageSeam(async () => 'https://cdn.test.com/posts/full-mock');

    const message: ProcessingJobMessage = {
      postId,
      accountId: optedInProfile.id,
      content: 'AC9 Case H',
      imageUrl: 'https://test.com/img.jpg',
      postUrl: 'https://www.instagram.com/p/face-blur-h/',
      publishedAt: '2026-10-03T10:00:00Z'
    };

    await processAiJob(message, { getRemainingTimeInMillis: () => 100 });

    const [row] = await db.select().from(extractionAuditLogs).where(eq(extractionAuditLogs.postId, postId));
    assert.strictEqual(row.actualFaceDetectionCount, null);
    assert.strictEqual(row.faceDetectionSkippedReason, null);
  });

  await t.test('Case I (AC9): a thrown error INSIDE detection itself leaves both audit columns null/null (documented gap)', async () => {
    mockImageFetch(t);
    const postId = await insertTestPost(optedInProfile.id, 'https://www.instagram.com/p/face-blur-i/');
    setCallGeminiSeam(async () => ({ text: JSON.stringify(singleEventPayload(true)) }));
    setRehostPostImageSeam(async () => 'https://cdn.test.com/posts/full-mock');
    setDetectAndBlurFacesSeam(async () => {
      throw new Error('simulated detection failure');
    });

    const message: ProcessingJobMessage = {
      postId,
      accountId: optedInProfile.id,
      content: 'AC9 Case I',
      imageUrl: 'https://test.com/img.jpg',
      postUrl: 'https://www.instagram.com/p/face-blur-i/',
      publishedAt: '2026-10-03T10:00:00Z'
    };

    await processAiJob(message);

    const [row] = await db.select().from(extractionAuditLogs).where(eq(extractionAuditLogs.postId, postId));
    assert.strictEqual(row.actualFaceDetectionCount, null);
    assert.strictEqual(row.faceDetectionSkippedReason, null);
  });

  await t.test(
    'Case J (AC9, design decision -- see Dev Notes): a thrown error in the LATER upload step (after detection already succeeded) still backfills the real detected count',
    async () => {
      mockImageFetch(t);
      const postId = await insertTestPost(optedInProfile.id, 'https://www.instagram.com/p/face-blur-j/');
      setCallGeminiSeam(async () => ({ text: JSON.stringify(singleEventPayload(true)) }));
      setRehostPostImageSeam(async () => 'https://cdn.test.com/posts/full-mock');
      setDetectAndBlurFacesSeam(async () => ({ buffer: Buffer.from('blurred-bytes'), faceCount: 4 }));
      // uploadFaceBlurThumbnailSeam is itself best-effort in production (never throws, per
      // Task 3) -- but this test proves the CALL SITE's own design holds even if a seam
      // override throws (e.g. a test double or a future refactor), matching AC9's exact
      // wording: "even if a later resize/upload step then fails."
      setUploadFaceBlurThumbnailSeam(async () => {
        throw new Error('simulated upload failure');
      });

      const message: ProcessingJobMessage = {
        postId,
        accountId: optedInProfile.id,
        content: 'AC9 Case J',
        imageUrl: 'https://test.com/img.jpg',
        postUrl: 'https://www.instagram.com/p/face-blur-j/',
        publishedAt: '2026-10-03T10:00:00Z'
      };

      // AC6: even an (in production, impossible) thrown upload error must be caught -- the
      // call site wraps uploadFaceBlurThumbnailSeam in its own try/catch as defense-in-depth.
      await assert.doesNotReject(() => processAiJob(message));

      const [row] = await db.select().from(extractionAuditLogs).where(eq(extractionAuditLogs.postId, postId));
      assert.strictEqual(row.actualFaceDetectionCount, 4, 'AC9: the real count must be backfilled even though the later upload step threw');
      assert.strictEqual(row.faceDetectionSkippedReason, null);
      const [postRow] = await db.select().from(posts).where(eq(posts.id, postId));
      assert.strictEqual(postRow.durableThumbnailUrl, null, 'durableThumbnailUrl stays null when the upload step fails');
    }
  );
});
