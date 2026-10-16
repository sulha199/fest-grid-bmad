import { getActiveSubscriberUserIds } from '../subscriptions/get-active-subscriber-user-ids.js';
import { getActiveSubscriberUserIdsForPost } from '../subscriptions/get-active-subscriber-user-ids-for-post.js';
import { fetchCandidateKeys } from '../ai-gateway/usage-store.js';
import { selectApiKey, determineSelectionTier } from '@festgrid/domain';

/**
 * Story 3.6z (AC1, AC2) — read-only pre-flight check answering "does this account have a
 * usable Gemini API key right now," reusing the exact same Tier 1/Tier 2 selection building
 * blocks `callGemini` already uses (Story 0.13). Never decrypts a key (no KMS call), never
 * calls Gemini, and never mutates usage counts -- it only answers "does a candidate exist,"
 * not "will the next real call succeed" (rate-limiting is only discoverable by the real call
 * inside `processAiJob`/`callGemini`, unchanged by this story).
 */
export async function hasAvailableApiKeyForAccount(accountId: string): Promise<boolean> {
  const subscriberUserIds = await getActiveSubscriberUserIds(accountId);
  if (subscriberUserIds.length === 0) {
    return false;
  }

  const candidates = await fetchCandidateKeys('gemini', subscriberUserIds);
  const tier = determineSelectionTier(subscriberUserIds);

  return selectApiKey(candidates, tier) !== null;
}

/**
 * Same check, but over the subscribers of every account the post is associated with (PRD 3.7,
 * 2026-10-16) -- the owner, any co-author and the scraping source -- not only `posts.account_id`.
 */
export async function hasAvailableApiKeyForPost(postId: string): Promise<boolean> {
  const subscriberUserIds = await getActiveSubscriberUserIdsForPost(postId);
  if (subscriberUserIds.length === 0) {
    return false;
  }

  const candidates = await fetchCandidateKeys('gemini', subscriberUserIds);
  const tier = determineSelectionTier(subscriberUserIds);

  return selectApiKey(candidates, tier) !== null;
}
