import { JSONSchemaType } from 'ajv';
import { ScrapedPost } from '@festgrid/domain';

export const scrapedPostSchema: JSONSchemaType<ScrapedPost> = {
  type: 'object',
  properties: {
    content: { type: 'string' },
    imageUrl: { type: 'string', nullable: true },
    postUrl: { type: 'string' },
    originalPostUrl: { type: 'string', nullable: true },
    publishedAt: { type: 'string' }
  },
  required: ['content', 'postUrl', 'publishedAt'],
  additionalProperties: false
};
