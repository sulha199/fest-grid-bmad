import { sql } from 'drizzle-orm';
import { userSettings, users } from '@festgrid/database';

/**
 * The one place a NEW `user_settings` row's values are built (Story 10.13, notify when a job finishes). Every code path that can create the
 * row (`getOrCreateUserSettings`, `markJobsOpened`, the announcer's `recordNoticeSent`) uses it, so the Jobs badge watermark of a new row is
 * the account's creation time, exactly what `countJobsFinishedSinceLastOpened` assumes for a user with no row. Without it the column default
 * `now()` would silently hide every ended job the user had not seen yet from the badge, the moment any path created the row.
 * `overrides` wins (an explicit "opened now" or "notice sent now" passes its own value).
 */
export function newUserSettingsValues(userId: string, overrides: Partial<typeof userSettings.$inferInsert> = {}): typeof userSettings.$inferInsert {
  return {
    userId,
    // A subquery (one statement, no extra round trip); `now()` only if the user row is somehow not visible (the foreign key rejects it anyway).
    jobsLastOpenedAt: sql`coalesce((select ${users.createdAt} from ${users} where ${users.id} = ${userId}), now())` as unknown as Date,
    ...overrides,
  };
}
