import test from 'node:test';
import * as assert from 'node:assert';
import { createSchema, createYoga } from 'graphql-yoga';
import { resolvers } from './resolvers.js';
import * as fs from 'fs';
import * as path from 'path';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users, events, eventMatchCandidates, eventMerges, reports, posts, socialMediaAccountProfiles } from '@festgrid/database';

const schemaDir = path.resolve(process.cwd(), 'src/schema');
const files = fs.readdirSync(schemaDir).filter((f) => f.endsWith('.graphql'));
const typeDefs = files.map((f) => fs.readFileSync(path.join(schemaDir, f), 'utf8')).join('\n');

const schema = createSchema({
  typeDefs: `
    ${typeDefs}
    type Query {
      health: Boolean
    }
  `,
  resolvers: resolvers as any,
});

let mockUser: any = null;

const yoga = createYoga({
  schema,
  context: () => ({ user: mockUser }) as any,
});

async function gqlCall(query: string, variables?: Record<string, unknown>) {
  const response = await yoga.fetch('http://yoga/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  return response.json();
}

test('event-merges resolvers (Story 3.6w)', async (t) => {
  const suffix = Date.now() + '-emres';
  const createdEventIds: string[] = [];

  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({ accountId: 'acc-emres-' + suffix, platform: 'instagram', displayName: 'EMRes Account', username: 'emres_' + suffix })
    .returning();
  const [post] = await db
    .insert(posts)
    .values({ accountId: profile.id, platform: 'instagram', postUrl: 'https://instagram.com/p/emres-' + suffix, publishedAt: new Date('2026-01-01T00:00:00Z') })
    .returning();

  const [regularUser] = await db.insert(users).values({ email: `emres-user-${suffix}@test.com`, name: 'Regular', role: 'user' }).returning();
  const [moderator] = await db.insert(users).values({ email: `emres-mod-${suffix}@test.com`, name: 'Moderator', role: 'moderator' }).returning();

  t.after(async () => {
    await db.delete(reports).where(inArray(reports.eventId, createdEventIds));
    await db.delete(eventMerges).where(inArray(eventMerges.winnerEventId, createdEventIds));
    await db.delete(eventMatchCandidates).where(inArray(eventMatchCandidates.eventId, createdEventIds));
    await db.delete(events).where(inArray(events.id, createdEventIds));
    await db.delete(posts).where(eq(posts.id, post.id));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
    await db.delete(users).where(inArray(users.id, [regularUser.id, moderator.id]));
  });

  async function makeEvent(name: string) {
    const [row] = await db.insert(events).values({ eventName: name, location: 'Nowhere' }).returning();
    createdEventIds.push(row.id);
    return row;
  }

  async function makeSuggestion(eventId: string, candidateEventId: string, score: number) {
    const [row] = await db.insert(eventMatchCandidates).values({ eventId, candidateEventId, score, postId: post.id }).returning();
    return row;
  }

  await t.test('suggestedEventMatches - non-moderator rejected with FORBIDDEN', async () => {
    mockUser = { userId: regularUser.id, role: regularUser.role };
    const result = await gqlCall(`query { suggestedEventMatches { edges { node { id } } } }`);
    assert.ok(result.errors);
    assert.strictEqual(result.errors[0].extensions?.code, 'FORBIDDEN');
  });

  await t.test('suggestedEventMatches - moderator sees only pending rows, with nested event/candidateEvent', async () => {
    const candidate = await makeEvent('List Candidate ' + suffix);
    const newEvent = await makeEvent('List New ' + suffix);
    const pending = await makeSuggestion(newEvent.id, candidate.id, 0.55);

    const otherCandidate = await makeEvent('List Candidate2 ' + suffix);
    const otherNewEvent = await makeEvent('List New2 ' + suffix);
    const rejected = await makeSuggestion(otherNewEvent.id, otherCandidate.id, 0.1);
    await db
      .update(eventMatchCandidates)
      .set({ status: 'rejected', resolvedAt: new Date(), resolvedByModeratorId: moderator.id })
      .where(eq(eventMatchCandidates.id, rejected.id));

    mockUser = { userId: moderator.id, role: moderator.role };
    const result = await gqlCall(`
      query {
        suggestedEventMatches {
          edges {
            node {
              id
              status
              score
              event { id eventName }
              candidateEvent { id eventName }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `);
    assert.ok(!result.errors, JSON.stringify(result.errors));
    const nodes = result.data.suggestedEventMatches.edges.map((e: any) => e.node);
    const found = nodes.find((n: any) => n.id === pending.id);
    assert.ok(found, 'pending suggestion should be listed');
    assert.strictEqual(found.status, 'pending');
    assert.strictEqual(found.event.id, newEvent.id);
    assert.strictEqual(found.event.eventName, newEvent.eventName);
    assert.strictEqual(found.candidateEvent.id, candidate.id);
    assert.ok(!nodes.some((n: any) => n.id === rejected.id), 'rejected suggestion must not appear in the pending list');
  });

  await t.test('resolveSuggestedEventMatch - ACCEPT commits a merge, returns mergeId, flips status', async () => {
    const candidate = await makeEvent('Accept Candidate ' + suffix);
    const newEvent = await makeEvent('Accept New ' + suffix);
    const suggestion = await makeSuggestion(newEvent.id, candidate.id, 0.6);

    mockUser = { userId: moderator.id, role: moderator.role };
    const result = await gqlCall(
      `
        mutation Resolve($id: ID!, $action: SuggestedEventMatchAction!) {
          resolveSuggestedEventMatch(id: $id, action: $action) {
            mergeId
            suggestion { id status event { id } candidateEvent { id } }
          }
        }
      `,
      { id: suggestion.id, action: 'ACCEPT' }
    );
    assert.ok(!result.errors, JSON.stringify(result.errors));
    assert.ok(result.data.resolveSuggestedEventMatch.mergeId);
    assert.strictEqual(result.data.resolveSuggestedEventMatch.suggestion.status, 'accepted');

    const [loserRow] = await db.select().from(events).where(eq(events.id, newEvent.id));
    assert.ok(loserRow.deletedAt !== null);
    assert.strictEqual(loserRow.mergedIntoEventId, candidate.id);
  });

  await t.test('resolveSuggestedEventMatch - REJECT flips to rejected, no merge, mergeId null', async () => {
    const candidate = await makeEvent('Reject Candidate ' + suffix);
    const newEvent = await makeEvent('Reject New ' + suffix);
    const suggestion = await makeSuggestion(newEvent.id, candidate.id, 0.5);

    mockUser = { userId: moderator.id, role: moderator.role };
    const result = await gqlCall(
      `
        mutation Resolve($id: ID!, $action: SuggestedEventMatchAction!) {
          resolveSuggestedEventMatch(id: $id, action: $action) {
            mergeId
            suggestion { id status }
          }
        }
      `,
      { id: suggestion.id, action: 'REJECT' }
    );
    assert.ok(!result.errors, JSON.stringify(result.errors));
    assert.strictEqual(result.data.resolveSuggestedEventMatch.mergeId, null);
    assert.strictEqual(result.data.resolveSuggestedEventMatch.suggestion.status, 'rejected');

    const [loserRow] = await db.select().from(events).where(eq(events.id, newEvent.id));
    assert.strictEqual(loserRow.deletedAt, null);
    assert.strictEqual(loserRow.mergedIntoEventId, null);
  });

  await t.test('undoEventMerge - restores the loser and flips the suggestion back to pending', async () => {
    const candidate = await makeEvent('Undo Candidate ' + suffix);
    const newEvent = await makeEvent('Undo New ' + suffix);
    const suggestion = await makeSuggestion(newEvent.id, candidate.id, 0.65);

    mockUser = { userId: moderator.id, role: moderator.role };
    const acceptResult = await gqlCall(
      `mutation Resolve($id: ID!, $action: SuggestedEventMatchAction!) { resolveSuggestedEventMatch(id: $id, action: $action) { mergeId } }`,
      { id: suggestion.id, action: 'ACCEPT' }
    );
    const mergeId = acceptResult.data.resolveSuggestedEventMatch.mergeId;

    const undoResult = await gqlCall(`mutation Undo($mergeId: ID!) { undoEventMerge(mergeId: $mergeId) { id deletedAt } }`, {
      mergeId,
    });
    assert.ok(!undoResult.errors, JSON.stringify(undoResult.errors));
    assert.strictEqual(undoResult.data.undoEventMerge.id, newEvent.id);
    assert.strictEqual(undoResult.data.undoEventMerge.deletedAt, null);

    const [restoredLoserRow] = await db.select().from(events).where(eq(events.id, newEvent.id));
    assert.strictEqual(restoredLoserRow.mergedIntoEventId, null);

    const [pendingAgain] = await db.select().from(eventMatchCandidates).where(eq(eventMatchCandidates.id, suggestion.id));
    assert.strictEqual(pendingAgain.status, 'pending');
  });

  await t.test('moderatorPendingItemCount - includes pending suggested-event-match rows', async () => {
    const candidate = await makeEvent('Badge Candidate ' + suffix);
    const newEvent = await makeEvent('Badge New ' + suffix);

    mockUser = { userId: moderator.id, role: moderator.role };
    const before = await gqlCall(`query { moderatorPendingItemCount }`);
    assert.ok(!before.errors, JSON.stringify(before.errors));
    const beforeCount = before.data.moderatorPendingItemCount;

    await makeSuggestion(newEvent.id, candidate.id, 0.5);

    const after = await gqlCall(`query { moderatorPendingItemCount }`);
    assert.ok(!after.errors, JSON.stringify(after.errors));
    assert.strictEqual(after.data.moderatorPendingItemCount, beforeCount + 1);
  });

  await t.test('restoreEvent - rejects RESTORE on a merged event, directing the caller to undoEventMerge', async () => {
    const candidate = await makeEvent('Guard Candidate ' + suffix);
    const newEvent = await makeEvent('Guard New ' + suffix);
    const suggestion = await makeSuggestion(newEvent.id, candidate.id, 0.7);

    mockUser = { userId: moderator.id, role: moderator.role };
    await gqlCall(`mutation Resolve($id: ID!, $action: SuggestedEventMatchAction!) { resolveSuggestedEventMatch(id: $id, action: $action) { mergeId } }`, {
      id: suggestion.id,
      action: 'ACCEPT',
    });

    const result = await gqlCall(`mutation Restore($id: ID!, $action: SoftDeleteAction!) { restoreEvent(id: $id, action: $action) { id } }`, {
      id: newEvent.id,
      action: 'RESTORE',
    });
    assert.ok(result.errors, 'restoring a merged event through restoreEvent must fail');
    assert.strictEqual(result.errors[0].extensions?.code, 'INVALID_STATE_TRANSITION');
  });
});
