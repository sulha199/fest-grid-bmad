import { pgTable, uuid, text, timestamp, boolean, date, time, jsonb, doublePrecision, integer, pgEnum, index, unique, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { LocationDetails } from '@festgrid/shared-types';
import type { ProposedEventCorrection } from '@festgrid/domain/events';

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

export const defaultLocationChangeStatusEnum = pgEnum('default_location_change_status', ['PENDING_REVIEW', 'ACCEPTED', 'REVERTED']);

export const scheduleTimezoneStatusEnum = pgEnum('schedule_timezone_status', ['RESOLVED', 'NEEDS_CLARIFICATION']);

export const correctionSourceEnum = pgEnum('correction_source', ['manual', 'ai_assisted']);
export const correctionStatusEnum = pgEnum('correction_status', ['pending', 'applied', 'rejected']);
export const brightdataJobStatusEnum = pgEnum('brightdata_job_status', ['PENDING', 'COMPLETED', 'EXPIRED']);

export const brightdataPendingJobs = pgTable('brightdata_pending_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  profileId: uuid('profile_id').references(() => socialMediaAccountProfiles.id).notNull(),
  snapshotId: text('snapshot_id').notNull().unique(),
  webhookToken: text('webhook_token').notNull().unique(),
  status: brightdataJobStatusEnum('status').default('PENDING').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ...timestamps,
}, (t) => ({
  statusExpiresIdx: index('idx_brightdata_pending_jobs_status_expires').on(t.status, t.expiresAt)
}));

export const apifyJobStatusEnum = pgEnum('apify_job_status', ['PENDING', 'COMPLETED', 'EXPIRED']);

export const apifyPendingJobs = pgTable('apify_pending_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  profileId: uuid('profile_id').references(() => socialMediaAccountProfiles.id).notNull(),
  runId: text('run_id').notNull().unique(),
  webhookToken: text('webhook_token').notNull().unique(),
  status: apifyJobStatusEnum('status').default('PENDING').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ...timestamps,
}, (t) => ({
  statusExpiresIdx: index('idx_apify_pending_jobs_status_expires').on(t.status, t.expiresAt)
}));

export const reportReasonEnum = pgEnum('report_reason', ['cancelled', 'dangerous', 'personal']);
export const reportStatusEnum = pgEnum('report_status', ['pending', 'upheld', 'dismissed']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').unique().notNull(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  role: userRoleEnum('role').default('user').notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }), // Soft delete support
  timezone: text('timezone'),
  lastQuotaWarningEmailSentAt: timestamp('last_quota_warning_email_sent_at', { withTimezone: true }),
  ...timestamps,
});

export const userSettings = pgTable('user_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).unique().notNull(),
  hidePastEventsAfterDays: integer('hide_past_events_after_days').default(7).notNull(),
  pushNotificationsEnabled: boolean('push_notifications_enabled').default(true).notNull(),
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

export const socialMediaAccountProfiles = pgTable('social_media_account_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: text('account_id').notNull(),
  platform: text('platform').notNull(),
  username: text('username').notNull(),
  displayName: text('display_name').notNull(),
  profileImageUrl: text('profile_image_url'),
  description: text('description'),
  lastPostDate: timestamp('last_post_date', { withTimezone: true }),
  lastScrapedAt: timestamp('last_scraped_at', { withTimezone: true }),
  defaultLocation: jsonb('default_location').$type<LocationDetails>(),
  ...timestamps,
}, (t) => ({
  platformAccountIdUnq: unique().on(t.platform, t.accountId),
}));

export const scraperProviderUsage = pgTable('scraper_provider_usage', {
  id: uuid('id').defaultRandom().primaryKey(),
  provider: text('provider').notNull().unique(),
  itemsUsedThisCycle: integer('items_used_this_cycle').default(0).notNull(),
  usageCycleResetAt: timestamp('usage_cycle_reset_at', { withTimezone: true }).defaultNow().notNull(),
  ...timestamps,
});

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  accountId: uuid('account_id').references(() => socialMediaAccountProfiles.id).notNull(),
  isNewlyAdded: boolean('is_newly_added').default(true).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  ...timestamps,
}, (t) => ({
  activeIdx: index('idx_subscriptions_active').on(t.userId).where(sql`deleted_at IS NULL`),
}));

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
  keyLast4: text('key_last4').notNull(),
  provider: text('provider').notNull(),
  isValid: boolean('is_valid').default(true).notNull(),
  invalidAttempts: integer('invalid_attempts').default(0).notNull(),
  usageCount: integer('usage_count').default(0).notNull(),
  usageCycleResetAt: timestamp('usage_cycle_reset_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }), // Soft delete support
  ...timestamps,
}, (t) => ({
  activeIdx: index('idx_api_keys_active').on(t.userId).where(sql`deleted_at IS NULL`),
}));

export const posts = pgTable('posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').references(() => socialMediaAccountProfiles.id).notNull(),
  platform: text('platform').notNull(),
  content: text('content').notNull(),
  imageUrl: text('image_url'),
  postUrl: text('post_url').notNull(),
  originalPostUrl: text('original_post_url'),
  isExtracted: boolean('is_extracted').default(false).notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
  ...timestamps,
}, (t) => ({
  accountIdIdx: index('account_id_idx').on(t.accountId),
  publishedAtIdx: index('published_at_idx').on(t.publishedAt),
  postUrlUnq: unique().on(t.postUrl),
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
  deletedAt: timestamp('deleted_at', { withTimezone: true }), // Soft delete support
  ...timestamps,
}, (t) => ({
  nameIdx: index('event_name_idx').on(t.eventName).where(sql`deleted_at IS NULL`),
  typesIdx: index('event_types_idx').on(t.types).where(sql`deleted_at IS NULL`),
  categoriesIdx: index('event_categories_idx').on(t.categories).where(sql`deleted_at IS NULL`),
  locationIdx: index('event_location_idx').on(t.location).where(sql`deleted_at IS NULL`),
  postIdIdx: index('event_post_id_idx').on(t.postId).where(sql`deleted_at IS NULL`),
  // postIdUnq stays a full, unconditional uniqueness constraint deliberately for data integrity
  postIdUnq: unique().on(t.postId),
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
  timezone: text('timezone'),
  timezoneStatus: scheduleTimezoneStatusEnum('timezone_status'),
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
  accountProfile: one(socialMediaAccountProfiles, {
    fields: [posts.accountId],
    references: [socialMediaAccountProfiles.id],
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

export const usersRelations = relations(users, ({ one, many }) => ({
  userLocations: many(userLocations),
  subscriptions: many(subscriptions),
  apiKeys: many(apiKeys),
  favorites: many(favorites),
  calendarAdditions: many(calendarAdditions),
  userSettings: one(userSettings, { fields: [users.id], references: [userSettings.userId] }),
  fcmTokens: many(fcmTokens),
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

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.id],
  }),
}));

export const socialMediaAccountProfilesRelations = relations(socialMediaAccountProfiles, ({ many }) => ({
  subscriptions: many(subscriptions),
  posts: many(posts),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
  accountProfile: one(socialMediaAccountProfiles, {
    fields: [subscriptions.accountId],
    references: [socialMediaAccountProfiles.id],
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}));

export const fcmTokens = pgTable('fcm_tokens', {
  token: text('token').primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  ...timestamps,
}, (t) => ({
  userIdIdx: index('idx_fcm_tokens_user_id').on(t.userId),
}));

export const fcmTokensRelations = relations(fcmTokens, ({ one }) => ({
  user: one(users, {
    fields: [fcmTokens.userId],
    references: [users.id],
  }),
}));

export const defaultLocationChangeRequests = pgTable('default_location_change_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').references(() => socialMediaAccountProfiles.id).notNull(),
  changedByUserId: uuid('changed_by_user_id').references(() => users.id).notNull(),
  previousLocation: jsonb('previous_location').$type<LocationDetails>(),
  newLocation: jsonb('new_location').$type<LocationDetails>().notNull(),
  status: defaultLocationChangeStatusEnum('status').default('PENDING_REVIEW').notNull(),
  reviewedByModeratorId: uuid('reviewed_by_moderator_id').references(() => users.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  accountStatusIdx: index('idx_default_location_change_requests_account_status').on(t.accountId, t.status),
}));

export const defaultLocationChangeRequestsRelations = relations(defaultLocationChangeRequests, ({ one }) => ({
  accountProfile: one(socialMediaAccountProfiles, {
    fields: [defaultLocationChangeRequests.accountId],
    references: [socialMediaAccountProfiles.id],
  }),
  changedByUser: one(users, {
    fields: [defaultLocationChangeRequests.changedByUserId],
    references: [users.id],
  }),
  reviewedByModerator: one(users, {
    fields: [defaultLocationChangeRequests.reviewedByModeratorId],
    references: [users.id],
  }),
}));

export const corrections = pgTable('corrections', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }).notNull(),
  submittedByUserId: uuid('submitted_by_user_id').references(() => users.id).notNull(),
  proposedData: jsonb('proposed_data').$type<ProposedEventCorrection>().notNull(),
  source: correctionSourceEnum('source').notNull(),
  status: correctionStatusEnum('status').default('pending').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
}, (t) => ({
  eventIdIdx: index('idx_corrections_event_id').on(t.eventId),
}));

export const correctionsRelations = relations(corrections, ({ one }) => ({
  event: one(events, {
    fields: [corrections.eventId],
    references: [events.id],
  }),
  submittedByUser: one(users, {
    fields: [corrections.submittedByUserId],
    references: [users.id],
  }),
}));

export const reports = pgTable('reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }).notNull(),
  reporterUserId: uuid('reporter_user_id').references(() => users.id).notNull(),
  reason: reportReasonEnum('reason').notNull(),
  details: text('details'),
  status: reportStatusEnum('status').default('pending').notNull(),
  moderatorIgnored: boolean('moderator_ignored').default(false).notNull(),
  resolvedByModeratorId: uuid('resolved_by_moderator_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
}, (t) => ({
  reportsEventIdx: index('idx_reports_event_id').on(t.eventId),
  reportsEventReasonIdx: index('idx_reports_event_reason').on(t.eventId, t.reason),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  event: one(events, {
    fields: [reports.eventId],
    references: [events.id],
  }),
  reporterUser: one(users, {
    fields: [reports.reporterUserId],
    references: [users.id],
  }),
  resolvedByModerator: one(users, {
    fields: [reports.resolvedByModeratorId],
    references: [users.id],
  }),
}));

export const accountVotes = pgTable('account_votes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  accountId: uuid('account_id').references(() => socialMediaAccountProfiles.id).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  userAccountUniqueIdx: uniqueIndex('idx_account_votes_user_account').on(t.userId, t.accountId),
  activeUserVotesIdx: index('idx_account_votes_active_user').on(t.userId).where(sql`deleted_at IS NULL`),
  activeAccountVotesIdx: index('idx_account_votes_active_account').on(t.accountId).where(sql`deleted_at IS NULL`),
}));

export const accountVotesRelations = relations(accountVotes, ({ one }) => ({
  user: one(users, {
    fields: [accountVotes.userId],
    references: [users.id],
  }),
  accountProfile: one(socialMediaAccountProfiles, {
    fields: [accountVotes.accountId],
    references: [socialMediaAccountProfiles.id],
  }),
}));

export const widgetDisplayModeEnum = pgEnum('widget_display_mode', ['CARD', 'CALENDAR']);
export const widgetThemeEnum = pgEnum('widget_theme', ['DARK', 'LIGHT']);

export const widgets = pgTable('widgets', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerUserId: uuid('owner_user_id').references(() => users.id).notNull(),
  filters: jsonb('filters').notNull(),
  displayMode: widgetDisplayModeEnum('display_mode').default('CARD').notNull(),
  theme: widgetThemeEnum('theme').default('LIGHT').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  activeIdx: index('idx_widgets_active').on(t.ownerUserId).where(sql`deleted_at IS NULL`),
}));

export const widgetsRelations = relations(widgets, ({ one }) => ({
  owner: one(users, {
    fields: [widgets.ownerUserId],
    references: [users.id],
  }),
}));

export const embedDomains = pgTable('embed_domains', {
  id: uuid('id').defaultRandom().primaryKey(),
  widgetId: uuid('widget_id').references(() => widgets.id).notNull(),
  pattern: text('pattern').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  activeIdx: index('idx_embed_domains_active').on(t.widgetId).where(sql`deleted_at IS NULL`),
  patternUnqIdx: uniqueIndex('idx_embed_domains_pattern_widget').on(t.widgetId, t.pattern),
}));

export const embedDomainsRelations = relations(embedDomains, ({ one }) => ({
  widget: one(widgets, {
    fields: [embedDomains.widgetId],
    references: [widgets.id],
  }),
}));

export const unprocessedScraperPayloads = pgTable('unprocessed_scraper_payloads', {
  id: uuid('id').defaultRandom().primaryKey(),
  rawPayload: jsonb('raw_payload').notNull(),
  validationError: jsonb('validation_error').notNull(),
  context: jsonb('context').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  idxCreatedDesc: index('idx_unprocessed_payloads_created_desc')
    .on(t.createdAt)
    .desc()
    .where(sql`deleted_at IS NULL`),
  idxSourceGin: index('idx_unprocessed_payloads_source')
    .on(t.context)
    .where(sql`deleted_at IS NULL`),
  idxCleanup: index('idx_unprocessed_payloads_cleanup')
    .on(t.createdAt)
    .where(sql`deleted_at IS NULL`),
}));

export const parserVersionRegistry = pgTable('parser_version_registry', {
  id: uuid('id').defaultRandom().primaryKey(),
  version: text('version').notNull().unique(),
  description: text('description'),
  sourceFile: text('source_file'),
  deployedAt: timestamp('deployed_at', { withTimezone: true }).defaultNow().notNull(),
  isActive: boolean('is_active').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  idxVersion: uniqueIndex('idx_parser_versions_version').on(t.version),
  idxActive: index('idx_parser_versions_active').on(t.isActive, t.version),
}));
