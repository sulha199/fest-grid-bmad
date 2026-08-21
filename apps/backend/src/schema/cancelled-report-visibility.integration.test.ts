import test from 'node:test';
import * as assert from 'node:assert';
import { createSchema, createYoga } from 'graphql-yoga';
import { resolvers } from './resolvers.js';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/client.js';
import { users, events, schedules, reports } from '@festgrid/database';
import { eq, inArray, gte, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { shouldSoftDeleteFromCancelledReports, getCancelledReportWindowCutoff } from '@festgrid/domain/events';

// Read the generated schema for the yoga server
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

test('Story 4.4: Cancelled Report Visibility and Soft-Delete Flow', async (t) => {
  let user1: any;
  let user2: any;
  let user3: any;
  let moderator: any;
  let testEvent: any;
  let testSchedule: any;

  t.beforeEach(async () => {
    try {
      const suffix = Date.now() + Math.random().toString(36).substring(2, 7);
      
      // 1.1 In a beforeEach, insert 3 distinct users rows directly
      const [u1] = await db.insert(users).values({
        email: `reporter-1-${suffix}@test.com`,
        name: 'Reporter 1',
        role: 'user',
      }).returning();
      user1 = u1;

      const [u2] = await db.insert(users).values({
        email: `reporter-2-${suffix}@test.com`,
        name: 'Reporter 2',
        role: 'user',
      }).returning();
      user2 = u2;

      const [u3] = await db.insert(users).values({
        email: `reporter-3-${suffix}@test.com`,
        name: 'Reporter 3',
        role: 'user',
      }).returning();
      user3 = u3;

      // Insert moderator user
      const [mod] = await db.insert(users).values({
        email: `moderator-${suffix}@test.com`,
        name: 'Moderator',
        role: 'moderator',
      }).returning();
      moderator = mod;

      // Insert one events row
      const [ev] = await db.insert(events).values({
        eventName: `Cancelled Threshold Test Event ${suffix}`,
        slug: `cancelled-threshold-test-event-${suffix}`,
        location: 'Integration Test, US',
      }).returning();
      testEvent = ev;

      // Insert one schedules row (main schedule)
      const [sch] = await db.insert(schedules).values({
        eventId: testEvent.id,
        isMainSchedule: true,
        eventStartDate: new Date().toISOString().slice(0, 10),
        location: 'Integration Test, US',
      }).returning();
      testSchedule = sch;
    } catch (err) {
      console.error('ERROR IN BEFOREEACH setup:', err);
      throw err;
    }
  });

  t.afterEach(async () => {
    try {
      // Teardown test-local data
      if (testEvent) {
        await db.delete(reports).where(eq(reports.eventId, testEvent.id));
        await db.delete(schedules).where(eq(schedules.eventId, testEvent.id));
        await db.delete(events).where(eq(events.id, testEvent.id));
      }
      const userIds = [user1?.id, user2?.id, user3?.id, moderator?.id].filter(Boolean);
      if (userIds.length > 0) {
        await db.delete(users).where(inArray(users.id, userIds));
      }
    } catch (err) {
      console.error('ERROR IN AFTEREACH cleanup:', err);
      throw err;
    }
  });

  // Helper helper to submit report via real resolver / Yoga fetch
  const submit = async (user: any, reason: string) => {
    mockUser = { userId: user.id, role: user.role };
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation SubmitReport($eventId: ID!, $reason: ReportReason!) {
            submitReport(eventId: $eventId, reason: $reason) {
              id
              reason
              status
            }
          }
        `,
        variables: {
          eventId: testEvent.id,
          reason,
        }
      })
    });
    return await response.json();
  };

  // Helper helper to query events list
  const queryEvents = async (user: any, includeSoftDeleted = false) => {
    mockUser = user ? { userId: user.id, role: user.role } : null;
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query GetEvents($includeSoftDeleted: Boolean) {
            events(includeSoftDeleted: $includeSoftDeleted) {
              items {
                id
                eventName
              }
            }
          }
        `,
        variables: {
          includeSoftDeleted,
        }
      })
    });
    return await response.json();
  };

  // Helper helper to query event details by ID
  const queryEventDetails = async (user: any, id: string) => {
    mockUser = user ? { userId: user.id, role: user.role } : null;
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query GetEvent($id: ID!) {
            event(id: $id) {
              id
              eventName
            }
          }
        `,
        variables: { id }
      })
    });
    return await response.json();
  };

  // Helper helper to query event details by Slug
  const queryEventBySlug = async (user: any, slug: string) => {
    mockUser = user ? { userId: user.id, role: user.role } : null;
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query GetEventBySlug($slug: String!) {
            eventBySlug(slug: $slug) {
              id
              eventName
            }
          }
        `,
        variables: { slug }
      })
    });
    return await response.json();
  };

  // Helper to restore event
  const restoreEvent = async (user: any, id: string) => {
    mockUser = { userId: user.id, role: user.role };
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation RestoreEvent($id: ID!) {
            restoreEvent(id: $id, action: RESTORE) {
              id
            }
          }
        `,
        variables: { id }
      })
    });
    return await response.json();
  };

  await t.test('1.2: 3 unique reports triggers soft delete, 1 & 2 do not', async () => {
    // 1st unique report -> should stay active
    let res = await submit(user1, 'cancelled');
    assert.ok(!res.errors, `errors: ${JSON.stringify(res.errors)}`);
    let [evState] = await db.select().from(events).where(eq(events.id, testEvent.id));
    assert.strictEqual(evState.deletedAt, null, 'Should be active after 1 report');

    // 2nd unique report -> should stay active
    res = await submit(user2, 'cancelled');
    assert.ok(!res.errors, `errors: ${JSON.stringify(res.errors)}`);
    [evState] = await db.select().from(events).where(eq(events.id, testEvent.id));
    assert.strictEqual(evState.deletedAt, null, 'Should be active after 2 reports');

    // 3rd unique report -> threshold reached, soft deleted!
    res = await submit(user3, 'cancelled');
    assert.ok(!res.errors, `errors: ${JSON.stringify(res.errors)}`);
    [evState] = await db.select().from(events).where(eq(events.id, testEvent.id));
    assert.ok(evState.deletedAt !== null, 'Event should be soft-deleted after 3 unique reports');
  });

  await t.test('1.3: regular query excludes, moderator query with includeSoftDeleted includes', async () => {
    // Trigger soft delete
    await submit(user1, 'cancelled');
    await submit(user2, 'cancelled');
    await submit(user3, 'cancelled');

    // Regular query 'events' should exclude the soft-deleted event
    const eventsRes = await queryEvents(user1, false);
    assert.ok(!eventsRes.errors, `eventsRes errors: ${JSON.stringify(eventsRes.errors)}`);
    const items = eventsRes.data.events.items;
    const found = items.find((item: any) => item.id === testEvent.id);
    assert.strictEqual(found, undefined, 'Soft-deleted event should not be in regular events query');

    // Regular 'event' by ID query should return null
    const eventRes = await queryEventDetails(user1, testEvent.id);
    assert.ok(!eventRes.errors, `eventRes errors: ${JSON.stringify(eventRes.errors)}`);
    assert.strictEqual(eventRes.data.event, null, 'Soft-deleted event by ID should be null for regular users');

    // Regular 'eventBySlug' query should return null
    const eventSlugRes = await queryEventBySlug(user1, testEvent.slug);
    assert.ok(!eventSlugRes.errors, `eventSlugRes errors: ${JSON.stringify(eventSlugRes.errors)}`);
    assert.strictEqual(eventSlugRes.data.eventBySlug, null, 'Soft-deleted event by slug should be null for regular users');

    // Moderator query with includeSoftDeleted: true should return it
    const modEventsRes = await queryEvents(moderator, true);
    assert.ok(!modEventsRes.errors, `modEventsRes errors: ${JSON.stringify(modEventsRes.errors)}`);
    const modItems = modEventsRes.data.events.items;
    const modFound = modItems.find((item: any) => item.id === testEvent.id);
    assert.ok(modFound, 'Soft-deleted event should be returned for moderators with includeSoftDeleted: true');

    // Check deletedAt directly on the database
    const [evInDb] = await db.select().from(events).where(eq(events.id, testEvent.id));
    assert.ok(evInDb.deletedAt !== null, 'deletedAt should be populated in the database');
  });

  await t.test('1.4: restoreEvent makes it visible again with deletedAt null', async () => {
    // Trigger soft delete
    await submit(user1, 'cancelled');
    await submit(user2, 'cancelled');
    await submit(user3, 'cancelled');

    // Restore event
    const restoreRes = await restoreEvent(moderator, testEvent.id);
    assert.ok(!restoreRes.errors, `Restore error: ${JSON.stringify(restoreRes.errors)}`);

    // Verify deletedAt in db is null
    const [evInDb] = await db.select().from(events).where(eq(events.id, testEvent.id));
    assert.strictEqual(evInDb.deletedAt, null, 'deletedAt should be null after restore');

    // Regular queries should find it again
    const eventRes = await queryEventDetails(user1, testEvent.id);
    assert.ok(!eventRes.errors);
    assert.ok(eventRes.data.event, 'Should find restored event by ID');
    assert.strictEqual(eventRes.data.event.id, testEvent.id);
  });

  await t.test('1.5: out-of-window reports do not count toward threshold', async () => {
    // 1st report: valid cancelled report via resolver
    await submit(user1, 'cancelled');

    // 2nd report: valid cancelled report via resolver
    await submit(user2, 'cancelled');

    // 3rd report: out of window (backdated to 10 days ago, threshold default window is 7 days)
    const tenDaysAgo = new Date();
    tenDaysAgo.setUTCDate(tenDaysAgo.getUTCDate() - 10);

    // Raw insert the 3rd report to simulate backdating
    await db.insert(reports).values({
      eventId: testEvent.id,
      reporterUserId: user3.id,
      reason: 'cancelled',
      status: 'pending',
      createdAt: tenDaysAgo,
    });

    // Check unique reports within window: should be 2, because the 3rd is out of window
    const windowDays = 7;
    const cutoff = getCancelledReportWindowCutoff({ windowDays });
    
    const countRes = await db.select({
      count: sql<number>`count(distinct ${reports.reporterUserId})`
    })
    .from(reports)
    .where(
      and(
        eq(reports.eventId, testEvent.id),
        eq(reports.reason, 'cancelled'),
        gte(reports.createdAt, cutoff)
      )
    );
    const uniqueCount = Number(countRes[0]?.count ?? 0);
    assert.strictEqual(uniqueCount, 2, 'Should only count 2 active reports in window');

    const shouldDelete = shouldSoftDeleteFromCancelledReports({
      uniqueReporterCount: uniqueCount,
      threshold: 3,
    });
    assert.strictEqual(shouldDelete, false, 'Should not soft-delete since active reports count (2) is less than threshold (3)');

    // Ensure database row for events still has deletedAt as null
    const [evState] = await db.select().from(events).where(eq(events.id, testEvent.id));
    assert.strictEqual(evState.deletedAt, null, 'Event should remain active because the old report is outside the 7-day window');
  });
});
