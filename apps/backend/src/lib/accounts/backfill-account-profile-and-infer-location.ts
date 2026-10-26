import { db } from '../../db/client.js';
import { socialMediaAccountProfiles } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { ScrapedPost } from '@festgrid/domain';
import {
  computeProfileBackfillPatch,
  selectOwnPostForBackfill,
  buildLocationInferenceRequest,
  parseLocationInferenceResponse,
} from '@festgrid/domain';
import { getActiveSubscriberUserIds } from '../subscriptions/get-active-subscriber-user-ids.js';
import { callGeminiForLocationInference } from '../ai-gateway/system-key-adapter.js';
import { resolveLocation as defaultResolveLocation } from '../geolocation/adapter.js';
import { applyDefaultLocationChange } from './apply-default-location-change.js';

export let resolveLocationSeam = defaultResolveLocation;
export function setResolveLocationSeam(fn: typeof defaultResolveLocation) {
  resolveLocationSeam = fn;
}

export async function backfillAccountProfileAndInferDefaultLocation(
  accountId: string,
  scrapedPosts: ScrapedPost[]
): Promise<void> {
  try {
    if (scrapedPosts.length === 0) {
      return;
    }

    // 1. Fetch the social_media_account_profiles row by id = accountId
    const [profile] = await db
      .select()
      .from(socialMediaAccountProfiles)
      .where(eq(socialMediaAccountProfiles.id, accountId))
      .limit(1);

    if (!profile) {
      console.error(`[backfillAccountProfileAndInferDefaultLocation] Profile not found for accountId: ${accountId}`);
      return;
    }

    // 2. Profile backfill (AC1, AC2). Owner data is applied only from a post this profile's OWN
    // account published: a profile scrape also returns collab, repost and curator-feed posts whose
    // owner is someone else, and applying one of those rewrote `username`, which the scraper builds
    // its next target from (BUG-081).
    const backfillPost = selectOwnPostForBackfill(
      { accountId: profile.accountId, username: profile.username || '' },
      scrapedPosts
    );

    if (!backfillPost && scrapedPosts.some((post) => post.ownerDisplayName || post.ownerUsername)) {
      console.log(
        `[backfillAccountProfileAndInferDefaultLocation] No scraped post is owned by profile ${profile.accountId} (${accountId}); name fields left unchanged.`
      );
    }

    if (backfillPost) {
      const patch = computeProfileBackfillPatch(
        { accountId: profile.accountId, displayName: profile.displayName || '', username: profile.username || '' },
        { ownerDisplayName: backfillPost.ownerDisplayName, ownerUsername: backfillPost.ownerUsername }
      );
      if (patch) {
        await db
          .update(socialMediaAccountProfiles)
          .set({
            ...patch,
            updatedAt: new Date(),
          })
          .where(eq(socialMediaAccountProfiles.id, accountId));

        if (patch.displayName) {
          profile.displayName = patch.displayName;
        }
        if (patch.username) {
          profile.username = patch.username;
        }
      }
    }

    // 3. Location inference (AC3-AC9)
    if (profile.defaultLocation !== null) {
      return; // AC8: do not call Gemini if default location is already set
    }

    let promptRequest = null;
    for (const post of scrapedPosts) {
      promptRequest = buildLocationInferenceRequest(post);
      if (promptRequest) {
        break;
      }
    }

    if (!promptRequest) {
      return; // no usable signal anywhere in the batch
    }

    const subscriberUserIds = await getActiveSubscriberUserIds(accountId);
    const result = await callGeminiForLocationInference({
      ...promptRequest,
      provider: 'gemini',
      subscriberUserIds,
    });

    const inference = parseLocationInferenceResponse(result.text);
    if (!inference) {
      return; // Gemini found nothing, not an error
    }

    const resolved = await resolveLocationSeam({ kind: 'ADDRESS', address: inference.placeDescription });
    await applyDefaultLocationChange({
      accountId,
      newLocation: resolved,
      previousLocation: null,
      changedByUserId: null,
      changeSource: 'AI_INFERENCE',
      confidenceScore: inference.confidence,
      accountDisplayName: profile.displayName,
      onlyIfCurrentlyNull: true,
    });

  } catch (error) {
    console.error(
      `[backfillAccountProfileAndInferDefaultLocation] Error processing account enrichment for accountId: ${accountId}:`,
      error
    );
  }
}
