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
 * `Query.events`' default (Discovery) order is the event's next schedule date. Many events share a
 * date, so without a last unique key the order of ties is the planner's choice per page, and a
 * scroll through the list repeated one event and skipped another (2026-10-30: 614 distinct events
 * in 664 rows). The default order must end with `events.id`. Same real-Postgres Yoga harness as
 * `events-per-day-limit.test.ts`; every fixture lives on far-future, uniquely prefixed dates.
 *
 * The window below spans two days on purpose: a window of one date takes the pinned-date branch,
 * which already ends in a schedule id.
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
  schedules: { eventStartDate: string }[];
}

const EVENTS_QUERY = `
  query Events($query: EventQueryConditionInput, $offset: Int, $limit: Int) {
    events(query: $query, offset: $offset, limit: $limit) {
      items {
        id
        schedules { eventStartDate }
      }
      hasMore
    }
  }
`;

async function queryEvents(variables: Record<string, unknown>): Promise<{ items: Item[]; hasMore: boolean }> {
  const response = await yoga.fetch('http://yoga/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: EVENTS_QUERY, variables }),
  });
  const result = await response.json();
  assert.ok(!result.errors, `GraphQL errors returned: ${JSON.stringify(result.errors)}`);
  return result.data.events;
}

const PREFIX = 'default-order-tiebreak ';
const FIRST_DAY = '2033-02-10';
const SECOND_DAY = '2033-02-11';
const WINDOW = { field: 'scheduleDateRange', operator: 'overlaps', value: { from: FIRST_DAY, to: SECOND_DAY } };

test('Query.events default order is total: ties on the next date end with the event id', async (t) => {
  const createdEventIds: string[] = [];

  // A previously interrupted run may have left rows behind; this suite's counts are exact.
  await db.delete(events).where(like(events.eventName, `${PREFIX}%`));

  async function createEvent(name: string, day: string) {
    const [event] = await db.insert(events).values({ eventName: name, location: 'Test City' }).returning();
    createdEventIds.push(event.id);
    await db.insert(schedules).values({ eventId: event.id, eventStartDate: day, isMainSchedule: true });
  }

  // Twelve events share the first day (no start time: nothing but the id can order them), three
  // fall on the second. Their ids are random, so insertion order is not id order.
  for (let i = 0; i < 12; i++) await createEvent(`${PREFIX}first ${i}`, FIRST_DAY);
  for (let i = 0; i < 3; i++) await createEvent(`${PREFIX}second ${i}`, SECOND_DAY);

  t.after(async () => {
    await db.delete(events).where(inArray(events.id, createdEventIds));
  });

  const mine = (items: Item[]) => items.filter((item) => createdEventIds.includes(item.id));

  await t.test('within one date, events come back in ascending id order', async () => {
    const { items } = await queryEvents({ query: WINDOW, limit: 100 });
    const ours = mine(items);

    assert.strictEqual(ours.length, 15, 'every seeded event must be returned');
    const firstDayIds = ours.filter((item) => item.schedules[0].eventStartDate === FIRST_DAY).map((item) => item.id);
    assert.strictEqual(firstDayIds.length, 12);
    assert.deepStrictEqual(firstDayIds, [...firstDayIds].sort(), 'ties on the next date must be ordered by event id');
    assert.ok(
      ours.findIndex((item) => item.schedules[0].eventStartDate === SECOND_DAY) >= 12,
      'the earlier date still comes first'
    );
  });

  await t.test('paging with a small limit repeats nothing and skips nothing', async () => {
    const whole = mine((await queryEvents({ query: WINDOW, limit: 100 })).items).map((item) => item.id);

    for (const pageSize of [1, 4, 5, 7]) {
      const seen: string[] = [];
      for (let offset = 0; ; offset += pageSize) {
        const page = await queryEvents({ query: WINDOW, limit: pageSize, offset });
        seen.push(...mine(page.items).map((item) => item.id));
        if (!page.hasMore) break;
      }
      assert.deepStrictEqual(seen, whole, `page size ${pageSize} must walk the same sequence as one full fetch`);
    }
  });
});
