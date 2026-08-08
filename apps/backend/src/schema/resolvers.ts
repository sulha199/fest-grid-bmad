import { Resolvers } from '../generated/resolvers-types.js';
import { db } from '../db/client.js';
import { events, schedules, posts, users, favorites, calendarAdditions, userLocations, userSettings, fcmTokens, socialMediaAccountProfiles, apiKeys, subscriptions, defaultLocationChangeRequests } from '@festgrid/database';
import { buildOptimizedDrizzleSelect, buildDrizzleWhere, activeOnly } from '@festgrid/graphql-select';
import { requireAuth } from '../lib/auth/context.js';
import { eq, count, sql, asc, and, exists, desc } from 'drizzle-orm';
import { QueryCondition, resolveWithinRadiusConditions, UnknownLocationPreferenceError } from '@festgrid/domain/query';
import { resolveLocationInputMode, validateRadiusMeters, InvalidUserLocationInputError } from '@festgrid/domain/user-locations';
import { validateHidePastEventsAfterDays, InvalidUserSettingsInputError } from '@festgrid/domain/user-settings';
import { getOrCreateUserSettings } from '../lib/user-settings/get-or-create-user-settings.js';
import { resolveLocation, getAddressPredictions } from '../lib/geolocation/adapter.js';
import { GraphQLJSON } from 'graphql-scalars';
import { GraphQLError } from 'graphql';
import { buildDefaultEventVisibilityConditions, DEFAULT_HIDE_PAST_EVENTS_AFTER_DAYS } from '@festgrid/domain/events';
import { SUPPORTED_PLATFORMS } from '@festgrid/domain/subscriptions';
import { ScraperCapacityExceededError } from '@festgrid/domain';
import { subscribeToAccount as subscribeToAccountFn } from '../lib/subscriptions/subscribe-to-account.js';
import { encryptApiKey } from '../lib/ai-gateway/kms.js';
import { compileValidator } from '../validation/validate.js';
import { reportSystemErrorSchema } from '../validation/report-system-error.schema.js';
import { sendTemplatedEmail } from '../lib/email/adapter.js';
import { loadBackendEnv } from '../env.js';

const validateReportSystemError = compileValidator<any>(reportSystemErrorSchema);

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
  } as any,
  Mutation: {
    createApiKey: async (_: any, { input }: any, context: any) => {
      const authUser = requireAuth(context);
      if (input.provider.toLowerCase() !== 'gemini') {
        throw new GraphQLError('Unsupported provider', { extensions: { code: 'BAD_REQUEST' } });
      }
      const keyEncrypted = await encryptApiKey(input.key);
      const keyLast4 = input.key.slice(-4);
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
    editAccountDefaultLocation: async (_: any, { accountId, input }: any, context: any, info: any) => {
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

        // 5. Update social_media_account_profiles set default_location = resolved
        await db.update(socialMediaAccountProfiles)
          .set({
            defaultLocation: newLocation,
          })
          .where(eq(socialMediaAccountProfiles.id, accountId));

        // 6. Insert into default_location_change_requests
        await db.insert(defaultLocationChangeRequests).values({
          accountId,
          changedByUserId: authUser.userId,
          previousLocation,
          newLocation,
          status: 'PENDING_REVIEW' as any,
        });

        // 7. Get moderators and send notification emails (best effort, async, non-blocking)
        try {
          const moderators = await db.select().from(users).where(eq(users.role, 'moderator'));
          if (moderators.length > 0) {
            const previousLocationText = previousLocation.formattedAddress || previousLocation.placeName || 'Unknown';
            const newLocationText = newLocation.formattedAddress || newLocation.placeName || 'Unknown';
            const moderatorReviewUrl = `${loadBackendEnv().webAppBaseUrl}/moderator/items`;
            
            // Trigger best-effort email dispatch for each moderator in parallel
            Promise.allSettled(
              moderators.map((mod) => 
                sendTemplatedEmail(
                  'DEFAULT_LOCATION_CHANGE_MODERATOR_ALERT',
                  mod.email,
                  {
                    accountDisplayName: profile.displayName,
                    previousLocationText,
                    newLocationText,
                    moderatorReviewUrl,
                  }
                )
              )
            ).catch((err) => {
              console.error('Failed sending moderator emails:', err);
            });
          }
        } catch (emailErr) {
          console.error('Failed loading moderators or triggering email send:', emailErr);
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
    }
  },
  Query: {
    health: () => true,
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
    events: async (_: any, { query, limit, offset }: any, context: any, info: any) => {
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

      const defaultVisibilityConditions = buildDefaultEventVisibilityConditions({ hidePastEventsAfterDays });

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
        ) : sql`false`
      };

      const finalCondition: QueryCondition = {
        operator: 'and',
        conditions: [
          ...(resolvedQuery ? [resolvedQuery as QueryCondition] : []),
          ...defaultVisibilityConditions,
        ],
      };
      const whereClause = buildDrizzleWhere(finalCondition, fieldMap);
      
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
        .where(whereClause as any);
      const totalCount = totalCountRes[0]?.count ?? 0;

      return {
        items: items as any, // Cast since buildOptimizedDrizzleSelect returns partial shapes
        hasMore,
        totalCount
      };
    },
    event: async (_: any, { id }: any, context: any, info: any) => {
      const requestedFields = buildOptimizedDrizzleSelect(events, info);
      const rows = await db.select({
        ...requestedFields,
        id: events.id,
        postId: events.postId,
        imageUrl: posts.imageUrl,
        sourcePostUrl: posts.postUrl,
        originalPostUrl: posts.originalPostUrl,
      }).from(events)
        .leftJoin(posts, eq(events.postId, posts.id))
        .where(eq(events.id, id));

      return (rows[0] as any) || null;
    },
    eventBySlug: async (_: any, { slug }: any, context: any, info: any) => {
      const requestedFields = buildOptimizedDrizzleSelect(events, info);
      const rows = await db.select({
        ...requestedFields,
        id: events.id,
        postId: events.postId,
        slug: events.slug,
        imageUrl: posts.imageUrl,
        sourcePostUrl: posts.postUrl,
        originalPostUrl: posts.originalPostUrl,
      }).from(events)
        .leftJoin(posts, eq(events.postId, posts.id))
        .where(eq(events.slug, slug));

      return (rows[0] as any) || null;
    }
  },
  Event: {
    schedules: async (parent: any, args: any, context: any, info: any) => {
      const requestedFields = buildOptimizedDrizzleSelect(schedules, info);
      const rows = await db.select({
        ...requestedFields,
        id: schedules.id
      }).from(schedules).where(eq(schedules.eventId, parent.id));
      return rows as any;
    },
    imageUrl: (parent: any) => parent.imageUrl || null,
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
