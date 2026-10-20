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

// Prod incident 2026-10-15/2026-10-20 (infokonsermusik, profile 7d2bb351-...): the profile
// UPDATE and the accountTypeClassificationReviews INSERT below used to be two separate
// statements with no transaction. The apiLambda hard timeout killed the invocation between
// them, leaving the profile AWAITING_APPROVAL with no open review row -- invisible to
// `pendingAccountTypeClassificationReviews` and never retried (subscribe-time classification
// only runs when accountTypeStatus IS NULL) and never scrapable (AD-34). Both writes now run in
// one `db.transaction` in both failure paths below, so a kill or write error between them rolls
// back the whole thing instead of leaving the half-state. When the transaction itself fails, we
// throw this (rather than returning a status that was never actually persisted) so a caller
// never acts on a lie.
export class ClassificationPersistenceFailedError extends Error {
  constructor(message: string, public readonly cause: unknown) {
    super(message);
    this.name = 'ClassificationPersistenceFailedError';
  }
}

export let getAccountClassificationProfileSeam = (username: string) => instagramScraperAdapter.getAccountClassificationProfile(username);
export function setGetAccountClassificationProfileSeam(fn: typeof instagramScraperAdapter.getAccountClassificationProfile) {
  getAccountClassificationProfileSeam = fn;
}

export let callGeminiForAccountClassificationSeam = defaultCallGemini;
export function setCallGeminiForAccountClassificationSeam(fn: typeof defaultCallGemini) {
  callGeminiForAccountClassificationSeam = fn;
}

// Test-only injection point for the review-row insert inside both atomic transactions below --
// lets a test simulate the insert failing (e.g. to assert the paired profile update rolls back
// with it) without needing a real DB constraint violation. Production code always goes through
// this seam so the transaction behavior under test is the real one, not a bypass.
type ReviewInsertValues = {
  accountId: string;
  proposedAccountType: 'ORGANIZER_VENUE_EVENT' | 'PERSONAL' | 'CURATOR_GUIDE' | null;
  confidenceScore: number | null;
  failureReason: string | null;
};
export let insertAccountTypeClassificationReviewSeam = async (
  tx: Pick<typeof db, 'insert'>,
  values: ReviewInsertValues
): Promise<unknown> => tx.insert(accountTypeClassificationReviews).values(values);
export function setInsertAccountTypeClassificationReviewSeam(fn: typeof insertAccountTypeClassificationReviewSeam) {
  insertAccountTypeClassificationReviewSeam = fn;
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
      // Record as awaiting approval because of low confidence (no hard failure reason).
      // Atomic: the profile update and the review-row insert commit or fail together (see
      // ClassificationPersistenceFailedError above).
      try {
        await db.transaction(async (tx) => {
          await tx.update(socialMediaAccountProfiles)
            .set({
              accountType,
              accountTypeStatus: 'AWAITING_APPROVAL',
              accountTypeConfidenceScore: confidenceScore,
              updatedAt: new Date()
            })
            .where(eq(socialMediaAccountProfiles.id, accountId));

          await insertAccountTypeClassificationReviewSeam(tx, {
            accountId,
            proposedAccountType: accountType,
            confidenceScore,
            failureReason: null
          });
        });
      } catch (dbErr) {
        console.error(`[classifyAccountType] Failed to persist low-confidence classification for ${username}:`, dbErr);
        throw new ClassificationPersistenceFailedError(
          'Failed to persist low-confidence account classification and review row',
          dbErr
        );
      }

      return { accountType, accountTypeStatus: 'AWAITING_APPROVAL' };
    }

    // On success above threshold. Single statement, so no atomicity concern, but the write
    // error must still propagate rather than be swallowed by the generic catch below into a
    // status that was never actually persisted (edge-case regression guard, 2026-10-20).
    try {
      await db.update(socialMediaAccountProfiles)
        .set({
          accountType,
          accountTypeStatus: 'CONFIRMED',
          accountTypeConfidenceScore: confidenceScore,
          updatedAt: new Date()
        })
        .where(eq(socialMediaAccountProfiles.id, accountId));
    } catch (dbErr) {
      console.error(`[classifyAccountType] Failed to persist confirmed classification for ${username}:`, dbErr);
      throw new ClassificationPersistenceFailedError(
        'Failed to persist confirmed account classification',
        dbErr
      );
    }

    return { accountType, accountTypeStatus: 'CONFIRMED' };

  } catch (error: any) {
    // A persistence failure must propagate, never collapse into a return value that claims a
    // status was written when it wasn't (that's exactly the swallow-into-success-looking-return
    // shape the 2026-10-15 incident needs fixed). Anything else is a genuinely unexpected bug --
    // for that case alone, fall back to the pre-existing AWAITING_APPROVAL-with-nulls return
    // (unchanged legacy behavior, out of this fix's scope).
    if (error instanceof ClassificationPersistenceFailedError) {
      throw error;
    }
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
  // Atomic: the profile update and the review-row insert commit or fail together. A write
  // failure (including a mid-transaction kill) rolls both statements back -- no orphan
  // AWAITING_APPROVAL profile without an open review row -- and is NOT swallowed here; it
  // propagates via ClassificationPersistenceFailedError so the caller never returns a status
  // that was never actually persisted.
  try {
    await db.transaction(async (tx) => {
      await tx.update(socialMediaAccountProfiles)
        .set({
          accountType: proposedAccountType,
          accountTypeStatus: 'AWAITING_APPROVAL',
          accountTypeConfidenceScore: confidenceScore,
          updatedAt: new Date()
        })
        .where(eq(socialMediaAccountProfiles.id, accountId));

      await insertAccountTypeClassificationReviewSeam(tx, {
        accountId,
        proposedAccountType,
        confidenceScore,
        failureReason
      });
    });
  } catch (dbErr) {
    console.error('[classifyAccountType] Failed to persist hard-failure classification and review row:', dbErr);
    throw new ClassificationPersistenceFailedError(
      'Failed to persist hard-failure account classification and review row',
      dbErr
    );
  }

  return { accountType: proposedAccountType, accountTypeStatus: 'AWAITING_APPROVAL' };
}
