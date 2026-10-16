import test from 'node:test';
import * as assert from 'node:assert';
import { createSchema, createYoga } from 'graphql-yoga';
import { resolvers } from './resolvers.js';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/client.js';
import { users, posts, apiKeys, socialMediaAccountProfiles, subscriptions, manualExtractionJobs, vendorCallLocks, postAccountAssociations } from '@festgrid/database';
import { and, eq, desc, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import '../lib/scraper/register-adapters.js';
import { callGeminiGenerateContent, setCallGeminiGenerateContent } from '../lib/ai-gateway/gemini-client.js';
import { callApifyActor, setCallApifyActor } from '../lib/scraper/instagram-adapter.js';
import { sendSqsMessage, setSendSqsMessage } from '../lib/aws/send-sqs-message.js';
import { invokeAiProcessor, setInvokeAiProcessor } from '../lib/aws/invoke-ai-processor.js';
import { processManualExtractionJob } from '../lib/ai-processor/process-manual-extraction-job.js';
import { clearApifyProviderUsage } from '../lib/scraper/usage-store-test-helpers.js';

const schemaDir = path.resolve(process.cwd(), 'src/schema');
const files = fs.readdirSync(schemaDir).filter(f => f.endsWith('.graphql'));
const typeDefs = files.map(f => fs.readFileSync(path.join(schemaDir, f), 'utf8')).join('\n');

const schema = createSchema({
  typeDefs: `
    ${typeDefs}
    type Query {
      health: Boolean
    }
  `,
  resolvers: resolvers as any
});

let mockUser: any = null;

const yoga = createYoga({
  schema,
  context: () => ({
    user: mockUser,
  }) as any,
});

test('extractEventDataFromUrl resolver integration', async (t) => {
  const originalCallGeminiGenerateContent = callGeminiGenerateContent;
  const originalCallApifyActor = callApifyActor;
  const originalSendSqsMessage = sendSqsMessage;
  const originalInvokeAiProcessor = invokeAiProcessor;
  const originalAiProcessorFunctionName = process.env.AI_PROCESSOR_FUNCTION_NAME;

  // Story 4.2b -- the mutation hands off to the AI Lambda via an async invoke; capture it here
  // and run the AI-Lambda half (processManualExtractionJob) explicitly, so each test exercises
  // enqueue -> process -> poll end to end against the real DB.
  process.env.AI_PROCESSOR_FUNCTION_NAME = 'mock-ai-processor-fn';
  const invokedJobIds: string[] = [];
  setInvokeAiProcessor(async (_fn, payload) => {
    invokedJobIds.push(payload.jobId);
  });

  const POLL_QUERY = `
    query ExtractionJob($id: ID!) {
      extractionJob(id: $id) {
        status
        data { eventName types categories schedules { id isMainSchedule eventStartDate title } }
        errorCode
        errorMessage
      }
    }
  `;
  async function pollJob(jobId: string) {
    const res = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: POLL_QUERY, variables: { id: jobId } }),
    });
    return res.json();
  }

  let testUser: any;
  let existingPost: any;
  let testApiKey: any;
  let testProfile: any;

  // This test file exercises the real Apify capacity gate (via extractEventDataFromUrl's
  // new-post scrape path) but doesn't own scraper_provider_usage. Clear any leftover 'apify'
  // row up front — both to self-heal from a previous run that crashed before its own cleanup
  // ran, and because the "new post path" subtest below records real usage against this same
  // row (see t.after cleanup). See deferred-work.md, "quick-dev fix of scraper-provider-usage
  // test pollution".
  await clearApifyProviderUsage();

  await t.test('setup - get test data', async () => {
    // Self-heal from dirty state
    await db.delete(posts).where(eq(posts.postUrl, 'https://instagram.com/p/existing123'));

    // 1. Create a dedicated test user for this test file to avoid concurrent interference
    const [insertedUser] = await db.insert(users).values({
      email: `extraction-test-${Date.now()}-${Math.random()}@example.com`,
      role: 'user',
    }).returning();
    testUser = insertedUser;

    // 1.5 Create a profile for the post's accountId FK with explicit UUID
    const profileId = randomUUID();
    const [insertedProfile] = await db.insert(socialMediaAccountProfiles).values({
      id: profileId,
      platform: 'instagram',
      accountId: 'fake-acc-' + Date.now(),
      username: 'fake_username',
      displayName: 'Fake Display Name',
    }).returning();
    testProfile = insertedProfile;

    // 2. Insert/Get an existing post to test existing post path
    const [insertedPost] = await db.insert(posts).values({
      accountId: profileId,
      platform: 'instagram',
      content: 'This is a mock post with event details for existing path.',
      postUrl: 'https://instagram.com/p/existing123',
      originalPostUrl: 'https://instagram.com/p/existing_original123',
      publishedAt: new Date(),
    }).returning();
    existingPost = insertedPost;

    // 3. Ensure test user has a valid apiKey for Gemini TIER_1
    const [insertedKey] = await db.insert(apiKeys).values({
      userId: testUser.id,
      provider: 'gemini',
      keyEncrypted: 'mock-encrypted-key',
      keyLast4: '1234',
      isValid: true,
      invalidAttempts: 0,
    }).returning();
    testApiKey = insertedKey;
  });

  t.after(async () => {
    if (testApiKey) {
      // processManualExtractionJob above runs through the real adapter.ts callGemini wrapper
      // (only the inner callGeminiGenerateContent network call is mocked) -- that wrapper's
      // guarded-call lease claim/release leaves a permanent `vendor_call_locks` row behind,
      // keyed by this key's id. Delete it before the key row itself.
      await db.delete(vendorCallLocks).where(eq(vendorCallLocks.lockKey, `gemini:key:${testApiKey.id}`));
      await db.delete(apiKeys).where(eq(apiKeys.id, testApiKey.id));
    }
    if (existingPost) {
      await db.delete(posts).where(eq(posts.id, existingPost.id));
    }
    if (testProfile) {
      await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, testProfile.id));
    }
    if (testUser) {
      await db.delete(users).where(eq(users.id, testUser.id));
    }
    // The "new post path" subtest above records real Apify usage against this row; clear it so
    // this file doesn't leave a row behind for whichever test file runs next.
    await clearApifyProviderUsage();
    setCallGeminiGenerateContent(originalCallGeminiGenerateContent);
    setCallApifyActor(originalCallApifyActor);
    setSendSqsMessage(originalSendSqsMessage);
    setInvokeAiProcessor(originalInvokeAiProcessor);
    if (originalAiProcessorFunctionName === undefined) delete process.env.AI_PROCESSOR_FUNCTION_NAME;
    else process.env.AI_PROCESSOR_FUNCTION_NAME = originalAiProcessorFunctionName;
    await db.delete(manualExtractionJobs).where(eq(manualExtractionJobs.requestedByUserId, testUser?.id ?? randomUUID()));
  });

  await t.test('extractEventDataFromUrl - unauthenticated rejected', async () => {
    mockUser = null;
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ExtractEventDataFromUrl($url: String!) {
            extractEventDataFromUrl(url: $url) {
              data {
                eventName
              }
              errorCode
              errorMessage
            }
          }
        `,
        variables: {
          url: 'https://instagram.com/p/existing123',
        }
      })
    });

    const result = await response.json();
    assert.ok(result.errors, 'should return errors');
    assert.strictEqual(result.errors[0].extensions?.code, 'UNAUTHENTICATED');
  });

  await t.test('extractEventDataFromUrl - existing post path with valid key successfully extracts data', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    setCallGeminiGenerateContent(async (key, req) => {
      return {
        text: JSON.stringify({
          isEvent: true,
          events: [
            {
              eventName: 'Existing Path Festival',
              types: ['PERFORMANCE'],
              categories: ['MUSIC'],
              confidenceScore: 0.9,
              schedules: [
                {
                  isMainSchedule: true,
                  eventStartDate: '2026-09-01',
                  title: 'Main stage'
                }
              ]
            }
          ]
        })
      };
    });

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ExtractEventDataFromUrl($url: String!) {
            extractEventDataFromUrl(url: $url) {
              jobId
              data {
                eventName
                types
                categories
                schedules {
                  id
                  isMainSchedule
                  eventStartDate
                  title
                }
              }
              errorCode
              errorMessage
            }
          }
        `,
        variables: {
          url: 'https://instagram.com/p/existing123',
        }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, 'should not have errors');
    const started = result.data.extractEventDataFromUrl;
    assert.ok(started.jobId, 'mutation should return a jobId');
    assert.strictEqual(started.data, null, 'the extraction itself is no longer returned inline (Story 4.2b)');
    assert.strictEqual(started.errorCode, null);
    assert.deepStrictEqual(invokedJobIds.slice(-1), [started.jobId], 'the AI Lambda should have been async-invoked once for this job');

    // Before the AI Lambda runs the job is PENDING; the stored payload carries the TIER_2 fallback account.
    const pending = await pollJob(started.jobId);
    assert.strictEqual(pending.data.extractionJob.status, 'PENDING');
    const [jobRow] = await db.select().from(manualExtractionJobs).where(eq(manualExtractionJobs.id, started.jobId));
    assert.strictEqual(jobRow.requestPayload.existingPostAccountId, existingPost.accountId);
    assert.strictEqual(jobRow.requestPayload.message.postId, existingPost.id);

    await processManualExtractionJob(started.jobId);
    const done = await pollJob(started.jobId);
    assert.ok(!done.errors, 'should not have errors');
    assert.strictEqual(done.data.extractionJob.status, 'SUCCEEDED');
    assert.strictEqual(done.data.extractionJob.data.eventName, 'Existing Path Festival');
    assert.strictEqual(done.data.extractionJob.data.schedules[0].id, null);
  });

  await t.test('extractEventDataFromUrl - new post path unrecognized platform returns UNSUPPORTED_PLATFORM', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ExtractEventDataFromUrl($url: String!) {
            extractEventDataFromUrl(url: $url) {
              errorCode
              errorMessage
            }
          }
        `,
        variables: {
          url: 'https://unsupported-site.com/post/123',
        }
      })
    });

    const result = await response.json();
    assert.strictEqual(result.data.extractEventDataFromUrl.errorCode, 'UNSUPPORTED_PLATFORM');
  });

  await t.test('extractEventDataFromUrl - new post path successfully scrapes and extracts', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    setCallApifyActor(async (input: any) => {
      return [
        {
          timestamp: '2026-08-11T00:00:00Z',
          url: 'https://instagram.com/p/new_pasted_123',
          caption: 'Brand new event announced on instagram!',
        }
      ];
    });

    setCallGeminiGenerateContent(async (key, req) => {
      return {
        text: JSON.stringify({
          isEvent: true,
          events: [
            {
              eventName: 'New Pasted Event',
              types: ['PERFORMANCE'],
              categories: ['MUSIC'],
              confidenceScore: 0.95,
              schedules: [
                {
                  isMainSchedule: true,
                  eventStartDate: '2026-10-10',
                  title: 'Only Schedule'
                }
              ]
            }
          ]
        })
      };
    });

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ExtractEventDataFromUrl($url: String!) {
            extractEventDataFromUrl(url: $url) {
              jobId
              data {
                eventName
                types
                categories
                schedules {
                  isMainSchedule
                  eventStartDate
                  title
                }
              }
              errorCode
              errorMessage
            }
          }
        `,
        variables: {
          url: 'https://instagram.com/p/new_pasted_123',
        }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, 'should not have errors');
    const started = result.data.extractEventDataFromUrl;
    assert.ok(started.jobId, 'mutation should return a jobId');
    const [jobRow] = await db.select().from(manualExtractionJobs).where(eq(manualExtractionJobs.id, started.jobId));
    assert.strictEqual(jobRow.requestPayload.existingPostAccountId, undefined, 'new-post jobs have no TIER_2 fallback account');
    assert.strictEqual(jobRow.requestPayload.message.content, 'Brand new event announced on instagram!');

    await processManualExtractionJob(started.jobId);
    const done = await pollJob(started.jobId);
    assert.strictEqual(done.data.extractionJob.status, 'SUCCEEDED');
    assert.strictEqual(done.data.extractionJob.data.eventName, 'New Pasted Event');
  });

  await t.test('extractEventDataFromUrl - isEvent false returns EXTRACTION_FAILED', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    setCallGeminiGenerateContent(async (key, req) => {
      return {
        text: JSON.stringify({
          isEvent: false,
          events: []
        })
      };
    });

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ExtractEventDataFromUrl($url: String!) {
            extractEventDataFromUrl(url: $url) {
              jobId
              errorCode
              errorMessage
            }
          }
        `,
        variables: {
          url: 'https://instagram.com/p/existing123',
        }
      })
    });

    const result = await response.json();
    const started = result.data.extractEventDataFromUrl;
    assert.ok(started.jobId, 'the failure is discovered asynchronously, so the mutation still returns a jobId');
    await processManualExtractionJob(started.jobId);
    const done = await pollJob(started.jobId);
    assert.strictEqual(done.data.extractionJob.status, 'FAILED');
    assert.strictEqual(done.data.extractionJob.errorCode, 'EXTRACTION_FAILED');
    assert.strictEqual(done.data.extractionJob.errorMessage, 'The linked post does not appear to describe an event.');
  });

  await t.test('extractEventDataFromUrl - existing post with null content returns EXTRACTION_FAILED', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    await db.update(posts).set({ content: null }).where(eq(posts.id, existingPost.id));

    try {
      const response = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation ExtractEventDataFromUrl($url: String!) {
              extractEventDataFromUrl(url: $url) {
                errorCode
                errorMessage
              }
            }
          `,
          variables: {
            url: 'https://instagram.com/p/existing123',
          }
        })
      });

      const result = await response.json();
      assert.strictEqual(result.data.extractEventDataFromUrl.errorCode, 'EXTRACTION_FAILED');
      assert.strictEqual(result.data.extractEventDataFromUrl.errorMessage, 'The source post content has been removed for privacy compliance.');
    } finally {
      await db.update(posts).set({ content: 'This is a mock post with event details for existing path.' }).where(eq(posts.id, existingPost.id));
    }
  });

  // ---- Story 4.2b: job lifecycle unhappy paths ----

  const START_MUTATION = `
    mutation ($url: String!) {
      extractEventDataFromUrl(url: $url) { jobId errorCode errorMessage data { eventName } }
    }
  `;
  async function startExtraction(url: string) {
    const res = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: START_MUTATION, variables: { url } }),
    });
    return res.json();
  }

  await t.test('extractEventDataFromUrl - a failing async invoke returns EXTRACTION_FAILED and marks the job FAILED', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };
    setInvokeAiProcessor(async () => {
      throw new Error('lambda:InvokeFunction denied');
    });
    try {
      const result = await startExtraction('https://instagram.com/p/existing123');
      const started = result.data.extractEventDataFromUrl;
      assert.strictEqual(started.jobId, null);
      assert.strictEqual(started.errorCode, 'EXTRACTION_FAILED');
      const [row] = await db
        .select()
        .from(manualExtractionJobs)
        .where(eq(manualExtractionJobs.requestedByUserId, testUser.id))
        .orderBy(desc(manualExtractionJobs.createdAt))
        .limit(1);
      assert.strictEqual(row.status, 'FAILED');
      assert.strictEqual(row.errorCode, 'EXTRACTION_FAILED');
    } finally {
      setInvokeAiProcessor(async (_fn, payload) => {
        invokedJobIds.push(payload.jobId);
      });
    }
  });

  await t.test('extractEventDataFromUrl - missing AI_PROCESSOR_FUNCTION_NAME fails closed, no invoke attempted', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };
    const saved = process.env.AI_PROCESSOR_FUNCTION_NAME;
    delete process.env.AI_PROCESSOR_FUNCTION_NAME;
    const before = invokedJobIds.length;
    try {
      const result = await startExtraction('https://instagram.com/p/existing123');
      assert.strictEqual(result.data.extractEventDataFromUrl.errorCode, 'EXTRACTION_FAILED');
      assert.strictEqual(invokedJobIds.length, before);
    } finally {
      process.env.AI_PROCESSOR_FUNCTION_NAME = saved;
    }
  });

  await t.test('extractionJob - unauthenticated rejected; another user\'s job and unknown ids are NOT_FOUND', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };
    const started = (await startExtraction('https://instagram.com/p/existing123')).data.extractEventDataFromUrl;

    const [otherUser] = await db.insert(users).values({
      email: `extraction-other-${Date.now()}-${Math.random()}@example.com`,
      role: 'user',
    }).returning();
    try {
      mockUser = { userId: otherUser.id, role: otherUser.role };
      const foreign = await pollJob(started.jobId);
      assert.strictEqual(foreign.errors[0].extensions?.code, 'NOT_FOUND');
      const unknown = await pollJob(randomUUID());
      assert.strictEqual(unknown.errors[0].extensions?.code, 'NOT_FOUND');

      mockUser = null;
      const anon = await pollJob(started.jobId);
      assert.strictEqual(anon.errors[0].extensions?.code, 'UNAUTHENTICATED');
    } finally {
      await db.delete(users).where(eq(users.id, otherUser.id));
    }
  });

  await t.test('extractionJob - a PENDING or PROCESSING job older than 5 minutes is reported FAILED (no stuck spinner)', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };
    const stale = new Date(Date.now() - 6 * 60 * 1000);
    for (const status of ['PENDING', 'PROCESSING'] as const) {
      const [job] = await db.insert(manualExtractionJobs).values({
        requestedByUserId: testUser.id,
        sourceUrl: 'https://instagram.com/p/stale',
        requestPayload: { message: { postId: randomUUID(), accountId: '', content: 'x', postUrl: 'https://instagram.com/p/stale', publishedAt: '2026-08-29T10:24:17Z' } },
        status,
        createdAt: stale,
      }).returning();
      const result = await pollJob(job.id);
      assert.strictEqual(result.data.extractionJob.status, 'FAILED', status);
      assert.strictEqual(result.data.extractionJob.errorCode, 'EXTRACTION_FAILED', status);
    }
  });

  await t.test('extractionJob - a fresh PENDING job stays PENDING, and a finished job is never overwritten by the sweep', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };
    const mk = (status: 'PENDING' | 'SUCCEEDED', createdAt?: Date) =>
      db.insert(manualExtractionJobs).values({
        requestedByUserId: testUser.id,
        sourceUrl: 'https://instagram.com/p/fresh',
        requestPayload: { message: { postId: randomUUID(), accountId: '', content: 'x', postUrl: 'https://instagram.com/p/fresh', publishedAt: '2026-08-29T10:24:17Z' } },
        status,
        resultData:
          status === 'SUCCEEDED'
            ? { eventName: 'Done Long Ago', types: ['PERFORMANCE'], categories: ['MUSIC'], location: 'Somewhere', schedules: [{ isMainSchedule: true, eventStartDate: '2026-10-10' }] }
            : null,
        ...(createdAt ? { createdAt } : {}),
      }).returning();
    const [fresh] = await mk('PENDING');
    assert.strictEqual((await pollJob(fresh.id)).data.extractionJob.status, 'PENDING');
    const [oldDone] = await mk('SUCCEEDED', new Date(Date.now() - 60 * 60 * 1000));
    const done = await pollJob(oldDone.id);
    assert.strictEqual(done.data.extractionJob.status, 'SUCCEEDED');
    assert.strictEqual(done.data.extractionJob.data.eventName, 'Done Long Ago');
  });
});

test('manual post selection & extraction integration tests', async (t) => {
  let testUser: any;
  let testProfile: any;
  let testSubscription: any;
  let testApiKey: any;
  let oldPost: any;
  let recentPost: any;
  let otherUser: any;
  let otherPost: any;
  let otherApiKey: any;
  let partialFailureFirstPost: any;
  let partialFailureSecondPost: any;
  let partialFailureAlreadyExtractedPost: any;

  await t.test('setup - manual post selection test data', async () => {
    process.env.AI_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789012/mock-queue';
    process.env.AWS_REGION = 'us-east-1';
    setSendSqsMessage(async () => {});

    // User
    const [insertedUser] = await db.insert(users).values({
      email: `mps-test-${Date.now()}-${Math.random()}@example.com`,
      role: 'user',
    }).returning();
    testUser = insertedUser;

    // Profile
    const profileId = randomUUID();
    const [insertedProfile] = await db.insert(socialMediaAccountProfiles).values({
      id: profileId,
      platform: 'instagram',
      accountId: 'mps-acc-' + Date.now(),
      username: 'mps_username',
      displayName: 'MPS Display Name',
    }).returning();
    testProfile = insertedProfile;

    // Subscription
    const [insertedSub] = await db.insert(subscriptions).values({
      id: randomUUID(),
      userId: testUser.id,
      accountId: testProfile.id,
      isNewlyAdded: true,
    }).returning();
    testSubscription = insertedSub;

    // Gemini API Key
    const [insertedKey] = await db.insert(apiKeys).values({
      userId: testUser.id,
      provider: 'gemini',
      keyEncrypted: 'mps-mock-encrypted-key',
      keyLast4: '9999',
      isValid: true,
      invalidAttempts: 0,
      usageCount: 10, // 10 used
      usageCycleResetAt: new Date(), // cycle not reset
    }).returning();
    testApiKey = insertedKey;

    // Old Post (35 days ago)
    const thirtyFiveDaysAgo = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
    const [insertedOldPost] = await db.insert(posts).values({
      accountId: testProfile.id,
      platform: 'instagram',
      content: 'This is an old post',
      postUrl: `https://instagram.com/p/old123-${Date.now()}-${Math.random()}`,
      publishedAt: thirtyFiveDaysAgo,
    }).returning();
    oldPost = insertedOldPost;
  });

  t.after(async () => {
    if (partialFailureFirstPost) {
      await db.delete(posts).where(eq(posts.id, partialFailureFirstPost.id));
    }
    if (partialFailureSecondPost) {
      await db.delete(posts).where(eq(posts.id, partialFailureSecondPost.id));
    }
    if (partialFailureAlreadyExtractedPost) {
      await db.delete(posts).where(eq(posts.id, partialFailureAlreadyExtractedPost.id));
    }
    if (otherPost) {
      await db.delete(posts).where(eq(posts.id, otherPost.id));
    }
    if (recentPost) {
      await db.delete(posts).where(eq(posts.id, recentPost.id));
    }
    if (oldPost) {
      await db.delete(posts).where(eq(posts.id, oldPost.id));
    }
    if (otherApiKey) {
      await db.delete(apiKeys).where(eq(apiKeys.id, otherApiKey.id));
    }
    if (testApiKey) {
      await db.delete(apiKeys).where(eq(apiKeys.id, testApiKey.id));
    }
    if (testSubscription) {
      await db.delete(subscriptions).where(eq(subscriptions.id, testSubscription.id));
    }
    if (testProfile) {
      await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, testProfile.id));
    }
    if (otherUser) {
      await db.delete(users).where(eq(users.id, otherUser.id));
    }
    if (testUser) {
      await db.delete(users).where(eq(users.id, testUser.id));
    }
  });

  await t.test('Subscription.isInactive resolves to true if the account was scraped recently and its posts are older than 30 days', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };
    // Story 5.4a: an account that has never been scraped is not inactive, so the fixture needs a recent
    // completed scrape for "no recent posts" to mean something. Restored below.
    await db.update(socialMediaAccountProfiles).set({ lastScrapedAt: new Date() }).where(eq(socialMediaAccountProfiles.id, testProfile.id));

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query MySubscriptions {
            mySubscriptions {
              id
              isInactive
            }
          }
        `
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, 'should not have errors');
    const sub = result.data.mySubscriptions.find((s: any) => s.id === testSubscription.id);
    assert.ok(sub);
    assert.strictEqual(sub.isInactive, true);
    await db.update(socialMediaAccountProfiles).set({ lastScrapedAt: null }).where(eq(socialMediaAccountProfiles.id, testProfile.id));
  });

  await t.test('Subscription.isInactive resolves to false if there is a post within 30 days', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    // Insert recent post
    const [insertedRecentPost] = await db.insert(posts).values({
      accountId: testProfile.id,
      platform: 'instagram',
      content: 'This is a recent post',
      postUrl: `https://instagram.com/p/recent123-${Date.now()}-${Math.random()}`,
      publishedAt: new Date(),
    }).returning();
    recentPost = insertedRecentPost;

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query MySubscriptions {
            mySubscriptions {
              id
              isInactive
            }
          }
        `
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, 'should not have errors');
    const sub = result.data.mySubscriptions.find((s: any) => s.id === testSubscription.id);
    assert.ok(sub);
    assert.strictEqual(sub.isInactive, false);
  });

  await t.test('markSubscriptionViewed sets isNewlyAdded to false', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation MarkSubscriptionViewed($id: ID!) {
            markSubscriptionViewed(subscriptionId: $id) {
              id
              isNewlyAdded
            }
          }
        `,
        variables: { id: testSubscription.id }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, 'should not have errors');
    assert.strictEqual(result.data.markSubscriptionViewed.isNewlyAdded, false);
  });

  await t.test('myExtractionQuota returns limits and remaining', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query MyExtractionQuota {
            myExtractionQuota {
              limit
              used
              remaining
            }
          }
        `
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, 'should not have errors');
    assert.strictEqual(result.data.myExtractionQuota.limit, 300);
    assert.strictEqual(result.data.myExtractionQuota.used, 10);
    assert.strictEqual(result.data.myExtractionQuota.remaining, 290);
  });

  await t.test('postsByAccount retrieves posts for account with cursor-based pagination', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query PostsByAccount($accountId: ID!, $limit: Int) {
            postsByAccount(accountId: $accountId, limit: $limit) {
              items {
                id
                publishedAt
              }
              hasMore
              nextCursor
            }
          }
        `,
        variables: { accountId: testProfile.id, limit: 1 }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, 'should not have errors');
    assert.strictEqual(result.data.postsByAccount.items.length, 1);
    assert.strictEqual(result.data.postsByAccount.hasMore, true);
    assert.ok(result.data.postsByAccount.nextCursor);
  });

  await t.test('postsByAccount onlyUnextracted hides extracted posts and keeps pagination full', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };
    const query = `
      query PostsByAccount($accountId: ID!, $limit: Int, $onlyUnextracted: Boolean) {
        postsByAccount(accountId: $accountId, limit: $limit, onlyUnextracted: $onlyUnextracted) {
          items { id isExtracted }
          hasMore
        }
      }
    `;
    const run = async (variables: Record<string, unknown>) => {
      const response = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { accountId: testProfile.id, limit: 100, ...variables } })
      });
      const result = await response.json();
      assert.ok(!result.errors, 'should not have errors');
      return result.data.postsByAccount.items as Array<{ id: string; isExtracted: boolean }>;
    };

    // Flip one existing post to extracted (update only -- no rows created) and restore it afterwards.
    const [target] = await db.select().from(posts).where(and(eq(posts.accountId, testProfile.id), eq(posts.isExtracted, false))).limit(1);
    assert.ok(target, 'needs at least one un-extracted post for the profile');
    await db.update(posts).set({ isExtracted: true }).where(eq(posts.id, target.id));
    try {
      const unfiltered = await run({});
      assert.ok(unfiltered.some((p) => p.id === target.id), 'default call still returns extracted posts');

      const filtered = await run({ onlyUnextracted: true });
      assert.ok(!filtered.some((p) => p.id === target.id), 'extracted post is hidden');
      assert.ok(filtered.every((p) => p.isExtracted === false), 'only un-extracted posts are returned');
      assert.strictEqual(filtered.length, unfiltered.length - unfiltered.filter((p) => p.isExtracted).length);
    } finally {
      await db.update(posts).set({ isExtracted: false }).where(eq(posts.id, target.id));
    }
  });

  await t.test('postsByAccount next-page cursor works and never skips posts that share a timestamp', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    const [pagingProfile] = await db.insert(socialMediaAccountProfiles).values({
      accountId: `paging-${Date.now()}-${Math.random()}`,
      platform: 'instagram',
      username: 'paging-test-account',
      displayName: 'Paging Test Account',
    }).returning();
    const [pagingSub] = await db.insert(subscriptions).values({
      userId: testUser.id,
      accountId: pagingProfile.id,
    }).returning();
    const sameInstant = new Date('2026-01-01T10:00:00.000Z');
    const created = await db.insert(posts).values(
      [0, 1, 2].map((i) => ({
        accountId: pagingProfile.id,
        platform: 'instagram',
        content: `same-timestamp post ${i}`,
        postUrl: `https://instagram.com/p/paging-${i}-${Date.now()}-${Math.random()}`,
        publishedAt: sameInstant,
      }))
    ).returning();
    const olderPost = (await db.insert(posts).values({
      accountId: pagingProfile.id,
      platform: 'instagram',
      content: 'older post',
      postUrl: `https://instagram.com/p/paging-old-${Date.now()}-${Math.random()}`,
      publishedAt: new Date('2025-12-31T10:00:00.000Z'),
    }).returning())[0];

    try {
      const query = `
        query PostsByAccount($accountId: ID!, $cursor: String, $limit: Int) {
          postsByAccount(accountId: $accountId, cursor: $cursor, limit: $limit) {
            items { id }
            nextCursor
            hasMore
          }
        }
      `;
      const seen: string[] = [];
      let cursor: string | null = null;
      for (let guard = 0; guard < 10; guard++) {
        const response: Response = await yoga.fetch('http://yoga/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, variables: { accountId: pagingProfile.id, limit: 1, cursor } })
        });
        const result: any = await response.json();
        assert.ok(!result.errors, 'next page must not error: ' + JSON.stringify(result.errors));
        seen.push(...result.data.postsByAccount.items.map((p: { id: string }) => p.id));
        if (!result.data.postsByAccount.hasMore) break;
        cursor = result.data.postsByAccount.nextCursor;
      }
      assert.strictEqual(new Set(seen).size, seen.length, 'no post is returned twice');
      assert.deepStrictEqual(
        [...seen].sort(),
        [...created.map((p) => p.id), olderPost.id].sort(),
        'every post is returned exactly once across pages'
      );

      // A bare ISO cursor (the previous format) is still accepted.
      const legacy = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { accountId: pagingProfile.id, limit: 10, cursor: sameInstant.toISOString() } })
      });
      const legacyResult = await legacy.json();
      assert.ok(!legacyResult.errors, 'legacy cursor accepted');
      assert.deepStrictEqual(legacyResult.data.postsByAccount.items.map((p: { id: string }) => p.id), [olderPost.id]);
    } finally {
      await db.delete(posts).where(eq(posts.accountId, pagingProfile.id));
      await db.delete(subscriptions).where(eq(subscriptions.id, pagingSub.id));
      await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, pagingProfile.id));
    }
  });

  await t.test('postsByAccount and selectPostsForExtraction cover a post stored under a twin profile but scraped under the subscribed account', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    // Subscribing keys the profile by username while publisher resolution keys it by the vendor's
    // numeric owner id, so a scrape's posts can land on a twin row the subscriber never subscribed
    // to. The post's SCRAPING_SOURCE association still points at the subscribed profile.
    const [twinProfile] = await db.insert(socialMediaAccountProfiles).values({
      accountId: `twin-numeric-${Date.now()}-${Math.random()}`,
      platform: 'instagram',
      username: 'twin-of-test-profile',
      displayName: 'Twin Of Test Profile',
    }).returning();
    const [twinPost] = await db.insert(posts).values({
      accountId: twinProfile.id,
      platform: 'instagram',
      content: 'post stored under the twin profile',
      postUrl: `https://instagram.com/p/twin-post-${Date.now()}-${Math.random()}`,
      publishedAt: new Date(),
    }).returning();
    await db.insert(postAccountAssociations).values({
      postId: twinPost.id,
      accountId: testProfile.id,
      role: 'SCRAPING_SOURCE',
    });

    try {
      const listResponse = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query PostsByAccount($accountId: ID!) {
              postsByAccount(accountId: $accountId, limit: 100, onlyUnextracted: true) {
                items { id }
              }
            }
          `,
          variables: { accountId: testProfile.id }
        })
      });
      const listResult = await listResponse.json();
      assert.ok(!listResult.errors, 'should not have errors');
      assert.ok(
        listResult.data.postsByAccount.items.some((p: { id: string }) => p.id === twinPost.id),
        'the twin-owned post scraped under the subscribed account is listed'
      );

      const selectResponse = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation SelectPosts($postIds: [ID!]!) {
              selectPostsForExtraction(postIds: $postIds) {
                id
              }
            }
          `,
          variables: { postIds: [twinPost.id] }
        })
      });
      const selectResult = await selectResponse.json();
      assert.ok(!selectResult.errors, 'selecting it for extraction is not FORBIDDEN: ' + JSON.stringify(selectResult.errors));
      assert.strictEqual(selectResult.data.selectPostsForExtraction[0].id, twinPost.id);
    } finally {
      await db.delete(postAccountAssociations).where(eq(postAccountAssociations.postId, twinPost.id));
      await db.delete(posts).where(eq(posts.id, twinPost.id));
      await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, twinProfile.id));
    }
  });

  await t.test('postsByAccount filters by extraction status and returns the status of each post (PRD 3.10)', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };
    const [statusProfile] = await db.insert(socialMediaAccountProfiles).values({
      accountId: `status-${Date.now()}-${Math.random()}`,
      platform: 'instagram',
      username: 'status-filter-account',
      displayName: 'Status Filter Account',
    }).returning();
    const [statusSub] = await db.insert(subscriptions).values({ userId: testUser.id, accountId: statusProfile.id }).returning();
    const mk = async (tag: string, values: Partial<typeof posts.$inferInsert>) => (await db.insert(posts).values({
      accountId: statusProfile.id,
      platform: 'instagram',
      content: tag,
      postUrl: `https://instagram.com/p/status-${tag}-${Date.now()}-${Math.random()}`,
      publishedAt: new Date(),
      ...values,
    }).returning())[0];

    try {
      const pending = await mk('pending', {});
      const queued = await mk('queued', { queuedForExtractionAt: new Date() });
      const extracting = await mk('extracting', { queuedForExtractionAt: new Date(Date.now() - 2000), extractionStartedAt: new Date() });
      const promoted = await mk('promoted', { isExtracted: true, extractedEventCount: 1 });
      const notEvent = await mk('notevent', { isExtracted: true });

      const run = async (statuses?: string[]) => {
        const response = await yoga.fetch('http://yoga/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `query($accountId: ID!, $statuses: [PostExtractionStatus!]) {
              postsByAccount(accountId: $accountId, limit: 100, statuses: $statuses) { items { id extractionStatus } }
            }`,
            variables: { accountId: statusProfile.id, statuses },
          })
        });
        const result: any = await response.json();
        assert.ok(!result.errors, 'should not have errors: ' + JSON.stringify(result.errors));
        return new Map<string, string>(result.data.postsByAccount.items.map((p: any) => [p.id, p.extractionStatus]));
      };

      const all = await run();
      assert.strictEqual(all.size, 5, 'no filter lists every post');
      assert.strictEqual(all.get(pending.id), 'PENDING');
      assert.strictEqual(all.get(queued.id), 'QUEUED');
      assert.strictEqual(all.get(extracting.id), 'EXTRACTING');
      assert.strictEqual(all.get(promoted.id), 'PROMOTED');
      assert.strictEqual(all.get(notEvent.id), 'NOT_EVENT');

      assert.deepStrictEqual([...(await run(['PENDING'])).keys()], [pending.id]);
      assert.deepStrictEqual([...(await run(['PROMOTED', 'NOT_EVENT'])).keys()].sort(), [promoted.id, notEvent.id].sort());
      assert.strictEqual((await run([])).size, 5, 'an empty filter means every status');
    } finally {
      await db.delete(posts).where(eq(posts.accountId, statusProfile.id));
      await db.delete(subscriptions).where(eq(subscriptions.id, statusSub.id));
      await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, statusProfile.id));
    }
  });

  await t.test('a co-authored post is one post across both accounts: listed in each tab, selectable by a subscriber of only the co-author, queued once', async () => {
    const stamp = `${Date.now()}-${Math.random()}`;
    const [publisher] = await db.insert(socialMediaAccountProfiles).values({
      accountId: `co-pub-${stamp}`, platform: 'instagram', username: `co-pub-${stamp}`, displayName: 'Co Publisher',
    }).returning();
    const [coauthor] = await db.insert(socialMediaAccountProfiles).values({
      accountId: `co-auth-${stamp}`, platform: 'instagram', username: `co-auth-${stamp}`, displayName: 'Co Author',
    }).returning();
    const [coUser] = await db.insert(users).values({ email: `co-${Date.now()}@example.com`, role: 'user' }).returning();
    const [coKey] = await db.insert(apiKeys).values({
      userId: coUser.id, provider: 'gemini', keyEncrypted: 'mps-mock-encrypted-key-co', keyLast4: '7777',
      isValid: true, invalidAttempts: 0, usageCount: 0, usageCycleResetAt: new Date(),
    }).returning();
    const [coSub] = await db.insert(subscriptions).values({ userId: coUser.id, accountId: coauthor.id }).returning();
    const [post] = await db.insert(posts).values({
      accountId: publisher.id, platform: 'instagram', content: 'co-authored post',
      postUrl: `https://instagram.com/p/co-${stamp}`, publishedAt: new Date(),
    }).returning();
    await db.insert(postAccountAssociations).values([
      { postId: post.id, accountId: publisher.id, role: 'PUBLISHER' },
      { postId: post.id, accountId: coauthor.id, role: 'COAUTHOR' },
    ]);
    // The publisher account is subscribed to by testUser, the co-author account by coUser only.
    const [pubSub] = await db.insert(subscriptions).values({ userId: testUser.id, accountId: publisher.id }).returning();

    const list = async (user: any, accountId: string, statuses: string[]) => {
      mockUser = { userId: user.id, role: user.role };
      const response = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `query($accountId: ID!, $statuses: [PostExtractionStatus!]) {
            postsByAccount(accountId: $accountId, limit: 100, statuses: $statuses) { items { id extractionStatus } }
          }`,
          variables: { accountId, statuses },
        })
      });
      const result: any = await response.json();
      assert.ok(!result.errors, 'should not have errors: ' + JSON.stringify(result.errors));
      return result.data.postsByAccount.items.map((p: any) => p.id as string);
    };

    try {
      assert.ok((await list(testUser, publisher.id, ['PENDING'])).includes(post.id), 'listed in the publisher tab');
      assert.ok((await list(coUser, coauthor.id, ['PENDING'])).includes(post.id), 'listed in the co-author tab');

      // The co-author's subscriber selects it although posts.account_id is the publisher.
      mockUser = { userId: coUser.id, role: coUser.role };
      const select = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `mutation($postIds: [ID!]!) { selectPostsForExtraction(postIds: $postIds) { id extractionStatus } }`,
          variables: { postIds: [post.id] },
        })
      });
      const selectResult: any = await select.json();
      assert.ok(!selectResult.errors, 'co-author subscriber may select it: ' + JSON.stringify(selectResult.errors));
      assert.strictEqual(selectResult.data.selectPostsForExtraction[0].extractionStatus, 'QUEUED');

      // It is now queued in BOTH tabs and no longer pending in either.
      assert.ok((await list(testUser, publisher.id, ['QUEUED'])).includes(post.id));
      assert.ok((await list(coUser, coauthor.id, ['QUEUED'])).includes(post.id));
      assert.ok(!(await list(testUser, publisher.id, ['PENDING'])).includes(post.id));

      // A second subscriber selecting the same post does not queue it again.
      mockUser = { userId: testUser.id, role: testUser.role };
      const again = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `mutation($postIds: [ID!]!) { selectPostsForExtraction(postIds: $postIds) { id } }`,
          variables: { postIds: [post.id] },
        })
      });
      const againResult: any = await again.json();
      assert.ok(againResult.errors, 'a post already queued by the other account cannot be queued twice');
      assert.strictEqual(againResult.errors[0].extensions?.code, 'CONFLICT');
    } finally {
      await db.delete(postAccountAssociations).where(eq(postAccountAssociations.postId, post.id));
      await db.delete(posts).where(eq(posts.id, post.id));
      await db.delete(subscriptions).where(inArray(subscriptions.id, [coSub.id, pubSub.id]));
      await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, [publisher.id, coauthor.id]));
      await db.delete(apiKeys).where(eq(apiKeys.id, coKey.id));
      await db.delete(users).where(eq(users.id, coUser.id));
    }
  });

  await t.test('selectPostsForExtraction throws FORBIDDEN if user is not subscribed to post account', async () => {
    // Create another user and post
    const [insertedOtherUser] = await db.insert(users).values({
      email: `other-${Date.now()}@example.com`,
      role: 'user',
    }).returning();
    otherUser = insertedOtherUser;

    const [insertedOtherKey] = await db.insert(apiKeys).values({
      userId: otherUser.id,
      provider: 'gemini',
      keyEncrypted: 'mps-mock-encrypted-key-other',
      keyLast4: '8888',
      isValid: true,
      invalidAttempts: 0,
      usageCount: 0,
      usageCycleResetAt: new Date(),
    }).returning();
    otherApiKey = insertedOtherKey;

    const [insertedOtherPost] = await db.insert(posts).values({
      accountId: testProfile.id, // they are not subscribed to this profile
      platform: 'instagram',
      content: 'unsubscribed post content',
      postUrl: `https://instagram.com/p/unsub123-${Date.now()}-${Math.random()}`,
      publishedAt: new Date(),
    }).returning();
    otherPost = insertedOtherPost;

    mockUser = { userId: otherUser.id, role: otherUser.role };

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation SelectPosts($postIds: [ID!]!) {
            selectPostsForExtraction(postIds: $postIds) {
              id
            }
          }
        `,
        variables: { postIds: [otherPost.id] }
      })
    });

    const result = await response.json();
    assert.ok(result.errors);
    assert.strictEqual(result.errors[0].extensions?.code, 'FORBIDDEN');
  });

  await t.test('selectPostsForExtraction successfully enqueues posts', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation SelectPosts($postIds: [ID!]!) {
            selectPostsForExtraction(postIds: $postIds) {
              id
              isExtracted
            }
          }
        `,
        variables: { postIds: [recentPost.id] }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, 'should not have errors');
    assert.strictEqual(result.data.selectPostsForExtraction[0].id, recentPost.id);
  });

  await t.test('selectPostsForExtraction returns Posts for the ones that succeed when one postId fails mid-loop (BUG-015)', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    // Story 3.6z (AC3): recentPost was already successfully enqueued by the previous test and
    // now carries a non-stale claim (queuedForExtractionAt), so re-submitting it here would
    // correctly throw PostAlreadyQueuedError -- that's the idempotency fix working as intended,
    // not a regression. Use a fresh, never-enqueued post for this test's "succeeds" half instead,
    // which is what BUG-015 actually needs: at least one post that succeeds alongside one that fails.
    const [insertedFirstPost] = await db.insert(posts).values({
      accountId: testProfile.id,
      platform: 'instagram',
      content: 'A first post to enqueue (BUG-015 partial-failure case)',
      postUrl: `https://instagram.com/p/partial-first-${Date.now()}-${Math.random()}`,
      publishedAt: new Date(),
    }).returning();
    partialFailureFirstPost = insertedFirstPost;

    const [insertedSecondPost] = await db.insert(posts).values({
      accountId: testProfile.id,
      platform: 'instagram',
      content: 'A second post to enqueue',
      postUrl: `https://instagram.com/p/partial123-${Date.now()}-${Math.random()}`,
      publishedAt: new Date(),
    }).returning();
    partialFailureSecondPost = insertedSecondPost;

    const [insertedAlreadyExtractedPost] = await db.insert(posts).values({
      accountId: testProfile.id,
      platform: 'instagram',
      content: 'Already extracted post',
      postUrl: `https://instagram.com/p/already-extracted123-${Date.now()}-${Math.random()}`,
      publishedAt: new Date(),
      isExtracted: true,
    }).returning();
    partialFailureAlreadyExtractedPost = insertedAlreadyExtractedPost;

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation SelectPosts($postIds: [ID!]!) {
            selectPostsForExtraction(postIds: $postIds) {
              id
            }
          }
        `,
        variables: { postIds: [insertedFirstPost.id, insertedSecondPost.id, insertedAlreadyExtractedPost.id] }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, 'should not have errors -- partial success must not throw');
    const returnedIds = result.data.selectPostsForExtraction.map((p: any) => p.id);
    assert.strictEqual(returnedIds.length, 2, 'only the 2 non-extracted posts should be returned');
    assert.ok(returnedIds.includes(insertedFirstPost.id));
    assert.ok(returnedIds.includes(insertedSecondPost.id));
    assert.ok(!returnedIds.includes(insertedAlreadyExtractedPost.id));
  });

  await t.test('Story 3.6z (Task 11): selectPostsForExtraction surfaces PostAlreadyQueuedError as a clean CONFLICT GraphQL error', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    const [alreadyQueuedPost] = await db.insert(posts).values({
      accountId: testProfile.id,
      platform: 'instagram',
      content: 'A post auto-enqueued moments ago',
      postUrl: `https://instagram.com/p/already-queued-${Date.now()}-${Math.random()}`,
      publishedAt: new Date(),
      isExtracted: false,
      queuedForExtractionAt: new Date(), // simulates a just-auto-enqueued, non-stale claim
    }).returning();

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation SelectPosts($postIds: [ID!]!) {
            selectPostsForExtraction(postIds: $postIds) {
              id
            }
          }
        `,
        variables: { postIds: [alreadyQueuedPost.id] }
      })
    });

    const result = await response.json();
    assert.ok(result.errors, 'should return an error, not a 500-shaped unhandled rejection');
    assert.strictEqual(result.errors[0].extensions?.code, 'CONFLICT');

    await db.delete(posts).where(eq(posts.id, alreadyQueuedPost.id));
  });
});
