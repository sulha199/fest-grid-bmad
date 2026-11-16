import { and, eq, or, sql } from 'drizzle-orm';
import { socialMediaAccountProfiles } from '@festgrid/database';
import { isScrapableAccountType } from '@festgrid/domain/scraper';
import { db } from '../../db/client.js';

// AD-34 -- the account scrape gate for the two code paths that fetch ONE post by URL: the
// moderator re-extract rescrape (`startPostReextractionPreview`) and `extractEventDataFromUrl`.
// Neither scrapes an account, but both start a scrape, and PRD 3.16 says a personal account, or
// one whose classification still awaits a moderator, is never scraped. The rule itself stays in
// `isScrapableAccountType()`; this file only finds the account row to ask it about.

export const ACCOUNT_NOT_SCRAPABLE_MESSAGE =
  'This post belongs to an account FestDaily does not scrape (a personal account, or one still waiting for a moderator to classify it), so it cannot be fetched.';
export const SCRAPE_IN_PROGRESS_MESSAGE = 'This post is being fetched right now. Try again in a moment.';

type AccountTypeRow = { accountType: 'ORGANIZER_VENUE_EVENT' | 'PERSONAL' | 'CURATOR_GUIDE' | null; accountTypeStatus: 'CONFIRMED' | 'AWAITING_APPROVAL' | null };

function gate(row: AccountTypeRow | undefined): boolean {
  // No row means nothing classifies the account, which is the "never classified" case the rule allows.
  return row === undefined ? true : isScrapableAccountType(row.accountType, row.accountTypeStatus);
}

/** A stored post: gated on its owning account (`posts.account_id` is the profile's uuid). Call BEFORE scraping. */
export async function isStoredPostAccountScrapable(accountProfileId: string): Promise<boolean> {
  const [row] = await db
    .select({ accountType: socialMediaAccountProfiles.accountType, accountTypeStatus: socialMediaAccountProfiles.accountTypeStatus })
    .from(socialMediaAccountProfiles)
    .where(eq(socialMediaAccountProfiles.id, accountProfileId))
    .limit(1);
  return gate(row);
}

/**
 * An unknown URL has no account to look up before the scrape, so what the scrape returned about the
 * post's owner is looked up afterwards: the handle (case-insensitive, against `username` and a
 * handle-keyed `account_id`) and the platform's numeric owner id (against a numeric-keyed
 * `account_id`, which survives a username change). Nothing to match on, or no profile of ours, is
 * allowed: nothing marks it as off limits. Every matching profile must pass.
 */
export async function isOwnerAccountScrapable(
  platform: string,
  owner: { username?: string | null; ownerId?: string | null }
): Promise<boolean> {
  const handle = owner.username?.trim().toLowerCase();
  const ownerId = owner.ownerId?.trim();
  const matchers = [
    ...(handle ? [sql`lower(${socialMediaAccountProfiles.username}) = ${handle}`, sql`lower(${socialMediaAccountProfiles.accountId}) = ${handle}`] : []),
    ...(ownerId ? [eq(socialMediaAccountProfiles.accountId, ownerId)] : []),
  ];
  if (matchers.length === 0) return true;
  const rows = await db
    .select({ accountType: socialMediaAccountProfiles.accountType, accountTypeStatus: socialMediaAccountProfiles.accountTypeStatus })
    .from(socialMediaAccountProfiles)
    .where(and(eq(socialMediaAccountProfiles.platform, platform), or(...matchers)));
  return rows.every((row) => gate(row));
}
