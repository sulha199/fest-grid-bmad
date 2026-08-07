import { db } from '../../db/client.js';
import { apiKeys } from '@festgrid/database';
import { activeOnly } from '@festgrid/graphql-select';
import { isCycleElapsed, nextCycleReset, ApiKeyCandidate } from '@festgrid/domain';
import { and, eq, inArray } from 'drizzle-orm';
import { loadBackendEnv } from '../../env.js';

export async function fetchCandidateKeys(
  provider: string,
  subscriberUserIds: string[]
): Promise<ApiKeyCandidate[]> {
  if (subscriberUserIds.length === 0) {
    return [];
  }

  const rows = await db.select().from(apiKeys).where(
    and(
      eq(apiKeys.provider, provider),
      inArray(apiKeys.userId, subscriberUserIds),
      activeOnly(apiKeys)
    )
  );

  const env = loadBackendEnv();
  const cycleDays = env.apiKeyUsageCycleDays;
  const now = new Date();

  return rows.map(row => {
    const isElapsed = isCycleElapsed(row.usageCycleResetAt.toISOString(), cycleDays, now);
    return {
      id: row.id,
      userId: row.userId,
      usageCount: isElapsed ? 0 : row.usageCount,
      usageCycleResetAt: row.usageCycleResetAt.toISOString(),
      isValid: row.isValid,
      invalidAttempts: row.invalidAttempts,
    };
  });
}

export async function recordSuccessfulUsage(keyId: string): Promise<void> {
  const env = loadBackendEnv();
  const now = new Date();
  const cycleDays = env.apiKeyUsageCycleDays;

  const [key] = await db.select().from(apiKeys).where(eq(apiKeys.id, keyId));
  if (!key) {
    throw new Error(`Key ${keyId} not found`);
  }

  const isElapsed = isCycleElapsed(key.usageCycleResetAt.toISOString(), cycleDays, now);
  if (isElapsed) {
    const nextReset = nextCycleReset(now, cycleDays);
    await db.update(apiKeys).set({
      usageCount: 1,
      usageCycleResetAt: new Date(nextReset),
      updatedAt: now,
    }).where(eq(apiKeys.id, keyId));
  } else {
    await db.update(apiKeys).set({
      usageCount: key.usageCount + 1,
      updatedAt: now,
    }).where(eq(apiKeys.id, keyId));
  }
}

export async function recordInvalidAttempt(keyId: string, threshold: number): Promise<void> {
  const now = new Date();
  const [key] = await db.select().from(apiKeys).where(eq(apiKeys.id, keyId));
  if (!key) {
    throw new Error(`Key ${keyId} not found`);
  }

  const nextAttempts = key.invalidAttempts + 1;
  const isValid = nextAttempts < threshold;

  await db.update(apiKeys).set({
    invalidAttempts: nextAttempts,
    isValid,
    updatedAt: now,
  }).where(eq(apiKeys.id, keyId));
}
