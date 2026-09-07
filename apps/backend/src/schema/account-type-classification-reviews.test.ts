import test from 'node:test';
import * as assert from 'node:assert';
import { createSchema, createYoga } from 'graphql-yoga';
import { resolvers } from './resolvers.js';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/client.js';
import { users, socialMediaAccountProfiles, accountTypeClassificationReviews } from '@festgrid/database';
import { eq, inArray } from 'drizzle-orm';

// read the generated schema for the yoga server
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

test('account type classification reviews resolver integration', async (t) => {
  let regularUser: any;
  let moderatorUser: any;
  let testAccount: any;

  await t.test('setup - seed users and account profile', async () => {
    const [user1] = await db.insert(users).values({
      email: `requester-atc-${Date.now()}@test.com`,
      name: 'Requester',
      role: 'user',
    }).returning();
    regularUser = user1;

    const [mod] = await db.insert(users).values({
      email: `mod-atc-${Date.now()}@test.com`,
      name: 'Moderator Atc',
      role: 'moderator',
    }).returning();
    moderatorUser = mod;

    const [insertedAccount] = await db.insert(socialMediaAccountProfiles).values({
      platform: 'instagram',
      accountId: `acc-atc-${Date.now()}`,
      displayName: 'Test Classification Account',
      username: 'test_atc',
      description: 'A test account bio',
      accountTypeStatus: 'AWAITING_APPROVAL',
    }).returning();
    testAccount = insertedAccount;
  });

  await t.test('pendingAccountTypeClassificationReviews - non-moderator rejected with FORBIDDEN', async () => {
    mockUser = { userId: regularUser.id, role: regularUser.role };
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query PendingAccountTypeClassificationReviews {
            pendingAccountTypeClassificationReviews {
              id
            }
          }
        `,
      })
    });
    const result = await response.json();
    assert.ok(result.errors);
    assert.strictEqual(result.errors[0].extensions?.code, 'FORBIDDEN');
  });

  let lowConfidenceReviewId: string;
  let failedReviewId: string;

  await t.test('pendingAccountTypeClassificationReviews - moderator query returns oldest-first, low-confidence + failure rows', async () => {
    const [lowConfidenceReview] = await db.insert(accountTypeClassificationReviews).values({
      accountId: testAccount.id,
      proposedAccountType: 'ORGANIZER_VENUE_EVENT',
      confidenceScore: 0.42,
    }).returning();
    lowConfidenceReviewId = lowConfidenceReview.id;

    const [failedReview] = await db.insert(accountTypeClassificationReviews).values({
      accountId: testAccount.id,
      proposedAccountType: null,
      confidenceScore: null,
      failureReason: 'AI classification attempt failed after retries',
    }).returning();
    failedReviewId = failedReview.id;

    mockUser = { userId: moderatorUser.id, role: moderatorUser.role };
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query PendingAccountTypeClassificationReviews {
            pendingAccountTypeClassificationReviews {
              id
              accountId
              proposedAccountType
              confidenceScore
              failureReason
              account {
                id
                displayName
                username
                description
              }
            }
          }
        `,
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, JSON.stringify(result.errors));
    const rows = result.data.pendingAccountTypeClassificationReviews.filter((r: any) => r.accountId === testAccount.id);
    assert.strictEqual(rows.length, 2);
    // oldest-first
    assert.strictEqual(rows[0].id, lowConfidenceReviewId);
    assert.strictEqual(rows[1].id, failedReviewId);

    assert.strictEqual(rows[0].proposedAccountType, 'ORGANIZER_VENUE_EVENT');
    assert.strictEqual(rows[0].confidenceScore, 0.42);
    assert.strictEqual(rows[0].failureReason, null);
    assert.strictEqual(rows[0].account.id, testAccount.id);
    assert.strictEqual(rows[0].account.displayName, 'Test Classification Account');
    assert.strictEqual(rows[0].account.description, 'A test account bio');

    assert.strictEqual(rows[1].proposedAccountType, null);
    assert.strictEqual(rows[1].confidenceScore, null);
    assert.strictEqual(rows[1].failureReason, 'AI classification attempt failed after retries');
  });

  await t.test('resolveAccountTypeClassificationReview - non-moderator rejected with FORBIDDEN', async () => {
    mockUser = { userId: regularUser.id, role: regularUser.role };
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ResolveAccountTypeClassificationReview($id: ID!, $accountType: AccountType!) {
            resolveAccountTypeClassificationReview(id: $id, accountType: $accountType) {
              id
            }
          }
        `,
        variables: { id: lowConfidenceReviewId, accountType: 'ORGANIZER_VENUE_EVENT' }
      })
    });
    const result = await response.json();
    assert.ok(result.errors);
    assert.strictEqual(result.errors[0].extensions?.code, 'FORBIDDEN');
  });

  await t.test('resolveAccountTypeClassificationReview - NOT_FOUND for a bad id', async () => {
    mockUser = { userId: moderatorUser.id, role: moderatorUser.role };
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ResolveAccountTypeClassificationReview($id: ID!, $accountType: AccountType!) {
            resolveAccountTypeClassificationReview(id: $id, accountType: $accountType) {
              id
            }
          }
        `,
        variables: { id: '00000000-0000-0000-0000-000000000000', accountType: 'ORGANIZER_VENUE_EVENT' }
      })
    });
    const result = await response.json();
    assert.ok(result.errors);
    assert.strictEqual(result.errors[0].extensions?.code, 'NOT_FOUND');
  });

  await t.test('resolveAccountTypeClassificationReview - happy path resolves to ORGANIZER_VENUE_EVENT', async () => {
    mockUser = { userId: moderatorUser.id, role: moderatorUser.role };
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ResolveAccountTypeClassificationReview($id: ID!, $accountType: AccountType!) {
            resolveAccountTypeClassificationReview(id: $id, accountType: $accountType) {
              id
              resolvedAccountType
              reviewedByModeratorId
              reviewedAt
            }
          }
        `,
        variables: { id: lowConfidenceReviewId, accountType: 'ORGANIZER_VENUE_EVENT' }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, JSON.stringify(result.errors));
    const review = result.data.resolveAccountTypeClassificationReview;
    assert.strictEqual(review.resolvedAccountType, 'ORGANIZER_VENUE_EVENT');
    assert.strictEqual(review.reviewedByModeratorId, moderatorUser.id);
    assert.ok(review.reviewedAt);

    const [profile] = await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, testAccount.id));
    assert.strictEqual(profile.accountType, 'ORGANIZER_VENUE_EVENT');
    assert.strictEqual(profile.accountTypeStatus, 'CONFIRMED');
  });

  await t.test('resolveAccountTypeClassificationReview - INVALID_STATE_TRANSITION when already resolved', async () => {
    mockUser = { userId: moderatorUser.id, role: moderatorUser.role };
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ResolveAccountTypeClassificationReview($id: ID!, $accountType: AccountType!) {
            resolveAccountTypeClassificationReview(id: $id, accountType: $accountType) {
              id
            }
          }
        `,
        variables: { id: lowConfidenceReviewId, accountType: 'PERSONAL' }
      })
    });
    const result = await response.json();
    assert.ok(result.errors);
    assert.strictEqual(result.errors[0].extensions?.code, 'INVALID_STATE_TRANSITION');
  });

  await t.test('resolveAccountTypeClassificationReview - happy path resolves failure row to CURATOR_GUIDE', async () => {
    mockUser = { userId: moderatorUser.id, role: moderatorUser.role };
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ResolveAccountTypeClassificationReview($id: ID!, $accountType: AccountType!) {
            resolveAccountTypeClassificationReview(id: $id, accountType: $accountType) {
              id
              resolvedAccountType
            }
          }
        `,
        variables: { id: failedReviewId, accountType: 'CURATOR_GUIDE' }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, JSON.stringify(result.errors));
    assert.strictEqual(result.data.resolveAccountTypeClassificationReview.resolvedAccountType, 'CURATOR_GUIDE');

    const [profile] = await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, testAccount.id));
    assert.strictEqual(profile.accountType, 'CURATOR_GUIDE');
    assert.strictEqual(profile.accountTypeStatus, 'CONFIRMED');
  });

  await t.test('resolveAccountTypeClassificationReview - happy path resolves to PERSONAL for a fresh row', async () => {
    const [freshReview] = await db.insert(accountTypeClassificationReviews).values({
      accountId: testAccount.id,
      proposedAccountType: 'PERSONAL',
      confidenceScore: 0.55,
    }).returning();

    mockUser = { userId: moderatorUser.id, role: moderatorUser.role };
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ResolveAccountTypeClassificationReview($id: ID!, $accountType: AccountType!) {
            resolveAccountTypeClassificationReview(id: $id, accountType: $accountType) {
              id
              resolvedAccountType
            }
          }
        `,
        variables: { id: freshReview.id, accountType: 'PERSONAL' }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, JSON.stringify(result.errors));
    assert.strictEqual(result.data.resolveAccountTypeClassificationReview.resolvedAccountType, 'PERSONAL');

    const [profile] = await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, testAccount.id));
    assert.strictEqual(profile.accountType, 'PERSONAL');
    assert.strictEqual(profile.accountTypeStatus, 'CONFIRMED');
  });

  await t.test('moderatorPendingItemCount - reflects the new third term and drops after resolution', async () => {
    // Seed one pending classification review and confirm the badge's summed count includes it,
    // then drops by exactly 1 once resolved -- isolates the new third source's contribution
    // from whatever pending reports/location-changes already exist in the count.
    const [pendingClassification] = await db.insert(accountTypeClassificationReviews).values({
      accountId: testAccount.id,
      proposedAccountType: 'ORGANIZER_VENUE_EVENT',
      confidenceScore: 0.3,
    }).returning();

    mockUser = { userId: moderatorUser.id, role: moderatorUser.role };

    const before = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `query { moderatorPendingItemCount }` })
    });
    const beforeResult = await before.json();
    assert.ok(!beforeResult.errors, JSON.stringify(beforeResult.errors));
    const countBefore = beforeResult.data.moderatorPendingItemCount;

    await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ResolveAccountTypeClassificationReview($id: ID!, $accountType: AccountType!) {
            resolveAccountTypeClassificationReview(id: $id, accountType: $accountType) {
              id
            }
          }
        `,
        variables: { id: pendingClassification.id, accountType: 'ORGANIZER_VENUE_EVENT' }
      })
    });

    const after = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `query { moderatorPendingItemCount }` })
    });
    const afterResult = await after.json();
    assert.ok(!afterResult.errors, JSON.stringify(afterResult.errors));
    const countAfter = afterResult.data.moderatorPendingItemCount;

    assert.strictEqual(countAfter, countBefore - 1);
  });

  await t.test('cleanup', async () => {
    await db.delete(accountTypeClassificationReviews).where(eq(accountTypeClassificationReviews.accountId, testAccount.id));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, testAccount.id));
    await db.delete(users).where(inArray(users.id, [regularUser.id, moderatorUser.id]));
  });
});
