import { JSONSchemaType } from 'ajv';

export interface ExtractedEventPayload {
  isEvent: boolean;
  eventName: string;
  types: string[];
  categories: string[];
}

export const extractedEventSchema: JSONSchemaType<ExtractedEventPayload> = {
  type: 'object',
  properties: {
    isEvent: { type: 'boolean' },
    eventName: { type: 'string' },
    types: {
      type: 'array',
      items: { type: 'string' }
    },
    categories: {
      type: 'array',
      items: { type: 'string' }
    }
  },
  required: ['isEvent', 'eventName', 'types', 'categories'],
  additionalProperties: false
};
