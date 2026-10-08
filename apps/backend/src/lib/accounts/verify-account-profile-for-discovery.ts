import { db } from '../../db/client.js';
import { socialMediaAccountProfiles } from '@festgrid/database';
import { and, eq } from 'drizzle-orm';

/**
 * Flip `isVerifiedForDiscovery` false -> true for a profile. Shared by `subscribeToAccount`
 * (Story 3.16, AC4) and `castVote` (Story 3.17) -- both are "real demand" signals that make a
 * scrape-discovered profile eligible for broad discovery surfaces. The flip is one-way --
 * nothing in this codebase ever sets `isVerifiedForDiscovery` back to `false`.
 *
 * Idempotent no-op when the profile is already `true` (the `WHERE ... = false` clause matches
 * zero rows) or when `profileId` does not exist -- returns `undefined` in both cases, never
 * throws.
 */
export async function verifyAccountProfileForDiscovery(profileId: string) {
  const [verified] = await db
    .update(socialMediaAccountProfiles)
    .set({ isVerifiedForDiscovery: true })
    .where(
      and(
        eq(socialMediaAccountProfiles.id, profileId),
        eq(socialMediaAccountProfiles.isVerifiedForDiscovery, false)
      )
    )
    .returning();

  return verified;
}
