import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles } from '@festgrid/database';

/** Lower-case, trimmed, no leading `@`: how a username is compared. */
export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase();
}

/**
 * STOPGAP (BUG-059) -- finds an existing profile row for a platform account by its username.
 *
 * Subscribing keys a profile by the typed handle while scrape ingestion keys it by the vendor's
 * numeric owner ID, so one platform account could become two rows ("twins") and its posts ended up
 * on the row nobody subscribed to. Every path that creates a profile calls this first and reuses
 * what it finds. The permanent fix is the numeric-`account_id` identity model in
 * `_bmad-output/specs/spec-profile-identity-unification/DESIGN.md`, which replaces this lookup.
 *
 * Known limitation: a username can be reassigned on the platform, so a stale row could match a new
 * owner of the name. The design's rename/reuse checks address that; this lookup does not.
 *
 * `handleKeyedOnly` restricts the match to rows whose `account_id` is not all digits, i.e. rows
 * created from a typed handle (Instagram is the only platform in use).
 */
export async function findProfileByUsername(
  platform: string,
  username: string,
  options: { handleKeyedOnly?: boolean } = {}
) {
  const normalized = normalizeUsername(username);
  if (normalized === '') {
    return undefined;
  }

  const conditions = [
    eq(socialMediaAccountProfiles.platform, platform),
    sql`lower(${socialMediaAccountProfiles.username}) = ${normalized}`,
  ];
  if (options.handleKeyedOnly) {
    conditions.push(sql`${socialMediaAccountProfiles.accountId} !~ '^[0-9]+$'`);
  }

  const [row] = await db
    .select()
    .from(socialMediaAccountProfiles)
    .where(and(...conditions))
    .orderBy(asc(socialMediaAccountProfiles.createdAt))
    .limit(1);
  return row;
}
