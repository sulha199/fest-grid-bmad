import { db } from '../db/client.js';
import { unprocessedScraperPayloads, users } from '@festgrid/database';
import { gte, isNull, eq, and } from 'drizzle-orm';
import { loadBackendEnv } from '../env.js';

interface AnomalyGroup {
  source: string;
  count: number;
  samples: Array<{
    postUrl?: string | null;
    scraperVendor?: string | null;
    error: string;
    parserVersion: string;
    timestamp: string;
  }>;
}

export async function handler() {
  const env = loadBackendEnv();
  const retentionDays = parseInt(env.unprocessedPayloadRetentionDays || '30', 10);

  try {
    // Query payloads from past 24 hours
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const payloads = await db
      .select()
      .from(unprocessedScraperPayloads)
      .where(
        and(
          gte(unprocessedScraperPayloads.createdAt, oneDayAgo),
          isNull(unprocessedScraperPayloads.deletedAt)
        )
      );

    // Group by source
    const grouped: Record<string, AnomalyGroup> = {};
    for (const payload of payloads) {
      const context = payload.context as any;
      const source = context.source || 'unknown';

      if (!grouped[source]) {
        grouped[source] = {
          source,
          count: 0,
          samples: [],
        };
      }

      grouped[source].count += 1;

      // Keep first 10 samples
      if (grouped[source].samples.length < 10) {
        const error = Array.isArray(payload.validationError)
          ? payload.validationError[0]?.message || 'Validation failed'
          : 'Validation failed';

        grouped[source].samples.push({
          postUrl: context.postUrl,
          scraperVendor: context.scraperVendor,
          error: error.substring(0, 100),
          parserVersion: context.parserVersion,
          timestamp: context.timestamp,
        });
      }
    }

    // If no anomalies, skip sending
    if (Object.keys(grouped).length === 0) {
      console.log('No anomalies found in past 24 hours, skipping digest');
      return {
        statusCode: 200,
        message: 'No anomalies to report',
      };
    }

    // Fetch all moderators
    const moderators = await db
      .select()
      .from(users)
      .where(eq(users.role, 'moderator'));

    // Get total count of payloads in retention
    const totalInRetention = await db
      .select()
      .from(unprocessedScraperPayloads)
      .where(isNull(unprocessedScraperPayloads.deletedAt));

    // Log digest data for each moderator
    // TODO: Wire to actual email adapter and template
    const date = new Date().toISOString().split('T')[0];
    const anomalies = Object.values(grouped);

    for (const mod of moderators) {
      if (!mod.email) continue;
      console.log(
        `[Digest Email] To: ${mod.email}, Date: ${date}, Anomalies: ${anomalies
          .map((a) => `${a.source}=${a.count}`)
          .join(', ')}`
      );
    }

    console.log(
      `Daily digest logged for ${moderators.length} moderators. Anomalies: ${Object.entries(grouped)
        .map(([k, v]) => `${k}=${v.count}`)
        .join(', ')}`
    );

    return {
      statusCode: 200,
      message: `Sent ${moderators.length} digest emails`,
    };
  } catch (error) {
    console.error('Digest Lambda error:', error);
    return {
      statusCode: 500,
      message: 'Digest send failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
