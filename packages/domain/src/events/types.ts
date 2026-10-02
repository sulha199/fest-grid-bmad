import { EventType, EventCategory, LocationDetails, EventLink } from '@festgrid/shared-types';

// Closed set for events.detail_level (Architecture Spine AD-30 Rule 1, Story 3.6r). A 'stub'
// event is created from a roundup item with no readable date/location (3.6s); every event
// shipped before this story is 'full' (the column's own NOT NULL DEFAULT 'full').
export const EVENT_DETAIL_LEVELS = ['stub', 'full'] as const;
export type EventDetailLevel = (typeof EVENT_DETAIL_LEVELS)[number];

export interface GeminiSchedulePayload {
  isMainSchedule: boolean;
  eventStartDate: string;
  eventEndDate?: string;
  eventStartTime?: string;
  eventEndTime?: string;
  title?: string;
  performers?: string[];
  location?: string;
  ticketPrice?: string;
}

export interface GeminiExtractionPayload {
  isEvent: boolean;
  eventName: string;
  types: string[];
  categories: string[];
  schedules: GeminiSchedulePayload[];
  location?: string;
  organizerName?: string;
  contactInfo?: string;
  hasPrivateContact?: boolean;
  description?: string;
  confidenceScore: number;
  // Story 0.37 — any explicit additional links found in the source content.
  links?: EventLink[];
  // Story 3.6l — model-self-reported completeness signal, logging-only, never persisted
  // (absent from ExtractedEventMessage/EventInsertValues/schedules and any DB-facing type).
  minScheduleCount?: number;
  expectedScheduleNames?: string[];
}

export type ScheduleTimezoneStatus = 'RESOLVED' | 'NEEDS_CLARIFICATION';

export interface ScheduleTimezoneResolution {
  timezone?: string;
  timezoneStatus: ScheduleTimezoneStatus;
}

export interface ExtractedScheduleMessage {
  isMainSchedule: boolean;
  eventStartDate: string;
  eventEndDate?: string;
  eventStartTime?: string;
  eventEndTime?: string;
  title?: string;
  performers?: string[];
  location?: string;
  ticketPrice?: string;
  locationDetails?: LocationDetails;
  timezone?: string;
  timezoneStatus?: ScheduleTimezoneStatus;
}

export interface ExtractedEventMessage {
  postId: string;
  sourceSocialMediaAccountId: string;
  eventName: string;
  types: EventType[];
  categories: EventCategory[];
  schedules: ExtractedScheduleMessage[];
  location?: string;
  organizerName?: string;
  contactInfo?: string;
  hasPrivateContact?: boolean;
  description?: string;
  confidenceScore: number;
  // Story 0.37 — sanitized via sanitizeEventLinks before reaching this message shape.
  links?: EventLink[];
}

// Story 3.7g — a plain, DB/ORM-decoupled shape describing the fields of a `posts` row that
// `buildEventInsertValues()` needs to derive a platform-prefixed slug. Deliberately NOT
// `typeof posts.$inferSelect` (or any other Drizzle-derived type): packages/domain is imported
// directly by apps/web as well as apps/backend, so per project-context.md's Code Organization
// rule it must stay free of any dependency on @festgrid/database's Drizzle schema types.
export interface EventSourcePostIdentity {
  platform: string;
  platformPostId: string | null;
  platformPostType: string | null;
}

export interface EventInsertValues {
  postId: string;
  sourceSocialMediaAccountId: string;
  eventName: string;
  types: string[];
  categories: string[];
  location: string;
  organizerName?: string | null;
  contactInfo?: string | null;
  hasPrivateContact: boolean;
  description?: string | null;
  confidenceScore?: number | null;
  links?: EventLink[] | null;
  // Story 3.7g — present only when a platform-derivable slug was built from the source post's
  // platformPostId/platformPostType (e.g. `ig_p_Cx9uWttkSN`); omitted otherwise so Drizzle's
  // `events.slug` `$defaultFn` (legacy hex) fires on insert. Never set to `undefined` explicitly
  // — the key must be physically absent for the fallback to engage (see
  // build-event-insert-values.ts for why).
  slug?: string;
}

export interface ScheduleInsertValues {
  eventId?: string; // set after event insert
  isMainSchedule: boolean;
  eventStartDate: string;
  eventEndDate?: string | null;
  eventStartTime?: string | null;
  eventEndTime?: string | null;
  title?: string | null;
  performers?: string[] | null;
  location?: string | null;
  ticketPrice?: string | null;
  locationDetails?: LocationDetails | null;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
  timezoneStatus?: ScheduleTimezoneStatus | null;
}

export interface ProposedScheduleCorrection {
  id?: string;
  isMainSchedule: boolean;
  eventStartDate: string;
  eventEndDate?: string;
  eventStartTime?: string;
  eventEndTime?: string;
  title?: string;
  performers?: string[];
  location?: string;
  ticketPrice?: string;
}

export interface ProposedEventCorrection {
  eventName: string;
  types: EventType[];
  categories: EventCategory[];
  location: string;
  organizerName?: string;
  contactInfo?: string;
  description?: string;
  schedules: ProposedScheduleCorrection[];
}
