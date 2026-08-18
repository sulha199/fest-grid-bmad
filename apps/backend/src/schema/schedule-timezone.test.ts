import test from 'node:test';
import * as assert from 'node:assert';
import { createSchema, createYoga } from 'graphql-yoga';
import { resolvers } from './resolvers.js';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/client.js';
import { users, events, schedules } from '@festgrid/database';
import { eq } from 'drizzle-orm';

// read the generated schema for the yoga server
const schemaDir = path.resolve(process.cwd(), 'src/schema');
const files = fs.readdirSync(schemaDir).filter(f => f.endsWith('.graphql'));
const typeDefs = files.map(f => fs.readFileSync(path.join(schemaDir, f), 'utf8')).join('\n');

const schema = createSchema({
  typeDefs: `
    $${typeDefs}
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

test('resolveScheduleTimezone resolver integration', async (t) => {
  let testUser: any;
  let testScheduleId: string;
  let testEventId: string;

  await t.test('setup - get test user and schedule with NEEDS_CLARIFICATION', async () => {
    const seededUsers = await db.select().from(users).limit(1);
    if (seededUsers.length > 0) {
      testUser = seededUsers[0];
    }

    const seededSchedules = await db.select().from(schedules).limit(1);
    if (seededSchedules.length > 0) {
      testScheduleId = seededSchedules[0].id;
      testEventId = seededSchedules[0].eventId;
      
      // Update schedule to NEEDS_CLARIFICATION for testing
      await db.update(schedules)
        .set({ timezoneStatus: 'NEEDS_CLARIFICATION' as any, timezone: null })
        .where(eq(schedules.id, testScheduleId));
    }
  });

  await t.test('resolveScheduleTimezone - unauthenticated rejected', async () => {
    if (!testScheduleId) return;
    mockUser = null;

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ResolveScheduleTimezone($scheduleId: ID!, $timezone: String!) {
            resolveScheduleTimezone(scheduleId: $scheduleId, timezone: $timezone) {
              scheduleId
              timezone
              timezoneStatus
            }
          }
        `,
        variables: { scheduleId: testScheduleId, timezone: 'UTC' }
      })
    });

    const result = await response.json();
    assert.ok(result.errors, 'should return errors');
    assert.strictEqual(result.errors[0].extensions?.code, 'UNAUTHENTICATED');
  });

  await t.test('resolveScheduleTimezone - invalid IANA string rejected', async () => {
    if (!testUser || !testScheduleId) return;
    mockUser = { userId: testUser.id, role: testUser.role };

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ResolveScheduleTimezone($scheduleId: ID!, $timezone: String!) {
            resolveScheduleTimezone(scheduleId: $scheduleId, timezone: $timezone) {
              scheduleId
              timezone
              timezoneStatus
            }
          }
        `,
        variables: { scheduleId: testScheduleId, timezone: 'garbage' }
      })
    });

    const result = await response.json();
    assert.ok(result.errors, 'should return errors');
    assert.strictEqual(result.errors[0].extensions?.code, 'BAD_REQUEST');

    // Verify schedule was not updated
    const updated = await db.select().from(schedules).where(eq(schedules.id, testScheduleId));
    assert.strictEqual(updated[0].timezoneStatus, 'NEEDS_CLARIFICATION');
  });

  await t.test('resolveScheduleTimezone - non-existent schedule rejected', async () => {
    if (!testUser) return;
    mockUser = { userId: testUser.id, role: testUser.role };

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ResolveScheduleTimezone($scheduleId: ID!, $timezone: String!) {
            resolveScheduleTimezone(scheduleId: $scheduleId, timezone: $timezone) {
              scheduleId
              timezone
              timezoneStatus
            }
          }
        `,
        variables: { scheduleId: 'nonexistent-id', timezone: 'UTC' }
      })
    });

    const result = await response.json();
    assert.ok(result.errors, 'should return errors');
    assert.strictEqual(result.errors[0].extensions?.code, 'NOT_FOUND');
  });

  await t.test('resolveScheduleTimezone - schedule with RESOLVED status rejected', async () => {
    if (!testUser || !testScheduleId) return;
    mockUser = { userId: testUser.id, role: testUser.role };

    // First update schedule to RESOLVED
    await db.update(schedules)
      .set({ timezoneStatus: 'RESOLVED' as any, timezone: 'UTC' })
      .where(eq(schedules.id, testScheduleId));

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ResolveScheduleTimezone($scheduleId: ID!, $timezone: String!) {
            resolveScheduleTimezone(scheduleId: $scheduleId, timezone: $timezone) {
              scheduleId
              timezone
              timezoneStatus
            }
          }
        `,
        variables: { scheduleId: testScheduleId, timezone: 'Asia/Jakarta' }
      })
    });

    const result = await response.json();
    assert.ok(result.errors, 'should return errors');
    assert.strictEqual(result.errors[0].extensions?.code, 'INVALID_STATE_TRANSITION');

    // Verify timezone was not changed
    const unchanged = await db.select().from(schedules).where(eq(schedules.id, testScheduleId));
    assert.strictEqual(unchanged[0].timezone, 'UTC');
  });

  await t.test('resolveScheduleTimezone - happy path (any authenticated user)', async () => {
    if (!testUser || !testScheduleId) return;
    mockUser = { userId: testUser.id, role: testUser.role };

    // Reset to NEEDS_CLARIFICATION
    await db.update(schedules)
      .set({ timezoneStatus: 'NEEDS_CLARIFICATION' as any, timezone: null })
      .where(eq(schedules.id, testScheduleId));

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ResolveScheduleTimezone($scheduleId: ID!, $timezone: String!) {
            resolveScheduleTimezone(scheduleId: $scheduleId, timezone: $timezone) {
              scheduleId
              timezone
              timezoneStatus
            }
          }
        `,
        variables: { scheduleId: testScheduleId, timezone: 'America/New_York' }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, 'should not have errors');
    assert.strictEqual(result.data.resolveScheduleTimezone.timezone, 'America/New_York');
    assert.strictEqual(result.data.resolveScheduleTimezone.timezoneStatus, 'RESOLVED');

    // Verify database was updated
    const updated = await db.select().from(schedules).where(eq(schedules.id, testScheduleId));
    assert.strictEqual(updated[0].timezone, 'America/New_York');
    assert.strictEqual(updated[0].timezoneStatus, 'RESOLVED');
  });
});
