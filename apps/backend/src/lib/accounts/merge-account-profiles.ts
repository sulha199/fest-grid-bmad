import { sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { accountProfileMerges } from '@festgrid/database';

/**
 * BUG-059 / spec-profile-identity-unification section 4 -- merges a "twin" profile (a second
 * `social_media_account_profiles` row for the same platform account) into its survivor.
 *
 * This is a migration tool, run from `scripts/merge-twin-profiles.ts` with a dry-run default. It is
 * deliberately not called from any request path.
 *
 * Everything that points at the twin is repointed to the survivor BEFORE the twin is deleted:
 * `scraper_actor_runs`, `apify_pending_jobs` and `brightdata_pending_jobs` cascade on delete, so
 * deleting first would silently destroy run history and in-flight jobs. The twin's full row and
 * every id moved are kept in `account_profile_merges`.
 *
 * The survivor keeps its `account_id` and `id` (URLs unchanged). Re-keying the survivor to the
 * platform's numeric ID is a later, separate step in the design's runbook.
 */

type Row = Record<string, any>;

export interface ProfileMergePlan {
  survivor: Row;
  twin: Row;
  /** Posts where the twin is PUBLISHER, the survivor is SCRAPING_SOURCE and owner_username equals the username. */
  evidenceCount: number;
  /** Reasons the merge must not run, regardless of evidence. */
  blockers: string[];
  /** True when the vendor itself proved both rows are one account and no blocker applies. */
  safeToAutoMerge: boolean;
}

async function selectProfile(executor: typeof db, id: string): Promise<Row | undefined> {
  const rows = (await executor.execute(
    sql`select * from social_media_account_profiles where id = ${id}`
  )) as unknown as Row[];
  return rows[0];
}

/** Read-only: evidence and blockers for merging `twinId` into `survivorId`. */
export async function planAccountProfileMerge(survivorId: string, twinId: string): Promise<ProfileMergePlan> {
  const survivor = await selectProfile(db, survivorId);
  const twin = await selectProfile(db, twinId);
  if (!survivor) throw new Error(`Survivor profile not found: ${survivorId}`);
  if (!twin) throw new Error(`Twin profile not found: ${twinId}`);

  const blockers: string[] = [];
  if (survivorId === twinId) blockers.push('survivor and twin are the same row');
  if (survivor.platform !== twin.platform) blockers.push('profiles are on different platforms');
  if (String(survivor.username).toLowerCase() !== String(twin.username).toLowerCase()) {
    blockers.push('usernames differ');
  }
  if (
    survivor.account_type &&
    twin.account_type &&
    survivor.account_type_status === 'CONFIRMED' &&
    twin.account_type_status === 'CONFIRMED' &&
    survivor.account_type !== twin.account_type
  ) {
    blockers.push(`confirmed account types differ (${survivor.account_type} vs ${twin.account_type})`);
  }
  if (Boolean(survivor.is_image_storage_opted_in) !== Boolean(twin.is_image_storage_opted_in)) {
    blockers.push('image-storage opt-in differs (consent must not be inferred)');
  }

  const [{ n }] = (await db.execute(sql`
    select count(*)::int as n
    from post_account_associations pub
    join post_account_associations src
      on src.post_id = pub.post_id and src.role = 'SCRAPING_SOURCE' and src.account_id = ${survivorId}
    join posts p on p.id = pub.post_id
    where pub.account_id = ${twinId}
      and pub.role = 'PUBLISHER'
      and lower(p.owner_username) = lower(${survivor.username})
  `)) as unknown as { n: number }[];

  return {
    survivor,
    twin,
    evidenceCount: n,
    blockers,
    safeToAutoMerge: blockers.length === 0 && n > 0,
  };
}

export interface MergeAccountProfilesOptions {
  survivorId: string;
  twinId: string;
  /** Who ran the merge: a moderator id or e.g. `script:merge-twin-profiles`. Stored in the audit row. */
  performedBy: string;
  /** Merge even when no vendor evidence exists (a human has confirmed the identity). Blockers still apply. */
  allowWithoutEvidence?: boolean;
}

export interface MergeAccountProfilesResult {
  mergeId: string;
  repointed: Record<string, unknown>;
}

const ids = (rows: unknown): string[] => (rows as { id: string }[]).map((r) => r.id);

export async function mergeAccountProfiles(options: MergeAccountProfilesOptions): Promise<MergeAccountProfilesResult> {
  const { survivorId, twinId, performedBy, allowWithoutEvidence = false } = options;

  const plan = await planAccountProfileMerge(survivorId, twinId);
  if (plan.blockers.length > 0) {
    throw new Error(`Refusing to merge ${twinId} into ${survivorId}: ${plan.blockers.join('; ')}`);
  }
  if (plan.evidenceCount === 0 && !allowWithoutEvidence) {
    throw new Error(
      `Refusing to merge ${twinId} into ${survivorId}: no vendor-proven evidence (a post published by the twin and scraped under the survivor with a matching owner username)`
    );
  }

  return db.transaction(async (tx) => {
    // Lock both rows in id order so two concurrent merges cannot deadlock, then re-read: the plan
    // above ran outside the transaction.
    await tx.execute(sql`
      select id from social_media_account_profiles where id in (${survivorId}, ${twinId}) order by id for update
    `);
    const twinRow = await selectProfile(tx as unknown as typeof db, twinId);
    const survivorRow = await selectProfile(tx as unknown as typeof db, survivorId);
    if (!twinRow || !survivorRow) {
      throw new Error('Profile disappeared before the merge could lock it');
    }

    const repointed: Record<string, unknown> = {};

    // Scraper run history and in-flight jobs (all three cascade on profile delete).
    repointed.scraperActorRuns = ids(await tx.execute(sql`
      update scraper_actor_runs set profile_id = ${survivorId}, updated_at = now()
      where profile_id = ${twinId} returning id`));
    repointed.apifyPendingJobs = ids(await tx.execute(sql`
      update apify_pending_jobs set profile_id = ${survivorId}, updated_at = now()
      where profile_id = ${twinId} returning id`));
    repointed.brightdataPendingJobs = ids(await tx.execute(sql`
      update brightdata_pending_jobs set profile_id = ${survivorId}, updated_at = now()
      where profile_id = ${twinId} returning id`));

    // Posts.
    repointed.posts = ids(await tx.execute(sql`
      update posts set account_id = ${survivorId}, updated_at = now()
      where account_id = ${twinId} returning id`));

    // Post-account associations. The per-post partial unique indexes (one publisher, one scraping
    // source) cannot be violated by a repoint, because each post has at most one such row and it
    // belongs to exactly one of the two profiles. The only collision is the same (post, role) on
    // both rows, which can happen for COAUTHOR (several allowed per post): keep the survivor's.
    const droppedAssociations: unknown[] = [];
    droppedAssociations.push(...((await tx.execute(sql`
      delete from post_account_associations t
      using post_account_associations s
      where t.account_id = ${twinId} and s.account_id = ${survivorId}
        and s.post_id = t.post_id and s.role = t.role
      returning t.id, t.post_id, t.role`)) as unknown as unknown[]));
    repointed.associationsDropped = droppedAssociations;
    repointed.associations = ids(await tx.execute(sql`
      update post_account_associations set account_id = ${survivorId}, updated_at = now()
      where account_id = ${twinId} returning id`));

    // Subscriptions: repoint, then keep one active row per user (the earliest).
    repointed.subscriptions = ids(await tx.execute(sql`
      update subscriptions set account_id = ${survivorId}, updated_at = now()
      where account_id = ${twinId} returning id`));
    repointed.subscriptionsSoftDeleted = ids(await tx.execute(sql`
      update subscriptions s set deleted_at = now(), updated_at = now()
      where s.account_id = ${survivorId} and s.deleted_at is null
        and exists (
          select 1 from subscriptions o
          where o.account_id = s.account_id and o.user_id = s.user_id and o.deleted_at is null
            and (o.created_at < s.created_at or (o.created_at = s.created_at and o.id < s.id))
        )
      returning s.id`));

    // Votes: unique (user, account). An active twin vote re-activates a withdrawn survivor vote; the
    // twin's duplicate is then dropped and the rest repointed.
    await tx.execute(sql`
      update account_votes s set deleted_at = null
      from account_votes t
      where s.account_id = ${survivorId} and t.account_id = ${twinId}
        and t.user_id = s.user_id and t.deleted_at is null and s.deleted_at is not null`);
    repointed.votesDropped = (await tx.execute(sql`
      delete from account_votes t using account_votes s
      where t.account_id = ${twinId} and s.account_id = ${survivorId} and s.user_id = t.user_id
      returning t.id, t.user_id`)) as unknown as unknown[];
    repointed.votes = ids(await tx.execute(sql`
      update account_votes set account_id = ${survivorId}
      where account_id = ${twinId} returning id`));

    // Audit-style tables with no uniqueness on the account.
    repointed.defaultLocationChangeRequests = ids(await tx.execute(sql`
      update default_location_change_requests set account_id = ${survivorId}
      where account_id = ${twinId} returning id`));
    repointed.classificationReviews = ids(await tx.execute(sql`
      update account_type_classification_reviews set account_id = ${survivorId}
      where account_id = ${twinId} returning id`));

    // events.source_social_media_account_id is a text copy of the profile's account_id with no FK.
    repointed.eventsRewritten = ids(await tx.execute(sql`
      update events set source_social_media_account_id = ${survivorRow.account_id}, updated_at = now()
      where source_social_media_account_id = ${twinRow.account_id} returning id`));

    // Fold the twin's facts into the survivor: the survivor's value wins, blanks are filled. Account
    // type and image opt-in are never taken from the twin (a difference is a blocker above).
    await tx.execute(sql`
      update social_media_account_profiles s set
        description = coalesce(s.description, t.description),
        default_location = coalesce(s.default_location, t.default_location),
        discovery_source = coalesce(s.discovery_source, t.discovery_source),
        first_seen = least(s.first_seen, t.first_seen),
        last_seen = greatest(s.last_seen, t.last_seen),
        last_post_date = greatest(s.last_post_date, t.last_post_date),
        is_verified_for_discovery = (s.is_verified_for_discovery or t.is_verified_for_discovery),
        updated_at = now()
      from social_media_account_profiles t
      where s.id = ${survivorId} and t.id = ${twinId}`);

    const [audit] = await tx
      .insert(accountProfileMerges)
      .values({
        survivorId,
        twinAccountId: String(twinRow.account_id),
        twinSnapshot: twinRow,
        performedBy,
        evidence: {
          evidenceCount: plan.evidenceCount,
          allowedWithoutEvidence: plan.evidenceCount === 0 && allowWithoutEvidence,
          survivorAccountId: survivorRow.account_id,
        },
        repointed,
      })
      .returning({ id: accountProfileMerges.id });

    // Nothing references the twin any more; this delete cascades to nothing.
    await tx.execute(sql`delete from social_media_account_profiles where id = ${twinId}`);

    return { mergeId: audit.id, repointed };
  });
}

export interface TwinGroup {
  platform: string;
  username: string;
  /** Rows in the group, best survivor first. */
  profiles: (Row & { active_subscriptions: number; post_count: number })[];
}

/** Read-only: every (platform, lower(username)) group with more than one profile row. */
export async function findTwinGroups(): Promise<TwinGroup[]> {
  const rows = (await db.execute(sql`
    select a.*,
      (select count(*)::int from subscriptions s where s.account_id = a.id and s.deleted_at is null) as active_subscriptions,
      (select count(*)::int from posts p where p.account_id = a.id) as post_count
    from social_media_account_profiles a
    where (a.platform, lower(a.username)) in (
      select platform, lower(username) from social_media_account_profiles group by 1, 2 having count(*) > 1
    )
    order by a.platform, lower(a.username), a.created_at
  `)) as unknown as (Row & { active_subscriptions: number; post_count: number })[];

  const groups = new Map<string, TwinGroup>();
  for (const row of rows) {
    const key = `${row.platform}|${String(row.username).toLowerCase()}`;
    if (!groups.has(key)) {
      groups.set(key, { platform: row.platform, username: String(row.username).toLowerCase(), profiles: [] });
    }
    groups.get(key)!.profiles.push(row);
  }
  for (const group of groups.values()) {
    group.profiles.sort((a, b) => survivorScore(b) - survivorScore(a) || +new Date(a.created_at) - +new Date(b.created_at));
  }
  return [...groups.values()];
}

/** Higher wins: active subscriptions, then a confirmed account type, a default location, then opt-in. */
function survivorScore(p: Row & { active_subscriptions: number }): number {
  return (
    Math.min(p.active_subscriptions, 99) * 1000 +
    (p.account_type_status === 'CONFIRMED' ? 100 : 0) +
    (p.default_location ? 10 : 0) +
    (p.is_image_storage_opted_in ? 1 : 0)
  );
}
