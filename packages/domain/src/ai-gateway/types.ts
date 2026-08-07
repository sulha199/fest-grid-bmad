export interface ApiKeyCandidate {
  id: string;
  userId: string;
  usageCount: number;
  usageCycleResetAt: string; /* ISO string */
  isValid: boolean;
  invalidAttempts: number;
}

export type SelectionTier = 'TIER_1_USER_SPECIFIC' | 'TIER_2_SHARED_ROUND_ROBIN';
