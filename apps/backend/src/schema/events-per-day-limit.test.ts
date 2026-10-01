import test from 'node:test';
import * as assert from 'node:assert';
import { createSchema, createYoga } from 'graphql-yoga';
import { resolvers } from './resolvers.js';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/client.js';
import { events, schedules } from '@festgrid/database';
import { inArray, like } from 'drizzle-orm';

/**
 * Story 1.i1h Task 9.1 — `Query.events`'s new optional `perDayLimit` windowed path (AC1/AC2/AC3/AC6)
 * plus the single-exact-date `ORDER BY` tie-break the overflow dialog's continuation call depends on
 * (Task 4). Same real-Postgres Yoga harness as `resolvers.test.ts`; every fixture lives on a
 * far-future, uniquely-prefixed date so it can never collide with this repo's seeded mock data.
 */
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

const yoga = createYoga({
  schema,
  context: () => ({ user: null }) as any,
});

interface Item {
  id: string;
  eventName: string;
  schedules: { id: string; eventStartDate: string }[];
}

/**
 * One parameterised document reused by every subtest — the same lazy-`EventQueryConditionInput`
 * variables convention `resolvers.test.ts`'s `queryOverlaps` helper already uses, extended with the
 * new `perDayLimit` argument (Task 2) plus `limit`/`offset` so the tie-break subtest can paginate.
 */
const EVENTS_QUERY = `
  query Events($query: EventQueryConditionInput, $perDayLimit: Int, $offset: Int, $limit: Int) {
    events(query: $query, perDayLimit: $perDayLimit, offset: $offset, limit: $limit) {
      items {
        id
        eventName
        schedules { id eventStartDate }
      }
      hasMore
      totalCount
    }
  }
`;

async function queryEvents(
  variables: Record<string, unknown>
): Promise<{ items: Item[]; hasMore: boolean; totalCount: number }> {
  const response = await yoga.fetch('http://yoga/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: EVENTS_QUERY, variables }),
  });

  const result = await response.json();
  assert.ok(!result.errors, `GraphQL errors returned: ${JSON.stringify(result.errors)}`);
  return result.data.events;
}

/** How many of the returned occurrences are the seeded single-day rows of one specific day. */
function countSingleDayItemsFor(items: Item[], day: string, namePrefix: string): number {
  return items.filter(
    (item) =>
      item.eventName.startsWith(namePrefix) &&
      item.schedules.length === 1 &&
      item.schedules[0].eventStartDate === day
  ).length;
}

const PREFIX = '1.i1h perDayLimit ';
/** The day that overflows its per-day budget. */
const BUSY_DAY = '2031-06-02';
/** A later day inside the same window — AC1's whole point is that it must not be starved. */
const QUIET_DAY = '2031-06-04';
const MULTI_DAY_END = '2031-06-06';
/** A separate, isolated day for the tie-break/pagination test (Task 4.2). */
const PAGINATION_DAY = '2032-01-15';

test('events resolver perDayLimit windowed path and single-exact-date tie-break (Story 1.i1h)', async (t) => {
  const createdEventIds: string[] = [];

  // Idempotent seed: this suite's own counts are exact, so any row a previously interrupted run
  // left behind must go before seeding (a failed run's `t.after` is not guaranteed to have fired).
  await db.delete(events).where(like(events.eventName, `${PREFIX}%`));

  async function createEvent(opts: {
    eventName: string;
    scheduleStartDate: string;
    scheduleEndDate?: string | null;
    eventStartTime?: string | null;
  }) {
    const [event] = await db.insert(events).values({
      eventName: opts.eventName,
      location: 'Test City',
    }).returning();
    createdEventIds.push(event.id);

    await db.insert(schedules).values({
      eventId: event.id,
      eventStartDate: opts.scheduleStartDate,
      eventEndDate: opts.scheduleEndDate ?? null,
      eventStartTime: opts.eventStartTime ?? null,
      isMainSchedule: true,
    });

    return event;
  }

  // 25 single-day occurrences on the busy day — comfortably over a `perDayLimit: 20`, each with a
  // distinct start time so the window's `event_start_time ASC NULLS LAST, id ASC` ordering is
  // fully determined by data the test controls.
  for (let i = 0; i < 25; i++) {
    const hour = 8 + Math.floor(i / 6);
    const minute = String((i % 6) * 10).padStart(2, '0');
    await createEvent({
      eventName: `${PREFIX}busy ${String(i).padStart(2, '0')}`,
      scheduleStartDate: BUSY_DAY,
      eventStartTime: `${String(hour).padStart(2, '0')}:${minute}:00`,
    });
  }

  // Two single-day occurrences on a later day of the same window.
  await createEvent({ eventName: `${PREFIX}quiet a`, scheduleStartDate: QUIET_DAY, eventStartTime: '10:00:00' });
  await createEvent({ eventName: `${PREFIX}quiet b`, scheduleStartDate: QUIET_DAY, eventStartTime: '11:00:00' });

  // One multi-day occurrence covering the busy day AND the quiet day — exempt from every per-day cap.
  const multiDayEvent = await createEvent({
    eventName: `${PREFIX}multi-day expo`,
    scheduleStartDate: BUSY_DAY,
    scheduleEndDate: MULTI_DAY_END,
    eventStartTime: '07:00:00',
  });

  t.after(async () => {
    await db.delete(events).where(inArray(events.id, createdEventIds));
  });

  const windowCondition = {
    field: 'scheduleDateRange',
    operator: 'overlaps',
    value: { from: BUSY_DAY, to: QUIET_DAY },
  };

  await t.test('caps the busy day at perDayLimit without starving the later day (AC1/AC2/AC3)', async () => {
    const result = await queryEvents({ query: windowCondition, perDayLimit: 20 });

    assert.strictEqual(
      countSingleDayItemsFor(result.items, BUSY_DAY, `${PREFIX}busy`),
      20,
      'the busy day must return exactly perDayLimit single-day occurrences'
    );
    assert.strictEqual(
      countSingleDayItemsFor(result.items, QUIET_DAY, `${PREFIX}quiet`),
      2,
      'the later day must keep its own full slice instead of being starved by the busy day'
    );
    assert.strictEqual(
      result.items.filter((item) => item.id === multiDayEvent.id).length,
      1,
      'the exempt multi-day occurrence must be included exactly once'
    );
    // 20 capped single-day + 2 quiet-day + 1 exempt multi-day.
    assert.strictEqual(result.items.length, 23, 'windowed total must be perDayLimit + later day + exempt');
  });

  await t.test('the multi-day exemption is independent of N (AC1)', async () => {
    const result = await queryEvents({ query: windowCondition, perDayLimit: 1 });

    assert.strictEqual(countSingleDayItemsFor(result.items, BUSY_DAY, `${PREFIX}busy`), 1);
    assert.strictEqual(countSingleDayItemsFor(result.items, QUIET_DAY, `${PREFIX}quiet`), 1);
    assert.strictEqual(
      result.items.filter((item) => item.id === multiDayEvent.id).length,
      1,
      'a multi-day occurrence is never subject to the rn <= N cutoff'
    );
  });

  await t.test('omitting perDayLimit leaves the existing flat path completely unwindowed (AC3)', async () => {
    const result = await queryEvents({ query: windowCondition, limit: 1000 });

    assert.strictEqual(
      countSingleDayItemsFor(result.items, BUSY_DAY, `${PREFIX}busy`),
      25,
      'without perDayLimit every busy-day occurrence is still returned'
    );
    assert.strictEqual(countSingleDayItemsFor(result.items, QUIET_DAY, `${PREFIX}quiet`), 2);
    assert.strictEqual(result.items.filter((item) => item.id === multiDayEvent.id).length, 1);
  });

  await t.test('single-exact-date pagination is ordered, gap-free and duplicate-free (AC6/Task 4.2)', async () => {
    // Five occurrences on their own isolated day, inserted in ascending start-time order so the
    // expected sequence is fully determined: time-then-id is exactly the tie-break under test.
    const expectedOrder: string[] = [];
    for (let i = 0; i < 5; i++) {
      const created = await createEvent({
        eventName: `${PREFIX}page ${i}`,
        scheduleStartDate: PAGINATION_DAY,
        eventStartTime: `${String(9 + i).padStart(2, '0')}:00:00`,
      });
      expectedOrder.push(created.id);
    }

    const exactDateCondition = {
      field: 'scheduleDateRange',
      operator: 'overlaps',
      value: { from: PAGINATION_DAY, to: PAGINATION_DAY },
    };

    const firstPage = await queryEvents({ query: exactDateCondition, offset: 0, limit: 3 });
    const secondPage = await queryEvents({ query: exactDateCondition, offset: 3, limit: 3 });

    const firstIds = firstPage.items.map((item) => item.id);
    const secondIds = secondPage.items.map((item) => item.id);

    assert.strictEqual(firstIds.length, 3, 'page 1 should be a full page');
    assert.strictEqual(secondIds.length, 2, 'page 2 should hold the remainder');
    assert.deepStrictEqual(
      firstIds,
      expectedOrder.slice(0, 3),
      'page 1 must follow the schedule-level event_start_time ASC tie-break'
    );
    assert.deepStrictEqual(
      secondIds,
      expectedOrder.slice(3),
      'page 2 must continue that same sequence rather than restarting it'
    );

    const union = new Set([...firstIds, ...secondIds]);
    assert.strictEqual(union.size, 5, 'the two offset-paginated calls must not duplicate a row');
    for (const id of expectedOrder) {
      assert.ok(union.has(id), `occurrence ${id} was skipped between the two calls`);
    }

    // Deterministic across repeated calls — without the tie-break the primary key alone would leave
    // every same-date candidate tied and the second read could come back in a different order.
    const firstAgain = await queryEvents({ query: exactDateCondition, offset: 0, limit: 3 });
    const secondAgain = await queryEvents({ query: exactDateCondition, offset: 3, limit: 3 });
    assert.deepStrictEqual(firstAgain.items.map((item) => item.id), firstIds, 'page 1 order must be stable');
    assert.deepStrictEqual(secondAgain.items.map((item) => item.id), secondIds, 'page 2 order must be stable');
  });
});
