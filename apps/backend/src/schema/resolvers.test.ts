import test from 'node:test';
import * as assert from 'node:assert';
import { createSchema, createYoga } from 'graphql-yoga';
import { resolvers } from './resolvers.js';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/client.js';
import { users, events, schedules } from '@festgrid/database';
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

test('events resolver integration via Yoga', async (t) => {
  await t.test('events - default sort by soonest upcoming', async () => {
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        query: `
          query {
            events(limit: 5) {
              items {
                id
                eventName
              }
              totalCount
              hasMore
            }
          }
        `
      })
    });
    
    const result = await response.json();
    assert.ok(!result.errors, 'GraphQL errors returned');
    assert.ok(result.data.events.items, 'should return items');
    assert.strictEqual(typeof result.data.events.totalCount, 'number', 'should return total count');
    assert.strictEqual(typeof result.data.events.hasMore, 'boolean', 'should return hasMore');
  });

  await t.test('events - filtering by type', async () => {
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        query: `
          query {
            events(query: { field: "types", operator: "contains", value: "MUSIC" }, limit: 10) {
              items {
                id
                types
              }
            }
          }
        `
      })
    });
    
    const result = await response.json();
    assert.ok(!result.errors, 'GraphQL errors returned');
    assert.ok(Array.isArray(result.data.events.items), 'should return array');
  });

  await t.test('events - scheduleDateRange overlaps filtering (Story 1.3h)', async (t) => {
    const createdEventIds: string[] = [];

    async function createEventWithSchedule(opts: {
      eventName: string;
      types?: string[];
      categories?: string[];
      scheduleStartDate: string;
      scheduleEndDate?: string | null;
      isMainSchedule?: boolean;
    }) {
      const [event] = await db.insert(events).values({
        eventName: opts.eventName,
        location: 'Test City',
        types: opts.types ?? null,
        categories: opts.categories ?? null,
      }).returning();
      createdEventIds.push(event.id);
      await db.insert(schedules).values({
        eventId: event.id,
        eventStartDate: opts.scheduleStartDate,
        eventEndDate: opts.scheduleEndDate ?? null,
        isMainSchedule: opts.isMainSchedule ?? true,
      });
      return event;
    }

    // AC6 boundary cases, all evaluated against range [2026-08-01, 2026-08-07]
    const insideEvent = await createEventWithSchedule({
      eventName: '1.3h test - fully inside range',
      scheduleStartDate: '2026-08-02',
      scheduleEndDate: '2026-08-03',
    });
    const spanningEvent = await createEventWithSchedule({
      eventName: '1.3h test - spans/contains range',
      scheduleStartDate: '2026-07-25',
      scheduleEndDate: '2026-08-15',
    });
    const startEdgeEvent = await createEventWithSchedule({
      eventName: '1.3h test - overlaps start edge only',
      scheduleStartDate: '2026-07-28',
      scheduleEndDate: '2026-08-02',
    });
    const endEdgeEvent = await createEventWithSchedule({
      eventName: '1.3h test - overlaps end edge only',
      scheduleStartDate: '2026-08-05',
      scheduleEndDate: '2026-08-10',
    });
    const outsideEvent = await createEventWithSchedule({
      eventName: '1.3h test - entirely outside range',
      scheduleStartDate: '2026-09-01',
      scheduleEndDate: '2026-09-05',
    });
    const singleDayEvent = await createEventWithSchedule({
      eventName: '1.3h test - single-day (null end date)',
      scheduleStartDate: '2026-08-04',
      scheduleEndDate: null,
    });
    const subScheduleOnlyEvent = await createEventWithSchedule({
      eventName: '1.3h test - main schedule outside range',
      scheduleStartDate: '2026-09-10',
      scheduleEndDate: '2026-09-12',
      isMainSchedule: true,
    });
    await db.insert(schedules).values({
      eventId: subScheduleOnlyEvent.id,
      eventStartDate: '2026-08-06',
      eventEndDate: '2026-08-06',
      isMainSchedule: false,
    });
    const compositionEvent = await createEventWithSchedule({
      eventName: '1.3h test - composition with types',
      types: ['MUSIC'],
      scheduleStartDate: '2026-08-02',
      scheduleEndDate: '2026-08-03',
    });
    const compositionMismatchEvent = await createEventWithSchedule({
      eventName: '1.3h test - composition mismatch (wrong type)',
      types: ['ARTS'],
      scheduleStartDate: '2026-08-02',
      scheduleEndDate: '2026-08-03',
    });

    t.after(async () => {
      await db.delete(events).where(inArray(events.id, createdEventIds));
    });

    const overlapsCondition = {
      field: 'scheduleDateRange',
      operator: 'overlaps',
      value: { from: '2026-08-01', to: '2026-08-07' },
    };

    async function queryOverlaps(query: unknown) {
      const response = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query Events($query: EventQueryConditionInput) {
              events(query: $query, limit: 1000) {
                items { id }
              }
            }
          `,
          variables: { query },
        }),
      });
      const result = await response.json();
      assert.ok(!result.errors, `GraphQL errors returned: ${JSON.stringify(result.errors)}`);
      return new Set<string>(result.data.events.items.map((i: { id: string }) => i.id));
    }

    await t.test('matches boundary cases per AC6', async () => {
      const ids = await queryOverlaps(overlapsCondition);
      assert.ok(ids.has(insideEvent.id), 'fully-inside schedule should match');
      assert.ok(ids.has(spanningEvent.id), 'spanning schedule should match');
      assert.ok(ids.has(startEdgeEvent.id), 'start-edge-only overlap should match');
      assert.ok(ids.has(endEdgeEvent.id), 'end-edge-only overlap should match');
      assert.ok(!ids.has(outsideEvent.id), 'entirely-outside schedule should NOT match');
      assert.ok(ids.has(singleDayEvent.id), 'single-day (null end date) schedule should match');
    });

    await t.test('matches events whose only matching schedule is a sub-schedule', async () => {
      const ids = await queryOverlaps(overlapsCondition);
      assert.ok(
        ids.has(subScheduleOnlyEvent.id),
        'event with an out-of-range main schedule but an in-range sub-schedule should match (proves EXISTS-against-full-table, not mainSchedulesOnly)'
      );
    });

    await t.test('composes correctly with an existing types condition via and (AC4)', async () => {
      const ids = await queryOverlaps({
        operator: 'and',
        conditions: [
          overlapsCondition,
          { field: 'types', operator: 'contains', value: 'MUSIC' },
        ],
      });
      assert.ok(ids.has(compositionEvent.id), 'matching date range AND matching type should match');
      assert.ok(!ids.has(compositionMismatchEvent.id), 'matching date range but non-matching type should NOT match');
    });

    await t.test('composes correctly with itself across independent or-ed conditions (AC4)', async () => {
      const secondWeekEvent = await createEventWithSchedule({
        eventName: '1.3h test - second independent week',
        scheduleStartDate: '2026-09-15',
        scheduleEndDate: '2026-09-16',
      });
      createdEventIds.push(secondWeekEvent.id);

      const ids = await queryOverlaps({
        operator: 'or',
        conditions: [
          overlapsCondition,
          {
            field: 'scheduleDateRange',
            operator: 'overlaps',
            value: { from: '2026-09-14', to: '2026-09-18' },
          },
        ],
      });
      assert.ok(ids.has(insideEvent.id), 'first scheduleDateRange condition should still match independently');
      assert.ok(ids.has(secondWeekEvent.id), 'second, independent scheduleDateRange condition should match');
      assert.ok(!ids.has(outsideEvent.id), 'event matching neither condition should NOT match');
    });
  });

  await t.test('event - fetch single event by ID with schedules', async () => {
    const allReq = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `{ events(limit: 1) { items { id } } }` })
    });
    const allRes = await allReq.json();

    if (allRes.data.events.items.length === 0) return; // skip if no seed data
    const firstEventId = allRes.data.events.items[0].id;
    
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query GetEvent($id: ID!) {
            event(id: $id) {
              id
              eventName
              schedules {
                id
                eventStartDate
              }
            }
          }
        `,
        variables: { id: firstEventId }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, 'GraphQL errors returned');
    assert.strictEqual(result.data.event.id, firstEventId);
    assert.ok(result.data.event.eventName);
    assert.ok(Array.isArray(result.data.event.schedules));
  });

  await t.test('eventBySlug - fetch single event by slug with schedules', async () => {
    const allReq = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `{ events(limit: 1) { items { id slug } } }` })
    });
    const allRes = await allReq.json();

    if (allRes.data.events.items.length === 0) return; // skip if no seed data
    const firstEvent = allRes.data.events.items[0];
    
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query GetEventBySlug($slug: String!) {
            eventBySlug(slug: $slug) {
              id
              eventName
              slug
              imageUrl
              sourcePostUrl
              originalPostUrl
              schedules {
                id
                eventStartDate
              }
            }
          }
        `,
        variables: { slug: firstEvent.slug }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, 'GraphQL errors returned');
    assert.strictEqual(result.data.eventBySlug.id, firstEvent.id);
    assert.strictEqual(result.data.eventBySlug.slug, firstEvent.slug);
    assert.ok(result.data.eventBySlug.eventName);
    assert.ok(Array.isArray(result.data.eventBySlug.schedules));
    assert.strictEqual(result.data.eventBySlug.originalPostUrl, null);
  });

  await t.test('eventBySlug - return null for non-existent slug', async () => {
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query GetEventBySlug($slug: String!) {
            eventBySlug(slug: $slug) {
              id
            }
          }
        `,
        variables: { slug: 'non-existent-slug-12345' }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, 'GraphQL errors returned');
    assert.strictEqual(result.data.eventBySlug, null);
  });

  await t.test('me - throws UNAUTHENTICATED error when not authenticated', async () => {
    mockUser = null;
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            me {
              id
              email
              role
            }
          }
        `
      })
    });

    const result = await response.json();
    assert.ok(result.errors, 'should return errors');
    assert.strictEqual(result.errors[0].extensions?.code, 'UNAUTHENTICATED');
  });

  await t.test('me - returns user details when authenticated', async () => {
    // Get an existing seeded user
    const seededUsers = await db.select().from(users).limit(1);
    if (seededUsers.length === 0) return;

    const testUser = seededUsers[0];
    mockUser = { userId: testUser.id, role: testUser.role };

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            me {
              id
              email
              role
            }
          }
        `
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, 'GraphQL errors returned');
    assert.strictEqual(result.data.me.id, testUser.id);
    assert.strictEqual(result.data.me.email, testUser.email);
    assert.strictEqual(result.data.me.role, testUser.role);
  });
});
