import { db } from '../../db/client.js';
import { users } from '@festgrid/database';
import { eq } from 'drizzle-orm';

// Small shared helper for the moderator-query-and-email pattern used by
// send-dangerous-report-moderator-alerts.ts, send-scraper-audit-alert.ts, and
// send-scraper-provider-down-alerts.ts (Story 3.4q) -- extracted here to avoid
// a fourth exact duplicate of `db.select().from(users).where(eq(users.role,
// 'moderator'))`. Existing call sites are left as-is (out of this story's scope);
// new moderator-alert code should use this instead of re-querying directly.
export async function getModeratorEmails(): Promise<{ id: string; email: string }[]> {
  const moderators = await db.select().from(users).where(eq(users.role, 'moderator'));
  return moderators.map((mod) => ({ id: mod.id, email: mod.email }));
}
