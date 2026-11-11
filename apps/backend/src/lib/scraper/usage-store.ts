import { db } from '../../db/client.js';
import { scraperProviderUsage } from '@festgrid/database';
import { isCycleElapsed, ScraperCapacityExceededError } from '@festgrid/domain';
import { eq } from 'drizzle-orm';
import { loadBackendEnv } from '../../env.js';

// Helper to get provider-specific pricing and budget
function getProviderPricing(provider: string, env: ReturnType<typeof loadBackendEnv>) {
  if (provider === 'brightdata') {
    return {
      pricePerThousandItemsUsd: env.brightdataPricePerThousandItemsUsd ?? 1.5,
      monthlyBudgetUsd: env.brightdataMonthlyBudgetUsd ?? 7.5,
    };
  }
  // default to apify values
  return {
    pricePerThousandItemsUsd: env.scraperPricePerThousandItemsUsd ?? 2.3,
    monthlyBudgetUsd: env.scraperMonthlyBudgetUsd ?? 10,
  };
}

export async function recordProviderUsage(provider: string, itemCount: number): Promise<void> {
  const env = loadBackendEnv();
  const cycleDays = env.scraperUsageCycleDays;
  const now = new Date();

  const [row] = await db.select().from(scraperProviderUsage).where(eq(scraperProviderUsage.provider, provider));

  // usageCycleResetAt is the cycle START (isCycleElapsed compares now - start against cycleDays);
  // storing a future "next reset" here would make every cycle last 2x cycleDays.
  if (!row) {
    await db.insert(scraperProviderUsage).values({
      provider,
      itemsUsedThisCycle: itemCount,
      usageCycleResetAt: now,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    const isElapsed = isCycleElapsed(row.usageCycleResetAt.toISOString(), cycleDays, now);
    if (isElapsed) {
      await db.update(scraperProviderUsage).set({
        itemsUsedThisCycle: itemCount,
        usageCycleResetAt: now,
        // A new cycle: whatever cap was known to be used up has reset (Story 10.2).
        capacityExhaustedUntil: null,
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

/**
 * Remembers that `provider` reported its monthly cap used up (Apify's 403 "Monthly usage hard limit exceeded"): sets
 * `capacity_exhausted_until` to the END of the current usage cycle, so every caller (the post chain, the daily batch) skips the
 * provider without a refused call until the cycle rolls over. A time, not a flag, so it clears itself. Idempotent within a
 * cycle; a provider whose cycle already elapsed starts a fresh one first, and the row is created when absent.
 */
export async function markProviderCapacityExhausted(provider: string): Promise<void> {
  const env = loadBackendEnv();
  const cycleMs = env.scraperUsageCycleDays * 24 * 60 * 60 * 1000;
  const now = new Date();
  const [row] = await db.select().from(scraperProviderUsage).where(eq(scraperProviderUsage.provider, provider));

  if (!row) {
    await db.insert(scraperProviderUsage).values({
      provider,
      itemsUsedThisCycle: 0,
      usageCycleResetAt: now,
      capacityExhaustedUntil: new Date(now.getTime() + cycleMs),
      createdAt: now,
      updatedAt: now,
    });
    return;
  }
  if (isCycleElapsed(row.usageCycleResetAt.toISOString(), env.scraperUsageCycleDays, now)) {
    await db
      .update(scraperProviderUsage)
      .set({ itemsUsedThisCycle: 0, usageCycleResetAt: now, capacityExhaustedUntil: new Date(now.getTime() + cycleMs), updatedAt: now })
      .where(eq(scraperProviderUsage.provider, provider));
    return;
  }
  await db
    .update(scraperProviderUsage)
    .set({ capacityExhaustedUntil: new Date(row.usageCycleResetAt.getTime() + cycleMs), updatedAt: now })
    .where(eq(scraperProviderUsage.provider, provider));
}

/**
 * What the Apify call sites use to remember a refusal. A test seam: a suite that provokes the monthly-limit refusal must not
 * write the REAL `apify` usage row (other suites run in parallel against the same database and would see Apify as exhausted),
 * so each such file swaps in a recorder. Each test file is its own process, so no restore is needed.
 */
export let rememberExhaustedCapacity: (provider: string) => Promise<void> = markProviderCapacityExhausted;

export function setRememberExhaustedCapacity(fn: typeof rememberExhaustedCapacity): void {
  rememberExhaustedCapacity = fn;
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

  // Story 10.2 (IDEA-101): a cap the provider itself reported as used up holds for the rest of the cycle, whatever the
  // item estimate says (the estimate cannot know what other apps on the same account spent).
  if (!isElapsed && row.capacityExhaustedUntil && row.capacityExhaustedUntil.getTime() > now.getTime()) {
    return false;
  }

  let itemsUsed = row.itemsUsedThisCycle;
  if (isElapsed) {
    itemsUsed = 0; // Usage has conceptually reset
  }

  const { pricePerThousandItemsUsd, monthlyBudgetUsd } = getProviderPricing(provider, env);

  const estimatedUsd = itemsUsed * (pricePerThousandItemsUsd / 1000);
  const budgetLimit = monthlyBudgetUsd * env.scraperCapacityThresholdRatio;

  return estimatedUsd < budgetLimit;
}

export async function assertProviderCapacityAvailable(provider: string, context?: string): Promise<void> {
  const isAvailable = await isProviderCapacityAvailable(provider);
  if (!isAvailable) {
    const detail = context ? ` for ${context}` : '';
    throw new ScraperCapacityExceededError(`Apify capacity exceeded${detail}. Scraper usage has reached the configured threshold and requests are paused until the next cycle reset.`);
  }
}
