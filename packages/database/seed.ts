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
  socialMediaAccountProfiles,
  reports,
  accountVotes,
  widgets,
  embedDomains,
  defaultLocationChangeRequests,
  corrections,
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
    locationDetails: {
      coordinates: { latitude: -6.2088, longitude: 106.8456 },
      formattedAddress: 'Jakarta, Indonesia',
      placeName: 'Jakarta',
      provider: 'GEOAPIFY' as const
    },
  },
  {
    id: '10000000-0000-0000-0000-000000000002',
    userId: FIXTURE_USERS[1].id,
    name: 'Work Bandung',
    latitude: -6.9175,
    longitude: 107.6191,
    radius: 8000,
    locationDetails: {
      coordinates: { latitude: -6.9175, longitude: 107.6191 },
      formattedAddress: 'Bandung, West Java, Indonesia',
      placeName: 'Bandung',
      provider: 'GEOAPIFY' as const
    },
  },
];

const FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILES = [
  {
    id: '70000000-0000-0000-0000-000000000001',
    accountId: 'ig_jkt_events',
    platform: 'instagram',
    displayName: 'Jakarta City Events',
    username: 'jktcity.events',
    profileImageUrl: 'https://images.example.com/profiles/jktcity-events.png',
    description: 'Curated arts and music events around Jakarta.',
  },
  {
    id: '70000000-0000-0000-0000-000000000002',
    accountId: 'ig_bdg_family',
    platform: 'instagram',
    displayName: 'Bandung Family Weekend',
    username: 'bdg.family.weekend',
    profileImageUrl: 'https://images.example.com/profiles/bdg-family-weekend.png',
    description: 'Family-friendly community activities and workshops.',
  },
];

const FIXTURE_SUBSCRIPTIONS = [
  {
    id: '20000000-0000-0000-0000-000000000001',
    userId: FIXTURE_USERS[0].id,
    accountId: FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILES[0].id,
    isNewlyAdded: true,
  },
  {
    id: '20000000-0000-0000-0000-000000000002',
    userId: FIXTURE_USERS[1].id,
    accountId: FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILES[1].id,
    isNewlyAdded: true,
  },
];

const FIXTURE_API_KEYS = [
  {
    id: '30000000-0000-0000-0000-000000000001',
    userId: FIXTURE_USERS[0].id,
    keyEncrypted: 'enc:key:alice:gemini:v1',
    keyLast4: 'key1',
    provider: 'gemini',
    isValid: true,
    invalidAttempts: 0,
  },
  {
    id: '30000000-0000-0000-0000-000000000002',
    userId: FIXTURE_USERS[1].id,
    keyEncrypted: 'enc:key:bob:gemini:v1',
    keyLast4: 'key2',
    provider: 'gemini',
    isValid: true,
    invalidAttempts: 0,
  },
];

export const FIXTURE_POSTS = [
  {
    id: '60000000-0000-0000-0000-000000000001',
    accountId: FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILES[0].id,
    postUrl: 'https://instagram.com/jktcity.events/p/C1PASTJAZZ',
    imageUrl: 'https://media.storiesig.info/get?__sig=gMaHPAeSedQwJs90ezjNqg&__expires=1786891296&uri=https%3A%2F%2Fscontent-iad3-2.cdninstagram.com%2Fv%2Ft51.82787-15%2F764373463_18547291300074731_6625151285942470618_n.jpg%3Fstp%3Ddst-jpg_e35_p640x640_sh2.08_tt6%26efg%3DeyJ2ZW5jb2RlX3RhZyI6ImltYWdlX3VybGdlbi4xMDgwLnNkci5yZWd1bGFyX3Bob3RvLmMyIn0%26_nc_ht%3Dscontent-iad3-2.cdninstagram.com%26_nc_cat%3D111%26_nc_oc%3DQ6cZ2gG71lr_0Zb9-3GQQMgXrgOfqprj1bN72lJjL9t8PV5TDeQlJpiFr0US1QmP8hxSHDu3xKzssWbppMxGXy8HVq3J%26_nc_ohc%3D7ImEO91qAUEQ7kNvwHa-x-l%26_nc_gid%3D495il2AOsdCk-Cv_ZgGa5A%26edm%3DAPU89FABAAAA%26ccb%3D7-5%26oh%3D00_AQGD7e1pO4B_AdvRx3t2xbOzv_IZVBCq4GLAhDrxkr5FTA%26oe%3D6A87AFB2%26_nc_sid%3Dbc0c2c&filename=764373463_18547291300074731_6625151285942470618_n.jpg',
    isExtracted: true,
    publishedAt: new Date('2025-01-20T10:00:00Z'),
    content: 'Get ready for an amazing Past Jazz Night 2025! #jazz #jakarta',
  },
  {
    id: '60000000-0000-0000-0000-000000000002',
    accountId: FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILES[0].id,
    postUrl: 'https://instagram.com/jktcity.events/p/C2ONGOING',
    imageUrl: 'https://instagram.fjog3-1.fna.fbcdn.net/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=bzLIjr247pcQ7kNvwE4A2bO&_nc_oc=AdoTUcJcRmj4kpDJwODS3wtkdhw8hgCgn8aG0xKcgZTX_7R9RkTy8dfc3UzcaiOeeeY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fjog3-1.fna&_nc_gid=3iRx6urxFBGuqtGdl6KjAA&_nc_ss=7a22e&oh=00_AQH5aWDuo6ILXcschT7sh9HpWw31kksQvdvzCg0yNvmURA&oe=6A87B9A9',
    isExtracted: true,
    publishedAt: new Date('2025-12-10T10:00:00Z'),
    content: 'The Ongoing Culture Fest 2026-2027 is finally here. #culture #festival',
  },
  {
    id: '60000000-0000-0000-0000-000000000003',
    accountId: FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILES[1].id,
    postUrl: 'https://instagram.com/bdg.family.weekend/p/C3UPCOMING',
    imageUrl: 'https://instagram.fjog3-1.fna.fbcdn.net/v/t51.82787-15/775824879_18550742479074731_9080506194245506423_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=105&ig_cache_key=Mzk2NTA0ODUyNzEyMjE5NzUyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=dRV9sXct_V8Q7kNvwGKs8ZF&_nc_oc=AdqyrS2eqF60hKXWuYfXt8wV762DunR3AzHxB_5Or8Osu-n2gABO0JmTSRHLiAWDn3k&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fjog3-1.fna&_nc_gid=3iRx6urxFBGuqtGdl6KjAA&_nc_ss=7a22e&oh=00_AQFTjCzqMHUxZfR3Gu6AwtcTYyZtuBIkkLOKznAw7hEsLA&oe=6A87BF28',
    isExtracted: true,
    publishedAt: new Date('2027-10-15T10:00:00Z'),
    content: 'Join us at the Upcoming Family Workshop 2027! Fun for all ages. #family #bandung',
  },
  {
    id: '60000000-0000-0000-0000-000000000004',
    accountId: FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILES[0].id,
    postUrl: 'https://instagram.com/jktcity.events/p/C4CANCELLATION',
    imageUrl: 'https://images.example.com/events/cancellation-threshold-test.jpg',
    isExtracted: true,
    publishedAt: new Date('2027-11-01T10:00:00Z'),
    content: 'Cancellation test post content. #cancellation',
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
    sourceSocialMediaAccountId: FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILES[0].accountId,
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
    sourceSocialMediaAccountId: FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILES[0].accountId,
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
    sourceSocialMediaAccountId: FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILES[1].accountId,
    postId: FIXTURE_POSTS[2].id,
  },
  {
    id: '40000000-0000-0000-0000-000000000004',
    slug: 'cancellation-threshold-test-fixed',
    eventName: 'Cancellation Threshold Test Event',
    types: ['PERFORMANCE'],
    categories: ['MUSIC'],
    location: 'Cancellation Arena',
    organizerName: 'Nusantara Sound Collective',
    contactInfo: 'https://instagram.com/jktcity.events/p/C4CANCELLATION',
    confidenceScore: 0.99,
    sourceSocialMediaAccountId: FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILES[0].accountId,
    postId: '60000000-0000-0000-0000-000000000004',
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
    locationDetails: { coordinates: { latitude: -6.2615, longitude: 106.8106 } },
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
    locationDetails: { coordinates: { latitude: -6.1701, longitude: 106.8283 } },
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
    locationDetails: { coordinates: { latitude: -6.9147, longitude: 107.6098 } },
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
    locationDetails: { coordinates: { latitude: -6.9153, longitude: 107.6109 } },
  },
  {
    id: '50000000-0000-0000-0000-000000000005',
    slug: 'cancellation-threshold-test-main-fixed',
    eventId: '40000000-0000-0000-0000-000000000004',
    isMainSchedule: true,
    eventStartDate: '2027-11-20',
    eventEndDate: '2027-11-20',
    eventStartTime: '18:00:00',
    eventEndTime: '20:00:00',
    title: 'Cancellation Main Session',
    performers: ['Cancellation Performers'],
    location: 'Cancellation Arena - Main Area',
    ticketPrice: 'Free',
    locationDetails: { coordinates: { latitude: -6.1701, longitude: 106.8283 } },
  },
];

const FIXTURE_REPORTS = [
  {
    id: '80000000-0000-0000-0000-000000000001',
    eventId: '40000000-0000-0000-0000-000000000004',
    reporterUserId: FIXTURE_USERS[0].id,
    reason: 'cancelled' as const,
    details: 'Widely reported as cancelled',
    status: 'pending' as const,
  },
  {
    id: '80000000-0000-0000-0000-000000000002',
    eventId: '40000000-0000-0000-0000-000000000004',
    reporterUserId: FIXTURE_USERS[1].id,
    reason: 'cancelled' as const,
    details: 'Cancelled by organizer',
    status: 'pending' as const,
  },
];

export const FIXTURE_COUNTS = {
  users: FIXTURE_USERS.length,
  userLocations: FIXTURE_USER_LOCATIONS.length,
  socialMediaAccountProfiles: FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILES.length,
  subscriptions: FIXTURE_SUBSCRIPTIONS.length,
  apiKeys: FIXTURE_API_KEYS.length,
  posts: FIXTURE_POSTS.length,
  events: FIXTURE_EVENTS.length,
  schedules: FIXTURE_SCHEDULES.length,
  reports: FIXTURE_REPORTS.length,
} as const;

export const FIXTURE_USER_IDS = FIXTURE_USERS.map((user) => user.id).sort();
export const FIXTURE_USER_LOCATION_IDS = FIXTURE_USER_LOCATIONS.map((location) => location.id).sort();
export const FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILE_IDS = FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILES.map((profile) => profile.id).sort();
export const FIXTURE_SUBSCRIPTION_IDS = FIXTURE_SUBSCRIPTIONS.map((subscription) => subscription.id).sort();
export const FIXTURE_API_KEY_IDS = FIXTURE_API_KEYS.map((apiKey) => apiKey.id).sort();
export const FIXTURE_POST_IDS = FIXTURE_POSTS.map((post) => post.id).sort();
export const FIXTURE_EVENT_IDS = FIXTURE_EVENTS.map((event) => event.id).sort();
export const FIXTURE_SCHEDULE_IDS = FIXTURE_SCHEDULES.map((schedule) => schedule.id).sort();
export const FIXTURE_EVENT_SLUGS = FIXTURE_EVENTS.map((event) => event.slug).sort();
export const FIXTURE_SCHEDULE_SLUGS = FIXTURE_SCHEDULES.map((schedule) => schedule.slug).sort();
export const FIXTURE_REPORT_IDS = FIXTURE_REPORTS.map((report) => report.id).sort();

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
      // These five have no ON DELETE CASCADE back to users/events/socialMediaAccountProfiles
      // (unlike favorites/calendarAdditions/fcmTokens, which do and so need no explicit
      // cleanup here), so they must be cleared before their referenced rows or the delete
      // below fails with a foreign-key-constraint violation.
      await tx.delete(embedDomains);
      await tx.delete(widgets);
      await tx.delete(accountVotes);
      await tx.delete(corrections);
      await tx.delete(defaultLocationChangeRequests);
      await tx.delete(reports);
      await tx.delete(schedules);
      await tx.delete(events);
      await tx.delete(posts);
      await tx.delete(apiKeys);
      await tx.delete(subscriptions);
      await tx.delete(socialMediaAccountProfiles);
      await tx.delete(userLocations);
      await tx.delete(users);

      await tx.insert(users).values([...FIXTURE_USERS]);
      await tx.insert(userLocations).values([...FIXTURE_USER_LOCATIONS]);
      await tx.insert(socialMediaAccountProfiles).values([...FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILES]);
      await tx.insert(subscriptions).values([...FIXTURE_SUBSCRIPTIONS]);
      await tx.insert(apiKeys).values([...FIXTURE_API_KEYS]);
      await tx.insert(posts).values([...FIXTURE_POSTS]);
      await tx.insert(events).values([...FIXTURE_EVENTS]);
      await tx.insert(schedules).values([...FIXTURE_SCHEDULES]);
      await tx.insert(reports).values([...FIXTURE_REPORTS]);
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
