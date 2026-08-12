import test from 'node:test';
import * as assert from 'node:assert';
import { createSchema, createYoga } from 'graphql-yoga';
import { resolvers } from './resolvers.js';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/client.js';
import { users, events, schedules, userLocations, userSettings, posts, socialMediaAccountProfiles, reports, favorites } from '@festgrid/database';
import { eq, inArray, count, sql } from 'drizzle-orm';

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

    // AC6 boundary cases, all evaluated against range [2030-08-01, 2030-08-07]
    const insideEvent = await createEventWithSchedule({
      eventName: '1.3h test - fully inside range',
      scheduleStartDate: '2030-08-02',
      scheduleEndDate: '2030-08-03',
    });
    const spanningEvent = await createEventWithSchedule({
      eventName: '1.3h test - spans/contains range',
      scheduleStartDate: '2030-07-25',
      scheduleEndDate: '2030-08-15',
    });
    const startEdgeEvent = await createEventWithSchedule({
      eventName: '1.3h test - overlaps start edge only',
      scheduleStartDate: '2030-07-28',
      scheduleEndDate: '2030-08-02',
    });
    const endEdgeEvent = await createEventWithSchedule({
      eventName: '1.3h test - overlaps end edge only',
      scheduleStartDate: '2030-08-05',
      scheduleEndDate: '2030-08-10',
    });
    const outsideEvent = await createEventWithSchedule({
      eventName: '1.3h test - entirely outside range',
      scheduleStartDate: '2030-09-01',
      scheduleEndDate: '2030-09-05',
    });
    const singleDayEvent = await createEventWithSchedule({
      eventName: '1.3h test - single-day (null end date)',
      scheduleStartDate: '2030-08-04',
      scheduleEndDate: null,
    });
    const subScheduleOnlyEvent = await createEventWithSchedule({
      eventName: '1.3h test - main schedule outside range',
      scheduleStartDate: '2030-09-10',
      scheduleEndDate: '2030-09-12',
      isMainSchedule: true,
    });
    await db.insert(schedules).values({
      eventId: subScheduleOnlyEvent.id,
      eventStartDate: '2030-08-06',
      eventEndDate: '2030-08-06',
      isMainSchedule: false,
    });
    const compositionEvent = await createEventWithSchedule({
      eventName: '1.3h test - composition with types',
      types: ['MUSIC'],
      scheduleStartDate: '2030-08-02',
      scheduleEndDate: '2030-08-03',
    });
    const compositionMismatchEvent = await createEventWithSchedule({
      eventName: '1.3h test - composition mismatch (wrong type)',
      types: ['ARTS'],
      scheduleStartDate: '2030-08-02',
      scheduleEndDate: '2030-08-03',
    });

    t.after(async () => {
      await db.delete(events).where(inArray(events.id, createdEventIds));
    });

    const overlapsCondition = {
      field: 'scheduleDateRange',
      operator: 'overlaps',
      value: { from: '2030-08-01', to: '2030-08-07' },
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
        scheduleStartDate: '2030-09-15',
        scheduleEndDate: '2030-09-16',
      });
      createdEventIds.push(secondWeekEvent.id);

      const ids = await queryOverlaps({
        operator: 'or',
        conditions: [
          overlapsCondition,
          {
            field: 'scheduleDateRange',
            operator: 'overlaps',
            value: { from: '2030-09-14', to: '2030-09-18' },
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

  await t.test('events - default past-event visibility filter (Story 2.7)', async (t) => {
    const createdEventIds: string[] = [];
    const createdScheduleIds: string[] = [];
    
    const daysAgo = (n: number) => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - n);
      return d.toISOString().split('T')[0];
    };
    const daysAhead = (n: number) => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + n);
      return d.toISOString().split('T')[0];
    };

    const email = `visibility-test-${Math.random()}@example.com`;
    const [testUser] = await db.insert(users).values({
      email,
      name: 'Visibility Test User',
      role: 'user'
    }).returning();

    async function createTestEvent(opts: {
      eventName: string;
      startDate: string;
      endDate?: string | null;
      types?: string[];
      subSchedules?: { startDate: string; endDate?: string | null }[];
    }) {
      const [event] = await db.insert(events).values({
        eventName: opts.eventName,
        location: 'Test City',
        types: opts.types ?? null,
      }).returning();
      createdEventIds.push(event.id);

      const [sched] = await db.insert(schedules).values({
        eventId: event.id,
        eventStartDate: opts.startDate,
        eventEndDate: opts.endDate ?? null,
        isMainSchedule: true,
      }).returning();
      createdScheduleIds.push(sched.id);

      if (opts.subSchedules) {
        for (const sub of opts.subSchedules) {
          const [subSched] = await db.insert(schedules).values({
            eventId: event.id,
            eventStartDate: sub.startDate,
            eventEndDate: sub.endDate ?? null,
            isMainSchedule: false,
          }).returning();
          createdScheduleIds.push(subSched.id);
        }
      }
      return event;
    }

    const eventA = await createTestEvent({
      eventName: 'Past Event A (Ended 10 Days Ago)',
      startDate: daysAgo(12),
      endDate: daysAgo(10),
    });

    const eventB = await createTestEvent({
      eventName: 'Recent Event B (Ended 3 Days Ago)',
      startDate: daysAgo(4),
      endDate: daysAgo(3),
      types: ['FESTIVAL'],
    });

    const eventC = await createTestEvent({
      eventName: 'Active Event C (Main ended, sub-schedule active)',
      startDate: daysAgo(12),
      endDate: daysAgo(10),
      subSchedules: [
        { startDate: daysAhead(1), endDate: daysAhead(2) }
      ]
    });

    t.after(async () => {
      if (createdScheduleIds.length > 0) {
        await db.delete(schedules).where(inArray(schedules.id, createdScheduleIds));
      }
      if (createdEventIds.length > 0) {
        await db.delete(events).where(inArray(events.id, createdEventIds));
      }
      await db.delete(userSettings).where(eq(userSettings.userId, testUser.id));
      await db.delete(users).where(eq(users.id, testUser.id));
    });

    await t.test('anonymous caller uses fixed default N=7 (AC1, AC3, AC4)', async () => {
      mockUser = null;
      const response = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query {
              events(query: null, limit: 1000) {
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

      assert.ok(!ids.has(eventA.id), 'Event A (ended 10 days ago) should be hidden');
      assert.ok(ids.has(eventB.id), 'Event B (ended 3 days ago) should be visible');
      assert.ok(ids.has(eventC.id), 'Event C with active sub-schedule should be visible');
    });

    await t.test('authenticated caller uses custom settings N (AC1, AC2, AC4)', async () => {
      mockUser = { userId: testUser.id, role: testUser.role };

      await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation {
              updateUserSettings(input: { hidePastEventsAfterDays: 1 }) {
                hidePastEventsAfterDays
              }
            }
          `
        })
      });

      const response = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query {
              events(query: null, limit: 1000) {
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

      assert.ok(!ids.has(eventA.id), 'Event A should be hidden');
      assert.ok(!ids.has(eventB.id), 'Event B (ended 3 days ago) should now be hidden under custom N=1 setting');
      assert.ok(ids.has(eventC.id), 'Event C should still be visible due to active sub-schedule');
    });

    await t.test('past-event filter combines correctly with existing caller query (AC5)', async () => {
      mockUser = null;
      const response = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query {
              events(query: { field: "types", operator: "contains", value: "FESTIVAL" }, limit: 1000) {
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

      assert.ok(ids.has(eventB.id), 'Event B should match (type is FESTIVAL and ended 3 days ago)');
      assert.ok(!ids.has(eventC.id), 'Event C should not match (type is not FESTIVAL)');
    });

    await t.test('Query.event lookup by ID bypasses visibility filter (AC8)', async () => {
      mockUser = null;
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
          variables: { id: eventA.id }
        })
      });
      const result = await response.json();
      assert.ok(!result.errors, 'GraphQL errors returned');
      assert.strictEqual(result.data.event.id, eventA.id, 'Query.event should retrieve past event A directly');
    });
  });

  await t.test('events - excludes self-reported events from list views (Story 4.3c)', async (t) => {
    const createdEventIds: string[] = [];
    const createdUserIds: string[] = [];
    const createdReportIds: string[] = [];

    // Create 2 test users (to test per-caller correlation)
    const [user1] = await db.insert(users).values({
      email: `reporter-1-${Date.now()}@test.com`,
      role: 'user',
    }).returning();
    createdUserIds.push(user1.id);

    const [user2] = await db.insert(users).values({
      email: `reporter-2-${Date.now()}@test.com`,
      role: 'user',
    }).returning();
    createdUserIds.push(user2.id);

    // Create 3 active events
    const [event1] = await db.insert(events).values({
      eventName: 'Reported Event 1 (Personal Pending)',
      location: 'Location 1',
      types: ['MUSIC'],
    }).returning();
    createdEventIds.push(event1.id);

    const [event2] = await db.insert(events).values({
      eventName: 'Reported Event 2 (Cancelled Upheld)',
      location: 'Location 2',
      types: ['MUSIC'],
    }).returning();
    createdEventIds.push(event2.id);

    const [event3] = await db.insert(events).values({
      eventName: 'Reported Event 3 (Dangerous Dismissed)',
      location: 'Location 3',
      types: ['MUSIC'],
    }).returning();
    createdEventIds.push(event3.id);

    // Main schedules for each event (to satisfy active/upcoming defaults)
    await db.insert(schedules).values([
      { eventId: event1.id, eventStartDate: '2030-08-15', isMainSchedule: true },
      { eventId: event2.id, eventStartDate: '2030-08-16', isMainSchedule: true },
      { eventId: event3.id, eventStartDate: '2030-08-17', isMainSchedule: true },
    ]);

    // User 1 reports event 1 for 'personal' (pending status)
    const [report1] = await db.insert(reports).values({
      eventId: event1.id,
      reporterUserId: user1.id,
      reason: 'personal',
      status: 'pending',
    }).returning();
    createdReportIds.push(report1.id);

    // User 1 reports event 2 for 'cancelled' (upheld status)
    const [report2] = await db.insert(reports).values({
      eventId: event2.id,
      reporterUserId: user1.id,
      reason: 'cancelled',
      status: 'upheld',
    }).returning();
    createdReportIds.push(report2.id);

    // User 1 reports event 3 for 'dangerous' (dismissed status)
    const [report3] = await db.insert(reports).values({
      eventId: event3.id,
      reporterUserId: user1.id,
      reason: 'dangerous',
      status: 'dismissed',
    }).returning();
    createdReportIds.push(report3.id);

    t.after(async () => {
      // Clean up in reverse order
      if (createdReportIds.length > 0) {
        await db.delete(reports).where(inArray(reports.id, createdReportIds));
      }
      if (createdEventIds.length > 0) {
        await db.delete(events).where(inArray(events.id, createdEventIds));
      }
      if (createdUserIds.length > 0) {
        await db.delete(users).where(inArray(users.id, createdUserIds));
      }
    });

    await t.test('1. excludes reported events for reporter (any reason, any status) in plural list query', async () => {
      mockUser = { userId: user1.id, role: user1.role };
      const response = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query {
              events(limit: 1000) {
                items { id eventName }
                totalCount
              }
            }
          `
        })
      });
      const result = await response.json();
      assert.ok(!result.errors, 'GraphQL errors returned');
      const items = result.data.events.items;
      const ids = new Set(items.map((i: any) => i.id));

      // User 1 reported all three events, so they must be completely excluded
      assert.ok(!ids.has(event1.id), 'Event 1 should be excluded');
      assert.ok(!ids.has(event2.id), 'Event 2 should be excluded');
      assert.ok(!ids.has(event3.id), 'Event 3 should be excluded');

      // Check totalCount is correct as well
      const countRes = await db.select({ count: count() }).from(events).where(sql`${events.deletedAt} IS NULL`);
      const totalActiveEventsInDb = countRes[0]?.count ?? 0;
      // totalCount should be total active minus the three excluded reported events
      assert.strictEqual(result.data.events.totalCount, totalActiveEventsInDb - 3);
    });

    await t.test('2. reported events remain visible to a different authenticated user', async () => {
      mockUser = { userId: user2.id, role: user2.role };
      const response = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query {
              events(limit: 1000) {
                items { id }
              }
            }
          `
        })
      });
      const result = await response.json();
      const items = result.data.events.items;
      const ids = new Set(items.map((i: any) => i.id));

      // User 2 did NOT report any events, so they must be visible
      assert.ok(ids.has(event1.id), 'Event 1 should be visible to User 2');
      assert.ok(ids.has(event2.id), 'Event 2 should be visible to User 2');
      assert.ok(ids.has(event3.id), 'Event 3 should be visible to User 2');
    });

    await t.test('3. reported events remain visible to an anonymous (unauthenticated) caller', async () => {
      mockUser = null;
      const response = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query {
              events(limit: 1000) {
                items { id }
              }
            }
          `
        })
      });
      const result = await response.json();
      const items = result.data.events.items;
      const ids = new Set(items.map((i: any) => i.id));

      assert.ok(ids.has(event1.id), 'Event 1 should be visible to anonymous caller');
      assert.ok(ids.has(event2.id), 'Event 2 should be visible to anonymous caller');
      assert.ok(ids.has(event3.id), 'Event 3 should be visible to anonymous caller');
    });

    await t.test('4. singular event lookup (id and slug) bypasses list-view hide rule', async () => {
      mockUser = { userId: user1.id, role: user1.role };
      
      // Query.event(id)
      const responseById = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query GetEvent($id: ID!) {
              event(id: $id) {
                id
                eventName
                isHiddenForCurrentUser
              }
            }
          `,
          variables: { id: event1.id }
        })
      });
      const resultById = await responseById.json();
      assert.strictEqual(resultById.data.event.id, event1.id, 'Query.event should retrieve reported event directly');
      assert.strictEqual(resultById.data.event.isHiddenForCurrentUser, true, 'isHiddenForCurrentUser should be true');

      // Query.eventBySlug(slug)
      const [fullEvent1] = await db.select().from(events).where(eq(events.id, event1.id));
      const responseBySlug = await yoga.fetch('http://yoga/graphql', {
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
          variables: { slug: fullEvent1.slug }
        })
      });
      const resultBySlug = await responseBySlug.json();
      assert.strictEqual(resultBySlug.data.eventBySlug.id, event1.id, 'Query.eventBySlug should retrieve reported event directly');
    });

    await t.test('5. rule composes correctly with type condition and past-event default-visibility', async () => {
      mockUser = { userId: user1.id, role: user1.role };
      // Query: events of type 'MUSIC'.
      // If we queries as user1, event1, event2, event3 are still excluded.
      // If we queries as user2, they are matched since they are of type MUSIC.
      const response = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query {
              events(query: { field: "types", operator: "contains", value: "MUSIC" }, limit: 1000) {
                items { id }
              }
            }
          `
        })
      });
      const result = await response.json();
      const items = result.data.events.items;
      const ids = new Set(items.map((i: any) => i.id));

      assert.ok(!ids.has(event1.id), 'Event 1 should be excluded by report rule even when matching type query');
      assert.ok(!ids.has(event2.id), 'Event 2 should be excluded by report rule even when matching type query');
    });

    await t.test('6. isFavorited-sort path still excludes reported and favorited event', async () => {
      // Favorite event1 for user 1
      await db.insert(favorites).values({
        userId: user1.id,
        eventId: event1.id,
      });

      mockUser = { userId: user1.id, role: user1.role };
      // Query with field: "isFavorited", operator: "eq", value: true (uses sortByFavoritedAt)
      const response = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query {
              events(query: { field: "isFavorited", operator: "eq", value: true }, limit: 1000) {
                items { id }
              }
            }
          `
        })
      });
      const result = await response.json();
      const items = result.data.events.items;
      const ids = new Set(items.map((i: any) => i.id));

      assert.ok(!ids.has(event1.id), 'Reported and favorited event 1 should be excluded even when querying favorites');
    });
  });

  await t.test('Event.sourceSocialMediaAccountProfile resolver', async (t) => {
    let testProfile: any;
    let testPost: any;
    let testEvent: any;

    t.before(async () => {
      // Create a test profile
      const [p] = await db.insert(socialMediaAccountProfiles).values({
        accountId: 'resolver_test_profile_1',
        platform: 'instagram',
        displayName: 'Resolver Test Profile',
        username: 'resolver_test_profile_1',
      }).returning();
      testProfile = p;

      // Create a test post
      const [post] = await db.insert(posts).values({
        accountId: testProfile.id,
        platformPostId: 'resolver_test_post_1',
        postUrl: 'https://instagram.com/p/resolver_test_post_1',
        originalPostUrl: 'https://instagram.com/p/resolver_test_post_1',
        content: 'This is a test post',
        publishedAt: new Date(),
        isExtracted: true,
      }).returning();
      testPost = post;

      // Create a test event linked to post
      const [ev] = await db.insert(events).values({
        eventName: 'Resolver Test Event',
        postId: testPost.id,
        location: 'Test location',
      }).returning();
      testEvent = ev;
    });

    t.after(async () => {
      if (testEvent) await db.delete(events).where(eq(events.id, testEvent.id));
      if (testPost) await db.delete(posts).where(eq(posts.id, testPost.id));
      if (testProfile) await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, testProfile.id));
    });

    await t.test('resolves profile successfully via parent postId -> posts -> socialMediaAccountProfiles', async () => {
      const response = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query GetEventWithProfile($id: ID!) {
              event(id: $id) {
                id
                eventName
                sourceSocialMediaAccountProfile {
                  id
                  accountId
                  platform
                  displayName
                }
              }
            }
          `,
          variables: { id: testEvent.id }
        })
      });

      const result = await response.json();
      assert.ok(!result.errors, JSON.stringify(result.errors));
      assert.strictEqual(result.data.event.sourceSocialMediaAccountProfile.id, testProfile.id);
      assert.strictEqual(result.data.event.sourceSocialMediaAccountProfile.displayName, testProfile.displayName);
    });

    await t.test('returns null if event has no linked postId', async () => {
      const [noPostEvent] = await db.insert(events).values({
        eventName: 'No Post Event',
        location: 'Test location',
      }).returning();

      try {
        const response = await yoga.fetch('http://yoga/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `
              query GetEventWithProfile($id: ID!) {
                event(id: $id) {
                  id
                  sourceSocialMediaAccountProfile {
                    id
                  }
                }
              }
            `,
            variables: { id: noPostEvent.id }
          })
        });

        const result = await response.json();
        assert.ok(!result.errors, JSON.stringify(result.errors));
        assert.strictEqual(result.data.event.sourceSocialMediaAccountProfile, null);
      } finally {
        await db.delete(events).where(eq(events.id, noPostEvent.id));
      }
    });
  });

  await t.test('events - includeMyArchived opt-in bypass (Story 4.8)', async () => {
    const userId = '88888888-8888-8888-8888-888888888888';
    const otherUserId = '99999999-9999-9999-9999-999999999999';

    // Seed users
    await db.delete(users).where(inArray(users.id, [userId, otherUserId]));
    await db.insert(users).values([
      { id: userId, email: 'user@test.com', role: 'user' },
      { id: otherUserId, email: 'other@test.com', role: 'user' }
    ]);

    // Seed a soft-deleted event that userId favorited
    const softDeletedEventId = 'ea111111-1111-1111-1111-ea1111111111';
    const activeEventId = 'ea222222-2222-2222-2222-ea2222222222';
    const pastEventId = 'ea333333-3333-3333-3333-ea3333333333';

    await db.delete(events).where(inArray(events.id, [softDeletedEventId, activeEventId, pastEventId]));
    await db.insert(events).values([
      { id: softDeletedEventId, eventName: 'Archived Soft-deleted Event', slug: 'archived-soft-deleted-event', deletedAt: new Date(), location: 'Test Location' },
      { id: activeEventId, eventName: 'Normal Active Event', slug: 'normal-active-event', location: 'Test Location' },
      { id: pastEventId, eventName: 'Expired Past Event', slug: 'expired-past-event', location: 'Test Location' }
    ]);

    // Seed schedules (expired schedule for pastEventId, main schedules for others)
    await db.delete(schedules).where(inArray(schedules.eventId, [softDeletedEventId, activeEventId, pastEventId]));
    await db.insert(schedules).values([
      { id: '11111111-1111-1111-1111-111111111111', eventId: softDeletedEventId, isMainSchedule: true, eventStartDate: '2026-08-30' },
      { id: '22222222-2222-2222-2222-222222222222', eventId: activeEventId, isMainSchedule: true, eventStartDate: '2026-08-30' },
      { id: '33333333-3333-3333-3333-333333333333', eventId: pastEventId, isMainSchedule: true, eventStartDate: '1970-01-01' } // definitely past
    ]);

    // Seed favorites (userId favorites softDeletedEventId and pastEventId)
    await db.delete(favorites).where(inArray(favorites.eventId, [softDeletedEventId, pastEventId]));
    await db.insert(favorites).values([
      { id: '44444444-4444-4444-4444-444444444444', userId, eventId: softDeletedEventId },
      { id: '55555555-5555-5555-5555-555555555555', userId, eventId: pastEventId }
    ]);

    try {
      // Test 1: Unauthenticated request throws UNAUTHORIZED / UNAUTHENTICATED
      mockUser = null;
      const res1 = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query {
              events(includeMyArchived: true) {
                items { id }
              }
            }
          `
        })
      });
      const result1 = await res1.json();
      assert.ok(result1.errors);
      assert.strictEqual(result1.errors[0].extensions?.code, 'UNAUTHENTICATED');

      // Test 2: Authenticated request returns archived/hidden events where there is a personal connection
      mockUser = { userId, role: 'user' };
      const res2 = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query {
              events(includeMyArchived: true) {
                items {
                  id
                  eventName
                  deletedAt
                  isExpiredForCurrentUser
                }
              }
            }
          `
        })
      });
      const result2 = await res2.json();
      assert.ok(!result2.errors, JSON.stringify(result2.errors));
      const items2 = result2.data.events.items;
      // Should contain softDeletedEventId and pastEventId, but NOT activeEventId (no hidden rule applies to activeEventId)
      const itemIds = items2.map((item: any) => item.id);
      assert.ok(itemIds.includes(softDeletedEventId));
      assert.ok(itemIds.includes(pastEventId));
      assert.ok(!itemIds.includes(activeEventId));

      const pastItem = items2.find((i: any) => i.id === pastEventId);
      assert.strictEqual(pastItem.isExpiredForCurrentUser, true);

      // Test 3: Other user gets nothing or only their own (otherUserId hasn't favorited pastEventId, and soft-deleted is only visible to owners/connections)
      mockUser = { userId: otherUserId, role: 'user' };
      const res3 = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query {
              events(includeMyArchived: true) {
                items { id }
              }
            }
          `
        })
      });
      const result3 = await res3.json();
      assert.ok(!result3.errors);
      const itemIds3 = result3.data.events.items.map((item: any) => item.id);
      assert.ok(!itemIds3.includes(pastEventId));

      // Test 4: Singular Query.event and Query.eventBySlug owner-scoped bypass on soft-deleted
      // Case A: Owner (with personal connection) gets the soft-deleted event details when includeMyArchived: true
      mockUser = { userId, role: 'user' };
      const res4 = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query {
              event(id: "${softDeletedEventId}", includeMyArchived: true) {
                id
                eventName
              }
            }
          `
        })
      });
      const result4 = await res4.json();
      assert.ok(!result4.errors);
      assert.strictEqual(result4.data.event?.id, softDeletedEventId);

      // Case B: Non-owner gets null/not found for includeMyArchived: true on soft-deleted
      mockUser = { userId: otherUserId, role: 'user' };
      const res5 = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query {
              event(id: "${softDeletedEventId}", includeMyArchived: true) {
                id
              }
            }
          `
        })
      });
      const result5 = await res5.json();
      assert.ok(!result5.errors);
      assert.strictEqual(result5.data.event, null);

    } finally {
      // Clean up
      await db.delete(favorites).where(inArray(favorites.eventId, [softDeletedEventId, pastEventId]));
      await db.delete(schedules).where(inArray(schedules.eventId, [softDeletedEventId, activeEventId, pastEventId]));
      await db.delete(events).where(inArray(events.id, [softDeletedEventId, activeEventId, pastEventId]));
      await db.delete(users).where(inArray(users.id, [userId, otherUserId]));
    }
  });
});

test('Story 4.4a - Soft Delete and Moderator Mutations integration', async (t) => {
  // Let's seed an active event and a soft-deleted event
  const [activeEvent] = await db.insert(events).values({
    eventName: '4.4a Active Event',
    location: 'Active City',
  }).returning();

  const [deletedEvent] = await db.insert(events).values({
    eventName: '4.4a Soft Deleted Event',
    location: 'Deleted City',
    deletedAt: new Date(),
  }).returning();

  // Create a schedule for each so that they are sortable / queryable without crashes
  await db.insert(schedules).values([
    { eventId: activeEvent.id, eventStartDate: '2026-08-15', isMainSchedule: true },
    { eventId: deletedEvent.id, eventStartDate: '2026-08-15', isMainSchedule: true },
  ]);

  t.after(async () => {
    // Cleanup
    await db.delete(schedules).where(inArray(schedules.eventId, [activeEvent.id, deletedEvent.id]));
    await db.delete(events).where(inArray(events.id, [activeEvent.id, deletedEvent.id]));
  });

  await t.test('events - default query excludes soft-deleted events', async () => {
    mockUser = null;
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            events(limit: 100) {
              items { id eventName }
            }
          }
        `
      })
    });
    const result = await response.json();
    assert.ok(!result.errors, 'Should have no errors');
    const items = result.data.events.items;
    const foundDeleted = items.some((item: any) => item.id === deletedEvent.id);
    const foundActive = items.some((item: any) => item.id === activeEvent.id);
    assert.strictEqual(foundDeleted, false, 'Soft-deleted event should be excluded');
    assert.strictEqual(foundActive, true, 'Active event should be included');
  });

  await t.test('events - includeSoftDeleted: true auth/role gating', async () => {
    // Unauthenticated
    mockUser = null;
    let response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            events(includeSoftDeleted: true) {
              items { id }
            }
          }
        `
      })
    });
    let result = await response.json();
    assert.ok(result.errors, 'Should fail without auth');
    assert.strictEqual(result.errors[0].extensions?.code, 'UNAUTHENTICATED');

    // Authenticated regular user
    mockUser = { userId: '00000000-0000-0000-0000-000000000001', role: 'user' };
    response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            events(includeSoftDeleted: true) {
              items { id }
            }
          }
        `
      })
    });
    result = await response.json();
    assert.ok(result.errors, 'Should fail for non-moderator');
    assert.strictEqual(result.errors[0].extensions?.code, 'FORBIDDEN');

    // Authenticated moderator
    mockUser = { userId: '00000000-0000-0000-0000-000000000002', role: 'moderator' };
    response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            events(includeSoftDeleted: true) {
              items { id }
            }
          }
        `
      })
    });
    result = await response.json();
    assert.ok(!result.errors, 'Should succeed for moderator');
    const items = result.data.events.items;
    const foundDeleted = items.some((item: any) => item.id === deletedEvent.id);
    const foundActive = items.some((item: any) => item.id === activeEvent.id);
    assert.strictEqual(foundDeleted, true, 'Soft-deleted event should be included');
    assert.strictEqual(foundActive, true, 'Active event should be included');
  });

  await t.test('event(id) / eventBySlug(slug) returns null for soft-deleted event', async () => {
    mockUser = null;
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query GetEvent($id: ID!, $slug: String!) {
            event(id: $id) { id }
            eventBySlug(slug: $slug) { id }
          }
        `,
        variables: { id: deletedEvent.id, slug: deletedEvent.slug }
      })
    });
    const result = await response.json();
    assert.ok(!result.errors);
    assert.strictEqual(result.data.event, null);
    assert.strictEqual(result.data.eventBySlug, null);
  });

  await t.test('restoreEvent mutation - full transition state machine', async () => {
    // Unauthenticated
    mockUser = null;
    let response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            restoreEvent(id: "${deletedEvent.id}", action: RESTORE) { id }
          }
        `
      })
    });
    let result = await response.json();
    assert.strictEqual(result.errors?.[0].extensions?.code, 'UNAUTHENTICATED');

    // regular user
    mockUser = { userId: '00000000-0000-0000-0000-000000000003', role: 'user' };
    response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            restoreEvent(id: "${deletedEvent.id}", action: RESTORE) { id }
          }
        `
      })
    });
    result = await response.json();
    assert.strictEqual(result.errors?.[0].extensions?.code, 'FORBIDDEN');

    // Moderator - NOT_FOUND
    mockUser = { userId: '00000000-0000-0000-0000-000000000004', role: 'moderator' };
    response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            restoreEvent(id: "00000000-0000-0000-0000-000000000000", action: RESTORE) { id }
          }
        `
      })
    });
    result = await response.json();
    assert.strictEqual(result.errors?.[0].extensions?.code, 'NOT_FOUND');

    // Moderator - INVALID_STATE_TRANSITION (RESTORE on already active event)
    response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            restoreEvent(id: "${activeEvent.id}", action: RESTORE) { id }
          }
        `
      })
    });
    result = await response.json();
    assert.strictEqual(result.errors?.[0].extensions?.code, 'INVALID_STATE_TRANSITION');

    // Moderator - RESTORE on soft-deleted event
    response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            restoreEvent(id: "${deletedEvent.id}", action: RESTORE) { id eventName }
          }
        `
      })
    });
    result = await response.json();
    assert.ok(!result.errors, JSON.stringify(result.errors));
    assert.strictEqual(result.data.restoreEvent.eventName, '4.4a Soft Deleted Event');

    // Verify it is active now
    const [restoredRows] = await db.select().from(events).where(eq(events.id, deletedEvent.id));
    assert.strictEqual(restoredRows.deletedAt, null);

    // Moderator - DELETE (soft delete) on now-active event
    response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            restoreEvent(id: "${deletedEvent.id}", action: DELETE) { id }
          }
        `
      })
    });
    result = await response.json();
    assert.ok(!result.errors);

    const [softDeletedRows] = await db.select().from(events).where(eq(events.id, deletedEvent.id));
    assert.ok(softDeletedRows.deletedAt !== null);

    // Moderator - INVALID_STATE_TRANSITION (DELETE on already soft-deleted event)
    response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            restoreEvent(id: "${deletedEvent.id}", action: DELETE) { id }
          }
        `
      })
    });
    result = await response.json();
    assert.strictEqual(result.errors?.[0].extensions?.code, 'INVALID_STATE_TRANSITION');
  });

  await t.test('deleteEventPermanently mutation and cascade proof', async () => {
    // Create a temp user to satisfy FK
    const [tempUser] = await db.insert(users).values({
      email: `temp-cascade-reporter-${Date.now()}@test.com`,
      role: 'user',
    }).returning();

    // Create an event, a schedule, and a report on it
    const [tempEvent] = await db.insert(events).values({
      eventName: '4.4a Temp Cascade Event',
      location: 'Cascade City',
    }).returning();

    const [tempSchedule] = await db.insert(schedules).values({
      eventId: tempEvent.id,
      eventStartDate: '2026-08-15',
    }).returning();

    const [tempReport] = await db.insert(reports).values({
      eventId: tempEvent.id,
      reporterUserId: tempUser.id,
      reason: 'cancelled',
      status: 'pending',
    }).returning();

    mockUser = { userId: '00000000-0000-0000-0000-000000000002', role: 'moderator' };

    // Execute hard delete
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            deleteEventPermanently(id: "${tempEvent.id}")
          }
        `
      })
    });
    const result = await response.json();
    assert.ok(!result.errors, JSON.stringify(result.errors));
    assert.strictEqual(result.data.deleteEventPermanently, true);

    // Verify event is completely gone
    const eventRows = await db.select().from(events).where(eq(events.id, tempEvent.id));
    assert.strictEqual(eventRows.length, 0);

    // Verify schedule cascades
    const scheduleRows = await db.select().from(schedules).where(eq(schedules.id, tempSchedule.id));
    assert.strictEqual(scheduleRows.length, 0);

    // Verify report cascades
    const reportRows = await db.select().from(reports).where(eq(reports.id, tempReport.id));
    assert.strictEqual(reportRows.length, 0);

    // Clean up temp user
    await db.delete(users).where(eq(users.id, tempUser.id));
  });
});

