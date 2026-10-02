import { db } from '../../db/client.js';
import { posts } from '@festgrid/database';
import { eq, or } from 'drizzle-orm';
import { parseImageUrlExpiry, parsePlatformPostIdentity } from '@festgrid/domain/scraper';
import { getOrCreateDiscoveredAccountProfile } from '../accounts/get-or-create-discovered-account-profile.js';

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

/**
 * Processes publisher/coauthor identity discovery for the given post, non-blockingly
 * (Story 3.14 AC1/AC2/AC3/AC5). Runs on EVERY persistScrapedPost call -- not gated on
 * whether the post itself was newly inserted -- since lastSeen tracks "this identity
 * was observed again," not "this exact post object is new" (see Dev Notes).
 */
async function processDiscoveredIdentities({
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
}): Promise<void> {
  if (!ownerId && !(coauthors && coauthors.length > 0)) {
    return;
  }

  if (!discoverySourceVendor) {
    // Defensive guard against future drift -- every current call site passes
    // discoverySourceVendor whenever ownerId/coauthors is present (Task 5). This
    // should never happen in practice.
    console.error(
      `persistScrapedPost: ownerId/coauthors present but discoverySourceVendor missing for platform ${platform}; skipping identity processing`
    );
    return;
  }

  if (ownerId) {
    try {
      await getOrCreateDiscoveredAccountProfile({
        platform,
        accountId: ownerId,
        username: ownerUsername ?? undefined,
        displayName: ownerDisplayName ?? undefined,
        vendor: discoverySourceVendor,
        runId: scraperActorRunId,
      });
    } catch (err) {
      console.error(`Failed to get-or-create discovered account profile for publisher ${ownerId} on platform ${platform}`, err);
    }
  }

  if (coauthors && coauthors.length > 0) {
    for (const coauthor of coauthors) {
      try {
        await getOrCreateDiscoveredAccountProfile({
          platform,
          accountId: coauthor.accountId,
          username: coauthor.username,
          vendor: discoverySourceVendor,
          runId: scraperActorRunId,
        });
      } catch (err) {
        console.error(`Failed to get-or-create discovered account profile for coauthor ${coauthor.accountId} on platform ${platform}`, err);
      }
    }
  }
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

    await processDiscoveredIdentities({
      platform,
      scraperActorRunId,
      ownerId,
      ownerUsername,
      ownerDisplayName,
      coauthors,
      discoverySourceVendor,
    });

    return {
      post,
      alreadyExisted: true,
    };
  }

  // 2. If absent, insert a new row with onConflictDoNothing
  const imageUrlExpiresAt = parseImageUrlExpiry(imageUrl);
  const { platformPostId, platformPostType } = parsePlatformPostIdentity({ postUrl, originalPostUrl });

  const insertValues = {
    accountId,
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

  await processDiscoveredIdentities({
    platform,
    scraperActorRunId,
    ownerId,
    ownerUsername,
    ownerDisplayName,
    coauthors,
    discoverySourceVendor,
  });

  return {
    post,
    alreadyExisted: false,
  };
}
