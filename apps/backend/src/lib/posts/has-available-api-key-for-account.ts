import { getActiveSubscriberUserIds } from '../subscriptions/get-active-subscriber-user-ids.js';
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
