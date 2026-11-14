import { inArray } from 'drizzle-orm';
import { alertEmailRateLimits } from '@festgrid/database';
import { db } from '../../db/client.js';

// Test-only helper for the row-count ratchet (Story 0.51). `notifyAllModerators` (Story 0.i1a) claims one
// `alert_email_rate_limits` row per template and entity, so a test that reaches it with the real throttle store
// leaves rows behind unless it removes them. A test deletes EXACTLY the keys it caused, computed with
// `buildModeratorNotifyThrottleKey` from entities unique to its run -- never "everything created since a
// snapshot", which would also delete the rows of a test file running in parallel.

/** Delete the throttle rows with exactly these keys (a key with no row is ignored). */
export async function deleteModeratorNotifyKeys(keys: Iterable<string>): Promise<void> {
  const list = [...new Set(keys)];
  if (list.length > 0) {
    await db.delete(alertEmailRateLimits).where(inArray(alertEmailRateLimits.key, list));
  }
}
