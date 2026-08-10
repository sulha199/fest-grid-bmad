import { EventType, EventCategory, LocationDetails } from '@festgrid/shared-types';
import { GeminiExtractionPayload, ExtractedEventMessage, ExtractedScheduleMessage } from './types.js';

export function transformGeminiResponseToEventInfo(
  payload: GeminiExtractionPayload,
  context: {
    postId: string;
    sourceSocialMediaAccountId: string;
    defaultLocation?: LocationDetails;
    resolvedScheduleLocations: Map<number, LocationDetails>;
  }
): ExtractedEventMessage {
  // 1. Filter valid types and categories, fallback to OTHER if empty
  const validTypes = payload.types.filter((t): t is EventType =>
    Object.values(EventType).includes(t as EventType)
  );
  const types = validTypes.length > 0 ? validTypes : [EventType.OTHER];

  const validCategories = payload.categories.filter((c): c is EventCategory =>
    Object.values(EventCategory).includes(c as EventCategory)
  );
  const categories = validCategories.length > 0 ? validCategories : [EventCategory.OTHER];

  // 2. Resolve top-level location
  const location = payload.location || (context.defaultLocation
    ? (context.defaultLocation.formattedAddress ?? context.defaultLocation.placeName)
    : undefined);

  // 3. Map schedules, attaching resolved schedule locations
  const schedules: ExtractedScheduleMessage[] = payload.schedules.map((sch, i) => {
    const locationDetails = context.resolvedScheduleLocations.get(i);
    return {
      isMainSchedule: sch.isMainSchedule,
      eventStartDate: sch.eventStartDate,
      eventEndDate: sch.eventEndDate,
      eventStartTime: sch.eventStartTime,
      eventEndTime: sch.eventEndTime,
      title: sch.title,
      performers: sch.performers,
      location: sch.location,
      ticketPrice: sch.ticketPrice,
      locationDetails
    };
  });

  return {
    postId: context.postId,
    sourceSocialMediaAccountId: context.sourceSocialMediaAccountId,
    eventName: payload.eventName,
    types,
    categories,
    schedules,
    location,
    organizerName: payload.organizerName,
    contactInfo: payload.contactInfo,
    description: payload.description,
    confidenceScore: payload.confidenceScore
  };
}
