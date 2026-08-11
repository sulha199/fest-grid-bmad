import test from 'node:test';
import * as assert from 'node:assert';
import { createSchema, createYoga } from 'graphql-yoga';
import { resolvers } from './resolvers.js';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/client.js';
import { users, posts, apiKeys, socialMediaAccountProfiles } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import '../lib/scraper/register-adapters.js';
import { setCallGeminiGenerateContent } from '../lib/ai-gateway/gemini-client.js';
import { setCallApifyActor } from '../lib/scraper/instagram-adapter.ts';

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
  let testUser: any;
  let existingPost: any;
  let testApiKey: any;
  let testProfile: any;

  await t.test('setup - get test data', async () => {
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
    console.log('EXISTING PATH RESOLVER RESULT:', JSON.stringify(result, null, 2));
    assert.ok(!result.errors, 'should not have errors');
    assert.ok(result.data?.extractEventDataFromUrl?.data, 'should have extracted data');
    assert.strictEqual(result.data.extractEventDataFromUrl.data.eventName, 'Existing Path Festival');
    assert.strictEqual(result.data.extractEventDataFromUrl.data.schedules[0].id, null);
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
    console.log('NEW PATH RESOLVER RESULT:', JSON.stringify(result, null, 2));
    assert.ok(!result.errors, 'should not have errors');
    assert.ok(result.data?.extractEventDataFromUrl?.data, 'should have extracted data');
    assert.strictEqual(result.data.extractEventDataFromUrl.data.eventName, 'New Pasted Event');
  });

  await t.test('extractEventDataFromUrl - isEvent false returns EXTRACTION_FAILED', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    setCallGeminiGenerateContent(async (key, req) => {
      return {
        text: JSON.stringify({
          isEvent: false,
          eventName: '',
          types: [],
          categories: [],
          confidenceScore: 0.1,
          schedules: []
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
    assert.strictEqual(result.data.extractEventDataFromUrl.errorMessage, 'The linked post does not appear to describe an event.');
  });
});
