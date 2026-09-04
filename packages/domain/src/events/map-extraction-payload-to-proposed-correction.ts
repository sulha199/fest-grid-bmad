import { EventType, EventCategory } from '@festgrid/shared-types';
import { GeminiExtractionPayload, ProposedEventCorrection, ProposedScheduleCorrection } from './types.js';

export function mapExtractionPayloadToProposedCorrection(payload: GeminiExtractionPayload): ProposedEventCorrection {
  const schedules: ProposedScheduleCorrection[] = (payload.schedules || []).map((s) => ({
    id: undefined,
    isMainSchedule: s.isMainSchedule,
    eventStartDate: s.eventStartDate,
    eventEndDate: s.eventEndDate,
    eventStartTime: s.eventStartTime,
    eventEndTime: s.eventEndTime,
    title: s.title,
    performers: s.performers,
    location: s.location,
    ticketPrice: s.ticketPrice,
  }));

  // Discard-at-classification enforcement (AC5): same rule as
  // transformGeminiResponseToEventInfo (Task 3) applied at this second call site --
  // a private-contact classification always wins over whatever contactInfo the
  // prompt/schema separation returned, closing the parallel leak in the
  // AI-assisted correction preview path (extractEventDataFromUrl).
  const contactInfo = payload.hasPrivateContact === true ? undefined : payload.contactInfo;

  return {
    eventName: payload.eventName,
    types: (payload.types || []) as EventType[],
    categories: (payload.categories || []) as EventCategory[],
    location: payload.location || '',
    organizerName: payload.organizerName,
    contactInfo,
    description: payload.description,
    schedules,
  };
}
