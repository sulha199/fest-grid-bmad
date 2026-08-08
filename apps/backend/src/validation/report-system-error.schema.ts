import { JSONSchemaType } from 'ajv';

export interface ReportSystemErrorPayload {
  source: string;
  message: string;
  context?: string;
}

export const reportSystemErrorSchema: JSONSchemaType<ReportSystemErrorPayload> = {
  type: 'object',
  properties: {
    source: { type: 'string', minLength: 1, maxLength: 100 },
    message: { type: 'string', minLength: 1, maxLength: 2000 },
    context: { type: 'string', maxLength: 5000, nullable: true }
  },
  required: ['source', 'message'],
  additionalProperties: false
};
