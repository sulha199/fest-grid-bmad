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
  scraperActorRunId?: string;
}

export async function persistUnprocessedPayload({
  rawPayload,
  validationError,
  context,
  scraperActorRunId,
}: PersistUnprocessedPayloadParams) {
  try {
    const result = await db
      .insert(unprocessedScraperPayloads)
      .values({
        rawPayload,
        validationError,
        context,
        scraperActorRunId,
      })
      .returning();

    return result[0];
  } catch (err) {
    // Graceful FK error handling (AC7 per Story 3-4j): catch FK violations and log without rethrowing
    const dbErr = err as any;
    if (dbErr?.code === '23503') {
      console.warn(
        `FK constraint violation inserting unprocessed payload with runId ${scraperActorRunId}; payload will be persisted without run link`,
        err
      );
      // Retry insert without the FK to ensure payload is captured
      const result = await db
        .insert(unprocessedScraperPayloads)
        .values({
          rawPayload,
          validationError,
          context,
          // omit scraperActorRunId to retry without FK
        })
        .returning();
      return result[0];
    }
    throw err;
  }
}
