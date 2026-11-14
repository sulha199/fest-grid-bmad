import { inArray, like } from 'drizzle-orm';
import { alertEmailRateLimits } from '@festgrid/database';
import { db } from '../../db/client.js';
import { MODERATOR_NOTIFY_KEY_PREFIX } from '../alerts/alert-email-budget-store.js';

// Test-only helpers for the row-count ratchet (Story 0.51). `notifyAllModerators` (Story 0.i1a) claims one
// `alert_email_rate_limits` row per template and entity, so a test that reaches it with the real throttle store
// leaves rows behind unless it removes them -- and must never remove a row that existed before the test, so
// cleanup is by "keys created since the snapshot".

async function listKeys(): Promise<string[]> {
  const rows = await db
    .select({ key: alertEmailRateLimits.key })
    .from(alertEmailRateLimits)
    .where(like(alertEmailRateLimits.key, `${MODERATOR_NOTIFY_KEY_PREFIX}%`));
  return rows.map((row) => row.key);
}

/** The moderator-notify throttle keys that already exist. Call before the test acts. */
export async function snapshotModeratorNotifyKeys(): Promise<Set<string>> {
  return new Set(await listKeys());
}

/** Delete only the moderator-notify throttle rows created since `before` was snapshotted. */
export async function deleteModeratorNotifyKeysCreatedSince(before: Set<string>): Promise<void> {
  const created = (await listKeys()).filter((key) => !before.has(key));
  if (created.length > 0) {
    await db.delete(alertEmailRateLimits).where(inArray(alertEmailRateLimits.key, created));
  }
}
