import { db } from '../../db/client.js';
import { userSettings } from '@festgrid/database';

/**
 * Atomically fetches (or creates, on first access) a user's settings row.
 *
 * Uses a single `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` statement instead of a
 * select -> insert-on-conflict-do-nothing -> re-select sequence. The previous 3-step shape
 * had a re-select race window: between the insert and the re-select, nothing guaranteed the
 * row was visible yet in every execution path, and Drizzle's `onConflictDoNothing().returning()`
 * returns an empty array on conflict, so `RETURNING` only works here with a (no-op) `DO UPDATE`.
 *
 * The `set` clause reassigns `userId` to itself -- a deliberate no-op update whose sole purpose
 * is making Postgres treat this as an UPDATE (which supports RETURNING on the existing row) on
 * conflict, rather than actually changing any settings value.
 *
 * Always resolves to exactly one row in a single DB round trip, for both a brand-new `userId`
 * and an existing one -- see Story 0.36 AC1.
 */
export async function getOrCreateUserSettings(userId: string) {
  const [settings] = await db.insert(userSettings)
    .values({ userId })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { userId },
    })
    .returning();

  return settings;
}
