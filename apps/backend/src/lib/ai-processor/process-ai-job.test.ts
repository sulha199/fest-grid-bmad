import test from 'node:test';
import * as assert from 'node:assert';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, subscriptions, users, posts } from '@festgrid/database';
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
import { type ProcessingJobMessage } from '@festgrid/domain/posts';
import { AiGatewayExhaustedError } from '../ai-gateway/adapter.js';

// Force off regardless of the developer's local .env: Case F below relies on
// processAiJob throwing when DATA_INGESTION_QUEUE_URL is unset, which the
// local-dev inline-fallback path would otherwise swallow.
process.env.DATA_INGESTION_INLINE_FALLBACK_ENABLED = 'false';
// Story 3.20 (Task 6.1): BLUR_FACES_BEFORE_AI now defaults ON. This file's cases drive
// buildGeminiExtractionRequest with fake imageUrls/bytes via mocked fetch; with the setting on,
// resolvePostPublisherOptIn would also run a real DB query per call. Pinned off so every existing
// case here keeps exercising today's pre-3.20 behavior, unaffected by this story's new default.
process.env.BLUR_FACES_BEFORE_AI = 'false';

test('processAiJob orchestrator tests', async (t) => {
  const originalEnvQueueUrl = process.env.DATA_INGESTION_QUEUE_URL;
  const originalCallGeminiSeam = callGeminiSeam;
  const originalMarkPostExtractedSeam = markPostExtractedSeam;
  const originalRehostPostImageSeam = rehostPostImageSeam;
  const originalBackfillAccountProfileAndInferDefaultLocationSeam = backfillAccountProfileAndInferDefaultLocationSeam;
  const originalResolveLocationSeam = resolveLocationSeam;
  const originalSendSqsMessage = sendSqsMessage;

  setBackfillAccountProfileAndInferDefaultLocationSeam(async () => {});

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
      username: 'process_fest_' + Date.now(),
      isImageStorageOptedIn: true
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

    // Reset seams
    setCallGeminiSeam(originalCallGeminiSeam);
    setMarkPostExtractedSeam(originalMarkPostExtractedSeam);
    setRehostPostImageSeam(originalRehostPostImageSeam);
    setBackfillAccountProfileAndInferDefaultLocationSeam(originalBackfillAccountProfileAndInferDefaultLocationSeam);
    setResolveLocationSeam(originalResolveLocationSeam);
    setSendSqsMessage(originalSendSqsMessage);
  });

  t.beforeEach(() => {
    process.env.DATA_INGESTION_QUEUE_URL = 'https://sqs.mock-queue-url';
  });

  t.afterEach(() => {
    // Reset seams
    setCallGeminiSeam(originalCallGeminiSeam);
    setMarkPostExtractedSeam(originalMarkPostExtractedSeam);
    setRehostPostImageSeam(originalRehostPostImageSeam);
    setBackfillAccountProfileAndInferDefaultLocationSeam(originalBackfillAccountProfileAndInferDefaultLocationSeam);
    setResolveLocationSeam(originalResolveLocationSeam);
    setSendSqsMessage(originalSendSqsMessage);
  });

  await t.test('Case A: happy path (event extracted, enqueued, marked)', async (t) => {
    const originalTimezone = user.timezone;
    await db.update(users).set({ timezone: null }).where(eq(users.id, user.id));

    t.after(async () => {
      await db.update(users).set({ timezone: originalTimezone }).where(eq(users.id, user.id));
    });

    const message: ProcessingJobMessage = {
      postId: '00000000-0000-4000-8000-000000000001',
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
          events: [{
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
          }]
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
      assert.strictEqual(postId, '00000000-0000-4000-8000-000000000001');
      return {} as any;
    });

    await processAiJob(message);

    assert.ok(callGeminiCalled, 'callGemini should be called');
    assert.ok(sendSqsMessageCalled, 'sendSqsMessage should be called');
    assert.ok(markPostExtractedCalled, 'markPostExtracted should be called');
    assert.strictEqual(sqsBody.eventName, 'Epic Concert');
    assert.strictEqual(sqsBody.postId, '00000000-0000-4000-8000-000000000001');
    assert.strictEqual(sqsBody.schedules[0].timezoneStatus, 'NEEDS_CLARIFICATION');
    assert.strictEqual(sqsBody.schedules[0].timezone, undefined);
  });

  await t.test('Case A-2: Tier 2 resolved (single subscriber with timezone set)', async () => {
    // Seed user's timezone
    const originalTimezone = user.timezone;
    await db.update(users).set({ timezone: 'America/Denver' }).where(eq(users.id, user.id));

    const message: ProcessingJobMessage = {
      postId: '00000000-0000-4000-8000-00000000001a',
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
          events: [{
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
          }]
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
      postId: '00000000-0000-4000-8000-00000000001b',
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
          events: [{
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
          }]
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
      postId: '00000000-0000-4000-8000-000000000002',
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
          events: []
        })
      };
    });

    setSendSqsMessage(async () => {
      sendSqsMessageCalled = true;
    });

    setMarkPostExtractedSeam(async (postId) => {
      markPostExtractedCalled = true;
      assert.strictEqual(postId, '00000000-0000-4000-8000-000000000002');
      return {} as any;
    });

    await processAiJob(message);

    assert.ok(callGeminiCalled);
    assert.ok(markPostExtractedCalled, 'Should mark post extracted');
    assert.ok(!sendSqsMessageCalled, 'Should NOT enqueue');
  });

  await t.test('Case C: AJV validation failure path (not marked, not enqueued, no throw)', async () => {
    const message: ProcessingJobMessage = {
      postId: '00000000-0000-4000-8000-000000000003',
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
          // Missing required 'events' array entirely (Story 3.6s shape)
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
      postId: '00000000-0000-4000-8000-000000000004',
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
      postId: '00000000-0000-4000-8000-000000000005',
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
      postId: '00000000-0000-4000-8000-000000000006',
      accountId: profile.id,
      content: 'Trigger missing URL guard!',
      postUrl: 'https://test.com/p6',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    setCallGeminiSeam(async () => {
      return {
        text: JSON.stringify({
          isEvent: true,
          events: [{
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
          }]
        })
      };
    });

    await assert.rejects(
      () => processAiJob(message),
      /DATA_INGESTION_QUEUE_URL is not configured/
    );
  });

  await t.test('Case G-1: successful event extraction rehosts image bytes', async () => {
    const originalFetch = globalThis.fetch;
    t.after(() => {
      globalThis.fetch = originalFetch;
    });

    globalThis.fetch = async () => {
      return {
        ok: true,
        headers: {
          get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/png' : null)
        },
        arrayBuffer: async () => Buffer.from('mock-bytes-123')
      } as any;
    };

    const message: ProcessingJobMessage = {
      postId: '00000000-0000-4000-8000-000000000012',
      accountId: profile.id,
      content: 'Epic Concert Tonight!',
      imageUrl: 'https://test.com/img.png',
      postUrl: 'https://test.com/pg1',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    let rehostCalledWith: any = null;

    setCallGeminiSeam(async () => {
      return {
        text: JSON.stringify({
          isEvent: true,
          events: [{
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
          }]
        })
      };
    });

    setSendSqsMessage(async () => {});
    setMarkPostExtractedSeam(async () => ({} as any));

    setRehostPostImageSeam(async (postId, imageBytes, imageContentType) => {
      rehostCalledWith = { postId, imageBytes, imageContentType };
      return 'https://cdn.test.com/posts/post-rehost-g1';
    });

    await processAiJob(message);

    assert.ok(rehostCalledWith);
    assert.strictEqual(rehostCalledWith.postId, '00000000-0000-4000-8000-000000000012');
    assert.deepEqual(rehostCalledWith.imageBytes, Buffer.from('mock-bytes-123'));
    assert.strictEqual(rehostCalledWith.imageContentType, 'image/png');
  });

  await t.test('Case G-2: rehost failure does NOT block extraction or enqueuing (graceful fallback)', async () => {
    const originalFetch = globalThis.fetch;
    t.after(() => {
      globalThis.fetch = originalFetch;
    });

    globalThis.fetch = async () => {
      return {
        ok: true,
        headers: {
          get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/png' : null)
        },
        arrayBuffer: async () => Buffer.from('mock-bytes-123')
      } as any;
    };

    const message: ProcessingJobMessage = {
      postId: '00000000-0000-4000-8000-000000000013',
      accountId: profile.id,
      content: 'Epic Concert Tonight!',
      imageUrl: 'https://test.com/img.png',
      postUrl: 'https://test.com/pg2',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    let rehostCalled = false;
    let markPostExtractedCalled = false;
    let sendSqsMessageCalled = false;

    setCallGeminiSeam(async () => {
      return {
        text: JSON.stringify({
          isEvent: true,
          events: [{
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
          }]
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

    setRehostPostImageSeam(async () => {
      rehostCalled = true;
      throw new Error('Mock S3 upload failure');
    });

    // Should NOT throw or reject
    await processAiJob(message);

    assert.ok(rehostCalled);
    assert.ok(sendSqsMessageCalled);
    assert.ok(markPostExtractedCalled);
  });

  await t.test('Case H: isEvent: false does NOT attempt rehosting', async () => {
    const originalFetch = globalThis.fetch;
    t.after(() => {
      globalThis.fetch = originalFetch;
    });

    globalThis.fetch = async () => {
      return {
        ok: true,
        headers: {
          get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/png' : null)
        },
        arrayBuffer: async () => Buffer.from('mock-bytes-123')
      } as any;
    };

    const message: ProcessingJobMessage = {
      postId: 'post-rehost-h',
      accountId: profile.id,
      content: 'Just chilling at home!',
      imageUrl: 'https://test.com/img.png',
      postUrl: 'https://test.com/ph',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    let rehostCalled = false;

    setCallGeminiSeam(async () => {
      return {
        text: JSON.stringify({
          isEvent: false,
          events: []
        })
      };
    });

    setSendSqsMessage(async () => {});
    setMarkPostExtractedSeam(async () => ({} as any));

    setRehostPostImageSeam(async () => {
      rehostCalled = true;
      return null;
    });

    await processAiJob(message);

    assert.strictEqual(rehostCalled, false, 'Should not attempt re-hosting when isEvent is false');
  });

  await t.test('Case I: AJV validation failure does NOT attempt rehosting', async () => {
    const originalFetch = globalThis.fetch;
    t.after(() => {
      globalThis.fetch = originalFetch;
    });

    globalThis.fetch = async () => {
      return {
        ok: true,
        headers: {
          get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/png' : null)
        },
        arrayBuffer: async () => Buffer.from('mock-bytes-123')
      } as any;
    };

    const message: ProcessingJobMessage = {
      postId: 'post-rehost-i',
      accountId: profile.id,
      content: 'Invalid AJV caption',
      imageUrl: 'https://test.com/img.png',
      postUrl: 'https://test.com/pi',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    let rehostCalled = false;

    setCallGeminiSeam(async () => {
      return {
        text: JSON.stringify({
          isEvent: true,
          // missing required fields triggers validation failure
        })
      };
    });

    setSendSqsMessage(async () => {});
    setMarkPostExtractedSeam(async () => ({} as any));

    setRehostPostImageSeam(async () => {
      rehostCalled = true;
      return null;
    });

    await processAiJob(message);

    assert.strictEqual(rehostCalled, false, 'Should not attempt re-hosting when AJV validation fails');
  });

  await t.test('Case J: calls backfillAccountProfileAndInferDefaultLocationSeam when defaultLocation is falsy', async (t) => {
    const message: ProcessingJobMessage = {
      postId: '00000000-0000-4000-8000-00000000000a',
      accountId: profile.id,
      content: 'Epic Concert Tonight J!',
      postUrl: 'https://test.com/pj',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    let backfillCalled = false;
    let backfillAccountId = '';
    let backfillPosts: any[] = [];

    await db
      .update(socialMediaAccountProfiles)
      .set({ defaultLocation: null })
      .where(eq(socialMediaAccountProfiles.id, profile.id));

    setCallGeminiSeam(async () => {
      return {
        text: JSON.stringify({
          isEvent: true,
          events: [{
            eventName: 'Epic Concert J',
            types: ['PERFORMANCE'],
            categories: ['MUSIC'],
            schedules: [
            {
              isMainSchedule: true,
              eventStartDate: '2026-08-15'
            }
          ],
            confidenceScore: 0.99
          }]
        })
      };
    });

    setResolveLocationSeam(async () => {
      return {
        id: 'loc-1',
        name: 'Original Venue'
      } as any;
    });

    setSendSqsMessage(async () => {});
    setMarkPostExtractedSeam(async () => ({} as any));

    setBackfillAccountProfileAndInferDefaultLocationSeam(async (accId, posts) => {
      backfillCalled = true;
      backfillAccountId = accId;
      backfillPosts = posts;
    });

    await processAiJob(message);

    assert.ok(backfillCalled, 'backfill should be called');
    assert.strictEqual(backfillAccountId, profile.id);
    assert.strictEqual(backfillPosts.length, 1);
    assert.strictEqual(backfillPosts[0].content, message.content);

    // Clean up
    await db
      .update(socialMediaAccountProfiles)
      .set({ defaultLocation: null })
      .where(eq(socialMediaAccountProfiles.id, profile.id));
  });

  await t.test('Case K: does NOT call backfillAccountProfileAndInferDefaultLocationSeam when defaultLocation is truthy', async (t) => {
    const message: ProcessingJobMessage = {
      postId: '00000000-0000-4000-8000-00000000000b',
      accountId: profile.id,
      content: 'Epic Concert Tonight K!',
      postUrl: 'https://test.com/pk',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    let backfillCalled = false;

    await db
      .update(socialMediaAccountProfiles)
      .set({
        defaultLocation: { id: 'loc-k', name: 'Venue K' } as any
      })
      .where(eq(socialMediaAccountProfiles.id, profile.id));

    setCallGeminiSeam(async () => {
      return {
        text: JSON.stringify({
          isEvent: true,
          events: [{
            eventName: 'Epic Concert K',
            types: ['PERFORMANCE'],
            categories: ['MUSIC'],
            schedules: [
            {
              isMainSchedule: true,
              eventStartDate: '2026-08-15'
            }
          ],
            confidenceScore: 0.99
          }]
        })
      };
    });

    setResolveLocationSeam(async () => {
      return {
        id: 'loc-1',
        name: 'Original Venue'
      } as any;
    });

    setSendSqsMessage(async () => {});
    setMarkPostExtractedSeam(async () => ({} as any));

    setBackfillAccountProfileAndInferDefaultLocationSeam(async () => {
      backfillCalled = true;
    });

    await processAiJob(message);

    assert.strictEqual(backfillCalled, false, 'backfill should not be called when default location is already set');

    // Clean up
    await db
      .update(socialMediaAccountProfiles)
      .set({ defaultLocation: null })
      .where(eq(socialMediaAccountProfiles.id, profile.id));
  });

  await t.test('Case L: does not fail extraction when backfillAccountProfileAndInferDefaultLocationSeam throws', async (t) => {
    const message: ProcessingJobMessage = {
      postId: '00000000-0000-4000-8000-00000000000c',
      accountId: profile.id,
      content: 'Epic Concert Tonight L!',
      postUrl: 'https://test.com/pl',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    let backfillCalled = false;
    let markPostExtractedCalled = false;

    await db
      .update(socialMediaAccountProfiles)
      .set({ defaultLocation: null })
      .where(eq(socialMediaAccountProfiles.id, profile.id));

    setCallGeminiSeam(async () => {
      return {
        text: JSON.stringify({
          isEvent: true,
          events: [{
            eventName: 'Epic Concert L',
            types: ['PERFORMANCE'],
            categories: ['MUSIC'],
            schedules: [
            {
              isMainSchedule: true,
              eventStartDate: '2026-08-15'
            }
          ],
            confidenceScore: 0.99
          }]
        })
      };
    });

    setResolveLocationSeam(async () => {
      return {
        id: 'loc-1',
        name: 'Original Venue'
      } as any;
    });

    setSendSqsMessage(async () => {});
    setMarkPostExtractedSeam(async () => {
      markPostExtractedCalled = true;
      return {} as any;
    });

    setBackfillAccountProfileAndInferDefaultLocationSeam(async () => {
      backfillCalled = true;
      throw new Error('Inference service unavailable');
    });

    // Should not throw
    await processAiJob(message);

    assert.ok(backfillCalled, 'backfill should be called and throw');
    assert.ok(markPostExtractedCalled, 'extraction should still successfully complete');

    // Clean up
    await db
      .update(socialMediaAccountProfiles)
      .set({ defaultLocation: null })
      .where(eq(socialMediaAccountProfiles.id, profile.id));
  });

  await t.test('Case M-1: CURATOR_GUIDE account without image-storage opt-in skips image rehost and clears post content on successful enqueue', async () => {
    const [curatorProfile] = await db
      .insert(socialMediaAccountProfiles)
      .values({
        accountId: 'curator-acc-' + Date.now(),
        platform: 'instagram',
        displayName: 'Curator Guide Profile',
        username: 'curator_guide_' + Date.now(),
        accountType: 'CURATOR_GUIDE',
        isImageStorageOptedIn: false,
      })
      .returning();

    const testPostId = crypto.randomUUID();
    const [testPost] = await db
      .insert(posts)
      .values({
        id: testPostId,
        accountId: curatorProfile.id,
        platform: 'instagram',
        postUrl: 'https://test.com/curator-1',
        content: 'Original curator caption',
        publishedAt: new Date(),
      })
      .returning();

    const originalFetch = globalThis.fetch;
    t.after(() => {
      globalThis.fetch = originalFetch;
    });

    globalThis.fetch = async () => {
      return {
        ok: true,
        headers: {
          get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/png' : null)
        },
        arrayBuffer: async () => Buffer.from('mock-bytes-123')
      } as any;
    };

    const message: ProcessingJobMessage = {
      postId: testPost.id,
      accountId: curatorProfile.id,
      content: 'Original curator caption',
      imageUrl: 'https://test.com/img.png',
      postUrl: 'https://test.com/curator-1',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    let rehostCalled = false;
    let markPostExtractedCalled = false;
    let sendSqsMessageCalled = false;

    setCallGeminiSeam(async () => {
      return {
        text: JSON.stringify({
          isEvent: true,
          events: [{
            eventName: 'Curator Event',
            types: ['PERFORMANCE'],
            categories: ['MUSIC'],
            schedules: [
            {
              isMainSchedule: true,
              eventStartDate: '2026-08-15'
            }
          ],
            confidenceScore: 0.95
          }]
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

    setRehostPostImageSeam(async () => {
      rehostCalled = true;
      return 'https://cdn.test.com/posts/rehost-fail-not-expected';
    });

    try {
      await processAiJob(message);

      assert.strictEqual(rehostCalled, false, 'Should skip image re-hosting for curator guide without opt-in');
      assert.ok(sendSqsMessageCalled, 'Should successfully extract and enqueue event message');
      assert.ok(markPostExtractedCalled, 'Should mark post extracted');

      const [updatedPost] = await db.select().from(posts).where(eq(posts.id, testPost.id)).limit(1);
      assert.strictEqual(updatedPost.content, null, 'Post content should be cleared for curator guide');
    } finally {
      await db.delete(posts).where(eq(posts.id, testPost.id));
      await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, curatorProfile.id));
    }
  });

  await t.test('Case M-1-plain: plain non-CURATOR_GUIDE account without image-storage opt-in skips image rehost on successful enqueue', async () => {
    const [plainProfile] = await db
      .insert(socialMediaAccountProfiles)
      .values({
        accountId: 'plain-acc-' + Date.now(),
        platform: 'instagram',
        displayName: 'Plain Profile',
        username: 'plain_acc_' + Date.now(),
        isImageStorageOptedIn: false,
      })
      .returning();

    const testPostId = crypto.randomUUID();
    const [testPost] = await db
      .insert(posts)
      .values({
        id: testPostId,
        accountId: plainProfile.id,
        platform: 'instagram',
        postUrl: 'https://test.com/plain-1',
        content: 'Original plain caption',
        publishedAt: new Date(),
      })
      .returning();

    const originalFetch = globalThis.fetch;
    t.after(() => {
      globalThis.fetch = originalFetch;
    });

    globalThis.fetch = async () => {
      return {
        ok: true,
        headers: {
          get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/png' : null)
        },
        arrayBuffer: async () => Buffer.from('mock-bytes-123')
      } as any;
    };

    const message: ProcessingJobMessage = {
      postId: testPost.id,
      accountId: plainProfile.id,
      content: 'Original plain caption',
      imageUrl: 'https://test.com/img.png',
      postUrl: 'https://test.com/plain-1',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    let rehostCalled = false;
    let markPostExtractedCalled = false;
    let sendSqsMessageCalled = false;

    setCallGeminiSeam(async () => {
      return {
        text: JSON.stringify({
          isEvent: true,
          events: [{
            eventName: 'Plain Event',
            types: ['PERFORMANCE'],
            categories: ['MUSIC'],
            schedules: [
            {
              isMainSchedule: true,
              eventStartDate: '2026-08-15'
            }
          ],
            confidenceScore: 0.95
          }]
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

    setRehostPostImageSeam(async () => {
      rehostCalled = true;
      return 'https://cdn.test.com/posts/rehost-fail-not-expected';
    });

    try {
      await processAiJob(message);

      assert.strictEqual(rehostCalled, false, 'Should skip image re-hosting for plain account without opt-in');
      assert.ok(sendSqsMessageCalled, 'Should successfully extract and enqueue event message');
      assert.ok(markPostExtractedCalled, 'Should mark post extracted');

      const [updatedPost] = await db.select().from(posts).where(eq(posts.id, testPost.id)).limit(1);
      assert.strictEqual(updatedPost.content, 'Original plain caption', 'Post content should NOT be cleared for plain account');
    } finally {
      await db.delete(posts).where(eq(posts.id, testPost.id));
      await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, plainProfile.id));
    }
  });


  await t.test('Case M-2: CURATOR_GUIDE account with image-storage opt-in performs image rehost and clears post content on successful enqueue', async () => {
    const [curatorProfile] = await db
      .insert(socialMediaAccountProfiles)
      .values({
        accountId: 'curator-opt-acc-' + Date.now(),
        platform: 'instagram',
        displayName: 'Curator Guide Opted-In Profile',
        username: 'curator_guide_opt_' + Date.now(),
        accountType: 'CURATOR_GUIDE',
        isImageStorageOptedIn: true,
      })
      .returning();

    const testPostId = crypto.randomUUID();
    const [testPost] = await db
      .insert(posts)
      .values({
        id: testPostId,
        accountId: curatorProfile.id,
        platform: 'instagram',
        postUrl: 'https://test.com/curator-2',
        content: 'Original curator caption',
        publishedAt: new Date(),
      })
      .returning();

    const originalFetch = globalThis.fetch;
    t.after(() => {
      globalThis.fetch = originalFetch;
    });

    globalThis.fetch = async () => {
      return {
        ok: true,
        headers: {
          get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/png' : null)
        },
        arrayBuffer: async () => Buffer.from('mock-bytes-123')
      } as any;
    };

    const message: ProcessingJobMessage = {
      postId: testPost.id,
      accountId: curatorProfile.id,
      content: 'Original curator caption',
      imageUrl: 'https://test.com/img.png',
      postUrl: 'https://test.com/curator-2',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    let rehostCalled = false;
    let markPostExtractedCalled = false;
    let sendSqsMessageCalled = false;

    setCallGeminiSeam(async () => {
      return {
        text: JSON.stringify({
          isEvent: true,
          events: [{
            eventName: 'Curator Event',
            types: ['PERFORMANCE'],
            categories: ['MUSIC'],
            schedules: [
            {
              isMainSchedule: true,
              eventStartDate: '2026-08-15'
            }
          ],
            confidenceScore: 0.95
          }]
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

    setRehostPostImageSeam(async () => {
      rehostCalled = true;
      return 'https://cdn.test.com/posts/rehost-success';
    });

    try {
      await processAiJob(message);

      assert.strictEqual(rehostCalled, true, 'Should perform image re-hosting for opted-in curator guide');
      assert.ok(sendSqsMessageCalled, 'Should successfully extract and enqueue event message');
      assert.ok(markPostExtractedCalled, 'Should mark post extracted');

      const [updatedPost] = await db.select().from(posts).where(eq(posts.id, testPost.id)).limit(1);
      assert.strictEqual(updatedPost.content, null, 'Post content should still be cleared for opted-in curator guide');
    } finally {
      await db.delete(posts).where(eq(posts.id, testPost.id));
      await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, curatorProfile.id));
    }
  });

  await t.test('Case M-3: CURATOR_GUIDE account without image-storage opt-in skips image rehost and clears post content on isEvent: false path', async () => {
    const [curatorProfile] = await db
      .insert(socialMediaAccountProfiles)
      .values({
        accountId: 'curator-fail-acc-' + Date.now(),
        platform: 'instagram',
        displayName: 'Curator Guide Fail Profile',
        username: 'curator_guide_fail_' + Date.now(),
        accountType: 'CURATOR_GUIDE',
        isImageStorageOptedIn: false,
      })
      .returning();

    const testPostId = crypto.randomUUID();
    const [testPost] = await db
      .insert(posts)
      .values({
        id: testPostId,
        accountId: curatorProfile.id,
        platform: 'instagram',
        postUrl: 'https://test.com/curator-3',
        content: 'Original curator caption',
        publishedAt: new Date(),
      })
      .returning();

    const originalFetch = globalThis.fetch;
    t.after(() => {
      globalThis.fetch = originalFetch;
    });

    globalThis.fetch = async () => {
      return {
        ok: true,
        headers: {
          get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/png' : null)
        },
        arrayBuffer: async () => Buffer.from('mock-bytes-123')
      } as any;
    };

    const message: ProcessingJobMessage = {
      postId: testPost.id,
      accountId: curatorProfile.id,
      content: 'Original curator caption',
      imageUrl: 'https://test.com/img.png',
      postUrl: 'https://test.com/curator-3',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    let rehostCalled = false;
    let markPostExtractedCalled = false;
    let sendSqsMessageCalled = false;

    setCallGeminiSeam(async () => {
      return {
        text: JSON.stringify({
          isEvent: false,
          events: []
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

    setRehostPostImageSeam(async () => {
      rehostCalled = true;
      return 'https://cdn.test.com/posts/rehost-fail';
    });

    try {
      await processAiJob(message);

      assert.strictEqual(rehostCalled, false, 'Should not rehost image on isEvent: false');
      assert.strictEqual(sendSqsMessageCalled, false, 'Should not enqueue event message');
      assert.ok(markPostExtractedCalled, 'Should mark post extracted');

      const [updatedPost] = await db.select().from(posts).where(eq(posts.id, testPost.id)).limit(1);
      assert.strictEqual(updatedPost.content, null, 'Post content should be cleared for curator guide on non-event path');
    } finally {
      await db.delete(posts).where(eq(posts.id, testPost.id));
      await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, curatorProfile.id));
    }
  });

  await t.test('Case N (3.6t supersedes 3.6s AC8): a 2-event payload results in two SQS sends with ordinals 0 and 1, and marks extracted', async () => {
    const message: ProcessingJobMessage = {
      postId: '00000000-0000-4000-8000-00000000000d',
      accountId: profile.id,
      content: 'Two separate events in one post',
      postUrl: 'https://test.com/pn',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    let markPostExtractedCalled = false;
    const sentBodies: any[] = [];

    setCallGeminiSeam(async () => {
      return {
        text: JSON.stringify({
          isEvent: true,
          groupingReason: 'separate-events',
          events: [
            {
              eventName: 'Event One',
              types: ['PERFORMANCE'],
              categories: ['MUSIC'],
              schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-15' }],
              confidenceScore: 0.9
            },
            {
              eventName: 'Event Two',
              types: ['PERFORMANCE'],
              categories: ['MUSIC'],
              schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-20' }],
              confidenceScore: 0.9
            }
          ]
        })
      };
    });

    setSendSqsMessage(async (_queueUrl, body) => {
      sentBodies.push(JSON.parse(body));
    });

    setMarkPostExtractedSeam(async () => {
      markPostExtractedCalled = true;
      return {} as any;
    });

    await processAiJob(message);

    assert.strictEqual(sentBodies.length, 2, 'Should send one SQS message per event (AC1)');
    assert.ok(markPostExtractedCalled, 'Should mark post extracted once all events enqueued');

    const byName = Object.fromEntries(sentBodies.map((b) => [b.eventName, b.extractionOrdinal]));
    // Event One (2026-08-15) sorts before Event Two (2026-08-20) by earliest schedule date (AC7).
    assert.strictEqual(byName['Event One'], 0);
    assert.strictEqual(byName['Event Two'], 1);
  });

  await t.test('Case O: a 15-event payload is truncated to the configured cap (10), resulting in ten SQS sends with ordinals 0..9', async () => {
    const message: ProcessingJobMessage = {
      postId: '00000000-0000-4000-8000-00000000000e',
      accountId: profile.id,
      content: 'Fifteen-item roundup',
      postUrl: 'https://test.com/po',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    let markPostExtractedCalled = false;
    const sentBodies: any[] = [];

    const fifteenEvents = Array.from({ length: 15 }, (_, i) => ({
      eventName: `Roundup Event ${String(i + 1).padStart(2, '0')}`,
      types: ['OTHER'],
      categories: ['OTHER'],
      schedules: [{ isMainSchedule: true, eventStartDate: `2026-08-${String(i + 1).padStart(2, '0')}` }],
      confidenceScore: 0.8
    }));

    setCallGeminiSeam(async () => {
      return {
        text: JSON.stringify({
          isEvent: true,
          groupingReason: 'roundup',
          events: fifteenEvents
        })
      };
    });

    setSendSqsMessage(async (_queueUrl, body) => {
      sentBodies.push(JSON.parse(body));
    });

    setMarkPostExtractedSeam(async () => {
      markPostExtractedCalled = true;
      return {} as any;
    });

    await processAiJob(message);

    // 15 > 10 (env default MAX_EXTRACTED_EVENTS_PER_POST) truncates to the first 10 (Roundup
    // Event 01..10), then ordinal-assigns them -- their schedule dates are already ascending by
    // construction, so ordinals 0..9 land in the same order.
    assert.strictEqual(sentBodies.length, 10, 'Should enqueue one message per surviving (post-truncation) event');
    assert.ok(markPostExtractedCalled, 'Should mark post extracted once all events enqueued');
    const ordinals = sentBodies.map((b) => b.extractionOrdinal).sort((a, b) => a - b);
    assert.deepStrictEqual(ordinals, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  await t.test('Case N2 (AC7): deterministic ordinal assignment reorders events returned out of chronological order', async () => {
    const message: ProcessingJobMessage = {
      postId: '00000000-0000-4000-8000-0000000000d2',
      accountId: profile.id,
      content: 'Three events, model returns them out of date order',
      postUrl: 'https://test.com/pn2',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    const sentBodies: any[] = [];

    setCallGeminiSeam(async () => {
      return {
        text: JSON.stringify({
          isEvent: true,
          groupingReason: 'separate-events',
          events: [
            {
              eventName: 'September Event',
              types: ['OTHER'],
              categories: ['OTHER'],
              schedules: [{ isMainSchedule: true, eventStartDate: '2026-09-01' }],
              confidenceScore: 0.9
            },
            {
              eventName: 'August First Event',
              types: ['OTHER'],
              categories: ['OTHER'],
              schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-01' }],
              confidenceScore: 0.9
            },
            {
              eventName: 'August Mid Event',
              types: ['OTHER'],
              categories: ['OTHER'],
              schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-15' }],
              confidenceScore: 0.9
            }
          ]
        })
      };
    });

    setSendSqsMessage(async (_queueUrl, body) => {
      sentBodies.push(JSON.parse(body));
    });

    setMarkPostExtractedSeam(async () => ({} as any));

    await processAiJob(message);

    const byName = Object.fromEntries(sentBodies.map((b) => [b.eventName, b.extractionOrdinal]));
    assert.strictEqual(byName['August First Event'], 0, '2026-08-01 is earliest, gets ordinal 0');
    assert.strictEqual(byName['August Mid Event'], 1, '2026-08-15 is next, gets ordinal 1');
    assert.strictEqual(byName['September Event'], 2, '2026-09-01 is latest, gets ordinal 2, not the model response order 0');
  });

  await t.test('Case N3: posts.groupingReason/extractedEventCount/title are persisted after a successful multi-event extraction', async () => {
    const message: ProcessingJobMessage = {
      postId: '00000000-0000-4000-8000-0000000000d3',
      accountId: profile.id,
      content: 'Persist grouping facts check',
      postUrl: 'https://test.com/pn3',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    const [testPost] = await db
      .insert(posts)
      .values({
        id: '00000000-0000-4000-8000-0000000000d3',
        accountId: profile.id,
        platform: 'instagram',
        postUrl: 'https://test.com/pn3',
        content: 'Persist grouping facts check',
        publishedAt: new Date(),
      })
      .returning();

    setCallGeminiSeam(async () => {
      return {
        text: JSON.stringify({
          isEvent: true,
          groupingReason: 'roundup',
          postTitle: '  Weekend Jazz Roundup  ',
          events: [
            {
              eventName: 'Roundup A',
              types: ['OTHER'],
              categories: ['OTHER'],
              schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-01' }],
              confidenceScore: 0.8
            },
            {
              eventName: 'Roundup B',
              types: ['OTHER'],
              categories: ['OTHER'],
              schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-02' }],
              confidenceScore: 0.8
            }
          ]
        })
      };
    });

    setSendSqsMessage(async () => {});
    setMarkPostExtractedSeam(async () => ({} as any));

    try {
      await processAiJob(message);

      const [updatedPost] = await db.select().from(posts).where(eq(posts.id, testPost.id)).limit(1);
      assert.strictEqual(updatedPost.groupingReason, 'roundup');
      assert.strictEqual(updatedPost.extractedEventCount, 2);
      assert.strictEqual(updatedPost.title, 'Weekend Jazz Roundup');
    } finally {
      await db.delete(posts).where(eq(posts.id, testPost.id));
    }
  });

  await t.test('Case N4 (AC7): partial-enqueue-failure retry -- first two sends fail then succeed, processAiJob still completes', async () => {
    const message: ProcessingJobMessage = {
      postId: '00000000-0000-4000-8000-0000000000d4',
      accountId: profile.id,
      content: 'Retry-then-succeed check',
      postUrl: 'https://test.com/pn4',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    let markPostExtractedCalled = false;
    const sentBodies: any[] = [];
    const attemptsByOrdinal: Record<number, number> = {};

    setCallGeminiSeam(async () => {
      return {
        text: JSON.stringify({
          isEvent: true,
          groupingReason: 'separate-events',
          events: [
            {
              eventName: 'Retry Event',
              types: ['OTHER'],
              categories: ['OTHER'],
              schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-01' }],
              confidenceScore: 0.9
            }
          ]
        })
      };
    });

    setSendSqsMessage(async (_queueUrl, body) => {
      const parsed = JSON.parse(body);
      const ordinal = parsed.extractionOrdinal ?? 0;
      attemptsByOrdinal[ordinal] = (attemptsByOrdinal[ordinal] ?? 0) + 1;
      if (attemptsByOrdinal[ordinal] < 3) {
        throw new Error(`Simulated transient SQS failure, attempt ${attemptsByOrdinal[ordinal]}`);
      }
      sentBodies.push(parsed);
    });

    setMarkPostExtractedSeam(async () => {
      markPostExtractedCalled = true;
      return {} as any;
    });

    await processAiJob(message);

    assert.strictEqual(sentBodies.length, 1, 'The single event should eventually be enqueued after retries');
    assert.ok(markPostExtractedCalled, 'Should mark post extracted once the retried send succeeds');
    assert.strictEqual(attemptsByOrdinal[0], 3, 'Should have taken exactly 3 attempts (2 failures + 1 success)');
  });

  await t.test('Case N5 (AC7): enqueue failure exhausts all retries for one event out of three -- throws, not marked, other two still sent', async () => {
    const message: ProcessingJobMessage = {
      postId: '00000000-0000-4000-8000-0000000000d5',
      accountId: profile.id,
      content: 'One event exhausts retries, others still attempted',
      postUrl: 'https://test.com/pn5',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    let markPostExtractedCalled = false;
    const sentOrdinals: number[] = [];

    setCallGeminiSeam(async () => {
      return {
        text: JSON.stringify({
          isEvent: true,
          groupingReason: 'separate-events',
          events: [
            {
              eventName: 'Always Fails Event',
              types: ['OTHER'],
              categories: ['OTHER'],
              schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-01' }],
              confidenceScore: 0.9
            },
            {
              eventName: 'Fine Event Two',
              types: ['OTHER'],
              categories: ['OTHER'],
              schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-02' }],
              confidenceScore: 0.9
            },
            {
              eventName: 'Fine Event Three',
              types: ['OTHER'],
              categories: ['OTHER'],
              schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-03' }],
              confidenceScore: 0.9
            }
          ]
        })
      };
    });

    setSendSqsMessage(async (_queueUrl, body) => {
      const parsed = JSON.parse(body);
      if (parsed.eventName === 'Always Fails Event') {
        throw new Error('Simulated permanent SQS failure');
      }
      sentOrdinals.push(parsed.extractionOrdinal);
    });

    setMarkPostExtractedSeam(async () => {
      markPostExtractedCalled = true;
      return {} as any;
    });

    await assert.rejects(() => processAiJob(message), /event\(s\) failed to enqueue/);

    assert.strictEqual(markPostExtractedCalled, false, 'Should NOT mark post extracted when any event failed to enqueue');
    assert.strictEqual(sentOrdinals.length, 2, 'The other two events should still have been attempted (best-effort, not fail-fast)');
  });

  await t.test('Case N6: single-event payload regression guard -- exactly one SQS send with extractionOrdinal 0, marked extracted', async () => {
    const message: ProcessingJobMessage = {
      postId: '00000000-0000-4000-8000-0000000000d6',
      accountId: profile.id,
      content: 'Single event regression check',
      postUrl: 'https://test.com/pn6',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    let markPostExtractedCalled = false;
    const sentBodies: any[] = [];

    setCallGeminiSeam(async () => {
      return {
        text: JSON.stringify({
          isEvent: true,
          events: [
            {
              eventName: 'Solo Event',
              types: ['OTHER'],
              categories: ['OTHER'],
              schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-01' }],
              confidenceScore: 0.9
            }
          ]
        })
      };
    });

    setSendSqsMessage(async (_queueUrl, body) => {
      sentBodies.push(JSON.parse(body));
    });

    setMarkPostExtractedSeam(async () => {
      markPostExtractedCalled = true;
      return {} as any;
    });

    await processAiJob(message);

    assert.strictEqual(sentBodies.length, 1, 'Should enqueue exactly one message for a single-event payload');
    assert.strictEqual(sentBodies[0].extractionOrdinal, 0);
    assert.ok(markPostExtractedCalled, 'Should mark post extracted');
  });

  await t.test('Case P: isEvent: true with an empty events array is treated like isEvent: false', async () => {
    const message: ProcessingJobMessage = {
      postId: '00000000-0000-4000-8000-00000000000f',
      accountId: profile.id,
      content: 'Model reported true but found nothing',
      postUrl: 'https://test.com/pp',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    let sendSqsMessageCalled = false;
    let markPostExtractedCalled = false;

    setCallGeminiSeam(async () => {
      return {
        text: JSON.stringify({
          isEvent: true,
          events: []
        })
      };
    });

    setSendSqsMessage(async () => {
      sendSqsMessageCalled = true;
    });

    setMarkPostExtractedSeam(async (postId) => {
      markPostExtractedCalled = true;
      assert.strictEqual(postId, '00000000-0000-4000-8000-00000000000f');
      return {} as any;
    });

    await processAiJob(message);

    assert.strictEqual(sendSqsMessageCalled, false, 'Should NOT enqueue when events is empty');
    assert.ok(markPostExtractedCalled, 'Should still mark post extracted, mirroring the isEvent: false path');
  });

  await t.test('Case Q: single-event payload still enqueues exactly one message carrying organizerHandle/applicableDaysOfWeek', async () => {
    const message: ProcessingJobMessage = {
      postId: '00000000-0000-4000-8000-000000000010',
      accountId: profile.id,
      content: 'Weekend Market',
      postUrl: 'https://test.com/pq',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    let sqsBody: any = null;

    setCallGeminiSeam(async () => {
      return {
        text: JSON.stringify({
          isEvent: true,
          groupingReason: 'single-event',
          events: [
            {
              eventName: 'Weekend Market',
              types: ['OTHER'],
              categories: ['OTHER'],
              schedules: [
                {
                  isMainSchedule: true,
                  eventStartDate: '2026-08-15',
                  eventEndDate: '2026-08-31',
                  applicableDaysOfWeek: ['SAT', 'SUN']
                }
              ],
              confidenceScore: 0.9,
              organizerHandle: '@weekendmarket'
            }
          ]
        })
      };
    });

    setSendSqsMessage(async (_queueUrl, body) => {
      sqsBody = JSON.parse(body);
    });

    setMarkPostExtractedSeam(async () => ({} as any));

    await processAiJob(message);

    assert.ok(sqsBody, 'Should enqueue exactly one message for a single-event payload');
    assert.strictEqual(sqsBody.organizerHandle, '@weekendmarket');
    assert.deepStrictEqual(sqsBody.schedules[0].applicableDaysOfWeek, ['SAT', 'SUN']);
  });

  await t.test('Case R (AC6/Task 10.1): exactly one Gemini call per processAiJob call regardless of final event count', async () => {
    const message: ProcessingJobMessage = {
      postId: '00000000-0000-4000-8000-000000000011',
      accountId: profile.id,
      content: 'Multi-event call-count check',
      postUrl: 'https://test.com/pr',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    let callGeminiCallCount = 0;

    setCallGeminiSeam(async () => {
      callGeminiCallCount++;
      return {
        text: JSON.stringify({
          isEvent: true,
          groupingReason: 'separate-events',
          events: [
            {
              eventName: 'Event One',
              types: ['OTHER'],
              categories: ['OTHER'],
              schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-15' }],
              confidenceScore: 0.9
            },
            {
              eventName: 'Event Two',
              types: ['OTHER'],
              categories: ['OTHER'],
              schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-16' }],
              confidenceScore: 0.9
            },
            {
              eventName: 'Event Three',
              types: ['OTHER'],
              categories: ['OTHER'],
              schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-17' }],
              confidenceScore: 0.9
            }
          ]
        })
      };
    });

    setSendSqsMessage(async () => {});
    setMarkPostExtractedSeam(async () => ({} as any));

    await processAiJob(message);

    assert.strictEqual(callGeminiCallCount, 1, 'processAiJob must call Gemini exactly once per post, regardless of how many events come back (AD-13)');
  });
});

