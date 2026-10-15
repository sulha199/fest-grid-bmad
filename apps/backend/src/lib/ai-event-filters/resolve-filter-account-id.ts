import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, subscriptions } from '@festgrid/database';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves the AI filter's free-text `accountId` to a real `social_media_account_profiles.id`.
 *
 * The model is never given profile UUIDs, so what it returns is whatever the user typed: an
 * `@handle`, a bare username or a display name. Left as-is that value can never match an account
 * (BUG-056 stopped it 500-ing; IDEA-065 is this lookup), so the Favorites/Feed list silently came
 * back empty.
 *
 * Cost: one lookup per AI prompt, behind a multi-second Gemini call. Step 1 is scoped through the
 * user's own subscriptions (`idx_subscriptions_active`, a handful of rows); step 2 is an exact
 * lower(username) equality with LIMIT 1 -- no `ILIKE '%…%'`, so it never degrades into a
 * pattern scan. Display names are matched only inside the subscribed set for the same reason.
 *
 * Returns null when nothing matches (caller drops the filter and says so as a caveat).
 */
export async function resolveFilterAccountId(
  userId: string,
  raw: string
): Promise<string | null> {
  const value = raw.trim();
  if (value === '') return null;
  if (UUID_PATTERN.test(value)) return value;

  const needle = value.replace(/^@+/, '').trim().toLowerCase();
  if (needle === '') return null;

  // 1. The user's own subscribed accounts: username OR display name.
  const subscribed = await db
    .select({ id: socialMediaAccountProfiles.id })
    .from(subscriptions)
    .innerJoin(socialMediaAccountProfiles, eq(subscriptions.accountId, socialMediaAccountProfiles.id))
    .where(
      and(
        eq(subscriptions.userId, userId),
        isNull(subscriptions.deletedAt),
        sql`(lower(${socialMediaAccountProfiles.username}) = ${needle} OR lower(${socialMediaAccountProfiles.displayName}) = ${needle})`
      )
    )
    .limit(1);
  if (subscribed[0]) return subscribed[0].id;

  // 2. Any discoverable account, exact username only.
  const anyAccount = await db
    .select({ id: socialMediaAccountProfiles.id })
    .from(socialMediaAccountProfiles)
    .where(
      and(
        sql`lower(${socialMediaAccountProfiles.username}) = ${needle}`,
        eq(socialMediaAccountProfiles.isVerifiedForDiscovery, true)
      )
    )
    .limit(1);
  return anyAccount[0]?.id ?? null;
}
