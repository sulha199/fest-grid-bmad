import { describe, it, expect, beforeEach } from 'vitest';
import { persistUnprocessedPayload } from './persist-unprocessed-payload.js';
import { db } from '../../db/client.js';
import { unprocessedScraperPayloads } from '@festgrid/database';
import { eq } from 'drizzle-orm';

describe('persistUnprocessedPayload', () => {
  beforeEach(async () => {
    // Clean up test data
    await db.delete(unprocessedScraperPayloads);
  });

  it('persists unprocessed payload to database', async () => {
    const testPayload = {
      rawPayload: { content: 'test', url: 'https://example.com/post' },
      validationError: [
        {
          instancePath: '$.content',
          schemaPath: '#/required',
          keyword: 'type',
          message: 'must be string',
        },
      ],
      context: {
        source: 'apify' as const,
        scraperVendor: 'instagram',
        accountId: 'test_account_123',
        postUrl: 'https://example.com/post',
        timestamp: new Date().toISOString(),
        parserVersion: '3.4g',
      },
    };

    const result = await persistUnprocessedPayload(testPayload);

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.rawPayload).toEqual(testPayload.rawPayload);
    expect(result.validationError).toEqual(testPayload.validationError);
    expect(result.context).toEqual(testPayload.context);
    expect(result.createdAt).toBeDefined();
    expect(result.deletedAt).toBeNull();
  });

  it('persists payload with null optional context fields', async () => {
    const testPayload = {
      rawPayload: { error: 'not_found' },
      validationError: [
        {
          instancePath: '$',
          schemaPath: '#/type',
          keyword: 'type',
          message: 'must be object',
        },
      ],
      context: {
        source: 'gemini' as const,
        scraperVendor: null,
        accountId: null,
        postUrl: null,
        timestamp: new Date().toISOString(),
        parserVersion: '3.4g',
      },
    };

    const result = await persistUnprocessedPayload(testPayload);

    expect(result).toBeDefined();
    expect(result.context.scraperVendor).toBeNull();
    expect(result.context.accountId).toBeNull();
    expect(result.context.postUrl).toBeNull();
  });

  it('can query persisted payload by ID', async () => {
    const testPayload = {
      rawPayload: { content: 'test' },
      validationError: [{ keyword: 'required', message: 'field required' }],
      context: {
        source: 'brightdata' as const,
        scraperVendor: null,
        accountId: null,
        postUrl: 'https://example.com/post',
        timestamp: new Date().toISOString(),
        parserVersion: '3.4g',
      },
    };

    const inserted = await persistUnprocessedPayload(testPayload);

    const queried = await db
      .select()
      .from(unprocessedScraperPayloads)
      .where(eq(unprocessedScraperPayloads.id, inserted.id))
      .limit(1)
      .then((rows) => rows[0]);

    expect(queried).toBeDefined();
    expect(queried.id).toBe(inserted.id);
    expect(queried.rawPayload).toEqual(testPayload.rawPayload);
  });
});
