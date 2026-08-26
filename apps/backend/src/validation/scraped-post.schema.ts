import { JSONSchemaType } from 'ajv';
import { ScrapedPost } from '@festgrid/domain';

export const scrapedPostSchema: JSONSchemaType<ScrapedPost> = {
  type: 'object',
  properties: {
    content: { type: 'string', minLength: 1 },
    imageUrl: { type: 'string', nullable: true },
    videoUrl: { type: 'string', nullable: true },
    postUrl: { type: 'string' },
    originalPostUrl: { type: 'string', nullable: true },
    publishedAt: { type: 'string' },
    locationName: { type: 'string', nullable: true },
    ownerDisplayName: { type: 'string', nullable: true },
    ownerUsername: { type: 'string', nullable: true }
  },
  required: ['content', 'postUrl', 'publishedAt'],
  additionalProperties: false
};
