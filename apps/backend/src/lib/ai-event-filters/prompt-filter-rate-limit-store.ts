import { eq } from 'drizzle-orm';
import { promptFilterRateLimits } from '@festgrid/database';
import { evaluatePromptFilterRateLimit } from '@festgrid/domain/ai-event-filters';
import { db } from '../../db/client.js';
import { loadBackendEnv } from '../../env.js';

// Story 9.8 -- a plain read-then-write, not a single atomic SQL upsert (unlike
// vendorCallLocks' lock-claim, which must prevent two concurrent callers from believing they
// hold the same lock). A per-user prompt-rate-limit has a different concurrency profile: the
// realistic race is the same user double-clicking "submit" or firing two tabs, not distributed
// lock contention -- matching the existing, already-shipped usage-store.ts#recordSuccessfulUsage
// precedent for exactly this shape of problem. See this story's Dev Notes decision 2.
//
// Returns true iff the request is allowed to proceed (and the allowed attempt has already been
// recorded). Returns false iff the user is over their configured limit -- the caller must then
// throw RATE_LIMITED and must NOT call Gemini.
export async function checkAndRecordPromptFilterRateLimit(userId: string): Promise<boolean> {
  const env = loadBackendEnv();
  const now = new Date();

  const [row] = await db.select().from(promptFilterRateLimits).where(eq(promptFilterRateLimits.userId, userId));
  const state = row ? { requestCount: row.requestCount, windowStartAt: row.windowStartAt.toISOString() } : null;

  const decision = evaluatePromptFilterRateLimit(
    state,
    env.promptFilterRateLimitMaxRequests,
    env.promptFilterRateLimitWindowMinutes,
    now
  );

  if (!decision.allowed) {
    return false;
  }

  const nextWindowStartAt = new Date(decision.nextState.windowStartAt);
  if (!row) {
    await db.insert(promptFilterRateLimits).values({
      userId,
      requestCount: decision.nextState.requestCount,
      windowStartAt: nextWindowStartAt,
    });
  } else {
    await db.update(promptFilterRateLimits).set({
      requestCount: decision.nextState.requestCount,
      windowStartAt: nextWindowStartAt,
      updatedAt: now,
    }).where(eq(promptFilterRateLimits.userId, userId));
  }

  return true;
}
