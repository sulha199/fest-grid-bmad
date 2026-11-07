import { and, eq, sql } from 'drizzle-orm';
import { alertEmailRateLimits } from '@festgrid/database';
import { evaluatePromptFilterRateLimit } from '@festgrid/domain/ai-event-filters';
import { db } from '../../db/client.js';
import { loadBackendEnv } from '../../env.js';

// A fixed-window budget of alert emails per named channel. `Mutation.reportSystemError` is public, so it has
// no user to key a limit on, and every call used to email the alert address: anyone could fill that inbox.
// The decision is the same pure fixed-window rule the AI-filter limiter uses
// (`evaluatePromptFilterRateLimit`, packages/domain: it only counts requests in a window, it is not about
// prompts); this store makes read-evaluate-write safe under concurrency exactly as
// `checkAndRecordPromptFilterRateLimit` does, with an optimistic compare-and-swap:
//   - no row yet: INSERT ... ON CONFLICT DO NOTHING (the loser of a first-insert race re-reads);
//   - row exists: UPDATE ... WHERE it still holds the count and window that were read, so of N parallel
//     calls that read the same count only one write lands per round, and the number allowed in a window
//     can never exceed the maximum.
// A lost round only means another call advanced the row; the loop re-reads and the decision says allowed or
// denied. Every lost round is someone else's recorded send, so no call loses more than `max` rounds, plus
// one for a window rollover and one for a lost first insert (the headroom below). Exhausting it, which is
// never expected, fails closed.
//
// `key` names the channel (e.g. 'reportSystemError'), so one channel's flood cannot spend another's budget.
const ROUNDS_BEYOND_MAX_SENDS = 2;

export const REPORT_SYSTEM_ERROR_ALERT_KEY = 'reportSystemError';

/**
 * Returns true iff this call may send an alert email (and the send has already been counted). False means
 * the budget for the current window is spent: the caller must not send, and must log the report instead so
 * nothing is lost. A database error propagates; the caller decides (the resolver treats it as "do not send").
 */
export async function takeAlertEmailBudget(key: string): Promise<boolean> {
  const env = loadBackendEnv();
  const maxSends = env.systemErrorAlertMaxEmails;
  const maxAttempts = maxSends + ROUNDS_BEYOND_MAX_SENDS;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const now = new Date();
    const [row] = await db.select().from(alertEmailRateLimits).where(eq(alertEmailRateLimits.key, key));
    const state = row ? { requestCount: row.sendCount, windowStartAt: row.windowStartAt.toISOString() } : null;

    const decision = evaluatePromptFilterRateLimit(state, maxSends, env.systemErrorAlertWindowMinutes, now);
    if (!decision.allowed) return false;

    const nextWindowStartAt = new Date(decision.nextState.windowStartAt);
    if (!row) {
      const inserted = await db
        .insert(alertEmailRateLimits)
        .values({ key, sendCount: decision.nextState.requestCount, windowStartAt: nextWindowStartAt })
        .onConflictDoNothing()
        .returning({ key: alertEmailRateLimits.key });
      if (inserted.length > 0) return true;
      continue;
    }

    const updated = await db
      .update(alertEmailRateLimits)
      .set({ sendCount: decision.nextState.requestCount, windowStartAt: nextWindowStartAt, updatedAt: now })
      .where(
        and(
          eq(alertEmailRateLimits.key, key),
          eq(alertEmailRateLimits.sendCount, row.sendCount),
          // `row.windowStartAt` went through a JS Date (millisecond precision); a value written by the
          // column's `defaultNow()` carries microseconds, so compare at millisecond precision.
          sql`date_trunc('milliseconds', ${alertEmailRateLimits.windowStartAt}) = ${row.windowStartAt.toISOString()}::timestamptz`
        )
      )
      .returning({ key: alertEmailRateLimits.key });
    if (updated.length > 0) return true;
  }

  return false;
}
