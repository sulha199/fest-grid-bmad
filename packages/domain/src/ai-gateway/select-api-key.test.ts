import { test } from 'node:test';
import assert from 'node:assert';
import { selectApiKey, determineSelectionTier } from './select-api-key.js';
import { ApiKeyCandidate } from './types.js';

test('determineSelectionTier - 0 subscribers -> TIER_2_SHARED_ROUND_ROBIN', () => {
  assert.strictEqual(determineSelectionTier([]), 'TIER_2_SHARED_ROUND_ROBIN');
});

test('determineSelectionTier - 1 subscriber -> TIER_1_USER_SPECIFIC', () => {
  assert.strictEqual(determineSelectionTier(['user-a']), 'TIER_1_USER_SPECIFIC');
});

test('determineSelectionTier - 2+ subscribers -> TIER_2_SHARED_ROUND_ROBIN', () => {
  assert.strictEqual(determineSelectionTier(['user-a', 'user-b']), 'TIER_2_SHARED_ROUND_ROBIN');
  assert.strictEqual(determineSelectionTier(['user-a', 'user-b', 'user-c']), 'TIER_2_SHARED_ROUND_ROBIN');
});

test('selectApiKey - Tier 1: single key', () => {
  const candidates: ApiKeyCandidate[] = [
    { id: '1', userId: 'user-a', usageCount: 5, usageCycleResetAt: new Date().toISOString(), isValid: true, invalidAttempts: 0 }
  ];
  const chosen = selectApiKey(candidates, 'TIER_1_USER_SPECIFIC');
  assert.deepEqual(chosen, candidates[0]);
});

test('selectApiKey - Tier 1: multiple keys picks least usageCount', () => {
  const candidates: ApiKeyCandidate[] = [
    { id: '1', userId: 'user-a', usageCount: 10, usageCycleResetAt: new Date().toISOString(), isValid: true, invalidAttempts: 0 },
    { id: '2', userId: 'user-a', usageCount: 5, usageCycleResetAt: new Date().toISOString(), isValid: true, invalidAttempts: 0 }
  ];
  const chosen = selectApiKey(candidates, 'TIER_1_USER_SPECIFIC');
  assert.equal(chosen?.id, '2');
});

test('selectApiKey - Tier 2: round robin fairness picks least usageCount', () => {
  const candidates: ApiKeyCandidate[] = [
    { id: '1', userId: 'user-a', usageCount: 12, usageCycleResetAt: new Date().toISOString(), isValid: true, invalidAttempts: 0 },
    { id: '2', userId: 'user-b', usageCount: 4, usageCycleResetAt: new Date().toISOString(), isValid: true, invalidAttempts: 0 },
    { id: '3', userId: 'user-c', usageCount: 8, usageCycleResetAt: new Date().toISOString(), isValid: true, invalidAttempts: 0 }
  ];
  const chosen = selectApiKey(candidates, 'TIER_2_SHARED_ROUND_ROBIN');
  assert.equal(chosen?.id, '2');
});

test('selectApiKey - excludes invalid and explicitly excluded keys', () => {
  const candidates: ApiKeyCandidate[] = [
    { id: '1', userId: 'user-a', usageCount: 2, usageCycleResetAt: new Date().toISOString(), isValid: false, invalidAttempts: 6 },
    { id: '2', userId: 'user-b', usageCount: 1, usageCycleResetAt: new Date().toISOString(), isValid: true, invalidAttempts: 0 },
    { id: '3', userId: 'user-c', usageCount: 0, usageCycleResetAt: new Date().toISOString(), isValid: true, invalidAttempts: 0 }
  ];
  // Exclude id '3' explicitly, id '1' is invalid. So only id '2' should be available.
  const chosen = selectApiKey(candidates, 'TIER_2_SHARED_ROUND_ROBIN', new Set(['3']));
  assert.equal(chosen?.id, '2');
});

test('selectApiKey - returns null when no candidate remains', () => {
  const candidates: ApiKeyCandidate[] = [
    { id: '1', userId: 'user-a', usageCount: 2, usageCycleResetAt: new Date().toISOString(), isValid: false, invalidAttempts: 5 }
  ];
  const chosen = selectApiKey(candidates, 'TIER_1_USER_SPECIFIC');
  assert.equal(chosen, null);
});
