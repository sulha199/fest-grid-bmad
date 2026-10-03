import { EventType, EventCategory, LocationDetails, EventLink } from '@festgrid/shared-types';
import { type PostGroupingReason } from '../posts/types.js';

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
  // Story 3.6s (BUG-026) — populated only when the source text states the schedule recurs on
  // specific weekdays within a date span. Reuses the existing DayOfWeek enum values
  // (packages/domain/src/events/buildEventsQueryCondition.ts) as its allowed-values source.
  applicableDaysOfWeek?: string[];
}

// Story 3.6s — the fields that used to be flat on GeminiExtractionPayload now live on this
// per-event interface. One GeminiExtractionPayload may carry several of these (AD-30 Rule 5).
export interface GeminiEventPayload {
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
  // Story 3.6s (AD-30 Rule 5) — the @handle tagged for this specific item, captured at
  // extraction time because a CURATOR_GUIDE post's caption is nulled after extraction
  // (Story 3.4o). Not read by anything in this story; carried for Story 3.6v's matching pass.
  organizerHandle?: string;
}

export interface GeminiExtractionPayload {
  isEvent: boolean;
  events: GeminiEventPayload[];
  // Story 3.6s (AD-30 Rule 5) — the post-level grouping decision. Optional/not persisted-from-
  // here: posts.grouping_reason (Story 3.6r) is populated by a later story's ingestion step,
  // not by this payload type directly.
  groupingReason?: PostGroupingReason;
  // Story 3.6s — one-sentence model self-explanation of the grouping decision, for debugging
  // only. Deliberately never read by any downstream code in this story and never persisted —
  // do not add it to ExtractedEventMessage or any DB-facing type (AD-30 Rule 5).
  groupingRationale?: string;
  // Story 3.6s — model's own best-effort count of distinct events it believes the content
  // describes, mirroring minScheduleCount's existing self-report/logging-only pattern.
  minEventCount?: number;
  // Story 3.6s — brief human-readable reason per roundup item skipped for missing a readable
  // date or location (e.g. "Jakarta Fun Run — no date stated"). Logging-only.
  skippedItems?: string[];
  // Story 3.6m (AD-28 Rule 1) — model self-reported, once for the whole post, pre-filter signal
  // for Story 3.6n's face-detection/blur pass: whether any provided image shows a visible
  // person. Logging-only in this story (processAiJob) — never added to ExtractedEventMessage,
  // EventInsertValues, or any other DB-facing/persisted type, and never exposed via GraphQL.
  // Actual persistence into extraction_audit_logs is Story 3.6p's scope (AD-29).
  hasFaceImage?: boolean;
  // Story 3.6m — advisory/best-effort count of distinct people visible across the provided
  // image(s), never trusted as an exact count. Same logging-only scope as hasFaceImage above.
  faceImageCount?: number;
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
  // Story 3.6s (BUG-026) — threaded through from GeminiSchedulePayload. Mapping into
  // ScheduleInsertValues is explicitly Story 3.6t's job, not this story's.
  applicableDaysOfWeek?: string[];
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
  // Story 3.6s (AD-30 Rule 5) — threaded through from GeminiEventPayload.organizerHandle for
  // Story 3.6v's matching pass to read later. Not read by anything in this story. Mapping into
  // EventInsertValues is explicitly Story 3.6t's job, not this story's.
  organizerHandle?: string;
  // Story 3.6t — optional for backward compatibility: a DataIngestionQueue message enqueued
  // before this story's deploy has no such field at all. processIngestionJob/
  // insertEventWithPrimaryPost already treat its absence as ordinal 0 (AC2).
  extractionOrdinal?: number;
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
  // Story 3.6t — threaded through unconditionally from the message (never conditionally
  // omitted like `slug`): insertEventWithPrimaryPost always recomputes/overwrites this at its
  // own DB-write boundary, so the undefined-vs-absent-key distinction doesn't matter here.
  extractionOrdinal?: number;
  // Story 3.6t — present only when the caller (process-ingestion-job.ts) has already resolved
  // the stub/full decision; omitted otherwise so the DB's own DEFAULT 'full' fires, mirroring
  // the existing `slug?:` omit-the-key pattern.
  detailLevel?: EventDetailLevel;
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
  // Story 3.6t — mapped through from ExtractedScheduleMessage.applicableDaysOfWeek (BUG-026,
  // shipped on the message by Story 3.6s but explicitly left unmapped to this type until now).
  applicableDaysOfWeek?: string[] | null;
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
