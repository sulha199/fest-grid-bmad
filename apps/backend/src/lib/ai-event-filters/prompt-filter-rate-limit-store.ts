import { and, eq } from 'drizzle-orm';
import { promptFilterRateLimits } from '@festgrid/database';
import { evaluatePromptFilterRateLimit } from '@festgrid/domain/ai-event-filters';
import { db } from '../../db/client.js';
import { loadBackendEnv } from '../../env.js';

// Story 9.8 / Epic 9 review (P12) -- the decision logic stays in the pure
// `evaluatePromptFilterRateLimit`; this store only makes read-evaluate-write SAFE under
// concurrency with an optimistic compare-and-swap, instead of a plain read-then-write:
//   - no row yet: INSERT ... ON CONFLICT DO NOTHING (two concurrent first requests no longer
//     collide on the primary key; the loser re-reads and is evaluated against the winner's row);
//   - row exists: UPDATE ... WHERE the row still holds exactly the count/window that was read, so of
//     N parallel requests that read the same count only one write lands per round and the rest
//     re-read -- the number allowed in a window can never exceed the configured maximum.
// After a few lost rounds the request is denied (fail closed): sustained contention on ONE user's
// row means a burst, which is precisely what the limit exists to stop.
const MAX_ATTEMPTS = 4;

// Returns true iff the request is allowed to proceed (and the allowed attempt has already been
// recorded). Returns false iff the user is over their configured limit -- the caller must then
// throw RATE_LIMITED and must NOT call Gemini.
export async function checkAndRecordPromptFilterRateLimit(userId: string): Promise<boolean> {
  const env = loadBackendEnv();

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
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
      const inserted = await db
        .insert(promptFilterRateLimits)
        .values({ userId, requestCount: decision.nextState.requestCount, windowStartAt: nextWindowStartAt })
        .onConflictDoNothing()
        .returning({ userId: promptFilterRateLimits.userId });
      if (inserted.length > 0) {
        return true;
      }
      continue;
    }

    const updated = await db
      .update(promptFilterRateLimits)
      .set({
        requestCount: decision.nextState.requestCount,
        windowStartAt: nextWindowStartAt,
        updatedAt: now,
      })
      .where(
        and(
          eq(promptFilterRateLimits.userId, userId),
          eq(promptFilterRateLimits.requestCount, row.requestCount),
          eq(promptFilterRateLimits.windowStartAt, row.windowStartAt)
        )
      )
      .returning({ userId: promptFilterRateLimits.userId });
    if (updated.length > 0) {
      return true;
    }
  }

  return false;
}
