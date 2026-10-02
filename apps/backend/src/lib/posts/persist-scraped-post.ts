import { db } from '../../db/client.js';
import { posts } from '@festgrid/database';
import { eq, or } from 'drizzle-orm';
import { parseImageUrlExpiry, parsePlatformPostIdentity } from '@festgrid/domain/scraper';
import { getOrCreateDiscoveredAccountProfile } from '../accounts/get-or-create-discovered-account-profile.js';
import { persistPostAccountAssociations } from './persist-post-account-associations.js';

interface PersistScrapedPostParams {
  accountId: string;
  platform: string;
  content: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  postUrl: string;
  originalPostUrl?: string | null;
  publishedAt: string;
  scraperActorRunId?: string;
  locationName?: string | null;
  ownerDisplayName?: string | null;
  ownerUsername?: string | null;
  hashtags?: string[] | null;
  additionalImageUrls?: string[] | null;
  /** The publisher's stable platform account ID (Apify's ScrapedPost.ownerId), Story 3.14. */
  ownerId?: string;
  /** Normalized coauthor identities (Apify's coauthorProducers), Story 3.14. */
  coauthors?: { accountId: string; username?: string }[];
  /**
   * Explicit, caller-supplied vendor label (e.g. 'apify') for discovered-identity
   * provenance tracking (Story 3.14). Deliberately NOT derived implicitly from the
   * presence of ownerId/coauthors -- see this story's Dev Notes "Design Decisions".
   */
  discoverySourceVendor?: string;
}

interface ResolvedDiscoveredIdentities {
  /** The resolved `social_media_account_profiles.id` of the publisher, if resolvable. */
  publisherProfileId?: string;
  /** The resolved `social_media_account_profiles.id`s of every coauthor that resolved successfully. */
  coauthorProfileIds: string[];
}

/**
 * Resolves publisher/coauthor identity discovery for the given post (Story 3.14
 * AC1/AC2/AC3/AC5, restructured by Story 3.15 to run before the existing-post-vs-new-post
 * branch decision and to **return** its resolved ids instead of only firing side-effect
 * writes). Runs on EVERY persistScrapedPost call -- not gated on whether the post itself
 * was newly inserted -- since lastSeen tracks "this identity was observed again," not
 * "this exact post object is new" (see Dev Notes).
 *
 * A no-op (both fields absent/empty) when neither `ownerId` nor `coauthors` is present.
 * Each `getOrCreateDiscoveredAccountProfile` call is wrapped in its own try/catch -- on
 * failure, that identity's id is simply omitted from the returned result, which is what
 * makes Story 3.15 AC3's "or when publisher resolution itself fails" fallback work with
 * zero extra branching at the call site.
 */
async function resolveDiscoveredIdentities({
  platform,
  scraperActorRunId,
  ownerId,
  ownerUsername,
  ownerDisplayName,
  coauthors,
  discoverySourceVendor,
}: {
  platform: string;
  scraperActorRunId?: string;
  ownerId?: string;
  ownerUsername?: string | null;
  ownerDisplayName?: string | null;
  coauthors?: { accountId: string; username?: string }[];
  discoverySourceVendor?: string;
}): Promise<ResolvedDiscoveredIdentities> {
  const result: ResolvedDiscoveredIdentities = { coauthorProfileIds: [] };

  if (!ownerId && !(coauthors && coauthors.length > 0)) {
    return result;
  }

  if (!discoverySourceVendor) {
    // Defensive guard against future drift -- every current call site passes
    // discoverySourceVendor whenever ownerId/coauthors is present (Task 5). This
    // should never happen in practice.
    console.error(
      `persistScrapedPost: ownerId/coauthors present but discoverySourceVendor missing for platform ${platform}; skipping identity processing`
    );
    return result;
  }

  if (ownerId) {
    try {
      const profile = await getOrCreateDiscoveredAccountProfile({
        platform,
        accountId: ownerId,
        username: ownerUsername ?? undefined,
        displayName: ownerDisplayName ?? undefined,
        vendor: discoverySourceVendor,
        runId: scraperActorRunId,
      });
      result.publisherProfileId = profile.id;
    } catch (err) {
      console.error(`Failed to get-or-create discovered account profile for publisher ${ownerId} on platform ${platform}`, err);
    }
  }

  if (coauthors && coauthors.length > 0) {
    for (const coauthor of coauthors) {
      try {
        const profile = await getOrCreateDiscoveredAccountProfile({
          platform,
          accountId: coauthor.accountId,
          username: coauthor.username,
          vendor: discoverySourceVendor,
          runId: scraperActorRunId,
        });
        result.coauthorProfileIds.push(profile.id);
      } catch (err) {
        console.error(`Failed to get-or-create discovered account profile for coauthor ${coauthor.accountId} on platform ${platform}`, err);
      }
    }
  }

  return result;
}

export async function persistScrapedPost({
  accountId,
  platform,
  content,
  imageUrl,
  videoUrl,
  postUrl,
  originalPostUrl,
  publishedAt,
  scraperActorRunId,
  locationName,
  ownerDisplayName,
  ownerUsername,
  hashtags,
  additionalImageUrls,
  ownerId,
  coauthors,
  discoverySourceVendor,
}: PersistScrapedPostParams) {
  // Resolve publisher/coauthor identities once, before the existing-post-vs-new-post
  // branch decision (Story 3.15) -- unlike Story 3.14's original placement, the
  // new-post branch below now needs the resolved publisher profile id *before* its
  // own INSERT runs (AC3: it is the FK target for posts.accountId).
  const { publisherProfileId, coauthorProfileIds } = await resolveDiscoveredIdentities({
    platform,
    scraperActorRunId,
    ownerId,
    ownerUsername,
    ownerDisplayName,
    coauthors,
    discoverySourceVendor,
  });

  // 1. Try to find the existing post using the dual-lookup logic
  const conditions = originalPostUrl
    ? or(eq(posts.postUrl, postUrl), eq(posts.originalPostUrl, originalPostUrl))
    : eq(posts.postUrl, postUrl);

  let post = await db
    .select()
    .from(posts)
    .where(conditions)
    .limit(1)
    .then((rows) => rows[0]);

  if (post) {
    const backfillPatch: Record<string, unknown> = {};
    if (!post.videoUrl && videoUrl) {
      backfillPatch.videoUrl = videoUrl;
    }
    if (!post.imageUrl && imageUrl) {
      backfillPatch.imageUrl = imageUrl;
      backfillPatch.imageUrlExpiresAt = parseImageUrlExpiry(imageUrl);
    }

    if (Object.keys(backfillPatch).length > 0) {
      const [updated] = await db
        .update(posts)
        .set(backfillPatch)
        .where(eq(posts.id, post.id))
        .returning();
      post = updated;
    }

    // Already-existed branch: post.accountId is never touched here (unchanged, matches
    // AC3's "for new posts" framing and the existing backfillPatch mechanism's scope).
    // The resolved identities are still written to the association table (AC2/AC4/AC5).
    await persistPostAccountAssociations({
      postId: post.id,
      scrapingAccountId: accountId,
      publisherAccountId: publisherProfileId,
      coauthorAccountIds: coauthorProfileIds,
      scraperActorRunId,
    });

    return {
      post,
      alreadyExisted: true,
    };
  }

  // 2. If absent, insert a new row with onConflictDoNothing
  const imageUrlExpiresAt = parseImageUrlExpiry(imageUrl);
  const { platformPostId, platformPostType } = parsePlatformPostIdentity({ postUrl, originalPostUrl });

  // New-post branch only (AC3): posts.accountId resolves to the verified canonical
  // publisher profile id when the vendor owner identity was present and resolved
  // successfully, falling back to today's scraping-account value (the caller-supplied
  // `accountId`) otherwise. `accountId` itself is left untouched -- it is still needed
  // below as the SCRAPING_SOURCE association target regardless of what wins here.
  const insertValues = {
    accountId: publisherProfileId ?? accountId,
    platform,
    content,
    imageUrl,
    videoUrl,
    postUrl,
    originalPostUrl,
    publishedAt: new Date(publishedAt),
    scraperActorRunId,
    locationName,
    ownerDisplayName,
    ownerUsername,
    hashtags,
    imageUrlExpiresAt,
    additionalImageUrls,
    platformPostId,
    platformPostType,
  };

  try {
    await db
      .insert(posts)
      .values(insertValues)
      .onConflictDoNothing({
        target: [posts.postUrl],
      });
  } catch (err) {
    // Graceful FK error handling (AC7 per Story 3-4j): catch FK violations and log without rethrowing
    const dbErr = err as any;
    if (dbErr?.code === '23503') {
      console.warn(
        `FK constraint violation inserting post ${postUrl} with runId ${scraperActorRunId}; retrying without run link`,
        err
      );
      try {
        await db
          .insert(posts)
          .values({
            ...insertValues,
            scraperActorRunId: null,
          })
          .onConflictDoNothing({
            target: [posts.postUrl],
          });
      } catch (retryErr) {
        console.error(`Failed to persist post ${postUrl} on fallback without run link`, retryErr);
        throw retryErr;
      }
    } else {
      throw err;
    }
  }

  // Re-select to get the inserted row (race-safe)
  post = await db
    .select()
    .from(posts)
    .where(eq(posts.postUrl, postUrl))
    .limit(1)
    .then((rows) => rows[0]);

  await persistPostAccountAssociations({
    postId: post.id,
    scrapingAccountId: accountId,
    publisherAccountId: publisherProfileId,
    coauthorAccountIds: coauthorProfileIds,
    scraperActorRunId,
  });

  return {
    post,
    alreadyExisted: false,
  };
}
