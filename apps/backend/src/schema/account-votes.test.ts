import test from 'node:test';
import * as assert from 'node:assert';
import { createSchema, createYoga } from 'graphql-yoga';
import { resolvers } from './resolvers.js';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/client.js';
import { users, accountVotes, socialMediaAccountProfiles, subscriptions, userLocations } from '@festgrid/database';
import { eq, and, isNull } from 'drizzle-orm';

// Read all required schema fragments dynamically from the schema directory
const schemaDir = path.resolve(process.cwd(), 'src/schema');
const files = fs.readdirSync(schemaDir).filter(f => f.endsWith('.graphql'));
const typeDefs = files.map(f => fs.readFileSync(path.join(schemaDir, f), 'utf8')).join('\n');

const schema = createSchema({
  typeDefs,
  resolvers: resolvers as any
});

let mockUser: any = null;

const yoga = createYoga({
  schema,
  context: () => ({
    user: mockUser,
  }) as any,
});

test('account votes resolvers integration', async (t) => {
  let testUser: any;
  let anotherUser: any;
  let testProfile: any;
  let anotherProfile: any;
  const suffix = Date.now().toString();

  await t.test('setup - get test users and create account profiles', async () => {
    const seededUsers = await db.select().from(users).limit(2);
    assert.ok(seededUsers.length >= 2, 'Should have at least 2 users');
    testUser = seededUsers[0];
    anotherUser = seededUsers[1];

    // Clean votes from this user only to be isolated
    await db.delete(accountVotes).where(eq(accountVotes.userId, testUser.id));

    // Seed profiles with unique accountIds to avoid foreign key or unique conflicts
    const [p1] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'acc123_' + suffix,
      platform: 'instagram',
      username: 'test_insta_' + suffix,
      displayName: 'Test Insta ' + suffix,
    }).returning();
    testProfile = p1;

    const [p2] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'acc456_' + suffix,
      platform: 'twitter',
      username: 'test_twitter_' + suffix,
      displayName: 'Test Twitter ' + suffix,
    }).returning();
    anotherProfile = p2;
  });

  await t.test('castVote, rankedVoteAccounts, and suggestions flow', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    // 1. Cast vote on testProfile
    const res1 = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            castVote(input: { accountId: "${testProfile.id}" }) {
              id
              userId
              accountId
            }
          }
        `
      })
    });
    const result1 = await res1.json();
    assert.ok(!result1.errors, 'should not have errors: ' + JSON.stringify(result1.errors));
    assert.strictEqual(result1.data.castVote.accountId, testProfile.id);

    // 2. Query rankedVoteAccounts
    const res2 = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{ rankedVoteAccounts { voteCount profile { id displayName } } }`
      })
    });
    const result2 = await res2.json();
    assert.ok(!result2.errors, 'ranked query failed: ' + JSON.stringify(result2.errors));
    
    // Find our profile in ranked list
    const entry = result2.data.rankedVoteAccounts.find((e: any) => e.profile.id === testProfile.id);
    assert.ok(entry, 'our voted profile should be in ranked list');
    assert.strictEqual(entry.voteCount, 1);

    // 3. Query suggestions with a partial match
    const res3 = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{ votedAccountSuggestions(query: "Insta") { voteCount profile { id displayName } } }`
      })
    });
    const result3 = await res3.json();
    assert.ok(!result3.errors, 'suggestions query failed');
    const suggestionEntry = result3.data.votedAccountSuggestions.find((e: any) => e.profile.id === testProfile.id);
    assert.ok(suggestionEntry, 'our profile should be in suggestion list');
  });

  await t.test('withdrawVote mutation flow', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    // Fetch user's active vote
    const [vote] = await db.select().from(accountVotes).where(and(eq(accountVotes.userId, testUser.id), eq(accountVotes.accountId, testProfile.id)));
    assert.ok(vote);

    // Withdraw vote
    const resWithdraw = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            withdrawVote(id: "${vote.id}", action: DELETE) {
              id
              deletedAt
            }
          }
        `
      })
    });
    const resultWithdraw = await resWithdraw.json();
    assert.ok(!resultWithdraw.errors, 'withdraw failed');
    assert.ok(resultWithdraw.data.withdrawVote.deletedAt, 'should have deletedAt timestamp');

    // Query rankedVoteAccounts again - should not contain our withdrawn vote
    const resRanked = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{ rankedVoteAccounts { voteCount profile { id } } }`
      })
    });
    const resultRanked = await resRanked.json();
    const entry = resultRanked.data.rankedVoteAccounts.find((e: any) => e.profile.id === testProfile.id);
    assert.strictEqual(entry, undefined, 'withdrawn vote should not appear in ranked list');
  });
});
