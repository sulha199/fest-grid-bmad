import { EventType, EventCategory } from '@festgrid/shared-types';
import { GeminiEventPayload, ProposedEventCorrection, ProposedScheduleCorrection } from './types.js';
import { sanitizeEventLinks } from './sanitize-event-links.js';

// Story 3.6s — retyped from GeminiExtractionPayload (now the post-level `events[]` wrapper) to
// GeminiEventPayload: this function always maps exactly one event into one correction preview
// (Story 4.2a's on-demand AI-assisted correction flow targets exactly one existing event), so
// its caller (apps/backend's submitCorrectionPreview-style resolver) is responsible for
// selecting the single event to pass here -- see that call site for how a multi-event response
// is handled (out of this story's AC scope, but required to keep the resolver compiling/working
// against the restructured payload shape).
export function mapExtractionPayloadToProposedCorrection(payload: GeminiEventPayload): ProposedEventCorrection {
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
    // Story 4.10 (AC6) — previously silently dropped payload.links. Reuses the
    // already-tested sanitizer so the AI-assisted preview path matches the manual path.
    links: sanitizeEventLinks(payload.links),
  };
}
