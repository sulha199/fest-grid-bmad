import test from 'node:test';
import * as assert from 'node:assert';
import { createSchema, createYoga } from 'graphql-yoga';
import { resolvers } from './resolvers.js';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/client.js';
import { users, unprocessedScraperPayloads, parserVersionRegistry } from '@festgrid/database';
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

test('reprocessPayload resolver', async (t) => {
  let moderatorUser: any;
  let testPayload: any;
  let testParserVersion: any;

  await t.test('setup - seed data', async () => {
    // Insert moderator
    const [mod] = await db.insert(users).values({
      email: `mod-${Date.now()}@test.com`,
      name: 'Moderator',
      role: 'moderator',
    }).returning();
    moderatorUser = mod;

    // Insert parser version
    const [version] = await db.insert(parserVersionRegistry).values({
      version: `test-version-${Date.now()}`,
      isActive: true,
      deployedAt: new Date(),
    }).returning();
    testParserVersion = version;

    // Insert unprocessed payload
    const [payload] = await db.insert(unprocessedScraperPayloads).values({
      rawPayload: { test: true },
      validationError: { message: 'test' },
      context: { test: true },
    }).returning();
    testPayload = payload;
  });

  await t.test('reprocessPayload - honest failure result (not implemented)', async () => {
    mockUser = { userId: moderatorUser.id, role: moderatorUser.role };

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
        variables: {
          payloadId: testPayload.id,
          parserVersion: testParserVersion.version,
        }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, 'GraphQL errors returned');
    
    const { success, queueId, message } = result.data.reprocessPayload;
    
    assert.strictEqual(success, false, 'Expected success to be false');
    assert.strictEqual(queueId, null, 'Expected queueId to be null');
    assert.ok(message.includes('not yet implemented'), 'Expected message to state it is not implemented');
  });

  await t.test('cleanup', async () => {
    await db.delete(unprocessedScraperPayloads).where(eq(unprocessedScraperPayloads.id, testPayload.id));
    await db.delete(parserVersionRegistry).where(eq(parserVersionRegistry.version, testParserVersion.version));
    await db.delete(users).where(eq(users.id, moderatorUser.id));
  });
});