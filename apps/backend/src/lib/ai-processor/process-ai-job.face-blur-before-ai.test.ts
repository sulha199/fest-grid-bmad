import test from 'node:test';
import * as assert from 'node:assert';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, subscriptions, users, posts, postAccountAssociations } from '@festgrid/database';
import { eq, inArray } from 'drizzle-orm';
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
import { extractionAuditLogs } from '@festgrid/database';

// Story 3.20 (Task 5.2, Task 7.4) -- end-to-end wiring tests for the NEW pre-AI blur gate (step 2
// of processAiJob, inside buildGeminiExtractionRequest), distinct from process-ai-job.face-blur.test.ts
// (Story 3.6n's POST-extraction thumbnail stage, step 7.5b). This file verifies: the setting-on/
// opted-in-unchanged path never calls detectAndBlurFacesSeam (AC4, Task 5.2); the setting-on/
// not-opted-in path DOES call it and sends the blurred bytes to Gemini (AC1); and that
// resolvePostPublisherOptIn's PUBLISHER-only semantics are honored end-to-end (a co-author's own
// opt-in is ignored, an unverified PUBLISHER_UNKNOWN publisher is still blurred -- Task 7.4).
process.env.DATA_INGESTION_INLINE_FALLBACK_ENABLED = 'false';
// Opt THIS file in explicitly (Task 6.2) -- the opposite pin from process-ai-job.test.ts/
// process-ai-job.face-blur.test.ts, since this file's whole point is exercising the gate being on.
process.env.BLUR_FACES_BEFORE_AI = 'true';

function buildSchedule(title: string, date: string) {
  return { isMainSchedule: false, eventStartDate: date, title };
}

function singleEventPayload(): GeminiExtractionPayload {
  return {
    isEvent: true,
    hasFaceImage: false,
    events: [
      {
        eventName: 'Pre-AI Blur Test Event',
        types: ['PERFORMANCE'],
        categories: ['MUSIC'],
        schedules: [buildSchedule('Day 1', '2026-11-01')],
        confidenceScore: 0.9
      }
    ]
  };
}

test('processAiJob pre-AI face-blur gate (Story 3.20)', async (t) => {
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
  const originalFetch = globalThis.fetch;

  const seededUsers = await db.select().from(users).limit(1);
  assert.ok(seededUsers.length > 0, 'Must have at least one seeded user');
  const user = seededUsers[0];

  const profileIds: string[] = [];
  const postIds: string[] = [];

  async function makeProfile(isImageStorageOptedIn: boolean) {
    const suffix = Date.now() + '-' + Math.random().toString(36).slice(2);
    const [profile] = await db
      .insert(socialMediaAccountProfiles)
      .values({
        accountId: 'platform-acc-preai-blur-' + suffix,
        platform: 'instagram',
        displayName: 'Pre-AI Blur Test Account',
        username: 'preai_blur_' + suffix,
        isImageStorageOptedIn
      })
      .returning();
    profileIds.push(profile.id);
    await db.insert(subscriptions).values({ userId: user.id, accountId: profile.id, isNewlyAdded: true });
    return profile;
  }

  async function insertTestPost(accountId: string, imageUrlExpiresAt?: Date | null): Promise<string> {
    const suffix = Date.now() + '-' + Math.random().toString(36).slice(2);
    const [row] = await db
      .insert(posts)
      .values({
        accountId,
        platform: 'instagram',
        postUrl: 'https://www.instagram.com/p/preai-blur-' + suffix + '/',
        publishedAt: new Date('2026-10-03T10:00:00Z'),
        imageUrlExpiresAt: imageUrlExpiresAt ?? null,
      })
      .returning();
    postIds.push(row.id);
    return row.id;
  }

  // Story 3.21 (Task 7) — builds a schedule with an explicit end date/time, mirroring
  // process-ai-job.face-blur.test.ts's own identical helper, needed to exercise the relevance
  // gate (Story 3.6o) now reused inside this story's 'blurred' thumbnail-stage branch.
  function buildScheduleWithEnd(title: string, startDate: string, endDate?: string, endTime?: string) {
    return { isMainSchedule: false, eventStartDate: startDate, eventEndDate: endDate, eventEndTime: endTime, title };
  }

  async function associate(postId: string, accountId: string, role: 'PUBLISHER' | 'COAUTHOR' | 'PUBLISHER_UNKNOWN') {
    await db.insert(postAccountAssociations).values({ postId, accountId, role });
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
    globalThis.fetch = originalFetch;
  };

  t.after(async () => {
    if (postIds.length > 0) {
      await db.delete(postAccountAssociations).where(inArray(postAccountAssociations.postId, postIds));
      await db.delete(posts).where(inArray(posts.id, postIds));
    }
    if (profileIds.length > 0) {
      await db.delete(subscriptions).where(inArray(subscriptions.accountId, profileIds));
      await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, profileIds));
    }
    process.env.DATA_INGESTION_QUEUE_URL = originalEnvQueueUrl;
    restoreSeams();
  });

  t.beforeEach(() => {
    process.env.DATA_INGESTION_QUEUE_URL = 'https://sqs.mock-preai-blur-url';
    setBackfillAccountProfileAndInferDefaultLocationSeam(async () => {});
    setSendSqsMessage(async () => {});
    setMarkPostExtractedSeam(async () => ({}) as any);
    setResolveLocationSeam(async () => ({ location: undefined }) as any);
    setRehostPostImageSeam(async () => 'https://cdn.test.com/posts/full-mock');
    setUploadFaceBlurThumbnailSeam(async () => null);
    setBackfillFaceDetectionAuditResultSeam(async () => {});
    globalThis.fetch = (async () => ({
      ok: true,
      headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/jpeg' : null) },
      arrayBuffer: async () => Buffer.from('preai-blur-original-bytes'),
    })) as any;
  });

  t.afterEach(() => {
    restoreSeams();
  });

  await t.test('PUBLISHER opted in -> detectAndBlurFacesSeam never called, Gemini receives the ORIGINAL bytes (AC4, Task 5.2)', async () => {
    const publisher = await makeProfile(true);
    const postId = await insertTestPost(publisher.id);
    await associate(postId, publisher.id, 'PUBLISHER');

    let detectCalled = false;
    setDetectAndBlurFacesSeam(async () => {
      detectCalled = true;
      return { buffer: Buffer.from('should-never-be-used'), faceCount: 9 };
    });
    let sentInlineData: string | undefined;
    setCallGeminiSeam(async (req: any) => {
      sentInlineData = req.contents?.[1]?.inlineData?.data;
      return { text: JSON.stringify(singleEventPayload()) };
    });

    const message: ProcessingJobMessage = {
      postId,
      accountId: publisher.id,
      content: 'Opted-in publisher post',
      imageUrl: 'https://test.com/img.jpg',
      postUrl: 'https://www.instagram.com/p/preai-blur-optedin/',
      publishedAt: '2026-10-03T10:00:00Z'
    };

    await processAiJob(message);

    assert.strictEqual(detectCalled, false);
    assert.strictEqual(sentInlineData, Buffer.from('preai-blur-original-bytes').toString('base64'));
  });

  await t.test('PUBLISHER not opted in -> detectAndBlurFacesSeam called, Gemini receives the BLURRED bytes (AC1)', async () => {
    const publisher = await makeProfile(false);
    const postId = await insertTestPost(publisher.id);
    await associate(postId, publisher.id, 'PUBLISHER');

    let detectCalled = false;
    setDetectAndBlurFacesSeam(async () => {
      detectCalled = true;
      return { buffer: Buffer.from('preai-blurred-bytes'), faceCount: 1 };
    });
    let sentInlineData: string | undefined;
    setCallGeminiSeam(async (req: any) => {
      sentInlineData = req.contents?.[1]?.inlineData?.data;
      return { text: JSON.stringify(singleEventPayload()) };
    });

    const message: ProcessingJobMessage = {
      postId,
      accountId: publisher.id,
      content: 'Non-opted-in publisher post',
      imageUrl: 'https://test.com/img.jpg',
      postUrl: 'https://www.instagram.com/p/preai-blur-notoptedin/',
      publishedAt: '2026-10-03T10:00:00Z'
    };

    await processAiJob(message);

    assert.strictEqual(detectCalled, true);
    assert.strictEqual(sentInlineData, Buffer.from('preai-blurred-bytes').toString('base64'));
  });

  await t.test('opted-in COAUTHOR, no PUBLISHER row -> still blurred (co-author opt-in ignored, Task 7.4)', async () => {
    const scraper = await makeProfile(false);
    const coauthor = await makeProfile(true);
    const postId = await insertTestPost(scraper.id);
    await associate(postId, coauthor.id, 'COAUTHOR');

    let detectCalled = false;
    setDetectAndBlurFacesSeam(async () => {
      detectCalled = true;
      return { buffer: Buffer.from('preai-blurred-bytes'), faceCount: 1 };
    });
    setCallGeminiSeam(async () => ({ text: JSON.stringify(singleEventPayload()) }));

    const message: ProcessingJobMessage = {
      postId,
      accountId: scraper.id,
      content: 'Co-author opted-in, no publisher row',
      imageUrl: 'https://test.com/img.jpg',
      postUrl: 'https://www.instagram.com/p/preai-blur-coauthor/',
      publishedAt: '2026-10-03T10:00:00Z'
    };

    await processAiJob(message);

    assert.strictEqual(detectCalled, true, "a co-author's opt-in must never unblur the post -- only the PUBLISHER's does");
  });

  await t.test('PUBLISHER_UNKNOWN role (even if opted in) -> still blurred (unverified publisher, Task 7.4)', async () => {
    const unknownPublisher = await makeProfile(true);
    const postId = await insertTestPost(unknownPublisher.id);
    await associate(postId, unknownPublisher.id, 'PUBLISHER_UNKNOWN');

    let detectCalled = false;
    setDetectAndBlurFacesSeam(async () => {
      detectCalled = true;
      return { buffer: Buffer.from('preai-blurred-bytes'), faceCount: 1 };
    });
    setCallGeminiSeam(async () => ({ text: JSON.stringify(singleEventPayload()) }));

    const message: ProcessingJobMessage = {
      postId,
      accountId: unknownPublisher.id,
      content: 'Unverified publisher',
      imageUrl: 'https://test.com/img.jpg',
      postUrl: 'https://www.instagram.com/p/preai-blur-unknown/',
      publishedAt: '2026-10-03T10:00:00Z'
    };

    await processAiJob(message);

    assert.strictEqual(detectCalled, true, 'an unverified (PUBLISHER_UNKNOWN) publisher must count as NOT opted in -- still blurred');
  });

  await t.test('setting off (env.blurFacesBeforeAi=false) -> detectAndBlurFacesSeam never called regardless of opt-in state', async () => {
    const originalBlurSetting = process.env.BLUR_FACES_BEFORE_AI;
    process.env.BLUR_FACES_BEFORE_AI = 'false';
    try {
      const publisher = await makeProfile(false);
      const postId = await insertTestPost(publisher.id);
      await associate(postId, publisher.id, 'PUBLISHER');

      let detectCalled = false;
      setDetectAndBlurFacesSeam(async () => {
        detectCalled = true;
        return { buffer: Buffer.from('should-never-be-used'), faceCount: 9 };
      });
      setCallGeminiSeam(async () => ({ text: JSON.stringify(singleEventPayload()) }));

      const message: ProcessingJobMessage = {
        postId,
        accountId: publisher.id,
        content: 'Setting off, non-opted-in publisher',
        imageUrl: 'https://test.com/img.jpg',
        postUrl: 'https://www.instagram.com/p/preai-blur-settingoff/',
        publishedAt: '2026-10-03T10:00:00Z'
      };

      await processAiJob(message);

      assert.strictEqual(detectCalled, false);
    } finally {
      if (originalBlurSetting === undefined) delete process.env.BLUR_FACES_BEFORE_AI;
      else process.env.BLUR_FACES_BEFORE_AI = originalBlurSetting;
    }
  });

  // ---- Story 3.21 (Task 7, AC1/AC2): step 7.5b's restructured thumbnail-stage branches ----

  await t.test('Thumbnail reuse (AC1): aiImageInput=blurred -> detectAndBlurFacesSeam called exactly once (inside the builder), never again from processAiJob itself', async () => {
    const publisher = await makeProfile(false);
    const postId = await insertTestPost(publisher.id);
    await associate(postId, publisher.id, 'PUBLISHER');

    let detectCallCount = 0;
    setDetectAndBlurFacesSeam(async () => {
      detectCallCount++;
      return { buffer: Buffer.from('preai-blurred-bytes'), faceCount: 2 };
    });
    let uploadCalledWith: Buffer | undefined;
    setUploadFaceBlurThumbnailSeam(async (_postId: string, buf: Buffer) => {
      uploadCalledWith = buf;
      return 'https://cdn.test.com/posts/thumb-mock.jpg';
    });
    let backfillArgs: { actualFaceDetectionCount: number | null; faceDetectionSkippedReason: string | null } | undefined;
    setBackfillFaceDetectionAuditResultSeam(async (_id, args) => {
      backfillArgs = args as any;
    });
    setCallGeminiSeam(async () => ({ text: JSON.stringify(singleEventPayload()) }));

    const message: ProcessingJobMessage = {
      postId,
      accountId: publisher.id,
      content: 'Thumbnail reuse test',
      imageUrl: 'https://test.com/img.jpg',
      postUrl: 'https://www.instagram.com/p/preai-blur-reuse/',
      publishedAt: '2026-10-03T10:00:00Z'
    };

    await processAiJob(message);

    // Called exactly once -- inside buildGeminiExtractionRequest (step 2), never a second time
    // from processAiJob's own step 7.5b (that is this story's whole point, AC1).
    assert.strictEqual(detectCallCount, 1);
    // The REUSED (already-blurred) cover bytes are what gets uploaded, not a fresh detection.
    assert.deepStrictEqual(uploadCalledWith, Buffer.from('preai-blurred-bytes'));
    assert.deepStrictEqual(backfillArgs, { actualFaceDetectionCount: 2, faceDetectionSkippedReason: null });
  });

  await t.test('Relevance gate with the setting on (AC2): not relevant -> uploadFaceBlurThumbnailSeam never called, backfill still real count with faceDetectionSkippedReason null', async () => {
    const publisher = await makeProfile(false);
    // imageUrlExpiresAt before the event's own schedule end -> NOT relevant (image already expired
    // by the time the event ends is "relevant"; here the image expires AFTER a short-lived event
    // ends, i.e. the schedule end is BEFORE imageUrlExpiresAt -> isStillRelevant === false).
    const postId = await insertTestPost(publisher.id, new Date('2026-12-01T00:00:00Z'));
    await associate(postId, publisher.id, 'PUBLISHER');

    let detectCallCount = 0;
    setDetectAndBlurFacesSeam(async () => {
      detectCallCount++;
      return { buffer: Buffer.from('preai-blurred-bytes'), faceCount: 3 };
    });
    let uploadCalled = false;
    setUploadFaceBlurThumbnailSeam(async () => {
      uploadCalled = true;
      return null;
    });
    let backfillArgs: { actualFaceDetectionCount: number | null; faceDetectionSkippedReason: string | null } | undefined;
    setBackfillFaceDetectionAuditResultSeam(async (_id, args) => {
      backfillArgs = args as any;
    });

    const payload: GeminiExtractionPayload = {
      isEvent: true,
      hasFaceImage: false,
      events: [
        {
          eventName: 'Short-Lived Event',
          types: ['PERFORMANCE'],
          categories: ['MUSIC'],
          schedules: [buildScheduleWithEnd('Day 1', '2026-11-01', '2026-11-01', '10:00:00')],
          confidenceScore: 0.9
        }
      ]
    };
    setCallGeminiSeam(async () => ({ text: JSON.stringify(payload) }));

    const message: ProcessingJobMessage = {
      postId,
      accountId: publisher.id,
      content: 'Relevance gate, setting on',
      imageUrl: 'https://test.com/img.jpg',
      postUrl: 'https://www.instagram.com/p/preai-blur-gate/',
      publishedAt: '2026-10-03T10:00:00Z'
    };

    await processAiJob(message);

    // Detection already ran once, pre-AI (inside the builder) -- never again here, and the
    // resize/upload/storage step is the ONLY thing skipped by the gate (AC2).
    assert.strictEqual(detectCallCount, 1);
    assert.strictEqual(uploadCalled, false, 'uploadFaceBlurThumbnailSeam must not be called when not relevant');
    // AC2: faceDetectionSkippedReason is NEVER 'event_relevance_gate' for the blurred branch --
    // the face count is already known either way.
    assert.deepStrictEqual(backfillArgs, { actualFaceDetectionCount: 3, faceDetectionSkippedReason: null });
  });

  await t.test('Cover-failure-no-retry (AC3): aiImageInput=text_only_fail_closed -> detectAndBlurFacesSeam/uploadFaceBlurThumbnailSeam/backfill never called, durableThumbnailUrl stays null', async () => {
    const publisher = await makeProfile(false);
    const postId = await insertTestPost(publisher.id);
    await associate(postId, publisher.id, 'PUBLISHER');

    let detectCallCount = 0;
    setDetectAndBlurFacesSeam(async () => {
      detectCallCount++;
      throw new Error('simulated pre-AI cover blur failure');
    });
    let uploadCalled = false;
    setUploadFaceBlurThumbnailSeam(async () => {
      uploadCalled = true;
      return null;
    });
    let backfillCalled = false;
    setBackfillFaceDetectionAuditResultSeam(async () => {
      backfillCalled = true;
    });
    setCallGeminiSeam(async () => ({ text: JSON.stringify(singleEventPayload()) }));

    const message: ProcessingJobMessage = {
      postId,
      accountId: publisher.id,
      content: 'Cover blur fails closed, no retry',
      imageUrl: 'https://test.com/img.jpg',
      postUrl: 'https://www.instagram.com/p/preai-blur-noretry/',
      publishedAt: '2026-10-03T10:00:00Z'
    };

    await processAiJob(message);

    // The cover's own pre-AI blur attempt happens exactly once (inside the builder) and is
    // never retried against the original bytes from processAiJob's own step 7.5b.
    assert.strictEqual(detectCallCount, 1);
    assert.strictEqual(uploadCalled, false);
    assert.strictEqual(backfillCalled, false);
    const [postRow] = await db.select().from(posts).where(eq(posts.id, postId));
    assert.strictEqual(postRow.durableThumbnailUrl, null);
    const [auditRow] = await db.select().from(extractionAuditLogs).where(eq(extractionAuditLogs.postId, postId));
    assert.strictEqual(auditRow.aiImageInput, 'text_only_fail_closed');
  });
});
