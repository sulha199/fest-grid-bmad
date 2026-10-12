import { inArray } from 'drizzle-orm';
import { userSettings } from '@festgrid/database';
import { db } from '../../db/client.js';

// Test-only helpers for the row-count ratchet (Story 0.51). Any authenticated `Query.events` (and a
// few other resolvers) lazily creates a `user_settings` row for the caller via
// `getOrCreateUserSettings`. A test that runs those resolvers as a SEEDED user therefore leaves a row
// behind unless it removes it -- but must never remove a row that already existed before the test
// (dev DBs keep real settings), so cleanup is by "rows created since the snapshot".

/** User ids that already have a settings row. Call before the test acts as any seeded user. */
export async function snapshotUserSettingsUserIds(): Promise<Set<string>> {
  const rows = await db.select({ userId: userSettings.userId }).from(userSettings);
  return new Set(rows.map((row) => row.userId));
}

/** Delete only the settings rows created since `before` was snapshotted. */
export async function deleteUserSettingsCreatedSince(before: Set<string>): Promise<void> {
  const rows = await db.select({ userId: userSettings.userId }).from(userSettings);
  const created = rows.map((row) => row.userId).filter((userId) => !before.has(userId));
  if (created.length > 0) {
    await db.delete(userSettings).where(inArray(userSettings.userId, created));
  }
}
