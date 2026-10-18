import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { normalizeUsername } from '@festgrid/domain/scraper';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles } from '@festgrid/database';

const ALL_DIGITS = /^[0-9]+$/;

/**
 * Resolves an account page URL segment to a profile row (Architecture Spine AD-35 Rules 3-4).
 *
 * 1. Match `lower(username)`; the username WINS even when the segment is all digits and equals a
 *    different account's numeric `account_id` (Instagram allows all-digit usernames).
 * 2. Only when nothing matches and the segment is all digits, match `account_id`, so an old
 *    `/ig/<numeric id>` link still resolves (the page then redirects to the username URL).
 *
 * Transitional tie-break: until BUG-059 story 4 merges twin rows, a handle-keyed row and its
 * numeric twin share one username; prefer the numeric-`account_id` row, then the oldest. Remove
 * the numeric ordering once a unique `(platform, lower(username))` index exists.
 *
 * `columns` is the drizzle select object (it must include `id`), so the caller keeps the
 * requested-fields-only projection of the GraphQL layer.
 */
export async function resolveProfileByUsername(
  platform: string,
  segment: string,
  columns: Record<string, PgColumn | SQL>
) {
  const normalized = normalizeUsername(segment);
  if (normalized === '') {
    return undefined;
  }

  const [byUsername] = await db
    .select(columns)
    .from(socialMediaAccountProfiles)
    .where(
      and(
        eq(socialMediaAccountProfiles.platform, platform),
        sql`lower(${socialMediaAccountProfiles.username}) = ${normalized}`
      )
    )
    .orderBy(
      desc(sql`(${socialMediaAccountProfiles.accountId} ~ '^[0-9]+$')`),
      asc(socialMediaAccountProfiles.createdAt),
      asc(socialMediaAccountProfiles.id)
    )
    .limit(1);
  if (byUsername) {
    return byUsername;
  }

  if (!ALL_DIGITS.test(normalized)) {
    return undefined;
  }

  const [byAccountId] = await db
    .select(columns)
    .from(socialMediaAccountProfiles)
    .where(
      and(
        eq(socialMediaAccountProfiles.platform, platform),
        eq(socialMediaAccountProfiles.accountId, normalized)
      )
    )
    .limit(1);
  return byAccountId;
}
