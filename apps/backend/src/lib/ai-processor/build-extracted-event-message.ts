import type { ExtractedEventMessage, GeminiEventPayload } from '@festgrid/domain';
import { transformGeminiResponseToEventInfo } from '@festgrid/domain/events';
import type { LocationDetails } from '@festgrid/shared-types';
import { resolveAccountAndLocations } from './resolve-account-and-locations.js';
import { resolveScheduleTimezones } from './resolve-schedule-timezones.js';

export interface BuildExtractedEventMessageContext {
  postId: string;
  /** The post's account profile uuid (`posts.account_id`), as `ProcessingJobMessage.accountId`. */
  accountId: string;
  subscriberUserIds: string[];
  /** The caption, while the caller still has it (the children's-data filter reads it). */
  sourcePostText?: string;
  /** The filter's verdict, when the caller no longer has the caption (the re-extract Apply). */
  childrensDataMatch?: boolean;
}

/**
 * One extracted event -> the `ExtractedEventMessage` ingestion consumes: resolves the schedule
 * locations (geocoding) and timezones, then transforms. Moved out of `processAiJob`'s per-event loop
 * unchanged so the moderator re-extract Apply (AD-40) builds its events exactly as extraction does,
 * with real locations and timezones, instead of a second copy of these three calls.
 */
export async function buildExtractedEventMessage(
  event: GeminiEventPayload,
  context: BuildExtractedEventMessageContext
): Promise<{ eventMessage: ExtractedEventMessage; defaultLocation: LocationDetails | undefined }> {
  const { sourceSocialMediaAccountId, defaultLocation, resolvedScheduleLocations } = await resolveAccountAndLocations(
    context.accountId,
    event.schedules,
    event.location
  );

  const scheduleTimezoneResolutions = await resolveScheduleTimezones(
    event.schedules,
    resolvedScheduleLocations,
    context.subscriberUserIds,
    defaultLocation?.timezone
  );

  const eventMessage = transformGeminiResponseToEventInfo(event, {
    postId: context.postId,
    sourceSocialMediaAccountId,
    defaultLocation,
    resolvedScheduleLocations,
    scheduleTimezoneResolutions,
    sourcePostText: context.sourcePostText,
    childrensDataMatch: context.childrensDataMatch,
  });

  return { eventMessage, defaultLocation };
}
