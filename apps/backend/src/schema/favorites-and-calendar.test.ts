import test from 'node:test';
import * as assert from 'node:assert';
import { createSchema, createYoga } from 'graphql-yoga';
import { resolvers } from './resolvers.js';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/client.js';
import { users, events, schedules, favorites, calendarAdditions } from '@festgrid/database';
import { eq } from 'drizzle-orm';

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

test('favorites and calendar additions resolvers integration', async (t) => {
  let testUser: any;
  let testEventId: string;
  let testScheduleId: string;
  
  await t.test('setup - get test user and event', async () => {
    const seededUsers = await db.select().from(users).limit(1);
    if (seededUsers.length > 0) {
      testUser = seededUsers[0];
    }

    const [insertedEvent] = await db.insert(events).values({
      eventName: `Favorites/Calendar Test Event ${Date.now()}`,
      slug: `favorites-calendar-test-event-${Date.now()}`,
      location: 'Integration Test, US',
    }).returning();
    testEventId = insertedEvent.id;

    const [insertedSchedule] = await db.insert(schedules).values({
      eventId: testEventId,
      isMainSchedule: true,
      eventStartDate: new Date().toISOString().slice(0, 10),
      location: 'Integration Test, US',
    }).returning();
    testScheduleId = insertedSchedule.id;

    if (testUser && testEventId) {
      await db.delete(favorites).where(eq(favorites.userId, testUser.id));
      await db.delete(calendarAdditions).where(eq(calendarAdditions.userId, testUser.id));
    }
  });

  t.after(async () => {
    if (testUser) {
      await db.delete(favorites).where(eq(favorites.userId, testUser.id));
      await db.delete(calendarAdditions).where(eq(calendarAdditions.userId, testUser.id));
    }
    if (testEventId) {
      await db.delete(schedules).where(eq(schedules.eventId, testEventId));
      await db.delete(events).where(eq(events.id, testEventId));
    }
  });

  await t.test('toggleFavorite - unauthenticated rejected', async () => {
    mockUser = null;
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ToggleFavorite($eventId: ID!) {
            toggleFavorite(eventId: $eventId) {
              eventId
              isFavorited
            }
          }
        `,
        variables: { eventId: testEventId }
      })
    });

    const result = await response.json();
    assert.ok(result.errors, 'should return errors');
    assert.strictEqual(result.errors[0].extensions?.code, 'UNAUTHENTICATED');
  });

  await t.test('toggleFavorite - toggle on, off, and on', async () => {
    if (!testUser || !testEventId) return; // skip if no seed data
    mockUser = { userId: testUser.id, role: testUser.role };

    // 1. Toggle ON
    const res1 = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation { toggleFavorite(eventId: "${testEventId}") { isFavorited } }`
      })
    });
    const result1 = await res1.json();
    assert.ok(!result1.errors);
    assert.strictEqual(result1.data.toggleFavorite.isFavorited, true);

    // Verify field resolver
    const queryRes1 = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `{ event(id: "${testEventId}") { isFavorited } }` })
    });
    const queryResult1 = await queryRes1.json();
    assert.strictEqual(queryResult1.data.event.isFavorited, true);

    // 2. Toggle OFF
    const res2 = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation { toggleFavorite(eventId: "${testEventId}") { isFavorited } }`
      })
    });
    const result2 = await res2.json();
    assert.ok(!result2.errors);
    assert.strictEqual(result2.data.toggleFavorite.isFavorited, false);

    // Verify field resolver
    const queryRes2 = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `{ event(id: "${testEventId}") { isFavorited } }` })
    });
    const queryResult2 = await queryRes2.json();
    assert.strictEqual(queryResult2.data.event.isFavorited, false);

    // 3. Toggle ON again (re-toggle)
    const res3 = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation { toggleFavorite(eventId: "${testEventId}") { isFavorited } }`
      })
    });
    const result3 = await res3.json();
    assert.ok(!result3.errors);
    assert.strictEqual(result3.data.toggleFavorite.isFavorited, true);
  });

  await t.test('events filtering by isFavorited', async () => {
    if (!testUser || !testEventId) return;
    mockUser = { userId: testUser.id, role: testUser.role };

    // Authenticated
    const response1 = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            events(query: { field: "isFavorited", operator: "eq", value: true }) {
              items { id }
            }
          }
        `
      })
    });
    const result1 = await response1.json();
    assert.ok(!result1.errors);
    assert.ok(result1.data.events.items.length > 0);
    assert.ok(result1.data.events.items.some((i: { id: string }) => i.id === testEventId));

    // Unauthenticated should return empty
    mockUser = null;
    const response2 = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            events(query: { field: "isFavorited", operator: "eq", value: true }) {
              items { id }
            }
          }
        `
      })
    });
    const result2 = await response2.json();
    assert.ok(!result2.errors);
    assert.strictEqual(result2.data.events.items.length, 0);
  });

  await t.test('toggleCalendarAddition - unauthenticated rejected', async () => {
    mockUser = null;
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ToggleCalendarAddition($eventId: ID!, $scheduleId: ID!) {
            toggleCalendarAddition(eventId: $eventId, scheduleId: $scheduleId) {
              eventId
              scheduleId
              isAddedToCalendar
            }
          }
        `,
        variables: { eventId: testEventId, scheduleId: testScheduleId }
      })
    });

    const result = await response.json();
    assert.ok(result.errors);
    assert.strictEqual(result.errors[0].extensions?.code, 'UNAUTHENTICATED');
  });

  await t.test('toggleCalendarAddition - mismatch integrity check', async () => {
    if (!testUser || !testEventId || !testScheduleId) return;
    mockUser = { userId: testUser.id, role: testUser.role };

    const invalidEventId = "00000000-0000-0000-0000-000000000000";
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ToggleCalendarAddition($eventId: ID!, $scheduleId: ID!) {
            toggleCalendarAddition(eventId: $eventId, scheduleId: $scheduleId) {
              isAddedToCalendar
            }
          }
        `,
        variables: { eventId: invalidEventId, scheduleId: testScheduleId }
      })
    });

    const result = await response.json();
    assert.ok(result.errors);
    assert.strictEqual(result.errors[0].extensions?.code, 'BAD_REQUEST');
    assert.strictEqual(result.errors[0].message, 'Event ID mismatch');
  });

  await t.test('toggleCalendarAddition - toggle on, off, and on', async () => {
    if (!testUser || !testEventId || !testScheduleId) return;
    mockUser = { userId: testUser.id, role: testUser.role };

    // 1. Toggle ON
    const res1 = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation { toggleCalendarAddition(eventId: "${testEventId}", scheduleId: "${testScheduleId}") { isAddedToCalendar } }`
      })
    });
    const result1 = await res1.json();
    assert.ok(!result1.errors);
    assert.strictEqual(result1.data.toggleCalendarAddition.isAddedToCalendar, true);

    // Verify field resolvers on Event and Schedule
    const queryRes1 = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `{ event(id: "${testEventId}") { isAddedToCalendar schedules { isAddedToCalendar } } }` })
    });
    const queryResult1 = await queryRes1.json();
    assert.strictEqual(queryResult1.data.event.isAddedToCalendar, true);
    assert.ok(queryResult1.data.event.schedules.some((s: { isAddedToCalendar: boolean }) => s.isAddedToCalendar === true));

    // 2. Toggle OFF
    const res2 = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation { toggleCalendarAddition(eventId: "${testEventId}", scheduleId: "${testScheduleId}") { isAddedToCalendar } }`
      })
    });
    const result2 = await res2.json();
    assert.ok(!result2.errors);
    assert.strictEqual(result2.data.toggleCalendarAddition.isAddedToCalendar, false);

    const queryRes2 = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `{ event(id: "${testEventId}") { isAddedToCalendar schedules { isAddedToCalendar } } }` })
    });
    const queryResult2 = await queryRes2.json();
    assert.strictEqual(queryResult2.data.event.isAddedToCalendar, false);

    // 3. Toggle ON again
    const res3 = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation { toggleCalendarAddition(eventId: "${testEventId}", scheduleId: "${testScheduleId}") { isAddedToCalendar } }`
      })
    });
    const result3 = await res3.json();
    assert.ok(!result3.errors);
    assert.strictEqual(result3.data.toggleCalendarAddition.isAddedToCalendar, true);
  });

  await t.test('events filtering by isAddedToCalendar', async () => {
    if (!testUser || !testEventId) return;
    mockUser = { userId: testUser.id, role: testUser.role };

    // Authenticated
    const response1 = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            events(query: { field: "isAddedToCalendar", operator: "eq", value: true }) {
              items { id }
            }
          }
        `
      })
    });
    const result1 = await response1.json();
    assert.ok(!result1.errors);
    assert.ok(result1.data.events.items.length > 0);
    assert.ok(result1.data.events.items.some((i: { id: string }) => i.id === testEventId));

    // Unauthenticated should return empty
    mockUser = null;
    const response2 = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            events(query: { field: "isAddedToCalendar", operator: "eq", value: true }) {
              items { id }
            }
          }
        `
      })
    });
    const result2 = await response2.json();
    assert.ok(!result2.errors);
    assert.strictEqual(result2.data.events.items.length, 0);
  });
});
