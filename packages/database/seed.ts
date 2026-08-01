import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
  apiKeys,
  events,
  posts,
  schedules,
  subscriptions,
  userLocations,
  users,
} from './schema';
import { loadDatabaseEnv } from './env';

const FIXTURE_USERS = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'alice.dev@festgrid.local',
    name: 'Alice Dev',
    avatarUrl: 'https://images.example.com/users/alice.jpg',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'bob.dev@festgrid.local',
    name: 'Bob Dev',
    avatarUrl: 'https://images.example.com/users/bob.jpg',
  },
];

const FIXTURE_USER_LOCATIONS = [
  {
    id: '10000000-0000-0000-0000-000000000001',
    userId: FIXTURE_USERS[0].id,
    name: 'Home Jakarta',
    latitude: -6.2088,
    longitude: 106.8456,
    radius: 5000,
  },
  {
    id: '10000000-0000-0000-0000-000000000002',
    userId: FIXTURE_USERS[1].id,
    name: 'Work Bandung',
    latitude: -6.9175,
    longitude: 107.6191,
    radius: 8000,
  },
];

const FIXTURE_SUBSCRIPTIONS = [
  {
    id: '20000000-0000-0000-0000-000000000001',
    userId: FIXTURE_USERS[0].id,
    accountId: 'ig_jkt_events',
    platform: 'instagram',
    displayName: 'Jakarta City Events',
    username: 'jktcity.events',
    profileImageUrl: 'https://images.example.com/profiles/jktcity-events.png',
    description: 'Curated arts and music events around Jakarta.',
  },
  {
    id: '20000000-0000-0000-0000-000000000002',
    userId: FIXTURE_USERS[1].id,
    accountId: 'ig_bdg_family',
    platform: 'instagram',
    displayName: 'Bandung Family Weekend',
    username: 'bdg.family.weekend',
    profileImageUrl: 'https://images.example.com/profiles/bdg-family-weekend.png',
    description: 'Family-friendly community activities and workshops.',
  },
];

const FIXTURE_API_KEYS = [
  {
    id: '30000000-0000-0000-0000-000000000001',
    userId: FIXTURE_USERS[0].id,
    keyEncrypted: 'enc:key:alice:gemini:v1',
    provider: 'gemini',
    isValid: true,
    invalidAttempts: 0,
  },
  {
    id: '30000000-0000-0000-0000-000000000002',
    userId: FIXTURE_USERS[1].id,
    keyEncrypted: 'enc:key:bob:gemini:v1',
    provider: 'gemini',
    isValid: true,
    invalidAttempts: 0,
  },
];

const FIXTURE_POSTS = [
  {
    id: '60000000-0000-0000-0000-000000000001',
    subscriptionId: FIXTURE_SUBSCRIPTIONS[0].id,
    postUrl: 'https://instagram.com/jktcity.events/p/C1PASTJAZZ',
    imageUrl: 'https://images.example.com/events/past-jazz-night.jpg',
    isExtracted: true,
    publishedAt: new Date('2025-01-20T10:00:00Z'),
    content: 'Get ready for an amazing Past Jazz Night 2025! #jazz #jakarta',
  },
  {
    id: '60000000-0000-0000-0000-000000000002',
    subscriptionId: FIXTURE_SUBSCRIPTIONS[0].id,
    postUrl: 'https://instagram.com/jktcity.events/p/C2ONGOING',
    imageUrl: 'https://images.example.com/events/ongoing-culture-fest.jpg',
    isExtracted: true,
    publishedAt: new Date('2025-12-10T10:00:00Z'),
    content: 'The Ongoing Culture Fest 2026-2027 is finally here. #culture #festival',
  },
  {
    id: '60000000-0000-0000-0000-000000000003',
    subscriptionId: FIXTURE_SUBSCRIPTIONS[1].id,
    postUrl: 'https://instagram.com/bdg.family.weekend/p/C3UPCOMING',
    imageUrl: 'https://images.example.com/events/upcoming-family-workshop.jpg',
    isExtracted: true,
    publishedAt: new Date('2027-10-15T10:00:00Z'),
    content: 'Join us at the Upcoming Family Workshop 2027! Fun for all ages. #family #bandung',
  },
];

const FIXTURE_EVENTS = [
  {
    id: '40000000-0000-0000-0000-000000000001',
    slug: 'past-jazz-night-2025-fixed',
    eventName: 'Past Jazz Night 2025',
    types: ['PERFORMANCE'],
    categories: ['MUSIC'],
    location: 'South Jakarta Art Hall',
    organizerName: 'Nusantara Sound Collective',
    contactInfo: 'https://instagram.com/jktcity.events/p/C1PASTJAZZ',
    confidenceScore: 0.96,
    sourceSocialMediaAccountId: FIXTURE_SUBSCRIPTIONS[0].accountId,
    postId: FIXTURE_POSTS[0].id,
  },
  {
    id: '40000000-0000-0000-0000-000000000002',
    slug: 'ongoing-culture-fest-2026-2027-fixed',
    eventName: 'Ongoing Culture Fest 2026-2027',
    types: ['FESTIVAL', 'GATHERING'],
    categories: ['ARTS_AND_CULTURE', 'FAMILY_AND_KIDS'],
    location: 'Merdeka Square, Jakarta',
    organizerName: 'City Culture Office',
    contactInfo: 'https://instagram.com/jktcity.events/p/C2ONGOING',
    confidenceScore: 0.91,
    sourceSocialMediaAccountId: FIXTURE_SUBSCRIPTIONS[0].accountId,
    postId: FIXTURE_POSTS[1].id,
  },
  {
    id: '40000000-0000-0000-0000-000000000003',
    slug: 'upcoming-family-workshop-2027-fixed',
    eventName: 'Upcoming Family Workshop 2027',
    types: ['WORKSHOP'],
    categories: ['FAMILY_AND_KIDS', 'HOBBIES_AND_INTERESTS'],
    location: 'Bandung Community Hub',
    organizerName: 'Bandung Family Weekend',
    contactInfo: 'https://instagram.com/bdg.family.weekend/p/C3UPCOMING',
    confidenceScore: 0.93,
    sourceSocialMediaAccountId: FIXTURE_SUBSCRIPTIONS[1].accountId,
    postId: FIXTURE_POSTS[2].id,
  },
];

const FIXTURE_SCHEDULES = [
  {
    id: '50000000-0000-0000-0000-000000000001',
    slug: 'past-jazz-night-2025-main-fixed',
    eventId: FIXTURE_EVENTS[0].id,
    isMainSchedule: true,
    eventStartDate: '2025-02-20',
    eventEndDate: '2025-02-20',
    eventStartTime: '19:30:00',
    eventEndTime: '22:00:00',
    title: 'Main Jazz Session',
    performers: ['Nusa Trio', 'Kota Brass'],
    location: 'South Jakarta Art Hall - Stage A',
    ticketPrice: 'IDR 150000',
    locationDetails: { lat: -6.2615, lng: 106.8106 },
  },
  {
    id: '50000000-0000-0000-0000-000000000002',
    slug: 'ongoing-culture-fest-opening-fixed',
    eventId: FIXTURE_EVENTS[1].id,
    isMainSchedule: true,
    eventStartDate: '2026-01-10',
    eventEndDate: '2027-12-31',
    eventStartTime: '09:00:00',
    eventEndTime: '21:00:00',
    title: 'Daily Main Program',
    performers: ['Rotating Local Communities'],
    location: 'Merdeka Square - Main Area',
    ticketPrice: 'Free',
    locationDetails: { lat: -6.1701, lng: 106.8283 },
  },
  {
    id: '50000000-0000-0000-0000-000000000003',
    slug: 'upcoming-family-workshop-main-fixed',
    eventId: FIXTURE_EVENTS[2].id,
    isMainSchedule: true,
    eventStartDate: '2027-11-15',
    eventEndDate: '2027-11-15',
    eventStartTime: '10:00:00',
    eventEndTime: '12:00:00',
    title: 'Creative Family Workshop',
    performers: ['Creative Kids Lab'],
    location: 'Bandung Community Hub - Room 2',
    ticketPrice: 'IDR 50000',
    locationDetails: { lat: -6.9147, lng: 107.6098 },
  },
  {
    id: '50000000-0000-0000-0000-000000000004',
    slug: 'upcoming-family-workshop-bonus-fixed',
    eventId: FIXTURE_EVENTS[2].id,
    isMainSchedule: false,
    eventStartDate: '2027-11-16',
    eventEndDate: '2027-11-16',
    eventStartTime: '14:00:00',
    eventEndTime: '16:00:00',
    title: 'Parents Networking Session',
    performers: ['Community Facilitator Team'],
    location: 'Bandung Community Hub - Garden Deck',
    ticketPrice: 'Free with registration',
    locationDetails: { lat: -6.9153, lng: 107.6109 },
  },
];

export const FIXTURE_COUNTS = {
  users: FIXTURE_USERS.length,
  userLocations: FIXTURE_USER_LOCATIONS.length,
  subscriptions: FIXTURE_SUBSCRIPTIONS.length,
  apiKeys: FIXTURE_API_KEYS.length,
  posts: FIXTURE_POSTS.length,
  events: FIXTURE_EVENTS.length,
  schedules: FIXTURE_SCHEDULES.length,
} as const;

export const FIXTURE_USER_IDS = FIXTURE_USERS.map((user) => user.id).sort();
export const FIXTURE_USER_LOCATION_IDS = FIXTURE_USER_LOCATIONS.map((location) => location.id).sort();
export const FIXTURE_SUBSCRIPTION_IDS = FIXTURE_SUBSCRIPTIONS.map((subscription) => subscription.id).sort();
export const FIXTURE_API_KEY_IDS = FIXTURE_API_KEYS.map((apiKey) => apiKey.id).sort();
export const FIXTURE_POST_IDS = FIXTURE_POSTS.map((post) => post.id).sort();
export const FIXTURE_EVENT_IDS = FIXTURE_EVENTS.map((event) => event.id).sort();
export const FIXTURE_SCHEDULE_IDS = FIXTURE_SCHEDULES.map((schedule) => schedule.id).sort();
export const FIXTURE_EVENT_SLUGS = FIXTURE_EVENTS.map((event) => event.slug).sort();
export const FIXTURE_SCHEDULE_SLUGS = FIXTURE_SCHEDULES.map((schedule) => schedule.slug).sort();

export function isLocalConnectionString(connectionString: string): boolean {
  try {
    const parsed = new URL(connectionString);
    const hostname = parsed.hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    // Fail closed if URL parsing fails.
    return false;
  }
}

function assertSafeSeedTarget(connectionString: string): void {
  if (process.env.ALLOW_DESTRUCTIVE_SEED === 'true' || isLocalConnectionString(connectionString)) {
    return;
  }

  throw new Error(
    'Refusing to run destructive seed against a non-local database. Set ALLOW_DESTRUCTIVE_SEED=true to override intentionally.',
  );
}

export function createSqlClient(connectionString: string) {
  const isLocal = isLocalConnectionString(connectionString);

  return postgres(connectionString, {
    max: 1,
    ssl: isLocal ? false : 'require',
  });
}

export async function seedDatabase(connectionString?: string): Promise<void> {
  const resolvedConnectionString = connectionString ?? loadDatabaseEnv(__dirname).databaseUrl;
  assertSafeSeedTarget(resolvedConnectionString);
  const sqlClient = createSqlClient(resolvedConnectionString);
  const db = drizzle(sqlClient);

  try {
    await db.transaction(async (tx) => {
      // Explicit deletion order protects FK constraints and ensures deterministic reruns.
      await tx.delete(schedules);
      await tx.delete(events);
      await tx.delete(posts);
      await tx.delete(apiKeys);
      await tx.delete(subscriptions);
      await tx.delete(userLocations);
      await tx.delete(users);

      await tx.insert(users).values([...FIXTURE_USERS]);
      await tx.insert(userLocations).values([...FIXTURE_USER_LOCATIONS]);
      await tx.insert(subscriptions).values([...FIXTURE_SUBSCRIPTIONS]);
      await tx.insert(apiKeys).values([...FIXTURE_API_KEYS]);
      await tx.insert(posts).values([...FIXTURE_POSTS]);
      await tx.insert(events).values([...FIXTURE_EVENTS]);
      await tx.insert(schedules).values([...FIXTURE_SCHEDULES]);
    });
  } finally {
    await sqlClient.end();
  }
}

if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('Seed completed successfully.');
      process.exit(0);
    })
    .catch((error: unknown) => {
      console.error('Seed failed:', error);
      process.exit(1);
    });
}
