import { ApiKeyCandidate, SelectionTier } from './types.js';

/**
 * Story 3.6z (Task 3) — extracted byte-for-byte from `apps/backend/src/lib/ai-gateway/adapter.ts`'s
 * `callGemini` (no behavior change) so this story's pre-flight key-availability check
 * (`hasAvailableApiKeyForAccount`) can reuse the exact same tier-derivation rule instead of
 * risking the two call sites silently diverging later.
 */
export function determineSelectionTier(subscriberUserIds: string[]): SelectionTier {
  return subscriberUserIds.length === 1 ? 'TIER_1_USER_SPECIFIC' : 'TIER_2_SHARED_ROUND_ROBIN';
}

export function selectApiKey(
  candidates: ApiKeyCandidate[],
  tier: SelectionTier,
  excludeIds?: Set<string>
): ApiKeyCandidate | null {
  const activeCandidates = candidates.filter(c => {
    if (!c.isValid) return false;
    if (excludeIds && excludeIds.has(c.id)) return false;
    return true;
  });

  if (activeCandidates.length === 0) {
    return null;
  }

  // Sort by usageCount ascending. If Tier 2, this implements the fairness round-robin by prioritizing
  // keys from users who have contributed fewer API calls in the current billing cycle.
  // If Tier 1, it picks the least-recently-used key of the sole subscriber.
  const sorted = [...activeCandidates].sort((a, b) => a.usageCount - b.usageCount);
  return sorted[0];
}
