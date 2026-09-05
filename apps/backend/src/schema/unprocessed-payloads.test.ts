import test from 'node:test';
import * as assert from 'node:assert';
import { createSchema, createYoga } from 'graphql-yoga';
import { resolvers } from './resolvers.js';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/client.js';
import { users, unprocessedScraperPayloads, parserVersionRegistry, scraperActorRuns, socialMediaAccountProfiles, posts } from '@festgrid/database';
import { eq } from 'drizzle-orm';

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

async function callReprocessPayload(payloadId: string, parserVersion: string) {
  const response = await yoga.fetch('http://yoga/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        mutation ReprocessPayload($payloadId: ID!, $parserVersion: String!) {
          reprocessPayload(payloadId: $payloadId, parserVersion: $parserVersion) {
            success
            queueId
            message
          }
        }
      `,
      variables: { payloadId, parserVersion },
    }),
  });
  const result = await response.json();
  assert.ok(!result.errors, `GraphQL errors returned: ${JSON.stringify(result.errors)}`);
  return result.data.reprocessPayload;
}

test('reprocessPayload resolver', async (t) => {
  let moderatorUser: any;

  await t.test('setup - seed moderator', async () => {
    const [mod] = await db.insert(users).values({
      email: `mod-${Date.now()}@test.com`,
      name: 'Moderator',
      role: 'moderator',
    }).returning();
    moderatorUser = mod;
    mockUser = { userId: moderatorUser.id, role: moderatorUser.role };
  });

  await t.test('payload with no linked actor run cannot be reprocessed', async () => {
    const [version] = await db.insert(parserVersionRegistry).values({
      version: `test-no-run-${Date.now()}`,
      isActive: true,
      deployedAt: new Date(),
    }).returning();

    const [payload] = await db.insert(unprocessedScraperPayloads).values({
      rawPayload: { test: true },
      validationError: { message: 'test' },
      context: { test: true },
    }).returning();

    const { success, queueId, message } = await callReprocessPayload(payload.id, version.version);

    assert.strictEqual(success, false);
    assert.strictEqual(queueId, null);
    assert.ok(message.includes('no linked actor run'), `Expected "no linked actor run" message, got: ${message}`);

    await db.delete(unprocessedScraperPayloads).where(eq(unprocessedScraperPayloads.id, payload.id));
    await db.delete(parserVersionRegistry).where(eq(parserVersionRegistry.id, version.id));
  });

  await t.test('parser version registered for a different provider is rejected', async () => {
    const [version] = await db.insert(parserVersionRegistry).values({
      version: `test-wrong-source-${Date.now()}`,
      source: 'APIFY',
      isActive: true,
      deployedAt: new Date(),
    }).returning();

    const [payload] = await db.insert(unprocessedScraperPayloads).values({
      rawPayload: { test: true },
      validationError: { message: 'test' },
      context: { source: 'brightdata', timestamp: new Date().toISOString(), parserVersion: '3.4g' },
    }).returning();

    const { success, message } = await callReprocessPayload(payload.id, version.version);

    assert.strictEqual(success, false);
    assert.ok(message.includes('APIFY') && message.includes('BRIGHTDATA'), `Expected a provider-mismatch message, got: ${message}`);

    await db.delete(unprocessedScraperPayloads).where(eq(unprocessedScraperPayloads.id, payload.id));
    await db.delete(parserVersionRegistry).where(eq(parserVersionRegistry.id, version.id));
  });

  await t.test('unknown parser version is rejected', async () => {
    const [payload] = await db.insert(unprocessedScraperPayloads).values({
      rawPayload: { test: true },
      validationError: { message: 'test' },
      context: { test: true },
    }).returning();

    const { success, message } = await callReprocessPayload(payload.id, 'does-not-exist');

    assert.strictEqual(success, false);
    assert.ok(message.includes('not found in registry'));

    await db.delete(unprocessedScraperPayloads).where(eq(unprocessedScraperPayloads.id, payload.id));
  });

  await t.test('reprocessing a payload whose actor run now maps successfully persists the post and resolves the payload', async () => {
    const postUrl = `https://www.instagram.com/reel/reprocess-happy-${Date.now()}/`;

    const [profile] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'acct-reprocess-' + Date.now(),
      platform: 'instagram',
      username: 'test_user_reprocess',
      displayName: 'Test User Reprocess',
    }).returning();

    const [run] = await db.insert(scraperActorRuns).values({
      vendor: 'BRIGHTDATA',
      triggerMode: 'ASYNC',
      profileId: profile.id,
      runId: 'reprocess-run-' + Date.now(),
      rawInput: {},
      rawOutput: [
        {
          url: postUrl,
          description: 'Reprocessed caption',
          date_posted: new Date().toISOString(),
          photos: ['https://example.com/reprocess-img.jpg'],
        },
      ],
      status: 'SUCCEEDED',
    }).returning();

    const [payload] = await db.insert(unprocessedScraperPayloads).values({
      // Simulates the lossy, already-mapped candidate stored for an AJV validation
      // failure (see brightdata-record-mapper.ts) -- empty content, matching what a
      // pre-fix mapper run would have produced for this exact record.
      rawPayload: { content: '', postUrl, publishedAt: new Date().toISOString() },
      validationError: [{ message: 'must NOT have fewer than 1 characters', instancePath: '/content' }],
      context: {
        source: 'brightdata',
        postUrl,
        timestamp: new Date().toISOString(),
        parserVersion: '3.4g',
      },
      scraperActorRunId: run.id,
    }).returning();

    const { success, queueId, message } = await callReprocessPayload(payload.id, '3.4g');

    assert.strictEqual(success, true, `Expected success, got message: ${message}`);
    assert.strictEqual(queueId, run.id);
    assert.ok(message.includes('Reprocessed successfully'));

    const persistedPost = await db.select().from(posts).where(eq(posts.postUrl, postUrl));
    assert.strictEqual(persistedPost.length, 1);
    assert.strictEqual(persistedPost[0].content, 'Reprocessed caption');

    const [reloadedPayload] = await db.select().from(unprocessedScraperPayloads).where(eq(unprocessedScraperPayloads.id, payload.id));
    assert.ok(reloadedPayload.deletedAt, 'Expected the payload row to be soft-deleted after a successful reprocess');

    await db.delete(posts).where(eq(posts.postUrl, postUrl));
    await db.delete(unprocessedScraperPayloads).where(eq(unprocessedScraperPayloads.id, payload.id));
    await db.delete(scraperActorRuns).where(eq(scraperActorRuns.id, run.id));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
  });

  await t.test('cleanup', async () => {
    await db.delete(users).where(eq(users.id, moderatorUser.id));
  });
});
