import { and, eq, or, sql } from 'drizzle-orm';
import { socialMediaAccountProfiles } from '@festgrid/database';
import { isScrapableAccountType } from '@festgrid/domain/scraper';
import { db } from '../../db/client.js';

// AD-34 -- the account scrape gate for the two code paths that fetch ONE post by URL: the
// moderator re-extract rescrape (`startPostReextractionPreview`) and `extractEventDataFromUrl`.
// Neither scrapes an account, but both start a scrape, and PRD 3.16 says a personal account, or
// one whose classification still awaits a moderator, is never scraped. The rule itself stays in
// `isScrapableAccountType()`; this file only finds the account row to ask it about.

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
 * An unknown URL has no account to look up before the scrape, so the scrape's own `ownerUsername`
 * is looked up afterwards. A username we do not know is allowed (nothing marks it as off limits);
 * a known account is judged by the same rule as everywhere else. Matches a profile keyed by the
 * handle too (`account_id` = handle), case-insensitively.
 */
export async function isOwnerAccountScrapable(platform: string, ownerUsername: string | null | undefined): Promise<boolean> {
  const handle = ownerUsername?.trim().toLowerCase();
  if (!handle) return true;
  const rows = await db
    .select({ accountType: socialMediaAccountProfiles.accountType, accountTypeStatus: socialMediaAccountProfiles.accountTypeStatus })
    .from(socialMediaAccountProfiles)
    .where(
      and(
        eq(socialMediaAccountProfiles.platform, platform),
        or(sql`lower(${socialMediaAccountProfiles.username}) = ${handle}`, sql`lower(${socialMediaAccountProfiles.accountId}) = ${handle}`)
      )
    );
  // Every matching profile must pass: one non-scrapable account of that handle refuses the post.
  return rows.every((row) => gate(row));
}
