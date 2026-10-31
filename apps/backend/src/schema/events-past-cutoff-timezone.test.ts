import test from 'node:test';
import * as assert from 'node:assert';
import crypto from 'node:crypto';
import { createSchema, createYoga } from 'graphql-yoga';
import { resolvers } from './resolvers.js';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/client.js';
import { events, schedules, users, userSettings, favorites } from '@festgrid/database';
import { eq, inArray, like } from 'drizzle-orm';

/**
 * BUG-096. The Discovery list cut "past" events at the UTC date, while the card judges "Ended" in
 * the schedule's own timezone, so for about 7 hours of every Jakarta day the list still held events
 * whose card said Ended -- and, west of UTC, hid an event that was still live. The cutoff is now the
 * date of the request's one `now` in each schedule's own zone (`schedule_past_cutoff_date`), used by
 * the default-visibility filter, the Archive's `isPastEvent` and `Event.isExpiredForCurrentUser`.
 *
 * Same real-Postgres Yoga harness as `events-default-order-tiebreak.test.ts`. `context.now` pins the
 * instant (honoured only when NODE_ENV === 'test'); the fixtures live in 2033 so no other suite's
 * rows interfere, and are prefixed so a leftover from an interrupted run is swept first.
 *
 * The two instants are chosen so that the UTC date and the local date disagree:
 *   T1 2033-03-10T17:30Z  UTC Mar 10 | Jakarta Mar 11 00:30 | New York Mar 10 12:30 (EST)
 *   T2 2033-03-11T02:00Z  UTC Mar 11 | Jakarta Mar 11 09:00 | New York Mar 10 21:00 (EST)
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

let mockUser: { userId: string; role: string } | null = null;
let mockNow: Date | null = null;

const yoga = createYoga({
  schema,
  context: () => ({ user: mockUser, now: mockNow ?? undefined }) as any,
});

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const response = await yoga.fetch('http://yoga/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const result = await response.json();
  assert.ok(!result.errors, `GraphQL errors returned: ${JSON.stringify(result.errors)}`);
  return result.data as T;
}

async function listedIds(opts: { includeMyArchived?: boolean } = {}): Promise<Set<string>> {
  const data = await gql<{ events: { items: { id: string }[] } }>(
    `query Events($archived: Boolean) { events(limit: 1000, includeMyArchived: $archived) { items { id } } }`,
    { archived: opts.includeMyArchived ?? null }
  );
  return new Set(data.events.items.map((item) => item.id));
}

const PREFIX = 'past-cutoff-tz ';
const T1 = '2033-03-10T17:30:00.000Z';
const T2 = '2033-03-11T02:00:00.000Z';

interface Case {
  name: string;
  at: typeof T1 | typeof T2;
  timezone: string | null;
  status: 'RESOLVED' | 'NEEDS_CLARIFICATION' | null;
  start: string;
  end: string;
  days?: string[];
  visible: boolean;
}

// `visible` is what the card says: not yet Ended on its last day, in the zone the card would use.
const CASES: Case[] = [
  // T1: Jakarta already turned the page; UTC and New York have not.
  { name: 'Jakarta ended on the 10th: gone at Jakarta 00:30 on the 11th (the bug)', at: T1, timezone: 'Asia/Jakarta', status: 'RESOLVED', start: '2033-03-10', end: '2033-03-10', visible: false },
  { name: 'Jakarta ends on the 11th: still listed', at: T1, timezone: 'Asia/Jakarta', status: 'RESOLVED', start: '2033-03-11', end: '2033-03-11', visible: true },
  { name: 'no timezone: the UTC date applies, as before', at: T1, timezone: null, status: null, start: '2033-03-10', end: '2033-03-10', visible: true },
  { name: 'zone not RESOLVED: ignored like the card does, UTC date applies', at: T1, timezone: 'Asia/Jakarta', status: 'NEEDS_CLARIFICATION', start: '2033-03-10', end: '2033-03-10', visible: true },
  { name: 'zone name Postgres does not know: falls back to UTC, the query does not fail', at: T1, timezone: 'Not/AZone', status: 'RESOLVED', start: '2033-03-10', end: '2033-03-10', visible: true },
  { name: 'New York ends on the 10th: still listed at 12:30 New York', at: T1, timezone: 'America/New_York', status: 'RESOLVED', start: '2033-03-10', end: '2033-03-10', visible: true },
  // The weekday guard reads the same per-row bound: THU-only schedule, the one Thursday is Mar 10.
  { name: 'Jakarta THU-only schedule: its Thursday (the 10th) is over in Jakarta', at: T1, timezone: 'Asia/Jakarta', status: 'RESOLVED', start: '2033-03-07', end: '2033-03-13', days: ['THU'], visible: false },
  { name: 'no-timezone THU-only schedule: that Thursday is still today in UTC', at: T1, timezone: null, status: null, start: '2033-03-07', end: '2033-03-13', days: ['THU'], visible: true },
  // T2: UTC has moved on, New York has not (the opposite direction of the bug).
  { name: 'New York ends on the 10th: still live at 21:00 New York although UTC says the 11th', at: T2, timezone: 'America/New_York', status: 'RESOLVED', start: '2033-03-10', end: '2033-03-10', visible: true },
  { name: 'New York ended on the 9th: gone', at: T2, timezone: 'America/New_York', status: 'RESOLVED', start: '2033-03-09', end: '2033-03-09', visible: false },
  { name: 'Jakarta ended on the 10th: gone', at: T2, timezone: 'Asia/Jakarta', status: 'RESOLVED', start: '2033-03-10', end: '2033-03-10', visible: false },
  { name: 'no timezone, ended on the 10th: gone (UTC is the 11th)', at: T2, timezone: null, status: null, start: '2033-03-10', end: '2033-03-10', visible: false },
  { name: 'no timezone, ends on the 11th: still listed', at: T2, timezone: null, status: null, start: '2033-03-11', end: '2033-03-11', visible: true },
];

test('Query.events judges "past" in each schedule\'s own timezone (BUG-096)', async (t) => {
  const createdEventIds: string[] = [];
  const idByCase = new Map<Case, string>();
  const userId = crypto.randomUUID();

  await db.delete(events).where(like(events.eventName, `${PREFIX}%`));

  async function createEvent(name: string, rows: { timezone: string | null; status: Case['status']; start: string; end: string; days?: string[] }[]) {
    const [event] = await db.insert(events).values({ eventName: `${PREFIX}${name}`, location: 'Test City' }).returning();
    createdEventIds.push(event.id);
    await db.insert(schedules).values(
      rows.map((row, i) => ({
        eventId: event.id,
        eventStartDate: row.start,
        eventEndDate: row.end,
        applicableDaysOfWeek: row.days ?? null,
        timezone: row.timezone,
        timezoneStatus: row.status,
        isMainSchedule: i === 0,
      }))
    );
    return event.id;
  }

  for (const c of CASES) idByCase.set(c, await createEvent(c.name, [c]));

  await db.insert(users).values({ id: userId, email: `past-cutoff-tz-${userId}@example.com`, role: 'user' });
  await db.insert(favorites).values(createdEventIds.map((eventId) => ({ userId, eventId })));

  t.after(async () => {
    mockNow = null;
    mockUser = null;
    await db.delete(favorites).where(eq(favorites.userId, userId));
    await db.delete(events).where(inArray(events.id, createdEventIds));
    await db.delete(userSettings).where(eq(userSettings.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  });

  await t.test('the default list holds an event exactly while its card is not Ended, whatever the UTC date says', async () => {
    mockUser = null;
    for (const at of [T1, T2]) {
      mockNow = new Date(at);
      const ids = await listedIds();
      for (const c of CASES.filter((x) => x.at === at)) {
        assert.strictEqual(ids.has(idByCase.get(c)!), c.visible, `at ${at}: ${c.name}`);
      }
    }
  });

  await t.test('a second, still-upcoming schedule keeps the event listed although its other schedule is past in its zone', async () => {
    const eventId = await createEvent('two schedules', [
      { timezone: 'Asia/Jakarta', status: 'RESOLVED', start: '2033-03-10', end: '2033-03-10' },
      { timezone: 'Asia/Jakarta', status: 'RESOLVED', start: '2033-03-20', end: '2033-03-20' },
    ]);
    mockNow = new Date(T1);
    mockUser = null;
    assert.ok((await listedIds()).has(eventId));
  });

  await t.test('the Archive\'s isPastEvent is the exact complement: every event is in the default list or the archive, never both', async () => {
    mockUser = { userId, role: 'user' };
    for (const at of [T1, T2]) {
      mockNow = new Date(at);
      const [listed, archived] = [await listedIds(), await listedIds({ includeMyArchived: true })];
      for (const c of CASES.filter((x) => x.at === at && !x.days)) {
        const id = idByCase.get(c)!;
        assert.strictEqual(listed.has(id), c.visible, `default list at ${at}: ${c.name}`);
        assert.strictEqual(archived.has(id), !c.visible, `archive at ${at}: ${c.name}`);
      }
    }
  });

  await t.test('a hide-after-N-days grace window counts N days back from the zone-local date', async () => {
    await db.insert(userSettings).values({ userId, hidePastEventsAfterDays: 1 }).onConflictDoUpdate({
      target: userSettings.userId,
      set: { hidePastEventsAfterDays: 1 },
    });
    mockUser = { userId, role: 'user' };
    mockNow = new Date(T1); // Jakarta is the 11th, so with N=1 the cutoff day is the 10th
    const endedOn10 = idByCase.get(CASES[0])!;
    const grace = await createEvent('grace day 9th', [{ timezone: 'Asia/Jakarta', status: 'RESOLVED', start: '2033-03-09', end: '2033-03-09' }]);
    const ids = await listedIds();
    assert.ok(ids.has(endedOn10), 'ended on the 10th is inside the 1-day window');
    assert.ok(!ids.has(grace), 'ended on the 9th is outside it');
  });
});

test('Event.isExpiredForCurrentUser judges the same day, in the schedule\'s own timezone (BUG-096)', async (t) => {
  const createdEventIds: string[] = [];
  const userId = crypto.randomUUID();

  await db.insert(users).values({ id: userId, email: `past-cutoff-expired-${userId}@example.com`, role: 'user' });
  t.after(async () => {
    mockNow = null;
    mockUser = null;
    await db.delete(events).where(inArray(events.id, createdEventIds));
    await db.delete(userSettings).where(eq(userSettings.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  });

  async function isExpired(at: string, c: Pick<Case, 'timezone' | 'status' | 'end'>): Promise<boolean> {
    const [event] = await db.insert(events).values({ eventName: `${PREFIX}expired probe`, location: 'Test City' }).returning();
    createdEventIds.push(event.id);
    await db.insert(schedules).values({ eventId: event.id, eventStartDate: c.end, eventEndDate: c.end, timezone: c.timezone, timezoneStatus: c.status, isMainSchedule: true });
    mockUser = { userId, role: 'user' };
    mockNow = new Date(at);
    const data = await gql<{ event: { isExpiredForCurrentUser: boolean } }>(
      `query Probe($id: ID!) { event(id: $id) { isExpiredForCurrentUser } }`,
      { id: event.id }
    );
    return data.event.isExpiredForCurrentUser;
  }

  // The same instants and rule as the list: expired exactly when the list would have dropped it.
  // A failed query reads as `false` here (the resolver swallows errors), so a function that is
  // missing or raising would show up in the `true` cases.
  for (const c of CASES.filter((x) => !x.days)) {
    await t.test(`${c.at === T1 ? 'T1' : 'T2'}: ${c.name}`, async () => {
      assert.strictEqual(await isExpired(c.at, c), !c.visible);
    });
  }
});
