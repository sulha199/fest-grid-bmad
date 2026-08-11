import test from 'node:test';
import * as assert from 'node:assert';
import { createSchema, createYoga } from 'graphql-yoga';
import { resolvers } from './resolvers.js';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/client.js';
import { users, events, schedules, corrections } from '@festgrid/database';
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

test('submitCorrection resolver integration', async (t) => {
  let testUser: any;
  let testEventId: string;
  let testScheduleId: string;

  await t.test('setup - get test user and event', async () => {
    const seededUsers = await db.select().from(users).limit(1);
    if (seededUsers.length > 0) {
      testUser = seededUsers[0];
    }

    const seededEvents = await db.select({ id: events.id }).from(events).limit(1);
    if (seededEvents.length > 0) {
      testEventId = seededEvents[0].id;
      const seededSchedules = await db.select({ id: schedules.id }).from(schedules).where(eq(schedules.eventId, testEventId)).limit(1);
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
    assert.ok(!result.errors);
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
    assert.ok(!result.errors);
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
    assert.ok(!result.errors);
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
    assert.ok(!result.errors);
    assert.strictEqual(result.data.submitCorrection.status, 'applied');
    assert.deepEqual(result.data.submitCorrection.validationErrors, []);

    // Verify updates in database
    const [eventRow] = await db.select().from(events).where(eq(events.id, testEventId));
    assert.strictEqual(eventRow.eventName, newEventName);

    const [scheduleRow] = await db.select().from(schedules).where(eq(schedules.id, testScheduleId));
    assert.strictEqual(scheduleRow.eventStartDate, '2026-08-15');
  });
});
