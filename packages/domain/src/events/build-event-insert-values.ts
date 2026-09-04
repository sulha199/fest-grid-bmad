import { ExtractedEventMessage, EventInsertValues, ScheduleInsertValues, ExtractedScheduleMessage } from './types.js';

export function buildEventInsertValues(message: ExtractedEventMessage): {
  event: EventInsertValues;
  schedules: ScheduleInsertValues[];
} {
  const event: EventInsertValues = {
    postId: message.postId,
    sourceSocialMediaAccountId: message.sourceSocialMediaAccountId,
    eventName: message.eventName,
    types: message.types || [],
    categories: message.categories || [],
    location: message.location ?? 'Location not specified',
    organizerName: message.organizerName || null,
    contactInfo: message.contactInfo || null,
    hasPrivateContact: message.hasPrivateContact ?? false,
    description: message.description || null,
    confidenceScore: message.confidenceScore ?? null,
  };

  const schedules: ScheduleInsertValues[] = (message.schedules || []).map((s: ExtractedScheduleMessage) => {
    return {
      isMainSchedule: s.isMainSchedule,
      eventStartDate: s.eventStartDate,
      eventEndDate: s.eventEndDate || null,
      eventStartTime: s.eventStartTime || null,
      eventEndTime: s.eventEndTime || null,
      title: s.title || null,
      performers: s.performers || null,
      location: s.location || null,
      ticketPrice: s.ticketPrice || null,
      locationDetails: s.locationDetails || null,
      latitude: s.locationDetails?.coordinates?.latitude ?? null,
      longitude: s.locationDetails?.coordinates?.longitude ?? null,
      timezone: s.timezone || null,
      timezoneStatus: s.timezoneStatus || null,
    };
  });

  return { event, schedules };
}
