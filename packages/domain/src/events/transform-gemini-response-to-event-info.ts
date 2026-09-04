import { EventType, EventCategory, LocationDetails } from '@festgrid/shared-types';
import { GeminiExtractionPayload, ExtractedEventMessage, ExtractedScheduleMessage, ScheduleTimezoneResolution } from './types.js';

export function transformGeminiResponseToEventInfo(
  payload: GeminiExtractionPayload,
  context: {
    postId: string;
    sourceSocialMediaAccountId: string;
    defaultLocation?: LocationDetails;
    resolvedScheduleLocations: Map<number, LocationDetails>;
    scheduleTimezoneResolutions?: Map<number, ScheduleTimezoneResolution>;
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

  // 3. Map schedules, attaching resolved schedule locations and timezone resolutions
  const schedules: ExtractedScheduleMessage[] = payload.schedules.map((sch, i) => {
    const locationDetails = context.resolvedScheduleLocations.get(i);
    const timezoneResolution = context.scheduleTimezoneResolutions?.get(i);
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
      locationDetails,
      timezone: timezoneResolution?.timezone,
      timezoneStatus: timezoneResolution?.timezoneStatus
    };
  });

  // 4. Discard-at-classification enforcement (AC2): a private-contact classification
  // always wins over whatever contactInfo the prompt/schema separation returned --
  // never trust that separation alone, since a model response is not contractually
  // bound to honor it. The raw private value is never passed through.
  const contactInfo = payload.hasPrivateContact === true ? undefined : payload.contactInfo;

  return {
    postId: context.postId,
    sourceSocialMediaAccountId: context.sourceSocialMediaAccountId,
    eventName: payload.eventName,
    types,
    categories,
    schedules,
    location,
    organizerName: payload.organizerName,
    contactInfo,
    hasPrivateContact: payload.hasPrivateContact,
    description: payload.description,
    confidenceScore: payload.confidenceScore
  };
}
