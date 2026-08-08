import { db } from '../../db/client.js';
import { scraperProviderUsage } from '@festgrid/database';
import { isCycleElapsed, nextCycleReset } from '@festgrid/domain';
import { eq } from 'drizzle-orm';
import { loadBackendEnv } from '../../env.js';

export async function recordProviderUsage(provider: string, itemCount: number): Promise<void> {
  const env = loadBackendEnv();
  const cycleDays = env.scraperUsageCycleDays;
  const now = new Date();

  const [row] = await db.select().from(scraperProviderUsage).where(eq(scraperProviderUsage.provider, provider));

  if (!row) {
    const nextReset = nextCycleReset(now, cycleDays);
    await db.insert(scraperProviderUsage).values({
      provider,
      itemsUsedThisCycle: itemCount,
      usageCycleResetAt: new Date(nextReset),
      createdAt: now,
      updatedAt: now,
    });
  } else {
    const isElapsed = isCycleElapsed(row.usageCycleResetAt.toISOString(), cycleDays, now);
    if (isElapsed) {
      const nextReset = nextCycleReset(now, cycleDays);
      await db.update(scraperProviderUsage).set({
        itemsUsedThisCycle: itemCount,
        usageCycleResetAt: new Date(nextReset),
        updatedAt: now,
      }).where(eq(scraperProviderUsage.provider, provider));
    } else {
      await db.update(scraperProviderUsage).set({
        itemsUsedThisCycle: row.itemsUsedThisCycle + itemCount,
        updatedAt: now,
      }).where(eq(scraperProviderUsage.provider, provider));
    }
  }
}

export async function isProviderCapacityAvailable(provider: string): Promise<boolean> {
  const env = loadBackendEnv();
  const [row] = await db.select().from(scraperProviderUsage).where(eq(scraperProviderUsage.provider, provider));

  if (!row) {
    return true; // No row exists yet, so capacity is available
  }

  const cycleDays = env.scraperUsageCycleDays;
  const now = new Date();
  const isElapsed = isCycleElapsed(row.usageCycleResetAt.toISOString(), cycleDays, now);

  let itemsUsed = row.itemsUsedThisCycle;
  if (isElapsed) {
    itemsUsed = 0; // Usage has conceptually reset
  }

  const estimatedUsd = itemsUsed * (env.scraperPricePerThousandItemsUsd / 1000);
  const budgetLimit = env.scraperMonthlyBudgetUsd * env.scraperCapacityThresholdRatio;

  return estimatedUsd < budgetLimit;
}
