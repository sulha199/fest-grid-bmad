import { db } from '../../db/client.js';
import { unprocessedScraperPayloads } from '@festgrid/database';
import { sendScraperAuditAlert } from '../notifications/send-scraper-audit-alert.js';

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
      await sendScraperAuditAlert({
        source: 'persistUnprocessedPayload',
        message: `FK constraint violation on scraperActorRunId ${scraperActorRunId}`,
        context: JSON.stringify({ scraperActorRunId, ...context }),
      });
      // Retry insert without the FK to ensure payload is captured, but preserve the
      // orphaned run id inside context (jsonb) so a future backfill can key on it
      // instead of losing the link entirely.
      const result = await db
        .insert(unprocessedScraperPayloads)
        .values({
          rawPayload,
          validationError,
          context: { ...context, orphanedScraperActorRunId: scraperActorRunId },
          // omit scraperActorRunId to retry without FK
        })
        .returning();
      return result[0];
    }
    throw err;
  }
}
