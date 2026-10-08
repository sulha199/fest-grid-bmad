import test from 'node:test';
import * as assert from 'node:assert';
import { createSchema, createYoga } from 'graphql-yoga';
import { resolvers } from './resolvers.js';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/client.js';
import { users, accountVotes, socialMediaAccountProfiles, subscriptions, userLocations } from '@festgrid/database';
import { eq, and, isNull, inArray } from 'drizzle-orm';

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

  // Tracks every socialMediaAccountProfiles row this file creates (testProfile/anotherProfile
  // plus the per-sub-test `profile`/`unverified`/`verifiedProfile` rows below) so the file-level
  // t.after at the bottom can delete exactly those rows -- this file had zero cleanup before
  // this fix.
  const createdProfileIds: string[] = [];
  let demandUserA: any;
  let demandUserB: any;

  t.after(async () => {
    const voteOwnerIds = [testUser?.id, demandUserA?.id, demandUserB?.id].filter(Boolean);
    if (voteOwnerIds.length > 0) {
      await db.delete(accountVotes).where(inArray(accountVotes.userId, voteOwnerIds));
    }
    if (createdProfileIds.length > 0) {
      await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, createdProfileIds));
    }
    const createdUserIds = [demandUserA?.id, demandUserB?.id].filter(Boolean);
    if (createdUserIds.length > 0) {
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
  });

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
    createdProfileIds.push(testProfile.id, anotherProfile.id);
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

  // Story 3.17's new coverage below (Task 2.2/3.4) is self-contained -- it seeds its own users
  // rather than relying on the outer `testUser`/`anotherUser` from the "setup" subtest above,
  // since that setup reads pre-existing seeded rows from `users` that may not be present in
  // every environment this story runs in. (demandUserA/demandUserB are declared in the outer
  // scope above, alongside createdProfileIds, so the file-level t.after can clean them up too.)

  await t.test('(3.17 setup) seed two local users for the demand-gated discovery tests', async () => {
    const [a] = await db.insert(users).values({
      email: `demand-gate-a-${suffix}@example.test`,
      name: 'Demand Gate A',
      role: 'user',
    }).returning();
    demandUserA = a;

    const [b] = await db.insert(users).values({
      email: `demand-gate-b-${suffix}@example.test`,
      name: 'Demand Gate B',
      role: 'user',
    }).returning();
    demandUserB = b;
  });

  await t.test('(2.2a) castVote flips isVerifiedForDiscovery false -> true on a first-ever vote (Story 3.17, AC1)', async () => {
    const [unverified] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'acc-unverified-a-' + suffix,
      platform: 'instagram',
      username: 'test_unverified_a_' + suffix,
      displayName: 'Test Unverified A ' + suffix,
      isVerifiedForDiscovery: false,
    }).returning();
    createdProfileIds.push(unverified.id);

    mockUser = { userId: demandUserA.id, role: demandUserA.role };
    const res = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation { castVote(input: { accountId: "${unverified.id}" }) { id accountId } }`
      })
    });
    const result = await res.json();
    assert.ok(!result.errors, 'castVote failed: ' + JSON.stringify(result.errors));

    const [row] = await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, unverified.id));
    assert.strictEqual(row.isVerifiedForDiscovery, true, 'first vote must flip isVerifiedForDiscovery to true');
  });

  await t.test('(2.2b) castVote on an already-verified profile is a no-op on isVerifiedForDiscovery (regression guard)', async () => {
    const [verifiedProfile] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'acc-already-verified-b-' + suffix,
      platform: 'instagram',
      username: 'test_already_verified_b_' + suffix,
      displayName: 'Test Already Verified B ' + suffix,
      isVerifiedForDiscovery: true,
    }).returning();
    createdProfileIds.push(verifiedProfile.id);

    mockUser = { userId: demandUserB.id, role: demandUserB.role };
    const res = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation { castVote(input: { accountId: "${verifiedProfile.id}" }) { id accountId } }`
      })
    });
    const result = await res.json();
    assert.ok(!result.errors, 'castVote failed: ' + JSON.stringify(result.errors));

    const [row] = await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, verifiedProfile.id));
    assert.strictEqual(row.isVerifiedForDiscovery, true, 'already-true profile stays true');
  });

  await t.test('(2.2c) withdrawing then re-casting a vote re-confirms isVerifiedForDiscovery (idempotent)', async () => {
    const [profile] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'acc-unverified-c-' + suffix,
      platform: 'instagram',
      username: 'test_unverified_c_' + suffix,
      displayName: 'Test Unverified C ' + suffix,
      isVerifiedForDiscovery: false,
    }).returning();
    createdProfileIds.push(profile.id);

    mockUser = { userId: demandUserA.id, role: demandUserA.role };

    const cast1 = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation { castVote(input: { accountId: "${profile.id}" }) { id accountId } }`
      })
    });
    const cast1Result = await cast1.json();
    assert.ok(!cast1Result.errors);
    const voteId = cast1Result.data.castVote.id;

    const withdraw = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation { withdrawVote(id: "${voteId}", action: DELETE) { id deletedAt } }`
      })
    });
    const withdrawResult = await withdraw.json();
    assert.ok(!withdrawResult.errors, 'withdraw failed: ' + JSON.stringify(withdrawResult.errors));

    const recast = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation { castVote(input: { accountId: "${profile.id}" }) { id accountId deletedAt } }`
      })
    });
    const recastResult = await recast.json();
    assert.ok(!recastResult.errors, 'recast failed: ' + JSON.stringify(recastResult.errors));

    const [row] = await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
    assert.strictEqual(row.isVerifiedForDiscovery, true, 'reactivated vote re-confirms isVerifiedForDiscovery');
  });

  await t.test('(3.4a) a profile with isVerifiedForDiscovery: false and an active vote is excluded from rankedVoteAccounts and votedAccountSuggestions (transitional gap coverage)', async () => {
    // Simulates the accepted transitional gap: a vote exists but isVerifiedForDiscovery was
    // never flipped (e.g. a pre-existing vote row from before this story's castVote flip
    // existed). Seed the vote directly rather than via castVote, which would flip the column.
    const [profile] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'acc-gap-' + suffix,
      platform: 'instagram',
      username: 'test_gap_' + suffix,
      displayName: 'Test Gap ' + suffix,
      isVerifiedForDiscovery: false,
    }).returning();

    createdProfileIds.push(profile.id);
    await db.insert(accountVotes).values({
      userId: demandUserA.id,
      accountId: profile.id,
    });

    mockUser = { userId: demandUserA.id, role: demandUserA.role };

    const resRanked = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `{ rankedVoteAccounts { profile { id } } }` })
    });
    const rankedResult = await resRanked.json();
    assert.ok(!rankedResult.errors);
    assert.strictEqual(
      rankedResult.data.rankedVoteAccounts.some((e: any) => e.profile.id === profile.id),
      false,
      'unverified profile must not appear in rankedVoteAccounts'
    );

    const resSuggestions = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `{ votedAccountSuggestions(query: "Gap") { profile { id } } }` })
    });
    const suggestionsResult = await resSuggestions.json();
    assert.ok(!suggestionsResult.errors);
    assert.strictEqual(
      suggestionsResult.data.votedAccountSuggestions.some((e: any) => e.profile.id === profile.id),
      false,
      'unverified profile must not appear in votedAccountSuggestions'
    );
  });

  await t.test('(3.4b) a profile with isVerifiedForDiscovery: true and an active vote appears normally in both (regression guard)', async () => {
    const [profile] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'acc-verified-' + suffix,
      platform: 'instagram',
      username: 'test_verified_' + suffix,
      displayName: 'Test Verified ' + suffix,
      isVerifiedForDiscovery: true,
    }).returning();
    createdProfileIds.push(profile.id);

    await db.insert(accountVotes).values({
      userId: demandUserA.id,
      accountId: profile.id,
    });

    mockUser = { userId: demandUserA.id, role: demandUserA.role };

    const resRanked = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `{ rankedVoteAccounts { profile { id } } }` })
    });
    const rankedResult = await resRanked.json();
    assert.ok(!rankedResult.errors);
    assert.ok(
      rankedResult.data.rankedVoteAccounts.some((e: any) => e.profile.id === profile.id),
      'verified profile should appear in rankedVoteAccounts'
    );

    const resSuggestions = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `{ votedAccountSuggestions(query: "Verified") { profile { id } } }` })
    });
    const suggestionsResult = await resSuggestions.json();
    assert.ok(!suggestionsResult.errors);
    assert.ok(
      suggestionsResult.data.votedAccountSuggestions.some((e: any) => e.profile.id === profile.id),
      'verified profile should appear in votedAccountSuggestions'
    );
  });

  await t.test('(3.4c) queryModeratorAccountProfiles is unaffected by the gate -- still returns an isVerifiedForDiscovery: false profile', async () => {
    const [profile] = await db.insert(socialMediaAccountProfiles).values({
      accountId: 'acc-moderator-view-' + suffix,
      platform: 'instagram',
      username: 'test_moderator_view_' + suffix,
      displayName: 'Test Moderator View ' + suffix,
      isVerifiedForDiscovery: false,
    }).returning();
    createdProfileIds.push(profile.id);

    mockUser = { userId: demandUserA.id, role: 'moderator' };

    const res = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{ queryModeratorAccountProfiles(filters: { search: "Test Moderator View" }) { edges { node { id } } } }`
      })
    });
    const result = await res.json();
    assert.ok(!result.errors, 'queryModeratorAccountProfiles failed: ' + JSON.stringify(result.errors));
    const nodes = result.data.queryModeratorAccountProfiles.edges.map((e: any) => e.node);
    assert.ok(nodes.some((n: any) => n.id === profile.id), 'moderator view must still show the unverified profile');
  });
});
