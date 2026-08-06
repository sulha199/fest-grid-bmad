import { pgTable, uuid, text, timestamp, boolean, date, time, jsonb, doublePrecision, integer, pgEnum, index, unique } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { LocationDetails } from '@festgrid/shared-types';

const generateSlug = () => randomBytes(6).toString('hex');

// Reusable timestamp columns for future tables to ensure correct timezone handling
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
};

export const eventTypeEnum = pgEnum('event_type', [
  'EXHIBITION', 'COMPETITION', 'FESTIVAL', 'PERFORMANCE', 'WORKSHOP', 
  'SEMINAR', 'MARKET', 'GATHERING', 'PROMOTION', 'FUNDRAISER', 'CIVIC', 'OTHER'
]);

// RELIGION_AND_SPIRITUALITY: Worship services, retreats, interfaith gatherings
export const eventCategoryEnum = pgEnum('event_category', [
  'MUSIC', 'ARTS_AND_CULTURE', 'FOOD_AND_DRINK', 'SPORTS_AND_FITNESS',
  'FAMILY_AND_KIDS', 'HOBBIES_AND_INTERESTS', 'BUSINESS_AND_NETWORKING',
  'HEALTH_AND_WELLNESS', 'HOLIDAY', 'CHARITY_AND_CAUSES', 'CIVIC_AND_COMMUNITY',
  'RELIGION_AND_SPIRITUALITY', 'OTHER'
]);

export const userRoleEnum = pgEnum('user_role', ['user', 'moderator']);

export const geolocationQueryTypeEnum = pgEnum('geolocation_query_type', ['GEOCODE', 'REVERSE_GEOCODE', 'PLACE_DETAILS']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').unique().notNull(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  role: userRoleEnum('role').default('user').notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }), // Soft delete support
  ...timestamps,
});

export const userLocations = pgTable('user_locations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  // Radius in meters
  radius: integer('radius').notNull(),
  locationDetails: jsonb('location_details').$type<LocationDetails>().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }), // Soft delete support
  ...timestamps,
}, (t) => ({
  activeIdx: index('idx_user_locations_active').on(t.userId).where(sql`deleted_at IS NULL`),
}));

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  accountId: text('account_id').notNull(),
  platform: text('platform').notNull(),
  displayName: text('display_name').notNull(),
  username: text('username').notNull(),
  profileImageUrl: text('profile_image_url'),
  description: text('description'),
  lastPostDate: timestamp('last_post_date', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  ...timestamps,
});

export const geolocationCache = pgTable('geolocation_cache', {
  id: uuid('id').defaultRandom().primaryKey(),
  cacheKey: text('cache_key').unique().notNull(),
  queryType: geolocationQueryTypeEnum('query_type').notNull(),
  result: jsonb('result').notNull(),
  ...timestamps,
});

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  // Soft delete enabled: no cascade delete to preserve audit trails
  userId: uuid('user_id').references(() => users.id).notNull(),
  keyEncrypted: text('key_encrypted').notNull(),
  provider: text('provider').notNull(),
  isValid: boolean('is_valid').default(true).notNull(),
  invalidAttempts: integer('invalid_attempts').default(0).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }), // Soft delete support
  ...timestamps,
});

export const posts = pgTable('posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
  content: text('content').notNull(),
  imageUrl: text('image_url'),
  postUrl: text('post_url'),
  originalPostUrl: text('original_post_url'),
  isExtracted: boolean('is_extracted').default(false).notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
  ...timestamps,
}, (t) => ({
  subscriptionIdIdx: index('subscription_id_idx').on(t.subscriptionId),
  publishedAtIdx: index('published_at_idx').on(t.publishedAt),
}));

export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').$defaultFn(generateSlug).unique().notNull(),
  eventName: text('event_name').notNull(),
  // Drizzle doesn't perfectly support enum arrays, so we use text arrays but expect values from eventTypeEnum
  types: text('types').array(),
  // Expect values from eventCategoryEnum
  categories: text('categories').array(),
  // High-level summary of location (e.g. "Chicago, IL"). Specific coordinates are in schedules[n].locationDetails
  location: text('location').notNull(),
  // Organizer name, NOT a reference to users.id
  organizerName: text('organizer_name'),
  contactInfo: text('contact_info'),
  description: text('description'),
  confidenceScore: doublePrecision('confidence_score'),
  sourceSocialMediaAccountId: text('source_social_media_account_id'),
  postId: uuid('post_id').references(() => posts.id, { onDelete: 'set null' }),
  ...timestamps,
}, (t) => ({
  nameIdx: index('event_name_idx').on(t.eventName),
  typesIdx: index('event_types_idx').on(t.types),
  categoriesIdx: index('event_categories_idx').on(t.categories),
  locationIdx: index('event_location_idx').on(t.location),
  postIdIdx: index('event_post_id_idx').on(t.postId),
}));

export const schedules = pgTable('schedules', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').$defaultFn(generateSlug).unique().notNull(),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }).notNull(),
  isMainSchedule: boolean('is_main_schedule').default(true).notNull(),
  // Split into date and time to support incomplete extracted data from posters (where time might be missing)
  eventStartDate: date('event_start_date').notNull(),
  eventEndDate: date('event_end_date'),
  eventStartTime: time('event_start_time'),
  eventEndTime: time('event_end_time'),
  title: text('title'),
  performers: text('performers').array(),
  location: text('location'),
  // Kept as text to support free-form extracted data from posters (e.g., "$10-$20" or "Free before 9 PM")
  ticketPrice: text('ticket_price'),
  locationDetails: jsonb('location_details').$type<LocationDetails>(),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  ...timestamps,
}, (t) => ({
  performersIdx: index('schedule_performers_idx').on(t.performers),
  locationIdx: index('schedule_location_idx').on(t.location),
  coordinatesIdx: index('schedule_coordinates_idx').on(t.latitude, t.longitude),
}));

export const favorites = pgTable('favorites', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  ...timestamps,
}, (t) => ({
  unq: unique().on(t.userId, t.eventId),
  activeIdx: index('idx_favorites_active').on(t.userId).where(sql`deleted_at IS NULL`),
}));

export const calendarAdditions = pgTable('calendar_additions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }).notNull(),
  scheduleId: uuid('schedule_id').references(() => schedules.id, { onDelete: 'cascade' }).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  ...timestamps,
}, (t) => ({
  unq: unique().on(t.userId, t.scheduleId),
  activeIdx: index('idx_calendar_additions_active').on(t.userId, t.scheduleId).where(sql`deleted_at IS NULL`),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  schedules: many(schedules),
  favorites: many(favorites),
  calendarAdditions: many(calendarAdditions),
  post: one(posts, {
    fields: [events.postId],
    references: [posts.id],
  }),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  subscription: one(subscriptions, {
    fields: [posts.subscriptionId],
    references: [subscriptions.id],
  }),
  events: many(events),
}));

export const schedulesRelations = relations(schedules, ({ one, many }) => ({
  event: one(events, {
    fields: [schedules.eventId],
    references: [events.id],
  }),
  calendarAdditions: many(calendarAdditions),
}));

export const usersRelations = relations(users, ({ many }) => ({
  userLocations: many(userLocations),
  subscriptions: many(subscriptions),
  apiKeys: many(apiKeys),
  favorites: many(favorites),
  calendarAdditions: many(calendarAdditions),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, {
    fields: [favorites.userId],
    references: [users.id],
  }),
  event: one(events, {
    fields: [favorites.eventId],
    references: [events.id],
  }),
}));

export const calendarAdditionsRelations = relations(calendarAdditions, ({ one }) => ({
  user: one(users, {
    fields: [calendarAdditions.userId],
    references: [users.id],
  }),
  event: one(events, {
    fields: [calendarAdditions.eventId],
    references: [events.id],
  }),
  schedule: one(schedules, {
    fields: [calendarAdditions.scheduleId],
    references: [schedules.id],
  }),
}));

export const userLocationsRelations = relations(userLocations, ({ one }) => ({
  user: one(users, {
    fields: [userLocations.userId],
    references: [users.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
  posts: many(posts),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}));
