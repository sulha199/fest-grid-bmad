import { db } from '../../db/client.js';
import { socialMediaAccountProfiles } from '@festgrid/database';
import { resolveDiscoveredIdentityNames } from '@festgrid/domain/scraper';

interface DiscoveredIdentityInput {
  platform: string;
  accountId: string;
  username?: string;
  displayName?: string;
  vendor: string;
  runId?: string;
}

/**
 * Gets-or-creates exactly one `social_media_account_profiles` row for a
 * publisher/coauthor identity discovered during scraping/ingestion (Story 3.14).
 *
 * Unlike `subscribeToAccount`'s existing lookup-or-create pattern (select,
 * onConflictDoNothing, re-select), this uses a single atomic `onConflictDoUpdate`
 * upsert -- the first use of that Drizzle shape in this codebase. It is the
 * natural fit here: on conflict we always want to advance `lastSeen`, but never
 * touch `firstSeen`/`discoverySource`/`displayName`/`username`, which falls out
 * structurally from the `set` clause only including `lastSeen`/`updatedAt` --
 * no race window, no second query.
 *
 * A newly created profile defaults `isVerifiedForDiscovery: false` and is never
 * subscribed and never triggers a scrape -- that is Story 3.16's job.
 */
export async function getOrCreateDiscoveredAccountProfile(identity: DiscoveredIdentityInput) {
  const { displayName, username } = resolveDiscoveredIdentityNames(identity);
  const now = new Date();

  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: identity.accountId,
      platform: identity.platform,
      username,
      displayName,
      firstSeen: now,
      lastSeen: now,
      discoverySource: { vendor: identity.vendor, runId: identity.runId },
      isVerifiedForDiscovery: false,
    })
    .onConflictDoUpdate({
      target: [socialMediaAccountProfiles.platform, socialMediaAccountProfiles.accountId],
      set: { lastSeen: now, updatedAt: now },
    })
    .returning();

  return profile;
}
