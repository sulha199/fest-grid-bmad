import { JSONSchemaType } from 'ajv';
import { EventType, EventCategory } from '@festgrid/shared-types';
import { GeminiExtractionPayload, GeminiEventPayload, GeminiSchedulePayload, DayOfWeek } from '@festgrid/domain';
import { POST_GROUPING_REASONS } from '@festgrid/domain/posts';

export const geminiScheduleSchema: JSONSchemaType<GeminiSchedulePayload> = {
  type: 'object',
  properties: {
    isMainSchedule: { type: 'boolean' },
    eventStartDate: { type: 'string' },
    eventEndDate: { type: 'string', nullable: true },
    eventStartTime: { type: 'string', nullable: true },
    eventEndTime: { type: 'string', nullable: true },
    title: { type: 'string', nullable: true },
    performers: {
      type: 'array',
      items: { type: 'string' },
      nullable: true
    },
    location: { type: 'string', nullable: true },
    ticketPrice: { type: 'string', nullable: true },
    // Story 3.6s (BUG-026) — reuses the existing DayOfWeek enum (packages/domain) as the
    // allowed-values source, matching the Gemini-facing schema's own enum list.
    applicableDaysOfWeek: {
      type: 'array',
      items: { type: 'string', enum: Object.values(DayOfWeek) },
      nullable: true
    }
  },
  required: ['isMainSchedule', 'eventStartDate'],
  additionalProperties: false
};

// Story 3.6s — mirrors today's (pre-3.6s) extractedEventSchema's per-event fields, now nested
// under the post-level `events` array, plus the new `organizerHandle`. `additionalProperties:
// false` stays load-bearing here (same pattern as geminiScheduleSchema): a real Gemini response
// carrying an undeclared per-event field is silently dropped unless declared here in the same
// change as the Gemini-side schema (build-gemini-request.ts).
export const geminiEventSchema: JSONSchemaType<GeminiEventPayload> = {
  type: 'object',
  properties: {
    eventName: { type: 'string' },
    types: {
      type: 'array',
      items: { type: 'string', enum: Object.values(EventType) }
    },
    categories: {
      type: 'array',
      items: { type: 'string', enum: Object.values(EventCategory) }
    },
    schedules: {
      type: 'array',
      items: geminiScheduleSchema
    },
    location: { type: 'string', nullable: true },
    organizerName: { type: 'string', nullable: true },
    contactInfo: { type: 'string', nullable: true },
    hasPrivateContact: { type: 'boolean', nullable: true },
    description: { type: 'string', nullable: true },
    // Story 0.37 — additional links mentioned in the source content ({url, label?}[]).
    // Nested array-of-objects (mirrors geminiScheduleSchema), not a flat-string field.
    links: {
      type: 'array',
      nullable: true,
      maxItems: 10,
      items: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          label: { type: 'string', nullable: true }
        },
        required: ['url'],
        additionalProperties: false
      }
    },
    confidenceScore: { type: 'number', minimum: 0, maximum: 1 },
    // Story 3.6l — model-self-reported completeness signal, logging-only, never persisted.
    minScheduleCount: { type: 'number', nullable: true },
    expectedScheduleNames: { type: 'array', items: { type: 'string' }, nullable: true },
    // Story 3.6s (AD-30 Rule 5) — the @handle tagged for this specific item.
    organizerHandle: { type: 'string', nullable: true }
  },
  required: ['eventName', 'types', 'categories', 'schedules', 'confidenceScore'],
  additionalProperties: false
};

export const extractedEventSchema: JSONSchemaType<GeminiExtractionPayload> = {
  type: 'object',
  properties: {
    isEvent: { type: 'boolean' },
    // Story 3.6s — deliberately NO `maxItems` here (unlike the Gemini-facing schema in
    // build-gemini-request.ts): if the model ever ignores the prompt's cap instruction and
    // returns far more events than configured, a strict AJV `maxItems` would reject the ENTIRE
    // payload, losing all of that real extracted data to the existing `if (!isValid) return`
    // failure path. The actual enforcement point is a code-level truncation in
    // process-ai-job.ts, which keeps the first N events and logs a warning -- this mirrors this
    // codebase's established best-effort-degrade philosophy (image-fetch/location-resolution/
    // backfill failures all degrade gracefully) rather than a new hard-fail mode.
    events: {
      type: 'array',
      items: geminiEventSchema
    },
    // Story 3.6s (AD-30 Rule 5) — nullable/not required: forcing a meaningless grouping
    // classification on a non-event post (isEvent: false) has no value.
    groupingReason: { type: 'string', enum: [...POST_GROUPING_REASONS], nullable: true },
    groupingRationale: { type: 'string', nullable: true },
    minEventCount: { type: 'number', nullable: true },
    skippedItems: { type: 'array', items: { type: 'string' }, nullable: true }
  },
  required: ['isEvent', 'events'],
  additionalProperties: false
};
