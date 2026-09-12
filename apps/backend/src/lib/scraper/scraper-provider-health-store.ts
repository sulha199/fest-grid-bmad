import { db } from '../../db/client.js';
import { scraperProviderHealth } from '@festgrid/database';
import { and, eq, gte, isNull, lt, or } from 'drizzle-orm';
import type { ScraperTriggerFailureReason } from './scraper-trigger-result.js';

export async function recordProviderHealthCheck(
  provider: string,
  { attempted, succeeded, failureReason }: { attempted: number; succeeded: number; failureReason?: ScraperTriggerFailureReason }
): Promise<void> {
  const now = new Date();
  const isFullFailure = attempted > 0 && succeeded === 0;

  const [row] = await db
    .select()
    .from(scraperProviderHealth)
    .where(eq(scraperProviderHealth.provider, provider));

  if (!row) {
    await db.insert(scraperProviderHealth).values({
      provider,
      consecutiveFailureDays: isFullFailure ? 1 : 0,
      // On a full-failure day persist the dominant failure reason; otherwise leave null.
      lastFailureReason: isFullFailure ? (failureReason ?? null) : null,
      lastCheckedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    return;
  }

  await db
    .update(scraperProviderHealth)
    .set({
      consecutiveFailureDays: isFullFailure ? row.consecutiveFailureDays + 1 : 0,
      // Any success resets the failure reason to null alongside the counter reset;
      // a full-failure day takes the latest reason (or null when not provided by a
      // pre-3.4r call site).
      lastFailureReason: isFullFailure ? (failureReason ?? null) : null,
      lastCheckedAt: now,
      updatedAt: now,
    })
    .where(eq(scraperProviderHealth.provider, provider));
}

export async function getProvidersNeedingAlert(
  thresholdDays: number,
  cooldownDays: number
): Promise<{ provider: string; consecutiveFailureDays: number; lastFailureReason: string | null }[]> {
  const cooldownCutoff = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      provider: scraperProviderHealth.provider,
      consecutiveFailureDays: scraperProviderHealth.consecutiveFailureDays,
      lastFailureReason: scraperProviderHealth.lastFailureReason,
    })
    .from(scraperProviderHealth)
    .where(
      and(
        gte(scraperProviderHealth.consecutiveFailureDays, thresholdDays),
        or(
          isNull(scraperProviderHealth.lastAlertSentAt),
          lt(scraperProviderHealth.lastAlertSentAt, cooldownCutoff)
        )
      )
    );

  return rows;
}

export async function markProviderAlertSent(provider: string): Promise<void> {
  await db
    .update(scraperProviderHealth)
    .set({ lastAlertSentAt: new Date(), updatedAt: new Date() })
    .where(eq(scraperProviderHealth.provider, provider));
}
