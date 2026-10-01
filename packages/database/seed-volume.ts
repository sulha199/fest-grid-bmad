/**
 * Permanent, deterministic synthetic-VOLUME seed (added 2026-10-01, CC-024 wave plan).
 *
 * Why it exists: the hot read paths (`Query.events`, `Query.eventBySlug`, AD-17) only show their
 * real query plans at volume -- the regular fixture seed holds a dozen events, far too few for
 * EXPLAIN evidence (Story 3.6r's before/after acceptance criterion). schema.ts's own
 * `schedule_event_date_idx` comment already cites EXPLAIN ANALYZE at ~30k-event volume; this makes
 * that volume reproducible instead of ad hoc.
 *
 * Design rules:
 *   - ADDITIVE: it never wipes the database (unlike seed.ts). It only inserts rows carrying a
 *     recognizable marker and `--clean` removes exactly those rows.
 *   - DETERMINISTIC: a seeded PRNG + id-derived UUIDs, so the same options give the same rows.
 *   - RELATIVE DATES: every schedule/post date is an offset from "today" (UTC), so the mix of
 *     past / ongoing / upcoming events stays representative no matter when it is run.
 *   - LOCAL-ONLY by default: it reuses seed.ts's assertSafeSeedTarget guard.
 *
 * Usage (from packages/database):
 *   pnpm seed:volume                 30,000 events (default)
 *   pnpm seed:volume -- --events 5000
 *   pnpm seed:volume:clean           remove only the synthetic rows
 *
 * Markers: profiles `account_id LIKE 'vol-acct-%'`, posts `post_url LIKE '%/p/VOL%'`,
 * events `slug LIKE 'vol-event-%'` (schedules/favorites/calendar entries cascade from events).
 * User-scoped rows (subscriptions, favorites, calendar entries) attach to the two fixture users and
 * are skipped with a warning if the fixture seed has not been run.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { inArray, like } from 'drizzle-orm';
import {
  calendarAdditions,
  events,
  favorites,
  posts,
  schedules,
  socialMediaAccountProfiles,
  subscriptions,
  users,
} from './schema';
import { loadDatabaseEnv } from './env';
import { FIXTURE_USERS, createSqlClient, isLocalConnectionString, relativeDate } from './seed';

export const DEFAULT_VOLUME_EVENT_COUNT = 30_000;
const CHUNK_SIZE = 1000;

export interface VolumeSeedOptions {
  eventCount?: number;
  seed?: number;
  /** Injected "today" so date generation is testable; defaults to the real current time. */
  today?: Date;
}

// ---------------------------------------------------------------------------------------------
// Deterministic helpers
// ---------------------------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Valid, deterministic UUID (version/variant bits set) in a per-table namespace. */
function volumeId(namespace: string, n: number): string {
  return `${namespace}-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
}
const NS = { profile: 'a1000000', post: 'a2000000', event: 'a3000000', schedule: 'a4000000', subscription: 'a5000000', favorite: 'a6000000', calendar: 'a7000000' } as const;

const CITIES = [
  { name: 'Jakarta', admin: 'DKI Jakarta', lat: -6.2088, lng: 106.8456 },
  { name: 'Bandung', admin: 'West Java', lat: -6.9175, lng: 107.6191 },
  { name: 'Yogyakarta', admin: 'Special Region of Yogyakarta', lat: -7.7956, lng: 110.3695 },
  { name: 'Sleman', admin: 'Special Region of Yogyakarta', lat: -7.7156, lng: 110.3556 },
  { name: 'Semarang', admin: 'Central Java', lat: -6.9667, lng: 110.4167 },
  { name: 'Surabaya', admin: 'East Java', lat: -7.2575, lng: 112.7521 },
  { name: 'Malang', admin: 'East Java', lat: -7.9666, lng: 112.6326 },
  { name: 'Denpasar', admin: 'Bali', lat: -8.65, lng: 115.2167 },
  { name: 'Medan', admin: 'North Sumatra', lat: 3.5952, lng: 98.6722 },
  { name: 'Makassar', admin: 'South Sulawesi', lat: -5.1477, lng: 119.4327 },
  { name: 'Bogor', admin: 'West Java', lat: -6.5971, lng: 106.806 },
  { name: 'Solo', admin: 'Central Java', lat: -7.5666, lng: 110.8167 },
] as const;
const VENUE_TYPES = ['hall', 'mall', 'park', 'cafe', 'stadium', 'museum', 'campus', 'hotel'] as const;
const TYPES = ['EXHIBITION', 'COMPETITION', 'FESTIVAL', 'PERFORMANCE', 'WORKSHOP', 'SEMINAR', 'MARKET', 'GATHERING', 'PROMOTION', 'OTHER'] as const;
const CATEGORIES = ['MUSIC', 'ARTS_AND_CULTURE', 'FOOD_AND_DRINK', 'SPORTS_AND_FITNESS', 'FAMILY_AND_KIDS', 'HOBBIES_AND_INTERESTS', 'BUSINESS_AND_NETWORKING', 'TECHNOLOGY'] as const;
const PRICES = ['Free', 'Gratis', 'IDR 50000', 'IDR 150000', 'IDR 250000', 'Free before 9 PM', null] as const;
const HASHTAGS = ['jogja', 'music', 'festival', 'run', 'market', 'workshop', 'expo', 'kids', 'tech', 'art', 'food', 'charity'] as const;
const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

function pick<T>(rnd: () => number, list: readonly T[]): T {
  return list[Math.floor(rnd() * list.length)];
}
function int(rnd: () => number, min: number, max: number): number {
  return min + Math.floor(rnd() * (max - min + 1));
}
function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

// ---------------------------------------------------------------------------------------------
// Pure generator
// ---------------------------------------------------------------------------------------------

export function buildVolumeFixtures(options: VolumeSeedOptions = {}) {
  const eventCount = options.eventCount ?? DEFAULT_VOLUME_EVENT_COUNT;
  const rnd = mulberry32(options.seed ?? 20261001);
  const today = options.today ?? new Date();
  const date = (offset: number) => relativeDate(offset, today);

  const profileCount = Math.max(1, Math.ceil(eventCount / 150));
  const profileRows = Array.from({ length: profileCount }, (_, i) => {
    const city = CITIES[i % CITIES.length];
    return {
      id: volumeId(NS.profile, i + 1),
      accountId: `vol-acct-${i + 1}`,
      platform: 'instagram',
      username: `vol_acct_${i + 1}`,
      displayName: `Volume Account ${i + 1}`,
      accountType: 'ORGANIZER_VENUE_EVENT' as const,
      accountTypeStatus: 'CONFIRMED' as const,
      isImageStorageOptedIn: i % 10 === 0,
      lastPostDate: new Date(today.getTime() - int(rnd, 0, 20) * 86_400_000),
      lastScrapedAt: new Date(today.getTime() - int(rnd, 0, 2) * 86_400_000),
      defaultLocation: {
        coordinates: { latitude: city.lat, longitude: city.lng },
        formattedAddress: `${city.name}, Indonesia`,
        placeName: city.name,
        provider: 'GEOAPIFY' as const,
        city: city.name,
        adminArea: city.admin,
      },
    };
  });

  const postRows: Array<typeof posts.$inferInsert> = [];
  const eventRows: Array<typeof events.$inferInsert> = [];
  const scheduleRows: Array<typeof schedules.$inferInsert> = [];

  for (let i = 0; i < eventCount; i++) {
    const n = i + 1;
    const profile = profileRows[i % profileCount];
    const city = CITIES[int(rnd, 0, CITIES.length - 1)];
    const eventId = volumeId(NS.event, n);
    const postId = volumeId(NS.post, n);

    // Temporal mix relative to today: ~22% past, ~8% ongoing, ~70% upcoming.
    const bucket = rnd();
    let startOffset: number;
    if (bucket < 0.22) startOffset = -int(rnd, 2, 150);
    else if (bucket < 0.3) startOffset = -int(rnd, 0, 5);
    else startOffset = int(rnd, 1, 200);

    const publishedOffset = Math.min(startOffset, 0) - int(rnd, 1, 14);
    const imageExpiryOffset = int(rnd, 3, 30);
    const hashtags = [pick(rnd, HASHTAGS), pick(rnd, HASHTAGS)];

    postRows.push({
      id: postId,
      accountId: profile.id,
      platform: 'instagram',
      postUrl: `https://instagram.com/${profile.username}/p/VOL${n}`,
      originalPostUrl: `https://www.instagram.com/p/VOL${n}/`,
      content: `Synthetic volume event ${n} #${hashtags[0]} #${hashtags[1]}`,
      imageUrl: `https://example.invalid/vol/${n}.jpg`,
      durableImageUrl: profile.isImageStorageOptedIn ? `https://example.invalid/durable/${n}.jpg` : null,
      imageUrlExpiresAt: new Date(today.getTime() + imageExpiryOffset * 86_400_000),
      isExtracted: true,
      publishedAt: new Date(`${date(publishedOffset)}T10:00:00Z`),
      hashtags,
      ownerUsername: profile.username,
      ownerDisplayName: profile.displayName,
    });

    const type = pick(rnd, TYPES);
    eventRows.push({
      id: eventId,
      slug: `vol-event-${n}`,
      eventName: `Volume Event ${n} ${type.charAt(0)}${type.slice(1).toLowerCase()}`,
      types: [type],
      categories: [pick(rnd, CATEGORIES)],
      location: `${city.name} Venue ${int(rnd, 1, 40)}`,
      organizerName: profile.displayName,
      confidenceScore: Math.round((0.6 + rnd() * 0.4) * 100) / 100,
      sourceSocialMediaAccountId: profile.accountId,
      postId,
    });

    const scheduleRoll = rnd();
    const scheduleCount = scheduleRoll < 0.7 ? 1 : scheduleRoll < 0.9 ? 2 : 3;
    for (let k = 0; k < scheduleCount; k++) {
      const start = startOffset + k * int(rnd, 3, 9);
      const durationDays = rnd() < 0.3 ? int(rnd, 1, 4) : 0;
      const hour = int(rnd, 8, 20);
      const venueCity = rnd() < 0.85 ? city : CITIES[int(rnd, 0, CITIES.length - 1)];
      const lat = venueCity.lat + (rnd() - 0.5) * 0.08;
      const lng = venueCity.lng + (rnd() - 0.5) * 0.08;
      const venueType = pick(rnd, VENUE_TYPES);
      scheduleRows.push({
        id: volumeId(NS.schedule, scheduleRows.length + 1),
        slug: `vol-sched-${n}-${k + 1}`,
        eventId,
        isMainSchedule: k === 0,
        eventStartDate: date(start),
        eventEndDate: date(start + durationDays),
        eventStartTime: `${pad(hour)}:00:00`,
        eventEndTime: `${pad(Math.min(hour + int(rnd, 1, 4), 23))}:00:00`,
        title: scheduleCount > 1 ? `Session ${k + 1}` : null,
        performers: rnd() < 0.5 ? [`Performer ${int(rnd, 1, 300)}`] : null,
        location: `${venueCity.name} ${venueType}`,
        ticketPrice: pick(rnd, PRICES),
        latitude: lat,
        longitude: lng,
        locationDetails: {
          coordinates: { latitude: lat, longitude: lng },
          formattedAddress: `${venueCity.name}, Indonesia`,
          placeName: `${venueCity.name} ${venueType}`,
          provider: 'GEOAPIFY' as const,
          city: venueCity.name,
          adminArea: venueCity.admin,
          venueType,
        },
        timezone: 'Asia/Jakarta',
        // ~7% of multi-day schedules are weekday-narrowed (Story 1.3k / BUG-026 shape).
        applicableDaysOfWeek: durationDays >= 3 && rnd() < 0.25 ? [pick(rnd, DAYS)] : null,
      });
    }
  }

  // User-scoped rows exercising the per-row `isFavorited` / `favoriteCount` /
  // `isAddedToCalendar` / `isFromSubscribedAccount` subqueries on the hot path.
  const userA = FIXTURE_USERS[0].id;
  const userB = FIXTURE_USERS[1].id;
  const subscriptionRows: Array<typeof subscriptions.$inferInsert> = [];
  profileRows.forEach((profile, i) => {
    if (i % 8 === 0) subscriptionRows.push({ id: volumeId(NS.subscription, subscriptionRows.length + 1), userId: userA, accountId: profile.id });
    if (i % 16 === 3) subscriptionRows.push({ id: volumeId(NS.subscription, subscriptionRows.length + 1), userId: userB, accountId: profile.id });
  });
  const favoriteRows: Array<typeof favorites.$inferInsert> = [];
  const calendarRows: Array<typeof calendarAdditions.$inferInsert> = [];
  const mainScheduleByEvent = new Map(scheduleRows.filter((s) => s.isMainSchedule).map((s) => [s.eventId, s.id as string]));
  eventRows.forEach((event, i) => {
    const eventId = event.id as string;
    if (i % 16 === 0) favoriteRows.push({ id: volumeId(NS.favorite, favoriteRows.length + 1), userId: userA, eventId });
    if (i % 32 === 5) favoriteRows.push({ id: volumeId(NS.favorite, favoriteRows.length + 1), userId: userB, eventId });
    if (i % 10 === 7 && i % 32 !== 5) favoriteRows.push({ id: volumeId(NS.favorite, favoriteRows.length + 1), userId: userB, eventId, deletedAt: new Date(today.getTime() - 86_400_000) });
    if (i % 33 === 0) calendarRows.push({ id: volumeId(NS.calendar, calendarRows.length + 1), userId: userA, eventId, scheduleId: mainScheduleByEvent.get(eventId) as string });
  });

  return { profileRows, postRows, eventRows, scheduleRows, subscriptionRows, favoriteRows, calendarRows };
}

// ---------------------------------------------------------------------------------------------
// DB operations
// ---------------------------------------------------------------------------------------------

function chunk<T>(rows: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) out.push(rows.slice(i, i + CHUNK_SIZE));
  return out;
}

function assertSafeTarget(connectionString: string): void {
  if (process.env.ALLOW_DESTRUCTIVE_SEED === 'true' || isLocalConnectionString(connectionString)) return;
  throw new Error('Refusing to write synthetic volume data to a non-local database. Set ALLOW_DESTRUCTIVE_SEED=true to override intentionally.');
}

export async function cleanVolume(connectionString?: string): Promise<void> {
  const url = connectionString ?? loadDatabaseEnv(__dirname).databaseUrl;
  assertSafeTarget(url);
  const sqlClient = createSqlClient(url);
  const db = drizzle(sqlClient);
  try {
    await db.transaction(async (tx) => {
      // events first (schedules/favorites/calendar_additions/reports cascade), then the rows they pointed at.
      await tx.delete(events).where(like(events.slug, 'vol-event-%'));
      const volumeProfiles = tx.select({ id: socialMediaAccountProfiles.id }).from(socialMediaAccountProfiles).where(like(socialMediaAccountProfiles.accountId, 'vol-acct-%'));
      await tx.delete(subscriptions).where(inArray(subscriptions.accountId, volumeProfiles));
      await tx.delete(posts).where(like(posts.postUrl, '%/p/VOL%'));
      await tx.delete(socialMediaAccountProfiles).where(like(socialMediaAccountProfiles.accountId, 'vol-acct-%'));
    });
  } finally {
    await sqlClient.end();
  }
}

export async function seedVolume(connectionString?: string, options: VolumeSeedOptions = {}): Promise<Record<string, number>> {
  const url = connectionString ?? loadDatabaseEnv(__dirname).databaseUrl;
  assertSafeTarget(url);
  await cleanVolume(url);

  const rows = buildVolumeFixtures(options);
  const sqlClient = createSqlClient(url);
  const db = drizzle(sqlClient);
  try {
    const present = await db.select({ id: users.id }).from(users).where(inArray(users.id, [FIXTURE_USERS[0].id, FIXTURE_USERS[1].id]));
    const hasFixtureUsers = present.length === 2;
    if (!hasFixtureUsers) {
      console.warn('Fixture users not found (run `pnpm seed` first) -- skipping subscriptions, favorites and calendar entries.');
    }

    await db.transaction(async (tx) => {
      for (const c of chunk(rows.profileRows)) await tx.insert(socialMediaAccountProfiles).values(c);
      for (const c of chunk(rows.postRows)) await tx.insert(posts).values(c);
      for (const c of chunk(rows.eventRows)) await tx.insert(events).values(c);
      for (const c of chunk(rows.scheduleRows)) await tx.insert(schedules).values(c);
      if (hasFixtureUsers) {
        for (const c of chunk(rows.subscriptionRows)) await tx.insert(subscriptions).values(c);
        for (const c of chunk(rows.favoriteRows)) await tx.insert(favorites).values(c);
        for (const c of chunk(rows.calendarRows)) await tx.insert(calendarAdditions).values(c);
      }
    });
    // Fresh planner statistics -- EXPLAIN evidence is meaningless against stale stats.
    await sqlClient.unsafe('ANALYZE social_media_account_profiles, posts, events, schedules, subscriptions, favorites, calendar_additions');

    return {
      profiles: rows.profileRows.length,
      posts: rows.postRows.length,
      events: rows.eventRows.length,
      schedules: rows.scheduleRows.length,
      subscriptions: hasFixtureUsers ? rows.subscriptionRows.length : 0,
      favorites: hasFixtureUsers ? rows.favoriteRows.length : 0,
      calendarAdditions: hasFixtureUsers ? rows.calendarRows.length : 0,
    };
  } finally {
    await sqlClient.end();
  }
}

function parsePositiveInt(value: string | undefined, name: string): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new Error(`${name} must be a positive integer, got "${value}"`);
  return n;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const run = args.includes('--clean')
    ? cleanVolume().then(() => console.log('Synthetic volume rows removed.'))
    : seedVolume(undefined, {
        eventCount: parsePositiveInt(flag('--events'), '--events'),
        seed: parsePositiveInt(flag('--seed'), '--seed'),
      }).then((counts) => console.log('Synthetic volume seeded:', counts));
  run.then(() => process.exit(0)).catch((error: unknown) => {
    console.error('Volume seed failed:', error);
    process.exit(1);
  });
}
