import { JSONSchemaType } from 'ajv';
import { EventType, EventCategory } from '@festgrid/shared-types';
import { ProposedEventCorrection, ProposedScheduleCorrection } from '@festgrid/domain/events';

export const proposedScheduleCorrectionSchema: JSONSchemaType<ProposedScheduleCorrection> = {
  type: 'object',
  properties: {
    id: { type: 'string', nullable: true },
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

export const proposedEventCorrectionSchema: JSONSchemaType<ProposedEventCorrection> = {
  type: 'object',
  properties: {
    eventName: { type: 'string', minLength: 1 },
    types: {
      type: 'array',
      items: { type: 'string', enum: Object.values(EventType) as EventType[] }
    },
    categories: {
      type: 'array',
      items: { type: 'string', enum: Object.values(EventCategory) as EventCategory[] }
    },
    location: { type: 'string', minLength: 1 },
    organizerName: { type: 'string', nullable: true },
    contactInfo: { type: 'string', nullable: true },
    description: { type: 'string', nullable: true },
    schedules: {
      type: 'array',
      items: proposedScheduleCorrectionSchema,
      minItems: 1
    }
  },
  required: ['eventName', 'types', 'categories', 'location', 'schedules'],
  additionalProperties: false
};
