import { and, count, eq, inArray, ne, notInArray } from 'drizzle-orm';
import { activeOnly } from '@festgrid/graphql-select';
import { jobs, subscriptions, users } from '@festgrid/database';
import { JOB_TERMINAL_STATUSES, listJobTypeDefinitions } from '@festgrid/domain/jobs';
import { SubscriptionCapReachedError, evaluateSubscriptionCap } from '@festgrid/domain/subscriptions';
import { db } from '../../db/client.js';
import { loadBackendEnv } from '../../env.js';

// Story 10.3 (AC7, AC8; PRD FR122, section 6) -- the subscription cap. Counting is done INSIDE the caller's transaction
// after `lockUserRow`, so two simultaneous requests for one user are serialized and cannot both slip under the cap.

/** The Drizzle transaction handle (the same type `db.transaction` passes to its callback). */
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Serializes everything that admits work for one user: `SELECT ... FOR NO KEY UPDATE` on the user row (two of these
 * conflict, while the FOR KEY SHARE every foreign-key insert on `users` takes does not, so jobs and subscriptions are not blocked). A transaction-scoped row
 * lock is safe under the Supabase transaction-mode pooler (a session advisory lock is not, AD-32). Returns the role, or
 * null when the user does not exist (a deleted user: the caller refuses).
 */
export async function lockUserRow(tx: DbTransaction, userId: string): Promise<{ role: 'user' | 'moderator' } | null> {
  const [row] = await tx.select({ role: users.role }).from(users).where(eq(users.id, userId)).for('no key update');
  return row ?? null;
}

/** Active (not soft-deleted) subscriptions. */
export async function countActiveSubscriptions(tx: DbTransaction, userId: string): Promise<number> {
  const [row] = await tx
    .select({ value: count() })
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), activeOnly(subscriptions)));
  return row?.value ?? 0;
}

/**
 * Reserved slots (FR122): the user's non-terminal jobs (optionally except one: the job whose own handler is now turning its
 * reservation into the subscription, which must not count against itself) of a type that declares `reservesSubscriptionSlot`, an account
 * still being added that will become a subscription. Types come from the pure definitions the process REGISTERED IN THIS
 * PROCESS: a reserving type that the calling Lambda has not registered is not counted, so every Lambda that enforces the cap
 * must register all job type definitions (AD-53 Rule 12).
 */
export async function countReservedSlots(tx: DbTransaction, userId: string, excludeJobId?: string): Promise<number> {
  const reservingTypes = listJobTypeDefinitions()
    .filter((definition) => definition.reservesSubscriptionSlot)
    .map((definition) => definition.type);
  if (reservingTypes.length === 0) {
    return 0;
  }
  const [row] = await tx
    .select({ value: count() })
    .from(jobs)
    .where(
      and(
        eq(jobs.ownerUserId, userId),
        inArray(jobs.type, reservingTypes),
        notInArray(jobs.status, [...JOB_TERMINAL_STATUSES]),
        ...(excludeJobId ? [ne(jobs.id, excludeJobId)] : [])
      )
    );
  return row?.value ?? 0;
}

/**
 * Applies the cap for a user whose row the caller has ALREADY locked. Returns the typed refusal (not thrown), so a
 * caller that wants a result value (`admitJob`) and one that wants an exception (`subscribeToAccount`) share one rule.
 */
export async function checkSubscriptionCap(
  tx: DbTransaction,
  input: { userId: string; isModerator: boolean; alreadyHeld: boolean; excludeReservedByJobId?: string }
): Promise<{ allowed: true } | { allowed: false; activeCount: number; reservedCount: number; cap: number }> {
  const cap = loadBackendEnv().maxSubscribedAccountsFreeUser;
  if (input.isModerator || input.alreadyHeld) {
    return { allowed: true };
  }
  const [activeCount, reservedCount] = await Promise.all([
    countActiveSubscriptions(tx, input.userId),
    countReservedSlots(tx, input.userId, input.excludeReservedByJobId),
  ]);
  return evaluateSubscriptionCap({ isModerator: false, activeCount, reservedCount, alreadyHeld: false, cap });
}

/** Throws `SubscriptionCapReachedError` when the user is at or above the cap. The user row must already be locked. */
export async function assertSubscriptionCap(
  tx: DbTransaction,
  input: { userId: string; isModerator: boolean; alreadyHeld: boolean; excludeReservedByJobId?: string }
): Promise<void> {
  const decision = await checkSubscriptionCap(tx, input);
  if (!decision.allowed) {
    throw new SubscriptionCapReachedError(decision);
  }
}

