import { JSONSchemaType } from 'ajv';
import { EventType, EventCategory } from '@festgrid/shared-types';
import { GeminiExtractionPayload, GeminiSchedulePayload } from '@festgrid/domain';

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
    ticketPrice: { type: 'string', nullable: true }
  },
  required: ['isMainSchedule', 'eventStartDate'],
  additionalProperties: false
};

export const extractedEventSchema: JSONSchemaType<GeminiExtractionPayload> = {
  type: 'object',
  properties: {
    isEvent: { type: 'boolean' },
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
    confidenceScore: { type: 'number', minimum: 0, maximum: 1 }
  },
  required: ['isEvent', 'eventName', 'types', 'categories', 'schedules', 'confidenceScore'],
  additionalProperties: false
};
