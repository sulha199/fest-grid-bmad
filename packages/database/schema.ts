import { pgTable, uuid, text, timestamp, boolean, date, time, jsonb, doublePrecision, integer, smallint, pgEnum, index, unique, uniqueIndex, primaryKey, customType as drizzleCustomType, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { LocationDetails, EventLink } from '@festgrid/shared-types';
import type { ProposedEventCorrection } from '@festgrid/domain/events';
import type { ExtractionAuditEventCompleteness } from '@festgrid/domain/events';
import { POST_ACCOUNT_ROLES } from '@festgrid/domain/posts';
import { EVENT_DETAIL_LEVELS } from '@festgrid/domain/events';
import { POST_GROUPING_REASONS, AI_IMAGE_INPUT_VALUES } from '@festgrid/domain/posts';

const generateSlug = () => randomBytes(6).toString('hex');

// Reusable custom jsonb type to avoid double-encoding issues with postgres.js prepare: false
export const customJsonb = <TData>(name: string) =>
  drizzleCustomType<{ data: TData; driverData: unknown }>({
    dataType() {
      return 'jsonb';
    },
    toDriver(val: TData): unknown {
      // Pass raw object instead of stringifying, because postgres.js handles the jsonb formatting
      return val;
    },
    fromDriver(val: unknown): TData {
      // If reading old double-encoded legacy data, it comes back as a string, parse it.
      if (typeof val === 'string') {
        try {
          return JSON.parse(val) as TData;
        } catch {
          return val as TData;
        }
      }
      return val as TData;
    },
  })(name);

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
// TECHNOLOGY: Tech product promos, hackathons, tech meetups/conferences
// TRAVEL_AND_TOURISM: Travel gear promos, travel fairs, tourism expos
// EDUCATION: Academic olympiads/competitions, school contests
// CAREER: Job fairs, career workshops
// AUTOMOTIVE: Car and motorcycle fairs, exhibitions
export const eventCategoryEnum = pgEnum('event_category', [
  'MUSIC', 'ARTS_AND_CULTURE', 'FOOD_AND_DRINK', 'SPORTS_AND_FITNESS',
  'FAMILY_AND_KIDS', 'HOBBIES_AND_INTERESTS', 'BUSINESS_AND_NETWORKING',
  'HEALTH_AND_WELLNESS', 'HOLIDAY', 'CHARITY_AND_CAUSES', 'CIVIC_AND_COMMUNITY',
  'RELIGION_AND_SPIRITUALITY', 'TECHNOLOGY', 'TRAVEL_AND_TOURISM', 'EDUCATION',
  'CAREER', 'AUTOMOTIVE', 'OTHER'
]);

export const userRoleEnum = pgEnum('user_role', ['user', 'moderator']);

export const geolocationQueryTypeEnum = pgEnum('geolocation_query_type', ['GEOCODE', 'REVERSE_GEOCODE', 'PLACE_DETAILS']);

export const instagramOembedStatusEnum = pgEnum('instagram_oembed_status', ['AVAILABLE', 'UNAVAILABLE']);

// AWAITING_APPROVAL and REJECTED added 2026-08-28 (confidence-gated moderation, see AWAITING_APPROVAL doc comment on the table below)
export const defaultLocationChangeStatusEnum = pgEnum('default_location_change_status', ['AWAITING_APPROVAL', 'PENDING_REVIEW', 'ACCEPTED', 'REJECTED', 'REVERTED', 'SUPERSEDED']);

export const defaultLocationChangeSourceEnum = pgEnum('default_location_change_source', ['USER', 'AI_INFERENCE', 'MODERATOR']);

export const scheduleTimezoneStatusEnum = pgEnum('schedule_timezone_status', ['RESOLVED', 'NEEDS_CLARIFICATION']);

export const correctionSourceEnum = pgEnum('correction_source', ['manual', 'ai_assisted']);
// 'awaiting_verification' added 2026-09-07 (Story 3.6k): a UGC correction whose
// free-text fields matched the children's-data keyword filter -- non-performer
// data was applied immediately, but performer names were suppressed pending
// guardian verification (Tier 2, not yet built). Distinct from 'pending' because
// submitCorrection never actually writes 'pending' today; overloading it would
// conflate "not yet processed" with "held specifically for guardian-verification
// reasons" (see Story 4.3a's 'auto_resolved' for the same new-value-over-reuse precedent).
export const correctionStatusEnum = pgEnum('correction_status', ['pending', 'applied', 'rejected', 'awaiting_verification']);
export const brightdataJobStatusEnum = pgEnum('brightdata_job_status', ['PENDING', 'COMPLETED', 'EXPIRED']);

export const scraperRunVendorEnum = pgEnum('scraper_run_vendor', ['APIFY', 'BRIGHTDATA']);
export const scraperRunTriggerModeEnum = pgEnum('scraper_run_trigger_mode', ['SYNC', 'ASYNC']);

export const parserVersionSourceEnum = pgEnum('parser_version_source', ['APIFY', 'BRIGHTDATA', 'GEMINI']);
export const scraperRunStatusEnum = pgEnum('scraper_run_status', ['PENDING', 'SUCCEEDED', 'FAILED', 'TIMED_OUT', 'ABORTED']);

export const imageStorageOptInSourceEnum = pgEnum('image_storage_opt_in_source', ['MODERATOR', 'ACCOUNT_OWNER']);

export const accountTypeEnum = pgEnum('account_type', ['ORGANIZER_VENUE_EVENT', 'PERSONAL', 'CURATOR_GUIDE']);
export const accountTypeStatusEnum = pgEnum('account_type_status', ['CONFIRMED', 'AWAITING_APPROVAL']);

export const postAccountRoleEnum = pgEnum('post_account_role', POST_ACCOUNT_ROLES);

// Story 3.6r / AD-30 Rule 1.
export const eventDetailLevelEnum = pgEnum('event_detail_level', EVENT_DETAIL_LEVELS);
export const postGroupingReasonEnum = pgEnum('post_grouping_reason', POST_GROUPING_REASONS);

export const brightdataPendingJobs = pgTable('brightdata_pending_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  profileId: uuid('profile_id').references(() => socialMediaAccountProfiles.id, { onDelete: 'cascade' }).notNull(),
  snapshotId: text('snapshot_id').notNull().unique(),
  webhookToken: text('webhook_token').notNull().unique(),
  status: brightdataJobStatusEnum('status').default('PENDING').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  scraperActorRunId: uuid('scraper_actor_run_id').references(() => scraperActorRuns.id),
  ...timestamps,
}, (t) => ({
  statusExpiresIdx: index('idx_brightdata_pending_jobs_status_expires').on(t.status, t.expiresAt)
}));

export const apifyJobStatusEnum = pgEnum('apify_job_status', ['PENDING', 'COMPLETED', 'EXPIRED']);

export const apifyPendingJobs = pgTable('apify_pending_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  profileId: uuid('profile_id').references(() => socialMediaAccountProfiles.id, { onDelete: 'cascade' }).notNull(),
  runId: text('run_id').notNull().unique(),
  webhookToken: text('webhook_token').notNull().unique(),
  status: apifyJobStatusEnum('status').default('PENDING').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  scraperActorRunId: uuid('scraper_actor_run_id').references(() => scraperActorRuns.id),
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
  // Default changed 7 -> 0 (2026-09-14): hide a past event as soon as it ends, no grace
  // window, matching DEFAULT_HIDE_PAST_EVENTS_AFTER_DAYS in
  // packages/domain/src/events/buildDefaultEventVisibilityConditions.ts — keep the two in
  // sync. See migration 0056 for the matching backfill of existing untouched-default rows.
  hidePastEventsAfterDays: integer('hide_past_events_after_days').default(0).notNull(),
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
  scrapeTriggeredAt: timestamp('scrape_triggered_at', { withTimezone: true }),
  defaultLocation: jsonb('default_location').$type<LocationDetails>(),
  accountType: accountTypeEnum('account_type'),
  accountTypeStatus: accountTypeStatusEnum('account_type_status'),
  accountTypeConfidenceScore: doublePrecision('account_type_confidence_score'),
  isImageStorageOptedIn: boolean('is_image_storage_opted_in').default(false).notNull(),
  imageStorageOptInSource: imageStorageOptInSourceEnum('image_storage_opt_in_source'),
  firstSeen: timestamp('first_seen', { withTimezone: true }),
  lastSeen: timestamp('last_seen', { withTimezone: true }),
  discoverySource: jsonb('discovery_source').$type<{ vendor: string; runId?: string }>(),
  isVerifiedForDiscovery: boolean('is_verified_for_discovery').default(true).notNull(),
  // Story 3.16 -- atomic, TTL-bounded claim marking "a classify-then-maybe-trigger-scrape
  // attempt is currently in flight for this account." Null means unclaimed. Mirrors
  // posts.queuedForExtractionAt (Story 3.6z) exactly: set to now() on a successful claim,
  // reclaimable after a TTL so a crashed/timed-out attempt doesn't permanently strand the
  // account -- see claim-ttl.ts and subscribe-to-account.ts for the full design. No default,
  // no backfill -- every existing row is correctly null/unclaimed. No index: every read/write
  // is scoped by socialMediaAccountProfiles.id (primary key).
  classificationClaimedAt: timestamp('classification_claimed_at', { withTimezone: true }),
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

// Tracks per-provider trigger health (consecutive full-failure days + alert cooldown) --
// a distinct concern from scraperProviderUsage's cost/item-volume tracking above
// (Story 3.4q).
export const scraperProviderHealth = pgTable('scraper_provider_health', {
  id: uuid('id').defaultRandom().primaryKey(),
  provider: text('provider').notNull().unique(),
  consecutiveFailureDays: integer('consecutive_failure_days').default(0).notNull(),
  lastFailureReason: text('last_failure_reason'),
  lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
  lastAlertSentAt: timestamp('last_alert_sent_at', { withTimezone: true }),
  ...timestamps,
});

// One row per EventBridge daily batch-scrape invocation (IDEA-013) -- an append-only
// per-cycle audit record so we can tell 'the cron fired and found 0 targets' apart from
// 'the cron never fired'. The EventBridge branch of apps/backend/src/lambdas/scraper.ts
// inserts a row at the start of a batch and completes it at the end (startedAt -> a
// completion row records targetsFound plus how many dispatches succeeded/failed), in the
// same additive-observability shape as scraperProviderHealth's recordProviderHealthCheck.
// Purely observability -- no reads/writes elsewhere -- so it is deliberately NOT a
// soft-delete table (AD-8 exempts append-only log/audit tables like this one).
export const scraperBatchRuns = pgTable('scraper_batch_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  targetsFound: integer('targets_found').default(0).notNull(),
  dispatchedSucceeded: integer('dispatched_succeeded').default(0).notNull(),
  dispatchedFailed: integer('dispatched_failed').default(0).notNull(),
  ...timestamps,
}, (t) => ({
  startedAtIdx: index('idx_scraper_batch_runs_started_at').on(t.startedAt),
}));

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

// Bounded-TTL cache for Instagram's tokenless oEmbed endpoint (Story 3.7e). Both AVAILABLE and
// UNAVAILABLE results are cached (an UNAVAILABLE result, e.g. a deleted post, is just as reusable
// within the TTL window as an AVAILABLE one) -- see apps/backend/src/lib/instagram-oembed/adapter.ts.
export const instagramOembedCache = pgTable('instagram_oembed_cache', {
  id: uuid('id').defaultRandom().primaryKey(),
  postUrl: text('post_url').unique().notNull(),
  status: instagramOembedStatusEnum('status').notNull(),
  html: text('html'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ...timestamps,
}, (t) => ({
  expiresAtIdx: index('idx_instagram_oembed_cache_expires_at').on(t.expiresAt),
}));

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
  content: text('content'),
  imageUrl: text('image_url'),
  videoUrl: text('video_url'),
  postUrl: text('post_url').notNull(),
  originalPostUrl: text('original_post_url'),
  // Platform-native post id and real permalink type ('p', 'reel', 'reels', ...), captured once at
  // scrape-time from postUrl/originalPostUrl (insert only, no backfill -- AD-16 Rule 2). Powers Story
  // 3.7g's event slug construction and Story 3.7h's DB-free oEmbed lookup. Null when unparseable.
  platformPostId: text('platform_post_id'),
  platformPostType: text('platform_post_type'),
  isExtracted: boolean('is_extracted').default(false).notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
  scraperActorRunId: uuid('scraper_actor_run_id').references(() => scraperActorRuns.id),
  locationName: text('location_name'),
  ownerDisplayName: text('owner_display_name'),
  ownerUsername: text('owner_username'),
  durableImageUrl: text('durable_image_url'),
  imageUrlExpiresAt: timestamp('image_url_expires_at', { withTimezone: true }),
  // Story 3.6n / AD-28 -- face-blurred, consent-INDEPENDENT durable thumbnail. Populated for
  // opted-in and non-opted-in accounts alike (unlike durableImageUrl above, which stays
  // opted-in-only, unblurred, full-resolution and is completely unchanged by this column).
  // No index: nothing queries this column directly, only ever read via the events->posts join
  // Story 3.6n2 adds.
  durableThumbnailUrl: text('durable_thumbnail_url'),
  // Hashtags from the scraper adapter (Instagram/Apify today); powers #-prefixed hashtag search (added 2026-08-28)
  hashtags: text('hashtags').array(),
  // Image URLs of every slide in a carousel/Sidecar post (excluding the cover in image_url).
  // Nullable jsonb array, populated at persistence time (insert only, no backfill). Extraction-time
  // input for Story 3.6l's multi-image AI request -- never displayed in any UI. No index: nothing
  // queries by this column.
  additionalImageUrls: jsonb('additional_image_urls').$type<string[]>(),
  // Story 3.6r / AD-30 Rule 1 — post-level facts product UI reads, populated by Story 3.6s's
  // multi-event extraction payload (groupingReason/extractedEventCount). groupingRationale is
  // deliberately never persisted (AD-30 Rule 5).
  groupingReason: postGroupingReasonEnum('grouping_reason'),
  extractedEventCount: integer('extracted_event_count'),
  // Story 3.6z — atomic, TTL-bounded claim marking "an enqueuePostForProcessing attempt is
  // currently in flight for this post." Null means unclaimed. Set to now() on a successful
  // claim and cleared back to null only on a send-time failure (never on a downstream Gemini
  // failure, which deliberately holds the claim until it expires -- see enqueue-post-for-processing.ts
  // and claim-ttl.ts for the full design). No default, no backfill -- every existing row is
  // correctly null/unclaimed. No index: every read/write is scoped by posts.id (primary key).
  queuedForExtractionAt: timestamp('queued_for_extraction_at', { withTimezone: true }),
  ...timestamps,
}, (t) => ({
  accountIdIdx: index('account_id_idx').on(t.accountId),
  publishedAtIdx: index('published_at_idx').on(t.publishedAt),
  postUrlUnq: unique().on(t.postUrl),
  scraperActorRunIdIdx: index('idx_posts_scraper_actor_run_id').on(t.scraperActorRunId),
  // GIN, not the default btree: hashtag search is array-containment (&&) on an exact value, not
  // equality. The installed drizzle-kit (0.21.4) doesn't serialize `.using()` into its
  // snapshot/generated SQL (same class of gap as AD-8 rule 3's WHERE-clause drop) -- the actual
  // migration hand-adds `USING gin`; this builder call only documents intent for drizzle-orm's
  // own runtime/type-checking, it does not by itself produce the GIN index.
  hashtagsIdx: index('post_hashtags_idx').on(t.hashtags).using(sql`gin`),
}));

export const scraperActorRuns = pgTable('scraper_actor_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  vendor: scraperRunVendorEnum('vendor').notNull(),
  triggerMode: scraperRunTriggerModeEnum('trigger_mode').notNull(),
  profileId: uuid('profile_id').references(() => socialMediaAccountProfiles.id, { onDelete: 'cascade' }).notNull(),
  runId: text('run_id').notNull(),
  status: scraperRunStatusEnum('status').default('PENDING').notNull(),
  rawInput: jsonb('raw_input').notNull(),
  rawOutput: jsonb('raw_output'),
  itemCount: integer('item_count'),
  errorMessage: text('error_message'),
  pendingJobId: uuid('pending_job_id'),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  ...timestamps,
}, (t) => ({
  vendorRunIdUnq: unique().on(t.vendor, t.runId),
  profileIdIdx: index('idx_scraper_actor_runs_profile_id').on(t.profileId),
  vendorStatusIdx: index('idx_scraper_actor_runs_vendor_status').on(t.vendor, t.status),
  createdAtIdx: index('idx_scraper_actor_runs_created_at').on(t.createdAt),
}));

export const postAccountAssociations = pgTable('post_account_associations', {
  id: uuid('id').defaultRandom().primaryKey(),
  postId: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }).notNull(),
  accountId: uuid('account_id').references(() => socialMediaAccountProfiles.id).notNull(),
  role: postAccountRoleEnum('role').notNull(),
  scraperActorRunId: uuid('scraper_actor_run_id').references(() => scraperActorRuns.id),
  ...timestamps,
}, (t) => ({
  postAccountRoleUnq: unique().on(t.postId, t.accountId, t.role),
  // Partial unique indexes -- drizzle-kit 0.21.4 drops the WHERE predicate from generated
  // migration SQL (same gap as schedules.oneMainPerEventIdx / AD-8 rule 3). These builder
  // calls document intent only; the migration hand-adds the real DDL.
  onePublisherPerPostIdx: uniqueIndex('idx_post_account_associations_one_publisher_per_post')
    .on(t.postId)
    .where(sql`role IN ('PUBLISHER', 'PUBLISHER_UNKNOWN')`),
  oneScrapingSourcePerPostIdx: uniqueIndex('idx_post_account_associations_one_scraping_source_per_post')
    .on(t.postId)
    .where(sql`role = 'SCRAPING_SOURCE'`),
  accountIdPostIdIdx: index('idx_post_account_associations_account_id_post_id').on(t.accountId, t.postId),
}));

export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  // $defaultFn(generateSlug) (legacy hex) is now exercised only as the no-resolvable-platform-
  // post fallback (AD-16 Rule 4) -- the primary, platform-derivable slug (e.g. `ig_p_Cx9uWttkSN`)
  // is built explicitly by buildEventInsertValues() (Story 3.7g) from the source post's
  // platformPostId/platformPostType before insert, in which case Drizzle never calls this
  // $defaultFn at all. Unchanged: still the only slug generator for events with no resolvable
  // source post, and existing hex-slugged events are never backfilled (AC3).
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
  hasPrivateContact: boolean('has_private_contact').default(false).notNull(),
  description: text('description'),
  confidenceScore: doublePrecision('confidence_score'),
  // Story 0.37 — additional links mentioned in the source post (ticketing/RSVP/merch/
  // linktree/etc.), array of objects so it mirrors the locationDetails/proposedData typed-
  // jsonb-array precedent below, not contactInfo's plain text() column.
  links: jsonb('links').$type<EventLink[]>(),
  sourceSocialMediaAccountId: text('source_social_media_account_id'),
  // Story 3.6r / AD-30 — events.postId is kept as the PRIMARY-post pointer; it is no longer
  // 1:1 with posts (its unique() below is dropped in favor of postIdExtractionOrdinalUnq).
  // The canonical many-to-many link lives in eventPosts.
  postId: uuid('post_id').references(() => posts.id, { onDelete: 'set null' }),
  // This event's index within its PRIMARY post's extraction (existing rows backfill to 0).
  // Nullable so a null postId can carry a null ordinal (enforced together by the hand-written
  // CHECK in the migration SQL -- see migrations/0065_*.sql).
  extractionOrdinal: smallint('extraction_ordinal'),
  detailLevel: eventDetailLevelEnum('detail_level').default('full').notNull(),
  // Self-referencing FK -- requires the lazy, return-type-annotated callback form because a
  // plain `references(() => events.id, ...)` would try to reference this very table object
  // while it is still being constructed (TDZ/circular-reference issue, not a style choice).
  mergedIntoEventId: uuid('merged_into_event_id').references((): AnyPgColumn => events.id, { onDelete: 'set null' }),
  // AD-30 Rule 10 -- the single notification marker; set by one notify helper and nowhere else.
  notifiedAt: timestamp('notified_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }), // Soft delete support
  ...timestamps,
}, (t) => ({
  nameIdx: index('event_name_idx').on(t.eventName).where(sql`deleted_at IS NULL`),
  typesIdx: index('event_types_idx').on(t.types).where(sql`deleted_at IS NULL`),
  categoriesIdx: index('event_categories_idx').on(t.categories).where(sql`deleted_at IS NULL`),
  locationIdx: index('event_location_idx').on(t.location).where(sql`deleted_at IS NULL`),
  // AC6/Task 10 decides whether this stays once the new composite unique index below exists --
  // left in place until the EXPLAIN evidence says otherwise.
  postIdIdx: index('event_post_id_idx').on(t.postId).where(sql`deleted_at IS NULL`),
  // Story 3.6r / AD-30 Rule 1 -- replaces the old 1:1 postIdUnq. Full (non-partial, no
  // `.where()`), unconditional on deletedAt (a soft-deleted event is not recreated by
  // re-extraction) -- backs ingestion idempotency on (postId, extractionOrdinal).
  postIdExtractionOrdinalUnq: unique().on(t.postId, t.extractionOrdinal),
}));

// Story 3.6r / AD-30 Rule 1 -- the many-to-many event<->post link table. events.postId stays
// the PRIMARY-post pointer (see events table above); this table is the full link set, read by
// the (not-yet-wired) account-feed union matching (AD-31 Rule 4) and Query.relatedEventIds
// (AD-30 Rule 11), never by the Query.events/eventBySlug hot path (AD-30 Rule 4). This is this
// file's first composite primary key -- no prior table has one to copy from.
export const eventPosts = pgTable('event_posts', {
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }).notNull(),
  postId: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }).notNull(),
  // Nullable -- a manually-created link (future feature, not built by this story) may carry a
  // null ordinal; Postgres treats NULLs as distinct in the unique index below, so manual links
  // never collide with each other or with an extraction-derived ordinal.
  extractionOrdinal: smallint('extraction_ordinal'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.eventId, t.postId] }),
  postIdEventIdIdx: index('idx_event_posts_post_id_event_id').on(t.postId, t.eventId),
  postIdOrdinalUnq: unique().on(t.postId, t.extractionOrdinal),
}));

// Story 3.6r / AD-30 Rule 1 -- old slugs, so a primary-post change (Story 3.6v) can redirect
// visitors from a stale slug to the event's current one. No index on eventId yet -- AD-30 Rule
// 1 only specifies `slug unique, event_id FK cascade`; a lookup index is added when the actual
// redirect/alias-write path (Story 3.6v) needs one (matching idx_favorites_event_id's
// add-the-index-when-the-query-needs-it precedent).
export const eventSlugAliases = pgTable('event_slug_aliases', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }).notNull(),
  ...timestamps,
});

// Story 3.6p / AD-29 Rule 3 -- records why actualFaceDetectionCount is null (Story 3.6n/3.6o's
// eventual backfill), so a null is never misread as "detection ran and found zero faces."
export const extractionAuditFaceDetectionSkippedReasonEnum = pgEnum('extraction_audit_face_detection_skipped_reason', [
  'no_face_reported',
  'event_relevance_gate',
]);

// Story 3.21 / AD-29 Rule 7 -- which image shape the AI actually received for this attempt.
// Existing rows (inserted before this column existed) default to 'original_mode_off', an
// accurate description of what those rows' extraction attempts actually saw (the pre-AI blur
// feature did not exist yet).
export const extractionAuditAiImageInputEnum = pgEnum('extraction_audit_ai_image_input', AI_IMAGE_INPUT_VALUES);

// Story 3.6p / AD-29 -- one row per Gemini extraction attempt (process-ai-job.ts), holding
// every self-reported extraction-quality signal plus ground truth where available. Write-once
// from process-ai-job.ts (this story); actualFaceDetectionCount/faceDetectionSkippedReason are
// the only columns ever backfilled later, from the SAME Lambda invocation/extraction attempt
// that inserted the row (never a second attempt) -- Story 3.6n backfills 'no_face_reported'
// and the real count, Story 3.6o backfills 'event_relevance_gate' (ownership split confirmed
// with the user 2026-10-03; this story never writes either column itself, only returns the
// row's id -- see Task 2). Never joined into any client-facing resolver (AD-29 Rule 5) -- enforced by
// extraction-audit-logs-no-hotpath-import.test.ts. One row per ATTEMPT, not per event
// (AD-29 Rule 6's shape decision, confirmed with the user at this story's creation) --
// eventsCompleteness holds the per-event data Story 3.6s moved off the payload root.
export const extractionAuditLogs = pgTable('extraction_audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  postId: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }).notNull(),
  geminiModel: text('gemini_model').notNull(),
  isEvent: boolean('is_event').notNull(),
  // Post-level self-reported face-signal pre-filter (Story 3.6m, AD-28 Rule 1). Null when
  // absent from the Gemini response -- never coerced to false.
  hasFaceImage: boolean('has_face_image'),
  faceImageCount: integer('face_image_count'),
  // Ground truth for the face pre-filter, backfilled by Story 3.6n/3.6o -- NOT written by
  // this story. Null means "not backfilled yet," disambiguated from "ran, found zero" by the
  // skip-reason column (AD-29 Rule 3).
  actualFaceDetectionCount: integer('actual_face_detection_count'),
  faceDetectionSkippedReason: extractionAuditFaceDetectionSkippedReasonEnum('face_detection_skipped_reason'),
  // Story 3.21 / AD-29 Rule 7 -- which image shape the AI actually saw for this attempt. Known
  // at insert time (unlike actualFaceDetectionCount/faceDetectionSkippedReason above, which are
  // genuine async backfills) -- always written by writeExtractionAuditLog, never backfilled.
  aiImageInput: extractionAuditAiImageInputEnum('ai_image_input').notNull().default('original_mode_off'),
  // Post-level grouping self-report (Story 3.6s, AD-30 Rule 5). minEventCount is the model's
  // own best-effort count; actualEventCount is the post-truncation count of events actually
  // kept (events.length after Story 3.6s's cap) -- known synchronously within this same
  // extraction attempt, unlike the face-detection pair above which is a genuine async backfill.
  minEventCount: integer('min_event_count'),
  actualEventCount: integer('actual_event_count').notNull(),
  groupingReason: postGroupingReasonEnum('grouping_reason'),
  // Per-event completeness (Story 3.6l's minScheduleCount/expectedScheduleNames, plus
  // confidenceScore -- all three moved off the payload root onto GeminiEventPayload by Story
  // 3.6s). AD-29 Rule 6 explicitly leaves this shape to this story; chosen shape is one jsonb
  // array entry per extracted event (AskUserQuestion, this story's creation), empty for a
  // non-event or zero-event attempt.
  eventsCompleteness: jsonb('events_completeness').$type<ExtractionAuditEventCompleteness[]>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  postIdIdx: index('idx_extraction_audit_logs_post_id').on(t.postId),
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
  // Story 1.3k / AD-19 / BUG-026 (PRD §4.4) — the weekdays a recurring schedule actually occurs
  // on within its [eventStartDate, eventEndDate] span. Nullable; absent/null means "every day in
  // the span applies" (legacy-compatible default, no backfill needed). Free-form text array
  // matching the `events.types`/`events.categories` convention ("expect values from the
  // DayOfWeek enum", not a strict Postgres enum type) rather than a DB-level enum constraint.
  applicableDaysOfWeek: text('applicable_days_of_week').array(),
  ...timestamps,
}, (t) => ({
  performersIdx: index('schedule_performers_idx').on(t.performers),
  locationIdx: index('schedule_location_idx').on(t.location),
  coordinatesIdx: index('schedule_coordinates_idx').on(t.latitude, t.longitude),
  // Story 2.7 — next-upcoming display/sort selection reads (resolvers.ts's Query.events
  // ORDER BY subquery). The column list below is a builder-level approximation only:
  // drizzle-kit 0.21.4's index() builder cannot express an expression index (same class of
  // gap as post_hashtags_idx's GIN/`.where()` hand-edits above). The index as actually
  // created in the database (migration 0055_fix_schedule_event_date_idx.sql) is
  // ("event_id", (COALESCE("event_end_date", "event_start_date")), "event_start_date",
  // "event_start_time") — confirmed via EXPLAIN ANALYZE at ~30k-event volume to push the
  // query's COALESCE filter into an Index Cond (not a post-scan Filter), cutting execution
  // time ~40% vs. the plain (event_id, event_start_date, event_end_date) shape this builder
  // call alone would generate. Do not `drizzle-kit generate` over this — it will not detect
  // or preserve the expression index.
  eventDateIdx: index('schedule_event_date_idx').on(t.eventId, t.eventStartDate, t.eventEndDate),
  // Story 0.36 AC3 — enforces at most one isMainSchedule=true row per event. Builder-level
  // approximation only: drizzle-kit 0.21.4's index() builder drops the WHERE predicate from
  // generated migration SQL (same class of gap as eventDateIdx/idx_favorites_active above).
  // The index as actually created in the database (migration NNNN_*.sql) is a partial unique
  // index — CREATE UNIQUE INDEX idx_schedules_one_main_per_event ON schedules (event_id)
  // WHERE is_main_schedule = true — see that migration file for the real DB-enforced shape.
  oneMainPerEventIdx: uniqueIndex('idx_schedules_one_main_per_event').on(t.eventId).where(sql`is_main_schedule = true`),
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
  // Story 1.3j (AC5, BUG-034) — eventId-leading partial index so Story 1.3j's per-row
  // correlated subqueries (`favoriteCount`, and `isFavorited`/`isAddedToCalendar` EXISTS when
  // driven via the items select) scan only the matching soft-live rows instead of the whole
  // table once per output row. Builder-level approximation only: drizzle-kit 0.21.4 drops the
  // WHERE predicate from generated migration SQL (same class of gap as `idx_favorites_active`
  // and migration 0057), so the index as actually created in the DB is hand-edited in
  // migration 0060_*.sql to append `WHERE deleted_at IS NULL`.
  eventIdIdx: index('idx_favorites_event_id').on(t.eventId).where(sql`deleted_at IS NULL`),
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
  aiEventFilters: many(aiEventFilters),
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
  changedByUserId: uuid('changed_by_user_id').references(() => users.id),
  previousLocation: jsonb('previous_location').$type<LocationDetails>(),
  newLocation: jsonb('new_location').$type<LocationDetails>().notNull(),
  status: defaultLocationChangeStatusEnum('status').default('PENDING_REVIEW').notNull(),
  changeSource: defaultLocationChangeSourceEnum('change_source').default('USER').notNull(),
  // Populated only when changeSource is AI_INFERENCE; gates AWAITING_APPROVAL vs immediate apply (added 2026-08-28)
  confidenceScore: doublePrecision('confidence_score'),
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

export const accountTypeClassificationReviews = pgTable('account_type_classification_reviews', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').references(() => socialMediaAccountProfiles.id).notNull(),
  proposedAccountType: accountTypeEnum('proposed_account_type'), // null if classification failed before producing any answer
  confidenceScore: doublePrecision('confidence_score'),
  failureReason: text('failure_reason'), // populated only when AWAITING_APPROVAL is due to a hard failure, not low confidence
  resolvedAccountType: accountTypeEnum('resolved_account_type'), // set by moderator
  reviewedByModeratorId: uuid('reviewed_by_moderator_id').references(() => users.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  accountIdx: index('idx_account_type_classification_reviews_account').on(t.accountId),
}));

export const accountTypeClassificationReviewsRelations = relations(accountTypeClassificationReviews, ({ one }) => ({
  accountProfile: one(socialMediaAccountProfiles, {
    fields: [accountTypeClassificationReviews.accountId],
    references: [socialMediaAccountProfiles.id],
  }),
  reviewedByModerator: one(users, {
    fields: [accountTypeClassificationReviews.reviewedByModeratorId],
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
  // Added 2026-09-07 (Story 3.6k): audit-trail-only record of the submitter's
  // declaration checkbox ("I confirm I have parent/guardian permission if this
  // includes a minor"). Does NOT by itself unlock performer-name display or
  // change the keyword-match outcome -- FestDaily cannot verify the submitter
  // is actually the parent. Sibling-audit-column precedent: reports.moderatorIgnored.
  guardianPermissionConfirmed: boolean('guardian_permission_confirmed').default(false).notNull(),
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
  rawPayload: customJsonb<unknown>('raw_payload').notNull(),
  validationError: customJsonb<unknown>('validation_error').notNull(),
  context: customJsonb<unknown>('context').notNull(),
  scraperActorRunId: uuid('scraper_actor_run_id').references(() => scraperActorRuns.id),
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
  scraperActorRunIdIdx: index('idx_unprocessed_payloads_scraper_actor_run_id').on(t.scraperActorRunId),
}));

export const parserVersionRegistry = pgTable('parser_version_registry', {
  id: uuid('id').defaultRandom().primaryKey(),
  version: text('version').notNull().unique(),
  description: text('description'),
  sourceFile: text('source_file'),
  // Nullable: this table has historically only ever been populated by the dev/test
  // seed script (never in production), so an unknown/legacy row without a source is
  // possible -- see migration 0046 for the real production data this backfills.
  source: parserVersionSourceEnum('source'),
  deployedAt: timestamp('deployed_at', { withTimezone: true }).defaultNow().notNull(),
  isActive: boolean('is_active').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  idxVersion: uniqueIndex('idx_parser_versions_version').on(t.version),
  idxActive: index('idx_parser_versions_active').on(t.isActive, t.version),
}));

export const aiEventFilters = pgTable('ai_event_filters', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerUserId: uuid('owner_user_id').references(() => users.id).notNull(),
  prompt: text('prompt').notNull(),
  resolvedFilter: jsonb('resolved_filter').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  activeIdx: index('idx_ai_event_filters_active').on(t.ownerUserId).where(sql`deleted_at IS NULL`),
}));

export const aiEventFiltersRelations = relations(aiEventFilters, ({ one }) => ({
  owner: one(users, {
    fields: [aiEventFilters.ownerUserId],
    references: [users.id],
  }),
}));
