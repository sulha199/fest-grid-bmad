import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import {
  accountProfileRepairs,
  posts,
  scraperActorRuns,
  socialMediaAccountProfiles,
  subscriptions,
} from '@festgrid/database';
import { activeOnly } from '@festgrid/graphql-select';
import { isNumericAccountId, normalizeHandle, resolveScrapeHandle } from '@festgrid/domain';

/**
 * BUG-081 -- repair for the 2026-10-26 incident: `backfillAccountProfileAndInferDefaultLocation` rewrote the
 * `username` and `display_name` of handle-keyed profiles with the first scraped post's owner (a collab or
 * curator-feed account), and the batch then scraped that owner instead of the subscribed account.
 *
 * Run from `scripts/repair-rewritten-profile-usernames.ts` (dry run by default). Never called from a request path.
 *
 * - Handle-keyed rows (`account_id` is the handle a user subscribed with) are restored automatically:
 *   `username = account_id`, and `display_name` from the newest post the account itself published.
 * - Numeric-keyed rows (`account_id` is the platform ID) are only REPORTED. Their `account_id` carries no
 *   handle to restore from, so a human has to decide, with the vendor evidence printed beside the row.
 */

export const REPAIR_KIND = 'REWRITTEN_USERNAME_RESTORE';

type NumericVerdict = 'LABEL_MATCHES_VENDOR' | 'LABEL_CONFLICTS_WITH_VENDOR' | 'NO_VENDOR_EVIDENCE';

export interface HandleKeyedRepairPlan {
  profileId: string;
  accountId: string;
  currentUsername: string;
  currentDisplayName: string;
  updatedAt: Date;
  restoreUsername: string;
  /** Null when no post the account published is on file: the display name is then left as it is. */
  restoreDisplayName: string | null;
  displayNameEvidencePostUrl: string | null;
}

export interface NumericKeyedFinding {
  profileId: string;
  accountId: string;
  username: string;
  displayName: string;
  updatedAt: Date;
  activeSubscriptions: number;
  /** Handles the vendor paired with this platform ID in the profile's most recent scrape runs. */
  vendorHandles: string[];
  /** Owner handles of the posts stored under this profile, most frequent first (context only). */
  postOwnerHandles: { handle: string; posts: number }[];
  verdict: NumericVerdict;
}

/** A handle-keyed Instagram profile whose `username` no longer matches the handle it is keyed by. */
export function isRewrittenHandleKeyedProfile(profile: {
  platform: string;
  accountId: string;
  username: string;
}): boolean {
  return (
    profile.platform === 'instagram' &&
    !isNumericAccountId(profile.accountId) &&
    normalizeHandle(profile.username) !== normalizeHandle(profile.accountId)
  );
}

/**
 * Every handle the vendor paired with `platformId` in one run's `raw_output`: an item's
 * `ownerId`/`ownerUsername`, a coauthor's `id`/`username` (Apify), or `user_posted_id`/`user_posted` (Bright Data).
 * `raw_output` is sometimes a JSON string holding the array (drizzle/postgres.js double-encoding), so a string is
 * parsed first. Anything unparseable yields no handles instead of throwing.
 */
export function extractVendorHandlesForId(rawOutput: unknown, platformId: string): string[] {
  let value = rawOutput;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  const items: unknown[] = Array.isArray(value) ? value : [];
  const handles = new Set<string>();
  const add = (candidate: unknown) => {
    const handle = typeof candidate === 'string' ? normalizeHandle(candidate) : '';
    if (handle) handles.add(handle);
  };

  for (const entry of items) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    if (String(item.ownerId ?? '') === platformId) add(item.ownerUsername);
    if (String(item.user_posted_id ?? '') === platformId) add(item.user_posted);
    const coauthors = Array.isArray(item.coauthorProducers) ? item.coauthorProducers : [];
    for (const coauthor of coauthors) {
      if (coauthor && typeof coauthor === 'object' && String((coauthor as Record<string, unknown>).id ?? '') === platformId) {
        add((coauthor as Record<string, unknown>).username);
      }
    }
  }
  return [...handles];
}

export function classifyNumericKeyedLabel(username: string, vendorHandles: string[]): NumericVerdict {
  if (vendorHandles.length === 0) return 'NO_VENDOR_EVIDENCE';
  return vendorHandles.includes(normalizeHandle(username)) ? 'LABEL_MATCHES_VENDOR' : 'LABEL_CONFLICTS_WITH_VENDOR';
}

/** Read-only. Every handle-keyed Instagram profile whose username was rewritten, with what would be restored. */
export async function planHandleKeyedRepairs(): Promise<HandleKeyedRepairPlan[]> {
  const candidates = await db
    .select()
    .from(socialMediaAccountProfiles)
    .where(
      and(
        eq(socialMediaAccountProfiles.platform, 'instagram'),
        sql`${socialMediaAccountProfiles.accountId} !~ '^[0-9]+$'`
      )
    );

  const plans: HandleKeyedRepairPlan[] = [];
  for (const profile of candidates) {
    if (!isRewrittenHandleKeyedProfile(profile)) continue;

    const [ownPost] = await db
      .select({ ownerDisplayName: posts.ownerDisplayName, postUrl: posts.postUrl })
      .from(posts)
      .where(
        and(
          eq(posts.platform, 'instagram'),
          isNotNull(posts.ownerDisplayName),
          sql`btrim(${posts.ownerDisplayName}) <> ''`,
          sql`lower(${posts.ownerUsername}) = ${normalizeHandle(profile.accountId)}`
        )
      )
      .orderBy(desc(posts.publishedAt))
      .limit(1);

    const evidenceName = ownPost?.ownerDisplayName?.trim() || null;
    plans.push({
      profileId: profile.id,
      accountId: profile.accountId,
      currentUsername: profile.username,
      currentDisplayName: profile.displayName,
      updatedAt: profile.updatedAt,
      restoreUsername: resolveScrapeHandle(profile),
      restoreDisplayName: evidenceName && evidenceName !== profile.displayName ? evidenceName : null,
      displayNameEvidencePostUrl: evidenceName ? ownPost!.postUrl : null,
    });
  }
  return plans;
}

/**
 * Read-only. Subscribed numeric-keyed Instagram profiles, each with the handle(s) the vendor paired with its ID in
 * the profile's newest scrape runs. Nothing here is ever applied automatically.
 */
export async function findNumericKeyedFindings(): Promise<NumericKeyedFinding[]> {
  const rows = await db
    .select({
      profile: socialMediaAccountProfiles,
      activeSubscriptions: sql<number>`count(${subscriptions.id})`.mapWith(Number),
    })
    .from(socialMediaAccountProfiles)
    .innerJoin(subscriptions, eq(subscriptions.accountId, socialMediaAccountProfiles.id))
    .where(
      and(
        eq(socialMediaAccountProfiles.platform, 'instagram'),
        sql`${socialMediaAccountProfiles.accountId} ~ '^[0-9]+$'`,
        activeOnly(subscriptions)
      )
    )
    .groupBy(socialMediaAccountProfiles.id);

  const findings: NumericKeyedFinding[] = [];
  for (const { profile, activeSubscriptions } of rows) {
    const runs = await db
      .select({ rawOutput: scraperActorRuns.rawOutput })
      .from(scraperActorRuns)
      .where(and(eq(scraperActorRuns.profileId, profile.id), isNotNull(scraperActorRuns.rawOutput)))
      .orderBy(desc(scraperActorRuns.startedAt))
      .limit(5);
    const vendorHandles = [...new Set(runs.flatMap((run) => extractVendorHandlesForId(run.rawOutput, profile.accountId)))];

    const ownerCounts = await db
      .select({ handle: sql<string>`lower(${posts.ownerUsername})`, posts: sql<number>`count(*)`.mapWith(Number) })
      .from(posts)
      .where(and(eq(posts.accountId, profile.id), isNotNull(posts.ownerUsername)))
      .groupBy(sql`lower(${posts.ownerUsername})`)
      .orderBy(desc(sql`count(*)`))
      .limit(5);

    findings.push({
      profileId: profile.id,
      accountId: profile.accountId,
      username: profile.username,
      displayName: profile.displayName,
      updatedAt: profile.updatedAt,
      activeSubscriptions,
      vendorHandles,
      postOwnerHandles: ownerCounts,
      verdict: classifyNumericKeyedLabel(profile.username, vendorHandles),
    });
  }
  return findings;
}

export type HandleKeyedRepairResult = { status: 'repaired'; repairId: string } | { status: 'skipped'; reason: string };

/**
 * Applies one handle-keyed repair in a single transaction together with its audit row, so a repair either leaves a
 * `account_profile_repairs` row or never happened. The row is re-read under a lock and re-checked first: a profile
 * repaired by someone else since the plan was made is skipped, so re-running the script is harmless.
 */
export async function applyHandleKeyedRepair(
  plan: HandleKeyedRepairPlan,
  performedBy: string
): Promise<HandleKeyedRepairResult> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from social_media_account_profiles where id = ${plan.profileId} for update`);
    const [current] = await tx
      .select()
      .from(socialMediaAccountProfiles)
      .where(eq(socialMediaAccountProfiles.id, plan.profileId));

    if (!current) {
      return { status: 'skipped', reason: 'profile no longer exists' } as const;
    }
    if (!isRewrittenHandleKeyedProfile(current)) {
      return { status: 'skipped', reason: 'username already matches account_id' } as const;
    }

    const restoreDisplayName = plan.restoreDisplayName ?? current.displayName;
    const before = { username: current.username, displayName: current.displayName };
    const after = { username: plan.restoreUsername, displayName: restoreDisplayName };

    await tx
      .update(socialMediaAccountProfiles)
      .set({ username: after.username, displayName: after.displayName, updatedAt: new Date() })
      .where(eq(socialMediaAccountProfiles.id, plan.profileId));

    const [audit] = await tx
      .insert(accountProfileRepairs)
      .values({
        profileId: plan.profileId,
        repairKind: REPAIR_KIND,
        before,
        after,
        evidence: {
          accountId: plan.accountId,
          displayNameRestored: plan.restoreDisplayName !== null,
          displayNameEvidencePostUrl: plan.displayNameEvidencePostUrl,
        },
        performedBy,
      })
      .returning({ id: accountProfileRepairs.id });

    return { status: 'repaired', repairId: audit.id } as const;
  });
}
