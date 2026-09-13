import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isLocationTrustworthy,
  MIN_TRUSTWORTHY_CONFIDENCE,
  TRUSTWORTHY_MATCH_TYPE,
  LocationConfidenceSignal,
} from './is-location-trustworthy.js';

function signal(overrides: Partial<LocationConfidenceSignal> = {}): LocationConfidenceSignal {
  return { confidence: 0.9, matchType: 'full_match', ...overrides };
}

test('isLocationTrustworthy accepts a high-confidence full_match', () => {
  assert.equal(isLocationTrustworthy(signal({ confidence: 0.9, matchType: 'full_match' })), true);
});

test('isLocationTrustworthy rejects a below-bar confidence with full_match', () => {
  assert.equal(isLocationTrustworthy(signal({ confidence: 0.3, matchType: 'full_match' })), false);
});

test('isLocationTrustworthy rejects an above-bar confidence with a non-full_match matchType (AND, not OR)', () => {
  assert.equal(isLocationTrustworthy(signal({ confidence: 0.9, matchType: 'match_by_building' })), false);
});

test('isLocationTrustworthy rejects a missing (undefined) confidence', () => {
  assert.equal(isLocationTrustworthy(signal({ confidence: undefined, matchType: 'full_match' })), false);
});

test('isLocationTrustworthy rejects a null confidence (the GraphQL-generator shape)', () => {
  assert.equal(isLocationTrustworthy(signal({ confidence: null, matchType: 'full_match' })), false);
});

test('isLocationTrustworthy accepts the exact boundary confidence (>=, not >)', () => {
  assert.equal(isLocationTrustworthy(signal({ confidence: 0.5, matchType: 'full_match' })), true);
});

test('isLocationTrustworthy rejects a missing/undefined matchType', () => {
  assert.equal(isLocationTrustworthy(signal({ matchType: undefined })), false);
});

test('isLocationTrustworthy rejects a null matchType (the GraphQL-generator shape)', () => {
  assert.equal(isLocationTrustworthy(signal({ matchType: null })), false);
});

test('constants reflect the recorded design bar', () => {
  assert.equal(MIN_TRUSTWORTHY_CONFIDENCE, 0.5);
  assert.equal(TRUSTWORTHY_MATCH_TYPE, 'full_match');
});
