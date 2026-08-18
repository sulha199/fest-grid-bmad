import { db } from '../db/client.js';
import { unprocessedScraperPayloads } from '@festgrid/database';
import { isNull, lte, and } from 'drizzle-orm';
import { loadBackendEnv } from '../env.js';

export async function handler() {
  const env = loadBackendEnv();
  const retentionDays = parseInt(env.unprocessedPayloadRetentionDays || '30', 10);

  // Calculate cutoff date: now - retention days
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  try {
    // Get count of payloads to be cleaned
    const countRows = await db
      .select()
      .from(unprocessedScraperPayloads)
      .where(
        and(
          lte(unprocessedScraperPayloads.createdAt, cutoffDate),
          isNull(unprocessedScraperPayloads.deletedAt)
        )
      );

    const countToClean = countRows.length;

    if (countToClean === 0) {
      console.log(`No payloads older than ${retentionDays} days to clean up`);
      return {
        statusCode: 200,
        message: 'Cleaned up 0 rows',
      };
    }

    await db
      .update(unprocessedScraperPayloads)
      .set({ deletedAt: new Date() })
      .where(
        and(
          lte(unprocessedScraperPayloads.createdAt, cutoffDate),
          isNull(unprocessedScraperPayloads.deletedAt)
        )
      );

    console.log(`Cleaned up ${countToClean} unprocessed payloads older than ${retentionDays} days`);

    return {
      statusCode: 200,
      message: `Cleaned up ${countToClean} rows`,
    };
  } catch (error) {
    console.error('Cleanup Lambda error:', error);
    return {
      statusCode: 500,
      message: 'Cleanup failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
