import test from 'node:test';
import * as assert from 'node:assert';
import { createSchema, createYoga } from 'graphql-yoga';
import { resolvers } from './resolvers.js';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/client.js';
import { users, events, schedules, userLocations, userSettings } from '@festgrid/database';
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

  await t.test('withinRadius integration tests', async (t) => {
    // Get existing seeded user
    const seededUsers = await db.select().from(users).limit(1);
    if (seededUsers.length === 0) return;
    const testUser = seededUsers[0];

    // Create custom test user locations
    const [userLoc1] = await db.insert(userLocations).values({
      userId: testUser.id,
      name: 'Test Location 1',
      latitude: -6.2000,
      longitude: 106.8000,
      radius: 5000,
      locationDetails: {
        coordinates: { latitude: -6.2000, longitude: 106.8000 },
        formattedAddress: 'Test Location 1',
        placeName: 'Test Location 1',
        provider: 'GEOAPIFY'
      }
    }).returning();

    const [userLoc2] = await db.insert(userLocations).values({
      userId: testUser.id,
      name: 'Test Location 2',
      latitude: -6.3000,
      longitude: 106.9000,
      radius: 5000,
      locationDetails: {
        coordinates: { latitude: -6.3000, longitude: 106.9000 },
        formattedAddress: 'Test Location 2',
        placeName: 'Test Location 2',
        provider: 'GEOAPIFY'
      }
    }).returning();

    // Create 4 events + schedules at various distances
    const [eventA] = await db.insert(events).values({
      eventName: 'WithinRadius Event A',
      location: 'Test Location 1 Near',
    }).returning();
    const [schedA] = await db.insert(schedules).values({
      eventId: eventA.id,
      isMainSchedule: true,
      eventStartDate: '2026-09-01',
      latitude: -6.2010,
      longitude: 106.8010,
      locationDetails: { coordinates: { latitude: -6.2010, longitude: 106.8010 } }
    }).returning();

    const [eventB] = await db.insert(events).values({
      eventName: 'WithinRadius Event B',
      location: 'Test Location 2 Near',
    }).returning();
    const [schedB] = await db.insert(schedules).values({
      eventId: eventB.id,
      isMainSchedule: true,
      eventStartDate: '2026-09-02',
      latitude: -6.2990,
      longitude: 106.8990,
      locationDetails: { coordinates: { latitude: -6.2990, longitude: 106.8990 } }
    }).returning();

    const [eventC] = await db.insert(events).values({
      eventName: 'WithinRadius Event C',
      location: 'Far Away Event',
    }).returning();
    const [schedC] = await db.insert(schedules).values({
      eventId: eventC.id,
      isMainSchedule: true,
      eventStartDate: '2026-09-03',
      latitude: -1.0000,
      longitude: 100.0000,
      locationDetails: { coordinates: { latitude: -1.0000, longitude: 100.0000 } }
    }).returning();

    const [eventD] = await db.insert(events).values({
      eventName: 'WithinRadius Event D',
      location: 'No Coordinates Event',
    }).returning();
    const [schedD] = await db.insert(schedules).values({
      eventId: eventD.id,
      isMainSchedule: true,
      eventStartDate: '2026-09-04',
      latitude: null,
      longitude: null,
      locationDetails: null
    }).returning();

    t.after(async () => {
      await db.delete(schedules).where(inArray(schedules.id, [schedA.id, schedB.id, schedC.id, schedD.id]));
      await db.delete(events).where(inArray(events.id, [eventA.id, eventB.id, eventC.id, eventD.id]));
      await db.delete(userLocations).where(inArray(userLocations.id, [userLoc1.id, userLoc2.id]));
    });

    await t.test('1. filters correctly within radius for saved location shape (AC1, AC6)', async () => {
      mockUser = { userId: testUser.id, role: testUser.role };
      const response = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query {
              events(query: { field: "scheduleCoordinates", operator: "withinRadius", value: { locationPreferenceId: "${userLoc1.id}", radiusKm: 10 } }) {
                items { id eventName }
              }
            }
          `
        })
      });
      const result = await response.json();
      assert.ok(!result.errors, 'GraphQL errors returned');
      const items = result.data.events.items;
      const ids = new Set(items.map((i: any) => i.id));
      assert.ok(ids.has(eventA.id), 'should find event A near location 1');
      assert.ok(!ids.has(eventB.id), 'should not find event B which is far from location 1');
      assert.ok(!ids.has(eventC.id), 'should not find event C which is far');
      assert.ok(!ids.has(eventD.id), 'should not find event D which has no coordinates');
    });

    await t.test('2. filters correctly within radius for ad-hoc coordinate shape (AC1a)', async () => {
      mockUser = { userId: testUser.id, role: testUser.role };
      const response = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query {
              events(query: { field: "scheduleCoordinates", operator: "withinRadius", value: { latitude: -6.2000, longitude: 106.8000, radiusKm: 10 } }) {
                items { id eventName }
              }
            }
          `
        })
      });
      const result = await response.json();
      assert.ok(!result.errors, 'GraphQL errors returned');
      const items = result.data.events.items;
      const ids = new Set(items.map((i: any) => i.id));
      assert.ok(ids.has(eventA.id), 'should find event A');
      assert.ok(!ids.has(eventB.id), 'should not find event B');
      assert.ok(!ids.has(eventC.id), 'should not find event C');
      assert.ok(!ids.has(eventD.id), 'should not find event D');
    });

    await t.test('3. unauthenticated withinRadius query throws UNAUTHENTICATED (AC4)', async () => {
      mockUser = null;
      const res1 = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query {
              events(query: { field: "scheduleCoordinates", operator: "withinRadius", value: { locationPreferenceId: "${userLoc1.id}", radiusKm: 10 } }) {
                items { id }
              }
            }
          `
        })
      });
      const result1 = await res1.json();
      assert.ok(result1.errors, 'unauthenticated query should return error');
      assert.strictEqual(result1.errors[0].extensions?.code, 'UNAUTHENTICATED');

      const res2 = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query {
              events(query: { field: "scheduleCoordinates", operator: "withinRadius", value: { latitude: -6.2000, longitude: 106.8000, radiusKm: 10 } }) {
                items { id }
              }
            }
          `
        })
      });
      const result2 = await res2.json();
      assert.ok(result2.errors, 'unauthenticated ad-hoc query should return error');
      assert.strictEqual(result2.errors[0].extensions?.code, 'UNAUTHENTICATED');
    });

    await t.test('4. unowned or unknown locationPreferenceId throws NOT_FOUND (AC4)', async () => {
      mockUser = { userId: testUser.id, role: testUser.role };
      const response = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query {
              events(query: { field: "scheduleCoordinates", operator: "withinRadius", value: { locationPreferenceId: "00000000-0000-0000-0000-000000000999", radiusKm: 10 } }) {
                items { id }
              }
            }
          `
        })
      });
      const result = await response.json();
      assert.ok(result.errors, 'unknown location ID should return error');
      assert.strictEqual(result.errors[0].extensions?.code, 'NOT_FOUND');
      assert.strictEqual(result.errors[0].message, 'Location not found');
    });

    await t.test('5. or of two different owned locationPreferenceIds returns union of both radii (AC5)', async () => {
      mockUser = { userId: testUser.id, role: testUser.role };
      const response = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query {
              events(query: {
                operator: "or",
                conditions: [
                  { field: "scheduleCoordinates", operator: "withinRadius", value: { locationPreferenceId: "${userLoc1.id}", radiusKm: 10 } },
                  { field: "scheduleCoordinates", operator: "withinRadius", value: { locationPreferenceId: "${userLoc2.id}", radiusKm: 10 } }
                ]
              }) {
                items { id eventName }
              }
            }
          `
        })
      });
      const result = await response.json();
      assert.ok(!result.errors, 'GraphQL errors returned');
      const items = result.data.events.items;
      const ids = new Set(items.map((i: any) => i.id));
      assert.ok(ids.has(eventA.id), 'should find event A (near loc 1)');
      assert.ok(ids.has(eventB.id), 'should find event B (near loc 2)');
      assert.ok(!ids.has(eventC.id), 'should not find event C (far)');
    });
  });

  await t.test('userSettings integration tests (Story 2.6a)', async (t) => {
    let settingsTestUser: any;

    t.beforeEach(async () => {
      const email = `settings-user-${Math.random()}@example.com`;
      const [u] = await db.insert(users).values({
        email,
        name: 'Settings Test User',
        role: 'user'
      }).returning();
      settingsTestUser = u;
    });

    await t.test('mySettings - throws UNAUTHENTICATED error when not authenticated (AC4)', async () => {
      mockUser = null;
      const response = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query {
              mySettings {
                id
                hidePastEventsAfterDays
                pushNotificationsEnabled
              }
            }
          `
        })
      });

      const result = await response.json();
      assert.ok(result.errors, 'Expected unauthenticated error');
      assert.strictEqual(result.errors[0].extensions?.code, 'UNAUTHENTICATED');
    });

    await t.test('mySettings - transparently creates default settings row on first call (AC1, AC2)', async () => {
      mockUser = { userId: settingsTestUser.id, role: settingsTestUser.role };

      // Ensure no row exists beforehand
      const preCount = await db.select().from(userSettings).where(eq(userSettings.userId, settingsTestUser.id));
      assert.strictEqual(preCount.length, 0);

      const response = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query {
              mySettings {
                hidePastEventsAfterDays
                pushNotificationsEnabled
              }
            }
          `
        })
      });

      const result = await response.json();
      assert.ok(!result.errors, 'GraphQL errors returned: ' + JSON.stringify(result.errors));
      assert.strictEqual(result.data.mySettings.hidePastEventsAfterDays, 7);
      assert.strictEqual(result.data.mySettings.pushNotificationsEnabled, true);

      // Verify row exists in DB
      const postCount = await db.select().from(userSettings).where(eq(userSettings.userId, settingsTestUser.id));
      assert.strictEqual(postCount.length, 1);
    });

    await t.test('mySettings - is race-safe and does not duplicate insert (AC2)', async () => {
      mockUser = { userId: settingsTestUser.id, role: settingsTestUser.role };

      // Fire concurrent requests
      const promises = Array.from({ length: 3 }).map(async () => {
        const res = await yoga.fetch('http://yoga/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `
              query {
                mySettings {
                  id
                }
              }
            `
          })
        });
        return (res as Response).json();
      });

      const results = await Promise.all(promises);
      for (const res of results) {
        assert.ok(!res.errors, 'Expected no error in concurrent calls');
      }

      // Assert only a single row exists in the database
      const rows = await db.select().from(userSettings).where(eq(userSettings.userId, settingsTestUser.id));
      assert.strictEqual(rows.length, 1);
    });

    await t.test('updateUserSettings - partially updates only provided fields (AC3)', async () => {
      mockUser = { userId: settingsTestUser.id, role: settingsTestUser.role };

      // 1. Update only pushNotificationsEnabled to false
      const res1 = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation {
              updateUserSettings(input: { pushNotificationsEnabled: false }) {
                hidePastEventsAfterDays
                pushNotificationsEnabled
              }
            }
          `
        })
      });
      const result1 = await res1.json();
      assert.ok(!result1.errors, 'Mutation 1 failed');
      assert.strictEqual(result1.data.updateUserSettings.pushNotificationsEnabled, false);
      // hidePastEventsAfterDays should remain default (7)
      assert.strictEqual(result1.data.updateUserSettings.hidePastEventsAfterDays, 7);

      // 2. Update only hidePastEventsAfterDays to 14
      const res2 = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation {
              updateUserSettings(input: { hidePastEventsAfterDays: 14 }) {
                hidePastEventsAfterDays
                pushNotificationsEnabled
              }
            }
          `
        })
      });
      const result2 = await res2.json();
      assert.ok(!result2.errors, 'Mutation 2 failed');
      assert.strictEqual(result2.data.updateUserSettings.hidePastEventsAfterDays, 14);
      // pushNotificationsEnabled should remain false from the previous mutation
      assert.strictEqual(result2.data.updateUserSettings.pushNotificationsEnabled, false);
    });

    await t.test('updateUserSettings - returns BAD_REQUEST on out-of-bounds hidePastEventsAfterDays (AC5)', async () => {
      mockUser = { userId: settingsTestUser.id, role: settingsTestUser.role };

      const response = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation {
              updateUserSettings(input: { hidePastEventsAfterDays: 400 }) {
                hidePastEventsAfterDays
              }
            }
          `
        })
      });

      const result = await response.json();
      assert.ok(result.errors, 'Expected validation error');
      assert.strictEqual(result.errors[0].extensions?.code, 'BAD_REQUEST');

      // Verify DB row remains unchanged (or default/unset)
      const rows = await db.select().from(userSettings).where(eq(userSettings.userId, settingsTestUser.id));
      if (rows.length > 0) {
        assert.notStrictEqual(rows[0].hidePastEventsAfterDays, 400);
      }
    });

    await t.test('updateUserSettings - throws UNAUTHENTICATED error when not authenticated (AC4)', async () => {
      mockUser = null;
      const response = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation {
              updateUserSettings(input: { pushNotificationsEnabled: false }) {
                id
              }
            }
          `
        })
      });

      const result = await response.json();
      assert.ok(result.errors, 'Expected unauthenticated error');
      assert.strictEqual(result.errors[0].extensions?.code, 'UNAUTHENTICATED');
    });
  });
});
