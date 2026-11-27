import { and, asc, desc, eq, exists, sql, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { normalizeUsername } from '@festgrid/domain/scraper';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, subscriptions } from '@festgrid/database';
import { activeOnly } from '@festgrid/graphql-select';

const ALL_DIGITS = /^[0-9]+$/;

/**
 * Resolves an account page URL segment to a profile row (Architecture Spine AD-35 Rules 3-4).
 *
 * 1. Match `lower(username)`; the username WINS even when the segment is all digits and equals a
 *    different account's numeric `account_id` (Instagram allows all-digit usernames).
 * 2. Only when nothing matches and the segment is all digits, match `account_id`, so an old
 *    `/ig/<numeric id>` link still resolves (the page then redirects to the username URL).
 *
 * Transitional tie-break (AD-35 Rule 4, amended 2026-11-27): while twin rows exist, rows share one
 * username. Prefer, in order: a row with an ACTIVE subscription (soft-deleted ones do not count),
 * a row that has been scraped (`last_scraped_at` set), then the numeric-`account_id` row, then the
 * oldest `created_at`, then id. A subscribed, scraped handle row must not lose to an empty numeric
 * twin. Remove the whole tie-break once a unique `(platform, lower(username))` index exists.
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
      // Correlated to the outer profile row: `subscriptions.account_id = profiles.id`.
      desc(
        exists(
          db
            .select({ one: sql`1` })
            .from(subscriptions)
            .where(
              and(eq(subscriptions.accountId, socialMediaAccountProfiles.id), activeOnly(subscriptions))
            )
        )
      ),
      desc(sql`(${socialMediaAccountProfiles.lastScrapedAt} is not null)`),
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
