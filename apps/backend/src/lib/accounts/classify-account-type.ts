import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, accountTypeClassificationReviews } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { instagramScraperAdapter } from '../scraper/instagram-adapter.js';
import {
  buildAccountClassificationRequest,
  parseAccountClassificationResponse
} from '@festgrid/domain/scraper';
import { callGeminiForAccountClassification as defaultCallGemini } from '../ai-gateway/system-key-adapter.js';

const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;

export let getAccountClassificationProfileSeam = (username: string) => instagramScraperAdapter.getAccountClassificationProfile(username);
export function setGetAccountClassificationProfileSeam(fn: typeof instagramScraperAdapter.getAccountClassificationProfile) {
  getAccountClassificationProfileSeam = fn;
}

export let callGeminiForAccountClassificationSeam = defaultCallGemini;
export function setCallGeminiForAccountClassificationSeam(fn: typeof defaultCallGemini) {
  callGeminiForAccountClassificationSeam = fn;
}

export async function classifyAccountType(params: {
  accountId: string;
  username: string;
  userId: string;
}): Promise<{
  accountType: 'ORGANIZER_VENUE_EVENT' | 'PERSONAL' | 'CURATOR_GUIDE' | null;
  accountTypeStatus: 'CONFIRMED' | 'AWAITING_APPROVAL';
}> {
  const { accountId, username, userId } = params;

  try {
    // 1. Fetch profile
    let profile: { biography: string; username: string; displayName: string; businessCategoryName: string | null } | null = null;
    try {
      profile = await getAccountClassificationProfileSeam(username);
    } catch (err: any) {
      console.error(`[classifyAccountType] Apify adapter lookup failed for ${username}:`, err);
      // Hard failure: proceed to step 4 with error recorded
      return await handleHardFailure(accountId, null, null, `Apify lookup failed: ${err.message}`);
    }

    if (!profile) {
      console.error(`[classifyAccountType] Apify adapter returned null profile for ${username}`);
      return await handleHardFailure(accountId, null, null, 'Apify profile not found');
    }

    // 2. Build and call Gemini
    const promptRequest = buildAccountClassificationRequest(profile);
    let geminiResult;
    try {
      geminiResult = await callGeminiForAccountClassificationSeam({
        ...promptRequest,
        provider: 'gemini',
        subscriberUserIds: [userId] // acting user passed in directly, NOT getActiveSubscriberUserIds
      });
    } catch (err: any) {
      console.error(`[classifyAccountType] Gemini call failed for ${username}:`, err);
      return await handleHardFailure(accountId, null, null, `Gemini call failed: ${err.message}`);
    }

    // 3. Parse response
    const classification = parseAccountClassificationResponse(geminiResult.text);
    if (!classification) {
      console.error(`[classifyAccountType] Failed to parse Gemini response for ${username}: "${geminiResult.text}"`);
      return await handleHardFailure(accountId, null, null, 'Failed to parse Gemini response');
    }

    const { accountType, confidenceScore } = classification;

    // Check confidence threshold
    if (confidenceScore < DEFAULT_CONFIDENCE_THRESHOLD) {
      console.log(`[classifyAccountType] Confidence score ${confidenceScore} below threshold ${DEFAULT_CONFIDENCE_THRESHOLD} for ${username}`);
      // Record as awaiting approval because of low confidence (no hard failure reason)
      await db.update(socialMediaAccountProfiles)
        .set({
          accountType,
          accountTypeStatus: 'AWAITING_APPROVAL',
          accountTypeConfidenceScore: confidenceScore,
          updatedAt: new Date()
        })
        .where(eq(socialMediaAccountProfiles.id, accountId));

      await db.insert(accountTypeClassificationReviews)
        .values({
          accountId,
          proposedAccountType: accountType,
          confidenceScore,
          failureReason: null
        });

      return { accountType, accountTypeStatus: 'AWAITING_APPROVAL' };
    }

    // On success above threshold
    await db.update(socialMediaAccountProfiles)
      .set({
        accountType,
        accountTypeStatus: 'CONFIRMED',
        accountTypeConfidenceScore: confidenceScore,
        updatedAt: new Date()
      })
      .where(eq(socialMediaAccountProfiles.id, accountId));

    return { accountType, accountTypeStatus: 'CONFIRMED' };

  } catch (error: any) {
    console.error(`[classifyAccountType] Unexpected critical error in classifyAccountType for accountId ${accountId}:`, error);
    return { accountType: null, accountTypeStatus: 'AWAITING_APPROVAL' };
  }
}

async function handleHardFailure(
  accountId: string,
  proposedAccountType: 'ORGANIZER_VENUE_EVENT' | 'PERSONAL' | 'CURATOR_GUIDE' | null,
  confidenceScore: number | null,
  failureReason: string
): Promise<{
  accountType: 'ORGANIZER_VENUE_EVENT' | 'PERSONAL' | 'CURATOR_GUIDE' | null;
  accountTypeStatus: 'AWAITING_APPROVAL';
}> {
  try {
    await db.update(socialMediaAccountProfiles)
      .set({
        accountType: proposedAccountType,
        accountTypeStatus: 'AWAITING_APPROVAL',
        accountTypeConfidenceScore: confidenceScore,
        updatedAt: new Date()
      })
      .where(eq(socialMediaAccountProfiles.id, accountId));

    await db.insert(accountTypeClassificationReviews)
      .values({
        accountId,
        proposedAccountType,
        confidenceScore,
        failureReason
      });
  } catch (dbErr) {
    console.error('[classifyAccountType] Failed to write hard failure to DB:', dbErr);
  }

  return { accountType: proposedAccountType, accountTypeStatus: 'AWAITING_APPROVAL' };
}
