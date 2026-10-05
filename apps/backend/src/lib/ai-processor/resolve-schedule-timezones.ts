import { db } from '../../db/client.js';
import { users } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { LocationDetails } from '@festgrid/shared-types';
import { GeminiSchedulePayload, ScheduleTimezoneResolution } from '@festgrid/domain';

export async function resolveScheduleTimezones(
  schedules: GeminiSchedulePayload[],
  resolvedScheduleLocations: Map<number, LocationDetails>,
  subscriberUserIds: string[],
  accountTimezone?: string | null
): Promise<Map<number, ScheduleTimezoneResolution>> {
  const resolutions = new Map<number, ScheduleTimezoneResolution>();
  
  // Memoized subscriber timezone lookup
  let memoizedSubscriberTimezone: string | null | undefined = undefined; // undefined means not yet looked up, null means looked up but was null/failed

  for (let i = 0; i < schedules.length; i++) {
    const tier1Timezone = resolvedScheduleLocations.get(i)?.timezone;
    if (tier1Timezone) {
      resolutions.set(i, {
        timezone: tier1Timezone,
        timezoneStatus: 'RESOLVED',
      });
      continue;
    }

    // Tier 2: the source account's own timezone (its default location's IANA timezone). The
    // event's organizer is the best available proxy for where the event happens, and unlike the
    // subscriber tier it is available for every post, so viewers are never asked to supply it.
    if (accountTimezone) {
      resolutions.set(i, {
        timezone: accountTimezone,
        timezoneStatus: 'RESOLVED',
      });
      continue;
    }

    // Tier 3: if we have exactly 1 subscriber
    if (subscriberUserIds.length === 1) {
      const subscriberId = subscriberUserIds[0];
      
      if (memoizedSubscriberTimezone === undefined) {
        try {
          const rows = await db
            .select({ timezone: users.timezone })
            .from(users)
            .where(eq(users.id, subscriberId))
            .limit(1);
          
          if (rows.length > 0 && rows[0].timezone) {
            memoizedSubscriberTimezone = rows[0].timezone;
          } else {
            memoizedSubscriberTimezone = null;
          }
        } catch (error) {
          console.error(`Error looking up subscriber ${subscriberId} timezone:`, error);
          memoizedSubscriberTimezone = null; // Degrade to NEEDS_CLARIFICATION on failure
        }
      }

      if (memoizedSubscriberTimezone) {
        resolutions.set(i, {
          timezone: memoizedSubscriberTimezone,
          timezoneStatus: 'RESOLVED',
        });
        continue;
      }
    }

    // Fall back to Tier 4 (NEEDS_CLARIFICATION, resolvable by a moderator only)
    resolutions.set(i, {
      timezone: undefined,
      timezoneStatus: 'NEEDS_CLARIFICATION',
    });
  }

  return resolutions;
}
