import test from 'node:test';
import * as assert from 'node:assert';
import { createSchema, createYoga } from 'graphql-yoga';
import { resolvers } from './resolvers.js';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/client.js';
import { users, events, schedules, corrections } from '@festgrid/database';
import { and, eq } from 'drizzle-orm';

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

test('submitCorrection resolver integration', async (t) => {
  let testUser: any;
  let testEventId: string;
  let testScheduleId: string;

  t.after(async () => {
    // The setup sub-test below only self-heals (deletes any corrections left over from a
    // PRIOR run of this file) before this run's own sub-tests create new ones -- that caps
    // accumulation across repeated runs but, within a single run, never cleans up what THIS
    // run itself inserted. Do that real cleanup here too, by the same testUser.id filter.
    if (testUser) {
      await db.delete(corrections).where(eq(corrections.submittedByUserId, testUser.id));
    }
  });

  await t.test('setup - get test user and event', async () => {
    const seededUsers = await db.select().from(users).limit(1);
    if (seededUsers.length > 0) {
      testUser = seededUsers[0];
    }

    const seededEvents = await db.select({ id: events.id }).from(events).limit(1);
    if (seededEvents.length > 0) {
      testEventId = seededEvents[0].id;
      // Picking the *main* schedule specifically (not just any schedule for the event) matters
      // for events with more than one schedule: the tests below set `isMainSchedule: true` on
      // whichever schedule id they're given, and doing that to an already-non-main schedule
      // would collide with the event's existing main schedule on `idx_schedules_one_main_per_event`.
      const seededSchedules = await db.select({ id: schedules.id }).from(schedules).where(and(eq(schedules.eventId, testEventId), eq(schedules.isMainSchedule, true))).limit(1);
      if (seededSchedules.length > 0) {
        testScheduleId = seededSchedules[0].id;
      }
    }

    if (testUser) {
      await db.delete(corrections).where(eq(corrections.submittedByUserId, testUser.id));
    }
  });

  await t.test('submitCorrection - unauthenticated rejected', async () => {
    mockUser = null;
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation SubmitCorrection($eventId: ID!, $proposedData: ProposedEventCorrectionInput!, $source: CorrectionSource!) {
            submitCorrection(eventId: $eventId, proposedData: $proposedData, source: $source) {
              id
              status
            }
          }
        `,
        variables: {
          eventId: testEventId || '00000000-0000-0000-0000-000000000000',
          proposedData: {
            eventName: 'Unauthenticated Test',
            types: ['FESTIVAL'],
            categories: ['MUSIC'],
            location: 'Chicago, IL',
            schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-11' }]
          },
          source: 'manual'
        }
      })
    });

    const result = await response.json();
    assert.ok(result.errors, 'should return errors');
    assert.strictEqual(result.errors[0].extensions?.code, 'UNAUTHENTICATED');
  });

  await t.test('submitCorrection - unknown eventId rejected with NOT_FOUND', async () => {
    if (!testUser) return;
    mockUser = { userId: testUser.id, role: testUser.role };

    const unknownUuid = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation SubmitCorrection($eventId: ID!, $proposedData: ProposedEventCorrectionInput!, $source: CorrectionSource!) {
            submitCorrection(eventId: $eventId, proposedData: $proposedData, source: $source) {
              id
              status
            }
          }
        `,
        variables: {
          eventId: unknownUuid,
          proposedData: {
            eventName: 'Unknown Event Test',
            types: ['FESTIVAL'],
            categories: ['MUSIC'],
            location: 'Chicago, IL',
            schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-11' }]
          },
          source: 'manual'
        }
      })
    });

    const result = await response.json();
    assert.ok(result.errors, 'should return errors');
    assert.strictEqual(result.errors[0].extensions?.code, 'NOT_FOUND');

    // Verify no correction row was created
    const rows = await db.select().from(corrections).where(eq(corrections.eventId, unknownUuid));
    assert.strictEqual(rows.length, 0);
  });

  await t.test('submitCorrection - AJV validation error (empty eventName)', async () => {
    if (!testUser || !testEventId) return;
    mockUser = { userId: testUser.id, role: testUser.role };

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation SubmitCorrection($eventId: ID!, $proposedData: ProposedEventCorrectionInput!, $source: CorrectionSource!) {
            submitCorrection(eventId: $eventId, proposedData: $proposedData, source: $source) {
              id
              status
              validationErrors {
                field
                message
              }
            }
          }
        `,
        variables: {
          eventId: testEventId,
          proposedData: {
            eventName: '', // empty name -> minLength: 1 error
            types: ['FESTIVAL'],
            categories: ['MUSIC'],
            location: 'Chicago, IL',
            schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-11' }]
          },
          source: 'manual'
        }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, JSON.stringify(result.errors));
    assert.strictEqual(result.data.submitCorrection.status, 'rejected');
    const errors = result.data.submitCorrection.validationErrors;
    assert.ok(errors.some((e: any) => e.field === 'eventName'));
  });

  await t.test('submitCorrection - consistency check error (end date before start date)', async () => {
    if (!testUser || !testEventId) return;
    mockUser = { userId: testUser.id, role: testUser.role };

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation SubmitCorrection($eventId: ID!, $proposedData: ProposedEventCorrectionInput!, $source: CorrectionSource!) {
            submitCorrection(eventId: $eventId, proposedData: $proposedData, source: $source) {
              id
              status
              validationErrors {
                field
                message
              }
            }
          }
        `,
        variables: {
          eventId: testEventId,
          proposedData: {
            eventName: 'Consistent Test',
            types: ['FESTIVAL'],
            categories: ['MUSIC'],
            location: 'Chicago, IL',
            schedules: [{ isMainSchedule: true, eventStartDate: '2026-08-11', eventEndDate: '2026-08-10' }]
          },
          source: 'manual'
        }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, JSON.stringify(result.errors));
    assert.strictEqual(result.data.submitCorrection.status, 'rejected');
    const errors = result.data.submitCorrection.validationErrors;
    assert.ok(errors.some((e: any) => e.field === 'schedules[0].eventEndDate'));
  });

  await t.test('submitCorrection - ownership error (schedule id does not belong to event)', async () => {
    if (!testUser || !testEventId) return;
    mockUser = { userId: testUser.id, role: testUser.role };

    const wrongScheduleId = '00000000-0000-0000-0000-000000000000';
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation SubmitCorrection($eventId: ID!, $proposedData: ProposedEventCorrectionInput!, $source: CorrectionSource!) {
            submitCorrection(eventId: $eventId, proposedData: $proposedData, source: $source) {
              id
              status
              validationErrors {
                field
                message
              }
            }
          }
        `,
        variables: {
          eventId: testEventId,
          proposedData: {
            eventName: 'Ownership Test',
            types: ['FESTIVAL'],
            categories: ['MUSIC'],
            location: 'Chicago, IL',
            schedules: [{ id: wrongScheduleId, isMainSchedule: true, eventStartDate: '2026-08-11' }]
          },
          source: 'manual'
        }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, JSON.stringify(result.errors));
    assert.strictEqual(result.data.submitCorrection.status, 'rejected');
    const errors = result.data.submitCorrection.validationErrors;
    assert.ok(errors.some((e: any) => e.field === 'schedules[0].id'));
  });

  await t.test('submitCorrection - happy path applied and verified in DB', async () => {
    if (!testUser || !testEventId || !testScheduleId) return;
    mockUser = { userId: testUser.id, role: testUser.role };

    const newEventName = 'Completely Corrected Event Name';
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation SubmitCorrection($eventId: ID!, $proposedData: ProposedEventCorrectionInput!, $source: CorrectionSource!) {
            submitCorrection(eventId: $eventId, proposedData: $proposedData, source: $source) {
              id
              status
              validationErrors {
                field
                message
              }
            }
          }
        `,
        variables: {
          eventId: testEventId,
          proposedData: {
            eventName: newEventName,
            types: ['FESTIVAL'],
            categories: ['MUSIC'],
            location: 'Chicago, IL',
            schedules: [
              {
                id: testScheduleId,
                isMainSchedule: true,
                eventStartDate: '2026-08-15',
                eventEndDate: '2026-08-15',
                eventStartTime: '12:00:00',
                eventEndTime: '14:00:00',
                location: 'United Center, Chicago, IL'
              }
            ]
          },
          source: 'manual'
        }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, JSON.stringify(result.errors));
    assert.strictEqual(result.data.submitCorrection.status, 'applied');
    assert.deepEqual(result.data.submitCorrection.validationErrors, []);

    // Verify updates in database
    const [eventRow] = await db.select().from(events).where(eq(events.id, testEventId));
    assert.strictEqual(eventRow.eventName, newEventName);

    const [scheduleRow] = await db.select().from(schedules).where(eq(schedules.id, testScheduleId));
    assert.strictEqual(scheduleRow.eventStartDate, '2026-08-15');
  });

  await t.test("submitCorrection - children's-data keyword match: awaiting_verification, performers suppressed, other fields applied normally (Story 3.6k, AC2)", async () => {
    if (!testUser || !testEventId || !testScheduleId) return;
    mockUser = { userId: testUser.id, role: testUser.role };

    const matchedEventName = 'Lomba Tari Anak Sanggar Melati';
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation SubmitCorrection($eventId: ID!, $proposedData: ProposedEventCorrectionInput!, $source: CorrectionSource!, $guardianPermissionConfirmed: Boolean) {
            submitCorrection(eventId: $eventId, proposedData: $proposedData, source: $source, guardianPermissionConfirmed: $guardianPermissionConfirmed) {
              id
              status
              guardianPermissionConfirmed
              validationErrors {
                field
                message
              }
            }
          }
        `,
        variables: {
          eventId: testEventId,
          proposedData: {
            eventName: matchedEventName,
            types: ['FESTIVAL'],
            categories: ['MUSIC'],
            location: 'Chicago, IL',
            schedules: [
              {
                id: testScheduleId,
                isMainSchedule: true,
                eventStartDate: '2026-08-16',
                eventEndDate: '2026-08-16',
                location: 'United Center, Chicago, IL',
                performers: ['Aisyah', 'Budi']
              }
            ]
          },
          source: 'manual',
          guardianPermissionConfirmed: true
        }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, JSON.stringify(result.errors));
    assert.strictEqual(result.data.submitCorrection.status, 'awaiting_verification');
    assert.strictEqual(result.data.submitCorrection.guardianPermissionConfirmed, true);
    assert.deepEqual(result.data.submitCorrection.validationErrors, []);

    // Non-performer data still applied immediately.
    const [eventRow] = await db.select().from(events).where(eq(events.id, testEventId));
    assert.strictEqual(eventRow.eventName, matchedEventName);

    // performers written as null, not what was submitted.
    const [scheduleRow] = await db.select().from(schedules).where(eq(schedules.id, testScheduleId));
    assert.strictEqual(scheduleRow.eventStartDate, '2026-08-16');
    assert.strictEqual(scheduleRow.location, 'United Center, Chicago, IL');
    assert.strictEqual(scheduleRow.performers, null);
  });

  await t.test('submitCorrection - non-matching keyword regression: status applied, performers written as submitted', async () => {
    if (!testUser || !testEventId || !testScheduleId) return;
    mockUser = { userId: testUser.id, role: testUser.role };

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation SubmitCorrection($eventId: ID!, $proposedData: ProposedEventCorrectionInput!, $source: CorrectionSource!) {
            submitCorrection(eventId: $eventId, proposedData: $proposedData, source: $source) {
              id
              status
              guardianPermissionConfirmed
              validationErrors {
                field
                message
              }
            }
          }
        `,
        variables: {
          eventId: testEventId,
          proposedData: {
            eventName: 'Live Jazz Night',
            types: ['FESTIVAL'],
            categories: ['MUSIC'],
            location: 'Chicago, IL',
            schedules: [
              {
                id: testScheduleId,
                isMainSchedule: true,
                eventStartDate: '2026-08-17',
                eventEndDate: '2026-08-17',
                location: 'United Center, Chicago, IL',
                performers: ['DJ Nova']
              }
            ]
          },
          source: 'manual'
        }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, JSON.stringify(result.errors));
    assert.strictEqual(result.data.submitCorrection.status, 'applied');
    assert.strictEqual(result.data.submitCorrection.guardianPermissionConfirmed, false);

    const [scheduleRow] = await db.select().from(schedules).where(eq(schedules.id, testScheduleId));
    assert.deepEqual(scheduleRow.performers, ['DJ Nova']);
  });

  // Story 4.10 (AC2, AC3, AC5) -- links persistence/validation/clear cases

  await t.test('submitCorrection - links - rejects an invalid-protocol link URL with a links[0].url error, no DB write', async () => {
    if (!testUser || !testEventId || !testScheduleId) return;
    mockUser = { userId: testUser.id, role: testUser.role };

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation SubmitCorrection($eventId: ID!, $proposedData: ProposedEventCorrectionInput!, $source: CorrectionSource!) {
            submitCorrection(eventId: $eventId, proposedData: $proposedData, source: $source) {
              id
              status
              validationErrors {
                field
                message
              }
            }
          }
        `,
        variables: {
          eventId: testEventId,
          proposedData: {
            eventName: 'Links Invalid URL Test',
            types: ['FESTIVAL'],
            categories: ['MUSIC'],
            location: 'Chicago, IL',
            schedules: [{ id: testScheduleId, isMainSchedule: true, eventStartDate: '2026-08-11' }],
            links: [{ url: 'javascript:alert(1)' }]
          },
          source: 'manual'
        }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, JSON.stringify(result.errors));
    assert.strictEqual(result.data.submitCorrection.status, 'rejected');
    const errors = result.data.submitCorrection.validationErrors;
    assert.ok(errors.some((e: any) => e.field === 'links[0].url'));

    const [eventRow] = await db.select().from(events).where(eq(events.id, testEventId));
    assert.notStrictEqual(eventRow.eventName, 'Links Invalid URL Test');
  });

  await t.test('submitCorrection - links - persists a valid links array, trimming label on sanitize', async () => {
    if (!testUser || !testEventId || !testScheduleId) return;
    mockUser = { userId: testUser.id, role: testUser.role };

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation SubmitCorrection($eventId: ID!, $proposedData: ProposedEventCorrectionInput!, $source: CorrectionSource!) {
            submitCorrection(eventId: $eventId, proposedData: $proposedData, source: $source) {
              id
              status
              validationErrors {
                field
                message
              }
            }
          }
        `,
        variables: {
          eventId: testEventId,
          proposedData: {
            eventName: 'Links Persist Test',
            types: ['FESTIVAL'],
            categories: ['MUSIC'],
            location: 'Chicago, IL',
            schedules: [{ id: testScheduleId, isMainSchedule: true, eventStartDate: '2026-08-11' }],
            links: [{ url: 'https://tickets.example.com', label: '  Tickets  ' }]
          },
          source: 'manual'
        }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, JSON.stringify(result.errors));
    assert.strictEqual(result.data.submitCorrection.status, 'applied');

    const [eventRow] = await db.select().from(events).where(eq(events.id, testEventId));
    assert.deepEqual(eventRow.links, [{ url: 'https://tickets.example.com', label: 'Tickets' }]);
  });

  await t.test('submitCorrection - links - omitted leaves a previously-set links column unchanged', async () => {
    if (!testUser || !testEventId || !testScheduleId) return;
    mockUser = { userId: testUser.id, role: testUser.role };

    // Sanity check: the previous test left `links` set on this event.
    const [beforeRow] = await db.select().from(events).where(eq(events.id, testEventId));
    assert.deepEqual(beforeRow.links, [{ url: 'https://tickets.example.com', label: 'Tickets' }]);

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation SubmitCorrection($eventId: ID!, $proposedData: ProposedEventCorrectionInput!, $source: CorrectionSource!) {
            submitCorrection(eventId: $eventId, proposedData: $proposedData, source: $source) {
              id
              status
            }
          }
        `,
        variables: {
          eventId: testEventId,
          proposedData: {
            eventName: 'Links Omitted Test',
            types: ['FESTIVAL'],
            categories: ['MUSIC'],
            location: 'Chicago, IL',
            schedules: [{ id: testScheduleId, isMainSchedule: true, eventStartDate: '2026-08-11' }]
            // links omitted entirely
          },
          source: 'manual'
        }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, JSON.stringify(result.errors));
    assert.strictEqual(result.data.submitCorrection.status, 'applied');

    const [afterRow] = await db.select().from(events).where(eq(events.id, testEventId));
    assert.deepEqual(afterRow.links, [{ url: 'https://tickets.example.com', label: 'Tickets' }]);
  });

  await t.test('submitCorrection - links - submitting links: [] clears the column back to null, and the applied correction protects it', async () => {
    if (!testUser || !testEventId || !testScheduleId) return;
    mockUser = { userId: testUser.id, role: testUser.role };

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation SubmitCorrection($eventId: ID!, $proposedData: ProposedEventCorrectionInput!, $source: CorrectionSource!) {
            submitCorrection(eventId: $eventId, proposedData: $proposedData, source: $source) {
              id
              status
            }
          }
        `,
        variables: {
          eventId: testEventId,
          proposedData: {
            eventName: 'Links Clear Test',
            types: ['FESTIVAL'],
            categories: ['MUSIC'],
            location: 'Chicago, IL',
            schedules: [{ id: testScheduleId, isMainSchedule: true, eventStartDate: '2026-08-11' }],
            links: []
          },
          source: 'manual'
        }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, JSON.stringify(result.errors));
    assert.strictEqual(result.data.submitCorrection.status, 'applied');

    const [eventRow] = await db.select().from(events).where(eq(events.id, testEventId));
    assert.strictEqual(eventRow.links, null);

    // getProtectedFields (set-event-primary-post.ts) scans applied corrections' proposedData for
    // the presence of the 'links' key -- not its value -- to protect a column from enrichment.
    // Submitting `links: []` (an explicit clear) must leave that key present on the stored
    // proposedData so a later enrichment pass can never silently undo this user's clear.
    const appliedRows = await db
      .select({ proposedData: corrections.proposedData })
      .from(corrections)
      .where(and(eq(corrections.eventId, testEventId), eq(corrections.status, 'applied')));
    const latest = appliedRows[appliedRows.length - 1];
    assert.ok(latest, 'expected an applied correction row to exist');
    assert.ok('links' in (latest.proposedData as any), '"links" key must be present on the stored proposedData');
    assert.deepEqual((latest.proposedData as any).links, []);
  });
});
