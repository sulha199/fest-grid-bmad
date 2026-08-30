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
import { type ProcessingJobMessage } from '@festgrid/domain/posts';
import { AiGatewayExhaustedError } from '../ai-gateway/adapter.js';

// Force off regardless of the developer's local .env: Case F below relies on
// processAiJob throwing when DATA_INGESTION_QUEUE_URL is unset, which the
// local-dev inline-fallback path would otherwise swallow.
process.env.DATA_INGESTION_INLINE_FALLBACK_ENABLED = 'false';

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
      postId: 'post-rehost-g1',
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

    setSendSqsMessage(async () => {});
    setMarkPostExtractedSeam(async () => ({} as any));

    setRehostPostImageSeam(async (postId, imageBytes, imageContentType) => {
      rehostCalledWith = { postId, imageBytes, imageContentType };
      return 'https://cdn.test.com/posts/post-rehost-g1';
    });

    await processAiJob(message);

    assert.ok(rehostCalledWith);
    assert.strictEqual(rehostCalledWith.postId, 'post-rehost-g1');
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
      postId: 'post-rehost-g2',
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
          eventName: '',
          types: [],
          categories: [],
          schedules: [],
          confidenceScore: 0.99
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
      postId: 'post-process-j',
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
      postId: 'post-process-k',
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
      postId: 'post-process-l',
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
});

