import { db } from '../../db/client.js';
import { unprocessedScraperPayloads } from '@festgrid/database';

interface PersistUnprocessedPayloadParams {
  rawPayload: unknown;
  validationError: unknown;
  context: {
    source: 'apify' | 'brightdata' | 'gemini';
    scraperVendor?: string | null;
    accountId?: string | null;
    postUrl?: string | null;
    timestamp: string;
    parserVersion: string;
  };
}

export async function persistUnprocessedPayload({
  rawPayload,
  validationError,
  context,
}: PersistUnprocessedPayloadParams) {
  const result = await db
    .insert(unprocessedScraperPayloads)
    .values({
      rawPayload,
      validationError,
      context,
    })
    .returning();

  return result[0];
}
