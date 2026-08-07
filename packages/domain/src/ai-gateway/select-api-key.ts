import { ApiKeyCandidate, SelectionTier } from './types.js';

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
