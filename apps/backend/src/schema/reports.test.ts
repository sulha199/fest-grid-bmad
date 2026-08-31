import test from 'node:test';
import * as assert from 'node:assert';
import { createSchema, createYoga } from 'graphql-yoga';
import { resolvers } from './resolvers.js';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/client.js';
import { users, events, schedules, reports } from '@festgrid/database';
import { eq, and, inArray } from 'drizzle-orm';
import { GraphQLError } from 'graphql';

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

test('reports resolver integration', async (t) => {
  let regularUser: any;
  let regularUser2: any;
  let moderatorUser: any;
  let testEvent: any;

  await t.test('setup - seed users and event', async () => {
    // Insert test event
    const [insertedEvent] = await db.insert(events).values({
      eventName: 'Reports Test Event',
      location: 'Chicago, IL',
    }).returning();
    testEvent = insertedEvent;

    // Insert main schedule for the event
    await db.insert(schedules).values({
      eventId: testEvent.id,
      isMainSchedule: true,
      eventStartDate: '2026-08-11',
    });

    // Insert test users
    const [user1] = await db.insert(users).values({
      email: `reporter1-${Date.now()}@test.com`,
      name: 'Reporter 1',
      role: 'user',
    }).returning();
    regularUser = user1;

    const [user2] = await db.insert(users).values({
      email: `reporter2-${Date.now()}@test.com`,
      name: 'Reporter 2',
      role: 'user',
    }).returning();
    regularUser2 = user2;

    const [mod] = await db.insert(users).values({
      email: `mod-${Date.now()}@test.com`,
      name: 'Moderator',
      role: 'moderator',
    }).returning();
    moderatorUser = mod;
  });

  await t.test('submitReport - unauthenticated rejected', async () => {
    mockUser = null;
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation SubmitReport($eventId: ID!, $reason: ReportReason!, $details: String) {
            submitReport(eventId: $eventId, reason: $reason, details: $details) {
              id
            }
          }
        `,
        variables: {
          eventId: testEvent.id,
          reason: 'personal',
          details: 'Offensive content'
        }
      })
    });

    const result = await response.json();
    assert.ok(result.errors, 'should return errors');
    assert.strictEqual(result.errors[0].extensions?.code, 'UNAUTHENTICATED');
  });

  await t.test('submitReport - unknown eventId rejected with NOT_FOUND', async () => {
    mockUser = { userId: regularUser.id, role: regularUser.role };
    const unknownUuid = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation SubmitReport($eventId: ID!, $reason: ReportReason!, $details: String) {
            submitReport(eventId: $eventId, reason: $reason, details: $details) {
              id
            }
          }
        `,
        variables: {
          eventId: unknownUuid,
          reason: 'personal',
          details: 'Offensive content'
        }
      })
    });

    const result = await response.json();
    assert.ok(result.errors, 'should return errors');
    assert.strictEqual(result.errors[0].extensions?.code, 'NOT_FOUND');
  });

  let firstReportId: string;

  await t.test('submitReport - valid personal report creation', async () => {
    mockUser = { userId: regularUser.id, role: regularUser.role };
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation SubmitReport($eventId: ID!, $reason: ReportReason!, $details: String) {
            submitReport(eventId: $eventId, reason: $reason, details: $details) {
              id
              reason
              status
              moderatorIgnored
              event {
                id
                eventName
              }
            }
          }
        `,
        variables: {
          eventId: testEvent.id,
          reason: 'personal',
          details: 'Offensive content'
        }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, 'should not return errors');
    const report = result.data.submitReport;
    assert.ok(report.id);
    assert.strictEqual(report.reason, 'personal');
    assert.strictEqual(report.status, 'pending');
    assert.strictEqual(report.moderatorIgnored, false);
    assert.strictEqual(report.event.id, testEvent.id);
    assert.strictEqual(report.event.eventName, 'Reports Test Event');
    firstReportId = report.id;
  });

  await t.test('myReports - returns only user\'s reports', async () => {
    // First user's reports query
    mockUser = { userId: regularUser.id, role: regularUser.role };
    let response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query MyReports {
            myReports {
              id
              reason
              status
            }
          }
        `
      })
    });
    let result = await response.json();
    assert.ok(!result.errors);
    assert.strictEqual(result.data.myReports.length, 1);
    assert.strictEqual(result.data.myReports[0].id, firstReportId);

    // Second user's reports query (should be empty)
    mockUser = { userId: regularUser2.id, role: regularUser2.role };
    response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query MyReports {
            myReports {
              id
            }
          }
        `
      })
    });
    result = await response.json();
    assert.ok(!result.errors);
    assert.strictEqual(result.data.myReports.length, 0);
  });

  await t.test('reportedEvents - non-moderator caller rejected with FORBIDDEN', async () => {
    mockUser = { userId: regularUser.id, role: regularUser.role };
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query ReportedEvents {
            reportedEvents {
              id
            }
          }
        `
      })
    });
    const result = await response.json();
    assert.ok(result.errors);
    assert.strictEqual(result.errors[0].extensions?.code, 'FORBIDDEN');
  });

  await t.test('reportedEvents - moderator sees all, works with filters', async () => {
    mockUser = { userId: moderatorUser.id, role: moderatorUser.role };
    
    // Unfiltered
    let response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query ReportedEvents {
            reportedEvents {
              id
              status
              reason
            }
          }
        `
      })
    });
    let result = await response.json();
    assert.ok(!result.errors);
    const ownReports = result.data.reportedEvents.filter((r: any) => r.id === firstReportId);
    assert.strictEqual(ownReports.length, 1, 'should include exactly one entry for the report this test created');
    assert.strictEqual(ownReports[0].id, firstReportId);

    // Filter by reason = dangerous (should be empty)
    response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query ReportedEvents($reason: ReportReason) {
            reportedEvents(reason: $reason) {
              id
            }
          }
        `,
        variables: { reason: 'dangerous' }
      })
    });
    result = await response.json();
    assert.ok(!result.errors);
    assert.strictEqual(result.data.reportedEvents.length, 0);

    // Filter by reason = personal
    response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query ReportedEvents($reason: ReportReason) {
            reportedEvents(reason: $reason) {
              id
            }
          }
        `,
        variables: { reason: 'personal' }
      })
    });
    result = await response.json();
    assert.ok(!result.errors);
    assert.strictEqual(result.data.reportedEvents.length, 1);
  });

  await t.test('ignoreSubsequentReports - non-moderator rejected with FORBIDDEN', async () => {
    mockUser = { userId: regularUser.id, role: regularUser.role };
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation IgnoreSubsequentReports($reportId: ID!) {
            ignoreSubsequentReports(reportId: $reportId) {
              id
            }
          }
        `,
        variables: { reportId: firstReportId }
      })
    });
    const result = await response.json();
    assert.ok(result.errors);
    assert.strictEqual(result.errors[0].extensions?.code, 'FORBIDDEN');
  });

  await t.test('ignoreSubsequentReports - cancelled/personal rejected with BAD_REQUEST', async () => {
    mockUser = { userId: moderatorUser.id, role: moderatorUser.role };
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation IgnoreSubsequentReports($reportId: ID!) {
            ignoreSubsequentReports(reportId: $reportId) {
              id
            }
          }
        `,
        variables: { reportId: firstReportId }
      })
    });
    const result = await response.json();
    assert.ok(result.errors);
    assert.strictEqual(result.errors[0].extensions?.code, 'BAD_REQUEST');
  });

  let dangerousReportId: string;

  await t.test('ignoreSubsequentReports - valid dangerous report sets moderatorIgnored: true', async () => {
    // First, submit a dangerous report as Reporter 1
    mockUser = { userId: regularUser.id, role: regularUser.role };
    let response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation SubmitReport($eventId: ID!, $reason: ReportReason!) {
            submitReport(eventId: $eventId, reason: $reason) {
              id
              reason
            }
          }
        `,
        variables: {
          eventId: testEvent.id,
          reason: 'dangerous'
        }
      })
    });
    let result = await response.json();
    assert.ok(!result.errors);
    dangerousReportId = result.data.submitReport.id;

    // Now mod ignores subsequent reports on this dangerous report
    mockUser = { userId: moderatorUser.id, role: moderatorUser.role };
    response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation IgnoreSubsequentReports($reportId: ID!) {
            ignoreSubsequentReports(reportId: $reportId) {
              id
              moderatorIgnored
            }
          }
        `,
        variables: { reportId: dangerousReportId }
      })
    });
    result = await response.json();
    assert.ok(!result.errors);
    assert.strictEqual(result.data.ignoreSubsequentReports.moderatorIgnored, true);
  });

  await t.test('submitReport - dangerous report ignored check', async () => {
    // When reporter 1 tries to submit dangerous again on that event, it's rejected with REPORT_IGNORED
    mockUser = { userId: regularUser.id, role: regularUser.role };
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation SubmitReport($eventId: ID!, $reason: ReportReason!) {
            submitReport(eventId: $eventId, reason: $reason) {
              id
            }
          }
        `,
        variables: {
          eventId: testEvent.id,
          reason: 'dangerous'
        }
      })
    });
    const result = await response.json();
    assert.ok(result.errors);
    assert.strictEqual(result.errors[0].extensions?.code, 'REPORT_IGNORED');
  });

  await t.test('resolveReport - non-moderator rejected with FORBIDDEN', async () => {
    mockUser = { userId: regularUser.id, role: regularUser.role };
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ResolveReport($id: ID!, $outcome: ReportOutcome!) {
            resolveReport(id: $id, outcome: $outcome) {
              id
            }
          }
        `,
        variables: { id: firstReportId, outcome: 'upheld' }
      })
    });
    const result = await response.json();
    assert.ok(result.errors);
    assert.strictEqual(result.errors[0].extensions?.code, 'FORBIDDEN');
  });

  await t.test('resolveReport - unknown reportId rejected with NOT_FOUND', async () => {
    mockUser = { userId: moderatorUser.id, role: moderatorUser.role };
    const unknownUuid = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ResolveReport($id: ID!, $outcome: ReportOutcome!) {
            resolveReport(id: $id, outcome: $outcome) {
              id
            }
          }
        `,
        variables: { id: unknownUuid, outcome: 'upheld' }
      })
    });
    const result = await response.json();
    assert.ok(result.errors);
    assert.strictEqual(result.errors[0].extensions?.code, 'NOT_FOUND');
  });

  await t.test('resolveReport - valid resolution sets columns correctly', async () => {
    mockUser = { userId: moderatorUser.id, role: moderatorUser.role };
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ResolveReport($id: ID!, $outcome: ReportOutcome!) {
            resolveReport(id: $id, outcome: $outcome) {
              id
              status
              resolvedByModeratorId
              resolvedAt
            }
          }
        `,
        variables: { id: firstReportId, outcome: 'upheld' }
      })
    });
    const result = await response.json();
    assert.ok(!result.errors);
    const report = result.data.resolveReport;
    assert.strictEqual(report.status, 'upheld');
    assert.strictEqual(report.resolvedByModeratorId, moderatorUser.id);
    assert.ok(report.resolvedAt);
  });

  await t.test('resolveReport - already resolved throws INVALID_STATE_TRANSITION', async () => {
    mockUser = { userId: moderatorUser.id, role: moderatorUser.role };
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ResolveReport($id: ID!, $outcome: ReportOutcome!) {
            resolveReport(id: $id, outcome: $outcome) {
              id
            }
          }
        `,
        variables: { id: firstReportId, outcome: 'dismissed' }
      })
    });
    const result = await response.json();
    assert.ok(result.errors);
    assert.strictEqual(result.errors[0].extensions?.code, 'INVALID_STATE_TRANSITION');
  });

  await t.test('Event.isHiddenForCurrentUser evaluation', async () => {
    // 1. Unauthenticated sees false
    mockUser = null;
    let response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query GetEvent($id: ID!) {
            event(id: $id) {
              id
              isHiddenForCurrentUser
            }
          }
        `,
        variables: { id: testEvent.id }
      })
    });
    let result = await response.json();
    assert.ok(!result.errors);
    assert.strictEqual(result.data.event.isHiddenForCurrentUser, false);

    // 2. Reporter (regularUser) sees true (even after report resolution / upheld)
    mockUser = { userId: regularUser.id, role: regularUser.role };
    response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query GetEvent($id: ID!) {
            event(id: $id) {
              id
              isHiddenForCurrentUser
            }
          }
        `,
        variables: { id: testEvent.id }
      })
    });
    result = await response.json();
    assert.ok(!result.errors);
    assert.strictEqual(result.data.event.isHiddenForCurrentUser, true);

    // 3. Non-reporter (regularUser2) sees false
    mockUser = { userId: regularUser2.id, role: regularUser2.role };
    response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query GetEvent($id: ID!) {
            event(id: $id) {
              id
              isHiddenForCurrentUser
            }
          }
        `,
        variables: { id: testEvent.id }
      })
    });
    result = await response.json();
    assert.ok(!result.errors);
    assert.strictEqual(result.data.event.isHiddenForCurrentUser, false);
  });

  await t.test('submitReport - cancelled threshold-triggered soft-delete matrix (Story 4.4a)', async (t) => {
    // Let's create an event to report
    const [reportEvent] = await db.insert(events).values({
      eventName: '4.4a Report Event',
      location: 'Threshold City',
    }).returning();

    // Create three test users (reporters)
    const [u1] = await db.insert(users).values({ email: `u1-${Date.now()}@t.com`, role: 'user' }).returning();
    const [u2] = await db.insert(users).values({ email: `u2-${Date.now()}@t.com`, role: 'user' }).returning();
    const [u3] = await db.insert(users).values({ email: `u3-${Date.now()}@t.com`, role: 'user' }).returning();

    t.after(async () => {
      await db.delete(reports).where(eq(reports.eventId, reportEvent.id));
      await db.delete(events).where(eq(events.id, reportEvent.id));
      await db.delete(users).where(inArray(users.id, [u1.id, u2.id, u3.id]));
    });

    // Helper helper to submit report
    const submit = async (user: any, reason: string) => {
      mockUser = { userId: user.id, role: user.role };
      const response = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation {
              submitReport(eventId: "${reportEvent.id}", reason: ${reason}) {
                id
              }
            }
          `
        })
      });
      return await response.json();
    };

    // 1st unique reporter:Cancelled -> should stay active
    let res = await submit(u1, 'cancelled');
    assert.ok(!res.errors, JSON.stringify(res.errors));
    let [evState] = await db.select().from(events).where(eq(events.id, reportEvent.id));
    assert.strictEqual(evState.deletedAt, null, 'Should be active after 1 report');

    // Duplicate report from u1:Cancelled -> should stay active (count distinct)
    res = await submit(u1, 'cancelled');
    assert.ok(!res.errors);
    [evState] = await db.select().from(events).where(eq(events.id, reportEvent.id));
    assert.strictEqual(evState.deletedAt, null, 'Should be active after duplicate report');

    // 2nd unique reporter:Cancelled -> should stay active
    res = await submit(u2, 'cancelled');
    assert.ok(!res.errors);
    [evState] = await db.select().from(events).where(eq(events.id, reportEvent.id));
    assert.strictEqual(evState.deletedAt, null, 'Should be active after 2 reports');

    // 3rd unique reporter:Cancelled -> threshold of 3 reached, event gets soft deleted synchronously!
    res = await submit(u3, 'cancelled');
    assert.ok(!res.errors);
    [evState] = await db.select().from(events).where(eq(events.id, reportEvent.id));
    assert.ok(evState.deletedAt !== null, 'Event should be soft-deleted after 3 unique reports');
  });

  await t.test('submitReport - dangerous reason triggers moderator email alert', async (t) => {
    const consoleInfoCalls: any[] = [];
    const consoleInfoMock = t.mock.method(console, 'info', (...args: any[]) => {
      consoleInfoCalls.push(args);
    });

    mockUser = { userId: regularUser2.id, role: regularUser2.role };
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation SubmitReport($eventId: ID!, $reason: ReportReason!) {
            submitReport(eventId: $eventId, reason: $reason) {
              id
              reason
            }
          }
        `,
        variables: {
          eventId: testEvent.id,
          reason: 'dangerous',
        },
      }),
    });

    const result = await response.json();
    consoleInfoMock.mock.restore();

    assert.ok(!result.errors, 'should not return errors');
    assert.strictEqual(result.data.submitReport.reason, 'dangerous');

    const matchedCall = consoleInfoCalls.some((args) => {
      const msg = args.join(' ');
      return (
        msg.includes('[Email Stub]') &&
        msg.includes('Template: DANGEROUS_EVENT_MODERATOR_ALERT') &&
        msg.includes(`To: ${moderatorUser.email}`)
      );
    });

    assert.ok(matchedCall, 'Should have logged email stub send for moderatorUser');
  });

  await t.test('resolveReportsForEvent - non-moderator rejected with FORBIDDEN', async () => {
    mockUser = { userId: regularUser.id, role: regularUser.role };
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ResolveReportsForEvent($eventId: ID!) {
            resolveReportsForEvent(eventId: $eventId) {
              id
            }
          }
        `,
        variables: { eventId: testEvent.id }
      })
    });
    const result = await response.json();
    assert.ok(result.errors);
    assert.strictEqual(result.errors[0].extensions?.code, 'FORBIDDEN');
  });

  await t.test('resolveReportsForEvent - unknown eventId rejected with NOT_FOUND', async () => {
    mockUser = { userId: moderatorUser.id, role: moderatorUser.role };
    const unknownUuid = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ResolveReportsForEvent($eventId: ID!) {
            resolveReportsForEvent(eventId: $eventId) {
              id
            }
          }
        `,
        variables: { eventId: unknownUuid }
      })
    });
    const result = await response.json();
    assert.ok(result.errors);
    assert.strictEqual(result.errors[0].extensions?.code, 'NOT_FOUND');
  });

  await t.test('resolveReportsForEvent - soft-deleted event with pending and resolved reports', async () => {
    // Soft-delete the test event
    await db.update(events).set({ deletedAt: new Date() }).where(eq(events.id, testEvent.id));

    // Clear reports on this event
    await db.delete(reports).where(eq(reports.eventId, testEvent.id));

    // Insert 2 pending reports
    const [p1] = await db.insert(reports).values({
      eventId: testEvent.id,
      reporterUserId: regularUser.id,
      reason: 'cancelled',
      status: 'pending',
    }).returning();

    const [p2] = await db.insert(reports).values({
      eventId: testEvent.id,
      reporterUserId: regularUser2.id,
      reason: 'personal',
      status: 'pending',
    }).returning();

    // Insert 1 already-dismissed report
    const [p3] = await db.insert(reports).values({
      eventId: testEvent.id,
      reporterUserId: regularUser2.id,
      reason: 'personal',
      status: 'dismissed',
      resolvedByModeratorId: moderatorUser.id,
      resolvedAt: new Date(),
    }).returning();

    mockUser = { userId: moderatorUser.id, role: moderatorUser.role };
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ResolveReportsForEvent($eventId: ID!) {
            resolveReportsForEvent(eventId: $eventId) {
              id
              status
              resolvedByModeratorId
            }
          }
        `,
        variables: { eventId: testEvent.id }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, JSON.stringify(result.errors));
    const resolvedReports = result.data.resolveReportsForEvent;
    
    // Check that we returned the 2 newly resolved reports
    assert.strictEqual(resolvedReports.length, 2);
    assert.ok(resolvedReports.some((r: any) => r.id === p1.id && r.status === 'dismissed'));
    assert.ok(resolvedReports.some((r: any) => r.id === p2.id && r.status === 'dismissed'));

    // Verify in database that event is un-deleted (deletedAt is null)
    const [updatedEvent] = await db.select().from(events).where(eq(events.id, testEvent.id));
    assert.strictEqual(updatedEvent.deletedAt, null);

    // Verify that the already dismissed report stayed untouched (or wasn't resolved again/returned)
    const [dismissedInDb] = await db.select().from(reports).where(eq(reports.id, p3.id));
    assert.strictEqual(dismissedInDb.status, 'dismissed');
  });

  await t.test('cleanup - remove seeded reports, schedules, users, and events', async () => {
    await db.delete(reports).where(eq(reports.eventId, testEvent.id));
    await db.delete(schedules).where(eq(schedules.eventId, testEvent.id));
    await db.delete(events).where(eq(events.id, testEvent.id));
    await db.delete(users).where(eq(users.id, regularUser.id));
    await db.delete(users).where(eq(users.id, regularUser2.id));
    await db.delete(users).where(eq(users.id, moderatorUser.id));
  });
});
