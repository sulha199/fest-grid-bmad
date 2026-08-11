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

  return {
    eventName: payload.eventName,
    types: (payload.types || []) as EventType[],
    categories: (payload.categories || []) as EventCategory[],
    location: payload.location || '',
    organizerName: payload.organizerName,
    contactInfo: payload.contactInfo,
    description: payload.description,
    schedules,
  };
}
