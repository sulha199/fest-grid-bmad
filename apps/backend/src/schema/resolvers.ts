import { randomUUID } from 'node:crypto';
import { Resolvers } from '../generated/resolvers-types.js';
import { db } from '../db/client.js';
import { events, schedules, posts, users, favorites, calendarAdditions, userLocations, userSettings, fcmTokens, socialMediaAccountProfiles, apiKeys, subscriptions, defaultLocationChangeRequests, corrections, reports, accountVotes, widgets, embedDomains, unprocessedScraperPayloads, parserVersionRegistry, scraperActorRuns } from '@festgrid/database';
import { buildOptimizedDrizzleSelect, buildDrizzleWhere, activeOnly } from '@festgrid/graphql-select';
import { requireAuth, requireModerator } from '../lib/auth/context.js';
import { eq, ne, count, sql, asc, and, exists, desc, inArray, notInArray, or, gte, lte, isNull, ilike } from 'drizzle-orm';
import { parse as parseTld } from 'tldts';
import { QueryCondition, resolveWithinRadiusConditions, UnknownLocationPreferenceError } from '@festgrid/domain/query';
import { getScraperAdapter, detectPlatformFromUrl, lookupAccountProfile } from '@festgrid/domain/scraper';
import { selectApiKey } from '@festgrid/domain/ai-gateway';
import { mapExtractionPayloadToProposedCorrection } from '@festgrid/domain/events';
import { callGemini, AiGatewayExhaustedError } from '../lib/ai-gateway/adapter.js';
import { fetchCandidateKeys } from '../lib/ai-gateway/usage-store.js';
import { buildGeminiExtractionRequest } from '../lib/ai-processor/build-gemini-request.js';
import { extractedEventSchema } from '../validation/extracted-event.schema.js';
import { getActiveSubscriberUserIds } from '../lib/subscriptions/get-active-subscriber-user-ids.js';
import { resolveLocationInputMode, validateRadiusMeters, InvalidUserLocationInputError } from '@festgrid/domain/user-locations';
import { validateHidePastEventsAfterDays, InvalidUserSettingsInputError } from '@festgrid/domain/user-settings';
import { isValidIanaTimezone } from '@festgrid/domain/users';
import { getOrCreateUserSettings } from '../lib/user-settings/get-or-create-user-settings.js';
import { resolveLocation, getAddressPredictions, resolveAdminRegion } from '../lib/geolocation/adapter.js';
import { GraphQLJSON } from 'graphql-scalars';
import { GraphQLError } from 'graphql';
import { buildDefaultEventVisibilityConditions, DEFAULT_HIDE_PAST_EVENTS_AFTER_DAYS, validateCorrectionConsistency, ProposedEventCorrection, getCancelledReportWindowCutoff, shouldSoftDeleteFromCancelledReports, DEFAULT_CANCELLED_REPORT_THRESHOLD, DEFAULT_CANCELLED_REPORT_WINDOW_DAYS } from '@festgrid/domain/events';
import { SUPPORTED_PLATFORMS } from '@festgrid/domain/subscriptions';
import { ScraperCapacityExceededError, ApifyRequestTimeoutError, isCycleElapsed } from '@festgrid/domain';
import { PostAlreadyExtractedError, PostNotFoundError } from '@festgrid/domain/posts';
import { subscribeToAccount as subscribeToAccountFn } from '../lib/subscriptions/subscribe-to-account.js';
import { triggerScrapeForAccount } from '../lib/scraper/trigger-scrape-for-account.js';
import { decryptApiKey, encryptApiKey } from '../lib/ai-gateway/kms.js';
import { compileValidator } from '../validation/validate.js';
import { reportSystemErrorSchema } from '../validation/report-system-error.schema.js';
import { proposedEventCorrectionSchema } from '../validation/proposed-event-correction.schema.js';
import { sendTemplatedEmail } from '../lib/email/adapter.js';
import { loadBackendEnv } from '../env.js';
import { sendDangerousReportModeratorAlerts } from '../lib/notifications/send-dangerous-report-moderator-alerts.js';
import { enqueuePostForProcessing } from '../lib/posts/enqueue-post-for-processing.js';
import { replayActorRun } from '../lib/scraper/replay-actor-run.js';
import { applyDefaultLocationChange } from '../lib/accounts/apply-default-location-change.js';

const validateReportSystemError = compileValidator<any>(reportSystemErrorSchema);
const validateProposedEventCorrection = compileValidator<ProposedEventCorrection>(proposedEventCorrectionSchema);
const validateExtractedEvent = compileValidator<any>(extractedEventSchema);

function formatAjvInstancePath(instancePath: string, missingProperty?: string): string {
  if (!instancePath) {
    return missingProperty || '';
  }
  let path = instancePath.startsWith('/') ? instancePath.slice(1) : instancePath;
  path = path.replace(/\/(\d+)/g, '[$1]');
  path = path.replace(/\//g, '.');
  return path;
}

function formatLocationDetails(details: any): any {
  if (!details) return null;
  return {
    ...details,
    coordinates: {
      lat: details.coordinates.latitude ?? details.coordinates.lat,
      lng: details.coordinates.longitude ?? details.coordinates.lng,
    }
  };
}

function formatApiKey(row: any): any {
  if (!row) return null;
  return {
    ...row,
    maskedKey: '••••' + row.keyLast4,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function formatSubscription(row: any): any {
  if (!row) return null;
  return {
    id: row.id,
    accountId: row.accountId,
    isNewlyAdded: row.isNewlyAdded,
    createdAt: row.createdAt.toISOString(),
  };
}

export const resolvers: Resolvers = {
  JSON: GraphQLJSON,
  Coordinates: {
    lat: (parent: any) => parent.lat ?? parent.latitude,
    lng: (parent: any) => parent.lng ?? parent.longitude,
  },
  PayloadContext: {
    // context.source is persisted lowercase (see persist-unprocessed-payload.ts) but the
    // UnprocessedPayloadSource enum values are uppercase; normalize on the way out.
    source: (parent: any) => parent.source?.toUpperCase(),
  },
  Subscription: {
    account: async (parent: any, _: any, context: any, info: any) => {
      const requestedFields = buildOptimizedDrizzleSelect(socialMediaAccountProfiles, info);
      const rows = await db.select({
        ...requestedFields,
        id: socialMediaAccountProfiles.id,
      }).from(socialMediaAccountProfiles)
        .where(eq(socialMediaAccountProfiles.id, parent.accountId));

      const profile = rows[0] as any;
      if (!profile) {
        throw new GraphQLError('Profile not found', { extensions: { code: 'NOT_FOUND' } });
      }

      if (profile.defaultLocation) {
        profile.defaultLocation = formatLocationDetails(profile.defaultLocation);
      }

      return profile as any;
    },
    pendingExtractionCount: async (parent: any) => {
      const rows = await db.select({ count: count() })
        .from(posts)
        .where(
          and(
            eq(posts.accountId, parent.accountId),
            eq(posts.isExtracted, false)
          )
        );
      return rows[0]?.count ?? 0;
    },
    isInactive: async (parent: any) => {
      const rows = await db.select({ publishedAt: posts.publishedAt })
        .from(posts)
        .where(eq(posts.accountId, parent.accountId))
        .orderBy(desc(posts.publishedAt))
        .limit(1);
      if (rows.length === 0) {
        return true;
      }
      const mostRecent = rows[0].publishedAt;
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return mostRecent < thirtyDaysAgo;
    }
  } as any,
  SocialMediaAccountProfile: {
    hasPendingDefaultLocationReview: async (parent: any) => {
      const rows = await db.select({ id: defaultLocationChangeRequests.id })
        .from(defaultLocationChangeRequests)
        .where(
          and(
            eq(defaultLocationChangeRequests.accountId, parent.id),
            eq(defaultLocationChangeRequests.status, "PENDING_REVIEW")
          )
        )
        .limit(1);
      return rows.length > 0;
    },
    isScrapeInProgress: async (parent: any) => {
      const rows = await db.select({
        scrapeTriggeredAt: socialMediaAccountProfiles.scrapeTriggeredAt,
        lastScrapedAt: socialMediaAccountProfiles.lastScrapedAt,
      })
        .from(socialMediaAccountProfiles)
        .where(eq(socialMediaAccountProfiles.id, parent.id))
        .limit(1);

      const profile = rows[0];
      if (!profile || !profile.scrapeTriggeredAt) {
        return false;
      }

      const env = loadBackendEnv();
      const scrapeInProgressTimeoutHours = parseInt(env.scrapeInProgressTimeoutHours || '3', 10);
      const timeoutMs = scrapeInProgressTimeoutHours * 60 * 60 * 1000;
      const scrapeTimeoutBoundary = new Date(Date.now() - timeoutMs);

      // If scrapeTriggeredAt is older than the timeout, consider it cleared (orphaned job)
      if (profile.scrapeTriggeredAt < scrapeTimeoutBoundary) {
        return false;
      }

      // In-progress if:
      // - scrapeTriggeredAt is set AND
      // - (lastScrapedAt is null OR lastScrapedAt < scrapeTriggeredAt)
      if (profile.lastScrapedAt === null || profile.lastScrapedAt < profile.scrapeTriggeredAt) {
        return true;
      }

      return false;
    },
  } as any,
  Mutation: {
    createApiKey: async (_: any, { input }: any, context: any) => {
      const authUser = requireAuth(context);
      const normalizedKey = input.key.trim();
      if (input.provider.toLowerCase() !== 'gemini') {
        throw new GraphQLError('Unsupported provider', { extensions: { code: 'BAD_REQUEST' } });
      }
      if (!normalizedKey) {
        throw new GraphQLError('API key is required', { extensions: { code: 'BAD_REQUEST' } });
      }

      const activeKeys = await db.select().from(apiKeys)
        .where(and(eq(apiKeys.provider, input.provider.toLowerCase()), activeOnly(apiKeys)));

      for (const existingKey of activeKeys) {
        const plaintext = await decryptApiKey(existingKey.keyEncrypted);
        if (plaintext.trim() === normalizedKey) {
          throw new GraphQLError('API key already exists', { extensions: { code: 'DUPLICATE_API_KEY' } });
        }
      }

      const keyEncrypted = await encryptApiKey(normalizedKey);
      const keyLast4 = normalizedKey.slice(-4);
      const [inserted] = await db.insert(apiKeys).values({
        userId: authUser.userId,
        provider: input.provider.toLowerCase(),
        keyEncrypted,
        keyLast4,
        isValid: true,
        invalidAttempts: 0,
      }).returning();
      return formatApiKey(inserted);
    },
    deleteApiKey: async (_: any, { id, action }: any, context: any) => {
      const authUser = requireAuth(context);
      const existingRows = await db.select().from(apiKeys)
        .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, authUser.userId)));
      
      if (existingRows.length === 0) {
        throw new GraphQLError('ApiKey not found', { extensions: { code: 'NOT_FOUND' } });
      }

      const existing = existingRows[0];
      if (action === 'DELETE') {
        if (existing.deletedAt !== null) {
          throw new GraphQLError('ApiKey is already deleted', { extensions: { code: 'INVALID_STATE_TRANSITION' } });
        }
        const [updated] = await db.update(apiKeys)
          .set({ deletedAt: new Date(), updatedAt: new Date() })
          .where(eq(apiKeys.id, id))
          .returning();
        return formatApiKey(updated);
      } else if (action === 'RESTORE') {
        if (existing.deletedAt === null) {
          throw new GraphQLError('ApiKey is already active', { extensions: { code: 'INVALID_STATE_TRANSITION' } });
        }
        const [updated] = await db.update(apiKeys)
          .set({ deletedAt: null, updatedAt: new Date() })
          .where(eq(apiKeys.id, id))
          .returning();
        return formatApiKey(updated);
      }
      throw new GraphQLError('Invalid action', { extensions: { code: 'BAD_REQUEST' } });
    },
    subscribeToAccount: async (_: any, { input }: any, context: any) => {
      const authUser = requireAuth(context);
      if (!SUPPORTED_PLATFORMS.includes(input.platform.toLowerCase() as any)) {
        throw new GraphQLError('Unsupported platform', { extensions: { code: 'BAD_REQUEST' } });
      }
      try {
        const result = await subscribeToAccountFn({
          userId: authUser.userId,
          platform: input.platform.toLowerCase(),
          accountId: input.accountId,
          profile: {
            username: input.username,
            displayName: input.displayName,
          },
        });
        return {
          subscription: formatSubscription(result.subscription),
          alreadySubscribed: result.alreadySubscribed,
        };
      } catch (err) {
        if (err instanceof ScraperCapacityExceededError) {
          throw new GraphQLError(err.message, {
            extensions: { code: 'SCRAPER_CAPACITY_EXCEEDED' },
          });
        }
        throw err;
      }
    },
    removeSubscription: async (_: any, { id, action }: any, context: any) => {
      const authUser = requireAuth(context);
      const existingRows = await db.select().from(subscriptions)
        .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, authUser.userId)));
      
      if (existingRows.length === 0) {
        throw new GraphQLError('Subscription not found', { extensions: { code: 'NOT_FOUND' } });
      }

      const existing = existingRows[0];
      if (action === 'DELETE') {
        if (existing.deletedAt !== null) {
          throw new GraphQLError('Subscription is already deleted', { extensions: { code: 'INVALID_STATE_TRANSITION' } });
        }
        const [updated] = await db.update(subscriptions)
          .set({ deletedAt: new Date(), updatedAt: new Date() })
          .where(eq(subscriptions.id, id))
          .returning();
        return formatSubscription(updated);
      } else if (action === 'RESTORE') {
        if (existing.deletedAt === null) {
          throw new GraphQLError('Subscription is already active', { extensions: { code: 'INVALID_STATE_TRANSITION' } });
        }
        const [updated] = await db.update(subscriptions)
          .set({ deletedAt: null, updatedAt: new Date() })
          .where(eq(subscriptions.id, id))
          .returning();
        return formatSubscription(updated);
      }
      throw new GraphQLError('Invalid action', { extensions: { code: 'BAD_REQUEST' } });
    },
    triggerAccountScrape: async (_: any, { accountId }: any, context: any) => {
      const authUser = requireAuth(context);

      // 1. Check that the user has an active subscription to this account
      const activeSubRows = await db.select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.userId, authUser.userId),
            eq(subscriptions.accountId, accountId),
            activeOnly(subscriptions)
          )
        )
        .limit(1);

      if (activeSubRows.length === 0) {
        throw new GraphQLError('Subscription not found', { extensions: { code: 'NOT_FOUND' } });
      }

      // 2. Get the account profile
      const profileRows = await db.select()
        .from(socialMediaAccountProfiles)
        .where(eq(socialMediaAccountProfiles.id, accountId))
        .limit(1);

      if (profileRows.length === 0) {
        throw new GraphQLError('Account profile not found', { extensions: { code: 'NOT_FOUND' } });
      }

      const profile = profileRows[0];

      // 3. Re-check isScrapeInProgress server-side
      const env = loadBackendEnv();
      const scrapeInProgressTimeoutHours = parseInt(env.scrapeInProgressTimeoutHours || '3', 10);
      const timeoutMs = scrapeInProgressTimeoutHours * 60 * 60 * 1000;
      const scrapeTimeoutBoundary = new Date(Date.now() - timeoutMs);

      let isScrapeInProgress = false;
      if (profile.scrapeTriggeredAt && profile.scrapeTriggeredAt > scrapeTimeoutBoundary) {
        if (profile.lastScrapedAt === null || profile.lastScrapedAt < profile.scrapeTriggeredAt) {
          isScrapeInProgress = true;
        }
      }

      if (isScrapeInProgress) {
        throw new GraphQLError('Scrape already in progress for this account.', {
          extensions: { code: 'SCRAPE_ALREADY_IN_PROGRESS' },
        });
      }

      // 4. Decide branch: count posts to determine if initial or incremental
      const postCountRows = await db.select({ count: count() })
        .from(posts)
        .where(eq(posts.accountId, accountId));

      const postCount = postCountRows[0]?.count ?? 0;
      let isInitialScrape = false;
      let newerThan: string;

      if (postCount === 0) {
        // Initial scrape: 7 days ago
        isInitialScrape = true;
        newerThan = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      } else {
        // Incremental: from the most recent post
        const mostRecentRows = await db.select({ publishedAt: posts.publishedAt })
          .from(posts)
          .where(eq(posts.accountId, accountId))
          .orderBy(desc(posts.publishedAt))
          .limit(1);

        if (mostRecentRows.length > 0) {
          newerThan = mostRecentRows[0].publishedAt.toISOString();
        } else {
          // Fallback (shouldn't happen)
          newerThan = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        }
      }

      // 5. Build ScrapeTarget and trigger the cascade
      const scrapeTarget = {
        profileId: profile.id,
        platform: profile.platform as any,
        accountId: profile.accountId,
        username: profile.username,
        isInitialNewSubscription: isInitialScrape,
      };

      try {
        await triggerScrapeForAccount(scrapeTarget, newerThan);
      } catch (err) {
        if (err instanceof ScraperCapacityExceededError) {
          throw new GraphQLError(err.message, {
            extensions: { code: 'SCRAPER_CAPACITY_EXCEEDED' },
          });
        }
        throw err;
      }

      return {
        triggered: true,
        isInitialScrape,
      };
    },
    setAccountDefaultLocation: async (_: any, { accountId, input }: any, context: any, info: any) => {
      try {
        const authUser = requireAuth(context);

        // 1. Look up caller's active subscription to accountId
        const activeSubRows = await db.select()
          .from(subscriptions)
          .where(
            and(
              eq(subscriptions.userId, authUser.userId),
              eq(subscriptions.accountId, accountId),
              activeOnly(subscriptions)
            )
          );

        if (activeSubRows.length === 0) {
          throw new GraphQLError('Subscription not found', { extensions: { code: 'NOT_FOUND' } });
        }

        // 2. Look up the social_media_account_profiles row by id = accountId
        const profileRows = await db.select()
          .from(socialMediaAccountProfiles)
          .where(eq(socialMediaAccountProfiles.id, accountId));

        if (profileRows.length === 0) {
          throw new GraphQLError('Account profile not found', { extensions: { code: 'NOT_FOUND' } });
        }

        const profile = profileRows[0];

        // 3. If defaultLocation is already non-null, throw INVALID_STATE_TRANSITION
        if (profile.defaultLocation !== null) {
          throw new GraphQLError('Default location already set', {
            extensions: { code: 'INVALID_STATE_TRANSITION' },
          });
        }

        // 4. Call resolveLocationInputMode(input)
        const mode = resolveLocationInputMode(input);
        if (!mode) {
          throw new GraphQLError('Address or coordinates required', { extensions: { code: 'BAD_REQUEST' } });
        }

        let resolved;
        if (mode.kind === 'ADDRESS') {
          resolved = await resolveLocation({ kind: 'ADDRESS', address: mode.address });
        } else if (mode.kind === 'PLACE_ID') {
          resolved = await resolveLocation({ kind: 'PLACE_ID', placeId: mode.placeId });
        } else {
          resolved = await resolveLocation({ kind: 'COORDINATES', coordinates: { latitude: mode.latitude, longitude: mode.longitude } });
        }

        // 5. Update social_media_account_profiles set default_location = resolved
        await db.update(socialMediaAccountProfiles)
          .set({
            defaultLocation: resolved,
          })
          .where(eq(socialMediaAccountProfiles.id, accountId));

        // 6. Return the updated profile with defaultLocation formatted via formatLocationDetails
        const requestedFields = buildOptimizedDrizzleSelect(socialMediaAccountProfiles, info);
        const rows = await db.select({
          ...requestedFields,
          id: socialMediaAccountProfiles.id,
        }).from(socialMediaAccountProfiles)
          .where(eq(socialMediaAccountProfiles.id, accountId));

        const updatedProfile = rows[0] as any;
        if (updatedProfile && updatedProfile.defaultLocation) {
          updatedProfile.defaultLocation = formatLocationDetails(updatedProfile.defaultLocation);
        }

        return updatedProfile;
      } catch (err: any) {
        if (err instanceof InvalidUserLocationInputError) {
          throw new GraphQLError(err.message, { extensions: { code: 'BAD_REQUEST' } });
        }
        throw err;
      }
    },
    editAccountDefaultLocation: async (_: any, { accountId, input, asModeratorCorrection }: any, context: any, info: any) => {
      try {
        const authUser = requireAuth(context);
        // Which mutation semantics apply is decided by the calling page (via the explicit
        // asModeratorCorrection intent flag), not by the caller's role alone -- a moderator
        // editing their own subscription's default location from /settings/subscriptions
        // (which never passes this flag) still goes through the ordinary subscriber/review
        // flow below. Role is still required as a defense-in-depth check: a non-moderator
        // caller cannot self-grant the moderator path just by passing the flag.
        const isModerator = authUser.role === 'moderator' && asModeratorCorrection === true;

        // 1. Look up caller's active subscription to accountId only if not a moderator
        if (!isModerator) {
          const activeSubRows = await db.select()
            .from(subscriptions)
            .where(
              and(
                eq(subscriptions.userId, authUser.userId),
                eq(subscriptions.accountId, accountId),
                activeOnly(subscriptions)
              )
            );

          if (activeSubRows.length === 0) {
            throw new GraphQLError('Subscription not found', { extensions: { code: 'NOT_FOUND' } });
          }
        }

        // 2. Look up the social_media_account_profiles row by id = accountId
        const profileRows = await db.select()
          .from(socialMediaAccountProfiles)
          .where(eq(socialMediaAccountProfiles.id, accountId));

        if (profileRows.length === 0) {
          throw new GraphQLError('Account profile not found', { extensions: { code: 'NOT_FOUND' } });
        }

        const profile = profileRows[0];

        // 3. If defaultLocation is null, throw INVALID_STATE_TRANSITION
        if (profile.defaultLocation === null || profile.defaultLocation === undefined) {
          throw new GraphQLError('No default location set yet', {
            extensions: { code: 'INVALID_STATE_TRANSITION' },
          });
        }

        const previousLocation = profile.defaultLocation;

        // 4. Call resolveLocationInputMode(input)
        const mode = resolveLocationInputMode(input);
        if (!mode) {
          throw new GraphQLError('Address or coordinates required', { extensions: { code: 'BAD_REQUEST' } });
        }

        let resolved;
        if (mode.kind === 'ADDRESS') {
          resolved = await resolveLocation({ kind: 'ADDRESS', address: mode.address });
        } else if (mode.kind === 'PLACE_ID') {
          resolved = await resolveLocation({ kind: 'PLACE_ID', placeId: mode.placeId });
        } else {
          resolved = await resolveLocation({ kind: 'COORDINATES', coordinates: { latitude: mode.latitude, longitude: mode.longitude } });
        }

        const newLocation = resolved;

        const result = await applyDefaultLocationChange({
          accountId,
          newLocation,
          previousLocation,
          changedByUserId: authUser.userId,
          changeSource: isModerator ? 'MODERATOR' : 'USER',
          accountDisplayName: profile.displayName,
        });

        if (!result.applied) {
          throw new GraphQLError('Failed to apply default location change', {
            extensions: { code: 'INVALID_STATE_TRANSITION' },
          });
        }

        // 8. Return the updated profile with defaultLocation formatted via formatLocationDetails
        const requestedFields = buildOptimizedDrizzleSelect(socialMediaAccountProfiles, info);
        const rows = await db.select({
          ...requestedFields,
          id: socialMediaAccountProfiles.id,
        }).from(socialMediaAccountProfiles)
          .where(eq(socialMediaAccountProfiles.id, accountId));

        const updatedProfile = rows[0] as any;
        if (updatedProfile && updatedProfile.defaultLocation) {
          updatedProfile.defaultLocation = formatLocationDetails(updatedProfile.defaultLocation);
        }

        return updatedProfile;
      } catch (err: any) {
        if (err instanceof InvalidUserLocationInputError) {
          throw new GraphQLError(err.message, { extensions: { code: 'BAD_REQUEST' } });
        }
        throw err;
      }
    },
    createUserLocation: async (_: any, { input }: any, context: any) => {
      try {
        const authUser = requireAuth(context);
        const mode = resolveLocationInputMode(input);
        if (!mode) {
          throw new GraphQLError('Address or coordinates required', { extensions: { code: 'BAD_REQUEST' } });
        }
        validateRadiusMeters(input.radius);

        let resolved;
        if (mode.kind === 'ADDRESS') {
          resolved = await resolveLocation({ kind: 'ADDRESS', address: mode.address });
        } else if (mode.kind === 'PLACE_ID') {
          resolved = await resolveLocation({ kind: 'PLACE_ID', placeId: mode.placeId });
        } else {
          resolved = await resolveLocation({ kind: 'COORDINATES', coordinates: { latitude: mode.latitude, longitude: mode.longitude } });
        }

        const [created] = await db.insert(userLocations).values({
          userId: authUser.userId,
          name: input.name,
          latitude: resolved.coordinates.latitude,
          longitude: resolved.coordinates.longitude,
          radius: input.radius,
          locationDetails: resolved,
        }).returning();

        return {
          ...created,
          locationDetails: formatLocationDetails(created.locationDetails),
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
        } as any;
      } catch (err: any) {
        if (err instanceof InvalidUserLocationInputError) {
          throw new GraphQLError(err.message, { extensions: { code: 'BAD_REQUEST' } });
        }
        throw err;
      }
    },
    updateUserLocation: async (_: any, { id, input }: any, context: any) => {
      try {
        const authUser = requireAuth(context);
        const existingRows = await db.select().from(userLocations)
          .where(and(eq(userLocations.id, id), eq(userLocations.userId, authUser.userId)));
        
        if (existingRows.length === 0) {
          throw new GraphQLError('Location not found', { extensions: { code: 'NOT_FOUND' } });
        }

        const existing = existingRows[0];
        const mode = resolveLocationInputMode(input);
        let resolvedLatitude = existing.latitude;
        let resolvedLongitude = existing.longitude;
        let resolvedDetails = existing.locationDetails;

        if (mode !== null) {
          let resolved;
          if (mode.kind === 'ADDRESS') {
            resolved = await resolveLocation({ kind: 'ADDRESS', address: mode.address });
          } else if (mode.kind === 'PLACE_ID') {
            resolved = await resolveLocation({ kind: 'PLACE_ID', placeId: mode.placeId });
          } else {
            resolved = await resolveLocation({ kind: 'COORDINATES', coordinates: { latitude: mode.latitude, longitude: mode.longitude } });
          }
          resolvedLatitude = resolved.coordinates.latitude;
          resolvedLongitude = resolved.coordinates.longitude;
          resolvedDetails = resolved;
        }

        if (typeof input.radius === 'number') {
          validateRadiusMeters(input.radius);
        }

        const [updated] = await db.update(userLocations)
          .set({
            name: input.name ?? existing.name,
            radius: input.radius ?? existing.radius,
            latitude: resolvedLatitude,
            longitude: resolvedLongitude,
            locationDetails: resolvedDetails,
            updatedAt: new Date(),
          })
          .where(eq(userLocations.id, id))
          .returning();

        return {
          ...updated,
          locationDetails: formatLocationDetails(updated.locationDetails),
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        } as any;
      } catch (err: any) {
        if (err instanceof InvalidUserLocationInputError) {
          throw new GraphQLError(err.message, { extensions: { code: 'BAD_REQUEST' } });
        }
        throw err;
      }
    },
    deleteUserLocation: async (_: any, { id, action }: any, context: any) => {
      const authUser = requireAuth(context);
      const existingRows = await db.select().from(userLocations)
        .where(and(eq(userLocations.id, id), eq(userLocations.userId, authUser.userId)));
      
      if (existingRows.length === 0) {
        throw new GraphQLError('Location not found', { extensions: { code: 'NOT_FOUND' } });
      }

      const existing = existingRows[0];
      if (action === 'DELETE') {
        if (existing.deletedAt !== null) {
          throw new GraphQLError('Location is already deleted', { extensions: { code: 'INVALID_STATE_TRANSITION' } });
        }
        const [updated] = await db.update(userLocations)
          .set({ deletedAt: new Date(), updatedAt: new Date() })
          .where(eq(userLocations.id, id))
          .returning();
        return {
          ...updated,
          locationDetails: formatLocationDetails(updated.locationDetails),
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        } as any;
      } else if (action === 'RESTORE') {
        if (existing.deletedAt === null) {
          throw new GraphQLError('Location is already active', { extensions: { code: 'INVALID_STATE_TRANSITION' } });
        }
        const [updated] = await db.update(userLocations)
          .set({ deletedAt: null, updatedAt: new Date() })
          .where(eq(userLocations.id, id))
          .returning();
        return {
          ...updated,
          locationDetails: formatLocationDetails(updated.locationDetails),
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        } as any;
      }
      throw new GraphQLError('Invalid action', { extensions: { code: 'BAD_REQUEST' } });
    },
    toggleFavorite: async (_: any, { eventId }: any, context: any) => {
      const authUser = requireAuth(context);
      
      return await db.transaction(async (tx) => {
        const existingRows = await tx.select().from(favorites)
          .where(and(eq(favorites.userId, authUser.userId), eq(favorites.eventId, eventId)));
        
        if (existingRows.length > 0) {
          const existing = existingRows[0];
          if (existing.deletedAt === null) {
            // Unfavorite: set deletedAt
            await tx.update(favorites)
              .set({ deletedAt: new Date() })
              .where(eq(favorites.id, existing.id));
            return { eventId, isFavorited: false };
          } else {
            // Re-favorite: clear deletedAt
            await tx.update(favorites)
              .set({ deletedAt: null })
              .where(eq(favorites.id, existing.id));
            return { eventId, isFavorited: true };
          }
        } else {
          // Insert new
          await tx.insert(favorites).values({
            userId: authUser.userId,
            eventId,
          });
          return { eventId, isFavorited: true };
        }
      });
    },
    updateUserSettings: async (_: any, { input }: any, context: any) => {
      try {
        const authUser = requireAuth(context);
        if (input.hidePastEventsAfterDays !== undefined && input.hidePastEventsAfterDays !== null) {
          validateHidePastEventsAfterDays(input.hidePastEventsAfterDays);
        }

        // Ensure settings row exists first
        await getOrCreateUserSettings(authUser.userId);

        // Update fields if provided
        const updateData: any = {
          updatedAt: new Date(),
        };
        if (input.hidePastEventsAfterDays !== undefined) {
          updateData.hidePastEventsAfterDays = input.hidePastEventsAfterDays;
        }
        if (input.pushNotificationsEnabled !== undefined) {
          updateData.pushNotificationsEnabled = input.pushNotificationsEnabled;
        }

        const [updated] = await db.update(userSettings)
          .set(updateData)
          .where(eq(userSettings.userId, authUser.userId))
          .returning();

        return {
          ...updated,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        } as any;
      } catch (err: any) {
        if (err instanceof InvalidUserSettingsInputError) {
          throw new GraphQLError(err.message, { extensions: { code: 'BAD_REQUEST' } });
        }
        throw err;
      }
    },
    toggleCalendarAddition: async (_: any, { eventId, scheduleId }: any, context: any) => {
      const authUser = requireAuth(context);

      return await db.transaction(async (tx) => {
        const scheduleRows = await tx.select().from(schedules).where(eq(schedules.id, scheduleId));
        if (scheduleRows.length === 0) {
          throw new GraphQLError('Schedule not found', { extensions: { code: 'NOT_FOUND' } });
        }

        const schedule = scheduleRows[0];
        if (schedule.eventId !== eventId) {
          throw new GraphQLError('Event ID mismatch', { extensions: { code: 'BAD_REQUEST' } });
        }

        const existingRows = await tx.select().from(calendarAdditions)
          .where(and(eq(calendarAdditions.userId, authUser.userId), eq(calendarAdditions.scheduleId, scheduleId)));

        if (existingRows.length > 0) {
          const existing = existingRows[0];
          if (existing.deletedAt === null) {
            // Remove from calendar: set deletedAt
            await tx.update(calendarAdditions)
              .set({ deletedAt: new Date() })
              .where(eq(calendarAdditions.id, existing.id));
            return { eventId, scheduleId, isAddedToCalendar: false };
          } else {
            // Re-add to calendar: clear deletedAt
            await tx.update(calendarAdditions)
              .set({ deletedAt: null })
              .where(eq(calendarAdditions.id, existing.id));
            return { eventId, scheduleId, isAddedToCalendar: true };
          }
        } else {
          // Insert new
          await tx.insert(calendarAdditions).values({
            userId: authUser.userId,
            eventId,
            scheduleId,
          });
          return { eventId, scheduleId, isAddedToCalendar: true };
        }
      });
    },
    resolveScheduleTimezone: async (_: any, { scheduleId, timezone }: any, context: any) => {
      const authUser = requireAuth(context);

      if (!isValidIanaTimezone(timezone)) {
        throw new GraphQLError('Invalid IANA timezone.', {
          extensions: { code: 'BAD_REQUEST' }
        });
      }

      const scheduleRows = await db.select().from(schedules).where(eq(schedules.id, scheduleId));
      if (scheduleRows.length === 0) {
        throw new GraphQLError('Schedule not found', { extensions: { code: 'NOT_FOUND' } });
      }

      const schedule = scheduleRows[0];
      if (schedule.timezoneStatus !== 'NEEDS_CLARIFICATION') {
        throw new GraphQLError('Schedule timezone is not pending clarification.', {
          extensions: { code: 'INVALID_STATE_TRANSITION' }
        });
      }

      const [updated] = await db.update(schedules)
        .set({
          timezone,
          timezoneStatus: 'RESOLVED' as any,
          updatedAt: new Date(),
        })
        .where(eq(schedules.id, scheduleId))
        .returning();

      return {
        scheduleId: updated.id,
        timezone,
        timezoneStatus: 'RESOLVED' as const,
      };
    },
    registerFcmToken: async (_: any, { token }: any, context: any) => {
      const authUser = requireAuth(context);
      await db.insert(fcmTokens).values({
        token,
        userId: authUser.userId,
      }).onConflictDoUpdate({
        target: fcmTokens.token,
        set: {
          userId: authUser.userId,
          updatedAt: new Date(),
        },
      });
      return true;
    },
    unregisterFcmToken: async (_: any, { token }: any, context: any) => {
      const authUser = requireAuth(context);
      await db.delete(fcmTokens).where(
        and(
          eq(fcmTokens.token, token),
          eq(fcmTokens.userId, authUser.userId)
        )
      );
      return true;
    },
    updateUserTimezone: async (_: any, { timezone }: any, context: any) => {
      const authUser = requireAuth(context);
      if (!isValidIanaTimezone(timezone)) {
        throw new GraphQLError('Invalid IANA timezone.', {
          extensions: { code: 'BAD_REQUEST' }
        });
      }
      const current = await db.select({ timezone: users.timezone }).from(users)
        .where(eq(users.id, authUser.userId))
        .limit(1);
      if (current[0]?.timezone !== timezone) {
        await db.update(users).set({
          timezone,
          updatedAt: new Date(),
        }).where(eq(users.id, authUser.userId));
      }
      return true;
    },
    reportSystemError: async (_: any, { input }: any) => {
      const valid = validateReportSystemError(input);
      if (!valid) {
        throw new GraphQLError('Invalid reportSystemError input', {
          extensions: { code: 'BAD_REQUEST' }
        });
      }

      const env = loadBackendEnv();
      if (env.systemErrorAlertEmail) {
        try {
          await sendTemplatedEmail('SYSTEM_ERROR_ALERT', env.systemErrorAlertEmail, {
            source: input.source,
            message: input.message,
            context: input.context ?? 'None provided',
            timestamp: new Date().toISOString()
          });
        } catch (err) {
          console.error('[reportSystemError] failed to send alert email', err);
        }
      } else {
        console.error('[reportSystemError] SYSTEM_ERROR_ALERT_EMAIL not configured; error not alerted', input);
      }

      return true;
    },
    submitCorrection: async (_: any, { eventId, proposedData, source }: any, context: any) => {
      const authUser = requireAuth(context);

      // 1. Look up event
      const eventRows = await db.select().from(events).where(eq(events.id, eventId));
      if (eventRows.length === 0) {
        throw new GraphQLError('Event not found', { extensions: { code: 'NOT_FOUND' } });
      }

      const validationErrors: { field: string; message: string }[] = [];

      // 2. AJV pass
      const valid = validateProposedEventCorrection(proposedData);
      if (!valid && validateProposedEventCorrection.errors) {
        for (const error of validateProposedEventCorrection.errors) {
          const field = formatAjvInstancePath(error.instancePath, error.params?.missingProperty as string);
          validationErrors.push({
            field,
            message: error.message || 'Validation error'
          });
        }
      }

      // 3. Consistency pass (only if AJV passed)
      if (validationErrors.length === 0) {
        const consistencyErrors = validateCorrectionConsistency(proposedData);
        validationErrors.push(...consistencyErrors);
      }

      // 4. Schedule ownership check (only if AJV passed)
      if (validationErrors.length === 0) {
        const ids = proposedData.schedules.map((s: any) => s.id).filter((id: any): id is string => !!id);
        if (ids.length > 0) {
          const existingSchedules = await db.select()
            .from(schedules)
            .where(and(eq(schedules.eventId, eventId), inArray(schedules.id, ids)));
          const existingIds = new Set(existingSchedules.map((s) => s.id));

          proposedData.schedules.forEach((s: any, index: number) => {
            if (s.id && !existingIds.has(s.id)) {
              validationErrors.push({
                field: `schedules[${index}].id`,
                message: `Schedule ID "${s.id}" does not belong to this event`,
              });
            }
          });
        }
      }

      // 5. If rejected
      if (validationErrors.length > 0) {
        const [inserted] = await db.insert(corrections)
          .values({
            eventId,
            submittedByUserId: authUser.userId,
            proposedData,
            source,
            status: 'rejected',
            resolvedAt: new Date(),
          })
          .returning();

        return {
          ...inserted,
          createdAt: inserted.createdAt.toISOString(),
          resolvedAt: inserted.resolvedAt ? inserted.resolvedAt.toISOString() : null,
          validationErrors,
        } as any;
      }

      // 6. If applied (inside transaction)
      const correction = await db.transaction(async (tx) => {
        // Update event
        await tx.update(events)
          .set({
            eventName: proposedData.eventName,
            types: proposedData.types,
            categories: proposedData.categories,
            location: proposedData.location,
            organizerName: proposedData.organizerName || null,
            contactInfo: proposedData.contactInfo || null,
            description: proposedData.description || null,
            updatedAt: new Date(),
          })
          .where(eq(events.id, eventId));

        // Update/insert schedules
        for (const s of proposedData.schedules) {
          const fields = {
            isMainSchedule: s.isMainSchedule,
            eventStartDate: s.eventStartDate,
            eventEndDate: s.eventEndDate || null,
            eventStartTime: s.eventStartTime || null,
            eventEndTime: s.eventEndTime || null,
            title: s.title || null,
            performers: s.performers || null,
            location: s.location || null,
            ticketPrice: s.ticketPrice || null,
            updatedAt: new Date(),
          };

          if (s.id) {
            await tx.update(schedules)
              .set(fields)
              .where(and(eq(schedules.id, s.id), eq(schedules.eventId, eventId)));
          } else {
            await tx.insert(schedules)
              .values({
                ...fields,
                eventId,
              });
          }
        }

        // Insert applied correction row
        const [inserted] = await tx.insert(corrections)
          .values({
            eventId,
            submittedByUserId: authUser.userId,
            proposedData,
            source,
            status: 'applied',
            resolvedAt: new Date(),
          })
          .returning();

        return inserted;
      });

      return {
        ...correction,
        createdAt: correction.createdAt.toISOString(),
        resolvedAt: correction.resolvedAt ? correction.resolvedAt.toISOString() : null,
        validationErrors: [],
      } as any;
    },
    extractEventDataFromUrl: async (_: any, { url }: any, context: any) => {
      const authUser = requireAuth(context);

      // 1. Dual-lookup posts table
      const existingPostRows = await db
        .select()
        .from(posts)
        .where(or(eq(posts.postUrl, url), eq(posts.originalPostUrl, url)))
        .limit(1);

      let resultText: string;

      if (existingPostRows.length > 0) {
        // Existing-post path
        const post = existingPostRows[0];
        const message = {
          postId: post.id,
          accountId: post.accountId,
          content: post.content,
          imageUrl: post.imageUrl ?? undefined,
          postUrl: post.postUrl,
          publishedAt: post.publishedAt.toISOString(),
        };

        const request = await buildGeminiExtractionRequest(message);

        try {
          const result = await callGemini({
            ...request,
            provider: 'gemini',
            subscriberUserIds: [authUser.userId],
          });
          resultText = result.text;
        } catch (err: any) {
          if (err instanceof AiGatewayExhaustedError) {
            // TIER_2 Shared Round Robin Fallback
            const subscriberUserIds = await getActiveSubscriberUserIds(post.accountId);
            try {
              const result = await callGemini({
                ...request,
                provider: 'gemini',
                subscriberUserIds,
              });
              resultText = result.text;
            } catch (fallbackErr: any) {
              if (fallbackErr instanceof AiGatewayExhaustedError) {
                return {
                  errorCode: 'QUOTA_EXHAUSTED',
                  errorMessage: 'No available Gemini API key to perform this extraction.',
                };
              }
              throw fallbackErr;
            }
          } else {
            throw err;
          }
        }
      } else {
        // New-post path
        const platform = detectPlatformFromUrl(url);
        if (!platform) {
          return {
            errorCode: 'UNSUPPORTED_PLATFORM',
            errorMessage: 'This URL is not from a supported platform.',
          };
        }

        // NO_API_KEY Pre-Check
        const candidates = await fetchCandidateKeys('gemini', [authUser.userId]);
        const chosenKey = selectApiKey(candidates, 'TIER_1_USER_SPECIFIC');
        if (!chosenKey) {
          return {
            errorCode: 'NO_API_KEY',
            errorMessage: 'Contribute your own Gemini API key to use this feature.',
          };
        }

        const adapter = getScraperAdapter(platform);
        let scrapedPost;
        try {
          scrapedPost = await adapter.getPostByUrl(url);
          if (!scrapedPost) {
            return {
              errorCode: 'SCRAPE_FAILED',
              errorMessage: 'Could not retrieve content from the provided URL.',
            };
          }
        } catch (err) {
          console.error(`Failed to scrape post from URL ${url}:`, err);
          return {
            errorCode: 'SCRAPE_FAILED',
            errorMessage: 'Could not retrieve content from the provided URL.',
          };
        }

        const message = {
          postId: randomUUID(),
          accountId: '',
          content: scrapedPost.content,
          imageUrl: scrapedPost.imageUrl ?? undefined,
          postUrl: scrapedPost.postUrl,
          publishedAt: scrapedPost.publishedAt,
        };

        const request = await buildGeminiExtractionRequest(message);

        try {
          const result = await callGemini({
            ...request,
            provider: 'gemini',
            subscriberUserIds: [authUser.userId],
          });
          resultText = result.text;
        } catch (err: any) {
          if (err instanceof AiGatewayExhaustedError) {
            return {
              errorCode: 'QUOTA_EXHAUSTED',
              errorMessage: 'No available Gemini API key to perform this extraction.',
            };
          }
          throw err;
        }
      }

      // Shared response handling
      let payload: any;
      try {
        payload = JSON.parse(resultText);
      } catch {
        return {
          errorCode: 'EXTRACTION_FAILED',
          errorMessage: 'The extracted content could not be validated.',
        };
      }

      const valid = validateExtractedEvent(payload);
      if (!valid) {
        return {
          errorCode: 'EXTRACTION_FAILED',
          errorMessage: 'The extracted content could not be validated.',
        };
      }

      if (payload.isEvent === false) {
        return {
          errorCode: 'EXTRACTION_FAILED',
          errorMessage: 'The linked post does not appear to describe an event.',
        };
      }

      const data = mapExtractionPayloadToProposedCorrection(payload);
      return { data };
    },
    submitReport: async (_: any, { eventId, reason, details }: any, context: any): Promise<any> => {
      const authUser = requireAuth(context);
      const [existingEvent] = await db.select().from(events).where(eq(events.id, eventId));
      if (!existingEvent) {
        throw new GraphQLError('Event not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }
      if (reason === 'dangerous') {
        const existingReport = await db.select()
          .from(reports)
          .where(and(
            eq(reports.reporterUserId, authUser.userId),
            eq(reports.eventId, eventId),
            eq(reports.reason, 'dangerous'),
            eq(reports.moderatorIgnored, true)
          ));
        if (existingReport.length > 0) {
          throw new GraphQLError('This report has already been reviewed and will not be re-submitted.', {
            extensions: { code: 'REPORT_IGNORED' }
          });
        }
      }
      const [newReport] = await db.insert(reports).values({
        eventId,
        reporterUserId: authUser.userId,
        reason,
        details: details ?? null,
        status: 'pending',
      }).returning();

      if (reason === 'cancelled') {
        const cutoff = getCancelledReportWindowCutoff({ windowDays: DEFAULT_CANCELLED_REPORT_WINDOW_DAYS });
        const countRes = await db.select({
          count: sql<number>`count(distinct ${reports.reporterUserId})`
        })
        .from(reports)
        .where(
          and(
            eq(reports.eventId, eventId),
            eq(reports.reason, 'cancelled'),
            gte(reports.createdAt, cutoff)
          )
        );
        const uniqueCount = Number(countRes[0]?.count ?? 0);
        if (shouldSoftDeleteFromCancelledReports({
          uniqueReporterCount: uniqueCount,
          threshold: DEFAULT_CANCELLED_REPORT_THRESHOLD,
        })) {
          await db.update(events)
            .set({ deletedAt: new Date(), updatedAt: new Date() })
            .where(eq(events.id, eventId));
        }
      }

      if (reason === 'dangerous') {
        await sendDangerousReportModeratorAlerts(existingEvent.eventName);
      }

      return {
        ...newReport,
        createdAt: newReport.createdAt.toISOString(),
        resolvedAt: newReport.resolvedAt ? newReport.resolvedAt.toISOString() : null,
      };
    },
    resolveReport: async (_: any, { id, outcome }: any, context: any): Promise<any> => {
      const moderator = requireModerator(context);
      const [report] = await db.select().from(reports).where(eq(reports.id, id));
      if (!report) {
        throw new GraphQLError('Report not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }
      if (report.status !== 'pending') {
        throw new GraphQLError('Report is already resolved', {
          extensions: { code: 'INVALID_STATE_TRANSITION' },
        });
      }
      const [updated] = await db.update(reports).set({
        status: outcome,
        resolvedByModeratorId: moderator.userId,
        resolvedAt: new Date(),
      }).where(eq(reports.id, id)).returning();
      return {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        resolvedAt: updated.resolvedAt ? updated.resolvedAt.toISOString() : null,
      };
    },
    ignoreSubsequentReports: async (_: any, { reportId }: any, context: any): Promise<any> => {
      requireModerator(context);
      const [report] = await db.select().from(reports).where(eq(reports.id, reportId));
      if (!report) {
        throw new GraphQLError('Report not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }
      if (report.reason !== 'dangerous') {
        throw new GraphQLError('ignoreSubsequentReports only applies to dangerous-reason reports', {
          extensions: { code: 'BAD_REQUEST' },
        });
      }
      const [updated] = await db.update(reports).set({
        moderatorIgnored: true,
      }).where(eq(reports.id, reportId)).returning();
      return {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        resolvedAt: updated.resolvedAt ? updated.resolvedAt.toISOString() : null,
      };
    },
    resolveReportsForEvent: async (_: any, { eventId }: any, context: any): Promise<any> => {
      const moderator = requireModerator(context);
      const [existingEvent] = await db.select().from(events).where(eq(events.id, eventId));
      if (!existingEvent) {
        throw new GraphQLError('Event not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const updatedReports = await db.transaction(async (tx) => {
        if (existingEvent.deletedAt !== null) {
          await tx.update(events)
            .set({ deletedAt: null, updatedAt: new Date() })
            .where(eq(events.id, eventId));
        }

        const rows = await tx.update(reports)
          .set({
            status: 'dismissed',
            resolvedByModeratorId: moderator.userId,
            resolvedAt: new Date(),
          })
          .where(and(eq(reports.eventId, eventId), eq(reports.status, 'pending')))
          .returning();

        return rows;
      });

      return updatedReports.map((r: any) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
      }));
    },
    restoreEvent: async (_: any, { id, action }: any, context: any, info: any) => {
      requireModerator(context);
      const existingRows = await db.select().from(events).where(eq(events.id, id));
      if (existingRows.length === 0) {
        throw new GraphQLError('Event not found', { extensions: { code: 'NOT_FOUND' } });
      }

      const existing = existingRows[0];
      if (action === 'DELETE') {
        if (existing.deletedAt !== null) {
          throw new GraphQLError('Event is already deleted', { extensions: { code: 'INVALID_STATE_TRANSITION' } });
        }
        await db.update(events)
          .set({ deletedAt: new Date(), updatedAt: new Date() })
          .where(eq(events.id, id));
      } else if (action === 'RESTORE') {
        if (existing.deletedAt === null) {
          throw new GraphQLError('Event is already active', { extensions: { code: 'INVALID_STATE_TRANSITION' } });
        }
        await db.update(events)
          .set({ deletedAt: null, updatedAt: new Date() })
          .where(eq(events.id, id));
      } else {
        throw new GraphQLError('Invalid action', { extensions: { code: 'BAD_REQUEST' } });
      }

      const requestedFields = buildOptimizedDrizzleSelect(events, info);
      const rows = await db.select({
        ...requestedFields,
        id: events.id,
        postId: events.postId,
        imageUrl: posts.imageUrl,
        videoUrl: posts.videoUrl,
        sourcePostUrl: posts.postUrl,
        originalPostUrl: posts.originalPostUrl,
      }).from(events)
        .leftJoin(posts, eq(events.postId, posts.id))
        .where(eq(events.id, id));

      return (rows[0] as any) || null;
    },
    deleteEventPermanently: async (_: any, { id }: any, context: any) => {
      requireModerator(context);
      const existingRows = await db.select().from(events).where(eq(events.id, id));
      if (existingRows.length === 0) {
        throw new GraphQLError('Event not found', { extensions: { code: 'NOT_FOUND' } });
      }
      await db.delete(events).where(eq(events.id, id));
      return true;
    },
    resolveDefaultLocationChange: async (_: any, { id, action }: any, context: any): Promise<any> => {
      const moderator = requireModerator(context);
      
      const [reqRow] = await db.select()
        .from(defaultLocationChangeRequests)
        .where(eq(defaultLocationChangeRequests.id, id));

      if (!reqRow) {
        throw new GraphQLError('DefaultLocationChangeRequest not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (reqRow.status !== 'PENDING_REVIEW') {
        throw new GraphQLError('DefaultLocationChangeRequest is already resolved', {
          extensions: { code: 'INVALID_STATE_TRANSITION' },
        });
      }

      const updatedRow = await db.transaction(async (tx) => {
        if (action === 'ACCEPT') {
          const [updated] = await tx.update(defaultLocationChangeRequests)
            .set({
              status: 'ACCEPTED',
              reviewedByModeratorId: moderator.userId,
              reviewedAt: new Date(),
            })
            .where(eq(defaultLocationChangeRequests.id, id))
            .returning();
          return updated;
        } else if (action === 'REVERT') {
          if (reqRow.previousLocation === null && reqRow.changeSource !== 'AI_INFERENCE') {
            throw new GraphQLError('Cannot revert change because previous location was not recorded', {
              extensions: { code: 'BAD_REQUEST' },
            });
          }

          await tx.update(socialMediaAccountProfiles)
            .set({
              defaultLocation: reqRow.previousLocation || null,
            })
            .where(eq(socialMediaAccountProfiles.id, reqRow.accountId));

          const [updated] = await tx.update(defaultLocationChangeRequests)
            .set({
              status: 'REVERTED',
              reviewedByModeratorId: moderator.userId,
              reviewedAt: new Date(),
            })
            .where(eq(defaultLocationChangeRequests.id, id))
            .returning();
          return updated;
        } else {
          throw new GraphQLError('Invalid action', {
            extensions: { code: 'BAD_REQUEST' },
          });
        }
      });

      return {
        ...updatedRow,
        previousLocation: formatLocationDetails(updatedRow.previousLocation),
        newLocation: formatLocationDetails(updatedRow.newLocation),
        createdAt: updatedRow.createdAt.toISOString(),
        reviewedAt: updatedRow.reviewedAt ? updatedRow.reviewedAt.toISOString() : null,
      };
    },
    markSubscriptionViewed: async (_: any, { subscriptionId }: any, context: any) => {
      const authUser = requireAuth(context);
      const [updated] = await db.update(subscriptions)
        .set({ isNewlyAdded: false })
        .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.userId, authUser.userId)))
        .returning();
      if (!updated) {
        throw new GraphQLError('Subscription not found', { extensions: { code: 'NOT_FOUND' } });
      }
      return formatSubscription(updated);
    },
    selectPostsForExtraction: async (_: any, { postIds }: any, context: any) => {
      const authUser = requireAuth(context);

      if (postIds.length === 0) {
        return [];
      }

      // Quota check
      const keysRows = await db.select().from(apiKeys)
        .where(and(
          eq(apiKeys.userId, authUser.userId),
          eq(apiKeys.provider, 'gemini'),
          activeOnly(apiKeys)
        ));
      const env = loadBackendEnv();
      const cycleDays = env.apiKeyUsageCycleDays;
      const now = new Date();

      let used = 0;
      for (const row of keysRows) {
        const isElapsed = isCycleElapsed(row.usageCycleResetAt.toISOString(), cycleDays, now);
        used += isElapsed ? 0 : row.usageCount;
      }

      const limit = keysRows.length * 50;
      const remainingQuota = Math.max(0, limit - used);

      if (postIds.length > remainingQuota) {
        throw new GraphQLError('Selection exceeds remaining API quota', {
          extensions: { code: 'QUOTA_EXHAUSTED' }
        });
      }

      // Security Check: hold active subscriptions for all submitted post accounts
      const submitPosts = await db.select({ id: posts.id, accountId: posts.accountId })
        .from(posts)
        .where(inArray(posts.id, postIds));

      if (submitPosts.length !== postIds.length) {
        throw new GraphQLError('One or more posts not found', { extensions: { code: 'NOT_FOUND' } });
      }

      const activeSubs = await db.select({ accountId: subscriptions.accountId })
        .from(subscriptions)
        .where(and(eq(subscriptions.userId, authUser.userId), activeOnly(subscriptions)));
      
      const subAccountIds = new Set(activeSubs.map(s => s.accountId));
      for (const post of submitPosts) {
        if (!subAccountIds.has(post.accountId)) {
          throw new GraphQLError('No active subscription to this account', {
            extensions: { code: 'FORBIDDEN' }
          });
        }
      }

      try {
        for (const postId of postIds) {
          await enqueuePostForProcessing(postId);
        }
      } catch (err: any) {
        if (err instanceof PostAlreadyExtractedError) {
          throw new GraphQLError('Post has already been extracted', { extensions: { code: 'BAD_REQUEST' } });
        }
        if (err instanceof PostNotFoundError) {
          throw new GraphQLError('Post not found', { extensions: { code: 'NOT_FOUND' } });
        }
        throw err;
      }

      const updatedPosts = await db.select().from(posts).where(inArray(posts.id, postIds));
      return updatedPosts.map(p => ({
        ...p,
        publishedAt: p.publishedAt.toISOString()
      }));
    },
    castVote: async (_: any, { input }: any, context: any) => {
      const authUser = requireAuth(context);
      
      let accountId = input.accountId;
      
      if (!accountId) {
        if (!input.platform || !input.handleOrUrl) {
          throw new GraphQLError('accountId or platform + handleOrUrl required', { extensions: { code: 'BAD_REQUEST' } });
        }
        
        if (!SUPPORTED_PLATFORMS.includes(input.platform.toLowerCase() as any)) {
          throw new GraphQLError('Unsupported platform', { extensions: { code: 'BAD_REQUEST' } });
        }
        
        let lookupResult;
        try {
          lookupResult = await lookupAccountProfile(input.platform.toLowerCase() as any, input.handleOrUrl);
        } catch (err) {
          if (err instanceof ApifyRequestTimeoutError) {
            throw new GraphQLError(err.message, { extensions: { code: 'SCRAPE_TIMEOUT' } });
          }
          throw new GraphQLError('Failed to lookup account profile', { extensions: { code: 'BAD_REQUEST' } });
        }
        
        if (!lookupResult) {
          throw new GraphQLError('Account profile lookup failed or account not found on platform', { extensions: { code: 'BAD_REQUEST' } });
        }
        
        const [profile] = await db.insert(socialMediaAccountProfiles)
          .values({
            platform: input.platform.toLowerCase(),
            accountId: lookupResult.accountId,
            username: lookupResult.username,
            displayName: lookupResult.displayName,
            profileImageUrl: lookupResult.profileImageUrl || null,
          })
          .onConflictDoUpdate({
            target: [socialMediaAccountProfiles.platform, socialMediaAccountProfiles.accountId],
            set: {
              username: lookupResult.username,
              displayName: lookupResult.displayName,
              profileImageUrl: lookupResult.profileImageUrl || null,
              updatedAt: new Date(),
            }
          })
          .returning();
          
        accountId = profile.id;
      } else {
        const [profile] = await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, accountId));
        if (!profile) {
          throw new GraphQLError('Social media account profile not found', { extensions: { code: 'NOT_FOUND' } });
        }
      }
      
      const existingVote = await db.select().from(accountVotes)
        .where(and(eq(accountVotes.userId, authUser.userId), eq(accountVotes.accountId, accountId)));

      if (existingVote.length > 0) {
        const vote = existingVote[0];
        if (vote.deletedAt !== null) {
          const [updated] = await db.update(accountVotes)
            .set({ deletedAt: null, createdAt: new Date() })
            .where(eq(accountVotes.id, vote.id))
            .returning();
          return { ...updated, createdAt: updated.createdAt.toISOString(), deletedAt: null };
        }
        return { ...vote, createdAt: vote.createdAt.toISOString(), deletedAt: null };
      }

      const [newVote] = await db.insert(accountVotes)
        .values({
          userId: authUser.userId,
          accountId: accountId,
        })
        .returning();

      return { ...newVote, createdAt: newVote.createdAt.toISOString(), deletedAt: null };
    },
    withdrawVote: async (_: any, { id, action }: any, context: any) => {
      const authUser = requireAuth(context);
      
      const existingVote = await db.select().from(accountVotes)
        .where(and(eq(accountVotes.id, id), eq(accountVotes.userId, authUser.userId)));
        
      if (existingVote.length === 0) {
        throw new GraphQLError('Vote not found', { extensions: { code: 'NOT_FOUND' } });
      }
      
      const vote = existingVote[0];
      if (action === 'DELETE') {
        if (vote.deletedAt !== null) {
          throw new GraphQLError('Vote has already been withdrawn', { extensions: { code: 'INVALID_STATE_TRANSITION' } });
        }
        const [updated] = await db.update(accountVotes)
          .set({ deletedAt: new Date() })
          .where(eq(accountVotes.id, id))
          .returning();
        return { ...updated, createdAt: updated.createdAt.toISOString(), deletedAt: updated.deletedAt ? updated.deletedAt.toISOString() : null };
      } else if (action === 'RESTORE') {
        if (vote.deletedAt === null) {
          throw new GraphQLError('Vote is already active', { extensions: { code: 'INVALID_STATE_TRANSITION' } });
        }
        const [updated] = await db.update(accountVotes)
          .set({ deletedAt: null })
          .where(eq(accountVotes.id, id))
          .returning();
        return { ...updated, createdAt: updated.createdAt.toISOString(), deletedAt: null };
      }
      throw new GraphQLError('Invalid action', { extensions: { code: 'BAD_REQUEST' } });
    },
    createWidget: async (_: any, { input }: any, context: any) => {
      const authUser = requireAuth(context);
      
      if (typeof input.filters !== 'object' || input.filters === null) {
        throw new GraphQLError('Filters must be a valid JSON object', { extensions: { code: 'BAD_REQUEST' } });
      }

      const [inserted] = await db.insert(widgets).values({
        ownerUserId: authUser.userId,
        filters: input.filters,
        displayMode: input.displayMode || 'CARD',
        theme: input.theme || 'LIGHT',
      }).returning();
      return { ...inserted, createdAt: inserted.createdAt.toISOString(), deletedAt: null };
    },
    updateWidget: async (_: any, { id, input }: any, context: any) => {
      const authUser = requireAuth(context);
      
      const [existing] = await db.select().from(widgets).where(and(eq(widgets.id, id), eq(widgets.ownerUserId, authUser.userId)));
      if (!existing) {
        throw new GraphQLError('Widget not found or unauthorized', { extensions: { code: 'NOT_FOUND' } });
      }
      if (existing.deletedAt !== null) {
        throw new GraphQLError('Cannot update a deleted widget', { extensions: { code: 'INVALID_STATE_TRANSITION' } });
      }

      const updateFields: any = {};
      if (input.filters !== undefined) {
        if (typeof input.filters !== 'object' || input.filters === null) {
          throw new GraphQLError('Filters must be a valid JSON object', { extensions: { code: 'BAD_REQUEST' } });
        }
        updateFields.filters = input.filters;
      }
      if (input.displayMode !== undefined) {
        updateFields.displayMode = input.displayMode;
      }
      if (input.theme !== undefined) {
        updateFields.theme = input.theme;
      }

      const [updated] = await db.update(widgets)
        .set(updateFields)
        .where(eq(widgets.id, id))
        .returning();
      return { ...updated, createdAt: updated.createdAt.toISOString(), deletedAt: updated.deletedAt ? updated.deletedAt.toISOString() : null };
    },
    deleteWidget: async (_: any, { id, action }: any, context: any) => {
      const authUser = requireAuth(context);
      const [existing] = await db.select().from(widgets).where(and(eq(widgets.id, id), eq(widgets.ownerUserId, authUser.userId)));
      if (!existing) {
        throw new GraphQLError('Widget not found or unauthorized', { extensions: { code: 'NOT_FOUND' } });
      }

      if (action === 'DELETE') {
        if (existing.deletedAt !== null) {
          throw new GraphQLError('Widget is already deleted', { extensions: { code: 'INVALID_STATE_TRANSITION' } });
        }
        const [updated] = await db.update(widgets)
          .set({ deletedAt: new Date() })
          .where(eq(widgets.id, id))
          .returning();
        return { ...updated, createdAt: updated.createdAt.toISOString(), deletedAt: updated.deletedAt ? updated.deletedAt.toISOString() : null };
      } else if (action === 'RESTORE') {
        if (existing.deletedAt === null) {
          throw new GraphQLError('Widget is already active', { extensions: { code: 'INVALID_STATE_TRANSITION' } });
        }
        const [updated] = await db.update(widgets)
          .set({ deletedAt: null })
          .where(eq(widgets.id, id))
          .returning();
        return { ...updated, createdAt: updated.createdAt.toISOString(), deletedAt: null };
      }
      throw new GraphQLError('Invalid action', { extensions: { code: 'BAD_REQUEST' } });
    },
    registerEmbedDomain: async (_: any, { widgetId, pattern }: any, context: any) => {
      const authUser = requireAuth(context);
      
      const [widget] = await db.select().from(widgets).where(and(eq(widgets.id, widgetId), eq(widgets.ownerUserId, authUser.userId), isNull(widgets.deletedAt)));
      if (!widget) {
        throw new GraphQLError('Widget not found or unauthorized', { extensions: { code: 'NOT_FOUND' } });
      }

      let cleanPattern = pattern.toLowerCase().trim().replace(/^https?:\/\//, '').split('/')[0];
      
      const isWildcard = cleanPattern.startsWith('*.');
      if (isWildcard) {
        const suffix = cleanPattern.slice(2);
        if (!suffix || suffix.includes('*')) {
          throw new GraphQLError('Invalid wildcard pattern format', { extensions: { code: 'BAD_REQUEST' } });
        }
        const parsed = parseTld(suffix, { allowPrivateDomains: true });
        const isPublicSuffix = parsed.publicSuffix === suffix;
        const isSharedHostingDomain = parsed.domain === suffix && parsed.publicSuffix && parsed.publicSuffix.includes('.');
        if (isPublicSuffix || parsed.domain === null || isSharedHostingDomain) {
          throw new GraphQLError(`Wildcard suffix "${suffix}" is a public suffix or shared hosting domain and is not allowed.`, { extensions: { code: 'BAD_REQUEST' } });
        }
      } else {
        if (cleanPattern.includes('*')) {
          throw new GraphQLError('Pattern cannot contain wildcards unless it starts with "*."', { extensions: { code: 'BAD_REQUEST' } });
        }
      }

      const [inserted] = await db.insert(embedDomains)
        .values({
          widgetId,
          pattern: cleanPattern,
        })
        .onConflictDoUpdate({
          target: [embedDomains.widgetId, embedDomains.pattern],
          set: {
            deletedAt: null,
          }
        })
        .returning();
      return { ...inserted, createdAt: inserted.createdAt.toISOString(), deletedAt: null };
    },
    deregisterEmbedDomain: async (_: any, { id, action }: any, context: any) => {
      const authUser = requireAuth(context);
      
      const [existing] = await db.select({
        id: embedDomains.id,
        widgetId: embedDomains.widgetId,
        pattern: embedDomains.pattern,
        deletedAt: embedDomains.deletedAt,
        ownerUserId: widgets.ownerUserId,
      })
      .from(embedDomains)
      .innerJoin(widgets, eq(embedDomains.widgetId, widgets.id))
      .where(and(eq(embedDomains.id, id), eq(widgets.ownerUserId, authUser.userId)));

      if (!existing) {
        throw new GraphQLError('EmbedDomain not found or unauthorized', { extensions: { code: 'NOT_FOUND' } });
      }

      if (action === 'DELETE') {
        if (existing.deletedAt !== null) {
          throw new GraphQLError('Embed domain has already been deregistered', { extensions: { code: 'INVALID_STATE_TRANSITION' } });
        }
        const [updated] = await db.update(embedDomains)
          .set({ deletedAt: new Date() })
          .where(eq(embedDomains.id, id))
          .returning();
        return { ...updated, createdAt: updated.createdAt.toISOString(), deletedAt: updated.deletedAt ? updated.deletedAt.toISOString() : null };
      } else if (action === 'RESTORE') {
        if (existing.deletedAt === null) {
          throw new GraphQLError('Embed domain is already active', { extensions: { code: 'INVALID_STATE_TRANSITION' } });
        }
        const [updated] = await db.update(embedDomains)
          .set({ deletedAt: null })
          .where(eq(embedDomains.id, id))
          .returning();
        return { ...updated, createdAt: updated.createdAt.toISOString(), deletedAt: null };
      }
      throw new GraphQLError('Invalid action', { extensions: { code: 'BAD_REQUEST' } });
    },
    reprocessPayload: async (_: any, { payloadId, parserVersion }: any, context: any) => {
      requireModerator(context);

      // Verify payload exists
      const payloadRows = await db
        .select()
        .from(unprocessedScraperPayloads)
        .where(eq(unprocessedScraperPayloads.id, payloadId))
        .limit(1);

      if (!payloadRows.length || payloadRows[0].deletedAt) {
        return { success: false, message: 'Payload not found or already deleted' };
      }

      // Verify parser version exists
      const versionRows = await db
        .select()
        .from(parserVersionRegistry)
        .where(eq(parserVersionRegistry.version, parserVersion))
        .limit(1);

      if (!versionRows.length) {
        return { success: false, message: `Parser version ${parserVersion} not found in registry` };
      }

      // TODO: Enqueue to AIProcessingQueue
      // For now, return success with a placeholder queueId
      const queueId = randomUUID();

      return {
        success: true,
        queueId,
        message: `Payload requeued to AIProcessingQueue with parser ${parserVersion}`,
      };
    },
    deleteUnprocessedPayload: async (_: any, { payloadId }: any, context: any) => {
      requireModerator(context);

      const result = await db
        .update(unprocessedScraperPayloads)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(unprocessedScraperPayloads.id, payloadId),
            isNull(unprocessedScraperPayloads.deletedAt)
          )
        )
        .returning({ id: unprocessedScraperPayloads.id });

      return result.length > 0;
    },
    replayActorRun: async (_: any, { actorRunId }: any, context: any) => {
      requireModerator(context);
      return replayActorRun(actorRunId);
    },
  },
  Query: {
    health: () => true,
    myReports: async (_: any, __: any, context: any): Promise<any> => {
      const authUser = requireAuth(context);
      const rows = await db.select().from(reports)
        .where(eq(reports.reporterUserId, authUser.userId))
        .orderBy(desc(reports.createdAt));
      return rows.map(r => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
      }));
    },
    reportedEvents: async (_: any, { status, reason }: any, context: any): Promise<any> => {
      requireModerator(context);
      const conditions: any[] = [];
      if (status) {
        conditions.push(eq(reports.status, status));
      }
      if (reason) {
        conditions.push(eq(reports.reason, reason));
      }
      const rows = await db.select()
        .from(reports)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(reports.createdAt));
      return rows.map(r => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
      }));
    },
    pendingDefaultLocationChanges: async (_: any, __: any, context: any): Promise<any> => {
      requireModerator(context);
      const rows = await db.select()
        .from(defaultLocationChangeRequests)
        .where(eq(defaultLocationChangeRequests.status, 'PENDING_REVIEW'))
        .orderBy(asc(defaultLocationChangeRequests.createdAt));

      return rows.map((r) => ({
        ...r,
        previousLocation: formatLocationDetails(r.previousLocation),
        newLocation: formatLocationDetails(r.newLocation),
        createdAt: r.createdAt.toISOString(),
        reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
      }));
    },
    myApiKeys: async (_: any, __: any, context: any) => {
      const authUser = requireAuth(context);
      const rows = await db.select().from(apiKeys)
        .where(and(eq(apiKeys.userId, authUser.userId), activeOnly(apiKeys)))
        .orderBy(desc(apiKeys.createdAt));
      return rows.map(row => formatApiKey(row));
    },
    mySubscriptions: async (_: any, __: any, context: any) => {
      const authUser = requireAuth(context);
      const rows = await db.select().from(subscriptions)
        .where(and(eq(subscriptions.userId, authUser.userId), activeOnly(subscriptions)))
        .orderBy(desc(subscriptions.createdAt));
      return rows.map(row => formatSubscription(row));
    },
    postsByAccount: async (_: any, { accountId, cursor, limit }: any, context: any) => {
      const authUser = requireAuth(context);

      // Security Scope Check: Caller must have an active subscription to the account
      const subRows = await db.select({ id: subscriptions.id })
        .from(subscriptions)
        .where(and(
          eq(subscriptions.userId, authUser.userId),
          eq(subscriptions.accountId, accountId),
          activeOnly(subscriptions)
        ))
        .limit(1);

      if (subRows.length === 0) {
        throw new GraphQLError('No active subscription to this account', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      const qLimit = limit ?? 20;
      const conditions = [eq(posts.accountId, accountId)];
      if (cursor) {
        conditions.push(sql`${posts.publishedAt} < ${new Date(cursor)}`);
      }

      const postsRows = await db.select()
        .from(posts)
        .where(and(...conditions))
        .orderBy(desc(posts.publishedAt))
        .limit(qLimit + 1);

      const hasMore = postsRows.length > qLimit;
      const items = hasMore ? postsRows.slice(0, qLimit) : postsRows;
      const nextCursor = hasMore ? items[items.length - 1].publishedAt.toISOString() : null;

      return {
        items: items.map(p => ({
          ...p,
          publishedAt: p.publishedAt.toISOString()
        })),
        nextCursor,
        hasMore
      };
    },
    myExtractionQuota: async (_: any, __: any, context: any) => {
      const authUser = requireAuth(context);

      const keysRows = await db.select().from(apiKeys)
        .where(and(
          eq(apiKeys.userId, authUser.userId),
          eq(apiKeys.provider, 'gemini'),
          activeOnly(apiKeys)
        ));

      const env = loadBackendEnv();
      const cycleDays = env.apiKeyUsageCycleDays;
      const now = new Date();

      let used = 0;
      for (const row of keysRows) {
        const isElapsed = isCycleElapsed(row.usageCycleResetAt.toISOString(), cycleDays, now);
        used += isElapsed ? 0 : row.usageCount;
      }

      const limit = keysRows.length * 50;
      const remaining = Math.max(0, limit - used);

      return {
        limit,
        used,
        remaining
      };
    },
    socialMediaAccountProfileByAccountId: async (_: any, { platform, accountId }: any, context: any, info: any) => {
      const requestedFields = buildOptimizedDrizzleSelect(socialMediaAccountProfiles, info);
      const rows = await db.select({
        ...requestedFields,
        id: socialMediaAccountProfiles.id,
      }).from(socialMediaAccountProfiles)
        .where(
          and(
            eq(socialMediaAccountProfiles.platform, platform),
            eq(socialMediaAccountProfiles.accountId, accountId)
          )
        );

      const profile = rows[0] as any;
      if (!profile) return null;

      if (profile.defaultLocation) {
        profile.defaultLocation = formatLocationDetails(profile.defaultLocation);
      }

      return profile as any;
    },
    mySettings: async (_: any, __: any, context: any) => {
      const authUser = requireAuth(context);
      const settings = await getOrCreateUserSettings(authUser.userId);
      return {
        ...settings,
        createdAt: settings.createdAt.toISOString(),
        updatedAt: settings.updatedAt.toISOString(),
      } as any;
    },
    previewLocation: async (_: any, { latitude, longitude, placeId }: any, context: any) => {
      requireAuth(context);

      const hasCoords = (latitude !== undefined && latitude !== null) && (longitude !== undefined && longitude !== null);
      const hasPlaceId = placeId !== undefined && placeId !== null;
      const hasPartialCoords = (latitude !== undefined && latitude !== null) || (longitude !== undefined && longitude !== null);

      if (hasPlaceId && hasPartialCoords) {
        throw new GraphQLError('Exactly one of coordinates or placeId is required', { extensions: { code: 'BAD_REQUEST' } });
      }
      if (!hasPlaceId && !hasCoords) {
        throw new GraphQLError('Exactly one of coordinates or placeId is required', { extensions: { code: 'BAD_REQUEST' } });
      }

      const resolved = hasPlaceId
        ? await resolveLocation({ kind: 'PLACE_ID', placeId })
        : await resolveLocation({ kind: 'COORDINATES', coordinates: { latitude, longitude } });

      return formatLocationDetails(resolved) as any;
    },
    addressAutocomplete: async (_: any, { input }: any, context: any) => {
      requireAuth(context);
      return await getAddressPredictions(input);
    },
    myLocations: async (_: any, __: any, context: any) => {
      const authUser = requireAuth(context);
      const rows = await db.select().from(userLocations)
        .where(and(eq(userLocations.userId, authUser.userId), activeOnly(userLocations)))
        .orderBy(asc(userLocations.createdAt));

      return rows.map(row => ({
        ...row,
        locationDetails: formatLocationDetails(row.locationDetails),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })) as any;
    },
    me: async (_: any, __: any, context: any) => {
      const authUser = requireAuth(context);
      const rows = await db.select({
        id: users.id,
        email: users.email,
        role: users.role,
      }).from(users).where(eq(users.id, authUser.userId));

      if (rows.length === 0) {
        throw new Error('User not found');
      }
      return rows[0];
    },
    rankedVoteAccounts: async (_: any, { nearMe, locationPreferenceId }: any, context: any, info: any) => {
      const activeSubs = await db.select({ accountId: subscriptions.accountId })
        .from(subscriptions)
        .where(isNull(subscriptions.deletedAt));
      const excludedAccountIds = activeSubs.map(s => s.accountId);

      let userId: string | null = null;
      try {
        const authUser = requireAuth(context);
        userId = authUser.userId;
      } catch {
        // Not authenticated
      }

      let locationPref: any = null;
      if (nearMe && locationPreferenceId && userId) {
        const [loc] = await db.select().from(userLocations)
          .where(and(eq(userLocations.id, locationPreferenceId), eq(userLocations.userId, userId), isNull(userLocations.deletedAt)));
        if (loc) {
          locationPref = loc;
        }
      }

      const conditions = [isNull(accountVotes.deletedAt)];
      if (excludedAccountIds.length > 0) {
        conditions.push(notInArray(accountVotes.accountId, excludedAccountIds));
      }

      let rows;
      if (locationPref) {
        const callerLat = locationPref.latitude;
        const callerLng = locationPref.longitude;
        const callerRadiusKm = locationPref.radius / 1000;

        const distanceSql = sql`6371 * acos(LEAST(1, GREATEST(-1,
          cos(radians(${callerLat})) * cos(radians(${userLocations.latitude})) *
          cos(radians(${userLocations.longitude}) - radians(${callerLng})) +
          sin(radians(${callerLat})) * sin(radians(${userLocations.latitude}))
        )))`;

        const voterWeights = db.select({
          userId: userLocations.userId,
          weight: sql<number>`MAX(CASE WHEN ${distanceSql} <= ${callerRadiusKm} THEN 10 ELSE 1 END)`.as('weight')
        })
        .from(userLocations)
        .where(isNull(userLocations.deletedAt))
        .groupBy(userLocations.userId)
        .as('voter_weights');

        rows = await db.select({
          accountId: accountVotes.accountId,
          voteCount: sql<number>`count(${accountVotes.id})::int`,
          weightedScore: sql<number>`SUM(COALESCE(${voterWeights.weight}, 1))::int`,
          userVoteId: userId ? sql<string | null>`MAX(CASE WHEN ${accountVotes.userId} = ${userId} THEN ${accountVotes.id}::text ELSE NULL END)` : sql<string | null>`NULL`,
        })
        .from(accountVotes)
        .leftJoin(voterWeights, eq(accountVotes.userId, voterWeights.userId))
        .where(and(...conditions))
        .groupBy(accountVotes.accountId)
        .orderBy(desc(sql`SUM(COALESCE(${voterWeights.weight}, 1))`), desc(sql`count(${accountVotes.id})`));
      } else {
        rows = await db.select({
          accountId: accountVotes.accountId,
          voteCount: sql<number>`count(${accountVotes.id})::int`,
          userVoteId: userId ? sql<string | null>`MAX(CASE WHEN ${accountVotes.userId} = ${userId} THEN ${accountVotes.id}::text ELSE NULL END)` : sql<string | null>`NULL`,
        })
        .from(accountVotes)
        .where(and(...conditions))
        .groupBy(accountVotes.accountId)
        .orderBy(desc(sql`count(${accountVotes.id})`));
      }

      const result = [];
      for (const row of rows) {
        const [profile] = await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, row.accountId));
        if (profile) {
          if (profile.defaultLocation) {
            profile.defaultLocation = formatLocationDetails(profile.defaultLocation);
          }
          result.push({
            profile: profile as any,
            voteCount: row.voteCount,
            userVoteId: row.userVoteId,
          });
        }
      }
      return result;
    },
    voteRegionBreakdown: async (_: any, { accountId }: any, context: any) => {
      const votes = await db.select({
        userId: accountVotes.userId,
        latitude: userLocations.latitude,
        longitude: userLocations.longitude,
        locationDetails: userLocations.locationDetails,
      })
      .from(accountVotes)
      .leftJoin(userLocations, and(eq(accountVotes.userId, userLocations.userId), isNull(userLocations.deletedAt)))
      .where(and(eq(accountVotes.accountId, accountId), isNull(accountVotes.deletedAt)));

      const voterLocationsMap = new Map<string, { latitude: number; longitude: number; city?: string; province?: string }>();
      for (const row of votes) {
        if (row.latitude !== null && row.longitude !== null && !voterLocationsMap.has(row.userId)) {
          const details = row.locationDetails as any;
          voterLocationsMap.set(row.userId, {
            latitude: row.latitude,
            longitude: row.longitude,
            city: details?.city,
            province: details?.province,
          });
        }
      }

      const bucketsMap = new Map<string, number>();
      for (const [_, loc] of voterLocationsMap.entries()) {
        let city = loc.city;
        let province = loc.province;
        if (!city || !province) {
          const resolved = await resolveAdminRegion({ latitude: loc.latitude, longitude: loc.longitude });
          city = resolved.city;
          province = resolved.province;
        }

        if (city && province && city !== 'Unknown' && province !== 'Unknown') {
          const label = `${city}, ${province}`;
          bucketsMap.set(label, (bucketsMap.get(label) || 0) + 1);
        }
      }

      const result = [];
      for (const [label, count] of bucketsMap.entries()) {
        if (count >= 5) {
          result.push({ label, voterCount: count });
        }
      }

      return result;
    },
    votedAccountSuggestions: async (_: any, { query }: any, context: any) => {
      requireAuth(context);

      const activeSubs = await db.select({ accountId: subscriptions.accountId })
        .from(subscriptions)
        .where(isNull(subscriptions.deletedAt));
      const excludedAccountIds = activeSubs.map(s => s.accountId);

      const conditions = [isNull(accountVotes.deletedAt)];
      if (excludedAccountIds.length > 0) {
        conditions.push(notInArray(accountVotes.accountId, excludedAccountIds));
      }

      const profileConditions = [];
      if (query) {
        profileConditions.push(
          or(
            ilike(socialMediaAccountProfiles.username, `%${query}%`),
            ilike(socialMediaAccountProfiles.displayName, `%${query}%`),
            ilike(socialMediaAccountProfiles.platform, `%${query}%`)
          )
        );
      }

      const votesQuery = db.select({
        accountId: accountVotes.accountId,
        voteCount: sql<number>`count(${accountVotes.id})::int`,
        userVoteId: sql<string | null>`MAX(CASE WHEN ${accountVotes.userId} = ${context.user.userId} THEN ${accountVotes.id}::text ELSE NULL END)`,
      })
      .from(accountVotes)
      .innerJoin(socialMediaAccountProfiles, eq(accountVotes.accountId, socialMediaAccountProfiles.id))
      .where(and(
        ...conditions,
        ...(profileConditions.length > 0 ? profileConditions : [])
      ))
      .groupBy(accountVotes.accountId)
      .orderBy(desc(sql`count(${accountVotes.id})`));

      const rows = await votesQuery;

      const result = [];
      for (const row of rows) {
        const [profile] = await db.select().from(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, row.accountId));
        if (profile) {
          if (profile.defaultLocation) {
            profile.defaultLocation = formatLocationDetails(profile.defaultLocation);
          }
          result.push({
            profile: profile as any,
            voteCount: row.voteCount,
            userVoteId: row.userVoteId,
          });
        }
      }
      return result;
    },
    myWidgets: async (_: any, __: any, context: any) => {
      const authUser = requireAuth(context);
      const rows = await db.select().from(widgets).where(and(eq(widgets.ownerUserId, authUser.userId), isNull(widgets.deletedAt)));
      return rows.map(row => ({ ...row, createdAt: row.createdAt.toISOString(), deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null }));
    },
    widgetById: async (_: any, { id }: any, context: any) => {
      const [row] = await db.select().from(widgets).where(and(eq(widgets.id, id), isNull(widgets.deletedAt)));
      return row ? { ...row, createdAt: row.createdAt.toISOString(), deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null } : null;
    },
    embedDomainsForWidget: async (_: any, { widgetId }: any, context: any) => {
      const authUser = requireAuth(context);
      const [widget] = await db.select().from(widgets).where(and(eq(widgets.id, widgetId), eq(widgets.ownerUserId, authUser.userId), isNull(widgets.deletedAt)));
      if (!widget) {
        throw new GraphQLError('Widget not found or unauthorized', { extensions: { code: 'NOT_FOUND' } });
      }
      const rows = await db.select().from(embedDomains).where(and(eq(embedDomains.widgetId, widgetId), isNull(embedDomains.deletedAt)));
      return rows.map(row => ({ ...row, createdAt: row.createdAt.toISOString(), deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null }));
    },
    isOriginAllowedForWidget: async (_: any, { widgetId, origin }: any) => {
      const cleanOrigin = origin.toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
      const activePatterns = await db.select().from(embedDomains).where(and(eq(embedDomains.widgetId, widgetId), isNull(embedDomains.deletedAt)));
      
      for (const row of activePatterns) {
        const pattern = row.pattern.toLowerCase();
        if (pattern.startsWith('*.')) {
          const suffix = pattern.slice(2);
          if (cleanOrigin === suffix || cleanOrigin.endsWith('.' + suffix)) {
            return true;
          }
        } else {
          if (pattern === cleanOrigin) {
            return true;
          }
        }
      }
      return false;
    },
    events: async (_: any, { query, limit, offset, includeSoftDeleted, includeMyArchived }: any, context: any, info: any) => {
      const hasFavoritedEqTrue = (condition: QueryCondition | undefined): boolean => {
        if (!condition) {
          return false;
        }
        if ('conditions' in condition) {
          return condition.conditions.some(hasFavoritedEqTrue);
        }
        return condition.field === 'isFavorited' && condition.operator === 'eq' && condition.value === true;
      };

      const hasWithinRadiusCondition = (condition: QueryCondition | undefined): boolean => {
        if (!condition) return false;
        if ('conditions' in condition) return condition.conditions.some(hasWithinRadiusCondition);
        return condition.operator === 'withinRadius';
      };

      // Create field map for DSL
      // Check auth silently for filter correlations
      let userId: string | null = null;
      try {
        const authUser = requireAuth(context);
        userId = authUser.userId;
      } catch {
        // Not authenticated
      }

      let hidePastEventsAfterDays = DEFAULT_HIDE_PAST_EVENTS_AFTER_DAYS;
      if (userId) {
        const settings = await getOrCreateUserSettings(userId);
        hidePastEventsAfterDays = settings.hidePastEventsAfterDays;
      }

      // Compute threshold precisely matching buildDefaultEventVisibilityConditions
      const now = new Date();
      const utcYear = now.getUTCFullYear();
      const utcMonth = now.getUTCMonth();
      const utcDate = now.getUTCDate();
      const utcMidnight = new Date(Date.UTC(utcYear, utcMonth, utcDate));
      utcMidnight.setUTCDate(utcMidnight.getUTCDate() - hidePastEventsAfterDays);
      const threshold = `${utcMidnight.getUTCFullYear()}-${String(utcMidnight.getUTCMonth() + 1).padStart(2, '0')}-${String(utcMidnight.getUTCDate()).padStart(2, '0')}`;

      const defaultVisibilityConditions = buildDefaultEventVisibilityConditions({ hidePastEventsAfterDays, userId });

      if (hasWithinRadiusCondition(query as QueryCondition | undefined) && userId === null) {
        requireAuth(context);
      }

      let resolvedQuery = query;
      if (userId && hasWithinRadiusCondition(query as QueryCondition | undefined)) {
        const locationRows = await db.select({
          id: userLocations.id,
          latitude: userLocations.latitude,
          longitude: userLocations.longitude,
        }).from(userLocations).where(eq(userLocations.userId, userId));
        
        const locationsById = new Map(locationRows.map(r => [r.id, { latitude: r.latitude, longitude: r.longitude }]));
        try {
          resolvedQuery = resolveWithinRadiusConditions(query as QueryCondition, locationsById) as any;
        } catch (err) {
          if (err instanceof UnknownLocationPreferenceError) {
            throw new GraphQLError('Location not found', { extensions: { code: 'NOT_FOUND' } });
          }
          if (err instanceof InvalidUserLocationInputError) {
            throw new GraphQLError((err as Error).message, { extensions: { code: 'BAD_REQUEST' } });
          }
          throw err;
        }
      }

      // Create field map for DSL
      const fieldMap = {
        id: events.id,
        eventName: events.eventName,
        description: events.description,
        location: events.location,
        types: events.types,
        categories: events.categories,
        sourceSocialMediaAccountId: events.sourceSocialMediaAccountId,
        postId: events.postId,
        socialMediaAccountProfileId: posts.accountId,
        performers: schedules.performers, // mapped to joined table
        scheduleLocation: schedules.location, // to support filtering by schedule location
        scheduleCoordinates: { latColumn: schedules.latitude, lngColumn: schedules.longitude },
        scheduleDateRange: {
          table: schedules,
          eventIdCol: schedules.eventId,
          correlateCol: events.id,
          startCol: schedules.eventStartDate,
          endCol: schedules.eventEndDate,
        },
        isFavorited: userId ? exists(
          db.select({ id: favorites.id })
            .from(favorites)
            .where(and(
              eq(favorites.userId, userId),
              eq(favorites.eventId, events.id),
              activeOnly(favorites)
            ))
        ) : sql`false`,
        isAddedToCalendar: userId ? exists(
          db.select({ id: calendarAdditions.id })
            .from(calendarAdditions)
            .where(and(
              eq(calendarAdditions.userId, userId),
              eq(calendarAdditions.eventId, events.id),
              activeOnly(calendarAdditions)
            ))
        ) : sql`false`,
        isFromSubscribedAccount: userId ? exists(
          db.select({ id: subscriptions.id })
            .from(subscriptions)
            .innerJoin(posts, eq(subscriptions.accountId, posts.accountId))
            .where(and(
              eq(posts.id, events.postId),
              eq(subscriptions.userId, userId),
              activeOnly(subscriptions)
            ))
        ) : sql`false`,
        isReportedByCurrentUser: userId ? exists(
          db.select({ id: reports.id })
            .from(reports)
            .where(and(
              eq(reports.reporterUserId, userId),
              eq(reports.eventId, events.id)
            ))
        ) : sql`false`,
        isPastEvent: sql`NOT EXISTS (SELECT 1 FROM ${schedules} WHERE ${schedules.eventId} = ${events.id} AND daterange(${schedules.eventStartDate}, COALESCE(${schedules.eventEndDate}, ${schedules.eventStartDate}), '[]') && daterange(${threshold}::date, NULL, '[]'))`,
        isHiddenByModeration: sql`(${events.deletedAt} IS NOT NULL)`
      };

      let whereClause;
      if (includeMyArchived === true) {
        requireAuth(context);
        const forcedHiddenCondition: QueryCondition = {
          operator: 'or',
          conditions: [
            { field: 'isPastEvent', operator: 'eq', value: true },
            { field: 'isHiddenByModeration', operator: 'eq', value: true },
            { field: 'isReportedByCurrentUser', operator: 'eq', value: true },
          ],
        };
        const forcedConnectionCondition: QueryCondition = {
          operator: 'or',
          conditions: [
            { field: 'isFavorited', operator: 'eq', value: true },
            { field: 'isAddedToCalendar', operator: 'eq', value: true },
            { field: 'isFromSubscribedAccount', operator: 'eq', value: true },
          ],
        };
        const finalCondition: QueryCondition = {
          operator: 'and',
          conditions: [
            ...(resolvedQuery ? [resolvedQuery as QueryCondition] : []),
            forcedHiddenCondition,
            forcedConnectionCondition,
          ],
        };
        whereClause = buildDrizzleWhere(finalCondition, fieldMap);
      } else {
        const finalCondition: QueryCondition = {
          operator: 'and',
          conditions: [
            ...(resolvedQuery ? [resolvedQuery as QueryCondition] : []),
            ...defaultVisibilityConditions,
          ],
        };
        whereClause = buildDrizzleWhere(finalCondition, fieldMap);

        if (includeSoftDeleted === true) {
          requireModerator(context);
        } else {
          whereClause = whereClause ? and(whereClause as any, activeOnly(events)) : activeOnly(events);
        }
      }
      
      const qLimit = Math.min(limit ?? 1000, 1000);
      const qOffset = offset ?? 0;
      const sortByFavoritedAt = Boolean(userId) && hasFavoritedEqTrue(query as QueryCondition | undefined);

      const requestedFields = buildOptimizedDrizzleSelect(events, info, {
        path: 'items',
      });

      // Note: to filter on schedules' columns safely with a left join, or sort, we filter schedules in the join or where clause.
      // The AC specifies: "default sort order... is by the event's main schedule's eventStartDate/eventStartTime ascending".
      // Let's ensure we only join main schedules for sorting/filtering.
      // Wait, AC1: "join schedules (filtered isMainSchedule = true) for the default sort key"
      
      const mainSchedulesOnly = and(
        eq(events.id, schedules.eventId),
        eq(schedules.isMainSchedule, true)
      );

      const itemsQuery = db.select({
        ...requestedFields,
        id: events.id,
        postId: events.postId,
        imageUrl: posts.imageUrl,
        videoUrl: posts.videoUrl,
        sourcePostUrl: posts.postUrl,
        originalPostUrl: posts.originalPostUrl,
      }).from(events)
        .leftJoin(schedules, mainSchedulesOnly)
        .leftJoin(posts, eq(events.postId, posts.id))
        .$dynamic();

      if (sortByFavoritedAt && userId) {
        itemsQuery.leftJoin(
          favorites,
          and(
            eq(favorites.userId, userId),
            eq(favorites.eventId, events.id),
            activeOnly(favorites)
          )
        );
      }

      if (whereClause) {
        itemsQuery.where(whereClause as any);
      }

      if (sortByFavoritedAt) {
        itemsQuery.orderBy(desc(favorites.createdAt));
      } else {
        itemsQuery.orderBy(asc(schedules.eventStartDate), asc(schedules.eventStartTime));
      }
      itemsQuery.limit(qLimit + 1).offset(qOffset);

      const fetchedItems = await itemsQuery;

      const hasMore = fetchedItems.length > qLimit;
      const items = hasMore ? fetchedItems.slice(0, qLimit) : fetchedItems;

      // Note: Count query could be expensive, but required by schema.
      // If full schema optimization is needed, count should only be fetched if selected.
      const totalCountRes = await db.select({ count: count() as any })
        .from(events)
        .leftJoin(schedules, mainSchedulesOnly)
        .leftJoin(posts, eq(events.postId, posts.id))
        .where(whereClause as any);
      const totalCount = totalCountRes[0]?.count ?? 0;

      return {
        items: items as any, // Cast since buildOptimizedDrizzleSelect returns partial shapes
        hasMore,
        totalCount
      };
    },
    event: async (_: any, { id, includeMyArchived }: any, context: any, info: any) => {
      const requestedFields = buildOptimizedDrizzleSelect(events, info);
      const isModerator = context.user?.role === 'moderator';
      
      let condition;
      if (isModerator) {
        condition = eq(events.id, id);
      } else if (includeMyArchived === true) {
        const authUser = requireAuth(context);
        const userId = authUser.userId;
        const personalConnectionCheck = or(
          exists(
            db.select({ id: favorites.id })
              .from(favorites)
              .where(and(
                eq(favorites.userId, userId),
                eq(favorites.eventId, events.id),
                activeOnly(favorites)
              ))
          ),
          exists(
            db.select({ id: calendarAdditions.id })
              .from(calendarAdditions)
              .where(and(
                eq(calendarAdditions.userId, userId),
                eq(calendarAdditions.eventId, events.id),
                activeOnly(calendarAdditions)
              ))
          ),
          exists(
            db.select({ id: subscriptions.id })
              .from(subscriptions)
              .innerJoin(posts, eq(subscriptions.accountId, posts.accountId))
              .where(and(
                eq(posts.id, events.postId),
                eq(subscriptions.userId, userId),
                activeOnly(subscriptions)
              ))
          ),
          exists(
            db.select({ id: reports.id })
              .from(reports)
              .where(and(
                eq(reports.reporterUserId, userId),
                eq(reports.eventId, events.id)
              ))
          )
        );
        condition = and(
          eq(events.id, id),
          or(
            activeOnly(events),
            and(
              sql`${events.deletedAt} IS NOT NULL`,
              personalConnectionCheck
            )
          )
        );
      } else {
        condition = and(eq(events.id, id), activeOnly(events));
      }

      const rows = await db.select({
        ...requestedFields,
        id: events.id,
        postId: events.postId,
        imageUrl: posts.imageUrl,
        videoUrl: posts.videoUrl,
        sourcePostUrl: posts.postUrl,
        originalPostUrl: posts.originalPostUrl,
      }).from(events)
        .leftJoin(posts, eq(events.postId, posts.id))
        .where(condition);

      return (rows[0] as any) || null;
    },
    eventBySlug: async (_: any, { slug, includeMyArchived }: any, context: any, info: any) => {
      const requestedFields = buildOptimizedDrizzleSelect(events, info);
      const isModerator = context.user?.role === 'moderator';

      let condition;
      if (isModerator) {
        condition = eq(events.slug, slug);
      } else if (includeMyArchived === true) {
        const authUser = requireAuth(context);
        const userId = authUser.userId;
        const personalConnectionCheck = or(
          exists(
            db.select({ id: favorites.id })
              .from(favorites)
              .where(and(
                eq(favorites.userId, userId),
                eq(favorites.eventId, events.id),
                activeOnly(favorites)
              ))
          ),
          exists(
            db.select({ id: calendarAdditions.id })
              .from(calendarAdditions)
              .where(and(
                eq(calendarAdditions.userId, userId),
                eq(calendarAdditions.eventId, events.id),
                activeOnly(calendarAdditions)
              ))
          ),
          exists(
            db.select({ id: subscriptions.id })
              .from(subscriptions)
              .innerJoin(posts, eq(subscriptions.accountId, posts.accountId))
              .where(and(
                eq(posts.id, events.postId),
                eq(subscriptions.userId, userId),
                activeOnly(subscriptions)
              ))
          ),
          exists(
            db.select({ id: reports.id })
              .from(reports)
              .where(and(
                eq(reports.reporterUserId, userId),
                eq(reports.eventId, events.id)
              ))
          )
        );
        condition = and(
          eq(events.slug, slug),
          or(
            activeOnly(events),
            and(
              sql`${events.deletedAt} IS NOT NULL`,
              personalConnectionCheck
            )
          )
        );
      } else {
        condition = and(eq(events.slug, slug), activeOnly(events));
      }

      const rows = await db.select({
        ...requestedFields,
        id: events.id,
        postId: events.postId,
        slug: events.slug,
        imageUrl: posts.imageUrl,
        videoUrl: posts.videoUrl,
        sourcePostUrl: posts.postUrl,
        originalPostUrl: posts.originalPostUrl,
      }).from(events)
        .leftJoin(posts, eq(events.postId, posts.id))
        .where(condition);

      return (rows[0] as any) || null;
    },
    queryUnprocessedPayloads: async (_: any, { filters, first, after }: any, context: any) => {
      requireModerator(context);

      const limit = (first || 10) + 1; // +1 to detect hasNextPage
      const offset = after ? parseInt(Buffer.from(after, 'base64').toString(), 10) : 0;

      const conditions = [isNull(unprocessedScraperPayloads.deletedAt)];

      if (filters?.source) {
        conditions.push(sql`context->>'source' = ${filters.source.toLowerCase()}`);
      }
      if (filters?.createdAfter) {
        conditions.push(gte(unprocessedScraperPayloads.createdAt, new Date(filters.createdAfter)));
      }
      if (filters?.createdBefore) {
        conditions.push(sql`${unprocessedScraperPayloads.createdAt} <= ${new Date(filters.createdBefore)}`);
      }
      if (filters?.parserVersion) {
        conditions.push(sql`context->>'parserVersion' = ${filters.parserVersion}`);
      }

      const rows = await db
        .select()
        .from(unprocessedScraperPayloads)
        .where(and(...conditions))
        .orderBy(desc(unprocessedScraperPayloads.createdAt))
        .limit(limit)
        .offset(offset);

      const hasNextPage = rows.length > (first || 10);
      const edges = rows.slice(0, first || 10).map((row, idx) => ({
        node: row,
        cursor: Buffer.from((offset + idx).toString()).toString('base64'),
      }));

      const endCursor = edges.length > 0 ? edges[edges.length - 1].cursor : null;

      const totalCountRows = await db
        .select({ count: count() })
        .from(unprocessedScraperPayloads)
        .where(and(...conditions));

      return {
        edges,
        pageInfo: { hasNextPage, endCursor },
        totalCount: totalCountRows[0]?.count || 0,
      } as any;
    },
    parserVersions: async (_: any, { onlyActive }: any, context: any) => {
      requireModerator(context);

      const conditions = [];
      if (onlyActive) {
        conditions.push(eq(parserVersionRegistry.isActive, true));
      }

      const rows = await db
        .select()
        .from(parserVersionRegistry)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(parserVersionRegistry.deployedAt));

      return rows;
    },
    queryActorRuns: async (_: any, { filters, first, after }: any, context: any) => {
      requireModerator(context);

      const limit = (first || 10) + 1; // +1 to detect hasNextPage
      const offset = after ? parseInt(Buffer.from(after, 'base64').toString(), 10) : 0;

      const conditions = [];

      if (filters?.vendor) {
        conditions.push(eq(scraperActorRuns.vendor, filters.vendor as any));
      }
      if (filters?.status) {
        conditions.push(eq(scraperActorRuns.status, filters.status as any));
      }
      if (filters?.profileId) {
        conditions.push(eq(scraperActorRuns.profileId, filters.profileId));
      }
      if (filters?.createdAfter) {
        conditions.push(gte(scraperActorRuns.createdAt, new Date(filters.createdAfter)));
      }
      if (filters?.createdBefore) {
        conditions.push(lte(scraperActorRuns.createdAt, new Date(filters.createdBefore)));
      }

      const rows = await db
        .select()
        .from(scraperActorRuns)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(scraperActorRuns.createdAt))
        .limit(limit)
        .offset(offset);

      const hasNextPage = rows.length > (first || 10);
      const edges = rows.slice(0, first || 10).map((row, idx) => ({
        node: row,
        cursor: Buffer.from((offset + idx).toString()).toString('base64'),
      }));

      const endCursor = edges.length > 0 ? edges[edges.length - 1].cursor : null;

      const totalCountRows = await db
        .select({ count: count() })
        .from(scraperActorRuns)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return {
        edges,
        pageInfo: { hasNextPage, endCursor },
        totalCount: totalCountRows[0]?.count || 0,
      };
    }
  },
  RankedAccountVote: {
    profile: async (parent: any, _: any, context: any, info: any) => {
      if (parent.profile) {
        return parent.profile;
      }
      const requestedFields = buildOptimizedDrizzleSelect(socialMediaAccountProfiles, info);
      const rows = await db.select({
        ...requestedFields,
        id: socialMediaAccountProfiles.id,
      }).from(socialMediaAccountProfiles)
        .where(eq(socialMediaAccountProfiles.id, parent.accountId || parent.profileId));
      
      const profile = rows[0] as any;
      if (profile && profile.defaultLocation) {
        profile.defaultLocation = formatLocationDetails(profile.defaultLocation);
      }
      return profile || null;
    }
  },
  AccountVote: {
    createdAt: (parent: any) => parent.createdAt instanceof Date ? parent.createdAt.toISOString() : parent.createdAt,
    deletedAt: (parent: any) => parent.deletedAt instanceof Date ? parent.deletedAt.toISOString() : (parent.deletedAt || null),
  },
  Widget: {
    createdAt: (parent: any) => parent.createdAt instanceof Date ? parent.createdAt.toISOString() : parent.createdAt,
    deletedAt: (parent: any) => parent.deletedAt instanceof Date ? parent.deletedAt.toISOString() : (parent.deletedAt || null),
  },
  EmbedDomain: {
    createdAt: (parent: any) => parent.createdAt instanceof Date ? parent.createdAt.toISOString() : parent.createdAt,
    deletedAt: (parent: any) => parent.deletedAt instanceof Date ? parent.deletedAt.toISOString() : (parent.deletedAt || null),
  },
  DefaultLocationChangeRequest: {
    account: async (parent: any, _: any, __: any, info: any) => {
      const requestedFields = buildOptimizedDrizzleSelect(socialMediaAccountProfiles, info);
      const rows = await db.select({
        ...requestedFields,
        id: socialMediaAccountProfiles.id,
      }).from(socialMediaAccountProfiles)
        .where(eq(socialMediaAccountProfiles.id, parent.accountId));

      const profile = rows[0] as any;
      if (profile && profile.defaultLocation) {
        profile.defaultLocation = formatLocationDetails(profile.defaultLocation);
      }

      return profile || null;
    }
  },
  Report: {
    event: async (parent: any, _: any, __: any, info: any) => {
      const requestedFields = buildOptimizedDrizzleSelect(events, info);
      const rows = await db.select({
        ...requestedFields,
        id: events.id,
        postId: events.postId,
        slug: events.slug,
        imageUrl: posts.imageUrl,
        videoUrl: posts.videoUrl,
        sourcePostUrl: posts.postUrl,
        originalPostUrl: posts.originalPostUrl,
      }).from(events)
        .leftJoin(posts, eq(events.postId, posts.id))
        .where(eq(events.id, parent.eventId));
      
      return (rows[0] as any) || null;
    }
  },
  Event: {
    sourceSocialMediaAccountProfile: async (parent: any, args: any, context: any, info: any) => {
      if (!parent.postId) {
        return null;
      }
      const requestedFields = buildOptimizedDrizzleSelect(socialMediaAccountProfiles, info);
      const rows = await db.select({
        ...requestedFields,
        id: socialMediaAccountProfiles.id
      }).from(socialMediaAccountProfiles)
        .innerJoin(posts, eq(posts.accountId, socialMediaAccountProfiles.id))
        .where(eq(posts.id, parent.postId));

      return (rows[0] as any) || null;
    },
    schedules: async (parent: any, args: any, context: any, info: any) => {
      const requestedFields = buildOptimizedDrizzleSelect(schedules, info);
      const rows = await db.select({
        ...requestedFields,
        id: schedules.id
      }).from(schedules).where(eq(schedules.eventId, parent.id));
      return rows as any;
    },
    imageUrl: (parent: any) => parent.imageUrl || null,
    videoUrl: (parent: any) => parent.videoUrl || null,
    sourcePostUrl: (parent: any) => parent.sourcePostUrl || null,
    originalPostUrl: (parent: any) => parent.originalPostUrl || null,
    isFavorited: async (parent: any, _: any, context: any) => {
      try {
        const authUser = requireAuth(context);
        const rows = await db.select({ id: favorites.id })
          .from(favorites)
          .where(and(
            eq(favorites.userId, authUser.userId),
            eq(favorites.eventId, parent.id),
            activeOnly(favorites)
          ));
        return rows.length > 0;
      } catch {
        return false;
      }
    },
    favoriteCount: async (parent: any) => {
      const rows = await db.select({ count: count() })
        .from(favorites)
        .where(and(
          eq(favorites.eventId, parent.id),
          activeOnly(favorites)
        ));
      return rows[0]?.count ?? 0;
    },
    isAddedToCalendar: async (parent: any, _: any, context: any) => {
      try {
        const authUser = requireAuth(context);
        const rows = await db.select({ id: calendarAdditions.id })
          .from(calendarAdditions)
          .where(and(
            eq(calendarAdditions.userId, authUser.userId),
            eq(calendarAdditions.eventId, parent.id),
            activeOnly(calendarAdditions)
          ));
        return rows.length > 0;
      } catch {
        return false;
      }
    },
    isHiddenForCurrentUser: async (parent: any, _: any, context: any) => {
      try {
        const authUser = requireAuth(context);
        const rows = await db.select({ id: reports.id })
          .from(reports)
          .where(and(eq(reports.reporterUserId, authUser.userId), eq(reports.eventId, parent.id)));
        return rows.length > 0;
      } catch {
        return false;
      }
    },
    isExpiredForCurrentUser: async (parent: any, _: any, context: any) => {
      try {
        const authUser = requireAuth(context);
        const settings = await getOrCreateUserSettings(authUser.userId);
        const hidePastEventsAfterDays = settings.hidePastEventsAfterDays;

        const now = new Date();
        const utcYear = now.getUTCFullYear();
        const utcMonth = now.getUTCMonth();
        const utcDate = now.getUTCDate();
        const utcMidnight = new Date(Date.UTC(utcYear, utcMonth, utcDate));
        utcMidnight.setUTCDate(utcMidnight.getUTCDate() - hidePastEventsAfterDays);
        const threshold = `${utcMidnight.getUTCFullYear()}-${String(utcMidnight.getUTCMonth() + 1).padStart(2, '0')}-${String(utcMidnight.getUTCDate()).padStart(2, '0')}`;

        // Negated past-event overlaps check
        const rows = await db.select({ id: schedules.id })
          .from(schedules)
          .where(and(
            eq(schedules.eventId, parent.id),
            sql`daterange(${schedules.eventStartDate}, COALESCE(${schedules.eventEndDate}, ${schedules.eventStartDate}), '[]') && daterange(${threshold}::date, NULL, '[]')`
          ));
        return rows.length === 0;
      } catch {
        return false;
      }
    }
  },
  Schedule: {
    isAddedToCalendar: async (parent: any, _: any, context: any) => {
      try {
        const authUser = requireAuth(context);
        const rows = await db.select({ id: calendarAdditions.id })
          .from(calendarAdditions)
          .where(and(
            eq(calendarAdditions.userId, authUser.userId),
            eq(calendarAdditions.scheduleId, parent.id),
            activeOnly(calendarAdditions)
          ));
        return rows.length > 0;
      } catch {
        return false;
      }
    }
  }
};
