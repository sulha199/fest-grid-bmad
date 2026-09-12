import test from 'node:test';
import * as assert from 'node:assert';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, subscriptions, users } from '@festgrid/database';
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
import { compileValidator } from '../../validation/validate.js';
import { extractedEventSchema } from '../../validation/extracted-event.schema.js';
import { type GeminiExtractionPayload } from '@festgrid/domain';
import { type ProcessingJobMessage } from '@festgrid/domain/posts';

// Story 3.6l (AC5/AC6/AC8) — completeness-logging integration tests against the real DB,
// focusing the new warning branch the same way process-ai-job.multi-subscriber-quota.test.ts
// focuses its own concern. Uses the real-DB seeded-profile/subscription setup.
// Force off the local-dev inline-fallback regardless of any developer .env so we can assert the
// DataIngestionQueue hand-off via the sendSqsMessage seam (mirrors process-ai-job.test.ts).
process.env.DATA_INGESTION_INLINE_FALLBACK_ENABLED = 'false';

// Representative subset of the human-verified ground-truth events at the bottom of
// _bmad-output/implementation-artifacts/backlog/IDEA-001-multislide-extraction.md.
const GROUND_TRUTH_NAMES = ['Pink Ribbon Run 2026', 'K24 Healthy Run', 'Erafone Run 2026'];

function buildSchedule(title: string, date: string) {
  return { isMainSchedule: false, eventStartDate: date, title };
}

test('processAiJob carousel completeness logging tests', async (t) => {
  const originalEnvQueueUrl = process.env.DATA_INGESTION_QUEUE_URL;
  const originalCallGeminiSeam = callGeminiSeam;
  const originalMarkPostExtractedSeam = markPostExtractedSeam;
  const originalRehostPostImageSeam = rehostPostImageSeam;
  const originalBackfillAccountProfileAndInferDefaultLocationSeam = backfillAccountProfileAndInferDefaultLocationSeam;
  const originalResolveLocationSeam = resolveLocationSeam;
  const originalSendSqsMessage = sendSqsMessage;

  setBackfillAccountProfileAndInferDefaultLocationSeam(async () => {});

  const seededUsers = await db.select().from(users).limit(1);
  assert.ok(seededUsers.length > 0, 'Must have at least one seeded user');
  const user = seededUsers[0];

  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: 'platform-acc-carousel-completeness-' + Date.now(),
      platform: 'instagram',
      displayName: 'Carousel Completeness Fest Account',
      username: 'carousel_completeness_' + Date.now(),
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
  };

  t.after(async () => {
    await db.delete(subscriptions).where(eq(subscriptions.accountId, profile.id));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
    process.env.DATA_INGESTION_QUEUE_URL = originalEnvQueueUrl;
    restoreSeams();
  });

  t.beforeEach(() => {
    process.env.DATA_INGESTION_QUEUE_URL = 'https://sqs.mock-carousel-completeness-url';
    setBackfillAccountProfileAndInferDefaultLocationSeam(async () => {});
  });

  t.afterEach(() => {
    restoreSeams();
  });

  const captureWarn = (t: any) => {
    const warnCalls: any[][] = [];
    const warnMock = t.mock.method(console, 'warn', (...args: any[]) => {
      warnCalls.push(args);
    });
    return { warnCalls, warnMock };
  };

  await t.test('Case A: schedules fall short of a self-reported minScheduleCount -> warning + schedules flow to queue (AC5/AC8)', async (t) => {
    const { warnCalls, warnMock } = captureWarn(t);

    // Only 3 of the ~30 ground-truth events are returned, but the model self-reports 8 expected.
    const payload: GeminiExtractionPayload = {
      isEvent: true,
      eventName: 'Kumpulan Event Lari Jogja',
      types: ['PERFORMANCE'],
      categories: ['SPORTS_AND_FITNESS'],
      schedules: [
        buildSchedule('Pink Ribbon Run 2026', '2026-10-25'),
        buildSchedule('K24 Healthy Run', '2026-10-25'),
        buildSchedule('Erafone Run 2026', '2026-10-31')
      ],
      location: 'Yogyakarta',
      confidenceScore: 0.9,
      minScheduleCount: 8,
      expectedScheduleNames: GROUND_TRUTH_NAMES
    };

    const message: ProcessingJobMessage = {
      postId: 'post-carousel-completeness-1',
      accountId: profile.id,
      content: 'Rangkuman event lari di Jogja — schedule on later slides',
      postUrl: 'https://www.instagram.com/p/DcntzF0mB7z/',
      publishedAt: '2026-08-29T10:24:17Z'
    };

    let sqsBody: any = null;
    let sendSqsMessageCalled = false;
    let markPostExtractedCalled = false;

    setCallGeminiSeam(async () => ({ text: JSON.stringify(payload) }));
    setSendSqsMessage(async (_queueUrl, body) => {
      sendSqsMessageCalled = true;
      sqsBody = JSON.parse(body);
    });
    setMarkPostExtractedSeam(async (postId) => {
      markPostExtractedCalled = true;
      assert.strictEqual(postId, message.postId);
      return {} as any;
    });
    setResolveLocationSeam(async () => ({ location: undefined }) as any);

    await processAiJob(message);

    assert.strictEqual(warnCalls.length, 1, 'Expected exactly one incomplete-extraction warning');
    const warnText = warnCalls[0].join(' ');
    assert.ok(warnText.includes('post-carousel-completeness-1'), 'warning should include post id');
    assert.ok(warnText.includes('minScheduleCount=8'), 'warning should include minScheduleCount');
    assert.ok(warnText.includes('actual schedules=3'), 'warning should include actual schedules length');
    assert.ok(warnText.includes('Pink Ribbon Run 2026'), 'warning should include an expectedScheduleName');

    assert.ok(sendSqsMessageCalled, 'sendSqsMessage should be called');
    assert.ok(markPostExtractedCalled, 'markPostExtracted should be called');
    assert.strictEqual(sqsBody.schedules.length, 3, 'schedules must reach the queue unmodified');
    assert.strictEqual(sqsBody.schedules[0].title, 'Pink Ribbon Run 2026');
    assert.strictEqual(warnMock.mock.callCount(), 1, 'warn should have been called exactly once');
  });

  await t.test('Case B: AJV accepts a payload carrying the two new optional fields (Task 4/AC5)', async () => {
    const validate = compileValidator<GeminiExtractionPayload>(extractedEventSchema);
    const valid = validate({
      isEvent: true,
      eventName: 'Single Event',
      types: ['PERFORMANCE'],
      categories: ['MUSIC'],
      schedules: [{ isMainSchedule: true, eventStartDate: '2026-09-20' }],
      confidenceScore: 0.92,
      minScheduleCount: 1,
      expectedScheduleNames: ['Single Event']
    });
    assert.strictEqual(valid, true, 'payload with minScheduleCount/expectedScheduleNames must pass AJV');
  });

  await t.test('Case C: minScheduleCount absent -> no warning (AC6)', async (t) => {
    const { warnCalls } = captureWarn(t);

    const payload: GeminiExtractionPayload = {
      isEvent: true,
      eventName: 'Single Event',
      types: ['PERFORMANCE'],
      categories: ['MUSIC'],
      schedules: [buildSchedule('Single Event', '2026-09-20')],
      confidenceScore: 0.92
    };

    const message: ProcessingJobMessage = {
      postId: 'post-carousel-completeness-2',
      accountId: profile.id,
      content: 'Event announcement',
      postUrl: 'https://www.instagram.com/p/abc123/',
      publishedAt: '2026-08-29T10:24:17Z'
    };

    setCallGeminiSeam(async () => ({ text: JSON.stringify(payload) }));
    setSendSqsMessage(async () => {});
    setMarkPostExtractedSeam(async () => ({} as any));
    setResolveLocationSeam(async () => ({ location: undefined }) as any);

    await processAiJob(message);

    assert.strictEqual(warnCalls.length, 0, 'No warning when minScheduleCount is absent');
  });

  await t.test('Case D: isEvent=false with minScheduleCount present -> no warning (AC6)', async (t) => {
    const { warnCalls } = captureWarn(t);

    const payload: GeminiExtractionPayload = {
      isEvent: false,
      eventName: '',
      types: [],
      categories: [],
      schedules: [],
      confidenceScore: 0.99,
      minScheduleCount: 5,
      expectedScheduleNames: ['Non-event garbage']
    };

    const message: ProcessingJobMessage = {
      postId: 'post-carousel-completeness-3',
      accountId: profile.id,
      content: 'Just a random non-event post',
      postUrl: 'https://www.instagram.com/p/xyz789/',
      publishedAt: '2026-08-29T10:24:17Z'
    };

    let sendSqsMessageCalled = false;
    let markPostExtractedCalled = false;

    setCallGeminiSeam(async () => ({ text: JSON.stringify(payload) }));
    setSendSqsMessage(async () => {
      sendSqsMessageCalled = true;
    });
    setMarkPostExtractedSeam(async () => {
      markPostExtractedCalled = true;
      return {} as any;
    });

    await processAiJob(message);

    assert.strictEqual(warnCalls.length, 0, 'No warning when isEvent=false even if minScheduleCount present');
    assert.strictEqual(markPostExtractedCalled, true, 'non-event should be marked extracted');
    assert.strictEqual(sendSqsMessageCalled, false, 'non-event should not enqueue');
  });
});
