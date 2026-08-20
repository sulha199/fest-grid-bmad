import test from 'node:test';
import * as assert from 'node:assert';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, subscriptions, users } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { processAiJob, setCallGeminiSeam, setMarkPostExtractedSeam } from './process-ai-job.js';
import { setResolveLocationSeam } from './resolve-account-and-locations.js';
import { setSendSqsMessage } from '../aws/send-sqs-message.js';
import { type ProcessingJobMessage } from '@festgrid/domain/posts';
import { AiGatewayExhaustedError } from '../ai-gateway/adapter.js';

// Force off regardless of the developer's local .env: Case F below relies on
// processAiJob throwing when DATA_INGESTION_QUEUE_URL is unset, which the
// local-dev inline-fallback path would otherwise swallow.
process.env.DATA_INGESTION_INLINE_FALLBACK_ENABLED = 'false';

test('processAiJob orchestrator tests', async (t) => {
  const originalEnvQueueUrl = process.env.DATA_INGESTION_QUEUE_URL;

  // Retrieve seeded users
  const seededUsers = await db.select().from(users).limit(1);
  assert.ok(seededUsers.length > 0, 'Must have at least one seeded user');
  const user = seededUsers[0];

  // Insert a test social media account profile
  const testProfileAccountId = 'platform-acc-process-' + Date.now();
  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: testProfileAccountId,
      platform: 'instagram',
      displayName: 'Process Fest Account',
      username: 'process_fest_' + Date.now()
    })
    .returning();

  // Create subscriber
  const [sub] = await db
    .insert(subscriptions)
    .values({
      userId: user.id,
      accountId: profile.id,
      isNewlyAdded: true
    })
    .returning();

  t.after(async () => {
    // Cleanup database rows
    await db.delete(subscriptions).where(eq(subscriptions.accountId, profile.id));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
    process.env.DATA_INGESTION_QUEUE_URL = originalEnvQueueUrl;
  });

  t.beforeEach(() => {
    process.env.DATA_INGESTION_QUEUE_URL = 'https://sqs.mock-queue-url';
  });

  t.afterEach(() => {
    // Reset seams
    setCallGeminiSeam(async () => ({ text: '{}' }));
    setMarkPostExtractedSeam(async () => ({}) as any);
    setResolveLocationSeam(async () => ({}) as any);
    setSendSqsMessage(async () => {});
  });

  await t.test('Case A: happy path (event extracted, enqueued, marked)', async () => {
    const message: ProcessingJobMessage = {
      postId: 'post-process-1',
      accountId: profile.id,
      content: 'Epic Concert Tonight!',
      postUrl: 'https://test.com/p1',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    let callGeminiCalled = false;
    let markPostExtractedCalled = false;
    let sendSqsMessageCalled = false;
    let sqsBody: any = null;

    setCallGeminiSeam(async (req) => {
      callGeminiCalled = true;
      assert.deepStrictEqual(req.subscriberUserIds, [user.id]);
      return {
        text: JSON.stringify({
          isEvent: true,
          eventName: 'Epic Concert',
          types: ['PERFORMANCE'],
          categories: ['MUSIC'],
          schedules: [
            {
              isMainSchedule: true,
              eventStartDate: '2026-08-15'
            }
          ],
          confidenceScore: 0.95
        })
      };
    });

    setSendSqsMessage(async (queueUrl, body) => {
      sendSqsMessageCalled = true;
      sqsBody = JSON.parse(body);
      assert.strictEqual(queueUrl, 'https://sqs.mock-queue-url');
    });

    setMarkPostExtractedSeam(async (postId) => {
      markPostExtractedCalled = true;
      assert.strictEqual(postId, 'post-process-1');
      return {} as any;
    });

    await processAiJob(message);

    assert.ok(callGeminiCalled, 'callGemini should be called');
    assert.ok(sendSqsMessageCalled, 'sendSqsMessage should be called');
    assert.ok(markPostExtractedCalled, 'markPostExtracted should be called');
    assert.strictEqual(sqsBody.eventName, 'Epic Concert');
    assert.strictEqual(sqsBody.postId, 'post-process-1');
    assert.strictEqual(sqsBody.schedules[0].timezoneStatus, 'NEEDS_CLARIFICATION');
    assert.strictEqual(sqsBody.schedules[0].timezone, undefined);
  });

  await t.test('Case A-2: Tier 2 resolved (single subscriber with timezone set)', async () => {
    // Seed user's timezone
    const originalTimezone = user.timezone;
    await db.update(users).set({ timezone: 'America/Denver' }).where(eq(users.id, user.id));

    const message: ProcessingJobMessage = {
      postId: 'post-process-1a',
      accountId: profile.id,
      content: 'Epic Concert Tonight!',
      postUrl: 'https://test.com/p1a',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    let sqsBody: any = null;

    setCallGeminiSeam(async () => {
      return {
        text: JSON.stringify({
          isEvent: true,
          eventName: 'Epic Concert',
          types: ['PERFORMANCE'],
          categories: ['MUSIC'],
          schedules: [
            {
              isMainSchedule: true,
              eventStartDate: '2026-08-15'
            }
          ],
          confidenceScore: 0.95
        })
      };
    });

    setSendSqsMessage(async (queueUrl, body) => {
      sqsBody = JSON.parse(body);
    });

    setMarkPostExtractedSeam(async () => ({} as any));

    try {
      await processAiJob(message);
      assert.strictEqual(sqsBody.schedules[0].timezoneStatus, 'RESOLVED');
      assert.strictEqual(sqsBody.schedules[0].timezone, 'America/Denver');
    } finally {
      // Restore
      await db.update(users).set({ timezone: originalTimezone ?? null }).where(eq(users.id, user.id));
    }
  });

  await t.test('Case A-3: Zero-subscriber account, Tier 3 fires without users lookup', async () => {
    // Create an account profile with zero subscribers
    const [zeroSubProfile] = await db
      .insert(socialMediaAccountProfiles)
      .values({
        accountId: 'platform-acc-zero-' + Date.now(),
        platform: 'instagram',
        displayName: 'Zero Sub Profile',
        username: 'zero_sub_' + Date.now()
      })
      .returning();

    const message: ProcessingJobMessage = {
      postId: 'post-process-1b',
      accountId: zeroSubProfile.id,
      content: 'Epic Concert Tonight!',
      postUrl: 'https://test.com/p1b',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    let sqsBody: any = null;

    setCallGeminiSeam(async () => {
      return {
        text: JSON.stringify({
          isEvent: true,
          eventName: 'Epic Concert',
          types: ['PERFORMANCE'],
          categories: ['MUSIC'],
          schedules: [
            {
              isMainSchedule: true,
              eventStartDate: '2026-08-15'
            }
          ],
          confidenceScore: 0.95
        })
      };
    });

    setSendSqsMessage(async (queueUrl, body) => {
      sqsBody = JSON.parse(body);
    });

    setMarkPostExtractedSeam(async () => ({} as any));

    try {
      await processAiJob(message);
      assert.strictEqual(sqsBody.schedules[0].timezoneStatus, 'NEEDS_CLARIFICATION');
      assert.strictEqual(sqsBody.schedules[0].timezone, undefined);
    } finally {
      await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, zeroSubProfile.id));
    }
  });

  await t.test('Case B: isEvent: false path (marked, not enqueued)', async () => {
    const message: ProcessingJobMessage = {
      postId: 'post-process-2',
      accountId: profile.id,
      content: 'Just chilling at home!',
      postUrl: 'https://test.com/p2',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    let callGeminiCalled = false;
    let markPostExtractedCalled = false;
    let sendSqsMessageCalled = false;

    setCallGeminiSeam(async () => {
      callGeminiCalled = true;
      return {
        text: JSON.stringify({
          isEvent: false,
          eventName: '',
          types: [],
          categories: [],
          schedules: [],
          confidenceScore: 0.99
        })
      };
    });

    setSendSqsMessage(async () => {
      sendSqsMessageCalled = true;
    });

    setMarkPostExtractedSeam(async (postId) => {
      markPostExtractedCalled = true;
      assert.strictEqual(postId, 'post-process-2');
      return {} as any;
    });

    await processAiJob(message);

    assert.ok(callGeminiCalled);
    assert.ok(markPostExtractedCalled, 'Should mark post extracted');
    assert.ok(!sendSqsMessageCalled, 'Should NOT enqueue');
  });

  await t.test('Case C: AJV validation failure path (not marked, not enqueued, no throw)', async () => {
    const message: ProcessingJobMessage = {
      postId: 'post-process-3',
      accountId: profile.id,
      content: 'Invalid schema response!',
      postUrl: 'https://test.com/p3',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    let markPostExtractedCalled = false;
    let sendSqsMessageCalled = false;

    setCallGeminiSeam(async () => {
      return {
        text: JSON.stringify({
          isEvent: true,
          // Missing required eventName, schedules, types, categories, confidenceScore
        })
      };
    });

    setSendSqsMessage(async () => {
      sendSqsMessageCalled = true;
    });

    setMarkPostExtractedSeam(async () => {
      markPostExtractedCalled = true;
      return {} as any;
    });

    await processAiJob(message);

    assert.ok(!sendSqsMessageCalled, 'Should NOT enqueue on validation fail');
    assert.ok(!markPostExtractedCalled, 'Should NOT mark post extracted on validation fail');
  });

  await t.test('Case D: JSON parse failure path (not marked, not enqueued, no throw)', async () => {
    const message: ProcessingJobMessage = {
      postId: 'post-process-4',
      accountId: profile.id,
      content: 'Malformed JSON!',
      postUrl: 'https://test.com/p4',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    let markPostExtractedCalled = false;
    let sendSqsMessageCalled = false;

    setCallGeminiSeam(async () => {
      return {
        text: 'This is not JSON!'
      };
    });

    setSendSqsMessage(async () => {
      sendSqsMessageCalled = true;
    });

    setMarkPostExtractedSeam(async () => {
      markPostExtractedCalled = true;
      return {} as any;
    });

    await processAiJob(message);

    assert.ok(!sendSqsMessageCalled, 'Should NOT enqueue on parse fail');
    assert.ok(!markPostExtractedCalled, 'Should NOT mark post extracted on parse fail');
  });

  await t.test('Case E: AiGatewayExhaustedError propagation (throws, not marked, not enqueued)', async () => {
    const message: ProcessingJobMessage = {
      postId: 'post-process-5',
      accountId: profile.id,
      content: 'Exhausted keys!',
      postUrl: 'https://test.com/p5',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    let markPostExtractedCalled = false;
    let sendSqsMessageCalled = false;

    setCallGeminiSeam(async () => {
      throw new AiGatewayExhaustedError('Exhausted keys!');
    });

    setSendSqsMessage(async () => {
      sendSqsMessageCalled = true;
    });

    setMarkPostExtractedSeam(async () => {
      markPostExtractedCalled = true;
      return {} as any;
    });

    await assert.rejects(
      () => processAiJob(message),
      AiGatewayExhaustedError
    );

    assert.ok(!sendSqsMessageCalled, 'Should NOT enqueue on error');
    assert.ok(!markPostExtractedCalled, 'Should NOT mark post extracted on error');
  });

  await t.test('Case F: missing queue URL guard throws error', async () => {
    delete process.env.DATA_INGESTION_QUEUE_URL;

    const message: ProcessingJobMessage = {
      postId: 'post-process-6',
      accountId: profile.id,
      content: 'Trigger missing URL guard!',
      postUrl: 'https://test.com/p6',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    setCallGeminiSeam(async () => {
      return {
        text: JSON.stringify({
          isEvent: true,
          eventName: 'Epic Concert',
          types: ['PERFORMANCE'],
          categories: ['MUSIC'],
          schedules: [
            {
              isMainSchedule: true,
              eventStartDate: '2026-08-15'
            }
          ],
          confidenceScore: 0.95
        })
      };
    });

    await assert.rejects(
      () => processAiJob(message),
      /DATA_INGESTION_QUEUE_URL is not configured/
    );
  });
});
